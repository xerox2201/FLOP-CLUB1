// ============================================================
// Money formatting — the ONE public helper set for the mini-app.
//
//   formatUSD(1020)        -> "$1,020.00"   full string, symbol included
//   formatAmount(1020)     -> "1,020.00"    no symbol; markup prints its own "$"
//   formatAmount(1020, 0)  -> "1,020"       any fixed decimal count (0-4)
//   formatUSDShort(1020)   -> "$1,020"      compact, whole dollars only
//
// The Intl formatters themselves live in lib/table-geometry.ts (single source
// of truth for everything table and money related) and are re-exported here
// under the names every screen imports.
// ============================================================

import { fmtAmount, fmtMoney, fmtMoneyShort } from './table-geometry';

/** Anything an API payload can hand us for a money field. */
export type MoneyInput = number | string | null | undefined;

const AMOUNT_FORMATTERS = new Map<number, Intl.NumberFormat>();

/** Intl formatter with a fixed decimal count, cached per digit count. */
function amountFormatter(digits: number): Intl.NumberFormat {
  const key = Math.max(0, Math.min(4, Math.trunc(Number(digits) || 0)));
  let formatter = AMOUNT_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: key,
      maximumFractionDigits: key,
    });
    AMOUNT_FORMATTERS.set(key, formatter);
  }
  return formatter;
}

function toFinite(n: MoneyInput): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** "$1,020.00" — use when the UI builds the whole money string itself. */
export function formatUSD(n: MoneyInput): string {
  return fmtMoney(toFinite(n));
}

/**
 * "1,020.00" by default, "1,020" with digits = 0.
 * Use where the markup already prints its own "$" prefix.
 */
export function formatAmount(n: MoneyInput, digits = 2): string {
  const v = toFinite(n);
  return digits === 2 ? fmtAmount(v) : amountFormatter(digits).format(v);
}

/** "$1,020" — whole dollars for tight spots (keeps cents when not whole). */
export function formatUSDShort(n: MoneyInput): string {
  return fmtMoneyShort(toFinite(n));
}
