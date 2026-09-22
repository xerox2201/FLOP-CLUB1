import { Pool } from 'pg';
import 'dotenv/config';

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  console.log('🎯 Resetting Ali stats (telegram_id = 111)\n');

  // 1. Find Ali
  const ali = await db.query(
    'SELECT id, telegram_id, display_name FROM users WHERE telegram_id = 111',
  );
  if (ali.rows.length === 0) {
    console.error('❌ Ali (telegram_id=111) not found');
    process.exit(1);
  }
  const aliId = Number(ali.rows[0].id);
  console.log(
    `Ali found: id=${aliId}, telegram_id=${ali.rows[0].telegram_id}, name=${ali.rows[0].display_name}\n`,
  );

  // 2. Stats BEFORE (raw, no reset filter)
  const before = await db.query(
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
       COUNT(*) FILTER (WHERE winner_seats::jsonb @> to_jsonb(my_seat))::int AS hands_won,
       COALESCE(SUM(
         (SELECT COALESCE((sp->>'payout')::numeric, 0)
          FROM jsonb_array_elements(COALESCE(result->'showdownPlayers', '[]'::jsonb)) sp
          WHERE (sp->>'seat')::int = my_seat LIMIT 1)
       ), 0)::numeric AS total_won
     FROM my_real_hands`,
    [aliId],
  );
  console.log('📊 BEFORE (no reset):');
  console.log('  ', before.rows[0]);
  const lvlBefore = Math.floor(Number(before.rows[0].total_won) / 100) + 1;
  console.log(`   → Level would be: ${lvlBefore}\n`);

  // 3. INSERT reset
  const ins = await db.query(
    `INSERT INTO user_stats_reset (user_id, reset_at)
     VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET reset_at = NOW()
     RETURNING user_id, reset_at`,
    [aliId],
  );
  console.log('✅ INSERT done:');
  console.log('  ', ins.rows[0]);
  console.log('');

  // 4. Stats AFTER (with reset filter)
  const after = await db.query(
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
         AND h.ended_at > COALESCE(
           (SELECT reset_at FROM user_stats_reset WHERE user_id = $1),
           '1970-01-01'::timestamptz
         )
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(hs.state->'players') p
           WHERE (p->>'userId')::bigint = $1
         )
     )
     SELECT
       COUNT(*)::int AS hands_played,
       COUNT(*) FILTER (WHERE winner_seats::jsonb @> to_jsonb(my_seat))::int AS hands_won,
       COALESCE(SUM(
         (SELECT COALESCE((sp->>'payout')::numeric, 0)
          FROM jsonb_array_elements(COALESCE(result->'showdownPlayers', '[]'::jsonb)) sp
          WHERE (sp->>'seat')::int = my_seat LIMIT 1)
       ), 0)::numeric AS total_won
     FROM my_real_hands`,
    [aliId],
  );
  console.log('📊 AFTER (with reset filter):');
  console.log('  ', after.rows[0]);
  const lvlAfter = Math.floor(Number(after.rows[0].total_won) / 100) + 1;
  console.log(`   → Level would be: ${lvlAfter}`);
  console.log('');
  console.log('🎉 Done. Restart backend so /api/me picks up the change.');

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});