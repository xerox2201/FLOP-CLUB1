// ============================================================
// Table geometry — SINGLE SOURCE OF TRUTH for both table layouts
// (mobile PokerTableMobile.svelte + desktop PokerTable.svelte)
//
// Nothing here renders. It only answers: where do seats sit, how big is
// the felt, how do we break an amount into chips, how do we print money.
// ============================================================

export interface SeatPos {
  x: number;
  y: number;
}

/**
 * Seat positions on the felt ellipse, in percent, indexed by SEAT index.
 * The hero's seat always lands at the bottom-centre (50%, 90%) and the
 * remaining seats fan evenly around the ellipse — this reproduces the classic
 * 6-max layout (bottom, bottom-left, top-left, top-centre, top-right,
 * bottom-right) for every table size.
 *
 * Radii differ per layout because the desktop oval is wide (aspect 0.626) and
 * the mobile oval is tall (aspect 1.599); the same percentage would push seats
 * off the rail on one of them.
 */
export function seatPositions(
  count: number,
  heroIndex = 0,
  variant: 'desktop' | 'mobile' = 'desktop',
): SeatPos[] {
  const n = Math.max(2, Math.min(9, count));
  const hero = ((heroIndex % n) + n) % n;
  const rx = 40;
  const ry = variant === 'mobile' ? 41 : 35;
  const out: SeatPos[] = [];
  for (let seat = 0; seat < n; seat++) {
    const slot = (seat - hero + n) % n; // hero -> slot 0
    const angle = Math.PI / 2 + (slot / n) * Math.PI * 2; // start at the bottom
    out[seat] = {
      x: 50 + rx * Math.cos(angle),
      y: 50 + ry * Math.sin(angle),
    };
  }
  return out;
}

/**
 * Surface art aspect ratio (height / width) per layout.
 * desktop: /table-top-desktop.webp is 1400x876 (wide oval, like PS/GG).
 * mobile:  /table-top-mobile.webp  is  563x900 (portrait oval).
 */
export const SURFACE_ASPECT = {
  desktop: 876 / 1400,
  mobile: 900 / 563,
} as const;

/**
 * Felt box in px, fitted to BOTH viewport axes using the surface's real aspect
 * ratio, so the oval and its rail are never clipped and never distorted.
 */
export function tableBox(
  vw: number,
  vh: number,
  variant: 'desktop' | 'mobile' = 'desktop',
): { w: number; h: number } {
  const aspect = SURFACE_ASPECT[variant];
  const reserve = variant === 'desktop' ? 300 : 320;
  const maxW = variant === 'desktop' ? 1180 : 560;
  const w = Math.max(260, Math.min(maxW, vw * 0.92, (vh - reserve) / aspect));
  return { w: Math.round(w), h: Math.round(w * aspect) };
}

/**
 * Fit the surface inside an available box (used by the mobile layout, which
 * measures its wrapper instead of the viewport).
 */
export function fitSurface(
  availW: number,
  availH: number,
  variant: 'desktop' | 'mobile' = 'mobile',
): { w: number; h: number } {
  const aspect = SURFACE_ASPECT[variant];
  let w = availW;
  let h = w * aspect;
  if (h > availH) {
    h = availH;
    w = h / aspect;
  }
  return { w: Math.round(w), h: Math.round(h) };
}

/**
 * One cell of the chip sprite `/chips-set-hq.webp`. The sheet is a 4 x 3 grid
 * and every cell carries one printed denomination, so the value and the sprite
 * coordinates belong together and live in exactly one place.
 */
export interface ChipDenom {
  value: number;
  row: number;
  col: number;
}

/**
 * THE chip denomination table for the whole app (sprite + every stack
 * renderer). Ordered largest first, which is also the order in which
 * chipBreakdown() lays the columns out.
 */
export const CHIP_DENOMS: readonly ChipDenom[] = [
  { value: 1000000, row: 2, col: 3 },
  { value: 500000, row: 2, col: 2 },
  { value: 100000, row: 2, col: 1 },
  { value: 50000, row: 2, col: 0 },
  { value: 10000, row: 1, col: 3 },
  { value: 5000, row: 1, col: 2 },
  { value: 1000, row: 1, col: 1 },
  { value: 500, row: 1, col: 0 },
  { value: 100, row: 0, col: 3 },
  { value: 25, row: 0, col: 2 },
  { value: 5, row: 0, col: 1 },
  { value: 1, row: 0, col: 0 },
];

export interface ChipStack {
  denom: number;
  count: number;
  row: number;
  col: number;
}

/** Break an amount into chip columns, largest denomination first. */
export function chipBreakdown(amount: number): ChipStack[] {
  let rest = Math.max(0, Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100);
  const out: ChipStack[] = [];
  for (const d of CHIP_DENOMS) {
    if (rest + 1e-9 < d.value) continue;
    const count = Math.floor((rest + 1e-9) / d.value);
    if (count <= 0) continue;
    out.push({ denom: d.value, count, row: d.row, col: d.col });
    rest = Math.round((rest - count * d.value) * 100) / 100;
  }
  // Fractional amounts (0.25 blinds) have no sprite cell. Fall back to the
  // smallest chip so a real bet can never render as nothing.
  if (out.length === 0 && rest > 0) {
    const smallest = CHIP_DENOMS[CHIP_DENOMS.length - 1];
    out.push({ denom: smallest.value, count: 1, row: smallest.row, col: smallest.col });
  }
  return out;
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Money with thousand separators: 1020 -> "$1,020.00". */
export function fmtMoney(n: number): string {
  return USD.format(Number.isFinite(n) ? n : 0);
}

const AMOUNT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Amount WITHOUT the currency symbol, 2 decimals + thousand separators:
 * 1020 -> "1,020.00". Use where the markup prints its own "$" prefix.
 */
export function fmtAmount(n: number): string {
  return AMOUNT.format(Number.isFinite(n) ? n : 0);
}

/** Compact money for tight spots: 1020 -> "$1,020", 10.5 -> "$10.50". */
export function fmtMoneyShort(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return Number.isInteger(v) ? `$${v.toLocaleString('en-US')}` : USD.format(v);
}
