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
  const sql = fs.readFileSync(path.join(__dirname, '009_reentry_bounty.sql'), 'utf-8');
  await db.query(sql);
  console.log('✅ Migration 009 applied');

  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='tournaments'
       AND column_name IN ('allow_re_entry','max_re_entries','is_bounty','bounty_amount')`,
  );
  console.log('Tournaments columns:', cols.rows.map((r) => r.column_name));

  const cols2 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='tournament_entries' AND column_name='re_entry_count'`,
  );
  console.log('Entries re_entry_count:', cols2.rows.length > 0);

  const cols3 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='tournament_players'
       AND column_name IN ('bounty_earned','eliminated_by')`,
  );
  console.log('Players columns:', cols3.rows.map((r) => r.column_name));

  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });