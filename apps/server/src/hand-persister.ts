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
  sidePots: any[]; // 🔴 NEW
  playerStacks: Array<{ seat: number; userId: number; stack: number }>;
}

export class HandPersister {
  private ledger: LedgerService;

  constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
  }

  async startHand(input: HandStartInput): Promise<number | null> {
    try {
      const res = await this.db.query(
        `INSERT INTO hands 
         (table_id, hand_no, variant, mode, small_blind, big_blind, ante, 
          dealer_seat, server_seed_hash, player_count, started_at, finished)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), FALSE)
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
        ],
      );
      const handId = res.rows[0].id;

      // 🔴 Save snapshot at sequence 0
      this.saveSnapshot(handId, 0, {
        handNo: input.handNo,
        variant: input.variant,
        mode: input.mode,
        dealerSeat: input.dealerSeat,
        blinds: { sb: input.smallBlind, bb: input.bigBlind, ante: input.ante },
        players: input.players,
        phase: 'preflop',
      });

      for (const p of input.players) {
        await this.db.query(
          `INSERT INTO table_seats (table_id, seat_index, user_id, stack, status, updated_at)
           VALUES ($1, $2, $3, $4, 'OCCUPIED', NOW())
           ON CONFLICT (table_id, seat_index) 
           DO UPDATE SET user_id = $3, stack = $4, status = 'OCCUPIED', updated_at = NOW()`,
          [input.tableId, p.seat, p.userId, p.stack],
        );
      }

      return handId;
    } catch (e: any) {
      console.error('[hand-persister] startHand failed:', e.message);
      return null;
    }
  }

  recordEvent(handId: number | null, sequence: number, eventType: string, payload: any): void {
    if (!handId) return;
    this.db
      .query(
        `INSERT INTO hand_events (hand_id, sequence, event_type, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (hand_id, sequence) DO NOTHING`,
        [handId, sequence, eventType, JSON.stringify(payload || {})],
      )
      .catch((e: any) => console.error('[hand-persister] recordEvent failed:', e.message));
  }

  saveSnapshot(handId: number | null, sequence: number, state: any): void {
    if (!handId) return;
    this.db
      .query(
        `INSERT INTO hand_snapshots (hand_id, sequence, state)
       VALUES ($1, $2, $3)
       ON CONFLICT (hand_id, sequence) DO NOTHING`,
        [handId, sequence, JSON.stringify(state)],
      )
      .catch((e: any) => console.error('[hand-persister] saveSnapshot failed:', e.message));
  }

  async finishHand(
    tableId: number,
    handId: number | null,
    input: HandResultInput,
    mode: 'free' | 'real',
  ): Promise<void> {
    try {
      if (handId) {
        await this.db.query(
          `UPDATE hands 
           SET pot = $1, rake = $2, result = $3, community_cards = $4,
               winner_seats = $5, finished = TRUE, ended_at = NOW()
           WHERE id = $6`,
          [
            input.pot,
            input.rake,
            JSON.stringify({
              winners: input.winners,
              showdownPlayers: input.showdownPlayers,
              sidePots: input.sidePots || [], // 🔴 NEW
            }),
            JSON.stringify(input.communityCards || []),
            JSON.stringify(input.winners),
            handId,
          ],
        );
      }

      if (mode === 'free') {
        await this.persistFreeChips(input.playerStacks);
      } else {
        await this.persistRealMoney(input.playerStacks);
      }

      if (mode === 'real' && input.rake > 0) {
        await this.recordRake(input.rake, handId);
      }
    } catch (e: any) {
      console.error('[hand-persister] finishHand failed:', e.message);
    }
  }

    private async persistFreeChips(
    stacks: Array<{ seat: number; userId: number; stack: number }>,
  ): Promise<void> {
    for (const s of stacks) {
      try {
        const old = await this.db.query('SELECT chips FROM free_chips WHERE user_id = $1', [
          s.userId,
        ]);
        const oldBalance = Number(old.rows[0]?.chips ?? 0);
        const newBalance = Math.round(s.stack);
        const delta = newBalance - oldBalance;

        if (delta !== 0) {
          if (delta > 0) {
            await this.db.query(
              `UPDATE free_chips
               SET chips = $1,
                   total_hands = total_hands + 1,
                   free_won = free_won + $2,
                   free_hands_won = free_hands_won + 1
               WHERE user_id = $3`,
              [newBalance, delta, s.userId],
            );
          } else {
            await this.db.query(
              `UPDATE free_chips
               SET chips = $1,
                   total_hands = total_hands + 1
               WHERE user_id = $2`,
              [newBalance, s.userId],
            );
          }
          await this.db.query(
            `INSERT INTO play_money_log (user_id, delta, reason, balance_after)
             VALUES ($1, $2, $3, $4)`,
            [s.userId, delta, 'hand_result', newBalance],
          );
        } else {
          await this.db.query(
            'UPDATE free_chips SET total_hands = total_hands + 1 WHERE user_id = $1',
            [s.userId],
          );
        }
      } catch (e: any) {
        console.error(
          `[hand-persister] persistFreeChips user ${s.userId} failed:`,
          e.message,
        );
      }
    }
  }

    private async persistRealMoney(
    stacks: Array<{ seat: number; userId: number; stack: number }>,
  ): Promise<void> {
    for (const s of stacks) {
      try {
        await this.db.query(
          `UPDATE wallets SET balance_usd = $1, updated_at = NOW() WHERE user_id = $2`,
          [s.stack, s.userId],
        );
        // Decrement bonus pending counters
        await this.db.query(
          `UPDATE users
           SET bonus_real_hands_pending = GREATEST(0, bonus_real_hands_pending - 1)
           WHERE id = $1`,
          [s.userId],
        );
      } catch (e: any) {
        console.error(`[hand-persister] persistRealMoney user ${s.userId} failed:`, e.message);
      }
    }
  }

  private async recordRake(rake: number, handId: number | null): Promise<void> {
    const rakeAcc = await this.ledger.getAccountId('HOUSE_RAKE');
    const escrowAcc = await this.ledger.getAccountId('SYSTEM_ESCROW');
    if (!rakeAcc || !escrowAcc) {
      console.error('[hand-persister] rake accounts not found');
      return;
    }

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

  /**
   * 🔴 Replay: خواندن snapshot نزدیک‌ترین به sequence مشخص + event های بعدش
   */
  async getHandStateAt(handId: number, targetSequence: number): Promise<any | null> {
    try {
      // 1. نزدیک‌ترین snapshot قبل از target
      const snap = await this.db.query(
        `SELECT sequence, state FROM hand_snapshots
         WHERE hand_id = $1 AND sequence <= $2
         ORDER BY sequence DESC LIMIT 1`,
        [handId, targetSequence],
      );

      if (snap.rows.length === 0) {
        return null;
      }

      let state = snap.rows[0].state;
      const startSeq = snap.rows[0].sequence;

      // 2. Event های بعد از snapshot تا target
      const events = await this.db.query(
        `SELECT sequence, event_type, payload FROM hand_events
         WHERE hand_id = $1 AND sequence > $2 AND sequence <= $3
         ORDER BY sequence ASC`,
        [handId, startSeq, targetSequence],
      );

      return {
        snapshot: state,
        snapshotSequence: startSeq,
        events: events.rows,
        targetSequence,
      };
    } catch (e: any) {
      console.error('[hand-persister] getHandStateAt failed:', e.message);
      return null;
    }
  }

  /**
   * 🔴 گرفتن event های جدیدتر از یه sequence (برای reconnect)
   */
  async getEventsSince(handId: number, sinceSequence: number): Promise<any[]> {
    try {
      const res = await this.db.query(
        `SELECT sequence, event_type, payload, created_at 
         FROM hand_events
         WHERE hand_id = $1 AND sequence > $2
         ORDER BY sequence ASC
         LIMIT 500`,
        [handId, sinceSequence],
      );
      return res.rows;
    } catch (e: any) {
      console.error('[hand-persister] getEventsSince failed:', e.message);
      return [];
    }
  }
}
