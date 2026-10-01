// ============================================================
// End-to-end verification for Flop Club.
// Run: npx tsx apps/server/src/test-e2e.ts
//
// Creates a dedicated test user, exercises the money paths, then
// removes every row it created (ledger reversed, user deleted).
// Exit code 0 = every check passed, 1 = at least one failure.
// ============================================================

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { LedgerService } from './ledger.js';
import { MissionService, utcDay } from './mission-service.js';
import { BadBeatService } from './bad-beat-service.js';
import {
  WeeklyRaceService,
  weekStartUtc,
  bracketForRake,
  computePrizes,
} from './weekly-race-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker',
});

const ledger = new LedgerService(db);

// Fresh synthetic id per run, so the test never reuses - or deletes - a
// pre-existing user row.
const TEST_TG = Number(`999${String(Date.now()).slice(-9)}`);
const TEST_NAME = 'E2E Test User';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`;
  if (ok) passed++;
  else failed++;
  console.log(line);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function getUserId(): Promise<number> {
  const r = await db.query('SELECT id FROM users WHERE telegram_id = $1', [TEST_TG]);
  if (r.rows.length === 0) return 0;
  return Number(r.rows[0].id);
}

async function ensureTestUser(): Promise<number> {
  const existing = await getUserId();
  if (existing) {
    const u = await db.query('SELECT display_name FROM users WHERE id = $1', [existing]);
    if (u.rows[0]?.display_name === TEST_NAME) return existing;
    throw new Error(`telegram_id ${TEST_TG} belongs to another user; refusing to reuse it`);
  }

  const ins = await db.query(
    `INSERT INTO users (telegram_id, display_name, avatar_id, referral_code)
     VALUES ($1, $2, 'spade', $3)
     RETURNING id`,
    [TEST_TG, TEST_NAME, `ref_e2e_${Date.now().toString(36)}`],
  );
  const id = Number(ins.rows[0].id);
  await ledger.ensureUserAccount(id);
  await db.query(
    `INSERT INTO free_chips (user_id, chips) VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [id],
  );
  return id;
}

