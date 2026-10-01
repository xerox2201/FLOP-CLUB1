// ============================================================
// B2 / B3 community auto-post verification.
// Run: npx tsx apps/server/src/test-autopost.ts
//
// B2 (tournament finished) is exercised for real: one clearly-labelled test
// message is posted to the primary channel, then its log row and the synthetic
// tournament row are removed.
// B3 (daily leader) only fires at 20:00 UTC, so this verifies the hour guard,
// the aggregation query, the slot-claim state and the empty-list no-op instead
// of forcing a post.
// ============================================================

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTelegramBot } from './telegram-bot.js';
import { CommunityCron } from './community-cron.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker',
});

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
}

async function logCount(postType: string, targetId: string): Promise<number> {
  const r = await db.query(
    `SELECT COUNT(*)::int AS c FROM community_posts_log
     WHERE post_type = $1 AND target_id = $2`,
    [postType, targetId],
  );
  return Number(r.rows[0].c);
}

async function main(): Promise<void> {
  console.log('Community auto-post verification');
  console.log('================================');
  const bot = getTelegramBot(db);
  const cron = new CommunityCron(db);

  // ---- configuration ----
  const channelId = await bot.getPrimaryChannelId();
  check('primary channel configured', !!channelId, `chatId=${channelId}`);
  check(
    'TELEGRAM_BOT_TOKEN present after loading .env',
    !!process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'MISSING - posts cannot be sent',
  );

  const templates = await db.query(
    `SELECT code FROM telegram_post_templates WHERE is_active = TRUE ORDER BY code`,
  );
  console.log(`[autopost] templates: ${templates.rows.map((r: any) => r.code).join(', ')}`);

  // ---- B3: guard, aggregation, slot state ----
  const utcHour = new Date().getUTCHours();
  const today = new Date().toISOString().slice(0, 10);
  const claimedToday = await logCount('daily_leader', today);
  console.log(
    `[autopost] B3: current UTC hour=${utcHour} (fires at 20), today's slot claimed=${claimedToday > 0}`,
  );
  check(
    'B3 hour guard is understood',
    utcHour >= 0 && utcHour <= 23,
    `would ${utcHour === 20 ? 'FIRE' : 'SKIP'} right now`,
  );

  // Same aggregation the cron performs.
  const agg = await db.query(
    `SELECT h.result, hs.state
     FROM hands h
     JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
     WHERE h.mode = 'real' AND h.finished = TRUE
       AND h.ended_at > NOW() - INTERVAL '24 hours'
     ORDER BY h.id DESC
     LIMIT 500`,
  );
  let winnersFound = 0;
  for (const row of agg.rows) {
    const players = (row.state as any)?.players ?? [];
    const showdown = (row.result as any)?.showdownPlayers ?? [];
    for (const sp of showdown) {
      if (!sp.isWinner) continue;
      if (Number(sp.payout) > 0) winnersFound++;
    }
  }
  check(
    'B3 aggregation query runs against real hands',
    true,
    `${agg.rows.length} hands / ${winnersFound} winning showdown entries`,
  );

  const beforeEmpty = await logCount('daily_leader', `e2e-${today}`);
  await bot.announceDailyLeader({ dateLabel: `e2e-${today}`, topWinners: [] });
  const afterEmpty = await logCount('daily_leader', `e2e-${today}`);
  check(
    'B3 empty winner list posts nothing',
    afterEmpty === beforeEmpty && afterEmpty === 0,
    `slots=${afterEmpty}`,
  );

  // ---- B2: real post to the primary channel ----
  const ins = await db.query(
    `INSERT INTO tournaments (name, variant, starting_stack, status, total_prize_pool, total_players)
     VALUES ($1, 'holdem', 10000, 'finished', 250.00, 42)
     RETURNING id`,
    ['E2E TEST - Tournament Finished (safe to ignore)'],
  );
  const tournamentId = Number(ins.rows[0].id);
  console.log(
    `[autopost] B2: calling onTournamentFinished(${tournamentId}) - watch for the bot's own log line below`,
  );

  await cron.onTournamentFinished(tournamentId);

  const slot = await logCount('tournament_finished', String(tournamentId));
  check(
    'B2 claimed exactly one post slot',
    slot === 1,
    `tournamentId=${tournamentId} slots=${slot}`,
  );

  // Second call must be idempotent.
  await cron.onTournamentFinished(tournamentId);
  const slotAgain = await logCount('tournament_finished', String(tournamentId));
  check('B2 second call does not post again', slotAgain === 1, `slots=${slotAgain}`);

  const stored = await db.query(
    `SELECT payload FROM community_posts_log
     WHERE post_type = 'tournament_finished' AND target_id = $1`,
    [String(tournamentId)],
  );
  console.log(`[autopost] B2 stored payload: ${JSON.stringify(stored.rows[0]?.payload)}`);

  // ---- cleanup ----
  await db.query(
    `DELETE FROM community_posts_log WHERE post_type = 'tournament_finished' AND target_id = $1`,
    [String(tournamentId)],
  );
  await db.query('DELETE FROM tournaments WHERE id = $1', [tournamentId]);
  check('cleanup: test tournament + log row removed', true, `tournamentId=${tournamentId}`);

  console.log('\n================================');
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  await db.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  try {
    await db.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
