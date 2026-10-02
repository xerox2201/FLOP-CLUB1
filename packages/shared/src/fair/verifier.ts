/**
 * Isomorphic Provably Fair verifier — the single implementation used by the
 * server route AND by the mini-app (browser). It only needs WebCrypto, never
 * node:crypto, so a player can re-run it locally without trusting the server.
 *
 * Proof checks
 *   1. commitment  — SHA256(revealed server seed) === committed hash
 *   2. deck        — SHA256(deck derived from the proof) === stored deck hash
 *   3. board       — every community card exists in the derived deck, in
 *                    descending pop() order
 *   4. deal        — the board sits on the exact positions the deal implies
 *                    (needs playerCount + variant)
 *
 * The deck derivation depends on the hand's algorithm:
 *   deck-v1 — shuffle seed is the server seed itself
 *   deck-v2 — shuffle seed is HMAC-SHA256(serverSeed, "<clientSeed>:<nonce>")
 */

import {
  DECK_V1_ALGORITHM,
  DECK_V2_ALGORITHM,
  cardKey,
  deckStringV1,
  expectedBoardPositions,
  makeDeckV1,
  shuffleDeckV1,
  type FairCard,
} from './deck-core.js';
import { deckFromSeedV2 } from './deck-v2.js';
import { sha256Hex } from './sha256.js';

export {
  DECK_V1_ALGORITHM,
  DECK_V2_ALGORITHM,
  expectedBoardPositions,
  holeCountForVariant,
} from './deck-core.js';
export type { FairCard } from './deck-core.js';

export interface FairProof {
  algorithm: string;
  /** Revealed server seed (commit/reveal). */
  serverSeed: string;
  /** The commitment published before the hand: SHA256(serverSeed). */
  commitment: string;
  /** Combined player client seed (or the server-generated one). */
  clientSeed: string;
  /** Table-level hand counter. */
  nonce: number;
  communityCards?: FairCard[] | null;
  playerCount?: number | null;
  variant?: string | null;
  /** Deck hash stored at reveal time, when available. */
  expectedDeckHash?: string | null;
}

export interface FairChecks {
  commitmentMatches: boolean;
  deckHashMatches: boolean | null;
  communityCardsMatch: boolean | null;
  boardDealMatches: boolean | null;
}

export interface FairVerdict {
  algorithm: string;
  ok: boolean;
  checks: FairChecks;
  deckHash: string;
  communityPositions: number[] | null;
  expectedBoardPositions: number[] | null;
  /** Algorithm-specific explanation lines, safe to render in the UI. */
  notes: string[];
}

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function notesFor(algorithm: string): string[] {
  if (algorithm === DECK_V2_ALGORITHM) {
    return [
      'deck-v2: shuffle seed = HMAC-SHA256(server seed, "<client seed>:<nonce>").',
      'This verification ran locally with the same code the server uses.',
    ];
  }
  if (algorithm === DECK_V1_ALGORITHM) {
    return [
      'deck-v1: the deck is derived from the server seed only.',
      'This verification ran locally with the same code the server uses.',
    ];
  }
  return [
    `Unknown algorithm "${algorithm}". No verifier is available for this hand.`,
    'This verification ran locally with the same code the server uses.',
  ];
}

export async function verifyHand(proof: FairProof): Promise<FairVerdict> {
  const algorithm = String(proof?.algorithm ?? DECK_V1_ALGORITHM);
  const serverSeed = String(proof?.serverSeed ?? '');
  const commitment = String(proof?.commitment ?? '');
  const clientSeed = String(proof?.clientSeed ?? '');
  const nonce = Number(proof?.nonce ?? 0);
  const notes = notesFor(algorithm);

  let deck: FairCard[];
  if (algorithm === DECK_V1_ALGORITHM) {
    deck = shuffleDeckV1(makeDeckV1(), serverSeed);
  } else if (algorithm === DECK_V2_ALGORITHM) {
    deck = await deckFromSeedV2(serverSeed, clientSeed, nonce);
  } else {
    return {
      algorithm,
      ok: false,
      checks: {
        commitmentMatches: false,
        deckHashMatches: null,
        communityCardsMatch: null,
        boardDealMatches: null,
      },
      deckHash: '',
      communityPositions: null,
      expectedBoardPositions: null,
      notes,
    };
  }

  const commitmentMatches =
    serverSeed.length > 0 &&
    commitment.length > 0 &&
    sameHex(await sha256Hex(serverSeed), commitment);

  const deckHash = await sha256Hex(deckStringV1(deck));
  const expectedDeckHash = proof?.expectedDeckHash ? String(proof.expectedDeckHash) : null;
  const deckHashMatches = expectedDeckHash ? sameHex(deckHash, expectedDeckHash) : null;

  const board = Array.isArray(proof?.communityCards) ? (proof.communityCards as FairCard[]) : [];
  let communityPositions: number[] | null = null;
  let communityCardsMatch: boolean | null = null;

  if (board.length > 0) {
    const keys = deck.map(cardKey);
    communityPositions = board.map((c) => keys.indexOf(cardKey(c)));
    // pop() consumption: the board must walk the deck from the end backwards.
    communityCardsMatch =
      communityPositions.every((p) => p >= 0) &&
      communityPositions.every((p, i) => i === 0 || p < (communityPositions as number[])[i - 1]);
  }

  const playerCount = Number(proof?.playerCount ?? 0);
  const canCheckDeal = playerCount > 0 && board.length > 0;
  const expectedBoard = canCheckDeal
    ? expectedBoardPositions(playerCount, proof?.variant).slice(0, board.length)
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
    algorithm,
    ok,
    checks: { commitmentMatches, deckHashMatches, communityCardsMatch, boardDealMatches },
    deckHash,
    communityPositions,
    expectedBoardPositions: expectedBoard,
    notes,
  };
}
