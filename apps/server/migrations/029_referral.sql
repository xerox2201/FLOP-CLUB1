-- ============================================================
-- 029: Referral 2-level + Group affiliates + Milestones
-- ============================================================

-- 1. Referral edges (each user has at most ONE referrer)
CREATE TABLE IF NOT EXISTS referral_edges (
  id              BIGSERIAL PRIMARY KEY,
  referrer_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  level           INT NOT NULL DEFAULT 1 CHECK (level IN (1,2)),
  source_type     TEXT NOT NULL DEFAULT 'user'
                  CHECK (source_type IN ('user','group','channel')),
  source_code     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 months')
);

CREATE INDEX IF NOT EXISTS idx_referral_edges_referrer
  ON referral_edges (referrer_id, level);

-- 2. Per-hand referral earnings
CREATE TABLE IF NOT EXISTS referral_earnings (
  id              BIGSERIAL PRIMARY KEY,
  referrer_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hand_id         BIGINT REFERENCES hands(id),
  level           INT NOT NULL,
  rake_share      NUMERIC(18,2) NOT NULL,
  rate_applied    NUMERIC(5,4) NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  source          TEXT NOT NULL DEFAULT 'direct',
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ledger_tx_id    BIGINT REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_ref_earn_referrer
  ON referral_earnings (referrer_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_ref_earn_hand
  ON referral_earnings (hand_id, referrer_id);

-- 3. Group affiliates
CREATE TABLE IF NOT EXISTS group_affiliates (
  id                    BIGSERIAL PRIMARY KEY,
  owner_user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_group_id     BIGINT UNIQUE NOT NULL,
  telegram_group_title  TEXT NOT NULL,
  telegram_group_type   TEXT NOT NULL
                        CHECK (telegram_group_type IN ('group','supergroup','channel')),
  invite_link           TEXT,
  short_code            TEXT UNIQUE NOT NULL,
  rate_pct              NUMERIC(5,4) NOT NULL DEFAULT 0.08,
  total_members         INT NOT NULL DEFAULT 0,
  active_members        INT NOT NULL DEFAULT 0,
  total_group_rake      NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_earnings        NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 months'),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_affiliates_owner
  ON group_affiliates (owner_user_id);

-- 4. Group membership tracking
CREATE TABLE IF NOT EXISTS group_members (
  group_affiliate_id  BIGINT NOT NULL REFERENCES group_affiliates(id) ON DELETE CASCADE,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at      TIMESTAMPTZ,
  total_rake_from     NUMERIC(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (group_affiliate_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);

-- 5. Milestones
CREATE TABLE IF NOT EXISTS referral_milestones (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  threshold     INT NOT NULL,
  metric        TEXT NOT NULL CHECK (metric IN ('active_refs','lifetime_earned','total_refs')),
  reward_chips  INT NOT NULL DEFAULT 0,
  reward_usd    NUMERIC(18,2) NOT NULL DEFAULT 0,
  reward_xp     INT NOT NULL DEFAULT 0,
  sort_order    INT NOT NULL DEFAULT 0
);

INSERT INTO referral_milestones
  (code, name, description, threshold, metric, reward_chips, reward_usd, reward_xp, sort_order)
VALUES
  ('first_ref',    'First Referral',     'Invite your first friend',      1,  'active_refs',      5000,  0,   100,  10),
  ('refs_5',       'Squad Builder',      'Get 5 active referrals',        5,  'active_refs',     10000,  5,   250,  20),
  ('refs_10',      'Networker',          'Get 10 active referrals',      10,  'active_refs',     20000, 15,   500,  30),
  ('refs_25',      'Ambassador',         'Get 25 active referrals',      25,  'active_refs',    100000, 100,  2000,  40),
  ('earned_100',   'Century Club',       'Earn $100 from referrals',    100,  'lifetime_earned', 10000, 20,   500,  50),
  ('earned_500',   'Big Earner',         'Earn $500 from referrals',    500,  'lifetime_earned', 50000, 50,  1500,  60),
  ('earned_1000',  'Referral Legend',    'Earn $1,000 from referrals', 1000,  'lifetime_earned',100000,100,  3000,  70)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS referral_milestone_claims (
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_id   INT NOT NULL REFERENCES referral_milestones(id) ON DELETE CASCADE,
  claimed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, milestone_id)
);

-- 6. Duo bonuses (monthly)
CREATE TABLE IF NOT EXISTS referral_duo_bonuses (
  id              BIGSERIAL PRIMARY KEY,
  referrer_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_year      TEXT NOT NULL,
  referrer_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  referee_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_id, referee_id, month_year)
);

-- 7. Pending referral attributions (from /start ref_XXX)
CREATE TABLE IF NOT EXISTS pending_referrals (
  telegram_user_id  BIGINT PRIMARY KEY,
  code              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_pending_referrals_expiry
  ON pending_referrals (expires_at);

-- 8. Add referral_code to users (short code per user)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_referral_code
  ON users (referral_code) WHERE referral_code IS NOT NULL;

-- Backfill existing users
UPDATE users
SET referral_code = 'ref_' || substr(md5(id::text || created_at::text), 1, 8)
WHERE referral_code IS NULL;

DO $$ BEGIN
  RAISE NOTICE '[029] ✅ referral system ready';
END $$;