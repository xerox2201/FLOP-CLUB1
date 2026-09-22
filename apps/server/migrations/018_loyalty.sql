-- ============================================================
-- 018: Loyalty System — XP, Tier, Rakeback, XP tx, Shop, Vouchers, Seeds
-- All tables idempotent. 7 tables total.
-- ============================================================

-- ============================================================
-- 1. user_xp — lifetime XP + claimed XP
-- ============================================================
CREATE TABLE IF NOT EXISTS user_xp (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lifetime_xp   BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_xp >= 0),
  claimed_xp    BIGINT NOT NULL DEFAULT 0 CHECK (claimed_xp >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  user_xp IS 'Lifetime XP never decreases. claimed_xp is the amount already cashed out (always ≤ lifetime_xp).';
COMMENT ON COLUMN user_xp.lifetime_xp IS 'Total XP earned. Never decreases, even after cash out.';
COMMENT ON COLUMN user_xp.claimed_xp IS 'XP cashed out to wallet. Effective balance = lifetime_xp - claimed_xp.';

-- ============================================================
-- 2. user_tier — progressive rakeback tier
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tier (
  user_id        BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier           TEXT NOT NULL DEFAULT 'welcome'
                 CHECK (tier IN ('welcome','bronze','silver','gold','platinum','diamond')),
  lifetime_rake  NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (lifetime_rake >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  user_tier IS 'Rakeback tier. Separate from XP level. tier is derived from lifetime_rake.';

-- ============================================================
-- 3. rakeback_log — one row per (hand, user)
-- ============================================================
CREATE TABLE IF NOT EXISTS rakeback_log (
  id          BIGSERIAL PRIMARY KEY,
  hand_id     BIGINT NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hand_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rakeback_log_user_created
  ON rakeback_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rakeback_log_hand
  ON rakeback_log (hand_id);

COMMENT ON TABLE rakeback_log IS 'Rakeback paid per hand per user. UNIQUE(hand_id,user_id) for idempotency.';

-- ============================================================
-- 4. xp_transactions — ledger of all XP moves
-- ============================================================
CREATE TABLE IF NOT EXISTS xp_transactions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      BIGINT NOT NULL,               -- +earn, -claim
  source      TEXT NOT NULL
              CHECK (source IN ('hand_rakeback','seed','claim','freeroll','bonus')),
  ref_id      BIGINT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_tx_user_created
  ON xp_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_tx_source
  ON xp_transactions (source, created_at DESC);

COMMENT ON TABLE xp_transactions IS 'Immutable ledger of XP credits/debits. amount > 0 = earn, amount < 0 = claim.';

-- ============================================================
-- 5. shop_purchases
-- ============================================================
CREATE TABLE IF NOT EXISTS shop_purchases (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id         TEXT NOT NULL,
  ton_amount      NUMERIC(18,9) NOT NULL CHECK (ton_amount >= 0),
  usd_amount      NUMERIC(18,2) NOT NULL CHECK (usd_amount >= 0),
  chips_awarded   BIGINT NOT NULL DEFAULT 0,
  xp_awarded      BIGINT NOT NULL DEFAULT 0,
  voucher_amount  NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (voucher_amount >= 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','failed','refunded')),
  ton_tx_hash     TEXT,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shop_purchases_user
  ON shop_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_status
  ON shop_purchases (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_ton_tx
  ON shop_purchases (ton_tx_hash) WHERE ton_tx_hash IS NOT NULL;

COMMENT ON TABLE shop_purchases IS 'Purchase records. status=pending until TON tx confirms.';

-- ============================================================
-- 6. vouchers
-- ============================================================
CREATE TABLE IF NOT EXISTS vouchers (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount              NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  min_rake            NUMERIC(18,2) NOT NULL CHECK (min_rake > 0),
  current_rake        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (current_rake >= 0),
  used                BOOLEAN NOT NULL DEFAULT FALSE,
  used_at             TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL,
  source_purchase_id  BIGINT REFERENCES shop_purchases(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_user_active
  ON vouchers (user_id, used, expires_at)
  WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_vouchers_expires
  ON vouchers (expires_at) WHERE used = FALSE;

COMMENT ON TABLE vouchers IS 'Conditional cash rewards. Unlock when current_rake >= min_rake before expires_at.';

-- ============================================================
-- 7. seeds — log of claimed free seeds
-- ============================================================
CREATE TABLE IF NOT EXISTS seeds (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed_type   TEXT NOT NULL
              CHECK (seed_type IN ('bronze','silver','gold','platinum')),
  amount      NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  claimed     BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, seed_type)
);

CREATE INDEX IF NOT EXISTS idx_seeds_user
  ON seeds (user_id, claimed, created_at DESC);

COMMENT ON TABLE seeds IS 'Free seed claims. Definitions are hardcoded in backend; this table is the claim log.';