import type { Card, Rank, Suit } from './types.js';

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ r, s });
    }
  }
  return deck;
}

export function rankValue(r: Rank): number {
  return RANKS.indexOf(r) + 2;
}

export function cardStr(c: Card): string {
  return c.r + c.s;
}

export function cardsStr(cards: Card[]): string {
  return cards.map(cardStr).join(' ');
}

export function parseCard(str: string): Card {
  return { r: str[0] as Rank, s: str[1] as Suit };
}
