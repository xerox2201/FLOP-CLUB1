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
  const sqlPath = path.join(__dirname, '022_freeroll.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 022 applied');

  const t = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('freeroll_config','freeroll_history') ORDER BY table_name`,
  );
  console.log('📋 Tables:', t.rows.map((r) => r.table_name));

  const c = await db.query('SELECT * FROM freeroll_config WHERE id = 1');
  console.log('📋 Config:', c.rows[0]);

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});