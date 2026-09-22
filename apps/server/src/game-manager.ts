import { PokerGame } from '../../../packages/poker-engine/src/game.js';
import type { PlayerInit } from '../../../packages/poker-engine/src/types.js';
import { HandPersister } from './hand-persister.js';
import { ErrorCode, type CommandResult } from './errors.js';
import { getAchievementsService } from './achievement-service.js';
import { LoyaltyService } from './loyalty/service.js';

export interface PlayerInfo {
  userId: number;
  playerId: string;
  displayName: string;
  socketId: string;
  tournamentStack?: number;
  autoMuck?: boolean;
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
  tournamentId?: number;
  tournamentTableNumber?: number;
  turnBankUsed: boolean;
  timerGen: number;
  lastScheduledSeat: number;
  scheduledAt: number;
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

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

class GameManager {
  private rooms: Map<number, TableRoom> = new Map();
  private persister: HandPersister | null = null;
  private tournamentHandEndCallback:
    ((tournamentId: number, room: TableRoom, handResult?: any) => void | Promise<void>) | null =
    null;

  private getPersister(): HandPersister {
    if (!this.persister) {
      const pool = (globalThis as any).__dbPool;
      if (!pool) throw new Error('DB pool not initialized');
      this.persister = new HandPersister(pool);
      console.log('[game-manager] HandPersister initialized');
    }
    return this.persister;
  }

  setTournamentHandEndCallback(
    cb: (tournamentId: number, room: TableRoom, handResult?: any) => void | Promise<void>,
  ): void {
    this.tournamentHandEndCallback = cb;
    console.log('[game-manager] tournament callback registered');
  }

  static getVirtualTableId(tournamentId: number, tableNumber: number): number {
    return 1_000_000 + tournamentId * 1000 + tableNumber;
  }

  // ============================================================
  // TIMER
  // ============================================================
  private clearAutoActionTimer(room: TableRoom): void {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
  }

  private getEffectiveLimitSec(room: TableRoom, seat: any): number {
    const playerId = `user_${seat.userId}`;
    const p = room.players.get(playerId);
    if (!p || !p.socketId) return 3;
    const limits = TIME_LIMITS[room.speed];
    return limits.action + (room.turnBankUsed ? limits.bank : 0);
  }

  /**
   * 🔴 Idempotent: if a timer is already running for the SAME seat,
   * DO NOT clear and reschedule (which would reset the clock forever).
   */
  private scheduleAutoAction(room: TableRoom, io: any, reason: string): void {
    if (room.game.state.phase === 'showdown' || room.game.state.phase === 'waiting') {
      return;
    }

    const currentSeat = room.game.state.currentSeat;
    if (currentSeat < 0) return;

    const seat = room.game.state.seats[currentSeat];
    if (!seat || seat.folded || seat.allIn) return;

    // 🔴 If already scheduled for this exact seat, keep the existing timer
    if (room.turnTimer && room.lastScheduledSeat === currentSeat) {
      console.log(
        `[timer] ${ts()} ↺ skip reschedule (seat ${currentSeat} already armed, reason=${reason})`,
      );
      return;
    }

    this.clearAutoActionTimer(room);

    const totalMs = this.getEffectiveLimitSec(room, seat) * 1000;
    const elapsed = Date.now() - room.turnStartedAt;
    const remaining = Math.max(500, totalMs - elapsed);

    room.timerGen += 1;
    const myGen = room.timerGen;
    room.lastScheduledSeat = currentSeat;
    room.scheduledAt = Date.now();

    console.log(
      `[timer] ${ts()} 🕐 gen=${myGen} seat ${currentSeat} (${seat.displayName}): ${Math.round(remaining / 1000)}s reason=${reason}`,
    );

    room.turnTimer = setTimeout(() => {
      const r = this.rooms.get(room.tableId);
      if (!r) return;
      if (r.timerGen !== myGen) {
        console.log(`[timer] ${ts()} ⚠️ stale fired gen=${myGen} (cur=${r.timerGen})`);
        return;
      }
      console.log(`[timer] ${ts()} 🔥 fired gen=${myGen} seat=${r.game.state.currentSeat}`);
      this.autoAction(room.tableId, io).catch((e) =>
        console.error('[timer] auto-action error:', e.message),
      );
    }, remaining);
  }

