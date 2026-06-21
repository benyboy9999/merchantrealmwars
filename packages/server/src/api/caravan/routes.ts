import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { adminState } from '../../admin-bypass.js';
import { RESOURCE_WEIGHT, MULE_CAPACITY_KG, KEEP_FOUNDING_COST, getStarterSpeedMultiplier } from '@merchant-realms/shared';

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

    const arrived = await db.caravan.findMany({
      where: { empireId, status: 'IN_TRANSIT', arrivesAt: { lte: new Date() } },
    });
    for (const c of arrived) {
      try {
        await db.caravan.update({
          where: { id: c.id },
          data: {
            status:       'IDLE',
            locationType: c.destType!,
            locationId:   c.destId!,
            destType:     null,
            destId:       null,
            departedAt:   null,
            arrivesAt:    null,
          },
        });
      } catch (deliveryErr) {
        console.error(`[caravan] failed to deliver caravan ${c.id}:`, deliveryErr);
      }
    }

    const caravans = await db.caravan.findMany({
      where: { empireId },
      include: { cargo: true },
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
      where: { id: req.params['id'], empireId },
      include: { cargo: true },
    });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }

    const usedWeight = caravan.cargo.reduce((sum, c) => {
      const w = RESOURCE_WEIGHT[c.resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.5;
      return sum + c.quantity * w;
    }, 0);
    const maxWeight = caravan.animalCount * MULE_CAPACITY_KG;

    res.json({ caravan, capacity: { usedWeight: Math.round(usedWeight * 10) / 10, maxWeight } });
  } catch (err) { next(err); }
});

