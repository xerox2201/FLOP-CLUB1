import { Pool } from 'pg';
import 'dotenv/config';

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  console.log('═══ 1. Table exists? ═══');
  const t = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'user_stats_reset'
    ) AS exists
  `);
  console.log('  ', t.rows[0]);

  console.log('\n═══ 2. Columns ═══');
  const c = await db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'user_stats_reset'
    ORDER BY ordinal_position
  `);
  console.table(c.rows);

  console.log('\n═══ 3. FK to users ═══');
  const fk = await db.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'user_stats_reset'
      AND tc.constraint_type = 'FOREIGN KEY'
  `);
  console.table(fk.rows);

  console.log('\n═══ 4. Current rows ═══');
  const r = await db.query(`SELECT * FROM user_stats_reset ORDER BY user_id`);
  console.table(r.rows);

  console.log('\n═══ 5. Ali (uid=111) → db user id ═══');
  const ali = await db.query(
    `SELECT id, telegram_id, display_name FROM users WHERE telegram_id = 111`,
  );
  console.table(ali.rows);

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});