ALTER TABLE unipu_track.users
    ALTER COLUMN is_active SET DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS unipu_track.authorized_user_emails (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               unipu_track.CITEXT NOT NULL UNIQUE,
    added_by_user_id    INTEGER REFERENCES unipu_track.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO unipu_track.authorized_user_emails (email)
SELECT email
FROM unipu_track.users
WHERE is_active = TRUE
ON CONFLICT (email) DO NOTHING;

DROP TABLE IF EXISTS unipu_track.user_registration_approvals;
