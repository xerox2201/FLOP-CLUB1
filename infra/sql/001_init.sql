 CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE,
  username        TEXT,
  display_name    TEXT,
  language        TEXT DEFAULT 'en',
  country         TEXT,
  is_banned       BOOLEAN DEFAULT FALSE,
  risk_score      INT DEFAULT 0,
  avatar_id       TEXT DEFAULT 'spade',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallets (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance_usd     NUMERIC(18,2) DEFAULT 0 CHECK (balance_usd >= 0),
  locked_usd      NUMERIC(18,2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  type            TEXT NOT NULL,
  owner_user_id   BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id              BIGSERIAL PRIMARY KEY,
  kind            TEXT NOT NULL,
  ref             TEXT,
  meta            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE entries (
  id              BIGSERIAL PRIMARY KEY,
  tx_id           BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
  account_id      BIGINT REFERENCES accounts(id),
  amount          NUMERIC(18,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_entries_tx ON entries(tx_id);

CREATE TABLE poker_tables (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  variant         TEXT NOT NULL,
  mode            TEXT NOT NULL,
  speed           TEXT DEFAULT 'regular',
  blinds          JSONB NOT NULL,
  min_buyin       NUMERIC(18,2),
  max_buyin       NUMERIC(18,2),
  rake_pct        NUMERIC(5,4) DEFAULT 0.03,
  seats           INT DEFAULT 6,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hands (
  id              BIGSERIAL PRIMARY KEY,
  table_id        BIGINT REFERENCES poker_tables(id),
  hand_no         BIGINT,
  server_seed_hash TEXT NOT NULL,
  server_seed     TEXT,
  client_seeds    JSONB,
  deck_hash       TEXT,
  pot             NUMERIC(18,2),
  rake            NUMERIC(18,2),
  result          JSONB,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

CREATE TABLE exchange_rates (
  id              BIGSERIAL PRIMARY KEY,
  asset           TEXT NOT NULL,
  rate_usd        NUMERIC(18,8) NOT NULL,
  spread_pct      NUMERIC(5,4) DEFAULT 0.025,
  source          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leaderboard_periods (
  id              BIGSERIAL PRIMARY KEY,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  prize_pool_usd  NUMERIC(18,2) NOT NULL,
  status          TEXT DEFAULT 'open'
);

CREATE TABLE leaderboard_entries (
  id              BIGSERIAL PRIMARY KEY,
  period_id       BIGINT REFERENCES leaderboard_periods(id),
  user_id         BIGINT REFERENCES users(id),
  hands_played    INT DEFAULT 0,
  total_won_usd   NUMERIC(18,2) DEFAULT 0,
  rank            INT,
  prize_usd       NUMERIC(18,2) DEFAULT 0,
  paid            BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_lb_period ON leaderboard_entries(period_id, rank);
CREATE UNIQUE INDEX uniq_lb_period_user ON leaderboard_entries(period_id, user_id);

CREATE TABLE events (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  variant         TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  buyin_usd       NUMERIC(18,2),
  prize_pool_usd  NUMERIC(18,2),
  max_players     INT,
  status          TEXT DEFAULT 'scheduled',
  structure       JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_registrations (
  id              BIGSERIAL PRIMARY KEY,
  event_id        BIGINT REFERENCES events(id) ON DELETE CASCADE,
  user_id         BIGINT REFERENCES users(id),
  registered_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE revenue_daily (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE UNIQUE NOT NULL,
  rake_total      NUMERIC(18,2) DEFAULT 0,
  referral_paid   NUMERIC(18,2) DEFAULT 0,
  prize_paid      NUMERIC(18,2) DEFAULT 0,
  deposit_fees    NUMERIC(18,2) DEFAULT 0,
  withdraw_fees   NUMERIC(18,2) DEFAULT 0,
  infra_cost      NUMERIC(18,2) DEFAULT 0,
  net_revenue     NUMERIC(18,2) GENERATED ALWAYS AS (
    rake_total - referral_paid - prize_paid - deposit_fees - withdraw_fees - infra_cost
  ) STORED,
  prize_ratio     NUMERIC(6,4) GENERATED ALWAYS AS (
    CASE WHEN rake_total > 0 THEN prize_paid / rake_total ELSE 0 END
  ) STORED,
  status          TEXT GENERATED ALWAYS AS (
    CASE
      WHEN rake_total = 0 THEN 'idle'
      WHEN prize_paid / NULLIF(rake_total,0) < 0.10 THEN 'ok'
      WHEN prize_paid / NULLIF(rake_total,0) < 0.15 THEN 'warning'
      ELSE 'critical'
    END
  ) STORED,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id              BIGSERIAL PRIMARY KEY,
  type            TEXT NOT NULL,
  message         TEXT NOT NULL,
  resolved        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE free_chips (
  user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chips           BIGINT DEFAULT 10000,
  last_refill_at  TIMESTAMPTZ DEFAULT NOW(),
  total_hands     INT DEFAULT 0
);

CREATE TABLE referrals (
  id              BIGSERIAL PRIMARY KEY,
  referrer_id     BIGINT REFERENCES users(id),
  referee_id      BIGINT UNIQUE REFERENCES users(id),
  earned_usd      NUMERIC(18,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO poker_tables (name, variant, mode, speed, blinds, min_buyin, max_buyin, rake_pct, seats) VALUES
  ('Free Beginner', 'holdem', 'free', 'regular', '{"sb":5,"bb":10,"ante":0}',      0, 0,    0,    6),
  ('Free Omaha4',   'omaha4', 'free', 'regular', '{"sb":5,"bb":10,"ante":0}',      0, 0,    0,    6),
  ('Micro Holdem',  'holdem', 'real', 'regular', '{"sb":0.05,"bb":0.10,"ante":0}', 5, 20,   0.03, 6),
  ('Low Holdem',    'holdem', 'real', 'regular', '{"sb":0.25,"bb":0.50,"ante":0}', 20, 100, 0.03, 6),
  ('Mid Omaha4',    'omaha4', 'real', 'regular', '{"sb":0.50,"bb":1.00,"ante":0}', 40, 200, 0.03, 6),
  ('High Holdem',   'holdem', 'real', 'regular', '{"sb":2.50,"bb":5.00,"ante":0}', 200, 1000, 0.03, 6);