import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { MissionService, utcDay } from './mission-service.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const p = verifyToken(auth.slice(7), JWT_SECRET);
  return p?.uid ?? null;
}

export async function registerMissionRoutes(app: FastifyInstance, db: Pool) {
  const missions = new MissionService(db);

  // GET /api/missions/daily
  app.get('/api/missions/daily', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const list = await missions.getDailyMissions(userId);
    return {
      day: utcDay(),
      missions: list,
      claimableCount: list.filter((m) => m.claimable).length,
      claimedCount: list.filter((m) => m.claimed).length,
      totalRewardChips: list.reduce((s, m) => s + m.rewardChips, 0),
      totalRewardXp: list.reduce((s, m) => s + m.rewardXp, 0),
    };
  });

  // POST /api/missions/:code/claim
  app.post<{ Params: { code: string } }>('/api/missions/:code/claim', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const code = req.params?.code;
    const result = await missions.claim(userId, code);
    if (!result.ok) {
      const status = result.error === 'mission_not_found' ? 404 : 400;
      return reply.code(status).send({ error: result.error });
    }
    return result;
  });
}
