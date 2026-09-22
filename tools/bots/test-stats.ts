import { Pool } from 'pg';
import 'dotenv/config';

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  // Get Ali's user id
  const u = await db.query(
    `SELECT id FROM users WHERE display_name = 'Ali' LIMIT 1`,
  );
  const userId = u.rows[0].id;
  console.log(`Ali user_id = ${userId}\n`);

  const statsRes = await db.query(
    `WITH my_real_hands AS (
       SELECT
         h.id AS hand_id,
         h.winner_seats,
         h.result,
         (
           SELECT (p->>'seat')::int
           FROM jsonb_array_elements(hs.state->'players') p
           WHERE (p->>'userId')::bigint = $1
           LIMIT 1
         ) AS my_seat
       FROM hands h
       JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
       WHERE h.finished = TRUE
         AND h.mode = 'real'
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(hs.state->'players') p
           WHERE (p->>'userId')::bigint = $1
         )
     )
     SELECT
       COUNT(*)::int AS hands_played,
       COUNT(*) FILTER (
         WHERE winner_seats::jsonb @> to_jsonb(my_seat)
       )::int AS hands_won,
       COALESCE(SUM(
         (
           SELECT COALESCE((sp->>'payout')::numeric, 0)
           FROM jsonb_array_elements(
             COALESCE(result->'showdownPlayers', '[]'::jsonb)
           ) sp
           WHERE (sp->>'seat')::int = my_seat
           LIMIT 1
         )
       ), 0)::numeric AS total_won
     FROM my_real_hands`,
    [userId],
  );
  console.log('Stats:', statsRes.rows[0]);

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});