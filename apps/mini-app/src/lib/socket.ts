import { io, Socket } from 'socket.io-client';

const API_URL = '';

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
  sequence: number;
  serverSeedHash: string;
  serverSeed?: string;
  serverTime: number;
  turnStartedAt: number;
  autoActionAt: number;
  turnBaseLimit: number;
  timeBankLimit: number;
  turnBankActive?: boolean;
  variant?: string;
  mode?: 'free' | 'real';
  totalRake?: number;
  totalRebuy?: number;
 tournamentId?: number;
  tournamentTableNumber?: number;
  clientSeed?: string;
  revealSeed?: string;
}

export interface ChatMessage {
  id: string;
  userId: number;
  displayName: string;
  avatarId: string;
  text: string;
  isEmoji: boolean;
  timestamp: number;
}

export type SocketEvent =
  | { type: 'state'; state: TableState }
  | { type: 'hand_result'; result: any; state: any }
  | { type: 'connected' }
  | { type: 'disconnected'; reason: string }
  | { type: 'reconnecting'; attempt: number }
  | { type: 'reconnected'; syncType: string }
  | { type: 'player_joined'; userId: number; displayName: string; total: number }
  | { type: 'player_left'; userId: number; total: number }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'error'; message: string; code?: string };

type Listener = (e: SocketEvent) => void;

export class TableSocketIO {
  private socket: Socket | null = null;
  private listeners: Set<Listener> = new Set();
  private token: string;
  private tableId: number;
  private closedByUser = false;

  private lastHandNo: number = 0;
  private lastSequence: number = 0;
  private reconnectAttempt = 0;

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
      const isReconnect = this.reconnectAttempt > 0;
      this.emit({ type: 'connected' });
      this.reconnectAttempt = 0;

      this.socket?.emit(
        'table:join',
        {
          tableId: this.tableId,
          lastHandNo: this.lastHandNo,
          lastSequence: this.lastSequence,
        },
        (res: any) => {
          if (!res?.ok) {
            this.emit({ type: 'error', message: res?.error ?? 'join_failed', code: res?.code });
            return;
          }
          if (isReconnect) {
            this.emit({ type: 'reconnected', syncType: res.syncType || 'full' });
          }
        },
      );
    });

    this.socket.on('table:state', (state: TableState) => {
      if (typeof state.handNo === 'number') this.lastHandNo = state.handNo;
      if (typeof state.sequence === 'number') this.lastSequence = state.sequence;
      this.emit({ type: 'state', state });
    });

    this.socket.on('table:hand_result', (data: any) => {
      if (data?.state?.handNo) this.lastHandNo = data.state.handNo;
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

    this.socket.on('table:chat_message', (msg: ChatMessage) => {
      this.emit({ type: 'chat', message: msg });
    });

    this.socket.on('connect_error', (err: any) => {
      this.emit({ type: 'error', message: err.message });
    });

    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      this.reconnectAttempt = attempt;
      this.emit({ type: 'reconnecting', attempt });
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
      try {
        l(event);
      } catch (e) {
        console.error(e);
      }
    }
  }

  action(action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount = 0): void {
    if (!this.socket?.connected) return;

    const commandId = this.generateCommandId();

    this.socket.emit('table:action', { action, amount, commandId }, (res: any) => {
      if (!res?.ok) {
        this.emit({ type: 'error', message: res?.error ?? 'action_failed', code: res?.code });
      }
    });
  }

  private generateCommandId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  }

  useTimeBank(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('table:time_bank', {}, () => {});
  }

  requestResync(): void {
    if (!this.socket?.connected) return;
    this.socket.emit(
      'table:resync',
      {
        tableId: this.tableId,
        lastHandNo: this.lastHandNo,
        lastSequence: this.lastSequence,
      },
      (res: any) => {
        if (res?.ok) {
          this.emit({ type: 'reconnected', syncType: res.syncType || 'full' });
        }
      },
    );
  }

  leaveTable(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('table:leave', {}, () => {});
  }

  // ============================================================
  // CHAT
  // ============================================================
  sendChat(text: string, isEmoji = false): Promise<{ ok: boolean; code?: string }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ ok: false, code: 'NOT_CONNECTED' });
        return;
      }
      this.socket.emit('table:chat', { text, isEmoji }, (res: any) => {
        resolve(res ?? { ok: false, code: 'NO_ACK' });
      });
    });
  }

  requestChatHistory(): Promise<ChatMessage[]> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve([]);
        return;
      }
      this.socket.emit('table:chat_history', {}, (res: any) => {
        resolve(res?.messages ?? []);
      });
    });
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