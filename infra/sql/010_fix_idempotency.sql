ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'default';
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);