-- D6.1: Recurring Tournament Templates
CREATE TABLE IF NOT EXISTS tournament_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'holdem',
  mode TEXT NOT NULL DEFAULT 'free',
  format TEXT NOT NULL DEFAULT 'sng',
  speed TEXT NOT NULL DEFAULT 'regular',
  buy_in NUMERIC NOT NULL DEFAULT 0,
  fee NUMERIC NOT NULL DEFAULT 0,
  starting_stack BIGINT NOT NULL DEFAULT 5000,
  min_players INTEGER NOT NULL DEFAULT 2,
  max_players INTEGER NOT NULL DEFAULT 100,
  guaranteed NUMERIC NOT NULL DEFAULT 0,
  late_reg_min INTEGER NOT NULL DEFAULT 0,
  late_reg_level INTEGER NOT NULL DEFAULT 0,
  allow_re_entry BOOLEAN NOT NULL DEFAULT FALSE,
  max_re_entries INTEGER NOT NULL DEFAULT 1,
  is_bounty BOOLEAN NOT NULL DEFAULT FALSE,
  bounty_amount NUMERIC NOT NULL DEFAULT 0,
  satellite_target_id BIGINT REFERENCES tournaments(id),
  seats_awarded INTEGER NOT NULL DEFAULT 0,
  blind_structure_id BIGINT NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'daily',
  schedule_time TEXT NOT NULL DEFAULT '14:00',
  schedule_day INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_templates_next_run
  ON tournament_templates (is_active, next_run_at)
  WHERE is_active = TRUE;