-- D5.4: Satellites
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS satellite_target_id BIGINT REFERENCES tournaments(id),
  ADD COLUMN IF NOT EXISTS seats_awarded INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS satellite_tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  target_tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  source_tournament_id BIGINT NOT NULL REFERENCES tournaments(id),
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  UNIQUE(target_tournament_id, source_tournament_id, position)
);

CREATE INDEX IF NOT EXISTS idx_satellite_tickets_user
  ON satellite_tickets(user_id, used, target_tournament_id);

CREATE INDEX IF NOT EXISTS idx_satellite_tickets_target
  ON satellite_tickets(target_tournament_id, used);