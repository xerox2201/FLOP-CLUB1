// ============================================================
// Human-readable poker hand names (Phase 8)
// ------------------------------------------------------------
// IMPORTANT: this implementation is deliberately SELF-CONTAINED.
// `packages/shared` has no package.json and therefore no dependency on the
// poker engine, so the category is detected here from the five cards instead of
// importing evaluateHand(). If the ranking rules in
// packages/poker-engine/src/hand-evaluator.ts ever change, mirror them here.
// ============================================================

import type { Card, Rank } from './index.js';

const RANK_VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const RANK_NAME: Record<Rank, string> = {
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  T: 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  A: 'Ace',
};

const VALUE_TO_RANK: Record<number, Rank> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

function nameOf(value: number): string {
  const r = VALUE_TO_RANK[value];
  return r ? RANK_NAME[r] : String(value);
}

/** 'Ace' -> 'Aces', 'Six' -> 'Sixes' */
function plural(value: number): string {
  const name = nameOf(value);
  return name.endsWith('x') ? `${name}es` : `${name}s`;
}

/** 'Ten to Ace', or 'Ace to Five' for the wheel. */
function straightLabel(high: number): string {
  if (high === 5) return 'Ace to Five';
  return `${nameOf(high - 4)} to ${nameOf(high)}`;
}

interface FiveEval {
  rank: number;
  tiebreak: number[];
}

function straightHigh(ranks: number[]): number {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.length < 5) return 0;
  // Wheel: A-5-4-3-2
  if (
    unique[0] === 14 &&
    unique[1] === 5 &&
    unique[2] === 4 &&
    unique[3] === 3 &&
    unique[4] === 2
  ) {
    return 5;
  }
  for (let i = 1; i < 5; i++) {
    if (unique[i - 1] - unique[i] !== 1) return 0;
  }
  return unique[0];
}

function evaluateFive(cards: Card[]): FiveEval {
  const ranks = cards.map((c) => RANK_VALUE[c.r]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.s);
  const isFlush = suits.every((s) => s === suits[0]);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const high = straightHigh(ranks);
  const isStraight = high > 0;

  if (isFlush && isStraight && high === 14) return { rank: 10, tiebreak: [14] };
  if (isFlush && isStraight) return { rank: 9, tiebreak: [high] };
  if (groups[0][1] === 4) return { rank: 8, tiebreak: [groups[0][0], groups[1][0]] };
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: 7, tiebreak: [groups[0][0], groups[1][0]] };
  }
  if (isFlush) return { rank: 6, tiebreak: ranks };
  if (isStraight) return { rank: 5, tiebreak: [high] };
  if (groups[0][1] === 3) {
    return { rank: 4, tiebreak: [groups[0][0], ...groups.slice(1).map((g) => g[0])] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return { rank: 3, tiebreak: [groups[0][0], groups[1][0], groups[2][0]] };
  }
  if (groups[0][1] === 2) {
    return { rank: 2, tiebreak: [groups[0][0], ...groups.slice(1).map((g) => g[0])] };
  }
  return { rank: 1, tiebreak: ranks };
}

function compareFive(a: FiveEval, b: FiveEval): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const x = a.tiebreak[i] ?? 0;
    const y = b.tiebreak[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];
  const recurse = (start: number) => {
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i]);
      recurse(i + 1);
      cur.pop();
    }
  };
  recurse(0);
  return out;
}

function format(e: FiveEval): string {
  const t = e.tiebreak;
  switch (e.rank) {
    case 10:
      return 'Royal Flush';
    case 9:
      return `Straight Flush, ${straightLabel(t[0])}`;
    case 8:
      return `Four of a Kind, ${plural(t[0])}`;
    case 7:
      return `Full House, ${plural(t[0])} over ${plural(t[1])}`;
    case 6:
      return `Flush, ${nameOf(t[0])} high`;
    case 5:
      return `Straight, ${straightLabel(t[0])}`;
    case 4:
      return `Three of a Kind, ${plural(t[0])}`;
    case 3:
      return `Two Pair, ${plural(t[0])} and ${plural(t[1])}`;
    case 2:
      return `Pair of ${plural(t[0])}`;
    default:
      return `High Card, ${nameOf(t[0])}`;
  }
}

/**
 * Human-readable name for the best five cards.
 * Examples: 'Royal Flush', 'Full House, Aces over Kings', 'Pair of Aces',
 * 'Straight, Ten to Ace', 'High Card, Ace'.
 * Accepts exactly 5 cards; with more it picks the strongest five.
 * Returns '' when fewer than 5 cards are supplied.
 */
export function describeHand(bestFive: Card[]): string {
  const cards = (bestFive ?? []).filter(Boolean);
  if (cards.length < 5) return '';

  let best: FiveEval | null = null;
  for (const five of cards.length === 5 ? [cards] : combinations(cards, 5)) {
    const e = evaluateFive(five);
    if (!best || compareFive(e, best) > 0) best = e;
  }
  return best ? format(best) : '';
}

/**
 * Preflop label from two hole cards.
 * Examples: 'Pocket Aces', 'Ace-King suited', 'Queen-Jack offsuit'.
 */
export function describePreflop(hole: Card[]): string {
  const cards = (hole ?? []).filter(Boolean);
  if (cards.length < 2) return '';

  const [a, b] = [...cards].sort((x, y) => RANK_VALUE[y.r] - RANK_VALUE[x.r]);
  if (a.r === b.r) return `Pocket ${plural(RANK_VALUE[a.r])}`;
  return `${RANK_NAME[a.r]}-${RANK_NAME[b.r]} ${a.s === b.s ? 'suited' : 'offsuit'}`;
}
