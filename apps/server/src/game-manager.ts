 import { PokerGame } from '../../../packages/poker-engine/src/game.js';
import type { GameOptions } from '../../../packages/poker-engine/src/game.js';
import type { PlayerInit } from '../../../packages/poker-engine/src/types.js';

export interface PlayerInfo {
  userId: number;
  playerId: string;
  displayName: string;
  socketId: string;
}

export interface TableRoom {
  tableId: number;
  game: PokerGame;
  players: Map<string, PlayerInfo>;
  socketToPlayer: Map<string, string>;
  speed: 'regular' | 'fast' | 'turbo' | 'hyper';
  blinds: { sb: number; bb: number; ante: number };
  variant: 'holdem' | 'omaha4' | 'omaha5';
  rakePct: number;
  busy: boolean;
  handTimer: NodeJS.Timeout | null;
  turnTimer: NodeJS.Timeout | null;
  turnStartedAt: number;
  autoActionAt: number;
  lastActionAt: number;
}

const TIME_LIMITS = {
  regular: { action: 30, bank: 30 },
  fast: { action: 15, bank: 15 },
  turbo: { action: 10, bank: 10 },
  hyper: { action: 8, bank: 8 },
};

class GameManager {
  private rooms: Map<number, TableRoom> = new Map();

  createRoom(params: {
    tableId: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    variant: 'holdem' | 'omaha4' | 'omaha5';
    speed: 'regular' | 'fast' | 'turbo' | 'hyper';
    rakePct: number;
  }): TableRoom {
    if (this.rooms.has(params.tableId)) {
      return this.rooms.get(params.tableId)!;
    }

    const engine = new PokerGame(
      {
        tableId: params.tableId,
        variant: params.variant,
        speed: params.speed,
        smallBlind: params.smallBlind,
        bigBlind: params.bigBlind,
        ante: params.ante,
        rakePct: params.rakePct,
      },
      []
    );

    const room: TableRoom = {
      tableId: params.tableId,
      game: engine,
      players: new Map(),
      socketToPlayer: new Map(),
      speed: params.speed,
      blinds: { sb: params.smallBlind, bb: params.bigBlind, ante: params.ante },
      variant: params.variant,
      rakePct: params.rakePct,
      busy: false,
      handTimer: null,
      turnTimer: null,
      turnStartedAt: 0,
      autoActionAt: 0,
      lastActionAt: 0,
    };

    this.rooms.set(params.tableId, room);
    console.log(`[room] ✅ created table ${params.tableId}`);
    return room;
  }

  getRoom(tableId: number): TableRoom | undefined {
    return this.rooms.get(tableId);
  }

  joinRoom(params: {
    tableId: number;
    userId: number;
    displayName: string;
    socketId: string;
    tableConfig: any;
  }): TableRoom {
    let room = this.rooms.get(params.tableId);
    if (!room) {
      room = this.createRoom({
        tableId: params.tableId,
        smallBlind: Number(params.tableConfig.blinds.sb),
        bigBlind: Number(params.tableConfig.blinds.bb),
        ante: Number(params.tableConfig.blinds.ante ?? 0),
        variant: params.tableConfig.variant,
        speed: params.tableConfig.speed ?? 'regular',
        rakePct: Number(params.tableConfig.rake_pct) || 0.03,
      });
    }

    const playerId = `user_${params.userId}`;
    const info: PlayerInfo = {
      userId: params.userId,
      playerId,
      displayName: params.displayName,
      socketId: params.socketId,
    };

    room.players.set(playerId, info);
    room.socketToPlayer.set(params.socketId, playerId);

    const takenSeats = new Set<number>();
    for (const s of room.game.state.seats) {
      if (s.stack > 0 || !s.folded) takenSeats.add(s.seat);
    }

    let seat = 0;
    for (let i = 0; i < 6; i++) {
      if (!takenSeats.has(i)) { seat = i; break; }
    }

    // Initialize engine players array
    if (room.game.state.seats.length === 0) {
      const players: PlayerInit[] = [{
        userId: params.userId,
        displayName: params.displayName,
        stack: 1000,
      }];
      room.game = new PokerGame(
        {
          tableId: params.tableId,
          variant: room.variant,
          speed: room.speed,
          smallBlind: room.blinds.sb,
          bigBlind: room.blinds.bb,
          ante: room.blinds.ante,
          rakePct: room.rakePct,
        },
        players
      );
    }

    console.log(`[room] ✅ ${params.displayName} joined table ${params.tableId}`);
    return room;
  }

  leaveRoom(socketId: string): { tableId: number; playerId: string } | null {
    for (const [tableId, room] of this.rooms.entries()) {
      const playerId = room.socketToPlayer.get(socketId);
      if (playerId) {
        room.players.delete(playerId);
        room.socketToPlayer.delete(socketId);

        console.log(`[room] ${playerId} left table ${tableId}, size=${room.players.size}`);

        if (room.players.size === 0) {
          if (room.handTimer) clearTimeout(room.handTimer);
          if (room.turnTimer) clearTimeout(room.turnTimer);
          this.rooms.delete(tableId);
          console.log(`[room] 🗑️ table ${tableId} destroyed`);
        }
        return { tableId, playerId };
      }
    }
    return null;
  }