  private async autoAction(tableId: number, io: any): Promise<void> {
    const room = this.rooms.get(tableId);
    if (!room) return;

    if (room.busy) {
      console.log(`[timer] ${ts()} ⏸️ busy, skip auto-action`);
      return;
    }

    if (room.game.state.phase === 'showdown' || room.game.state.phase === 'waiting') {
      return;
    }

    const currentSeat = room.game.state.currentSeat;
    if (currentSeat < 0) return;

    const seat = room.game.state.seats[currentSeat];
    if (!seat || seat.folded || seat.allIn) return;

    const maxBet = Math.max(...room.game.state.seats.map((s: any) => s.betThisStreet));
    const toCall = maxBet - seat.betThisStreet;
    const action: 'fold' | 'check' = toCall > 0 ? 'fold' : 'check';

    console.log(
      `[timer] ${ts()} ⏰ auto-${action} for seat ${currentSeat} (${seat.displayName}) toCall=${toCall}`,
    );

    room.busy = true;
    try {
      const result = room.game.act(currentSeat, action, 0);
      if (!result.ok) {
        console.warn(`[timer] ${ts()} ❌ auto-action rejected: ${result.error}`);
        room.busy = false;
        return;
      }
      await this.afterAction(room, io, currentSeat, action, 0, 'auto');
    } catch (e: any) {
      console.error('[timer] auto-action failed:', e.message);
      room.busy = false;
    }
  }

  // ============================================================
  // After any action
  // ============================================================
  private async afterAction(
    room: TableRoom,
    io: any,
    actorSeat: number,
    action: string,
    amount: number,
    source: 'user' | 'auto',
  ): Promise<void> {
    try {
      this.clearAutoActionTimer(room);
      room.lastScheduledSeat = -1; // reset so next schedule always logs

      room.lastActionAt = Date.now();
      room.turnStartedAt = Date.now();
      room.turnBankUsed = false;
      room.game.state.turnBankActive = false;

      const limits = TIME_LIMITS[room.speed];
      room.autoActionAt = room.turnStartedAt + limits.action * 1000;

      // Persist (skip tournaments)
      if (room.currentHandId && !room.tournamentId) {
        room.currentSequence++;
        try {
          this.getPersister().recordEvent(
            room.currentHandId,
            room.currentSequence,
            'ACTION_TAKEN',
            {
              seat: actorSeat,
              userId: room.game.state.seats[actorSeat]?.userId,
              action,
              amount,
              pot: room.game.state.pot,
              phase: room.game.state.phase,
            },
          );
        } catch (e: any) {
          console.error('[game-manager] event persist error:', e.message);
        }
      }

      // Showdown?
      if (room.game.state.phase === 'showdown') {
        await this.handleShowdown(room, io);
        return;
      }

      // Broadcast + schedule next
      this.broadcastState(room.tableId, io);
      this.scheduleAutoAction(room, io, `after-${source}-seat-${actorSeat}`);
    } finally {
      room.busy = false;
    }
  }

  private async handleShowdown(room: TableRoom, io: any): Promise<void> {
    try {
      const handResult = room.game.finishHand();

      if (room.mode === 'real' && !room.tournamentId) {
        room.totalRake = round2(room.totalRake + handResult.rake);
      }
      // ============ AUTO-MUCK ============
      // If a losing player has auto-muck enabled, hide their hole cards
      // from opponents (and from showdownPlayers list).
      if (handResult.showdownPlayers && handResult.showdownPlayers.length > 0) {
        for (const sp of handResult.showdownPlayers) {
          if (sp.isWinner) continue;
          const seatData = room.game.state.seats.find((s: any) => s.seat === sp.seat);
          if (!seatData) continue;
          const playerInfo = room.players.get(`user_${seatData.userId}`);
          if (playerInfo?.autoMuck) {
            sp.hole = [];
            seatData.revealed = false;
          }
        }
      }
      // ============ END AUTO-MUCK ============
      room.game.state.handNo = room.handCounter;
      // ============ ACHIEVEMENTS TRACKING ============
      try {
        const ach = getAchievementsService();
        if (ach) {
          // Hands played (for every player at the table)
          for (const s of room.game.state.seats) {
            if (s.userId) {
              await ach.track(s.userId, 'hand_100', 1, 'increment');
              await ach.track(s.userId, 'hand_1000', 1, 'increment');
            }
          }

          // Winners
          for (const winnerSeat of handResult.winners || []) {
            const seatInfo = room.game.state.seats.find((s: any) => s.seat === winnerSeat);
            if (!seatInfo?.userId) continue;

            await ach.track(seatInfo.userId, 'first_win', 1);

            const payout = (handResult.payouts || []).find((p: any) => p.seat === winnerSeat);
            if (payout?.amount) {
              await ach.track(seatInfo.userId, 'big_pot', Number(payout.amount));
            }
          }
        }
      } catch (e: any) {
        console.error('[achievements] hand track failed:', e.message);
      }
      // ============ END ACHIEVEMENTS ============
      // ============ LOYALTY: rakeback + XP ============
      try {
        if (room.mode === 'real' && !room.tournamentId && handResult.rake > 0) {
          const loyalty = new LoyaltyService((globalThis as any).__dbPool);
          const contributions = room.game.state.seats
            .filter((s: any) => s.userId && !s.folded)
            .map((s: any) => ({
              userId: Number(s.userId),
              contribution: Number(s.totalBet ?? 0),
            }));

          const totalPotForShare = room.game.state.seats.reduce(
            (sum: number, s: any) => sum + Number(s.totalBet ?? 0),
            0,
          );

          if (totalPotForShare > 0) {
            await loyalty.payHand({
              handId: room.currentHandId ?? 0,
              pot: totalPotForShare,
              totalRake: Number(handResult.rake),
              contributions,
            });
          }
        }
      } catch (e: any) {
        console.error('[loyalty] payHand error:', e.message);
      }
      // ============ END LOYALTY ============
      const playerStacks = room.game.state.seats.map((s: any) => ({
        seat: s.seat,
        userId: s.userId,
        stack: s.stack,
      }));

      const totalPot =
        handResult.rake + handResult.payouts.reduce((sum: number, p: any) => sum + p.amount, 0);

      if (room.currentHandId && !room.tournamentId) {
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
              sidePots: handResult.sidePots || [],
              playerStacks,
            },
            room.mode,
          );
        } catch (e: any) {
          console.error('[game-manager] persister.finishHand error:', e.message);
        }
      }

