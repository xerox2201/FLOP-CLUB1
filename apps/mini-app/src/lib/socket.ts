 import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

export interface TableState {
  seats: any[];
  community: any[];
  phase: string;
  currentSeat: number;
  pot: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  winners: number[] | null;
  handNo: number;
  serverSeedHash: string;
  serverSeed?: string;
  serverTime: number;
  turnStartedAt: number;
  autoActionAt: number;
  turnBaseLimit: number;
  timeBankLimit: number;
  turnBankActive?: boolean;
  variant?: string;
}

export type SocketEvent =
  | { type: 'state'; state: TableState }
  | { type: 'hand_result'; result: any; state: any }
  | { type: 'connected' }
  | { type: 'disconnected'; reason: string }
  | { type: 'player_joined'; userId: number; displayName: string; total: number }
  | { type: 'player_left'; userId: number; total: number }
  | { type: 'error'; message: string };

type Listener = (e: SocketEvent) => void;

export class TableSocketIO {
  private socket: Socket | null = null;
  private listeners: Set<Listener> = new Set();
  private token: string;
  private tableId: number;
  private closedByUser = false;

  constructor(tableId: number, token: string) {
    this.tableId = tableId;
    this.token = token;
  }

  connect(): void {
    this.closedByUser = false;

    this.socket = io(API_URL, {
      auth: {
        token: this.token,
        device: this.getDeviceHash(),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.emit({ type: 'connected' });
      this.socket?.emit('table:join', { tableId: this.tableId }, (res: any) => {
        if (!res?.ok) {
          this.emit({ type: 'error', message: res?.error ?? 'join_failed' });
        }
      });
    });

    this.socket.on('table:state', (state: TableState) => {
      this.emit({ type: 'state', state });
    });

    this.socket.on('table:hand_result', (data: any) => {
      this.emit({
        type: 'hand_result',
        result: data?.result,
        state: data?.state,
      });
    });

    this.socket.on('table:player_joined', (data: any) => {
      this.emit({
        type: 'player_joined',
        userId: data.userId,
        displayName: data.displayName,
        total: data.total,
      });
    });

    this.socket.on('table:player_left', (data: any) => {
      this.emit({
        type: 'player_left',
        userId: data.userId,
        total: data.total,
      });
    });

    this.socket.on('connect_error', (err: any) => {
      this.emit({ type: 'error', message: err.message });
    });

    this.socket.on('disconnect', (reason: string) => {
      if (!this.closedByUser) {
        this.emit({ type: 'disconnected', reason });
      }
    });
  }

  private getDeviceHash(): string {
    let device = localStorage.getItem('device_hash');
    if (!device) {
      device = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_hash', device);
    }
    return device;
  }

  private emit(event: SocketEvent): void {
    for (const l of this.listeners) {
      try { l(event); } catch (e) { console.error(e); }
    }
  }

  action(action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount = 0): void {
    if (!this.socket?.connected) return;
    this.socket.emit('table:action', { action, amount }, (res: any) => {
      if (!res?.ok) {
        this.emit({ type: 'error', message: res?.error ?? 'action_failed' });
      }
    });
  }

  useTimeBank(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('table:time_bank', {}, () => {});
  }

  leaveTable(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('table:leave', {}, () => {});
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.closedByUser = true;
    this.listeners.clear();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}