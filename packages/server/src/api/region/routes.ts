import { Router } from 'express';
import { db } from '../../db/client.js';

export const regionRouter = Router();

regionRouter.get('/', async (_req, res, next) => {
  try {
    const regions = await db.region.findMany({ include: { districts: true } });
    res.json({ regions });
  } catch (err) { next(err); }
});

// All districts across all regions — used by the realm map (one round-trip instead of 5)
regionRouter.get('/districts', async (_req, res, next) => {
  try {
    const districts = await db.district.findMany({
      include: {
        plots: {
          include: {
            keeps: { select: { id: true, name: true, empireId: true } },
          },
        },
      },
    });
    res.json({ districts });
  } catch (err) { next(err); }
});

regionRouter.get('/:regionId/districts', async (req, res, next) => {
  try {
    const districts = await db.district.findMany({
      where: { regionId: req.params['regionId'] },
      include: {
        plots: {
          include: {
            keeps: {
              select: { id: true, name: true, empireId: true,
                empire: { select: { name: true } } },
            },
          },
        },
      },
    });
    res.json({ districts });
  } catch (err) { next(err); }
});
