BEGIN;

CREATE SCHEMA IF NOT EXISTS unipu_track;
SET search_path TO unipu_track, public;

CREATE EXTENSION IF NOT EXISTS citext;

-- ZAJEDNIČKE TEHNIČKE TABLICE

CREATE TABLE organizational_units (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(150) NOT NULL UNIQUE,
    short_name          VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               CITEXT NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    first_name          VARCHAR(50) NOT NULL,
    last_name           VARCHAR(80) NOT NULL,
    role                VARCHAR(10) NOT NULL DEFAULT 'PROFESSOR'
                        CHECK (role IN ('PROFESSOR', 'ADMIN')),
    is_active           BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_registration_approvals (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_members (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                 INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    first_name              VARCHAR(50) NOT NULL,
    last_name               VARCHAR(80) NOT NULL,
    academic_title          VARCHAR(30),
    email                   CITEXT,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reporting_periods (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    label               VARCHAR(20) NOT NULL UNIQUE,
    period_type         VARCHAR(15) NOT NULL
                        CHECK (period_type IN ('CALENDAR_YEAR', 'ACADEMIC_YEAR', 'CUSTOM')),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    is_closed           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

CREATE TABLE countries (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    iso2_code           CHAR(2) UNIQUE,
    name_hr             VARCHAR(100) NOT NULL UNIQUE,
    name_en             VARCHAR(100),
    region              VARCHAR(20) CHECK (
        region IS NULL OR region IN (
            'EU', 'OTHER_EUROPE', 'NORTH_AMERICA', 'SOUTH_AMERICA',
            'ASIA', 'AFRICA', 'OCEANIA'
        )
    )
);

CREATE TABLE organizations (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    organization_type   VARCHAR(50),
    country_id          INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    city                VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, country_id)
);

CREATE TABLE record_files (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    record_type         VARCHAR(30) NOT NULL,
    record_id           INTEGER NOT NULL,
    file_role           VARCHAR(30),
    file_name           VARCHAR(50) NOT NULL,
    storage_path        TEXT NOT NULL,
    mime_type           VARCHAR(50),
    file_size_bytes     INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes BETWEEN 0 AND 2147483647),
    uploaded_by         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_record_files_record ON record_files(record_type, record_id);

CREATE TABLE record_signatures (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    record_type         VARCHAR(60) NOT NULL,
    record_id           INTEGER NOT NULL,
    signer_role         VARCHAR(40) NOT NULL,
    signer_name         VARCHAR(40),
    signed_on           DATE,
    signature_file_id   INTEGER REFERENCES record_files(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_record_signatures_record ON record_signatures(record_type, record_id);

-- 1. EVIDENCIJA ČLANSTAVA

CREATE TABLE new_memberships (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    organization_id         INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    organization_name       VARCHAR(200) NOT NULL,
    organization_kind       VARCHAR(20) NOT NULL
                            CHECK (organization_kind IN ('SCIENTIFIC', 'PROFESSIONAL', 'ARTISTIC')),
    organization_level      VARCHAR(20) NOT NULL
                            CHECK (organization_level IN ('INTERNATIONAL', 'NATIONAL', 'REGIONAL')),
    headquarters_country_id INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    joined_on               DATE,
    membership_type         VARCHAR(40),
    annual_fee_eur          NUMERIC(5,2) CHECK (
        annual_fee_eur IS NULL OR annual_fee_eur BETWEEN 0 AND 999.99
    ),
    unipu_member_id         INTEGER REFERENCES staff_members(id) ON DELETE SET NULL,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    membership_benefits     TEXT,
    evidence_link           TEXT,
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE active_memberships (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    organization_id         INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    organization_name       VARCHAR(200) NOT NULL,
    organization_kind       VARCHAR(20) NOT NULL
                            CHECK (organization_kind IN ('SCIENTIFIC', 'PROFESSIONAL', 'ARTISTIC')),
    organization_level      VARCHAR(20) NOT NULL
                            CHECK (organization_level IN ('INTERNATIONAL', 'NATIONAL', 'REGIONAL')),
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    joined_year             SMALLINT CHECK (
        joined_year IS NULL OR joined_year BETWEEN 1950
        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT
    ),
    membership_type         VARCHAR(40),
    annual_fee_eur          NUMERIC(5,2) CHECK (
        annual_fee_eur IS NULL OR annual_fee_eur BETWEEN 0 AND 999.99
    ),
    unipu_representative_id INTEGER REFERENCES staff_members(id) ON DELETE SET NULL,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    organization_activities TEXT,
    membership_status       VARCHAR(20),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE membership_category_summaries (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    category_name           VARCHAR(100) NOT NULL,
    existing_memberships    SMALLINT NOT NULL DEFAULT 0 CHECK (existing_memberships BETWEEN 0 AND 9999),
    new_memberships         SMALLINT NOT NULL DEFAULT 0 CHECK (new_memberships BETWEEN 0 AND 9999),
    total_memberships       SMALLINT NOT NULL DEFAULT 0 CHECK (total_memberships BETWEEN 0 AND 9999),
    share_percent           NUMERIC(5,2) CHECK (share_percent IS NULL OR share_percent BETWEEN 0 AND 100),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. STRUČNA USAVRŠAVANJA

CREATE TABLE professional_developments (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    development_type        VARCHAR(30) NOT NULL CHECK (
        development_type IN (
            'STUDY_VISIT', 'WORKSHOP', 'CONFERENCE',
            'COURSE_CERTIFICATE', 'SUMMER_SCHOOL'
        )
    ),
    program_name            VARCHAR(250) NOT NULL,
    host_organization_id    INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    host_organization_name  VARCHAR(200),
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    start_date              DATE,
    end_date                DATE,
    media_link              TEXT,
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE professional_development_confirmations (
    id                          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    professional_development_id INTEGER REFERENCES professional_developments(id) ON DELETE SET NULL,
    institution_name            VARCHAR(200) NOT NULL,
    signer_name                 VARCHAR(40),
    signer_function             VARCHAR(40),
    confirmation_date           DATE,
    seal_present                BOOLEAN,
    created_by                  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by                  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE professional_development_media (
    id                          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    professional_development_id INTEGER REFERENCES professional_developments(id) ON DELETE SET NULL,
    development_name            VARCHAR(250) NOT NULL,
    media_type                  VARCHAR(80),
    media_link                  TEXT NOT NULL,
    published_on                DATE,
    created_by                  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by                  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SUDJELOVANJA NA ZNANSTVENIM I STRUČNIM SKUPOVIMA

CREATE TABLE event_participations (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    participation_type      VARCHAR(40) NOT NULL CHECK (
        participation_type IN (
            'ORAL_PRESENTATION',
            'POSTER_PRESENTATION',
            'PLENARY_LECTURE',
            'PANELIST',
            'ORGANIZING_COMMITTEE_MEMBER'
        )
    ),
    event_name              VARCHAR(250) NOT NULL,
    organizer_name          VARCHAR(200),
    location                VARCHAR(150),
    event_date              DATE,
    presentation_title      TEXT,
    program_link            TEXT,
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_organizer_confirmations (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_participation_id  INTEGER REFERENCES event_participations(id) ON DELETE SET NULL,
    event_name              VARCHAR(250) NOT NULL,
    committee_president_name VARCHAR(120),
    organizer_institution   VARCHAR(200),
    confirmation_date       DATE,
    impressum_link          TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_media (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_participation_id  INTEGER REFERENCES event_participations(id) ON DELETE SET NULL,
    event_name              VARCHAR(250) NOT NULL,
    media_type              VARCHAR(80),
    media_link              TEXT NOT NULL,
    published_on            DATE,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ODRŽANE RADIONICE

CREATE TABLE workshops (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    workshop_name           VARCHAR(250) NOT NULL,
    workshop_leaders        TEXT,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    target_group            VARCHAR(30) NOT NULL CHECK (
        target_group IN (
            'STUDENTS', 'TEACHERS', 'PUBLIC', 'EMPLOYEES', 'DOCTORAL_STUDENTS'
        )
    ),
    participant_count       SMALLINT CHECK (
        participant_count IS NULL OR participant_count BETWEEN 0 AND 9999
    ),
    location                VARCHAR(150),
    held_on                 DATE,
    duration_hours          SMALLINT CHECK (
        duration_hours IS NULL OR duration_hours BETWEEN 0 AND 999
    ),
    content_description     TEXT,
    leader_signature_file_id INTEGER REFERENCES record_files(id) ON DELETE SET NULL,
    media_link              TEXT,
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workshop_details (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workshop_id             INTEGER NOT NULL UNIQUE REFERENCES workshops(id) ON DELETE CASCADE,
    goals                   TEXT,
    learning_outcomes       TEXT,
    work_methods            TEXT,
    materials_resources     TEXT,
    evaluation              TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workshop_media (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workshop_id             INTEGER REFERENCES workshops(id) ON DELETE SET NULL,
    workshop_name           VARCHAR(250) NOT NULL,
    media_type              VARCHAR(80),
    media_link              TEXT NOT NULL,
    published_on            DATE,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. KOAUTORSTVO NA ZNANSTVENIM RADOVIMA

CREATE TABLE coauthorship_year_totals (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    calendar_year           SMALLINT NOT NULL CHECK (
        calendar_year BETWEEN 2000
        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT + 1
    ),
    paper_count             SMALLINT NOT NULL DEFAULT 0 CHECK (paper_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reporting_period_id, calendar_year)
);

CREATE TABLE coauthored_papers (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    authors_and_title       TEXT NOT NULL,
    publication_year        SMALLINT NOT NULL CHECK (
        publication_year BETWEEN 2000
        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT + 1
    ),
    category                VARCHAR(50) CHECK (
        category IN (
            'WOS_SCOPUS_Q1_Q2',
            'WOS_SCOPUS_Q3_Q4',
            'OTHER_INTERNATIONAL_JOURNALS',
            'DOMESTIC_JOURNALS',
            'BOOK_CHAPTERS',
            'CONFERENCE_PROCEEDINGS'
        )
    ),
    publication_link        TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coauthorship_category_summaries (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id INTEGER NOT NULL
                        REFERENCES reporting_periods(id)
                        ON DELETE RESTRICT,
    category            VARCHAR(50) NOT NULL CHECK (
        category IN (
            'WOS_SCOPUS_Q1_Q2',
            'WOS_SCOPUS_Q3_Q4',
            'OTHER_INTERNATIONAL_JOURNALS',
            'DOMESTIC_JOURNALS',
            'BOOK_CHAPTERS',
            'CONFERENCE_PROCEEDINGS',
            'TOTAL'
        )
    ),
    calendar_year       SMALLINT NOT NULL CHECK (
        calendar_year BETWEEN 2000
        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT + 1
    ),
    paper_count         SMALLINT NOT NULL DEFAULT 0 CHECK (
        paper_count BETWEEN 0 AND 9999
    ),
    created_by          INTEGER NOT NULL
                        REFERENCES users(id)
                        ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL
                        REFERENCES users(id)
                        ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (
        reporting_period_id,
        category,
        calendar_year
    )
);

-- 6. MEĐUNARODNI GOSTUJUĆI ISTRAŽIVAČI

CREATE TABLE realized_visiting_researchers (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    researcher_name         VARCHAR(120) NOT NULL,
    academic_title          VARCHAR(30),
    home_institution        VARCHAR(200),
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    scientific_field        VARCHAR(150),
    arrival_date            DATE,
    departure_date          DATE,
    duration_days           SMALLINT CHECK (
        duration_days IS NULL OR duration_days BETWEEN 0 AND 999
    ),
    host_unit_id            INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    mentor_contact          VARCHAR(150),
    activities_during_stay  TEXT,
    results                 TEXT,
    lecture_count           SMALLINT NOT NULL DEFAULT 0 CHECK (lecture_count BETWEEN 0 AND 9999),
    publication_count       SMALLINT NOT NULL DEFAULT 0 CHECK (publication_count BETWEEN 0 AND 9999),
    project_count           SMALLINT NOT NULL DEFAULT 0 CHECK (project_count BETWEEN 0 AND 9999),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date)
);

CREATE TABLE planned_visiting_researchers (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    researcher_name         VARCHAR(120) NOT NULL,
    academic_title          VARCHAR(30),
    home_institution        VARCHAR(200),
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    scientific_field        VARCHAR(150),
    planned_period          VARCHAR(100),
    duration                VARCHAR(60),
    host_unit_id            INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    mentor                  VARCHAR(120),
    planned_activities      TEXT,
    invitation_status       VARCHAR(40),
    funding_source          VARCHAR(150),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE visiting_researcher_unit_analyses (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER NOT NULL REFERENCES organizational_units(id) ON DELETE RESTRICT,
    visit_count             SMALLINT NOT NULL DEFAULT 0 CHECK (visit_count BETWEEN 0 AND 9999),
    total_days              INTEGER NOT NULL DEFAULT 0 CHECK (total_days BETWEEN 0 AND 999999),
    lecture_count           SMALLINT NOT NULL DEFAULT 0 CHECK (lecture_count BETWEEN 0 AND 9999),
    publication_count       SMALLINT NOT NULL DEFAULT 0 CHECK (publication_count BETWEEN 0 AND 9999),
    project_count           SMALLINT NOT NULL DEFAULT 0 CHECK (project_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. MAPIRANJE KLJUČNIH DIONIKA

CREATE TABLE stakeholder_analyses (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    analysis_date           DATE,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    responsible_person      VARCHAR(120),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE science_stakeholders (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stakeholder_analysis_id INTEGER NOT NULL REFERENCES stakeholder_analyses(id) ON DELETE CASCADE,
    organization_name       VARCHAR(200) NOT NULL,
    stakeholder_type        VARCHAR(100),
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    scientific_field        VARCHAR(150),
    contact_name            VARCHAR(120),
    contact_email           CITEXT,
    existing_cooperation    BOOLEAN,
    cooperation_type        VARCHAR(120),
    cooperation_potential   TEXT,
    priority                SMALLINT CHECK (priority BETWEEN 1 AND 5),
    planned_new_cooperation BOOLEAN NOT NULL DEFAULT FALSE,
    planned_activities      TEXT,
    status                  VARCHAR(40),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE artistic_stakeholders (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stakeholder_analysis_id INTEGER NOT NULL REFERENCES stakeholder_analyses(id) ON DELETE CASCADE,
    organization_name       VARCHAR(200) NOT NULL,
    stakeholder_type        VARCHAR(100),
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    scientific_field        VARCHAR(150),
    contact_name            VARCHAR(120),
    contact_email           CITEXT,
    existing_cooperation    BOOLEAN,
    cooperation_type        VARCHAR(120),
    cooperation_potential   TEXT,
    priority                SMALLINT CHECK (priority BETWEEN 1 AND 5),
    planned_new_cooperation BOOLEAN NOT NULL DEFAULT FALSE,
    planned_activities      TEXT,
    status                  VARCHAR(40),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE professional_stakeholders (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stakeholder_analysis_id INTEGER NOT NULL REFERENCES stakeholder_analyses(id) ON DELETE CASCADE,
    organization_name       VARCHAR(200) NOT NULL,
    organization_kind       VARCHAR(100),
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    activity_field          VARCHAR(150),
    contact_name            VARCHAR(120),
    contact_email           CITEXT,
    unipu_membership        BOOLEAN,
    cooperation_type        VARCHAR(120),
    cooperation_potential   TEXT,
    priority                SMALLINT CHECK (priority BETWEEN 1 AND 5),
    planned_new_cooperation BOOLEAN NOT NULL DEFAULT FALSE,
    planned_activities      TEXT,
    status                  VARCHAR(40),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stakeholder_analysis_summaries (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stakeholder_analysis_id INTEGER NOT NULL UNIQUE REFERENCES stakeholder_analyses(id) ON DELETE CASCADE,
    science_stakeholder_count SMALLINT NOT NULL DEFAULT 0 CHECK (science_stakeholder_count BETWEEN 0 AND 9999),
    art_stakeholder_count   SMALLINT NOT NULL DEFAULT 0 CHECK (art_stakeholder_count BETWEEN 0 AND 9999),
    profession_stakeholder_count SMALLINT NOT NULL DEFAULT 0 CHECK (profession_stakeholder_count BETWEEN 0 AND 9999),
    total_stakeholder_count SMALLINT NOT NULL DEFAULT 0 CHECK (total_stakeholder_count BETWEEN 0 AND 9999),
    existing_cooperation_count SMALLINT NOT NULL DEFAULT 0 CHECK (existing_cooperation_count BETWEEN 0 AND 9999),
    high_potential_count    SMALLINT NOT NULL DEFAULT 0 CHECK (high_potential_count BETWEEN 0 AND 9999),
    planned_new_cooperation_count SMALLINT NOT NULL DEFAULT 0 CHECK (planned_new_cooperation_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. MEĐUNARODNE KONFERENCIJE

CREATE TABLE international_conferences (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    conference_name         VARCHAR(250) NOT NULL,
    held_on                 DATE,
    location                VARCHAR(150),
    organizer_unit_id       INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    coorganizers            TEXT,
    scientific_field        VARCHAR(150),
    total_participants      SMALLINT CHECK (total_participants IS NULL OR total_participants BETWEEN 0 AND 9999),
    foreign_participants    SMALLINT CHECK (foreign_participants IS NULL OR foreign_participants BETWEEN 0 AND 9999),
    country_count           SMALLINT CHECK (country_count IS NULL OR country_count BETWEEN 0 AND 250),
    presentation_count      SMALLINT CHECK (presentation_count IS NULL OR presentation_count BETWEEN 0 AND 9999),
    published_paper_count   SMALLINT CHECK (published_paper_count IS NULL OR published_paper_count BETWEEN 0 AND 9999),
    web_or_proceedings_link TEXT,
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE international_conference_details (
    id                          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conference_id               INTEGER NOT NULL UNIQUE REFERENCES international_conferences(id) ON DELETE CASCADE,
    english_name                VARCHAR(250),
    date_and_location           VARCHAR(250),
    organizing_committee_chair  VARCHAR(120),
    program_committee_chair     VARCHAR(120),
    unipu_program_members       TEXT,
    foreign_program_members     TEXT,
    submitted_abstract_count    SMALLINT CHECK (submitted_abstract_count IS NULL OR submitted_abstract_count BETWEEN 0 AND 9999),
    accepted_abstract_count     SMALLINT CHECK (accepted_abstract_count IS NULL OR accepted_abstract_count BETWEEN 0 AND 9999),
    plenary_lecture_count       SMALLINT CHECK (plenary_lecture_count IS NULL OR plenary_lecture_count BETWEEN 0 AND 999),
    section_count               SMALLINT CHECK (section_count IS NULL OR section_count BETWEEN 0 AND 999),
    proceedings_indexing        VARCHAR(150),
    conference_website          TEXT,
    media_coverage              TEXT,
    organization_cost_eur       NUMERIC(8,2) CHECK (
        organization_cost_eur IS NULL OR organization_cost_eur BETWEEN 0 AND 999999.99
    ),
    funding_sources             TEXT,
    created_by                  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by                  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conference_country_statistics (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conference_id           INTEGER NOT NULL REFERENCES international_conferences(id) ON DELETE CASCADE,
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    country_name            VARCHAR(100) NOT NULL,
    participant_count       SMALLINT CHECK (participant_count IS NULL OR participant_count BETWEEN 0 AND 9999),
    presentation_count      SMALLINT CHECK (presentation_count IS NULL OR presentation_count BETWEEN 0 AND 9999),
    share_percent           NUMERIC(5,2) CHECK (
        share_percent IS NULL OR share_percent BETWEEN 0 AND 100
    ),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. MEĐUNARODNA MOBILNOST OSOBLJA

CREATE TABLE staff_mobilities (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    mobility_type           VARCHAR(100) NOT NULL,
    program_name            VARCHAR(100),
    host_institution        VARCHAR(200),
    destination_country_id  INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    start_date              DATE,
    end_date                DATE,
    duration_days           SMALLINT CHECK (duration_days IS NULL OR duration_days BETWEEN 0 AND 999),
    mobility_purpose        TEXT,
    activities              TEXT,
    results                 TEXT,
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE staff_mobility_unit_analyses (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER NOT NULL REFERENCES organizational_units(id) ON DELETE RESTRICT,
    employee_count          SMALLINT NOT NULL DEFAULT 0 CHECK (employee_count BETWEEN 0 AND 9999),
    people_in_mobility_count SMALLINT NOT NULL DEFAULT 0 CHECK (people_in_mobility_count BETWEEN 0 AND 9999),
    mobility_count          SMALLINT NOT NULL DEFAULT 0 CHECK (mobility_count BETWEEN 0 AND 9999),
    average_per_person      NUMERIC(4,2) CHECK (average_per_person IS NULL OR average_per_person BETWEEN 0 AND 99.99),
    erasmus_teaching_count  SMALLINT NOT NULL DEFAULT 0 CHECK (erasmus_teaching_count BETWEEN 0 AND 9999),
    erasmus_training_count  SMALLINT NOT NULL DEFAULT 0 CHECK (erasmus_training_count BETWEEN 0 AND 9999),
    ceepus_count            SMALLINT NOT NULL DEFAULT 0 CHECK (ceepus_count BETWEEN 0 AND 9999),
    bilateral_count         SMALLINT NOT NULL DEFAULT 0 CHECK (bilateral_count BETWEEN 0 AND 9999),
    other_count             SMALLINT NOT NULL DEFAULT 0 CHECK (other_count BETWEEN 0 AND 9999),
    total_days              INTEGER NOT NULL DEFAULT 0 CHECK (total_days BETWEEN 0 AND 999999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_multiple_mobility_analyses (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    mobility_count          SMALLINT NOT NULL DEFAULT 0 CHECK (mobility_count BETWEEN 0 AND 9999),
    total_days              INTEGER NOT NULL DEFAULT 0 CHECK (total_days BETWEEN 0 AND 999999),
    countries               TEXT,
    programs                TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_mobility_country_analyses (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    country_name            VARCHAR(100) NOT NULL,
    mobility_count          SMALLINT NOT NULL DEFAULT 0 CHECK (mobility_count BETWEEN 0 AND 9999),
    people_count            SMALLINT NOT NULL DEFAULT 0 CHECK (people_count BETWEEN 0 AND 9999),
    total_days              INTEGER NOT NULL DEFAULT 0 CHECK (total_days BETWEEN 0 AND 999999),
    most_common_program     VARCHAR(100),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. MEĐUNARODNA SURADNJA

CREATE TABLE new_international_cooperations (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    partner_institution     VARCHAR(100) NOT NULL,
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    cooperation_kind        VARCHAR(20) CHECK (
        cooperation_kind IN ('SCIENTIFIC', 'ARTISTIC', 'PROFESSIONAL')
    ),
    cooperation_field       VARCHAR(150),
    start_date              DATE,
    duration                VARCHAR(80),
    agreement_type          VARCHAR(100),
    unipu_contact_person    VARCHAR(120),
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    planned_activities      TEXT,
    agreement_link          TEXT,
    status                  VARCHAR(40),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE active_international_agreements (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    partner_institution     VARCHAR(100) NOT NULL,
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    cooperation_kind        VARCHAR(20) CHECK (
        cooperation_kind IN ('SCIENTIFIC', 'ARTISTIC', 'PROFESSIONAL')
    ),
    agreement_type          VARCHAR(100),
    signed_on               DATE,
    valid_until             DATE,
    responsible_person      VARCHAR(120),
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    completed_activities    TEXT,
    planned_activities      TEXT,
    status                  VARCHAR(40),
    document_link           TEXT,
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (valid_until IS NULL OR signed_on IS NULL OR valid_until >= signed_on)
);

CREATE TABLE international_cooperation_region_analyses (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    region                  VARCHAR(20) NOT NULL CHECK (
        region IN (
            'EU', 'OTHER_EUROPE', 'NORTH_AMERICA', 'SOUTH_AMERICA',
            'ASIA', 'AFRICA', 'OCEANIA'
        )
    ),
    scientific_count        SMALLINT NOT NULL DEFAULT 0 CHECK (scientific_count BETWEEN 0 AND 9999),
    artistic_count          SMALLINT NOT NULL DEFAULT 0 CHECK (artistic_count BETWEEN 0 AND 9999),
    professional_count      SMALLINT NOT NULL DEFAULT 0 CHECK (professional_count BETWEEN 0 AND 9999),
    total_count             SMALLINT NOT NULL DEFAULT 0 CHECK (total_count BETWEEN 0 AND 9999),
    new_count               SMALLINT NOT NULL DEFAULT 0 CHECK (new_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. OPTIMIZIRANI RASPORED NASTAVNIKA

CREATE TABLE schedule_optimization_reports (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER NOT NULL REFERENCES organizational_units(id) ON DELETE RESTRICT,
    academic_year           VARCHAR(11) NOT NULL,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (academic_year, organizational_unit_id)
);

CREATE TABLE schedule_overload_cases (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL REFERENCES schedule_optimization_reports(id) ON DELETE CASCADE,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    teaching_norm           SMALLINT CHECK (teaching_norm IS NULL OR teaching_norm BETWEEN 0 AND 9999),
    current_load            SMALLINT CHECK (current_load IS NULL OR current_load BETWEEN 0 AND 9999),
    overload_percent        NUMERIC(5,2) CHECK (
        overload_percent IS NULL OR overload_percent BETWEEN 0 AND 999.99
    ),
    courses_to_reassign     TEXT,
    relief_proposal         TEXT,
    proposed_course_holder  VARCHAR(120),
    planned_reduction       SMALLINT CHECK (planned_reduction IS NULL OR planned_reduction BETWEEN 0 AND 9999),
    status                  VARCHAR(40),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE academic_promotion_cases (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL REFERENCES schedule_optimization_reports(id) ON DELETE CASCADE,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    current_title           VARCHAR(30),
    candidate_title         VARCHAR(30),
    election_deadline       DATE,
    current_load            SMALLINT CHECK (current_load IS NULL OR current_load BETWEEN 0 AND 9999),
    proposed_load           SMALLINT CHECK (proposed_load IS NULL OR proposed_load BETWEEN 0 AND 9999),
    courses_to_reassign     TEXT,
    replacement_course_holder VARCHAR(120),
    research_time           INTEGER CHECK (research_time IS NULL OR research_time BETWEEN 0 AND 999999),
    procedure_status        VARCHAR(40),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_optimization_summaries (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL UNIQUE REFERENCES schedule_optimization_reports(id) ON DELETE CASCADE,
    teachers_over_norm_count SMALLINT NOT NULL DEFAULT 0 CHECK (teachers_over_norm_count BETWEEN 0 AND 9999),
    teachers_in_reelection_count SMALLINT NOT NULL DEFAULT 0 CHECK (teachers_in_reelection_count BETWEEN 0 AND 9999),
    redistribution_hours    INTEGER NOT NULL DEFAULT 0 CHECK (redistribution_hours BETWEEN 0 AND 999999),
    courses_for_redistribution_count SMALLINT NOT NULL DEFAULT 0 CHECK (courses_for_redistribution_count BETWEEN 0 AND 9999),
    replacement_holders_needed SMALLINT NOT NULL DEFAULT 0 CHECK (replacement_holders_needed BETWEEN 0 AND 9999),
    estimated_research_time_hours INTEGER NOT NULL DEFAULT 0 CHECK (estimated_research_time_hours BETWEEN 0 AND 999999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PRILAGODBA RASPOREDA NASTAVE

CREATE TABLE schedule_adjustment_reports (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    academic_year           VARCHAR(11) NOT NULL,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_adjustment_measures (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL REFERENCES schedule_adjustment_reports(id) ON DELETE CASCADE,
    measure_type            VARCHAR(100) NOT NULL,
    measure_description     TEXT,
    beneficiary_count       SMALLINT CHECK (beneficiary_count IS NULL OR beneficiary_count BETWEEN 0 AND 9999),
    released_hours_per_week SMALLINT CHECK (released_hours_per_week IS NULL OR released_hours_per_week BETWEEN 0 AND 168),
    application_period      VARCHAR(100),
    status                  VARCHAR(40),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_adjustment_beneficiaries (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL REFERENCES schedule_adjustment_reports(id) ON DELETE CASCADE,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    measure_type            VARCHAR(100),
    adjustment_reason       TEXT,
    research_project_activity TEXT,
    released_time           VARCHAR(100),
    application_period      VARCHAR(100),
    results                 TEXT,
    status                  VARCHAR(40),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE planned_schedule_adjustments (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL REFERENCES schedule_adjustment_reports(id) ON DELETE CASCADE,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    planned_measure         VARCHAR(120),
    reason                  TEXT,
    planned_period          VARCHAR(100),
    expected_results        TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_adjustment_effect_analyses (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL UNIQUE REFERENCES schedule_adjustment_reports(id) ON DELETE CASCADE,
    adjusted_teacher_count  SMALLINT NOT NULL DEFAULT 0 CHECK (adjusted_teacher_count BETWEEN 0 AND 9999),
    released_research_hours INTEGER NOT NULL DEFAULT 0 CHECK (released_research_hours BETWEEN 0 AND 999999),
    submitted_research_project_count SMALLINT NOT NULL DEFAULT 0 CHECK (submitted_research_project_count BETWEEN 0 AND 9999),
    published_paper_count   SMALLINT NOT NULL DEFAULT 0 CHECK (published_paper_count BETWEEN 0 AND 9999),
    q1_q2_paper_count       SMALLINT NOT NULL DEFAULT 0 CHECK (q1_q2_paper_count BETWEEN 0 AND 9999),
    average_productivity_increase_percent NUMERIC(5,2) CHECK (
        average_productivity_increase_percent IS NULL
        OR average_productivity_increase_percent BETWEEN 0 AND 999.99
    ),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. SLOBODNA STUDIJSKA GODINA

CREATE TABLE sabbatical_reports (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    monitoring_period       VARCHAR(100),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sabbatical_users (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL REFERENCES sabbatical_reports(id) ON DELETE CASCADE,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER REFERENCES organizational_units(id) ON DELETE SET NULL,
    usage_period            VARCHAR(100),
    q1_paper_count          SMALLINT NOT NULL DEFAULT 0 CHECK (q1_paper_count BETWEEN 0 AND 999),
    q2_paper_count          SMALLINT NOT NULL DEFAULT 0 CHECK (q2_paper_count BETWEEN 0 AND 999),
    other_paper_count       SMALLINT NOT NULL DEFAULT 0 CHECK (other_paper_count BETWEEN 0 AND 999),
    monograph_count         SMALLINT NOT NULL DEFAULT 0 CHECK (monograph_count BETWEEN 0 AND 999),
    total_paper_count       SMALLINT NOT NULL DEFAULT 0 CHECK (total_paper_count BETWEEN 0 AND 999),
    status                  VARCHAR(40),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sabbatical_q1_q2_papers (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL REFERENCES sabbatical_reports(id) ON DELETE CASCADE,
    authors                 TEXT NOT NULL,
    paper_title             TEXT NOT NULL,
    journal                 VARCHAR(200),
    quartile                VARCHAR(2) CHECK (quartile IN ('Q1', 'Q2')),
    publication_year        SMALLINT CHECK (
        publication_year IS NULL OR publication_year BETWEEN 2000
        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT + 1
    ),
    doi_or_link             TEXT,
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sabbatical_monographs (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id               INTEGER NOT NULL REFERENCES sabbatical_reports(id) ON DELETE CASCADE,
    authors                 TEXT NOT NULL,
    monograph_title         TEXT NOT NULL,
    publisher               VARCHAR(200),
    publication_year        SMALLINT CHECK (
        publication_year IS NULL OR publication_year BETWEEN 2000
        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT + 1
    ),
    isbn                    VARCHAR(17),
    page_count              SMALLINT CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 9999),
    link_or_reviews         TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE VIEW v_sabbatical_summary AS
SELECT
    r.id AS report_id,
    COUNT(DISTINCT u.id) AS sabbatical_user_count,
    COUNT(DISTINCT u.id) FILTER (WHERE u.q1_paper_count + u.q2_paper_count > 0) AS users_with_q1_q2,
    ROUND(
        100.0 * COUNT(DISTINCT u.id) FILTER (WHERE u.q1_paper_count + u.q2_paper_count > 0)
        / NULLIF(COUNT(DISTINCT u.id), 0),
        2
    ) AS success_percent,
    COUNT(DISTINCT m.id) AS monograph_count
FROM sabbatical_reports r
LEFT JOIN sabbatical_users u ON u.report_id = r.id
LEFT JOIN sabbatical_monographs m ON m.report_id = r.id
GROUP BY r.id;

-- 14. ZAJEDNIČKA DOGAĐANJA

CREATE TABLE held_joint_events (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    event_name              VARCHAR(250) NOT NULL,
    event_type              VARCHAR(100),
    event_date              DATE,
    location                VARCHAR(150),
    unipu_organizers        TEXT,
    partner_organizations   TEXT,
    partner_country_id      INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    participant_count       SMALLINT CHECK (participant_count IS NULL OR participant_count BETWEEN 0 AND 9999),
    presentation_count      SMALLINT CHECK (presentation_count IS NULL OR presentation_count BETWEEN 0 AND 9999),
    thematic_field          VARCHAR(150),
    program_report_link     TEXT,
    media_coverage          TEXT,
    cost_eur                NUMERIC(8,2) CHECK (cost_eur IS NULL OR cost_eur BETWEEN 0 AND 999999.99),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE planned_joint_events (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    event_name              VARCHAR(250) NOT NULL,
    event_type              VARCHAR(100),
    planned_date            DATE,
    location                VARCHAR(150),
    unipu_organizer         VARCHAR(200),
    potential_partners      TEXT,
    country_id              INTEGER REFERENCES countries(id) ON DELETE SET NULL,
    expected_participant_count SMALLINT CHECK (
        expected_participant_count IS NULL OR expected_participant_count BETWEEN 0 AND 9999
    ),
    thematic_field          VARCHAR(150),
    preparation_status      VARCHAR(40),
    estimated_cost_eur      NUMERIC(8,2) CHECK (
        estimated_cost_eur IS NULL OR estimated_cost_eur BETWEEN 0 AND 999999.99
    ),
    funding_source          VARCHAR(150),
    responsible_person      VARCHAR(120),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE joint_event_type_analyses (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    event_type              VARCHAR(100) NOT NULL,
    held_count              SMALLINT NOT NULL DEFAULT 0 CHECK (held_count BETWEEN 0 AND 9999),
    planned_count           SMALLINT NOT NULL DEFAULT 0 CHECK (planned_count BETWEEN 0 AND 9999),
    total_participants      INTEGER NOT NULL DEFAULT 0 CHECK (total_participants BETWEEN 0 AND 999999),
    average_participants    NUMERIC(4,0) CHECK (
        average_participants IS NULL OR average_participants BETWEEN 0 AND 9999
    ),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. PROJEKTNE PRIJAVE I REALIZACIJA

CREATE TABLE project_applications (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    proposal_name           VARCHAR(250) NOT NULL,
    funding_source          VARCHAR(150),
    call_name               VARCHAR(250),
    call_link               TEXT,
    unipu_role              VARCHAR(100),
    involved_units          TEXT,
    partner_institutions    TEXT,
    total_project_amount_eur NUMERIC(8,2) CHECK (
        total_project_amount_eur IS NULL OR total_project_amount_eur BETWEEN 0 AND 999999.99
    ),
    unipu_share_eur         NUMERIC(8,2) CHECK (
        unipu_share_eur IS NULL OR unipu_share_eur BETWEEN 0 AND 999999.99
    ),
    implementation_duration VARCHAR(100),
    project_type            VARCHAR(20) CHECK (
        project_type IS NULL OR project_type IN ('DOMESTIC', 'INTERNATIONAL')
    ),
    planned_activities      TEXT,
    unipu_project_team      TEXT,
    submission_deadline     DATE,
    application_status      VARCHAR(20) CHECK (
        application_status IS NULL OR application_status IN ('APPROVED', 'REJECTED')
    ),
    contract_or_partnership_reference VARCHAR(150),
    contract_project_code   VARCHAR(80),
    notes                   TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- STUDENTSKE ANKETE

CREATE TABLE survey_action_plans (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER REFERENCES reporting_periods(id) ON DELETE SET NULL,
    staff_member_id         INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    inclusion_reasons       TEXT NOT NULL,
    observed_deficiency     TEXT,
    improvement_measures    TEXT,
    executed_measures_report TEXT,
    target_value            TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GLAVNO IZVJEŠĆE O RADU I POSLOVANJU FAKULTETA

CREATE TABLE faculty_reports (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporting_period_id     INTEGER NOT NULL REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    organizational_unit_id  INTEGER NOT NULL REFERENCES organizational_units(id) ON DELETE RESTRICT,
    dean_name               VARCHAR(120),
    report_date             DATE,
    strategic_framework_text TEXT,
    human_capital_text      TEXT,
    community_networking_text TEXT,
    entrepreneurship_infrastructure_text TEXT,
    regional_development_text TEXT,
    international_visibility_text TEXT,
    research_integrity_text TEXT,
    postgraduate_education_text TEXT,
    technology_education_text TEXT,
    study_program_development_text TEXT,
    student_experience_text TEXT,
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reporting_period_id, organizational_unit_id)
);

CREATE TABLE staff_elections (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    staff_name          VARCHAR(120) NOT NULL,
    election_type       VARCHAR(30),
    job_position        VARCHAR(100),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE newly_employed_teachers (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    staff_name          VARCHAR(120) NOT NULL,
    academic_title      VARCHAR(30),
    employment_date     DATE,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE retired_teachers (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    staff_name          VARCHAR(120) NOT NULL,
    academic_title      VARCHAR(30),
    retirement_date     DATE,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctoral_assistants (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    assistant_name      VARCHAR(120) NOT NULL,
    study_name_provider VARCHAR(250),
    current_status      TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faculty_committees (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    committee_name      VARCHAR(150) NOT NULL,
    members             TEXT,
    mandate             VARCHAR(100),
    report_link         TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faculty_council_statistics (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL UNIQUE REFERENCES faculty_reports(id) ON DELETE CASCADE,
    meeting_count       SMALLINT CHECK (meeting_count IS NULL OR meeting_count BETWEEN 0 AND 999),
    meetings_with_students_count SMALLINT CHECK (
        meetings_with_students_count IS NULL OR meetings_with_students_count BETWEEN 0 AND 999
    ),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faculty_council_meeting_records (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    record_title        VARCHAR(250) NOT NULL,
    meeting_date        DATE,
    record_link         TEXT NOT NULL,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alumni_organizations (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    alumni_name         VARCHAR(150) NOT NULL,
    founded_on          DATE,
    current_member_count SMALLINT CHECK (current_member_count IS NULL OR current_member_count BETWEEN 0 AND 9999),
    previous_member_count SMALLINT CHECK (previous_member_count IS NULL OR previous_member_count BETWEEN 0 AND 9999),
    president_contact   VARCHAR(180),
    annual_activity_count SMALLINT CHECK (annual_activity_count IS NULL OR annual_activity_count BETWEEN 0 AND 999),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_partners (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    institution_name    VARCHAR(200) NOT NULL,
    sector              VARCHAR(100),
    cooperation_type    VARCHAR(150),
    status              VARCHAR(30),
    agreement_year      SMALLINT CHECK (
        agreement_year IS NULL OR agreement_year BETWEEN 1950
        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT + 1
    ),
    annual_results      TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE funded_projects (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    project_name        VARCHAR(250) NOT NULL,
    acronym             VARCHAR(30),
    funding_program     VARCHAR(150),
    amount_eur          NUMERIC(8,2) CHECK (
        amount_eur IS NULL OR amount_eur BETWEEN 0 AND 999999.99
    ),
    start_date          DATE,
    end_date            DATE,
    project_leader      VARCHAR(120),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE doctoral_generation_statistics (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id       INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    enrollment_year_label   VARCHAR(10) NOT NULL,
    enrolled_count          SMALLINT NOT NULL DEFAULT 0 CHECK (enrolled_count BETWEEN 0 AND 9999),
    employed_outside_unipu_count SMALLINT NOT NULL DEFAULT 0 CHECK (employed_outside_unipu_count BETWEEN 0 AND 9999),
    active_status_count     SMALLINT NOT NULL DEFAULT 0 CHECK (active_status_count BETWEEN 0 AND 9999),
    withdrawn_no_status_count SMALLINT NOT NULL DEFAULT 0 CHECK (withdrawn_no_status_count BETWEEN 0 AND 9999),
    graduated_count         SMALLINT NOT NULL DEFAULT 0 CHECK (graduated_count BETWEEN 0 AND 9999),
    mobility_count          SMALLINT NOT NULL DEFAULT 0 CHECK (mobility_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE defended_doctoral_dissertations (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    doctoral_student_name VARCHAR(120) NOT NULL,
    dissertation_title  TEXT,
    defense_date        DATE,
    mentor_name         VARCHAR(120),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctoral_co_mentors (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    co_mentor_name      VARCHAR(120) NOT NULL,
    home_unit_country   VARCHAR(250),
    dissertation_and_student TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE external_doctoral_mentorships (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    teacher_name        VARCHAR(120) NOT NULL,
    doctoral_study_university VARCHAR(250),
    dissertation_and_student TEXT,
    appointed_on        DATE,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE specialist_generation_statistics (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id       INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    enrollment_year_label   VARCHAR(10) NOT NULL,
    enrolled_count          SMALLINT NOT NULL DEFAULT 0 CHECK (enrolled_count BETWEEN 0 AND 9999),
    employed_outside_unipu_count SMALLINT NOT NULL DEFAULT 0 CHECK (employed_outside_unipu_count BETWEEN 0 AND 9999),
    active_status_count     SMALLINT NOT NULL DEFAULT 0 CHECK (active_status_count BETWEEN 0 AND 9999),
    withdrawn_no_status_count SMALLINT NOT NULL DEFAULT 0 CHECK (withdrawn_no_status_count BETWEEN 0 AND 9999),
    graduated_count         SMALLINT NOT NULL DEFAULT 0 CHECK (graduated_count BETWEEN 0 AND 9999),
    mobility_count          SMALLINT NOT NULL DEFAULT 0 CHECK (mobility_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE defended_specialist_works (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    student_name        VARCHAR(120) NOT NULL,
    work_title          TEXT,
    defense_date        DATE,
    mentor_name         VARCHAR(120),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE digital_tool_usage (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    tool_type           VARCHAR(100) NOT NULL,
    course_count        SMALLINT NOT NULL DEFAULT 0 CHECK (course_count BETWEEN 0 AND 9999),
    teacher_count       SMALLINT NOT NULL DEFAULT 0 CHECK (teacher_count BETWEEN 0 AND 9999),
    usage_type          TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE innovative_teaching_methods (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    method_type         VARCHAR(150) NOT NULL,
    course_count        SMALLINT NOT NULL DEFAULT 0 CHECK (course_count BETWEEN 0 AND 9999),
    teacher_count       SMALLINT NOT NULL DEFAULT 0 CHECK (teacher_count BETWEEN 0 AND 9999),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE full_time_study_enrollments (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id       INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    study_name              VARCHAR(200) NOT NULL,
    study_year              SMALLINT NOT NULL CHECK (study_year BETWEEN 1 AND 4),
    first_enrollment_count  SMALLINT NOT NULL DEFAULT 0 CHECK (first_enrollment_count BETWEEN 0 AND 9999),
    repeat_enrollment_count SMALLINT NOT NULL DEFAULT 0 CHECK (repeat_enrollment_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE part_time_study_enrollments (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id       INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    study_name              VARCHAR(200) NOT NULL,
    study_year              SMALLINT NOT NULL CHECK (study_year BETWEEN 1 AND 4),
    first_enrollment_count  SMALLINT NOT NULL DEFAULT 0 CHECK (first_enrollment_count BETWEEN 0 AND 9999),
    repeat_enrollment_count SMALLINT NOT NULL DEFAULT 0 CHECK (repeat_enrollment_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE english_course_statistics (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL UNIQUE REFERENCES faculty_reports(id) ON DELETE CASCADE,
    current_year_count  SMALLINT NOT NULL DEFAULT 0 CHECK (current_year_count BETWEEN 0 AND 9999),
    previous_year_count SMALLINT NOT NULL DEFAULT 0 CHECK (previous_year_count BETWEEN 0 AND 9999),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE foreign_student_statistics (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    study_name          VARCHAR(200) NOT NULL,
    current_total       SMALLINT NOT NULL DEFAULT 0 CHECK (current_total BETWEEN 0 AND 9999),
    current_eu          SMALLINT NOT NULL DEFAULT 0 CHECK (current_eu BETWEEN 0 AND 9999),
    current_non_eu      SMALLINT NOT NULL DEFAULT 0 CHECK (current_non_eu BETWEEN 0 AND 9999),
    previous_total      SMALLINT NOT NULL DEFAULT 0 CHECK (previous_total BETWEEN 0 AND 9999),
    previous_eu         SMALLINT NOT NULL DEFAULT 0 CHECK (previous_eu BETWEEN 0 AND 9999),
    previous_non_eu     SMALLINT NOT NULL DEFAULT 0 CHECK (previous_non_eu BETWEEN 0 AND 9999),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (current_eu + current_non_eu <= current_total),
    CHECK (previous_eu + previous_non_eu <= previous_total)
);

CREATE TABLE commission_exams (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    student_name        VARCHAR(120) NOT NULL,
    courses             TEXT,
    committee           TEXT,
    held_on             DATE,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE external_teachers (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    teacher_name        VARCHAR(120) NOT NULL,
    academic_title      VARCHAR(30),
    courses             TEXT,
    contact_hours       SMALLINT CHECK (contact_hours IS NULL OR contact_hours BETWEEN 0 AND 999),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lifelong_learning_programs (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id       INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    program_name            VARCHAR(250) NOT NULL,
    current_participant_count SMALLINT NOT NULL DEFAULT 0 CHECK (current_participant_count BETWEEN 0 AND 9999),
    previous_participant_count SMALLINT NOT NULL DEFAULT 0 CHECK (previous_participant_count BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_mobility_statistics (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id       INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    mobility_direction      VARCHAR(10) NOT NULL CHECK (mobility_direction IN ('OUTGOING', 'INCOMING')),
    current_erasmus         SMALLINT NOT NULL DEFAULT 0 CHECK (current_erasmus BETWEEN 0 AND 9999),
    previous_erasmus        SMALLINT NOT NULL DEFAULT 0 CHECK (previous_erasmus BETWEEN 0 AND 9999),
    current_other           SMALLINT NOT NULL DEFAULT 0 CHECK (current_other BETWEEN 0 AND 9999),
    previous_other          SMALLINT NOT NULL DEFAULT 0 CHECK (previous_other BETWEEN 0 AND 9999),
    created_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by              INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE field_teaching_activities (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    courses             TEXT,
    activity_date       DATE,
    location_institution VARCHAR(250),
    activity_description TEXT,
    learning_outcomes   TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_competitions (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    competition_name    VARCHAR(250) NOT NULL,
    organizer_location  VARCHAR(250),
    competition_type    VARCHAR(80),
    event_date          DATE,
    participants        TEXT,
    result_award        TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_awards (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    student_name        VARCHAR(120) NOT NULL,
    work_title          TEXT,
    work_type           VARCHAR(100),
    award_name          VARCHAR(200),
    awarding_body       VARCHAR(200),
    awarded_on          DATE,
    mentor_name         VARCHAR(120),
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE extracurricular_activities (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   INTEGER NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    activity_name       VARCHAR(250) NOT NULL,
    activity_type       VARCHAR(100),
    students_and_year   TEXT,
    organizer           VARCHAR(200),
    short_description   TEXT,
    created_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AUTOMATSKO AŽURIRANJE updated_at

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'organizational_units', 'users', 'staff_members', 'reporting_periods', 'organizations',
        'membership_category_summaries', 'visiting_researcher_unit_analyses', 'stakeholder_analysis_summaries', 'staff_mobility_unit_analyses', 'staff_multiple_mobility_analyses', 'staff_mobility_country_analyses', 'international_cooperation_region_analyses', 'schedule_optimization_summaries', 'schedule_adjustment_effect_analyses', 'joint_event_type_analyses',
        'new_memberships', 'active_memberships',
        'professional_developments', 'professional_development_confirmations', 'professional_development_media',
        'event_participations', 'event_organizer_confirmations', 'event_media',
        'workshops', 'workshop_details', 'workshop_media', 'coauthorship_year_totals', 'coauthored_papers', 'coauthorship_category_summaries',
        'realized_visiting_researchers', 'planned_visiting_researchers',
        'stakeholder_analyses', 'science_stakeholders', 'artistic_stakeholders', 'professional_stakeholders',
        'international_conferences', 'international_conference_details', 'conference_country_statistics',
        'staff_mobilities', 'new_international_cooperations', 'active_international_agreements',
        'schedule_optimization_reports', 'schedule_overload_cases', 'academic_promotion_cases',
        'schedule_adjustment_reports', 'schedule_adjustment_measures',
        'schedule_adjustment_beneficiaries', 'planned_schedule_adjustments',
        'sabbatical_reports', 'sabbatical_users', 'sabbatical_q1_q2_papers', 'sabbatical_monographs',
        'held_joint_events', 'planned_joint_events', 'project_applications', 'survey_action_plans',
        'faculty_reports', 'staff_elections', 'newly_employed_teachers', 'retired_teachers',
        'doctoral_assistants', 'faculty_committees', 'faculty_council_statistics', 'faculty_council_meeting_records',
        'alumni_organizations', 'business_partners', 'funded_projects',
        'doctoral_generation_statistics', 'defended_doctoral_dissertations',
        'doctoral_co_mentors', 'external_doctoral_mentorships',
        'specialist_generation_statistics', 'defended_specialist_works',
        'digital_tool_usage', 'innovative_teaching_methods',
        'full_time_study_enrollments', 'part_time_study_enrollments',
        'english_course_statistics', 'foreign_student_statistics',
        'commission_exams', 'external_teachers', 'lifelong_learning_programs',
        'student_mobility_statistics', 'field_teaching_activities',
        'student_competitions', 'student_awards', 'extracurricular_activities'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name, table_name
        );
    END LOOP;
END $$;

-- INDEKSI ZA LISTE, FILTERE I POČETNU STRANICU

CREATE INDEX idx_staff_members_unit ON staff_members(organizational_unit_id);
CREATE INDEX idx_organizations_country ON organizations(country_id);

CREATE INDEX idx_membership_summaries_period ON membership_category_summaries(reporting_period_id);
CREATE INDEX idx_visiting_unit_analysis_period ON visiting_researcher_unit_analyses(reporting_period_id);
CREATE INDEX idx_staff_mobility_unit_analysis_period ON staff_mobility_unit_analyses(reporting_period_id);
CREATE INDEX idx_staff_multiple_mobility_period ON staff_multiple_mobility_analyses(reporting_period_id);
CREATE INDEX idx_staff_mobility_country_analysis_period ON staff_mobility_country_analyses(reporting_period_id);
CREATE INDEX idx_cooperation_region_analysis_period ON international_cooperation_region_analyses(reporting_period_id);
CREATE INDEX idx_joint_event_type_analysis_period ON joint_event_type_analyses(reporting_period_id);

CREATE INDEX idx_new_memberships_period ON new_memberships(reporting_period_id);
CREATE INDEX idx_active_memberships_period ON active_memberships(reporting_period_id);
CREATE INDEX idx_professional_developments_period ON professional_developments(reporting_period_id);
CREATE INDEX idx_event_participations_period ON event_participations(reporting_period_id);
CREATE INDEX idx_workshops_period ON workshops(reporting_period_id);
CREATE INDEX idx_coauthorship_year_totals_period ON coauthorship_year_totals(reporting_period_id);
CREATE INDEX idx_coauthored_papers_period ON coauthored_papers(reporting_period_id);
CREATE INDEX idx_coauthorship_categories_period ON coauthorship_category_summaries(reporting_period_id);
CREATE INDEX idx_realized_visitors_period ON realized_visiting_researchers(reporting_period_id);
CREATE INDEX idx_planned_visitors_period ON planned_visiting_researchers(reporting_period_id);
CREATE INDEX idx_conferences_period ON international_conferences(reporting_period_id);
CREATE INDEX idx_staff_mobilities_period ON staff_mobilities(reporting_period_id);
CREATE INDEX idx_new_cooperations_period ON new_international_cooperations(reporting_period_id);
CREATE INDEX idx_active_agreements_period ON active_international_agreements(reporting_period_id);
CREATE INDEX idx_held_joint_events_period ON held_joint_events(reporting_period_id);
CREATE INDEX idx_planned_joint_events_period ON planned_joint_events(reporting_period_id);
CREATE INDEX idx_project_applications_period ON project_applications(reporting_period_id);
CREATE INDEX idx_faculty_reports_period ON faculty_reports(reporting_period_id);
CREATE INDEX idx_faculty_council_records_report ON faculty_council_meeting_records(faculty_report_id);

CREATE INDEX idx_new_memberships_recent ON new_memberships(updated_by, updated_at DESC);
CREATE INDEX idx_active_memberships_recent ON active_memberships(updated_by, updated_at DESC);
CREATE INDEX idx_professional_developments_recent ON professional_developments(updated_by, updated_at DESC);
CREATE INDEX idx_event_participations_recent ON event_participations(updated_by, updated_at DESC);
CREATE INDEX idx_workshops_recent ON workshops(updated_by, updated_at DESC);
CREATE INDEX idx_coauthored_papers_recent ON coauthored_papers(updated_by, updated_at DESC);
CREATE INDEX idx_realized_visitors_recent ON realized_visiting_researchers(updated_by, updated_at DESC);
CREATE INDEX idx_planned_visitors_recent ON planned_visiting_researchers(updated_by, updated_at DESC);
CREATE INDEX idx_conferences_recent ON international_conferences(updated_by, updated_at DESC);
CREATE INDEX idx_staff_mobilities_recent ON staff_mobilities(updated_by, updated_at DESC);
CREATE INDEX idx_new_cooperations_recent ON new_international_cooperations(updated_by, updated_at DESC);
CREATE INDEX idx_active_agreements_recent ON active_international_agreements(updated_by, updated_at DESC);
CREATE INDEX idx_held_joint_events_recent ON held_joint_events(updated_by, updated_at DESC);
CREATE INDEX idx_planned_joint_events_recent ON planned_joint_events(updated_by, updated_at DESC);
CREATE INDEX idx_project_applications_recent ON project_applications(updated_by, updated_at DESC);
CREATE INDEX idx_survey_action_plans_recent ON survey_action_plans(updated_by, updated_at DESC);
CREATE INDEX idx_faculty_reports_recent ON faculty_reports(updated_by, updated_at DESC);

-- DINAMIČKI FILTERI

CREATE VIEW v_membership_filter_options AS
SELECT
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT organization_kind ORDER BY organization_kind), NULL) AS organization_kinds,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT organization_level ORDER BY organization_level), NULL) AS organization_levels,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT membership_type ORDER BY membership_type), NULL) AS membership_types
FROM (
    SELECT organization_kind, organization_level, membership_type FROM new_memberships
    UNION ALL
    SELECT organization_kind, organization_level, membership_type FROM active_memberships
) memberships;

CREATE VIEW v_professional_development_filter_options AS
SELECT
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT development_type ORDER BY development_type), NULL) AS development_types,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT host_organization_name ORDER BY host_organization_name), NULL) AS host_organizations
FROM professional_developments;

CREATE VIEW v_event_participation_filter_options AS
SELECT
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT participation_type ORDER BY participation_type), NULL) AS participation_types,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT location ORDER BY location), NULL) AS locations
FROM event_participations;

CREATE VIEW v_workshop_filter_options AS
SELECT
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT target_group ORDER BY target_group), NULL) AS target_groups,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT location ORDER BY location), NULL) AS locations
FROM workshops;

CREATE VIEW v_project_filter_options AS
SELECT
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT funding_source ORDER BY funding_source), NULL) AS funding_sources,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT call_name ORDER BY call_name), NULL) AS calls,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT application_status ORDER BY application_status), NULL) AS application_statuses
FROM project_applications;

-- PERSONALIZIRANA POČETNA STRANICA

CREATE VIEW v_recent_records AS
SELECT id AS record_id, 'NEW_MEMBERSHIPS'::TEXT AS record_type,
       'Nova članstva'::TEXT AS module_name, organization_name::TEXT AS record_title,
       reporting_period_id, updated_by, updated_at
FROM new_memberships
UNION ALL
SELECT id, 'ACTIVE_MEMBERSHIPS', 'Aktivna članstva', organization_name,
       reporting_period_id, updated_by, updated_at
FROM active_memberships
UNION ALL
SELECT id, 'PROFESSIONAL_DEVELOPMENTS', 'Stručna usavršavanja', program_name,
       reporting_period_id, updated_by, updated_at
FROM professional_developments
UNION ALL
SELECT id, 'EVENT_PARTICIPATIONS', 'Sudjelovanja na skupovima', event_name,
       reporting_period_id, updated_by, updated_at
FROM event_participations
UNION ALL
SELECT id, 'WORKSHOPS', 'Radionice', workshop_name,
       reporting_period_id, updated_by, updated_at
FROM workshops
UNION ALL
SELECT id, 'COAUTHORED_PAPERS', 'Koautorski radovi', authors_and_title,
       reporting_period_id, updated_by, updated_at
FROM coauthored_papers
UNION ALL
SELECT id, 'REALIZED_VISITING_RESEARCHERS', 'Realizirana gostovanja', researcher_name,
       reporting_period_id, updated_by, updated_at
FROM realized_visiting_researchers
UNION ALL
SELECT id, 'PLANNED_VISITING_RESEARCHERS', 'Planirana gostovanja', researcher_name,
       reporting_period_id, updated_by, updated_at
FROM planned_visiting_researchers
UNION ALL
SELECT id, 'INTERNATIONAL_CONFERENCES', 'Međunarodne konferencije', conference_name,
       reporting_period_id, updated_by, updated_at
FROM international_conferences
UNION ALL
SELECT id, 'STAFF_MOBILITIES', 'Mobilnost osoblja',
       COALESCE(host_institution, mobility_purpose, 'Mobilnost osoblja'),
       reporting_period_id, updated_by, updated_at
FROM staff_mobilities
UNION ALL
SELECT id, 'NEW_INTERNATIONAL_COOPERATIONS', 'Nove međunarodne suradnje', partner_institution,
       reporting_period_id, updated_by, updated_at
FROM new_international_cooperations
UNION ALL
SELECT id, 'ACTIVE_INTERNATIONAL_AGREEMENTS', 'Aktivni međunarodni ugovori', partner_institution,
       reporting_period_id, updated_by, updated_at
FROM active_international_agreements
UNION ALL
SELECT id, 'HELD_JOINT_EVENTS', 'Održana zajednička događanja', event_name,
       reporting_period_id, updated_by, updated_at
FROM held_joint_events
UNION ALL
SELECT id, 'PLANNED_JOINT_EVENTS', 'Planirana zajednička događanja', event_name,
       reporting_period_id, updated_by, updated_at
FROM planned_joint_events
UNION ALL
SELECT id, 'PROJECT_APPLICATIONS', 'Projektne prijave', proposal_name,
       reporting_period_id, updated_by, updated_at
FROM project_applications
UNION ALL
SELECT id, 'SURVEY_ACTION_PLANS', 'Mjere nakon studentskih anketa',
       ('Nastavnik #' || staff_member_id)::TEXT,
       reporting_period_id, updated_by, updated_at
FROM survey_action_plans
UNION ALL
SELECT id, 'FACULTY_REPORTS', 'Godišnje izvješće fakulteta',
       ('Izvješće #' || id)::TEXT,
       reporting_period_id, updated_by, updated_at
FROM faculty_reports;

COMMIT;
