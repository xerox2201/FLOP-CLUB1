import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { ReferralService } from './referral-service.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const p = verifyToken(auth.slice(7), JWT_SECRET);
  return p?.uid ?? null;
}

export async function registerReferralRoutes(app: FastifyInstance, db: Pool) {
  const svc = new ReferralService(db);

  // ---------- Dashboard ----------
  app.get('/api/referral/me', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    return await svc.getDashboard(uid);
  });

  // ---------- Team ----------
  app.get('/api/referral/team', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    return await svc.getTeam(uid);
  });

  // ---------- History ----------
  app.get<{ Querystring: { source?: string; limit?: string; offset?: string } }>(
    '/api/referral/history',
    async (req, reply) => {
      const uid = authUser(req);
      if (!uid) return reply.code(401).send({ error: 'notoken' });
      return await svc.getHistory(uid, {
        source: req.query.source,
        limit: Number(req.query.limit) || 50,
        offset: Number(req.query.offset) || 0,
      });
    },
  );

  // ---------- Leaderboard ----------
  app.get('/api/referral/leaderboard', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    return await svc.getLeaderboard(uid);
  });

  // ---------- Milestones ----------
  app.get('/api/referral/milestones', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    return { milestones: await svc.getMilestones(uid) };
  });

  app.post<{ Params: { code: string } }>(
    '/api/referral/milestones/:code/claim',
    async (req, reply) => {
      const uid = authUser(req);
      if (!uid) return reply.code(401).send({ error: 'notoken' });
      const result = await svc.claimMilestone(uid, req.params.code);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      return { ok: true, reward: result.reward };
    },
  );

  // ---------- Ambassador ----------
  app.get('/api/referral/ambassador/status', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    return await svc.getAmbassadorStatus(uid);
  });

  // ---------- Group Affiliates ----------
  app.post<{
    Body: {
      telegramGroupId: number;
      telegramGroupTitle: string;
      telegramGroupType: 'group' | 'supergroup' | 'channel';
      inviteLink?: string;
    };
  }>('/api/referral/affiliate/register', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    const b = req.body ?? {};
    if (!b.telegramGroupId || !b.telegramGroupTitle || !b.telegramGroupType) {
      return reply.code(400).send({ error: 'missing_fields' });
    }
    const result = await svc.registerAffiliate({
      ownerUserId: uid,
      telegramGroupId: Number(b.telegramGroupId),
      telegramGroupTitle: b.telegramGroupTitle,
      telegramGroupType: b.telegramGroupType,
      inviteLink: b.inviteLink,
    });
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true, id: result.id, shortCode: result.shortCode };
  });

  app.get('/api/referral/affiliate/list', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    return { affiliates: await svc.listAffiliates(uid) };
  });

  app.get<{ Params: { id: string } }>('/api/referral/affiliate/:id', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });
    const detail = await svc.getAffiliateDetail(uid, id);
    if (!detail) return reply.code(404).send({ error: 'not_found' });
    return detail;
  });

  app.delete<{ Params: { id: string } }>('/api/referral/affiliate/:id', async (req, reply) => {
    const uid = authUser(req);
    if (!uid) return reply.code(401).send({ error: 'notoken' });
    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });
    const result = await svc.removeAffiliate(uid, id);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true };
  });
}
