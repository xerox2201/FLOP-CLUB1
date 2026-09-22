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
    process.env.DATABASE_URL ||
    'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  const sqlPath = path.join(__dirname, '016_user_stats_reset.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);

  await db.query(sql);
  console.log('✅ Migration 016 applied');

  const cols = await db.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'user_stats_reset'
     ORDER BY ordinal_position`,
  );
  console.log('\n📋 Columns:');
  for (const r of cols.rows) {
    console.log(`   - ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`);
  }

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});