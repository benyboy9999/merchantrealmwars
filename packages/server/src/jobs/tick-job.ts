import cron from 'node-cron';
import type { Server as SocketServer } from 'socket.io';
import { WsEvent, BUILDING_BASE_WORKERS } from '@artemis/shared';
import { computeProductionTick } from '@artemis/engine';
import { config } from '../config/index.js';
import { db } from '../db/client.js';
import { adminState } from '../admin-bypass.js';

let tickNumber = 0;

export interface TickResult {
  tickNumber: number;
  durationMs: number;
  produced: number;
  delivered: number;
}

export async function runTick(io?: SocketServer): Promise<TickResult> {
  const start = Date.now();
  tickNumber++;
  let totalProduced = 0;
  let totalDelivered = 0;

  // ── Phase 1: Production ──────────────────────────────────────────────────
  const keeps = await db.keep.findMany({
    include: {
      buildings: true,
      resourceLedger: true,
      productionOrders: { orderBy: [{ orderType: 'asc' }, { position: 'asc' }] },
    },
  });

  for (const keep of keeps) {
    const ledgerMap = new Map(keep.resourceLedger.map((e) => [e.resourceType, e.quantity]));

    // Group buildings by type
    const byType = new Map<string, typeof keep.buildings>();
    for (const b of keep.buildings) {
      if (!b.isActive || b.isDormant || b.buildingType === 'WAREHOUSE' || b.buildingType === 'HOUSING') continue;
      (byType.get(b.buildingType) ?? byType.set(b.buildingType, []).get(b.buildingType)!).push(b);
    }

    for (const [buildingType, buildings] of byType) {
      // Find the active recipe from the queue
      const orders = keep.productionOrders.filter((o) => o.buildingType === buildingType);
      if (orders.length === 0) continue;

      // Numerical first, then infinite (alphabetical sort by orderType puts INFINITE after NUMERICAL)
      const numericalOrders = orders.filter((o) => o.orderType === 'NUMERICAL' && (o.targetQuantity ?? 0) > o.producedQuantity);
      const infiniteOrders  = orders.filter((o) => o.orderType === 'INFINITE');

      // Determine active recipe key
      let activeRecipeKey: string | null = null;
      let activeOrderId: string | null = null;

      if (numericalOrders.length > 0) {
        activeRecipeKey = numericalOrders[0]!.recipeKey;
        activeOrderId   = numericalOrders[0]!.id;
      } else if (infiniteOrders.length > 0) {
        // Round-robin: pick based on tick number mod count
        const idx = tickNumber % infiniteOrders.length;
        activeRecipeKey = infiniteOrders[idx]!.recipeKey;
        activeOrderId   = infiniteOrders[idx]!.id;
      }

      if (!activeRecipeKey) continue;

      // Run production for each building of this type
      for (const building of buildings) {
        const baseWorkers = BUILDING_BASE_WORKERS[buildingType as keyof typeof BUILDING_BASE_WORKERS] ?? 1;
        const requiredWorkers = baseWorkers * building.level;
        const workerFactor = adminState.bypassEnabled ? 1 : Math.min(1, building.workersAssigned / requiredWorkers);

        const available = Array.from(ledgerMap.entries()).map(([resource, quantity]) => ({ resource, quantity }));
        const result = computeProductionTick(activeRecipeKey, available, building.level, workerFactor, adminState.bypassEnabled);

        if (result.blocked) continue;

        // Apply consumed inputs to ledger map
        for (const c of result.consumed) {
          ledgerMap.set(c.resource, (ledgerMap.get(c.resource) ?? 0) - c.quantity);
        }

        // Apply output to ledger map
        if (result.produced) {
          ledgerMap.set(result.produced.resource, (ledgerMap.get(result.produced.resource) ?? 0) + result.produced.quantity);
          totalProduced++;
        }

        // Update NUMERICAL order progress
        if (activeOrderId && result.produced) {
          const order = numericalOrders.find((o) => o.id === activeOrderId);
          if (order) {
            order.producedQuantity += result.produced.quantity;
          }
        }
      }

      // Flush numerical order completion to DB
      for (const order of numericalOrders) {
        if ((order.targetQuantity ?? 0) <= order.producedQuantity) {
          await db.productionOrder.delete({ where: { id: order.id } });
        } else {
          await db.productionOrder.update({ where: { id: order.id }, data: { producedQuantity: order.producedQuantity } });
        }
      }
    }

    // Flush resource ledger back to DB
    for (const [resourceType, quantity] of ledgerMap) {
      await db.resourceLedger.upsert({
        where:  { keepId_resourceType: { keepId: keep.id, resourceType } },
        create: { keepId: keep.id, resourceType, quantity: Math.max(0, quantity) },
        update: { quantity: Math.max(0, quantity) },
      });
    }
  }

  // ── Phase 2: Deliver arrived caravans ───────────────────────────────────
  const arrivedCaravans = await db.caravan.findMany({
    where: { status: 'IN_TRANSIT', arrivesAt: { lte: new Date() } },
  });

  for (const caravan of arrivedCaravans) {
    if (caravan.destType === 'KEEP') {
      await db.resourceLedger.upsert({
        where:  { keepId_resourceType: { keepId: caravan.destId, resourceType: caravan.resourceType } },
        create: { keepId: caravan.destId, resourceType: caravan.resourceType, quantity: caravan.quantity },
        update: { quantity: { increment: caravan.quantity } },
      });
    }
    await db.caravan.update({ where: { id: caravan.id }, data: { status: 'ARRIVED' } });
    totalDelivered++;
  }

  // ── Record tick ──────────────────────────────────────────────────────────
  const durationMs = Date.now() - start;
  await db.gameTick.create({ data: { tickNumber, processedAt: new Date(), durationMs } });

  const result: TickResult = { tickNumber, durationMs, produced: totalProduced, delivered: totalDelivered };

  if (io) io.emit(WsEvent.TICK_COMPLETE, result);
  console.warn(`⏱  Tick ${tickNumber} — ${durationMs}ms | produced: ${totalProduced} | delivered: ${totalDelivered}`);

  return result;
}

export function startTickJob(io: SocketServer): void {
  const interval = config.TICK_INTERVAL_SECONDS;
  if (interval < 60) {
    setInterval(() => void runTick(io), interval * 1000);
    console.warn(`⏱  Tick job: every ${interval}s`);
  } else {
    const mins = Math.floor(interval / 60);
    cron.schedule(`*/${mins} * * * *`, () => void runTick(io));
    console.warn(`⏱  Tick job: every ${mins}min`);
  }
}
