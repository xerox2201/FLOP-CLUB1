 import { PokerGame } from '../../../packages/poker-engine/src/game.js';
import type { PlayerInit } from '../../../packages/poker-engine/src/types.js';
import { HandPersister } from './hand-persister.js';

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
  mode: 'free' | 'real';
  rakePct: number;
  busy: boolean;
  handTimer: NodeJS.Timeout | null;
  turnTimer: NodeJS.Timeout | null;
  turnStartedAt: number;
  autoActionAt: number;
  lastActionAt: number;
  handCounter: number;
  totalRebuy: number;
  totalRake: number;
  currentHandId: number | null;
  currentSequence: number;
}

const TIME_LIMITS = {
  regular: { action: 30, bank: 30 },
  fast: { action: 15, bank: 15 },
  turbo: { action: 10, bank: 10 },
  hyper: { action: 8, bank: 8 },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

class GameManager {
  private rooms: Map<number, TableRoom> = new Map();
  private persister: HandPersister | null = null;

  private getPersister(): HandPersister {
    if (!this.persister) {
      const pool = (globalThis as any).__dbPool;
      if (!pool) {
        throw new Error('DB pool not initialized');
      }
      this.persister = new HandPersister(pool);
      console.log('[game-manager] HandPersister initialized');
    }
    return this.persister;
  }

  createRoom(params: {
    tableId: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    variant: 'holdem' | 'omaha4' | 'omaha5';
    speed: 'regular' | 'fast' | 'turbo' | 'hyper';
    mode: 'free' | 'real';
    rakePct: number;
  }): TableRoom {
    if (this.rooms.has(params.tableId)) {
      return this.rooms.get(params.tableId)!;
    }

    const effectiveRakePct = params.mode === 'free' ? 0 : params.rakePct;

    const engine = new PokerGame(
      {
        tableId: params.tableId,
        variant: params.variant,
        speed: params.speed,
        smallBlind: params.smallBlind,
        bigBlind: params.bigBlind,
        ante: params.ante,
        rakePct: effectiveRakePct,
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
      mode: params.mode,
      rakePct: effectiveRakePct,
      busy: false,
      handTimer: null,
      turnTimer: null,
      turnStartedAt: 0,
      autoActionAt: 0,
      lastActionAt: 0,
      handCounter: 0,
      totalRebuy: 0,
      totalRake: 0,
      currentHandId: null,
      currentSequence: 0,
    };

    this.rooms.set(params.tableId, room);
    console.log(`[room] created table ${params.tableId} mode=${params.mode}`);
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
      const mode: 'free' | 'real' = params.tableConfig.mode === 'free' ? 'free' : 'real';
      room = this.createRoom({
        tableId: params.tableId,
        smallBlind: Number(params.tableConfig.blinds.sb),
        bigBlind: Number(params.tableConfig.blinds.bb),
        ante: Number(params.tableConfig.blinds.ante ?? 0),
        variant: params.tableConfig.variant,
        speed: params.tableConfig.speed ?? 'regular',
        mode,
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

    console.log(`[room] ${params.displayName} joined table ${params.tableId}, size=${room.players.size}`);
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
          console.log(`[room] table ${tableId} destroyed`);
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
    if (!room) return;
    if (room.busy) return;

    const activePlayers = room.players.size;
    if (activePlayers < 2) {
      console.log(`[hand] table ${tableId}: not enough players (${activePlayers})`);
      return;
    }

    room.busy = true;
    try {
      const players: PlayerInit[] = [];
      let reBuysThisHand = 0;
      const REBUY_THRESHOLD = Number(process.env.REBUY_THRESHOLD ?? 0);
      const REBUY_AMOUNT = Number(process.env.REBUY_AMOUNT ?? 1000);

      for (const [, info] of room.players) {
        const oldSeat = room.game.state.seats.find(s => s.userId === info.userId);
        let stack = oldSeat?.stack ?? 1000;

        if (REBUY_THRESHOLD > 0 && stack < REBUY_THRESHOLD) {
          const injected = round2(REBUY_AMOUNT - stack);
          room.totalRebuy = round2(room.totalRebuy + injected);
          console.log(`[rebuy] ${info.displayName}: $${stack.toFixed(2)} → $${REBUY_AMOUNT.toFixed(2)} (+$${injected.toFixed(2)})`);
          stack = REBUY_AMOUNT;
          reBuysThisHand++;
        }

        players.push({
          userId: info.userId,
          displayName: info.displayName,
          stack,
        });
      }

      const prevHandCounter = room.handCounter ?? 0;
      const prevDealerSeat = room.game.state.dealerSeat;

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

      if (prevDealerSeat >= 0) {
        room.game.state.dealerSeat = prevDealerSeat;
      }

      room.game.startHand([]);

      room.handCounter = prevHandCounter + 1;
      room.game.state.handNo = room.handCounter;

      room.turnStartedAt = Date.now();
      const limits = TIME_LIMITS[room.speed];
      room.autoActionAt = room.turnStartedAt + limits.action * 1000;

      const handPlayers = room.game.state.seats
        .filter((s: any) => !s.folded || s.stack > 0)
        .map((s: any) => ({
          userId: s.userId,
          displayName: s.displayName,
          stack: s.stack,
          seat: s.seat,
        }));

      try {
        const persister = this.getPersister();
        const handId = await persister.startHand({
          tableId,
          handNo: room.handCounter,
          variant: room.variant,
          mode: room.mode,
          smallBlind: room.blinds.sb,
          bigBlind: room.blinds.bb,
          ante: room.blinds.ante,
          dealerSeat: room.game.state.dealerSeat,
          players: handPlayers,
        });
        room.currentHandId = handId;
        room.currentSequence = 0;
      } catch (e: any) {
        console.error('[game-manager] persister.startHand error:', e.message);
        room.currentHandId = null;
        room.currentSequence = 0;
      }

      this.broadcastState(tableId, io);
    } catch (e: any) {
      console.error(`[hand] ERROR in startHand:`, e);
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

    if (room.currentHandId) {
      room.currentSequence++;
      try {
        this.getPersister().recordEvent(room.currentHandId, room.currentSequence, 'ACTION_TAKEN', {
          seat: seatIdx,
          userId: player.userId,
          action: actType,
          amount,
          pot: room.game.state.pot,
          phase: room.game.state.phase,
        });

        if (room.currentSequence % 10 === 0) {
          this.getPersister().saveSnapshot(
            room.currentHandId,
            room.currentSequence,
            room.game.publicView(player.userId)
          );
        }
      } catch (e: any) {
        console.error('[game-manager] event persist error:', e.message);
      }
    }

    if (room.game.state.phase === 'showdown') {
      try {
        const handResult = room.game.finishHand();

        if (room.mode === 'real') {
          room.totalRake = round2(room.totalRake + handResult.rake);
        }

        room.game.state.handNo = room.handCounter;

        const playerStacks = room.game.state.seats.map((s: any) => ({
          seat: s.seat,
          userId: s.userId,
          stack: s.stack,
        }));

        const totalPot = handResult.rake + handResult.payouts.reduce((sum: number, p: any) => sum + p.amount, 0);

        if (room.currentHandId) {
          try {
            await this.getPersister().finishHand(
              room.tableId,
              room.currentHandId,
              {
                handId: room.currentHandId,
                pot: totalPot,
                rake: handResult.rake,
                winners: handResult.winners,
                communityCards: room.game.state.community,
                showdownPlayers: handResult.showdownPlayers,
                playerStacks,
              },
              room.mode
            );
          } catch (e: any) {
            console.error('[game-manager] persister.finishHand error:', e.message);
          }
        }

        for (const [, info] of room.players) {
          try {
            io.to(info.socketId).emit('table:hand_result', {
              result: {
                winners: handResult.winners,
                payouts: handResult.payouts,
                rake: handResult.rake,
                revealSeed: handResult.revealSeed,
                showdown: handResult.showdown,
                showdownPlayers: handResult.showdownPlayers,
                totalRake: room.totalRake,
                totalRebuy: room.totalRebuy,
              },
              state: room.game.publicView(info.userId),
            });
          } catch (e: any) {
            console.error(`[hand_result] ${info.playerId}: ${e.message}`);
          }
        }

        this.broadcastState(room.tableId, io);
      } catch (e: any) {
        console.error('[finishHand] ERROR:', e);
      }

      const handInterval = Number(process.env.HANDS_INTERVAL_MS ?? 5000);
      setTimeout(() => {
        const r = this.rooms.get(room.tableId);
        if (!r) return;
        this.startHand(room.tableId, io).catch((e) => console.error('[hand] error', e));
      }, handInterval);
    } else {
      this.broadcastState(room.tableId, io);
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

    for (const [, info] of room.players) {
      try {
        const view = room.game.publicView(info.userId);
        io.to(info.socketId).emit('table:state', {
          ...view,
          handNo: room.handCounter,
          pot: round2(view.pot ?? 0),
          minRaise: round2(view.minRaise ?? 0),
          smallBlind: round2(view.smallBlind ?? 0),
          bigBlind: round2(view.bigBlind ?? 0),
          seats: view.seats.map((s: any) => ({
            ...s,
            stack: round2(s.stack ?? 0),
            betThisStreet: round2(s.betThisStreet ?? 0),
            totalBet: round2(s.totalBet ?? 0),
          })),
          serverTime: Date.now(),
          turnStartedAt: room.turnStartedAt,
          autoActionAt: room.autoActionAt,
          turnBaseLimit: TIME_LIMITS[room.speed].action,
          timeBankLimit: TIME_LIMITS[room.speed].bank,
          totalRake: room.totalRake,
          totalRebuy: room.totalRebuy,
          mode: room.mode,
        });
      } catch (e: any) {
        console.error(`[broadcast] ${info.playerId}: ${e.message}`);
      }
    }
  }

  getRooms(): TableRoom[] {
    return [...this.rooms.values()];
  }
}

export const gameManager = new GameManager();