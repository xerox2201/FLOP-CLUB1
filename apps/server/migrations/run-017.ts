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
  const sqlPath = path.join(__dirname, '017_free_stats.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);

  await db.query(sql);
  console.log('✅ Migration 017 applied');

  const cols = await db.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'free_chips' ORDER BY ordinal_position`,
  );
  console.log('\n📋 free_chips columns:');
  for (const r of cols.rows) console.log(`   - ${r.column_name} (${r.data_type})`);

  const sample = await db.query(
    `SELECT user_id, chips, total_hands, free_won, free_hands_won FROM free_chips LIMIT 5`,
  );
  console.log('\n📋 Sample data:');
  console.table(sample.rows);

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});