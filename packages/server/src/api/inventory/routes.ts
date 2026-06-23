import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { adminState } from '../../admin-bypass.js';
import { RESOURCE_WEIGHT } from '@merchant-realms/shared';
import { checkHaltedBuildings } from '../../services/production-timers.js';

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

const TransferSchema = z.object({
  fromWarehouseId: z.number().int(),
  toWarehouseId:   z.number().int(),
  resourceType:    z.string(),
  quantity:        z.number().positive(),
});

function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

function usedWeight(items: { resourceType: string; quantity: number }[]): number {
  return items.reduce(
    (s, e) => s + e.quantity * (RESOURCE_WEIGHT[e.resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.5),
    0,
  );
}

inventoryRouter.post('/transfer', async (req, res, next) => {
  try {
    const { fromWarehouseId, toWarehouseId, resourceType, quantity } = TransferSchema.parse(req.body);
    const empireId = req.auth!.empireId;
    if (!empireId) { res.status(403).json({ error: 'Create an empire first' }); return; }

    if (fromWarehouseId === toWarehouseId) {
      res.status(400).json({ error: 'Source and destination are the same' });
      return;
    }

    // Load both warehouses in parallel — ownership enforced by empireId filter.
    // Include caravan relation so we can check IDLE status without an extra round-trip.
    const [src, dst] = await Promise.all([
      db.warehouse.findUnique({
        where:   { id: fromWarehouseId, empireId },
        include: { items: true, caravan: { select: { status: true } } },
      }),
      db.warehouse.findUnique({
        where:   { id: toWarehouseId, empireId },
        include: { items: true, caravan: { select: { status: true } } },
      }),
    ]);

    if (!src) fail(404, 'Source warehouse not found');
    if (!dst) fail(404, 'Destination warehouse not found');

    if (src.caravan?.status === 'IN_TRANSIT') fail(400, 'Source caravan is in transit');
    if (dst.caravan?.status === 'IN_TRANSIT') fail(400, 'Destination caravan is in transit');

    const srcItem = src.items.find((x) => x.resourceType === resourceType);
    if (!srcItem || srcItem.quantity < quantity) fail(400, 'Not enough resources in source warehouse');

    if (!adminState.bypassEnabled) {
      const addKg  = quantity * (RESOURCE_WEIGHT[resourceType as keyof typeof RESOURCE_WEIGHT] ?? 0.5);
      if (usedWeight(dst.items) + addKg > dst.cap) {
        fail(400, `Exceeds warehouse capacity (${dst.cap} kg)`);
      }
    }

    // Atomic: deduct source, upsert destination
    await db.$transaction([
      srcItem.quantity - quantity <= 0
        ? db.warehouseItem.delete({
            where: { warehouseId_resourceType: { warehouseId: fromWarehouseId, resourceType } },
          })
        : db.warehouseItem.update({
            where: { warehouseId_resourceType: { warehouseId: fromWarehouseId, resourceType } },
            data:  { quantity: srcItem.quantity - quantity },
          }),
      db.warehouseItem.upsert({
        where:  { warehouseId_resourceType: { warehouseId: toWarehouseId, resourceType } },
        create: { warehouseId: toWarehouseId, resourceType, quantity },
        update: { quantity: { increment: quantity } },
      }),
    ]);

    // Build updated warehouse states in-memory — no post-transaction fetch needed
    const newSrcQty  = srcItem.quantity - quantity;
    const updatedSrc = {
      ...src,
      items: newSrcQty <= 0
        ? src.items.filter((x) => x.resourceType !== resourceType)
        : src.items.map((x) => x.resourceType === resourceType ? { ...x, quantity: newSrcQty } : x),
    };

    const dstItem    = dst.items.find((x) => x.resourceType === resourceType);
    const updatedDst = {
      ...dst,
      items: dstItem
        ? dst.items.map((x) => x.resourceType === resourceType ? { ...x, quantity: x.quantity + quantity } : x)
        : [...dst.items, { id: 0, warehouseId: toWarehouseId, resourceType, quantity, updatedAt: new Date() }],
    };

    // If items just landed in a KEEP warehouse, try to restart any halted production
    if (dst.type === 'KEEP') {
      const destKeep = await db.keep.findFirst({ where: { warehouseId: dst.id } });
      if (destKeep) void checkHaltedBuildings(destKeep.id);
    }

    res.json({ ok: true, fromWarehouse: updatedSrc, toWarehouse: updatedDst });
  } catch (err: unknown) {
    if (err instanceof Error && 'status' in err) {
      res.status((err as Error & { status: number }).status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
