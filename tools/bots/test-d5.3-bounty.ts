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

async function main() {
  console.log('🎯 D5.3 Bounty Test\n');

  const uRes = await db.query(
    `SELECT id, telegram_id, display_name FROM users
     WHERE is_banned = FALSE AND telegram_id IS NOT NULL
     ORDER BY id LIMIT 2`,
  );
  const [A, B] = uRes.rows;
  console.log(`Users: A=${A.display_name}  B=${B.display_name}\n`);

  // Cleanup
  await db.query(
    `UPDATE tournaments SET status='cancelled', finished_at=NOW()
     WHERE name LIKE 'D5.3 Bounty%' AND status IN ('running','registering','paused','final_table','scheduled')`,
  );

  // Create 2-player SNG with bounty, no late reg
  const r = await adminCall('POST', '/api/tournaments', {
    name: `D5.3 Bounty ${Date.now()}`,
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'hyper',
    buyIn: 0, fee: 0, startingStack: 5000,
    minPlayers: 2, maxPlayers: 2, guaranteed: 0,
    blindStructureId: 1,
    lateRegLevel: 0,
    allowReEntry: false,
    maxReEntries: 0,
    isBounty: true,
    bountyAmount: 500,
  });
  const tid = r.data.tournamentId;
  console.log(`✅ Tournament #${tid} created (bounty=$500)\n`);

  const tokenA = await loginAs(A.telegram_id, A.display_name);
  const tokenB = await loginAs(B.telegram_id, B.display_name);

  await userCall('POST', `/api/tournaments/${tid}/register`, tokenA, {});
  await userCall('POST', `/api/tournaments/${tid}/register`, tokenB, {});
  await adminCall('POST', `/api/tournaments/${tid}/start`, {});

  await new Promise((res) => setTimeout(res, 1500));

  // Get virtual table + users
  const infoRes = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
  const vTable = infoRes.players[0].virtualTableId;
  console.log(`Virtual table: ${vTable}`);
  console.log(`Players: A(id=${A.id}, seat=${infoRes.players.find((p: any) => p.userId === A.id)?.seat})  B(id=${B.id}, seat=${infoRes.players.find((p: any) => p.userId === B.id)?.seat})\n`);

  // Connect sockets
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
  console.log('✅ Sockets joined\n');

  let lastState: any = null;
  let lastActedKey = '';
  let bountyEvent: any = null;

  sockA.on('table:state', (st: any) => { lastState = st; });
  sockB.on('table:state', (st: any) => { lastState = st; });
  sockA.on('tournament:' + tid + ':bounty', (d: any) => {
    bountyEvent = d;
    console.log(`\n📢 BOUNTY EVENT: ${JSON.stringify(d)}`);
  });

  const socketFor = (userId: number) => (userId === A.id ? sockA : sockB);

  // Play: seat with more chips ALL-IN, other CALL
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
      console.log(`  → seat ${seat.seat} (${seat.displayName}): ALL-IN $${amt}`);
      sock.emit('table:action', { action: 'RAISE', amount: amt });
    } else {
      const toCall = maxBet - seat.betThisStreet;
      if (toCall > 0) {
        console.log(`  → seat ${seat.seat} (${seat.displayName}): CALL`);
        sock.emit('table:action', { action: 'CALL', amount: 0 });
      }
    }
  }, 400);

  // Wait for tournament finished
  const startWait = Date.now();
  let finished = false;
  while (Date.now() - startWait < 60000) {
    const res: any = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
    if (res.status === 'finished') {
      finished = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  clearInterval(playLoop);
  sockA.disconnect();
  sockB.disconnect();

  console.log(`\nFinished: ${finished}\n`);

  // Check DB
  const tRow = await db.query(
    `SELECT status, winner_user_id FROM tournaments WHERE id=$1`,
    [tid],
  );
  console.log('Tournament:', tRow.rows[0]);

  const pRows = await db.query(
    `SELECT user_id, stack, bounty_earned, final_position, status
     FROM tournament_players WHERE tournament_id=$1 ORDER BY user_id`,
    [tid],
  );
  console.log('\nPlayers:');
  for (const p of pRows.rows) {
    console.log(`  user=${p.user_id} stack=${p.stack} bounty=${p.bounty_earned} pos=${p.final_position} status=${p.status}`);
  }

  const winner = tRow.rows[0].winner_user_id;
  const winnerRow = pRows.rows.find((p) => p.user_id === winner);
  const bountyFromWinner = Number(winnerRow?.bounty_earned ?? 0);

  await adminCall('POST', `/api/admin/tournaments/${tid}/cancel`, {});

  const checks: [string, boolean][] = [
    ['Tournament finished', tRow.rows[0].status === 'finished'],
    ['Winner has bounty_earned > 0', bountyFromWinner > 0],
    ['Winner bounty = $500', bountyFromWinner === 500],
  ];

  console.log('\n═══════════════════════════════════════════');
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