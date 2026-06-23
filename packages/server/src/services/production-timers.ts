import type { Server } from 'socket.io';
import {
  WsEvent,
  RECIPE_BY_KEY,
  RECIPE_BY_ID,
  getStarterSpeedMultiplier,
} from '@merchant-realms/shared';
import type { ResourceType } from '@merchant-realms/shared';
import { db } from '../db/client.js';

let io: Server | null = null;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function initProductionTimers(socketServer: Server): void {
  io = socketServer;
}

export function scheduleCompletion(buildingId: number, completesAt: Date): void {
  const existing = timers.get(buildingId);
  if (existing) clearTimeout(existing);

  const delayMs = Math.max(0, completesAt.getTime() - Date.now());
  timers.set(buildingId, setTimeout(() => void complete(buildingId), delayMs));
}

export function cancelCompletion(buildingId: number): void {
  const t = timers.get(buildingId);
  if (t) { clearTimeout(t); timers.delete(buildingId); }
}

// ── Speed helper ─────────────────────────────────────────────────────────────

async function getSpeedMultiplier(keepId: number): Promise<number> {
  const keep = await db.keep.findUnique({
    where:   { id: keepId },
    include: { empire: { select: { createdAt: true } } },
  });
  if (!keep) return 1;
  const ageDays = (Date.now() - keep.empire.createdAt.getTime()) / 86_400_000;
  return getStarterSpeedMultiplier(ageDays);
}

// ── Start a production cycle ─────────────────────────────────────────────────
// Deducts recipe inputs upfront, creates ProductionTask, schedules timer.
// Returns silently (building halted) if inputs are insufficient.

export async function startTask(
  buildingId: number,
  keepId:     number,
  recipeId:   number,
): Promise<void> {
  const existing = await db.productionTask.findUnique({ where: { buildingId } });
  if (existing) return;

  const recipeKey = RECIPE_BY_ID[recipeId];
  if (!recipeKey) return;
  const recipe = RECIPE_BY_KEY[recipeKey];
  if (!recipe) return;

  const keep = await db.keep.findUnique({
    where:   { id: keepId },
    include: { empire: { select: { createdAt: true } }, warehouse: { include: { items: true } } },
  });
  if (!keep?.warehouseId) return;

  const warehouseId = keep.warehouseId;
  const ledger      = new Map((keep.warehouse?.items ?? []).map((i) => [i.resourceType, i.quantity]));

  // Halt silently if inputs are insufficient
  for (const input of recipe.inputs) {
    if ((ledger.get(input.resource) ?? 0) < input.quantity) return;
  }

  const ageDays     = (Date.now() - keep.empire.createdAt.getTime()) / 86_400_000;
  const mult        = getStarterSpeedMultiplier(ageDays);
  const now         = new Date();
  const completesAt = new Date(now.getTime() + (recipe.timeMinutes * 60 * 1000) / mult);

  await db.$transaction(async (tx) => {
    for (const input of recipe.inputs) {
      const current   = ledger.get(input.resource) ?? 0;
      const remaining = current - input.quantity;
      if (remaining < 0.001) {
        await tx.warehouseItem.delete({
          where: { warehouseId_resourceType: { warehouseId, resourceType: input.resource } },
        });
      } else {
        await tx.warehouseItem.update({
          where: { warehouseId_resourceType: { warehouseId, resourceType: input.resource } },
          data:  { quantity: remaining },
        });
      }
    }

    await tx.productionTask.create({
      data: {
        buildingId,
        keepId,
        recipeId,
        startedAt:        now,
        completesAt,
        progressAtUpdate: 0,
        speedSnapshot:    mult,
      },
    });
  });

  scheduleCompletion(buildingId, completesAt);
}

// ── Complete a production cycle ───────────────────────────────────────────────
// Adds output, emits socket event, starts next cycle.

async function complete(buildingId: number): Promise<void> {
  timers.delete(buildingId);

  const task = await db.productionTask.findUnique({
    where:   { buildingId },
    include: {
      building: { select: { buildingTypeId: true, level: true } },
      keep: {
        include: {
          empire:           { select: { playerId: true } },
          productionOrders: { orderBy: { position: 'asc' } },
        },
      },
    },
  });
  if (!task) return;

  const recipeKey = RECIPE_BY_ID[task.recipeId];
  if (!recipeKey) return;
  const recipe = RECIPE_BY_KEY[recipeKey];
  if (!recipe) return;

  const warehouseId = task.keep.warehouseId;
  if (!warehouseId) return;

  const outputQty = recipe.outputQty * task.building.level;

  const order = task.keep.productionOrders.find(
    (o) => o.buildingTypeId === task.building.buildingTypeId && o.recipeId === task.recipeId,
  );

  await db.$transaction(async (tx) => {
    await tx.productionTask.delete({ where: { buildingId } });

    await tx.warehouseItem.upsert({
      where:  { warehouseId_resourceType: { warehouseId, resourceType: recipe.output as ResourceType } },
      create: { warehouseId, resourceType: recipe.output, quantity: outputQty },
      update: { quantity: { increment: outputQty } },
    });

    if (order) {
      const newProduced = order.producedQuantity + outputQty;
      const isDone = order.orderType === 'NUMERICAL'
        && order.targetQuantity != null
        && newProduced >= order.targetQuantity;
      if (isDone) {
        await tx.productionOrder.delete({ where: { id: order.id } });
      } else {
        await tx.productionOrder.update({ where: { id: order.id }, data: { producedQuantity: newProduced } });
      }
    }
  });

  const warehouseItems = await db.warehouseItem.findMany({ where: { warehouseId } });
  io?.to(`player:${task.keep.empire.playerId}`).emit(WsEvent.PRODUCTION_COMPLETED, {
    keepId:         task.keepId,
    buildingId,
    warehouseItems,
  });

  await scheduleNextCycle(buildingId, task.keepId, task.building.buildingTypeId);
}

