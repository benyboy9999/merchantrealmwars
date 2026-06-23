import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { adminState } from '../../admin-bypass.js';
import { runTick } from '../../jobs/tick-job.js';
import { checkHaltedBuildings, forceCompleteAllTasks } from '../../services/production-timers.js';
import { config } from '../../config/index.js';
import { requireAdmin } from '../../middleware/auth.js';
import { KEEP_FOUNDING_COST, MULE_CAPACITY_KG, REGION_IDS } from '@merchant-realms/shared';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

// ── Server status ────────────────────────────────────────────────────────────

adminRouter.get('/status', async (req, res) => {
  const empireId = req.auth!.empireId;
  const [lastTick, empire] = await Promise.all([
    db.gameTick.findFirst({ orderBy: { tickNumber: 'desc' } }),
    empireId ? db.empire.findUnique({ where: { id: empireId }, select: { goldBalance: true } }) : null,
  ]);
  res.json({
    bypassEnabled:       adminState.bypassEnabled,
    lastTick,
    goldBalance:         empire?.goldBalance ?? 0,
    tickIntervalSeconds: config.TICK_INTERVAL_SECONDS,
  });
});

adminRouter.post('/bypass', (req, res) => {
  const { enabled } = req.body as { enabled: boolean };
  adminState.bypassEnabled = Boolean(enabled);
  res.json({ bypassEnabled: adminState.bypassEnabled });
});

adminRouter.post('/tick', async (_req, res) => {
  try {
    const result = await runTick();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

adminRouter.post('/complete-caravans', async (_req, res) => {
  const caravans = await db.caravan.findMany({ where: { status: 'IN_TRANSIT' } });
  for (const c of caravans) {
    await db.caravan.update({
      where: { id: c.id },
      data: {
        status:       'IDLE',
        locationType: c.destType!,
        locationId:   c.destId!,
        destType:     null,
        destId:       null,
        departedAt:   null,
        arrivesAt:    null,
      },
    });
  }
  res.json({ completed: caravans.length });
});

adminRouter.post('/complete-production', async (_req, res) => {
  const completed = await forceCompleteAllTasks();
  res.json({ completed });
});

adminRouter.get('/world', async (_req, res) => {
  const [keeps, caravans, orders] = await Promise.all([
    db.keep.findMany({
      include: {
        buildings: true,
        warehouse: { include: { items: true } },
        plot:      { include: { district: true } },
      },
    }),
    db.caravan.findMany({ where: { status: 'IN_TRANSIT' } }),
    db.marketOrder.findMany({ where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] } }, take: 50 }),
  ]);
  res.json({ keeps, caravans, orders });
});

// ── Player management ────────────────────────────────────────────────────────

adminRouter.get('/players', async (_req, res, next) => {
  try {
    const players = await db.player.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        lastActiveAt: true,
        googleId: true,
        empire: {
          select: {
            id: true,
            name: true,
            goldBalance: true,
            _count: { select: { keeps: true, caravans: true } },
          },
        },
      },
    });
    res.json({ players });
  } catch (err) { next(err); }
});

adminRouter.get('/players/:id', async (req, res, next) => {
  try {
    const player = await db.player.findUnique({
      where: { id: parseInt(req.params['id']!) },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        lastActiveAt: true,
        googleId: true,
        empire: {
          include: {
            keeps: {
              include: {
                warehouse: { include: { items: true } },
                buildings: true,
                plot:      { include: { district: true } },
              },
            },
            caravans:   { include: { warehouse: { include: { items: true } } } },
            warehouses: { where: { type: 'EXCHANGE' }, include: { items: true } },
          },
        },
      },
    });
    if (!player) { res.status(404).json({ error: 'Player not found' }); return; }
    res.json({ player });
  } catch (err) { next(err); }
});

// Adjust gold — op: 'set' | 'add'
adminRouter.patch('/players/:id/gold', async (req, res, next) => {
  try {
    const { amount, op } = z.object({
      amount: z.number(),
      op:     z.enum(['set', 'add']),
    }).parse(req.body);

    const player = await db.player.findUnique({
      where:  { id: parseInt(req.params['id']!) },
      select: { empire: { select: { id: true } } },
    });
    if (!player?.empire) { res.status(404).json({ error: 'Player has no empire' }); return; }

    const empire = await db.empire.update({
      where: { id: player.empire.id },
      data:  op === 'set'
        ? { goldBalance: Math.max(0, amount) }
        : { goldBalance: { increment: amount } },
      select: { goldBalance: true },
    });
    res.json({ goldBalance: empire.goldBalance });
  } catch (err) { next(err); }
});

