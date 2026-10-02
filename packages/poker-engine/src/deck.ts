import crypto from 'crypto';
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

export function shuffleDeck(
  deck: Card[],
  seed?: string,
  clientSeed?: string,
  nonce?: number,
): Card[] {
  if (!Array.isArray(deck)) {
    console.error('[shuffleDeck] deck is not an array:', typeof deck);
    return [];
  }

  // deck-v2: mix player entropy into the shuffle seed (HMAC-SHA256).
  // Without clientSeed/nonce the derivation stays deck-v1: seed used as-is.
  const shuffleSeed =
    seed && clientSeed !== undefined && nonce !== undefined
      ? crypto.createHmac('sha256', seed).update(`${clientSeed}:${nonce}`).digest('hex')
      : seed;

  let rng: () => number;
  if (shuffleSeed && typeof shuffleSeed === 'string' && shuffleSeed.length > 0) {
    let h = 0;
    for (let i = 0; i < shuffleSeed.length; i++) {
      h = (h << 5) - h + shuffleSeed.charCodeAt(i);
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
