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

  console.log('\n=== HANDS WITH SIDE POTS ===\n');
  const res = await db.query(`
    SELECT id, hand_no, pot, rake, player_count, result
    FROM hands
    WHERE finished = TRUE
      AND result->'sidePots' IS NOT NULL
      AND jsonb_array_length(result->'sidePots') > 1
    ORDER BY id DESC
    LIMIT 5
  `);

  if (res.rows.length === 0) {
    console.log('❌ هیچ دستی با side pot پیدا نشد');
    console.log('(احتمالاً همه all-in ها با هم برابر بودن)');
  } else {
    for (const row of res.rows) {
      console.log(
        `Hand #${row.hand_no} (id=${row.id}) — pot=$${row.pot} rake=$${row.rake} players=${row.player_count}`,
      );
      for (const p of row.result.sidePots) {
        const winnerNames = (row.result.showdownPlayers || [])
          .filter((sp: any) => p.winnerSeats.includes(sp.seat))
          .map((sp: any) => sp.displayName)
          .join(', ');
        console.log(
          `  ${p.label.padEnd(12)} amount=$${p.amount}  net=$${p.netAmount}  eligible=[${p.eligibleSeats.join(',')}]  winners=[${winnerNames || p.winnerSeats.join(',')}]`,
        );
      }
      console.log('');
    }
  }

  console.log('\n=== TOTAL SIDE POTS COUNT ===');
  const count = await db.query(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN jsonb_array_length(result->'sidePots') > 1 THEN 1 ELSE 0 END) as with_side
    FROM hands WHERE finished = TRUE
  `);
  console.log(`Total hands: ${count.rows[0].total}`);
  console.log(`With side pots: ${count.rows[0].with_side}`);

  await db.end();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
