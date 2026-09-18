import { Pool } from 'pg';

export interface UnlockedAchievement {
  code: string;
  name: string;
  icon: string;
  rewardChips: number;
  rewardUsd: number;
}

export class AchievementService {
  constructor(private db: Pool) {}

  /**
   * Track progress for a specific achievement code.
   * If value >= threshold and not yet unlocked → unlock + give rewards.
   */
  async track(
    userId: number,
    code: string,
    value: number,
    mode: 'set' | 'increment' = 'set',
  ): Promise<UnlockedAchievement | null> {
    const achRes = await this.db.query(
      `SELECT id, code, name, icon, threshold, reward_chips, reward_usd
       FROM achievements
       WHERE code = $1 AND is_active = TRUE`,
      [code],
    );
    if (achRes.rows.length === 0) return null;

    const ach = achRes.rows[0];
    const threshold = Number(ach.threshold);

    // Get or create progress row
    const curRes = await this.db.query(
      `SELECT progress, unlocked_at
       FROM user_achievements
       WHERE user_id = $1 AND achievement_id = $2`,
      [userId, ach.id],
    );

    let newProgress = value;
    if (curRes.rows.length > 0) {
      if (curRes.rows[0].unlocked_at) {
        // already unlocked — just return null
        return null;
      }
      const current = Number(curRes.rows[0].progress) || 0;
      newProgress = mode === 'increment' ? current + value : Math.max(current, value);
    }

    const shouldUnlock = newProgress >= threshold;

    await this.db.query(
      `INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, achievement_id) DO UPDATE
         SET progress = EXCLUDED.progress,
             unlocked_at = COALESCE(user_achievements.unlocked_at, EXCLUDED.unlocked_at)`,
      [userId, ach.id, newProgress, shouldUnlock ? new Date() : null],
    );

    if (!shouldUnlock) return null;

    // Give rewards
    const rewardChips = Number(ach.reward_chips) || 0;
    const rewardUsd = Number(ach.reward_usd) || 0;

    if (rewardChips > 0) {
      await this.db.query(
        `UPDATE free_chips SET chips = chips + $1 WHERE user_id = $2`,
        [rewardChips, userId],
      );
    }

    if (rewardUsd > 0) {
      await this.db.query(
        `UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = NOW()
         WHERE user_id = $2`,
        [rewardUsd, userId],
      );
    }

    return {
      code: ach.code,
      name: ach.name,
      icon: ach.icon,
      rewardChips,
      rewardUsd,
    };
  }

  /**
   * Get all achievements + progress for a user.
   */
  async getUserAchievements(userId: number) {
    const res = await this.db.query(
      `SELECT
         a.id, a.code, a.name, a.description, a.icon, a.category,
         a.threshold, a.reward_chips, a.reward_usd, a.sort_order,
         COALESCE(ua.progress, 0) AS progress,
         ua.unlocked_at,
         COALESCE(ua.claimed, FALSE) AS claimed,
         ua.claimed_at
       FROM achievements a
       LEFT JOIN user_achievements ua
         ON ua.achievement_id = a.id AND ua.user_id = $1
       WHERE a.is_active = TRUE
       ORDER BY a.sort_order ASC, a.id ASC`,
      [userId],
    );

    return res.rows.map((r) => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      description: r.description,
      icon: r.icon,
      category: r.category,
      threshold: Number(r.threshold),
      progress: Number(r.progress),
      unlocked: !!r.unlocked_at,
      unlockedAt: r.unlocked_at,
      claimed: r.claimed,
      claimedAt: r.claimed_at,
      rewardChips: Number(r.reward_chips),
      rewardUsd: Number(r.reward_usd),
    }));
  }

  /**
   * Get all achievements (for listing definitions).
   */
  async listAll() {
    const res = await this.db.query(
      `SELECT id, code, name, description, icon, category,
              threshold, reward_chips, reward_usd, sort_order, is_active
       FROM achievements
       ORDER BY sort_order ASC, id ASC`,
    );
    return res.rows.map((r) => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      description: r.description,
      icon: r.icon,
      category: r.category,
      threshold: Number(r.threshold),
      rewardChips: Number(r.reward_chips),
      rewardUsd: Number(r.reward_usd),
      sortOrder: Number(r.sort_order),
      isActive: r.is_active,
    }));
  }

  /**
   * Claim a reward (marks as claimed, gives nothing — rewards already given on unlock).
   */
  async claim(userId: number, code: string): Promise<{ ok: boolean; error?: string }> {
    const res = await this.db.query(
      `SELECT ua.achievement_id, ua.unlocked_at, ua.claimed
       FROM user_achievements ua
       JOIN achievements a ON a.id = ua.achievement_id
       WHERE ua.user_id = $1 AND a.code = $2`,
      [userId, code],
    );
    if (res.rows.length === 0) return { ok: false, error: 'not_found' };
    if (!res.rows[0].unlocked_at) return { ok: false, error: 'not_unlocked' };
    if (res.rows[0].claimed) return { ok: false, error: 'already_claimed' };

    await this.db.query(
      `UPDATE user_achievements
       SET claimed = TRUE, claimed_at = NOW()
       WHERE user_id = $1 AND achievement_id = $2`,
      [userId, res.rows[0].achievement_id],
    );

    return { ok: true };
  }
}

// ============================================================
// Singleton getter (lazy init from globalThis.__dbPool)
// ============================================================
let _instance: AchievementService | null = null;

export function getAchievementsService(): AchievementService | null {
  if (_instance) return _instance;
  const db = (globalThis as any).__dbPool;
  if (!db) {
    console.warn('[achievements] db pool not set');
    return null;
  }
  _instance = new AchievementService(db);
  return _instance;
}