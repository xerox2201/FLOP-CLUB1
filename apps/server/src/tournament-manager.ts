import { Pool } from 'pg';
import { LedgerService } from './ledger.js';
import { BlindStructureService } from './blind-structures.js';
import { gameManager } from './game-manager.js';
import { SeasonManager } from './season-manager.js';
import { getAchievementsService } from './achievement-service.js';

export type TournamentStatus =
  | 'scheduled'
  | 'registering'
  | 'running'
  | 'paused'
  | 'final_table'
  | 'finished'
  | 'cancelled';

export type TournamentFormat = 'mtt' | 'sng' | 'freeroll' | 'satellite';

export interface TournamentConfig {
  id?: number;
  name: string;
  variant: 'holdem' | 'omaha4' | 'omaha5';
  mode: 'free' | 'real';
  format: TournamentFormat;
  speed: 'regular' | 'fast' | 'turbo' | 'hyper';
  buyIn: number;
  fee: number;
  startingStack: number;
  minPlayers: number;
  maxPlayers: number;
  guaranteed: number;
  scheduledStart?: Date | null;
  lateRegMin: number;
  lateRegLevel: number;
  allowReEntry: boolean;
  maxReEntries: number;
  isBounty: boolean;
  bountyAmount: number;
  satelliteTargetId: number | null;
  seatsAwarded: number;
  blindStructureId: number;
  isPrivate: boolean;
  createdBy: number;
}

export interface TournamentPlayer {
  userId: number;
  displayName: string;
  stack: number;
  tableNumber: number | null;
  seat: number | null;
  status: 'active' | 'sitting_out' | 'eliminated' | 'winner';
  eliminatedAt?: Date;
  finalPosition?: number;
}

export interface Tournament {
  id: number;
  config: TournamentConfig;
  status: TournamentStatus;
  currentLevel: number;
  levelStartedAt: number;
  players: Map<number, TournamentPlayer>;
  tables: Map<number, { tableNumber: number; seats: Array<number | null>; isFinal: boolean }>;
  startedAt?: number;
  finishedAt?: number;
  totalPrizePool: number;
  totalRake: number;
  levelTimer: NodeJS.Timeout | null;
  pausedAt?: number;
  pausedRemainingSec?: number;
  autoStartTimer?: NodeJS.Timeout | null;
  lateRegClosed?: boolean;
}

export class TournamentManager {
  private ledger: LedgerService;
  private blindService: BlindStructureService;
  private tournaments: Map<number, Tournament> = new Map();
  private io: any = null;

