import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

async function main() {
  const db = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://poker:pokerpass@localhost:5432/poker',
  });

  console.log('▶ Running migration 013_admin_panel.sql');

  const sql = readFileSync(join(__dirname, '013_admin_panel.sql'), 'utf8');
  await db.query(sql);

  console.log('✅ Migration 013 done');

  await db.end();
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});