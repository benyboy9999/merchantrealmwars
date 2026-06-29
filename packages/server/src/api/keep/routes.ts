import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  RESOURCE_WEIGHT, KEEP_BASE_STORAGE, WAREHOUSE_BASE_CAPACITY,
  BUILDING_CONSTRUCTION_COSTS, KEEP_MAX_BUILDING_SLOTS,
  KEEP_DEFAULT_BUILDING_SLOTS, KEEP_SLOT_UNLOCK_RESOURCE,
  BUILDING_TYPE_IDS, BUILDING_TYPE_BY_ID, RECIPE_IDS,
  RECIPE_BY_KEY, RECIPE_BY_ID, BUILDING_MAX_LEVEL,
} from '@merchant-realms/shared';
import type { BuildingType } from '@merchant-realms/shared';
import { calculateRepairCost, calculateUpgradeCost } from '@merchant-realms/engine';
import { startTask, cancelCompletion } from '../../services/production-timers.js';

export const keepRouter = Router();
keepRouter.use(requireAuth);

function empireGuard(empireId: number | null | undefined, res: import('express').Response): empireId is number {
  if (!empireId) { res.status(403).json({ error: 'Create an empire first' }); return false; }
  return true;
}

function computeUsedWeight(items: { resourceType: string; quantity: number }[]): number {
  return items.reduce(
    (s, e) => s + e.quantity * (RESOURCE_WEIGHT[e.resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.1),
    0,
  );
}

// ── List keeps ───────────────────────────────────────────────────────────────
keepRouter.get('/', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const keeps = await db.keep.findMany({
      where:   { empireId },
      include: { plot: { include: { district: true } }, buildings: true },
    });
    res.json({ keeps });
  } catch (err) { next(err); }
});

// ── Create keep ──────────────────────────────────────────────────────────────
keepRouter.post('/', async (req, res, next) => {
  try {
    const { plotId, name } = z.object({ plotId: z.number().int(), name: z.string().min(1).max(40) }).parse(req.body);
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;

    const existing = await db.keep.findFirst({ where: { plotId } });
    if (existing) { res.status(409).json({ error: 'Plot already has a Keep' }); return; }

    // Create warehouse and keep atomically — warehouse ID is stored on keep
    const keep = await db.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.create({
        data: { type: 'KEEP', empireId, cap: KEEP_BASE_STORAGE },
      });
      return tx.keep.create({
        data: { empireId, plotId, name, buildingSlotCount: KEEP_DEFAULT_BUILDING_SLOTS, warehouseId: warehouse.id },
      });
    });
    res.status(201).json({ keep });
  } catch (err) { next(err); }
});

// ── Keep detail ──────────────────────────────────────────────────────────────
keepRouter.get('/:id', async (req, res, next) => {
  try {
    const id       = parseInt(req.params['id']!);
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const [keep, empire] = await Promise.all([
      db.keep.findUnique({
        where:   { id, empireId },
        include: {
          plot:             { include: { district: true } },
          buildings:        { orderBy: { slotIndex: 'asc' }, include: { productionTask: true } },
          warehouse:        { include: { items: { orderBy: { resourceType: 'asc' } } } },
          productionOrders: { orderBy: [{ buildingTypeId: 'asc' }, { position: 'asc' }] },
        },
      }),
      db.empire.findUnique({ where: { id: empireId }, select: { goldBalance: true } }),
    ]);
    if (!keep) { res.status(404).json({ error: 'Keep not found' }); return; }

    const items      = keep.warehouse?.items ?? [];
    const usedWeight = Math.round(computeUsedWeight(items) * 10) / 10;
    const maxWeight  = keep.warehouse?.cap ?? KEEP_BASE_STORAGE;

    res.json({ keep, storage: { usedWeight, maxWeight }, goldBalance: empire?.goldBalance ?? 0 });
  } catch (err) { next(err); }
});

