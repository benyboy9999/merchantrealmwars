import { Router } from 'express';
import { CreateOrderSchema, CancelOrderSchema, PaginationSchema } from '@artemis/shared';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';

export const exchangeRouter = Router();

exchangeRouter.get('/orders', async (req, res, next) => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    const orders = await db.marketOrder.findMany({
      where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

exchangeRouter.post('/orders', requireAuth, async (req, res, next) => {
  try {
    const body = CreateOrderSchema.parse(req.body);
    const empire = await db.empire.findFirst({ where: { playerId: req.auth!.playerId } });
    if (!empire) {
      res.status(404).json({ error: 'Empire not found' });
      return;
    }
    const order = await db.marketOrder.create({
      data: {
        empireId: empire.id,
        regionId: body.regionId,
        orderType: body.orderType,
        resourceType: body.resourceType,
        quantity: body.quantity,
        pricePerUnit: body.pricePerUnit,
        fulfilledQty: 0,
        status: 'OPEN',
      },
    });
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

exchangeRouter.delete('/orders/:id', requireAuth, async (req, res, next) => {
  try {
    const empire = await db.empire.findFirst({ where: { playerId: req.auth!.playerId } });
    const order = await db.marketOrder.findFirst({
      where: { id: req.params['id'], empireId: empire?.id },
    });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    await db.marketOrder.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
