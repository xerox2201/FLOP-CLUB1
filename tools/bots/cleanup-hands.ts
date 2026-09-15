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
  console.log('Cleaning up duplicate tables...\n');

  // Deactivate duplicate tables (keep only lowest id per name+variant+mode)
  const res = await db.query(`
    UPDATE poker_tables pt
    SET is_active = FALSE
    WHERE pt.id NOT IN (
      SELECT MIN(id) FROM poker_tables
      GROUP BY name, variant, mode
    )
  `);
  console.log(`✅ Deactivated ${res.rowCount} duplicate tables`);

  // Show active tables
  const active = await db.query(
    `SELECT id, name, variant, mode FROM poker_tables WHERE is_active = TRUE ORDER BY id`,
  );
  console.log('\nActive tables:');
  for (const row of active.rows) {
    console.log(`  id=${row.id} | ${row.name} | ${row.variant} | ${row.mode}`);
  }

  await db.end();
  console.log('\n✅ Done');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
