import { Pool } from 'pg';

export interface SeasonRow {
  id: number;
  name: string;
  start_at: Date;
  end_at: Date;
  status: 'active' | 'finished';
  prize_pool: string;
}

export class SeasonManager {
  constructor(private db: Pool) {}

  computePoints(position: number, players: number, buyIn: number): number {
    if (!position || position <= 0 || !players || players <= 0) return 0;
    const base = (10 * Math.sqrt(players)) / Math.sqrt(position);
    const multiplier = 1 + Math.log10(Math.max(0, buyIn) + 1);
    const points = Math.round(base * multiplier);
    return Math.max(0, points);
  }

  async ensureActiveSeason(): Promise<SeasonRow> {
    const existing = await this.db.query(`SELECT * FROM seasons WHERE status = 'active' LIMIT 1`);
    if (existing.rows.length > 0) {
      const s = existing.rows[0];
      if (new Date(s.end_at) < new Date()) {
        await this.db.query(`UPDATE seasons SET status = 'finished' WHERE id = $1`, [s.id]);
        return this.createCurrentMonthSeason();
      }
      return s;
    }
    return this.createCurrentMonthSeason();
  }

  private async createCurrentMonthSeason(): Promise<SeasonRow> {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const startAt = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const endAt = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
    const monthName = startAt.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const res = await this.db.query(
      `INSERT INTO seasons (name, start_at, end_at, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [monthName, startAt, endAt],
    );
    console.log(`[season] 🗓️ created season "${monthName}" (#${res.rows[0].id})`);
    return res.rows[0];
  }

  async list(): Promise<SeasonRow[]> {
    const res = await this.db.query(`SELECT * FROM seasons ORDER BY start_at DESC LIMIT 24`);
    return res.rows;
  }

  async leaderboard(seasonId: number, limit: number = 100): Promise<any[]> {
    const res = await this.db.query(
      `SELECT
         te.user_id,
         u.display_name,
         u.avatar_id,
         SUM(te.points_earned)::int AS total_points,
         COUNT(*) FILTER (WHERE te.final_position = 1)::int AS wins,
         COUNT(*) FILTER (WHERE te.payout_amount > 0 OR te.status = 'qualified')::int AS itm_count,
         COUNT(*)::int AS tournaments_played,
         COALESCE(SUM(te.payout_amount), 0) AS total_won
       FROM tournament_entries te
       JOIN tournaments t ON t.id = te.tournament_id
       JOIN users u ON u.id = te.user_id
       WHERE t.season_id = $1
         AND t.status = 'finished'
         AND te.status IN ('cashed', 'won', 'qualified', 'eliminated')
       GROUP BY te.user_id, u.display_name, u.avatar_id
       HAVING SUM(te.points_earned) > 0
       ORDER BY total_points DESC, wins DESC, tournaments_played ASC
       LIMIT $2`,
      [seasonId, limit],
    );

    return res.rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      displayName: r.display_name,
      avatarId: r.avatar_id,
      points: r.total_points,
      wins: r.wins,
      itm: r.itm_count,
      played: r.tournaments_played,
      won: Number(r.total_won),
    }));
  }

  async myRank(
    seasonId: number,
    userId: number,
  ): Promise<{ rank: number | null; points: number; wins: number; played: number } | null> {
    const res = await this.db.query(
      `WITH agg AS (
         SELECT
           te.user_id,
           SUM(te.points_earned)::int AS points,
           COUNT(*) FILTER (WHERE te.final_position = 1)::int AS wins,
           COUNT(*)::int AS played
         FROM tournament_entries te
         JOIN tournaments t ON t.id = te.tournament_id
         WHERE t.season_id = $1
           AND t.status = 'finished'
           AND te.status IN ('cashed', 'won', 'qualified', 'eliminated')
         GROUP BY te.user_id
       ),
       ranked AS (
         SELECT
           user_id, points, wins, played,
           ROW_NUMBER() OVER (ORDER BY points DESC, wins DESC, played ASC) AS rank
         FROM agg
         WHERE points > 0
       )
       SELECT * FROM ranked WHERE user_id = $2`,
      [seasonId, userId],
    );
    if (res.rows.length === 0) {
      return { rank: null, points: 0, wins: 0, played: 0 };
    }
    const r = res.rows[0];
    return {
      rank: Number(r.rank),
      points: Number(r.points),
      wins: Number(r.wins),
      played: Number(r.played),
    };
  }
}