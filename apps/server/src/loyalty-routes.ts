import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { LoyaltyService } from './loyalty/service.js';
import type { SeedType } from './loyalty/definitions.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  return payload?.uid ?? null;
}

export async function registerLoyaltyRoutes(app: FastifyInstance, db: Pool) {
  const svc = new LoyaltyService(db);

  // ============================================================
  // GET /api/me/loyalty — full loyalty summary
  // ============================================================
  app.get('/api/me/loyalty', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    const summary = await svc.getSummary(userId);
    return summary;
  });

  // ============================================================
  // POST /api/seeds/claim — { type }
  // ============================================================
  app.post<{ Body: { type: SeedType } }>(
    '/api/seeds/claim',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });
      const type = req.body?.type;
      if (!type) return reply.code(400).send({ error: 'missing_type' });
      const r = await svc.claimSeed(userId, type);
      if (!r.ok) return reply.code(400).send({ error: r.error });
      return { ok: true, amount: r.amount };
    },
  );

  // ============================================================
  // POST /api/xp/convert — { xp }
  // ============================================================
  app.post<{ Body: { xp: number } }>(
    '/api/xp/convert',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });
      const xp = Number(req.body?.xp);
      if (!Number.isFinite(xp) || xp <= 0) {
        return reply.code(400).send({ error: 'invalid_xp' });
      }
      const r = await svc.cashOutXp(userId, xp);
      if (!r.ok) return reply.code(400).send({ error: r.error });
      return { ok: true, usd: r.usd, newClaimedXp: r.newClaimedXp };
    },
  );

  // ============================================================
  // GET /api/shop/packs — with level-based discount
  // ============================================================
  app.get('/api/shop/packs', async (req, reply) => {
    const userId = authUser(req);
    let level = 1;
    if (userId) {
      try {
        const xpRow = await db.query(
          'SELECT lifetime_xp FROM user_xp WHERE user_id = $1',
          [userId],
        );
        const { levelFromLifetimeXP } = await import('./loyalty/definitions.js');
        level = levelFromLifetimeXP(
          Number(xpRow.rows[0]?.lifetime_xp ?? 0),
        ).level;
      } catch {}
    }

    const { SHOP_PACKS, levelDiscount } = await import(
      './loyalty/definitions.js'
    );
    const discount = levelDiscount(level);

    return {
      level,
      discountPct: discount,
      packs: SHOP_PACKS.map((p) => ({
        ...p,
        priceUsdDiscounted:
          Math.round(p.priceUsd * (1 - discount) * 100) / 100,
        priceTonDiscounted:
          Math.round(p.priceTon * (1 - discount) * 1000) / 1000,
      })),
    };
  });

  // ============================================================
  // GET /api/xp/history — recent XP transactions
  // ============================================================
  app.get('/api/xp/history', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    const res = await db.query(
      `SELECT id, amount, source, ref_id, meta, created_at
       FROM xp_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [userId],
    );
    return { transactions: res.rows };
  });
}