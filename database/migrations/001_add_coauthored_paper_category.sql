ALTER TABLE unipu_track.coauthored_papers
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE unipu_track.coauthored_papers
DROP CONSTRAINT IF EXISTS coauthored_papers_category_check;

ALTER TABLE unipu_track.coauthored_papers
ADD CONSTRAINT coauthored_papers_category_check CHECK (
    category IN (
        'WOS_SCOPUS_Q1_Q2',
        'WOS_SCOPUS_Q3_Q4',
        'OTHER_INTERNATIONAL_JOURNALS',
        'DOMESTIC_JOURNALS',
        'BOOK_CHAPTERS',
        'CONFERENCE_PROCEEDINGS'
    )
);
