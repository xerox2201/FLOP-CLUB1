import { io, type Socket } from 'socket.io-client';
import { writable } from 'svelte/store';

const API_URL = '';

let socket: Socket | null = null;

export const realtimeConnected = writable(false);

export function initRealtime(token: string): Socket {
  if (socket) {
    // If already connected, ensure auth is up to date
    (socket.auth as any) = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    realtimeConnected.set(true);
    console.log('[realtime] connected', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    realtimeConnected.set(false);
    console.log('[realtime] disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[realtime] connect_error:', err.message);
  });

  return socket;
}

export function getRealtime(): Socket | null {
  return socket;
}

export function closeRealtime(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    realtimeConnected.set(false);
  }
}

// Regex to match tournament events:
// tournament:123:level, tournament:123:elimination, etc.
export const TOURNAMENT_EVENT_RE =
  /^tournament:(\d+):(level|elimination|balance|final_table|finished|started|paused|resumed|break_start|break_end|late_reg_closed)$/;