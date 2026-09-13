import crypto from 'crypto';
import type { Card } from './types.js';
import { makeDeck } from './cards.js';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function shuffleDeck(
  deck: Card[],
  serverSeed: string,
  clientSeeds: string[],
  nonce: number
): Card[] {
  const combined = sha256(serverSeed + ':' + clientSeeds.join(':') + ':' + nonce);
  const result = [...deck];
  let counter = 0;

  for (let i = result.length - 1; i > 0; i--) {
    const hash = crypto
      .createHmac('sha256', combined)
      .update(String(counter++))
      .digest('hex');
    const n = parseInt(hash.slice(0, 8), 16);
    const j = n % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export function deckHash(deck: Card[]): string {
  return sha256(deck.map(c => c.r + c.s).join(','));
}

export { makeDeck };