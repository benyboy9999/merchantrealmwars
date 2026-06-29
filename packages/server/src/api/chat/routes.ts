import { Router } from 'express';
import { z } from 'zod';
import { WsEvent } from '@merchant-realms/shared';
import { db } from '../../db/client.js';
import { requireAuth } from '../../middleware/auth.js';
import { getChatIo } from '../../services/chat-socket.js';

export const chatRouter = Router();
chatRouter.use(requireAuth);

// ── GET /api/chat/rooms ───────────────────────────────────────────────────

chatRouter.get('/rooms', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireId) { res.status(403).json({ error: 'Empire required' }); return; }

    const memberships = await db.chatRoomMember.findMany({
      where: { empireId },
      include: {
        chatRoom: {
          include: {
            members: {
              include: { empire: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    const rooms = memberships.map((m) => {
      const room = m.chatRoom;
      const partner = room.type === 'DM'
        ? (room.members.find((mb) => mb.empireId !== empireId)?.empire ?? null)
        : null;
      return {
        id:      room.id,
        type:    room.type,
        name:    room.name,
        isMuted: m.mutedAt !== null,
        ...(partner ? { partner: { id: partner.id, name: partner.name } } : {}),
      };
    });

    res.json({ rooms });
  } catch (err) { next(err); }
});

// ── GET /api/chat/rooms/:id/messages ─────────────────────────────────────

chatRouter.get('/rooms/:id/messages', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireId) { res.status(403).json({ error: 'Empire required' }); return; }
    const roomId = parseInt(req.params['id']!);
    const limit  = Math.min(parseInt(String(req.query['limit'] ?? '100')), 200);

    const member = await db.chatRoomMember.findUnique({
      where: { chatRoomId_empireId: { chatRoomId: roomId, empireId } },
    });
    if (!member) { res.status(403).json({ error: 'Not a member of this room' }); return; }

    const rows = await db.chatMessage.findMany({
      where:   { chatRoomId: roomId },
      include: { empire: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });

    const messages = rows.map((r) => ({
      id:         r.id,
      roomId:     r.chatRoomId,
      empireId:   r.empireId,
      empireName: r.empire?.name ?? null,
      content:    r.content,
      createdAt:  r.createdAt,
    }));

    res.json({ messages });
  } catch (err) { next(err); }
});

// ── POST /api/chat/dms — find or create DM room ───────────────────────────

chatRouter.post('/dms', async (req, res, next) => {
  try {
    const myEmpireId = req.auth!.empireId;
    if (!myEmpireId) { res.status(403).json({ error: 'Empire required' }); return; }

    const { empireId: targetId } = z.object({ empireId: z.number().int().positive() }).parse(req.body);
    if (targetId === myEmpireId) { res.status(400).json({ error: 'Cannot DM yourself' }); return; }

    const target = await db.empire.findUnique({ where: { id: targetId }, select: { id: true, playerId: true } });
    if (!target) { res.status(404).json({ error: 'Empire not found' }); return; }

    // Find existing DM between the two
    const existing = await db.chatRoom.findFirst({
      where: {
        type:    'DM',
        members: { some: { empireId: myEmpireId } },
        AND:     [{ members: { some: { empireId: targetId } } }],
      },
    });
    if (existing) {
      res.json({ room: { id: existing.id, isNew: false } }); return;
    }

    // Create new DM room
    const room = await db.chatRoom.create({
      data: {
        type: 'DM',
        members: { create: [{ empireId: myEmpireId }, { empireId: targetId }] },
      },
    });

    // Join both participants' sockets to the new room channel
    const myEmpire = await db.empire.findUnique({ where: { id: myEmpireId }, select: { playerId: true } });
    const io = getChatIo();
    if (io && myEmpire) {
      void io.in(`player:${myEmpire.playerId}`).socketsJoin(`chat:${room.id}`);
      void io.in(`player:${target.playerId}`).socketsJoin(`chat:${room.id}`);
      io.to(`player:${myEmpire.playerId}`).emit(WsEvent.CHAT_NEW_DM, { roomId: room.id });
      io.to(`player:${target.playerId}`).emit(WsEvent.CHAT_NEW_DM, { roomId: room.id });
    }

    res.json({ room: { id: room.id, isNew: true } });
  } catch (err) { next(err); }
});

// ── PATCH /api/chat/rooms/:id/mute ────────────────────────────────────────

chatRouter.patch('/rooms/:id/mute', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireId) { res.status(403).json({ error: 'Empire required' }); return; }
    const roomId = parseInt(req.params['id']!);
    const { muted } = z.object({ muted: z.boolean() }).parse(req.body);

    await db.chatRoomMember.update({
      where: { chatRoomId_empireId: { chatRoomId: roomId, empireId } },
      data:  { mutedAt: muted ? new Date() : null },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/chat/search?q= ───────────────────────────────────────────────

chatRouter.get('/search', async (req, res, next) => {
  try {
    const empireId = req.auth!.empireId;
    if (!empireId) { res.status(403).json({ error: 'Empire required' }); return; }
    const q     = String(req.query['q'] ?? '').trim();
    const limit = Math.min(parseInt(String(req.query['limit'] ?? '10')), 20);

    if (q.length < 1) { res.json({ empires: [] }); return; }

    const empires = await db.empire.findMany({
      where:  { name: { contains: q, mode: 'insensitive' }, NOT: { id: empireId } },
      select: { id: true, name: true },
      take:   limit,
    });

    res.json({ empires });
  } catch (err) { next(err); }
});
