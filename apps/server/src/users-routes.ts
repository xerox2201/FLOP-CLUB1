import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';

function isAdmin(req: any): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${ADMIN_SECRET}`;
}

export async function registerUsersRoutes(app: FastifyInstance, db: Pool) {
  // ============================================================
  // LIST USERS (search + filter + pagination)
  // ============================================================
  app.get<{
    Querystring: {
      search?: string;
      filter?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/admin/users', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });

    const search = (req.query.search ?? '').trim();
    const filter = req.query.filter ?? 'all';
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const where: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (search) {
      where.push(`(
        u.display_name ILIKE $${idx}
        OR u.username ILIKE $${idx}
        OR u.telegram_id::text = $${idx + 1}
      )`);
      values.push(`%${search}%`, search);
      idx += 2;
    }

    if (filter === 'banned') where.push(`u.is_banned = TRUE`);
    else if (filter === 'active') where.push(`u.is_banned = FALSE`);
    else if (filter === 'high_risk') where.push(`u.risk_score >= 65`);

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const res = await db.query(
      `SELECT
         u.id, u.telegram_id, u.username, u.display_name,
         u.language, u.country, u.is_banned, u.risk_score,
         u.avatar_id, u.ton_address, u.created_at,
         COALESCE(w.balance_usd, 0) AS balance_usd,
         COALESCE(fc.chips, 0) AS free_chips,
         COALESCE(fc.total_hands, 0) AS total_hands
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN free_chips fc ON fc.user_id = u.id
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset],
    );

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM users u ${whereSql}`,
      values,
    );

    return {
      users: res.rows.map((r) => ({
        id: Number(r.id),
        telegramId: Number(r.telegram_id),
        username: r.username,
        displayName: r.display_name,
        language: r.language,
        country: r.country,
        isBanned: r.is_banned,
        riskScore: r.risk_score,
        avatarId: r.avatar_id,
        tonAddress: r.ton_address,
        createdAt: r.created_at,
        balanceUsd: Number(r.balance_usd),
        freeChips: Number(r.free_chips),
        totalHands: Number(r.total_hands),
      })),
      total: countRes.rows[0].c,
      limit,
      offset,
    };
  });

  // ============================================================
  // GET ONE USER (full details)
  // ============================================================
  app.get<{ Params: { id: string } }>(
    '/api/admin/users/:id',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });

      const res = await db.query(
        `SELECT
           u.*,
           COALESCE(w.balance_usd, 0) AS balance_usd,
           COALESCE(w.locked_usd, 0) AS locked_usd,
           COALESCE(fc.chips, 0) AS free_chips,
           COALESCE(fc.total_hands, 0) AS total_hands,
           pr.score AS risk_score_calculated,
           pr.flags AS risk_flags,
           pr.action_taken AS risk_action
         FROM users u
         LEFT JOIN wallets w ON w.user_id = u.id
         LEFT JOIN free_chips fc ON fc.user_id = u.id
         LEFT JOIN player_risk pr ON pr.user_id = u.id
         WHERE u.id = $1`,
        [id],
      );
      if (res.rows.length === 0) {
        return reply.code(404).send({ error: 'not_found' });
      }

      const r = res.rows[0];

      const txRes = await db.query(
        `SELECT id, kind, amount, currency, status, created_at
         FROM transactions WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [id],
      );

      return {
        user: {
          id: Number(r.id),
          telegramId: Number(r.telegram_id),
          username: r.username,
          displayName: r.display_name,
          language: r.language,
          country: r.country,
          isBanned: r.is_banned,
          riskScore: r.risk_score,
          avatarId: r.avatar_id,
          tonAddress: r.ton_address,
          createdAt: r.created_at,
          balanceUsd: Number(r.balance_usd),
          lockedUsd: Number(r.locked_usd),
          freeChips: Number(r.free_chips),
          totalHands: Number(r.total_hands),
          riskFlags: r.risk_flags || {},
          riskAction: r.risk_action || 'none',
        },
        recentTx: txRes.rows.map((t) => ({
          id: Number(t.id),
          kind: t.kind,
          amount: Number(t.amount),
          currency: t.currency,
          status: t.status,
          createdAt: t.created_at,
        })),
      };
    },
  );

  // ============================================================
  // BAN / UNBAN
  // ============================================================
  app.post<{
    Params: { id: string };
    Body: { ban: boolean; reason?: string };
  }>('/api/admin/users/:id/ban', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const ban = !!req.body?.ban;
    const reason = req.body?.reason ?? 'admin action';

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const uRes = await client.query('SELECT id FROM users WHERE id = $1', [id]);
      if (uRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'not_found' });
      }

      await client.query('UPDATE users SET is_banned = $1 WHERE id = $2', [ban, id]);

      await client.query(
        `INSERT INTO suspicious_events (user_id, type, severity, evidence, resolved)
         VALUES ($1, $2, 10, $3, TRUE)`,
        [id, ban ? 'manual_ban' : 'manual_unban', JSON.stringify({ reason })],
      );

      await client.query(
        `INSERT INTO admin_actions (action, target_type, target_id, payload)
         VALUES ($1, 'user', $2, $3)`,
        [ban ? 'ban_user' : 'unban_user', String(id), JSON.stringify({ reason })],
      );

      await client.query('COMMIT');
      return { ok: true, isBanned: ban };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ============================================================
  // WALLET ADJUST (add or remove USD)
  // ============================================================
  app.post<{
    Params: { id: string };
    Body: { amount: number; reason?: string };
  }>('/api/admin/users/:id/wallet', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const amount = Number(req.body?.amount);
    const reason = req.body?.reason ?? 'admin adjustment';
    if (!Number.isFinite(amount) || amount === 0) {
      return reply.code(400).send({ error: 'invalid_amount' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        'SELECT id FROM users WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'not_found' });
      }

      const sysAcc = await client.query(
        `SELECT id FROM accounts WHERE code = 'SYSTEM_ADMIN_ADJUST'`,
      );
      const userAcc = await client.query(
        `SELECT id FROM accounts WHERE code = $1`,
        [`USER_${id}`],
      );

      if (sysAcc.rows.length === 0 || userAcc.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(500).send({ error: 'accounts_missing' });
      }

      const sysAccId = sysAcc.rows[0].id;
      const userAccId = userAcc.rows[0].id;

      const kind = amount > 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT';
      const txRes = await client.query(
        `INSERT INTO transactions (kind, ref, meta, status, user_id, amount, currency, completed_at)
         VALUES ($1, $2, $3, 'completed', $4, $5, 'USD', NOW())
         RETURNING id`,
        [
          kind,
          `admin_adjust_${id}_${Date.now()}`,
          JSON.stringify({ reason }),
          id,
          Math.abs(amount),
        ],
      );
      const txId = txRes.rows[0].id;

      if (amount > 0) {
        await client.query(
          `INSERT INTO entries (tx_id, account_id, amount, currency)
           VALUES ($1, $2, $3, 'USD'), ($1, $4, $5, 'USD')`,
          [txId, sysAccId, -Math.abs(amount), userAccId, Math.abs(amount)],
        );
      } else {
        await client.query(
          `INSERT INTO entries (tx_id, account_id, amount, currency)
           VALUES ($1, $2, $3, 'USD'), ($1, $4, $5, 'USD')`,
          [txId, userAccId, -Math.abs(amount), sysAccId, Math.abs(amount)],
        );
      }

      await client.query(
        `UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = NOW()
         WHERE user_id = $2`,
        [amount, id],
      );

      await client.query(
        `INSERT INTO admin_actions (action, target_type, target_id, payload)
         VALUES ('adjust_wallet', 'user', $1, $2)`,
        [String(id), JSON.stringify({ amount, reason })],
      );

      await client.query('COMMIT');

      const balRes = await db.query(
        `SELECT balance_usd FROM wallets WHERE user_id = $1`,
        [id],
      );
      return {
        ok: true,
        newBalance: Number(balRes.rows[0]?.balance_usd ?? 0),
        amount,
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ============================================================
  // USER HISTORY (transactions + tournaments)
  // ============================================================
  app.get<{
    Params: { id: string };
    Querystring: { limit?: string };
  }>('/api/admin/users/:id/history', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const [tx, tourneys] = await Promise.all([
      db.query(
        `SELECT id, kind, amount, currency, status, ref, meta, created_at
         FROM transactions WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [id, limit],
      ),
      db.query(
        `SELECT
           te.tournament_id, te.status, te.final_position, te.payout_amount,
           te.points_earned, te.registered_at,
           t.name, t.variant, t.buy_in, t.total_prize_pool, t.started_at, t.finished_at
         FROM tournament_entries te
         JOIN tournaments t ON t.id = te.tournament_id
         WHERE te.user_id = $1
         ORDER BY te.registered_at DESC LIMIT $2`,
        [id, limit],
      ),
    ]);

    return {
      transactions: tx.rows.map((r) => ({
        id: Number(r.id),
        kind: r.kind,
        amount: Number(r.amount),
        currency: r.currency,
        status: r.status,
        ref: r.ref,
        meta: r.meta,
        createdAt: r.created_at,
      })),
      tournaments: tourneys.rows.map((r) => ({
        tournamentId: Number(r.tournament_id),
        name: r.name,
        variant: r.variant,
        buyIn: Number(r.buy_in),
        status: r.status,
        finalPosition: r.final_position,
        payout: Number(r.payout_amount),
        points: Number(r.points_earned),
        prizePool: Number(r.total_prize_pool),
        registeredAt: r.registered_at,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
      })),
    };
  });
}