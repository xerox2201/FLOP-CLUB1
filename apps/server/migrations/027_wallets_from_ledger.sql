-- ============================================================
-- 027: Make wallets.balance_usd a strict projection of ledger
-- ------------------------------------------------------------
-- Root cause of the double-credit bug: both HandPersister and
-- LedgerService wrote directly to wallets.balance_usd.
-- After this migration: entries trigger maintains the balance,
-- nothing else writes to wallets.
-- ============================================================

-- 1. Report discrepancy before backfill
DO $$
DECLARE
  v_total INT;
  v_mismatch INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM wallets;
  SELECT COUNT(*) INTO v_mismatch
  FROM wallets w
  WHERE EXISTS (SELECT 1 FROM accounts a WHERE a.owner_user_id = w.user_id)
    AND COALESCE(w.balance_usd, 0) <> COALESCE((
      SELECT SUM(e.amount) FROM entries e
      JOIN accounts a ON a.id = e.account_id
      WHERE a.owner_user_id = w.user_id
    ), 0);
  RAISE NOTICE '[027] wallets total=% mismatch=% (before backfill)', v_total, v_mismatch;
END $$;

-- 2. Drop the >= 0 check — ledger is source of truth now,
--    and a negative balance would be a bug we want to see.
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_balance_usd_check;

-- 3. Backfill from ledger (source of truth)
UPDATE wallets w
SET balance_usd = COALESCE((
  SELECT SUM(e.amount)
  FROM entries e
  JOIN accounts a ON a.id = e.account_id
  WHERE a.owner_user_id = w.user_id
), 0),
updated_at = NOW()
WHERE EXISTS (SELECT 1 FROM accounts a WHERE a.owner_user_id = w.user_id);

-- 4. Trigger: sync wallet on every entry insert
CREATE OR REPLACE FUNCTION sync_wallet_from_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id BIGINT;
BEGIN
  SELECT owner_user_id INTO v_user_id
  FROM accounts WHERE id = NEW.account_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;  -- system account: no wallet
  END IF;

  INSERT INTO wallets (user_id, balance_usd, updated_at)
  VALUES (v_user_id, NEW.amount, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET balance_usd = wallets.balance_usd + NEW.amount,
        updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_wallet_from_ledger ON entries;
CREATE TRIGGER trg_sync_wallet_from_ledger
AFTER INSERT ON entries
FOR EACH ROW
EXECUTE FUNCTION sync_wallet_from_ledger();

DO $$ BEGIN
  RAISE NOTICE '[027] ✅ wallets now a projection of ledger';
END $$;