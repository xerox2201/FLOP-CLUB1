-- 017: Track free-play win stats
-- Adds free_won (sum of positive chip deltas) and free_hands_won (count of winning hands).
-- free_hands itself is already `free_chips.total_hands` — we just rename in API.
-- Idempotent.

ALTER TABLE free_chips
  ADD COLUMN IF NOT EXISTS free_won BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_hands_won INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN free_chips.free_won IS 'Sum of positive chip deltas from free hands (play_money_log.delta > 0, reason=hand_result).';
COMMENT ON COLUMN free_chips.free_hands_won IS 'Count of free hands where the player came out ahead.';

-- Backfill free_won from play_money_log
UPDATE free_chips fc SET free_won = COALESCE((
  SELECT SUM(pml.delta) FROM play_money_log pml
  WHERE pml.user_id = fc.user_id
    AND pml.reason = 'hand_result'
    AND pml.delta > 0
), 0)
WHERE free_won = 0;

-- Backfill free_hands_won
UPDATE free_chips fc SET free_hands_won = COALESCE((
  SELECT COUNT(*)::int FROM play_money_log pml
  WHERE pml.user_id = fc.user_id
    AND pml.reason = 'hand_result'
    AND pml.delta > 0
), 0)
WHERE free_hands_won = 0;