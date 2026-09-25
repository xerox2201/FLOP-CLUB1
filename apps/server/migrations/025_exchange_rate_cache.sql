-- 025: Exchange rate cache — for TON/USD live pricing
-- Replaces hardcoded TON_PRICE_USD env var with oracle-backed live rate.
-- Fallback chain: tonapi.io → swap.coffee → latest cached (age < 30min).

CREATE TABLE IF NOT EXISTS exchange_rates_cache (
  id          BIGSERIAL PRIMARY KEY,
  pair        TEXT NOT NULL,
  rate        NUMERIC(18,8) NOT NULL CHECK (rate > 0),
  source      TEXT NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_fetched
  ON exchange_rates_cache (pair, fetched_at DESC);

COMMENT ON TABLE exchange_rates_cache IS
  'Historical cache of live FX rates. PriceOracle reads latest row when APIs fail.';