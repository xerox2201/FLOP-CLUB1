-- ============================================================
-- 034: Weekly Rake Race
-- Table: weekly_race_entries
-- One row per user per week (bracket is derived from weekly rake and
-- is kept in the unique key as a safety net).
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_race_entries (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  bracket     TEXT NOT NULL CHECK (bracket IN ('bronze','silver','gold')),
  total_rake  NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_rake >= 0),
  rank        INTEGER CHECK (rank IS NULL OR rank > 0),
  prize_usd   NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (prize_usd >= 0),
  paid        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start, bracket)
);

-- Leaderboard scan per bracket, highest rake first.
CREATE INDEX IF NOT EXISTS idx_weekly_race_board
  ON weekly_race_entries (week_start, bracket, total_rake DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_race_user
  ON weekly_race_entries (user_id, week_start DESC);

COMMENT ON TABLE  weekly_race_entries IS 'Weekly rake race. week_start is the Monday (UTC) of the race week.';
COMMENT ON COLUMN weekly_race_entries.bracket IS 'bronze: $0-50 weekly rake, silver: $50-500, gold: $500+. Updated as weekly rake grows.';
COMMENT ON COLUMN weekly_race_entries.prize_usd IS 'Prize for the settled week. paid=TRUE once the ledger payment was recorded.';

DO $$ BEGIN
  RAISE NOTICE '[034] weekly_race_entries ready';
END $$;
