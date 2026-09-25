import { Pool } from 'pg';

// ============================================================
// PriceOracle — live TON/USD rate with multi-source fallback
// ------------------------------------------------------------
// Chain:  tonapi.io → swap.coffee → DB cache (< 30 min old)
// Fail-safe: if all sources fail AND cache is stale → throw.
//            Callers must handle the throw (halt money ops).
// ============================================================

const PAIR = 'TON/USD';
const FRESH_MS = 60_000; // in-memory freshness (1 min)
const DB_CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 min

const TONAPI_URL = 'https://tonapi.io/v2/rates?tokens=ton&currencies=usd';
const SWAP_COFFEE_URL = 'https://backend.swap.coffee/v1/ton/price';

interface CachedRate {
  rate: number;
  source: string;
  fetchedAt: number;
}

export class PriceOracle {
  private memCache: CachedRate | null = null;

  constructor(private db: Pool) {}

  // ============================================================
  // Public: get TON/USD rate (throws if unavailable)
  // ============================================================
  async getTonUsd(): Promise<number> {
    // 1. In-memory fresh cache
    if (this.memCache && Date.now() - this.memCache.fetchedAt < FRESH_MS) {
      return this.memCache.rate;
    }

    // 2. Try tonapi.io
    const tonapi = await this.fetchTonapi().catch((e) => {
      console.warn('[price-oracle] tonapi failed:', e.message);
      return null;
    });
    if (tonapi) {
      await this.persist(tonapi, 'tonapi');
      this.memCache = { rate: tonapi, source: 'tonapi', fetchedAt: Date.now() };
      return tonapi;
    }

    // 3. Try swap.coffee
    const swap = await this.fetchSwapCoffee().catch((e) => {
      console.warn('[price-oracle] swap.coffee failed:', e.message);
      return null;
    });
    if (swap) {
      await this.persist(swap, 'swap.coffee');
      this.memCache = { rate: swap, source: 'swap.coffee', fetchedAt: Date.now() };
      return swap;
    }

    // 4. Fall back to DB cache (must be fresh enough)
    const cached = await this.loadDbCache();
    if (cached && Date.now() - cached.fetchedAt < DB_CACHE_MAX_AGE_MS) {
      console.warn(
        `[price-oracle] using DB cache from ${cached.source} (${Math.round((Date.now() - cached.fetchedAt) / 1000)}s old)`,
      );
      this.memCache = cached;
      return cached.rate;
    }

    // 5. Total failure
    throw new Error('price_oracle_unavailable');
  }

  // ============================================================
  // Safe variant — returns null on failure (for UI displays)
  // ============================================================
  async tryGetTonUsd(): Promise<number | null> {
    try {
      return await this.getTonUsd();
    } catch {
      return null;
    }
  }

  // ============================================================
  // Data sources
  // ============================================================
  private async fetchTonapi(): Promise<number> {
    const res = await fetch(TONAPI_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`tonapi_http_${res.status}`);
    const data: any = await res.json();
    const rate = Number(data?.rates?.TON?.prices?.USD);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('tonapi_bad_payload');
    return rate;
  }

  private async fetchSwapCoffee(): Promise<number> {
    const res = await fetch(SWAP_COFFEE_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`swap_coffee_http_${res.status}`);
    const data: any = await res.json();
    // swap.coffee may return { price: number } or { data: { price } }
    const rate = Number(data?.price ?? data?.data?.price);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('swap_coffee_bad_payload');
    return rate;
  }

  // ============================================================
  // Persistence
  // ============================================================
  private async persist(rate: number, source: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO exchange_rates_cache (pair, rate, source, fetched_at)
         VALUES ($1, $2, $3, NOW())`,
        [PAIR, rate, source],
      );
    } catch (e: any) {
      console.error('[price-oracle] persist failed:', e.message);
    }
  }

  private async loadDbCache(): Promise<CachedRate | null> {
    try {
      const res = await this.db.query(
        `SELECT rate, source, fetched_at FROM exchange_rates_cache
         WHERE pair = $1 ORDER BY fetched_at DESC LIMIT 1`,
        [PAIR],
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        rate: Number(r.rate),
        source: r.source,
        fetchedAt: new Date(r.fetched_at).getTime(),
      };
    } catch (e: any) {
      console.error('[price-oracle] loadDbCache failed:', e.message);
      return null;
    }
  }
}

// ============================================================
// Singleton (lazy — uses globalThis.__dbPool)
// ============================================================
let _instance: PriceOracle | null = null;

export function getPriceOracle(): PriceOracle {
  if (_instance) return _instance;
  const db = (globalThis as any).__dbPool;
  if (!db) throw new Error('db pool not initialized');
  _instance = new PriceOracle(db);
  return _instance;
}
