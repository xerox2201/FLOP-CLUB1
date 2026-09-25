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
  const sqlPath = path.join(__dirname, '026_template_rebuy_addon.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 026 applied');

  const check = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'tournament_templates'
       AND column_name IN ('allow_rebuy','max_rebuys','rebuy_amount','rebuy_stack',
                           'rebuy_until_level','allow_addon','addon_amount',
                           'addon_stack','addon_at_level')
     ORDER BY column_name`,
  );
  console.log(
    '📋 Columns:',
    check.rows.map((r) => r.column_name),
  );
  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
