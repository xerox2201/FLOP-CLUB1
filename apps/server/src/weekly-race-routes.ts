import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import {
  WeeklyRaceService,
  RACE_BRACKET_ORDER,
  WEEKLY_RACE_BRACKETS,
  weekStartUtc,
  type RaceBracket,
} from './weekly-race-service.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const p = verifyToken(auth.slice(7), JWT_SECRET);
  return p?.uid ?? null;
}

function bracketList() {
  return RACE_BRACKET_ORDER.map((key) => {
    const cfg = WEEKLY_RACE_BRACKETS[key];
    return {
      key,
      label: cfg.label,
      color: cfg.color,
      minRake: cfg.minRake,
      maxRake: Number.isFinite(cfg.maxRake) ? cfg.maxRake : null,
      poolUsd: cfg.poolUsd,
      paidPlaces: cfg.paidPlaces,
    };
  });
}

export async function registerWeeklyRaceRoutes(app: FastifyInstance, db: Pool) {
  const race = new WeeklyRaceService(db);

  // GET /api/weekly-race/current?bracket=bronze|silver|gold
  app.get<{ Querystring: { bracket?: string } }>('/api/weekly-race/current', async (req) => {
    const weekStart = weekStartUtc();
    const requested = String(req.query?.bracket ?? 'bronze') as RaceBracket;
    const bracket: RaceBracket = RACE_BRACKET_ORDER.includes(requested) ? requested : 'bronze';

    const leaderboard = await race.getLeaderboard(bracket, 50, weekStart);
    const cfg = WEEKLY_RACE_BRACKETS[bracket];

    return {
      weekStart,
      bracket,
      brackets: bracketList(),
      poolUsd: cfg.poolUsd,
      paidPlaces: cfg.paidPlaces,
      entries: leaderboard,
    };
  });

  // GET /api/weekly-race/me
  app.get('/api/weekly-race/me', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const entry = await race.getMyEntry(userId);
    const cfg = WEEKLY_RACE_BRACKETS[entry.bracket];
    return {
      weekStart: weekStartUtc(),
      poolUsd: cfg.poolUsd,
      paidPlaces: cfg.paidPlaces,
      ...entry,
    };
  });

  // GET /api/weekly-race/history
  app.get('/api/weekly-race/history', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    return { history: await race.getHistory(userId, 12) };
  });
}
