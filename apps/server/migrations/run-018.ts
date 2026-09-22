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

const TABLES = [
  'user_xp',
  'user_tier',
  'rakeback_log',
  'xp_transactions',
  'shop_purchases',
  'vouchers',
  'seeds',
];

async function main() {
  const sqlPath = path.join(__dirname, '018_loyalty.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);

  await db.query(sql);
  console.log('✅ Migration 018 applied\n');

  console.log('═══ Verification ═══\n');

  for (const t of TABLES) {
    const cols = await db.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1 ORDER BY ordinal_position`,
      [t],
    );
    const idx = await db.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`,
      [t],
    );
    const fks = await db.query(
      `SELECT
         tc.constraint_name,
         kcu.column_name,
         ccu.table_name AS foreign_table,
         ccu.column_name AS foreign_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'`,
      [t],
    );

    console.log(`📋 ${t}`);
    console.log(`   Columns: ${cols.rows.map((r) => r.column_name).join(', ')}`);
    console.log(
      `   Indexes: ${idx.rows.map((r) => r.indexname).join(', ') || '(none)'}`,
    );
    if (fks.rows.length > 0) {
      console.log(
        `   FKs:     ${fks.rows.map((r) => `${r.column_name}→${r.foreign_table}.${r.foreign_column}`).join(', ')}`,
      );
    }
    console.log('');
  }

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});