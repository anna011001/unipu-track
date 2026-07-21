BEGIN;

CREATE SCHEMA IF NOT EXISTS unipu_track;
SET search_path TO unipu_track, public;

CREATE EXTENSION IF NOT EXISTS citext;


-- ENUM TYPES

CREATE TYPE user_role AS ENUM ('PROFESSOR', 'ADMIN');
CREATE TYPE document_status AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'LOCKED', 'ARCHIVED');
CREATE TYPE approval_decision AS ENUM ('PENDING', 'APPROVED', 'RETURNED', 'REJECTED');
CREATE TYPE activity_action AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'RETURNED', 'LOCKED', 'UNLOCKED', 'PRINTED', 'EXPORTED', 'DELETED');
CREATE TYPE record_phase AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE yes_no AS ENUM ('YES', 'NO');

-- COMMON / SECURITY / WORKFLOW TABLES

CREATE TABLE organizational_units (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(160) NOT NULL,
    short_name          VARCHAR(80),
    unit_type           VARCHAR(80),
    parent_id           BIGINT REFERENCES organizational_units(id) ON DELETE SET NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name)
);

CREATE TABLE users (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizational_unit_id BIGINT REFERENCES organizational_units(id) ON DELETE SET NULL,
    email               CITEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    first_name          VARCHAR(120) NOT NULL,
    last_name           VARCHAR(120) NOT NULL,
    academic_title      VARCHAR(160),
    role                user_role NOT NULL DEFAULT 'PROFESSOR',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_members (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    organizational_unit_id BIGINT REFERENCES organizational_units(id) ON DELETE SET NULL,
    first_name          VARCHAR(120) NOT NULL,
    last_name           VARCHAR(120) NOT NULL,
    academic_title      VARCHAR(160),
    employment_status   VARCHAR(80) DEFAULT 'ACTIVE',
    email               CITEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reporting_periods (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(80) NOT NULL,
    period_type         VARCHAR(30) NOT NULL CHECK (period_type IN ('CALENDAR_YEAR', 'ACADEMIC_YEAR', 'CUSTOM')),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    is_closed           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date),
    UNIQUE (name, period_type)
);

CREATE TABLE countries (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    iso2_code           CHAR(2) UNIQUE,
    name_hr             VARCHAR(120) NOT NULL UNIQUE,
    name_en             VARCHAR(120),
    region              VARCHAR(80),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE organizations (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(160) NOT NULL,
    organization_type   VARCHAR(120),
    country_id          BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    city                VARCHAR(120),
    website_url         TEXT,
    contact_name        VARCHAR(150),
    contact_email       CITEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, country_id)
);

-- One generic document row for every form/record
-- homepage, approvals, signatures, attachments, printing and audit logs
CREATE TABLE documents (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    module_code         VARCHAR(80) NOT NULL,
    title               VARCHAR(500) NOT NULL,
    reporting_period_id BIGINT REFERENCES reporting_periods(id) ON DELETE SET NULL,
    organizational_unit_id BIGINT REFERENCES organizational_units(id) ON DELETE SET NULL,
    owner_user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_by          BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by          BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status              document_status NOT NULL DEFAULT 'DRAFT',
    submitted_at        TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    locked_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_owner_updated ON documents(owner_user_id, updated_at DESC);
CREATE INDEX idx_documents_module_status ON documents(module_code, status);
CREATE INDEX idx_documents_period ON documents(reporting_period_id);

CREATE TABLE document_approvals (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    approver_user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision            approval_decision NOT NULL DEFAULT 'PENDING',
    comment             TEXT,
    signature_image_path TEXT,
    decided_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attachments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    uploaded_by         BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name           VARCHAR(255) NOT NULL,
    storage_path        TEXT NOT NULL,
    mime_type           VARCHAR(160),
    file_size_bytes     BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    attachment_type     VARCHAR(80),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_log (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT REFERENCES documents(id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action              activity_action NOT NULL,
    details             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_user_recent ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_document_recent ON activity_log(document_id, created_at DESC);


-- 1. MEMBERSHIPS IN SCIENTIFIC, PROFESSIONAL AND ART ORGANIZATIONS

CREATE TABLE memberships (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    organization_id     BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    organization_name   VARCHAR(200) NOT NULL,
    membership_domain   VARCHAR(40) NOT NULL CHECK (membership_domain IN ('SCIENTIFIC', 'PROFESSIONAL', 'ARTISTIC')),
    membership_level    VARCHAR(40) CHECK (membership_level IN ('INTERNATIONAL', 'NATIONAL', 'REGIONAL', 'OTHER')),
    headquarters_country_id BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    joined_on           DATE,
    joined_year         SMALLINT,
    membership_type     VARCHAR(160),
    annual_fee_eur      NUMERIC(12,2) CHECK (annual_fee_eur IS NULL OR annual_fee_eur >= 0),
    representative_staff_id BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
    benefits            TEXT,
    activities          TEXT,
    evidence_url        TEXT,
    membership_status   VARCHAR(50) DEFAULT 'ACTIVE',
    is_new_in_period    BOOLEAN NOT NULL DEFAULT FALSE,
    notes               TEXT
);


-- 2. PROFESSIONAL DEVELOPMENT

CREATE TABLE professional_developments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    development_type    VARCHAR(120) NOT NULL,
    program_name        VARCHAR(500) NOT NULL,
    host_organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    host_organization_name VARCHAR(200),
    country_id          BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    start_date          DATE,
    end_date            DATE,
    media_url           TEXT,
    notes               TEXT,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE external_confirmations (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_name   VARCHAR(200) NOT NULL,
    signer_name         VARCHAR(150),
    signer_role         VARCHAR(160),
    signed_on           DATE,
    signature_file_path TEXT,
    stamp_file_path     TEXT,
    confirmation_url    TEXT,
    notes               TEXT
);

CREATE TABLE media_links (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    item_name           VARCHAR(500),
    media_type          VARCHAR(100),
    url                 TEXT NOT NULL,
    published_on        DATE,
    notes               TEXT
);


-- 3. PARTICIPATION IN SCIENTIFIC AND PROFESSIONAL EVENTS

CREATE TABLE event_participations (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    participation_type  VARCHAR(120) NOT NULL,
    event_name          VARCHAR(500) NOT NULL,
    organizer_name      VARCHAR(255),
    location            VARCHAR(160),
    country_id          BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    event_date          DATE,
    presentation_title  TEXT,
    program_url         TEXT,
    notes               TEXT
);


-- 4. WORKSHOPS


CREATE TABLE workshops (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    name                VARCHAR(500) NOT NULL,
    leaders_text        TEXT,
    organizational_unit_id BIGINT REFERENCES organizational_units(id) ON DELETE SET NULL,
    target_group        VARCHAR(160),
    participant_count   INTEGER CHECK (participant_count IS NULL OR participant_count >= 0),
    location            VARCHAR(160),
    held_on             DATE,
    duration_hours      NUMERIC(7,2) CHECK (duration_hours IS NULL OR duration_hours >= 0),
    content_description TEXT,
    goals               TEXT,
    learning_outcomes   TEXT,
    work_methods        TEXT,
    materials_resources TEXT,
    evaluation          TEXT,
    media_url           TEXT,
    notes               TEXT
);

CREATE TABLE workshop_leaders (
    workshop_id         BIGINT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (workshop_id, staff_member_id)
);


-- 5. CO-AUTHORED SCIENTIFIC PAPERS

CREATE TABLE coauthored_papers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    authors_and_title   TEXT NOT NULL,
    publication_year    SMALLINT NOT NULL CHECK (publication_year BETWEEN 1900 AND 2200),
    publication_url     TEXT,
    doi                 VARCHAR(255),
    paper_category      VARCHAR(80) CHECK (paper_category IN ('WOS_SCOPUS_Q1_Q2', 'WOS_SCOPUS_Q3_Q4', 'OTHER_INTERNATIONAL_JOURNAL', 'DOMESTIC_JOURNAL', 'BOOK_CHAPTER', 'PROCEEDINGS', 'OTHER')),
    international_coauthor BOOLEAN NOT NULL DEFAULT TRUE,
    publication_status  VARCHAR(40) DEFAULT 'PUBLISHED',
    notes               TEXT
);


-- 6. INTERNATIONAL VISITING RESEARCHERS

CREATE TABLE visiting_researcher_visits (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    researcher_name     VARCHAR(150) NOT NULL,
    academic_title      VARCHAR(160),
    home_organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    home_organization_name VARCHAR(200),
    country_id          BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    scientific_field    VARCHAR(160),
    arrival_date        DATE,
    departure_date      DATE,
    host_unit_id        BIGINT REFERENCES organizational_units(id) ON DELETE SET NULL,
    mentor_staff_id     BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
    mentor_contact_text VARCHAR(180),
    activities          TEXT,
    results             TEXT,
    visit_phase         record_phase NOT NULL DEFAULT 'PLANNED',
    invitation_status   VARCHAR(80),
    funding_source      VARCHAR(160),
    notes               TEXT,
    CHECK (departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date)
);


-- 7. STAKEHOLDER MAPPING

CREATE TABLE stakeholder_analyses (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    analysis_date       DATE,
    responsible_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes               TEXT
);

CREATE TABLE stakeholders (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stakeholder_analysis_id BIGINT NOT NULL REFERENCES stakeholder_analyses(id) ON DELETE CASCADE,
    organization_id     BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    organization_name   VARCHAR(200) NOT NULL,
    stakeholder_area    VARCHAR(40) NOT NULL CHECK (stakeholder_area IN ('SCIENCE', 'ART', 'PROFESSION')),
    stakeholder_type    VARCHAR(160),
    country_id          BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    activity_field      VARCHAR(160),
    contact_name        VARCHAR(150),
    contact_email       CITEXT,
    existing_cooperation BOOLEAN,
    unipu_membership    BOOLEAN,
    cooperation_type    VARCHAR(120),
    cooperation_potential TEXT,
    priority            SMALLINT CHECK (priority BETWEEN 1 AND 5),
    planned_activities  TEXT,
    stakeholder_status  VARCHAR(80),
    notes               TEXT
);


-- 8. INTERNATIONAL CONFERENCES ORGANIZED / CO-ORGANIZED

CREATE TABLE international_conferences (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    name                VARCHAR(500) NOT NULL,
    english_name        VARCHAR(500),
    held_on             DATE,
    location            VARCHAR(160),
    organizer_unit_id   BIGINT REFERENCES organizational_units(id) ON DELETE SET NULL,
    co_organizers       TEXT,
    scientific_field    VARCHAR(160),
    total_participants  INTEGER CHECK (total_participants IS NULL OR total_participants >= 0),
    foreign_participants INTEGER CHECK (foreign_participants IS NULL OR foreign_participants >= 0),
    country_count       INTEGER CHECK (country_count IS NULL OR country_count >= 0),
    presentation_count  INTEGER CHECK (presentation_count IS NULL OR presentation_count >= 0),
    published_paper_count INTEGER CHECK (published_paper_count IS NULL OR published_paper_count >= 0),
    submitted_abstract_count INTEGER CHECK (submitted_abstract_count IS NULL OR submitted_abstract_count >= 0),
    accepted_abstract_count INTEGER CHECK (accepted_abstract_count IS NULL OR accepted_abstract_count >= 0),
    plenary_lecture_count INTEGER CHECK (plenary_lecture_count IS NULL OR plenary_lecture_count >= 0),
    section_count       INTEGER CHECK (section_count IS NULL OR section_count >= 0),
    organizing_committee_chair VARCHAR(150),
    program_committee_chair VARCHAR(150),
    unipu_program_committee_members TEXT,
    foreign_program_committee_members TEXT,
    proceedings_indexing VARCHAR(160),
    website_url         TEXT,
    proceedings_url     TEXT,
    media_coverage      TEXT,
    total_cost_eur      NUMERIC(14,2) CHECK (total_cost_eur IS NULL OR total_cost_eur >= 0),
    funding_sources     TEXT,
    notes               TEXT
);

CREATE TABLE conference_country_statistics (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conference_id       BIGINT NOT NULL REFERENCES international_conferences(id) ON DELETE CASCADE,
    country_id          BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    country_name        VARCHAR(120),
    participant_count   INTEGER NOT NULL DEFAULT 0 CHECK (participant_count >= 0),
    presentation_count  INTEGER NOT NULL DEFAULT 0 CHECK (presentation_count >= 0),
    UNIQUE (conference_id, country_id, country_name)
);


-- 9. INTERNATIONAL STAFF MOBILITY

CREATE TABLE staff_mobilities (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    mobility_type       VARCHAR(160) NOT NULL,
    program_name        VARCHAR(160),
    host_organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    host_organization_name VARCHAR(200),
    destination_country_id BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    start_date          DATE,
    end_date            DATE,
    purpose             TEXT,
    activities          TEXT,
    results             TEXT,
    notes               TEXT,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);


-- 10. INTERNATIONAL COOPERATION / AGREEMENTS

CREATE TABLE international_cooperations (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    partner_organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    partner_name        VARCHAR(200) NOT NULL,
    country_id          BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    cooperation_domain  VARCHAR(40) CHECK (cooperation_domain IN ('SCIENTIFIC', 'ARTISTIC', 'PROFESSIONAL', 'MULTIDISCIPLINARY')),
    cooperation_field   VARCHAR(160),
    start_date          DATE,
    duration_text       VARCHAR(160),
    agreement_type      VARCHAR(160),
    signed_on           DATE,
    valid_until         DATE,
    unipu_contact_staff_id BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
    planned_activities  TEXT,
    completed_activities TEXT,
    agreement_url       TEXT,
    cooperation_status  VARCHAR(80),
    is_new_in_period    BOOLEAN NOT NULL DEFAULT FALSE,
    notes               TEXT,
    CHECK (valid_until IS NULL OR signed_on IS NULL OR valid_until >= signed_on)
);


-- 11. OPTIMIZED TEACHING STAFF SCHEDULE

CREATE TABLE schedule_optimization_reports (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    academic_year       VARCHAR(20) NOT NULL,
    notes               TEXT
);

CREATE TABLE schedule_overload_cases (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           BIGINT NOT NULL REFERENCES schedule_optimization_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    teaching_norm       NUMERIC(10,2),
    current_load        NUMERIC(10,2),
    overload_percent    NUMERIC(7,2),
    courses_to_reassign TEXT,
    relief_proposal     TEXT,
    proposed_replacement_staff_id BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
    proposed_replacement_text VARCHAR(200),
    planned_reduction   NUMERIC(10,2),
    case_status         VARCHAR(80),
    notes               TEXT
);

CREATE TABLE academic_promotion_cases (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           BIGINT NOT NULL REFERENCES schedule_optimization_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    current_title       VARCHAR(160),
    candidate_title     VARCHAR(160),
    election_deadline   DATE,
    current_load        NUMERIC(10,2),
    proposed_load       NUMERIC(10,2),
    courses_to_reassign TEXT,
    replacement_staff_id BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
    replacement_text    VARCHAR(200),
    research_time_text  VARCHAR(160),
    procedure_status    VARCHAR(80),
    notes               TEXT
);


-- 12. TEACHING SCHEDULE ADJUSTMENTS FOR RESEARCH

CREATE TABLE schedule_adjustment_reports (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    academic_year       VARCHAR(20) NOT NULL,
    notes               TEXT
);

CREATE TABLE schedule_adjustment_measures (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           BIGINT NOT NULL REFERENCES schedule_adjustment_reports(id) ON DELETE CASCADE,
    measure_type        VARCHAR(160) NOT NULL,
    description         TEXT,
    beneficiary_count   INTEGER CHECK (beneficiary_count IS NULL OR beneficiary_count >= 0),
    released_hours_per_week NUMERIC(8,2) CHECK (released_hours_per_week IS NULL OR released_hours_per_week >= 0),
    application_period  VARCHAR(160),
    measure_status      VARCHAR(80)
);

CREATE TABLE schedule_adjustment_beneficiaries (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           BIGINT NOT NULL REFERENCES schedule_adjustment_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    measure_type        VARCHAR(160),
    reason              TEXT,
    research_project_activity TEXT,
    released_time_text  VARCHAR(160),
    application_period  VARCHAR(160),
    results             TEXT,
    beneficiary_status  VARCHAR(80)
);

CREATE TABLE schedule_adjustment_plans (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           BIGINT NOT NULL REFERENCES schedule_adjustment_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    planned_measure     VARCHAR(200),
    reason              TEXT,
    planned_period      VARCHAR(160),
    expected_results    TEXT
);


-- 13. SCIENTIFIC PRODUCTIVITY DURING SABBATICAL LEAVE

CREATE TABLE sabbatical_reports (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    monitoring_period   VARCHAR(160),
    notes               TEXT
);

CREATE TABLE sabbatical_users (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           BIGINT NOT NULL REFERENCES sabbatical_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    usage_period        VARCHAR(160),
    q1_paper_count      INTEGER NOT NULL DEFAULT 0 CHECK (q1_paper_count >= 0),
    q2_paper_count      INTEGER NOT NULL DEFAULT 0 CHECK (q2_paper_count >= 0),
    other_paper_count   INTEGER NOT NULL DEFAULT 0 CHECK (other_paper_count >= 0),
    monograph_count     INTEGER NOT NULL DEFAULT 0 CHECK (monograph_count >= 0),
    user_status         VARCHAR(80),
    notes               TEXT
);

CREATE TABLE sabbatical_publications (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           BIGINT NOT NULL REFERENCES sabbatical_reports(id) ON DELETE CASCADE,
    sabbatical_user_id  BIGINT REFERENCES sabbatical_users(id) ON DELETE SET NULL,
    authors             TEXT NOT NULL,
    title               TEXT NOT NULL,
    journal             VARCHAR(500),
    quartile            VARCHAR(2) CHECK (quartile IN ('Q1', 'Q2')),
    publication_year    SMALLINT,
    doi_or_url          TEXT,
    notes               TEXT
);

CREATE TABLE sabbatical_monographs (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id           BIGINT NOT NULL REFERENCES sabbatical_reports(id) ON DELETE CASCADE,
    sabbatical_user_id  BIGINT REFERENCES sabbatical_users(id) ON DELETE SET NULL,
    authors             TEXT NOT NULL,
    title               TEXT NOT NULL,
    publisher           VARCHAR(180),
    publication_year    SMALLINT,
    isbn                VARCHAR(40),
    page_count          INTEGER CHECK (page_count IS NULL OR page_count >= 0),
    link_or_reviews     TEXT
);


-- 14. JOINT EVENTS

CREATE TABLE joint_events (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    name                VARCHAR(500) NOT NULL,
    event_type          VARCHAR(160),
    event_phase         record_phase NOT NULL DEFAULT 'PLANNED',
    event_date          DATE,
    planned_date        DATE,
    location            VARCHAR(160),
    unipu_organizers    TEXT,
    partner_organizations TEXT,
    partner_country_id  BIGINT REFERENCES countries(id) ON DELETE SET NULL,
    participant_count   INTEGER CHECK (participant_count IS NULL OR participant_count >= 0),
    expected_participant_count INTEGER CHECK (expected_participant_count IS NULL OR expected_participant_count >= 0),
    presentation_count  INTEGER CHECK (presentation_count IS NULL OR presentation_count >= 0),
    thematic_field      VARCHAR(160),
    program_report_url  TEXT,
    media_coverage      TEXT,
    cost_eur            NUMERIC(14,2) CHECK (cost_eur IS NULL OR cost_eur >= 0),
    estimated_cost_eur  NUMERIC(14,2) CHECK (estimated_cost_eur IS NULL OR estimated_cost_eur >= 0),
    funding_source      VARCHAR(160),
    responsible_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    preparation_status  VARCHAR(80),
    notes               TEXT
);


-- 15. PROJECT APPLICATIONS AND IMPLEMENTATION

CREATE TABLE project_applications (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    project_name        VARCHAR(500) NOT NULL,
    acronym             VARCHAR(80),
    funding_source      VARCHAR(160),
    call_name           VARCHAR(500),
    call_url            TEXT,
    unipu_role          VARCHAR(160),
    involved_units      TEXT,
    partner_institutions TEXT,
    total_budget_eur    NUMERIC(16,2) CHECK (total_budget_eur IS NULL OR total_budget_eur >= 0),
    unipu_share_eur     NUMERIC(16,2) CHECK (unipu_share_eur IS NULL OR unipu_share_eur >= 0),
    implementation_start DATE,
    implementation_end DATE,
    duration_text       VARCHAR(160),
    project_scope       VARCHAR(40) CHECK (project_scope IN ('DOMESTIC', 'INTERNATIONAL', 'OTHER')),
    planned_activities  TEXT,
    unipu_project_team  TEXT,
    submission_deadline DATE,
    application_status  VARCHAR(80),
    contract_reference  VARCHAR(120),
    project_code        VARCHAR(120),
    notes               TEXT,
    CHECK (implementation_end IS NULL OR implementation_start IS NULL OR implementation_end >= implementation_start)
);


-- 16. MEASURES FOLLOWING STUDENT SURVEYS

CREATE TABLE survey_reason_catalog (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                VARCHAR(60) NOT NULL UNIQUE,
    label               VARCHAR(500) NOT NULL,
    description         TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE survey_measure_catalog (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                VARCHAR(60) NOT NULL UNIQUE,
    label               VARCHAR(500) NOT NULL,
    default_target      TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE survey_reason_measure_rules (
    reason_id           BIGINT NOT NULL REFERENCES survey_reason_catalog(id) ON DELETE CASCADE,
    measure_id          BIGINT NOT NULL REFERENCES survey_measure_catalog(id) ON DELETE CASCADE,
    is_default          BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (reason_id, measure_id)
);

CREATE TABLE survey_action_plans (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    course_name         VARCHAR(500),
    observed_deficiency TEXT,
    execution_report    TEXT,
    target_value        TEXT,
    due_date            DATE,
    completed_on        DATE,
    completion_status   VARCHAR(80),
    notes               TEXT
);

CREATE TABLE survey_action_plan_reasons (
    action_plan_id      BIGINT NOT NULL REFERENCES survey_action_plans(id) ON DELETE CASCADE,
    reason_id           BIGINT NOT NULL REFERENCES survey_reason_catalog(id) ON DELETE RESTRICT,
    details             TEXT,
    PRIMARY KEY (action_plan_id, reason_id)
);

CREATE TABLE survey_action_plan_measures (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action_plan_id      BIGINT NOT NULL REFERENCES survey_action_plans(id) ON DELETE CASCADE,
    measure_id          BIGINT REFERENCES survey_measure_catalog(id) ON DELETE SET NULL,
    custom_measure      TEXT,
    target_value        TEXT,
    due_date            DATE,
    is_completed        BOOLEAN NOT NULL DEFAULT FALSE,
    execution_report    TEXT,
    completed_on        DATE,
    CHECK (measure_id IS NOT NULL OR custom_measure IS NOT NULL)
);

-- Seed reasons and suggested measures from the provided survey form.
INSERT INTO survey_reason_catalog (code, label, sort_order) VALUES
('AVG_BELOW_3', 'Prosječna ocjena nastavnika niža od 3,00', 1),
('QUESTION_BELOW_3', 'Prosječna ocjena pojedinog pitanja niža od 3,00', 2),
('ETHICS_CONCERN', 'Komentari ukazuju na moguće grubo kršenje etičkih normi', 3),
('ENVELOPE_NOT_COLLECTED', 'Nastavnik nije preuzeo omotnicu za evaluaciju', 4),
('RESPONSE_BELOW_33', 'Evaluaciji je pristupilo manje od 33% upisanih studenata', 5),
('EVALUATION_NOT_CONDUCTED', 'Studentska evaluacija nije provedena', 6);

INSERT INTO survey_measure_catalog (code, label, default_target) VALUES
('INTERVIEW', 'Razgovor s nastavnikom', 'Razgovor je proveden i evidentiran.'),
('SELF_EVALUATION', 'Obveza samovrednovanja nastavnika', 'Nastavnik je predao samovrednovanje u zadanom roku.'),
('PROFESSIONAL_TRAINING', 'Stručno osposobljavanje i usavršavanje', 'Nastavnik je završio dogovoreno stručno usavršavanje.'),
('CHANGE_COURSE_HOLDER', 'Određivanje sunositelja ili drugog nositelja kolegija', 'Kolegij ima određenog odgovarajućeg nositelja ili sunositelja.'),
('TEACHING_OBSERVATION', 'Hospitiranje kod uspješno ocijenjenog nastavnika', 'Hospitiranje je provedeno i dokumentirano.'),
('PEER_REVIEW', 'Suradnička procjena nastave', 'Suradnička procjena je provedena i preporuke su evidentirane.'),
('WRITTEN_EXPLANATION', 'Pisano obrazloženje nastavnika', 'Pisano obrazloženje je dostavljeno u zadanom roku.');

INSERT INTO survey_reason_measure_rules (reason_id, measure_id)
SELECT r.id, m.id
FROM survey_reason_catalog r
JOIN survey_measure_catalog m ON m.code IN ('INTERVIEW', 'SELF_EVALUATION', 'PROFESSIONAL_TRAINING', 'CHANGE_COURSE_HOLDER', 'TEACHING_OBSERVATION', 'PEER_REVIEW')
WHERE r.code IN ('AVG_BELOW_3', 'QUESTION_BELOW_3', 'ETHICS_CONCERN');

INSERT INTO survey_reason_measure_rules (reason_id, measure_id)
SELECT r.id, m.id
FROM survey_reason_catalog r
JOIN survey_measure_catalog m ON m.code IN ('INTERVIEW', 'WRITTEN_EXPLANATION')
WHERE r.code IN ('ENVELOPE_NOT_COLLECTED', 'RESPONSE_BELOW_33', 'EVALUATION_NOT_CONDUCTED');


-- MAIN FACULTY REPORT (PRILOG - OBRAZAC)

CREATE TABLE faculty_reports (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id         BIGINT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    dean_staff_id       BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
    academic_year       VARCHAR(20) NOT NULL,
    strategic_framework_text TEXT,
    human_capital_text  TEXT,
    community_networking_text TEXT,
    entrepreneurship_text TEXT,
    regional_development_text TEXT,
    international_visibility_text TEXT,
    research_integrity_text TEXT,
    postgraduate_education_text TEXT,
    technology_education_text TEXT,
    study_program_development_text TEXT,
    student_experience_text TEXT,
    submitted_to_senate_on DATE,
    notes               TEXT
);

CREATE TABLE staff_elections (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    election_type       VARCHAR(80),
    job_title           VARCHAR(160),
    election_date       DATE
);

CREATE TABLE staff_employment_changes (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    change_type         VARCHAR(30) NOT NULL CHECK (change_type IN ('HIRED', 'RETIRED')),
    academic_title      VARCHAR(160),
    effective_date      DATE
);

CREATE TABLE doctoral_assistants (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    doctoral_program    VARCHAR(500),
    provider            VARCHAR(160),
    current_status      TEXT
);

CREATE TABLE faculty_committees (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    name                VARCHAR(160) NOT NULL,
    members_text        TEXT,
    mandate_start       DATE,
    mandate_end         DATE,
    report_url          TEXT
);

CREATE TABLE faculty_council_statistics (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL UNIQUE REFERENCES faculty_reports(id) ON DELETE CASCADE,
    meetings_count      INTEGER CHECK (meetings_count IS NULL OR meetings_count >= 0),
    meetings_with_students_count INTEGER CHECK (meetings_with_students_count IS NULL OR meetings_with_students_count >= 0),
    minutes_urls        TEXT
);

CREATE TABLE alumni_organizations (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    name                VARCHAR(160) NOT NULL,
    founded_on          DATE,
    current_member_count INTEGER CHECK (current_member_count IS NULL OR current_member_count >= 0),
    previous_member_count INTEGER CHECK (previous_member_count IS NULL OR previous_member_count >= 0),
    president_name      VARCHAR(150),
    president_email     CITEXT,
    annual_activity_count INTEGER CHECK (annual_activity_count IS NULL OR annual_activity_count >= 0)
);

CREATE TABLE business_partners (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    organization_id     BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    organization_name   VARCHAR(200) NOT NULL,
    sector              VARCHAR(160),
    cooperation_type    VARCHAR(120),
    partner_status      VARCHAR(80),
    agreement_year      SMALLINT,
    annual_results      TEXT
);

CREATE TABLE funded_projects (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    project_name        VARCHAR(500) NOT NULL,
    acronym             VARCHAR(80),
    funding_program     VARCHAR(160),
    amount_eur          NUMERIC(16,2),
    start_date          DATE,
    end_date            DATE,
    leader_staff_id     BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
    leader_name         VARCHAR(150)
);

CREATE TABLE postgraduate_program_statistics (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    program_type        VARCHAR(30) NOT NULL CHECK (program_type IN ('DOCTORAL', 'SPECIALIST')),
    program_name        VARCHAR(500),
    enrollment_year_label VARCHAR(20) NOT NULL,
    enrolled_count      INTEGER DEFAULT 0 CHECK (enrolled_count >= 0),
    employed_outside_unipu_count INTEGER DEFAULT 0 CHECK (employed_outside_unipu_count >= 0),
    active_status_count INTEGER DEFAULT 0 CHECK (active_status_count >= 0),
    withdrawn_or_inactive_count INTEGER DEFAULT 0 CHECK (withdrawn_or_inactive_count >= 0),
    graduated_count     INTEGER DEFAULT 0 CHECK (graduated_count >= 0),
    mobility_count      INTEGER DEFAULT 0 CHECK (mobility_count >= 0)
);

CREATE TABLE postgraduate_theses (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    thesis_type         VARCHAR(30) NOT NULL CHECK (thesis_type IN ('DOCTORAL', 'SPECIALIST')),
    student_name        VARCHAR(150) NOT NULL,
    thesis_title        TEXT NOT NULL,
    defense_date        DATE,
    mentor_name         VARCHAR(150)
);

CREATE TABLE doctoral_co_mentors (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    co_mentor_name      VARCHAR(150) NOT NULL,
    home_institution_country VARCHAR(500),
    thesis_and_student  TEXT
);

CREATE TABLE external_doctoral_mentorships (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    staff_member_id     BIGINT REFERENCES staff_members(id) ON DELETE SET NULL,
    teacher_name        VARCHAR(150),
    doctoral_program_university VARCHAR(500),
    thesis_and_student  TEXT,
    appointed_on        DATE
);

CREATE TABLE digital_tool_usage (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    tool_type           VARCHAR(120) NOT NULL,
    course_count        INTEGER DEFAULT 0 CHECK (course_count >= 0),
    teacher_count       INTEGER DEFAULT 0 CHECK (teacher_count >= 0),
    usage_description   TEXT
);

CREATE TABLE innovative_teaching_methods (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    method_name         VARCHAR(160) NOT NULL,
    course_count        INTEGER DEFAULT 0 CHECK (course_count >= 0),
    description         TEXT
);

CREATE TABLE study_program_enrollments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    study_name          VARCHAR(500) NOT NULL,
    study_level         VARCHAR(120),
    attendance_type     VARCHAR(30) NOT NULL CHECK (attendance_type IN ('FULL_TIME', 'PART_TIME')),
    study_year          SMALLINT NOT NULL CHECK (study_year BETWEEN 1 AND 10),
    first_enrollment_count INTEGER DEFAULT 0 CHECK (first_enrollment_count >= 0),
    repeat_enrollment_count INTEGER DEFAULT 0 CHECK (repeat_enrollment_count >= 0)
);

CREATE TABLE english_course_statistics (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    year_label          VARCHAR(20) NOT NULL,
    course_count        INTEGER DEFAULT 0 CHECK (course_count >= 0)
);

CREATE TABLE foreign_student_statistics (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    study_name          VARCHAR(500) NOT NULL,
    year_label          VARCHAR(20) NOT NULL,
    total_count         INTEGER DEFAULT 0 CHECK (total_count >= 0),
    eu_count            INTEGER DEFAULT 0 CHECK (eu_count >= 0),
    non_eu_count        INTEGER DEFAULT 0 CHECK (non_eu_count >= 0),
    CHECK (eu_count + non_eu_count <= total_count)
);

CREATE TABLE commission_exams (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    student_name        VARCHAR(150) NOT NULL,
    courses_text        TEXT,
    committee_text      TEXT,
    held_on             DATE
);

CREATE TABLE external_teachers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    teacher_name        VARCHAR(150) NOT NULL,
    academic_title      VARCHAR(160),
    courses_text        TEXT,
    contact_hours       NUMERIC(10,2)
);

CREATE TABLE lifelong_learning_programs (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    program_name        VARCHAR(500) NOT NULL,
    current_participant_count INTEGER DEFAULT 0 CHECK (current_participant_count >= 0),
    previous_participant_count INTEGER DEFAULT 0 CHECK (previous_participant_count >= 0)
);

CREATE TABLE student_mobility_statistics (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    mobility_direction  VARCHAR(20) NOT NULL CHECK (mobility_direction IN ('OUTGOING', 'INCOMING')),
    program_group       VARCHAR(30) NOT NULL CHECK (program_group IN ('ERASMUS', 'OTHER')),
    year_label          VARCHAR(20) NOT NULL,
    student_count       INTEGER DEFAULT 0 CHECK (student_count >= 0)
);

CREATE TABLE field_teaching_activities (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    course_name         VARCHAR(500) NOT NULL,
    activity_date       DATE,
    location_institution VARCHAR(500),
    activity_description TEXT,
    learning_outcomes   TEXT
);

CREATE TABLE student_competitions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    event_name          VARCHAR(500) NOT NULL,
    organizer_location  VARCHAR(500),
    competition_type    VARCHAR(120),
    event_date          DATE,
    participants_text   TEXT,
    result_award        TEXT
);

CREATE TABLE student_awards (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    student_name        VARCHAR(150) NOT NULL,
    work_title          TEXT NOT NULL,
    work_type           VARCHAR(160),
    award_name          VARCHAR(500),
    awarding_body       VARCHAR(500),
    awarded_on          DATE,
    mentor_name         VARCHAR(150)
);

CREATE TABLE extracurricular_activities (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    faculty_report_id   BIGINT NOT NULL REFERENCES faculty_reports(id) ON DELETE CASCADE,
    activity_name       VARCHAR(500) NOT NULL,
    activity_type       VARCHAR(160),
    students_text       TEXT,
    organizer           VARCHAR(500),
    description         TEXT
);


-- AUTOMATIC updated_at TRIGGER

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_staff_members_updated_at
BEFORE UPDATE ON staff_members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- VIEWS FOR THE PERSONALIZED HOMEPAGE AND DYNAMIC FILTERS

CREATE VIEW v_user_recent_documents AS
SELECT
    d.id AS document_id,
    d.owner_user_id,
    d.module_code,
    d.title,
    d.status,
    d.updated_at,
    d.updated_by,
    u.first_name || ' ' || u.last_name AS updated_by_name
FROM documents d
JOIN users u ON u.id = d.updated_by
WHERE d.status <> 'ARCHIVED';

CREATE VIEW v_used_mobility_countries AS
SELECT DISTINCT c.id, c.name_hr, c.name_en
FROM staff_mobilities sm
JOIN countries c ON c.id = sm.destination_country_id;

CREATE VIEW v_used_organization_countries AS
SELECT DISTINCT c.id, c.name_hr, c.name_en
FROM organizations o
JOIN countries c ON c.id = o.country_id;

-- Indexes for lists and filters
CREATE INDEX idx_memberships_country ON memberships(headquarters_country_id);
CREATE INDEX idx_prof_dev_country ON professional_developments(country_id);
CREATE INDEX idx_event_participations_date ON event_participations(event_date);
CREATE INDEX idx_workshops_date ON workshops(held_on);
CREATE INDEX idx_papers_year_category ON coauthored_papers(publication_year, paper_category);
CREATE INDEX idx_visits_country_dates ON visiting_researcher_visits(country_id, arrival_date);
CREATE INDEX idx_stakeholders_priority ON stakeholders(priority, stakeholder_status);
CREATE INDEX idx_conferences_date ON international_conferences(held_on);
CREATE INDEX idx_mobility_country_dates ON staff_mobilities(destination_country_id, start_date);
CREATE INDEX idx_cooperations_country_status ON international_cooperations(country_id, cooperation_status);
CREATE INDEX idx_joint_events_date_type ON joint_events(event_date, event_type);
CREATE INDEX idx_projects_status_deadline ON project_applications(application_status, submission_deadline);

COMMIT;
