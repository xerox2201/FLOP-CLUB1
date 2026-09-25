import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';

function requireAdmin(req: any, reply: any): boolean {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'no_token' });
    return false;
  }
  const token = auth.slice(7);
  if (token === ADMIN_SECRET) return true;
  const payload = verifyToken(token, JWT_SECRET);
  if (!payload) {
    reply.code(401).send({ error: 'invalid_token' });
    return false;
  }
  return true;
}

export async function registerAntiCheatRoutes(app: FastifyInstance, db: Pool) {
  app.get('/api/admin/anticheat/risky-users', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const res = await db.query(
      `SELECT pr.user_id, pr.score, pr.flags, pr.action_taken, pr.last_updated,
              u.display_name, u.telegram_id, u.is_banned
       FROM player_risk pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.score > 0
       ORDER BY pr.score DESC LIMIT 100`,
    );
    return { users: res.rows };
  });

  app.get('/api/admin/anticheat/events', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { resolved } = req.query as any;
    const where =
      resolved === 'true'
        ? 'WHERE se.resolved = TRUE'
        : resolved === 'false'
          ? 'WHERE se.resolved = FALSE'
          : '';
    const res = await db.query(
      `SELECT se.id, se.user_id, se.other_user_id, se.type, se.severity,
              se.evidence, se.resolved, se.reviewer_note, se.created_at,
              u.display_name as user_name, u2.display_name as other_name
       FROM suspicious_events se
       JOIN users u ON u.id = se.user_id
       LEFT JOIN users u2 ON u2.id = se.other_user_id
       ${where}
       ORDER BY se.created_at DESC LIMIT 200`,
    );
    return { events: res.rows };
  });

  app.get<{ Params: { userId: string } }>(
    '/api/admin/anticheat/user/:userId/actions',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const res = await db.query(
        `SELECT * FROM player_actions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [req.params.userId],
      );
      return { actions: res.rows };
    },
  );

  app.get<{ Params: { userId: string } }>(
    '/api/admin/anticheat/user/:userId/ips',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const res = await db.query(
        `SELECT ip, first_seen, last_seen FROM user_ips WHERE user_id = $1 ORDER BY last_seen DESC`,
        [req.params.userId],
      );
      return { ips: res.rows };
    },
  );

  app.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/api/admin/anticheat/events/:id/resolve',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      await db.query(
        `UPDATE suspicious_events SET resolved = TRUE, reviewer_note = $1 WHERE id = $2`,
        [req.body?.note ?? null, req.params.id],
      );
      return { ok: true };
    },
  );

  app.post<{ Params: { userId: string }; Body: { ban: boolean; reason?: string } }>(
    '/api/admin/anticheat/user/:userId/ban',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const { ban, reason } = req.body;
      await db.query('UPDATE users SET is_banned = $1 WHERE id = $2', [ban, req.params.userId]);
      await db.query(
        `INSERT INTO suspicious_events (user_id, type, severity, evidence, resolved)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [
          req.params.userId,
          ban ? 'manual_ban' : 'manual_unban',
          10,
          JSON.stringify({ reason: reason ?? 'admin action' }),
        ],
      );
      return { ok: true };
    },
  );

  app.get('/api/admin/anticheat/stats', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const [total, byType, highRisk] = await Promise.all([
      db.query('SELECT COUNT(*) FROM suspicious_events WHERE resolved = FALSE'),
      db.query(
        `SELECT type, COUNT(*) as count FROM suspicious_events WHERE resolved = FALSE GROUP BY type`,
      ),
      db.query('SELECT COUNT(*) FROM player_risk WHERE score >= 65'),
    ]);
    return {
      unresolvedTotal: Number(total.rows[0].count),
      highRiskUsers: Number(highRisk.rows[0].count),
      byType: byType.rows,
    };
  });
  // ============================================================
  // SHADOWBAN list + manual toggle
  // ============================================================
  app.get('/api/admin/anticheat/shadowbanned', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const res = await db.query(
      `SELECT pr.user_id, pr.score, pr.flags, pr.action_taken, pr.last_updated,
              u.display_name, u.telegram_id, u.is_banned
       FROM player_risk pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.action_taken IN ('shadowban', 'ban')
       ORDER BY pr.score DESC, pr.last_updated DESC
       LIMIT 100`,
    );
    return { users: res.rows };
  });

  app.post<{ Params: { userId: string } }>(
    '/api/admin/anticheat/user/:userId/shadowban',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const userId = Number(req.params.userId);
      if (!userId) return reply.code(400).send({ error: 'invalid_user_id' });

      await db.query(
        `INSERT INTO player_risk (user_id, score, flags, action_taken, last_updated)
         VALUES ($1, 0, '{}'::jsonb, 'shadowban', NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET action_taken = 'shadowban', last_updated = NOW()`,
        [userId],
      );
      console.log(`[anti-cheat] 👻 manual shadowban: user=${userId}`);
      return { ok: true };
    },
  );

  app.post<{ Params: { userId: string } }>(
    '/api/admin/anticheat/user/:userId/unshadowban',
    async (req, reply) => {
      if (!requireAdmin(req, reply)) return;
      const userId = Number(req.params.userId);
      if (!userId) return reply.code(400).send({ error: 'invalid_user_id' });

      await db.query(
        `UPDATE player_risk SET action_taken = 'none', last_updated = NOW()
         WHERE user_id = $1`,
        [userId],
      );
      console.log(`[anti-cheat] ✅ manual unshadowban: user=${userId}`);
      return { ok: true };
    },
  );
}
