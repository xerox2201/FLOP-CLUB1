import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker';

async function main() {
  const db = new Pool({ connectionString: DATABASE_URL });

  console.log('\n=== BLIND STRUCTURES ===');
  const s = await db.query(
    'SELECT id, name, starting_stack, is_turbo, is_hyper FROM blind_structures ORDER BY id',
  );
  console.table(s.rows);

  console.log('\n=== BLIND LEVELS COUNT ===');
  const l = await db.query(
    'SELECT structure_id, COUNT(*) as level_count, MIN(small_blind) as min_sb, MAX(big_blind) as max_bb FROM blind_levels GROUP BY structure_id ORDER BY structure_id',
  );
  console.table(l.rows);

  console.log('\n=== SAMPLE LEVELS (Structure 1) ===');
  const lv = await db.query(
    'SELECT level, small_blind, big_blind, ante, duration_sec, is_break FROM blind_levels WHERE structure_id = 1 ORDER BY level LIMIT 10',
  );
  console.table(lv.rows);

  console.log('\n=== TOURNAMENTS TABLE ===');
  const t = await db.query('SELECT COUNT(*) FROM tournaments');
  console.log(`Tournaments count: ${t.rows[0].count}`);

  await db.end();
  console.log('\n✅ Done');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
