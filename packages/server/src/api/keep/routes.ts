import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { getAdminEmpireId } from '../../db/admin-empire.js';
import {
  RESOURCE_WEIGHT, KEEP_BASE_STORAGE, WAREHOUSE_BASE_CAPACITY,
  BUILDING_CONSTRUCTION_COSTS, KEEP_MAX_BUILDING_SLOTS,
  KEEP_DEFAULT_BUILDING_SLOTS, KEEP_SLOT_UNLOCK_RESOURCE,
} from '@merchant-realms/shared';
import type { BuildingType } from '@merchant-realms/shared';
import { calculateRepairCost } from '@merchant-realms/engine';

export const keepRouter = Router();

// ── List keeps ───────────────────────────────────────────────────────────────
keepRouter.get('/', async (_req, res, next) => {
  try {
    const empireId = await getAdminEmpireId();
    const keeps = await db.keep.findMany({
      where: { empireId },
      include: { plot: { include: { district: true } }, buildings: true },
    });
    res.json({ keeps });
  } catch (err) { next(err); }
});

// ── Create keep ──────────────────────────────────────────────────────────────
keepRouter.post('/', async (req, res, next) => {
  try {
    const { plotId, name } = z.object({ plotId: z.string(), name: z.string().min(1).max(40) }).parse(req.body);
    const empireId = await getAdminEmpireId();

    const existing = await db.keep.findFirst({ where: { plotId } });
    if (existing) { res.status(409).json({ error: 'Plot already has a Keep' }); return; }

    const keep = await db.keep.create({ data: { empireId, plotId, name, buildingSlotCount: KEEP_DEFAULT_BUILDING_SLOTS } });
    res.status(201).json({ keep });
  } catch (err) { next(err); }
});

