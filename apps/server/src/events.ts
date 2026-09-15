import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  return payload?.uid ?? null;
}

function isAdmin(req: any): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${ADMIN_SECRET}`;
}

async function logEvent(db: Pool, eventId: number, type: string, message: string, meta: any = {}) {
  try {
    await db.query(
      `INSERT INTO event_logs (event_id, type, message, meta) VALUES ($1, $2, $3, $4)`,
      [eventId, type, message, JSON.stringify(meta)],
    );
  } catch (e) {}
}

export async function registerEventsRoutes(app: FastifyInstance, db: Pool) {
  app.get('/api/events', async () => {
    const res = await db.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as registered_count
       FROM events e
       WHERE e.status IN ('scheduled', 'registering', 'running')
         AND e.starts_at > NOW() - INTERVAL '1 day'
       ORDER BY
         CASE e.status WHEN 'running' THEN 1 WHEN 'registering' THEN 2 WHEN 'scheduled' THEN 3 ELSE 4 END,
         e.starts_at ASC`,
    );
    return { events: res.rows };
  });

  app.get<{ Params: { id: string } }>('/api/events/:id', async (req, reply) => {
    const { id } = req.params;
    const evRes = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (evRes.rows.length === 0) return reply.code(404).send({ error: 'event_not_found' });
    const regs = await db.query(
      `SELECT er.user_id, u.display_name, u.avatar_id, er.registered_at
       FROM event_registrations er
       JOIN users u ON u.id = er.user_id
       WHERE er.event_id = $1 ORDER BY er.registered_at ASC LIMIT 200`,
      [id],
    );
    const results = await db.query(
      `SELECT tr.*, u.display_name, u.avatar_id
       FROM tournament_results tr
       JOIN users u ON u.id = tr.user_id
       WHERE tr.event_id = $1 ORDER BY tr.rank ASC LIMIT 100`,
      [id],
    );
    return { event: evRes.rows[0], registrations: regs.rows, results: results.rows };
  });

  app.post<{ Params: { id: string } }>('/api/events/:id/register', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params;
    const evRes = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (evRes.rows.length === 0) return reply.code(404).send({ error: 'event_not_found' });
    const ev = evRes.rows[0];
    if (!['scheduled', 'registering'].includes(ev.status))
      return reply.code(400).send({ error: 'event_not_open' });
    const cntRes = await db.query(
      'SELECT COUNT(*) as c FROM event_registrations WHERE event_id = $1',
      [id],
    );
    if (ev.max_players && Number(cntRes.rows[0].c) >= ev.max_players)
      return reply.code(400).send({ error: 'event_full' });
    if (Number(ev.buyin_usd) > 0) {
      const wRes = await db.query('SELECT balance_usd FROM wallets WHERE user_id = $1', [userId]);
      if (wRes.rows.length === 0 || Number(wRes.rows[0].balance_usd) < Number(ev.buyin_usd)) {
        return reply.code(400).send({ error: 'insufficient_balance' });
      }
    }
    try {
      await db.query('INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2)', [
        id,
        userId,
      ]);
      if (Number(ev.buyin_usd) > 0) {
        await db.query('UPDATE wallets SET balance_usd = balance_usd - $1 WHERE user_id = $2', [
          ev.buyin_usd,
          userId,
        ]);
        const toPrize = Number(ev.buyin_usd) * 0.9;
        await db.query(
          `UPDATE events SET prize_pool_collected = COALESCE(prize_pool_collected, 0) + $1 WHERE id = $2`,
          [toPrize, id],
        );
        const rakeAmount = Number(ev.buyin_usd) * 0.1;
        const today = new Date().toISOString().slice(0, 10);
        await db.query(
          `INSERT INTO revenue_daily (date, rake_total) VALUES ($1, $2)
           ON CONFLICT (date) DO UPDATE SET rake_total = revenue_daily.rake_total + $2`,
          [today, rakeAmount],
        );
      }
      await logEvent(db, Number(id), 'register', `User ${userId} registered`, { userId });
      return { ok: true };
    } catch (e: any) {
      if (e.code === '23505') return { ok: true, already: true };
      return reply.code(500).send({ error: 'register_failed' });
    }
  });

  app.delete<{ Params: { id: string } }>('/api/events/:id/register', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params;
    const evRes = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (evRes.rows.length === 0) return reply.code(404).send({ error: 'event_not_found' });
    const ev = evRes.rows[0];
    if (ev.status === 'running' || ev.status === 'finished')
      return reply.code(400).send({ error: 'event_started' });
    const delRes = await db.query(
      'DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2 RETURNING id',
      [id, userId],
    );
    if (delRes.rows.length === 0) return reply.code(404).send({ error: 'not_registered' });
    if (Number(ev.buyin_usd) > 0) {
      const refund = Number(ev.buyin_usd);
      await db.query('UPDATE wallets SET balance_usd = balance_usd + $1 WHERE user_id = $2', [
        refund,
        userId,
      ]);
      await db.query(
        `UPDATE events SET prize_pool_collected = COALESCE(prize_pool_collected, 0) - $1 WHERE id = $2`,
        [refund * 0.9, id],
      );
    }
    await logEvent(db, Number(id), 'unregister', `User ${userId} unregistered`, { userId });
    return { ok: true };
  });

  app.post<{ Body: any }>('/api/admin/events', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const b = req.body ?? {};
    if (!b.title || !b.variant || !b.starts_at)
      return reply.code(400).send({ error: 'missing_fields' });
    const blind =
      b.blind_structure ??
      (await db.query('SELECT default_blind_structure($1) as s', [b.starting_stack ?? 1500]))
        .rows[0].s;
    const prize =
      b.prize_structure ?? (await db.query('SELECT default_prize_structure() as s')).rows[0].s;
    const inserted = await db.query(
      `INSERT INTO events (title, variant, starts_at, buyin_usd, prize_pool_usd, max_players,
        min_players, status, blind_structure, prize_structure, starting_stack, late_reg_level, prize_pool_collected)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, $10, $11, $12) RETURNING *`,
      [
        b.title,
        b.variant,
        new Date(b.starts_at),
        b.buyin_usd ?? 0,
        0,
        b.max_players ?? 100,
        b.min_players ?? 2,
        JSON.stringify(blind),
        JSON.stringify(prize),
        b.starting_stack ?? 1500,
        b.late_reg_level ?? 3,
        0,
      ],
    );
    await logEvent(db, inserted.rows[0].id, 'created', `Tournament created by admin`);
    return { ok: true, event: inserted.rows[0] };
  });

  app.get('/api/admin/events', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const res = await db.query(
      `SELECT e.*, (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as reg_count
       FROM events e ORDER BY e.starts_at DESC LIMIT 100`,
    );
    return { events: res.rows };
  });

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/admin/events/:id/cancel',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const { id } = req.params;
      const { reason } = req.body ?? {};
      const evRes = await db.query('SELECT * FROM events WHERE id = $1', [id]);
      if (evRes.rows.length === 0) return reply.code(404).send({ error: 'event_not_found' });
      const ev = evRes.rows[0];
      if (['finished', 'cancelled'].includes(ev.status))
        return reply.code(400).send({ error: 'already_done' });
      if (Number(ev.buyin_usd) > 0) {
        const regs = await db.query('SELECT user_id FROM event_registrations WHERE event_id = $1', [
          id,
        ]);
        for (const r of regs.rows) {
          await db.query('UPDATE wallets SET balance_usd = balance_usd + $1 WHERE user_id = $2', [
            ev.buyin_usd,
            r.user_id,
          ]);
        }
      }
      await db.query(
        `UPDATE events SET status = 'cancelled', cancelled_reason = $1 WHERE id = $2`,
        [reason ?? 'cancelled by admin', id],
      );
      await logEvent(db, Number(id), 'cancelled', reason ?? 'cancelled by admin');
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string }; Body: { status: string } }>(
    '/api/admin/events/:id/status',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const { id } = req.params;
      const { status } = req.body ?? {};
      if (!['scheduled', 'registering', 'running', 'finished'].includes(status)) {
        return reply.code(400).send({ error: 'invalid_status' });
      }
      await db.query(`UPDATE events SET status = $1 WHERE id = $2`, [status, id]);
      await logEvent(db, Number(id), 'status_change', `Status changed to ${status}`);
      if (status === 'running') {
        await db.query(
          `UPDATE events SET level_started_at = NOW(), current_level = 1 WHERE id = $1`,
          [id],
        );
      }
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string } }>('/api/admin/events/:id/logs', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const res = await db.query(
      `SELECT * FROM event_logs WHERE event_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.params.id],
    );
    return { logs: res.rows };
  });
}
