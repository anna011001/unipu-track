ALTER TABLE schedule_optimization_reports
    ALTER COLUMN organizational_unit_id SET NOT NULL;

ALTER TABLE schedule_optimization_reports
    DROP CONSTRAINT IF EXISTS uq_schedule_optimization_year_unit;

ALTER TABLE schedule_optimization_reports
    ADD CONSTRAINT uq_schedule_optimization_year_unit
    UNIQUE (academic_year, organizational_unit_id);
