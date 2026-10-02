/**
 * Server-side verifier for deck-v1 hands.
 *
 * The whole verification runs on the server: the client only displays the
 * result (see ProvablyFairFooter.svelte). Independent client-side
 * verification is planned (Part C).
 *
 * What is checked for a finished hand:
 *   1. commitment  — SHA256(revealed server seed) === committed hash
 *   2. deck        — SHA256(deck derived from the seed) === stored deck hash
 *   3. board       — every community card exists in the derived deck and the
 *                    card positions are strictly increasing (a single deck,
 *                    dealt in order)
 *
 * Not yet part of the shuffle (documented, not checked):
 *   the client seed and the nonce are recorded but deck-v1 derives the deck
 *   from the server seed only. Player-controlled entropy arrives in Part C.
 */

import {
  DECK_V1_ALGORITHM,
  deckFromSeedV1,
  deckHashV1,
  cardKey,
  sha256Hex,
  type FairCard,
} from './deck-v1.js';

export interface VerifyV1Input {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed?: string | null;
  nonce?: number | null;
  communityCards?: FairCard[] | null;
  expectedDeckHash?: string | null;
  /** Persisted hands.player_count — enables the exact deal-position check. */
  playerCount?: number | null;
  /** Persisted hands.variant — enables the exact deal-position check. */
  variant?: string | null;
}

export interface VerifyV1Checks {
  /** SHA256(server seed) equals the published commitment. */
  commitmentMatches: boolean;
  /** Recomputed deck hash equals the stored deck hash (null: nothing stored). */
  deckHashMatches: boolean | null;
  /** Board cards exist in the deck in deal order (descending pop() positions). */
  communityCardsMatch: boolean | null;
  /** Board sits on the exact positions the deal implies (null: player count unknown). */
  boardDealMatches: boolean | null;
}

export interface VerifyV1Result {
  algorithm: string;
  ok: boolean;
  checks: VerifyV1Checks;
  deckHash: string;
  communityPositions: number[] | null;
  expectedBoardPositions: number[] | null;
  notes: string[];
}

const NOTES = [
  'Server-side verification. Independent client verification coming soon.',
  'deck-v1 derives the deck from the server seed only; the client seed and nonce are recorded but not mixed in yet.',
];

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Hole cards per seat, mirroring PokerGame.holeCount(). */
function holeCountForVariant(variant?: string | null): number {
  if (variant === 'omaha4') return 4;
  if (variant === 'omaha5') return 5;
  return 2;
}

/**
 * Positions the board must occupy in the derived deck.
 *
 * The engine deals with deck.pop(), so the deck is consumed from the end:
 * hole cards first, then burn+flop(3), burn+turn(1), burn+river(1).
 * For `hole` hole cards the flop starts at 50 - hole and the streets are
 * 1, 1, 2, 2 apart (each street burns one card first).
 */
export function expectedBoardPositionsV1(playerCount: number, variant?: string | null): number[] {
  const start = 50 - playerCount * holeCountForVariant(variant);
  return [start, start - 1, start - 2, start - 4, start - 6];
}

export function verifyHandV1(input: VerifyV1Input): VerifyV1Result {
  const serverSeed = String(input.serverSeed ?? '');
  const serverSeedHash = String(input.serverSeedHash ?? '');

  const commitmentMatches =
    serverSeed.length > 0 &&
    serverSeedHash.length > 0 &&
    sameHex(sha256Hex(serverSeed), serverSeedHash);

  const deck = deckFromSeedV1(serverSeed);
  const deckHash = deckHashV1(deck);

  const expectedDeckHash = input.expectedDeckHash ? String(input.expectedDeckHash) : null;
  const deckHashMatches = expectedDeckHash ? sameHex(deckHash, expectedDeckHash) : null;

  const board = Array.isArray(input.communityCards) ? input.communityCards : [];
  let communityPositions: number[] | null = null;
  let communityCardsMatch: boolean | null = null;

  if (board.length > 0) {
    const keys = deck.map(cardKey);
    communityPositions = board.map((c) => keys.indexOf(cardKey(c)));
    // pop() consumption: the board must walk the deck from the end backwards.
    communityCardsMatch =
      communityPositions.every((p) => p >= 0) &&
      communityPositions.every((p, i) => i === 0 || p < communityPositions![i - 1]);
  }

  const playerCount = Number(input.playerCount ?? 0);
  const canCheckDeal = playerCount > 0 && board.length > 0;
  const expectedBoard = canCheckDeal
    ? expectedBoardPositionsV1(playerCount, input.variant).slice(0, board.length)
    : null;
  const boardDealMatches = expectedBoard
    ? JSON.stringify(expectedBoard) === JSON.stringify(communityPositions)
    : null;

  const ok =
    commitmentMatches &&
    deckHashMatches !== false &&
    communityCardsMatch !== false &&
    boardDealMatches !== false;

  return {
    algorithm: DECK_V1_ALGORITHM,
    ok,
    checks: { commitmentMatches, deckHashMatches, communityCardsMatch, boardDealMatches },
    deckHash,
    communityPositions,
    expectedBoardPositions: expectedBoard,
    notes: NOTES,
  };
}
