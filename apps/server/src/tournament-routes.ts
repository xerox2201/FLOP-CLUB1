import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { TournamentManager } from './tournament-manager.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  return payload?.uid ?? null;
}

export async function registerTournamentRoutes(
  app: FastifyInstance,
  db: Pool,
  tm: TournamentManager,
): Promise<void> {
  app.get<{ Querystring: { status?: string; variant?: string; mode?: string } }>(
    '/api/tournaments',
    async (req) => {
      const list = await tm.list({
        status: req.query.status,
        variant: req.query.variant,
        mode: req.query.mode,
      });
      return { tournaments: list };
    },
  );

  app.get<{ Params: { id: string } }>('/api/tournaments/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const t = await tm.get(id);
    if (!t) return reply.code(404).send({ error: 'not_found' });
    return t;
  });

  app.post<{ Body: any }>('/api/tournaments', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const body = req.body ?? {};

    if (!body.name || !body.variant || !body.blindStructureId) {
      return reply.code(400).send({ error: 'missing_fields' });
    }

    try {
      const id = await tm.create({
        name: body.name,
        variant: body.variant,
        mode: body.mode || 'real',
        format: body.format || 'mtt',
        speed: body.speed || 'regular',
        buyIn: Number(body.buyIn || 0),
        fee: Number(body.fee || 0),
        startingStack: Number(body.startingStack || 10000),
        minPlayers: Number(body.minPlayers || 2),
        maxPlayers: Number(body.maxPlayers || 100),
        guaranteed: Number(body.guaranteed || 0),
        scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
        lateRegMin: Number(body.lateRegMin || 0),
        blindStructureId: Number(body.blindStructureId),
        isPrivate: !!body.isPrivate,
        createdBy: userId,
      });
      return { ok: true, tournamentId: id };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  app.post<{ Params: { id: string } }>('/api/tournaments/:id/register', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const result = await tm.register(id, userId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/tournaments/:id/unregister', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const result = await tm.unregister(id, userId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/tournaments/:id/start', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const result = await tm.start(id);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true };
  });

  // 🔴 D3: bust
  app.post<{ Params: { id: string }; Body: { userId: number; eliminatedBy?: number } }>(
    '/api/tournaments/:id/bust',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });

      const { userId, eliminatedBy } = req.body ?? {};
      if (!userId) return reply.code(400).send({ error: 'missing_userId' });

      const result = await tm.handlePlayerBust(id, userId, eliminatedBy);
      if (!result.ok) return reply.code(400).send({ error: 'not_eliminated' });
      return { ok: true, finalPosition: result.finalPosition, finished: result.finished };
    },
  );

  // 🔴 D3: sync stacks
  app.post<{ Params: { id: string }; Body: { stacks: Record<string, number> } }>(
    '/api/tournaments/:id/sync-stacks',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });

      const stacks = req.body?.stacks ?? {};
      const map = new Map<number, number>();
      for (const [uid, s] of Object.entries(stacks)) {
        map.set(Number(uid), Number(s));
      }
      await tm.checkBustedPlayers(id, map);
      return { ok: true };
    },
  );

  app.get('/api/blind-structures', async () => {
    const res = await db.query(
      'SELECT id, name, description, starting_stack, is_turbo, is_hyper FROM blind_structures ORDER BY id',
    );
    return {
      structures: res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        startingStack: Number(r.starting_stack),
        isTurbo: r.is_turbo,
        isHyper: r.is_hyper,
      })),
    };
  });
}
