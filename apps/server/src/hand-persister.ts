 import { Pool } from 'pg';
import { LedgerService } from './ledger.js';

export interface HandStartInput {
  tableId: number;
  handNo: number;
  variant: string;
  mode: 'free' | 'real';
  smallBlind: number;
  bigBlind: number;
  ante: number;
  dealerSeat: number;
  players: Array<{
    userId: number;
    displayName: string;
    stack: number;
    seat: number;
  }>;
}

export interface HandResultInput {
  handId: number;
  pot: number;
  rake: number;
  winners: number[];
  communityCards: any[];
  showdownPlayers: any[];
  playerStacks: Array<{ seat: number; userId: number; stack: number }>;
}

export class HandPersister {
  private ledger: LedgerService;

  constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
  }

  /**
   * شروع یه دست جدید — INSERT توی hands و table_seats
   */
  async startHand(input: HandStartInput): Promise<number | null> {
    try {
      const res = await this.db.query(
        `INSERT INTO hands 
         (table_id, hand_no, variant, mode, small_blind, big_blind, ante, 
          dealer_seat, server_seed_hash, player_count, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id`,
        [
          input.tableId,
          input.handNo,
          input.variant,
          input.mode,
          input.smallBlind,
          input.bigBlind,
          input.ante,
          input.dealerSeat,
          'pending',
          input.players.length,
        ]
      );
      const handId = res.rows[0].id;

      // UPSERT table_seats برای هر بازیکن
      for (const p of input.players) {
        await this.db.query(
          `INSERT INTO table_seats (table_id, seat_index, user_id, stack, status, updated_at)
           VALUES ($1, $2, $3, $4, 'OCCUPIED', NOW())
           ON CONFLICT (table_id, seat_index) 
           DO UPDATE SET user_id = $3, stack = $4, status = 'OCCUPIED', updated_at = NOW()`,
          [input.tableId, p.seat, p.userId, p.stack]
        );
      }

      return handId;
    } catch (e: any) {
      console.error('[hand-persister] startHand failed:', e.message);
      return null;
    }
  }

  /**
   * ثبت یه event — fire and forget
   */
  recordEvent(handId: number | null, sequence: number, eventType: string, payload: any): void {
    if (!handId) return;
    this.db.query(
      `INSERT INTO hand_events (hand_id, sequence, event_type, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (hand_id, sequence) DO NOTHING`,
      [handId, sequence, eventType, JSON.stringify(payload || {})]
    ).catch(e => console.error('[hand-persister] recordEvent failed:', e.message));
  }

  /**
   * Snapshot هر ۱۰ event — fire and forget
   */
  saveSnapshot(handId: number | null, sequence: number, state: any): void {
    if (!handId) return;
    this.db.query(
      `INSERT INTO hand_snapshots (hand_id, sequence, state)
       VALUES ($1, $2, $3)
       ON CONFLICT (hand_id, sequence) DO NOTHING`,
      [handId, sequence, JSON.stringify(state)]
    ).catch(e => console.error('[hand-persister] saveSnapshot failed:', e.message));
  }

  /**
   * پایان دست — UPDATE hands + persist stacks + rake
   */
  async finishHand(
    tableId: number,
    handId: number | null,
    input: HandResultInput,
    mode: 'free' | 'real'
  ): Promise<void> {
    try {
      // 1. UPDATE hands با نتیجه
      if (handId) {
        await this.db.query(
          `UPDATE hands 
           SET pot = $1, rake = $2, result = $3, community_cards = $4,
               winner_seats = $5, finished = TRUE, ended_at = NOW()
           WHERE id = $6`,
          [
            input.pot,
            input.rake,
            JSON.stringify({ winners: input.winners, showdownPlayers: input.showdownPlayers }),
            JSON.stringify(input.communityCards || []),
            JSON.stringify(input.winners),
            handId,
          ]
        );
      }

      // 2. Persist stacks
      if (mode === 'free') {
        await this.persistFreeChips(input.playerStacks);
      } else {
        await this.persistRealMoney(input.playerStacks);
      }

      // 3. Record rake به ledger (فقط real money)
      if (mode === 'real' && input.rake > 0) {
        await this.recordRake(input.rake, handId);
      }
    } catch (e: any) {
      console.error('[hand-persister] finishHand failed:', e.message);
    }
  }

  /**
   * Play money: update free_chips + log
   */
  private async persistFreeChips(
    stacks: Array<{ seat: number; userId: number; stack: number }>
  ): Promise<void> {
    for (const s of stacks) {
      // خواندن balance قبلی
      const old = await this.db.query(
        'SELECT chips FROM free_chips WHERE user_id = $1',
        [s.userId]
      );
      const oldBalance = Number(old.rows[0]?.chips ?? 0);
      const newBalance = Math.round(s.stack);
      const delta = newBalance - oldBalance;

      if (delta !== 0) {
        await this.db.query(
          'UPDATE free_chips SET chips = $1, total_hands = total_hands + 1 WHERE user_id = $2',
          [newBalance, s.userId]
        );
        await this.db.query(
          `INSERT INTO play_money_log (user_id, delta, reason, balance_after)
           VALUES ($1, $2, $3, $4)`,
          [s.userId, delta, 'hand_result', newBalance]
        );
      } else {
        await this.db.query(
          'UPDATE free_chips SET total_hands = total_hands + 1 WHERE user_id = $1',
          [s.userId]
        );
      }
    }
  }

  /**
   * Real money: update wallets
   */
  private async persistRealMoney(
    stacks: Array<{ seat: number; userId: number; stack: number }>
  ): Promise<void> {
    for (const s of stacks) {
      await this.db.query(
        `UPDATE wallets SET balance_usd = $1, updated_at = NOW() WHERE user_id = $2`,
        [s.stack, s.userId]
      );
    }
  }

  /**
   * ثبت rake به ledger
   */
  private async recordRake(rake: number, handId: number | null): Promise<void> {
    const rakeAcc = await this.ledger.getAccountId('HOUSE_RAKE');
    const escrowAcc = await this.ledger.getAccountId('SYSTEM_ESCROW');
    if (!rakeAcc || !escrowAcc) return;

    await this.ledger.record({
      kind: 'RAKE',
      ref: `hand_${handId}`,
      meta: { handId },
      entries: [
        { accountId: escrowAcc, amount: -rake },
        { accountId: rakeAcc, amount: +rake },
      ],
      idempotencyKey: `rake_hand_${handId}`,
    });
  }
}