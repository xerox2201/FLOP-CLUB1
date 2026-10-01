-- ============================================================
-- 031: Fix referral_earnings unique constraint
-- ------------------------------------------------------------
-- Bug: UNIQUE(hand_id, referrer_id, level) blocked a referrer
-- from earning commission from TWO different referees who
-- played the same hand at the same table.
-- Correct: include referee_id in the unique key.
-- ============================================================

DROP INDEX IF EXISTS idx_referral_earnings_hand_lvl;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_earnings_hand_ref_lvl
  ON referral_earnings (hand_id, referrer_id, referee_id, level)
  WHERE hand_id IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE '[031] ✅ referral_earnings unique index fixed';
END $$;