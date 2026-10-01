import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const p = verifyToken(auth.slice(7), JWT_SECRET);
  return p?.uid ?? null;
}

export async function registerMyMoneyRoutes(app: FastifyInstance, db: Pool) {
  // GET /api/my/money?period=30d|90d|lifetime
  app.get<{ Querystring: { period?: string } }>('/api/my/money', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });

    const period = req.query.period ?? '30d';
    const interval = period === 'lifetime' ? null : period === '90d' ? '90 days' : '30 days';

    const fromClause = interval ? `AND created_at > NOW() - INTERVAL '${interval}'` : '';

    // 1. Total rake contributed by this user (exact from rakeback_log.rake_share)
    const rakeRes = await db.query(
      `SELECT COALESCE(SUM(rake_share), 0)::numeric AS total
       FROM rakeback_log
       WHERE user_id = $1 ${fromClause ? fromClause.replace('created_at', 'created_at') : ''}`,
      [uid],
    );
    const rakePaid = Number(rakeRes.rows[0]?.total ?? 0);

    // 2. Instant rakeback
    const rbRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM rakeback_log
       WHERE user_id = $1 ${fromClause}`,
      [uid],
    );
    const rakebackEarned = Number(rbRes.rows[0]?.total ?? 0);

    // 3. Referral earnings (as referrer)
    const refRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM referral_earnings
       WHERE referrer_id = $1 ${fromClause.replace('created_at', 'paid_at')}`,
      [uid],
    );
    const referralEarned = Number(refRes.rows[0]?.total ?? 0);

    // 4. Vouchers unlocked (used=TRUE) in the period
    const vRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM vouchers
       WHERE user_id = $1 AND used = TRUE
       ${fromClause.replace('created_at', 'used_at')}`,
      [uid],
    );
    const vouchersEarned = Number(vRes.rows[0]?.total ?? 0);

    // 5. Seeds claimed
    const sRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM seeds
       WHERE user_id = $1 AND claimed = TRUE
       ${fromClause.replace('created_at', 'claimed_at')}`,
      [uid],
    );
    const seedsEarned = Number(sRes.rows[0]?.total ?? 0);

    // 6. XP cashout (in USD — 1000 XP = $1)
    const xpRes = await db.query(
      `SELECT COALESCE(SUM(ABS(amount)), 0)::bigint AS total
       FROM xp_transactions
       WHERE user_id = $1 AND source = 'claim'
       ${fromClause}`,
      [uid],
    );
    const xpCashoutUsd = Number(xpRes.rows[0]?.total ?? 0) / 1000;

    // 7. Tournament prizes (from ledger)
    const tRes = await db.query(
      `SELECT COALESCE(SUM(e.amount), 0)::numeric AS total
       FROM entries e
       JOIN accounts a ON a.id = e.account_id
       JOIN transactions t ON t.id = e.tx_id
       WHERE a.owner_user_id = $1
         AND t.kind = 'TOURNAMENT_PRIZE'
         ${fromClause.replace('created_at', 't.created_at')}`,
      [uid],
    );
    const tournamentPrizes = Number(tRes.rows[0]?.total ?? 0);

    // 8. Total winnings at cash tables (from hands)
    const wRes = await db.query(
      `WITH my_hands AS (
         SELECT h.id, h.result, h.winner_seats,
                (SELECT (p->>'seat')::int FROM jsonb_array_elements(hs.state->'players') p
                 WHERE (p->>'userId')::bigint = $1 LIMIT 1) AS my_seat
         FROM hands h
         JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
         WHERE h.finished = TRUE AND h.mode = 'real'
           ${fromClause.replace('created_at', 'h.ended_at')}
           AND EXISTS (SELECT 1 FROM jsonb_array_elements(hs.state->'players') p
                       WHERE (p->>'userId')::bigint = $1)
       )
       SELECT COALESCE(SUM(
         (SELECT COALESCE((sp->>'payout')::numeric, 0)
          FROM jsonb_array_elements(COALESCE(result->'showdownPlayers', '[]'::jsonb)) sp
          WHERE (sp->>'seat')::int = my_seat LIMIT 1)
       ), 0)::numeric AS total
       FROM my_hands`,
      [uid],
    );
    const tableWon = Number(wRes.rows[0]?.total ?? 0);

    // 9. Cashback (part of plan — not yet built, so 0)
    const cashback = 0;

    // Totals
    const totalReturned =
      rakebackEarned + referralEarned + vouchersEarned + seedsEarned + xpCashoutUsd + cashback;

    const breakdown = [
      { key: 'instant_rakeback', label: 'Instant Rakeback', amount: rakebackEarned },
      { key: 'referral', label: 'Referral earnings', amount: referralEarned },
      { key: 'vouchers', label: 'Vouchers unlocked', amount: vouchersEarned },
      { key: 'seeds', label: 'Seeds claimed', amount: seedsEarned },
      { key: 'xp_cashout', label: 'XP cashout', amount: xpCashoutUsd },
      { key: 'cashback', label: 'Cashback', amount: cashback },
    ];

    const platformKept = Math.max(0, rakePaid - totalReturned);

    return {
      period,
      rakePaid,
      totalReturned,
      returnPct: rakePaid > 0 ? totalReturned / rakePaid : 0,
      breakdown,
      platformKept,
      platformKeptPct: rakePaid > 0 ? platformKept / rakePaid : 0,
      tableWon,
      tournamentPrizes,
      // Meta explanation (shown in UI)
      note: 'Returns include rakeback, referral, vouchers, seeds, and XP cashout. Table winnings are separate from rake.',
    };
  });
}