  getPlayerBySocket(socketId: string): { room: TableRoom; player: PlayerInfo } | null {
    for (const room of this.rooms.values()) {
      const playerId = room.socketToPlayer.get(socketId);
      if (playerId) {
        const player = room.players.get(playerId);
        if (player) return { room, player };
      }
    }
    return null;
  }

  async startHand(tableId: number, io: any): Promise<void> {
    const room = this.rooms.get(tableId);
    if (!room || room.busy) return;

    const activePlayers = room.players.size;
    if (activePlayers < 2) {
      console.log(`[hand] table ${tableId}: not enough players (${activePlayers})`);
      return;
    }

    room.busy = true;
    try {
      // Rebuild engine with current players
      const players: PlayerInit[] = [];
      for (const [pid, info] of room.players) {
        const oldSeat = room.game.state.seats.find(s => s.userId === info.userId);
        players.push({
          userId: info.userId,
          displayName: info.displayName,
          stack: oldSeat?.stack ?? 1000,
        });
      }

      room.game = new PokerGame(
        {
          tableId,
          variant: room.variant,
          speed: room.speed,
          smallBlind: room.blinds.sb,
          bigBlind: room.blinds.bb,
          ante: room.blinds.ante,
          rakePct: room.rakePct,
        },
        players
      );

      room.game.startHand([]);
      room.turnStartedAt = Date.now();
      const limits = TIME_LIMITS[room.speed];
      room.autoActionAt = room.turnStartedAt + limits.action * 1000;

      console.log(`[hand] table ${tableId} started, hand #${room.game.state.handNo}`);

      this.broadcastState(tableId, io);
    } finally {
      room.busy = false;
    }
  }

  async act(
    socketId: string,
    actionType: string,
    amount: number,
    io: any
  ): Promise<{ ok: boolean; error?: string }> {
    const ctx = this.getPlayerBySocket(socketId);
    if (!ctx) return { ok: false, error: 'not_in_room' };

    const { room, player } = ctx;

    const seatIdx = room.game.state.seats.findIndex(s => s.userId === player.userId);
    if (seatIdx === -1) return { ok: false, error: 'not_seated' };

    const actType = actionType.toLowerCase() as 'fold' | 'check' | 'call' | 'raise';
    const result = room.game.act(seatIdx, actType, amount);
    if (!result.ok) return result;

    room.lastActionAt = Date.now();
    room.turnStartedAt = Date.now();
    const limits = TIME_LIMITS[room.speed];
    room.autoActionAt = room.turnStartedAt + limits.action * 1000;

    console.log(`[action] ${player.displayName} → ${actionType}${amount ? ' ' + amount : ''}`);

    this.broadcastState(room.tableId, io);

    if (room.game.state.phase === 'showdown') {
      const handResult = room.game.finishHand();
      this.broadcastState(room.tableId, io);

      setTimeout(() => {
        const r = this.rooms.get(room.tableId);
        if (!r) return;
        this.startHand(room.tableId, io).catch((e) => console.error('[hand] error', e));
      }, 5000);
    }

    return { ok: true };
  }

  async useTimeBank(socketId: string, io: any): Promise<{ ok: boolean; error?: string }> {
    const ctx = this.getPlayerBySocket(socketId);
    if (!ctx) return { ok: false, error: 'not_in_room' };

    const { room, player } = ctx;
    const seatIdx = room.game.state.seats.findIndex(s => s.userId === player.userId);
    if (seatIdx === -1) return { ok: false, error: 'not_seated' };

    const result = room.game.useTimeBank(seatIdx);
    if (!result.ok) return result;

    const limits = TIME_LIMITS[room.speed];
    room.autoActionAt = Date.now() + limits.bank * 1000;

    this.broadcastState(room.tableId, io);
    return { ok: true };
  }

  broadcastState(tableId: number, io: any): void {
    const room = this.rooms.get(tableId);
    if (!room) return;

    for (const [playerId, info] of room.players) {
      try {
        const view = room.game.publicView(info.userId);
        io.to(info.socketId).emit('table:state', {
          ...view,
          serverTime: Date.now(),
          turnStartedAt: room.turnStartedAt,
          autoActionAt: room.autoActionAt,
          turnBaseLimit: TIME_LIMITS[room.speed].action,
          timeBankLimit: TIME_LIMITS[room.speed].bank,
        });
      } catch (e: any) {
        console.error(`[broadcast] ${playerId}: ${e.message}`);
      }
    }
  }

  getRooms(): TableRoom[] {
    return [...this.rooms.values()];
  }
}

export const gameManager = new GameManager();