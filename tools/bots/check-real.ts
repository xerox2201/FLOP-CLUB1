import { Pool } from 'pg';
import 'dotenv/config';

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  console.log('═══ Last 10 hands ═══\n');
  const hands = await db.query(`
    SELECT id, hand_no, mode, table_id, finished, pot
    FROM hands
    WHERE finished = TRUE
    ORDER BY id DESC
    LIMIT 10
  `);
  console.table(hands.rows);

  console.log('\n═══ Real tables ═══\n');
  const realTables = await db.query(`
    SELECT id, name, variant, mode, is_active
    FROM poker_tables
    WHERE mode IN ('real', 'cash')
    ORDER BY id
  `);
  console.table(realTables.rows);

  console.log('\n═══ Ali payouts on REAL tables ═══\n');
  const payouts = await db.query(`
    SELECT
      h.id,
      h.mode,
      h.pot,
      sp->>'displayName' AS player,
      sp->>'payout' AS payout,
      sp->>'isWinner' AS is_winner
    FROM hands h
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(h.result->'showdownPlayers', '[]'::jsonb)
    ) sp
    WHERE h.finished = TRUE
      AND h.mode = 'real'
      AND (sp->>'displayName') = 'Ali'
    ORDER BY h.id DESC
    LIMIT 10
  `);
  console.table(payouts.rows);

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});