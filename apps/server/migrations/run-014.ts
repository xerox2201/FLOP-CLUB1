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

  console.log('▶ Running migration 014_achievements.sql');
  const sql = readFileSync(join(__dirname, '014_achievements.sql'), 'utf8');
  await db.query(sql);
  console.log('✅ Migration 014 done');
  await db.end();
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});