import { Router } from 'express';
import { db } from '../../db/client.js';
import { adminState } from '../../admin-bypass.js';
import { runTick } from '../../jobs/tick-job.js';
import { config } from '../../config/index.js';
import { RECIPE_BY_KEY } from '@merchant-realms/shared';
import type { ResourceType } from '@merchant-realms/shared';

export const adminRouter = Router();

// Simple token check — set ADMIN_TOKEN in .env
adminRouter.use((req, res, next) => {
  const token = req.headers['x-admin-token'] ?? req.query['adminToken'];
  if (token !== process.env['ADMIN_TOKEN']) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }
  next();
});

adminRouter.get('/status', async (_req, res) => {
  const [lastTick, player] = await Promise.all([
    db.gameTick.findFirst({ orderBy: { tickNumber: 'desc' } }),
    db.player.findUnique({ where: { email: 'admin@merchantrealms.dev' } }),
  ]);
  const empire = player ? await db.empire.findUnique({ where: { playerId: player.id } }) : null;
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
        // Consume inputs (skip when bypass is on)
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
