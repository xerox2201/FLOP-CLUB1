// ============================================================
// WeeklyRaceService - weekly rake race with 3 brackets
// Bronze $100 / Silver $500 / Gold $2000. Prizes are house-funded
// (budget line: Weekly Race = $3 per $100 rake).
// ============================================================

import { Pool } from 'pg';
import { LedgerService } from './ledger.js';

export type RaceBracket = 'bronze' | 'silver' | 'gold';

export interface BracketConfig {
  label: string;
  minRake: number;
  maxRake: number;
  poolUsd: number;
  paidPlaces: number;
  color: string;
}

export const WEEKLY_RACE_BRACKETS: Record<RaceBracket, BracketConfig> = {
  bronze: {
    label: 'Bronze',
    minRake: 0,
    maxRake: 50,
    poolUsd: 100,
    paidPlaces: 20,
    color: '#c98a3e',
  },
  silver: {
    label: 'Silver',
    minRake: 50,
    maxRake: 500,
    poolUsd: 500,
    paidPlaces: 30,
    color: '#cbd5e1',
  },
  gold: {
    label: 'Gold',
    minRake: 500,
    maxRake: Infinity,
    poolUsd: 2000,
    paidPlaces: 50,
    color: '#f4c95d',
  },
};

export const RACE_BRACKET_ORDER: RaceBracket[] = ['bronze', 'silver', 'gold'];

export interface WeeklyStanding {
  userId: number;
  displayName: string;
  avatarId: string;
  totalRake: number;
  rank: number;
  prizeUsd: number;
  paid: boolean;
}

export interface CloseWeekResult {
  bracket: RaceBracket;
  players: number;
  paidPlaces: number;
  poolUsd: number;
  paidUsd: number;
  duplicate?: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Monday (UTC) of the week that `d` falls in, as YYYY-MM-DD.
export function weekStartUtc(d: Date = new Date()): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const daysSinceMonday = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - daysSinceMonday);
  return dt.toISOString().slice(0, 10);
}

export function previousWeekStartUtc(): string {
  return weekStartUtc(new Date(Date.now() - 7 * 86_400_000));
}

export function bracketForRake(rake: number): RaceBracket {
  const r = Math.max(0, Number(rake) || 0);
  if (r >= WEEKLY_RACE_BRACKETS.gold.minRake) return 'gold';
  if (r >= WEEKLY_RACE_BRACKETS.silver.minRake) return 'silver';
  return 'bronze';
}

// Prize curve: linearly decreasing weights across the paid places
// (rank 1 gets `places` shares, rank 2 gets `places - 1`, ...).
// Deterministic, and the rounding remainder goes to rank 1 so the
// amounts always sum to exactly the bracket pool.
export function computePrizes(pool: number, places: number): number[] {
  if (places <= 0) return [];
  const weights: number[] = [];
  for (let i = 0; i < places; i++) weights.push(places - i);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const amounts = weights.map((w) => Math.floor(((pool * w) / weightSum) * 100) / 100);
  const distributed = round2(amounts.reduce((a, b) => a + b, 0));
  const remainder = round2(pool - distributed);
  if (remainder > 0) amounts[0] = round2(amounts[0] + remainder);
  return amounts;
}

export class WeeklyRaceService {
  private ledger: LedgerService;

  constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
  }

  // ============================================================
  // recordRake - add rake to this week's entry, moving the bracket up
  // as the weekly total grows. One row per user per week.
  // ============================================================
  async recordRake(
    userId: number,
    rakeAmount: number,
    weekStart: string = weekStartUtc(),
  ): Promise<void> {
    const amount = round2(Number(rakeAmount) || 0);
    if (!userId || amount <= 0) return;

    const existing = await this.db.query(
      `SELECT id, total_rake FROM weekly_race_entries
       WHERE user_id = $1 AND week_start = $2::date
       ORDER BY id LIMIT 1`,
      [userId, weekStart],
    );

    if (existing.rows.length === 0) {
      await this.db.query(
        `INSERT INTO weekly_race_entries (user_id, week_start, bracket, total_rake)
         VALUES ($1, $2::date, $3, $4)
         ON CONFLICT (user_id, week_start, bracket)
         DO UPDATE SET total_rake = weekly_race_entries.total_rake + EXCLUDED.total_rake,
                       updated_at = NOW()`,
        [userId, weekStart, bracketForRake(amount), amount],
      );
      return;
    }

    const row = existing.rows[0];
    const newTotal = round2(Number(row.total_rake) + amount);
    await this.db.query(
      `UPDATE weekly_race_entries
       SET total_rake = $1, bracket = $2, updated_at = NOW()
       WHERE id = $3`,
      [newTotal, bracketForRake(newTotal), row.id],
    );
  }

  // ============================================================
  // Reads
  // ============================================================
  async getCurrentBracket(
    userId: number,
    weekStart: string = weekStartUtc(),
  ): Promise<RaceBracket> {
    const r = await this.db.query(
      `SELECT total_rake FROM weekly_race_entries
       WHERE user_id = $1 AND week_start = $2::date
       ORDER BY total_rake DESC LIMIT 1`,
      [userId, weekStart],
    );
    return bracketForRake(Number(r.rows[0]?.total_rake ?? 0));
  }

  async getLeaderboard(
    bracket: RaceBracket,
    limit = 50,
    weekStart: string = weekStartUtc(),
  ): Promise<WeeklyStanding[]> {
    const r = await this.db.query(
      `SELECT w.user_id, w.total_rake, w.rank, w.prize_usd, w.paid,
              u.display_name, u.avatar_id
       FROM weekly_race_entries w
       LEFT JOIN users u ON u.id = w.user_id
       WHERE w.week_start = $1::date AND w.bracket = $2
       ORDER BY w.total_rake DESC, w.user_id ASC
       LIMIT $3`,
      [weekStart, bracket, limit],
    );

    return r.rows.map((row: any, i: number) => ({
      userId: Number(row.user_id),
      displayName: row.display_name ?? 'Player',
      avatarId: row.avatar_id ?? 'spade',
      totalRake: Number(row.total_rake),
      rank: Number(row.rank ?? i + 1),
      prizeUsd: Number(row.prize_usd ?? 0),
      paid: row.paid === true,
    }));
  }

  async getMyEntry(
    userId: number,
    weekStart: string = weekStartUtc(),
  ): Promise<{
    bracket: RaceBracket;
    totalRake: number;
    rank: number | null;
    prizeUsd: number;
    paid: boolean;
    bracketSize: number;
  }> {
    const mine = await this.db.query(
      `SELECT bracket, total_rake, rank, prize_usd, paid FROM weekly_race_entries
       WHERE user_id = $1 AND week_start = $2::date
       ORDER BY total_rake DESC LIMIT 1`,
      [userId, weekStart],
    );

    const totalRake = Number(mine.rows[0]?.total_rake ?? 0);
    const bracket = (mine.rows[0]?.bracket as RaceBracket) ?? bracketForRake(totalRake);

    const size = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM weekly_race_entries
       WHERE week_start = $1::date AND bracket = $2`,
      [weekStart, bracket],
    );

    let rank: number | null = mine.rows[0]?.rank != null ? Number(mine.rows[0].rank) : null;
    if (rank === null && totalRake > 0) {
      const live = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM weekly_race_entries
         WHERE week_start = $1::date AND bracket = $2
           AND (total_rake > $3 OR (total_rake = $3 AND user_id < $4))`,
        [weekStart, bracket, totalRake, userId],
      );
      rank = Number(live.rows[0]?.c ?? 0) + 1;
    }

    return {
      bracket,
      totalRake,
      rank,
      prizeUsd: Number(mine.rows[0]?.prize_usd ?? 0),
      paid: mine.rows[0]?.paid === true,
      bracketSize: Number(size.rows[0]?.c ?? 0),
    };
  }

  async getHistory(userId: number, limit = 12): Promise<any[]> {
    const r = await this.db.query(
      `SELECT week_start, bracket, total_rake, rank, prize_usd, paid
       FROM weekly_race_entries
       WHERE user_id = $1
       ORDER BY week_start DESC
       LIMIT $2`,
      [userId, limit],
    );
    return r.rows.map((row: any) => ({
      weekStart: row.week_start,
      bracket: row.bracket,
      totalRake: Number(row.total_rake),
      rank: row.rank != null ? Number(row.rank) : null,
      prizeUsd: Number(row.prize_usd ?? 0),
      paid: row.paid === true,
    }));
  }

  // ============================================================
  // closeWeek - rank the bracket, pay the top N from HOUSE_RAKE
  // Idempotent per (week, bracket) via the ledger idempotency key.
  // ============================================================
  async closeWeek(weekStart: string = previousWeekStartUtc()): Promise<CloseWeekResult[]> {
    const results: CloseWeekResult[] = [];
    const rakeAcc = await this.ledger.getAccountId('HOUSE_RAKE');

    for (const bracket of RACE_BRACKET_ORDER) {
      const cfg = WEEKLY_RACE_BRACKETS[bracket];

      const standings = await this.db.query(
        `SELECT id, user_id, total_rake FROM weekly_race_entries
         WHERE week_start = $1::date AND bracket = $2
         ORDER BY total_rake DESC, user_id ASC`,
        [weekStart, bracket],
      );

      const base: CloseWeekResult = {
        bracket,
        players: standings.rows.length,
        paidPlaces: cfg.paidPlaces,
        poolUsd: cfg.poolUsd,
        paidUsd: 0,
      };

      if (standings.rows.length === 0) {
        results.push(base);
        continue;
      }

      // Rank every participant for the history UI.
      for (let i = 0; i < standings.rows.length; i++) {
        await this.db.query(
          'UPDATE weekly_race_entries SET rank = $1, updated_at = NOW() WHERE id = $2',
          [i + 1, standings.rows[i].id],
        );
      }

      const winners = standings.rows
        .slice(0, cfg.paidPlaces)
        .filter((r: any) => Number(r.total_rake) > 0);

      if (winners.length === 0 || !rakeAcc) {
        results.push(base);
        continue;
      }

      const amounts = computePrizes(cfg.poolUsd, winners.length);

      const entries: { accountId: number; amount: number }[] = [];
      const recipients: { entryId: number; userId: number; amount: number }[] = [];

      for (let i = 0; i < winners.length; i++) {
        const acc = await this.ledger.ensureUserAccount(Number(winners[i].user_id));
        if (!acc || amounts[i] <= 0) continue;
        entries.push({ accountId: acc, amount: amounts[i] });
        recipients.push({
          entryId: Number(winners[i].id),
          userId: Number(winners[i].user_id),
          amount: amounts[i],
        });
      }

      if (recipients.length === 0) {
        results.push(base);
        continue;
      }

      const totalPaid = round2(recipients.reduce((s, r) => s + r.amount, 0));

      const res = await this.ledger.record({
        kind: 'BONUS',
        ref: `weekly_race_${weekStart}_${bracket}`,
        meta: {
          weekStart,
          bracket,
          poolUsd: cfg.poolUsd,
          paidUsd: totalPaid,
          places: recipients.length,
        },
        entries: [{ accountId: rakeAcc, amount: -totalPaid }, ...entries],
        idempotencyKey: `weekly_race_${weekStart}_${bracket}`,
      });

      if (!res.ok) {
        console.error(`[weekly-race] ledger failed for ${bracket}:`, res.error);
        results.push(base);
        continue;
      }

      for (const r of recipients) {
        await this.db.query(
          `UPDATE weekly_race_entries
           SET prize_usd = $1, paid = TRUE, updated_at = NOW()
           WHERE id = $2`,
          [r.amount, r.entryId],
        );
      }

      // Everyone else in the bracket is settled with no prize.
      await this.db.query(
        `UPDATE weekly_race_entries
         SET paid = TRUE, updated_at = NOW()
         WHERE week_start = $1::date AND bracket = $2 AND paid = FALSE`,
        [weekStart, bracket],
      );

      results.push({ ...base, paidUsd: totalPaid, duplicate: res.duplicate === true });
      console.log(
        `[weekly-race] closed ${weekStart} ${bracket}: ${recipients.length} winners, $${totalPaid} paid${res.duplicate ? ' (duplicate)' : ''}`,
      );
    }

    return results;
  }
}
