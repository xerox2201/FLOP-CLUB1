import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  const sqlPath = path.join(__dirname, '027_wallets_from_ledger.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);

  await db.query(sql);
  console.log('✅ Migration 027 applied');

  // Verify: wallets should match ledger
  const mismatch = await db.query(`
    SELECT COUNT(*)::int AS n
    FROM wallets w
    WHERE EXISTS (SELECT 1 FROM accounts a WHERE a.owner_user_id = w.user_id)
      AND COALESCE(w.balance_usd, 0) <> COALESCE((
        SELECT SUM(e.amount) FROM entries e
        JOIN accounts a ON a.id = e.account_id
        WHERE a.owner_user_id = w.user_id
      ), 0)
  `);
  console.log(`📊 Wallets still out of sync: ${mismatch.rows[0].n}`);

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
