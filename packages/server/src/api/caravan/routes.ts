import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { adminState } from '../../admin-bypass.js';
import { KEEP_FOUNDING_COST, KEEP_BASE_STORAGE, KEEP_DEFAULT_BUILDING_SLOTS, getStarterSpeedMultiplier } from '@merchant-realms/shared';
import { scheduleArrival } from '../../services/caravan-timers.js';

export const caravanRouter = Router();
caravanRouter.use(requireAuth);

const TRAVEL_SECONDS = 60;

function empireGuard(empireId: string | null | undefined, res: import('express').Response): empireId is string {
  if (!empireId) { res.status(403).json({ error: 'Create an empire first' }); return false; }
  return true;
}

// ── List caravans ────────────────────────────────────────────────────────────
caravanRouter.get('/', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;

    const caravans = await db.caravan.findMany({
      where:   { empireId },
      include: { warehouse: { include: { items: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ caravans });
  } catch (err) { next(err); }
});

// ── Single caravan ───────────────────────────────────────────────────────────
caravanRouter.get('/:id', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const caravan = await db.caravan.findUnique({
      where:   { id: req.params['id'], empireId },
      include: { warehouse: { include: { items: true } } },
    });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }

    const items      = caravan.warehouse?.items ?? [];
    const usedWeight = Math.round(
      items.reduce((s, e) => s + e.quantity * 0.5, 0) * 10,
    ) / 10;
    const maxWeight = caravan.warehouse?.cap ?? 0;

    res.json({ caravan, capacity: { usedWeight, maxWeight } });
  } catch (err) { next(err); }
});

// ── Dispatch caravan ─────────────────────────────────────────────────────────
caravanRouter.post('/:id/dispatch', async (req, res, next) => {
  try {
    const { destType, destId } = z.object({
      destType: z.enum(['KEEP', 'EXCHANGE', 'PLOT']),
      destId:   z.string(),
    }).parse(req.body);

    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const caravan = await db.caravan.findUnique({
      where:   { id: req.params['id'], empireId },
      include: { empire: { select: { createdAt: true } } },
    });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }
    if (caravan.status !== 'IDLE') { res.status(400).json({ error: 'Caravan is already in transit' }); return; }

    if (destType === 'KEEP') {
      const keep = await db.keep.findUnique({ where: { id: destId } });
      if (!keep) { res.status(404).json({ error: 'Destination keep not found' }); return; }
    } else if (destType === 'PLOT') {
      const plot = await db.plot.findUnique({ where: { id: destId } });
      if (!plot) { res.status(404).json({ error: 'Destination plot not found' }); return; }
    }

    const now             = new Date();
    const empireAgeDays   = (now.getTime() - caravan.empire.createdAt.getTime()) / 86_400_000;
    const starterMultiplier = getStarterSpeedMultiplier(empireAgeDays);
    const arrivesAt       = adminState.bypassEnabled
      ? new Date(now.getTime() + 1000)
      : new Date(now.getTime() + (TRAVEL_SECONDS / starterMultiplier) * 1000);

    const updated = await db.caravan.update({
      where:   { id: caravan.id },
      data:    { status: 'IN_TRANSIT', destType, destId, departedAt: now, arrivesAt },
      include: { warehouse: { include: { items: true } } },
    });

    scheduleArrival(updated.id, arrivesAt);
    res.json({ caravan: updated });
  } catch (err) { next(err); }
});

// ── Found a keep at a plot ────────────────────────────────────────────────────
caravanRouter.post('/found', async (req, res, next) => {
  try {
    const { plotId, keepName } = z.object({
      plotId:   z.string(),
      keepName: z.string().min(1).max(40),
    }).parse(req.body);

    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;

    const existing = await db.keep.findFirst({ where: { plotId } });
    if (existing) { res.status(409).json({ error: 'Plot already has a keep' }); return; }

    const caravans = await db.caravan.findMany({
      where:   { empireId, locationType: 'PLOT', locationId: plotId, status: 'IDLE' },
      include: { warehouse: { include: { items: true } } },
    });
    if (caravans.length === 0) { res.status(400).json({ error: 'No caravans at this plot' }); return; }

    const combined = new Map<string, number>();
    for (const c of caravans) {
      for (const item of c.warehouse?.items ?? []) {
        combined.set(item.resourceType, (combined.get(item.resourceType) ?? 0) + item.quantity);
      }
    }

    for (const cost of KEEP_FOUNDING_COST) {
      if ((combined.get(cost.resource) ?? 0) < cost.quantity) {
        res.status(400).json({
          error: `Not enough ${cost.resource} — need ${cost.quantity}, have ${Math.floor(combined.get(cost.resource) ?? 0)}`,
        });
        return;
      }
    }

    // Deduct founding costs from caravan warehouses, spreading across multiple caravans
    for (const cost of KEEP_FOUNDING_COST) {
      let remaining = cost.quantity;
      for (const c of caravans) {
        if (remaining <= 0) break;
        const item = c.warehouse?.items.find((x) => x.resourceType === cost.resource);
        if (!item || !c.warehouseId) continue;
        const take   = Math.min(item.quantity, remaining);
        const newQty = item.quantity - take;
        if (newQty < 0.001) {
          await db.warehouseItem.delete({
            where: { warehouseId_resourceType: { warehouseId: c.warehouseId, resourceType: cost.resource } },
          });
        } else {
          await db.warehouseItem.update({
            where: { warehouseId_resourceType: { warehouseId: c.warehouseId, resourceType: cost.resource } },
            data:  { quantity: newQty },
          });
        }
        remaining -= take;
      }
    }

    // Create keep + warehouse atomically
    const keep = await db.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.create({
        data: { type: 'KEEP', empireId, cap: KEEP_BASE_STORAGE },
      });
      const k = await tx.keep.create({
        data: { empireId, plotId, name: keepName, buildingSlotCount: KEEP_DEFAULT_BUILDING_SLOTS, warehouseId: warehouse.id },
      });
      // Move caravans from plot to the new keep
      await tx.caravan.updateMany({
        where: { empireId, locationType: 'PLOT', locationId: plotId, status: 'IDLE' },
        data:  { locationType: 'KEEP', locationId: k.id },
      });
      return k;
    });

    res.status(201).json({ keep });
  } catch (err) { next(err); }
});
