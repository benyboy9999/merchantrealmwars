import cron from 'node-cron';
import type { Server as SocketServer } from 'socket.io';
import { WsEvent, HOUSING_BASE_CAPACITY, WORKERS_PER_LEVEL, RECIPE_BY_KEY, T1_WORKER_NEEDS, BASE_CYCLE_SECONDS } from '@merchant-realms/shared';
import type { ResourceType } from '@merchant-realms/shared';
import { calculateConsumption } from '@merchant-realms/engine';
import { config } from '../config/index.js';
import { db } from '../db/client.js';
import { adminState } from '../admin-bypass.js';

let tickNumber = 0; // initialised from DB in startTickJob

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

    // Pool-based worker factor: housing supplies workers, production buildings consume them
    const totalWorkers = keep.buildings
      .filter((b) => b.buildingType === 'HOUSING' && b.isActive && !b.isDormant)
      .reduce((sum, b) => sum + b.level * HOUSING_BASE_CAPACITY, 0);
    const requiredWorkers = keep.buildings
      .filter((b) => b.buildingType !== 'HOUSING' && b.buildingType !== 'WAREHOUSE' && b.isActive && !b.isDormant)
      .reduce((sum, b) => sum + b.level * WORKERS_PER_LEVEL, 0);
    const keepWorkerFactor = adminState.bypassEnabled
      ? 1
      : requiredWorkers === 0 ? 1 : Math.min(1, totalWorkers / requiredWorkers);

    // ── Worker consumption ───────────────────────────────────────────────
    let consumptionPenalty = 1;
    let consumptionBonus   = 1;
    if (!adminState.bypassEnabled && totalWorkers > 0) {
      const tickFraction = config.TICK_INTERVAL_SECONDS / BASE_CYCLE_SECONDS;
      const scaledNeeds = T1_WORKER_NEEDS.map((n) => ({
        resourceType:      n.resourceType,
        quantityPerWorker: n.quantityPerCycle * tickFraction,
        isNecessary:       n.isNecessary,
      }));
      const consumptionAvailable = Array.from(ledgerMap.entries()).map(([rt, qty]) => ({
        resourceType: rt as ResourceType,
        available:    qty,
      }));
      const cr = calculateConsumption(
        [{ tier: 'T1' as const, count: totalWorkers, needs: scaledNeeds }],
        consumptionAvailable,
      );
      for (const { resourceType, quantity } of cr.resourcesConsumed) {
        ledgerMap.set(resourceType, Math.max(0, (ledgerMap.get(resourceType) ?? 0) - quantity));
      }
      consumptionPenalty = cr.penaltyFactor;
      consumptionBonus   = cr.bonusFactor;
    }

    // Group active production buildings by type
    const byType = new Map<string, typeof keep.buildings>();
    for (const b of keep.buildings) {
      if (!b.isActive || b.isDormant || b.buildingType === 'WAREHOUSE' || b.buildingType === 'HOUSING') continue;
      (byType.get(b.buildingType) ?? byType.set(b.buildingType, []).get(b.buildingType)!).push(b);
    }

    for (const [buildingType, buildings] of byType) {
      const orders = keep.productionOrders.filter((o) => o.buildingType === buildingType);
      if (orders.length === 0) continue;

      const numericalOrders = orders.filter((o) => o.orderType === 'NUMERICAL' && (o.targetQuantity ?? 0) > o.producedQuantity);
      const infiniteOrders  = orders.filter((o) => o.orderType === 'INFINITE');

      let activeRecipeKey: string | null = null;
      let activeOrderId: string | null = null;

      if (numericalOrders.length > 0) {
        activeRecipeKey = numericalOrders[0]!.recipeKey;
        activeOrderId   = numericalOrders[0]!.id;
      } else if (infiniteOrders.length > 0) {
        const idx = tickNumber % infiniteOrders.length;
        activeRecipeKey = infiniteOrders[idx]!.recipeKey;
        activeOrderId   = infiniteOrders[idx]!.id;
      }

      if (!activeRecipeKey) continue;

      const recipe = RECIPE_BY_KEY[activeRecipeKey];
      if (!recipe) continue;

      // Progress gained this tick: (tickInterval / batchDuration) × workerFactor
      // Workers affect speed — fewer workers = slower progress
      const progressPerTick = config.TICK_INTERVAL_SECONDS / (recipe.timeMinutes * 60);
      const progressGain    = progressPerTick * keepWorkerFactor * consumptionPenalty * consumptionBonus;

      for (const building of buildings) {
        const newProgress = building.productionProgress + progressGain;

        if (newProgress >= 1.0) {
          // Batch complete — check inputs and produce
          const available = Array.from(ledgerMap.entries()).map(([resource, av]) => ({
            resource: resource as ResourceType,
            available: av,
          }));

          // Check inputs (skip check when admin bypass is on)
          const scaledInputs = recipe.inputs.map((inp) => ({
            resource: inp.resource as ResourceType,
            quantity: inp.quantity * building.level,
          }));

          const inputsAvailable = adminState.bypassEnabled || scaledInputs.every(
            (inp) => (ledgerMap.get(inp.resource) ?? 0) >= inp.quantity,
          );

          if (inputsAvailable) {
            // Consume inputs
            for (const inp of scaledInputs) {
              if (!adminState.bypassEnabled) {
                ledgerMap.set(inp.resource, (ledgerMap.get(inp.resource) ?? 0) - inp.quantity);
              }
            }

            // Produce output (full batch, not scaled by workerFactor — workers affect speed only)
            const outputQty = recipe.outputQty * building.level;
            ledgerMap.set(
              recipe.output as ResourceType,
              (ledgerMap.get(recipe.output as ResourceType) ?? 0) + outputQty,
            );
            totalProduced++;

            // Track NUMERICAL order progress
            if (activeOrderId) {
              const order = numericalOrders.find((o) => o.id === activeOrderId);
              if (order) order.producedQuantity += outputQty;
            }

            // Carry over remainder so fast workers don't waste progress
            building.productionProgress = newProgress - 1.0;
          } else {
            // Blocked — hold just below 1.0, retry next tick when inputs arrive
            building.productionProgress = Math.min(newProgress, 0.999);
          }
        } else {
          building.productionProgress = newProgress;
        }

        // Save progress
        await db.building.update({
          where: { id: building.id },
          data:  { productionProgress: building.productionProgress },
        });
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

    // Flush resource ledger
    for (const [resourceType, quantity] of ledgerMap) {
      await db.resourceLedger.upsert({
        where:  { keepId_resourceType: { keepId: keep.id, resourceType } },
        create: { keepId: keep.id, resourceType, quantity: Math.max(0, quantity) },
        update: { quantity: Math.max(0, quantity) },
      });
    }
  }

  // ── Phase 2: Arrive caravans ─────────────────────────────────────────────
  const arrivedCaravans = await db.caravan.findMany({
    where: { status: 'IN_TRANSIT', arrivesAt: { lte: new Date() } },
  });

  for (const caravan of arrivedCaravans) {
    await db.caravan.update({
      where: { id: caravan.id },
      data: {
        status:       'IDLE',
        locationType: caravan.destType!,
        locationId:   caravan.destId!,
        destType:     null,
        destId:       null,
        departedAt:   null,
        arrivesAt:    null,
      },
    });
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

export async function startTickJob(io: SocketServer): Promise<void> {
  const last = await db.gameTick.findFirst({ orderBy: { tickNumber: 'desc' } });
  tickNumber = last?.tickNumber ?? 0;

  const interval = config.TICK_INTERVAL_SECONDS;
  if (interval < 60) {
    setInterval(() => void runTick(io), interval * 1000);
    console.warn(`⏱  Tick job: every ${interval}s (resuming from tick ${tickNumber})`);
  } else {
    const mins = Math.floor(interval / 60);
    cron.schedule(`*/${mins} * * * *`, () => void runTick(io));
    console.warn(`⏱  Tick job: every ${mins}min (resuming from tick ${tickNumber})`);
  }
}
