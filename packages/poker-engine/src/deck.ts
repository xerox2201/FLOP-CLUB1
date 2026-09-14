 import type { Card, Suit, Rank } from './types.js';

const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ r, s });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[], seed?: string): Card[] {
  if (!Array.isArray(deck)) {
    console.error('[shuffleDeck] deck is not an array:', typeof deck);
    return [];
  }

  let rng: () => number;
  if (seed && typeof seed === 'string' && seed.length > 0) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h << 5) - h + seed.charCodeAt(i);
      h |= 0;
    }
    let state = h || 1;
    rng = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state |= 0;
      return ((state >>> 0) % 100000) / 100000;
    };
  } else {
    rng = Math.random;
  }

  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  for (let i = 0; i < arr.length; i++) {
    deck[i] = arr[i];
  }

  return deck;
}