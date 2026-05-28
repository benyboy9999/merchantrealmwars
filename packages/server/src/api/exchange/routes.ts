import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';

export const exchangeRouter = Router();

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
    const adminPlayer = await db.player.findUnique({ where: { email: 'admin@artemis.dev' } });
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
