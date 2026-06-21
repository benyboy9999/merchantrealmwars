import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';

export const exchangeRouter = Router();
exchangeRouter.use(requireAuth);

function empireGuard(empireId: string | null | undefined, res: import('express').Response): empireId is string {
  if (!empireId) { res.status(403).json({ error: 'Create an empire first' }); return false; }
  return true;
}

// ── Exchange storage ──────────────────────────────────────────────────────────

exchangeRouter.get('/storage', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const regionId = (req.query['regionId'] as string) ?? 'CENTRAL';
    const [storage, empire] = await Promise.all([
      db.exchangeStorage.findMany({
        where: { empireId, regionId },
        orderBy: { resourceType: 'asc' },
      }),
      db.empire.findUnique({ where: { id: empireId }, select: { goldBalance: true } }),
    ]);
    res.json({ storage, goldBalance: empire?.goldBalance ?? 0 });
  } catch (err) { next(err); }
});

// ── Listings — browse ─────────────────────────────────────────────────────────

exchangeRouter.get('/:regionId/listings', async (req, res, next) => {
  try {
    const { resourceType } = z.object({ resourceType: z.string().optional() }).parse(req.query);
    const listings = await db.marketOrder.findMany({
      where: {
        regionId: req.params['regionId'],
        orderType: 'SELL',
        status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
        ...(resourceType ? { resourceType } : {}),
      },
      orderBy: [{ resourceType: 'asc' }, { pricePerUnit: 'asc' }],
      take: 500,
    });
    res.json({ listings });
  } catch (err) { next(err); }
});

// ── Listings — create ─────────────────────────────────────────────────────────

exchangeRouter.post('/:regionId/listings', async (req, res, next) => {
  try {
    const { resourceType, quantity, pricePerUnit } = z.object({
      resourceType: z.string(),
      quantity:     z.number().positive(),
      pricePerUnit: z.number().positive(),
    }).parse(req.body);

    const regionId = req.params['regionId']!;
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;

    const storage = await db.exchangeStorage.findUnique({
      where: { empireId_regionId_resourceType: { empireId, regionId, resourceType } },
    });
    if (!storage || storage.quantity < quantity) {
      res.status(400).json({ error: 'Insufficient quantity in exchange storage' });
      return;
    }

    const [, listing] = await db.$transaction([
      db.exchangeStorage.update({
        where: { empireId_regionId_resourceType: { empireId, regionId, resourceType } },
        data:  { quantity: { decrement: quantity } },
      }),
      db.marketOrder.create({
        data: { empireId, regionId, orderType: 'SELL', resourceType, quantity, pricePerUnit },
      }),
    ]);

    res.status(201).json({ listing });
  } catch (err) { next(err); }
});

// ── Listings — buy ────────────────────────────────────────────────────────────

