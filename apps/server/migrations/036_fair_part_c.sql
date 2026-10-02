-- ============================================================
-- 036: Provably Fair Part C — player entropy + table-level nonce
--
--  * poker_tables.hand_sequence: atomic per-table hand counter. It is used
--    both as hands.hand_no and as hand_seeds.nonce, so hand numbers and
--    nonces stay unique across server restarts.
--  * table_client_seeds: one player-chosen seed per (table, user).
--  * client_seed_changes: audit + rate limit of seed changes.
--  * hand_seeds: records how the hand's client seed was built and by whom.
-- ============================================================

ALTER TABLE poker_tables ADD COLUMN IF NOT EXISTS hand_sequence BIGINT NOT NULL DEFAULT 0;

-- Backfill: existing tables must not re-issue hand numbers that were already
-- used (the in-memory counter resets on every server restart).
UPDATE poker_tables pt
SET hand_sequence = COALESCE((SELECT MAX(hand_no) FROM hands WHERE table_id = pt.id), 0);

CREATE TABLE IF NOT EXISTS table_client_seeds (
  table_id   BIGINT NOT NULL,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed       TEXT NOT NULL,
  seed_hash  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_id, user_id)
);

CREATE TABLE IF NOT EXISTS client_seed_changes (
  id         BIGSERIAL PRIMARY KEY,
  table_id   BIGINT NOT NULL,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_hash   TEXT,
  new_hash   TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_seed_changes_rate
  ON client_seed_changes (user_id, table_id, changed_at DESC);

ALTER TABLE hand_seeds
  ADD COLUMN IF NOT EXISTS client_seed_hash   TEXT,
  ADD COLUMN IF NOT EXISTS client_seed_source TEXT,
  ADD COLUMN IF NOT EXISTS client_seed_inputs JSONB;

-- The table-level counter outgrows int4 in theory; keep the type honest.
ALTER TABLE hand_seeds ALTER COLUMN nonce TYPE BIGINT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hand_seeds_client_seed_source_check'
  ) THEN
    ALTER TABLE hand_seeds
      ADD CONSTRAINT hand_seeds_client_seed_source_check
      CHECK (client_seed_source IS NULL OR client_seed_source IN ('player', 'server'));
  END IF;
END $$;

COMMENT ON COLUMN poker_tables.hand_sequence IS 'Atomic per-table hand counter: the source of hands.hand_no and hand_seeds.nonce.';
COMMENT ON COLUMN hand_seeds.client_seed_hash IS 'SHA-256 of the combined client seed used for this hand.';
COMMENT ON COLUMN hand_seeds.client_seed_source IS 'player: at least one seated player supplied a seed. server: server-generated.';
COMMENT ON COLUMN hand_seeds.client_seed_inputs IS 'Per-player inputs used to build the combined client seed: [{userId, seed, seedHash}].';

DO $$ BEGIN
  RAISE NOTICE '[036] fair part C ready';
END $$;
