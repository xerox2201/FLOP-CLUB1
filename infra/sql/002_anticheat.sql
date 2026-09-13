CREATE TABLE IF NOT EXISTS player_actions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
  table_id        BIGINT,
  hand_no         BIGINT,
  action          TEXT NOT NULL,
  amount          NUMERIC(18,2) DEFAULT 0,
  street          TEXT,
  response_ms     INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_actions_user ON player_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_table_hand ON player_actions(table_id, hand_no);

CREATE TABLE IF NOT EXISTS user_ips (
  user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
  ip              TEXT NOT NULL,
  first_seen      TIMESTAMPTZ DEFAULT NOW(),
  last_seen       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, ip)
);
CREATE INDEX IF NOT EXISTS idx_user_ips_ip ON user_ips(ip);

CREATE TABLE IF NOT EXISTS user_devices (
  user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
  device_hash     TEXT NOT NULL,
  first_seen      TIMESTAMPTZ DEFAULT NOW(),
  last_seen       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, device_hash)
);
CREATE INDEX IF NOT EXISTS idx_user_devices_hash ON user_devices(device_hash);

CREATE TABLE IF NOT EXISTS player_pairs (
  user_a              BIGINT NOT NULL,
  user_b              BIGINT NOT NULL,
  hands_together      INT DEFAULT 0,
  chips_net_flow      NUMERIC(18,2) DEFAULT 0,
  suspicious_moves    INT DEFAULT 0,
  suspicion_score     INT DEFAULT 0,
  last_updated        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS suspicious_events (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
  other_user_id   BIGINT REFERENCES users(id),
  type            TEXT NOT NULL,
  severity        INT DEFAULT 1,
  evidence        JSONB DEFAULT '{}',
  resolved        BOOLEAN DEFAULT FALSE,
  reviewer_note   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suspicious_user ON suspicious_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_type ON suspicious_events(type, resolved);

CREATE TABLE IF NOT EXISTS player_risk (
  user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score           INT DEFAULT 0,
  flags           JSONB DEFAULT '{}',
  action_taken    TEXT DEFAULT 'none',
  last_updated    TIMESTAMPTZ DEFAULT NOW()
);