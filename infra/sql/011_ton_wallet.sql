ALTER TABLE users ADD COLUMN IF NOT EXISTS ton_address TEXT;

CREATE TABLE IF NOT EXISTS ton_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  direction TEXT NOT NULL,
  amount_ton NUMERIC(18,9) NOT NULL,
  amount_usd NUMERIC(18,2),
  tx_hash TEXT UNIQUE,
  from_address TEXT,
  to_address TEXT,
  memo TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  confirmations INT DEFAULT 0,
  ledger_tx_id BIGINT REFERENCES transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ton_tx_user ON ton_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ton_tx_status ON ton_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ton_tx_hash ON ton_transactions(tx_hash);

INSERT INTO accounts (code, type) VALUES
  ('SYSTEM_TON_DEPOSITS', 'system'),
  ('SYSTEM_TON_HOTWALLET', 'system'),
  ('SYSTEM_TON_FEES', 'system')
ON CONFLICT (code) DO NOTHING;