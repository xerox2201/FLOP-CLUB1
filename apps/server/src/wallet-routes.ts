import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { LedgerService } from './ledger.js';
import { tonAdapter } from './ton.js';
import { levelFromLifetimeXP } from './loyalty/definitions.js';
import { getPriceOracle } from './price-oracle.js';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const TON_DEPOSIT_ADDRESS = process.env.TON_DEPOSIT_ADDRESS || '';
const TON_MIN_WITHDRAW = Number(process.env.TON_MIN_WITHDRAW || 1.0);
const TON_WITHDRAW_FEE = 0.05; // flat fee — always

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  return payload?.uid ?? null;
}

export async function registerWalletRoutes(app: FastifyInstance, db: Pool): Promise<void> {
  const ledger = new LedgerService(db);
  const oracle = getPriceOracle();
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
      const xpRow = await db.query('SELECT lifetime_xp FROM user_xp WHERE user_id = $1', [userId]);
      const level = levelFromLifetimeXP(Number(xpRow.rows[0]?.lifetime_xp ?? 0)).level;

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
      // First-withdrawal anti-abuse conditions
      const firstWd = await db.query(
        `SELECT
           u.first_withdrawal_unlocked,
           u.created_at AS account_created,
           (SELECT COALESCE(SUM(amount_usd), 0)::numeric
              FROM ton_transactions
              WHERE user_id = u.id AND direction='deposit' AND status='confirmed'
           ) AS lifetime_deposit_usd,
           (SELECT MAX(confirmed_at)
              FROM ton_transactions
              WHERE user_id = u.id AND direction='deposit' AND status='confirmed'
           ) AS last_deposit_at,
           COALESCE(ut.lifetime_rake, 0)::numeric AS lifetime_rake_usd,
           (SELECT COALESCE(SUM(amount), 0)::numeric
              FROM rakeback_log WHERE user_id = u.id
           ) AS lifetime_rakeback_usd
         FROM users u
         LEFT JOIN user_tier ut ON ut.user_id = u.id
         WHERE u.id = $1`,
        [userId],
      );
      const fw = firstWd.rows[0] || {};

      const lifetimeDepositUsd = Number(fw.lifetime_deposit_usd ?? 0);
      const lifetimeRakeUsd = Number(fw.lifetime_rake_usd ?? 0);
      const accountAgeHours = (Date.now() - new Date(fw.account_created).getTime()) / 3_600_000;
      const depositAgeHours = fw.last_deposit_at
        ? (Date.now() - new Date(fw.last_deposit_at).getTime()) / 3_600_000
        : 0;

      // Real hands played (reset-aware)
      const handsRes = await db.query(
        `SELECT COUNT(*)::int AS hands
         FROM hands h
         JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
         WHERE h.finished = TRUE AND h.mode = 'real'
           AND h.ended_at > COALESCE(
             (SELECT reset_at FROM user_stats_reset WHERE user_id = $1),
             '1970-01-01'::timestamptz)
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(hs.state->'players') p
             WHERE (p->>'userId')::bigint = $1
           )`,
        [userId],
      );
      const realHandsPlayed = Number(handsRes.rows[0]?.hands ?? 0);

      const ANTI_ABUSE = {
        minDeposit: 5,
        minRake: 0.5,
        minHands: 20,
        minAccountAgeH: 24,
        minDepositAgeH: 6,
      };

      const antiAbuseChecks = {
        alreadyUnlocked: !!fw.first_withdrawal_unlocked,
        depositOk: lifetimeDepositUsd >= ANTI_ABUSE.minDeposit,
        rakeOk: lifetimeRakeUsd >= ANTI_ABUSE.minRake,
        handsOk: realHandsPlayed >= ANTI_ABUSE.minHands,
        accountAgeOk: accountAgeHours >= ANTI_ABUSE.minAccountAgeH,
        depositAgeOk: depositAgeHours >= ANTI_ABUSE.minDepositAgeH,
      };

      // 🔴 Auto-unlock: as soon as all 5 conditions pass, verify permanently.
      //    This lets us hide the checklist from view without waiting for the
      //    user to attempt a withdrawal.
      let justUnlocked = false;
      if (!antiAbuseChecks.alreadyUnlocked) {
        const allMet =
          antiAbuseChecks.depositOk &&
          antiAbuseChecks.rakeOk &&
          antiAbuseChecks.handsOk &&
          antiAbuseChecks.accountAgeOk &&
          antiAbuseChecks.depositAgeOk;

        if (allMet) {
          try {
            const upd = await db.query(
              `UPDATE users
               SET first_withdrawal_unlocked = TRUE,
                   first_withdrawal_at = NOW()
               WHERE id = $1 AND first_withdrawal_unlocked = FALSE
               RETURNING id`,
              [userId],
            );
            antiAbuseChecks.alreadyUnlocked = true;
            if ((upd.rowCount ?? 0) > 0) {
              justUnlocked = true;
              console.log(`[wallet] 🔓 auto-unlocked first withdrawal: user=${userId}`);
            }
          } catch (e: any) {
            console.error('[wallet] auto-unlock failed:', e.message);
          }
        }
      }

      const antiAbuseMet =
        antiAbuseChecks.alreadyUnlocked ||
        (antiAbuseChecks.depositOk &&
          antiAbuseChecks.rakeOk &&
          antiAbuseChecks.handsOk &&
          antiAbuseChecks.accountAgeOk &&
          antiAbuseChecks.depositAgeOk);
      const bonusConditionsMet =
        playthroughRemaining <= 0 &&
        rakeRemaining <= 0 &&
        handsRemaining <= 0 &&
        waitDaysRemaining <= 0;

      const conditionsMet = bonusConditionsMet && antiAbuseMet;

      const bonusLocked = conditionsMet ? 0 : Number(p.bonus_playthrough_pending ?? 0);
      const availableBalance = Math.max(0, balance - bonusLocked);

      const tonPriceUsd = (await oracle.tryGetTonUsd()) ?? 0;
      if (tonPriceUsd <= 0) {
        return reply.code(503).send({ error: 'price_unavailable' });
      }
      const minWithdrawUsd = TON_MIN_WITHDRAW * tonPriceUsd;
      const feeUsd = TON_WITHDRAW_FEE * tonPriceUsd;

      const canWithdraw =
        conditionsMet && availableBalance >= minWithdrawUsd + feeUsd && tonAdapter.isReady();

      return {
        balance,
        availableBalance,
        bonusLocked,
        minWithdrawUsd,
        minWithdrawTon: TON_MIN_WITHDRAW,
        feeTon: TON_WITHDRAW_FEE,
        feeUsd,
        tonPriceUsd,
        level,
        conditionsMet,
        bonusConditionsMet,
        antiAbuseMet,
        antiAbuse: {
          alreadyUnlocked: antiAbuseChecks.alreadyUnlocked,
          justUnlocked,
          checks: antiAbuseChecks,
          current: {
            lifetimeDepositUsd,
            lifetimeRakeUsd,
            realHandsPlayed,
            accountAgeHours: Math.round(accountAgeHours * 10) / 10,
            depositAgeHours: Math.round(depositAgeHours * 10) / 10,
          },
          required: ANTI_ABUSE,
        },
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
          const daysSince = (Date.now() - new Date(pending.bonus_received_at).getTime()) / 86400000;
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
        // Anti-abuse first-withdrawal gate
        const fw = await db.query(
          `SELECT
             u.first_withdrawal_unlocked,
             u.created_at AS account_created,
             (SELECT COALESCE(SUM(amount_usd), 0)::numeric
                FROM ton_transactions
                WHERE user_id = u.id AND direction='deposit' AND status='confirmed'
             ) AS lifetime_deposit_usd,
             (SELECT MAX(confirmed_at)
                FROM ton_transactions
                WHERE user_id = u.id AND direction='deposit' AND status='confirmed'
             ) AS last_deposit_at,
             COALESCE(ut.lifetime_rake, 0)::numeric AS lifetime_rake_usd
           FROM users u
           LEFT JOIN user_tier ut ON ut.user_id = u.id
           WHERE u.id = $1`,
          [userId],
        );
        const fwRow = fw.rows[0] || {};

        if (!fwRow.first_withdrawal_unlocked) {
          const depositUsd = Number(fwRow.lifetime_deposit_usd ?? 0);
          const rakeUsd = Number(fwRow.lifetime_rake_usd ?? 0);
          const accAgeH = (Date.now() - new Date(fwRow.account_created).getTime()) / 3_600_000;
          const depAgeH = fwRow.last_deposit_at
            ? (Date.now() - new Date(fwRow.last_deposit_at).getTime()) / 3_600_000
            : 0;

          const handsQ = await db.query(
            `SELECT COUNT(*)::int AS hands
             FROM hands h
             JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
             WHERE h.finished = TRUE AND h.mode = 'real'
               AND h.ended_at > COALESCE(
                 (SELECT reset_at FROM user_stats_reset WHERE user_id = $1),
                 '1970-01-01'::timestamptz)
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(hs.state->'players') p
                 WHERE (p->>'userId')::bigint = $1
               )`,
            [userId],
          );
          const handsN = Number(handsQ.rows[0]?.hands ?? 0);

          const missing: string[] = [];
          if (depositUsd < 5) missing.push('lifetime_deposit_5usd');
          if (rakeUsd < 0.5) missing.push('lifetime_rake_0_50usd');
          if (handsN < 20) missing.push('real_hands_20');
          if (accAgeH < 24) missing.push('account_age_24h');
          if (depAgeH < 6) missing.push('deposit_age_6h');

          if (missing.length > 0) {
            return reply.code(400).send({
              error: 'first_withdrawal_locked',
              missing,
              current: {
                lifetimeDepositUsd: depositUsd,
                lifetimeRakeUsd: rakeUsd,
                realHandsPlayed: handsN,
                accountAgeHours: Math.round(accAgeH * 10) / 10,
                depositAgeHours: Math.round(depAgeH * 10) / 10,
              },
            });
          }

          // All conditions met — unlock now
          await db.query(
            `UPDATE users SET first_withdrawal_unlocked = TRUE,
                              first_withdrawal_at = NOW()
             WHERE id = $1`,
            [userId],
          );
        }
        let tonUsdRate: number;
        try {
          tonUsdRate = await oracle.getTonUsd();
        } catch (e: any) {
          console.error('[wallet] withdraw aborted — price oracle unavailable:', e.message);
          return reply.code(503).send({ error: 'price_unavailable' });
        }

        const amountUsd = amountTon * tonUsdRate;
        const feeUsd = TON_WITHDRAW_FEE * tonUsdRate;
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
            const txHash = await tonAdapter.sendTon(toAddress, amountTon - TON_WITHDRAW_FEE);
            await db.query(
              `UPDATE ton_transactions SET status='processing', tx_hash=$1 WHERE id=$2`,
              [txHash, txId],
            );
            console.log(
              `[wallet] ✅ withdraw sent: user=${userId} amount=${amountTon} TON tx=${txHash}`,
            );
          } catch (e: any) {
            console.error('[wallet] withdraw send failed:', e.message);
            await db.query(`UPDATE ton_transactions SET status='failed', error=$1 WHERE id=$2`, [
              e.message,
              txId,
            ]);
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
