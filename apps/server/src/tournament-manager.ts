import { Pool } from 'pg';
import { LedgerService } from './ledger.js';
import { BlindStructureService } from './blind-structures.js';
import { gameManager } from './game-manager.js';

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
}

export class TournamentManager {
  private ledger: LedgerService;
  private blindService: BlindStructureService;
  private tournaments: Map<number, Tournament> = new Map();
  private io: any = null;

  constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
    this.blindService = new BlindStructureService(db);
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
          min_players, max_players, guaranteed, scheduled_start, late_reg_min,
          blind_structure_id, status, is_private, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        config.name, config.variant, config.mode, config.format, config.speed,
        config.buyIn, config.fee, config.startingStack,
        config.minPlayers, config.maxPlayers, config.guaranteed,
        config.scheduledStart || null, config.lateRegMin,
        config.blindStructureId, status, config.isPrivate, config.createdBy,
      ]
    );

    const tournamentId = res.rows[0].id;
    await this.setupPayoutStructure(tournamentId, config.maxPlayers);

    console.log(`[tournament] ✅ created #${tournamentId} "${config.name}" status=${status}`);
    return tournamentId;
  }

  private async setupPayoutStructure(tournamentId: number, maxPlayers: number): Promise<void> {
    let structure: Array<{ position: number; percentage: number }> = [];

    if (maxPlayers <= 9) {
      structure = [
        { position: 1, percentage: 0.50 },
        { position: 2, percentage: 0.30 },
        { position: 3, percentage: 0.20 },
      ];
    } else if (maxPlayers <= 18) {
      structure = [
        { position: 1, percentage: 0.40 },
        { position: 2, percentage: 0.25 },
        { position: 3, percentage: 0.15 },
        { position: 4, percentage: 0.10 },
        { position: 5, percentage: 0.06 },
        { position: 6, percentage: 0.04 },
      ];
    } else if (maxPlayers <= 45) {
      structure = [
        { position: 1, percentage: 0.30 },
        { position: 2, percentage: 0.20 },
        { position: 3, percentage: 0.13 },
        { position: 4, percentage: 0.09 },
        { position: 5, percentage: 0.07 },
        { position: 6, percentage: 0.06 },
        { position: 7, percentage: 0.05 },
        { position: 8, percentage: 0.04 },
        { position: 9, percentage: 0.03 },
        { position: 10, percentage: 0.03 },
      ];
    } else {
      structure = [
        { position: 1, percentage: 0.22 },
        { position: 2, percentage: 0.15 },
        { position: 3, percentage: 0.10 },
        { position: 4, percentage: 0.08 },
        { position: 5, percentage: 0.06 },
        { position: 6, percentage: 0.05 },
        { position: 7, percentage: 0.04 },
        { position: 8, percentage: 0.035 },
        { position: 9, percentage: 0.03 },
        { position: 10, percentage: 0.025 },
        { position: 11, percentage: 0.02 },
        { position: 12, percentage: 0.02 },
        { position: 13, percentage: 0.015 },
        { position: 14, percentage: 0.015 },
        { position: 15, percentage: 0.015 },
      ];
    }

    for (const s of structure) {
      await this.db.query(
        `INSERT INTO tournament_payouts (tournament_id, position, percentage)
         VALUES ($1, $2, $3)
         ON CONFLICT (tournament_id, position) DO NOTHING`,
        [tournamentId, s.position, s.percentage]
      );
    }
  }

  // ============================================================
  // REGISTER
  // ============================================================
  async register(tournamentId: number, userId: number): Promise<{ ok: boolean; error?: string }> {
    const t = await this.loadFromDB(tournamentId);
    if (!t) return { ok: false, error: 'tournament_not_found' };

    if (t.status !== 'registering' && t.status !== 'scheduled') {
      return { ok: false, error: 'registration_closed' };
    }

    const playerCount = await this.getPlayerCount(tournamentId);
    if (playerCount >= t.config.maxPlayers) {
      return { ok: false, error: 'tournament_full' };
    }

    const existing = await this.db.query(
      'SELECT id, status FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2',
      [tournamentId, userId]
    );
    if (existing.rows.length > 0 && existing.rows[0].status !== 'refunded') {
      return { ok: false, error: 'already_registered' };
    }

    if (t.config.mode === 'real' && (t.config.buyIn > 0 || t.config.fee > 0)) {
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
        idempotencyKey: `tourney_entry_${tournamentId}_${userId}`,
      });

      if (!ledgerResult.ok) {
        return { ok: false, error: ledgerResult.error || 'payment_failed' };
      }
    }

    await this.db.query(
      `INSERT INTO tournament_entries
         (tournament_id, user_id, status, starting_stack)
       VALUES ($1, $2, 'registered', $3)
       ON CONFLICT (tournament_id, user_id) DO UPDATE SET status = 'registered'`,
      [tournamentId, userId, t.config.startingStack]
    );

    console.log(`[tournament] ✅ user=${userId} registered for #${tournamentId}`);
    return { ok: true };
  }

  // ============================================================
  // UNREGISTER
  // ============================================================
  async unregister(tournamentId: number, userId: number): Promise<{ ok: boolean; error?: string }> {
    const t = await this.loadFromDB(tournamentId);
    if (!t) return { ok: false, error: 'tournament_not_found' };

    if (t.status === 'running' || t.status === 'final_table') {
      return { ok: false, error: 'tournament_running' };
    }

    const entry = await this.db.query(
      'SELECT id, status FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2',
      [tournamentId, userId]
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
      [tournamentId, userId]
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
      [tournamentId]
    );

    if (entries.rows.length < t.config.minPlayers) {
      return { ok: false, error: 'not_enough_players' };
    }

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
      [prizePool, totalFee, entries.rows.length, tournamentId]
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
        [tournamentId, tableNumber, tableSize]
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
        [tournamentId, p.user_id, t.config.startingStack, tableNumber, seatIdx]
      );

      await this.db.query(
        `UPDATE tournament_entries SET status = 'playing' WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, p.user_id]
      );
    }

    const level1 = await this.blindService.getLevel(t.config.blindStructureId, 1);
    if (level1) {
      await this.db.query(
        `INSERT INTO tournament_level_log (tournament_id, level, sb, bb, ante, players_remaining)
         VALUES ($1, 1, $2, $3, $4, $5)
         ON CONFLICT (tournament_id, level) DO NOTHING`,
        [tournamentId, level1.sb, level1.bb, level1.ante, players.length]
      );
    }

    // Create game rooms
    await this.createGameRooms(tournamentId, t);

    this.startBlindTimer(tournamentId);

    console.log(`[tournament] ✅ #${tournamentId} started with ${players.length} players, ${numTables} tables`);
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
        .map(userId => {
          const p = t.players.get(userId);
          return {
            userId,
            displayName: p?.displayName || `Player ${userId}`,
            stack: p?.stack ?? t.config.startingStack,
          };
        })
        .filter(p => p.stack > 0);

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

  private startBlindTimer(tournamentId: number): void {
    const t = this.tournaments.get(tournamentId);
    if (!t) return;

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
    if (!t || t.status !== 'running') return;

    t.currentLevel += 1;
    t.levelStartedAt = Date.now();

    await this.db.query(
      `UPDATE tournaments SET current_level = $1, level_started_at = NOW() WHERE id = $2`,
      [t.currentLevel, tournamentId]
    );

    const level = await this.blindService.getLevel(t.config.blindStructureId, t.currentLevel);
    if (level) {
      const activeCount = [...t.players.values()].filter(p => p.status === 'active').length;
      await this.db.query(
        `INSERT INTO tournament_level_log (tournament_id, level, sb, bb, ante, players_remaining)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tournament_id, level) DO NOTHING`,
        [tournamentId, t.currentLevel, level.sb, level.bb, level.ante, activeCount]
      );

      // Update blinds in game rooms
      gameManager.updateRoomBlinds(tournamentId, level.sb, level.bb, level.ante);

      if (this.io) {
        this.io.emit(`tournament:${tournamentId}:level`, {
          level: t.currentLevel,
          sb: level.sb, bb: level.bb, ante: level.ante,
          isBreak: level.isBreak,
        });
      }
    }

    this.startBlindTimer(tournamentId);
  }

  // ============================================================
  // LIST / GET
  // ============================================================
  async list(filter: { status?: string; variant?: string; mode?: string; limit?: number } = {}): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filter.status);
    } else {
      conditions.push(`status IN ('scheduled', 'registering', 'running', 'final_table')`);
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
         CASE status WHEN 'running' THEN 0 WHEN 'final_table' THEN 1 WHEN 'registering' THEN 2 WHEN 'scheduled' THEN 3 ELSE 4 END,
         scheduled_start ASC NULLS LAST,
         id DESC
       LIMIT $${idx}`,
      params
    );

    return res.rows.map(r => this.serializeRow(r));
  }

  async get(tournamentId: number): Promise<any | null> {
    const res = await this.db.query(
      `SELECT t.*,
         (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = t.id AND status = 'registered') AS registered_count,
         (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = t.id AND status = 'active') AS active_count
       FROM tournaments t WHERE id = $1`,
      [tournamentId]
    );
    if (res.rows.length === 0) return null;

    const base = this.serializeRow(res.rows[0]);
    const players = await this.db.query(
      `SELECT tp.user_id, u.display_name, tp.stack, tp.table_number, tp.seat, tp.status, tp.final_position
       FROM tournament_players tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.tournament_id = $1
       ORDER BY tp.stack DESC`,
      [tournamentId]
    );

    const payouts = await this.db.query(
      `SELECT position, percentage, fixed_amount FROM tournament_payouts
       WHERE tournament_id = $1 ORDER BY position ASC`,
      [tournamentId]
    );

    return {
      ...base,
      players: players.rows.map(p => ({
        userId: p.user_id,
        displayName: p.display_name,
        stack: Number(p.stack),
        tableNumber: p.table_number,
        seat: p.seat,
        status: p.status,
        finalPosition: p.final_position,
        virtualTableId: p.table_number != null
          ? (1_000_000 + tournamentId * 1000 + p.table_number)
          : null,
      })),
      payouts: payouts.rows.map(p => ({
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
      [tournamentId]
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
        'SELECT * FROM tournament_players WHERE tournament_id = $1',
        [tournamentId]
      );
      for (const p of players.rows) {
        t.players.set(p.user_id, {
          userId: p.user_id,
          displayName: '',
          stack: Number(p.stack),
          tableNumber: p.table_number,
          seat: p.seat,
          status: p.status,
          finalPosition: p.final_position,
        });
      }

      const tables = await this.db.query(
        'SELECT * FROM tournament_tables WHERE tournament_id = $1 AND status = $2',
        [tournamentId, 'active']
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
  // D3: ELIMINATION
  // ============================================================
  async eliminatePlayer(
    tournamentId: number,
    userId: number,
    eliminatedBy?: number
  ): Promise<{ ok: boolean; finalPosition?: number; finished?: boolean }> {
    const t = this.tournaments.get(tournamentId) ?? await this.loadFromDB(tournamentId);
    if (!t) return { ok: false };

    const player = t.players.get(userId);
    if (!player || player.status !== 'active') return { ok: false };

    const activeCount = [...t.players.values()].filter(p => p.status === 'active').length;
    const finalPosition = activeCount;

    player.status = 'eliminated';
    player.eliminatedAt = new Date();
    player.finalPosition = finalPosition;

    await this.db.query(
      `UPDATE tournament_players
       SET status = 'eliminated', eliminated_at = NOW(), final_position = $1, eliminated_by = $2
       WHERE tournament_id = $3 AND user_id = $4`,
      [finalPosition, eliminatedBy ?? null, tournamentId, userId]
    );

    await this.db.query(
      `UPDATE tournament_entries
       SET status = 'eliminated', final_position = $1
       WHERE tournament_id = $2 AND user_id = $3`,
      [finalPosition, tournamentId, userId]
    );

    console.log(`[tournament] 💀 user=${userId} eliminated at position ${finalPosition}`);

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:elimination`, {
        userId,
        finalPosition,
        remaining: activeCount - 1,
      });
    }

    const remaining = [...t.players.values()].filter(p => p.status === 'active');
    if (remaining.length === 1) {
      const winner = remaining[0];
      winner.status = 'winner';
      winner.finalPosition = 1;
      await this.db.query(
        `UPDATE tournament_players SET status = 'winner', final_position = 1
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, winner.userId]
      );
      await this.db.query(
        `UPDATE tournament_entries SET status = 'won', final_position = 1
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, winner.userId]
      );
      await this.finishTournament(tournamentId);
      return { ok: true, finalPosition, finished: true };
    }

    await this.checkAndConsolidate(tournamentId);
    await this.rebalanceIfNeeded(tournamentId);

    return { ok: true, finalPosition, finished: false };
  }

  // ============================================================
  // D3: TABLE BALANCING
  // ============================================================
  private async rebalanceIfNeeded(tournamentId: number): Promise<void> {
    const t = this.tournaments.get(tournamentId);
    if (!t || t.status !== 'running') return;

    const tables = [...t.tables.values()];
    const counts = tables.map(tbl => ({
      tableNumber: tbl.tableNumber,
      count: tbl.seats.filter(s => {
        if (s === null) return false;
        const p = t.players.get(s);
        return p?.status === 'active';
      }).length,
    }));

    if (counts.length < 2) return;

    const maxCount = Math.max(...counts.map(c => c.count));
    const minCount = Math.min(...counts.map(c => c.count));

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

    const emptySeat = targetTable.seats.findIndex(s => s === null);
    if (emptySeat < 0) return;

    targetTable.seats[emptySeat] = moveUserId;
    const moved = t.players.get(moveUserId)!;
    moved.tableNumber = target.tableNumber;
    moved.seat = emptySeat;

    await this.db.query(
      `UPDATE tournament_players SET table_number = $1, seat = $2
       WHERE tournament_id = $3 AND user_id = $4`,
      [target.tableNumber, emptySeat, tournamentId, moveUserId]
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
  // D3: FINAL TABLE
  // ============================================================
  private async checkAndConsolidate(tournamentId: number): Promise<void> {
    const t = this.tournaments.get(tournamentId);
    if (!t || t.status !== 'running') return;

    const activePlayers = [...t.players.values()].filter(p => p.status === 'active');
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
          [finalTableNumber, i, tournamentId, p.userId]
        );
      }

      await this.db.query(
        `UPDATE tournament_tables SET status = 'closed' WHERE tournament_id = $1`,
        [tournamentId]
      );
      await this.db.query(
        `INSERT INTO tournament_tables (tournament_id, table_number, max_seats, status, is_final)
         VALUES ($1, $2, $3, 'active', TRUE)`,
        [tournamentId, finalTableNumber, finalTableSize]
      );

      t.status = 'final_table';
      await this.db.query(
        `UPDATE tournaments SET status = 'final_table' WHERE id = $1`,
        [tournamentId]
      );

      if (this.io) {
        this.io.emit(`tournament:${tournamentId}:final_table`, {
          players: activePlayers.map(p => ({ userId: p.userId, stack: p.stack })),
          tableNumber: finalTableNumber,
        });
      }
    }
  }

  // ============================================================
  // D4: FINISH + PAYOUTS
  // ============================================================
  private async finishTournament(tournamentId: number): Promise<void> {
    const t = this.tournaments.get(tournamentId);
    if (!t) return;

    console.log(`[tournament] 🏁 finishing #${tournamentId}`);

    const payoutsRes = await this.db.query(
      `SELECT position, percentage FROM tournament_payouts
       WHERE tournament_id = $1 ORDER BY position ASC`,
      [tournamentId]
    );

    const totalPrize = t.totalPrizePool;

    for (const po of payoutsRes.rows) {
      const position = po.position;
      const percentage = Number(po.percentage);

      const winner = [...t.players.values()].find(p => p.finalPosition === position);
      if (!winner) continue;

      const amount = Math.round(totalPrize * percentage * 100) / 100;
      if (amount <= 0) continue;

      const prizeAcc = await this.ledger.getAccountId('SYSTEM_TOURNAMENT_PRIZE');
      const userAcc = await this.ledger.getUserAccountId(winner.userId);
      if (!prizeAcc || !userAcc) continue;

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
        await this.db.query(
          `UPDATE tournament_entries SET status = 'cashed', payout_amount = $1
           WHERE tournament_id = $2 AND user_id = $3`,
          [amount, tournamentId, winner.userId]
        );
        console.log(`[tournament] 💰 prize pos=${position} user=${winner.userId} $${amount}`);
      }
    }

    const winner = [...t.players.values()].find(p => p.finalPosition === 1);
    t.status = 'finished';
    t.finishedAt = Date.now();

    await this.db.query(
      `UPDATE tournaments
       SET status = 'finished', finished_at = NOW(), winner_user_id = $1
       WHERE id = $2`,
      [winner?.userId ?? null, tournamentId]
    );

    if (t.levelTimer) {
      clearTimeout(t.levelTimer);
      t.levelTimer = null;
    }

    if (this.io) {
      this.io.emit(`tournament:${tournamentId}:finished`, {
        winner: winner?.userId,
        prizePool: totalPrize,
      });
    }

    console.log(`[tournament] ✅ #${tournamentId} finished, winner=${winner?.userId}`);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  async handlePlayerBust(
    tournamentId: number,
    userId: number,
    eliminatedBy?: number
  ): Promise<{ ok: boolean; finalPosition?: number; finished?: boolean }> {
    return this.eliminatePlayer(tournamentId, userId, eliminatedBy);
  }

  async checkBustedPlayers(tournamentId: number, currentStacks: Map<number, number>): Promise<void> {
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
          [stack, tournamentId, userId]
        );
      }
    }
  }

  // ============================================================
  // Called by game-manager after each hand
  // ============================================================
  async syncStacksAndEliminate(tournamentId: number, room: any): Promise<void> {
    const t = this.tournaments.get(tournamentId) ?? await this.loadFromDB(tournamentId);
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
        [stack, tournamentId, userId]
      );

      if (stack <= 0) busted.push(userId);
    }

    for (const userId of busted) {
      await this.eliminatePlayer(tournamentId, userId);
    }

    if (busted.length > 0) {
      console.log(
        `[tournament] 🔄 synced stacks for #${tournamentId}, eliminated: [${busted.join(',')}]`
      );
    }
  }
}