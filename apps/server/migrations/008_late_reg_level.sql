-- Add late_reg_level to tournaments
-- Standard MTT uses "levels" not "minutes" for late registration.
-- 0 = no late reg (registration closes at start)

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS late_reg_level INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN tournaments.late_reg_level IS 'Last level at which new players can register. 0 = no late reg.';

-- Index for the auto-close check
CREATE INDEX IF NOT EXISTS idx_tournaments_late_reg
  ON tournaments (status, current_level)
  WHERE status IN ('running', 'final_table');