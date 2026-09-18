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

async function adminCall(method: string, p: string, body?: any) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function main() {
  console.log('🎯 D6.1 Recurring Template Test\n');

  const marker = `D6.1Test-${Date.now()}`;
  console.log(`Marker: ${marker}\n`);

  // Cleanup old templates AND tournaments from previous runs
  await db.query(`DELETE FROM tournament_templates WHERE name LIKE 'D6.1Test-%'`);
  await db.query(
    `UPDATE tournaments SET status='cancelled', finished_at=NOW()
     WHERE name LIKE 'D6.1Test-%' AND status IN ('running','registering','scheduled','paused','final_table')`,
  );

  // 1. Create hourly template (fires immediately when we force next_run_at)
  console.log('═══ Create hourly template ═══');
  const createRes = await adminCall('POST', '/api/admin/tournament-templates', {
    name: marker,
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'hyper',
    buyIn: 0, fee: 0, startingStack: 5000,
    minPlayers: 2, maxPlayers: 9, guaranteed: 0,
    blindStructureId: 1,
    scheduleType: 'hourly',
  });
  console.log('  ', JSON.stringify(createRes.data));
  const tplId = createRes.data.templateId;

  // 2. Verify template row
  const tplRow = await db.query(
    `SELECT id, name, schedule_type, is_active, next_run_at FROM tournament_templates WHERE id = $1`,
    [tplId],
  );
  console.log(`\nTemplate row: ${JSON.stringify(tplRow.rows[0])}\n`);

  // 3. Force next_run_at to past so scheduler fires
  console.log('═══ Force next_run_at to past (simulate due) ═══');
  await db.query(
    `UPDATE tournament_templates SET next_run_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
    [tplId],
  );
  console.log('  Waiting ~65s for scheduler to fire...\n');

  const testStartTime = new Date();
  let createdTid: number | null = null;
  const startWait = Date.now();
  while (Date.now() - startWait < 75_000) {
    const check = await db.query(
      `SELECT id FROM tournaments
       WHERE name LIKE $1 AND created_at >= $2
       ORDER BY id DESC LIMIT 1`,
      [`${marker}%`, testStartTime],
    );
    if (check.rows.length > 0) {
      createdTid = check.rows[0].id;
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
    process.stdout.write('.');
  }
  console.log('');

  let after: any = { rows: [{}] };
  if (createdTid) {
    console.log(`\n✅ Scheduler created tournament #${createdTid}\n`);

    // Verify template's last_run_at got set and next_run_at advanced
    after = await db.query(
      `SELECT next_run_at, last_run_at FROM tournament_templates WHERE id = $1`,
      [tplId],
    );
    console.log(
      `Template after fire: next_run_at=${after.rows[0].next_run_at}, last_run_at=${after.rows[0].last_run_at}`,
    );
  } else {
    console.log('\n❌ Scheduler did NOT fire within 75s\n');
  }

  // 4. Test toggle (pause)
  console.log('═══ Test toggle (pause) ═══');
  await adminCall('POST', `/api/admin/tournament-templates/${tplId}/toggle`, { active: false });
  const paused = await db.query(
    `SELECT is_active, next_run_at FROM tournament_templates WHERE id = $1`,
    [tplId],
  );
  console.log(`  After pause: is_active=${paused.rows[0].is_active}, next_run_at=${paused.rows[0].next_run_at}`);

  // 5. Test weekly schedule computeNextRun
  console.log('\n═══ Test weekly template ═══');
  const weeklyName = `${marker}-weekly`;
  const weeklyRes = await adminCall('POST', '/api/admin/tournament-templates', {
    name: weeklyName,
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'regular',
    buyIn: 0, fee: 0, startingStack: 5000,
    minPlayers: 2, maxPlayers: 9, guaranteed: 0,
    blindStructureId: 1,
    scheduleType: 'weekly',
    scheduleTime: '18:00',
    scheduleDay: 5, // Friday
  });
  const weeklyId = weeklyRes.data.templateId;
  const weeklyRow = await db.query(
    `SELECT schedule_type, schedule_time, schedule_day, next_run_at FROM tournament_templates WHERE id = $1`,
    [weeklyId],
  );
  console.log(`  Weekly row: ${JSON.stringify(weeklyRow.rows[0])}`);
  console.log(
    `  next_run_at day of week: ${new Date(weeklyRow.rows[0].next_run_at).getUTCDay()} (should be 5)`,
  );

  // 6. List all templates
  console.log('\n═══ List all templates ═══');
  const listRes = await adminCall('GET', '/api/admin/tournament-templates');
  console.log(`  Count: ${listRes.data.templates?.length ?? 0}`);

  // Cleanup
  await adminCall('DELETE', `/api/admin/tournament-templates/${tplId}`);
  await adminCall('DELETE', `/api/admin/tournament-templates/${weeklyId}`);
  if (createdTid) {
    await adminCall('POST', `/api/admin/tournaments/${createdTid}/cancel`, {});
  }
  console.log('\n(Cleaned up)\n');

  const checks: [string, boolean][] = [
    ['Template created', createRes.data.ok === true],
    ['Template row has correct schedule_type', tplRow.rows[0].schedule_type === 'hourly'],
    ['Template initially active', tplRow.rows[0].is_active === true],
    ['Scheduler fired & created tournament', createdTid !== null],
    ['Template last_run_at set after fire', after.rows[0]?.last_run_at != null],
    ['Pause toggle worked', paused.rows[0].is_active === false],
    ['Weekly template created', weeklyRes.data.ok === true],
    [
      'Weekly next_run is on Friday (day 5)',
      new Date(weeklyRow.rows[0].next_run_at).getUTCDay() === 5,
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
  try {
    await db.end();
  } catch {}
  process.exit(1);
});