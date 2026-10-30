import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getAdminSocket(): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  const token = localStorage.getItem('admin_token') || '';
  const serverUrl = import.meta.env.VITE_WS_URL || window.location.origin;

  socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('⚡ Admin WebSocket conectado');
  });

  socket.on('disconnect', () => {
    console.log('⚠️ Admin WebSocket desconectado');
  });

  return socket;
}

export function disconnectAdminSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
