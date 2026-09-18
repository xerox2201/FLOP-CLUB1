import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';

function isAdmin(req: any): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${ADMIN_SECRET}`;
}

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (token === ADMIN_SECRET) return 1;
  const payload = verifyToken(token, JWT_SECRET);
  return payload?.uid ?? null;
}

export async function registerBroadcastRoutes(app: FastifyInstance, db: Pool) {
  // ============================================================
  // ADMIN — LIST BROADCASTS
  // ============================================================
  app.get('/api/admin/broadcasts', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const res = await db.query(
      `SELECT b.id, b.title, b.message, b.target, b.severity,
              b.created_at,
              (SELECT COUNT(*)::int FROM admin_broadcast_reads r WHERE r.broadcast_id = b.id) AS read_count
       FROM admin_broadcasts b
       ORDER BY b.created_at DESC LIMIT 100`,
    );
    return {
      broadcasts: res.rows.map((r) => ({
        id: Number(r.id),
        title: r.title,
        message: r.message,
        target: r.target,
        severity: r.severity,
        readCount: Number(r.read_count),
        createdAt: r.created_at,
      })),
    };
  });

  // ============================================================
  // ADMIN — CREATE BROADCAST
  // ============================================================
  app.post<{
    Body: { title: string; message: string; target?: string; severity?: string };
  }>('/api/admin/broadcasts', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const title = (req.body?.title ?? '').trim();
    const message = (req.body?.message ?? '').trim();
    const target = req.body?.target ?? 'all';
    const severity = req.body?.severity ?? 'info';

    if (!title || !message) {
      return reply.code(400).send({ error: 'missing_fields' });
    }
    if (!['all', 'active', 'banned', 'high_risk'].includes(target)) {
      return reply.code(400).send({ error: 'invalid_target' });
    }
    if (!['info', 'warning', 'success', 'danger'].includes(severity)) {
      return reply.code(400).send({ error: 'invalid_severity' });
    }

    const res = await db.query(
      `INSERT INTO admin_broadcasts (title, message, target, severity)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [title, message, target, severity],
    );

    await db.query(
      `INSERT INTO admin_actions (action, target_type, target_id, payload)
       VALUES ('broadcast', 'broadcast', $1, $2)`,
      [String(res.rows[0].id), JSON.stringify({ title, target, severity })],
    );

    return {
      ok: true,
      broadcastId: Number(res.rows[0].id),
      createdAt: res.rows[0].created_at,
    };
  });

  // ============================================================
  // ADMIN — DELETE BROADCAST
  // ============================================================
  app.delete<{ Params: { id: string } }>(
    '/api/admin/broadcasts/:id',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });

      await db.query('DELETE FROM admin_broadcasts WHERE id = $1', [id]);

      await db.query(
        `INSERT INTO admin_actions (action, target_type, target_id)
         VALUES ('delete_broadcast', 'broadcast', $1)`,
        [String(id)],
      );

      return { ok: true };
    },
  );

  // ============================================================
  // USER — GET UNREAD BROADCASTS
  // ============================================================
  app.get('/api/broadcasts', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const userRes = await db.query(
      'SELECT is_banned, risk_score FROM users WHERE id = $1',
      [userId],
    );
    if (userRes.rows.length === 0) {
      return reply.code(404).send({ error: 'not_found' });
    }
    const { is_banned, risk_score } = userRes.rows[0];

    const res = await db.query(
      `SELECT b.id, b.title, b.message, b.target, b.severity, b.created_at
       FROM admin_broadcasts b
       WHERE (
         b.target = 'all'
         OR (b.target = 'active' AND $1 = FALSE)
         OR (b.target = 'banned' AND $1 = TRUE)
         OR (b.target = 'high_risk' AND $2 >= 65)
       )
       AND NOT EXISTS (
         SELECT 1 FROM admin_broadcast_reads r
         WHERE r.broadcast_id = b.id AND r.user_id = $3
       )
       ORDER BY b.created_at DESC LIMIT 20`,
      [is_banned, risk_score, userId],
    );

    return {
      broadcasts: res.rows.map((r) => ({
        id: Number(r.id),
        title: r.title,
        message: r.message,
        target: r.target,
        severity: r.severity,
        createdAt: r.created_at,
      })),
    };
  });

  // ============================================================
  // USER — MARK AS READ
  // ============================================================
  app.post<{ Params: { id: string } }>(
    '/api/broadcasts/:id/read',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });

      await db.query(
        `INSERT INTO admin_broadcast_reads (broadcast_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, userId],
      );

      return { ok: true };
    },
  );
}