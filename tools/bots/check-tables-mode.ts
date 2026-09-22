import { Pool } from 'pg';
import 'dotenv/config';

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  console.log('═══ All poker_tables ═══\n');
  const r = await db.query(`
    SELECT id, name, variant, mode, is_active
    FROM poker_tables
    ORDER BY id
  `);
  console.table(r.rows);

  console.log('\n═══ Tables with mode=cash ═══');
  const cash = await db.query(
    `SELECT id, name, mode FROM poker_tables WHERE mode = 'cash'`,
  );
  console.table(cash.rows);

  console.log('\n═══ Tables named "Free*" but mode != "free" ═══');
  const mismatched = await db.query(
    `SELECT id, name, mode FROM poker_tables
     WHERE name ILIKE 'free%' AND mode != 'free'`,
  );
  console.table(mismatched.rows);

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});