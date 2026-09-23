-- ============================================================
-- 022: Freeroll daily scheduler
-- ============================================================

CREATE TABLE IF NOT EXISTS freeroll_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_hour_utc INT NOT NULL DEFAULT 20,
  schedule_minute_utc INT NOT NULL DEFAULT 0,
  min_players INT NOT NULL DEFAULT 10,
  max_players INT NOT NULL DEFAULT 100000,
  min_deposit_usd NUMERIC(18,2) NOT NULL DEFAULT 5,
  starting_stack BIGINT NOT NULL DEFAULT 5000,
  speed TEXT NOT NULL DEFAULT 'turbo',
  variant TEXT NOT NULL DEFAULT 'holdem',
  blind_structure_id BIGINT REFERENCES blind_structures(id),
  min_prize_usd NUMERIC(18,2) NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO freeroll_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS freeroll_history (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  prize_usd NUMERIC(18,2) NOT NULL,
  net_revenue_usd NUMERIC(18,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','running','finished','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freeroll_history_start
  ON freeroll_history (scheduled_start DESC);

CREATE INDEX IF NOT EXISTS idx_freeroll_history_tournament
  ON freeroll_history (tournament_id);