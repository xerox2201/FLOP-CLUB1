import './env.js';
import crypto from 'crypto';
import { registerBroadcastRoutes } from './broadcast-routes.js';
import { registerUsersRoutes } from './users-routes.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { verifyTelegramInitData, signToken, verifyToken } from './auth.js';
import { setupSocketServer, getOnlineUserCount } from './socket-server.js';
import { registerLeaderboardRoutes } from './leaderboard.js';
import { registerEventsRoutes } from './events.js';
import { registerAntiCheatRoutes } from './anti-cheat-routes.js';
import { registerTableManagerRoutes } from './table-manager.js';
import { registerHandsRoutes } from './hands-routes.js';
import { registerWalletRoutes } from './wallet-routes.js';
import { tonAdapter } from './ton.js';
import { DepositWatcher } from './deposit-watcher.js';
import { gameManager } from './game-manager.js';
import { TournamentManager } from './tournament-manager.js';
import { TournamentScheduler } from './tournament-scheduler.js';
import { registerTournamentRoutes } from './tournament-routes.js';
import { registerSettingsRoutes } from './settings-routes.js';
import { registerOverviewRoutes } from './overview-routes.js';
import { registerAchievementsRoutes } from './achievements-routes.js';
import { registerLoyaltyRoutes } from './loyalty-routes.js';
import { registerShopRoutes } from './shop-routes.js';
import { TournamentCleanupJob } from './tournament-cleanup.js';
import { registerDailyRefillRoutes } from './daily-refill-routes.js';
import { registerTimeRoutes } from './time-routes.js';
import { FreerollService } from './freeroll-service.js';
import { FreerollScheduler } from './freeroll-scheduler.js';
import { registerFreerollRoutes } from './freeroll-routes.js';
import { registerHomeRoutes } from './home-routes.js';
import { registerMissionRoutes } from './mission-routes.js';
import { registerBadBeatRoutes } from './bad-beat-routes.js';
import { registerWeeklyRaceRoutes } from './weekly-race-routes.js';
import { registerFairRoutes } from './fair-routes.js';

const PORT = Number(process.env.PORT ?? 4000);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://poker:pokerpass@localhost:5432/poker';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';

const IS_PROD = process.env.NODE_ENV === 'production';

const app = Fastify({
  logger: true,
  trustProxy: IS_PROD,
});

const db = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? (IS_PROD ? 20 : 5)),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  keepAlive: true,
});

// 🔴 Expose db pool for HandPersister
(globalThis as any).__dbPool = db;

