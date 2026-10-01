// ============================================================
// LoyaltyService — pays rakeback + XP per hand,
//                   updates tiers + voucher progress,
//                   exposes read APIs for /api/me + routes.
// ============================================================

import { Pool } from 'pg';
import { LedgerService } from '../ledger.js';
import {
  TierName,
  tierForRake,
  nextTier,
  XP_PER_RAKE_USD,
  SEED_DEFS,
  SeedType,
  seedDef,
  levelFromLifetimeXP,
} from './definitions.js';

export interface PlayerContribution {
  userId: number;
  contribution: number;
}

export interface PayHandResult {
  handId: number;
  totalRake: number;
  pot: number;
  perPlayer: Array<{
    userId: number;
    rakeShare: number;
    rakeback: number;
    xp: number;
    newTier: TierName;
    skipped: boolean;
    reason?: string;
  }>;
}

export class LoyaltyService {
  private ledger: LedgerService;

  constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
  }

  // ============================================================
  // payHand — pay rakeback + XP for a single hand (idempotent)
  // ============================================================
  async payHand(params: {
    handId: number;
    pot: number;
    totalRake: number;
    contributions: PlayerContribution[];
  }): Promise<PayHandResult> {
    const { handId, pot, totalRake, contributions } = params;
    const result: PayHandResult = { handId, totalRake, pot, perPlayer: [] };

    if (totalRake <= 0 || pot <= 0) return result;

    for (const c of contributions) {
      if (c.contribution <= 0) {
        result.perPlayer.push({
          userId: c.userId,
          rakeShare: 0,
          rakeback: 0,
          xp: 0,
          newTier: 'welcome',
          skipped: true,
          reason: 'no_contribution',
        });
        continue;
      }

      const share = c.contribution / pot;
      const rakeShare = Math.round(totalRake * share * 100) / 100;
      if (rakeShare <= 0) {
        result.perPlayer.push({
          userId: c.userId,
          rakeShare: 0,
          rakeback: 0,
          xp: 0,
          newTier: 'welcome',
          skipped: true,
          reason: 'rake_share_zero',
        });
        continue;
      }

      // Idempotency
      const existing = await this.db.query(
        'SELECT id FROM rakeback_log WHERE hand_id = $1 AND user_id = $2',
        [handId, c.userId],
      );
      if (existing.rows.length > 0) {
        const tierRow = await this.db.query('SELECT tier FROM user_tier WHERE user_id = $1', [
          c.userId,
        ]);
        result.perPlayer.push({
          userId: c.userId,
          rakeShare,
          rakeback: 0,
          xp: 0,
          newTier: (tierRow.rows[0]?.tier as TierName) ?? 'welcome',
          skipped: true,
          reason: 'already_paid',
        });
        continue;
      }

      // Current tier
      const tierRow = await this.db.query(
        'SELECT tier, lifetime_rake FROM user_tier WHERE user_id = $1',
        [c.userId],
      );
      const currentTier: TierName = (tierRow.rows[0]?.tier as TierName) ?? 'welcome';
      const lifetimeRakeBefore = Number(tierRow.rows[0]?.lifetime_rake ?? 0);

      const tierDef = tierForRake(lifetimeRakeBefore);
      const rakeback = Math.round(rakeShare * tierDef.rakebackPct * 100) / 100;
      const xp = Math.round(rakeShare * XP_PER_RAKE_USD);

      const client = await this.db.connect();
      try {
        await client.query('BEGIN');

        // 1. Credit rakeback via ledger
        if (rakeback > 0) {
          const userAcc = await this.ledger.getUserAccountId(c.userId);
          const houseAcc = await this.ledger.getAccountId('HOUSE_RAKE');
          if (userAcc && houseAcc) {
            await this.ledger.record({
              kind: 'BONUS',
              userId: c.userId,
              ref: `rakeback_hand_${handId}`,
              meta: { handId, rakeShare, rakebackPct: tierDef.rakebackPct },
              entries: [
                { accountId: houseAcc, amount: -rakeback },
                { accountId: userAcc, amount: rakeback },
              ],
              idempotencyKey: `rakeback_hand_${handId}_user_${c.userId}`,
            });
          }
        }

        // 2. Log rakeback (with exact rake_share for accurate accounting
        //    and referral commission calculation)
        await client.query(
          `INSERT INTO rakeback_log (hand_id, user_id, amount, rake_share)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (hand_id, user_id) DO NOTHING`,
          [handId, c.userId, rakeback, rakeShare],
        );

        // 3. Credit XP
        if (xp > 0) {
          await client.query(
            `INSERT INTO user_xp (user_id, lifetime_xp, claimed_xp, updated_at)
             VALUES ($1, $2, 0, NOW())
             ON CONFLICT (user_id) DO UPDATE
               SET lifetime_xp = user_xp.lifetime_xp + EXCLUDED.lifetime_xp,
                   updated_at = NOW()`,
            [c.userId, xp],
          );
          await client.query(
            `INSERT INTO xp_transactions (user_id, amount, source, ref_id, meta)
             VALUES ($1, $2, 'hand_rakeback', $3, $4)`,
            [c.userId, xp, handId, JSON.stringify({ rakeShare })],
          );
        }

        // 4. Update lifetime_rake + tier
        const newLifetimeRake = Math.round((lifetimeRakeBefore + rakeShare) * 100) / 100;
        const newTierDef = tierForRake(newLifetimeRake);
        await client.query(
          `INSERT INTO user_tier (user_id, tier, lifetime_rake, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET tier = EXCLUDED.tier,
                 lifetime_rake = EXCLUDED.lifetime_rake,
                 updated_at = NOW()`,
          [c.userId, newTierDef.name, newLifetimeRake],
        );

        // 4b. Decrement bonus pending counters
        await client.query(
          `UPDATE users
           SET bonus_playthrough_pending = GREATEST(0, bonus_playthrough_pending - $1),
               bonus_rake_pending = GREATEST(0, bonus_rake_pending - $2)
           WHERE id = $3`,
          [c.contribution, rakeShare, c.userId],
        );

        // 5. Voucher progress
        await client.query(
          `UPDATE vouchers
           SET current_rake = current_rake + $1
           WHERE user_id = $2
             AND used = FALSE
             AND expires_at > NOW()
             AND current_rake < min_rake`,
          [rakeShare, c.userId],
        );

        // 6. Auto-unlock vouchers
        const unlocked = await client.query(
          `SELECT id, amount FROM vouchers
           WHERE user_id = $1
             AND used = FALSE
             AND expires_at > NOW()
             AND current_rake >= min_rake
           RETURNING id, amount`,
          [c.userId],
        );
        for (const v of unlocked.rows) {
          const userAcc = await this.ledger.getUserAccountId(c.userId);
          const bonusAcc = await this.ledger.getAccountId('HOUSE_BONUS');
          const amt = Number(v.amount);
          if (userAcc && bonusAcc) {
            const ok = await this.ledger.record({
              kind: 'BONUS',
              userId: c.userId,
              ref: `voucher_unlock_${v.id}`,
              meta: { voucherId: v.id },
              entries: [
                { accountId: bonusAcc, amount: -amt },
                { accountId: userAcc, amount: amt },
              ],
              idempotencyKey: `voucher_unlock_${v.id}`,
            });
            if (ok.ok) {
              await client.query(`UPDATE vouchers SET used = TRUE, used_at = NOW() WHERE id = $1`, [
                v.id,
              ]);
              await client.query(
                `UPDATE users
                 SET bonus_playthrough_pending = bonus_playthrough_pending + $1,
                     bonus_rake_pending = bonus_rake_pending + 15,
                     bonus_real_hands_pending = bonus_real_hands_pending + 150,
                     bonus_received_at = NOW()
                 WHERE id = $2`,
                [amt * 10, c.userId],
              );
            }
          }
        }

        await client.query('COMMIT');

        // Weekly rake race: this hand's rake share counts toward the week.
        try {
          const { WeeklyRaceService } = await import('../weekly-race-service.js');
          const race = new WeeklyRaceService(this.db);
          await race.recordRake(c.userId, rakeShare);
        } catch (e: any) {
          console.error('[weekly-race] recordRake failed:', e.message);
        }

        result.perPlayer.push({
          userId: c.userId,
          rakeShare,
          rakeback,
          xp,
          newTier: newTierDef.name,
          skipped: false,
        });
      } catch (e: any) {
        await client.query('ROLLBACK');
        console.error(`[loyalty] payHand user=${c.userId} hand=${handId} failed:`, e.message);
        result.perPlayer.push({
          userId: c.userId,
          rakeShare,
          rakeback: 0,
          xp: 0,
          newTier: currentTier,
          skipped: true,
          reason: 'error:' + e.message,
        });
      } finally {
        client.release();
      }
    }

    return result;
  }

  // ============================================================
  // getSummary — everything for /api/me loyalty block
  // ============================================================
  async getSummary(userId: number) {
    const xpRow = await this.db.query(
      'SELECT lifetime_xp, claimed_xp FROM user_xp WHERE user_id = $1',
      [userId],
    );
    const lifetimeXp = Number(xpRow.rows[0]?.lifetime_xp ?? 0);
    const claimedXp = Number(xpRow.rows[0]?.claimed_xp ?? 0);
    const availableXp = Math.max(0, lifetimeXp - claimedXp);
    const levelInfo = levelFromLifetimeXP(lifetimeXp);

    const tierRow = await this.db.query(
      'SELECT tier, lifetime_rake FROM user_tier WHERE user_id = $1',
      [userId],
    );
    const lifetimeRake = Number(tierRow.rows[0]?.lifetime_rake ?? 0);
    const tierDef = tierForRake(lifetimeRake);
    const nt = nextTier(tierDef.name);

    let progressToNextTier = 1;
    if (nt) {
      const span = nt.minRake - tierDef.minRake;
      progressToNextTier =
        span > 0 ? Math.min(1, Math.max(0, (lifetimeRake - tierDef.minRake) / span)) : 0;
    }

    const rbRow = await this.db.query(
      'SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM rakeback_log WHERE user_id = $1',
      [userId],
    );
    const rakebackEarned = Number(rbRow.rows[0]?.total ?? 0);

    const vRows = await this.db.query(
      `SELECT id, amount, min_rake, current_rake, used, expires_at
       FROM vouchers
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    );
    const vouchers = vRows.rows.map((r: any) => {
      const minRake = Number(r.min_rake);
      const current = Number(r.current_rake);
      return {
        id: Number(r.id),
        amount: Number(r.amount),
        minRake,
        currentRake: current,
        used: !!r.used,
        expiresAt: r.expires_at,
        progressPct: minRake > 0 ? Math.min(100, Math.round((current / minRake) * 100)) : 0,
      };
    });

    const fc = await this.db.query(
      'SELECT total_hands, free_hands_won FROM free_chips WHERE user_id = $1',
      [userId],
    );
    const freeHands = Number(fc.rows[0]?.total_hands ?? 0);
    const freeWins = Number(fc.rows[0]?.free_hands_won ?? 0);

    const sRows = await this.db.query(
      'SELECT seed_type, claimed, claimed_at FROM seeds WHERE user_id = $1',
      [userId],
    );
    const claimedMap = new Map<string, { claimed: boolean; at: string | null }>();
    for (const r of sRows.rows) {
      claimedMap.set(r.seed_type, { claimed: !!r.claimed, at: r.claimed_at });
    }

    const seeds = SEED_DEFS.map((def) => {
      const claimed = claimedMap.get(def.type);
      const eligible =
        !claimed?.claimed && freeHands >= def.minFreeHands && freeWins >= def.minFreeWins;
      return {
        type: def.type,
        label: def.label,
        icon: def.icon,
        amount: def.amount,
        claimed: !!claimed?.claimed,
        claimedAt: claimed?.at ?? null,
        eligible,
        progress: {
          freeHands,
          freeWins,
          minFreeHands: def.minFreeHands,
          minFreeWins: def.minFreeWins,
        },
      };
    });

    return {
      lifetimeXp,
      claimedXp,
      availableXp,
      level: levelInfo.level,
      xpIntoLevel: levelInfo.xpIntoLevel,
      xpForNextLevel: levelInfo.xpForNextLevel,
      tier: tierDef.name,
      tierLabel: tierDef.label,
      tierIcon: tierDef.icon,
      tierColor: tierDef.color,
      lifetimeRake,
      rakebackPct: tierDef.rakebackPct,
      nextTier: nt ? { name: nt.name, label: nt.label, minRake: nt.minRake } : null,
      progressToNextTier,
      rakePaidLifetime: lifetimeRake,
      rakebackEarned,
      vouchers,
      seeds,
    };
  }

  // ============================================================
  // claimSeed
  // ============================================================
  async claimSeed(
    userId: number,
    type: SeedType,
  ): Promise<{ ok: boolean; error?: string; amount?: number }> {
    const def = seedDef(type);

    const existing = await this.db.query(
      'SELECT claimed FROM seeds WHERE user_id = $1 AND seed_type = $2',
      [userId, type],
    );
    if (existing.rows[0]?.claimed) return { ok: false, error: 'already_claimed' };

    const fc = await this.db.query(
      'SELECT total_hands, free_hands_won FROM free_chips WHERE user_id = $1',
      [userId],
    );
    const freeHands = Number(fc.rows[0]?.total_hands ?? 0);
    const freeWins = Number(fc.rows[0]?.free_hands_won ?? 0);

    if (freeHands < def.minFreeHands)
      return { ok: false, error: `need_${def.minFreeHands}_free_hands` };
    if (freeWins < def.minFreeWins)
      return { ok: false, error: `need_${def.minFreeWins}_free_wins` };

    const userAcc = await this.ledger.getUserAccountId(userId);
    const bonusAcc = await this.ledger.getAccountId('HOUSE_BONUS');
    if (!userAcc || !bonusAcc) return { ok: false, error: 'account_missing' };

    const ok = await this.ledger.record({
      kind: 'BONUS',
      userId,
      ref: `seed_${type}`,
      meta: { seedType: type, amount: def.amount },
      entries: [
        { accountId: bonusAcc, amount: -def.amount },
        { accountId: userAcc, amount: def.amount },
      ],
      idempotencyKey: `seed_${type}_user_${userId}`,
    });

    if (!ok.ok) return { ok: false, error: ok.error ?? 'ledger_failed' };

    await this.db.query(
      `INSERT INTO seeds (user_id, seed_type, amount, claimed, claimed_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (user_id, seed_type) DO UPDATE
         SET claimed = TRUE, claimed_at = NOW()`,
      [userId, type, def.amount],
    );

    await this.db.query(
      `UPDATE users
       SET bonus_playthrough_pending = bonus_playthrough_pending + $1,
           bonus_rake_pending = bonus_rake_pending + $2,
           bonus_real_hands_pending = bonus_real_hands_pending + $3,
           bonus_received_at = NOW()
       WHERE id = $4`,
      [def.amount * def.playthroughMultiplier, def.minRakeAfter, def.minRealHandsAfter, userId],
    );

    return { ok: true, amount: def.amount };
  }

  // ============================================================
  // cashOutXp — with level gate + 24h cooldown + monthly cap
  // ============================================================
  async cashOutXp(
    userId: number,
    xpAmount: number,
  ): Promise<{
    ok: boolean;
    error?: string;
    usd?: number;
    newClaimedXp?: number;
  }> {
    const xp = Math.floor(xpAmount);
    if (xp < 5000) return { ok: false, error: 'min_5000_xp' };
    if (xp % 1000 !== 0) return { ok: false, error: 'must_be_multiple_of_1000' };

    const xpRow = await this.db.query(
      'SELECT lifetime_xp, claimed_xp FROM user_xp WHERE user_id = $1',
      [userId],
    );
    const lifetimeXp = Number(xpRow.rows[0]?.lifetime_xp ?? 0);
    const claimedXp = Number(xpRow.rows[0]?.claimed_xp ?? 0);
    const available = Math.max(0, lifetimeXp - claimedXp);

    const lvl = levelFromLifetimeXP(lifetimeXp).level;
    if (lvl < 5) return { ok: false, error: 'level_5_required' };

    if (available < xp) return { ok: false, error: 'insufficient_xp' };

    const recent = await this.db.query(
      `SELECT created_at FROM xp_transactions
       WHERE user_id = $1 AND source = 'claim'
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (recent.rows[0]) {
      const last = new Date(recent.rows[0].created_at).getTime();
      const elapsedHours = (Date.now() - last) / 3_600_000;
      if (elapsedHours < 24) {
        const waitH = Math.ceil(24 - elapsedHours);
        return { ok: false, error: `cooldown_${waitH}h` };
      }
    }

    const monthly = await this.db.query(
      `SELECT COALESCE(SUM(ABS(amount)), 0)::bigint AS total
       FROM xp_transactions
       WHERE user_id = $1 AND source = 'claim'
         AND created_at > NOW() - INTERVAL '30 days'`,
      [userId],
    );
    const monthTotal = Number(monthly.rows[0]?.total ?? 0);
    if (monthTotal + xp > 50000) {
      return {
        ok: false,
        error: `monthly_cap_50000_xp (used ${monthTotal})`,
      };
    }

    const usd = xp / 1000;
    const userAcc = await this.ledger.getUserAccountId(userId);
    const bonusAcc = await this.ledger.getAccountId('HOUSE_BONUS');
    if (!userAcc || !bonusAcc) return { ok: false, error: 'account_missing' };

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const ok = await this.ledger.record({
        kind: 'BONUS',
        userId,
        ref: `xp_cashout_${xp}`,
        meta: { xp, usd },
        entries: [
          { accountId: bonusAcc, amount: -usd },
          { accountId: userAcc, amount: usd },
        ],
        idempotencyKey: `xp_cashout_${userId}_${Date.now()}`,
      });

      if (!ok.ok) {
        await client.query('ROLLBACK');
        return { ok: false, error: ok.error ?? 'ledger_failed' };
      }

      const upd = await client.query(
        `UPDATE user_xp
         SET claimed_xp = claimed_xp + $1, updated_at = NOW()
         WHERE user_id = $2
         RETURNING claimed_xp`,
        [xp, userId],
      );

      await client.query(
        `INSERT INTO xp_transactions (user_id, amount, source, meta)
         VALUES ($1, $2, 'claim', $3)`,
        [userId, -xp, JSON.stringify({ usd, level: lvl })],
      );

      await client.query('COMMIT');
      return {
        ok: true,
        usd,
        newClaimedXp: Number(upd.rows[0]?.claimed_xp ?? claimedXp + xp),
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return { ok: false, error: e.message };
    } finally {
      client.release();
    }
  }
}