    private seasons: SeasonManager;

constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
    this.blindService = new BlindStructureService(db);
    this.seasons = new SeasonManager(db);
  }

  setIO(io: any): void {
    this.io = io;
  }

  // ============================================================
  // CREATE
  // ============================================================
  async create(config: TournamentConfig): Promise<number> {
    const now = Date.now();
    let status: TournamentStatus = 'registering';

    if (config.format === 'sng' || config.format === 'freeroll') {
      status = 'registering';
    } else if (config.scheduledStart && config.scheduledStart.getTime() > now) {
      status = 'scheduled';
    }

    const res = await this.db.query(
      `INSERT INTO tournaments
         (name, variant, mode, format, speed, buy_in, fee, starting_stack,
          min_players, max_players, guaranteed, scheduled_start, late_reg_min, late_reg_level,
          blind_structure_id, status, is_private, created_by,
          allow_re_entry, max_re_entries, is_bounty, bounty_amount,
          satellite_target_id, seats_awarded)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id`,
      [
        config.name,
        config.variant,
        config.mode,
        config.format,
        config.speed,
        config.buyIn,
        config.fee,
        config.startingStack,
        config.minPlayers,
        config.maxPlayers,
        config.guaranteed,
        config.scheduledStart || null,
        config.lateRegMin,
        config.lateRegLevel,
        config.blindStructureId,
        status,
        config.isPrivate,
        config.createdBy,
        config.allowReEntry,
        config.maxReEntries,
        config.isBounty,
        config.bountyAmount,
        config.satelliteTargetId ?? null,
        config.seatsAwarded ?? 0,
      ],
    );

    const tournamentId = res.rows[0].id;
    await this.setupPayoutStructure(tournamentId, config.maxPlayers);

    console.log(`[tournament] ✅ created #${tournamentId} "${config.name}" status=${status}`);
    return tournamentId;
  }

  // ============================================================
  // PAYOUT STRUCTURE
  // ============================================================
  private computePayoutStructure(
    numPlayers: number,
  ): Array<{ position: number; percentage: number }> {
    if (numPlayers <= 2)
      return [
        { position: 1, percentage: 0.65 },
        { position: 2, percentage: 0.35 },
      ];
    if (numPlayers <= 4)
      return [
        { position: 1, percentage: 0.55 },
        { position: 2, percentage: 0.3 },
        { position: 3, percentage: 0.15 },
      ];
    if (numPlayers <= 6)
      return [
        { position: 1, percentage: 0.45 },
        { position: 2, percentage: 0.3 },
        { position: 3, percentage: 0.15 },
        { position: 4, percentage: 0.1 },
      ];
    if (numPlayers <= 9)
      return [
        { position: 1, percentage: 0.4 },
        { position: 2, percentage: 0.25 },
        { position: 3, percentage: 0.15 },
        { position: 4, percentage: 0.1 },
        { position: 5, percentage: 0.05 },
        { position: 6, percentage: 0.05 },
      ];
    if (numPlayers <= 18)
      return [
        { position: 1, percentage: 0.35 },
        { position: 2, percentage: 0.22 },
        { position: 3, percentage: 0.14 },
        { position: 4, percentage: 0.1 },
        { position: 5, percentage: 0.07 },
        { position: 6, percentage: 0.05 },
        { position: 7, percentage: 0.04 },
        { position: 8, percentage: 0.03 },
      ];
    if (numPlayers <= 45)
      return [
        { position: 1, percentage: 0.3 },
        { position: 2, percentage: 0.2 },
        { position: 3, percentage: 0.12 },
        { position: 4, percentage: 0.09 },
        { position: 5, percentage: 0.07 },
        { position: 6, percentage: 0.05 },
        { position: 7, percentage: 0.04 },
        { position: 8, percentage: 0.035 },
        { position: 9, percentage: 0.03 },
        { position: 10, percentage: 0.025 },
        { position: 11, percentage: 0.02 },
        { position: 12, percentage: 0.02 },
      ];
    return [
      { position: 1, percentage: 0.3 },
      { position: 2, percentage: 0.2 },
      { position: 3, percentage: 0.12 },
      { position: 4, percentage: 0.08 },
      { position: 5, percentage: 0.06 },
      { position: 6, percentage: 0.05 },
      { position: 7, percentage: 0.04 },
      { position: 8, percentage: 0.035 },
      { position: 9, percentage: 0.03 },
      { position: 10, percentage: 0.025 },
      { position: 11, percentage: 0.02 },
      { position: 12, percentage: 0.015 },
      { position: 13, percentage: 0.015 },
      { position: 14, percentage: 0.005 },
      { position: 15, percentage: 0.005 },
    ];
  }

  private async setupPayoutStructure(tournamentId: number, numPlayers: number): Promise<void> {
    await this.db.query('DELETE FROM tournament_payouts WHERE tournament_id = $1', [tournamentId]);

    const structure = this.computePayoutStructure(numPlayers);

    for (const s of structure) {
      await this.db.query(
        `INSERT INTO tournament_payouts (tournament_id, position, percentage)
         VALUES ($1, $2, $3)
         ON CONFLICT (tournament_id, position) DO UPDATE SET percentage = EXCLUDED.percentage`,
        [tournamentId, s.position, s.percentage],
      );
    }
  }

  // ============================================================
  // REGISTER
  // ============================================================
  async register(
    tournamentId: number,
    userId: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const t = await this.loadFromDB(tournamentId);
    if (!t) return { ok: false, error: 'tournament_not_found' };

    // 🔴 Sync currentLevel + status from DB FIRST
    try {
      const dbRow = await this.db.query(
        'SELECT current_level, status FROM tournaments WHERE id = $1',
        [tournamentId],
      );
      if (dbRow.rows.length > 0) {
        t.currentLevel = dbRow.rows[0].current_level;
        t.status = dbRow.rows[0].status as any;
      }
    } catch (e: any) {
      console.error('[tournament] sync failed:', e.message);
    }

    if (t.status !== 'registering' && t.status !== 'scheduled' && t.status !== 'running') {
      return { ok: false, error: 'registration_closed' };
    }

    const playerCount = await this.getPlayerCount(tournamentId);
    if (playerCount >= t.config.maxPlayers) {
      return { ok: false, error: 'tournament_full' };
    }

    // Allow registration during 'running' if late reg is open
    const isLateReg =
      t.status === 'running' &&
      t.config.lateRegLevel > 0 &&
      t.currentLevel <= t.config.lateRegLevel &&
      !t.lateRegClosed;

    if (t.status === 'running' && !isLateReg) {
      return { ok: false, error: 'registration_closed' };
    }

    if (isLateReg) {
      console.log(
        `[tournament] 🕐 late reg: user=${userId} joining #${tournamentId} at level ${t.currentLevel}/${t.config.lateRegLevel}`,
      );
    }

    const existing = await this.db.query(
      'SELECT id, status, re_entry_count FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2',
      [tournamentId, userId],
    );

    let isReEntry = false;
    let newReEntryCount = 0;

    if (existing.rows.length > 0) {
      const e = existing.rows[0];

      // Check if player is busted (stack=0) in tournament_players
      let isBusted = false;
      if (e.status === 'playing') {
        const pRow = await this.db.query(
          'SELECT stack FROM tournament_players WHERE tournament_id = $1 AND user_id = $2',
          [tournamentId, userId],
        );
        if (pRow.rows.length > 0 && Number(pRow.rows[0].stack) <= 0) {
          isBusted = true;
          await this.db.query(
            `UPDATE tournament_entries SET status = 'eliminated' WHERE tournament_id = $1 AND user_id = $2`,
            [tournamentId, userId],
          );
          await this.db.query(
            `UPDATE tournament_players SET status = 'eliminated', eliminated_at = NOW()
             WHERE tournament_id = $1 AND user_id = $2`,
            [tournamentId, userId],
          );
          const tPlayer = t.players.get(userId);
          if (tPlayer) tPlayer.status = 'eliminated';
          e.status = 'eliminated';
        }
      }

      const eligibleForReEntry =
        (e.status === 'eliminated' || isBusted) &&
        t.config.allowReEntry &&
        isLateReg;

      if (e.status === 'refunded') {
        // allow fresh registration
      } else if (eligibleForReEntry) {
        if (e.re_entry_count >= t.config.maxReEntries) {
          return { ok: false, error: 'max_re_entries_reached' };
        }
        isReEntry = true;
        newReEntryCount = (e.re_entry_count ?? 0) + 1;
      } else {
        return { ok: false, error: 'already_registered' };
      }
    }
    // ============================================================
    // Freeroll eligibility: min lifetime deposit
    // ============================================================
    if (t.config.format === 'freeroll') {
      try {
        const cfg = await this.db.query(
          'SELECT min_deposit_usd FROM freeroll_config WHERE id = 1',
        );
        const minReq = Number(cfg.rows[0]?.min_deposit_usd ?? 5);
        const dep = await this.db.query(
          `SELECT COALESCE(SUM(amount_usd), 0)::numeric AS total
           FROM ton_transactions
           WHERE user_id = $1 AND direction = 'deposit' AND status = 'confirmed'`,
          [userId],
        );
        const total = Number(dep.rows[0]?.total ?? 0);
        if (total < minReq) {
          return {
            ok: false,
            error: `min_deposit_${minReq}_usd_required`,
          };
        }
      } catch (e: any) {
        console.error('[freeroll] eligibility check failed:', e.message);
      }
    }

    // 🔴 D5.4: Check if user has an unused satellite ticket for this tournament
    let hasTicket = false;
    try {
      const ticketRes = await this.db.query(
        `SELECT id FROM satellite_tickets
         WHERE user_id = $1 AND target_tournament_id = $2 AND used = FALSE
         ORDER BY id ASC LIMIT 1`,
        [userId, tournamentId],
      );
      if (ticketRes.rows.length > 0) {
        hasTicket = true;
        const ticketId = ticketRes.rows[0].id;
        await this.db.query(
          `UPDATE satellite_tickets SET used = TRUE, used_at = NOW() WHERE id = $1`,
          [ticketId],
        );
        console.log(
          `[tournament] 🎟️ user=${userId} used satellite ticket #${ticketId} for #${tournamentId}`,
        );
      }
    } catch (e: any) {
      console.error('[tournament] ticket check failed:', e.message);
    }

    if (!hasTicket && t.config.mode === 'real' && (t.config.buyIn > 0 || t.config.fee > 0)) {
      const total = t.config.buyIn + t.config.fee;
      const userAcc = await this.ledger.getUserAccountId(userId);
      const entryAcc = await this.ledger.getAccountId('SYSTEM_TOURNAMENT_ENTRY');
      if (!userAcc || !entryAcc) return { ok: false, error: 'account_missing' };

      const ledgerResult = await this.ledger.record({
        kind: 'TOURNAMENT_ENTRY',
        userId,
        ref: `tourney_${tournamentId}_entry`,
        meta: { tournamentId, buyIn: t.config.buyIn, fee: t.config.fee },
        entries: [
          { accountId: userAcc, amount: -total },
          { accountId: entryAcc, amount: total },
        ],
        idempotencyKey: isReEntry
          ? `tourney_reentry_${tournamentId}_${userId}_${newReEntryCount}`
          : `tourney_entry_${tournamentId}_${userId}`,
      });

      if (!ledgerResult.ok) {
        return { ok: false, error: ledgerResult.error || 'payment_failed' };
      }
    }

    if (isReEntry) {
      await this.db.query(
        `UPDATE tournament_entries
         SET status = 'registered', re_entry_count = $1
         WHERE tournament_id = $2 AND user_id = $3`,
        [newReEntryCount, tournamentId, userId],
      );
    } else {
      await this.db.query(
        `INSERT INTO tournament_entries
           (tournament_id, user_id, status, starting_stack)
         VALUES ($1, $2, 'registered', $3)
         ON CONFLICT (tournament_id, user_id) DO UPDATE SET status = 'registered'`,
        [tournamentId, userId, t.config.startingStack],
      );
    }

    // Late reg OR re-entry → add to table
    if (isLateReg || isReEntry) {
      try {
        if (isReEntry) {
          const oldPlayer = t.players.get(userId);
          if (oldPlayer) oldPlayer.status = 'active';
          await this.db.query(
            `UPDATE tournament_players
             SET status = 'active', stack = $1, eliminated_at = NULL, final_position = NULL
             WHERE tournament_id = $2 AND user_id = $3`,
            [t.config.startingStack, tournamentId, userId],
          );
        }
        await this.addLateRegPlayerToTable(tournamentId, userId, t);
      } catch (e: any) {
        console.error('[tournament] addLateRegPlayerToTable failed:', e.message);
      }
    }

    console.log(
      `[tournament] ✅ user=${userId} registered for #${tournamentId}${isLateReg ? ' (late)' : ''}${isReEntry ? ' (re-entry#' + newReEntryCount + ')' : ''}${hasTicket ? ' (ticket)' : ''}`,
    );
    return { ok: true };
  }

  // ============================================================
  // UNREGISTER
  // ============================================================
  async unregister(
    tournamentId: number,
    userId: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const t = await this.loadFromDB(tournamentId);
    if (!t) return { ok: false, error: 'tournament_not_found' };

    if (t.status === 'running' || t.status === 'final_table') {
      return { ok: false, error: 'tournament_running' };
    }

    const entry = await this.db.query(
      'SELECT id, status FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2',
      [tournamentId, userId],
    );
    if (entry.rows.length === 0 || entry.rows[0].status !== 'registered') {
      return { ok: false, error: 'not_registered' };
    }

    if (t.config.mode === 'real' && (t.config.buyIn > 0 || t.config.fee > 0)) {
      const total = t.config.buyIn + t.config.fee;
      const userAcc = await this.ledger.getUserAccountId(userId);
      const entryAcc = await this.ledger.getAccountId('SYSTEM_TOURNAMENT_ENTRY');
      if (userAcc && entryAcc) {
        await this.ledger.record({
          kind: 'TOURNAMENT_REFUND',
          userId,
          ref: `tourney_${tournamentId}_refund`,
          entries: [
            { accountId: entryAcc, amount: -total },
            { accountId: userAcc, amount: total },
          ],
          idempotencyKey: `tourney_refund_${tournamentId}_${userId}`,
        });
      }
    }

    await this.db.query(
      `UPDATE tournament_entries SET status = 'refunded' WHERE tournament_id = $1 AND user_id = $2`,
      [tournamentId, userId],
    );

    console.log(`[tournament] user=${userId} unregistered from #${tournamentId}`);
    return { ok: true };
  }

  // ============================================================
  // START
  // ============================================================
  async start(tournamentId: number): Promise<{ ok: boolean; error?: string }> {
    const t = await this.loadFromDB(tournamentId);
    if (!t) return { ok: false, error: 'tournament_not_found' };

    if (t.status !== 'registering' && t.status !== 'scheduled') {
      return { ok: false, error: 'invalid_status' };
    }

    const entries = await this.db.query(
      `SELECT te.user_id, u.display_name
       FROM tournament_entries te
       JOIN users u ON u.id = te.user_id
       WHERE te.tournament_id = $1 AND te.status = 'registered'
       ORDER BY te.registered_at ASC`,
      [tournamentId],
    );

    if (entries.rows.length < t.config.minPlayers) {
      return { ok: false, error: 'not_enough_players' };
    }

    await this.setupPayoutStructure(tournamentId, entries.rows.length);

    const totalBuyIn = entries.rows.length * t.config.buyIn;
    const totalFee = entries.rows.length * t.config.fee;
    const prizePool = Math.max(totalBuyIn, t.config.guaranteed);

    await this.db.query(
      `UPDATE tournaments
       SET status = 'running',
           started_at = NOW(),
           total_prize_pool = $1,
           total_rake = $2,
           total_players = $3,
           current_level = 1,
           level_started_at = NOW()
       WHERE id = $4`,
      [prizePool, totalFee, entries.rows.length, tournamentId],
    );

    t.status = 'running';
    t.startedAt = Date.now();
    t.currentLevel = 1;
    t.levelStartedAt = Date.now();
    t.totalPrizePool = prizePool;
    t.totalRake = totalFee;

    const players = entries.rows;
    const tableSize = 9;
    const numTables = Math.max(1, Math.ceil(players.length / tableSize));

    for (let i = 0; i < numTables; i++) {
      const tableNumber = i + 1;
      const seats: Array<number | null> = new Array(tableSize).fill(null);
      t.tables.set(tableNumber, { tableNumber, seats, isFinal: false });

      await this.db.query(
        `INSERT INTO tournament_tables (tournament_id, table_number, max_seats, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (tournament_id, table_number) DO NOTHING`,
        [tournamentId, tableNumber, tableSize],
      );
    }

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const tableIdx = i % numTables;
      const seatIdx = Math.floor(i / numTables);
      const tableNumber = tableIdx + 1;

      t.players.set(p.user_id, {
        userId: p.user_id,
        displayName: p.display_name,
        stack: t.config.startingStack,
        tableNumber,
        seat: seatIdx,
        status: 'active',
      });

      const table = t.tables.get(tableNumber)!;
      table.seats[seatIdx] = p.user_id;

      await this.db.query(
        `INSERT INTO tournament_players
           (tournament_id, user_id, stack, table_number, seat, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [tournamentId, p.user_id, t.config.startingStack, tableNumber, seatIdx],
      );

      await this.db.query(
        `UPDATE tournament_entries SET status = 'playing' WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, p.user_id],
      );
    }

    const level1 = await this.blindService.getLevel(t.config.blindStructureId, 1);
    if (level1) {
      await this.db.query(
        `INSERT INTO tournament_level_log (tournament_id, level, sb, bb, ante, players_remaining)
         VALUES ($1, 1, $2, $3, $4, $5)
         ON CONFLICT (tournament_id, level) DO NOTHING`,
        [tournamentId, level1.sb, level1.bb, level1.ante, players.length],
      );
    }

    await this.createGameRooms(tournamentId, t);
    this.startBlindTimer(tournamentId);

    console.log(
      `[tournament] ✅ #${tournamentId} started with ${players.length} players, ${numTables} tables`,
    );

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:started`, {
        players: players.length,
        tables: numTables,
      });
    }
    return { ok: true };
  }

  private async createGameRooms(tournamentId: number, t: Tournament): Promise<void> {
    const level1 = await this.blindService.getLevel(t.config.blindStructureId, 1);
    const blinds = level1
      ? { sb: level1.sb, bb: level1.bb, ante: level1.ante }
      : { sb: 10, bb: 20, ante: 0 };

    for (const [tableNumber, table] of t.tables.entries()) {
      const players = table.seats
        .filter((s): s is number => s !== null)
        .map((userId) => {
          const p = t.players.get(userId);
          return {
            userId,
            displayName: p?.displayName || `Player ${userId}`,
            stack: p?.stack ?? t.config.startingStack,
          };
        })
        .filter((p) => p.stack > 0);

      if (players.length < 2) {
        console.log(`[tournament] table ${tableNumber} has < 2 players, skipping room creation`);
        continue;
      }

      gameManager.createTournamentRoom({
        tournamentId,
        tableNumber,
        variant: t.config.variant,
        speed: t.config.speed,
        blinds,
        players,
      });
    }
  }

  // ============================================================
  // LATE REG / RE-ENTRY: add player to smallest table
  // ============================================================
  private async addLateRegPlayerToTable(
    tournamentId: number,
    userId: number,
    t: Tournament,
  ): Promise<void> {
    const uRes = await this.db.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    const displayName = uRes.rows[0]?.display_name ?? `Player ${userId}`;

    const counts: { tableNumber: number; count: number }[] = [];
    for (const [num, tbl] of t.tables.entries()) {
      const active = tbl.seats.filter((s) => {
        if (s === null) return false;
        const p = t.players.get(s);
        return p?.status === 'active';
      }).length;
      counts.push({ tableNumber: num, count: active });
    }
    if (counts.length === 0) {
      console.log(`[tournament] late reg: no tables available for user=${userId}`);
      return;
    }
    counts.sort((a, b) => a.count - b.count);

    let targetTableNum = counts[0].tableNumber;
    let emptySeat = -1;
    for (const c of counts) {
      const tbl = t.tables.get(c.tableNumber);
      if (!tbl) continue;
      const idx = tbl.seats.findIndex((s) => s === null);
      if (idx >= 0) {
        targetTableNum = c.tableNumber;
        emptySeat = idx;
        break;
      }
    }
    if (emptySeat < 0) {
      console.log(`[tournament] late reg: no empty seat for user=${userId}`);
      return;
    }

    const startStack = t.config.startingStack;
    t.players.set(userId, {
      userId,
      displayName,
      stack: startStack,
      tableNumber: targetTableNum,
      seat: emptySeat,
      status: 'active',
    });
    const tbl = t.tables.get(targetTableNum)!;
    tbl.seats[emptySeat] = userId;

    await this.db.query(
      `INSERT INTO tournament_players
         (tournament_id, user_id, stack, table_number, seat, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [tournamentId, userId, startStack, targetTableNum, emptySeat],
    );
    await this.db.query(
      `UPDATE tournament_entries SET status = 'playing' WHERE tournament_id = $1 AND user_id = $2`,
      [tournamentId, userId],
    );

    const virtualTableId = 1_000_000 + tournamentId * 1000 + targetTableNum;
    const room = gameManager.getRoom(virtualTableId);
    if (room) {
      const playerId = `user_${userId}`;
      room.players.set(playerId, {
        userId,
        playerId,
        displayName,
        socketId: '',
        tournamentStack: startStack,
      });
      console.log(
        `[tournament] 🕐 late reg: added user=${userId} to table ${targetTableNum} seat ${emptySeat} (vTable=${virtualTableId})`,
      );
    } else {
      console.log(
        `[tournament] late reg: room ${virtualTableId} not found; player will join via socket`,
      );
    }

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:late_register`, {
        userId,
        displayName,
        tableNumber: targetTableNum,
        seat: emptySeat,
        stack: startStack,
      });
    }
  }

  // ============================================================
  // TIMERS
  // ============================================================
  private startBlindTimer(tournamentId: number): void {
    const t = this.tournaments.get(tournamentId);
    if (!t) return;
    if (t.status === 'paused') return;

    if (t.levelTimer) clearTimeout(t.levelTimer);

    const scheduleNext = async () => {
      const level = await this.blindService.getLevel(t.config.blindStructureId, t.currentLevel);
      if (!level) return;
      const durationMs = level.durationSec * 1000;
      t.levelTimer = setTimeout(async () => {
        await this.advanceLevel(tournamentId);
      }, durationMs);
    };
    scheduleNext();
  }

  private async advanceLevel(tournamentId: number): Promise<void> {
    const t = this.tournaments.get(tournamentId);
    if (!t) return;
    if (t.status === 'paused') {
      console.log(`[tournament] ⏸️ advanceLevel skipped (#${tournamentId} is paused)`);
      return;
    }
    if (t.status !== 'running' && t.status !== 'final_table') return;

    const prevLevel = t.currentLevel;
    t.currentLevel += 1;
    t.levelStartedAt = Date.now();

    await this.db.query(
      `UPDATE tournaments SET current_level = $1, level_started_at = NOW() WHERE id = $2`,
      [t.currentLevel, tournamentId],
    );

    const level = await this.blindService.getLevel(t.config.blindStructureId, t.currentLevel);

    if (!level) {
      this.startBlindTimer(tournamentId);
      return;
    }

    // BREAK handling
    if (level.isBreak) {
      console.log(`[tournament] ☕ #${tournamentId} entered BREAK at level ${t.currentLevel}`);
      if (this.io) {
        this.io.emit(`tournament:${tournamentId}:break_start`, {
          level: t.currentLevel,
          durationSec: level.durationSec,
        });
      }
      this.startBlindTimer(tournamentId);
      return;
    }

    const activeCount = [...t.players.values()].filter((p) => p.status === 'active').length;
    await this.db.query(
      `INSERT INTO tournament_level_log (tournament_id, level, sb, bb, ante, players_remaining)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tournament_id, level) DO NOTHING`,
      [tournamentId, t.currentLevel, level.sb, level.bb, level.ante, activeCount],
    );

    gameManager.updateRoomBlinds(tournamentId, level.sb, level.bb, level.ante);

    // Late reg close check
    if (
      !t.lateRegClosed &&
      t.config.lateRegLevel > 0 &&
      prevLevel <= t.config.lateRegLevel &&
      t.currentLevel > t.config.lateRegLevel
    ) {
      t.lateRegClosed = true;
      console.log(`[tournament] 🔒 late registration CLOSED at level ${t.currentLevel}`);
      if (this.io) {
        this.io.emit(`tournament:${tournamentId}:late_reg_closed`, {
          closedAtLevel: t.currentLevel,
          totalPlayers: t.players.size,
        });
      }
    }

    // Break end
    const prevLevelData = await this.blindService.getLevel(
      t.config.blindStructureId,
      prevLevel,
    );
    if (prevLevelData?.isBreak && this.io) {
      this.io.emit(`tournament:${tournamentId}:break_end`, {
        newLevel: t.currentLevel,
        sb: level.sb,
        bb: level.bb,
        ante: level.ante,
      });
    }

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:level`, {
        level: t.currentLevel,
        sb: level.sb,
        bb: level.bb,
        ante: level.ante,
        isBreak: false,
      });
    }

    this.startBlindTimer(tournamentId);
  }

  // ============================================================
  // AUTO-START SCHEDULER
  // ============================================================
  startAutoStartScheduler(intervalMs: number = 30_000): void {
    console.log(`[tournament] 🚀 auto-start scheduler running (every ${intervalMs / 1000}s)`);
    this.tickAutoStart().catch((e) => console.error('[auto-start] tick error:', e.message));
    const timer = setInterval(() => {
      this.tickAutoStart().catch((e) => console.error('[auto-start] tick error:', e.message));
    }, intervalMs);
    if (timer.unref) timer.unref();
  }

  private async tickAutoStart(): Promise<void> {
    try {
      const res = await this.db.query(
        `SELECT id, name, scheduled_start FROM tournaments
         WHERE status = 'scheduled'
           AND scheduled_start IS NOT NULL
           AND scheduled_start <= NOW()
         ORDER BY scheduled_start ASC
         LIMIT 20`,
      );
      for (const row of res.rows) {
        const result = await this.start(row.id);
        if (result.ok) {
          console.log(`[tournament] 🚀 auto-started #${row.id} "${row.name}"`);
        } else {
          console.log(`[tournament] ⏳ auto-start #${row.id} deferred: ${result.error}`);
        }
      }
    } catch (e: any) {
      console.error('[auto-start] error:', e.message);
    }
  }

  // ============================================================
  // PAUSE / RESUME
  // ============================================================
  async pause(tournamentId: number): Promise<{ ok: boolean; error?: string }> {
    const t = this.tournaments.get(tournamentId) ?? (await this.loadFromDB(tournamentId));
    if (!t) return { ok: false, error: 'tournament_not_found' };
    if (t.status !== 'running' && t.status !== 'final_table') {
      return { ok: false, error: 'not_running' };
    }

    const level = await this.blindService.getLevel(t.config.blindStructureId, t.currentLevel);
    let remainingSec = 0;
    if (level) {
      const elapsed = (Date.now() - t.levelStartedAt) / 1000;
      remainingSec = Math.max(0, level.durationSec - elapsed);
    }

    t.pausedAt = Date.now();
    t.pausedRemainingSec = remainingSec;

    if (t.levelTimer) {
      clearTimeout(t.levelTimer);
      t.levelTimer = null;
    }

    const prevStatus = t.status;
    t.status = 'paused';

    await this.db.query(`UPDATE tournaments SET status = 'paused' WHERE id = $1`, [tournamentId]);

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:paused`, {
        pausedAt: t.pausedAt,
        remainingSec: Math.round(remainingSec),
        prevStatus,
      });
    }

    console.log(
      `[tournament] ⏸️ #${tournamentId} paused at level ${t.currentLevel} (${Math.round(remainingSec)}s remaining)`,
    );
    return { ok: true };
  }

  async resume(tournamentId: number): Promise<{ ok: boolean; error?: string }> {
    const t = this.tournaments.get(tournamentId) ?? (await this.loadFromDB(tournamentId));
    if (!t) return { ok: false, error: 'tournament_not_found' };
    if (t.status !== 'paused') return { ok: false, error: 'not_paused' };

    t.status = 'running';
    t.levelStartedAt = Date.now();
    t.pausedAt = undefined;

    await this.db.query(
      `UPDATE tournaments SET status = 'running', level_started_at = NOW() WHERE id = $1`,
      [tournamentId],
    );

    if (t.levelTimer) clearTimeout(t.levelTimer);
    const remainingMs = (t.pausedRemainingSec ?? 0) * 1000;
    if (remainingMs > 0) {
      t.levelTimer = setTimeout(() => {
        this.advanceLevel(tournamentId).catch((e) =>
          console.error('[tournament] advanceLevel after resume failed:', e.message),
        );
      }, remainingMs);
      console.log(
        `[tournament] ▶️ #${tournamentId} resumed with ${Math.round(remainingMs / 1000)}s on level ${t.currentLevel}`,
      );
    } else {
      await this.advanceLevel(tournamentId);
      console.log(`[tournament] ▶️ #${tournamentId} resumed, level advanced`);
    }
    t.pausedRemainingSec = undefined;

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:resumed`, {
        currentLevel: t.currentLevel,
      });
    }

    return { ok: true };
  }

  getStatus(tournamentId: number): TournamentStatus | null {
    const t = this.tournaments.get(tournamentId);
    return t ? t.status : null;
  }

  // ============================================================
  // D5.4: SATELLITE TICKETS
  // ============================================================
  async getUserTickets(userId: number): Promise<any[]> {
    const res = await this.db.query(
      `SELECT st.id, st.target_tournament_id, st.source_tournament_id, st.position,
              st.used, st.created_at,
              tgt.name AS target_name, tgt.scheduled_start AS target_start,
              src.name AS source_name
       FROM satellite_tickets st
       LEFT JOIN tournaments tgt ON tgt.id = st.target_tournament_id
       LEFT JOIN tournaments src ON src.id = st.source_tournament_id
       WHERE st.user_id = $1
       ORDER BY st.id DESC LIMIT 50`,
      [userId],
    );
    return res.rows;
  }

  // ============================================================
  // LIST / GET
  // ============================================================
  async list(
    filter: { status?: string; variant?: string; mode?: string; limit?: number } = {},
  ): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filter.status);
    } else {
      conditions.push(
        `status IN ('scheduled', 'registering', 'running', 'final_table', 'paused')`,
      );
    }

    if (filter.variant) {
      conditions.push(`variant = $${idx++}`);
      params.push(filter.variant);
    }
    if (filter.mode) {
      conditions.push(`mode = $${idx++}`);
      params.push(filter.mode);
    }

    const limit = Math.min(filter.limit || 50, 100);
    params.push(limit);

    const res = await this.db.query(
      `SELECT t.*,
         (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = t.id AND status = 'registered') AS registered_count,
         (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = t.id AND status = 'active') AS active_count
       FROM tournaments t
       WHERE ${conditions.join(' AND ')}
       ORDER BY 
         CASE status WHEN 'running' THEN 0 WHEN 'final_table' THEN 1 WHEN 'paused' THEN 2 WHEN 'registering' THEN 3 WHEN 'scheduled' THEN 4 ELSE 5 END,
         scheduled_start ASC NULLS LAST,
         id DESC
       LIMIT $${idx}`,
      params,
    );

    return res.rows.map((r) => this.serializeRow(r));
  }

  async get(tournamentId: number): Promise<any | null> {
    const res = await this.db.query(
      `SELECT t.*,
         (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = t.id AND status = 'registered') AS registered_count,
         (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = t.id AND status = 'active') AS active_count
       FROM tournaments t WHERE id = $1`,
      [tournamentId],
    );
    if (res.rows.length === 0) return null;

    const base = this.serializeRow(res.rows[0]);
    const players = await this.db.query(
      `SELECT tp.user_id, u.display_name, tp.stack, tp.table_number, tp.seat, tp.status, tp.final_position, tp.bounty_earned
       FROM tournament_players tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.tournament_id = $1
       ORDER BY tp.stack DESC`,
      [tournamentId],
    );

    const payouts = await this.db.query(
      `SELECT position, percentage, fixed_amount FROM tournament_payouts
       WHERE tournament_id = $1 ORDER BY position ASC`,
      [tournamentId],
    );

    return {
      ...base,
      players: players.rows.map((p) => ({
        userId: p.user_id,
        displayName: p.display_name,
        stack: Number(p.stack),
        tableNumber: p.table_number,
        seat: p.seat,
        status: p.status,
        finalPosition: p.final_position,
        bountyEarned: Number(p.bounty_earned ?? 0),
        virtualTableId:
          p.table_number != null ? 1_000_000 + tournamentId * 1000 + p.table_number : null,
      })),
      payouts: payouts.rows.map((p) => ({
        position: p.position,
        percentage: Number(p.percentage),
        fixedAmount: p.fixed_amount ? Number(p.fixed_amount) : null,
      })),
    };
  }

  private serializeRow(r: any): any {
    return {
      id: r.id,
      name: r.name,
      variant: r.variant,
      mode: r.mode,
      format: r.format,
      speed: r.speed,
      buyIn: Number(r.buy_in),
      fee: Number(r.fee),
      startingStack: Number(r.starting_stack),
      minPlayers: r.min_players,
      maxPlayers: r.max_players,
      guaranteed: Number(r.guaranteed),
      scheduledStart: r.scheduled_start,
      lateRegMin: r.late_reg_min,
      lateRegLevel: r.late_reg_level ?? 0,
      allowReEntry: r.allow_re_entry ?? false,
      maxReEntries: r.max_re_entries ?? 1,
      isBounty: r.is_bounty ?? false,
      bountyAmount: Number(r.bounty_amount ?? 0),
      satelliteTargetId: r.satellite_target_id ? Number(r.satellite_target_id) : null,
      seatsAwarded: Number(r.seats_awarded ?? 0),
      blindStructureId: r.blind_structure_id,
      currentLevel: r.current_level,
      levelStartedAt: r.level_started_at,
      status: r.status,
      isPrivate: r.is_private,
      totalPrizePool: Number(r.total_prize_pool),
      totalRake: Number(r.total_rake),
      totalPlayers: r.total_players,
      registeredCount: Number(r.registered_count || 0),
      activeCount: Number(r.active_count || 0),
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      createdAt: r.created_at,
    };
  }

  private async getPlayerCount(tournamentId: number): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*) AS c FROM tournament_entries WHERE tournament_id = $1 AND status IN ('registered','playing')`,
      [tournamentId],
    );
    return Number(res.rows[0].c);
  }

  private async loadFromDB(tournamentId: number): Promise<Tournament | null> {
    if (this.tournaments.has(tournamentId)) {
      return this.tournaments.get(tournamentId)!;
    }

    const res = await this.db.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (res.rows.length === 0) return null;

    const r = res.rows[0];
    const t: Tournament = {
      id: r.id,
      config: {
        id: r.id,
        name: r.name,
        variant: r.variant,
        mode: r.mode,
        format: r.format,
        speed: r.speed,
        buyIn: Number(r.buy_in),
        fee: Number(r.fee),
        startingStack: Number(r.starting_stack),
        minPlayers: r.min_players,
        maxPlayers: r.max_players,
        guaranteed: Number(r.guaranteed),
        scheduledStart: r.scheduled_start,
        lateRegMin: r.late_reg_min,
        lateRegLevel: r.late_reg_level ?? 0,
        allowReEntry: r.allow_re_entry ?? false,
        maxReEntries: r.max_re_entries ?? 1,
        isBounty: r.is_bounty ?? false,
        bountyAmount: Number(r.bounty_amount ?? 0),
        satelliteTargetId: r.satellite_target_id ? Number(r.satellite_target_id) : null,
        seatsAwarded: Number(r.seats_awarded ?? 0),
        blindStructureId: r.blind_structure_id,
        isPrivate: r.is_private,
        createdBy: r.created_by,
      },
      status: r.status,
      currentLevel: r.current_level || 0,
      levelStartedAt: r.level_started_at ? new Date(r.level_started_at).getTime() : 0,
      players: new Map(),
      tables: new Map(),
      totalPrizePool: Number(r.total_prize_pool || 0),
      totalRake: Number(r.total_rake || 0),
      levelTimer: null,
    };

    if (t.status === 'running' || t.status === 'final_table' || t.status === 'paused') {
      const players = await this.db.query(
        'SELECT tp.*, u.display_name FROM tournament_players tp JOIN users u ON u.id = tp.user_id WHERE tp.tournament_id = $1',
        [tournamentId],
      );
      for (const p of players.rows) {
        t.players.set(p.user_id, {
          userId: p.user_id,
          displayName: p.display_name ?? '',
          stack: Number(p.stack),
          tableNumber: p.table_number,
          seat: p.seat,
          status: p.status,
          finalPosition: p.final_position,
        });
      }

      const tables = await this.db.query(
        'SELECT * FROM tournament_tables WHERE tournament_id = $1 AND status = $2',
        [tournamentId, 'active'],
      );
      for (const tbl of tables.rows) {
        t.tables.set(tbl.table_number, {
          tableNumber: tbl.table_number,
          seats: new Array(tbl.max_seats).fill(null),
          isFinal: tbl.is_final,
        });
      }
    }

    this.tournaments.set(tournamentId, t);
    return t;
  }

  // ============================================================
  // ELIMINATION
  // ============================================================
  async eliminatePlayer(
    tournamentId: number,
    userId: number,
    eliminatedBy?: number,
  ): Promise<{ ok: boolean; finalPosition?: number; finished?: boolean }> {
    const t = this.tournaments.get(tournamentId) ?? (await this.loadFromDB(tournamentId));
    if (!t) return { ok: false };

    const player = t.players.get(userId);
    if (!player || player.status !== 'active') return { ok: false };

    const activeCount = [...t.players.values()].filter((p) => p.status === 'active').length;
    const finalPosition = activeCount;

    player.status = 'eliminated';
    player.eliminatedAt = new Date();
    player.finalPosition = finalPosition;

    await this.db.query(
      `UPDATE tournament_players
       SET status = 'eliminated', eliminated_at = NOW(), final_position = $1, eliminated_by = $2
       WHERE tournament_id = $3 AND user_id = $4`,
      [finalPosition, eliminatedBy ?? null, tournamentId, userId],
    );

    await this.db.query(
      `UPDATE tournament_entries
       SET status = 'eliminated', final_position = $1
       WHERE tournament_id = $2 AND user_id = $3`,
      [finalPosition, tournamentId, userId],
    );

    console.log(`[tournament] 💀 user=${userId} eliminated at position ${finalPosition}`);

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:elimination`, {
        userId,
        finalPosition,
        remaining: activeCount - 1,
        eliminatedBy: eliminatedBy ?? null,
      });
    }

    const remaining = [...t.players.values()].filter((p) => p.status === 'active');
    if (remaining.length === 1) {
      const winner = remaining[0];
      winner.status = 'winner';
      winner.finalPosition = 1;
      await this.db.query(
        `UPDATE tournament_players SET status = 'winner', final_position = 1
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, winner.userId],
      );
      await this.db.query(
        `UPDATE tournament_entries SET status = 'won', final_position = 1
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, winner.userId],
      );
      await this.finishTournament(tournamentId);
      return { ok: true, finalPosition, finished: true };
    }

    await this.checkAndConsolidate(tournamentId);
    await this.rebalanceIfNeeded(tournamentId);

    return { ok: true, finalPosition, finished: false };
  }

  // ============================================================
  // TABLE BALANCING
  // ============================================================
  private async rebalanceIfNeeded(tournamentId: number): Promise<void> {
    const t = this.tournaments.get(tournamentId);
    if (!t || t.status !== 'running') return;

    const tables = [...t.tables.values()];
    const counts = tables.map((tbl) => ({
      tableNumber: tbl.tableNumber,
      count: tbl.seats.filter((s) => {
        if (s === null) return false;
        const p = t.players.get(s);
        return p?.status === 'active';
      }).length,
    }));

    if (counts.length < 2) return;

    const maxCount = Math.max(...counts.map((c) => c.count));
    const minCount = Math.min(...counts.map((c) => c.count));

    if (maxCount - minCount < 2) return;

    console.log(`[tournament] 🔄 rebalancing: max=${maxCount} min=${minCount}`);

    const sorted = [...counts].sort((a, b) => b.count - a.count);
    const source = sorted[0];
    const target = sorted[sorted.length - 1];

    const sourceTable = t.tables.get(source.tableNumber)!;
    const targetTable = t.tables.get(target.tableNumber)!;

    let moveUserId: number | null = null;
    for (let i = sourceTable.seats.length - 1; i >= 0; i--) {
      const s = sourceTable.seats[i];
      if (s === null) continue;
      const p = t.players.get(s);
      if (p?.status === 'active') {
        moveUserId = s;
        sourceTable.seats[i] = null;
        break;
      }
    }

    if (moveUserId === null) return;

    const emptySeat = targetTable.seats.findIndex((s) => s === null);
    if (emptySeat < 0) return;

    targetTable.seats[emptySeat] = moveUserId;
    const moved = t.players.get(moveUserId)!;
    moved.tableNumber = target.tableNumber;
    moved.seat = emptySeat;

    await this.db.query(
      `UPDATE tournament_players SET table_number = $1, seat = $2
       WHERE tournament_id = $3 AND user_id = $4`,
      [target.tableNumber, emptySeat, tournamentId, moveUserId],
    );

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:balance`, {
        userId: moveUserId,
        from: source.tableNumber,
        to: target.tableNumber,
        seat: emptySeat,
      });
    }
  }

  // ============================================================
  // FINAL TABLE
  // ============================================================
  private async checkAndConsolidate(tournamentId: number): Promise<void> {
    const t = this.tournaments.get(tournamentId);
    if (!t || t.status !== 'running') return;

    const activePlayers = [...t.players.values()].filter((p) => p.status === 'active');
    const finalTableSize = 9;

    if (activePlayers.length <= finalTableSize && t.tables.size > 1) {
      console.log(`[tournament] 🏆 moving to FINAL TABLE (${activePlayers.length} players)`);

      const finalTableNumber = 1000;
      const finalSeats: Array<number | null> = new Array(finalTableSize).fill(null);
      t.tables.clear();
      t.tables.set(finalTableNumber, {
        tableNumber: finalTableNumber,
        seats: finalSeats,
        isFinal: true,
      });

      for (let i = 0; i < activePlayers.length; i++) {
        const p = activePlayers[i];
        p.tableNumber = finalTableNumber;
        p.seat = i;
        finalSeats[i] = p.userId;

        await this.db.query(
          `UPDATE tournament_players SET table_number = $1, seat = $2
           WHERE tournament_id = $3 AND user_id = $4`,
          [finalTableNumber, i, tournamentId, p.userId],
        );
      }

      await this.db.query(
        `UPDATE tournament_tables SET status = 'closed' WHERE tournament_id = $1`,
        [tournamentId],
      );
      await this.db.query(
        `INSERT INTO tournament_tables (tournament_id, table_number, max_seats, status, is_final)
         VALUES ($1, $2, $3, 'active', TRUE)`,
        [tournamentId, finalTableNumber, finalTableSize],
      );

      t.status = 'final_table';
      await this.db.query(`UPDATE tournaments SET status = 'final_table' WHERE id = $1`, [
        tournamentId,
      ]);

      if (this.io) {
        this.io.emit(`tournament:${tournamentId}:final_table`, {
          players: activePlayers.map((p) => ({ userId: p.userId, stack: p.stack })),
          tableNumber: finalTableNumber,
        });
      }
    }
  }

  // ============================================================
  // FINISH + PAYOUTS (D5.4: supports satellite mode)
  // ============================================================
  private async finishTournament(tournamentId: number): Promise<void> {
    const t = this.tournaments.get(tournamentId);
    if (!t) return;

    const isFree = t.config.mode === 'free';
    const isSatellite = !!(t.config.satelliteTargetId && t.config.seatsAwarded > 0);
    console.log(
      `[tournament] 🏁 finishing #${tournamentId} (mode=${t.config.mode}${isSatellite ? ', SATELLITE' : ''})`,
    );

    const payoutsRes = await this.db.query(
      `SELECT position, percentage FROM tournament_payouts
       WHERE tournament_id = $1 ORDER BY position ASC`,
      [tournamentId],
    );

    const totalPrize = t.totalPrizePool;
    const prizeAcc = !isFree ? await this.ledger.getAccountId('SYSTEM_TOURNAMENT_PRIZE') : null;

    // 🔴 D5.4: Satellite mode — award tickets instead of money
    if (isSatellite) {
      const sorted = [...t.players.values()]
        .filter((p) => p.finalPosition != null)
        .sort((a, b) => (a.finalPosition ?? 999) - (b.finalPosition ?? 999));

      const seatWinners = sorted.slice(0, t.config.seatsAwarded);

      for (const winner of seatWinners) {
        try {
          await this.db.query(
            `INSERT INTO satellite_tickets
               (user_id, target_tournament_id, source_tournament_id, position)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (target_tournament_id, source_tournament_id, position) DO NOTHING`,
            [winner.userId, t.config.satelliteTargetId, tournamentId, winner.finalPosition],
          );

          await this.db.query(
            `UPDATE tournament_entries SET status = 'qualified', payout_amount = 0
             WHERE tournament_id = $1 AND user_id = $2`,
            [tournamentId, winner.userId],
          );

          if (this.io) {
            this.io.emit(`tournament:${tournamentId}:ticket_won`, {
              userId: winner.userId,
              targetTournamentId: t.config.satelliteTargetId,
              position: winner.finalPosition,
            });
          }

          console.log(
            `[satellite] 🎟️ #${tournamentId}: user=${winner.userId} (pos ${winner.finalPosition}) → ticket to #${t.config.satelliteTargetId}`,
          );
        } catch (e: any) {
          console.error('[satellite] ticket award failed:', e.message);
        }
      }
    } else {
      // Normal payout loop
      for (const po of payoutsRes.rows) {
        const position = po.position;
        const percentage = Number(po.percentage);

        const winner = [...t.players.values()].find((p) => p.finalPosition === position);
        if (!winner) {
          console.log(
            `[tournament] ⚠️ position ${position} unclaimed (${(percentage * 100).toFixed(1)}% = $${(totalPrize * percentage).toFixed(2)} stays in prize account)`,
          );
          continue;
        }

        const amount = Math.round(totalPrize * percentage * 100) / 100;
        if (amount <= 0) continue;

        if (isFree) {
          try {
            await this.db.query(
              `INSERT INTO free_chips (user_id, chips) VALUES ($1, $2)
               ON CONFLICT (user_id) DO UPDATE SET chips = free_chips.chips + $2`,
              [winner.userId, amount],
            );
            await this.db.query(
              `INSERT INTO play_money_log (user_id, delta, reason, balance_after)
               VALUES ($1, $2, 'tournament_prize',
                 (SELECT chips FROM free_chips WHERE user_id = $1))`,
              [winner.userId, amount],
            );
            console.log(
              `[tournament] 🎁 free chips pos=${position} user=${winner.userId} +${amount}`,
            );
          } catch (e: any) {
            console.error('[tournament] free chips award failed:', e.message);
          }
        } else {
          const userAcc = await this.ledger.getUserAccountId(winner.userId);
          if (!prizeAcc || !userAcc) {
            console.error(
              `[tournament] ❌ missing accounts for user=${winner.userId}`,
            );
            continue;
          }

          const result = await this.ledger.record({
            kind: 'TOURNAMENT_PRIZE',
            userId: winner.userId,
            ref: `tourney_${tournamentId}_prize_pos_${position}`,
            meta: { tournamentId, position, percentage },
            entries: [
              { accountId: prizeAcc, amount: -amount },
              { accountId: userAcc, amount: amount },
            ],
            idempotencyKey: `tourney_prize_${tournamentId}_${winner.userId}`,
          });

          if (result.ok) {
            console.log(`[tournament] 💰 prize pos=${position} user=${winner.userId} $${amount}`);
          } else {
            console.error(`[tournament] ❌ ledger failed:`, result.error);
          }
        }

        await this.db.query(
          `UPDATE tournament_entries SET status = 'cashed', payout_amount = $1
           WHERE tournament_id = $2 AND user_id = $3`,
          [amount, tournamentId, winner.userId],
        );
      }
    }
    // 🔴 D6.2: Award tournament points for the current season
    try {
      const season = await this.seasons.ensureActiveSeason();

      // Attach this tournament to the season if not already
      if (!t.config.id) {
        // no-op; the tournament may have been created outside the manager
      }
      await this.db.query(
        `UPDATE tournaments SET season_id = $1 WHERE id = $2 AND season_id IS NULL`,
        [season.id, tournamentId],
      );

      const totalPlayers = [...t.players.values()].length;
      const buyIn = t.config.buyIn;

      for (const p of t.players.values()) {
        const pos = p.finalPosition;
        if (!pos) continue;
        const pts = this.seasons.computePoints(pos, totalPlayers, buyIn);
        if (pts <= 0) continue;
        await this.db.query(
          `UPDATE tournament_entries
           SET points_earned = $1
           WHERE tournament_id = $2 AND user_id = $3`,
          [pts, tournamentId, p.userId],
        );
      }

      console.log(
        `[season] 📊 #${tournamentId}: awarded points to ${totalPlayers} players (season #${season.id})`,
      );
    } catch (e: any) {
      console.error('[season] points award failed:', e.message);
    }

    const winner = [...t.players.values()].find((p) => p.finalPosition === 1);
    t.status = 'finished';
    t.finishedAt = Date.now();

    await this.db.query(
      `UPDATE tournaments
       SET status = 'finished', finished_at = NOW(), winner_user_id = $1
       WHERE id = $2`,
      [winner?.userId ?? null, tournamentId],
    );

    if (t.levelTimer) {
      clearTimeout(t.levelTimer);
      t.levelTimer = null;
    }

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:finished`, {
        winner: winner?.userId,
        prizePool: totalPrize,
        mode: t.config.mode,
        isSatellite,
      });
    }

    console.log(`[tournament] ✅ #${tournamentId} finished, winner=${winner?.userId}`);
        // ============ ACHIEVEMENTS TRACKING ============
    try {
      const ach = getAchievementsService();
      if (ach) {
        for (const p of t.players.values()) {
          if (!p.userId || p.finalPosition == null) continue;

          await ach.track(p.userId, 'first_tourney', 1);

          if (p.finalPosition === 1) {
            await ach.track(p.userId, 'tourney_win', 1);
            await ach.track(p.userId, 'champion', 1, 'increment');
          }
        }
      }
    } catch (e: any) {
      console.error('[achievements] tournament track failed:', e.message);
    }
    // ============ END ACHIEVEMENTS ============
  }

  // ============================================================
  // PUBLIC API console.log("[tournament] ✅ #${tournamentId} finished, winner=${winner?.userId}");
  // ============================================================
  async handlePlayerBust(
    tournamentId: number,
    userId: number,
    eliminatedBy?: number,
  ): Promise<{ ok: boolean; finalPosition?: number; finished?: boolean }> {
    return this.eliminatePlayer(tournamentId, userId, eliminatedBy);
  }

  async checkBustedPlayers(
    tournamentId: number,
    currentStacks: Map<number, number>,
  ): Promise<void> {
    const t = this.tournaments.get(tournamentId);
    if (!t) return;

    for (const [userId, stack] of currentStacks.entries()) {
      const p = t.players.get(userId);
      if (!p || p.status !== 'active') continue;
      if (stack <= 0) {
        await this.eliminatePlayer(tournamentId, userId);
      } else {
        p.stack = stack;
        await this.db.query(
          `UPDATE tournament_players SET stack = $1 WHERE tournament_id = $2 AND user_id = $3`,
          [stack, tournamentId, userId],
        );
      }
    }
  }

  // ============================================================
  // Sync after each hand
  // ============================================================
  async syncStacksAndEliminate(
    tournamentId: number,
    room: any,
    handResult?: any,
  ): Promise<void> {
    const t = this.tournaments.get(tournamentId) ?? (await this.loadFromDB(tournamentId));
    if (!t) return;

    const busted: number[] = [];

    for (const seat of room.game.state.seats) {
      const userId = seat.userId;
      const stack = Number(seat.stack) || 0;
      const p = t.players.get(userId);
      if (!p || p.status !== 'active') continue;

      p.stack = stack;
      await this.db.query(
        `UPDATE tournament_players SET stack = $1 WHERE tournament_id = $2 AND user_id = $3`,
        [stack, tournamentId, userId],
      );

      if (stack <= 0) busted.push(userId);
    }

    // Determine killer
    let killerUserId: number | undefined;
    if (handResult && Array.isArray(handResult.winners) && handResult.winners.length > 0) {
      const winnerSeat = handResult.winners[0];
      const winnerSeatObj = room.game.state.seats[winnerSeat];
      if (winnerSeatObj) killerUserId = winnerSeatObj.userId;
    }

    for (const userId of busted) {
      const killer = killerUserId && killerUserId !== userId ? killerUserId : undefined;
      await this.eliminatePlayer(tournamentId, userId, killer);

      if (t.config.isBounty && t.config.bountyAmount > 0 && killer) {
        const killerPlayer = t.players.get(killer);
        if (
          killerPlayer &&
          (killerPlayer.status === 'active' || killerPlayer.status === 'winner')
        ) {
          const bounty = t.config.bountyAmount;
          const newStack = Math.round((killerPlayer.stack + bounty) * 100) / 100;
          killerPlayer.stack = newStack;

          await this.db.query(
            `UPDATE tournament_players
             SET stack = $1, bounty_earned = bounty_earned + $2
             WHERE tournament_id = $3 AND user_id = $4`,
            [newStack, bounty, tournamentId, killer],
          );

          const killerSeatIdx = room.game.state.seats.findIndex(
            (s: any) => s.userId === killer,
          );
          if (killerSeatIdx >= 0) {
            room.game.state.seats[killerSeatIdx].stack = newStack;
          }

          console.log(
            `[tournament] 💰 bounty: ${killerPlayer.displayName} +$${bounty} (killed user=${userId})`,
          );

          if (this.io) {
            this.io.emit(`tournament:${tournamentId}:bounty`, {
              killerUserId: killer,
              victimUserId: userId,
              amount: bounty,
              newStack,
            });
          }
        }
      }
    }

    if (busted.length > 0) {
      console.log(
        `[tournament] 🔄 synced stacks for #${tournamentId}, eliminated: [${busted.join(',')}]`,
      );
    }
  }
}