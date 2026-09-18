import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';

function isAdmin(req: any): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${ADMIN_SECRET}`;
}

const ALLOWED_KEYS = [
  'maintenance_mode',
  'registration_open',
  'cash_games_open',
  'tournaments_open',
  'deposits_open',
  'withdrawals_open',
];

export async function registerSettingsRoutes(app: FastifyInstance, db: Pool) {
  // ============================================================
  // GET ALL SETTINGS
  // ============================================================
  app.get('/api/admin/settings', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const res = await db.query(
      `SELECT key, value, updated_at FROM admin_settings ORDER BY key`,
    );
    const out: Record<string, any> = {};
    for (const r of res.rows) {
      out[r.key] = { value: r.value, updatedAt: r.updated_at };
    }
    return { settings: out };
  });

  // ============================================================
  // UPDATE ONE OR MANY SETTINGS
  // ============================================================
  app.post<{
    Body: Record<string, any>;
  }>('/api/admin/settings', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });

    const body = req.body ?? {};
    const entries = Object.entries(body);
    if (entries.length === 0) {
      return reply.code(400).send({ error: 'empty_body' });
    }

    // فقط کلیدهای مجاز
    const invalid = entries.filter(([k]) => !ALLOWED_KEYS.includes(k));
    if (invalid.length > 0) {
      return reply
        .code(400)
        .send({ error: 'invalid_keys', keys: invalid.map(([k]) => k) });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      for (const [key, value] of entries) {
        await client.query(
          `INSERT INTO admin_settings (key, value, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, JSON.stringify(value)],
        );
      }

      await client.query(
        `INSERT INTO admin_actions (action, target_type, target_id, payload)
         VALUES ('update_settings', 'setting', 'batch', $1)`,
        [JSON.stringify(body)],
      );

      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }

    return { ok: true, updated: entries.map(([k]) => k) };
  });

  // ============================================================
  // PUBLIC — game status (برای نمایش maintenance mode به بازیکن)
  // ============================================================
  app.get('/api/status', async () => {
    const res = await db.query(
      `SELECT key, value FROM admin_settings WHERE key IN
       ('maintenance_mode','registration_open','cash_games_open',
        'tournaments_open','deposits_open','withdrawals_open')`,
    );
    const out: Record<string, boolean> = {};
    for (const r of res.rows) {
      out[r.key] = r.value === true || r.value === 'true';
    }
    return { status: out };
  });

  // ============================================================
  // ADMIN — action log
  // ============================================================
  app.get<{ Querystring: { limit?: string } }>(
    '/api/admin/actions',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const res = await db.query(
        `SELECT id, action, target_type, target_id, payload, created_at
         FROM admin_actions
         ORDER BY created_at DESC LIMIT $1`,
        [limit],
      );
      return {
        actions: res.rows.map((r) => ({
          id: Number(r.id),
          action: r.action,
          targetType: r.target_type,
          targetId: r.target_id,
          payload: r.payload,
          createdAt: r.created_at,
        })),
      };
    },
  );
}