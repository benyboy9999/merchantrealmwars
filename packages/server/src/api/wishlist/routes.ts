import { Router } from 'express';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';

export const wishlistRouter = Router();
wishlistRouter.use(requireAuth);

function empireGuard(empireId: number | null | undefined, res: import('express').Response): empireId is number {
  if (!empireId) { res.status(403).json({ error: 'Create an empire first' }); return false; }
  return true;
}

// GET /api/wishlists
wishlistRouter.get('/', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const wishlists = await db.wishlist.findMany({
      where:   { empireId },
      include: { items: { orderBy: { id: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ wishlists });
  } catch (e) { next(e); }
});

// POST /api/wishlists — { name, items?: [{resourceType, quantity}] }
wishlistRouter.post('/', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const { name, items = [] } = req.body as {
      name: string;
      items?: { resourceType: string; quantity: number }[];
    };
    const wishlist = await db.wishlist.create({
      data: {
        empireId,
        name,
        ...(items.length > 0
          ? { items: { create: items.map(({ resourceType, quantity }) => ({ resourceType, quantity })) } }
          : {}),
      },
      include: { items: true },
    });
    res.json({ wishlist });
  } catch (e) { next(e); }
});

// PATCH /api/wishlists/:id — { name }
wishlistRouter.patch('/:id', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const id = parseInt(req.params['id']!, 10);
    const { name } = req.body as { name: string };
    const result = await db.wishlist.updateMany({ where: { id, empireId }, data: { name } });
    if (result.count === 0) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/wishlists/:id
wishlistRouter.delete('/:id', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const id = parseInt(req.params['id']!, 10);
    await db.wishlist.deleteMany({ where: { id, empireId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PUT /api/wishlists/:id/items — { resourceType, quantity } — upsert one item
wishlistRouter.put('/:id/items', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const id = parseInt(req.params['id']!, 10);
    const { resourceType, quantity } = req.body as { resourceType: string; quantity: number };
    const wishlist = await db.wishlist.findFirst({ where: { id, empireId } });
    if (!wishlist) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    const item = await db.wishlistItem.upsert({
      where:  { wishlistId_resourceType: { wishlistId: id, resourceType } },
      create: { wishlistId: id, resourceType, quantity },
      update: { quantity },
    });
    res.json({ item });
  } catch (e) { next(e); }
});

// DELETE /api/wishlists/:id/items/:resourceType
wishlistRouter.delete('/:id/items/:resourceType', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireGuard(empireId, res)) return;
    const id = parseInt(req.params['id']!, 10);
    const resourceType = req.params['resourceType']!;
    const wishlist = await db.wishlist.findFirst({ where: { id, empireId } });
    if (!wishlist) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    await db.wishlistItem.deleteMany({ where: { wishlistId: id, resourceType } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
