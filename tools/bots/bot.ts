 import dotenv from 'dotenv';
import { io, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_URL = process.env.API_URL || 'http://localhost:4000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const TABLE_ID = Number(process.env.TABLE_ID || 1);
const NUM_BOTS = Number(process.env.NUM_BOTS || 6);
const MAX_HANDS = process.env.MAX_HANDS ? Number(process.env.MAX_HANDS) : Infinity;
const DELAY_MIN = Number(process.env.DELAY_MIN || 10);
const DELAY_MAX = Number(process.env.DELAY_MAX || 50);
const VERBOSE = process.env.VERBOSE !== 'false';

const db = new Pool({ connectionString: DATABASE_URL });

const EXPECTED_ERRORS = new Set([
  'hand_not_active',
  'not_your_turn',
  'not_active',
]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const stats = {
  handsStarted: 0,
  handsFinished: 0,
  actions: { FOLD: 0, CHECK: 0, CALL: 0, RAISE: 0 } as Record<string, number>,
  expectedErrors: 0,
  realErrors: [] as string[],
  warnings: [] as string[],
  startTime: 0,
  initialChips: NUM_BOTS * 1000,
  totalRake: 0,
  totalRebuy: 0,
  seenCardsPerHand: new Map<number, Set<string>>(),
  lastHandDuration: 0,
  longestHand: 0,
  shortestHand: Infinity,
  firstHandCaptured: false,
};

let lastState: any = null;

interface BotState {
  index: number;
  userId: number;
  displayName: string;
  token: string;
  socket: Socket | null;
  seat: number | null;
  stack: number;
  lastActedTurnKey: string | null;
  handsPlayed: Set<number>;
  lastFinishedHand: number;
}

async function ensureUser(name: string, tgId: number): Promise<number> {
  const existing = await db.query('SELECT id FROM users WHERE telegram_id = $1', [tgId]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await db.query(
    `INSERT INTO users (telegram_id, username, display_name, language)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [tgId, `bot_${tgId}`, name, 'en']
  );
  const userId = inserted.rows[0].id;
  await db.query('INSERT INTO wallets (user_id, balance_usd) VALUES ($1, 0)', [userId]);
  await db.query('INSERT INTO free_chips (user_id, chips) VALUES ($1, 10000)', [userId]);
  return userId;
}

function decideAction(state: any, mySeat: any): { action: string; amount?: number } {
  const stack = Number(mySeat.stack) || 0;
  if (stack <= 0) return { action: 'FOLD' };

  const bigBlind = Number(state.bigBlind) || 0.10;
  const minRaise = Number(state.minRaise) || bigBlind;
  const maxBet = Math.max(...state.seats.map((s: any) => Number(s.betThisStreet) || 0));
  const myBet = Number(mySeat.betThisStreet) || 0;
  const toCall = round2(Math.max(0, maxBet - myBet));

  const safeMinRaise = round2(Math.max(minRaise, bigBlind));
  const minTotal = round2(maxBet + safeMinRaise);
  const allInTotal = round2(stack + myBet);
  const canRaiseToMin = allInTotal + 0.0001 >= minTotal && stack > 0;

  const r = Math.random();

  // 🧪 تست side pots — 15% احتمال all-in
  if (r < 0.15 && stack > 0) {
    return { action: 'RAISE', amount: allInTotal };
  }

  if (toCall === 0) {
    if (canRaiseToMin && r < 0.25) {
      const extra = Math.floor(Math.random() * 3) * bigBlind;
      const target = Math.min(minTotal + extra, allInTotal);
      const raiseTo = round2(target);
      if (raiseTo + 0.0001 >= minTotal) {
        return { action: 'RAISE', amount: raiseTo };
      }
    }
    return { action: 'CHECK' };
  }

  if (toCall > stack * 0.6) {
    return r < 0.9 ? { action: 'FOLD' } : { action: 'CALL' };
  }

  if (canRaiseToMin && r < 0.16) {
    const raiseTo = round2(Math.min(minTotal + bigBlind, allInTotal));
    if (raiseTo + 0.0001 >= minTotal) {
      return { action: 'RAISE', amount: raiseTo };
    }
  }

  if (r < 0.75) return { action: 'CALL' };
  return { action: 'FOLD' };
}

async function createBot(index: number): Promise<BotState> {
  const name = `Bot${index + 1}`;
  const tgId = 900000 + index;
  const userId = await ensureUser(name, tgId);
  const token = jwt.sign({ uid: userId, tg: tgId }, JWT_SECRET);
  return {
    index, userId, displayName: name, token,
    socket: null, seat: null, stack: 0,
    lastActedTurnKey: null,
    handsPlayed: new Set(),
    lastFinishedHand: 0,
  };
}

function checkChipConservation(state: any) {
  if (state.pot !== 0) return;
  if (state.phase !== 'showdown') return;

  let total = 0;
  for (const s of state.seats) {
    total += (s.stack || 0) + (s.betThisStreet || 0);
  }

  const expected = stats.initialChips + stats.totalRebuy - stats.totalRake;
  const diff = Math.abs(total - expected);
  if (diff > 0.5) {
    const msg = `CHIP BROKEN (hand #${state.handNo}): expected=$${expected.toFixed(2)}, got=$${total.toFixed(2)}, diff=$${diff.toFixed(2)}`;
    stats.warnings.push(msg);
    if (VERBOSE) console.error(`   ⚠️  ${msg}`);
  }
}

function checkDuplicateCards(handNo: number, state: any) {
  if (!stats.seenCardsPerHand.has(handNo)) {
    stats.seenCardsPerHand.set(handNo, new Set());
  }
  const seen = stats.seenCardsPerHand.get(handNo)!;
  const allCards: string[] = [];
  for (const s of state.seats) {
    if (s.revealed && s.hole) {
      for (const c of s.hole) {
        if (c.r !== '?' && c.s !== '?') allCards.push(`${c.r}${c.s}`);
      }
    }
  }
  for (const c of state.community || []) {
    if (c.r !== '?' && c.s !== '?') allCards.push(`${c.r}${c.s}`);
  }
  for (const card of allCards) {
    if (seen.has(card)) {
      const msg = `DUPLICATE CARD in hand #${handNo}: ${card}`;
      stats.realErrors.push(msg);
      if (VERBOSE) console.error(`   ❌ ${msg}`);
    }
    seen.add(card);
  }
}

async function connectBot(bot: BotState, onStateUpdate: (bot: BotState, state: any) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = io(API_URL, {
      auth: { token: bot.token, device: `bot_device_${bot.userId}` },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });
    bot.socket = socket;

    const timeout = setTimeout(() => {
      reject(new Error(`${bot.displayName} connect timeout`));
    }, 12000);

    socket.on('connect', () => {
      socket.emit('table:join', { tableId: TABLE_ID }, (res: any) => {
        clearTimeout(timeout);
        if (!res?.ok) {
          console.error(`[${bot.displayName}] join failed: ${res?.error}`);
          reject(new Error(res?.error || 'join_failed'));
          return;
        }
        if (VERBOSE) console.log(`  ✓ ${bot.displayName} joined (userId=${bot.userId})`);
        resolve();
      });
    });

    socket.on('table:state', (state: any) => {
      try { onStateUpdate(bot, state); } catch (e: any) {
        stats.realErrors.push(`${bot.displayName} state handler: ${e.message}`);
      }
    });

    socket.on('table:hand_result', (data: any) => {
      if (bot.index !== 0) return;
      const totalRake = Number(data?.result?.totalRake ?? 0);
      const totalRebuy = Number(data?.result?.totalRebuy ?? 0);
      stats.totalRake = totalRake;
      stats.totalRebuy = totalRebuy;
    });

    socket.on('connect_error', (err: any) => {
      clearTimeout(timeout);
      stats.realErrors.push(`${bot.displayName} connect_error: ${err.message}`);
      reject(err);
    });

    socket.on('error', (err: any) => {
      stats.realErrors.push(`${bot.displayName} socket error: ${err?.message || err}`);
    });
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       POKER BOT RUNNER — Engine Test         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  API_URL:    ${API_URL}`);
  console.log(`  TABLE_ID:   ${TABLE_ID}`);
  console.log(`  NUM_BOTS:   ${NUM_BOTS}`);
  console.log(`  MAX_HANDS:  ${MAX_HANDS === Infinity ? '∞ (unlimited)' : MAX_HANDS}`);
  console.log(`  DELAY:      ${DELAY_MIN}-${DELAY_MAX}ms`);
  console.log(`  JWT_SECRET: ${JWT_SECRET.slice(0, 8)}...`);
  console.log(`  VARIANT:    ${process.env.TEST_VARIANT || 'auto-detect'}`);
  console.log('');

  console.log('▸ Creating bot users...');
  const bots: BotState[] = [];
  for (let i = 0; i < NUM_BOTS; i++) {
    const bot = await createBot(i);
    bots.push(bot);
  }
  console.log(`  ✓ ${bots.length} bots created`);
  console.log('');

  const actionQueue: (() => void)[] = [];
  let processing = false;

  function enqueueAction(fn: () => void) {
    actionQueue.push(fn);
    if (!processing) {
      processing = true;
      processQueue();
    }
  }

  function processQueue() {
    const fn = actionQueue.shift();
    if (!fn) { processing = false; return; }
    fn();
    const delay = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
    setTimeout(processQueue, delay);
  }

  let lastHandStartTime = Date.now();

  const handleState = (bot: BotState, state: any) => {
    if (bot.index === 0) lastState = state;

    const mySeat = state.seats.find((s: any) => s.userId === bot.userId);
    if (!mySeat) return;
    bot.seat = mySeat.seat;
    bot.stack = mySeat.stack;

    if (!stats.firstHandCaptured && state.handNo === 1 && state.seats.length === NUM_BOTS) {
      let total = 0;
      for (const s of state.seats) {
        total += (s.stack || 0) + (s.betThisStreet || 0);
      }
      stats.initialChips = Math.round(total * 100) / 100;
      stats.firstHandCaptured = true;
      if (VERBOSE) console.log(`  💰 Initial chips: $${stats.initialChips.toFixed(2)}`);
    }

    if (state.handNo > 0 && !bot.handsPlayed.has(state.handNo)) {
      bot.handsPlayed.add(state.handNo);
      if (bot.index === 0) {
        stats.handsStarted++;
        lastHandStartTime = Date.now();
        if (VERBOSE && (state.handNo <= 5 || state.handNo % 100 === 0)) {
          const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
          console.log(`\n  🃏 Hand #${state.handNo}  (${elapsed}s elapsed)`);
        }
      }
    }

    if (state.winners && state.winners.length > 0 && bot.index === 0) {
      if (bot.lastFinishedHand !== state.handNo) {
        bot.lastFinishedHand = state.handNo;
        stats.handsFinished++;

        const handDuration = Date.now() - lastHandStartTime;
        stats.lastHandDuration = handDuration;
        if (handDuration > stats.longestHand) stats.longestHand = handDuration;
        if (handDuration < stats.shortestHand) stats.shortestHand = handDuration;

        checkChipConservation(state);
        checkDuplicateCards(state.handNo, state);
      }
    }

    if (state.currentSeat === mySeat.seat && !mySeat.folded && !mySeat.allIn) {
      if (state.phase === 'showdown' || state.phase === 'waiting') return;

      const maxBet = Math.max(...state.seats.map((s: any) => s.betThisStreet));
      const turnKey = `${state.handNo}-${state.currentSeat}-${state.community?.length || 0}-${mySeat.betThisStreet}-${maxBet}`;
      if (bot.lastActedTurnKey === turnKey) return;
      bot.lastActedTurnKey = turnKey;

      enqueueAction(() => {
        if (!bot.socket?.connected) return;
        if (state.currentSeat !== mySeat.seat) return;
        const decision = decideAction(state, mySeat);
        stats.actions[decision.action]++;

        bot.socket.emit(
          'table:action',
          { action: decision.action, amount: decision.amount || 0 },
          (res: any) => {
            if (!res?.ok) {
              const err = res?.error || 'unknown';
              if (EXPECTED_ERRORS.has(err)) {
                stats.expectedErrors++;
              } else {
                const errMsg = `${bot.displayName} ${decision.action} failed: ${err}`;
                stats.realErrors.push(errMsg);
                console.error(`   ❌ ${errMsg}`);
                const maxBet2 = Math.max(...state.seats.map((s: any) => Number(s.betThisStreet) || 0));
                const myBet2 = Number(mySeat.betThisStreet) || 0;
                const toCall2 = maxBet2 - myBet2;
                const fallback = toCall2 > 0 ? 'CALL' : 'CHECK';
                bot.socket?.emit('table:action', { action: fallback, amount: 0 }, (r2: any) => {
                  if (!r2?.ok) {
                    bot.socket?.emit('table:action', { action: 'FOLD', amount: 0 }, () => {});
                  }
                });
              }
            }
          }
        );
      });
    }
  };

  console.log('▸ Connecting bots to table...');
  for (const bot of bots) {
    try {
      await connectBot(bot, handleState);
    } catch (e: any) {
      console.error(`  ✗ ${bot.displayName}: ${e.message}`);
      stats.realErrors.push(`${bot.displayName}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`  ✓ All bots connected`);
  console.log('');

  stats.startTime = Date.now();
  console.log('▸ Running hands... (Ctrl+C to stop)');
  let lastReport = 0;

  while (stats.handsFinished < MAX_HANDS) {
    await new Promise(r => setTimeout(r, 500));

    const now = Date.now();
    if (now - lastReport > 5000) {
      lastReport = now;
      const elapsed = ((now - stats.startTime) / 1000).toFixed(0);
      const hpm = stats.handsFinished > 0 ? (stats.handsFinished / (now - stats.startTime) * 60000).toFixed(1) : '0';
      process.stdout.write(`\r  📊 Hands: ${stats.handsFinished}${MAX_HANDS === Infinity ? '' : '/' + MAX_HANDS}  |  Time: ${elapsed}s  |  Rate: ${hpm}/min  |  Real: ${stats.realErrors.length}  |  Race: ${stats.expectedErrors}  `);
    }
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║                 RESULTS                       ║');
  console.log('╚══════════════════════════════════════════════╝');
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  console.log(`  Duration:       ${elapsed}s`);
  console.log(`  Hands started:  ${stats.handsStarted}`);
  console.log(`  Hands finished: ${stats.handsFinished}`);
  console.log(`  Rate:           ${(stats.handsFinished / (Date.now() - stats.startTime) * 60000).toFixed(1)} hands/min`);
  console.log(`  Hand duration:  avg=${stats.lastHandDuration}ms  min=${stats.shortestHand}ms  max=${stats.longestHand}ms`);
  console.log('');
  console.log('  Actions:');
  for (const [k, v] of Object.entries(stats.actions)) {
    console.log(`    ${k.padEnd(6)} ${v}`);
  }
  console.log('');
  console.log(`  Initial chips:  $${stats.initialChips.toFixed(2)}`);
  console.log(`  Total re-buys:  $${stats.totalRebuy.toFixed(2)} (from server)`);
  console.log(`  Total rake:     $${stats.totalRake.toFixed(2)} (from server)`);
  console.log('');
  console.log(`  ⚠️  Warnings:       ${stats.warnings.length}`);
  console.log(`  🔄 Race conditions: ${stats.expectedErrors} (طبیعی)`);
  console.log(`  ❌ Real errors:     ${stats.realErrors.length}`);

  if (stats.realErrors.length > 0) {
    console.log('');
    console.log('  ── REAL Errors (first 30) ──');
    for (const e of stats.realErrors.slice(0, 30)) console.log(`    ❌ ${e}`);
    if (stats.realErrors.length > 30) console.log(`    ... and ${stats.realErrors.length - 30} more`);
  }

  if (stats.warnings.length > 0) {
    console.log('');
    console.log('  ── Warnings (first 30) ──');
    for (const w of stats.warnings.slice(0, 30)) console.log(`    ⚠️  ${w}`);
    if (stats.warnings.length > 30) console.log(`    ... and ${stats.warnings.length - 30} more`);
  }

  console.log('');
  console.log('  ── Final Chip Totals ──');
  let finalTotal = 0;
  if (lastState && lastState.seats) {
    // 🔴 pot شامل betThisStreet هست — فقط stack + pot
    for (const s of lastState.seats) {
      console.log(`    ${s.displayName}: $${(s.stack || 0).toFixed(2)}`);
      finalTotal += (s.stack || 0);
    }
    const potInState = Number(lastState.pot) || 0;
    if (potInState > 0) {
      console.log(`    [pot]: $${potInState.toFixed(2)}`);
      finalTotal += potInState;
    }
  }
  const expectedFinal = stats.initialChips + stats.totalRebuy - stats.totalRake;
  console.log(`    ─────────────`);
  console.log(`    Total on table: $${finalTotal.toFixed(2)}`);
  console.log(`    Expected:       $${expectedFinal.toFixed(2)}`);
  console.log(`    Diff:           $${(finalTotal - expectedFinal).toFixed(2)}`);

  console.log('');
  console.log('▸ Disconnecting...');
  for (const bot of bots) {
    bot.socket?.disconnect();
  }
  await db.end();

  const exitCode = stats.realErrors.length > 0 ? 1 : 0;
  console.log('');
  console.log(exitCode === 0 ? '  ✅ ALL REAL TESTS PASSED' : '  ❌ REAL ERRORS FOUND');
  process.exit(exitCode);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});