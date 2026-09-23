import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  const sqlPath = path.join(__dirname, '021_withdrawal_conditions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 021 applied');

  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='users' AND column_name LIKE 'bonus_%' OR column_name='last_daily_refill_at'`,
  );
  console.log('📋 Columns:', cols.rows.map(r => r.column_name));
  await db.end();
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });