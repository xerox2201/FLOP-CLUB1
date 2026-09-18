-- D5.3: Re-entry + Bounty

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS allow_re_entry BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_re_entries INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_bounty BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bounty_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS re_entry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS bounty_earned NUMERIC NOT NULL DEFAULT 0;

-- eliminated_by might already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_players' AND column_name = 'eliminated_by'
  ) THEN
    ALTER TABLE tournament_players ADD COLUMN eliminated_by BIGINT;
  END IF;
END $$;