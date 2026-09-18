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
  const sqlPath = path.join(__dirname, '008_late_reg_level.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('Running:', sqlPath);

  await db.query(sql);
  console.log('✅ Migration applied');

  const check = await db.query(
    `SELECT column_name, data_type, column_default
     FROM information_schema.columns
     WHERE table_name = 'tournaments' AND column_name = 'late_reg_level'`,
  );
  if (check.rows.length > 0) {
    console.log('✅ Column exists:', check.rows[0]);
  } else {
    console.log('❌ Column NOT found');
  }

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});