 -- Hand events for replay
CREATE TABLE hand_events (
  id BIGSERIAL PRIMARY KEY,
  hand_id BIGINT,
  sequence INT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshots every 10 events
CREATE TABLE hand_snapshots (
  id BIGSERIAL PRIMARY KEY,
  hand_id BIGINT,
  sequence INT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotency keys
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id BIGINT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table seats
CREATE TABLE table_seats (
  id BIGSERIAL PRIMARY KEY,
  table_id BIGINT,
  seat_index INT NOT NULL,
  user_id BIGINT,
  stack NUMERIC(18,2) DEFAULT 0,
  status TEXT DEFAULT 'EMPTY',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Play money log
CREATE TABLE play_money_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  delta BIGINT NOT NULL,
  reason TEXT NOT NULL,
  balance_after BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System accounts
INSERT INTO accounts (code, type) VALUES
  ('HOUSE_RAKE', 'house'),
  ('HOUSE_PRIZE_POOL', 'house'),
  ('HOUSE_REFERRAL', 'house'),
  ('HOUSE_BONUS', 'house'),
  ('SYSTEM_ESCROW', 'system'),
  ('SYSTEM_DEPOSITS', 'system'),
  ('SYSTEM_WITHDRAWS', 'system')
ON CONFLICT (code) DO NOTHING;

-- Auto account function
CREATE OR REPLACE FUNCTION create_user_account() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO accounts (code, type, owner_user_id)
  VALUES ('USER_' || NEW.id, 'user', NEW.id)
  ON CONFLICT (code) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on users
DROP TRIGGER IF EXISTS trg_create_user_account ON users;
CREATE TRIGGER trg_create_user_account
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_account();

-- Backfill existing users
INSERT INTO accounts (code, type, owner_user_id)
SELECT 'USER_' || id, 'user', id FROM users
ON CONFLICT (code) DO NOTHING;