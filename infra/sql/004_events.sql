ALTER TABLE events
  ADD COLUMN IF NOT EXISTS blind_structure JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS prize_structure JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS min_players INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS registered_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starting_stack INT DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS late_reg_level INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS prize_pool_collected NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

CREATE TABLE IF NOT EXISTS tournament_results (
  id              BIGSERIAL PRIMARY KEY,
  event_id        BIGINT REFERENCES events(id) ON DELETE CASCADE,
  user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
  rank            INT NOT NULL,
  prize_usd       NUMERIC(18,2) DEFAULT 0,
  hands_played    INT DEFAULT 0,
  eliminated_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_results_event ON tournament_results(event_id, rank);

CREATE TABLE IF NOT EXISTS event_logs (
  id              BIGSERIAL PRIMARY KEY,
  event_id        BIGINT REFERENCES events(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  message         TEXT,
  meta            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_logs_event ON event_logs(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_status_start ON events(status, starts_at);

CREATE OR REPLACE FUNCTION default_blind_structure(p_starting_stack INT DEFAULT 1500)
RETURNS JSONB AS $$
BEGIN
  RETURN '[
    {"level":1,"sb":10,"bb":20,"ante":0,"duration_min":5},
    {"level":2,"sb":15,"bb":30,"ante":0,"duration_min":5},
    {"level":3,"sb":25,"bb":50,"ante":0,"duration_min":5},
    {"level":4,"sb":50,"bb":100,"ante":10,"duration_min":6},
    {"level":5,"sb":75,"bb":150,"ante":15,"duration_min":6},
    {"level":6,"sb":100,"bb":200,"ante":25,"duration_min":8},
    {"level":7,"sb":150,"bb":300,"ante":40,"duration_min":8},
    {"level":8,"sb":200,"bb":400,"ante":50,"duration_min":10},
    {"level":9,"sb":300,"bb":600,"ante":75,"duration_min":10},
    {"level":10,"sb":500,"bb":1000,"ante":100,"duration_min":12},
    {"level":11,"sb":800,"bb":1600,"ante":200,"duration_min":12},
    {"level":12,"sb":1200,"bb":2400,"ante":300,"duration_min":15}
  ]'::jsonb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION default_prize_structure()
RETURNS JSONB AS $$
BEGIN
  RETURN '[
    {"rank":1,"pct":0.40},
    {"rank":2,"pct":0.24},
    {"rank":3,"pct":0.15},
    {"rank":4,"pct":0.10},
    {"rank":5,"pct":0.06},
    {"rank":"6-10","pct":0.01}
  ]'::jsonb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

INSERT INTO events (title, variant, starts_at, buyin_usd, prize_pool_usd, max_players, status, blind_structure, prize_structure, starting_stack)
SELECT 'Daily Freeroll #1', 'holdem', NOW() + INTERVAL '1 hour', 0, 100, 100, 'scheduled',
  default_blind_structure(), default_prize_structure(), 1500
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Daily Freeroll #1');

INSERT INTO events (title, variant, starts_at, buyin_usd, prize_pool_usd, max_players, status, blind_structure, prize_structure, starting_stack)
SELECT 'Weekly Championship', 'holdem', NOW() + INTERVAL '1 day', 5, 500, 200, 'scheduled',
  default_blind_structure(), default_prize_structure(), 2000
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Weekly Championship');