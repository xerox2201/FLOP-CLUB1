 import { Pool } from 'pg';

export type LedgerKind =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'CASH_GAME_BUY_IN'
  | 'CASH_GAME_CASH_OUT'
  | 'HAND_WIN'
  | 'HAND_LOSS'
  | 'RAKE'
  | 'TOURNAMENT_ENTRY'
  | 'TOURNAMENT_REFUND'
  | 'TOURNAMENT_PRIZE'
  | 'REBUY'
  | 'BONUS'
  | 'REFERRAL'
  | 'ADMIN_ADJUSTMENT'
  | 'REVERSAL';

export interface LedgerEntry {
  accountId: number;
  amount: number;
}

export interface LedgerTransactionInput {
  kind: LedgerKind;
  ref?: string;
  meta?: Record<string, any>;
  entries: LedgerEntry[];
  idempotencyKey?: string;
  userId?: number;
}

export interface LedgerResult {
  ok: boolean;
  transactionId?: number;
  error?: string;
  duplicate?: boolean;
}

export class LedgerService {
  constructor(private db: Pool) {}

  /**
   * ثبت یک تراکنش مالی
   * - جمع همه‌ی amount ها باید صفر باشه
   * - اگه idempotencyKey تکراری باشه، تراکنش دوباره ثبت نمیشه
   */
  async record(input: LedgerTransactionInput): Promise<LedgerResult> {
    const sum = input.entries.reduce((s, e) => s + e.amount, 0);
    if (Math.abs(sum) > 0.001) {
      return { ok: false, error: `Ledger mismatch: sum=${sum}` };
    }

    if (input.entries.length === 0) {
      return { ok: false, error: 'No entries' };
    }

    if (input.idempotencyKey) {
      const existing = await this.db.query(
        'SELECT result FROM idempotency_keys WHERE key = $1',
        [input.idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return {
          ok: true,
          duplicate: true,
          transactionId: existing.rows[0].result?.transactionId,
        };
      }
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const ids = [...new Set(input.entries.map(e => e.accountId))].sort((a, b) => a - b);
      for (const id of ids) {
        await client.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [id]);
      }

      const txRes = await client.query(
        `INSERT INTO transactions (kind, ref, meta, status, user_id, idempotency_key, amount, completed_at)
         VALUES ($1, $2, $3, 'completed', $4, $5, $6, NOW())
         RETURNING id`,
        [
          input.kind,
          input.ref || null,
          JSON.stringify(input.meta || {}),
          input.userId || null,
          input.idempotencyKey || null,
          Math.abs(input.entries.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0)),
        ]
      );
      const txId = txRes.rows[0].id;

      for (const entry of input.entries) {
        await client.query(
          `INSERT INTO entries (tx_id, account_id, amount, currency)
           VALUES ($1, $2, $3, 'USD')`,
          [txId, entry.accountId, entry.amount]
        );
      }

      for (const entry of input.entries) {
        const accRes = await client.query('SELECT owner_user_id FROM accounts WHERE id = $1', [entry.accountId]);
        const userId = accRes.rows[0]?.owner_user_id;
        if (userId) {
          await client.query(
            `UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = NOW() WHERE user_id = $2`,
            [entry.amount, userId]
          );
        }
      }

      if (input.idempotencyKey) {
        await client.query(
          `INSERT INTO idempotency_keys (key, user_id, result)
           VALUES ($1, $2, $3)`,
          [input.idempotencyKey, input.userId || null, JSON.stringify({ transactionId: txId })]
        );
      }

      await client.query('COMMIT');
      return { ok: true, transactionId: txId };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return { ok: false, error: e.message };
    } finally {
      client.release();
    }
  }

  async getBalance(accountId: number): Promise<number> {
    const res = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS balance FROM entries WHERE account_id = $1`,
      [accountId]
    );
    return Number(res.rows[0].balance);
  }

  async getAccountId(code: string): Promise<number | null> {
    const res = await this.db.query('SELECT id FROM accounts WHERE code = $1', [code]);
    return res.rows[0]?.id ?? null;
  }

  async getUserAccountId(userId: number): Promise<number | null> {
    return this.getAccountId(`USER_${userId}`);
  }

  async getHistory(userId: number, limit = 50, offset = 0) {
    const accountId = await this.getUserAccountId(userId);
    if (!accountId) return [];

    const res = await this.db.query(
      `SELECT 
        e.id, e.amount, e.currency, e.created_at,
        t.kind, t.ref, t.meta, t.status
       FROM entries e
       JOIN transactions t ON t.id = e.tx_id
       WHERE e.account_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );
    return res.rows;
  }
}