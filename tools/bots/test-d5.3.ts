import { Pool } from 'pg';
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
  console.log('🎯 D5.3 Re-entry + Bounty Test\n');

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
     WHERE name LIKE 'D5.3 Test%' AND status IN ('running','registering','paused','final_table','scheduled')`,
  );

  // Create with allowReEntry + bounty
  const r = await adminCall('POST', '/api/tournaments', {
    name: `D5.3 Test ${Date.now()}`,
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'hyper',
    buyIn: 0, fee: 0, startingStack: 5000,
    minPlayers: 2, maxPlayers: 9, guaranteed: 0,
    blindStructureId: 1,
    lateRegLevel: 3,
    allowReEntry: true,
    maxReEntries: 2,
    isBounty: true,
    bountyAmount: 250,
  });
  if (!r.data.ok) {
    console.error('❌ Create failed:', r.data);
    await db.end();
    process.exit(1);
  }
  const tid = r.data.tournamentId;
  console.log(`✅ Tournament #${tid} created`);
  console.log(`   allowReEntry=true  maxReEntries=2  isBounty=true  bounty=$250\n`);

  // Verify DB
  const dbRow = await db.query(
    `SELECT allow_re_entry, max_re_entries, is_bounty, bounty_amount FROM tournaments WHERE id=$1`,
    [tid],
  );
  console.log('DB flags:', dbRow.rows[0]);
  console.log('');

  const tokenA = await loginAs(A.telegram_id, A.display_name);
  const tokenB = await loginAs(B.telegram_id, B.display_name);

  await userCall('POST', `/api/tournaments/${tid}/register`, tokenA, {});
  await userCall('POST', `/api/tournaments/${tid}/register`, tokenB, {});

  console.log('Starting tournament...');
  await adminCall('POST', `/api/tournaments/${tid}/start`, {});
  await new Promise((res) => setTimeout(res, 1500));

  // Verify bounty is enabled
  const infoRes = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
  console.log(`\nTournament status: ${infoRes.status}`);
  console.log(`Current level: ${infoRes.currentLevel}`);
  console.log(`Late reg level: ${infoRes.lateRegLevel}`);
  console.log(`Is bounty: ${infoRes.isBounty}`);
  console.log(`Bounty amount: $${infoRes.bountyAmount}`);
  console.log(`Allow re-entry: ${infoRes.allowReEntry}`);
  console.log(`Max re-entries: ${infoRes.maxReEntries}\n`);

  // Manually eliminate B (simulate)
  console.log('═══ Simulating B elimination (set stack=0) ═══');
  await db.query(
    `UPDATE tournament_players SET stack = 0 WHERE tournament_id=$1 AND user_id=$2`,
    [tid, B.id],
  );

  // Now try re-entry for B via register endpoint
  console.log('═══ B re-entry attempt ═══');
  const reRes = await userCall('POST', `/api/tournaments/${tid}/register`, tokenB, {});
  console.log(`  status=${reRes.status}  data=${JSON.stringify(reRes.data)}`);

  const entryRow = await db.query(
    `SELECT status, re_entry_count FROM tournament_entries
     WHERE tournament_id=$1 AND user_id=$2`,
    [tid, B.id],
  );
  console.log(`  B entry: ${JSON.stringify(entryRow.rows[0])}\n`);

  // Cleanup
  await adminCall('POST', `/api/admin/tournaments/${tid}/cancel`, {});
  console.log('(Cleaned up)\n');

  const checks: [string, boolean][] = [
    ['allow_re_entry saved', dbRow.rows[0].allow_re_entry === true],
    ['max_re_entries saved', dbRow.rows[0].max_re_entries === 2],
    ['is_bounty saved', dbRow.rows[0].is_bounty === true],
    ['bounty_amount saved', Number(dbRow.rows[0].bounty_amount) === 250],
    ['tournament started with bounty info', infoRes.isBounty === true],
    ['B re-entry succeeded', reRes.data.ok === true],
    ['B re_entry_count = 1', Number(entryRow.rows[0]?.re_entry_count) === 1],
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