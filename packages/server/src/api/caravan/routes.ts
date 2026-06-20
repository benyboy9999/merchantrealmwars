import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { getAdminEmpireId } from '../../db/admin-empire.js';
import { adminState } from '../../admin-bypass.js';
import { RESOURCE_WEIGHT, MULE_CAPACITY_KG, KEEP_FOUNDING_COST, getStarterSpeedMultiplier } from '@merchant-realms/shared';

export const caravanRouter = Router();

const TRAVEL_SECONDS = 60;

// ── List caravans ────────────────────────────────────────────────────────────
caravanRouter.get('/', async (_req, res, next) => {
  try {
    const empireId = await getAdminEmpireId();

    // Deliver any caravans that have passed their arrivesAt — avoids waiting for the next tick
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
    const caravan = await db.caravan.findUnique({
      where: { id: req.params['id'] },
      include: { cargo: true },
    });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }

    // Capacity info
    const usedWeight = caravan.cargo.reduce((sum, c) => {
      const w = RESOURCE_WEIGHT[c.resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.5;
      return sum + c.quantity * w;
    }, 0);
    const maxWeight = caravan.animalCount * MULE_CAPACITY_KG;

    res.json({ caravan, capacity: { usedWeight: Math.round(usedWeight * 10) / 10, maxWeight } });
  } catch (err) { next(err); }
});

