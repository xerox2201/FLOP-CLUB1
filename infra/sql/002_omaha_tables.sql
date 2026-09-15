-- Omaha 4 و Omaha 5 tables برای تست

INSERT INTO poker_tables (name, variant, mode, speed, blinds, min_buyin, max_buyin, rake_pct, seats, is_active)
VALUES
  ('Omaha 4 - Micro', 'omaha4', 'cash', 'regular', '{"sb": 0.05, "bb": 0.10, "ante": 0}', 5, 100, 0.03, 6, TRUE),
  ('Omaha 5 - Micro', 'omaha5', 'cash', 'regular', '{"sb": 0.05, "bb": 0.10, "ante": 0}', 5, 100, 0.03, 6, TRUE)
ON CONFLICT DO NOTHING;