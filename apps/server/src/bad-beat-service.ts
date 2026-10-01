// ============================================================
// BadBeatService - Bad Beat Jackpot: pool funding, trigger detection, payouts
// Funded by 2% of rake per hand (= $2 per $100 rake).
// All money movement goes through LedgerService (HOUSE_RAKE <-> HOUSE_BAD_BEAT).
// ============================================================

import { Pool } from 'pg';
import { LedgerService } from './ledger.js';

// Contribution is 2% of RAKE. It is deliberately not 0.5% of pot:
// rake is 3% of pot by default, so 0.5% of pot equals 16.67% of rake
// ($16.67 per $100 rake), which is 8x over the $2 per $100 rake budget.
export const BAD_BEAT_RAKE_PCT = 0.02;

export type BadBeatTier = 'quad_plus' | 'straight_flush';

// Hand names produced by packages/poker-engine/src/hand-evaluator.ts
const STRAIGHT_FLUSH_NAMES = ['Straight Flush', 'Royal Flush'];
const QUAD_NAMES = ['Four of a Kind'];

// Payout split, as fractions of the pool at trigger time:
//   quad_plus      : 50% to the loser, then the remaining 50% split 50/25/25
//                    (loser / winner / table) -> 75.00% / 12.50% / 12.50%
//   straight_flush : 100% to the loser
// Each tier sums to exactly 1.00 of the pool, so a payout can never exceed it.
export const BAD_BEAT_SPLITS: Record<
  BadBeatTier,
  { loser: number; winner: number; table: number }
> = {
  quad_plus: { loser: 0.75, winner: 0.125, table: 0.125 },
  straight_flush: { loser: 1.0, winner: 0, table: 0 },
};

const HOUSE_RAKE = 'HOUSE_RAKE';
const HOUSE_BAD_BEAT = 'HOUSE_BAD_BEAT';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BadBeatTrigger {
  triggered: true;
  tier: BadBeatTier;
  amount: number;
  loserUserId: number;
  winnerUserId: number | null;
  handName: string;
}

export interface BadBeatPayout {
  userId: number;
  role: 'loser' | 'winner' | 'table';
  amount: number;
}

export interface BadBeatPayoutResult {
  ok: boolean;
  duplicate?: boolean;
  tier?: BadBeatTier;
  paid?: number;
  payouts?: BadBeatPayout[];
  error?: string;
}

export class BadBeatService {
  private ledger: LedgerService;

  constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
  }

  // ============================================================
  // Pool reads
  // ============================================================
  async getPoolAmount(): Promise<number> {
    const r = await this.db.query('SELECT amount_usd FROM bad_beat_pool WHERE id = 1');
    return Number(r.rows[0]?.amount_usd ?? 0);
  }

  async getPool(): Promise<{ id: number; amount_usd: number; updated_at: string | null }> {
    const r = await this.db.query(
      'SELECT id, amount_usd, updated_at FROM bad_beat_pool WHERE id = 1',
    );
    const row = r.rows[0];
    return {
      id: Number(row?.id ?? 1),
      amount_usd: Number(row?.amount_usd ?? 0),
      updated_at: row?.updated_at ?? null,
    };
  }

  async getStats(): Promise<{
    pool: number;
    totalPaid: number;
    lastPayout: any | null;
    updatedAt: string | null;
  }> {
    const pool = await this.getPool();
    const tot = await this.db.query(
      'SELECT COALESCE(SUM(amount_usd), 0)::numeric AS v FROM bad_beat_payouts',
    );
    const recent = await this.getRecentPayouts(1);
    return {
      pool: pool.amount_usd,
      totalPaid: Number(tot.rows[0]?.v ?? 0),
      lastPayout: recent[0] ?? null,
      updatedAt: pool.updated_at,
    };
  }

  async getRecentPayouts(limit = 10): Promise<any[]> {
    const r = await this.db.query(
      `SELECT bp.id, bp.hand_id, bp.user_id, bp.tier, bp.amount_usd, bp.created_at,
              u.display_name
       FROM bad_beat_payouts bp
       LEFT JOIN users u ON u.id = bp.user_id
       ORDER BY bp.created_at DESC, bp.id DESC
       LIMIT $1`,
      [limit],
    );
    return r.rows.map((row: any) => ({
      id: Number(row.id),
      handId: Number(row.hand_id),
      userId: Number(row.user_id),
      displayName: row.display_name ?? 'Player',
      tier: row.tier,
      amountUsd: Number(row.amount_usd),
      createdAt: row.created_at,
    }));
  }

  // ============================================================
  // recordPotContribution - 2% of the hand's rake funds the pool
  // ============================================================
  async recordPotContribution(rake: number, handId?: number): Promise<number> {
    const amount = round2(Math.max(0, Number(rake) || 0) * BAD_BEAT_RAKE_PCT);
    if (amount <= 0) return 0;

    const rakeAcc = await this.ledger.getAccountId(HOUSE_RAKE);
    const poolAcc = await this.ledger.getAccountId(HOUSE_BAD_BEAT);
    if (!rakeAcc || !poolAcc) {
      console.error('[bad-beat] missing HOUSE_RAKE or HOUSE_BAD_BEAT account');
      return 0;
    }

    const res = await this.ledger.record({
      kind: 'BONUS',
      ref: handId ? `bad_beat_pool_hand_${handId}` : 'bad_beat_pool',
      meta: { handId, rake, pct: BAD_BEAT_RAKE_PCT, amount },
      entries: [
        { accountId: rakeAcc, amount: -amount },
        { accountId: poolAcc, amount: amount },
      ],
      idempotencyKey: handId ? `bad_beat_pool_hand_${handId}` : undefined,
    });

    if (!res.ok) {
      console.error('[bad-beat] contribution ledger failed:', res.error);
      return 0;
    }
    // Already funded for this hand - do not grow the pool twice.
    if (res.duplicate) return 0;

    await this.db.query(
      'UPDATE bad_beat_pool SET amount_usd = amount_usd + $1, updated_at = NOW() WHERE id = 1',
      [amount],
    );
    return amount;
  }

  // ============================================================
  // checkTrigger - did a qualifying bad beat happen?
  // Returns null when nothing qualifies.
  // ============================================================
  async checkTrigger(
    handResult: { showdownPlayers?: any[]; winners?: number[] },
    seatToUserId: Record<number, number>,
  ): Promise<BadBeatTrigger | null> {
    const players = handResult?.showdownPlayers ?? [];
    if (players.length === 0) return null;

    const losers = players.filter((p) => !p.isWinner);
    if (losers.length === 0) return null;

    // A straight flush is stronger than quads, so it is checked first.
    const sfLoser = losers.find((p) => STRAIGHT_FLUSH_NAMES.includes(String(p.handName)));
    const quadLoser = losers.find((p) => QUAD_NAMES.includes(String(p.handName)));
    const loser = sfLoser ?? quadLoser;
    if (!loser) return null;

    const tier: BadBeatTier = sfLoser ? 'straight_flush' : 'quad_plus';
    const loserUserId = Number(seatToUserId[Number(loser.seat)] ?? 0);
    if (!loserUserId) return null;

    const winnerSeat = Number(handResult.winners?.[0]);
    const winnerUserId = Number.isFinite(winnerSeat)
      ? Number(seatToUserId[winnerSeat] ?? 0) || null
      : null;

    return {
      triggered: true,
      tier,
      amount: await this.getPoolAmount(),
      loserUserId,
      winnerUserId,
      handName: String(loser.handName),
    };
  }

  // ============================================================
  // payoutBadBeat - distribute the pool. Idempotent per hand.
  // ============================================================
  async payoutBadBeat(params: {
    handId: number;
    tier: BadBeatTier;
    loserUserId: number;
    winnerUserId?: number | null;
    tableUserIds?: number[];
    pool?: number;
  }): Promise<BadBeatPayoutResult> {
    const { handId, tier, loserUserId } = params;
    if (!handId) return { ok: false, error: 'missing_hand_id' };
    if (!loserUserId) return { ok: false, error: 'missing_loser' };

    const already = await this.db.query(
      'SELECT 1 FROM bad_beat_payouts WHERE hand_id = $1 LIMIT 1',
      [handId],
    );
    if (already.rows.length > 0) return { ok: true, duplicate: true };

    const pool = round2(params.pool ?? (await this.getPoolAmount()));
    if (pool <= 0) return { ok: false, error: 'pool_empty' };

    const split = BAD_BEAT_SPLITS[tier];
    const winnerId = Number(params.winnerUserId ?? 0) || null;
    const tableIds = [...new Set((params.tableUserIds ?? []).map(Number))].filter(
      (id) => id && id !== loserUserId && id !== winnerId,
    );

    const poolAcc = await this.ledger.getAccountId(HOUSE_BAD_BEAT);
    const loserAcc = await this.ledger.ensureUserAccount(loserUserId);
    if (!poolAcc || !loserAcc) return { ok: false, error: 'missing_account' };

    const plan: BadBeatPayout & { accountId: number } = {
      userId: loserUserId,
      role: 'loser',
      amount: round2(pool * split.loser),
      accountId: loserAcc,
    };
    const rows: (BadBeatPayout & { accountId: number })[] = [plan];

    if (winnerId && split.winner > 0) {
      const acc = await this.ledger.ensureUserAccount(winnerId);
      if (acc) {
        rows.push({
          userId: winnerId,
          role: 'winner',
          amount: round2(pool * split.winner),
          accountId: acc,
        });
      }
    }

    if (tableIds.length > 0 && split.table > 0) {
      const totalTable = round2(pool * split.table);
      const each = Math.floor((totalTable / tableIds.length) * 100) / 100;
      for (const id of tableIds) {
        const acc = await this.ledger.ensureUserAccount(id);
        if (acc) {
          rows.push({ userId: id, role: 'table', amount: each, accountId: acc });
        }
      }
    }

    const payRows = rows.filter((p) => p.amount > 0);
    if (payRows.length === 0) return { ok: false, error: 'nothing_to_pay' };

    const paid = round2(payRows.reduce((s, p) => s + p.amount, 0));

    const res = await this.ledger.record({
      kind: 'BONUS',
      ref: `bad_beat_hand_${handId}`,
      meta: { handId, tier, pool, paid },
      userId: loserUserId,
      entries: [
        { accountId: poolAcc, amount: -paid },
        ...payRows.map((p) => ({ accountId: p.accountId, amount: p.amount })),
      ],
      idempotencyKey: `bad_beat_hand_${handId}`,
    });
    if (!res.ok) return { ok: false, error: res.error };
    if (res.duplicate) return { ok: true, duplicate: true };

    for (const p of payRows) {
      await this.db.query(
        `INSERT INTO bad_beat_payouts (hand_id, user_id, tier, amount_usd)
         VALUES ($1, $2, $3, $4)`,
        [handId, p.userId, tier, p.amount],
      );
    }

    await this.db.query(
      `UPDATE bad_beat_pool
       SET amount_usd = GREATEST(0, amount_usd - $1), updated_at = NOW()
       WHERE id = 1`,
      [paid],
    );

    return {
      ok: true,
      tier,
      paid,
      payouts: payRows.map(({ userId, role, amount }) => ({ userId, role, amount })),
    };
  }
}