// ── Keep detail ──────────────────────────────────────────────────────────────
keepRouter.get('/:id', async (req, res, next) => {
  try {
    // Run keep query and empire gold fetch in parallel
    const [keep, empireId] = await Promise.all([
      db.keep.findUnique({
        where: { id: req.params['id'] },
        include: {
          plot: { include: { district: true } },
          buildings: { orderBy: { slotIndex: 'asc' } },
          resourceLedger: { orderBy: { resourceType: 'asc' } },
          productionOrders: { orderBy: [{ buildingType: 'asc' }, { position: 'asc' }] },
        },
      }),
      getAdminEmpireId(),
    ]);
    if (!keep) { res.status(404).json({ error: 'Keep not found' }); return; }

    // Fetch gold — empireId is cached so this is just one query
    const empire = await db.empire.findUnique({ where: { id: empireId }, select: { goldBalance: true } });

    let usedWeight = 0;
    for (const entry of keep.resourceLedger) {
      const w = RESOURCE_WEIGHT[entry.resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.1;
      usedWeight += entry.quantity * w;
    }
    const warehouseCapacity = keep.buildings
      .filter((b) => b.buildingType === 'WAREHOUSE')
      .reduce((sum, b) => sum + b.level * WAREHOUSE_BASE_CAPACITY, 0);
    const maxWeight = KEEP_BASE_STORAGE + warehouseCapacity;

    res.json({ keep, storage: { usedWeight: Math.round(usedWeight * 10) / 10, maxWeight }, goldBalance: empire?.goldBalance ?? 0 });
  } catch (err) { next(err); }
});

// ── Construct building ────────────────────────────────────────────────────────
keepRouter.post('/:id/buildings', async (req, res, next) => {
  try {
    const { buildingType, slotIndex } = z.object({
      buildingType: z.string(),
      slotIndex: z.number().int().min(0),
    }).parse(req.body);

    const keep = await db.keep.findUnique({ where: { id: req.params['id'] } });
    if (!keep) { res.status(404).json({ error: 'Keep not found' }); return; }
    if (slotIndex >= keep.buildingSlotCount) { res.status(400).json({ error: 'Slot index out of range' }); return; }

    const existing = await db.building.findUnique({ where: { keepId_slotIndex: { keepId: keep.id, slotIndex } } });
    if (existing) { res.status(409).json({ error: 'Slot already occupied' }); return; }

    // Check and deduct construction costs
    const costs = BUILDING_CONSTRUCTION_COSTS[buildingType as BuildingType] ?? [];
    if (costs.length > 0) {
      const ledger = await db.resourceLedger.findMany({ where: { keepId: keep.id } });
      const ledgerMap = new Map(ledger.map((e) => [e.resourceType, e.quantity]));
      for (const cost of costs) {
        const have = ledgerMap.get(cost.resource) ?? 0;
        if (have < cost.quantity) {
          res.status(400).json({ error: `Not enough ${cost.resource} — need ${cost.quantity}, have ${Math.floor(have)}` });
          return;
        }
      }
      for (const cost of costs) {
        await db.resourceLedger.update({
          where: { keepId_resourceType: { keepId: keep.id, resourceType: cost.resource } },
          data: { quantity: { decrement: cost.quantity } },
        });
      }
    }

    const building = await db.building.create({
      data: { keepId: keep.id, buildingType, slotIndex, level: 1, health: 100, workersAssigned: 0 },
    });
    res.status(201).json({ building });
  } catch (err) { next(err); }
});

// ── Unlock building slot ─────────────────────────────────────────────────────
keepRouter.post('/:id/unlock-slot', async (req, res, next) => {
  try {
    const keep = await db.keep.findUnique({ where: { id: req.params['id'] } });
    if (!keep) { res.status(404).json({ error: 'Keep not found' }); return; }
    if (keep.buildingSlotCount >= KEEP_MAX_BUILDING_SLOTS) {
      res.status(400).json({ error: 'All building slots already unlocked' }); return;
    }

    // nth unlock costs n Scaffolding (1 for first, 2 for second, …)
    const unlockNumber = keep.buildingSlotCount - KEEP_DEFAULT_BUILDING_SLOTS + 1;
    const cost = unlockNumber;

    const ledgerEntry = await db.resourceLedger.findUnique({
      where: { keepId_resourceType: { keepId: keep.id, resourceType: KEEP_SLOT_UNLOCK_RESOURCE } },
    });
    const held = ledgerEntry?.quantity ?? 0;
    if (held < cost) {
      res.status(400).json({ error: `Not enough ${KEEP_SLOT_UNLOCK_RESOURCE} — need ${cost}, have ${Math.floor(held)}` });
      return;
    }

    const [updatedKeep] = await db.$transaction([
      db.keep.update({ where: { id: keep.id }, data: { buildingSlotCount: { increment: 1 } } }),
      db.resourceLedger.update({
        where: { keepId_resourceType: { keepId: keep.id, resourceType: KEEP_SLOT_UNLOCK_RESOURCE } },
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
    const keep = await db.keep.update({ where: { id: req.params['id'] }, data: { name } });
    res.json({ keep });
  } catch (err) { next(err); }
});

// ── Demolish building ────────────────────────────────────────────────────────
keepRouter.delete('/:keepId/buildings/:buildingId', async (req, res, next) => {
  try {
    await db.building.delete({ where: { id: req.params['buildingId'] } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Assign workers ────────────────────────────────────────────────────────────
keepRouter.patch('/:keepId/buildings/:buildingId/workers', async (req, res, next) => {
  try {
    const { count } = z.object({ count: z.number().int().min(0) }).parse(req.body);
    const building = await db.building.update({
      where: { id: req.params['buildingId'] },
      data: { workersAssigned: count },
    });
    res.json({ building });
  } catch (err) { next(err); }
});

// ── Repair building ───────────────────────────────────────────────────────────
keepRouter.post('/:keepId/buildings/:buildingId/repair', async (req, res, next) => {
  try {
    const building = await db.building.findUnique({ where: { id: req.params['buildingId'] } });
    if (!building) { res.status(404).json({ error: 'Building not found' }); return; }
    if (building.health >= 100) { res.status(400).json({ error: 'Building is already at full health' }); return; }

    const constructionCost = BUILDING_CONSTRUCTION_COSTS[building.buildingType as BuildingType];
    if (!constructionCost) { res.status(400).json({ error: 'No construction cost defined for this building type' }); return; }

    const repairCost = calculateRepairCost(constructionCost, building.level, building.health);

    // Check the keep has all required resources
    const ledger = await db.resourceLedger.findMany({ where: { keepId: req.params['keepId'] } });
    const ledgerMap = new Map(ledger.map((e) => [e.resourceType, e.quantity]));

    for (const { resource, quantity } of repairCost) {
      if ((ledgerMap.get(resource) ?? 0) < quantity) {
        res.status(400).json({ error: `Insufficient ${resource} — need ${quantity}` });
        return;
      }
    }

    // Deduct resources and restore building to full health
    await db.$transaction([
      ...repairCost.map(({ resource, quantity }) =>
        db.resourceLedger.update({
          where:  { keepId_resourceType: { keepId: req.params['keepId']!, resourceType: resource } },
          data:   { quantity: { decrement: quantity } },
        }),
      ),
      db.building.update({
        where: { id: building.id },
        data:  { health: 100 },
      }),
    ]);

    res.json({ ok: true, repairCost });
  } catch (err) { next(err); }
});

// ── Production queue ──────────────────────────────────────────────────────────
keepRouter.get('/:id/queue/:buildingType', async (req, res, next) => {
  try {
    const orders = await db.productionOrder.findMany({
      where: { keepId: req.params['id'], buildingType: req.params['buildingType'] },
      orderBy: [{ orderType: 'asc' }, { position: 'asc' }], // INFINITE sorts after NUMERICAL alphabetically
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

    // Position = max existing position + 1
    const last = await db.productionOrder.findFirst({
      where: { keepId: req.params['id'], buildingType: req.params['buildingType'] },
      orderBy: { position: 'desc' },
    });

    const order = await db.productionOrder.create({
      data: {
        keepId: req.params['id'],
        buildingType: req.params['buildingType'],
        recipeKey,
        orderType,
        targetQuantity: orderType === 'NUMERICAL' ? (targetQuantity ?? null) : null,
        producedQuantity: 0,
        position: (last?.position ?? 0) + 1,
      },
    });
    res.status(201).json({ order });
  } catch (err) { next(err); }
});

keepRouter.delete('/:keepId/queue/:orderId', async (req, res, next) => {
  try {
    await db.productionOrder.delete({ where: { id: req.params['orderId'] } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
