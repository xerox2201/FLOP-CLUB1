-- 021: Withdrawal conditions for bonus/free rewards
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bonus_playthrough_pending NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_rake_pending NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_real_hands_pending INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_daily_refill_at TIMESTAMPTZ;