// Public API — no authentication required, rate-limited.
// Scope TBD — see CLAUDE.md (TBD Systems > Public API scope).
// This file is a placeholder establishing the /api/public/v1/ namespace.

import { Router } from 'express';
import { db } from '../../db/client.js';

export const publicRouter = Router();

publicRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Placeholder — full public endpoints to be added once scope is decided
publicRouter.get('/exchange/orders', async (_req, res, next) => {
  try {
    const orders = await db.marketOrder.findMany({
      where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
      select: {
        id: true,
        regionId: true,
        orderType: true,
        resourceType: true,
        quantity: true,
        pricePerUnit: true,
        fulfilledQty: true,
        createdAt: true,
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});
