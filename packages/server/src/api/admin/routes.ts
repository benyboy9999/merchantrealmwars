import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { adminState } from '../../admin-bypass.js';
import { runTick } from '../../jobs/tick-job.js';
import { config } from '../../config/index.js';
import { requireAdmin } from '../../middleware/auth.js';
import { RECIPE_BY_KEY, KEEP_FOUNDING_COST } from '@merchant-realms/shared';
import type { ResourceType } from '@merchant-realms/shared';

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
    bypassEnabled: adminState.bypassEnabled,
    lastTick,
    goldBalance: empire?.goldBalance ?? 0,
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
  const keeps = await db.keep.findMany({
    include: {
      buildings: true,
      resourceLedger: true,
      productionOrders: { orderBy: [{ orderType: 'asc' }, { position: 'asc' }] },
    },
  });

  let completed = 0;

  for (const keep of keeps) {
    const ledgerMap = new Map(keep.resourceLedger.map((e) => [e.resourceType, e.quantity]));

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
      const activeOrder = numericalOrders[0] ?? infiniteOrders[0];
      if (!activeOrder) continue;

      const recipe = RECIPE_BY_KEY[activeOrder.recipeKey];
      if (!recipe) continue;

      for (const building of buildings) {
        const scaledInputs = recipe.inputs.map((inp) => ({
          resource: inp.resource as ResourceType,
          quantity: inp.quantity * building.level,
        }));
        const inputsOk = adminState.bypassEnabled || scaledInputs.every(
          (inp) => (ledgerMap.get(inp.resource) ?? 0) >= inp.quantity,
        );
        if (!inputsOk) continue;

        if (!adminState.bypassEnabled) {
          for (const inp of scaledInputs) {
            ledgerMap.set(inp.resource, (ledgerMap.get(inp.resource) ?? 0) - inp.quantity);
          }
        }

        const outputQty = recipe.outputQty * building.level;
        ledgerMap.set(recipe.output as ResourceType, (ledgerMap.get(recipe.output as ResourceType) ?? 0) + outputQty);

        await db.building.update({ where: { id: building.id }, data: { productionProgress: 0 } });
        completed++;

        if (activeOrder.orderType === 'NUMERICAL') {
          activeOrder.producedQuantity += outputQty;
        }
      }

      if (activeOrder.orderType === 'NUMERICAL') {
        if ((activeOrder.targetQuantity ?? 0) <= activeOrder.producedQuantity) {
          await db.productionOrder.delete({ where: { id: activeOrder.id } });
        } else {
          await db.productionOrder.update({ where: { id: activeOrder.id }, data: { producedQuantity: activeOrder.producedQuantity } });
        }
      }
    }

    for (const [resourceType, quantity] of ledgerMap) {
      await db.resourceLedger.upsert({
        where:  { keepId_resourceType: { keepId: keep.id, resourceType } },
        create: { keepId: keep.id, resourceType, quantity: Math.max(0, quantity) },
        update: { quantity: Math.max(0, quantity) },
      });
    }
  }

  res.json({ completed });
});

adminRouter.get('/world', async (_req, res) => {
  const [keeps, caravans, orders] = await Promise.all([
    db.keep.findMany({ include: { buildings: true, resourceLedger: true, plot: { include: { district: true } } } }),
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
      where: { id: req.params['id'] },
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
                resourceLedger: true,
                buildings: true,
                plot: { include: { district: true } },
              },
            },
            caravans: { include: { cargo: true } },
            exchangeStorages: true,
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
      op: z.enum(['set', 'add']),
    }).parse(req.body);

    const player = await db.player.findUnique({
      where: { id: req.params['id'] },
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

// Grant resources to a keep's storage
adminRouter.post('/players/:id/resources', async (req, res, next) => {
  try {
    const { keepId, resourceType, quantity } = z.object({
      keepId:       z.string(),
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const keep = await db.keep.findUnique({
      where: { id: keepId },
      select: { empire: { select: { player: { select: { id: true } } } } },
    });
    if (!keep || keep.empire.player.id !== req.params['id']) {
      res.status(404).json({ error: 'Keep not found for this player' }); return;
    }

    const ledger = await db.resourceLedger.upsert({
      where:  { keepId_resourceType: { keepId, resourceType } },
      create: { keepId, resourceType, quantity },
      update: { quantity: { increment: quantity } },
    });
    res.json({ ledger });
  } catch (err) { next(err); }
});

// Grant gold to exchange storage
adminRouter.post('/players/:id/exchange-resources', async (req, res, next) => {
  try {
    const { regionId, resourceType, quantity } = z.object({
      regionId:     z.string(),
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const player = await db.player.findUnique({
      where: { id: req.params['id'] },
      select: { empire: { select: { id: true } } },
    });
    if (!player?.empire) { res.status(404).json({ error: 'Player has no empire' }); return; }

    const storage = await db.exchangeStorage.upsert({
      where:  { empireId_regionId_resourceType: { empireId: player.empire.id, regionId, resourceType } },
      create: { empireId: player.empire.id, regionId, resourceType, quantity },
      update: { quantity: { increment: quantity } },
    });
    res.json({ storage });
  } catch (err) { next(err); }
});

// Provision starter caravan (for players stuck with no caravan)
adminRouter.post('/players/:id/starter-caravan', async (req, res, next) => {
  try {
    const player = await db.player.findUnique({
      where: { id: req.params['id'] },
      select: { empire: { select: { id: true } } },
    });
    if (!player?.empire) { res.status(404).json({ error: 'Player has no empire' }); return; }

    const caravan = await db.caravan.create({
      data: {
        empireId:     player.empire.id,
        name:         'Starter Caravan',
        animalType:   'MULE',
        animalCount:  1,
        locationType: 'EXCHANGE',
        locationId:   'CENTRAL',
        status:       'IDLE',
      },
    });

    await db.caravanCargo.createMany({
      data: KEEP_FOUNDING_COST.map((cost) => ({
        caravanId:    caravan.id,
        resourceType: cost.resource,
        quantity:     cost.quantity,
      })),
    });

    res.json({ caravan });
  } catch (err) { next(err); }
});

// Toggle admin status for a player
adminRouter.patch('/players/:id/admin', async (req, res, next) => {
  try {
    const { isAdmin } = z.object({ isAdmin: z.boolean() }).parse(req.body);
    const player = await db.player.update({
      where: { id: req.params['id'] },
      data:  { isAdmin },
      select: { id: true, email: true, isAdmin: true },
    });
    res.json({ player });
  } catch (err) { next(err); }
});

// Delete a player and all their data
adminRouter.delete('/players/:id', async (req, res, next) => {
  try {
    await db.player.delete({ where: { id: req.params['id'] } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
