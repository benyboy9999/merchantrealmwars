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
import { scheduleCompletion } from '../services/production-timers.js';

let tickNumber = 0;
let tickRunning = false;

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

  const keeps = await db.keep.findMany({
    include: {
      empire:           { select: { createdAt: true } },
      buildings:        { include: { productionTask: true } },
      warehouse:        { include: { items: true } },
      productionOrders: { orderBy: [{ orderType: 'asc' }, { position: 'asc' }] },
    },
  });

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  const speedChangedBuildings: Array<{ buildingId: number; completesAt: Date }> = [];
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

  // ── Phase 1: Consumption + speed-change detection ────────────────────────────
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

    const hasActiveProduction = keep.buildings.some(
      (b) => b.isActive && !b.isDormant && b.productionTask,
    );

    if (!adminState.bypassEnabled && totalActualWorkers > 0 && hasActiveProduction) {
      const tickFraction    = config.TICK_INTERVAL_SECONDS / BASE_CYCLE_SECONDS;
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

    // ── Speed-change detection per active production task ────────────────────────
    for (const building of keep.buildings) {
      if (!building.productionTask || !building.isActive || building.isDormant) continue;

      const btCode = BUILDING_TYPE_BY_ID[building.buildingTypeId] as BuildingType | undefined;
      if (!btCode) continue;

      const recipeKey = RECIPE_BY_ID[building.productionTask.recipeId];
      if (!recipeKey) continue;
      const recipe = RECIPE_BY_KEY[recipeKey];
      if (!recipe) continue;

      const bTier            = (BUILDING_TIER[btCode] ?? 1) as 1 | 2 | 3;
      const workerFactor     = tierWorkerFactor[`T${bTier}` as WorkerTier];
      const durabilityFactor = calculateDurabilityFactor(building.health, DURABILITY_CONSTANTS.threshold);
      const effectiveSpeed   = workerFactor * consumptionPenalty * consumptionBonus * starterMultiplier * durabilityFactor;

      if (Math.abs(effectiveSpeed - building.productionTask.speedSnapshot) > 0.01) {
        const task        = building.productionTask;
        const now         = Date.now();
        const updatedAt   = new Date(task.updatedAt).getTime();
        const completesAt = new Date(task.completesAt).getTime();
        const totalMs     = completesAt - updatedAt;
        const elapsedFrac = totalMs > 0 ? Math.min(1, (now - updatedAt) / totalMs) : 0;
        const currentProgress = task.progressAtUpdate + elapsedFrac * (1 - task.progressAtUpdate);
        const remaining       = Math.max(0, 1 - currentProgress);
        const newDurationMs   = effectiveSpeed > 0
          ? (remaining * recipe.timeMinutes * 60 * 1000) / effectiveSpeed
          : 365 * 24 * 60 * 60 * 1000;
        const newCompletesAt  = new Date(now + newDurationMs);

        writes.push(db.productionTask.update({
          where: { buildingId: building.id },
          data: {
            completesAt:      newCompletesAt,
            progressAtUpdate: currentProgress,
            speedSnapshot:    effectiveSpeed,
          },
        }));
        speedChangedBuildings.push({ buildingId: building.id, completesAt: newCompletesAt });
      }
    }

    // ── Durability decay ─────────────────────────────────────────────────────────
    for (const building of keep.buildings) {
      if (!building.isActive) continue;
      const newHealth = Math.max(DURABILITY_CONSTANTS.floor, building.health - decayThisTick);
      if (Math.abs(newHealth - building.health) > 0.001) {
        writes.push(db.building.update({
          where: { id: building.id },
          data:  { health: newHealth },
        }));
      }
    }

    // ── Flush warehouse changes ──────────────────────────────────────────────────
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

  // ── Flush all writes ─────────────────────────────────────────────────────────
  if (writes.length > 0) {
    await db.$transaction(writes);
  }

  // ── Reschedule timers for speed-changed tasks ────────────────────────────────
  for (const { buildingId, completesAt } of speedChangedBuildings) {
    scheduleCompletion(buildingId, completesAt);
  }

  // ── Record tick ──────────────────────────────────────────────────────────────
  const durationMs = Date.now() - start;
  await db.gameTick.create({ data: { tickNumber, processedAt: new Date(), durationMs } });

  const result: TickResult = { tickNumber, durationMs, produced: 0, delivered: 0 };
  if (io) io.emit(WsEvent.TICK_COMPLETE, result);
  console.log(`⏱  Tick ${tickNumber} — ${durationMs}ms`);

  return result;
}

export async function startTickJob(io: SocketServer): Promise<void> {
  const last = await db.gameTick.findFirst({ orderBy: { tickNumber: 'desc' } });
  tickNumber = last?.tickNumber ?? 0;

  const interval = config.TICK_INTERVAL_SECONDS;
  const onError  = (err: unknown) => console.error('[tick] unhandled error:', err);

  if (interval < 60) {
    setInterval(() => runTick(io).catch(onError), interval * 1000);
    console.log(`⏱  Tick job: every ${interval}s (resuming from tick ${tickNumber})`);
  } else {
    const mins = Math.floor(interval / 60);
    cron.schedule(`*/${mins} * * * *`, () => runTick(io).catch(onError));
    console.log(`⏱  Tick job: every ${mins}min (resuming from tick ${tickNumber})`);
  }
}
