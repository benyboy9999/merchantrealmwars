import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';

const NPC_BUY_PRICE = 1; // gold per unit — NPC auto-purchases at this price for pilot

async function getAdminEmpire() {
  const player = await db.player.findUnique({ where: { email: 'admin@merchantrealms.dev' } });
  if (!player) throw new Error('Admin player not found');
  const empire = await db.empire.findUnique({ where: { playerId: player.id } });
  if (!empire) throw new Error('Admin empire not found');
  return empire;
}

export const exchangeRouter = Router();

// ── Exchange storage ─────────────────────────────────────────────────────────
exchangeRouter.get('/storage', async (req, res, next) => {
  try {
    const regionId = (req.query['regionId'] as string) ?? 'CENTRAL';
    const empire = await getAdminEmpire();
    const [storage] = await Promise.all([
      db.exchangeStorage.findMany({ where: { empireId: empire.id, regionId }, orderBy: { resourceType: 'asc' } }),
    ]);
    res.json({ storage, goldBalance: empire.goldBalance });
  } catch (err) { next(err); }
});

// Sell resources from exchange storage to NPC (auto-buy at 1g/unit)
exchangeRouter.post('/sell', async (req, res, next) => {
  try {
    const { regionId, resourceType, quantity } = z.object({
      regionId:     z.string(),
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const empire = await getAdminEmpire();

    const entry = await db.exchangeStorage.findUnique({
      where: { empireId_regionId_resourceType: { empireId: empire.id, regionId, resourceType } },
    });
    if (!entry || entry.quantity < quantity) {
      res.status(400).json({ error: 'Not enough in exchange storage' });
      return;
    }

    const gold = quantity * NPC_BUY_PRICE;

    if (entry.quantity - quantity < 0.001) {
      await db.exchangeStorage.delete({
        where: { empireId_regionId_resourceType: { empireId: empire.id, regionId, resourceType } },
      });
    } else {
      await db.exchangeStorage.update({
        where: { empireId_regionId_resourceType: { empireId: empire.id, regionId, resourceType } },
        data: { quantity: { decrement: quantity } },
      });
    }

    await db.empire.update({
      where: { id: empire.id },
      data: { goldBalance: { increment: gold } },
    });

    res.json({ ok: true, sold: quantity, gold, resourceType });
  } catch (err) { next(err); }
});

// Buy from NPC → deposited to exchange storage
exchangeRouter.post('/buy', async (req, res, next) => {
  try {
    const { regionId, resourceType, quantity } = z.object({
      regionId:     z.string(),
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const empire = await getAdminEmpire();
    const cost = quantity * NPC_BUY_PRICE;

    if (empire.goldBalance < cost) {
      res.status(400).json({ error: `Not enough gold — need ${cost}g, have ${empire.goldBalance.toFixed(0)}g` });
      return;
    }

    await db.empire.update({ where: { id: empire.id }, data: { goldBalance: { decrement: cost } } });
    await db.exchangeStorage.upsert({
      where:  { empireId_regionId_resourceType: { empireId: empire.id, regionId, resourceType } },
      create: { empireId: empire.id, regionId, resourceType, quantity },
      update: { quantity: { increment: quantity } },
    });

    res.json({ ok: true, bought: quantity, cost, resourceType });
  } catch (err) { next(err); }
});

// ── Market orders ────────────────────────────────────────────────────────────
// List open orders (no auth for concept)
exchangeRouter.get('/orders', async (req, res, next) => {
  try {
    const regionId = (req.query['regionId'] as string) ?? 'CENTRAL';
    const orders = await db.marketOrder.findMany({
      where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] }, regionId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ orders });
  } catch (err) { next(err); }
});

// Fill a sell order — buy from it (no auth for concept, goes to admin empire)
exchangeRouter.post('/orders/:id/fill', async (req, res, next) => {
  try {
    const { quantity } = z.object({ quantity: z.number().positive() }).parse(req.body);
    const order = await db.marketOrder.findUnique({ where: { id: req.params['id'] } });
    if (!order || order.status === 'CANCELLED' || order.status === 'FILLED') {
      res.status(404).json({ error: 'Order not available' });
      return;
    }
    if (order.orderType !== 'SELL') {
      res.status(400).json({ error: 'Can only fill SELL orders via this endpoint' });
      return;
    }

    const available = order.quantity - order.fulfilledQty;
    const filled = Math.min(quantity, available);

    // Add resource to admin empire's first keep
    const adminPlayer = await db.player.findUnique({ where: { email: 'admin@merchantrealms.dev' } });
    const empire = adminPlayer ? await db.empire.findUnique({ where: { playerId: adminPlayer.id } }) : null;
    const keep = empire ? await db.keep.findFirst({ where: { empireId: empire.id } }) : null;

    if (keep) {
      await db.resourceLedger.upsert({
        where:  { keepId_resourceType: { keepId: keep.id, resourceType: order.resourceType } },
        create: { keepId: keep.id, resourceType: order.resourceType, quantity: filled },
        update: { quantity: { increment: filled } },
      });
    }

    // Update order
    const newFulfilled = order.fulfilledQty + filled;
    const newStatus = newFulfilled >= order.quantity ? 'FILLED' : 'PARTIALLY_FILLED';

    // NPC orders reset quantity rather than filling (unlimited supply)
    if (order.empireId === null) {
      // NPC order — don't mark as filled, just record the trade
      await db.marketOrder.update({ where: { id: order.id }, data: { fulfilledQty: 0 } });
    } else {
      await db.marketOrder.update({ where: { id: order.id }, data: { fulfilledQty: newFulfilled, status: newStatus } });
    }

    res.json({ ok: true, filled, resourceType: order.resourceType });
  } catch (err) { next(err); }
});
