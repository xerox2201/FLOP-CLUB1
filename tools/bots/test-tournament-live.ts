import dotenv from 'dotenv';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API = 'http://localhost:4000';
const DATABASE_URL = process.env.DATABASE_URL!;
const JWT_SECRET = process.env.JWT_SECRET!;
const NUM_PLAYERS = 6;

async function ensureUsers(db: Pool, n: number): Promise<any[]> {
  // 🔴 Skip user id=1 ("Test") — start from id > 1
  let res = await db.query(
    `SELECT id, telegram_id, display_name FROM users 
     WHERE id > 1 AND display_name NOT LIKE 'Test%'
     ORDER BY id ASC LIMIT $1`,
    [n],
  );

  const existing = res.rows;
  const missing = n - existing.length;

  if (missing > 0) {
    console.log(`Creating ${missing} new bot users...`);
    for (let i = 0; i < missing; i++) {
      const tgId = 900000 + Math.floor(Math.random() * 100000);
      const name = `Bot${existing.length + i + 1}`;
      try {
        await db.query(
          `INSERT INTO users (telegram_id, display_name, avatar_id)
           VALUES ($1, $2, 'spade')`,
          [tgId, name],
        );
      } catch (e: any) {
        console.log(`  user ${name} maybe exists: ${e.message}`);
      }
    }
    res = await db.query(
      `SELECT id, telegram_id, display_name FROM users 
       WHERE id > 1 AND display_name NOT LIKE 'Test%'
       ORDER BY id ASC LIMIT $1`,
      [n],
    );
  }

  return res.rows;
}

async function main() {
  const db = new Pool({ connectionString: DATABASE_URL });

  // 🧹 Cancel old running tournaments
  await db.query(
    `UPDATE tournaments SET status = 'cancelled' 
     WHERE status IN ('running', 'final_table', 'registering', 'scheduled')`,
  );
  console.log('🧹 Cancelled old tournaments');

  const users = await ensureUsers(db, NUM_PLAYERS);
  console.log(`Using ${users.length} users:`);
  for (const u of users) {
    console.log(`  id=${u.id} ${u.display_name}`);
  }

  if (users.length < NUM_PLAYERS) {
    console.error(`❌ Only ${users.length} users available, need ${NUM_PLAYERS}`);
    await db.end();
    return;
  }

  const tokens = users.map((u) =>
    jwt.sign({ uid: u.id, tg: u.telegram_id }, JWT_SECRET, { expiresIn: '24h' }),
  );

  const headers = (i: number) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens[i]}`,
  });

  // Create 6-max tournament
  const createRes = await fetch(`${API}/api/tournaments`, {
    method: 'POST',
    headers: headers(0),
    body: JSON.stringify({
      name: 'Live 6-max ' + Date.now(),
      variant: 'holdem',
      mode: 'free',
      format: 'sng',
      startingStack: 1500,
      minPlayers: 2,
      maxPlayers: 6,
      blindStructureId: 5,
    }),
  }).then((r) => r.json());
  const tid = createRes.tournamentId;
  console.log(`\n✅ Tournament #${tid} created (6-max)`);

  // Register all 6
  for (let i = 0; i < users.length; i++) {
    const r = await fetch(`${API}/api/tournaments/${tid}/register`, {
      method: 'POST',
      headers: headers(i),
      body: JSON.stringify({}),
    }).then((r) => r.json());
    console.log(`  register user ${users[i].id} (${users[i].display_name}): ${JSON.stringify(r)}`);
  }

  // Start
  const startRes = await fetch(`${API}/api/tournaments/${tid}/start`, {
    method: 'POST',
    headers: headers(0),
    body: JSON.stringify({}),
  }).then((r) => r.json());
  console.log(`\n✅ Started: ${JSON.stringify(startRes)}`);

  const detail = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
  const firstPlayer = detail.players[0];
  console.log(`\n🎯 Status: ${detail.status}`);
  console.log(`🏆 Virtual Table ID: ${firstPlayer?.virtualTableId}`);

  console.log('\nPlayers & seats:');
  for (const p of detail.players) {
    console.log(`  seat ${p.seat}: ${p.displayName} (id=${p.userId}, stack=${p.stack})`);
  }

  console.log('\n👉 Open browsers:');
  console.log('   Chrome: http://localhost:5173/?uid=111&name=Ali');
  console.log('   Edge:   http://localhost:5173/?uid=222&name=Sara');
  console.log(`\n   Then: Tourneys → "Live 6-max ..." → 🎰 Go to Your Table`);

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
