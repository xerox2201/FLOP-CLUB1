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
  const sql = fs.readFileSync(path.join(__dirname, '010_satellites.sql'), 'utf-8');
  await db.query(sql);
  console.log('✅ Migration 010 applied');

  const c1 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='tournaments' AND column_name IN ('satellite_target_id','seats_awarded')`,
  );
  console.log('Tournaments cols:', c1.rows.map((r) => r.column_name));

  const c2 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='satellite_tickets' ORDER BY ordinal_position`,
  );
  console.log('satellite_tickets cols:', c2.rows.map((r) => r.column_name));

  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });