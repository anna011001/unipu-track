BEGIN;

CREATE TABLE IF NOT EXISTS unipu_track.staff_member_organizational_units (
    staff_member_id         INTEGER NOT NULL
                            REFERENCES unipu_track.staff_members(id) ON DELETE CASCADE,
    organizational_unit_id  INTEGER NOT NULL
                            REFERENCES unipu_track.organizational_units(id) ON DELETE CASCADE,
    is_primary              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (staff_member_id, organizational_unit_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_member_primary_organizational_unit
    ON unipu_track.staff_member_organizational_units(staff_member_id)
    WHERE is_primary = TRUE;

INSERT INTO unipu_track.staff_member_organizational_units (
    staff_member_id,
    organizational_unit_id,
    is_primary
)
SELECT id, organizational_unit_id, TRUE
FROM unipu_track.staff_members
WHERE organizational_unit_id IS NOT NULL
ON CONFLICT (staff_member_id, organizational_unit_id)
DO UPDATE SET is_primary = TRUE;

CREATE OR REPLACE FUNCTION unipu_track.sync_staff_member_primary_organizational_unit()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE unipu_track.staff_member_organizational_units
    SET is_primary = FALSE
    WHERE staff_member_id = NEW.id AND is_primary = TRUE;

    IF NEW.organizational_unit_id IS NOT NULL THEN
        INSERT INTO unipu_track.staff_member_organizational_units (
            staff_member_id,
            organizational_unit_id,
            is_primary
        ) VALUES (NEW.id, NEW.organizational_unit_id, TRUE)
        ON CONFLICT (staff_member_id, organizational_unit_id)
        DO UPDATE SET is_primary = TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_staff_member_primary_organizational_unit
    ON unipu_track.staff_members;

CREATE TRIGGER trg_sync_staff_member_primary_organizational_unit
AFTER INSERT OR UPDATE OF organizational_unit_id ON unipu_track.staff_members
FOR EACH ROW
EXECUTE FUNCTION unipu_track.sync_staff_member_primary_organizational_unit();

COMMIT;
