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
  const sqlPath = path.join(__dirname, '023_anti_abuse.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 023 applied');

  const c1 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='freeroll_config'
       AND column_name IN ('launch_grace_until','grace_min_prize_usd')`,
  );
  console.log('📋 freeroll_config:', c1.rows.map((r) => r.column_name));

  const c2 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='users'
       AND column_name IN ('first_withdrawal_unlocked','first_withdrawal_at')`,
  );
  console.log('📋 users:', c2.rows.map((r) => r.column_name));

  const c3 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='tournaments'
       AND column_name LIKE '%rebuy%' OR column_name LIKE '%addon%'`,
  );
  console.log('📋 tournaments:', c3.rows.map((r) => r.column_name));

  const cfg = await db.query('SELECT * FROM freeroll_config WHERE id = 1');
  console.log('📋 Freeroll config:', cfg.rows[0]);

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});