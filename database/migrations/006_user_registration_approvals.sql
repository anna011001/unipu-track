ALTER TABLE unipu_track.users
    ALTER COLUMN is_active SET DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS unipu_track.user_registration_approvals (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE
                    REFERENCES unipu_track.users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_registration_approvals_token_hash
    ON unipu_track.user_registration_approvals(token_hash);
