-- ============================================================
-- Blind Structures (templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS blind_structures (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  starting_stack BIGINT NOT NULL,
  is_turbo BOOLEAN DEFAULT FALSE,
  is_hyper BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blind_levels (
  id BIGSERIAL PRIMARY KEY,
  structure_id BIGINT REFERENCES blind_structures(id) ON DELETE CASCADE,
  level INT NOT NULL,
  small_blind NUMERIC(18,2) NOT NULL,
  big_blind NUMERIC(18,2) NOT NULL,
  ante NUMERIC(18,2) DEFAULT 0,
  duration_sec INT NOT NULL DEFAULT 600,
  is_break BOOLEAN DEFAULT FALSE,
  UNIQUE(structure_id, level)
);

CREATE INDEX IF NOT EXISTS idx_blind_levels_struct ON blind_levels(structure_id, level);

-- ============================================================
-- Tournaments
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  variant TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'real',
  format TEXT NOT NULL DEFAULT 'mtt',
  speed TEXT DEFAULT 'regular',
  buy_in NUMERIC(18,2) NOT NULL DEFAULT 0,
  fee NUMERIC(18,2) NOT NULL DEFAULT 0,
  starting_stack BIGINT NOT NULL,
  min_players INT DEFAULT 2,
  max_players INT DEFAULT 1000,
  guaranteed NUMERIC(18,2) DEFAULT 0,
  scheduled_start TIMESTAMPTZ,
  late_reg_min INT DEFAULT 0,
  blind_structure_id BIGINT REFERENCES blind_structures(id),
  current_level INT DEFAULT 0,
  level_started_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled',
  -- status: scheduled | registering | running | paused | final_table | finished | cancelled
  is_private BOOLEAN DEFAULT FALSE,
  invite_code TEXT,
  password_hash TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  winner_user_id BIGINT REFERENCES users(id),
  total_prize_pool NUMERIC(18,2) DEFAULT 0,
  total_rake NUMERIC(18,2) DEFAULT 0,
  total_players INT DEFAULT 0,
  config JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_tournaments_variant ON tournaments(variant, format);

-- ============================================================
-- Tournament Entries
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_entries (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'registered',
  -- status: registered | playing | eliminated | won | cashed | refunded
  starting_stack BIGINT,
  final_position INT,
  payout_amount NUMERIC(18,2) DEFAULT 0,
  rebuy_count INT DEFAULT 0,
  UNIQUE(tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_t_entries_tourney ON tournament_entries(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_t_entries_user ON tournament_entries(user_id, registered_at DESC);

-- ============================================================
-- Tournament Players (active in-play state)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_players (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id),
  stack BIGINT NOT NULL,
  table_number INT,
  seat INT,
  status TEXT DEFAULT 'active',
  -- status: active | sitting_out | eliminated | winner
  eliminated_at TIMESTAMPTZ,
  eliminated_by BIGINT REFERENCES users(id),
  final_position INT,
  UNIQUE(tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_t_players_tourney ON tournament_players(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_t_players_table ON tournament_players(tournament_id, table_number, seat);

-- ============================================================
-- Tournament Tables
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_tables (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  table_number INT NOT NULL,
  max_seats INT DEFAULT 9,
  status TEXT DEFAULT 'active',
  is_final BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_t_tables_tourney ON tournament_tables(tournament_id, status);

-- ============================================================
-- Tournament Payouts (structure per tournament)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_payouts (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  position INT NOT NULL,
  percentage NUMERIC(6,4) NOT NULL,
  fixed_amount NUMERIC(18,2),
  UNIQUE(tournament_id, position)
);

CREATE INDEX IF NOT EXISTS idx_t_payouts_tourney ON tournament_payouts(tournament_id, position);

-- ============================================================
-- Tournament Blind Level Log (history)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_level_log (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  level INT NOT NULL,
  sb NUMERIC(18,2),
  bb NUMERIC(18,2),
  ante NUMERIC(18,2),
  players_remaining INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, level)
);

-- ============================================================
-- Wallet ledger accounts for tournaments
-- ============================================================
INSERT INTO accounts (code, type) VALUES
  ('SYSTEM_TOURNAMENT_ENTRY', 'system'),
  ('SYSTEM_TOURNAMENT_PRIZE', 'system'),
  ('SYSTEM_TOURNAMENT_RAKE', 'system'),
  ('SYSTEM_TOURNAMENT_REFUND', 'system')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 🔴 Seed Blind Structures
-- ============================================================
INSERT INTO blind_structures (name, description, starting_stack, is_turbo, is_hyper) VALUES
  ('Regular MTT', '10k stack · 10min levels · 15min break every 6', 10000, FALSE, FALSE),
  ('Turbo MTT', '5k stack · 5min levels · shorter', 5000, TRUE, FALSE),
  ('Hyper MTT', '3k stack · 3min levels · fast', 3000, TRUE, TRUE),
  ('SNG Regular', '1500 stack · 8min levels · 9 players', 1500, FALSE, FALSE),
  ('SNG Turbo', '1500 stack · 3min levels · 9 players', 1500, TRUE, FALSE),
  ('Heads-Up', '1500 stack · 5min levels · 2 players', 1500, FALSE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Regular MTT levels
WITH s AS (SELECT id FROM blind_structures WHERE name = 'Regular MTT')
INSERT INTO blind_levels (structure_id, level, small_blind, big_blind, ante, duration_sec, is_break) 
SELECT s.id, level, sb, bb, ante, dur, is_b
FROM s, (VALUES
  (1,   25,   50,    0, 600, FALSE),
  (2,   50,  100,    0, 600, FALSE),
  (3,   75,  150,    0, 600, FALSE),
  (4,  100,  200,   25, 600, FALSE),
  (5,  150,  300,   25, 600, FALSE),
  (6,  200,  400,   50, 600, FALSE),
  (7,    0,    0,    0, 900, TRUE),  -- break
  (8,  300,  600,   75, 600, FALSE),
  (9,  400,  800,  100, 600, FALSE),
  (10, 600, 1200,  150, 600, FALSE),
  (11, 800, 1600,  200, 600, FALSE),
  (12,1000, 2000,  250, 600, FALSE),
  (13,    0,    0,    0, 900, TRUE),  -- break
  (14,1500, 3000,  400, 600, FALSE),
  (15,2000, 4000,  500, 600, FALSE),
  (16,3000, 6000,  750, 600, FALSE),
  (17,4000, 8000, 1000, 600, FALSE),
  (18,5000,10000, 1250, 600, FALSE)
) AS t(level, sb, bb, ante, dur, is_b)
ON CONFLICT (structure_id, level) DO NOTHING;

-- Turbo MTT
WITH s AS (SELECT id FROM blind_structures WHERE name = 'Turbo MTT')
INSERT INTO blind_levels (structure_id, level, small_blind, big_blind, ante, duration_sec, is_break)
SELECT s.id, level, sb, bb, ante, dur, is_b
FROM s, (VALUES
  (1,   25,   50,    0, 300, FALSE),
  (2,   50,  100,   10, 300, FALSE),
  (3,  100,  200,   25, 300, FALSE),
  (4,  150,  300,   30, 300, FALSE),
  (5,  200,  400,   50, 300, FALSE),
  (6,  300,  600,   75, 300, FALSE),
  (7,  500, 1000,  100, 300, FALSE),
  (8,  800, 1600,  200, 300, FALSE),
  (9, 1200, 2400,  300, 300, FALSE),
  (10,2000, 4000,  500, 300, FALSE)
) AS t(level, sb, bb, ante, dur, is_b)
ON CONFLICT (structure_id, level) DO NOTHING;

-- SNG Turbo (9 players, 1500 stack)
WITH s AS (SELECT id FROM blind_structures WHERE name = 'SNG Turbo')
INSERT INTO blind_levels (structure_id, level, small_blind, big_blind, ante, duration_sec, is_break)
SELECT s.id, level, sb, bb, ante, dur, is_b
FROM s, (VALUES
  (1,   10,   20,    0, 180, FALSE),
  (2,   15,   30,    0, 180, FALSE),
  (3,   25,   50,    0, 180, FALSE),
  (4,   50,  100,    0, 180, FALSE),
  (5,   75,  150,   10, 180, FALSE),
  (6,  100,  200,   25, 180, FALSE),
  (7,  150,  300,   25, 180, FALSE),
  (8,  200,  400,   50, 180, FALSE),
  (9,  300,  600,   75, 180, FALSE),
  (10, 500, 1000,  100, 180, FALSE)
) AS t(level, sb, bb, ante, dur, is_b)
ON CONFLICT (structure_id, level) DO NOTHING;