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
  console.log('🎯 D5.4 Satellite Test\n');

  const uRes = await db.query(
    `SELECT id, telegram_id, display_name FROM users
     WHERE is_banned = FALSE AND telegram_id IS NOT NULL
     ORDER BY id LIMIT 2`,
  );
  const [A, B] = uRes.rows;
  console.log(`Users: A=${A.display_name}  B=${B.display_name}\n`);

  // Cleanup old
  await db.query(
    `UPDATE tournaments SET status='cancelled', finished_at=NOW()
     WHERE name LIKE 'D5.4%' AND status IN ('running','registering','paused','final_table','scheduled')`,
  );

  // 1. Create main tournament (target)
  const mainRes = await adminCall('POST', '/api/tournaments', {
    name: `D5.4 Main ${Date.now()}`,
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'hyper',
    buyIn: 0, fee: 0, startingStack: 5000,
    minPlayers: 2, maxPlayers: 9, guaranteed: 0,
    blindStructureId: 1,
  });
  const mainTid = mainRes.data.tournamentId;
  console.log(`✅ Main tournament #${mainTid} created\n`);

  // 2. Create satellite targeting the main
  const satRes = await adminCall('POST', '/api/tournaments', {
    name: `D5.4 Satellite ${Date.now()}`,
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'hyper',
    buyIn: 0, fee: 0, startingStack: 5000,
    minPlayers: 2, maxPlayers: 9, guaranteed: 0,
    blindStructureId: 1,
    satelliteTargetId: mainTid,
    seatsAwarded: 1,
  });
  const satTid = satRes.data.tournamentId;
  console.log(`✅ Satellite #${satTid} created (target=#${mainTid}, seats=1)\n`);

  // Verify DB
  const dbRow = await db.query(
    `SELECT satellite_target_id, seats_awarded FROM tournaments WHERE id=$1`,
    [satTid],
  );
  console.log('Satellite DB:', dbRow.rows[0]);
  console.log('');

  // 3. Register + start satellite
  const tokenA = await loginAs(A.telegram_id, A.display_name);
  const tokenB = await loginAs(B.telegram_id, B.display_name);
  await userCall('POST', `/api/tournaments/${satTid}/register`, tokenA, {});
  await userCall('POST', `/api/tournaments/${satTid}/register`, tokenB, {});
  await adminCall('POST', `/api/tournaments/${satTid}/start`, {});
  await new Promise((r) => setTimeout(r, 1500));
  console.log('Satellite started. Playing...\n');

  // 4. Play the satellite to completion
  await playTournament(satTid, A, B);

  // 5. Verify ticket was awarded
  console.log('\n═══ After satellite finishes ═══');

  const ticketRows = await db.query(
    `SELECT id, user_id, target_tournament_id, source_tournament_id, position, used
     FROM satellite_tickets WHERE source_tournament_id = $1`,
    [satTid],
  );
  console.log(`Tickets created: ${ticketRows.rows.length}`);
  for (const t of ticketRows.rows) {
    console.log(`  ticket#${t.id} user=${t.user_id} → target#${t.target_tournament_id} pos=${t.position} used=${t.used}`);
  }

  const winnerId = ticketRows.rows[0]?.user_id;
  const winnerToken = winnerId === A.id ? tokenA : tokenB;

  console.log(`\nWinner (ticket holder): user=${winnerId}\n`);

  // 6. Winner registers for main tournament (should be free via ticket)
  console.log('═══ Winner registers for main tournament ═══');
  const mainReg = await userCall('POST', `/api/tournaments/${mainTid}/register`, winnerToken, {});
  console.log(`  status=${mainReg.status}  data=${JSON.stringify(mainReg.data)}`);

  const mainEntry = await db.query(
    `SELECT status FROM tournament_entries WHERE tournament_id=$1 AND user_id=$2`,
    [mainTid, winnerId],
  );
  console.log(`  Main entry: ${JSON.stringify(mainEntry.rows[0])}`);

  // 7. Check ticket was marked used
  const ticketAfter = await db.query(
    `SELECT used, used_at FROM satellite_tickets WHERE id = $1`,
    [ticketRows.rows[0].id],
  );
  console.log(`  Ticket after: used=${ticketAfter.rows[0].used}`);

  // 8. Also check user tickets API
  const ticketsApiRes = await fetch(`${API}/api/tournaments/satellite/tickets`, {
    headers: { Authorization: `Bearer ${winnerToken}` },
  });
  const ticketsApi = await ticketsApiRes.json();
  console.log(`  API tickets count: ${ticketsApi.tickets?.length ?? 0}\n`);

  // Cleanup
  await adminCall('POST', `/api/admin/tournaments/${mainTid}/cancel`, {});
  await adminCall('POST', `/api/admin/tournaments/${satTid}/cancel`, {});
  console.log('(Cleaned up)\n');

  // Assertions
  const checks: [string, boolean][] = [
    ['Satellite created with target', dbRow.rows[0].satellite_target_id === mainTid],
    ['seats_awarded saved', dbRow.rows[0].seats_awarded === 1],
    ['Ticket created for winner', ticketRows.rows.length === 1],
    ['Ticket is for main tournament', ticketRows.rows[0]?.target_tournament_id === mainTid],
    ['Winner registers for main', mainReg.data.ok === true],
    ['Ticket marked as used', ticketAfter.rows[0].used === true],
    ['API returns the ticket', (ticketsApi.tickets?.length ?? 0) >= 1],
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