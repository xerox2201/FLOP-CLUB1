-- 019: Grandfather clause
-- Users who joined during the first 3 months keep their generous rakeback forever.
-- The column is a simple flag; the business logic reads it in rakeback calc.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS grandfathered BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.grandfathered IS
  'TRUE if user joined during the first 3 months — keeps generous rakeback forever.';

CREATE INDEX IF NOT EXISTS idx_users_grandfathered
  ON users (grandfathered) WHERE grandfathered = TRUE;