-- ============================================================
-- 014: Achievements system
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  icon            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general',
  threshold       INT NOT NULL DEFAULT 1,
  reward_chips    INT NOT NULL DEFAULT 0,
  reward_usd      NUMERIC(18,2) NOT NULL DEFAULT 0,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_category
  ON achievements (category, sort_order);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  INT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress        INT NOT NULL DEFAULT 0,
  unlocked_at     TIMESTAMPTZ,
  claimed         BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at      TIMESTAMPTZ,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id, unlocked_at DESC NULLS LAST);

INSERT INTO achievements (code, name, description, icon, category, threshold, reward_chips, reward_usd, sort_order) VALUES
  ('first_win',        'First Win',         'Win your first hand',              '/badges/first-win.png',       'hand',       1,    500,  0, 10),
  ('hand_100',         'Century',           'Play 100 hands',                   '/badges/hand-100.png',        'hand',       100,  1000, 0, 20),
  ('hand_1000',        'Grinder',           'Play 1,000 hands',                 '/badges/hand-1000.png',       'hand',       1000, 5000, 0, 30),
  ('first_tourney',    'First Blood',       'Play your first tournament',       '/badges/first-tourney.png',   'tournament', 1,    1000, 0, 40),
  ('tourney_win',      'Tournament Winner', 'Win a tournament',                 '/badges/tourney-win.png',     'tournament', 1,    5000, 0, 50),
  ('big_pot',          'Big Pot',           'Win a pot of $100 or more',        '/badges/big-pot.png',         'wallet',     100,  2000, 0, 60),
  ('high_roller',      'High Roller',       'Reach a balance of $1,000',        '/badges/high-roller.png',     'wallet',     1000, 0,    0, 70),
  ('streak_7',         'On Fire',           'Login 7 days in a row',            '/badges/streak.png',          'special',    7,    3000, 0, 80),
  ('level_10',         'Veteran',           'Reach level 10',                   '/badges/level-up.png',        'special',    10,   2000, 0, 90),
  ('champion',         'Champion',          'Win 10 tournaments',               '/badges/champion.png',        'tournament', 10,   20000,0, 100)
ON CONFLICT (code) DO NOTHING;