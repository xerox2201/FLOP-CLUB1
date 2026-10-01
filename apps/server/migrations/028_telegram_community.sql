-- ============================================================
-- 028: Telegram community (channel + group + bot)
-- ============================================================

CREATE TABLE IF NOT EXISTS telegram_chats (
  id                BIGSERIAL PRIMARY KEY,
  chat_id           BIGINT UNIQUE NOT NULL,
  chat_type         TEXT NOT NULL
                    CHECK (chat_type IN ('group','supergroup','channel')),
  title             TEXT NOT NULL,
  username          TEXT,
  invite_link       TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  bot_is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  bot_permissions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  member_count      INT NOT NULL DEFAULT 0,
  linked_chat_id    BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_chats_primary_channel
  ON telegram_chats (chat_type)
  WHERE is_primary = TRUE AND chat_type = 'channel';

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_chats_primary_group
  ON telegram_chats (chat_type)
  WHERE is_primary = TRUE AND chat_type IN ('group','supergroup');

CREATE TABLE IF NOT EXISTS telegram_memberships (
  chat_id           BIGINT NOT NULL REFERENCES telegram_chats(chat_id) ON DELETE CASCADE,
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL
                    CHECK (status IN ('creator','administrator','member','restricted','left','kicked')),
  is_premium        BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at         TIMESTAMPTZ,
  last_verified_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_memberships_user
  ON telegram_memberships (user_id, status);

CREATE TABLE IF NOT EXISTS telegram_invite_links (
  id                    BIGSERIAL PRIMARY KEY,
  chat_id               BIGINT NOT NULL REFERENCES telegram_chats(chat_id) ON DELETE CASCADE,
  invite_link           TEXT NOT NULL,
  creator_user_id       BIGINT REFERENCES users(id),
  name                  TEXT,
  expire_date           TIMESTAMPTZ,
  member_limit          INT,
  creates_join_request  BOOLEAN NOT NULL DEFAULT FALSE,
  pending_join_count    INT NOT NULL DEFAULT 0,
  subscription_count    INT NOT NULL DEFAULT 0,
  revoked               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_invite_links_chat
  ON telegram_invite_links (chat_id, revoked);
CREATE INDEX IF NOT EXISTS idx_telegram_invite_links_user
  ON telegram_invite_links (creator_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_post_templates (
  id              SERIAL PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  parse_mode      TEXT NOT NULL DEFAULT 'HTML',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO telegram_post_templates (code, title, body, parse_mode) VALUES
  ('big_win',
   'Big Win',
   E'🏆 <b>Big Win Alert</b>\n\n{player} just won <b>${amount}</b> at {blinds} {variant}!\n\n<a href="{app_link}">Play now →</a>',
   'HTML'),
  ('tournament_starting',
   'Tournament Starting',
   E'🎰 <b>{tournament_name}</b> starts in {minutes} minutes!\n\n💰 Prize pool: <b>${prize}</b>\n👥 Players: {players}\n🎫 Buy-in: {buyin}\n\n<a href="{app_link}">Register →</a>',
   'HTML'),
  ('bad_beat_hit',
   'Bad Beat Hit',
   E'💥 <b>BAD BEAT JACKPOT HIT!</b>\n\nPool: <b>${pool}</b>\nWinner: {winner}\nHand: {hand}\n\n<a href="{app_link}">Join the action →</a>',
   'HTML'),
  ('daily_leader',
   'Daily Leader',
   E'👑 <b>Today''s Top Winner</b>\n\n{player} is leading with <b>+${amount}</b>!\n\n<a href="{app_link}">See leaderboard →</a>',
   'HTML')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS telegram_bot_actions (
  id              BIGSERIAL PRIMARY KEY,
  chat_id         BIGINT,
  action          TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ok              BOOLEAN NOT NULL DEFAULT TRUE,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_bot_actions_chat
  ON telegram_bot_actions (chat_id, created_at DESC);

DO $$ BEGIN
  RAISE NOTICE '[028] ✅ telegram community tables ready';
END $$;