// ── Construct building ────────────────────────────────────────────────────────
keepRouter.post('/:id/buildings', async (req, res, next) => {
  try {
    const { buildingType, slotIndex } = z.object({
      buildingType: z.string(),
      slotIndex:    z.number().int().min(0),
    }).parse(req.body);

    const buildingTypeId = BUILDING_TYPE_IDS[buildingType as BuildingType];
    if (!buildingTypeId) { res.status(400).json({ error: `Unknown building type: ${buildingType}` }); return; }

    const id       = parseInt(req.params['id']!);
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const keep = await db.keep.findUnique({ where: { id, empireId } });
    if (!keep) { res.status(404).json({ error: 'Keep not found' }); return; }
    if (slotIndex >= keep.buildingSlotCount) { res.status(400).json({ error: 'Slot index out of range' }); return; }

    const existing = await db.building.findUnique({ where: { keepId_slotIndex: { keepId: keep.id, slotIndex } } });
    if (existing) { res.status(409).json({ error: 'Slot already occupied' }); return; }

    const costs = BUILDING_CONSTRUCTION_COSTS[buildingType as BuildingType] ?? [];
    const warehouseId = keep.warehouseId!;

    if (costs.length > 0) {
      const items    = await db.warehouseItem.findMany({ where: { warehouseId } });
      const itemsMap = new Map(items.map((e) => [e.resourceType, e.quantity]));
      for (const cost of costs) {
        const have = itemsMap.get(cost.resource) ?? 0;
        if (have < cost.quantity) {
          res.status(400).json({ error: `Not enough ${cost.resource} — need ${cost.quantity}, have ${Math.floor(have)}` });
          return;
        }
      }
    }

    const building = await db.$transaction(async (tx) => {
      // Deduct construction costs from warehouse
      for (const cost of costs) {
        await tx.warehouseItem.update({
          where: { warehouseId_resourceType: { warehouseId, resourceType: cost.resource } },
          data:  { quantity: { decrement: cost.quantity } },
        });
      }
      const b = await tx.building.create({
        data: { keepId: keep.id, buildingTypeId, slotIndex, level: 1, health: 100, workersAssigned: 0 },
      });
      // Increase warehouse capacity when a Warehouse building is constructed
      if (buildingTypeId === BUILDING_TYPE_IDS.WAREHOUSE) {
        await tx.warehouse.update({
          where: { id: warehouseId },
          data:  { cap: { increment: WAREHOUSE_BASE_CAPACITY } },
        });
      }
      return b;
    });
    res.status(201).json({ building });
  } catch (err) { next(err); }
});

// ── Unlock building slot ─────────────────────────────────────────────────────
keepRouter.post('/:id/unlock-slot', async (req, res, next) => {
  try {
    const id       = parseInt(req.params['id']!);
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const keep = await db.keep.findUnique({ where: { id, empireId } });
    if (!keep) { res.status(404).json({ error: 'Keep not found' }); return; }
    if (keep.buildingSlotCount >= KEEP_MAX_BUILDING_SLOTS) {
      res.status(400).json({ error: 'All building slots already unlocked' }); return;
    }

    const unlockNumber = keep.buildingSlotCount - KEEP_DEFAULT_BUILDING_SLOTS + 1;
    const cost         = unlockNumber;
    const warehouseId  = keep.warehouseId!;

    const item = await db.warehouseItem.findUnique({
      where: { warehouseId_resourceType: { warehouseId, resourceType: KEEP_SLOT_UNLOCK_RESOURCE } },
    });
    const held = item?.quantity ?? 0;
    if (held < cost) {
      res.status(400).json({ error: `Not enough ${KEEP_SLOT_UNLOCK_RESOURCE} — need ${cost}, have ${Math.floor(held)}` });
      return;
    }

    const [updatedKeep] = await db.$transaction([
      db.keep.update({ where: { id: keep.id }, data: { buildingSlotCount: { increment: 1 } } }),
      db.warehouseItem.update({
        where: { warehouseId_resourceType: { warehouseId, resourceType: KEEP_SLOT_UNLOCK_RESOURCE } },
        data:  { quantity: { decrement: cost } },
      }),
    ]);

    res.json({ keep: updatedKeep, cost, resource: KEEP_SLOT_UNLOCK_RESOURCE });
  } catch (err) { next(err); }
});

