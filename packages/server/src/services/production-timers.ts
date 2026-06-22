import type { Server } from 'socket.io';
import { WsEvent, RECIPE_BY_KEY } from '@merchant-realms/shared';
import { db } from '../db/client.js';

let io: Server | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function initProductionTimers(socketServer: Server): void {
  io = socketServer;
}

export function scheduleCompletion(buildingId: string, completesAt: Date): void {
  const existing = timers.get(buildingId);
  if (existing) clearTimeout(existing);

  const delayMs = Math.max(0, completesAt.getTime() - Date.now());
  timers.set(buildingId, setTimeout(() => void complete(buildingId), delayMs));
}

export function cancelCompletion(buildingId: string): void {
  const t = timers.get(buildingId);
  if (t) { clearTimeout(t); timers.delete(buildingId); }
}

async function complete(buildingId: string): Promise<void> {
  timers.delete(buildingId);

  const task = await db.productionTask.findUnique({
    where: { buildingId },
    include: {
      building: true,
      keep: {
        include: {
          warehouse: { include: { items: true } },
          empire: { select: { playerId: true } },
          productionOrders: { orderBy: { position: 'asc' } },
        },
      },
    },
  });
  if (!task) return;

  const recipe = RECIPE_BY_KEY[task.recipeKey];
  if (!recipe) return;

  const warehouseId = task.keep.warehouseId;
  if (!warehouseId) return;

  const items = task.keep.warehouse?.items ?? [];
  const ledger = new Map(items.map((i) => [i.resourceType, i.quantity]));

  // Check all inputs are available
  for (const input of recipe.inputs) {
    if ((ledger.get(input.resource) ?? 0) < input.quantity) {
      // Mark building dormant and notify
      await db.building.update({ where: { id: buildingId }, data: { isDormant: true } });
      await db.productionTask.delete({ where: { buildingId } });
      io?.to(`player:${task.keep.empire.playerId}`).emit(WsEvent.PRODUCTION_BLOCKED, {
        keepId:    task.keepId,
        buildingId,
        recipeKey: task.recipeKey,
        missing:   recipe.inputs.filter((i) => (ledger.get(i.resource) ?? 0) < i.quantity).map((i) => i.resource),
      });
      return;
    }
  }

  // Consume inputs + add output atomically
  await db.$transaction(async (tx) => {
    // Deduct inputs
    for (const input of recipe.inputs) {
      const current = ledger.get(input.resource) ?? 0;
      const remaining = current - input.quantity;
      if (remaining <= 0) {
        await tx.warehouseItem.delete({ where: { warehouseId_resourceType: { warehouseId, resourceType: input.resource } } });
      } else {
        await tx.warehouseItem.update({ where: { warehouseId_resourceType: { warehouseId, resourceType: input.resource } }, data: { quantity: remaining } });
      }
    }

    // Add output
    await tx.warehouseItem.upsert({
      where:  { warehouseId_resourceType: { warehouseId, resourceType: recipe.output } },
      create: { warehouseId, resourceType: recipe.output, quantity: recipe.outputQty },
      update: { quantity: { increment: recipe.outputQty } },
    });

    // Delete completed task
    await tx.productionTask.delete({ where: { buildingId } });

    // Update production order
    const order = task.keep.productionOrders.find((o) => o.buildingType === task.building.buildingType && o.recipeKey === task.recipeKey);
    if (order) {
      const newProduced = order.producedQuantity + recipe.outputQty;
      const isDone = order.orderType === 'NUMERICAL' && order.targetQuantity != null && newProduced >= order.targetQuantity;
      if (isDone) {
        await tx.productionOrder.delete({ where: { id: order.id } });
      } else {
        await tx.productionOrder.update({ where: { id: order.id }, data: { producedQuantity: newProduced } });
      }
    }
  });

  // Re-read warehouse for the emit payload
  const updatedWarehouse = await db.warehouseItem.findMany({ where: { warehouseId } });

  io?.to(`player:${task.keep.empire.playerId}`).emit(WsEvent.PRODUCTION_COMPLETED, {
    keepId:        task.keepId,
    buildingId,
    recipeKey:     task.recipeKey,
    warehouseItems: updatedWarehouse,
  });

  // Try to start the next cycle
  await scheduleNextCycle(buildingId, task.keepId, task.building.buildingType);
}

async function scheduleNextCycle(buildingId: string, keepId: string, buildingType: string): Promise<void> {
  const nextOrder = await db.productionOrder.findFirst({
    where:   { keepId, buildingType },
    orderBy: { position: 'asc' },
  });
  if (!nextOrder) return;

  const recipe = RECIPE_BY_KEY[nextOrder.recipeKey];
  if (!recipe) return;

  const now        = new Date();
  const completesAt = new Date(now.getTime() + recipe.timeMinutes * 60 * 1000);

  await db.productionTask.create({
    data: {
      buildingId,
      keepId,
      recipeKey:       nextOrder.recipeKey,
      startedAt:       now,
      completesAt,
      progressAtUpdate: 0,
      speedSnapshot:   1.0,
    },
  });

  scheduleCompletion(buildingId, completesAt);
}

// Called once at server startup to recover in-flight tasks.
export async function rescheduleActiveTasks(): Promise<void> {
  const tasks = await db.productionTask.findMany();
  for (const t of tasks) {
    scheduleCompletion(t.buildingId, t.completesAt);
  }
  if (tasks.length > 0) {
    console.log(`[production] rescheduled ${tasks.length} active task(s)`);
  }
}

// Creates a ProductionTask for a building that has no active task but has
// queued orders. Called from the route when an order is added to an idle building.
export async function startTask(
  buildingId: string,
  keepId:     string,
  recipeKey:  string,
): Promise<void> {
  const recipe = RECIPE_BY_KEY[recipeKey];
  if (!recipe) return;

  // Idempotent — don't create a second task if one already exists
  const existing = await db.productionTask.findUnique({ where: { buildingId } });
  if (existing) return;

  const now         = new Date();
  const completesAt = new Date(now.getTime() + recipe.timeMinutes * 60 * 1000);

  await db.productionTask.create({
    data: {
      buildingId,
      keepId,
      recipeKey,
      startedAt:       now,
      completesAt,
      progressAtUpdate: 0,
      speedSnapshot:   1.0,
    },
  });

  scheduleCompletion(buildingId, completesAt);
}
