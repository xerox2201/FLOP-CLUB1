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

  console.log('\n=== HANDS ===');
  const h = await db.query(
    'SELECT id, hand_no, variant, mode, pot, rake, finished, player_count FROM hands ORDER BY id DESC LIMIT 10'
  );
  console.table(h.rows);

  console.log('\n=== COUNTS ===');
  const events = await db.query('SELECT COUNT(*) FROM hand_events');
  const snapshots = await db.query('SELECT COUNT(*) FROM hand_snapshots');
  const hands = await db.query('SELECT COUNT(*) FROM hands');
  console.log(`Hands:     ${hands.rows[0].count}`);
  console.log(`Events:    ${events.rows[0].count}`);
  console.log(`Snapshots: ${snapshots.rows[0].count}`);

  console.log('\n=== LAST 10 EVENTS ===');
  const ev = await db.query(
    'SELECT id, hand_id, sequence, event_type FROM hand_events ORDER BY id DESC LIMIT 10'
  );
  console.table(ev.rows);
  console.log('\n=== HANDS WITH SIDE POTS ===');
  const sp = await db.query(`
    SELECT id, hand_no, pot, rake,
           (SELECT COUNT(*) FROM jsonb_array_elements(result->'sidePots')) as pot_count,
           result->'sidePots' as side_pots
    FROM hands
    WHERE finished = TRUE
      AND result->'sidePots' IS NOT NULL
      AND jsonb_array_length(result->'sidePots') > 1
    ORDER BY id DESC LIMIT 3
  `);
  for (const row of sp.rows) {
    console.log(`Hand #${row.hand_no} (id=${row.id}) pot=$${row.pot}:`);
    for (const p of (row.side_pots || [])) {
      console.log(`  ${p.label}: $${p.amount} (net $${p.netAmount}) - winners: ${p.winnerSeats.join(',')}`);
    }
  }

  console.log('\n=== RAKE TRANSACTIONS ===');
  const t = await db.query(
    "SELECT id, kind, amount, ref, user_id, status FROM transactions WHERE kind = 'RAKE' ORDER BY id DESC LIMIT 10"
  );
  console.table(t.rows);

  console.log('\n=== RAKE ACCOUNT BALANCE ===');
  const rakeAcc = await db.query("SELECT id FROM accounts WHERE code = 'HOUSE_RAKE'");
  if (rakeAcc.rows[0]) {
    const bal = await db.query(
      'SELECT COALESCE(SUM(amount), 0)::numeric AS balance FROM entries WHERE account_id = $1',
      [rakeAcc.rows[0].id]
    );
    console.log(`HOUSE_RAKE balance: $${Number(bal.rows[0].balance).toFixed(2)}`);
  }

  console.log('\n=== TABLE SEATS ===');
  const seats = await db.query(
    'SELECT table_id, seat_index, user_id, stack, status FROM table_seats ORDER BY table_id, seat_index LIMIT 20'
  );
  console.table(seats.rows);

  await db.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});