// ── Load resource into caravan ────────────────────────────────────────────────
caravanRouter.post('/:id/load', async (req, res, next) => {
  try {
    const { resourceType, quantity } = z.object({
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const caravan = await db.caravan.findUnique({ where: { id: req.params['id'], empireId }, include: { cargo: true } });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }
    if (caravan.status !== 'IDLE') { res.status(400).json({ error: 'Caravan is in transit' }); return; }
    if (caravan.locationType !== 'KEEP' && caravan.locationType !== 'EXCHANGE') {
      res.status(400).json({ error: 'Can only load at a Keep or Exchange' }); return;
    }

    const currentWeight = caravan.cargo.reduce((sum, c) =>
      sum + c.quantity * (RESOURCE_WEIGHT[c.resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.5), 0);
    const newItemWeight = quantity * (RESOURCE_WEIGHT[resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.5);
    const maxWeight = caravan.animalCount * MULE_CAPACITY_KG;
    if (!adminState.bypassEnabled && currentWeight + newItemWeight > maxWeight) {
      res.status(400).json({ error: `Exceeds caravan capacity (${maxWeight} kg)` }); return;
    }

    if (caravan.locationType === 'KEEP') {
      if (adminState.bypassEnabled) {
        await db.resourceLedger.updateMany({
          where: { keepId: caravan.locationId, resourceType },
          data:  { quantity: { decrement: quantity } },
        });
      } else {
        const deducted = await db.$executeRaw`
          UPDATE "ResourceLedger"
          SET    quantity = quantity - ${quantity}
          WHERE  "keepId" = ${caravan.locationId}
            AND  "resourceType" = ${resourceType}
            AND  quantity >= ${quantity}
        `;
        if (deducted === 0) {
          res.status(400).json({ error: 'Not enough resources in keep' }); return;
        }
      }
    } else {
      if (adminState.bypassEnabled) {
        await db.exchangeStorage.updateMany({
          where: { empireId, regionId: caravan.locationId, resourceType },
          data:  { quantity: { decrement: quantity } },
        });
      } else {
        const deducted = await db.$executeRaw`
          UPDATE "ExchangeStorage"
          SET    quantity = quantity - ${quantity}
          WHERE  "empireId" = ${empireId}
            AND  "regionId" = ${caravan.locationId}
            AND  "resourceType" = ${resourceType}
            AND  quantity >= ${quantity}
        `;
        if (deducted === 0) {
          res.status(400).json({ error: 'Not enough resources in exchange storage' }); return;
        }
      }
    }

    await db.caravanCargo.upsert({
      where:  { caravanId_resourceType: { caravanId: caravan.id, resourceType } },
      create: { caravanId: caravan.id, resourceType, quantity },
      update: { quantity: { increment: quantity } },
    });

    const updated = await db.caravan.findUnique({ where: { id: caravan.id }, include: { cargo: true } });
    res.json({ caravan: updated });
  } catch (err) { next(err); }
});

// ── Unload resource from caravan ──────────────────────────────────────────────
caravanRouter.post('/:id/unload', async (req, res, next) => {
  try {
    const { resourceType, quantity } = z.object({
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const caravan = await db.caravan.findUnique({ where: { id: req.params['id'], empireId }, include: { cargo: true } });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }
    if (caravan.status !== 'IDLE') { res.status(400).json({ error: 'Caravan is in transit' }); return; }

    const cargoEntry = caravan.cargo.find((c) => c.resourceType === resourceType);
    if (!cargoEntry || cargoEntry.quantity < quantity) {
      res.status(400).json({ error: 'Not enough cargo to unload' }); return;
    }

    if (cargoEntry.quantity - quantity < 0.001) {
      await db.caravanCargo.delete({ where: { id: cargoEntry.id } });
    } else {
      await db.caravanCargo.update({ where: { id: cargoEntry.id }, data: { quantity: { decrement: quantity } } });
    }

    if (caravan.locationType === 'KEEP') {
      await db.resourceLedger.upsert({
        where:  { keepId_resourceType: { keepId: caravan.locationId, resourceType } },
        create: { keepId: caravan.locationId, resourceType, quantity },
        update: { quantity: { increment: quantity } },
      });
    } else if (caravan.locationType === 'EXCHANGE') {
      await db.exchangeStorage.upsert({
        where:  { empireId_regionId_resourceType: { empireId, regionId: caravan.locationId, resourceType } },
        create: { empireId, regionId: caravan.locationId, resourceType, quantity },
        update: { quantity: { increment: quantity } },
      });
    }

    const updated = await db.caravan.findUnique({ where: { id: caravan.id }, include: { cargo: true } });
    res.json({ caravan: updated });
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

    const now = new Date();
    const empireAgeDays = (now.getTime() - caravan.empire.createdAt.getTime()) / 86_400_000;
    const starterMultiplier = getStarterSpeedMultiplier(empireAgeDays);
    const arrivesAt = adminState.bypassEnabled
      ? new Date(now.getTime() + 1000)
      : new Date(now.getTime() + (TRAVEL_SECONDS / starterMultiplier) * 1000);

    const updated = await db.caravan.update({
      where: { id: caravan.id },
      data:  { status: 'IN_TRANSIT', destType, destId, departedAt: now, arrivesAt },
      include: { cargo: true },
    });

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
      where: { empireId, locationType: 'PLOT', locationId: plotId, status: 'IDLE' },
      include: { cargo: true },
    });
    if (caravans.length === 0) { res.status(400).json({ error: 'No caravans at this plot' }); return; }

    const combined = new Map<string, number>();
    for (const c of caravans) {
      for (const cargo of c.cargo) {
        combined.set(cargo.resourceType, (combined.get(cargo.resourceType) ?? 0) + cargo.quantity);
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

    for (const cost of KEEP_FOUNDING_COST) {
      let remaining = cost.quantity;
      for (const c of caravans) {
        if (remaining <= 0) break;
        const entry = c.cargo.find((x) => x.resourceType === cost.resource);
        if (!entry) continue;
        const take = Math.min(entry.quantity, remaining);
        if (entry.quantity - take < 0.001) {
          await db.caravanCargo.delete({ where: { id: entry.id } });
        } else {
          await db.caravanCargo.update({ where: { id: entry.id }, data: { quantity: { decrement: take } } });
        }
        remaining -= take;
      }
    }

    const keep = await db.keep.create({
      data: { empireId, plotId, name: keepName, buildingSlotCount: 6 },
    });

    await db.caravan.updateMany({
      where: { empireId, locationType: 'PLOT', locationId: plotId, status: 'IDLE' },
      data:  { locationType: 'KEEP', locationId: keep.id },
    });

    res.status(201).json({ keep });
  } catch (err) { next(err); }
});
