import { Router } from 'express';
import { CreateEmpireSchema } from '@artemis/shared';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';

export const empireRouter = Router();

empireRouter.use(requireAuth);

empireRouter.get('/me', async (req, res, next) => {
  try {
    const empire = await db.empire.findFirst({
      where: { playerId: req.auth!.playerId },
      include: { keeps: true },
    });
    if (!empire) {
      res.status(404).json({ error: 'No empire found' });
      return;
    }
    res.json({ empire });
  } catch (err) {
    next(err);
  }
});

empireRouter.post('/', async (req, res, next) => {
  try {
    const existing = await db.empire.findFirst({ where: { playerId: req.auth!.playerId } });
    if (existing) {
      res.status(409).json({ error: 'Empire already exists' });
      return;
    }
    const body = CreateEmpireSchema.parse(req.body);
    const empire = await db.empire.create({
      data: { playerId: req.auth!.playerId, name: body.name, goldBalance: 0 },
    });
    res.status(201).json({ empire });
  } catch (err) {
    next(err);
  }
});
