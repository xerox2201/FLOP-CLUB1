import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { FreerollService } from './freeroll-service.js';
import { FreerollScheduler } from './freeroll-scheduler.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (token === ADMIN_SECRET) return 1;
  const p = verifyToken(token, JWT_SECRET);
  return p?.uid ?? null;
}

function isAdmin(req: any): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${ADMIN_SECRET}`;
}

export async function registerFreerollRoutes(
  app: FastifyInstance,
  db: Pool,
  scheduler: FreerollScheduler,
) {
  const svc = new FreerollService(db);

  // ============================================================
  // PUBLIC
  // ============================================================
  app.get('/api/freeroll/next', async () => {
    const next = await svc.getNextFreeroll();
    return { freeroll: next };
  });

  app.get('/api/freeroll/eligibility', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    return await svc.userEligibility(userId);
  });

  // ============================================================
  // ADMIN
  // ============================================================
  app.get('/api/admin/freeroll/config', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    return await svc.getConfig();
  });

  app.post<{ Body: any }>('/api/admin/freeroll/config', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const updated = await svc.updateConfig(req.body ?? {});
    return updated;
  });

  app.get<{ Querystring: { limit?: string } }>(
    '/api/admin/freeroll/history',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      return { history: await svc.getHistory(limit) };
    },
  );

  app.post('/api/admin/freeroll/trigger', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    await scheduler.tick();
    const next = await svc.getNextFreeroll();
    return { ok: true, next };
  });

  app.post<{ Body: { hoursFromNow?: number } }>(
    '/api/admin/freeroll/create',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const hours = Math.max(0.1, Number(req.body?.hoursFromNow ?? 24));
      const when = new Date(Date.now() + hours * 3600_000);
      const tid = await svc.createDailyFreeroll(when);
      return { ok: tid !== null, tournamentId: tid, scheduledStart: when };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/freeroll/:id',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });
      await db.query(
        `UPDATE tournaments SET status = 'cancelled', finished_at = NOW()
         WHERE id = $1 AND status IN ('scheduled','registering')`,
        [id],
      );
      await db.query(
        `UPDATE freeroll_history SET status = 'cancelled' WHERE tournament_id = $1`,
        [id],
      );
      return { ok: true };
    },
  );
}