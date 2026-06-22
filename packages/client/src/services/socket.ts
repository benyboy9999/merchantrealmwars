import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.js';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ['websocket'], // skip HTTP polling — go straight to WS
      auth: (cb) => cb({ token: useAuthStore.getState().token ?? '' }),
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
