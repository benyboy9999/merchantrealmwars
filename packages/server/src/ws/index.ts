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
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
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

    socket.on(WsEvent.CHAT_SEND, async (data: unknown) => {
      try {
        const parsed = SendChatMessageSchema.parse(data);
        const player = await db.player.findUnique({
          where: { id: playerId },
          select: { username: true },
        });
        if (!player) return;

        const message = await db.chatMessage.create({
          data: {
            senderId: playerId,
            channelType: parsed.channelType,
            channelId: parsed.channelId,
            content: parsed.content,
          },
        });

        const payload = {
          id: message.id,
          senderId: playerId,
          senderUsername: player.username,
          channelType: message.channelType,
          channelId: message.channelId,
          content: message.content,
          sentAt: message.sentAt,
        };

        if (parsed.channelType === 'GLOBAL') {
          io.to('global').emit(WsEvent.CHAT_MESSAGE, payload);
        } else if (parsed.channelType === 'GUILD' && parsed.channelId) {
          io.to(`guild:${parsed.channelId}`).emit(WsEvent.CHAT_MESSAGE, payload);
        } else if (parsed.channelType === 'REGION' && parsed.channelId) {
          io.to(`region:${parsed.channelId}`).emit(WsEvent.CHAT_MESSAGE, payload);
        }
      } catch {
        // Swallow invalid messages
      }
    });

    socket.on('disconnect', () => {
      // Future: update player last-seen
    });
  });

  return io;
}
