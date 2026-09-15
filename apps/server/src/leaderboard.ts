import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const PRIZE_DISTRIBUTION = [
  { from: 1, to: 1, pct: 0.21 },
  { from: 2, to: 2, pct: 0.12 },
  { from: 3, to: 3, pct: 0.08 },
  { from: 4, to: 4, pct: 0.06 },
  { from: 5, to: 5, pct: 0.05 },
  { from: 6, to: 10, pct: 0.04 },
  { from: 11, to: 15, pct: 0.025 },
  { from: 16, to: 20, pct: 0.015 },
  { from: 21, to: 25, pct: 0.01 },
  { from: 26, to: 30, pct: 0.006 },
];
const PRIZE_POOL_PCT = 0.1;
const MAX_PRIZE_PCT = 0.15;

export function calculatePrize(rank: number, pool: number): number {
  const tier = PRIZE_DISTRIBUTION.find((t) => rank >= t.from && rank <= t.to);
  if (!tier) return 0;
  return Math.round(pool * tier.pct * 100) / 100;
}

export async function ensureOpenPeriod(db: Pool): Promise<number> {
  const existing = await db.query(
    `SELECT id FROM leaderboard_periods
     WHERE status = 'open' AND NOW() BETWEEN period_start AND period_end
     ORDER BY period_start DESC LIMIT 1`,
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const inserted = await db.query(
    `INSERT INTO leaderboard_periods (period_start, period_end, prize_pool_usd, status)
     VALUES (
       date_trunc('month', NOW())::date,
       (date_trunc('month', NOW()) + INTERVAL '1 month - 1 day')::date,
       0, 'open'
     ) RETURNING id`,
  );
  return inserted.rows[0].id;
}

export async function calculateLivePrizePool(
  db: Pool,
  periodId: number,
): Promise<{ totalRake: number; prizePool: number }> {
  const period = await db.query(
    'SELECT period_start, period_end FROM leaderboard_periods WHERE id = $1',
    [periodId],
  );
  if (period.rows.length === 0) return { totalRake: 0, prizePool: 0 };
  const { period_start, period_end } = period.rows[0];
  const rakeRes = await db.query(
    `SELECT COALESCE(SUM(rake_total), 0) as total FROM revenue_daily WHERE date BETWEEN $1 AND $2`,
    [period_start, period_end],
  );
  const totalRake = Number(rakeRes.rows[0].total) || 0;
  return { totalRake, prizePool: Math.round(totalRake * PRIZE_POOL_PCT * 100) / 100 };
}

export async function recordLeaderboardEntry(
  db: Pool,
  userId: number,
  wonAmount: number,
  handsPlayed = 1,
): Promise<void> {
  try {
    const periodId = await ensureOpenPeriod(db);
    await db.query(
      `INSERT INTO leaderboard_entries (period_id, user_id, hands_played, total_won_usd)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (period_id, user_id) DO UPDATE
       SET hands_played = leaderboard_entries.hands_played + $3,
           total_won_usd = leaderboard_entries.total_won_usd + $4`,
      [periodId, userId, handsPlayed, wonAmount],
    );
  } catch (e) {
    console.error('[leaderboard] record error', e);
  }
}

export async function recalcRanks(db: Pool, periodId: number): Promise<void> {
  try {
    await db.query(
      `WITH ranked AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY total_won_usd DESC, hands_played DESC) as new_rank
         FROM leaderboard_entries WHERE period_id = $1
       )
       UPDATE leaderboard_entries le SET rank = ranked.new_rank FROM ranked WHERE le.id = ranked.id`,
      [periodId],
    );
  } catch (e) {
    console.error('[leaderboard] recalc error', e);
  }
}

export async function registerLeaderboardRoutes(app: FastifyInstance, db: Pool) {
  app.get('/api/leaderboard/periods', async () => {
    const res = await db.query(
      `SELECT id, period_start, period_end, prize_pool_usd, status
       FROM leaderboard_periods ORDER BY period_start DESC LIMIT 12`,
    );
    return { periods: res.rows };
  });

  app.get('/api/leaderboard/current', async () => {
    const periodId = await ensureOpenPeriod(db);
    const period = await db.query('SELECT * FROM leaderboard_periods WHERE id = $1', [periodId]);
    const entries = await db.query(
      `SELECT le.rank, le.hands_played, le.total_won_usd, le.prize_usd,
              u.id as user_id, u.display_name, u.avatar_id
       FROM leaderboard_entries le
       JOIN users u ON u.id = le.user_id
       WHERE le.period_id = $1
       ORDER BY le.total_won_usd DESC, le.hands_played DESC LIMIT 30`,
      [periodId],
    );
    const live = await calculateLivePrizePool(db, periodId);
    return {
      period: { ...period.rows[0], prize_pool_usd: live.prizePool },
      livePrizePool: live.prizePool,
      liveTotalRake: live.totalRake,
      entries: entries.rows,
    };
  });

  app.get('/api/leaderboard/me', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'no token' });
    const payload = verifyToken(auth.slice(7), JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'invalid token' });
    const periodId = await ensureOpenPeriod(db);
    const entry = await db.query(
      `SELECT * FROM leaderboard_entries WHERE period_id = $1 AND user_id = $2`,
      [periodId, payload.uid],
    );
    const rankRes = await db.query(
      `SELECT COUNT(*) + 1 as rank FROM leaderboard_entries
       WHERE period_id = $1
         AND (total_won_usd > COALESCE((SELECT total_won_usd FROM leaderboard_entries WHERE period_id = $1 AND user_id = $2), 0)
              OR (total_won_usd = COALESCE((SELECT total_won_usd FROM leaderboard_entries WHERE period_id = $1 AND user_id = $2), 0)
                  AND hands_played > COALESCE((SELECT hands_played FROM leaderboard_entries WHERE period_id = $1 AND user_id = $2), 0)))`,
      [periodId, payload.uid],
    );
    return { entry: entry.rows[0] ?? null, liveRank: Number(rankRes.rows[0].rank) };
  });
}
