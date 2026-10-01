import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { BadBeatService } from './bad-beat-service.js';

export async function registerBadBeatRoutes(app: FastifyInstance, db: Pool) {
  const badBeat = new BadBeatService(db);

  // GET /api/bad-beat/pool
  app.get('/api/bad-beat/pool', async () => {
    const stats = await badBeat.getStats();
    return {
      pool: stats.pool,
      totalPaid: stats.totalPaid,
      lastPayout: stats.lastPayout,
      updatedAt: stats.updatedAt,
    };
  });

  // GET /api/bad-beat/recent
  app.get('/api/bad-beat/recent', async () => {
    const payouts = await badBeat.getRecentPayouts(10);
    return { payouts };
  });
}
