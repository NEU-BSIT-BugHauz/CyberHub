-- S1-DEV-03: PostgreSQL-backed Express sessions.

BEGIN;

CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
    ON user_sessions (expire);

COMMIT;
