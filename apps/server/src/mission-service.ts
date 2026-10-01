// ============================================================
// MissionService - 5 daily missions: progress, claiming, daily reset
// Progress is keyed by UTC day. Rewards are free chips + XP.
// ============================================================

import { Pool } from 'pg';

export interface DailyMission {
  code: string;
  title: string;
  description: string;
  metric: string;
  threshold: number;
  rewardChips: number;
  rewardXp: number;
  progress: number;
  claimed: boolean;
  claimable: boolean;
  claimedAt: string | null;
}

export interface MissionClaimResult {
  ok: boolean;
  error?: string;
  code?: string;
  rewardChips?: number;
  rewardXp?: number;
}

// UTC day key, e.g. '2026-10-01'
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export class MissionService {
  constructor(private db: Pool) {}

  // ============================================================
  // getDailyMissions - 5 active missions with today's progress
  // ============================================================
  async getDailyMissions(userId: number, day: string = utcDay()): Promise<DailyMission[]> {
    const r = await this.db.query(
      `SELECT m.code, m.title, m.description, m.metric, m.threshold,
              m.reward_chips, m.reward_xp,
              COALESCE(p.progress, 0)::int AS progress,
              COALESCE(p.claimed, FALSE) AS claimed,
              p.claimed_at
       FROM missions m
       LEFT JOIN mission_progress p
              ON p.mission_id = m.id AND p.user_id = $1 AND p.day = $2::date
       WHERE m.is_active = TRUE
       ORDER BY m.id`,
      [userId, day],
    );

    return r.rows.map((row: any) => {
      const progress = Number(row.progress);
      const threshold = Number(row.threshold);
      const claimed = row.claimed === true;
      return {
        code: row.code,
        title: row.title,
        description: row.description,
        metric: row.metric,
        threshold,
        rewardChips: Number(row.reward_chips),
        rewardXp: Number(row.reward_xp),
        progress,
        claimed,
        claimable: !claimed && progress >= threshold,
        claimedAt: row.claimed_at ?? null,
      };
    });
  }

  // ============================================================
  // trackProgress - add `delta` to today's counter for every mission
  // whose metric matches. Creates the row on first touch.
  // ============================================================
  async trackProgress(
    userId: number,
    metric: string,
    delta = 1,
    day: string = utcDay(),
  ): Promise<number> {
    const d = Math.max(0, Math.trunc(Number(delta) || 0));
    if (!userId || d <= 0 || !metric) return 0;

    const r = await this.db.query(
      `INSERT INTO mission_progress (user_id, mission_id, day, progress)
       SELECT $1, m.id, $2::date, $3
       FROM missions m
       WHERE m.metric = $4 AND m.is_active = TRUE
       ON CONFLICT (user_id, mission_id, day)
       DO UPDATE SET progress = mission_progress.progress + EXCLUDED.progress
       RETURNING mission_id`,
      [userId, day, d, metric],
    );
    return r.rows.length;
  }

  // ============================================================
  // claim - grant rewards once progress >= threshold
  // ============================================================
  async claim(
    userId: number,
    missionCode: string,
    day: string = utcDay(),
  ): Promise<MissionClaimResult> {
    if (!userId || !missionCode) return { ok: false, error: 'missing_params' };

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const mRes = await client.query(
        `SELECT id, code, threshold, reward_chips, reward_xp
         FROM missions WHERE code = $1 AND is_active = TRUE`,
        [missionCode],
      );
      const mission = mRes.rows[0];
      if (!mission) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'mission_not_found' };
      }

      const pRes = await client.query(
        `SELECT progress, claimed FROM mission_progress
         WHERE user_id = $1 AND mission_id = $2 AND day = $3::date
         FOR UPDATE`,
        [userId, mission.id, day],
      );
      const progress = Number(pRes.rows[0]?.progress ?? 0);
      const claimed = pRes.rows[0]?.claimed === true;

      if (claimed) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'already_claimed' };
      }
      if (progress < Number(mission.threshold)) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'not_complete' };
      }

      const rewardChips = Number(mission.reward_chips);
      const rewardXp = Number(mission.reward_xp);

      if (rewardChips > 0) {
        await client.query(
          `INSERT INTO free_chips (user_id, chips) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET chips = free_chips.chips + EXCLUDED.chips`,
          [userId, rewardChips],
        );
        await client.query(
          `INSERT INTO play_money_log (user_id, delta, reason, balance_after)
           VALUES ($1, $2, 'mission_reward',
                   (SELECT chips FROM free_chips WHERE user_id = $1))`,
          [userId, rewardChips],
        );
      }

      if (rewardXp > 0) {
        await client.query(
          `INSERT INTO user_xp (user_id, lifetime_xp, claimed_xp, updated_at)
           VALUES ($1, $2, 0, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET lifetime_xp = user_xp.lifetime_xp + EXCLUDED.lifetime_xp,
                 updated_at = NOW()`,
          [userId, rewardXp],
        );
        await client.query(
          `INSERT INTO xp_transactions (user_id, amount, source, ref_id, meta)
           VALUES ($1, $2, 'bonus', NULL, $3)`,
          [userId, rewardXp, JSON.stringify({ mission: missionCode, day })],
        );
      }

      await client.query(
        `UPDATE mission_progress
         SET claimed = TRUE, claimed_at = NOW()
         WHERE user_id = $1 AND mission_id = $2 AND day = $3::date`,
        [userId, mission.id, day],
      );

      await client.query('COMMIT');
      return { ok: true, code: missionCode, rewardChips, rewardXp };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return { ok: false, error: e.message };
    } finally {
      client.release();
    }
  }

  // ============================================================
  // resetDaily - drop progress for every day before today (UTC)
  // ============================================================
  async resetDaily(): Promise<number> {
    const r = await this.db.query('DELETE FROM mission_progress WHERE day < $1::date', [utcDay()]);
    return r.rowCount ?? 0;
  }
}
