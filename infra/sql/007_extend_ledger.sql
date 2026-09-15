-- Extend transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(18,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_kind ON transactions(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_idem ON transactions(idempotency_key);

-- Extend entries
ALTER TABLE entries ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS balance_after NUMERIC(18,2);

CREATE INDEX IF NOT EXISTS idx_entries_account ON entries(account_id, created_at DESC);

-- Extend hands
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
ALTER TABLE hands ADD COLUMN IF NOT EXISTS mode TEXT;