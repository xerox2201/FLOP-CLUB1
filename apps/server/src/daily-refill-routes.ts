import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { tierForRake, dailyRefillForTier } from './loyalty/definitions.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const p = verifyToken(auth.slice(7), JWT_SECRET);
  return p?.uid ?? null;
}

export async function registerDailyRefillRoutes(app: FastifyInstance, db: Pool) {
  // GET /api/daily-refill/status
  app.get('/api/daily-refill/status', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    const [u, t] = await Promise.all([
      db.query('SELECT last_daily_refill_at FROM users WHERE id=$1', [userId]),
      db.query('SELECT tier, lifetime_rake FROM user_tier WHERE user_id=$1', [userId]),
    ]);
    const last = u.rows[0]?.last_daily_refill_at;
    const tierDef = tierForRake(Number(t.rows[0]?.lifetime_rake ?? 0));
    const refillAmount = dailyRefillForTier(tierDef.name);
    const canClaim =
      !last || Date.now() - new Date(last).getTime() > 22 * 3600 * 1000;
    return {
      tier: tierDef.name,
      tierLabel: tierDef.label,
      tierIcon: tierDef.icon,
      refillAmount,
      canClaim,
      lastClaimAt: last,
      nextAvailableAt: last
        ? new Date(new Date(last).getTime() + 24 * 3600 * 1000).toISOString()
        : null,
    };
  });

  // POST /api/daily-refill/claim
  app.post('/api/daily-refill/claim', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const u = await client.query(
        'SELECT last_daily_refill_at FROM users WHERE id=$1 FOR UPDATE',
        [userId],
      );
      const last = u.rows[0]?.last_daily_refill_at;
      if (last && Date.now() - new Date(last).getTime() < 22 * 3600 * 1000) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'already_claimed_today' });
      }
      const t = await client.query(
        'SELECT lifetime_rake FROM user_tier WHERE user_id=$1',
        [userId],
      );
      const tierDef = tierForRake(Number(t.rows[0]?.lifetime_rake ?? 0));
      const amount = dailyRefillForTier(tierDef.name);

      await client.query(
        `INSERT INTO free_chips (user_id, chips) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET chips = free_chips.chips + $2`,
        [userId, amount],
      );
      await client.query(
        `INSERT INTO play_money_log (user_id, delta, reason, balance_after)
         VALUES ($1, $2, 'daily_refill',
           (SELECT chips FROM free_chips WHERE user_id = $1))`,
        [userId, amount],
      );
      await client.query(
        'UPDATE users SET last_daily_refill_at = NOW() WHERE id = $1',
        [userId],
      );
      await client.query('COMMIT');
      return { ok: true, amount, tier: tierDef.name };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });
}