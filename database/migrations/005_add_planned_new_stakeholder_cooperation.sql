ALTER TABLE science_stakeholders
    ADD COLUMN IF NOT EXISTS planned_new_cooperation BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE artistic_stakeholders
    ADD COLUMN IF NOT EXISTS planned_new_cooperation BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE professional_stakeholders
    ADD COLUMN IF NOT EXISTS planned_new_cooperation BOOLEAN NOT NULL DEFAULT FALSE;
