import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { gameManager } from './game-manager.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';

function isAdmin(req: any): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${ADMIN_SECRET}`;
}

export async function registerOverviewRoutes(app: FastifyInstance, db: Pool) {
  // ============================================================
  // OVERVIEW — all-in-one dashboard
  // ============================================================
  app.get('/api/admin/overview', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });

    const [
      usersStats,
      tablesStats,
      tourneyStats,
      anticheatStats,
      walletStats,
      recentUsers,
    ] = await Promise.all([
      // Users
      db.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_banned = TRUE)::int AS banned,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS new_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d,
          COUNT(*) FILTER (WHERE risk_score >= 65)::int AS high_risk
        FROM users
      `),
      // Tables
      db.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
          COUNT(*) FILTER (WHERE variant = 'holdem')::int AS holdem,
          COUNT(*) FILTER (WHERE variant = 'omaha4')::int AS omaha4,
          COUNT(*) FILTER (WHERE variant = 'omaha5')::int AS omaha5
        FROM poker_tables
      `),
      // Tournaments
      db.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'running')::int AS running,
          COUNT(*) FILTER (WHERE status = 'registering')::int AS registering,
          COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
          COUNT(*) FILTER (WHERE status = 'finished')::int AS finished,
          COALESCE(SUM(total_rake), 0)::numeric AS total_rake
        FROM tournaments
      `),
      // Anti-cheat
      db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM suspicious_events WHERE resolved = FALSE) AS unresolved,
          (SELECT COUNT(*)::int FROM player_risk WHERE score >= 65) AS high_risk
      `),
      // Wallet
      db.query(`
        SELECT
          COUNT(*)::int AS total_wallets,
          COALESCE(SUM(balance_usd), 0)::numeric AS total_balance,
          COALESCE(AVG(balance_usd), 0)::numeric AS avg_balance
        FROM wallets
      `),
      // Recent users
      db.query(`
        SELECT id, display_name, username, created_at, is_banned, risk_score
        FROM users
        ORDER BY created_at DESC
        LIMIT 5
      `),
    ]);

    const rooms = gameManager.getRooms();
    let livePlayers = 0;
    let liveHands = 0;
    for (const room of rooms) {
      livePlayers += room.players.size;
      liveHands += room.game.state.handNo;
    }

    const u = usersStats.rows[0];
    const t = tablesStats.rows[0];
    const to = tourneyStats.rows[0];
    const a = anticheatStats.rows[0];
    const w = walletStats.rows[0];

    return {
      users: {
        total: u.total,
        banned: u.banned,
        new24h: u.new_24h,
        new7d: u.new_7d,
        highRisk: u.high_risk,
      },
      tables: {
        total: t.total,
        active: t.active,
        byVariant: {
          holdem: t.holdem,
          omaha4: t.omaha4,
          omaha5: t.omaha5,
        },
      },
      tournaments: {
        total: to.total,
        running: to.running,
        registering: to.registering,
        scheduled: to.scheduled,
        finished: to.finished,
        totalRake: Number(to.total_rake),
      },
      anticheat: {
        unresolved: a.unresolved,
        highRisk: a.high_risk,
      },
      wallet: {
        totalWallets: w.total_wallets,
        totalBalance: Number(w.total_balance),
        avgBalance: Number(w.avg_balance),
      },
      live: {
        rooms: rooms.length,
        players: livePlayers,
        hands: liveHands,
      },
      recentUsers: recentUsers.rows.map((r) => ({
        id: Number(r.id),
        displayName: r.display_name,
        username: r.username,
        createdAt: r.created_at,
        isBanned: r.is_banned,
        riskScore: r.risk_score,
      })),
    };
  });

  // ============================================================
  // LIVE MONITOR — rooms in real-time
  // ============================================================
  app.get('/api/admin/live', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });

    const rooms = gameManager.getRooms();
    const list = rooms.map((room: any) => {
      const players: any[] = [];
      for (const [, p] of room.players) {
        players.push({
          userId: p.userId,
          displayName: p.displayName,
          stack: p.stack,
          folded: p.folded,
          allIn: p.allIn,
        });
      }
      return {
        tableId: room.tableId,
        tableName: room.tableName ?? null,
        phase: room.game?.state?.phase ?? 'waiting',
        handNo: room.game?.state?.handNo ?? 0,
        pot: room.game?.state?.pot ?? 0,
        currentSeat: room.game?.state?.currentSeat ?? null,
        players,
      };
    });

    return { rooms: list };
  });
}