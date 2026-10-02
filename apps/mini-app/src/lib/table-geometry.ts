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

export interface ChipStack {
  denom: number;
  count: number;
}

/** Denominations, largest first. */
export const CHIP_DENOMS = [1000, 500, 100, 25, 5, 1, 0.5, 0.25] as const;

/** Sprite colour per denomination (see /chips-set-hq.webp). */
export const CHIP_COLORS: Record<number, string> = {
  1000: '#d4af37',
  500: '#3b82f6',
  100: '#0f172a',
  25: '#10b981',
  5: '#dc2626',
  1: '#f8fafc',
  0.5: '#f97316',
  0.25: '#0ea5e9',
};

/** Break an amount into real chip stacks, largest denomination first. */
export function chipBreakdown(amount: number): ChipStack[] {
  let rest = Math.max(0, Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100);
  const out: ChipStack[] = [];
  for (const denom of CHIP_DENOMS) {
    if (rest + 1e-9 < denom) continue;
    const count = Math.floor((rest + 1e-9) / denom);
    if (count <= 0) continue;
    out.push({ denom, count });
    rest = Math.round((rest - count * denom) * 100) / 100;
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
