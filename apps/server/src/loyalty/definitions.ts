// ============================================================
// Loyalty definitions: tiers, rakeback rates, XP curve, seeds, packs
// Pure data + pure functions. No DB.
// ============================================================

export type TierName = 'welcome' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface TierDef {
  name: TierName;
  label: string;
  minRake: number;
  maxRake: number;
  rakebackPct: number;
  color: string;
  icon: string;
}

// Flat instant rakeback. Tier labels retained for VIP cosmetics, voucher gating, seeds, shop discounts. No hidden grind curve on rate.
export const INSTANT_RAKEBACK_PCT = 0.25;

export const TIERS: TierDef[] = [
  {
    name: 'welcome',
    label: 'Welcome',
    minRake: 0,
    maxRake: 25,
    rakebackPct: INSTANT_RAKEBACK_PCT,
    color: '#6ee7b7',
    icon: '🌱',
  },
  {
    name: 'bronze',
    label: 'Bronze',
    minRake: 25,
    maxRake: 100,
    rakebackPct: INSTANT_RAKEBACK_PCT,
    color: '#c98a3e',
    icon: '🥉',
  },
  {
    name: 'silver',
    label: 'Silver',
    minRake: 100,
    maxRake: 500,
    rakebackPct: INSTANT_RAKEBACK_PCT,
    color: '#cbd5e1',
    icon: '🥈',
  },
  {
    name: 'gold',
    label: 'Gold',
    minRake: 500,
    maxRake: 2500,
    rakebackPct: INSTANT_RAKEBACK_PCT,
    color: '#f4c95d',
    icon: '🥇',
  },
  {
    name: 'platinum',
    label: 'Platinum',
    minRake: 2500,
    maxRake: 10000,
    rakebackPct: INSTANT_RAKEBACK_PCT,
    color: '#a5b4fc',
    icon: '💎',
  },
  {
    name: 'diamond',
    label: 'Diamond',
    minRake: 10000,
    maxRake: Infinity,
    rakebackPct: INSTANT_RAKEBACK_PCT,
    color: '#67e8f9',
    icon: '💠',
  },
];

export function tierForRake(lifetimeRake: number): TierDef {
  const r = Math.max(0, Number(lifetimeRake) || 0);
  for (const t of TIERS) {
    if (r >= t.minRake && r < t.maxRake) return t;
  }
  return TIERS[TIERS.length - 1];
}

export function nextTier(current: TierName): TierDef | null {
  const idx = TIERS.findIndex((t) => t.name === current);
  if (idx < 0 || idx >= TIERS.length - 1) return null;
  return TIERS[idx + 1];
}

export function tierDef(name: TierName): TierDef {
  return TIERS.find((t) => t.name === name) ?? TIERS[0];
}

// ============================================================
// XP constants
// ============================================================
// XP rate: 100 XP per $1 of rake (was 250 before Phase 1).
export const XP_PER_RAKE_USD = 100;

// XP cashout rules
export const XP_CASHOUT_MIN = 5000;
export const XP_CASHOUT_STEP = 1000;
export const XP_CASHOUT_MIN_LEVEL = 5;
export const XP_CASHOUT_MONTHLY_CAP = 50000;
export const XP_CASHOUT_COOLDOWN_HOURS = 24;

// ============================================================
// XP CURVE — stepped, exact table
// ============================================================
// XP_TABLE[L] = XP needed to go from level L to L+1
// Covers L1..L49. For L50+ computed separately.
const XP_TABLE: number[] = [
  0, // index 0 unused
  // Tier I — Starter (L1-L5 entry points: 4 transitions)
  100,
  250,
  500,
  1000,
  // Tier II — Bronze (L5→L15, 10 transitions)
  1500,
  2200,
  3000,
  4000,
  5500,
  7000,
  9000,
  12000,
  16000,
  20000,
  // Tier III — Silver (L15→L30, 15 transitions)
  30000,
  40000,
  50000,
  60000,
  75000,
  100000,
  130000,
  165000,
  210000,
  260000,
  320000,
  400000,
  500000,
  620000,
  770000,
  // Tier IV — Gold (L30→L50, 20 transitions)
  1000000,
  1200000,
  1450000,
  1750000,
  2100000,
  2500000,
  3000000,
  3600000,
  4300000,
  5200000,
  6200000,
  7500000,
  9000000,
  10800000,
  13000000,
  15600000,
  18700000,
  22500000,
  27000000,
  32500000,
];

export function xpForNextLevel(level: number): number {
  if (level < 1) return 100;

  // Tier I-III + IV (L1-L49): exact table
  if (level <= 49) {
    return XP_TABLE[level] ?? 32_500_000;
  }

  // Tier V — Platinum (L50-L79): anchor-based linear interpolation
  //   L50→L51 = 40M, L60→L61 = 150M, L70→L71 = 350M, L79→L80 = 500M
  if (level <= 59) return Math.round(40_000_000 + (level - 50) * 11_000_000);
  if (level <= 69) return Math.round(150_000_000 + (level - 60) * 20_000_000);
  if (level <= 79) return Math.round(350_000_000 + (level - 70) * (150_000_000 / 9));

  // Tier VI — Diamond (L80+): 500M + 50M per level, cap at 1B
  const xp = 500_000_000 + (level - 80) * 50_000_000;
  return Math.min(1_000_000_000, xp);
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpAtLevelStart: number;
}

