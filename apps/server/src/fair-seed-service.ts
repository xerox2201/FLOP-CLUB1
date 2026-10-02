/**
 * Provably Fair — commit / reveal persistence.
 *
 * hand_seeds is the source of truth. `hands.server_seed` is only mirrored at
 * reveal time so existing hand queries keep working.
 *
 * Both operations are called fire-and-forget from game-manager: a failure here
 * must never break a hand, so every method swallows nothing but returns a
 * boolean and callers attach a .catch().
 */

import { Pool } from 'pg';
import { DECK_V1_ALGORITHM, deckFromSeedV1, deckHashV1 } from './fair/deck-v1.js';

/**
 * Part B keeps the nonce fixed: deck-v1 does not mix the nonce in yet, so
 * hand-level and table-level nonces produce the same deck today.
 * TODO(part-c): nonce should be table-level hand counter
 */
export const FAIR_NONCE_PART_B = 1;

export interface FairCommitInput {
  handId: number;
  tableId?: number | null;
  handNo?: number | null;
  serverSeedHash: string;
  clientSeed: string;
  algorithm?: string;
}

export interface FairRevealInput {
  handId: number;
  serverSeed: string;
  serverSeedHash?: string | null;
  clientSeed?: string | null;
  algorithm?: string;
}

export interface FairSeedRecord {
  hand_id: number;
  table_id: number | null;
  hand_no: number | null;
  algorithm: string;
  server_seed_hash: string;
  server_seed: string | null;
  client_seed: string;
  nonce: number;
  deck_hash: string | null;
  committed_at: Date;
  revealed_at: Date | null;
}

export class FairSeedService {
  constructor(private db: Pool) {}

  /** Publish the commitment for a hand before any card is dealt. */
  async commit(input: FairCommitInput): Promise<boolean> {
    const algorithm = input.algorithm ?? DECK_V1_ALGORITHM;
    const res = await this.db.query(
      `INSERT INTO hand_seeds
         (hand_id, table_id, hand_no, algorithm, server_seed_hash, client_seed, nonce)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (hand_id) DO NOTHING`,
      [
        input.handId,
        input.tableId ?? null,
        input.handNo ?? null,
        algorithm,
        input.serverSeedHash,
        input.clientSeed,
        FAIR_NONCE_PART_B,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  /** Reveal the seed once the hand is over and mirror it onto the hands row. */
  async reveal(input: FairRevealInput): Promise<boolean> {
    const algorithm = input.algorithm ?? DECK_V1_ALGORITHM;
    const deckHash = deckHashV1(deckFromSeedV1(input.serverSeed));

    const canInsert = !!input.serverSeedHash && !!input.clientSeed;
    let rowCount = 0;

    if (canInsert) {
      const res = await this.db.query(
        `INSERT INTO hand_seeds
           (hand_id, algorithm, server_seed_hash, client_seed, nonce,
            server_seed, deck_hash, revealed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (hand_id) DO UPDATE
           SET server_seed = EXCLUDED.server_seed,
               deck_hash   = EXCLUDED.deck_hash,
               revealed_at = NOW()`,
        [
          input.handId,
          algorithm,
          input.serverSeedHash,
          input.clientSeed,
          FAIR_NONCE_PART_B,
          input.serverSeed,
          deckHash,
        ],
      );
      rowCount = res.rowCount ?? 0;
    } else {
      // The commit row is missing its commitment fields: only the reveal can
      // be written, never a new commitment.
      const res = await this.db.query(
        `UPDATE hand_seeds
            SET server_seed = $1, deck_hash = $2, revealed_at = NOW()
          WHERE hand_id = $3`,
        [input.serverSeed, deckHash, input.handId],
      );
      rowCount = res.rowCount ?? 0;
    }

    // Mirror only — hand_seeds stays the source of truth.
    await this.db.query(`UPDATE hands SET server_seed = $1 WHERE id = $2`, [
      input.serverSeed,
      input.handId,
    ]);

    return rowCount > 0;
  }

  async getByHandId(handId: number): Promise<FairSeedRecord | null> {
    const res = await this.db.query(`SELECT * FROM hand_seeds WHERE hand_id = $1`, [handId]);
    return res.rows[0] ?? null;
  }

  async getByCommitment(serverSeedHash: string): Promise<FairSeedRecord | null> {
    const res = await this.db.query(`SELECT * FROM hand_seeds WHERE server_seed_hash = $1`, [
      serverSeedHash,
    ]);
    return res.rows[0] ?? null;
  }
}
