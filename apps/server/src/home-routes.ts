import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { gameManager } from './game-manager.js';
import { getOnlineUserCount } from './socket-server.js';
import { verifyToken } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  return payload?.uid ?? null;
}

export async function registerHomeRoutes(app: FastifyInstance, db: Pool) {
  app.get('/api/home', async (req) => {
    const userId = authUser(req);

    // ─── 1. Live stats from in-memory gameManager ───
    const rooms = gameManager.getRooms();
    const cashRooms = rooms.filter((r: any) => !r.tournamentId && r.players.size > 0);
    const tourneyRooms = rooms.filter((r: any) => r.tournamentId && r.players.size > 0);

    // ─── 2. Live cash tables list (from DB meta + memory players) ───
    let liveTables: any[] = [];
    if (cashRooms.length > 0) {
      const ids = cashRooms.map((r: any) => r.tableId);
      const meta = await db.query(
        `SELECT id, name, variant, mode, blinds, seats FROM poker_tables WHERE id = ANY($1::bigint[])`,
        [ids],
      );
      const metaMap = new Map(meta.rows.map((r: any) => [Number(r.id), r]));
      liveTables = cashRooms
        .map((r: any) => {
          const m: any = metaMap.get(r.tableId);
          if (!m) return null;
          return {
            id: r.tableId,
            name: m.name,
            variant: m.variant,
            mode: m.mode,
            blinds: {
              sb: Number(m.blinds?.sb ?? 0),
              bb: Number(m.blinds?.bb ?? 0),
            },
            seats: Number(m.seats ?? 6),
            players: r.players.size,
            phase: r.game?.state?.phase ?? 'waiting',
          };
        })
        .filter(Boolean)
        .slice(0, 4);
    }

    // ─── 3. Live tournaments with prize > 0 ───
    const tourRes = await db.query(
      `SELECT t.id, t.name, t.variant, t.speed, t.total_prize_pool, t.current_level,
              (SELECT COUNT(*)::int FROM tournament_entries
               WHERE tournament_id = t.id AND status IN ('registered','playing')) AS players
       FROM tournaments t
       WHERE t.status IN ('running','final_table')
         AND t.total_prize_pool > 0
       ORDER BY t.total_prize_pool DESC
       LIMIT 4`,
    );
    const liveTournaments = tourRes.rows.map((r: any) => ({
      id: Number(r.id),
      name: r.name,
      variant: r.variant,
      speed: r.speed,
      totalPrizePool: Number(r.total_prize_pool),
      players: Number(r.players),
      currentLevel: Number(r.current_level),
    }));

    // ─── 4. Top winners today (real money) ───
    const topWinnersToday = await getTopWinnersToday(db);

    // ─── 5. User progress (only if authed) ───
    let userProgress: any = null;
    if (userId) {
      try {
        const { LoyaltyService } = await import('./loyalty/service.js');
        const svc = new LoyaltyService(db);
        const loyalty = await svc.getSummary(userId);
        userProgress = {
          level: loyalty.level,
          xpIntoLevel: loyalty.xpIntoLevel,
          xpForNextLevel: loyalty.xpForNextLevel,
          tier: loyalty.tier,
          tierLabel: loyalty.tierLabel,
          tierIcon: loyalty.tierIcon,
          tierColor: loyalty.tierColor,
          rakebackPct: loyalty.rakebackPct,
          progressToNextTier: loyalty.progressToNextTier,
        };
      } catch (e: any) {
        console.error('[home] userProgress failed:', e.message);
      }
    }

    return {
      onlineUsers: getOnlineUserCount(),
      activeTables: cashRooms.length,
      activeTournaments: tourneyRooms.length,
      tables: liveTables,
      tournaments: liveTournaments,
      topWinnersToday,
      userProgress,
    };
  });
}

// ============================================================
// Aggregate top 3 winners from the last 24h of real-money hands
// ============================================================
async function getTopWinnersToday(db: Pool): Promise<any[]> {
  try {
    const res = await db.query(
      `SELECT h.result, hs.state
       FROM hands h
       JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
       WHERE h.mode = 'real'
         AND h.finished = TRUE
         AND h.ended_at > NOW() - INTERVAL '24 hours'
       ORDER BY h.id DESC
       LIMIT 500`,
    );

    const winnersMap = new Map<
      number,
      { userId: number; displayName: string; totalWon: number; wins: number }
    >();

    for (const row of res.rows) {
      const state = row.state || {};
      const players = state.players || [];
      const showdown = row.result?.showdownPlayers || [];

      for (const sp of showdown) {
        if (!sp.isWinner) continue;
        const payout = Number(sp.payout) || 0;
        if (payout <= 0) continue;

        const player = players.find((p: any) => Number(p.seat) === Number(sp.seat));
        if (!player) continue;

        const uid = Number(player.userId);
        if (!uid) continue;

        if (!winnersMap.has(uid)) {
          winnersMap.set(uid, {
            userId: uid,
            displayName: player.displayName || 'Player',
            totalWon: 0,
            wins: 0,
          });
        }
        const entry = winnersMap.get(uid)!;
        entry.totalWon += payout;
        entry.wins += 1;
      }
    }

    const sorted = [...winnersMap.values()].sort((a, b) => b.totalWon - a.totalWon).slice(0, 3);

    if (sorted.length > 0) {
      const ids = sorted.map((s) => s.userId);
      const avatarRes = await db.query(
        `SELECT id, avatar_id FROM users WHERE id = ANY($1::bigint[])`,
        [ids],
      );
      const avatarMap = new Map(avatarRes.rows.map((r: any) => [Number(r.id), r.avatar_id]));
      for (const s of sorted) {
        (s as any).avatarId = avatarMap.get(s.userId) || 'king';
      }
    }

    return sorted;
  } catch (e: any) {
    console.error('[home] topWinnersToday failed:', e.message);
    return [];
  }
}
