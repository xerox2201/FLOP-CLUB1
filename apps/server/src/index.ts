 import './env.js';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { verifyTelegramInitData, signToken, verifyToken } from './auth.js';
import { setupSocketServer } from './socket-server.js';
import { registerLeaderboardRoutes } from './leaderboard.js';
import { registerEventsRoutes } from './events.js';
import { registerAntiCheatRoutes } from './anti-cheat-routes.js';
import { registerTableManagerRoutes } from './table-manager.js';

const PORT = Number(process.env.PORT ?? 4000);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://poker:pokerpass@localhost:5432/poker';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

const app = Fastify({ logger: true });
const db = new Pool({ connectionString: DATABASE_URL });

// 🔴 Expose db pool for HandPersister
(globalThis as any).__dbPool = db;

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 20) return null;
    return Math.min(times * 500, 5000);
  },
});

let redisReady = false;
let lastRedisErrorLog = 0;

redis.on('ready', () => {
  redisReady = true;
  console.log('[redis] ✅ connected');
});
redis.on('error', (err: any) => {
  redisReady = false;
  const now = Date.now();
  if (now - lastRedisErrorLog > 30000) {
    lastRedisErrorLog = now;
    console.error(`[redis] ⚠️ ${err.code ?? err.message}`);
  }
});

await app.register(cors, { origin: true });

app.get('/health', async () => {
  const dbRes = await db.query('SELECT NOW() as now');
  let redisStatus: string;
  try { redisStatus = await redis.ping(); } catch { redisStatus = 'unavailable'; }
  return {
    status: 'ok',
    db_time: dbRes.rows[0].now,
    redis: redisStatus,
    redis_ready: redisReady,
    uptime: process.uptime(),
  };
});

app.get('/api/tables', async () => {
  const res = await db.query(
    'SELECT id, name, variant, mode, speed, blinds, min_buyin, max_buyin, rake_pct, seats FROM poker_tables WHERE is_active = TRUE ORDER BY id'
  );
  return { tables: res.rows };
});

app.post<{ Body: { initData: string } }>('/api/auth/telegram', async (req, reply) => {
  const { initData } = req.body ?? {};
  if (!initData) return reply.code(400).send({ error: 'initData required' });

  let tgUser;
  if (!BOT_TOKEN) {
    const params = new URLSearchParams(initData);
    const u = params.get('user');
    if (!u) return reply.code(400).send({ error: 'dev mode: user required' });
    tgUser = JSON.parse(u);
  } else {
    const parsed = verifyTelegramInitData(initData, BOT_TOKEN);
    if (!parsed) return reply.code(401).send({ error: 'invalid initData' });
    tgUser = parsed.user;
  }

  const existing = await db.query('SELECT * FROM users WHERE telegram_id = $1', [tgUser.id]);
  let user;
  if (existing.rows.length > 0) {
    user = existing.rows[0];
    const newName = tgUser.first_name ?? user.display_name;
    if (user.display_name !== newName) {
      await db.query('UPDATE users SET display_name = $1 WHERE id = $2', [newName, user.id]);
      user.display_name = newName;
    }
  } else {
    const inserted = await db.query(
      `INSERT INTO users (telegram_id, username, display_name, language)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tgUser.id, tgUser.username ?? null, tgUser.first_name ?? 'Player', tgUser.language_code ?? 'en']
    );
    user = inserted.rows[0];
    await db.query('INSERT INTO wallets (user_id, balance_usd) VALUES ($1, $2)', [user.id, 0]);
    await db.query('INSERT INTO free_chips (user_id, chips) VALUES ($1, $2)', [user.id, 10000]);
  }

  const token = signToken({ uid: user.id, tg: user.telegram_id }, JWT_SECRET);

  return {
    token,
    user: {
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      display_name: user.display_name,
      language: user.language,
      avatar_id: user.avatar_id || 'spade',
    },
  };
});

app.get('/api/me', async (req, reply) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'notoken' });
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  if (!payload) return reply.code(401).send({ error: 'invalid token' });

  const user = await db.query(
    'SELECT id, telegram_id, username, display_name, language, avatar_id, created_at FROM users WHERE id = $1',
    [payload.uid]
  );
  const wallet = await db.query(
    'SELECT balance_usd, locked_usd FROM wallets WHERE user_id = $1',
    [payload.uid]
  );
  const chips = await db.query(
    'SELECT chips, total_hands FROM free_chips WHERE user_id = $1',
    [payload.uid]
  );

  return {
    user: user.rows[0],
    wallet: wallet.rows[0],
    free_chips: chips.rows[0],
  };
});

app.post<{ Body: { avatar_id: string } }>('/api/me/avatar', async (req, reply) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'notoken' });
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  if (!payload) return reply.code(401).send({ error: 'invalid token' });

  const { avatar_id } = req.body ?? {};
  if (!avatar_id) return reply.code(400).send({ error: 'avatar_id required' });

  await db.query('UPDATE users SET avatar_id = $1 WHERE id = $2', [avatar_id, payload.uid]);
  return { ok: true, avatar_id };
});

await registerLeaderboardRoutes(app, db);
await registerEventsRoutes(app, db);
await registerAntiCheatRoutes(app, db);
await registerTableManagerRoutes(app, db);

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });

  const io = new SocketIOServer(app.server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,
  });

  setupSocketServer(io, db);

  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO attached`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}