/**
 * Player-controlled client seeds (Part C) — persistence + policy.
 *
 * A player sets one seed per table. The seed applies from the next hand on;
 * changing it more than once per cooldown is rejected, and no change is
 * accepted while a hand at that table is being played (the caller checks the
 * table phase, see fair-routes.ts).
 *
 * The seeds of the seated players are combined deterministically for each hand
 * (see packages/shared/src/fair/client-seed.ts) so a single player never
 * controls the deck alone.
 */

import { Pool } from 'pg';
import {
  clientSeedHash,
  combineClientSeeds,
  validateClientSeed,
  type ClientSeedInput,
} from '../../../packages/shared/src/fair/client-seed.js';

export const CLIENT_SEED_CHANGE_COOLDOWN_MS = 5 * 60 * 1000;

export interface HandClientSeed {
  /** Combined seed, or null when no seated player supplied one. */
  clientSeed: string | null;
  source: 'player' | 'server';
  /** Audit trail stored on the hand. */
  inputs: Array<{ userId: number; seed: string; seedHash: string }>;
}

export interface ClientSeedRecord {
  tableId: number;
  userId: number;
  seed: string;
  seedHash: string;
  updatedAt: Date;
}

export type SetClientSeedResult =
  | { ok: true; seedHash: string }
  | { ok: false; code: 'invalid_seed' | 'cooldown'; error: string; retryAfterMs?: number };

function toRecord(row: any): ClientSeedRecord {
  return {
    tableId: Number(row.table_id),
    userId: Number(row.user_id),
    seed: String(row.seed),
    seedHash: String(row.seed_hash),
    updatedAt: row.updated_at,
  };
}

export class FairClientSeedService {
  constructor(private db: Pool) {}

  async get(tableId: number, userId: number): Promise<ClientSeedRecord | null> {
    const res = await this.db.query(
      `SELECT table_id, user_id, seed, seed_hash, updated_at
       FROM table_client_seeds WHERE table_id = $1 AND user_id = $2`,
      [tableId, userId],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async getLastChangeAt(tableId: number, userId: number): Promise<Date | null> {
    const res = await this.db.query(
      `SELECT changed_at FROM client_seed_changes
       WHERE table_id = $1 AND user_id = $2
       ORDER BY changed_at DESC LIMIT 1`,
      [tableId, userId],
    );
    return res.rows[0]?.changed_at ?? null;
  }

  /** Store a player seed (audited + rate limited). */
  async set(tableId: number, userId: number, rawSeed: unknown): Promise<SetClientSeedResult> {
    const validation = validateClientSeed(rawSeed);
    if (!validation.ok) {
      return { ok: false, code: 'invalid_seed', error: validation.error };
    }

    const lastChangeAt = await this.getLastChangeAt(tableId, userId);
    if (lastChangeAt) {
      const elapsed = Date.now() - new Date(lastChangeAt).getTime();
      const remaining = CLIENT_SEED_CHANGE_COOLDOWN_MS - elapsed;
      if (remaining > 0) {
        return {
          ok: false,
          code: 'cooldown',
          error: 'seed_change_cooldown',
          retryAfterMs: remaining,
        };
      }
    }

    const seed = validation.seed;
    const seedHash = await clientSeedHash(seed);
    const previous = await this.get(tableId, userId);

    await this.db.query(
      `INSERT INTO table_client_seeds (table_id, user_id, seed, seed_hash, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (table_id, user_id)
       DO UPDATE SET seed = EXCLUDED.seed, seed_hash = EXCLUDED.seed_hash, updated_at = NOW()`,
      [tableId, userId, seed, seedHash],
    );

    await this.db.query(
      `INSERT INTO client_seed_changes (table_id, user_id, old_hash, new_hash)
       VALUES ($1, $2, $3, $4)`,
      [tableId, userId, previous?.seedHash ?? null, seedHash],
    );

    return { ok: true, seedHash };
  }

  /**
   * The hand's client seed: the deterministic combination of the seeds of the
   * given players, or null when none of them supplied one.
   */
  async getHandClientSeed(tableId: number, userIds: number[]): Promise<HandClientSeed> {
    const ids = [
      ...new Set(userIds.map((u) => Number(u)).filter((u) => Number.isFinite(u) && u > 0)),
    ];
    if (ids.length === 0) return { clientSeed: null, source: 'server', inputs: [] };

    const res = await this.db.query(
      `SELECT user_id, seed, seed_hash FROM table_client_seeds
       WHERE table_id = $1 AND user_id = ANY($2::bigint[])
       ORDER BY user_id`,
      [tableId, ids],
    );

    const inputs = res.rows.map((r: any) => ({
      userId: Number(r.user_id),
      seed: String(r.seed),
      seedHash: String(r.seed_hash),
    }));

    const combined: ClientSeedInput[] = inputs.map((i) => ({ userId: i.userId, seed: i.seed }));
    const clientSeed = await combineClientSeeds(combined);

    return {
      clientSeed,
      source: clientSeed ? 'player' : 'server',
      inputs,
    };
  }
}
