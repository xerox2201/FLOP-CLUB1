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
  const sqlPath = path.join(__dirname, '031_referral_earnings_unique_fix.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 031 applied');

  const idx = await db.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'referral_earnings'
    ORDER BY indexname
  `);
  for (const r of idx.rows) {
    console.log(`   ${r.indexname}`);
  }
  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
