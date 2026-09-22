import { Pool } from 'pg';
import 'dotenv/config';

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  console.log('▶ Fixing table modes...\n');

  // mode='cash' → 'real'
  const r1 = await db.query(
    `UPDATE poker_tables SET mode = 'real' WHERE mode = 'cash' RETURNING id, name`,
  );
  console.log(`✅ ${r1.rowCount} tables updated from 'cash' → 'real'`);
  for (const row of r1.rows) console.log(`   #${row.id} ${row.name}`);

  // "Free Omaha4" id=7 → should be free
  const r2 = await db.query(
    `UPDATE poker_tables SET mode = 'free' WHERE id = 7 AND name ILIKE 'Free%' RETURNING id, name, mode`,
  );
  if (r2.rowCount > 0) {
    console.log(`\n✅ Fixed "Free" table that was marked real:`);
    for (const row of r2.rows) console.log(`   #${row.id} ${row.name} → ${row.mode}`);
  }

  // Show all tables
  const all = await db.query(
    `SELECT id, name, variant, mode, is_active FROM poker_tables ORDER BY id`,
  );
  console.log('\n═══ All tables ═══\n');
  console.table(all.rows);

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});