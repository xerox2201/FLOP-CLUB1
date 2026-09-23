import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { LedgerService } from './ledger.js';
import { tonAdapter } from './ton.js';
import { levelFromLifetimeXP } from './loyalty/definitions.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const TON_DEPOSIT_ADDRESS = process.env.TON_DEPOSIT_ADDRESS || '';
const TON_MIN_WITHDRAW = Number(process.env.TON_MIN_WITHDRAW || 1.0);
const TON_WITHDRAW_FEE = 0.05; // flat fee — always
const TON_PRICE_USD = 5;

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  return payload?.uid ?? null;
}


export async function registerWalletRoutes(app: FastifyInstance, db: Pool): Promise<void> {
  const ledger = new LedgerService(db);

  // ============================================================
  // GET /api/wallet/deposit-info
  // ============================================================
  app.get('/api/wallet/deposit-info', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    if (!TON_DEPOSIT_ADDRESS) {
      return reply.code(503).send({ error: 'deposits_disabled' });
    }

    return {
      depositAddress: TON_DEPOSIT_ADDRESS,
      memo: String(userId),
      minDeposit: tonAdapter.getMinDeposit(),
      network: process.env.TON_NETWORK || 'testnet',
    };
  });

  // ============================================================
  // GET /api/wallet/balance
  // ============================================================
  app.get('/api/wallet/balance', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    try {
      const userAcc = await ledger.getUserAccountId(userId);
      const balance = userAcc ? await ledger.getBalance(userAcc) : 0;

      const ton = await db.query(
        `SELECT
           COALESCE(SUM(CASE WHEN direction='deposit' AND status='confirmed' THEN amount_ton ELSE 0 END), 0) AS dep,
           COALESCE(SUM(CASE WHEN direction='withdraw' AND status IN ('confirmed','processing','pending') THEN amount_ton ELSE 0 END), 0) AS wd
         FROM ton_transactions WHERE user_id = $1`,
        [userId],
      );

      const chips = await db.query(`SELECT chips FROM free_chips WHERE user_id = $1`, [userId]);

      return {
        balance: Number(balance),
        freeChips: Number(chips.rows[0]?.chips ?? 0),
        ton: {
          deposited: Number(ton.rows[0].dep),
          withdrawn: Number(ton.rows[0].wd),
        },
        hotWalletReady: tonAdapter.isReady(),
      };
    } catch (e: any) {
      console.error('[wallet] balance failed:', e.message);
      return reply.code(500).send({ error: e.message });
    }
  });

  // ============================================================
  // GET /api/wallet/withdraw-status
  // ============================================================
  app.get('/api/wallet/withdraw-status', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    try {
      const userAcc = await ledger.getUserAccountId(userId);
      const balance = userAcc ? await ledger.getBalance(userAcc) : 0;

      // Level (for info only)
      const xpRow = await db.query(
        'SELECT lifetime_xp FROM user_xp WHERE user_id = $1',
        [userId],
      );
      const level = levelFromLifetimeXP(
        Number(xpRow.rows[0]?.lifetime_xp ?? 0),
      ).level;

      // Bonus conditions
      const cond = await db.query(
        `SELECT bonus_playthrough_pending, bonus_rake_pending,
                bonus_real_hands_pending, bonus_received_at
         FROM users WHERE id = $1`,
        [userId],
      );
      const p = cond.rows[0] ?? {};

      const playthroughRemaining = Number(p.bonus_playthrough_pending ?? 0);
      const rakeRemaining = Number(p.bonus_rake_pending ?? 0);
      const handsRemaining = Number(p.bonus_real_hands_pending ?? 0);

      let waitDaysRemaining = 0;
      if (p.bonus_received_at) {
        const daysSince = (Date.now() - new Date(p.bonus_received_at).getTime()) / 86400000;
        waitDaysRemaining = Math.max(0, Math.ceil(14 - daysSince));
      }

      const conditionsMet =
        playthroughRemaining <= 0 &&
        rakeRemaining <= 0 &&
        handsRemaining <= 0 &&
        waitDaysRemaining <= 0;

      const bonusLocked = conditionsMet ? 0 : Number(p.bonus_playthrough_pending ?? 0);
      const availableBalance = Math.max(0, balance - bonusLocked);

      const minWithdrawUsd = TON_MIN_WITHDRAW * TON_PRICE_USD;
      const feeUsd = TON_WITHDRAW_FEE * TON_PRICE_USD;

      const canWithdraw =
        conditionsMet &&
        availableBalance >= minWithdrawUsd + feeUsd &&
        tonAdapter.isReady();

      return {
        balance,
        availableBalance,
        bonusLocked,
        minWithdrawUsd,
        minWithdrawTon: TON_MIN_WITHDRAW,
        feeTon: TON_WITHDRAW_FEE,
        feeUsd,
        tonPriceUsd: TON_PRICE_USD,
        level,
        conditionsMet,
        conditions: {
          playthroughRemaining,
          rakeRemaining,
          handsRemaining,
          waitDaysRemaining,
        },
        canWithdraw,
        hotWalletReady: tonAdapter.isReady(),
      };
    } catch (e: any) {
      console.error('[wallet] withdraw-status failed:', e.message);
      return reply.code(500).send({ error: e.message });
    }
  });

  // ============================================================
  // GET /api/wallet/history
  // ============================================================
  app.get('/api/wallet/history', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    try {
      const txs = await db.query(
        `SELECT id, direction, amount_ton, amount_usd, tx_hash, from_address, to_address,
                memo, status, error, confirmations, created_at, confirmed_at
         FROM ton_transactions
         WHERE user_id = $1
         ORDER BY id DESC
         LIMIT 50`,
        [userId],
      );

      const ledgerTxs = await ledger.getHistory(userId, 50);

      return {
        tonTransactions: txs.rows.map((r) => ({
          id: r.id,
          direction: r.direction,
          amountTon: Number(r.amount_ton),
          amountUsd: r.amount_usd ? Number(r.amount_usd) : null,
          txHash: r.tx_hash,
          fromAddress: r.from_address,
          toAddress: r.to_address,
          memo: r.memo,
          status: r.status,
          error: r.error,
          confirmations: r.confirmations,
          createdAt: r.created_at,
          confirmedAt: r.confirmed_at,
        })),
        ledgerTransactions: ledgerTxs,
      };
    } catch (e: any) {
      console.error('[wallet] history failed:', e.message);
      return reply.code(500).send({ error: e.message });
    }
  });

  // ============================================================
  // POST /api/wallet/withdraw — instant, automatic
  // ============================================================
  app.post<{ Body: { amountTon: number; toAddress: string } }>(
    '/api/wallet/withdraw',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });

      const { amountTon, toAddress } = req.body ?? {};

      if (!amountTon || amountTon < TON_MIN_WITHDRAW) {
        return reply.code(400).send({
          error: 'amount_below_minimum',
          minimum: TON_MIN_WITHDRAW,
        });
      }

      const validPrefixes = ['EQ', 'UQ', 'kQ', '0Q', 'Ef', 'Uf', 'kf', '0f', '0:', '-1:'];
      if (!toAddress || !validPrefixes.some((p) => toAddress.startsWith(p))) {
        return reply.code(400).send({ error: 'invalid_address' });
      }

      if (!tonAdapter.isReady()) {
        return reply.code(503).send({ error: 'withdrawals_disabled' });
      }

      try {
        const userAcc = await ledger.getUserAccountId(userId);
        if (!userAcc) return reply.code(400).send({ error: 'no_account' });

        const balance = await ledger.getBalance(userAcc);

        // Bonus conditions
        const u = await db.query(
          `SELECT bonus_playthrough_pending, bonus_rake_pending,
                  bonus_real_hands_pending, bonus_received_at
           FROM users WHERE id = $1`,
          [userId],
        );
        const pending = u.rows[0];
        const playR = Number(pending?.bonus_playthrough_pending ?? 0);
        const rakeR = Number(pending?.bonus_rake_pending ?? 0);
        const handsR = Number(pending?.bonus_real_hands_pending ?? 0);

        let waitR = 0;
        if (pending?.bonus_received_at) {
          const daysSince =
            (Date.now() - new Date(pending.bonus_received_at).getTime()) / 86400000;
          waitR = Math.max(0, Math.ceil(14 - daysSince));
        }

        if (playR > 0 || rakeR > 0 || handsR > 0 || waitR > 0) {
          return reply.code(400).send({
            error: 'bonus_conditions_not_met',
            conditions: {
              playthroughRemaining: playR,
              rakeRemaining: rakeR,
              handsRemaining: handsR,
              waitDaysRemaining: waitR,
            },
          });
        }

        const amountUsd = amountTon * TON_PRICE_USD;

        // Balance check (incl. fee)
        const feeUsd = TON_WITHDRAW_FEE * TON_PRICE_USD;
        const needed = amountUsd; // fee deducted from amount sent, not from balance
        if (balance < needed) {
          return reply.code(400).send({
            error: 'insufficient_balance',
            balance,
            required: needed,
          });
        }

        const escrowAcc = await ledger.getAccountId('SYSTEM_ESCROW');
        if (!escrowAcc) return reply.code(500).send({ error: 'escrow_not_found' });

        // Ledger: lock funds in escrow
        const ledgerResult = await ledger.record({
          kind: 'WITHDRAWAL',
          userId,
          ref: `withdraw_${userId}_${Date.now()}`,
          meta: { amountTon, toAddress, feeTon: TON_WITHDRAW_FEE },
          entries: [
            { accountId: userAcc, amount: -amountUsd },
            { accountId: escrowAcc, amount: amountUsd },
          ],
          idempotencyKey: `wd_${userId}_${Date.now()}`,
        });

        if (!ledgerResult.ok) {
          return reply.code(400).send({ error: ledgerResult.error });
        }

        // Insert ton_transactions row
        const tonResult = await db.query(
          `INSERT INTO ton_transactions
             (user_id, direction, amount_ton, amount_usd, to_address, status, ledger_tx_id, memo)
           VALUES ($1, 'withdraw', $2, $3, $4, 'processing', $5, $6)
           RETURNING id`,
          [userId, amountTon, amountUsd, toAddress, ledgerResult.transactionId, `wd_${userId}`],
        );

        const txId = tonResult.rows[0].id;

        // Send TON async — instant
        (async () => {
          try {
            const txHash = await tonAdapter.sendTon(
              toAddress,
              amountTon - TON_WITHDRAW_FEE,
            );
            await db.query(
              `UPDATE ton_transactions SET status='processing', tx_hash=$1 WHERE id=$2`,
              [txHash, txId],
            );
            console.log(
              `[wallet] ✅ withdraw sent: user=${userId} amount=${amountTon} TON tx=${txHash}`,
            );
          } catch (e: any) {
            console.error('[wallet] withdraw send failed:', e.message);
            await db.query(
              `UPDATE ton_transactions SET status='failed', error=$1 WHERE id=$2`,
              [e.message, txId],
            );
            // Refund
            const escrowAcc2 = await ledger.getAccountId('SYSTEM_ESCROW');
            if (escrowAcc2) {
              await ledger.record({
                kind: 'WITHDRAWAL',
                userId,
                ref: `withdraw_refund_${txId}`,
                entries: [
                  { accountId: escrowAcc2, amount: -amountUsd },
                  { accountId: userAcc, amount: amountUsd },
                ],
                idempotencyKey: `wd_refund_${txId}`,
              });
              console.log(`[wallet] 💸 refunded user=${userId} $${amountUsd}`);
            }
          }
        })();

        return {
          ok: true,
          transactionId: txId,
          amountTon,
          amountUsd,
          feeTon: TON_WITHDRAW_FEE,
          toAddress,
          status: 'processing',
        };
      } catch (e: any) {
        console.error('[wallet] withdraw failed:', e.message);
        return reply.code(500).send({ error: e.message });
      }
    },
  );

  // ============================================================
  // GET /api/wallet/withdraw/:id
  // ============================================================
  app.get<{ Params: { id: string } }>('/api/wallet/withdraw/:id', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const res = await db.query(
      `SELECT id, direction, amount_ton, amount_usd, tx_hash, to_address, status, error, created_at, confirmed_at
         FROM ton_transactions WHERE id=$1 AND user_id=$2`,
      [id, userId],
    );
    if (res.rows.length === 0) return reply.code(404).send({ error: 'not_found' });
    return res.rows[0];
  });
}