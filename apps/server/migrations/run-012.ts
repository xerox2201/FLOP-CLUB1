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
  const sql = fs.readFileSync(path.join(__dirname, '012_seasons.sql'), 'utf-8');
  await db.query(sql);
  console.log('✅ Migration 012 applied');

  const c1 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='seasons' ORDER BY ordinal_position`,
  );
  console.log('seasons cols:', c1.rows.map((r) => r.column_name).join(', '));

  const c2 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='tournament_entries' AND column_name='points_earned'`,
  );
  console.log('points_earned exists:', c2.rows.length > 0);

  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });