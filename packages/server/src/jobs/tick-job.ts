import cron from 'node-cron';
import type { Server as SocketServer } from 'socket.io';
import { Prisma } from '@prisma/client';
import {
  WsEvent,
  HOUSING_CAPACITY_PER_LEVEL,
  BUILDING_TIER,
  BUILDING_WORKER_COST,
  WORKER_NEEDS,
  OVERHEAD_CONSTANTS,
  OVERHEAD_TIER_WEIGHTS,
  RECIPE_BY_KEY,
  RECIPE_BY_ID,
  BUILDING_TYPE_BY_ID,
  BASE_CYCLE_SECONDS,
  DURABILITY_CONSTANTS,
  getStarterSpeedMultiplier,
} from '@merchant-realms/shared';
import type { ResourceType, WorkerTier, BuildingType } from '@merchant-realms/shared';
import { calculateConsumption, calculateOverheadFactor, calculateDurabilityFactor } from '@merchant-realms/engine';
import type { WorkerGroupState } from '@merchant-realms/engine';
import { config } from '../config/index.js';
import { db } from '../db/client.js';
import { adminState } from '../admin-bypass.js';

let tickNumber = 0;
let tickRunning = false; // guard: skip if previous tick hasn't finished

export interface TickResult {
  tickNumber: number;
  durationMs: number;
  produced: number;
  delivered: number;
}

export async function runTick(io?: SocketServer): Promise<TickResult> {
  if (tickRunning) {
    console.log(`[tick] Skipping tick ${tickNumber + 1} — previous still running`);
    return { tickNumber, durationMs: 0, produced: 0, delivered: 0 };
  }
  tickRunning = true;
  try {
    return await doTick(io);
  } finally {
    tickRunning = false;
  }
}

