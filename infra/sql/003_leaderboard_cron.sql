CREATE OR REPLACE FUNCTION update_leaderboard_entry(
  p_user_id BIGINT,
  p_won NUMERIC,
  p_hand_no BIGINT
) RETURNS VOID AS $$
DECLARE
  v_period_id BIGINT;
BEGIN
  SELECT id INTO v_period_id
  FROM leaderboard_periods
  WHERE status = 'open' AND NOW() BETWEEN period_start AND period_end
  ORDER BY period_start DESC LIMIT 1;

  IF v_period_id IS NULL THEN
    INSERT INTO leaderboard_periods (period_start, period_end, prize_pool_usd, status)
    VALUES (
      date_trunc('month', NOW())::date,
      (date_trunc('month', NOW()) + INTERVAL '1 month - 1 day')::date,
      0,
      'open'
    )
    RETURNING id INTO v_period_id;
  END IF;

  INSERT INTO leaderboard_entries (period_id, user_id, hands_played, total_won_usd)
  VALUES (v_period_id, p_user_id, 1, p_won)
  ON CONFLICT (period_id, user_id) DO UPDATE
  SET hands_played = leaderboard_entries.hands_played + 1,
      total_won_usd = leaderboard_entries.total_won_usd + p_won;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_lb_entries_won
  ON leaderboard_entries(period_id, total_won_usd DESC);

CREATE INDEX IF NOT EXISTS idx_lb_entries_user_period
  ON leaderboard_entries(user_id, period_id);