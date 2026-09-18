import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  console.log('════════ Tournament columns ════════');
  const t = await db.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'tournaments'
    ORDER BY ordinal_position
  `);
  for (const r of t.rows) {
    console.log(`  ${r.column_name}  (${r.data_type})  default=${r.column_default ?? '-'}`);
  }

  console.log('\n════════ Blind levels — is_break column ════════');
  const b = await db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'blind_levels'
    ORDER BY ordinal_position
  `);
  for (const r of b.rows) {
    console.log(`  ${r.column_name}  (${r.data_type})`);
  }

  console.log('\n════════ Blind levels — sample (structure 1) ════════');
  const lv = await db.query(`
    SELECT level, small_blind, big_blind, ante, duration_sec, is_break
    FROM blind_levels WHERE structure_id = 1 ORDER BY level ASC LIMIT 15
  `);
  for (const r of lv.rows) {
    console.log(
      `  L${r.level}: ${r.small_blind}/${r.big_blind}${r.ante ? '+'+r.ante : ''} ${r.duration_sec}s break=${r.is_break}`,
    );
  }

  console.log('\n════════ Tournaments — late_reg_level column ════════');
  const t2 = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'late_reg_level'
  `);
  console.log(t2.rows.length > 0 ? '  ✅ column exists' : '  ❌ column MISSING');

  await db.end();
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  try { await db.end(); } catch {}
  process.exit(1);
});