// ── Schedule next cycle ───────────────────────────────────────────────────────

async function scheduleNextCycle(
  buildingId:     number,
  keepId:         number,
  buildingTypeId: number,
): Promise<void> {
  const order = await db.productionOrder.findFirst({
    where:   { keepId, buildingTypeId },
    orderBy: { position: 'asc' },
  });
  if (!order) return;
  await startTask(buildingId, keepId, order.recipeId);
}

// ── Check halted buildings ────────────────────────────────────────────────────
// Called whenever items are added to a keep's warehouse.
// Scoped to that keep only — never scans globally.

export async function checkHaltedBuildings(keepId: number): Promise<void> {
  const [orders, buildings] = await Promise.all([
    db.productionOrder.findMany({ where: { keepId }, orderBy: { position: 'asc' } }),
    db.building.findMany({
      where:   { keepId, isActive: true, isDormant: false },
      include: { productionTask: true },
    }),
  ]);
  if (orders.length === 0) return;

  for (const building of buildings) {
    if (building.productionTask) continue;
    const order = orders.find((o) => o.buildingTypeId === building.buildingTypeId);
    if (!order) continue;
    void startTask(building.id, keepId, order.recipeId);
  }
}

// ── Server startup: recover in-flight tasks ───────────────────────────────────

export async function rescheduleActiveTasks(): Promise<void> {
  const tasks = await db.productionTask.findMany();
  for (const t of tasks) {
    scheduleCompletion(t.buildingId, t.completesAt);
  }
  if (tasks.length > 0) {
    console.log(`[production] rescheduled ${tasks.length} active task(s)`);
  }
}

// ── Admin: force complete all active production tasks ─────────────────────────

export async function forceCompleteAllTasks(): Promise<number> {
  const tasks = await db.productionTask.findMany({
    include: {
      building: { select: { buildingTypeId: true, level: true } },
      keep: {
        include: {
          empire:           { select: { playerId: true } },
          productionOrders: { orderBy: { position: 'asc' } },
        },
      },
    },
  });

  let completed = 0;
  for (const task of tasks) {
    cancelCompletion(task.buildingId);

    const recipeKey = RECIPE_BY_ID[task.recipeId];
    if (!recipeKey) continue;
    const recipe = RECIPE_BY_KEY[recipeKey];
    if (!recipe) continue;

    const warehouseId = task.keep.warehouseId;
    if (!warehouseId) continue;

    const outputQty = recipe.outputQty * task.building.level;
    const order = task.keep.productionOrders.find(
      (o) => o.buildingTypeId === task.building.buildingTypeId && o.recipeId === task.recipeId,
    );

    await db.$transaction(async (tx) => {
      await tx.productionTask.delete({ where: { buildingId: task.buildingId } });
      await tx.warehouseItem.upsert({
        where:  { warehouseId_resourceType: { warehouseId, resourceType: recipe.output as ResourceType } },
        create: { warehouseId, resourceType: recipe.output, quantity: outputQty },
        update: { quantity: { increment: outputQty } },
      });
      if (order) {
        const newProduced = order.producedQuantity + outputQty;
        const isDone = order.orderType === 'NUMERICAL'
          && order.targetQuantity != null
          && newProduced >= order.targetQuantity;
        if (isDone) {
          await tx.productionOrder.delete({ where: { id: order.id } });
        } else {
          await tx.productionOrder.update({ where: { id: order.id }, data: { producedQuantity: newProduced } });
        }
      }
    });

    const warehouseItems = await db.warehouseItem.findMany({ where: { warehouseId } });
    io?.to(`player:${task.keep.empire.playerId}`).emit(WsEvent.PRODUCTION_COMPLETED, {
      keepId: task.keepId, buildingId: task.buildingId, warehouseItems,
    });

    const nextOrder = await db.productionOrder.findFirst({
      where:   { keepId: task.keepId, buildingTypeId: task.building.buildingTypeId },
      orderBy: { position: 'asc' },
    });
    if (nextOrder) void startTask(task.buildingId, task.keepId, nextOrder.recipeId);

    completed++;
  }
  return completed;
}

// ── Exported for tick-job speed-adjustment ────────────────────────────────────

export { getSpeedMultiplier };
