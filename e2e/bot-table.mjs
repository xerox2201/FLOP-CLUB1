// Dev-only bot table driver: 8 seeded bots join one table and play hands.
//   node e2e/bot-table.mjs [hands] [seconds]
// Uses the real protocol: socket auth { token } -> table:join -> table:action.
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import crypto from 'crypto';
import { io } from 'socket.io-client';

const HANDS = Number(process.argv[2] || 5);
const SECONDS = Number(process.argv[3] || 90);

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SECRET = env.JWT_SECRET;
const db = new pg.Pool({ connectionString: env.DATABASE_URL });

// minimal HS256 signer (same wire format jsonwebtoken produces)
function signJwt(payload, secret, expiresInSec) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ ...payload, iat: now, exp: now + expiresInSec });
  return data + '.' + crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

const bots = (await db.query(
  "SELECT id, telegram_id, display_name FROM users WHERE telegram_id >= 900000000 ORDER BY telegram_id LIMIT 8",
)).rows;
console.log('bots found: ' + bots.length + ' -> ' + bots.map((b) => b.display_name).join(', '));

const tables = (await db.query("SELECT id, name, mode FROM poker_tables ORDER BY id LIMIT 5")).rows;
const tableId = Number(process.argv[4] || tables[0]?.id || 1);
console.log('table: #' + tableId + ' ' + (tables.find((t) => t.id === tableId)?.name || ''));

const stats = { hands: 0, actions: 0, joins: [], errors: [], results: [] };
const sockets = [];

for (const bot of bots) {
  const token = signJwt({ uid: bot.id }, SECRET, 3600);
  const s = io('http://localhost:4000', { auth: { token }, transports: ['websocket'] });
  s.bot = bot;
  s.on('connect_error', (e) => stats.errors.push(bot.display_name + ' connect_error: ' + e.message));
  s.on('table:state', (st) => {
    const me = (st.seats || []).find((x) => Number(x.userId) === Number(bot.id));
    if (!me || st.currentSeat !== me.seat) return;
    // the state exposes no currentBet: the engine derives it as max(betThisStreet)
    const maxBet = Math.max(0, ...(st.seats || []).map((x) => Number(x.betThisStreet || 0)));
    const toCall = maxBet - Number(me.betThisStreet || 0);
    const canCheck = toCall <= 0.001;
    const minRaise = Number(st.minRaise || st.bigBlind || 10);
    const canRaise = Number(me.stack || 0) > toCall + minRaise;
    const roll = Math.random();
    let action = canCheck ? 'CHECK' : 'CALL';
    let amount = 0;
    if (canRaise && roll < 0.18) { action = 'RAISE'; amount = Math.round((maxBet + minRaise) * 100) / 100; }
    else if (canRaise && roll < 0.22) { action = 'RAISE'; amount = Math.round(Number(me.stack || 0) + Number(me.betThisStreet || 0)); }
    stats.actions++;
    s.emit('table:action', { action, amount, commandId: 'b' + Date.now() + Math.random() }, (res) => {
      if (res && res.ok === false && res.code !== 'not_your_turn') {
        stats.errors.push(bot.display_name + ' ' + action + ' -> ' + (res.code || res.error));
        if (!canCheck) s.emit('table:action', { action: 'FOLD', amount: 0, commandId: 'f' + Date.now() }, () => {});
      }
    });
    if (stats.hands === 0 && stats.actions <= bots.length) console.log('  act: ' + bot.display_name + ' ' + action);
  });
  s.on('table:hand_result', (r) => {
    stats.hands++;
    const w = (r?.result?.winners || []).join('+');
    stats.results.push(Math.round(r?.result?.rake || 0) + '|' + w);
    if (stats.hands % 5 === 0) console.log('  hands: ' + stats.hands + '  actions: ' + stats.actions + '  errors: ' + stats.errors.length);
    if (stats.hands >= HANDS) finish('hand target reached');
  });
  s.on('connect', () => {
    s.emit('table:join', { tableId }, (ack) => {
      stats.joins.push(bot.display_name + ':' + JSON.stringify(ack));
      if (!ack || ack.ok === false) stats.errors.push(bot.display_name + ' join -> ' + JSON.stringify(ack));
    });
  });
  sockets.push(s);
  await new Promise((r) => setTimeout(r, 120));
}

let done = false;
function finish(why) {
  if (done) return;
  done = true;
  console.log('\n=== finished: ' + why + ' ===');
  console.log('hands: ' + stats.hands + '   actions: ' + stats.actions + '   errors: ' + stats.errors.length);
  stats.errors.slice(0, 12).forEach((e) => console.log('  ERR ' + e));
  const ok = stats.joins.filter((j) => j.includes('"ok":true')).length;
  console.log('joined ok: ' + ok + '/' + bots.length);
  stats.joins.slice(0, 3).forEach((j) => console.log('  ' + j));
  sockets.forEach((s) => s.close());
  db.end().finally(() => process.exit(0));
}

setTimeout(() => finish('time limit ' + SECONDS + 's'), SECONDS * 1000);
