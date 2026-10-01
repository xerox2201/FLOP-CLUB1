-- ============================================================
-- 030: Referral polish — accurate rake tracking + active detection
-- ============================================================

-- 1. Store exact rake_share per user per hand (was lost before)
ALTER TABLE rakeback_log
  ADD COLUMN IF NOT EXISTS rake_share NUMERIC(18,2);

-- Backfill existing rows using tier at the time (best-effort)
UPDATE rakeback_log rl
SET rake_share = ROUND(
  rl.amount / COALESCE((
    SELECT CASE
      WHEN ut.tier = 'welcome'  THEN 0.60
      WHEN ut.tier = 'bronze'   THEN 0.50
      WHEN ut.tier = 'silver'   THEN 0.45
      WHEN ut.tier = 'gold'     THEN 0.40
      WHEN ut.tier = 'platinum' THEN 0.35
      WHEN ut.tier = 'diamond'  THEN 0.30
      ELSE 0.25
    END
    FROM user_tier ut WHERE ut.user_id = rl.user_id
  ), 0.25) * 100
) / 100
WHERE rl.rake_share IS NULL AND rl.amount > 0;

CREATE INDEX IF NOT EXISTS idx_rakeback_log_rake_share
  ON rakeback_log (user_id, created_at DESC)
  WHERE rake_share IS NOT NULL;

-- 2. Referral edge tracking (active detection)
ALTER TABLE referral_edges
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_rake_from NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned_for_referrer NUMERIC(18,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_referral_edges_active
  ON referral_edges (referrer_id, last_active_at DESC)
  WHERE last_active_at IS NOT NULL;

-- 3. Unique index for referral_earnings idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_earnings_hand_lvl
  ON referral_earnings (hand_id, referrer_id, level)
  WHERE hand_id IS NOT NULL;

-- 4. Group affiliate per-member rake tracking
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_earned_for_group NUMERIC(18,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_group_members_active
  ON group_members (group_affiliate_id, last_active_at DESC)
  WHERE last_active_at IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE '[030] ✅ referral polish ready';
END $$;