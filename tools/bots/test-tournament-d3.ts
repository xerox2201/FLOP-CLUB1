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

  const users = await db.query('SELECT id, telegram_id, display_name FROM users LIMIT 4');
  console.log(`Using ${users.rows.length} users`);

  const tokens = users.rows.map(u =>
    jwt.sign({ uid: u.id, tg: u.telegram_id }, JWT_SECRET, { expiresIn: '1h' })
  );

  const headers = (i: number) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens[i]}`,
  });

  // 1. Create tournament
  const createRes = await fetch(`${API}/api/tournaments`, {
    method: 'POST',
    headers: headers(0),
    body: JSON.stringify({
      name: 'D3 Test',
      variant: 'holdem',
      mode: 'free',
      format: 'sng',
      startingStack: 1500,
      minPlayers: 2,
      maxPlayers: 9,
      blindStructureId: 5,
    }),
  }).then(r => r.json());
  const tid = createRes.tournamentId;
  console.log(`\n✅ Tournament #${tid}`);

  // 2. Register all 4
  for (let i = 0; i < users.rows.length; i++) {
    const r = await fetch(`${API}/api/tournaments/${tid}/register`, {
      method: 'POST',
      headers: headers(i),
      body: JSON.stringify({}),
    }).then(r => r.json());
    console.log(`  register user ${users.rows[i].id}: ${JSON.stringify(r)}`);
  }

  // 3. Start
  const startRes = await fetch(`${API}/api/tournaments/${tid}/start`, {
    method: 'POST',
    headers: headers(0),
    body: JSON.stringify({}),
  }).then(r => r.json());
  console.log(`\n✅ Started: ${JSON.stringify(startRes)}`);

  // 4. Check status
  let detail = await fetch(`${API}/api/tournaments/${tid}`).then(r => r.json());
  console.log(`\nStatus: ${detail.status}`);
  console.log(`Players: ${detail.players.length}`);
  console.table(detail.players.map((p: any) => ({
    name: p.displayName, stack: p.stack, table: p.tableNumber, seat: p.seat,
  })));

  // 5. Bust 3 users
  for (let i = 0; i < 3; i++) {
    const bustRes = await fetch(`${API}/api/tournaments/${tid}/bust`, {
      method: 'POST',
      headers: headers(0),
      body: JSON.stringify({ userId: users.rows[i].id }),
    }).then(r => r.json());
    console.log(`\n💀 Bust user=${users.rows[i].id}:`, JSON.stringify(bustRes));
  }

  // 6. Final
  detail = await fetch(`${API}/api/tournaments/${tid}`).then(r => r.json());
  console.log(`\n🏁 Final status: ${detail.status}`);
  console.log(`Winner:`, detail.players.find((p: any) => p.finalPosition === 1));

  const payouts = await db.query(
    `SELECT user_id, status, final_position, payout_amount
     FROM tournament_entries WHERE tournament_id = $1 ORDER BY final_position`,
    [tid]
  );
  console.table(payouts.rows);

  await db.end();
  console.log('\n✅ D3 test complete');
}

main().catch(e => { console.error(e); process.exit(1); });