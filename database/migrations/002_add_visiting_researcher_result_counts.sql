ALTER TABLE unipu_track.realized_visiting_researchers
ADD COLUMN IF NOT EXISTS lecture_count SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS publication_count SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS project_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE unipu_track.realized_visiting_researchers
DROP CONSTRAINT IF EXISTS realized_visiting_researchers_lecture_count_check,
DROP CONSTRAINT IF EXISTS realized_visiting_researchers_publication_count_check,
DROP CONSTRAINT IF EXISTS realized_visiting_researchers_project_count_check;

ALTER TABLE unipu_track.realized_visiting_researchers
ADD CONSTRAINT realized_visiting_researchers_lecture_count_check
    CHECK (lecture_count BETWEEN 0 AND 9999),
ADD CONSTRAINT realized_visiting_researchers_publication_count_check
    CHECK (publication_count BETWEEN 0 AND 9999),
ADD CONSTRAINT realized_visiting_researchers_project_count_check
    CHECK (project_count BETWEEN 0 AND 9999);
