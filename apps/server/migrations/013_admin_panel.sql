-- ============================================================
-- 013: Admin Panel — broadcasts, settings, actions log
-- ============================================================

-- Broadcast messages from admin to players
CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  target        TEXT NOT NULL DEFAULT 'all',  -- all | active | banned | high_risk
  severity      TEXT NOT NULL DEFAULT 'info', -- info | warning | success | danger
  created_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_created
  ON admin_broadcasts (created_at DESC);

-- Read receipts
CREATE TABLE IF NOT EXISTS admin_broadcast_reads (
  broadcast_id  INT NOT NULL REFERENCES admin_broadcasts(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (broadcast_id, user_id)
);

-- Panel settings (key-value)
CREATE TABLE IF NOT EXISTS admin_settings (
  key           TEXT PRIMARY KEY,
  value         JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO admin_settings (key, value) VALUES
  ('maintenance_mode',  'false'::jsonb),
  ('registration_open', 'true'::jsonb),
  ('cash_games_open',   'true'::jsonb),
  ('tournaments_open',  'true'::jsonb),
  ('deposits_open',     'true'::jsonb),
  ('withdrawals_open',  'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Admin action log
CREATE TABLE IF NOT EXISTS admin_actions (
  id            SERIAL PRIMARY KEY,
  action        TEXT NOT NULL,              -- ban_user | unban_user | adjust_wallet | broadcast | ...
  target_type   TEXT,                       -- user | tournament | table | broadcast | setting
  target_id     TEXT,
  payload       JSONB DEFAULT '{}'::jsonb,
  admin_ref     TEXT,                       -- "ADMIN_SECRET" or admin user_id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created
  ON admin_actions (created_at DESC);

-- System account for admin wallet adjustments
INSERT INTO accounts (code, type) VALUES
  ('SYSTEM_ADMIN_ADJUST', 'system')
ON CONFLICT (code) DO NOTHING;