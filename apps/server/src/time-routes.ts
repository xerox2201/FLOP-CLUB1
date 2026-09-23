import type { FastifyInstance } from 'fastify';

export async function registerTimeRoutes(app: FastifyInstance) {
  app.get('/api/time', async () => {
    const now = new Date();
    return {
      utc: now.getTime(),
      utcIso: now.toISOString(),
    };
  });
}