async function main() {
  // ============================================================
  // CORS
  // ============================================================
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: IS_PROD ? (allowedOrigins.length > 0 ? allowedOrigins : false) : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  if (IS_PROD && allowedOrigins.length === 0) {
    console.warn('[cors] ⚠️  CORS_ORIGINS not set — all cross-origin requests will be blocked');
  }

  // ============================================================
  // Global error handler
  // ============================================================
  app.setErrorHandler((error, req, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      req.log.error({ err: error, url: req.url, method: req.method }, 'unhandled error');
    }

    if (IS_PROD && statusCode >= 500) {
      return reply.code(statusCode).send({ error: 'internal_error' });
    }

    return reply.code(statusCode).send({
      error: error.message || 'internal_error',
      code: (error as any).code,
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'not_found', path: req.url });
  });

  // ============================================================
  // Redis
  // ============================================================
  let redis: Redis | null = null;
  try {
    redis = new Redis(REDIS_URL);
    redis.on('connect', () => console.log('[redis] ✅ connected'));
    redis.on('error', (e: any) => console.error('[redis] error:', e.message));
  } catch (e: any) {
    console.error('[redis] init failed:', e.message);
  }

  // ============================================================
  // Health
  // ============================================================
  app.get('/health', async () => ({ ok: true, ts: Date.now() }));

  // ============================================================
  // Auth routes
  // ============================================================
  app.post<{ Body: { initData: string } }>('/api/auth/telegram', async (req, reply) => {
    const { initData } = req.body ?? {};
    if (!initData) return reply.code(400).send({ error: 'missing initData' });

    const parsed = verifyTelegramInitData(initData, BOT_TOKEN);
    if (!parsed) {
      // 🔴 dev fallback: allow user=... without hash
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      if (!userStr) return reply.code(401).send({ error: 'invalid initData' });
      try {
        const u = JSON.parse(userStr);
        const userId = Number(u.id);
        const displayName = u.first_name || u.username || `User${userId}`;
        const { dbUser, isNewUser } = await upsertUser(userId, displayName);

        // Safety: block silently issuing JWT without uid
        if (!dbUser?.id) {
          console.error('[auth] dev fallback: upsertUser returned invalid shape', { dbUser });
          return reply.code(500).send({ error: 'user_creation_failed' });
        }

        // 🔴 Referral attribution on FIRST login only (dev path)
        if (isNewUser) {
          try {
            const pending = await db.query(
              `SELECT code FROM pending_referrals
               WHERE telegram_user_id = $1 AND expires_at > NOW()`,
              [userId],
            );
            if (pending.rows.length > 0) {
              const code = pending.rows[0].code;
              const { attributeReferral } = await import('./referral-service.js');
              await attributeReferral(db, dbUser.id, code);
              await db.query(`DELETE FROM pending_referrals WHERE telegram_user_id = $1`, [userId]);
              console.log(`[referral] 🎁 attributed user ${dbUser.id} to code ${code}`);
            }
          } catch (e: any) {
            console.error('[referral] attribution failed (dev):', e.message);
          }
        }

        const token = signToken({ uid: dbUser.id, tg: userId }, JWT_SECRET);
        return { token, user: dbUser };
      } catch (e: any) {
        console.error('[auth] dev fallback failed:', e.message);
        return reply.code(401).send({ error: 'invalid user json' });
      }
    }

    const displayName = parsed.user.first_name || parsed.user.username || `User${parsed.user.id}`;
    const { dbUser, isNewUser } = await upsertUser(parsed.user.id, displayName);

    // 🔴 Referral attribution on FIRST login only
    if (isNewUser) {
      try {
        const pending = await db.query(
          `SELECT code FROM pending_referrals
           WHERE telegram_user_id = $1 AND expires_at > NOW()`,
          [parsed.user.id],
        );
        if (pending.rows.length > 0) {
          const code = pending.rows[0].code;
          const { attributeReferral } = await import('./referral-service.js');
          await attributeReferral(db, dbUser.id, code);
          await db.query(`DELETE FROM pending_referrals WHERE telegram_user_id = $1`, [
            parsed.user.id,
          ]);
          console.log(`[referral] 🎁 attributed user ${dbUser.id} to code ${code}`);
        }
      } catch (e: any) {
        console.error('[referral] attribution failed:', e.message);
      }
    }

    const token = signToken({ uid: dbUser.id, tg: parsed.user.id }, JWT_SECRET);
    return { token, user: dbUser };
  });

  // ============================================================
  // Me
  // ============================================================
  app.get('/api/me', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'notoken' });
    const payload = verifyToken(auth.slice(7), JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'invalid token' });

    const userRes = await db.query(
      'SELECT id, telegram_id, display_name, avatar_id, created_at FROM users WHERE id = $1',
      [payload.uid],
    );
    if (userRes.rows.length === 0) return reply.code(404).send({ error: 'user_not_found' });

    const user = userRes.rows[0];

    // wallet / ledger balance
    let balance = 0;
    try {
      const { LedgerService } = await import('./ledger.js');
      const ledger = new LedgerService(db);
      const acc = await ledger.getUserAccountId(user.id);
      if (acc) balance = await ledger.getBalance(acc);
    } catch (e: any) {
      console.error('[me] ledger error:', e.message);
    }

    // free chips + hands
    const chipsRes = await db.query(
      'SELECT chips, total_hands, free_won, free_hands_won FROM free_chips WHERE user_id = $1',
      [user.id],
    );
    const totalHands = Number(chipsRes.rows[0]?.total_hands ?? 0);
    const freeWon = Number(chipsRes.rows[0]?.free_won ?? 0);
    const freeHandsWon = Number(chipsRes.rows[0]?.free_hands_won ?? 0);

    // stats: hands won + total winnings on REAL money tables only
    let handsWon = 0;
    let totalWon = 0;
    let handsPlayedReal = 0;
    try {
      const statsRes = await db.query(
        `WITH my_real_hands AS (
           SELECT
             h.id AS hand_id,
             h.winner_seats,
             h.result,
             (
               SELECT (p->>'seat')::int
               FROM jsonb_array_elements(hs.state->'players') p
               WHERE (p->>'userId')::bigint = $1
               LIMIT 1
             ) AS my_seat
           FROM hands h
           JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
                     WHERE h.finished = TRUE
             AND h.mode = 'real'
             AND h.ended_at > COALESCE(
               (SELECT reset_at FROM user_stats_reset WHERE user_id = $1),
               '1970-01-01'::timestamptz
             )
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements(hs.state->'players') p
               WHERE (p->>'userId')::bigint = $1
             )
         )
         SELECT
           COUNT(*)::int AS hands_played,
           COUNT(*) FILTER (
             WHERE winner_seats::jsonb @> to_jsonb(my_seat)
           )::int AS hands_won,
           COALESCE(SUM(
             (
               SELECT COALESCE((sp->>'payout')::numeric, 0)
               FROM jsonb_array_elements(
                 COALESCE(result->'showdownPlayers', '[]'::jsonb)
               ) sp
               WHERE (sp->>'seat')::int = my_seat
               LIMIT 1
             )
           ), 0)::numeric AS total_won
         FROM my_real_hands`,
        [user.id],
      );
      handsPlayedReal = Number(statsRes.rows[0]?.hands_played ?? 0);
      handsWon = Number(statsRes.rows[0]?.hands_won ?? 0);
      totalWon = Number(statsRes.rows[0]?.total_won ?? 0);
    } catch (e: any) {
      console.error('[me] stats error:', e.message);
    }

    // trophies: tournaments won
    let trophies = 0;
    try {
      const trophiesRes = await db.query(
        `SELECT COUNT(*)::int AS t
         FROM tournament_entries
         WHERE user_id = $1 AND final_position = 1`,
        [user.id],
      );
      trophies = Number(trophiesRes.rows[0]?.t ?? 0);
    } catch (e: any) {
      console.error('[me] trophies error:', e.message);
    }
    // loyalty summary (tier, xp, rakeback, vouchers, seeds)
    let loyalty: any = null;
    try {
      const { LoyaltyService } = await import('./loyalty/service.js');
      const svc = new LoyaltyService(db);
      loyalty = await svc.getSummary(user.id);
    } catch (e: any) {
      console.error('[me] loyalty error:', e.message);
    }
    return {
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        display_name: user.display_name,
        avatar_id: user.avatar_id,
      },
      wallet: { balance },
      free_chips: {
        chips: Number(chipsRes.rows[0]?.chips ?? 0),
        total_hands: totalHands,
        free_hands: totalHands,
        free_won: freeWon,
        free_hands_won: freeHandsWon,
      },
      stats: {
        loyalty,
        handsWon,
        handsPlayedReal,
        totalWon,
        totalHands,
        trophies,
        real_hands: handsPlayedReal,
      },
    };
  });

  app.post<{ Body: { avatar_id: string } }>('/api/me/avatar', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'notoken' });
    const payload = verifyToken(auth.slice(7), JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'invalid token' });

    const { avatar_id } = req.body ?? {};
    if (!avatar_id) return reply.code(400).send({ error: 'missing avatar_id' });

    await db.query('UPDATE users SET avatar_id = $1 WHERE id = $2', [avatar_id, payload.uid]);
    return { ok: true, avatar_id };
  });

  // ============================================================
  // Live stats (public) — online users + active tables
  // ============================================================
  app.get('/api/live-stats', async () => {
    const rooms = gameManager.getRooms();
    const activeTables = rooms.filter((r: any) => r.players.size > 0).length;
    return {
      onlineUsers: getOnlineUserCount(),
      activeTables,
    };
  });

  // ============================================================
  // Tables (public list)
  // ============================================================
  app.get('/api/tables', async () => {
    try {
      const res = await db.query(
        `SELECT id, name, variant, mode, speed, blinds,
                min_buyin, max_buyin, seats, rake_pct, is_active
         FROM poker_tables
         WHERE is_active = TRUE
         ORDER BY id ASC`,
      );
      return {
        tables: res.rows.map((r) => {
          const room = gameManager.getRoom(r.id);
          const livePlayers = room ? room.players.size : 0;
          const maxSeats = Number(r.seats ?? 6);
          return {
            id: r.id,
            name: r.name,
            variant: r.variant,
            mode: r.mode,
            speed: r.speed,
            blinds: {
              sb: Number(r.blinds?.sb ?? 0),
              bb: Number(r.blinds?.bb ?? 0),
              ante: Number(r.blinds?.ante ?? 0),
            },
            minBuyIn: Number(r.min_buyin ?? 0),
            maxBuyIn: Number(r.max_buyin ?? 0),
            maxSeats,
            livePlayers,
            seats: maxSeats, // backward compat
            rakePct: Number(r.rake_pct ?? 0),
          };
        }),
      };
    } catch (e: any) {
      console.error('[tables] error:', e.message);
      return { tables: [] };
    }
  });

  // ============================================================
  // Route registrations
  // ============================================================
  await registerLeaderboardRoutes(app, db);
  await registerEventsRoutes(app, db);
  await registerAntiCheatRoutes(app, db);
  await registerTableManagerRoutes(app, db);
  await registerHandsRoutes(app, db);
  await registerWalletRoutes(app, db);
  await registerUsersRoutes(app, db);
  await registerBroadcastRoutes(app, db);
  await registerSettingsRoutes(app, db);
  await registerOverviewRoutes(app, db);
  await registerAchievementsRoutes(app, db);
  await registerLoyaltyRoutes(app, db);
  await registerShopRoutes(app, db);
  await registerDailyRefillRoutes(app, db);
  await registerTimeRoutes(app);
  await registerHomeRoutes(app, db);
  await registerMissionRoutes(app, db);
  await registerBadBeatRoutes(app, db);
  await registerWeeklyRaceRoutes(app, db);

  // Provably Fair (commit/reveal + server-side verification)
  await registerFairRoutes(app, db);

  // 🔴 Referral + transparency
  const { registerReferralRoutes } = await import('./referral-routes.js');
  const { registerMyMoneyRoutes } = await import('./my-money-routes.js');
  const { registerBooksRoutes } = await import('./books-routes.js');
  await registerReferralRoutes(app, db);
  await registerMyMoneyRoutes(app, db);
  await registerBooksRoutes(app, db);

  const freerollSvc = new FreerollService(db);
  const freerollScheduler = new FreerollScheduler(db, freerollSvc);
  await registerFreerollRoutes(app, db, freerollScheduler);

  // 🔴 Telegram community (channel + group + bot)
  const { registerTelegramRoutes } = await import('./telegram-routes.js');
  const { getTelegramBot, startPolling, stopPolling } = await import('./telegram-bot.js');
  await registerTelegramRoutes(app, db);

  // Long polling — works in restricted regions (Iran), no public HTTPS needed.
  // deleteWebhook is non-blocking: if Cloudflare proxy is slow, the server
  // still starts. Polling retries automatically via getUpdates.
  if (process.env.TELEGRAM_BOT_TOKEN) {
    getTelegramBot(db)
      .deleteWebhook()
      .then(() => {
        startPolling(db, 1000).catch((e) => console.error('[tg-bot] polling crashed:', e.message));
      })
      .catch((e: any) => {
        console.error('[tg-bot] setup failed:', e.message);
        // Still try polling — getUpdates will surface a clearer error
        startPolling(db, 1000).catch(() => {});
      });
  } else {
    console.warn('[tg-bot] TELEGRAM_BOT_TOKEN not set — bot disabled');
  }

  // 🔴 Community auto-posts (B1 + B3)
  const { CommunityCron } = await import('./community-cron.js');
  const communityCron = new CommunityCron(db);
  communityCron.start();
  // Debug endpoints (dev only)
  if (!IS_PROD) {
    app.post('/api/debug/cron/starting', async () => {
      await communityCron.debugTickStarting();
      return { ok: true };
    });
    app.post('/api/debug/cron/daily', async () => {
      await communityCron.debugTickDaily();
      return { ok: true };
    });
  }
  // 🔴 Tournament Manager
  const tournamentManager = new TournamentManager(db);
  const scheduler = new TournamentScheduler(db, tournamentManager);
  await registerTournamentRoutes(app, db, tournamentManager, scheduler);

  // 🔴 Wire game-manager ↔ tournament-manager
  gameManager.setTournamentHandEndCallback(async (tournamentId, room, handResult) => {
    await tournamentManager.syncStacksAndEliminate(tournamentId, room, handResult);
  });

  // ============================================================
  // TON adapter
  // ============================================================
  await tonAdapter.init();

  // ============================================================
  // Listen
  // ============================================================
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // ============================================================
  // Socket.IO
  // ============================================================
  const io = new SocketIOServer(app.server, {
    cors: { origin: true, credentials: true },
  });

  setupSocketServer(io, db);
  console.log('🔌 Socket.IO attached');

  tournamentManager.setIO(io);

  // 🔴 D5.1: Start auto-start scheduler (checks every 30s for scheduled tournaments)
  tournamentManager.startAutoStartScheduler(30_000);
  // 🔴 D6.1: Start recurring tournament scheduler (checks every 60s)
  scheduler.start(60_000);
  // 🔴 Start stale tournament cleanup job
  const cleanupJob = new TournamentCleanupJob(db);
  cleanupJob.start(10 * 60 * 1000);
  // ============================================================
  // Deposit watcher
  // ============================================================
  const depositWatcher = new DepositWatcher(db);
  depositWatcher.start();

  freerollScheduler.start(5 * 60 * 1000);

  // 🔴 Referral duo bonus — runs daily at 02:00 UTC
  const runDuoBonus = async () => {
    try {
      const now = new Date();
      // Only run on 1st of month, 02:00-02:59 UTC
      if (now.getUTCDate() !== 1 || now.getUTCHours() !== 2) return;
      const { ReferralService } = await import('./referral-service.js');
      const svc = new ReferralService(db);
      await svc.payMonthlyDuoBonuses();
    } catch (e: any) {
      console.error('[referral] duo bonus cron error:', e.message);
    }
  };
  const duoBonusTimer = setInterval(runDuoBonus, 60 * 60 * 1000); // hourly check
  if (duoBonusTimer.unref) duoBonusTimer.unref();

  // Daily missions — clear old progress at 00:00 UTC (checked hourly).
  // resetDaily() only deletes days before today, so repeat runs are safe.
  const runMissionReset = async () => {
    try {
      if (new Date().getUTCHours() !== 0) return;
      const { MissionService } = await import('./mission-service.js');
      const svc = new MissionService(db);
      const removed = await svc.resetDaily();
      if (removed > 0) {
        console.log(`[missions] daily reset removed ${removed} old progress rows`);
      }
    } catch (e: any) {
      console.error('[missions] reset cron error:', e.message);
    }
  };
  const missionResetTimer = setInterval(runMissionReset, 60 * 60 * 1000);
  if (missionResetTimer.unref) missionResetTimer.unref();

  // Weekly Rake Race — settle last week's brackets on Monday 00:00 UTC.
  // closeWeek() is idempotent per (week, bracket), so repeat runs are safe.
  const runWeeklyRaceClose = async () => {
    try {
      const now = new Date();
      if (now.getUTCDay() !== 1 || now.getUTCHours() !== 0) return;
      const { WeeklyRaceService } = await import('./weekly-race-service.js');
      const svc = new WeeklyRaceService(db);
      const results = await svc.closeWeek();
      for (const r of results) {
        console.log(
          `[weekly-race] ${r.bracket}: ${r.players} players, ${r.paidPlaces} paid places, $${r.paidUsd} paid`,
        );
      }
    } catch (e: any) {
      console.error('[weekly-race] close cron error:', e.message);
    }
  };
  const weeklyRaceTimer = setInterval(runWeeklyRaceClose, 60 * 60 * 1000);
  if (weeklyRaceTimer.unref) weeklyRaceTimer.unref();

  process.on('SIGINT', () => {
    console.log('\n[shutdown] stopping services...');
    stopPolling();
    communityCron.stop();
    freerollScheduler.stop();
    cleanupJob.stop();
    depositWatcher.stop();
    clearInterval(duoBonusTimer);
    clearInterval(missionResetTimer);
    clearInterval(weeklyRaceTimer);
    setTimeout(() => process.exit(0), 500);
  });
}