export function levelFromLifetimeXP(lifetimeXp: number): LevelInfo {
  let remaining = Math.max(0, Number(lifetimeXp) || 0);
  let level = 1;
  let consumed = 0;

  for (let safety = 0; safety < 5000; safety++) {
    const need = xpForNextLevel(level);
    if (remaining < need) {
      return { level, xpIntoLevel: remaining, xpForNextLevel: need, xpAtLevelStart: consumed };
    }
    remaining -= need;
    consumed += need;
    level++;
  }
  return { level, xpIntoLevel: 0, xpForNextLevel: xpForNextLevel(level), xpAtLevelStart: consumed };
}

// ============================================================
// Level-based discounts (shop)
// ============================================================
export function levelDiscount(level: number): number {
  if (level >= 80) return 0.3;
  if (level >= 50) return 0.2;
  if (level >= 25) return 0.1;
  if (level >= 10) return 0.05;
  return 0;
}

// ============================================================
// Shop packs — 6 packs, level-based discount applied at purchase
// ============================================================
export interface ShopPack {
  id: string;
  name: string;
  priceUsd: number;
  priceTon: number;
  chips: number;
  voucher: number;
  xp: number;
}

export const SHOP_PACKS: ShopPack[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 1,
    priceTon: 0.25,
    chips: 10_000,
    voucher: 0,
    xp: 200,
  },
  { id: 'value', name: 'Value', priceUsd: 3, priceTon: 0.75, chips: 40_000, voucher: 0.5, xp: 500 },
  {
    id: 'premium',
    name: 'Premium',
    priceUsd: 8,
    priceTon: 2.0,
    chips: 120_000,
    voucher: 1.5,
    xp: 1200,
  },
  { id: 'mega', name: 'Mega', priceUsd: 20, priceTon: 5.0, chips: 350_000, voucher: 4, xp: 3000 },
  {
    id: 'ultra',
    name: 'Ultra',
    priceUsd: 50,
    priceTon: 12.5,
    chips: 1_000_000,
    voucher: 10,
    xp: 8000,
  },
  {
    id: 'whale',
    name: 'Whale',
    priceUsd: 100,
    priceTon: 25.0,
    chips: 2_500_000,
    voucher: 20,
    xp: 18000,
  },
];

export function packById(id: string): ShopPack | null {
  return SHOP_PACKS.find((p) => p.id === id) ?? null;
}

// ============================================================
// Seeds — hardcoded definitions (claim log lives in DB)
// ============================================================
export type SeedType = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface SeedDef {
  type: SeedType;
  label: string;
  icon: string;
  minFreeHands: number;
  minFreeWins: number;
  amount: number;
  playthroughMultiplier: number;
  minRakeAfter: number;
  minRealHandsAfter: number;
  waitDays: number;
}

export const SEED_DEFS: SeedDef[] = [
  {
    type: 'bronze',
    label: 'Bronze Seed',
    icon: '🥉',
    minFreeHands: 50,
    minFreeWins: 10,
    amount: 0.5,
    playthroughMultiplier: 10,
    minRakeAfter: 15,
    minRealHandsAfter: 150,
    waitDays: 14,
  },
  {
    type: 'silver',
    label: 'Silver Seed',
    icon: '🥈',
    minFreeHands: 200,
    minFreeWins: 50,
    amount: 1.0,
    playthroughMultiplier: 10,
    minRakeAfter: 15,
    minRealHandsAfter: 150,
    waitDays: 14,
  },
  {
    type: 'gold',
    label: 'Gold Seed',
    icon: '🥇',
    minFreeHands: 500,
    minFreeWins: 150,
    amount: 2.5,
    playthroughMultiplier: 10,
    minRakeAfter: 15,
    minRealHandsAfter: 150,
    waitDays: 14,
  },
  {
    type: 'platinum',
    label: 'Platinum Seed',
    icon: '💎',
    minFreeHands: 2000,
    minFreeWins: 500,
    amount: 5.0,
    playthroughMultiplier: 10,
    minRakeAfter: 15,
    minRealHandsAfter: 150,
    waitDays: 14,
  },
];

export function seedDef(type: SeedType): SeedDef {
  const d = SEED_DEFS.find((s) => s.type === type);
  if (!d) throw new Error(`Unknown seed type: ${type}`);
  return d;
}

// ============================================================
// Daily chip refill (by tier)
// ============================================================
export function dailyRefillForTier(tier: TierName): number {
  return (
    {
      welcome: 500,
      bronze: 1500,
      silver: 5000,
      gold: 15000,
      platinum: 50000,
      diamond: 200000,
    } as Record<TierName, number>
  )[tier];
}
