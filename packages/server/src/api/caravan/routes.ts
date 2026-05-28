import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { adminState } from '../../admin-bypass.js';

export const caravanRouter = Router();

const TRAVEL_SECONDS = 60; // 60s base travel time; admin bypass sets to 0

caravanRouter.get('/', async (_req, res, next) => {
  try {
    const caravans = await db.caravan.findMany({ orderBy: { departedAt: 'desc' } });
    res.json({ caravans });
  } catch (err) { next(err); }
});

caravanRouter.post('/dispatch', async (req, res, next) => {
  try {
    const body = z.object({
      fromKeepId:   z.string(),
      toKeepId:     z.string(),
      resourceType: z.string(),
      quantity:     z.number().positive(),
      animalType:   z.enum(['MULE', 'HORSE']),
      animalCount:  z.number().int().min(1).default(1),
      feedLoaded:   z.number().min(0).default(0),
    }).parse(req.body);

    const fromKeep = await db.keep.findUnique({ where: { id: body.fromKeepId } });
    if (!fromKeep) { res.status(404).json({ error: 'Origin keep not found' }); return; }

    // Check cargo available (skip if admin bypass)
    if (!adminState.bypassEnabled) {
      const ledger = await db.resourceLedger.findUnique({
        where: { keepId_resourceType: { keepId: body.fromKeepId, resourceType: body.resourceType } },
      });
      if (!ledger || ledger.quantity < body.quantity) {
        res.status(400).json({ error: 'Insufficient resources in origin keep' });
        return;
      }
      // Deduct cargo
      await db.resourceLedger.update({
        where: { keepId_resourceType: { keepId: body.fromKeepId, resourceType: body.resourceType } },
        data: { quantity: { decrement: body.quantity } },
      });
    }

    const now = new Date();
    const arrivesAt = adminState.bypassEnabled
      ? new Date(now.getTime() + 1000) // arrives in 1s when bypassed
      : new Date(now.getTime() + TRAVEL_SECONDS * 1000);

    const empire = await db.empire.findFirst({
      where: { keeps: { some: { id: body.fromKeepId } } },
    });

    const caravan = await db.caravan.create({
      data: {
        empireId:     empire!.id,
        originType:   'KEEP',
        originId:     body.fromKeepId,
        destType:     'KEEP',
        destId:       body.toKeepId,
        resourceType: body.resourceType,
        quantity:     body.quantity,
        animalType:   body.animalType,
        animalCount:  body.animalCount,
        feedLoaded:   body.feedLoaded,
        departedAt:   now,
        arrivesAt,
        status: 'IN_TRANSIT',
      },
    });
    res.status(201).json({ caravan });
  } catch (err) { next(err); }
});

caravanRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const caravan = await db.caravan.findUnique({ where: { id: req.params['id'] } });
    if (!caravan || caravan.status !== 'IN_TRANSIT') {
      res.status(400).json({ error: 'Caravan not in transit' });
      return;
    }
    await db.caravan.update({ where: { id: caravan.id }, data: { status: 'CANCELLED' } });

    // Return cargo to origin keep
    if (caravan.originType === 'KEEP') {
      await db.resourceLedger.upsert({
        where:  { keepId_resourceType: { keepId: caravan.originId, resourceType: caravan.resourceType } },
        create: { keepId: caravan.originId, resourceType: caravan.resourceType, quantity: caravan.quantity },
        update: { quantity: { increment: caravan.quantity } },
      });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});
