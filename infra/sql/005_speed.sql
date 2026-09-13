ALTER TABLE poker_tables
  ADD COLUMN IF NOT EXISTS speed TEXT DEFAULT 'regular';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS speed TEXT DEFAULT 'regular';

CREATE INDEX IF NOT EXISTS idx_poker_tables_speed ON poker_tables(speed);
CREATE INDEX IF NOT EXISTS idx_events_speed ON events(speed);