// ── Load resource into caravan (from location inventory) ─────────────────────
caravanRouter.post('/:id/load', async (req, res, next) => {
  try {
    const { resourceType, quantity } = z.object({
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const caravan = await db.caravan.findUnique({ where: { id: req.params['id'] }, include: { cargo: true } });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }
    if (caravan.status !== 'IDLE') { res.status(400).json({ error: 'Caravan is in transit' }); return; }
    if (caravan.locationType !== 'KEEP' && caravan.locationType !== 'EXCHANGE') {
      res.status(400).json({ error: 'Can only load at a Keep or Exchange' }); return;
    }

    // Capacity check (always enforced)
    const currentWeight = caravan.cargo.reduce((sum, c) =>
      sum + c.quantity * (RESOURCE_WEIGHT[c.resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.5), 0);
    const newItemWeight = quantity * (RESOURCE_WEIGHT[resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.5);
    const maxWeight = caravan.animalCount * MULE_CAPACITY_KG;
    if (!adminState.bypassEnabled && currentWeight + newItemWeight > maxWeight) {
      res.status(400).json({ error: `Exceeds caravan capacity (${maxWeight} kg)` }); return;
    }

    // Deduct from source inventory using a single atomic UPDATE so concurrent requests
    // cannot both pass the availability check and double-deduct.
    if (caravan.locationType === 'KEEP') {
      if (adminState.bypassEnabled) {
        // Bypass: deduct whatever is available, allow negative
        await db.resourceLedger.updateMany({
          where: { keepId: caravan.locationId, resourceType },
          data:  { quantity: { decrement: quantity } },
        });
      } else {
        // Atomic: only deducts if quantity >= requested; returns 0 rows if not
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
      // EXCHANGE — same atomic pattern
      const empireId = await getAdminEmpireId();
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

    // Add to cargo — also atomic so concurrent requests don't stack
    await db.caravanCargo.upsert({
      where: { caravanId_resourceType: { caravanId: caravan.id, resourceType } },
      create: { caravanId: caravan.id, resourceType, quantity },
      update: { quantity: { increment: quantity } },
    });

    const updated = await db.caravan.findUnique({ where: { id: caravan.id }, include: { cargo: true } });
    res.json({ caravan: updated });
  } catch (err) { next(err); }
});

// ── Unload resource from caravan (to location inventory) ─────────────────────
caravanRouter.post('/:id/unload', async (req, res, next) => {
  try {
    const { resourceType, quantity } = z.object({
      resourceType: z.string(),
      quantity:     z.number().positive(),
    }).parse(req.body);

    const caravan = await db.caravan.findUnique({ where: { id: req.params['id'] }, include: { cargo: true } });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }
    if (caravan.status !== 'IDLE') { res.status(400).json({ error: 'Caravan is in transit' }); return; }

    const cargoEntry = caravan.cargo.find((c) => c.resourceType === resourceType);
    if (!cargoEntry || cargoEntry.quantity < quantity) {
      res.status(400).json({ error: 'Not enough cargo to unload' });
      return;
    }

    // Update cargo
    if (cargoEntry.quantity - quantity < 0.001) {
      await db.caravanCargo.delete({ where: { id: cargoEntry.id } });
    } else {
      await db.caravanCargo.update({
        where: { id: cargoEntry.id },
        data: { quantity: { decrement: quantity } },
      });
    }

    // Deposit to location
    if (caravan.locationType === 'KEEP') {
      await db.resourceLedger.upsert({
        where:  { keepId_resourceType: { keepId: caravan.locationId, resourceType } },
        create: { keepId: caravan.locationId, resourceType, quantity },
        update: { quantity: { increment: quantity } },
      });
    } else if (caravan.locationType === 'EXCHANGE') {
      const empireId = await getAdminEmpireId();
      await db.exchangeStorage.upsert({
        where:  { empireId_regionId_resourceType: { empireId: empireId, regionId: caravan.locationId, resourceType } },
        create: { empireId: empireId, regionId: caravan.locationId, resourceType, quantity },
        update: { quantity: { increment: quantity } },
      });
    }
    // PLOT: no location storage; cargo stays in caravan until founding

    const updated = await db.caravan.findUnique({ where: { id: caravan.id }, include: { cargo: true } });
    res.json({ caravan: updated });
  } catch (err) { next(err); }
});

// ── Dispatch caravan to destination ─────────────────────────────────────────
caravanRouter.post('/:id/dispatch', async (req, res, next) => {
  try {
    const { destType, destId } = z.object({
      destType: z.enum(['KEEP', 'EXCHANGE', 'PLOT']),
      destId:   z.string(),
    }).parse(req.body);

    const caravan = await db.caravan.findUnique({
      where:   { id: req.params['id'] },
      include: { empire: { select: { createdAt: true } } },
    });
    if (!caravan) { res.status(404).json({ error: 'Caravan not found' }); return; }
    if (caravan.status !== 'IDLE') { res.status(400).json({ error: 'Caravan is already in transit' }); return; }

    // Validate destination exists
    if (destType === 'KEEP') {
      const keep = await db.keep.findUnique({ where: { id: destId } });
      if (!keep) { res.status(404).json({ error: 'Destination keep not found' }); return; }
    } else if (destType === 'PLOT') {
      const plot = await db.plot.findUnique({ where: { id: destId } });
      if (!plot) { res.status(404).json({ error: 'Destination plot not found' }); return; }
    }
    // EXCHANGE: destId is regionId — no validation needed for pilot

    const now = new Date();
    const empireAgeDays = (now.getTime() - caravan.empire.createdAt.getTime()) / 86_400_000;
    const starterMultiplier = getStarterSpeedMultiplier(empireAgeDays);
    const arrivesAt = adminState.bypassEnabled
      ? new Date(now.getTime() + 1000)
      : new Date(now.getTime() + (TRAVEL_SECONDS / starterMultiplier) * 1000);

    const updated = await db.caravan.update({
      where: { id: caravan.id },
      data: {
        status:    'IN_TRANSIT',
        destType,
        destId,
        departedAt: now,
        arrivesAt,
      },
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

    const empireId = await getAdminEmpireId();

    // Check plot is unoccupied
    const existing = await db.keep.findFirst({ where: { plotId } });
    if (existing) { res.status(409).json({ error: 'Plot already has a keep' }); return; }

    // Find all idle caravans at this plot
    const caravans = await db.caravan.findMany({
      where: { empireId: empireId, locationType: 'PLOT', locationId: plotId, status: 'IDLE' },
      include: { cargo: true },
    });
    if (caravans.length === 0) { res.status(400).json({ error: 'No caravans at this plot' }); return; }

    // Sum cargo across all caravans at the plot
    const combined = new Map<string, number>();
    for (const c of caravans) {
      for (const cargo of c.cargo) {
        combined.set(cargo.resourceType, (combined.get(cargo.resourceType) ?? 0) + cargo.quantity);
      }
    }

    // Check founding cost
    for (const cost of KEEP_FOUNDING_COST) {
      if ((combined.get(cost.resource) ?? 0) < cost.quantity) {
        res.status(400).json({
          error: `Not enough ${cost.resource} — need ${cost.quantity}, have ${Math.floor(combined.get(cost.resource) ?? 0)}`,
        });
        return;
      }
    }

    // Deduct founding materials from caravan cargo (FIFO across caravans)
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

    // Create the keep
    const keep = await db.keep.create({
      data: { empireId: empireId, plotId, name: keepName, buildingSlotCount: 6 },
    });

    // Move caravans to the new keep
    await db.caravan.updateMany({
      where: { empireId: empireId, locationType: 'PLOT', locationId: plotId, status: 'IDLE' },
      data: { locationType: 'KEEP', locationId: keep.id },
    });

    res.status(201).json({ keep });
  } catch (err) { next(err); }
});
