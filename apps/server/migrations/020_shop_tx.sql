-- 020: Shop purchase extras
ALTER TABLE shop_purchases
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_at_purchase INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_shop_purchases_pending
  ON shop_purchases (status, created_at)
  WHERE status = 'pending';