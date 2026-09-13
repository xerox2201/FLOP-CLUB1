import type { Card } from './types.js';
import { rankValue } from './cards.js';

export interface EvalResult {
  rank: number;
  tiebreak: number[];
  name: string;
}

export function evaluateHand(cards: Card[]): EvalResult {
  if (cards.length < 5) {
    return { rank: 0, tiebreak: [], name: 'Incomplete' };
  }

  const combos = combinations(cards, 5);
  let best: EvalResult | null = null;

  for (const c of combos) {
    const result = eval5(c);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }

  return best!;
}

function eval5(cards: Card[]): EvalResult {
  const ranks = cards.map(c => rankValue(c.r)).sort((a, b) => b - a);
  const suits = cards.map(c => c.s);
  const isFlush = suits.every(s => s === suits[0]);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);

  const groups = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isStraight = checkStraight(ranks);
  const isWheel = ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2;

  if (isFlush && isStraight && ranks[0] === 14) {
    return { rank: 10, tiebreak: [14], name: 'Royal Flush' };
  }

  if (isFlush && isStraight) {
    const high = isWheel ? 5 : ranks[0];
    return { rank: 9, tiebreak: [high], name: 'Straight Flush' };
  }

  if (groups[0][1] === 4) {
    return { rank: 8, tiebreak: [groups[0][0], groups[1][0]], name: 'Four of a Kind' };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: 7, tiebreak: [groups[0][0], groups[1][0]], name: 'Full House' };
  }

  if (isFlush) {
    return { rank: 6, tiebreak: ranks, name: 'Flush' };
  }

  if (isStraight) {
    const high = isWheel ? 5 : ranks[0];
    return { rank: 5, tiebreak: [high], name: 'Straight' };
  }

  if (groups[0][1] === 3) {
    return { rank: 4, tiebreak: [groups[0][0], ...groups.slice(1).map(g => g[0])], name: 'Three of a Kind' };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return { rank: 3, tiebreak: [groups[0][0], groups[1][0], groups[2][0]], name: 'Two Pair' };
  }

  if (groups[0][1] === 2) {
    return { rank: 2, tiebreak: [groups[0][0], ...groups.slice(1).map(g => g[0])], name: 'One Pair' };
  }

  return { rank: 1, tiebreak: ranks, name: 'High Card' };
}

function checkStraight(ranks: number[]): boolean {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);

  if (unique.length >= 5 && unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
    return true;
  }
  if (unique.length < 5) return false;
  for (let i = 1; i < 5; i++) {
    if (unique[i - 1] - unique[i] !== 1) return false;
  }
  return true;
}

export function compareHands(a: EvalResult, b: EvalResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const x = a.tiebreak[i] || 0;
    const y = b.tiebreak[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const current: T[] = [];
  function recurse(start: number) {
    if (current.length === k) { result.push([...current]); return; }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      recurse(i + 1);
      current.pop();
    }
  }
  recurse(0);
  return result;
}