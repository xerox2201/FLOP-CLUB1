import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { LedgerService } from './ledger.js';
import {
  SHOP_PACKS,
  packById,
  levelFromLifetimeXP,
  levelDiscount,
} from './loyalty/definitions.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  return payload?.uid ?? null;
}

export async function registerShopRoutes(app: FastifyInstance, db: Pool) {
  const ledger = new LedgerService(db);

  // POST /api/shop/purchase { packId, tonTxHash? }
  // In dev, we trust the tonTxHash if provided, or auto-complete for testing.
  app.post<{ Body: { packId: string; tonTxHash?: string } }>(
    '/api/shop/purchase',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });

      const { packId, tonTxHash } = req.body ?? {};
      if (!packId) return reply.code(400).send({ error: 'missing_pack_id' });

      const pack = packById(packId);
      if (!pack) return reply.code(400).send({ error: 'invalid_pack' });

      // Level
      const xpRow = await db.query(
        'SELECT lifetime_xp FROM user_xp WHERE user_id = $1',
        [userId],
      );
      const level = levelFromLifetimeXP(
        Number(xpRow.rows[0]?.lifetime_xp ?? 0),
      ).level;
      const discount = levelDiscount(level);
      const priceUsd = Math.round(pack.priceUsd * (1 - discount) * 100) / 100;
      const priceTon = Math.round(pack.priceTon * (1 - discount) * 1000) / 1000;

      // Insert purchase row (pending)
      const ins = await db.query(
        `INSERT INTO shop_purchases
           (user_id, pack_id, ton_amount, usd_amount, chips_awarded, xp_awarded, voucher_amount, status, ton_tx_hash, discount_pct, level_at_purchase)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10)
         RETURNING id`,
        [
          userId, packId, priceTon, priceUsd, pack.chips, pack.xp, pack.voucher,
          tonTxHash || null, discount, level,
        ],
      );
      const purchaseId = Number(ins.rows[0].id);

      // Grant chips (free_chips)
      if (pack.chips > 0) {
        await db.query(
          `INSERT INTO free_chips (user_id, chips) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET chips = free_chips.chips + $2`,
          [userId, pack.chips],
        );
        await db.query(
          `INSERT INTO play_money_log (user_id, delta, reason, balance_after)
           VALUES ($1, $2, 'shop_purchase',
             (SELECT chips FROM free_chips WHERE user_id = $1))`,
          [userId, pack.chips],
        );
      }

      // Grant XP
      if (pack.xp > 0) {
        await db.query(
          `INSERT INTO user_xp (user_id, lifetime_xp, claimed_xp, updated_at)
           VALUES ($1, $2, 0, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET lifetime_xp = user_xp.lifetime_xp + EXCLUDED.lifetime_xp,
                 updated_at = NOW()`,
          [userId, pack.xp],
        );
        await db.query(
          `INSERT INTO xp_transactions (user_id, amount, source, meta)
           VALUES ($1, $2, 'bonus', $3)`,
          [userId, pack.xp, JSON.stringify({ packId, purchaseId })],
        );
      }

      // Create voucher (if any)
      if (pack.voucher > 0) {
        const minRake = Math.round(pack.voucher * 2.5 * 100) / 100;
        await db.query(
          `INSERT INTO vouchers
             (user_id, amount, min_rake, current_rake, used, expires_at, source_purchase_id)
           VALUES ($1, $2, $3, 0, FALSE, NOW() + INTERVAL '90 days', $4)`,
          [userId, pack.voucher, minRake, purchaseId],
        );
      }

      // Mark complete
      await db.query(
        `UPDATE shop_purchases SET status='completed', completed_at=NOW() WHERE id=$1`,
        [purchaseId],
      );

      // Ledger entry (revenue)
      const revenueAcc = await ledger.getAccountId('HOUSE_PRIZE_POOL');
      // We record purchase as a receivable — for now just log via transaction
      // For full ledger, house gets the revenue via TON deposits watcher.

      return {
        ok: true,
        purchaseId,
        chipsAwarded: pack.chips,
        xpAwarded: pack.xp,
        voucherAmount: pack.voucher,
        priceUsd,
        priceTon,
        discountPct: discount,
      };
    },
  );

  // GET /api/shop/purchases — user history
  app.get('/api/shop/purchases', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    const res = await db.query(
      `SELECT id, pack_id, usd_amount, ton_amount, chips_awarded, xp_awarded, voucher_amount, status, created_at
       FROM shop_purchases WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    return { purchases: res.rows };
  });
}