// ============================================================
// User upsert helper
// ============================================================
async function upsertUser(
  telegramId: number,
  displayName: string,
): Promise<{ dbUser: any; isNewUser: boolean }> {
  const existing = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  if (existing.rows.length > 0) {
    return { dbUser: existing.rows[0], isNewUser: false };
  }

  // Generate a unique referral code (retry on collision)
  let refCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = 'ref_' + crypto.randomBytes(4).toString('hex');
    const check = await db.query('SELECT 1 FROM users WHERE referral_code = $1', [candidate]);
    if (check.rows.length === 0) {
      refCode = candidate;
      break;
    }
  }
  if (!refCode) refCode = 'ref_' + Date.now().toString(36);

  const res = await db.query(
    `INSERT INTO users (telegram_id, display_name, avatar_id, referral_code)
     VALUES ($1, $2, 'spade', $3)
     RETURNING id, telegram_id, display_name, avatar_id, created_at, referral_code`,
    [telegramId, displayName, refCode],
  );

  const newUser = res.rows[0];

  try {
    const { LedgerService } = await import('./ledger.js');
    const ledger = new LedgerService(db);
    await ledger.ensureUserAccount(newUser.id);
  } catch (e: any) {
    console.error('[user] ledger account creation failed:', e.message);
  }

  try {
    await db.query(
      `INSERT INTO free_chips (user_id, chips) VALUES ($1, 1000)
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id],
    );
  } catch (e: any) {
    console.error('[user] free chips creation failed:', e.message);
  }

  return { dbUser: newUser, isNewUser: true };
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
