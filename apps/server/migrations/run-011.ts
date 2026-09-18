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
  const sql = fs.readFileSync(path.join(__dirname, '011_tournament_templates.sql'), 'utf-8');
  await db.query(sql);
  console.log('✅ Migration 011 applied');

  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='tournament_templates' ORDER BY ordinal_position`,
  );
  console.log('tournament_templates cols:', cols.rows.map((r) => r.column_name).join(', '));

  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });