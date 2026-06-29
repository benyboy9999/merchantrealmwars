import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { WsEvent, SendChatMessageSchema } from '@merchant-realms/shared';
import { config } from '../config/index.js';
import { db } from '../db/client.js';

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: process.env['VITE_API_URL'] ?? '*', credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined;
    if (!token) { next(new Error('Authentication required')); return; }
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as { playerId: number };
      socket.data = { playerId: payload.playerId };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { playerId } = socket.data as { playerId: number };
    void socket.join(`player:${playerId}`);
    void socket.join('global');

    // Join the player's empire's chat rooms
    void (async () => {
      try {
        const empire = await db.empire.findUnique({
          where:   { playerId },
          select:  { id: true, chatRoomMembers: { select: { chatRoomId: true } } },
        });
        if (empire) {
          socket.data.empireId = empire.id;
          for (const m of empire.chatRoomMembers) {
            void socket.join(`chat:${m.chatRoomId}`);
          }
        }
      } catch { /* ignore — socket still functions */ }
    })();

    socket.on(WsEvent.CHAT_SEND, async (data: unknown) => {
      try {
        const parsed = SendChatMessageSchema.parse(data);
        // empireId is set in the async init; fall back to a DB lookup if still missing
        let empireId = socket.data.empireId as number | undefined;
        if (!empireId) {
          const emp = await db.empire.findUnique({ where: { playerId }, select: { id: true } });
          if (!emp) return;
          empireId = emp.id;
          socket.data.empireId = empireId;
        }

        // Verify membership
        const member = await db.chatRoomMember.findUnique({
          where: { chatRoomId_empireId: { chatRoomId: parsed.roomId, empireId } },
        });
        if (!member) return;

        const empire = await db.empire.findUnique({ where: { id: empireId }, select: { name: true } });

        const message = await db.chatMessage.create({
          data: { chatRoomId: parsed.roomId, empireId, content: parsed.content },
        });

        io.to(`chat:${parsed.roomId}`).emit(WsEvent.CHAT_MESSAGE, {
          id:         message.id,
          roomId:     message.chatRoomId,
          empireId,
          empireName: empire?.name ?? null,
          content:    message.content,
          createdAt:  message.createdAt,
        });
      } catch { /* swallow invalid messages */ }
    });

    socket.on('disconnect', () => { /* future: update last-seen */ });
  });

  return io;
}
