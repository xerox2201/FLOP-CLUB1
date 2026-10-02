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
  const sqlPath = path.join(__dirname, '036_fair_part_c.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('Running:', sqlPath);
  await db.query(sql);
  console.log('[036] Migration 036 applied');

  const tables = await db.query(
    `SELECT id, name, hand_sequence,
            (SELECT MAX(hand_no) FROM hands WHERE table_id = pt.id) AS max_hand_no
     FROM poker_tables pt ORDER BY id`,
  );
  console.log('[036] hand_sequence backfill:');
  for (const r of tables.rows) {
    console.log(
      `  table ${r.id} (${r.name}): hand_sequence=${r.hand_sequence} max_hand_no=${r.max_hand_no}`,
    );
  }

  const cols = await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'hand_seeds' ORDER BY ordinal_position`,
  );
  console.log(
    '[036] hand_seeds columns:',
    cols.rows.map((r: any) => `${r.column_name}:${r.data_type}`).join(', '),
  );

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
