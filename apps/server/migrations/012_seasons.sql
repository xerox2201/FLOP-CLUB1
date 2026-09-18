-- D6.2: Seasons + Tournament Points

CREATE TABLE IF NOT EXISTS seasons (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  prize_pool NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS season_id BIGINT REFERENCES seasons(id);

ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tournaments_season
  ON tournaments(season_id);

CREATE INDEX IF NOT EXISTS idx_tournament_entries_season_points
  ON tournament_entries(tournament_id, points_earned)
  WHERE points_earned > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_one_active
  ON seasons (status) WHERE status = 'active';