import { Pool } from 'pg';

export interface FreerollConfig {
  id: number;
  enabled: boolean;
  schedule_hour_utc: number;
  schedule_minute_utc: number;
  min_players: number;
  max_players: number;
  min_deposit_usd: string;
  starting_stack: string;
  speed: string;
  variant: string;
  blind_structure_id: number | null;
  min_prize_usd: string;
  launch_grace_until: string | null;
  grace_min_prize_usd: string;
  updated_at: string;
}

export class FreerollService {
  constructor(private db: Pool) {}

  async getConfig(): Promise<FreerollConfig> {
    const r = await this.db.query('SELECT * FROM freeroll_config WHERE id = 1');
    return r.rows[0];
  }

  async updateConfig(patch: Partial<FreerollConfig>): Promise<FreerollConfig> {
    const allowed = [
      'enabled',
      'schedule_hour_utc',
      'schedule_minute_utc',
      'min_players',
      'max_players',
      'min_deposit_usd',
      'starting_stack',
      'speed',
      'variant',
      'blind_structure_id',
      'min_prize_usd',
      'launch_grace_until',
      'grace_min_prize_usd',
    ];
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const k of allowed) {
      if (patch[k as keyof FreerollConfig] !== undefined) {
        sets.push(`${k} = $${i++}`);
        vals.push(patch[k as keyof FreerollConfig]);
      }
    }
    if (sets.length === 0) return this.getConfig();
    sets.push(`updated_at = NOW()`);
    const q = `UPDATE freeroll_config SET ${sets.join(', ')} WHERE id = 1 RETURNING *`;
    const r = await this.db.query(q, vals);
    return r.rows[0];
  }

  async calculateNetRevenueUsd(fromUtc: Date, toUtc: Date): Promise<number> {
    // Revenue: house rake
    const rake = await this.db.query(
      `SELECT COALESCE(SUM(e.amount), 0)::numeric AS total
       FROM entries e
       JOIN accounts a ON a.id = e.account_id
       JOIN transactions t ON t.id = e.tx_id
       WHERE a.code = 'HOUSE_RAKE'
         AND t.created_at >= $1 AND t.created_at < $2`,
      [fromUtc, toUtc],
    );
    const rakeTotal = Number(rake.rows[0]?.total ?? 0);

    // Costs
    const rb = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM rakeback_log WHERE created_at >= $1 AND created_at < $2`,
      [fromUtc, toUtc],
    );
    const rakeback = Number(rb.rows[0]?.total ?? 0);

    const vc = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM vouchers WHERE used = TRUE AND used_at >= $1 AND used_at < $2`,
      [fromUtc, toUtc],
    );
    const vouchers = Number(vc.rows[0]?.total ?? 0);

    const sd = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM seeds WHERE claimed = TRUE AND claimed_at >= $1 AND claimed_at < $2`,
      [fromUtc, toUtc],
    );
    const seeds = Number(sd.rows[0]?.total ?? 0);

    const xp = await this.db.query(
      `SELECT COALESCE(SUM(ABS(amount)), 0)::numeric AS total
       FROM xp_transactions
       WHERE source = 'claim' AND created_at >= $1 AND created_at < $2`,
      [fromUtc, toUtc],
    );
    const xpCashoutUsd = Number(xp.rows[0]?.total ?? 0) / 1000;

    const fr = await this.db.query(
      `SELECT COALESCE(SUM(prize_usd), 0)::numeric AS total
       FROM freeroll_history
       WHERE scheduled_start >= $1 AND scheduled_start < $2
         AND status != 'cancelled'`,
      [fromUtc, toUtc],
    );
    const freerolls = Number(fr.rows[0]?.total ?? 0);

    return rakeTotal - rakeback - vouchers - seeds - xpCashoutUsd - freerolls;
  }

  async hasUpcomingFreeroll(): Promise<boolean> {
    const r = await this.db.query(
      `SELECT 1 FROM tournaments
       WHERE format = 'freeroll'
         AND name LIKE 'Daily Freeroll%'
         AND status IN ('scheduled', 'registering')
         AND scheduled_start > NOW() - INTERVAL '1 hour'
       LIMIT 1`,
    );
    return r.rows.length > 0;
  }

  async createDailyFreeroll(scheduledStart: Date): Promise<number | null> {
    const cfg = await this.getConfig();
    if (!cfg.enabled) return null;

    // Net revenue for last 24h
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const net = await this.calculateNetRevenueUsd(from, to);

    // Determine effective min prize (launch grace vs normal)
    const now = new Date();
    const graceUntil = cfg.launch_grace_until ? new Date(cfg.launch_grace_until) : new Date(0);
    const inGrace = now.getTime() < graceUntil.getTime();

    const minPrize = inGrace ? Number(cfg.grace_min_prize_usd) : Number(cfg.min_prize_usd);

    // Cap: freeroll prize must not exceed 15% of daily net revenue,
    // and never more than $300 hard ceiling. This protects platform
    // margin while still being generous on good days.
    const cap = Math.min(net * 0.15, 300);

    // Computed prize: max(minPrize, net), then clamped to cap.
    // minPrize is always preserved — even if cap < minPrize,
    // the floor wins so freerolls never go to zero.
    const computedPrize = Math.max(minPrize, Math.ceil(net));
    const prize = Math.max(minPrize, Math.min(computedPrize, cap));

    console.log(
      `[freeroll] net=$${net.toFixed(2)} grace=${inGrace} min=$${minPrize} cap=$${cap.toFixed(2)} -> prize=$${prize}`,
    );

    // Blind structure (Turbo MTT fallback)
    let blindId = cfg.blind_structure_id ? Number(cfg.blind_structure_id) : 0;
    if (!blindId) {
      const b = await this.db.query(
        `SELECT id FROM blind_structures WHERE name = 'Turbo MTT' LIMIT 1`,
      );
      blindId = b.rows[0]?.id ?? 0;
    }
    if (!blindId) {
      console.error('[freeroll] no blind structure found');
      return null;
    }

    const dateStr = scheduledStart.toISOString().slice(0, 10);
    const name = `Daily Freeroll ${dateStr}`;

    const res = await this.db.query(
      `INSERT INTO tournaments
         (name, variant, mode, format, speed, buy_in, fee, starting_stack,
          min_players, max_players, guaranteed, scheduled_start, late_reg_min,
          late_reg_level, blind_structure_id, status, is_private, created_by,
          allow_re_entry, max_re_entries, is_bounty, bounty_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [
        name,
        cfg.variant,
        'real',
        'freeroll',
        cfg.speed,
        0,
        0,
        Number(cfg.starting_stack),
        Number(cfg.min_players),
        Number(cfg.max_players),
        prize,
        scheduledStart,
        0,
        0,
        blindId,
        'registering',
        false,
        1,
        false,
        1,
        false,
        0,
      ],
    );
    const tid = Number(res.rows[0].id);

    await this.db.query(
      `INSERT INTO freeroll_history
         (tournament_id, scheduled_start, prize_usd, net_revenue_usd, status)
       VALUES ($1, $2, $3, $4, 'scheduled')`,
      [tid, scheduledStart, prize, net],
    );

    console.log(
      `[freeroll] 🎁 created #${tid} "${name}" prize=$${prize} start=${scheduledStart.toISOString()}`,
    );
    return tid;
  }

  async getNextFreeroll(): Promise<any | null> {
    const r = await this.db.query(
      `SELECT t.id, t.name, t.scheduled_start, t.guaranteed AS prize_usd,
              t.min_players, t.max_players, t.status,
              (SELECT COUNT(*)::int FROM tournament_entries
               WHERE tournament_id = t.id AND status IN ('registered','playing'))
                AS registered
       FROM tournaments t
       WHERE t.format = 'freeroll'
         AND t.status IN ('scheduled', 'registering', 'running')
         AND t.scheduled_start > NOW() - INTERVAL '2 hours'
       ORDER BY t.scheduled_start ASC
       LIMIT 1`,
    );
    return r.rows[0] ?? null;
  }

  async userEligibility(userId: number): Promise<{
    eligible: boolean;
    lifetimeDepositUsd: number;
    minRequired: number;
  }> {
    const cfg = await this.getConfig();
    const minReq = Number(cfg.min_deposit_usd);

    const r = await this.db.query(
      `SELECT COALESCE(SUM(amount_usd), 0)::numeric AS total
       FROM ton_transactions
       WHERE user_id = $1 AND direction = 'deposit' AND status = 'confirmed'`,
      [userId],
    );
    const total = Number(r.rows[0]?.total ?? 0);

    return {
      eligible: total >= minReq,
      lifetimeDepositUsd: total,
      minRequired: minReq,
    };
  }

  async getHistory(limit = 50): Promise<any[]> {
    const r = await this.db.query(
      `SELECT fh.*, t.name AS tournament_name, t.status AS tournament_status,
              (SELECT COUNT(*)::int FROM tournament_entries
               WHERE tournament_id = fh.tournament_id) AS entries
       FROM freeroll_history fh
       LEFT JOIN tournaments t ON t.id = fh.tournament_id
       ORDER BY fh.scheduled_start DESC
       LIMIT $1`,
      [limit],
    );
    return r.rows;
  }
}
