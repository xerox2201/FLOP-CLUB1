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
  const sqlPath = path.join(__dirname, '025_exchange_rate_cache.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 025 applied');

  const check = await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'exchange_rates_cache' ORDER BY ordinal_position`,
  );
  console.log(
    '📋 Columns:',
    check.rows.map((r) => `${r.column_name}(${r.data_type})`),
  );
  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
