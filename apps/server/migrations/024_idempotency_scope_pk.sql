-- 024: idempotency_keys — scope becomes part of primary key
-- Root cause: table reused by CommandQueue and LedgerService
-- with different scope meanings but shared PK on `key` only,
-- causing unique violation collisions.

-- Ensure scope is never NULL before adding to PK
UPDATE idempotency_keys SET scope = 'default' WHERE scope IS NULL;

ALTER TABLE idempotency_keys
  ALTER COLUMN scope SET DEFAULT 'default',
  ALTER COLUMN scope SET NOT NULL;

-- Change PK from (key) to (key, scope)
ALTER TABLE idempotency_keys DROP CONSTRAINT IF EXISTS idempotency_keys_pkey;
ALTER TABLE idempotency_keys ADD PRIMARY KEY (key, scope);

CREATE INDEX IF NOT EXISTS idx_idempotency_key_scope
  ON idempotency_keys (key, scope);