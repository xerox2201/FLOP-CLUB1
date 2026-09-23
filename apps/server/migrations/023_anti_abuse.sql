-- ============================================================
-- 023: Anti-abuse + Freeroll grace + Rebuy/Addon schema
-- ============================================================

-- 1. Freeroll launch grace (first 30 days → min prize $5)
ALTER TABLE freeroll_config
  ADD COLUMN IF NOT EXISTS launch_grace_until TIMESTAMPTZ
    DEFAULT (NOW() + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS grace_min_prize_usd NUMERIC(18,2) NOT NULL DEFAULT 5.00;

COMMENT ON COLUMN freeroll_config.launch_grace_until IS
  'Until this timestamp, freeroll min prize uses grace_min_prize_usd';
COMMENT ON COLUMN freeroll_config.grace_min_prize_usd IS
  'Minimum prize during launch grace period';

-- 2. First-withdrawal anti-abuse flag
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_withdrawal_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_withdrawal_at TIMESTAMPTZ;

COMMENT ON COLUMN users.first_withdrawal_unlocked IS
  'TRUE once user completes all anti-abuse conditions and can withdraw freely';

-- 3. Rebuy / Addon schema on tournaments
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS allow_rebuy BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_rebuys INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebuy_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebuy_stack BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebuy_until_level INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_addon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS addon_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_stack BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_at_level INT NOT NULL DEFAULT 0;

ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS rebuy_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_addon BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS rebuy_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_addon BOOLEAN NOT NULL DEFAULT FALSE;