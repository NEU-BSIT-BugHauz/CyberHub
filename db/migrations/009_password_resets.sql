-- 009_password_resets.sql
-- S1-DBA-04: Password reset token table (hashed token, expiry, used flag/timestamp)

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used BOOLEAN GENERATED ALWAYS AS (used_at IS NOT NULL) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist if password_resets was created by an earlier baseline migration
ALTER TABLE password_resets
  ADD COLUMN IF NOT EXISTS token_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used BOOLEAN GENERATED ALWAYS AS (used_at IS NOT NULL) STORED,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Indexes matching routes/passwordReset.js lookup and invalidation queries
CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token_hash_uidx
  ON password_resets (token_hash);

CREATE INDEX IF NOT EXISTS password_resets_user_active_idx
  ON password_resets (user_id)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS password_resets_expires_at_idx
  ON password_resets (expires_at);
