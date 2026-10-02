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
  const sqlPath = path.join(__dirname, '035_provably_fair.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('Running:', sqlPath);
  await db.query(sql);
  console.log('[035] Migration 035 applied');

  const cols = await db.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_name = 'hand_seeds' ORDER BY ordinal_position`,
  );
  console.log(
    '[035] Columns:',
    cols.rows
      .map((r: any) => `${r.column_name}:${r.data_type}${r.is_nullable === 'NO' ? '!' : ''}`)
      .join(', '),
  );

  const idx = await db.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'hand_seeds' ORDER BY indexname`,
  );
  console.log('[035] Indexes:', idx.rows.map((r: any) => r.indexname).join(', '));

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
