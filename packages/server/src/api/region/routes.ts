import { Router } from 'express';
import { db } from '../../db/client.js';

export const regionRouter = Router();

regionRouter.get('/', async (_req, res, next) => {
  try {
    const regions = await db.region.findMany({ include: { plots: true } });
    res.json({ regions });
  } catch (err) { next(err); }
});

regionRouter.get('/:regionId/plots', async (req, res, next) => {
  try {
    const plots = await db.plot.findMany({
      where: { regionId: req.params['regionId'] },
      include: {
        keeps: {
          select: { id: true, name: true, empireId: true,
            empire: { select: { name: true } } },
        },
      },
    });
    res.json({ plots });
  } catch (err) { next(err); }
});
