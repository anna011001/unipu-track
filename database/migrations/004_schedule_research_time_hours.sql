ALTER TABLE academic_promotion_cases
    ALTER COLUMN research_time TYPE INTEGER
    USING NULLIF(SUBSTRING(research_time FROM '([0-9]+)'), '')::INTEGER;

ALTER TABLE academic_promotion_cases
    ADD CONSTRAINT chk_academic_promotion_research_time
    CHECK (research_time IS NULL OR research_time BETWEEN 0 AND 999999);
