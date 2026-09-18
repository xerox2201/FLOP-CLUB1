import { Pool } from 'pg';
import { io, Socket } from 'socket.io-client';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API = 'http://localhost:4000';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin_dev_secret';

const db = new Pool({ connectionString: DATABASE_URL });

async function loginAs(telegramId: number, name: string): Promise<string> {
  const userJson = JSON.stringify({
    id: telegramId,
    first_name: name,
    username: name.toLowerCase().replace(/\s/g, ''),
    language_code: 'en',
  });
  const initData = `user=${encodeURIComponent(userJson)}&auth_date=9999999999&hash=dev`;
  const res = await fetch(`${API}/api/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error('login failed: ' + JSON.stringify(data));
  return data.token;
}

async function apiCall(method: string, path: string, token: string, body?: any) {
  const headers: any = { Authorization: `Bearer ${token}` };
  const opts: any = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  return { status: res.status, data: await res.json() };
}

async function adminCall(method: string, path: string, body?: any) {
  const headers: any = { Authorization: `Bearer ${ADMIN_SECRET}` };
  const opts: any = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  return { status: res.status, data: await res.json() };
}

async function main() {
  console.log('🎯 Full Tournament Test: Elimination + Payout\n');

  const usersRes = await db.query(
    `SELECT id, telegram_id, display_name FROM users
     WHERE is_banned = FALSE AND telegram_id IS NOT NULL
     ORDER BY id LIMIT 2`
  );
  if (usersRes.rows.length < 2) {
    console.error('❌ Need 2 users with telegram_id. Found:', usersRes.rows.length);
    await db.end();
    process.exit(1);
  }
  const [A, B] = usersRes.rows;
  console.log(`Users: A=${A.display_name}(db_id=${A.id}, tg=${A.telegram_id})  B=${B.display_name}(db_id=${B.id}, tg=${B.telegram_id})\n`);

  const bsRes: any = await fetch(`${API}/api/blind-structures`).then((r) => r.json());
  if (!bsRes.structures?.length) {
    console.error('❌ No blind structures');
    await db.end();
    process.exit(1);
  }
  const blindId = bsRes.structures[0].id;
  console.log(`Blind structure: ${bsRes.structures[0].name} (id=${blindId})\n`);

  console.log('Cleaning up old test tournaments...');
  await db.query(
    `UPDATE tournaments SET status = 'cancelled', finished_at = NOW()
     WHERE name LIKE 'E2E Test%' AND status IN ('running','registering','scheduled','final_table')`
  );

  console.log('Creating tournament...');
  const createRes = await adminCall('POST', '/api/tournaments', {
    name: `E2E Test ${Date.now()}`,
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'hyper',
    buyIn: 0,
    fee: 0,
    startingStack: 5000,
    minPlayers: 2,
    maxPlayers: 2,
    guaranteed: 1000,
    blindStructureId: blindId,
  });
  if (!createRes.data.ok) {
    console.error('❌ Create failed:', createRes.data);
    await db.end();
    process.exit(1);
  }
  const tid = createRes.data.tournamentId;
  console.log(`✅ Tournament #${tid} created\n`);

  const tokenA = await loginAs(A.telegram_id, A.display_name);
  const tokenB = await loginAs(B.telegram_id, B.display_name);
  console.log('✅ Both users logged in\n');

  console.log('Registering players...');
  const rA = await apiCall('POST', `/api/tournaments/${tid}/register`, tokenA, {});
  const rB = await apiCall('POST', `/api/tournaments/${tid}/register`, tokenB, {});
  console.log(`  ${A.display_name}: ${JSON.stringify(rA.data)}`);
  console.log(`  ${B.display_name}: ${JSON.stringify(rB.data)}\n`);

  console.log('Starting tournament...');
  const startRes = await adminCall('POST', `/api/tournaments/${tid}/start`, {});
  console.log(`  ${JSON.stringify(startRes.data)}\n`);
  if (!startRes.data.ok) {
    await db.end();
    process.exit(1);
  }

  const detailRes: any = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
  const players = detailRes.players || [];
  console.log('Tournament players:');
  for (const p of players) {
    console.log(`  ${p.displayName}: seat=${p.seat}, table=${p.tableNumber}, vTable=${p.virtualTableId}`);
  }
  const virtualTableId = players[0]?.virtualTableId;
  if (!virtualTableId) {
    console.error('❌ No virtual table id');
    await db.end();
    process.exit(1);
  }
  console.log(`\nVirtual table: ${virtualTableId}\n`);

  const sockA: Socket = io(API, { auth: { token: tokenA }, transports: ['websocket', 'polling'] });
  const sockB: Socket = io(API, { auth: { token: tokenB }, transports: ['websocket', 'polling'] });

  await new Promise<void>((resolve) => {
    let c = 0;
    const check = () => { if (++c === 2) resolve(); };
    sockA.on('connect', check);
    sockB.on('connect', check);
  });
  console.log('✅ Both sockets connected\n');

  await Promise.all([
    new Promise<void>((resolve) => {
      sockA.emit('table:join', { tableId: virtualTableId }, (res: any) => {
        console.log(`  A join: ${JSON.stringify(res)}`);
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      sockB.emit('table:join', { tableId: virtualTableId }, (res: any) => {
        console.log(`  B join: ${JSON.stringify(res)}`);
        resolve();
      });
    }),
  ]);
  console.log('');

  let lastState: any = null;
  let lastActedKey = '';
  let actionCount = 0;

  const onState = (st: any) => { lastState = st; };
  sockA.on('table:state', onState);
  sockB.on('table:state', onState);
  sockA.on('table:hand_result', (d: any) => {
    console.log(`\n📢 HAND RESULT: winners=${JSON.stringify(d.result?.winners)}`);
  });

  const socketFor = (userId: number) => (userId === A.id ? sockA : sockB);

  const playLoop = setInterval(() => {
    if (!lastState) return;
    if (lastState.phase !== 'preflop') return;
    if (lastState.currentSeat < 0) return;

    const seat = lastState.seats?.find((s: any) => s.seat === lastState.currentSeat);
    if (!seat || seat.folded || seat.allIn) return;

    const allBets = lastState.seats.map((s: any) => s.betThisStreet);
    const maxBet = Math.max(...allBets);
    const noRaiseYet = allBets.every((b: number) => b <= lastState.bigBlind);

    const key = `${lastState.handNo}-${lastState.phase}-${seat.seat}-${seat.betThisStreet}-${seat.stack}-${actionCount}`;
    if (key === lastActedKey) return;
    lastActedKey = key;
    actionCount++;

    const sock = socketFor(seat.userId);

    if (noRaiseYet && seat.betThisStreet <= lastState.smallBlind) {
      const allInAmt = Math.floor((seat.stack + seat.betThisStreet) * 100) / 100;
      console.log(`  → seat ${seat.seat} (${seat.displayName}): ALL-IN $${allInAmt}`);
      sock.emit('table:action', { action: 'RAISE', amount: allInAmt }, (res: any) => {
        if (!res?.ok) console.log(`     ❌ rejected: ${res?.error}`);
      });
      return;
    }

    const toCall = maxBet - seat.betThisStreet;
    if (toCall > 0) {
      console.log(`  → seat ${seat.seat} (${seat.displayName}): CALL $${toCall}`);
      sock.emit('table:action', { action: 'CALL', amount: 0 }, (res: any) => {
        if (!res?.ok) console.log(`     ❌ rejected: ${res?.error}`);
      });
    }
  }, 400);

  console.log('Waiting for tournament to finish...\n');
  const startWait = Date.now();
  let finished = false;
  while (Date.now() - startWait < 90000) {
    const res: any = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
    if (res.status === 'finished') {
      finished = true;
      console.log(`\n✅ Tournament finished in ${((Date.now() - startWait) / 1000).toFixed(1)}s\n`);
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  clearInterval(playLoop);
  sockA.disconnect();
  sockB.disconnect();

  if (!finished) {
    console.error('❌ Tournament did not finish within 90s');
    await db.end();
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════');
  console.log(' DB Verification');
  console.log('═══════════════════════════════════════════\n');

  const tRes = await db.query(
    `SELECT id, status, winner_user_id, total_prize_pool, finished_at
     FROM tournaments WHERE id = $1`,
    [tid]
  );
  const T = tRes.rows[0];
  console.log('Tournament row:');
  console.log(`  status=${T.status}, winner_user_id=${T.winner_user_id}, prize_pool=$${T.total_prize_pool}\n`);

  const eRes = await db.query(
    `SELECT user_id, status, final_position, payout_amount
     FROM tournament_entries WHERE tournament_id = $1 ORDER BY final_position NULLS LAST`,
    [tid]
  );
  console.log('Tournament entries:');
  for (const row of eRes.rows) {
    console.log(`  user=${row.user_id} status=${row.status} pos=${row.final_position ?? '-'} payout=$${row.payout_amount ?? 0}`);
  }
  console.log('');

  const txRes = await db.query(
    `SELECT t.id, t.kind, t.user_id, t.ref, e.amount
     FROM transactions t
     JOIN entries e ON e.tx_id = t.id
     WHERE t.kind = 'TOURNAMENT_PRIZE' AND t.ref LIKE $1
     ORDER BY t.id`,
    [`tourney_${tid}_%`]
  );
  console.log('Ledger TOURNAMENT_PRIZE entries:');
  if (txRes.rows.length === 0) console.log('  (none)');
  for (const row of txRes.rows) {
    console.log(`  tx=${row.id} user=${row.user_id} amount=$${row.amount} ref=${row.ref}`);
  }
  console.log('');

  const wRes = await db.query(
    `SELECT user_id, balance_usd FROM wallets WHERE user_id IN ($1, $2) ORDER BY user_id`,
    [A.id, B.id]
  );
  console.log('Wallets:');
  for (const row of wRes.rows) {
    console.log(`  user=${row.user_id} balance=$${row.balance_usd}`);
  }
  console.log('');

  const totalPayout = eRes.rows.reduce((s, r) => s + Number(r.payout_amount || 0), 0);
  const isFree = true; // this test creates a free tournament

  const checks: [string, boolean][] = [
    ['Tournament status = finished', T.status === 'finished'],
    ['winner_user_id is set', T.winner_user_id != null],
    ['winner is one of the two players', [A.id, B.id].includes(T.winner_user_id)],
    ['At least one entry has status=cashed', eRes.rows.some((r) => r.status === 'cashed')],
    ['At least one entry has payout > 0', eRes.rows.some((r) => Number(r.payout_amount) > 0)],
    [
      `Payouts sum to prize pool ($${totalPayout.toFixed(2)} / $${T.total_prize_pool})`,
      Math.abs(totalPayout - Number(T.total_prize_pool)) < 0.01,
    ],
    [
      isFree ? 'Free mode: NO real-money ledger entries' : 'Real mode: has ledger entries',
      isFree ? txRes.rows.length === 0 : txRes.rows.length > 0,
    ],
  ];

  console.log('═══════════════════════════════════════════');
  console.log(' Assertions');
  console.log('═══════════════════════════════════════════');
  let passed = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (ok) passed++;
  }
  console.log(`\n${passed}/${checks.length} passed\n`);

  await db.end();
  process.exit(passed === checks.length ? 0 : 1);
}

main().catch(async (e) => {
  console.error('FATAL:', e);
  try { await db.end(); } catch {}
  process.exit(1);
});