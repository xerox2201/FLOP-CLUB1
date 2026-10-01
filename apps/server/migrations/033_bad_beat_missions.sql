-- ============================================================
-- 033: Bad Beat Jackpot (pool + payouts) and Daily Missions
-- Tables: bad_beat_pool, bad_beat_payouts, missions, mission_progress
-- All statements idempotent.
-- Money basis: bad beat contribution = 2% of rake (= $2 per $100 rake).
-- ============================================================

-- ============================================================
-- 1. bad_beat_pool - singleton row (id = 1) holding the live pool
-- ============================================================
CREATE TABLE IF NOT EXISTS bad_beat_pool (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  amount_usd  NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bad_beat_pool (id, amount_usd) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE  bad_beat_pool IS 'Singleton row (id = 1): live bad beat jackpot pool. Funded by 2% of rake per hand.';
COMMENT ON COLUMN bad_beat_pool.amount_usd IS 'Current pool balance in USD. Paid out on quad_plus / straight_flush triggers.';

-- House account that physically holds the jackpot between hits.
INSERT INTO accounts (code, type) VALUES ('HOUSE_BAD_BEAT', 'house')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. bad_beat_payouts - one row per recipient per triggered hand
-- ============================================================
CREATE TABLE IF NOT EXISTS bad_beat_payouts (
  id          BIGSERIAL PRIMARY KEY,
  hand_id     BIGINT NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL CHECK (tier IN ('quad_plus','straight_flush')),
  amount_usd  NUMERIC(18,2) NOT NULL CHECK (amount_usd >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bad_beat_payouts_created
  ON bad_beat_payouts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bad_beat_payouts_user
  ON bad_beat_payouts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bad_beat_payouts_hand
  ON bad_beat_payouts (hand_id);

COMMENT ON TABLE bad_beat_payouts IS 'Bad beat payouts. Ledger idempotency key: bad_beat_hand_{hand_id}.';

-- ============================================================
-- 3. missions - daily mission definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS missions (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  metric        TEXT NOT NULL
                CHECK (metric IN ('hands_played','hands_won','tournaments_played','showdowns_won','omaha_hands_played')),
  threshold     INTEGER NOT NULL CHECK (threshold > 0),
  reward_chips  BIGINT NOT NULL DEFAULT 0 CHECK (reward_chips >= 0),
  reward_xp     BIGINT NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  missions IS 'Daily mission definitions. Progress resets every UTC day (see mission_progress.day).';
COMMENT ON COLUMN missions.metric IS 'Counter incremented by MissionService.trackProgress().';

-- ============================================================
-- 4. mission_progress - per user / mission / UTC day
-- ============================================================
CREATE TABLE IF NOT EXISTS mission_progress (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id  BIGINT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  claimed     BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, mission_id, day)
);

CREATE INDEX IF NOT EXISTS idx_mission_progress_user_day
  ON mission_progress (user_id, day);
CREATE INDEX IF NOT EXISTS idx_mission_progress_day
  ON mission_progress (day);

COMMENT ON TABLE mission_progress IS 'Daily mission progress. PK(user_id, mission_id, day) keeps tracking idempotent per day.';

-- ============================================================
-- 5. Seed the 5 daily missions (idempotent upsert on code)
-- ============================================================
INSERT INTO missions (code, title, description, metric, threshold, reward_chips, reward_xp, is_active) VALUES
  ('play_10_hands',   'Play 10 Hands',     'Play 10 hands today',       'hands_played',       10, 500,  50,  TRUE),
  ('win_3_hands',     'Win 3 Hands',       'Win 3 hands today',         'hands_won',           3, 1000, 100, TRUE),
  ('play_tournament', 'Play a Tournament', 'Play any tournament today', 'tournaments_played',  1, 2000, 200, TRUE),
  ('win_showdown',    'Win a Showdown',    'Win a showdown today',      'showdowns_won',       1, 750,  75,  TRUE),
  ('play_omaha',      'Play Omaha',        'Play an Omaha hand today',  'omaha_hands_played',  1, 500,  50,  TRUE)
ON CONFLICT (code) DO UPDATE SET
  title        = EXCLUDED.title,
  description  = EXCLUDED.description,
  metric       = EXCLUDED.metric,
  threshold    = EXCLUDED.threshold,
  reward_chips = EXCLUDED.reward_chips,
  reward_xp    = EXCLUDED.reward_xp,
  is_active    = EXCLUDED.is_active;

DO $$ BEGIN
  RAISE NOTICE '[033] bad_beat_pool, bad_beat_payouts, missions, mission_progress ready';
END $$;
