import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { AchievementService } from './achievement-service.js';

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

export async function registerAchievementsRoutes(
  app: FastifyInstance,
  db: Pool,
) {
  const svc = new AchievementService(db);

  // ============================================================
  // PUBLIC — list all achievement definitions
  // ============================================================
  app.get('/api/achievements', async () => {
    const list = await svc.listAll();
    return { achievements: list };
  });

  // ============================================================
  // USER — get my achievements + progress
  // ============================================================
  app.get('/api/me/achievements', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    const list = await svc.getUserAchievements(userId);
    return { achievements: list };
  });

  // ============================================================
  // USER — claim reward
  // ============================================================
  app.post<{ Params: { code: string } }>(
    '/api/me/achievements/:code/claim',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });
      const code = req.params.code;
      const result = await svc.claim(userId, code);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      return { ok: true };
    },
  );

  // ============================================================
  // ADMIN — create/update achievement
  // ============================================================
  app.post<{
    Body: {
      code: string;
      name: string;
      description: string;
      icon: string;
      category?: string;
      threshold?: number;
      rewardChips?: number;
      rewardUsd?: number;
      sortOrder?: number;
      isActive?: boolean;
    };
  }>('/api/admin/achievements', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const b = req.body ?? {};
    if (!b.code || !b.name || !b.description || !b.icon) {
      return reply.code(400).send({ error: 'missing_fields' });
    }
    const res = await db.query(
      `INSERT INTO achievements
         (code, name, description, icon, category, threshold,
          reward_chips, reward_usd, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         icon = EXCLUDED.icon,
         category = EXCLUDED.category,
         threshold = EXCLUDED.threshold,
         reward_chips = EXCLUDED.reward_chips,
         reward_usd = EXCLUDED.reward_usd,
         sort_order = EXCLUDED.sort_order,
         is_active = EXCLUDED.is_active
       RETURNING id`,
      [
        b.code,
        b.name,
        b.description,
        b.icon,
        b.category ?? 'general',
        Number(b.threshold ?? 1),
        Number(b.rewardChips ?? 0),
        Number(b.rewardUsd ?? 0),
        Number(b.sortOrder ?? 100),
        b.isActive !== false,
      ],
    );
    return { ok: true, achievementId: Number(res.rows[0].id) };
  });

  // ============================================================
  // ADMIN — toggle active
  // ============================================================
  app.post<{ Params: { id: string }; Body: { active: boolean } }>(
    '/api/admin/achievements/:id/toggle',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });
      const active = !!req.body?.active;
      await db.query(
        `UPDATE achievements SET is_active = $1 WHERE id = $2`,
        [active, id],
      );
      return { ok: true, isActive: active };
    },
  );
}