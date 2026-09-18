import { Pool } from 'pg';
import { io, Socket } from 'socket.io-client';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API = 'http://localhost:4000';
const ADMIN = process.env.ADMIN_SECRET || 'admin_dev_secret';
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker',
});

async function loginAs(tg: number, name: string) {
  const userJson = JSON.stringify({
    id: tg, first_name: name, username: name.toLowerCase(), language_code: 'en',
  });
  const initData = `user=${encodeURIComponent(userJson)}&auth_date=9999999999&hash=dev`;
  const res = await fetch(`${API}/api/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  return (await res.json()).token as string;
}

async function adminCall(method: string, p: string, body?: any) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function userCall(method: string, p: string, token: string, body?: any) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function playTournament(tid: number, userA: any, userB: any) {
  const infoRes = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
  const vTable = infoRes.players[0].virtualTableId;

  const tokenA = await loginAs(userA.telegram_id, userA.display_name);
  const tokenB = await loginAs(userB.telegram_id, userB.display_name);

  const sockA: Socket = io(API, { auth: { token: tokenA }, transports: ['websocket', 'polling'] });
  const sockB: Socket = io(API, { auth: { token: tokenB }, transports: ['websocket', 'polling'] });

  await new Promise<void>((resolve) => {
    let c = 0;
    const check = () => { if (++c === 2) resolve(); };
    sockA.on('connect', check);
    sockB.on('connect', check);
  });

  await Promise.all([
    new Promise<void>((r) => sockA.emit('table:join', { tableId: vTable }, () => r())),
    new Promise<void>((r) => sockB.emit('table:join', { tableId: vTable }, () => r())),
  ]);

  let lastState: any = null;
  let lastActedKey = '';
  sockA.on('table:state', (st: any) => { lastState = st; });
  sockB.on('table:state', (st: any) => { lastState = st; });
  const socketFor = (userId: number) => (userId === userA.id ? sockA : sockB);

  const playLoop = setInterval(() => {
    if (!lastState || lastState.phase !== 'preflop') return;
    if (lastState.currentSeat < 0) return;
    const seat = lastState.seats?.find((s: any) => s.seat === lastState.currentSeat);
    if (!seat || seat.folded || seat.allIn) return;
    const allBets = lastState.seats.map((s: any) => s.betThisStreet);
    const maxBet = Math.max(...allBets);
    const noRaiseYet = allBets.every((b: number) => b <= lastState.bigBlind);
    const key = `${lastState.handNo}-${seat.seat}-${seat.stack}-${seat.betThisStreet}`;
    if (key === lastActedKey) return;
    lastActedKey = key;
    const sock = socketFor(seat.userId);
    if (noRaiseYet && seat.betThisStreet <= lastState.smallBlind) {
      const amt = Math.floor((seat.stack + seat.betThisStreet) * 100) / 100;
      sock.emit('table:action', { action: 'RAISE', amount: amt });
    } else {
      const toCall = maxBet - seat.betThisStreet;
      if (toCall > 0) sock.emit('table:action', { action: 'CALL', amount: 0 });
    }
  }, 400);

  const startWait = Date.now();
  while (Date.now() - startWait < 60000) {
    const res: any = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
    if (res.status === 'finished') break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  clearInterval(playLoop);
  sockA.disconnect();
  sockB.disconnect();
}

async function main() {
  console.log('🎯 D6.2 Season Leaderboard Test\n');

  const uRes = await db.query(
    `SELECT id, telegram_id, display_name FROM users
     WHERE is_banned = FALSE AND telegram_id IS NOT NULL
     ORDER BY id LIMIT 2`,
  );
  const [A, B] = uRes.rows;
  console.log(`Users: A=${A.display_name}  B=${B.display_name}\n`);

  // Reset A/B points from previous runs
  await db.query(
    `UPDATE tournament_entries SET points_earned = 0 WHERE user_id IN ($1, $2)`,
    [A.id, B.id],
  );

  // Cleanup
  await db.query(
    `UPDATE tournaments SET status='cancelled', finished_at=NOW()
     WHERE name LIKE 'D6.2 Test%' AND status IN ('running','registering','scheduled','paused','final_table')`,
  );

  // Create a 2-player SNG
  const createRes = await adminCall('POST', '/api/tournaments', {
    name: `D6.2 Test ${Date.now()}`,
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'hyper',
    buyIn: 0, fee: 0, startingStack: 5000,
    minPlayers: 2, maxPlayers: 2, guaranteed: 0,
    blindStructureId: 1,
  });
  const tid = createRes.data.tournamentId;
  console.log(`✅ Tournament #${tid} created\n`);

  const tokenA = await loginAs(A.telegram_id, A.display_name);
  const tokenB = await loginAs(B.telegram_id, B.display_name);
  await userCall('POST', `/api/tournaments/${tid}/register`, tokenA, {});
  await userCall('POST', `/api/tournaments/${tid}/register`, tokenB, {});
  await adminCall('POST', `/api/tournaments/${tid}/start`, {});
  await new Promise((r) => setTimeout(r, 1500));

  console.log('Playing tournament to finish...\n');
  await playTournament(tid, A, B);

  // Verify season assignment
  const tRow = await db.query(
    `SELECT season_id, status, winner_user_id FROM tournaments WHERE id=$1`,
    [tid],
  );
  console.log('Tournament:', tRow.rows[0]);

  // Check points
  const pRows = await db.query(
    `SELECT user_id, final_position, points_earned, status
     FROM tournament_entries WHERE tournament_id=$1 ORDER BY final_position`,
    [tid],
  );
  console.log('\nEntries:');
  for (const p of pRows.rows) {
    console.log(`  user=${p.user_id} pos=${p.final_position} points=${p.points_earned} status=${p.status}`);
  }

  // Check season leaderboard
  console.log('\n═══ Season leaderboard API ═══');
  const lbRes = await fetch(`${API}/api/leaderboard/season`).then((r) => r.json());
  console.log(`Season: ${lbRes.season.name}`);
  console.log(`Top entries:`);
  for (const e of lbRes.entries.slice(0, 5)) {
    console.log(`  #${e.rank} user=${e.userId} ${e.displayName} → ${e.points} pts (${e.played} played, ${e.wins} wins)`);
  }

  // Check my rank
  const myRes = await fetch(`${API}/api/leaderboard/season/me`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  }).then((r) => r.json());
  console.log(`\nMy rank (A): ${JSON.stringify(myRes.me)}`);

  // Cleanup
  await adminCall('POST', `/api/admin/tournaments/${tid}/cancel`, {});
  console.log('\n(Cleaned up)\n');

  const winnerId = tRow.rows[0].winner_user_id;
  const winnerEntry = pRows.rows.find((p) => p.user_id === winnerId);
  const loserEntry = pRows.rows.find((p) => p.user_id !== winnerId);

  const checks: [string, boolean][] = [
    ['Tournament assigned to season', tRow.rows[0].season_id != null],
    ['Winner got points > 0', Number(winnerEntry?.points_earned) > 0],
    ['Loser got points > 0', Number(loserEntry?.points_earned) > 0],
    ['Winner got more points than loser', Number(winnerEntry?.points_earned) > Number(loserEntry?.points_earned)],
    ['Leaderboard API returns entries', lbRes.entries.length >= 2],
    ['Leaderboard ranked correctly (winner first)', lbRes.entries[0]?.userId === winnerId],
    ['My rank API works', myRes.me != null],
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