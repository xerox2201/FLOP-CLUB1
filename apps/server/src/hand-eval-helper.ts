// ============================================================
// Server-side hand display helper (Phase 8)
// ------------------------------------------------------------
// Turns a seat's current hole + community cards into a human-readable hand
// name for the live table UI, plus the five cards that form it.
//
// Uses the engine's exported `evaluateHand`/`compareHands`. The engine's own
// best-five helpers (`extractBestFive`, `evaluateSeat`) are PRIVATE, so the
// 2+3 Omaha rule is reproduced here rather than exported from the engine
// (packages/poker-engine must not be modified).
// ============================================================

import {
  evaluateHand,
  compareHands,
  type EvalResult,
} from '../../../packages/poker-engine/src/hand-evaluator.js';
import { rankValue } from '../../../packages/poker-engine/src/cards.js';
import type { Card, Variant } from '../../../packages/poker-engine/src/types.js';
import { describeHand, describePreflop } from '../../../packages/shared/src/hand-names.js';

export interface SeatHandDisplay {
  /** The five cards forming the current best hand, or null when unknown. */
  bestCards: Card[] | null;
  /** e.g. 'Full House, Aces over Kings', or null when not available yet. */
  handName: string | null;
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

/** The two highest-ranked hole cards (used for the Omaha preflop label). */
function topTwo(hole: Card[]): Card[] {
  return [...hole].sort((a, b) => rankValue(b.r) - rankValue(a.r)).slice(0, 2);
}

/**
 * Best hand display for one seat.
 *
 * - preflop (fewer than 3 community cards): preflop label, no cards
 * - holdem: best five of hole + board
 * - omaha4/omaha5: best five following the 2 hole + 3 board rule
 */
export function evaluateSeatForDisplay(
  hole: Card[],
  community: Card[],
  variant: Variant,
): SeatHandDisplay {
  if (!hole || hole.length === 0) return { bestCards: null, handName: null };

  const board = community ?? [];

  if (board.length < 3) {
    if (variant === 'holdem') {
      return { bestCards: null, handName: describePreflop(hole) || null };
    }
    // Omaha seats hold 4-5 cards; a two-card label keeps the string meaningful
    // ('Ace-King suited') instead of mashing four cards together.
    return { bestCards: null, handName: describePreflop(topTwo(hole)) || null };
  }

  const fives: Card[][] =
    variant === 'holdem'
      ? combinations([...hole, ...board], 5)
      : combinations(hole, 2).flatMap((h) => combinations(board, 3).map((b) => [...h, ...b]));

  let bestCards: Card[] | null = null;
  let bestEval: EvalResult | null = null;

  for (const five of fives) {
    const e = evaluateHand(five);
    if (!bestEval || compareHands(e, bestEval) > 0) {
      bestEval = e;
      bestCards = five;
    }
  }

  if (!bestCards) return { bestCards: null, handName: null };
  return { bestCards, handName: describeHand(bestCards) || null };
}
