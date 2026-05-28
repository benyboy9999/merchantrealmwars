import { io, Socket } from 'socket.io-client';
import { WsEvent } from '@artemis/shared';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env['VITE_WS_URL'] ?? '', {
      auth: { token: localStorage.getItem('accessToken') },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(token: string): void {
  const s = getSocket();
  s.auth = { token };
  s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export { WsEvent };
