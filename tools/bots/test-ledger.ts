console.log('hello');
import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker';

// ===== Copy of LedgerService =====
class LedgerService {
  constructor(private db: Pool) {}

  async record(input: any): Promise<any> {
    const sum = input.entries.reduce((s: number, e: any) => s + e.amount, 0);
    if (Math.abs(sum) > 0.001) {
      return { ok: false, error: `Ledger mismatch: sum=${sum}` };
    }
    if (input.entries.length === 0) {
      return { ok: false, error: 'No entries' };
    }

    if (input.idempotencyKey) {
      const existing = await this.db.query('SELECT result FROM idempotency_keys WHERE key = $1', [
        input.idempotencyKey,
      ]);
      if (existing.rows.length > 0) {
        return { ok: true, duplicate: true, transactionId: existing.rows[0].result?.transactionId };
      }
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const ids = [...new Set(input.entries.map((e: any) => e.accountId))].sort(
        (a: any, b: any) => a - b,
      );
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
          Math.abs(
            input.entries.reduce((s: number, e: any) => s + (e.amount > 0 ? e.amount : 0), 0),
          ),
        ],
      );
      const txId = txRes.rows[0].id;

      for (const entry of input.entries) {
        await client.query(
          `INSERT INTO entries (tx_id, account_id, amount, currency) VALUES ($1, $2, $3, 'USD')`,
          [txId, entry.accountId, entry.amount],
        );
      }

      for (const entry of input.entries) {
        const accRes = await client.query('SELECT owner_user_id FROM accounts WHERE id = $1', [
          entry.accountId,
        ]);
        const userId = accRes.rows[0]?.owner_user_id;
        if (userId) {
          await client.query(
            `UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = NOW() WHERE user_id = $2`,
            [entry.amount, userId],
          );
        }
      }

      if (input.idempotencyKey) {
        await client.query(
          `INSERT INTO idempotency_keys (key, user_id, result) VALUES ($1, $2, $3)`,
          [input.idempotencyKey, input.userId || null, JSON.stringify({ transactionId: txId })],
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
      [accountId],
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
      `SELECT e.id, e.amount, e.currency, e.created_at, t.kind, t.ref, t.meta, t.status
       FROM entries e JOIN transactions t ON t.id = e.tx_id
       WHERE e.account_id = $1 ORDER BY e.created_at DESC LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );
    return res.rows;
  }
}

// ===== TEST =====
async function main() {
  const db = new Pool({ connectionString: DATABASE_URL });
  const ledger = new LedgerService(db);

  console.log('Testing Ledger Service\n');

  const userRes = await db.query('SELECT id FROM users LIMIT 1');
  if (userRes.rows.length === 0) {
    console.log('No users found');
    process.exit(1);
  }
  const userId = userRes.rows[0].id;
  console.log(`Using test user: id=${userId}`);

  const userAcc = await ledger.getUserAccountId(userId);
  const depositAcc = await ledger.getAccountId('SYSTEM_DEPOSITS');
  const rakeAcc = await ledger.getAccountId('HOUSE_RAKE');

  console.log(`User account: ${userAcc}`);
  console.log(`Deposits account: ${depositAcc}`);
  console.log(`Rake account: ${rakeAcc}\n`);

  if (!userAcc || !depositAcc || !rakeAcc) {
    console.log('Missing accounts');
    process.exit(1);
  }

  console.log('TEST 1: Deposit $100');
  const r1 = await ledger.record({
    kind: 'DEPOSIT',
    userId,
    entries: [
      { accountId: depositAcc, amount: -100 },
      { accountId: userAcc, amount: +100 },
    ],
    idempotencyKey: `dep_${userId}_001`,
  });
  console.log('Result:', r1);
  const bal1 = await ledger.getBalance(userAcc);
  console.log(`Balance after deposit: $${bal1}\n`);

  console.log('TEST 2: Duplicate deposit (should be ignored)');
  const r2 = await ledger.record({
    kind: 'DEPOSIT',
    userId,
    entries: [
      { accountId: depositAcc, amount: -100 },
      { accountId: userAcc, amount: +100 },
    ],
    idempotencyKey: `dep_${userId}_001`,
  });
  console.log('Result:', r2);
  const bal2 = await ledger.getBalance(userAcc);
  console.log(`Balance (should be same): $${bal2}\n`);

  console.log('TEST 3: Rake $3');
  const r3 = await ledger.record({
    kind: 'RAKE',
    entries: [
      { accountId: userAcc, amount: -3 },
      { accountId: rakeAcc, amount: +3 },
    ],
    idempotencyKey: `rake_${Date.now()}`,
  });
  console.log('Result:', r3);
  const bal3 = await ledger.getBalance(userAcc);
  console.log(`Balance after rake: $${bal3}`);
  const rakeBal = await ledger.getBalance(rakeAcc);
  console.log(`Rake account: $${rakeBal}\n`);

  console.log('TEST 4: Invalid transaction (sum != 0)');
  const r4 = await ledger.record({
    kind: 'DEPOSIT',
    entries: [
      { accountId: userAcc, amount: +100 },
      { accountId: depositAcc, amount: -50 },
    ],
  });
  console.log('Result (should fail):', r4, '\n');

  console.log('TEST 5: Transaction history');
  const history = await ledger.getHistory(userId, 10);
  console.log(`Found ${history.length} transactions:`);
  for (const h of history) {
    console.log(`  ${h.kind}: ${h.amount} @ ${h.created_at}`);
  }

  await db.end();
  console.log('\nAll tests complete');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
