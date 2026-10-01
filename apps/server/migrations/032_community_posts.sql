-- ============================================================
-- 032: Community auto-posts log
-- Prevents duplicate posts across server restarts.
-- ============================================================

CREATE TABLE IF NOT EXISTS community_posts_log (
  id           BIGSERIAL PRIMARY KEY,
  post_type    TEXT NOT NULL,       -- 'tournament_starting' | 'tournament_finished' | 'daily_leader'
  target_id    TEXT NOT NULL,       -- e.g. tournament_id, or date string for daily
  chat_id      BIGINT,              -- where it was posted
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  posted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_community_posts_posted_at
  ON community_posts_log (posted_at DESC);

DO $$ BEGIN
  RAISE NOTICE '[032] ✅ community_posts_log ready';
END $$;