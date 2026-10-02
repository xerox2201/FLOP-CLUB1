-- ============================================================
-- 035: Provably Fair — hand_seeds
-- Source of truth for the commit/reveal of one hand.
-- One row per persisted hand (tournament hands are not persisted).
--
-- commit: served at hand start -> server_seed_hash (+ client_seed, nonce)
-- reveal: served at hand end   -> server_seed + deck_hash
--
-- The algorithm column pins the deck derivation version. deck-v1 is a
-- frozen snapshot of the engine shuffle; it must never change, a new
-- version is added instead.
-- ============================================================

CREATE TABLE IF NOT EXISTS hand_seeds (
  hand_id          BIGINT PRIMARY KEY REFERENCES hands(id) ON DELETE CASCADE,
  table_id         BIGINT,
  hand_no          BIGINT,
  algorithm        TEXT NOT NULL DEFAULT 'deck-v1',
  server_seed_hash TEXT NOT NULL,
  server_seed      TEXT,
  client_seed      TEXT NOT NULL,
  nonce            INTEGER NOT NULL,
  deck_hash        TEXT,
  committed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revealed_at      TIMESTAMPTZ
);

-- A commitment must never be reused by another hand.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hand_seeds_commitment
  ON hand_seeds (server_seed_hash);

-- Verification looks the hand up by its commitment hash.
CREATE INDEX IF NOT EXISTS idx_hand_seeds_revealed
  ON hand_seeds (revealed_at);

COMMENT ON TABLE  hand_seeds IS 'Provably Fair commit/reveal per hand. Source of truth; hands.server_seed is only a mirror.';
COMMENT ON COLUMN hand_seeds.algorithm IS 'Deck derivation version. deck-v1 is frozen: never edit it, add deck-v2 instead.';
COMMENT ON COLUMN hand_seeds.server_seed_hash IS 'SHA-256 of server_seed. Committed before any card is dealt.';
COMMENT ON COLUMN hand_seeds.server_seed IS 'NULL until the hand ends. Revealed by the verifier.';
COMMENT ON COLUMN hand_seeds.nonce IS 'Reserved for the table-level hand counter (Part C). Currently always 1.';
COMMENT ON COLUMN hand_seeds.deck_hash IS 'SHA-256 of the deck derived from server_seed via algorithm.';

DO $$ BEGIN
  RAISE NOTICE '[035] hand_seeds ready';
END $$;
