// ============================================================
// Community auto-post scheduler
// ------------------------------------------------------------
// Three jobs:
//   B1 — Tournament starting (checks every 5 min)
//   B2 — Tournament finished (event-driven; called by tournament-manager)
//   B3 — Daily leader (checks every hour; fires at 20:00 UTC)
// ============================================================

import type { Pool } from 'pg';
import { getTelegramBot } from './telegram-bot.js';

export class CommunityCron {
  private startingTimer: NodeJS.Timeout | null = null;
  private dailyTimer: NodeJS.Timeout | null = null;
  private lastDailyDate: string | null = null;

  constructor(private db: Pool) {}

  start(): void {
    console.log('[community-cron] 🕐 starting auto-posts scheduler');

    // B1 — tournament starting (every 5 min)
    this.tickStarting().catch((e) =>
      console.error('[community-cron] starting tick failed:', e.message),
    );
    this.startingTimer = setInterval(
      () => {
        this.tickStarting().catch((e) =>
          console.error('[community-cron] starting tick failed:', e.message),
        );
      },
      5 * 60 * 1000,
    );
    if (this.startingTimer.unref) this.startingTimer.unref();

    // B3 — daily leader (every hour)
    this.dailyTimer = setInterval(
      () => {
        this.tickDaily().catch((e) =>
          console.error('[community-cron] daily tick failed:', e.message),
        );
      },
      60 * 60 * 1000,
    );
    if (this.dailyTimer.unref) this.dailyTimer.unref();

    // Run once at startup after a short delay (let other services warm up)
    setTimeout(() => {
      this.tickDaily().catch(() => {});
    }, 15_000);
  }

  stop(): void {
    if (this.startingTimer) {
      clearInterval(this.startingTimer);
      this.startingTimer = null;
    }
    if (this.dailyTimer) {
      clearInterval(this.dailyTimer);
      this.dailyTimer = null;
    }
  }

  // ============================================================
  // B1 — Tournaments starting in 25–35 minutes
  // ============================================================
  private async tickStarting(): Promise<void> {
    const bot = getTelegramBot(this.db);
    const channelId = await bot.getPrimaryChannelId();
    if (!channelId) return;

    const res = await this.db.query(
      `SELECT id, name, variant, mode, buy_in, guaranteed, max_players,
              total_prize_pool,
              EXTRACT(EPOCH FROM (scheduled_start - NOW()))::int AS seconds_until,
              (SELECT COUNT(*)::int FROM tournament_entries
               WHERE tournament_id = t.id AND status IN ('registered','playing')
              ) AS registered_count
       FROM tournaments t
       WHERE status IN ('scheduled', 'registering')
         AND scheduled_start > NOW()
         AND scheduled_start < NOW() + INTERVAL '35 minutes'
         AND scheduled_start > NOW() + INTERVAL '25 minutes'`,
    );

    for (const row of res.rows) {
      const minutesUntil = Math.max(1, Math.round(Number(row.seconds_until) / 60));
      const prizeUsd = Math.max(Number(row.total_prize_pool ?? 0), Number(row.guaranteed ?? 0));
      const buyIn = Number(row.buy_in ?? 0);

      try {
        await bot.announceTournamentStarting({
          tournamentId: Number(row.id),
          name: String(row.name),
          minutesUntil,
          prizeUsd,
          buyIn,
          registeredCount: Number(row.registered_count ?? 0),
          maxPlayers: Number(row.max_players ?? 0),
          variant: String(row.variant ?? 'holdem'),
        });
      } catch (e: any) {
        console.warn(`[community-cron] tournament #${row.id} announce failed:`, e.message);
      }
    }
  }

  // ============================================================
  // B3 — Daily leader (fires at 20:00 UTC once per day)
  // ============================================================
  private async tickDaily(): Promise<void> {
    const now = new Date();
    const utcHour = now.getUTCHours();

    // Fire only at 20:00 UTC (between 20:00 and 20:59)
    if (utcHour !== 20) return;

    const dateLabel = now.toISOString().slice(0, 10);
    if (this.lastDailyDate === dateLabel) return;

    const bot = getTelegramBot(this.db);
    const channelId = await bot.getPrimaryChannelId();
    if (!channelId) return;

    // Aggregate top winners from last 24h (same logic as home-routes.ts)
    try {
      const res = await this.db.query(
        `SELECT h.result, hs.state
         FROM hands h
         JOIN hand_snapshots hs ON hs.hand_id = h.id AND hs.sequence = 0
         WHERE h.mode = 'real'
           AND h.finished = TRUE
           AND h.ended_at > NOW() - INTERVAL '24 hours'
         ORDER BY h.id DESC
         LIMIT 500`,
      );

      const map = new Map<number, { displayName: string; totalWon: number; wins: number }>();

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
          if (!map.has(uid)) {
            map.set(uid, {
              displayName: player.displayName || 'Player',
              totalWon: 0,
              wins: 0,
            });
          }
          const e = map.get(uid)!;
          e.totalWon += payout;
          e.wins += 1;
        }
      }

      const top = [...map.values()].sort((a, b) => b.totalWon - a.totalWon).slice(0, 3);

      await bot.announceDailyLeader({ dateLabel, topWinners: top });
      this.lastDailyDate = dateLabel;
    } catch (e: any) {
      console.warn('[community-cron] daily aggregation failed:', e.message);
    }
  }

  // ============================================================
  // Debug: manual tick (dev only)
  // ============================================================
  async debugTickStarting(): Promise<void> {
    await this.tickStarting();
  }

  async debugTickDaily(): Promise<void> {
    await this.tickDaily();
  }

  // ============================================================
  // B2 — Called by TournamentManager when a tournament finishes.
  // ============================================================
  async onTournamentFinished(tournamentId: number): Promise<void> {
    try {
      const bot = getTelegramBot(this.db);
      const channelId = await bot.getPrimaryChannelId();
      if (!channelId) return;

      const r = await this.db.query(
        `SELECT t.id, t.name, t.variant, t.total_prize_pool, t.total_players,
                u.display_name AS winner_name
         FROM tournaments t
         LEFT JOIN users u ON u.id = t.winner_user_id
         WHERE t.id = $1`,
        [tournamentId],
      );
      if (r.rows.length === 0) return;
      const row = r.rows[0];

      await bot.announceTournamentFinished({
        tournamentId: Number(row.id),
        name: String(row.name),
        winnerDisplayName: row.winner_name ?? null,
        prizeUsd: Number(row.total_prize_pool ?? 0),
        totalPlayers: Number(row.total_players ?? 0),
        variant: String(row.variant ?? 'holdem'),
      });
    } catch (e: any) {
      console.warn('[community-cron] onTournamentFinished failed:', e.message);
    }
  }
}
