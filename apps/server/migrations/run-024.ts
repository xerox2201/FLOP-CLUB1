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
  const sqlPath = path.join(__dirname, '024_idempotency_scope_pk.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 024 applied');

  const pk = await db.query(
    `SELECT a.attname
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = 'idempotency_keys'::regclass AND i.indisprimary`,
  );
  console.log(
    '📋 Primary key columns:',
    pk.rows.map((r) => r.attname),
  );
  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
