 -- ============================================================
-- 006_ledger_and_events.sql
-- Flop Club — Ledger, Events, Snapshots, Idempotency
-- ============================================================

-- ============================================================
-- 1. HAND EVENTS (Event Sourcing برای Replay)
-- ============================================================
CREATE TABLE IF NOT EXISTS hand_events (
  id              BIGSERIAL PRIMARY KEY,
  hand_id         BIGINT REFERENCES hands(id) ON DELETE CASCADE,
  sequence        INT NOT NULL,
  event_type      TEXT NOT NULL,
  schema_version  INT DEFAULT 1,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hand_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_hand_events_hand ON hand_events(hand_id, sequence);

-- ============================================================
-- 2. HAND SNAPSHOTS (هر ۱۰ event)
-- ============================================================
CREATE TABLE IF NOT EXISTS hand_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  hand_id         BIGINT REFERENCES hands(id) ON DELETE CASCADE,
  sequence        INT NOT NULL,
  state           JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hand_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_hand_snapshots_hand ON hand_snapshots(hand_id, sequence);

-- ============================================================
-- 3. IDEMPOTENCY KEYS (جلوگیری از duplicate action)
-- ============================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key             TEXT PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id),
  scope           TEXT NOT NULL DEFAULT 'default',
  result          JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ============================================================
-- 4. EXTEND hands TABLE
-- ============================================================
ALTER TABLE hands ADD COLUMN IF NOT EXISTS variant TEXT;
ALTER TABLE hands ADD COLUMN IF NOT EXISTS dealer_seat INT;
ALTER TABLE hands ADD COLUMN IF NOT EXISTS community_cards JSONB;
ALTER TABLE hands ADD COLUMN IF NOT EXISTS winner_seats JSONB;
ALTER TABLE hands ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT 'poker-engine@0.3.0';
ALTER TABLE hands ADD COLUMN IF NOT EXISTS small_blind NUMERIC(18,2);
ALTER TABLE hands ADD COLUMN IF NOT EXISTS big_blind NUMERIC(18,2);
ALTER TABLE hands ADD COLUMN IF NOT EXISTS ante NUMERIC(18,2) DEFAULT 0;
ALTER TABLE hands ADD COLUMN IF NOT EXISTS player_count INT;
ALTER TABLE hands ADD COLUMN IF NOT EXISTS finished BOOLEAN DEFAULT FALSE;
ALTER TABLE hands ADD COLUMN IF NOT EXISTS mode TEXT; -- 'free' | 'real'

-- ============================================================
-- 5. TABLE SEATS (persist state هر صندلی)
-- ============================================================
CREATE TABLE IF NOT EXISTS table_seats (
  id              BIGSERIAL PRIMARY KEY,
  table_id        BIGINT REFERENCES poker_tables(id) ON DELETE CASCADE,
  seat_index      INT NOT NULL,
  user_id         BIGINT REFERENCES users(id),
  stack           NUMERIC(18,2) DEFAULT 0,
  status          TEXT DEFAULT 'EMPTY',
  -- status: EMPTY | RESERVED | OCCUPIED | SITTING_OUT | DISCONNECTED | LEAVING
  reserved_at     TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, seat_index)
);
CREATE INDEX IF NOT EXISTS idx_table_seats_table ON table_seats(table_id);
CREATE INDEX IF NOT EXISTS idx_table_seats_user ON table_seats(user_id);

-- ============================================================
-- 6. AUTO-CREATE LEDGER ACCOUNT for هر user
-- ============================================================
CREATE OR REPLACE FUNCTION create_user_account() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO accounts (code, type, owner_user_id)
  VALUES ('USER_' || NEW.id, 'user', NEW.id)
  ON CONFLICT (code) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_user_account ON users;
CREATE TRIGGER trg_create_user_account
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_account();

-- Backfill existing users
INSERT INTO accounts (code, type, owner_user_id)
SELECT 'USER_' || id, 'user', id FROM users
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 7. SEED SYSTEM ACCOUNTS
-- ============================================================
INSERT INTO accounts (code, type, owner_user_id) VALUES
  ('HOUSE_RAKE',       'house',  NULL),
  ('HOUSE_PRIZE_POOL', 'house',  NULL),
  ('HOUSE_REFERRAL',   'house',  NULL),
  ('HOUSE_BONUS',      'house',  NULL),
  ('SYSTEM_ESCROW',    'system', NULL),
  ('SYSTEM_DEPOSITS',  'system', NULL),
  ('SYSTEM_WITHDRAWS', 'system', NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 8. EXTEND transactions TABLE (idempotency, status, user)
-- ============================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(18,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_kind ON transactions(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_idem ON transactions(idempotency_key);

-- ============================================================
-- 9. EXTEND entries TABLE
-- ============================================================
ALTER TABLE entries ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS balance_after NUMERIC(18,2);

CREATE INDEX IF NOT EXISTS idx_entries_account ON entries(account_id, created_at DESC);

-- ============================================================
-- 10. ADD INDEX on wallets
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- ============================================================
-- 11. PLAY MONEY — جدای از ledger (فقط audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS play_money_log (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id),
  delta           BIGINT NOT NULL,           -- مثبت/منفی
  reason          TEXT NOT NULL,             -- 'daily_bonus', 'hand_win', 'hand_loss', 'tournament_entry', ...
  ref             TEXT,                      -- hand_id / tournament_id
  balance_after   BIGINT NOT NULL,
  meta            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_play_money_log_user ON play_money_log(user_id, created_at DESC);

-- ============================================================
-- 12. VERIFY
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 006 complete:';
  RAISE NOTICE '  - hand_events, hand_snapshots, idempotency_keys added';
  RAISE NOTICE '  - table_seats added';
  RAISE NOTICE '  - accounts auto-create trigger installed';
  RAISE NOTICE '  - 7 system accounts seeded';
  RAISE NOTICE '  - transactions + entries extended';
  RAISE NOTICE '  - play_money_log added';
END $$;