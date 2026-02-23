CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  apple_user_id TEXT UNIQUE NOT NULL,
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spotify_tokens (
  id            SERIAL PRIMARY KEY,
  user_id       INT REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
