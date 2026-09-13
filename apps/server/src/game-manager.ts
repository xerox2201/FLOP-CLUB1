 import { PokerEngine, ActionType } from '@pokertools/engine';
import { Pool } from 'pg';

export const SCALE = 100;

export interface PlayerInfo {
  userId: number;
  playerId: string;
  displayName: string;
  socketId: string;
}

export interface TableRoom {
  tableId: number;
  engine: PokerEngine;
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
  handEnded: boolean;
}

const TIME_LIMITS = {
  regular: { action: 30, bank: 30 },
  fast: { action: 15, bank: 15 },
  turbo: { action: 10, bank: 10 },
  hyper: { action: 8, bank: 8 },
};

function scaleDownState(state: any): any {
  const currentBetsObj: Record<number, number> = {};
  if (state.currentBets) {
    const entries = state.currentBets instanceof Map
      ? Array.from(state.currentBets.entries())
      : Object.entries(state.currentBets);
    for (const [k, v] of entries) {
      currentBetsObj[Number(k)] = (Number(v) || 0) / SCALE;
    }
  }

  const players = (state.players || []).map((p: any) => {
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      seat: p.seat,
      stack: (p.stack ?? 0) / SCALE,
      hand: p.hand || null,
      shownCards: p.shownCards || null,
      status: p.status,
      betThisStreet: (p.betThisStreet ?? 0) / SCALE,
      totalInvestedThisHand: (p.totalInvestedThisHand ?? 0) / SCALE,
      isSittingOut: p.isSittingOut ?? false,
      timeBank: p.timeBank ?? 30,
    };
  });

  const pots = (state.pots || []).map((p: any) => ({
    amount: (p.amount ?? 0) / SCALE,
    eligibleSeats: p.eligibleSeats || [],
  }));

  return {
    players,
    board: state.board || [],
    street: state.street,
    pots,
    currentBets: currentBetsObj,
    minRaise: (state.minRaise ?? 0) / SCALE,
    lastRaiseAmount: (state.lastRaiseAmount ?? 0) / SCALE,
    actionTo: state.actionTo,
    lastAggressorSeat: state.lastAggressorSeat ?? null,
    activePlayers: state.activePlayers || [],
    winners: state.winners ?? null,
    rakeThisHand: (state.rakeThisHand ?? 0) / SCALE,
    handNumber: state.handNumber ?? 0,
    buttonSeat: state.buttonSeat ?? null,
    smallBlind: (state.smallBlind ?? 0) / SCALE,
    bigBlind: (state.bigBlind ?? 0) / SCALE,
    ante: (state.ante ?? 0) / SCALE,
    blindLevel: state.blindLevel ?? 0,
    timeBankActiveSeat: state.timeBankActiveSeat ?? null,
    handId: state.handId,
    timestamp: state.timestamp,
    variant: null,
  };
}

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

    const sbScaled = Math.max(1, Math.round(params.smallBlind * SCALE));
    const bbScaled = Math.max(2, Math.round(params.bigBlind * SCALE));

    const engine = new PokerEngine({
      smallBlind: sbScaled,
      bigBlind: bbScaled,
      maxPlayers: 6,
    });

    const room: TableRoom = {
      tableId: params.tableId,
      engine,
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
      handEnded: false,
    };

    this.rooms.set(params.tableId, room);
    console.log(`[room] ✅ created table ${params.tableId} (sb=${sbScaled}, bb=${bbScaled})`);
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
    for (const p of room.engine.state.players) {
      if (p && p.seat !== undefined && p.seat !== null) {
        takenSeats.add(p.seat);
      }
    }

    let seat = 0;
    for (let i = 0; i < 6; i++) {
      if (!takenSeats.has(i)) { seat = i; break; }
    }

    const startingStack = Math.round(1000 * SCALE);

    try {
      room.engine.sit(seat, playerId, params.displayName, startingStack);
      console.log(`[room] ✅ ${params.displayName} joined table ${params.tableId} at seat ${seat}`);
    } catch (e: any) {
      console.log(`[room] ⚠️ sit error: ${e.message}`);
    }

    return room;
  }

  leaveRoom(socketId: string): { tableId: number; playerId: string } | null {
    for (const [tableId, room] of this.rooms.entries()) {
      const playerId = room.socketToPlayer.get(socketId);
      if (playerId) {
        room.players.delete(playerId);
        room.socketToPlayer.delete(socketId);
        try { room.engine.stand(playerId); } catch (e) {}

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

  async startHand(tableId: number, db: Pool, io: any): Promise<void> {
    const room = this.rooms.get(tableId);
    if (!room || room.busy) return;

    const activePlayers = room.engine.state.players.filter(
      (p: any) => p && p.status !== 'SITTING_OUT' && p.stack > 0
    );

    if (activePlayers.length < 2) {
      console.log(`[hand] table ${tableId}: not enough players (${activePlayers.length})`);
      return;
    }

    room.busy = true;
    try {
      room.handEnded = false;
      room.engine.deal();
      room.turnStartedAt = Date.now();
      const limits = TIME_LIMITS[room.speed];
      room.autoActionAt = room.turnStartedAt + limits.action * 1000;

      console.log(`[hand] table ${tableId} started, hand #${room.engine.state.handNumber}`);

      this.broadcastState(tableId, io);
      this.scheduleTurnTimer(tableId, db, io);
    } finally {
      room.busy = false;
    }
  }

  async act(
    socketId: string,
    actionType: string,
    amount: number,
    db: Pool,
    io: any
  ): Promise<{ ok: boolean; error?: string }> {
    const ctx = this.getPlayerBySocket(socketId);
    if (!ctx) return { ok: false, error: 'not_in_room' };

    const { room, player } = ctx;

    const currentSeat = room.engine.state.actionTo;
    const mySeat = room.engine.state.players.find(
      (p: any) => p && p.id === player.playerId
    )?.seat;

    if (mySeat !== currentSeat) {
      return { ok: false, error: 'not_your_turn' };
    }

    try {
      const actionData: any = { type: actionType, playerId: player.playerId };
      if (amount > 0) {
        actionData.amount = Math.round(amount * SCALE);
      }

      room.engine.act(actionData);
      room.lastActionAt = Date.now();

      console.log(`[action] ${player.displayName} → ${actionType}${amount ? ' $' + amount : ''}`);

      this.broadcastState(room.tableId, io);

      const street = room.engine.state.street;
      const winners = room.engine.state.winners;

      if (street === 'SHOWDOWN' || (winners && winners.length > 0)) {
        await this.finishHand(room.tableId, db, io);
      } else {
        room.turnStartedAt = Date.now();
        const limits = TIME_LIMITS[room.speed];
        room.autoActionAt = room.turnStartedAt + limits.action * 1000;
        this.scheduleTurnTimer(room.tableId, db, io);
      }

      return { ok: true };
    } catch (e: any) {
      console.log(`[action] error: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  async useTimeBank(socketId: string, db: Pool, io: any): Promise<{ ok: boolean; error?: string }> {
    const ctx = this.getPlayerBySocket(socketId);
    if (!ctx) return { ok: false, error: 'not_in_room' };

    const { room, player } = ctx;

    try {
      room.engine.act({ type: ActionType.TIME_BANK, playerId: player.playerId });
      const limits = TIME_LIMITS[room.speed];
      room.autoActionAt = Date.now() + limits.bank * 1000;

      this.broadcastState(room.tableId, io);
      this.scheduleTurnTimer(room.tableId, db, io);

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async finishHand(tableId: number, db: Pool, io: any): Promise<void> {
    const room = this.rooms.get(tableId);
    if (!room) return;

    if (room.handEnded) return;
    room.handEnded = true;

    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    console.log(`[hand] table ${tableId} finished`);

    this.broadcastState(tableId, io);

    try {
      const state = room.engine.state;
      const winners = state.winners ?? [];
      const rake = (state.rakeThisHand ?? 0) / SCALE;
      const pot = state.pots.reduce((s: number, p: any) => s + (p.amount ?? 0), 0) / SCALE;

      await db.query(
        `INSERT INTO hands (table_id, hand_no, pot, rake, result, ended_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [tableId, state.handNumber, pot, rake, JSON.stringify({ winners })]
      );

      if (rake > 0) {
        const today = new Date().toISOString().slice(0, 10);
        await db.query(
          `INSERT INTO revenue_daily (date, rake_total)
           VALUES ($1, $2)
           ON CONFLICT (date) DO UPDATE SET rake_total = revenue_daily.rake_total + $2`,
          [today, rake]
        );
      }
    } catch (e) {
      console.error('[hand] DB error', e);
    }

    room.handTimer = setTimeout(() => {
      this.startHand(tableId, db, io).catch((e) => console.error('[hand] error', e));
    }, 5000);
  }

  scheduleTurnTimer(tableId: number, db: Pool, io: any): void {
    const room = this.rooms.get(tableId);
    if (!room || room.handEnded) return;

    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    const delay = room.autoActionAt - Date.now();
    if (delay <= 0) return;

    room.turnTimer = setTimeout(async () => {
      const r = this.rooms.get(tableId);
      if (!r || r.handEnded) return;

      const currentSeat = r.engine.state.actionTo;
      if (currentSeat === null || currentSeat === undefined) return;

      const currentPlayer = r.engine.state.players.find(
        (p: any) => p && p.seat === currentSeat
      );
      if (!currentPlayer) return;

      const currentBet = r.engine.state.currentBets.get(currentSeat) ?? 0;
      const bets = Array.from(r.engine.state.currentBets.values()) as number[];
      const maxBet = Math.max(0, ...bets);
      const toCall = maxBet - currentBet;

      try {
        if (toCall <= 0) {
          r.engine.act({ type: ActionType.CHECK, playerId: currentPlayer.id });
          console.log(`[timer] ⏱️ auto-CHECK for ${currentPlayer.id}`);
        } else {
          r.engine.act({ type: ActionType.FOLD, playerId: currentPlayer.id });
          console.log(`[timer] ⏱️ auto-FOLD for ${currentPlayer.id}`);
        }

        this.broadcastState(tableId, io);

        if (r.engine.state.street === 'SHOWDOWN' || (r.engine.state.winners && r.engine.state.winners.length > 0)) {
          await this.finishHand(tableId, db, io);
        } else {
          r.turnStartedAt = Date.now();
          const lims = TIME_LIMITS[r.speed];
          r.autoActionAt = r.turnStartedAt + lims.action * 1000;
          this.scheduleTurnTimer(tableId, db, io);
        }
      } catch (e: any) {
        console.error('[timer] error', e.message);
      }
    }, delay);
  }

  broadcastState(tableId: number, io: any): void {
    const room = this.rooms.get(tableId);
    if (!room) return;

    for (const [playerId, info] of room.players) {
      try {
        const view = room.engine.view(playerId);
        const scaled = scaleDownState(view);
        scaled.variant = room.variant;

        io.to(info.socketId).emit('table:state', {
          ...scaled,
          scaleFactor: SCALE,
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