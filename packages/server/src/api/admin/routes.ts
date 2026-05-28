import { Router } from 'express';
import { db } from '../../db/client.js';
import { adminState } from '../../admin-bypass.js';
import { runTick } from '../../jobs/tick-job.js';

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
  const lastTick = await db.gameTick.findFirst({ orderBy: { tickNumber: 'desc' } });
  res.json({ bypassEnabled: adminState.bypassEnabled, lastTick });
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
  const updated = await db.caravan.updateMany({
    where: { status: 'IN_TRANSIT' },
    data:  { status: 'ARRIVED', arrivesAt: new Date() },
  });
  res.json({ completed: updated.count });
});

adminRouter.get('/world', async (_req, res) => {
  const [keeps, caravans, orders] = await Promise.all([
    db.keep.findMany({ include: { buildings: true, resourceLedger: true, plot: true } }),
    db.caravan.findMany({ where: { status: 'IN_TRANSIT' } }),
    db.marketOrder.findMany({ where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] } }, take: 50 }),
  ]);
  res.json({ keeps, caravans, orders });
});
