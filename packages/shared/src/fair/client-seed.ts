/**
 * Player-controlled client seeds (Part C).
 *
 * Rules
 *  - a player sets one seed per table; it applies from the next hand on
 *  - the seed of every seated player who set one is combined deterministically:
 *      clientSeed(hand) = SHA256( sorted("userId:seed").join("|") )
 *    so no single player controls the deck alone and the order of seats is
 *    irrelevant.
 *  - when nobody set a seed the hand keeps the server-generated client seed
 *    and is recorded with clientSeedSource = 'server'.
 */

import { sha256Hex } from './sha256.js';

export const CLIENT_SEED_MIN_LENGTH = 8;
export const CLIENT_SEED_MAX_LENGTH = 64;
export const CLIENT_SEED_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface ClientSeedInput {
  userId: number;
  seed: string;
}

export type ClientSeedValidation = { ok: true; seed: string } | { ok: false; error: string };

export function validateClientSeed(raw: unknown): ClientSeedValidation {
  const seed = typeof raw === 'string' ? raw.trim() : '';
  if (seed.length < CLIENT_SEED_MIN_LENGTH) {
    return { ok: false, error: 'seed_too_short' };
  }
  if (seed.length > CLIENT_SEED_MAX_LENGTH) {
    return { ok: false, error: 'seed_too_long' };
  }
  if (!CLIENT_SEED_PATTERN.test(seed)) {
    return { ok: false, error: 'seed_bad_charset' };
  }
  return { ok: true, seed };
}

/** Deterministic combination of the seated players' seeds. Null when empty. */
export async function combineClientSeeds(inputs: ClientSeedInput[]): Promise<string | null> {
  const parts = inputs
    .filter((i) => i && Number.isFinite(Number(i.userId)) && typeof i.seed === 'string')
    .map((i) => `${Number(i.userId)}:${i.seed}`);
  if (parts.length === 0) return null;
  parts.sort();
  return sha256Hex(parts.join('|'));
}

export async function clientSeedHash(seed: string): Promise<string> {
  return sha256Hex(seed);
}
