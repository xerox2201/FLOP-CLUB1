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
  const sqlPath = path.join(__dirname, '033_bad_beat_missions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('Running:', sqlPath);
  await db.query(sql);
  console.log('[033] Migration 033 applied');

  const tables = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('bad_beat_pool','bad_beat_payouts','missions','mission_progress')
     ORDER BY table_name`,
  );
  console.log('[033] Tables:', tables.rows.map((r: any) => r.table_name).join(', '));

  const seeded = await db.query(
    'SELECT code, metric, threshold, reward_chips, reward_xp FROM missions ORDER BY id',
  );
  for (const r of seeded.rows) {
    console.log(
      `[033] mission ${r.code} metric=${r.metric} threshold=${r.threshold} chips=${r.reward_chips} xp=${r.reward_xp}`,
    );
  }

  const poolRow = await db.query('SELECT id, amount_usd FROM bad_beat_pool');
  console.log('[033] bad_beat_pool rows:', JSON.stringify(poolRow.rows));

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
