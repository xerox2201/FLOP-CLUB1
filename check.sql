SELECT 'loyalty_tables' AS check_name, COUNT(*)::text AS found
FROM information_schema.tables
WHERE table_name IN ('user_xp','user_tier','rakeback_log','xp_transactions','shop_purchases','vouchers','seeds')
UNION ALL
SELECT 'shop_purchases_extra', COUNT(*)::text
FROM information_schema.columns
WHERE table_name='shop_purchases' AND column_name IN ('discount_pct','level_at_purchase')
UNION ALL
SELECT 'users_bonus_cols', COUNT(*)::text
FROM information_schema.columns
WHERE table_name='users' AND (column_name LIKE 'bonus%' OR column_name='last_daily_refill_at')
UNION ALL
SELECT 'free_chips_extra', COUNT(*)::text
FROM information_schema.columns
WHERE table_name='free_chips' AND column_name IN ('free_won','free_hands_won')
UNION ALL
SELECT 'user_stats_reset', (SELECT CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='user_stats_reset') THEN 1 ELSE 0 END)::text;