exchangeRouter.post('/listings/:id/buy', async (req, res, next) => {
  try {
    const { quantity } = z.object({ quantity: z.number().positive() }).parse(req.body);
    const listingId     = req.params['id']!;
    const buyerEmpireId = req.auth!.empireId;
    if (!empireGuard(buyerEmpireId, res)) return;

    const [listing, buyer] = await Promise.all([
      db.marketOrder.findUnique({ where: { id: listingId } }),
      db.empire.findUnique({ where: { id: buyerEmpireId }, select: { id: true, goldBalance: true } }),
    ]);

    if (!listing || listing.status === 'CANCELLED' || listing.status === 'FILLED') {
      res.status(409).json({ error: 'LISTING_EXPIRED' });
      return;
    }
    if (!buyer) { res.status(404).json({ error: 'Empire not found' }); return; }

    const totalGold = quantity * listing.pricePerUnit;
    if (buyer.goldBalance < totalGold) {
      res.status(400).json({ error: `Insufficient gold — need ${totalGold.toFixed(0)}g, have ${buyer.goldBalance.toFixed(0)}g` });
      return;
    }

    try {
      await db.$transaction(async (tx) => {
        const claimed = await tx.$executeRaw`
          UPDATE "MarketOrder"
          SET    "fulfilledQty" = "fulfilledQty" + ${quantity}
          WHERE  "id" = ${listingId}
            AND  "status" IN ('OPEN', 'PARTIALLY_FILLED')
            AND  ("quantity" - "fulfilledQty") >= ${quantity}
        `;
        if (claimed === 0) throw new Error('LISTING_EXPIRED');

        await tx.empire.update({ where: { id: buyer.id }, data: { goldBalance: { decrement: totalGold } } });
        if (listing.empireId) {
          await tx.empire.update({ where: { id: listing.empireId }, data: { goldBalance: { increment: totalGold } } });
        }

        await tx.exchangeStorage.upsert({
          where:  { empireId_regionId_resourceType: { empireId: buyer.id, regionId: listing.regionId, resourceType: listing.resourceType } },
          create: { empireId: buyer.id, regionId: listing.regionId, resourceType: listing.resourceType, quantity },
          update: { quantity: { increment: quantity } },
        });

        const updated = await tx.marketOrder.findUnique({ where: { id: listingId }, select: { quantity: true, fulfilledQty: true } });
        if (updated && updated.fulfilledQty >= updated.quantity) {
          await tx.marketOrder.update({ where: { id: listingId }, data: { status: 'FILLED' } });
        } else {
          await tx.marketOrder.update({ where: { id: listingId }, data: { status: 'PARTIALLY_FILLED' } });
        }

        await tx.marketTrade.create({
          data: {
            listingId,
            sellerEmpireId: listing.empireId ?? null,
            buyerEmpireId:  buyer.id,
            resourceType:   listing.resourceType,
            quantity,
            pricePerUnit:   listing.pricePerUnit,
            totalGold,
          },
        });
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'LISTING_EXPIRED') {
        res.status(409).json({ error: 'LISTING_EXPIRED' });
        return;
      }
      throw err;
    }

    res.json({ ok: true, quantity, resourceType: listing.resourceType, totalGold });
  } catch (err) { next(err); }
});

// ── Listings — cancel ─────────────────────────────────────────────────────────

exchangeRouter.delete('/listings/:id', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const listing = await db.marketOrder.findUnique({ where: { id: req.params['id'] } });

    if (!listing) { res.status(404).json({ error: 'Listing not found' }); return; }
    if (listing.empireId !== empireId) { res.status(403).json({ error: 'Not your listing' }); return; }
    if (listing.status !== 'OPEN' && listing.status !== 'PARTIALLY_FILLED') {
      res.status(400).json({ error: 'Listing cannot be cancelled' }); return;
    }

    const remaining = listing.quantity - listing.fulfilledQty;
    await db.$transaction([
      db.marketOrder.update({ where: { id: listing.id }, data: { status: 'CANCELLED' } }),
      db.exchangeStorage.upsert({
        where:  { empireId_regionId_resourceType: { empireId, regionId: listing.regionId, resourceType: listing.resourceType } },
        create: { empireId, regionId: listing.regionId, resourceType: listing.resourceType, quantity: remaining },
        update: { quantity: { increment: remaining } },
      }),
    ]);

    res.json({ ok: true, returned: remaining, resourceType: listing.resourceType });
  } catch (err) { next(err); }
});

// ── NPC sell endpoint (dev shortcut) ─────────────────────────────────────────

exchangeRouter.post('/sell', async (req, res, next) => {
  try {
    const { regionId, resourceType, quantity } = z.object({
      regionId:     z.string(),
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const entry = await db.exchangeStorage.findUnique({
      where: { empireId_regionId_resourceType: { empireId, regionId, resourceType } },
    });
    if (!entry || entry.quantity < quantity) {
      res.status(400).json({ error: 'Not enough in exchange storage' });
      return;
    }

    const gold = quantity;
    await db.$transaction([
      entry.quantity - quantity < 0.001
        ? db.exchangeStorage.delete({ where: { empireId_regionId_resourceType: { empireId, regionId, resourceType } } })
        : db.exchangeStorage.update({ where: { empireId_regionId_resourceType: { empireId, regionId, resourceType } }, data: { quantity: { decrement: quantity } } }),
      db.empire.update({ where: { id: empireId }, data: { goldBalance: { increment: gold } } }),
    ]);

    res.json({ ok: true, sold: quantity, gold, resourceType });
  } catch (err) { next(err); }
});
