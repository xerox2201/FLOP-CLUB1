CREATE TABLE IF NOT EXISTS user_stats_reset (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reset_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_reset_at
  ON user_stats_reset (user_id, reset_at);