// Grant resources to a keep's warehouse
adminRouter.post('/players/:id/resources', async (req, res, next) => {
  try {
    const { keepId, resourceType, quantity } = z.object({
      keepId:       z.number().int(),
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const keep = await db.keep.findUnique({
      where:  { id: keepId },
      select: { warehouseId: true, empire: { select: { player: { select: { id: true } } } } },
    });
    if (!keep || keep.empire.player.id !== parseInt(req.params['id']!)) {
      res.status(404).json({ error: 'Keep not found for this player' }); return;
    }

    const warehouseId = keep.warehouseId!;
    const item = await db.warehouseItem.upsert({
      where:  { warehouseId_resourceType: { warehouseId, resourceType } },
      create: { warehouseId, resourceType, quantity },
      update: { quantity: { increment: quantity } },
    });
    void checkHaltedBuildings(keepId);
    res.json({ item });
  } catch (err) { next(err); }
});

// Grant resources to exchange warehouse
adminRouter.post('/players/:id/exchange-resources', async (req, res, next) => {
  try {
    const { regionId, resourceType, quantity } = z.object({
      regionId:     z.number().int(),
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const player = await db.player.findUnique({
      where:  { id: parseInt(req.params['id']!) },
      select: { empire: { select: { id: true } } },
    });
    if (!player?.empire) { res.status(404).json({ error: 'Player has no empire' }); return; }

    const empireId = player.empire.id;
    let warehouse = await db.warehouse.findFirst({ where: { empireId, regionId, type: 'EXCHANGE' } });
    if (!warehouse) {
      warehouse = await db.warehouse.create({
        data: { type: 'EXCHANGE', empireId, regionId, cap: 1_000_000_000 },
      });
    }

    const item = await db.warehouseItem.upsert({
      where:  { warehouseId_resourceType: { warehouseId: warehouse.id, resourceType } },
      create: { warehouseId: warehouse.id, resourceType, quantity },
      update: { quantity: { increment: quantity } },
    });
    res.json({ item });
  } catch (err) { next(err); }
});

// Provision starter caravan (for players stuck with no caravan)
adminRouter.post('/players/:id/starter-caravan', async (req, res, next) => {
  try {
    const player = await db.player.findUnique({
      where:  { id: parseInt(req.params['id']!) },
      select: { empire: { select: { id: true } } },
    });
    if (!player?.empire) { res.status(404).json({ error: 'Player has no empire' }); return; }

    const caravan = await db.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.create({
        data: { type: 'CARAVAN', empireId: player.empire!.id, cap: MULE_CAPACITY_KG },
      });
      const c = await tx.caravan.create({
        data: {
          empireId:     player.empire!.id,
          name:         'Starter Caravan',
          animalType:   'MULE',
          animalCount:  1,
          locationType: 'EXCHANGE',
          locationId:   REGION_IDS.CENTRAL,
          status:       'IDLE',
          warehouseId:  warehouse.id,
        },
      });
      await tx.warehouseItem.createMany({
        data: KEEP_FOUNDING_COST.map((cost) => ({
          warehouseId:  warehouse.id,
          resourceType: cost.resource,
          quantity:     cost.quantity,
        })),
      });
      return c;
    });

    res.json({ caravan });
  } catch (err) { next(err); }
});

// Toggle admin status for a player
adminRouter.patch('/players/:id/admin', async (req, res, next) => {
  try {
    const { isAdmin } = z.object({ isAdmin: z.boolean() }).parse(req.body);
    const player = await db.player.update({
      where:  { id: parseInt(req.params['id']!) },
      data:   { isAdmin },
      select: { id: true, email: true, isAdmin: true },
    });
    res.json({ player });
  } catch (err) { next(err); }
});

// Delete a player and all their data
adminRouter.delete('/players/:id', async (req, res, next) => {
  try {
    await db.player.delete({ where: { id: parseInt(req.params['id']!) } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
