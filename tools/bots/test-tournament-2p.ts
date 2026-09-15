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

async function main() {
  const db = new Pool({ connectionString: DATABASE_URL });

  // Cancel old running tournaments
  await db.query(
    `UPDATE tournaments SET status = 'cancelled' WHERE status IN ('running', 'final_table', 'registering', 'scheduled')`,
  );
  console.log('🧹 Cancelled old tournaments');

  // Only Ali (id=2) and Sara (id=3)
  const users = await db.query(
    `SELECT id, telegram_id, display_name FROM users WHERE id IN (2, 3) ORDER BY id`,
  );
  console.log(`Using ${users.rows.length} users (Ali + Sara only):`);
  for (const u of users.rows) {
    console.log(`  id=${u.id} ${u.display_name}`);
  }

  if (users.rows.length < 2) {
    console.error('❌ Need Ali (id=2) and Sara (id=3)');
    await db.end();
    return;
  }

  const tokens = users.rows.map((u) =>
    jwt.sign({ uid: u.id, tg: u.telegram_id }, JWT_SECRET, { expiresIn: '24h' }),
  );

  const headers = (i: number) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens[i]}`,
  });

  // Create 2-max tournament
  const createRes = await fetch(`${API}/api/tournaments`, {
    method: 'POST',
    headers: headers(0),
    body: JSON.stringify({
      name: 'Heads-Up Test ' + Date.now(),
      variant: 'holdem',
      mode: 'free',
      format: 'sng',
      startingStack: 1500,
      minPlayers: 2,
      maxPlayers: 2,
      blindStructureId: 6, // Heads-Up structure
    }),
  }).then((r) => r.json());
  const tid = createRes.tournamentId;
  console.log(`\n✅ Tournament #${tid} created (2-max)`);

  // Register both
  for (let i = 0; i < users.rows.length; i++) {
    const r = await fetch(`${API}/api/tournaments/${tid}/register`, {
      method: 'POST',
      headers: headers(i),
      body: JSON.stringify({}),
    }).then((r) => r.json());
    console.log(`  register ${users.rows[i].display_name}: ${JSON.stringify(r)}`);
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

  console.log('\nPlayers:');
  for (const p of detail.players) {
    console.log(`  seat ${p.seat}: ${p.displayName} (id=${p.userId})`);
  }

  console.log('\n👉 Open browsers:');
  console.log('   Chrome: http://localhost:5173/?uid=111&name=Ali');
  console.log('   Edge:   http://localhost:5173/?uid=222&name=Sara');
  console.log(`\n   Then: Tourneys → "Heads-Up Test..." → 🎰 Go to Your Table`);
  console.log('\n   Play until one player loses all chips!');

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
