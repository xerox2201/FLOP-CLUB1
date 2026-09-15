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

  // Get or create test user
  const userRes = await db.query('SELECT id, telegram_id, display_name FROM users LIMIT 1');
  const user = userRes.rows[0];
  console.log(`Using user: id=${user.id} name=${user.display_name}`);

  const token = jwt.sign({ uid: user.id, tg: user.telegram_id }, JWT_SECRET, { expiresIn: '1h' });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. Get blind structures
  console.log('\n=== 1. Blind Structures ===');
  const bs = await fetch(`${API}/api/blind-structures`).then((r) => r.json());
  console.table(bs.structures);

  // 2. Create tournament
  console.log('\n=== 2. Create Tournament ===');
  const createRes = await fetch(`${API}/api/tournaments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Test SNG #1',
      variant: 'holdem',
      mode: 'free',
      format: 'sng',
      speed: 'regular',
      buyIn: 0,
      fee: 0,
      startingStack: 1500,
      minPlayers: 2,
      maxPlayers: 9,
      guaranteed: 0,
      blindStructureId: 5,
    }),
  }).then((r) => r.json());
  console.log(createRes);

  const tid = createRes.tournamentId;

  // 3. Register — 🔴 FIXED: body اضافه شد
  console.log('\n=== 3. Register ===');
  const regRes = await fetch(`${API}/api/tournaments/${tid}/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  }).then((r) => r.json());
  console.log(regRes);

  // 4. List tournaments
  console.log('\n=== 4. List Tournaments ===');
  const list = await fetch(`${API}/api/tournaments`).then((r) => r.json());
  console.table(
    list.tournaments.map((t: any) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      registered: t.registeredCount,
    })),
  );

  // 5. Get details
  console.log('\n=== 5. Get Details ===');
  const detail = await fetch(`${API}/api/tournaments/${tid}`).then((r) => r.json());
  console.log(`Name: ${detail.name}`);
  console.log(`Status: ${detail.status}`);
  console.log(`Registered: ${detail.registeredCount}`);
  console.log(`Payouts:`, detail.payouts);

  await db.end();
  console.log('\n✅ All tests complete');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
