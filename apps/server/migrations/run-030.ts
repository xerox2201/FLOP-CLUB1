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
  const sqlPath = path.join(__dirname, '030_referral_polish.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 030 applied');

  const c1 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='rakeback_log' AND column_name='rake_share'`,
  );
  console.log(`📋 rakeback_log.rake_share: ${c1.rows.length > 0 ? '✅' : '❌'}`);

  const c2 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='referral_edges'
       AND column_name IN ('last_active_at','total_rake_from','total_earned_for_referrer')`,
  );
  console.log(`📋 referral_edges new cols: ${c2.rows.map((r: any) => r.column_name).join(', ')}`);

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
