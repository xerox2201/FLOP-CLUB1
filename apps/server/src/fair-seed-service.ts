/**
 * Provably Fair — commit / reveal persistence + the table-level hand counter.
 *
 * hand_seeds is the source of truth. `hands.server_seed` is only mirrored at
 * reveal time so existing hand queries keep working.
 *
 * commit/reveal are called fire-and-forget from game-manager: a failure here
 * must never break a hand, so callers always attach a .catch().
 */

import { Pool } from 'pg';
import {
  DECK_V1_ALGORITHM,
  deckFromSeedV1,
  deckHashV1,
} from '../../../packages/shared/src/fair/deck-v1.js';
import { DECK_V2_ALGORITHM, deckHashV2 } from '../../../packages/shared/src/fair/deck-v2.js';

export interface FairSeedInput {
  userId: number;
  seed: string;
  seedHash: string;
}

export interface FairCommitInput {
  handId: number;
  tableId?: number | null;
  handNo?: number | null;
  algorithm: string;
  serverSeedHash: string;
  clientSeed: string;
  clientSeedHash?: string | null;
  clientSeedSource?: 'player' | 'server' | null;
  clientSeedInputs?: FairSeedInput[] | null;
  /** Table-level hand counter. */
  nonce: number;
}

export interface FairRevealInput {
  handId: number;
  serverSeed: string;
}

export interface FairSeedRecord {
  hand_id: number;
  table_id: number | null;
  hand_no: number | null;
  algorithm: string;
  server_seed_hash: string;
  server_seed: string | null;
  client_seed: string;
  client_seed_hash: string | null;
  client_seed_source: 'player' | 'server' | null;
  client_seed_inputs: FairSeedInput[] | null;
  nonce: number;
  deck_hash: string | null;
  committed_at: Date;
  revealed_at: Date | null;
}

export class FairSeedService {
  constructor(private db: Pool) {}

  /**
   * Atomically reserve the next hand number for a table.
   *
   * Returns null when the table row does not exist (e.g. virtual tournament
   * tables) or on a database error, so the caller can fall back.
   */
  async reserveTableHandNo(tableId: number): Promise<number | null> {
    const res = await this.db.query(
      `UPDATE poker_tables SET hand_sequence = hand_sequence + 1
       WHERE id = $1 RETURNING hand_sequence`,
      [tableId],
    );
    return res.rows[0] ? Number(res.rows[0].hand_sequence) : null;
  }

  /** Publish the commitment for a hand before any card is dealt. */
  async commit(input: FairCommitInput): Promise<boolean> {
    const res = await this.db.query(
      `INSERT INTO hand_seeds
         (hand_id, table_id, hand_no, algorithm, server_seed_hash, client_seed,
          client_seed_hash, client_seed_source, client_seed_inputs, nonce)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (hand_id) DO NOTHING`,
      [
        input.handId,
        input.tableId ?? null,
        input.handNo ?? null,
        input.algorithm,
        input.serverSeedHash,
        input.clientSeed,
        input.clientSeedHash ?? null,
        input.clientSeedSource ?? null,
        input.clientSeedInputs ? JSON.stringify(input.clientSeedInputs) : null,
        input.nonce,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Reveal the seed once the hand is over, store the deck hash and mirror the
   * seed onto the hands row. The committed row drives the derivation, so a
   * missing commitment means nothing is revealed.
   */
  async reveal(input: FairRevealInput): Promise<boolean> {
    const row = await this.getByHandId(input.handId);
    if (!row) return false;

    const algorithm = row.algorithm ?? DECK_V1_ALGORITHM;
    let deckHash: string | null = null;

    if (algorithm === DECK_V2_ALGORITHM) {
      if (row.client_seed && row.nonce !== null && row.nonce !== undefined) {
        deckHash = await deckHashV2(input.serverSeed, row.client_seed, Number(row.nonce));
      } else {
        console.error(`[fair] reveal ${input.handId}: deck-v2 without client seed/nonce`);
      }
    } else {
      deckHash = deckHashV1(deckFromSeedV1(input.serverSeed));
    }

    const res = await this.db.query(
      `UPDATE hand_seeds
          SET server_seed = $1, deck_hash = $2, revealed_at = NOW()
        WHERE hand_id = $3`,
      [input.serverSeed, deckHash, input.handId],
    );

    // Mirror only — hand_seeds stays the source of truth.
    await this.db.query(`UPDATE hands SET server_seed = $1 WHERE id = $2`, [
      input.serverSeed,
      input.handId,
    ]);

    return (res.rowCount ?? 0) > 0;
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