// ── Rename keep ──────────────────────────────────────────────────────────────
keepRouter.patch('/:id', async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(40) }).parse(req.body);
    const id       = parseInt(req.params['id']!);
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const existing = await db.keep.findUnique({ where: { id, empireId } });
    if (!existing) { res.status(404).json({ error: 'Keep not found' }); return; }
    const keep = await db.keep.update({ where: { id }, data: { name } });
    res.json({ keep });
  } catch (err) { next(err); }
});

// ── Demolish building ────────────────────────────────────────────────────────
keepRouter.delete('/:keepId/buildings/:buildingId', async (req, res, next) => {
  try {
    const keepId     = parseInt(req.params['keepId']!);
    const buildingId = parseInt(req.params['buildingId']!);
    const empireId   = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const building = await db.building.findFirst({
      where: { id: buildingId, keep: { id: keepId, empireId } },
    });
    if (!building) { res.status(404).json({ error: 'Building not found' }); return; }

    await db.$transaction(async (tx) => {
      await tx.building.delete({ where: { id: building.id } });
      // Decrease warehouse cap when a Warehouse building is demolished
      if (building.buildingTypeId === BUILDING_TYPE_IDS.WAREHOUSE) {
        const keep = await tx.keep.findUnique({ where: { id: keepId } });
        if (keep?.warehouseId) {
          await tx.warehouse.update({
            where: { id: keep.warehouseId },
            data:  { cap: { decrement: building.level * WAREHOUSE_BASE_CAPACITY } },
          });
        }
      }
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Assign workers ────────────────────────────────────────────────────────────
keepRouter.patch('/:keepId/buildings/:buildingId/workers', async (req, res, next) => {
  try {
    const { count }  = z.object({ count: z.number().int().min(0) }).parse(req.body);
    const keepId     = parseInt(req.params['keepId']!);
    const buildingId = parseInt(req.params['buildingId']!);
    const empireId   = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const existing = await db.building.findFirst({
      where: { id: buildingId, keep: { id: keepId, empireId } },
    });
    if (!existing) { res.status(404).json({ error: 'Building not found' }); return; }
    const building = await db.building.update({ where: { id: existing.id }, data: { workersAssigned: count } });
    res.json({ building });
  } catch (err) { next(err); }
});

// ── Repair building ───────────────────────────────────────────────────────────
keepRouter.post('/:keepId/buildings/:buildingId/repair', async (req, res, next) => {
  try {
    const keepId     = parseInt(req.params['keepId']!);
    const buildingId = parseInt(req.params['buildingId']!);
    const empireId   = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const building = await db.building.findFirst({
      where: { id: buildingId, keep: { id: keepId, empireId } },
    });
    if (!building) { res.status(404).json({ error: 'Building not found' }); return; }
    if (building.health >= 100) { res.status(400).json({ error: 'Building is already at full health' }); return; }

    const buildingTypeCode = BUILDING_TYPE_BY_ID[building.buildingTypeId] as BuildingType | undefined;
    const constructionCost = buildingTypeCode ? BUILDING_CONSTRUCTION_COSTS[buildingTypeCode] : undefined;
    if (!constructionCost) { res.status(400).json({ error: 'No construction cost defined for this building type' }); return; }

    const repairCost  = calculateRepairCost(constructionCost, building.level, building.health);
    const keep        = await db.keep.findUnique({ where: { id: keepId } });
    const warehouseId = keep?.warehouseId!;

    const items    = await db.warehouseItem.findMany({ where: { warehouseId } });
    const itemsMap = new Map(items.map((e) => [e.resourceType, e.quantity]));

    for (const { resource, quantity } of repairCost) {
      if ((itemsMap.get(resource) ?? 0) < quantity) {
        res.status(400).json({ error: `Insufficient ${resource} — need ${quantity}` });
        return;
      }
    }

    await db.$transaction([
      ...repairCost.map(({ resource, quantity }) =>
        db.warehouseItem.update({
          where: { warehouseId_resourceType: { warehouseId, resourceType: resource } },
          data:  { quantity: { decrement: quantity } },
        }),
      ),
      db.building.update({ where: { id: building.id }, data: { health: 100 } }),
    ]);

    res.json({ ok: true, repairCost });
  } catch (err) { next(err); }
});

// ── Upgrade building ──────────────────────────────────────────────────────────
keepRouter.post('/:keepId/buildings/:buildingId/upgrade', async (req, res, next) => {
  try {
    const keepId     = parseInt(req.params['keepId']!);
    const buildingId = parseInt(req.params['buildingId']!);
    const empireId   = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;

    const building = await db.building.findFirst({
      where: { id: buildingId, keep: { id: keepId, empireId } },
    });
    if (!building) { res.status(404).json({ error: 'Building not found' }); return; }
    if (building.level >= BUILDING_MAX_LEVEL) {
      res.status(400).json({ error: `Building is already at max level (${BUILDING_MAX_LEVEL})` }); return;
    }

    const buildingTypeCode = BUILDING_TYPE_BY_ID[building.buildingTypeId] as BuildingType | undefined;
    const constructionCost = buildingTypeCode ? BUILDING_CONSTRUCTION_COSTS[buildingTypeCode] : undefined;
    if (!constructionCost) { res.status(400).json({ error: 'No construction cost defined for this building type' }); return; }

    const upgradeCost = calculateUpgradeCost(constructionCost, building.level);
    const keep        = await db.keep.findUnique({ where: { id: keepId } });
    const warehouseId = keep?.warehouseId!;

    if (upgradeCost.length > 0) {
      const items    = await db.warehouseItem.findMany({ where: { warehouseId } });
      const itemsMap = new Map(items.map((e) => [e.resourceType, e.quantity]));
      for (const { resource, quantity } of upgradeCost) {
        if ((itemsMap.get(resource) ?? 0) < quantity) {
          res.status(400).json({ error: `Not enough ${resource} — need ${quantity}, have ${Math.floor(itemsMap.get(resource) ?? 0)}` });
          return;
        }
      }
    }

    const updated = await db.$transaction(async (tx) => {
      for (const { resource, quantity } of upgradeCost) {
        await tx.warehouseItem.update({
          where: { warehouseId_resourceType: { warehouseId, resourceType: resource } },
          data:  { quantity: { decrement: quantity } },
        });
      }
      const b = await tx.building.update({
        where: { id: building.id },
        data:  { level: { increment: 1 }, health: 100 },
      });
      // Warehouse buildings increase storage cap by one tier per level
      if (building.buildingTypeId === BUILDING_TYPE_IDS.WAREHOUSE) {
        await tx.warehouse.update({
          where: { id: warehouseId },
          data:  { cap: { increment: WAREHOUSE_BASE_CAPACITY } },
        });
      }
      return b;
    });

    res.json({ building: updated, upgradeCost });
  } catch (err) { next(err); }
});

// ── Production queue ──────────────────────────────────────────────────────────
keepRouter.get('/:id/queue/:buildingType', async (req, res, next) => {
  try {
    const keepId = parseInt(req.params['id']!);
    const buildingTypeId = BUILDING_TYPE_IDS[req.params['buildingType'] as BuildingType];
    if (!buildingTypeId) { res.status(400).json({ error: `Unknown building type: ${req.params['buildingType']}` }); return; }
    const orders = await db.productionOrder.findMany({
      where:   { keepId, buildingTypeId },
      orderBy: [{ orderType: 'asc' }, { position: 'asc' }],
    });
    res.json({ orders });
  } catch (err) { next(err); }
});

keepRouter.post('/:id/queue/:buildingType', async (req, res, next) => {
  try {
    const { recipeKey, orderType, targetQuantity } = z.object({
      recipeKey:      z.string(),
      orderType:      z.enum(['INFINITE', 'NUMERICAL']),
      targetQuantity: z.number().positive().optional(),
    }).parse(req.body);

    if (orderType === 'NUMERICAL' && !targetQuantity) {
      res.status(400).json({ error: 'targetQuantity required for NUMERICAL orders' });
      return;
    }

    const buildingTypeId = BUILDING_TYPE_IDS[req.params['buildingType'] as BuildingType];
    if (!buildingTypeId) { res.status(400).json({ error: `Unknown building type: ${req.params['buildingType']}` }); return; }

    const recipeId = RECIPE_IDS[recipeKey as keyof typeof RECIPE_IDS];
    if (!recipeId) { res.status(400).json({ error: `Unknown recipe: ${recipeKey}` }); return; }

    const keepId   = parseInt(req.params['id']!);
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const keepOwned = await db.keep.findUnique({ where: { id: keepId, empireId } });
    if (!keepOwned) { res.status(404).json({ error: 'Keep not found' }); return; }

    const last = await db.productionOrder.findFirst({
      where:   { keepId, buildingTypeId },
      orderBy: { position: 'desc' },
    });

    const order = await db.productionOrder.create({
      data: {
        keepId,
        buildingTypeId,
        recipeId,
        orderType,
        targetQuantity:   orderType === 'NUMERICAL' ? (targetQuantity ?? null) : null,
        producedQuantity: 0,
        position:         (last?.position ?? 0) + 1,
      },
    });

    // If this building has no active ProductionTask, start one now
    const building = await db.building.findFirst({
      where: { keepId, buildingTypeId, isActive: true, isDormant: false },
      include: { productionTask: true },
    });
    if (building && !building.productionTask) {
      await startTask(building.id, keepId, recipeId);
    }

    res.status(201).json({ order });
  } catch (err) { next(err); }
});

keepRouter.delete('/:keepId/queue/:orderId', async (req, res, next) => {
  try {
    const keepId   = parseInt(req.params['keepId']!);
    const orderId  = parseInt(req.params['orderId']!);
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;

    const order = await db.productionOrder.findFirst({
      where: { id: orderId, keep: { id: keepId, empireId } },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    // If there is an active production task for this recipe, cancel it and return inputs.
    const building = await db.building.findFirst({
      where:   { keepId, buildingTypeId: order.buildingTypeId },
      include: { productionTask: true },
    });

    if (building?.productionTask?.recipeId === order.recipeId) {
      const recipeKey = RECIPE_BY_ID[order.recipeId];
      const recipe    = recipeKey ? RECIPE_BY_KEY[recipeKey] : null;
      const keep      = await db.keep.findUnique({ where: { id: keepId }, select: { warehouseId: true } });
      const warehouseId = keep?.warehouseId;

      if (recipe && warehouseId) {
        cancelCompletion(building.id);
        await db.$transaction(async (tx) => {
          await tx.productionTask.delete({ where: { buildingId: building.id } });
          await tx.productionOrder.delete({ where: { id: order.id } });
          for (const input of recipe.inputs) {
            await tx.warehouseItem.upsert({
              where:  { warehouseId_resourceType: { warehouseId, resourceType: input.resource } },
              create: { warehouseId, resourceType: input.resource, quantity: input.quantity },
              update: { quantity: { increment: input.quantity } },
            });
          }
        });
        res.json({ ok: true, inputsReturned: true });
        return;
      }
    }

    await db.productionOrder.delete({ where: { id: order.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
