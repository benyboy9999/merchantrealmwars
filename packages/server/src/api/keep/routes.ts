import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { RESOURCE_WEIGHT, KEEP_BASE_STORAGE, WAREHOUSE_BASE_CAPACITY } from '@artemis/shared';

export const keepRouter = Router();

const ADMIN_EMPIRE_EMAIL = 'admin@artemis.dev';

async function getAdminEmpire() {
  const player = await db.player.findUnique({ where: { email: ADMIN_EMPIRE_EMAIL } });
  if (!player) throw new Error('Admin player not found — run pnpm db:seed first');
  const empire = await db.empire.findUnique({ where: { playerId: player.id } });
  if (!empire) throw new Error('Admin empire not found — run pnpm db:seed first');
  return empire;
}

// ── List keeps ───────────────────────────────────────────────────────────────
keepRouter.get('/', async (_req, res, next) => {
  try {
    const empire = await getAdminEmpire();
    const keeps = await db.keep.findMany({
      where: { empireId: empire.id },
      include: { plot: true, buildings: true },
    });
    res.json({ keeps });
  } catch (err) { next(err); }
});

// ── Create keep ──────────────────────────────────────────────────────────────
keepRouter.post('/', async (req, res, next) => {
  try {
    const { plotId, name } = z.object({ plotId: z.string(), name: z.string().min(1).max(40) }).parse(req.body);
    const empire = await getAdminEmpire();

    const existing = await db.keep.findFirst({ where: { plotId } });
    if (existing) { res.status(409).json({ error: 'Plot already has a Keep' }); return; }

    const keep = await db.keep.create({ data: { empireId: empire.id, plotId, name, buildingSlotCount: 6 } });
    res.status(201).json({ keep });
  } catch (err) { next(err); }
});

// ── Keep detail ──────────────────────────────────────────────────────────────
keepRouter.get('/:id', async (req, res, next) => {
  try {
    const keep = await db.keep.findUnique({
      where: { id: req.params['id'] },
      include: {
        plot: true,
        buildings: { orderBy: { slotIndex: 'asc' } },
        resourceLedger: { orderBy: { resourceType: 'asc' } },
        productionOrders: { orderBy: [{ buildingType: 'asc' }, { position: 'asc' }] },
      },
    });
    if (!keep) { res.status(404).json({ error: 'Keep not found' }); return; }

    // Compute weight
    let usedWeight = 0;
    for (const entry of keep.resourceLedger) {
      const w = RESOURCE_WEIGHT[entry.resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.1;
      usedWeight += entry.quantity * w;
    }
    const warehouseCapacity = keep.buildings
      .filter((b) => b.buildingType === 'WAREHOUSE')
      .reduce((sum, b) => sum + b.level * WAREHOUSE_BASE_CAPACITY, 0);
    const maxWeight = KEEP_BASE_STORAGE + warehouseCapacity;

    res.json({ keep, storage: { usedWeight: Math.round(usedWeight * 10) / 10, maxWeight } });
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

    const building = await db.building.create({
      data: { keepId: keep.id, buildingType, slotIndex, level: 1, health: 100, workersAssigned: 0 },
    });
    res.status(201).json({ building });
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
        targetQuantity: orderType === 'NUMERICAL' ? targetQuantity : null,
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
