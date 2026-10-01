// ============================================================
// ReferralService
// ------------------------------------------------------------
// Owns: attribution, per-hand commissions, team queries,
//       milestones, group affiliates, duo bonuses.
// ------------------------------------------------------------
// Commission rates (per plan):
//   Direct (level 1):  12%
//   Indirect (level 2): 3%
//   Group affiliate:    8%
//   Duo bonus:          5% each, monthly
// ------------------------------------------------------------

import { Pool } from 'pg';
import crypto from 'crypto';
import { LedgerService } from './ledger.js';

const SIGNUP_BONUS_CHIPS = 5000;
const DIRECT_RATE = 0.12;
const INDIRECT_RATE = 0.03;
const GROUP_RATE = 0.08;
const DUO_RATE = 0.05;
const DUO_MONTHLY_CAP = 2.5; // USD per duo per month

export interface ReferralHandInput {
  handId: number;
  totalRake: number;
  contributions: Array<{ userId: number; contribution: number }>;
}

export class ReferralService {
  private ledger: LedgerService;

  constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
  }

  // ============================================================
  // Attribution — called from auth on first login
  // ============================================================
  async attributeReferral(
    newUserId: number,
    code: string,
  ): Promise<{ ok: boolean; referrerId?: number; error?: string }> {
    if (!code || code.length < 5) return { ok: false, error: 'invalid_code' };

    // Personal: "ref_XXXXXXXX"
    if (code.startsWith('ref_')) {
      const refRes = await this.db.query('SELECT id FROM users WHERE referral_code = $1', [code]);
      if (refRes.rows.length === 0) return { ok: false, error: 'referrer_not_found' };
      const referrerId = Number(refRes.rows[0].id);
      if (referrerId === newUserId) return { ok: false, error: 'self_referral' };

      const existing = await this.db.query('SELECT id FROM referral_edges WHERE referee_id = $1', [
        newUserId,
      ]);
      if (existing.rows.length > 0) return { ok: false, error: 'already_attributed' };

      await this.db.query(
        `INSERT INTO referral_edges (referrer_id, referee_id, level, source_type, source_code)
         VALUES ($1, $2, 1, 'user', $3)`,
        [referrerId, newUserId, code],
      );

      // Level-2 edge: if the direct referrer was himself referred
      const upper = await this.db.query(
        'SELECT referrer_id FROM referral_edges WHERE referee_id = $1 AND level = 1',
        [referrerId],
      );
      if (upper.rows.length > 0) {
        await this.db.query(
          `INSERT INTO referral_edges (referrer_id, referee_id, level, source_type, source_code)
           VALUES ($1, $2, 2, 'indirect', $3)
           ON CONFLICT (referee_id) DO NOTHING`,
          [Number(upper.rows[0].referrer_id), newUserId, code],
        );
      }

      await this.giveChips(referrerId, SIGNUP_BONUS_CHIPS, 'referral_signup');
      return { ok: true, referrerId };
    }

    // Group: "grp_XXXXXXXX"
    if (code.startsWith('grp_')) {
      const shortCode = code.slice(4);
      const grpRes = await this.db.query(
        'SELECT id, owner_user_id FROM group_affiliates WHERE short_code = $1 AND is_active = TRUE',
        [shortCode],
      );
      if (grpRes.rows.length === 0) return { ok: false, error: 'group_not_found' };
      const groupId = Number(grpRes.rows[0].id);
      const ownerId = Number(grpRes.rows[0].owner_user_id);

      await this.db.query(
        `INSERT INTO group_members (group_affiliate_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [groupId, newUserId],
      );

      await this.db.query(
        `INSERT INTO referral_edges (referrer_id, referee_id, level, source_type, source_code)
         VALUES ($1, $2, 1, 'group', $3)
         ON CONFLICT (referee_id) DO NOTHING`,
        [ownerId, newUserId, code],
      );

      await this.db.query(
        `UPDATE group_affiliates SET total_members = total_members + 1 WHERE id = $1`,
        [groupId],
      );

      return { ok: true, referrerId: ownerId };
    }

    return { ok: false, error: 'unknown_code_format' };
  }

  // ============================================================
  // Per-hand commissions
  // ============================================================
  async payForHand(input: ReferralHandInput): Promise<void> {
    const { handId, totalRake, contributions } = input;
    if (totalRake <= 0) return;

    const totalContribution = contributions.reduce((s, c) => s + c.contribution, 0);
    if (totalContribution <= 0) return;

    for (const c of contributions) {
      if (c.contribution <= 0) continue;
      const rakeShare = Math.round(totalRake * (c.contribution / totalContribution) * 100) / 100;
      if (rakeShare <= 0) continue;

      // Update referee's active timestamp + rake contribution
      await this.db.query(
        `UPDATE referral_edges
         SET last_active_at = NOW(),
             total_rake_from = total_rake_from + $1
         WHERE referee_id = $2`,
        [rakeShare, c.userId],
      );

      await this.payDirect(handId, c.userId, rakeShare);
      await this.payIndirect(handId, c.userId, rakeShare);
      await this.payGroup(handId, c.userId, rakeShare);
    }
  }

  private async payDirect(handId: number, refereeId: number, rakeShare: number): Promise<void> {
    const edge = await this.db.query(
      `SELECT referrer_id FROM referral_edges
       WHERE referee_id = $1 AND level = 1 AND expires_at > NOW()`,
      [refereeId],
    );
    if (edge.rows.length === 0) return;

    const referrerId = Number(edge.rows[0].referrer_id);
    const amount = Math.round(rakeShare * DIRECT_RATE * 100) / 100;
    if (amount <= 0) return;

    await this.payReferrer({
      referrerId,
      refereeId,
      handId,
      level: 1,
      rakeShare,
      rate: DIRECT_RATE,
      amount,
      source: 'direct',
    });
  }

  private async payIndirect(handId: number, refereeId: number, rakeShare: number): Promise<void> {
    const edge = await this.db.query(
      `SELECT referrer_id FROM referral_edges
       WHERE referee_id = $1 AND level = 2 AND expires_at > NOW()`,
      [refereeId],
    );
    if (edge.rows.length === 0) return;

    const referrerId = Number(edge.rows[0].referrer_id);
    const amount = Math.round(rakeShare * INDIRECT_RATE * 100) / 100;
    if (amount <= 0) return;

    await this.payReferrer({
      referrerId,
      refereeId,
      handId,
      level: 2,
      rakeShare,
      rate: INDIRECT_RATE,
      amount,
      source: 'indirect',
    });
  }

  private async payReferrer(params: {
    referrerId: number;
    refereeId: number;
    handId: number;
    level: number;
    rakeShare: number;
    rate: number;
    amount: number;
    source: string;
  }): Promise<void> {
    const idem = `referral_hand_${params.handId}_referrer_${params.referrerId}_lvl_${params.level}`;

    const userAcc = await this.ledger.getUserAccountId(params.referrerId);
    const houseAcc = await this.ledger.getAccountId('HOUSE_RAKE');
    if (!userAcc || !houseAcc) return;

    const result = await this.ledger.record({
      kind: 'REFERRAL',
      userId: params.referrerId,
      ref: idem,
      meta: {
        handId: params.handId,
        refereeId: params.refereeId,
        level: params.level,
        rakeShare: params.rakeShare,
        rate: params.rate,
      },
      entries: [
        { accountId: houseAcc, amount: -params.amount },
        { accountId: userAcc, amount: params.amount },
      ],
      idempotencyKey: idem,
    });

    if (!result.ok || result.duplicate) return;

    await this.db.query(
      `INSERT INTO referral_earnings
         (referrer_id, referee_id, hand_id, level, rake_share, rate_applied, amount, source, ledger_tx_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (hand_id, referrer_id, referee_id, level)
         WHERE hand_id IS NOT NULL
         DO NOTHING`,
      [
        params.referrerId,
        params.refereeId,
        params.handId,
        params.level,
        params.rakeShare,
        params.rate,
        params.amount,
        params.source,
        result.transactionId ?? null,
      ],
    );

    await this.db.query(
      `UPDATE referral_edges
       SET total_earned_for_referrer = total_earned_for_referrer + $1
       WHERE referrer_id = $2 AND referee_id = $3 AND level = $4`,
      [params.amount, params.referrerId, params.refereeId, params.level],
    );
  }

  private async payGroup(handId: number, refereeId: number, rakeShare: number): Promise<void> {
    const gm = await this.db.query(
      `SELECT gm.group_affiliate_id, ga.owner_user_id, ga.rate_pct
       FROM group_members gm
       JOIN group_affiliates ga ON ga.id = gm.group_affiliate_id
       WHERE gm.user_id = $1 AND ga.is_active = TRUE AND ga.expires_at > NOW()`,
      [refereeId],
    );
    if (gm.rows.length === 0) return;

    const row = gm.rows[0];
    const groupId = Number(row.group_affiliate_id);
    const ownerId = Number(row.owner_user_id);
    const rate = Number(row.rate_pct) || GROUP_RATE;
    const amount = Math.round(rakeShare * rate * 100) / 100;
    if (amount <= 0) return;

    const idem = `group_hand_${handId}_group_${groupId}_owner_${ownerId}`;
    const userAcc = await this.ledger.getUserAccountId(ownerId);
    const houseAcc = await this.ledger.getAccountId('HOUSE_RAKE');
    if (!userAcc || !houseAcc) return;

    const result = await this.ledger.record({
      kind: 'REFERRAL',
      userId: ownerId,
      ref: idem,
      meta: { handId, refereeId, groupId, rate },
      entries: [
        { accountId: houseAcc, amount: -amount },
        { accountId: userAcc, amount: amount },
      ],
      idempotencyKey: idem,
    });

    if (!result.ok || result.duplicate) return;

    await this.db.query(
      `UPDATE group_members
       SET last_active_at = NOW(),
           total_rake_from = total_rake_from + $1,
           total_earned_for_group = total_earned_for_group + $2
       WHERE group_affiliate_id = $3 AND user_id = $4`,
      [rakeShare, amount, groupId, refereeId],
    );

    await this.db.query(
      `UPDATE group_affiliates
       SET total_group_rake = total_group_rake + $1,
           total_earnings = total_earnings + $2
       WHERE id = $3`,
      [rakeShare, amount, groupId],
    );
  }

  // ============================================================
  // Dashboard
  // ============================================================
  async getDashboard(userId: number): Promise<any> {
    const [uRes, lifetimeRes, monthRes, activeRes, totalRefsRes, recentRes, codeRes] =
      await Promise.all([
        this.db.query(`SELECT referral_code FROM users WHERE id = $1`, [userId]),
        this.db.query(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS v
           FROM referral_earnings WHERE referrer_id = $1`,
          [userId],
        ),
        this.db.query(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS v
           FROM referral_earnings
           WHERE referrer_id = $1 AND paid_at > date_trunc('month', NOW())`,
          [userId],
        ),
        this.db.query(
          `SELECT COUNT(DISTINCT referee_id)::int AS v
           FROM referral_edges
           WHERE referrer_id = $1 AND level = 1
             AND last_active_at > NOW() - INTERVAL '30 days'`,
          [userId],
        ),
        this.db.query(
          `SELECT COUNT(*)::int AS v FROM referral_edges
           WHERE referrer_id = $1 AND level = 1`,
          [userId],
        ),
        this.db.query(
          `SELECT re.amount, re.level, re.rate_applied, re.rake_share,
                  re.paid_at, u.display_name
           FROM referral_earnings re
           JOIN users u ON u.id = re.referee_id
           WHERE re.referrer_id = $1
           ORDER BY re.paid_at DESC LIMIT 10`,
          [userId],
        ),
        this.db.query(`SELECT referral_code FROM users WHERE id = $1`, [userId]),
      ]);

    const referralCode = String(uRes.rows[0]?.referral_code ?? '');
    const lifetime = Number(lifetimeRes.rows[0].v);
    const thisMonth = Number(monthRes.rows[0].v);
    const activeRefs = Number(activeRes.rows[0].v);
    const totalRefs = Number(totalRefsRes.rows[0].v);

    // Rate + bonus
    const bonusTier = Math.min(6, Math.floor(activeRefs / 5) * 2);
    const directRate = DIRECT_RATE + bonusTier / 100;
    const indirectRate = INDIRECT_RATE;

    return {
      referralCode,
      shareLink: `https://t.me/FlopClubBot?start=${referralCode}`,
      lifetime,
      thisMonth,
      activeRefs,
      totalRefs,
      directRate,
      indirectRate,
      bonusTier,
      ambassadorProgress: Math.min(100, Math.round((activeRefs / 25) * 100)),
      ambassadorTarget: 25,
      recentActivity: recentRes.rows.map((r: any) => ({
        displayName: r.display_name,
        amount: Number(r.amount),
        level: r.level,
        rate: Number(r.rate_applied),
        rakeShare: Number(r.rake_share),
        paidAt: r.paid_at,
      })),
    };
  }

  // ============================================================
  // Team
  // ============================================================
  async getTeam(userId: number): Promise<any> {
    const direct = await this.db.query(
      `SELECT re.referee_id, re.created_at, re.last_active_at,
              re.total_rake_from, re.total_earned_for_referrer,
              u.display_name, u.avatar_id, u.referral_code,
              COALESCE(ut.lifetime_rake, 0)::numeric AS lifetime_rake,
              COALESCE(ux.lifetime_xp, 0)::bigint AS lifetime_xp
       FROM referral_edges re
       JOIN users u ON u.id = re.referee_id
       LEFT JOIN user_tier ut ON ut.user_id = re.referee_id
       LEFT JOIN user_xp ux ON ux.user_id = re.referee_id
       WHERE re.referrer_id = $1 AND re.level = 1
       ORDER BY re.total_earned_for_referrer DESC`,
      [userId],
    );

    const indirect = await this.db.query(
      `SELECT re.referrer_id AS via_user_id,
              u.display_name AS via_name,
              COUNT(*)::int AS count,
              COALESCE(SUM(re.total_rake_from), 0)::numeric AS total_rake,
              COALESCE(SUM(re.total_earned_for_referrer), 0)::numeric AS total_earned
       FROM referral_edges re
       JOIN users u ON u.id = re.referrer_id
       WHERE re.referrer_id IN (
         SELECT referee_id FROM referral_edges
         WHERE referrer_id = $1 AND level = 1
       )
       AND re.level = 1
       GROUP BY re.referrer_id, u.display_name
       ORDER BY total_earned DESC`,
      [userId],
    );

    return {
      direct: direct.rows.map((r: any) => ({
        userId: Number(r.referee_id),
        displayName: r.display_name,
        avatarId: r.avatar_id,
        joinedAt: r.created_at,
        lastActiveAt: r.last_active_at,
        isActive:
          r.last_active_at && new Date(r.last_active_at) > new Date(Date.now() - 30 * 86400000),
        rakeFrom: Number(r.total_rake_from),
        earned: Number(r.total_earned_for_referrer),
        lifetimeRake: Number(r.lifetime_rake),
        lifetimeXp: Number(r.lifetime_xp),
      })),
      indirect: indirect.rows.map((r: any) => ({
        viaUserId: Number(r.via_user_id),
        viaName: r.via_name,
        count: Number(r.count),
        totalRake: Number(r.total_rake),
        totalEarned: Number(r.total_earned),
      })),
    };
  }

  // ============================================================
  // History
  // ============================================================
  async getHistory(
    userId: number,
    opts: { source?: string; limit?: number; offset?: number } = {},
  ): Promise<any> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const source = opts.source;

    const where = source && source !== 'all' ? 'AND re.source = $4' : '';
    const params: any[] = [userId, limit, offset];
    if (source && source !== 'all') params.push(source);

    const [rows, total] = await Promise.all([
      this.db.query(
        `SELECT re.amount, re.level, re.rate_applied, re.rake_share,
                re.source, re.paid_at,
                u.display_name AS referee_name
         FROM referral_earnings re
         JOIN users u ON u.id = re.referee_id
         WHERE re.referrer_id = $1
         ${where}
         ORDER BY re.paid_at DESC
         LIMIT $2 OFFSET $3`,
        params,
      ),
      this.db.query(
        `SELECT
           COALESCE(SUM(amount), 0)::numeric AS total,
           COALESCE(SUM(amount) FILTER (WHERE paid_at > date_trunc('month', NOW())), 0)::numeric AS this_month
         FROM referral_earnings WHERE referrer_id = $1`,
        [userId],
      ),
    ]);

    return {
      entries: rows.rows.map((r: any) => ({
        amount: Number(r.amount),
        level: r.level,
        rate: Number(r.rate_applied),
        rakeShare: Number(r.rake_share),
        source: r.source,
        paidAt: r.paid_at,
        refereeName: r.referee_name,
      })),
      total: Number(total.rows[0].total),
      thisMonth: Number(total.rows[0].this_month),
      limit,
      offset,
    };
  }

  // ============================================================
  // Leaderboard
  // ============================================================
  async getLeaderboard(userId: number): Promise<any> {
    const top = await this.db.query(
      `SELECT re.referrer_id, u.display_name, u.avatar_id,
              SUM(re.amount)::numeric AS earned,
              COUNT(DISTINCT re.referee_id)::int AS refs
       FROM referral_earnings re
       JOIN users u ON u.id = re.referrer_id
       WHERE re.paid_at > date_trunc('month', NOW())
       GROUP BY re.referrer_id, u.display_name, u.avatar_id
       ORDER BY earned DESC
       LIMIT 20`,
    );

    const me = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS earned,
              COUNT(DISTINCT referee_id)::int AS refs
       FROM referral_earnings
       WHERE referrer_id = $1 AND paid_at > date_trunc('month', NOW())`,
      [userId],
    );

    const myRank = await this.db.query(
      `WITH agg AS (
        SELECT referrer_id, SUM(amount)::numeric AS earned
        FROM referral_earnings
        WHERE paid_at > date_trunc('month', NOW())
        GROUP BY referrer_id
      )
      SELECT COUNT(*) + 1 AS rank FROM agg
      WHERE earned > COALESCE((SELECT earned FROM agg WHERE referrer_id = $1), 0)`,
      [userId],
    );

    return {
      prizePool: 500,
      entries: top.rows.map((r: any, i: number) => ({
        rank: i + 1,
        userId: Number(r.referrer_id),
        displayName: r.display_name,
        avatarId: r.avatar_id,
        earned: Number(r.earned),
        refs: Number(r.refs),
      })),
      me: {
        rank: Number(myRank.rows[0]?.rank ?? 0),
        earned: Number(me.rows[0]?.earned ?? 0),
        refs: Number(me.rows[0]?.refs ?? 0),
      },
    };
  }

  // ============================================================
  // Milestones
  // ============================================================
  async getMilestones(userId: number): Promise<any> {
    const [defs, activeRes, lifetimeRes, totalRefsRes, claimsRes] = await Promise.all([
      this.db.query(`SELECT * FROM referral_milestones ORDER BY sort_order ASC`),
      this.db.query(
        `SELECT COUNT(DISTINCT referee_id)::int AS v
         FROM referral_edges
         WHERE referrer_id = $1 AND level = 1
           AND last_active_at > NOW() - INTERVAL '30 days'`,
        [userId],
      ),
      this.db.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS v
         FROM referral_earnings WHERE referrer_id = $1`,
        [userId],
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS v FROM referral_edges
         WHERE referrer_id = $1 AND level = 1`,
        [userId],
      ),
      this.db.query(`SELECT milestone_id FROM referral_milestone_claims WHERE user_id = $1`, [
        userId,
      ]),
    ]);

    const active = Number(activeRes.rows[0].v);
    const lifetime = Number(lifetimeRes.rows[0].v);
    const totalRefs = Number(totalRefsRes.rows[0].v);
    const claimedIds = new Set(claimsRes.rows.map((r: any) => Number(r.milestone_id)));

    const metrics: Record<string, number> = {
      active_refs: active,
      lifetime_earned: lifetime,
      total_refs: totalRefs,
    };

    return defs.rows.map((d: any) => {
      const current = metrics[d.metric] ?? 0;
      const achieved = current >= d.threshold;
      return {
        id: Number(d.id),
        code: d.code,
        name: d.name,
        description: d.description,
        threshold: Number(d.threshold),
        metric: d.metric,
        current,
        achieved,
        claimed: claimedIds.has(Number(d.id)),
        claimable: achieved && !claimedIds.has(Number(d.id)),
        rewardChips: Number(d.reward_chips),
        rewardUsd: Number(d.reward_usd),
        rewardXp: Number(d.reward_xp),
      };
    });
  }

  async claimMilestone(
    userId: number,
    code: string,
  ): Promise<{ ok: boolean; error?: string; reward?: any }> {
    const m = await this.db.query('SELECT * FROM referral_milestones WHERE code = $1', [code]);
    if (m.rows.length === 0) return { ok: false, error: 'milestone_not_found' };
    const ms = m.rows[0];
    const milestoneId = Number(ms.id);

    // Check claim
    const already = await this.db.query(
      'SELECT 1 FROM referral_milestone_claims WHERE user_id = $1 AND milestone_id = $2',
      [userId, milestoneId],
    );
    if (already.rows.length > 0) return { ok: false, error: 'already_claimed' };

    // Check achieved
    const metrics: Record<string, any> = {
      active_refs: await this.db.query(
        `SELECT COUNT(DISTINCT referee_id)::int AS v
         FROM referral_edges
         WHERE referrer_id = $1 AND level = 1
           AND last_active_at > NOW() - INTERVAL '30 days'`,
        [userId],
      ),
      lifetime_earned: await this.db.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS v
         FROM referral_earnings WHERE referrer_id = $1`,
        [userId],
      ),
      total_refs: await this.db.query(
        `SELECT COUNT(*)::int AS v FROM referral_edges
         WHERE referrer_id = $1 AND level = 1`,
        [userId],
      ),
    };

    const current = Number(metrics[ms.metric]?.rows[0].v ?? 0);
    if (current < Number(ms.threshold)) {
      return { ok: false, error: 'not_achieved' };
    }

    // Grant rewards
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Chips
      if (Number(ms.reward_chips) > 0) {
        await client.query(
          `INSERT INTO free_chips (user_id, chips) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET chips = free_chips.chips + $2`,
          [userId, Number(ms.reward_chips)],
        );
        await client.query(
          `INSERT INTO play_money_log (user_id, delta, reason, balance_after)
           VALUES ($1, $2, 'referral_milestone',
             (SELECT chips FROM free_chips WHERE user_id = $1))`,
          [userId, Number(ms.reward_chips)],
        );
      }

      // XP
      if (Number(ms.reward_xp) > 0) {
        await client.query(
          `INSERT INTO user_xp (user_id, lifetime_xp, claimed_xp, updated_at)
           VALUES ($1, $2, 0, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET lifetime_xp = user_xp.lifetime_xp + EXCLUDED.lifetime_xp,
                 updated_at = NOW()`,
          [userId, Number(ms.reward_xp)],
        );
      }

      await client.query(
        `INSERT INTO referral_milestone_claims (user_id, milestone_id)
         VALUES ($1, $2)`,
        [userId, milestoneId],
      );

      await client.query('COMMIT');

      // USD reward via ledger (outside transaction — ledger has its own)
      if (Number(ms.reward_usd) > 0) {
        const userAcc = await this.ledger.getUserAccountId(userId);
        const houseAcc = await this.ledger.getAccountId('HOUSE_RAKE');
        if (userAcc && houseAcc) {
          await this.ledger.record({
            kind: 'REFERRAL',
            userId,
            ref: `milestone_${code}`,
            meta: { milestoneId, code },
            entries: [
              { accountId: houseAcc, amount: -Number(ms.reward_usd) },
              { accountId: userAcc, amount: Number(ms.reward_usd) },
            ],
            idempotencyKey: `milestone_${userId}_${code}`,
          });
        }
      }

      return {
        ok: true,
        reward: {
          chips: Number(ms.reward_chips),
          usd: Number(ms.reward_usd),
          xp: Number(ms.reward_xp),
        },
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return { ok: false, error: e.message };
    } finally {
      client.release();
    }
  }

  // ============================================================
  // Ambassador
  // ============================================================
  async getAmbassadorStatus(userId: number): Promise<any> {
    const activeRes = await this.db.query(
      `SELECT COUNT(DISTINCT referee_id)::int AS v
       FROM referral_edges
       WHERE referrer_id = $1 AND level = 1
         AND last_active_at > NOW() - INTERVAL '30 days'`,
      [userId],
    );
    const active = Number(activeRes.rows[0].v);
    return {
      isAmbassador: active >= 25,
      activeRefs: active,
      required: 25,
      progressPct: Math.min(100, Math.round((active / 25) * 100)),
      benefits: {
        directRate: 0.18,
        indirectRate: 0.05,
        monthlyTournament: 500,
      },
    };
  }

  // ============================================================
  // Group Affiliates
  // ============================================================
  async registerAffiliate(params: {
    ownerUserId: number;
    telegramGroupId: number;
    telegramGroupTitle: string;
    telegramGroupType: 'group' | 'supergroup' | 'channel';
    inviteLink?: string;
  }): Promise<{ ok: boolean; error?: string; id?: number; shortCode?: string }> {
    // Verify bot is admin in the group (if bot token available)
    // Note: this is enforced by Telegram when we try to getChatMember
    try {
      const existing = await this.db.query(
        'SELECT id, short_code FROM group_affiliates WHERE telegram_group_id = $1',
        [params.telegramGroupId],
      );
      if (existing.rows.length > 0) {
        if (Number(existing.rows[0].id) && existing.rows[0].short_code) {
          // Reuse if same owner
          const ownerCheck = await this.db.query(
            'SELECT owner_user_id FROM group_affiliates WHERE telegram_group_id = $1',
            [params.telegramGroupId],
          );
          if (Number(ownerCheck.rows[0].owner_user_id) !== params.ownerUserId) {
            return { ok: false, error: 'group_already_registered' };
          }
          return {
            ok: true,
            id: Number(existing.rows[0].id),
            shortCode: existing.rows[0].short_code,
          };
        }
      }

      // Generate unique short code
      let shortCode = '';
      for (let i = 0; i < 5; i++) {
        const candidate = crypto.randomBytes(4).toString('hex');
        const check = await this.db.query('SELECT 1 FROM group_affiliates WHERE short_code = $1', [
          candidate,
        ]);
        if (check.rows.length === 0) {
          shortCode = candidate;
          break;
        }
      }
      if (!shortCode) return { ok: false, error: 'code_generation_failed' };

      const res = await this.db.query(
        `INSERT INTO group_affiliates
           (owner_user_id, telegram_group_id, telegram_group_title,
            telegram_group_type, invite_link, short_code)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, short_code`,
        [
          params.ownerUserId,
          params.telegramGroupId,
          params.telegramGroupTitle,
          params.telegramGroupType,
          params.inviteLink ?? null,
          shortCode,
        ],
      );

      return {
        ok: true,
        id: Number(res.rows[0].id),
        shortCode: res.rows[0].short_code,
      };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async listAffiliates(userId: number): Promise<any[]> {
    const res = await this.db.query(
      `SELECT id, telegram_group_id, telegram_group_title, telegram_group_type,
              short_code, rate_pct, total_members, total_group_rake, total_earnings,
              is_active, is_verified, expires_at, created_at
       FROM group_affiliates
       WHERE owner_user_id = $1
       ORDER BY total_earnings DESC, created_at DESC`,
      [userId],
    );
    return res.rows.map((r: any) => ({
      id: Number(r.id),
      telegramGroupId: Number(r.telegram_group_id),
      telegramGroupTitle: r.telegram_group_title,
      telegramGroupType: r.telegram_group_type,
      shortCode: r.short_code,
      ratePct: Number(r.rate_pct),
      totalMembers: Number(r.total_members),
      totalGroupRake: Number(r.total_group_rake),
      totalEarnings: Number(r.total_earnings),
      isActive: r.is_active,
      isVerified: r.is_verified,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      affiliateLink: `https://t.me/FlopClubBot?start=grp_${r.short_code}`,
    }));
  }

  async getAffiliateDetail(userId: number, affiliateId: number): Promise<any | null> {
    const res = await this.db.query(
      `SELECT * FROM group_affiliates WHERE id = $1 AND owner_user_id = $2`,
      [affiliateId, userId],
    );
    if (res.rows.length === 0) return null;
    const a = res.rows[0];

    const [members, topContrib, growth] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE last_active_at > NOW() - INTERVAL '30 days')::int AS active
         FROM group_members WHERE group_affiliate_id = $1`,
        [affiliateId],
      ),
      this.db.query(
        `SELECT gm.user_id, u.display_name, gm.total_rake_from
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_affiliate_id = $1
         ORDER BY gm.total_rake_from DESC LIMIT 10`,
        [affiliateId],
      ),
      this.db.query(
        `SELECT DATE_TRUNC('day', paid_at)::date AS day,
                SUM(amount)::numeric AS earned
         FROM referral_earnings re
         JOIN group_members gm ON gm.user_id = re.referee_id
         WHERE gm.group_affiliate_id = $1
           AND re.paid_at > NOW() - INTERVAL '30 days'
         GROUP BY 1 ORDER BY 1`,
        [affiliateId],
      ),
    ]);

    return {
      id: Number(a.id),
      telegramGroupId: Number(a.telegram_group_id),
      telegramGroupTitle: a.telegram_group_title,
      telegramGroupType: a.telegram_group_type,
      shortCode: a.short_code,
      inviteLink: a.invite_link,
      ratePct: Number(a.rate_pct),
      totalMembers: Number(a.total_members),
      activeMembers: Number(members.rows[0]?.active ?? 0),
      totalGroupRake: Number(a.total_group_rake),
      totalEarnings: Number(a.total_earnings),
      isActive: a.is_active,
      isVerified: a.is_verified,
      expiresAt: a.expires_at,
      createdAt: a.created_at,
      affiliateLink: `https://t.me/FlopClubBot?start=grp_${a.short_code}`,
      topContributors: topContrib.rows.map((r: any) => ({
        userId: Number(r.user_id),
        displayName: r.display_name,
        rakeFrom: Number(r.total_rake_from),
      })),
      dailyEarnings: growth.rows.map((r: any) => ({
        day: r.day,
        earned: Number(r.earned),
      })),
    };
  }

  async removeAffiliate(
    userId: number,
    affiliateId: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await this.db.query(
      `UPDATE group_affiliates SET is_active = FALSE
       WHERE id = $1 AND owner_user_id = $2
       RETURNING id`,
      [affiliateId, userId],
    );
    if (res.rows.length === 0) return { ok: false, error: 'not_found' };
    return { ok: true };
  }

  // ============================================================
  // Monthly Duo Bonus (cron)
  // ============================================================
  async payMonthlyDuoBonuses(): Promise<number> {
    const monthYear = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    let paid = 0;

    const edges = await this.db.query(
      `SELECT re.referrer_id, re.referee_id, re.total_rake_from
       FROM referral_edges re
       WHERE re.level = 1
         AND re.last_active_at > NOW() - INTERVAL '30 days'
         AND re.total_rake_from > 0`,
    );

    for (const e of edges.rows) {
      const referrerId = Number(e.referrer_id);
      const refereeId = Number(e.referee_id);
      const rakeFrom = Number(e.total_rake_from);

      const bonusEach = Math.min(DUO_MONTHLY_CAP, rakeFrom * DUO_RATE);
      if (bonusEach <= 0) continue;

      // Referrer side
      await this.payDuoBonus(referrerId, refereeId, monthYear, bonusEach, 'referrer');
      // Referee side (self-bonus for being active)
      await this.payDuoBonus(refereeId, referrerId, monthYear, bonusEach, 'referee');

      paid++;
    }

    console.log(`[referral] 💰 duo bonuses paid for ${paid} pairs (${monthYear})`);
    return paid;
  }

  private async payDuoBonus(
    userId: number,
    otherId: number,
    monthYear: string,
    amount: number,
    side: 'referrer' | 'referee',
  ): Promise<void> {
    const idem = `duo_${monthYear}_${userId}_${side}`;
    const userAcc = await this.ledger.getUserAccountId(userId);
    const houseAcc = await this.ledger.getAccountId('HOUSE_RAKE');
    if (!userAcc || !houseAcc) return;

    const result = await this.ledger.record({
      kind: 'REFERRAL',
      userId,
      ref: idem,
      meta: { otherId, monthYear, side },
      entries: [
        { accountId: houseAcc, amount: -amount },
        { accountId: userAcc, amount: amount },
      ],
      idempotencyKey: idem,
    });

    if (!result.ok || result.duplicate) return;

    await this.db.query(
      `INSERT INTO referral_duo_bonuses
         (referrer_id, referee_id, month_year, referrer_amount, referee_amount)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (referrer_id, referee_id, month_year) DO UPDATE
         SET referrer_amount = referral_duo_bonuses.referrer_amount + EXCLUDED.referrer_amount,
             referee_amount = referral_duo_bonuses.referee_amount + EXCLUDED.referee_amount`,
      [
        side === 'referrer' ? userId : otherId,
        side === 'referee' ? userId : otherId,
        monthYear,
        side === 'referrer' ? amount : 0,
        side === 'referee' ? amount : 0,
      ],
    );
  }

  // ============================================================
  // Helper: give chips (signup bonus etc.)
  // ============================================================
  private async giveChips(userId: number, amount: number, reason: string): Promise<void> {
    await this.db.query(
      `INSERT INTO free_chips (user_id, chips) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET chips = free_chips.chips + $2`,
      [userId, amount],
    );
    await this.db.query(
      `INSERT INTO play_money_log (user_id, delta, reason, balance_after)
       VALUES ($1, $2, $3, (SELECT chips FROM free_chips WHERE user_id = $1))`,
      [userId, amount, reason],
    );
  }
}

// Backwards-compatible named export (was used by index.ts)
export async function attributeReferral(
  db: Pool,
  newUserId: number,
  code: string,
): Promise<{ ok: boolean; referrerId?: number; error?: string }> {
  const svc = new ReferralService(db);
  return svc.attributeReferral(newUserId, code);
}
