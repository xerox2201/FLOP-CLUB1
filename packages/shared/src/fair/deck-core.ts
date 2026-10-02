/**
 * FROZEN — deck-core (browser-safe twin of fair/deck-v1.ts)
 *
 * Same deck and same Fisher-Yates shuffle as deck-v1 and as
 * packages/poker-engine/src/deck.ts. It exists separately only because
 * deck-v1.ts imports node:crypto for SHA-256 and therefore cannot be bundled
 * for the browser.
 *
 * DO NOT EDIT. Behavioural equality with deck-v1.ts and with the engine is
 * asserted by packages/shared/src/fair/__tests__/fair.test.ts.
 */

export interface FairCard {
  r: string;
  s: string;
}

export const DECK_V1_ALGORITHM = 'deck-v1';
export const DECK_V2_ALGORITHM = 'deck-v2';

export const DECK_V1_SUITS = ['s', 'h', 'd', 'c'];
export const DECK_V1_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export function makeDeckV1(): FairCard[] {
  const deck: FairCard[] = [];
  for (const s of DECK_V1_SUITS) {
    for (const r of DECK_V1_RANKS) {
      deck.push({ r, s });
    }
  }
  return deck;
}

export function shuffleDeckV1(deck: FairCard[], seed: string): FairCard[] {
  if (!seed || typeof seed !== 'string' || seed.length === 0) {
    throw new Error('deck-v1 requires a non-empty seed');
  }

  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  let state = h || 1;
  const rng = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state |= 0;
    return ((state >>> 0) % 100000) / 100000;
  };

  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export function cardKey(card: FairCard): string {
  return `${card.r}${card.s}`;
}

/** Canonical, order-sensitive serialization of a deck. */
export function deckStringV1(cards: FairCard[]): string {
  return cards.map(cardKey).join(',');
}

/** Hole cards per seat, mirroring PokerGame.holeCount(). */
export function holeCountForVariant(variant?: string | null): number {
  if (variant === 'omaha4') return 4;
  if (variant === 'omaha5') return 5;
  return 2;
}

/**
 * Positions the board must occupy in a derived deck.
 *
 * The engine deals with deck.pop(), so the deck is consumed from the end:
 * hole cards first, then burn+flop(3), burn+turn(1), burn+river(1).
 * For `hole` hole cards the flop starts at 50 - hole, and each following
 * street is 2 positions earlier (one burn card + one dealt card).
 */
export function expectedBoardPositions(playerCount: number, variant?: string | null): number[] {
  const start = 50 - playerCount * holeCountForVariant(variant);
  return [start, start - 1, start - 2, start - 4, start - 6];
}
