/**
 * Provably Fair parity + verifier tests (Part C).
 *
 * The critical assertion: the shared deck derivation used by the verifier
 * (server-side and in the browser) reproduces the engine's shuffle
 * byte-for-byte, for deck-v1 and for deck-v2, over many random seeds.
 */

import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { makeDeck, shuffleDeck } from '../../../../poker-engine/src/deck.js';
import { deckFromSeedV1, deckHashV1, deckStringV1 as serverDeckString } from '../deck-v1.js';
import { verifyHandV1 } from '../verify-v1.js';
import { deckFromSeedV2, deckHashV2 } from '../deck-v2.js';
import {
  DECK_V1_ALGORITHM,
  DECK_V2_ALGORITHM,
  deckStringV1,
  expectedBoardPositions,
  makeDeckV1,
  shuffleDeckV1,
} from '../deck-core.js';
import { verifyHand } from '../verifier.js';
import { combineClientSeeds, validateClientSeed } from '../client-seed.js';

const SAMPLES = Number(process.env.FAIR_PARITY_SAMPLES ?? 200);

function engineDeckString(seed: string, clientSeed?: string, nonce?: number): string {
  return shuffleDeck(makeDeck(), seed, clientSeed, nonce)
    .map((c) => `${c.r}${c.s}`)
    .join(',');
}

function randomSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

function randomClientSeed(): string {
  return crypto.randomBytes(16).toString('hex');
}

describe('deck-v1 parity', () => {
  it(`shared deck-core matches the engine for ${SAMPLES} seeds`, () => {
    for (let i = 0; i < SAMPLES; i++) {
      const seed = randomSeed();
      expect(deckStringV1(shuffleDeckV1(makeDeckV1(), seed))).toBe(engineDeckString(seed));
    }
  });

  it(`frozen deck-v1 matches deck-core for ${SAMPLES} seeds`, () => {
    for (let i = 0; i < SAMPLES; i++) {
      const seed = randomSeed();
      expect(serverDeckString(deckFromSeedV1(seed))).toBe(
        deckStringV1(shuffleDeckV1(makeDeckV1(), seed)),
      );
    }
  });
});

describe('deck-v2 parity', () => {
  it(`shared deck-v2 matches the engine for ${SAMPLES} seed/clientSeed/nonce triples`, async () => {
    for (let i = 0; i < SAMPLES; i++) {
      const seed = randomSeed();
      const clientSeed = randomClientSeed();
      const nonce = i + 1;
      const shared = deckStringV1(await deckFromSeedV2(seed, clientSeed, nonce));
      expect(shared).toBe(engineDeckString(seed, clientSeed, nonce));
    }
  });

  it('player entropy actually changes the deck', async () => {
    const seed = randomSeed();
    const a = deckStringV1(await deckFromSeedV2(seed, 'player-one', 1));
    const b = deckStringV1(await deckFromSeedV2(seed, 'player-two', 1));
    const c = deckStringV1(await deckFromSeedV2(seed, 'player-one', 2));
    const plain = engineDeckString(seed);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(plain);
  });

  it('frozen deck-v1 derivation is unchanged by deck-v2', () => {
    const seed = randomSeed();
    expect(deckStringV1(deckFromSeedV1(seed))).toBe(engineDeckString(seed));
  });
});

