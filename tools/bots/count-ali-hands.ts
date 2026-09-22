import { Pool } from 'pg';
import 'dotenv/config';

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  const r = await db.query(`
    SELECT
      COUNT(*)::int      AS total_hands,
      MIN(h.ended_at)    AS first_hand,
      MAX(h.ended_at)    AS last_hand
    FROM hands h
    JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
    WHERE h.finished = TRUE
      AND h.mode = 'real'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(hs.state->'players') p
        WHERE (p->>'userId')::bigint =
          (SELECT id FROM users WHERE telegram_id = 111)
      )
  `);
  console.log('Ali real hands:', r.rows[0]);
  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});