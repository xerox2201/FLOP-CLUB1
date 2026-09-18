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

async function main() {
  console.log('🎯 D6.3 My Tournament History Test\n');

  const uRes = await db.query(
    `SELECT id, telegram_id, display_name FROM users
     WHERE is_banned = FALSE AND telegram_id IS NOT NULL
     ORDER BY id LIMIT 1`,
  );
  const A = uRes.rows[0];
  console.log(`User: ${A.display_name} (id=${A.id})\n`);

  const tokenA = await loginAs(A.telegram_id, A.display_name);

  // Fetch history (all)
  console.log('═══ All tournaments ═══');
  const allRes = await fetch(`${API}/api/my/tournaments?filter=all`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  }).then((r) => r.json());
  console.log(`  Tournaments: ${allRes.tournaments?.length ?? 0}`);
  console.log(`  Stats:`, allRes.stats);
  console.log('');

  // Fetch wins
  console.log('═══ Filter: won ═══');
  const wonRes = await fetch(`${API}/api/my/tournaments?filter=won`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  }).then((r) => r.json());
  console.log(`  Wins: ${wonRes.tournaments?.length ?? 0}`);

  // Fetch ITM
  console.log('\n═══ Filter: itm ═══');
  const itmRes = await fetch(`${API}/api/my/tournaments?filter=itm`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  }).then((r) => r.json());
  console.log(`  ITM: ${itmRes.tournaments?.length ?? 0}`);

  // Fetch eliminated
  console.log('\n═══ Filter: eliminated ═══');
  const elimRes = await fetch(`${API}/api/my/tournaments?filter=eliminated`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  }).then((r) => r.json());
  console.log(`  Eliminated: ${elimRes.tournaments?.length ?? 0}`);

  // Show first 3 tournaments
  if (allRes.tournaments?.length > 0) {
    console.log('\n═══ First 3 tournaments ═══');
    for (const t of allRes.tournaments.slice(0, 3)) {
      console.log(`  #${t.id} ${t.name} → pos=${t.finalPosition} payout=$${t.payout} pts=${t.points}`);
    }
  }

  const checks: [string, boolean][] = [
    ['History endpoint works', allRes.tournaments !== undefined],
    ['Stats returned', allRes.stats != null],
    ['Stats has total count', typeof allRes.stats?.total === 'number'],
    ['Stats has ROI', typeof allRes.stats?.roi === 'number'],
    ['Stats has ITM%', typeof allRes.stats?.itmPct === 'number'],
    ['won filter returns only wins', wonRes.tournaments?.every((t: any) => t.finalPosition === 1) ?? true],
    ['eliminated filter excludes winners', elimRes.tournaments?.every((t: any) => !t.isWinner) ?? true],
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