describe('verifier', () => {
  async function honestProof(algorithm: string, playerCount = 2) {
    const serverSeed = randomSeed();
    const clientSeed = algorithm === DECK_V2_ALGORITHM ? randomClientSeed() : '';
    const nonce = 7;
    const deck =
      algorithm === DECK_V2_ALGORITHM
        ? await deckFromSeedV2(serverSeed, clientSeed, nonce)
        : deckFromSeedV1(serverSeed);
    const positions = expectedBoardPositions(playerCount, 'holdem');
    const board = positions.map((p) => deck[p]);
    const commitment = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const deckHash =
      algorithm === DECK_V2_ALGORITHM
        ? await deckHashV2(serverSeed, clientSeed, nonce)
        : deckHashV1(deck);
    return { serverSeed, clientSeed, nonce, board, commitment, deckHash, playerCount };
  }

  it('accepts an honest deck-v2 hand and reports where the board sat', async () => {
    const p = await honestProof(DECK_V2_ALGORITHM, 2);
    const verdict = await verifyHand({
      algorithm: DECK_V2_ALGORITHM,
      serverSeed: p.serverSeed,
      commitment: p.commitment,
      clientSeed: p.clientSeed,
      nonce: p.nonce,
      communityCards: p.board,
      playerCount: p.playerCount,
      variant: 'holdem',
      expectedDeckHash: p.deckHash,
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.checks).toEqual({
      commitmentMatches: true,
      deckHashMatches: true,
      communityCardsMatch: true,
      boardDealMatches: true,
    });
    expect(verdict.communityPositions).toEqual(expectedBoardPositions(2, 'holdem'));
  });

  it('rejects a tampered board, a reordered board, a wrong seed and a wrong deck hash', async () => {
    const p = await honestProof(DECK_V2_ALGORITHM, 2);
    const base = {
      algorithm: DECK_V2_ALGORITHM,
      serverSeed: p.serverSeed,
      commitment: p.commitment,
      clientSeed: p.clientSeed,
      nonce: p.nonce,
      playerCount: p.playerCount,
      variant: 'holdem',
      expectedDeckHash: p.deckHash,
    };

    const tampered = p.board.map((c, i) => (i === 2 ? { r: '2', s: 'c' } : c));
    expect((await verifyHand({ ...base, communityCards: tampered })).ok).toBe(false);

    const reordered = [p.board[3], p.board[4], p.board[0], p.board[1], p.board[2]];
    expect(
      (await verifyHand({ ...base, communityCards: reordered })).checks.communityCardsMatch,
    ).toBe(false);

    const wrongSeed = await verifyHand({
      ...base,
      serverSeed: randomSeed(),
      communityCards: p.board,
    });
    expect(wrongSeed.ok).toBe(false);
    expect(wrongSeed.checks.commitmentMatches).toBe(false);
    expect(wrongSeed.checks.deckHashMatches).toBe(false);

    const wrongDeckHash = await verifyHand({
      ...base,
      communityCards: p.board,
      expectedDeckHash: 'deadbeef',
    });
    expect(wrongDeckHash.checks.deckHashMatches).toBe(false);
    expect(wrongDeckHash.ok).toBe(false);
  });

  it('rejects an unknown algorithm instead of guessing', async () => {
    const verdict = await verifyHand({
      algorithm: 'deck-v9',
      serverSeed: randomSeed(),
      commitment: 'irrelevant',
      clientSeed: '',
      nonce: 1,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.deckHash).toBe('');
  });

  it('agrees with the frozen deck-v1 oracle', async () => {
    for (let i = 0; i < 25; i++) {
      const p = await honestProof(DECK_V1_ALGORITHM, 3);
      const input = {
        serverSeed: p.serverSeed,
        serverSeedHash: p.commitment,
        clientSeed: null,
        nonce: 1,
        communityCards: p.board,
        expectedDeckHash: p.deckHash,
        playerCount: p.playerCount,
        variant: 'holdem',
      } as const;

      const oracle = verifyHandV1({ ...input });
      const shared = await verifyHand({
        algorithm: DECK_V1_ALGORITHM,
        serverSeed: p.serverSeed,
        commitment: p.commitment,
        clientSeed: '',
        nonce: 1,
        communityCards: p.board,
        playerCount: p.playerCount,
        variant: 'holdem',
        expectedDeckHash: p.deckHash,
      });

      expect(shared.ok).toBe(oracle.ok);
      expect(shared.checks.commitmentMatches).toBe(oracle.checks.commitmentMatches);
      expect(shared.checks.deckHashMatches).toBe(oracle.checks.deckHashMatches);
      expect(shared.checks.communityCardsMatch).toBe(oracle.checks.communityCardsMatch);
      expect(shared.checks.boardDealMatches).toBe(oracle.checks.boardDealMatches);
    }
  });
});

describe('client seeds', () => {
  it('validates length and charset', () => {
    expect(validateClientSeed('short').ok).toBe(false);
    expect(validateClientSeed('has space here').ok).toBe(false);
    expect(validateClientSeed('a'.repeat(65)).ok).toBe(false);
    expect(validateClientSeed('good-seed_123').ok).toBe(true);
  });

  it('combines seeds order-independently and returns null for nobody', async () => {
    expect(await combineClientSeeds([])).toBeNull();

    const a = await combineClientSeeds([
      { userId: 2, seed: 'bbbbbbbb' },
      { userId: 1, seed: 'aaaaaaaa' },
    ]);
    const b = await combineClientSeeds([
      { userId: 1, seed: 'aaaaaaaa' },
      { userId: 2, seed: 'bbbbbbbb' },
    ]);
    expect(a).toBe(b);

    const c = await combineClientSeeds([{ userId: 1, seed: 'aaaaaaaa' }]);
    expect(c).not.toBe(a);
  });
});