async function doTick(io?: SocketServer): Promise<TickResult> {
  const start = Date.now();
  tickNumber++;
  let totalProduced = 0;

  // ── Read all data upfront ────────────────────────────────────────────────────
  const keeps = await db.keep.findMany({
    include: {
      empire:           { select: { createdAt: true } },
      buildings:        true,
      warehouse:        { include: { items: true } },
      productionOrders: { orderBy: [{ orderType: 'asc' }, { position: 'asc' }] },
    },
  });

  // Collect all DB writes — flushed as one transaction at the end.
  const writes: Prisma.PrismaPromise<unknown>[] = [];

  const decayThisTick = DURABILITY_CONSTANTS.decayPerCycle * (config.TICK_INTERVAL_SECONDS / BASE_CYCLE_SECONDS);

  // ── Pre-pass: empire-wide weighted workforce for overhead ────────────────────
  const empireWeightedWorkforce = new Map<number, number>();
  for (const keep of keeps) {
    let keepWeighted = 0;
    for (const b of keep.buildings) {
      if (!b.isActive || b.isDormant) continue;
      const btCode = BUILDING_TYPE_BY_ID[b.buildingTypeId] as BuildingType | undefined;
      if (!btCode) continue;
      const housingCap = HOUSING_CAPACITY_PER_LEVEL[btCode];
      if (housingCap !== undefined) {
        const tier = (BUILDING_TIER[btCode] ?? 1) as 1 | 2 | 3;
        keepWeighted += b.level * housingCap * OVERHEAD_TIER_WEIGHTS[`T${tier}` as WorkerTier];
      }
    }
    empireWeightedWorkforce.set(
      keep.empireId,
      (empireWeightedWorkforce.get(keep.empireId) ?? 0) + keepWeighted,
    );
  }

  // ── Phase 1: Production ──────────────────────────────────────────────────────
  for (const keep of keeps) {
    const ledgerMap = new Map((keep.warehouse?.items ?? []).map((e) => [e.resourceType, e.quantity]));

    const tierHousingCap: Record<WorkerTier, number> = { T1: 0, T2: 0, T3: 0 };
    for (const b of keep.buildings) {
      if (!b.isActive || b.isDormant) continue;
      const btCode = BUILDING_TYPE_BY_ID[b.buildingTypeId] as BuildingType | undefined;
      if (!btCode) continue;
      const housingCap = HOUSING_CAPACITY_PER_LEVEL[btCode];
      if (housingCap !== undefined) {
        const tier = (BUILDING_TIER[btCode] ?? 1) as 1 | 2 | 3;
        tierHousingCap[`T${tier}` as WorkerTier] += b.level * housingCap;
      }
    }

    const tierDemand: Record<WorkerTier, number> = { T1: 0, T2: 0, T3: 0 };
    for (const b of keep.buildings) {
      if (!b.isActive || b.isDormant) continue;
      const btCode = BUILDING_TYPE_BY_ID[b.buildingTypeId] as BuildingType | undefined;
      if (!btCode) continue;
      const workerCost = BUILDING_WORKER_COST[btCode] ?? 0;
      if (workerCost === 0) continue;
      const tier = (BUILDING_TIER[btCode] ?? 1) as 1 | 2 | 3;
      tierDemand[`T${tier}` as WorkerTier] += b.level * workerCost;
    }

    const tierWorkerFactor: Record<WorkerTier, number> = adminState.bypassEnabled
      ? { T1: 1, T2: 1, T3: 1 }
      : {
          T1: tierDemand.T1 === 0 ? 1 : Math.min(1, tierHousingCap.T1 / tierDemand.T1),
          T2: tierDemand.T2 === 0 ? 1 : Math.min(1, tierHousingCap.T2 / tierDemand.T2),
          T3: tierDemand.T3 === 0 ? 1 : Math.min(1, tierHousingCap.T3 / tierDemand.T3),
        };

    const tierActualWorkers: Record<WorkerTier, number> = {
      T1: Math.min(tierDemand.T1, tierHousingCap.T1),
      T2: Math.min(tierDemand.T2, tierHousingCap.T2),
      T3: Math.min(tierDemand.T3, tierHousingCap.T3),
    };
    const totalActualWorkers = tierActualWorkers.T1 + tierActualWorkers.T2 + tierActualWorkers.T3;

    const empireAgeDays     = (Date.now() - keep.empire.createdAt.getTime()) / 86_400_000;
    const starterMultiplier = getStarterSpeedMultiplier(empireAgeDays);

    const weightedWorkforce  = empireWeightedWorkforce.get(keep.empireId) ?? 0;
    const overheadMultiplier = adminState.bypassEnabled
      ? 1
      : calculateOverheadFactor(
          weightedWorkforce,
          OVERHEAD_CONSTANTS.threshold,
          OVERHEAD_CONSTANTS.penaltyPerUnit,
          OVERHEAD_CONSTANTS.maxMultiplier,
        );

    let consumptionPenalty = 1;
    let consumptionBonus   = 1;
    if (!adminState.bypassEnabled && totalActualWorkers > 0) {
      const tickFraction = config.TICK_INTERVAL_SECONDS / BASE_CYCLE_SECONDS;
      const workerGroups: WorkerGroupState[] = (['T1', 'T2', 'T3'] as const)
        .filter((tier) => tierActualWorkers[tier] > 0)
        .map((tier) => ({
          tier,
          count: tierActualWorkers[tier],
          needs: WORKER_NEEDS[tier].map((n) => ({
            resourceType:      n.resourceType,
            quantityPerWorker: n.quantityPerCycle * tickFraction * overheadMultiplier * starterMultiplier,
            isNecessary:       n.isNecessary,
          })),
        }));

      const consumptionAvailable = Array.from(ledgerMap.entries()).map(([rt, qty]) => ({
        resourceType: rt as ResourceType,
        available:    qty,
      }));
      const cr = calculateConsumption(workerGroups, consumptionAvailable);
      for (const { resourceType, quantity } of cr.resourcesConsumed) {
        ledgerMap.set(resourceType, Math.max(0, (ledgerMap.get(resourceType) ?? 0) - quantity));
      }
      consumptionPenalty = cr.penaltyFactor;
      consumptionBonus   = cr.bonusFactor;
    }

    // Group buildings by buildingTypeId (integer)
    const byTypeId = new Map<number, typeof keep.buildings>();
    for (const b of keep.buildings) {
      if (!b.isActive || b.isDormant) continue;
      const btCode = BUILDING_TYPE_BY_ID[b.buildingTypeId] as BuildingType | undefined;
      if (!btCode || (BUILDING_WORKER_COST[btCode] ?? 0) === 0) continue;
      (byTypeId.get(b.buildingTypeId) ?? byTypeId.set(b.buildingTypeId, []).get(b.buildingTypeId)!).push(b);
    }

    for (const [buildingTypeId, buildings] of byTypeId) {
      const btCode = BUILDING_TYPE_BY_ID[buildingTypeId] as BuildingType | undefined;
      if (!btCode) continue;

      const orders = keep.productionOrders.filter((o) => o.buildingTypeId === buildingTypeId);
      if (orders.length === 0) continue;

      const numericalOrders = orders.filter((o) => o.orderType === 'NUMERICAL' && (o.targetQuantity ?? 0) > o.producedQuantity);
      const infiniteOrders  = orders.filter((o) => o.orderType === 'INFINITE');

      let activeRecipeId: number | null = null;
      let activeOrderId: number | null = null;

      if (numericalOrders.length > 0) {
        activeRecipeId = numericalOrders[0]!.recipeId;
        activeOrderId  = numericalOrders[0]!.id;
      } else if (infiniteOrders.length > 0) {
        const idx = tickNumber % infiniteOrders.length;
        activeRecipeId = infiniteOrders[idx]!.recipeId;
        activeOrderId  = infiniteOrders[idx]!.id;
      }

      if (!activeRecipeId) continue;

      const recipeKey = RECIPE_BY_ID[activeRecipeId];
      if (!recipeKey) continue;
      const recipe = RECIPE_BY_KEY[recipeKey];
      if (!recipe) continue;

      const bTier = (BUILDING_TIER[btCode] ?? 1) as 1 | 2 | 3;
      const workerFactor    = tierWorkerFactor[`T${bTier}` as WorkerTier];
      const progressPerTick = config.TICK_INTERVAL_SECONDS / (recipe.timeMinutes * 60);
      const baseProgressGain = progressPerTick * workerFactor * consumptionPenalty * consumptionBonus * starterMultiplier;

      for (const building of buildings) {
        const durabilityFactor = calculateDurabilityFactor(building.health, DURABILITY_CONSTANTS.threshold);
        const progressGain     = baseProgressGain * durabilityFactor;
        const newProgress = building.productionProgress + progressGain;

        if (newProgress >= 1.0) {
          const scaledInputs = recipe.inputs.map((inp) => ({
            resource: inp.resource as ResourceType,
            quantity: inp.quantity * building.level,
          }));

          const inputsAvailable = adminState.bypassEnabled || scaledInputs.every(
            (inp) => (ledgerMap.get(inp.resource) ?? 0) >= inp.quantity,
          );

          if (inputsAvailable) {
            for (const inp of scaledInputs) {
              if (!adminState.bypassEnabled) {
                ledgerMap.set(inp.resource, (ledgerMap.get(inp.resource) ?? 0) - inp.quantity);
              }
            }
            const outputQty = recipe.outputQty * building.level;
            ledgerMap.set(
              recipe.output as ResourceType,
              (ledgerMap.get(recipe.output as ResourceType) ?? 0) + outputQty,
            );
            totalProduced++;

            if (activeOrderId) {
              const order = numericalOrders.find((o) => o.id === activeOrderId);
              if (order) order.producedQuantity += outputQty;
            }

            building.productionProgress = newProgress - 1.0;
          } else {
            building.productionProgress = Math.min(newProgress, 0.999);
          }
        } else {
          building.productionProgress = newProgress;
        }

        const newHealth = Math.max(DURABILITY_CONSTANTS.floor, building.health - decayThisTick);

        writes.push(db.building.update({
          where: { id: building.id },
          data:  { productionProgress: building.productionProgress, health: newHealth },
        }));
      }

      for (const order of numericalOrders) {
        if ((order.targetQuantity ?? 0) <= order.producedQuantity) {
          writes.push(db.productionOrder.delete({ where: { id: order.id } }));
        } else {
          writes.push(db.productionOrder.update({
            where: { id: order.id },
            data:  { producedQuantity: order.producedQuantity },
          }));
        }
      }
    }

    // Queue warehouse item writes — only for values that actually changed
    const warehouseId   = keep.warehouseId!;
    const originalItems = new Map((keep.warehouse?.items ?? []).map((e) => [e.resourceType, e.quantity]));
    for (const [resourceType, quantity] of ledgerMap) {
      const clamped = Math.max(0, quantity);
      if (Math.abs((originalItems.get(resourceType) ?? 0) - clamped) > 0.001) {
        writes.push(db.warehouseItem.upsert({
          where:  { warehouseId_resourceType: { warehouseId, resourceType } },
          create: { warehouseId, resourceType, quantity: clamped },
          update: { quantity: clamped },
        }));
      }
    }
  }

  // ── Flush all writes in one transaction ─────────────────────────────────────
  if (writes.length > 0) {
    await db.$transaction(writes);
  }

  // ── Record tick ──────────────────────────────────────────────────────────────
  const durationMs = Date.now() - start;
  await db.gameTick.create({ data: { tickNumber, processedAt: new Date(), durationMs } });

  const result: TickResult = { tickNumber, durationMs, produced: totalProduced, delivered: 0 };
  if (io) io.emit(WsEvent.TICK_COMPLETE, result);
  console.log(`⏱  Tick ${tickNumber} — ${durationMs}ms | produced: ${totalProduced}`);

  return result;
}

export async function startTickJob(io: SocketServer): Promise<void> {
  const last = await db.gameTick.findFirst({ orderBy: { tickNumber: 'desc' } });
  tickNumber = last?.tickNumber ?? 0;

  const interval = config.TICK_INTERVAL_SECONDS;
  const onError = (err: unknown) => console.error('[tick] unhandled error:', err);

  if (interval < 60) {
    setInterval(() => runTick(io).catch(onError), interval * 1000);
    console.log(`⏱  Tick job: every ${interval}s (resuming from tick ${tickNumber})`);
  } else {
    const mins = Math.floor(interval / 60);
    cron.schedule(`*/${mins} * * * *`, () => runTick(io).catch(onError));
    console.log(`⏱  Tick job: every ${mins}min (resuming from tick ${tickNumber})`);
  }
}
