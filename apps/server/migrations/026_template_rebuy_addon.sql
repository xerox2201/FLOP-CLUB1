-- 026: Add rebuy/addon fields to tournament_templates
-- So auto-generated tournaments from templates can inherit rebuy/addon config.

ALTER TABLE tournament_templates
  ADD COLUMN IF NOT EXISTS allow_rebuy BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_rebuys INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebuy_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebuy_stack BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rebuy_until_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_addon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS addon_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_stack BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_at_level INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN tournament_templates.allow_rebuy IS 'Enable rebuy for auto-generated tournaments';
COMMENT ON COLUMN tournament_templates.rebuy_until_level IS 'Last blind level allowing rebuy (0 = disabled)';
COMMENT ON COLUMN tournament_templates.addon_at_level IS 'Blind level where addon is offered (0 = disabled)';