      for (const [, info] of room.players) {
        try {
          if (!info.socketId) continue;
          io.to(info.socketId).emit('table:hand_result', {
            result: {
              winners: handResult.winners,
              payouts: handResult.payouts,
              rake: handResult.rake,
              revealSeed: handResult.revealSeed,
              showdown: handResult.showdown,
              showdownPlayers: handResult.showdownPlayers,
              sidePots: handResult.sidePots,
              totalRake: room.totalRake,
              totalRebuy: room.totalRebuy,
            },
            state: room.game.publicView(info.userId),
          });
        } catch (e: any) {
          console.error(`[hand_result] ${info.playerId}: ${e.message}`);
        }
      }

      if (room.tournamentId && this.tournamentHandEndCallback) {
        try {
          await this.tournamentHandEndCallback(room.tournamentId, room, handResult);
        } catch (e: any) {
          console.error('[game-manager] tournament callback error:', e.message);
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
  }

  // ============================================================
  // Room creation
  // ============================================================
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
      [],
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
      turnBankUsed: false,
      timerGen: 0,
      lastScheduledSeat: -1,
      scheduledAt: 0,
    };

    this.rooms.set(params.tableId, room);
    console.log(`[room] created table ${params.tableId} mode=${params.mode}`);
    return room;
  }

  createTournamentRoom(params: {
    tournamentId: number;
    tableNumber: number;
    variant: 'holdem' | 'omaha4' | 'omaha5';
    speed: 'regular' | 'fast' | 'turbo' | 'hyper';
    blinds: { sb: number; bb: number; ante: number };
    players: Array<{ userId: number; displayName: string; stack: number; socketId?: string }>;
  }): TableRoom {
    const virtualTableId = GameManager.getVirtualTableId(params.tournamentId, params.tableNumber);

    if (this.rooms.has(virtualTableId)) {
      return this.rooms.get(virtualTableId)!;
    }

    const room = this.createRoom({
      tableId: virtualTableId,
      smallBlind: params.blinds.sb,
      bigBlind: params.blinds.bb,
      ante: params.blinds.ante,
      variant: params.variant,
      speed: params.speed,
      mode: 'real',
      rakePct: 0,
    });

    room.tournamentId = params.tournamentId;
    room.tournamentTableNumber = params.tableNumber;

    for (const p of params.players) {
      const playerId = `user_${p.userId}`;
      room.players.set(playerId, {
        userId: p.userId,
        playerId,
        displayName: p.displayName,
        socketId: p.socketId || '',
        tournamentStack: p.stack,
      });
    }

    console.log(
      `[room] 🏆 tournament room created: T#${params.tournamentId} table ${params.tableNumber} → virtual ${virtualTableId} (${params.players.length} players)`,
    );
    return room;
  }

  updateRoomBlinds(tournamentId: number, sb: number, bb: number, ante: number): void {
    let count = 0;
    for (const room of this.rooms.values()) {
      if (room.tournamentId === tournamentId) {
        room.blinds = { sb, bb, ante };
        room.game.state.smallBlind = sb;
        room.game.state.bigBlind = bb;
        room.game.state.ante = ante;
        count++;
      }
    }
    if (count > 0) {
      console.log(
        `[room] 🎯 updated blinds T#${tournamentId} (${count} tables): ${sb}/${bb}${ante ? '+' + ante : ''}`,
      );
    }
  }

  getRoom(tableId: number | string): TableRoom | undefined {
    return this.rooms.get(Number(tableId));
  }

  joinRoom(params: {
    tableId: number;
    userId: number;
    displayName: string;
    socketId: string;
    tableConfig: any;
    autoMuck?: boolean;
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
    const existing = room.players.get(playerId);

    const info: PlayerInfo = {
      userId: params.userId,
      playerId,
      displayName: params.displayName,
      socketId: params.socketId,
      tournamentStack: existing?.tournamentStack,
      autoMuck: params.autoMuck ?? existing?.autoMuck ?? true,
    };

    room.players.set(playerId, info);
    room.socketToPlayer.set(params.socketId, playerId);

    console.log(
      `[room] ${params.displayName} joined table ${params.tableId}, size=${room.players.size}${info.tournamentStack ? ' (stack: ' + info.tournamentStack + ')' : ''}`,
    );
    return room;
  }

  leaveRoom(socketId: string): { tableId: number; playerId: string } | null {
    for (const [tableId, room] of this.rooms.entries()) {
      const playerId = room.socketToPlayer.get(socketId);
      if (playerId) {
        room.socketToPlayer.delete(socketId);

        if (room.tournamentId) {
          const p = room.players.get(playerId);
          if (p) p.socketId = '';
          console.log(`[room] ${playerId} disconnected from tournament ${tableId} (kept)`);
        } else {
          room.players.delete(playerId);
          console.log(`[room] ${playerId} left table ${tableId}, size=${room.players.size}`);

          if (room.players.size === 0) {
            this.clearAutoActionTimer(room);
            if (room.handTimer) clearTimeout(room.handTimer);
            this.rooms.delete(tableId);
            console.log(`[room] table ${tableId} destroyed`);
          }
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

  resync(tableId: number, userId: number, lastHandNo: number | null, lastSequence: number | null) {
    const room = this.rooms.get(tableId);
    if (!room) {
      return { syncType: 'full', currentHandNo: 0, currentSequence: 0 };
    }

    const curHand = room.handCounter;
    const curSeq = room.currentSequence;

    if (lastHandNo === curHand && lastSequence === curSeq) {
      return { syncType: 'none', currentHandNo: curHand, currentSequence: curSeq };
    }

    return { syncType: 'full', currentHandNo: curHand, currentSequence: curSeq };
  }

  async startHand(tableId: number, io: any): Promise<void> {
    const room = this.rooms.get(tableId);
    if (!room) return;

    if (room.busy) {
      console.log(`[hand] ${ts()} table ${tableId}: busy, skipping startHand`);
      return;
    }

    const isTournament = !!room.tournamentId;

    const activePlayers = room.players.size;
    if (activePlayers < 2) {
      console.log(`[hand] table ${tableId}: not enough players (${activePlayers})`);
      return;
    }

    room.busy = true;
    try {
      const players: PlayerInit[] = [];
      const REBUY_THRESHOLD = Number(process.env.REBUY_THRESHOLD ?? 0);
      const REBUY_AMOUNT = Number(process.env.REBUY_AMOUNT ?? 1000);

      for (const [, info] of room.players) {
        const oldSeat = room.game.state.seats.find((s) => s.userId === info.userId);
        let stack: number;

        if (isTournament) {
          if (oldSeat === undefined) {
            stack = info.tournamentStack ?? 0;
          } else {
            stack = Number(oldSeat.stack) || 0;
          }
          if (stack <= 0) {
            console.log(`[hand] tournament: skipping user ${info.userId} (stack=${stack})`);
            continue;
          }
        } else {
          stack = oldSeat?.stack ?? 1000;
          if (REBUY_THRESHOLD > 0 && stack < REBUY_THRESHOLD) {
            const injected = round2(REBUY_AMOUNT - stack);
            room.totalRebuy = round2(room.totalRebuy + injected);
            stack = REBUY_AMOUNT;
          }
        }

        players.push({
          userId: info.userId,
          displayName: info.displayName,
          stack,
        });
      }

      if (players.length < 2) {
        console.log(`[hand] table ${tableId}: only ${players.length} players with chips — paused`);
        room.busy = false;
        return;
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
        players,
      );

      if (prevDealerSeat >= 0) {
        room.game.state.dealerSeat = prevDealerSeat;
      }

      room.game.startHand([]);

      room.handCounter = prevHandCounter + 1;
      room.game.state.handNo = room.handCounter;
      room.currentSequence = 0;
      room.turnBankUsed = false;

      room.turnStartedAt = Date.now();
      const limits = TIME_LIMITS[room.speed];
      room.autoActionAt = room.turnStartedAt + limits.action * 1000;

      // Log hand details
      const dealerSeat = room.game.state.dealerSeat;
      const firstSeat = room.game.state.currentSeat;
      console.log(
        `[hand] ${ts()} table ${tableId} hand #${room.handCounter} dealer=${dealerSeat} first=${firstSeat} SB=${room.blinds.sb} BB=${room.blinds.bb}`,
      );

      const handPlayers = room.game.state.seats
        .filter((s: any) => !s.folded || s.stack > 0)
        .map((s: any) => ({
          userId: s.userId,
          displayName: s.displayName,
          stack: s.stack,
          seat: s.seat,
        }));

      // Skip persistence for tournaments
      if (isTournament) {
        room.currentHandId = null;
      } else {
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
        } catch (e: any) {
          console.error('[game-manager] persister.startHand error:', e.message);
          room.currentHandId = null;
        }
      }
    } catch (e: any) {
      console.error(`[hand] ERROR in startHand:`, e);
      room.busy = false;
      return;
    }

    // Release busy
    room.busy = false;

    // Broadcast + schedule first action
    this.broadcastState(tableId, io);
    this.scheduleAutoAction(room, io, `startHand-#${room.handCounter}`);
  }

  async act(socketId: string, actionType: string, amount: number, io: any): Promise<CommandResult> {
    const ctx = this.getPlayerBySocket(socketId);
    if (!ctx) return { ok: false, code: ErrorCode.NOT_IN_ROOM };

    const { room, player } = ctx;

    if (room.busy) {
      return { ok: false, code: ErrorCode.RATE_LIMITED };
    }

    const seatIdx = room.game.state.seats.findIndex((s) => s.userId === player.userId);
    if (seatIdx === -1) return { ok: false, code: ErrorCode.NOT_SEATED };

    const actType = actionType.toLowerCase() as 'fold' | 'check' | 'call' | 'raise';
    const result = room.game.act(seatIdx, actType, amount);
    if (!result.ok) {
      return { ok: false, code: (result.error as any) || ErrorCode.INVALID_ACTION };
    }

    console.log(`[hand] ${ts()} user ${player.displayName} seat ${seatIdx} ${actType} ${amount}`);

    room.busy = true;
    await this.afterAction(room, io, seatIdx, actType, amount, 'user');
    return { ok: true };
  }

  async useTimeBank(socketId: string, io: any): Promise<CommandResult> {
    const ctx = this.getPlayerBySocket(socketId);
    if (!ctx) return { ok: false, code: ErrorCode.NOT_IN_ROOM };

    const { room, player } = ctx;
    const seatIdx = room.game.state.seats.findIndex((s) => s.userId === player.userId);
    if (seatIdx === -1) return { ok: false, code: ErrorCode.NOT_SEATED };

    const result = room.game.useTimeBank(seatIdx);
    if (!result.ok) return { ok: false, code: (result.error as any) || ErrorCode.INVALID_ACTION };

    room.turnBankUsed = true;
    room.game.state.turnBankActive = true;
    const limits = TIME_LIMITS[room.speed];
    room.autoActionAt = room.turnStartedAt + (limits.action + limits.bank) * 1000;

    console.log(`[timer] ${ts()} ⏱️ time bank used by seat ${seatIdx} (${player.displayName})`);

    this.clearAutoActionTimer(room);
    room.lastScheduledSeat = -1;
    this.scheduleAutoAction(room, io, 'timeBank');
    this.broadcastState(room.tableId, io);

    return { ok: true };
  }

  broadcastState(tableId: number, io: any): void {
    const room = this.rooms.get(tableId);
    if (!room) return;

    const limits = TIME_LIMITS[room.speed];
    const effectiveLimit = limits.action + (room.turnBankUsed ? limits.bank : 0);

    for (const [, info] of room.players) {
      try {
        if (!info.socketId) continue;
        const view = room.game.publicView(info.userId);
        io.to(info.socketId).emit('table:state', {
          ...view,
          handNo: room.handCounter,
          sequence: room.currentSequence,
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
          turnBaseLimit: effectiveLimit,
          timeBankLimit: limits.bank,
          turnBankActive: room.turnBankUsed,
          totalRake: room.totalRake,
          totalRebuy: room.totalRebuy,
          mode: room.mode,
          tournamentId: room.tournamentId,
          tournamentTableNumber: room.tournamentTableNumber,
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