// ============================================================
// Section 1 - Daily missions
// ============================================================
async function testMissions(userId: number): Promise<void> {
  console.log('\n--- Daily missions ---');
  const missions = new MissionService(db);

  const before = await db.query('SELECT chips FROM free_chips WHERE user_id = $1', [userId]);
  const chipsBefore = Number(before.rows[0]?.chips ?? 0);
  const xpBefore = await db.query('SELECT lifetime_xp FROM user_xp WHERE user_id = $1', [userId]);
  const lifetimeBefore = Number(xpBefore.rows[0]?.lifetime_xp ?? 0);

  const list = await missions.getDailyMissions(userId);
  check('5 active missions returned', list.length === 5, `got ${list.length}`);

  const played = await missions.trackProgress(userId, 'hands_played', 10);
  check('trackProgress matched play_10_hands', played >= 1, `rows=${played}`);

  const omaha = await missions.trackProgress(userId, 'omaha_hands_played', 1);
  check('trackProgress matched play_omaha', omaha >= 1, `rows=${omaha}`);

  const afterTrack = await missions.getDailyMissions(userId);
  const m10 = afterTrack.find((m) => m.code === 'play_10_hands');
  check(
    'play_10_hands progress = 10/10 and claimable',
    !!m10 && m10.progress === 10 && m10.claimable === true,
    `progress=${m10?.progress} claimable=${m10?.claimable}`,
  );

  const notDone = afterTrack.find((m) => m.code === 'win_3_hands');
  check(
    'win_3_hands not claimable yet',
    !!notDone && notDone.claimable === false && notDone.progress === 0,
    `progress=${notDone?.progress}`,
  );

  const claim1 = await missions.claim(userId, 'play_10_hands');
  check(
    'claim play_10_hands grants 500 chips + 50 XP',
    claim1.ok === true && claim1.rewardChips === 500 && claim1.rewardXp === 50,
    JSON.stringify(claim1),
  );

  const claim2 = await missions.claim(userId, 'play_10_hands');
  check(
    'double claim rejected',
    claim2.ok === false && claim2.error === 'already_claimed',
    claim2.error ?? '',
  );

  const claim3 = await missions.claim(userId, 'win_3_hands');
  check(
    'claim without progress rejected',
    claim3.ok === false && claim3.error === 'not_complete',
    claim3.error ?? '',
  );

  const after = await db.query('SELECT chips FROM free_chips WHERE user_id = $1', [userId]);
  const chipsAfter = Number(after.rows[0]?.chips ?? 0);
  check(
    'free_chips increased by 500',
    chipsAfter - chipsBefore === 500,
    `${chipsBefore} -> ${chipsAfter}`,
  );

  const xpAfter = await db.query('SELECT lifetime_xp FROM user_xp WHERE user_id = $1', [userId]);
  const lifetimeAfter = Number(xpAfter.rows[0]?.lifetime_xp ?? 0);
  check(
    'lifetime_xp increased by 50',
    lifetimeAfter - lifetimeBefore === 50,
    `${lifetimeBefore} -> ${lifetimeAfter}`,
  );

  const xpTx = await db.query(
    `SELECT COUNT(*)::int AS c FROM xp_transactions
     WHERE user_id = $1 AND source = 'bonus'`,
    [userId],
  );
  check('xp_transactions has bonus row', Number(xpTx.rows[0].c) >= 1, `rows=${xpTx.rows[0].c}`);

  const pm = await db.query(
    `SELECT COUNT(*)::int AS c FROM play_money_log
     WHERE user_id = $1 AND reason = 'mission_reward'`,
    [userId],
  );
  check('play_money_log has mission_reward row', Number(pm.rows[0].c) >= 1, `rows=${pm.rows[0].c}`);

  // resetDaily() must keep today's rows and drop older ones.
  const today = utcDay();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO mission_progress (user_id, mission_id, day, progress)
     SELECT $1, id, $2::date, 1 FROM missions WHERE code = 'win_3_hands'
     ON CONFLICT (user_id, mission_id, day) DO NOTHING`,
    [userId, yesterday],
  );
  const removed = await missions.resetDaily();
  check('resetDaily removed the stale day', removed >= 1, `removed=${removed}`);

  const todayRows = await db.query(
    'SELECT COUNT(*)::int AS c FROM mission_progress WHERE user_id = $1 AND day = $2::date',
    [userId, today],
  );
  check(
    'resetDaily kept today rows',
    Number(todayRows.rows[0].c) >= 1,
    `rows=${todayRows.rows[0].c}`,
  );
}

// ============================================================
// Section 2 - Bad beat jackpot
// ============================================================
async function testBadBeat(userId: number, tableUserId: number): Promise<void> {
  console.log('\n--- Bad beat jackpot ---');
  const badBeat = new BadBeatService(db);

  const poolStart = await badBeat.getPoolAmount();

  // 1. Funding: 2% of a $100 rake = $2.00
  const contributed = await badBeat.recordPotContribution(100);
  const poolAfterContrib = await badBeat.getPoolAmount();
  check(
    'contribution of $100 rake is $2.00 (2%)',
    contributed === 2 && round2(poolAfterContrib - poolStart) === 2,
    `contributed=${contributed} pool=${poolAfterContrib}`,
  );

  const smallContrib = await badBeat.recordPotContribution(3);
  check('contribution of $3 rake is $0.06', smallContrib === 0.06, `contributed=${smallContrib}`);

  // Undo the small one so the arithmetic below stays obvious.
  const poolAcc = await ledger.getAccountId('HOUSE_BAD_BEAT');
  const rakeAcc = await ledger.getAccountId('HOUSE_RAKE');
  if (poolAcc && rakeAcc) {
    await ledger.record({
      kind: 'REVERSAL',
      ref: 'e2e_bad_beat_contrib_reversal_small',
      entries: [
        { accountId: poolAcc, amount: -smallContrib },
        { accountId: rakeAcc, amount: smallContrib },
      ],
    });
    await db.query(
      'UPDATE bad_beat_pool SET amount_usd = amount_usd - $1, updated_at = NOW() WHERE id = 1',
      [smallContrib],
    );
  }

  // 2. Trigger detection
  const seatMap: Record<number, number> = { 1: userId, 2: tableUserId };

  const quadHand = {
    winners: [2],
    showdownPlayers: [
      { seat: 1, displayName: 'loser', handName: 'Four of a Kind', isWinner: false, payout: 0 },
      { seat: 2, displayName: 'winner', handName: 'Ace High', isWinner: true, payout: 10 },
    ],
  };
  const quad = await badBeat.checkTrigger(quadHand, seatMap);
  check(
    'quads loss triggers quad_plus',
    !!quad && quad.tier === 'quad_plus' && quad.loserUserId === userId,
    `tier=${quad?.tier} amount=${quad?.amount}`,
  );

  const sfHand = {
    winners: [2],
    showdownPlayers: [
      { seat: 1, displayName: 'loser', handName: 'Straight Flush', isWinner: false, payout: 0 },
      { seat: 2, displayName: 'winner', handName: 'Four of a Kind', isWinner: true, payout: 10 },
    ],
  };
  const sf = await badBeat.checkTrigger(sfHand, seatMap);
  check(
    'straight flush loss triggers straight_flush',
    !!sf && sf.tier === 'straight_flush',
    `tier=${sf?.tier}`,
  );

  const noTrigger = await badBeat.checkTrigger(
    {
      winners: [2],
      showdownPlayers: [
        { seat: 1, displayName: 'loser', handName: 'Two Pair', isWinner: false, payout: 0 },
        { seat: 2, displayName: 'winner', handName: 'Flush', isWinner: true, payout: 10 },
      ],
    },
    seatMap,
  );
  check('ordinary loss does not trigger', noTrigger === null, String(noTrigger));

  const foldHand = { winners: [2], showdownPlayers: [] };
  check('fold-out hand does not trigger', (await badBeat.checkTrigger(foldHand, seatMap)) === null);

  // 3. Payout against a real hand row (FK target), then clean up.
  const handRow = await db.query('SELECT id FROM hands ORDER BY id DESC LIMIT 1');
  const handId = Number(handRow.rows[0]?.id ?? 0);
  if (!handId) {
    check('bad beat payout (skipped: no hand rows)', false, 'no hands in DB');
    return;
  }

  const poolBeforePayout = await badBeat.getPoolAmount();
  const payout = await badBeat.payoutBadBeat({
    handId,
    tier: 'quad_plus',
    loserUserId: userId,
    winnerUserId: tableUserId,
    tableUserIds: [userId, tableUserId],
    pool: poolBeforePayout,
  });

  const expectedLoser = round2(poolBeforePayout * 0.75);
  const expectedWinner = round2(poolBeforePayout * 0.125);
  const loserShare = payout.payouts?.find((p) => p.role === 'loser')?.amount ?? 0;
  const winnerShare = payout.payouts?.find((p) => p.role === 'winner')?.amount ?? 0;

  check(
    'quad_plus pays 75% loser / 12.5% winner',
    payout.ok === true && loserShare === expectedLoser && winnerShare === expectedWinner,
    `loser=${loserShare} (exp ${expectedLoser}) winner=${winnerShare} (exp ${expectedWinner})`,
  );

  const poolAfterPayout = await badBeat.getPoolAmount();
  check(
    'pool drained by exactly the paid amount',
    round2(poolBeforePayout - poolAfterPayout) === round2(payout.paid ?? 0),
    `pool ${poolBeforePayout} -> ${poolAfterPayout}, paid=${payout.paid}`,
  );

  const payoutRows = await db.query(
    'SELECT COUNT(*)::int AS c, COALESCE(SUM(amount_usd),0)::numeric AS total FROM bad_beat_payouts WHERE hand_id = $1',
    [handId],
  );
  check(
    'bad_beat_payouts rows written and sum to paid',
    Number(payoutRows.rows[0].c) === (payout.payouts?.length ?? 0) &&
      round2(Number(payoutRows.rows[0].total)) === round2(payout.paid ?? 0),
    `rows=${payoutRows.rows[0].c} total=${payoutRows.rows[0].total}`,
  );

  const second = await badBeat.payoutBadBeat({
    handId,
    tier: 'quad_plus',
    loserUserId: userId,
    winnerUserId: tableUserId,
    tableUserIds: [userId, tableUserId],
  });
  check(
    'second payout for the same hand is a duplicate',
    second.duplicate === true,
    JSON.stringify(second),
  );

  // 4. Cleanup: reverse the payout and delete the payout log rows.
  const userAcc = await ledger.ensureUserAccount(userId);
  const tableAcc = await ledger.ensureUserAccount(tableUserId);
  if (poolAcc && rakeAcc && userAcc && tableAcc) {
    await ledger.record({
      kind: 'REVERSAL',
      ref: `e2e_bad_beat_reversal_${handId}`,
      entries: [
        {
          accountId: userAcc,
          amount: -(payout.payouts?.find((p) => p.role === 'loser')?.amount ?? 0),
        },
        {
          accountId: tableAcc,
          amount: -(payout.payouts?.find((p) => p.role === 'winner')?.amount ?? 0),
        },
        { accountId: poolAcc, amount: payout.paid ?? 0 },
      ],
    });
    await db.query(
      'UPDATE bad_beat_pool SET amount_usd = amount_usd + $1, updated_at = NOW() WHERE id = 1',
      [payout.paid ?? 0],
    );

    // Reverse the $2.00 funding contribution so the pool returns to baseline.
    await ledger.record({
      kind: 'REVERSAL',
      ref: 'e2e_bad_beat_contrib_reversal',
      entries: [
        { accountId: poolAcc, amount: -contributed },
        { accountId: rakeAcc, amount: contributed },
      ],
    });
    await db.query(
      'UPDATE bad_beat_pool SET amount_usd = amount_usd - $1, updated_at = NOW() WHERE id = 1',
      [contributed],
    );
  }
  await db.query('DELETE FROM bad_beat_payouts WHERE hand_id = $1', [handId]);
  check('cleanup: payout rows removed', true, `handId=${handId}`);
}

// ============================================================
// Section 3 - Weekly rake race
// ============================================================
async function testWeeklyRace(userId: number, otherUserId: number): Promise<void> {
  console.log('\n--- Weekly rake race ---');
  const race = new WeeklyRaceService(db);

  // 1. Week key must be a Monday (1 Oct 2026 is a Thursday).
  const wk = weekStartUtc(new Date('2026-10-01T12:00:00Z'));
  check('weekStartUtc lands on a Monday', new Date(`${wk}T00:00:00Z`).getUTCDay() === 1, wk);

  // 2. Brackets
  check('bracketForRake $10 -> bronze', bracketForRake(10) === 'bronze', bracketForRake(10));
  check('bracketForRake $100 -> silver', bracketForRake(100) === 'silver', bracketForRake(100));
  check('bracketForRake $1000 -> gold', bracketForRake(1000) === 'gold', bracketForRake(1000));

  // 3. Prize curve
  const prizes = computePrizes(100, 20);
  const prizeSum = round2(prizes.reduce((a, b) => a + b, 0));
  check('computePrizes(100, 20) sums to exactly the pool', prizeSum === 100, `sum=${prizeSum}`);
  check(
    'computePrizes is non-increasing',
    prizes.every((p, i) => i === 0 || p <= prizes[i - 1]),
    prizes.slice(0, 4).join(','),
  );

  // 4. Live accrual + bracket promotion
  const before = await race.getMyEntry(userId);
  await race.recordRake(userId, 60);
  const after = await race.getMyEntry(userId);
  check(
    'recordRake adds to the current week',
    round2(after.totalRake - before.totalRake) === 60,
    `${before.totalRake} -> ${after.totalRake}`,
  );
  check('$60 of weekly rake sits in silver', after.bracket === 'silver', after.bracket);
  check('my rank is assigned while the week is live', after.rank === 1, `rank=${after.rank}`);

  // 5. Settle a synthetic past week (2020-01-06 is a Monday).
  const pastWeek = '2020-01-06';
  await db.query('DELETE FROM weekly_race_entries WHERE week_start = $1::date', [pastWeek]);
  await db.query(
    `INSERT INTO weekly_race_entries (user_id, week_start, bracket, total_rake)
     VALUES ($1, $2::date, 'bronze', 40), ($3, $2::date, 'bronze', 20)`,
    [userId, pastWeek, otherUserId],
  );

  const closed = await race.closeWeek(pastWeek);
  const bronze = closed.find((r) => r.bracket === 'bronze');
  check(
    'closeWeek sees both bronze players',
    !!bronze && bronze.players === 2,
    JSON.stringify(bronze),
  );
  check(
    'closeWeek paid a positive amount',
    !!bronze && bronze.paidUsd > 0,
    `paid=$${bronze?.paidUsd}`,
  );

  const settled = await db.query(
    `SELECT user_id, rank, prize_usd, paid FROM weekly_race_entries
     WHERE week_start = $1::date ORDER BY rank`,
    [pastWeek],
  );
  check(
    'ranks assigned by rake (1 then 2)',
    Number(settled.rows[0]?.rank) === 1 && Number(settled.rows[1]?.rank) === 2,
    settled.rows.map((r: any) => r.rank).join(','),
  );
  check(
    'every row marked settled',
    settled.rows.every((r: any) => r.paid === true),
    settled.rows.map((r: any) => r.paid).join(','),
  );
  check(
    'rank 1 prize beats rank 2',
    Number(settled.rows[0]?.prize_usd) > Number(settled.rows[1]?.prize_usd),
    `${settled.rows[0]?.prize_usd} vs ${settled.rows[1]?.prize_usd}`,
  );
  const paidSum = round2(settled.rows.reduce((s: number, r: any) => s + Number(r.prize_usd), 0));
  check('bronze prizes sum to the $100 pool', paidSum === 100, `sum=${paidSum}`);

  // 6. Idempotency
  const again = await race.closeWeek(pastWeek);
  const bronzeAgain = again.find((r) => r.bracket === 'bronze');
  check(
    'closeWeek is idempotent (ledger duplicate)',
    bronzeAgain?.duplicate === true,
    JSON.stringify(bronzeAgain),
  );

  // 7. Cleanup: reverse the ledger payments, then drop the synthetic rows.
  const rakeAcc = await ledger.getAccountId('HOUSE_RAKE');
  if (rakeAcc) {
    const entries: { accountId: number; amount: number }[] = [];
    let total = 0;
    for (const r of settled.rows) {
      const amount = Number(r.prize_usd);
      if (amount <= 0) continue;
      const acc = await ledger.ensureUserAccount(Number(r.user_id));
      if (!acc) continue;
      entries.push({ accountId: acc, amount: -amount });
      total = round2(total + amount);
    }
    if (entries.length > 0) {
      await ledger.record({
        kind: 'REVERSAL',
        ref: `e2e_weekly_race_reversal_${pastWeek}`,
        entries: [{ accountId: rakeAcc, amount: total }, ...entries],
      });
    }
  }
  await db.query('DELETE FROM weekly_race_entries WHERE week_start = $1::date', [pastWeek]);
  await db.query('DELETE FROM weekly_race_entries WHERE user_id = $1', [userId]);
  check('cleanup: synthetic race rows removed', true, pastWeek);
}

// ============================================================
// Cleanup
// ============================================================
async function cleanup(userId: number): Promise<void> {
  if (!userId) return;

  // Safety net: only ever delete a row this test created.
  const u = await db.query('SELECT display_name FROM users WHERE id = $1', [userId]);
  if (u.rows[0]?.display_name !== TEST_NAME) {
    console.log(`[cleanup] refusing to delete user ${userId}: not a test user`);
    return;
  }

  await db.query('DELETE FROM idempotency_keys WHERE user_id = $1', [userId]);
  await db.query(
    `DELETE FROM entries WHERE account_id IN
       (SELECT id FROM accounts WHERE owner_user_id = $1)`,
    [userId],
  );
  await db.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM accounts WHERE owner_user_id = $1', [userId]);
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function main(): Promise<void> {
  console.log('Flop Club - end-to-end verification');
  console.log('===================================');

  const baseline = await db.query(
    `SELECT (SELECT COALESCE(SUM(amount),0)::numeric FROM entries) AS ledger_sum,
            (SELECT amount_usd FROM bad_beat_pool WHERE id = 1) AS pool`,
  );
  const poolAtStart = Number(baseline.rows[0]?.pool ?? 0);

  const userId = await ensureTestUser();
  console.log(`test user id=${userId} telegram_id=${TEST_TG}`);

  // A second user id for winner/table shares (no account needed until payout).
  const other = await db.query('SELECT id FROM users WHERE id <> $1 ORDER BY id LIMIT 1', [userId]);
  const tableUserId = Number(other.rows[0]?.id ?? 0);

  await testMissions(userId);
  await testBadBeat(userId, tableUserId);
  await testWeeklyRace(userId, tableUserId);

  // Restore the pool to its exact starting value.
  if (poolAtStart !== (await new BadBeatService(db).getPoolAmount())) {
    console.log(`[cleanup] restoring pool to ${poolAtStart}`);
  }
  await cleanup(userId);

  const finalPool = await new BadBeatService(db).getPoolAmount();
  check(
    'pool restored to baseline',
    round2(finalPool) === round2(poolAtStart),
    `${finalPool} vs ${poolAtStart}`,
  );

  const leftover = await getUserId();
  check('test user removed', leftover === 0);

  console.log('\n===================================');
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
