import type { Server } from 'socket.io';

let io: Server | null = null;

export function initChatSocket(server: Server): void {
  io = server;
}

export function getChatIo(): Server | null {
  return io;
}
