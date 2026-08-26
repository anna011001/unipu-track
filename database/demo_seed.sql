-- UNIPU Track demo podaci
-- Pokrenuti u Supabase SQL Editoru nakon svih migracija.
-- Skripta ne mijenja korisničke račune ni lozinke.

BEGIN;

SET LOCAL search_path TO unipu_track, public;

DO $seed$
DECLARE
    v_user_id INTEGER;
    v_period_id INTEGER;
    v_unit_id INTEGER;
    v_unit_2_id INTEGER;
    v_hr_id INTEGER;
    v_de_id INTEGER;
    v_it_id INTEGER;
    v_si_id INTEGER;
    v_nl_id INTEGER;
    v_org_id INTEGER;
    v_org_2_id INTEGER;
    v_staff_1_id INTEGER;
    v_staff_2_id INTEGER;
    v_staff_3_id INTEGER;
    v_development_id INTEGER;
    v_event_id INTEGER;
    v_workshop_id INTEGER;
    v_analysis_id INTEGER;
    v_conference_id INTEGER;
    v_optimization_id INTEGER;
    v_adjustment_id INTEGER;
    v_sabbatical_id INTEGER;
    v_faculty_report_id INTEGER;
BEGIN
    SELECT id
    INTO v_user_id
    FROM users
    WHERE is_active = TRUE
    ORDER BY CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END, id
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Seed zahtijeva barem jednog aktivnog korisnika u unipu_track.users.';
    END IF;

    INSERT INTO reporting_periods (label, period_type, start_date, end_date, is_closed)
    VALUES
        ('2025.', 'CALENDAR_YEAR', DATE '2025-01-01', DATE '2025-12-31', TRUE),
        ('2025./2026.', 'ACADEMIC_YEAR', DATE '2025-10-01', DATE '2026-09-30', FALSE)
    ON CONFLICT (label) DO NOTHING;

    SELECT id INTO v_period_id FROM reporting_periods WHERE label = '2025./2026.';

    INSERT INTO organizational_units (short_name, name)
    SELECT 'FIPU', 'Fakultet informatike u Puli'
    WHERE NOT EXISTS (SELECT 1 FROM organizational_units WHERE short_name = 'FIPU');

    INSERT INTO organizational_units (short_name, name)
    SELECT 'FET', 'Fakultet ekonomije i turizma "Dr. Mijo Mirković" u Puli'
    WHERE NOT EXISTS (SELECT 1 FROM organizational_units WHERE short_name = 'FET');

    SELECT id INTO v_unit_id FROM organizational_units WHERE short_name = 'FIPU' ORDER BY id LIMIT 1;
    SELECT id INTO v_unit_2_id FROM organizational_units WHERE short_name = 'FET' ORDER BY id LIMIT 1;

    INSERT INTO countries (iso2_code, name_hr, name_en, region)
    VALUES
        ('HR', 'Republika Hrvatska', 'Republic of Croatia', 'EU'),
        ('DE', 'Njemačka', 'Germany', 'EU'),
        ('IT', 'Italija', 'Italy', 'EU'),
        ('SI', 'Slovenija', 'Slovenia', 'EU'),
        ('NL', 'Nizozemska', 'Netherlands', 'EU')
    ON CONFLICT (iso2_code) DO UPDATE
    SET name_hr = EXCLUDED.name_hr, name_en = EXCLUDED.name_en, region = EXCLUDED.region;

    SELECT id INTO v_hr_id FROM countries WHERE iso2_code = 'HR';
    SELECT id INTO v_de_id FROM countries WHERE iso2_code = 'DE';
    SELECT id INTO v_it_id FROM countries WHERE iso2_code = 'IT';
    SELECT id INTO v_si_id FROM countries WHERE iso2_code = 'SI';
    SELECT id INTO v_nl_id FROM countries WHERE iso2_code = 'NL';

    INSERT INTO organizations (name, organization_type, country_id, city)
    VALUES
        ('Hrvatska udruga za informacijsku tehnologiju', 'Strukovna udruga', v_hr_id, 'Zagreb'),
        ('University of Bologna', 'Sveučilište', v_it_id, 'Bologna')
    ON CONFLICT (name, country_id) DO UPDATE
    SET organization_type = EXCLUDED.organization_type, city = EXCLUDED.city;

    SELECT id INTO v_org_id
    FROM organizations
    WHERE name = 'Hrvatska udruga za informacijsku tehnologiju' AND country_id = v_hr_id;

    SELECT id INTO v_org_2_id
    FROM organizations
    WHERE name = 'University of Bologna' AND country_id = v_it_id;

    -- Jedinstveni marker čini skriptu sigurnom za ponovno pokretanje.
    IF EXISTS (
        SELECT 1 FROM new_memberships
        WHERE evidence_link = 'https://www.unipu.hr/demo/clanstvo'
    ) THEN
        RAISE NOTICE 'UNIPU Track demo podaci već postoje; seed je preskočen.';
        RETURN;
    END IF;

    INSERT INTO staff_members (
        organizational_unit_id, first_name, last_name, academic_title, email, is_active
    )
    SELECT v_unit_id, 'Marija', 'Kovač', 'izv. prof. dr. sc.', 'demo.marija.kovac@unipu.hr', TRUE
    WHERE NOT EXISTS (SELECT 1 FROM staff_members WHERE email = 'demo.marija.kovac@unipu.hr');

    INSERT INTO staff_members (
        organizational_unit_id, first_name, last_name, academic_title, email, is_active
    )
    SELECT v_unit_id, 'Ivan', 'Horvat', 'doc. dr. sc.', 'demo.ivan.horvat@unipu.hr', TRUE
    WHERE NOT EXISTS (SELECT 1 FROM staff_members WHERE email = 'demo.ivan.horvat@unipu.hr');

    INSERT INTO staff_members (
        organizational_unit_id, first_name, last_name, academic_title, email, is_active
    )
    SELECT v_unit_2_id, 'Petra', 'Marić', 'prof. dr. sc.', 'demo.petra.maric@unipu.hr', TRUE
    WHERE NOT EXISTS (SELECT 1 FROM staff_members WHERE email = 'demo.petra.maric@unipu.hr');

    SELECT id INTO v_staff_1_id FROM staff_members WHERE email = 'demo.marija.kovac@unipu.hr' ORDER BY id LIMIT 1;
    SELECT id INTO v_staff_2_id FROM staff_members WHERE email = 'demo.ivan.horvat@unipu.hr' ORDER BY id LIMIT 1;
    SELECT id INTO v_staff_3_id FROM staff_members WHERE email = 'demo.petra.maric@unipu.hr' ORDER BY id LIMIT 1;

    -- Članstva (vrijednosti su nadahnute spremljenim Postman primjerima).
    INSERT INTO new_memberships (
        reporting_period_id, organization_id, organization_name, organization_kind,
        organization_level, headquarters_country_id, joined_on, membership_type,
        annual_fee_eur, unipu_member_id, organizational_unit_id, membership_benefits,
        evidence_link, notes, created_by, updated_by
    ) VALUES (
        v_period_id, v_org_id, 'Hrvatska udruga za informacijsku tehnologiju',
        'PROFESSIONAL', 'NATIONAL', v_hr_id, DATE '2026-01-15', 'Redovno članstvo',
        120.50, v_staff_1_id, v_unit_id, 'Sudjelovanje u stručnim skupovima i radnim skupinama.',
        'https://www.unipu.hr/demo/clanstvo', 'Demo podatak za prezentaciju.', v_user_id, v_user_id
    );

    INSERT INTO active_memberships (
        reporting_period_id, organization_id, organization_name, organization_kind,
        organization_level, country_id, joined_year, membership_type, annual_fee_eur,
        unipu_representative_id, organizational_unit_id, organization_activities,
        membership_status, notes, created_by, updated_by
    ) VALUES (
        v_period_id, v_org_2_id, 'University of Bologna', 'SCIENTIFIC',
        'INTERNATIONAL', v_it_id, 2022, 'Institucijsko članstvo', 450.00,
        v_staff_2_id, v_unit_id, 'Razmjena znanja, međunarodno umrežavanje i zajedničke inicijative.',
        'Aktivno', 'Članstvo obnovljeno za akademsku godinu.', v_user_id, v_user_id
    );

    INSERT INTO membership_category_summaries (
        reporting_period_id, category_name, existing_memberships, new_memberships,
        total_memberships, share_percent, created_by, updated_by
    ) VALUES
        (v_period_id, 'Znanstvene organizacije', 6, 1, 7, 53.85, v_user_id, v_user_id),
        (v_period_id, 'Strukovne organizacije', 4, 2, 6, 46.15, v_user_id, v_user_id);

    -- Stručna usavršavanja.
    INSERT INTO professional_developments (
        reporting_period_id, staff_member_id, organizational_unit_id, development_type,
        program_name, host_organization_id, host_organization_name, country_id,
        start_date, end_date, media_link, notes, created_by, updated_by
    ) VALUES (
        v_period_id, v_staff_1_id, v_unit_id, 'COURSE_CERTIFICATE',
        'Napredne metode analize podataka u visokom obrazovanju', NULL,
        'University of Ljubljana', v_si_id, DATE '2025-11-10', DATE '2025-11-14',
        'https://www.uni-lj.si/', 'Završen program i stečen certifikat.', v_user_id, v_user_id
    ) RETURNING id INTO v_development_id;

    INSERT INTO professional_development_confirmations (
        professional_development_id, institution_name, signer_name, signer_function,
        confirmation_date, seal_present, created_by, updated_by
    ) VALUES (
        v_development_id, 'University of Ljubljana', 'Ana Novak', 'Koordinatorica programa',
        DATE '2025-11-14', TRUE, v_user_id, v_user_id
    );

    INSERT INTO professional_development_media (
        professional_development_id, development_name, media_type, media_link,
        published_on, created_by, updated_by
    ) VALUES (
        v_development_id, 'Napredne metode analize podataka u visokom obrazovanju',
        'Objava na mrežnoj stranici', 'https://www.unipu.hr/novosti', DATE '2025-11-18',
        v_user_id, v_user_id
    );

    -- Sudjelovanja na događanjima.
    INSERT INTO event_participations (
        reporting_period_id, staff_member_id, organizational_unit_id, participation_type,
        event_name, organizer_name, location, event_date, presentation_title,
        program_link, notes, created_by, updated_by
    ) VALUES (
        v_period_id, v_staff_2_id, v_unit_id, 'ORAL_PRESENTATION',
        'Central European Conference on Information Systems', 'University of Maribor',
        'Maribor, Slovenija', DATE '2026-03-20',
        'Digital transformation of university reporting processes',
        'https://www.um.si/', 'Rad predstavljen u međunarodnoj sekciji.', v_user_id, v_user_id
    ) RETURNING id INTO v_event_id;

    INSERT INTO event_organizer_confirmations (
        event_participation_id, event_name, committee_president_name,
        organizer_institution, confirmation_date, impressum_link, created_by, updated_by
    ) VALUES (
        v_event_id, 'Central European Conference on Information Systems', 'Marko Kranjc',
        'University of Maribor', DATE '2026-03-20', 'https://www.um.si/', v_user_id, v_user_id
    );

    INSERT INTO event_media (
        event_participation_id, event_name, media_type, media_link,
        published_on, created_by, updated_by
    ) VALUES (
        v_event_id, 'Central European Conference on Information Systems',
        'Konferencijska vijest', 'https://www.unipu.hr/novosti', DATE '2026-03-22',
        v_user_id, v_user_id
    );

    -- Radionice.
    INSERT INTO workshops (
        reporting_period_id, workshop_name, workshop_leaders, organizational_unit_id,
        target_group, participant_count, location, held_on, duration_hours,
        content_description, media_link, notes, created_by, updated_by
    ) VALUES (
        v_period_id, 'Od ideje do istraživačkog projekta', 'Marija Kovač; Ivan Horvat',
        v_unit_id, 'DOCTORAL_STUDENTS', 28, 'Fakultet informatike u Puli',
        DATE '2026-02-12', 6, 'Razrada projektne ideje, plan aktivnosti i izrada proračuna.',
        'https://www.unipu.hr/novosti', 'Radionica je ocijenjena prosječnom ocjenom 4,8/5.',
        v_user_id, v_user_id
    ) RETURNING id INTO v_workshop_id;

    INSERT INTO workshop_details (
        workshop_id, goals, learning_outcomes, work_methods, materials_resources,
        evaluation, created_by, updated_by
    ) VALUES (
        v_workshop_id, 'Osnažiti polaznike za pripremu kvalitetnih projektnih prijava.',
        'Polaznik može definirati ciljeve, rezultate, aktivnosti i osnovni proračun projekta.',
        'Kratka izlaganja, rad u skupinama i analiza primjera.',
        'Predlošci prijavnih obrazaca i primjeri uspješnih projekata.',
        'Anonimni upitnik i prezentacija grupnog rada.', v_user_id, v_user_id
    );

    INSERT INTO workshop_media (
        workshop_id, workshop_name, media_type, media_link, published_on, created_by, updated_by
    ) VALUES (
        v_workshop_id, 'Od ideje do istraživačkog projekta', 'Fotogalerija',
        'https://www.unipu.hr/novosti', DATE '2026-02-13', v_user_id, v_user_id
    );

    -- Koautorstva.
    INSERT INTO coauthorship_year_totals (
        reporting_period_id, calendar_year, paper_count, created_by, updated_by
    ) VALUES (v_period_id, 2025, 14, v_user_id, v_user_id)
    ON CONFLICT (reporting_period_id, calendar_year) DO NOTHING;

    INSERT INTO coauthored_papers (
        reporting_period_id, authors_and_title, publication_year, category,
        publication_link, created_by, updated_by
    ) VALUES
        (v_period_id, 'Kovač, M.; Novak, A. — Data-driven quality assurance in higher education',
         2025, 'WOS_SCOPUS_Q1_Q2', 'https://doi.org/10.0000/unipu.demo.1', v_user_id, v_user_id),
        (v_period_id, 'Horvat, I.; Rossi, L. — Interoperable reporting systems for universities',
         2025, 'CONFERENCE_PROCEEDINGS', 'https://doi.org/10.0000/unipu.demo.2', v_user_id, v_user_id);

    INSERT INTO coauthorship_category_summaries (
        reporting_period_id, category, calendar_year, paper_count, created_by, updated_by
    ) VALUES
        (v_period_id, 'WOS_SCOPUS_Q1_Q2', 2025, 6, v_user_id, v_user_id),
        (v_period_id, 'WOS_SCOPUS_Q3_Q4', 2025, 3, v_user_id, v_user_id),
        (v_period_id, 'CONFERENCE_PROCEEDINGS', 2025, 5, v_user_id, v_user_id),
        (v_period_id, 'TOTAL', 2025, 14, v_user_id, v_user_id)
    ON CONFLICT (reporting_period_id, category, calendar_year) DO NOTHING;

    -- Gostujući istraživači.
    INSERT INTO realized_visiting_researchers (
        reporting_period_id, researcher_name, academic_title, home_institution, country_id,
        scientific_field, arrival_date, departure_date, duration_days, host_unit_id,
        mentor_contact, activities_during_stay, results, lecture_count, publication_count,
        project_count, notes, created_by, updated_by
    ) VALUES (
        v_period_id, 'Luca Rossi', 'prof. dr. sc.', 'University of Bologna', v_it_id,
        'Informacijski sustavi', DATE '2025-10-13', DATE '2025-10-24', 12, v_unit_id,
        'Marija Kovač', 'Gostujuća predavanja, konzultacije i priprema zajedničkog rada.',
        'Održana tri predavanja i pripremljen nacrt zajedničkog rada.', 3, 1, 1,
        'Posjet realiziran u okviru Erasmus+ programa.', v_user_id, v_user_id
    );

    INSERT INTO planned_visiting_researchers (
        reporting_period_id, researcher_name, academic_title, home_institution, country_id,
        scientific_field, planned_period, duration, host_unit_id, mentor,
        planned_activities, invitation_status, funding_source, notes, created_by, updated_by
    ) VALUES (
        v_period_id, 'Sophie de Vries', 'doc. dr. sc.', 'Utrecht University', v_nl_id,
        'Umjetna inteligencija u obrazovanju', 'svibanj 2026.', '10 dana', v_unit_id,
        'Ivan Horvat', 'Predavanja i zajednička prijava istraživačkog projekta.',
        'Poziv prihvaćen', 'Erasmus+', 'Termin je usuglašen s partnerskom ustanovom.',
        v_user_id, v_user_id
    );

    INSERT INTO visiting_researcher_unit_analyses (
        reporting_period_id, organizational_unit_id, visit_count, total_days,
        lecture_count, publication_count, project_count, created_by, updated_by
    ) VALUES (v_period_id, v_unit_id, 2, 22, 5, 2, 1, v_user_id, v_user_id);

    -- Dionici.
    INSERT INTO stakeholder_analyses (
        analysis_date, organizational_unit_id, responsible_person, created_by, updated_by
    ) VALUES (DATE '2026-01-30', v_unit_id, 'Marija Kovač', v_user_id, v_user_id)
    RETURNING id INTO v_analysis_id;

    INSERT INTO science_stakeholders (
        stakeholder_analysis_id, organization_name, stakeholder_type, country_id,
        scientific_field, contact_name, contact_email, existing_cooperation,
        cooperation_type, cooperation_potential, priority, planned_new_cooperation,
        planned_activities, status, notes, created_by, updated_by
    ) VALUES (
        v_analysis_id, 'Institut Ruđer Bošković', 'Istraživački institut', v_hr_id,
        'Podatkovna znanost', 'Ana Matić', 'ana.matic@example.hr', TRUE,
        'Zajednička istraživanja', 'Visok potencijal za prijavu projekata Obzor Europa.',
        5, TRUE, 'Priprema zajedničke projektne radionice.', 'Aktivno',
        'Prioritetni znanstveni dionik.', v_user_id, v_user_id
    );

    INSERT INTO artistic_stakeholders (
        stakeholder_analysis_id, organization_name, stakeholder_type, country_id,
        scientific_field, contact_name, contact_email, existing_cooperation,
        cooperation_type, cooperation_potential, priority, planned_new_cooperation,
        planned_activities, status, notes, created_by, updated_by
    ) VALUES (
        v_analysis_id, 'Istarsko narodno kazalište', 'Kulturna ustanova', v_hr_id,
        'Digitalna umjetnost', 'Petra Jurić', 'petra.juric@example.hr', TRUE,
        'Stručni i umjetnički projekti', 'Razvoj interdisciplinarnih studentskih projekata.',
        4, TRUE, 'Zajednička izložba studentskih radova.', 'U pripremi',
        'Suradnja povezuje tehnologiju i umjetnost.', v_user_id, v_user_id
    );

    INSERT INTO professional_stakeholders (
        stakeholder_analysis_id, organization_name, organization_kind, country_id,
        activity_field, contact_name, contact_email, unipu_membership,
        cooperation_type, cooperation_potential, priority, planned_new_cooperation,
        planned_activities, status, notes, created_by, updated_by
    ) VALUES (
        v_analysis_id, 'Infobip d.o.o.', 'Tehnološka tvrtka', v_hr_id,
        'Komunikacijske tehnologije', 'Marko Barić', 'marko.baric@example.hr', TRUE,
        'Stručna praksa i gostujuća predavanja', 'Mentoriranje studenata i zajednički laboratorij.',
        5, TRUE, 'Hackathon i program stručne prakse.', 'Aktivno',
        'Ključni partner iz gospodarstva.', v_user_id, v_user_id
    );

    INSERT INTO stakeholder_analysis_summaries (
        stakeholder_analysis_id, science_stakeholder_count, art_stakeholder_count,
        profession_stakeholder_count, total_stakeholder_count,
        existing_cooperation_count, high_potential_count,
        planned_new_cooperation_count, created_by, updated_by
    ) VALUES (v_analysis_id, 1, 1, 1, 3, 3, 2, 3, v_user_id, v_user_id);

    -- Međunarodne konferencije.
    INSERT INTO international_conferences (
        reporting_period_id, conference_name, held_on, location, organizer_unit_id,
        coorganizers, scientific_field, total_participants, foreign_participants,
        country_count, presentation_count, published_paper_count,
        web_or_proceedings_link, notes, created_by, updated_by
    ) VALUES (
        v_period_id, 'International Conference on Digital Transformation in Education',
        DATE '2026-04-16', 'Pula', v_unit_id, 'University of Bologna; University of Ljubljana',
        'Digitalno obrazovanje', 126, 47, 11, 68, 32,
        'https://www.unipu.hr/', 'Konferencija je održana hibridno.', v_user_id, v_user_id
    ) RETURNING id INTO v_conference_id;

    INSERT INTO international_conference_details (
        conference_id, english_name, date_and_location, organizing_committee_chair,
        program_committee_chair, unipu_program_members, foreign_program_members,
        submitted_abstract_count, accepted_abstract_count, plenary_lecture_count,
        section_count, proceedings_indexing, conference_website, media_coverage,
        organization_cost_eur, funding_sources, created_by, updated_by
    ) VALUES (
        v_conference_id, 'International Conference on Digital Transformation in Education',
        '16.–17. travnja 2026., Pula', 'Marija Kovač', 'Luca Rossi',
        'Ivan Horvat; Petra Marić', 'Sophie de Vries; Ana Novak', 82, 68, 3, 6,
        'Scopus (prijavljeno)', 'https://www.unipu.hr/', 'Regionalni portali i društvene mreže',
        18450.00, 'Kotizacije; Sveučilište Jurja Dobrile u Puli; Erasmus+',
        v_user_id, v_user_id
    );

    INSERT INTO conference_country_statistics (
        conference_id, country_id, country_name, participant_count,
        presentation_count, share_percent, created_by, updated_by
    ) VALUES
        (v_conference_id, v_hr_id, 'Republika Hrvatska', 79, 41, 62.70, v_user_id, v_user_id),
        (v_conference_id, v_it_id, 'Italija', 18, 11, 14.29, v_user_id, v_user_id),
        (v_conference_id, v_si_id, 'Slovenija', 14, 8, 11.11, v_user_id, v_user_id);

    -- Mobilnost osoblja (ova cjelina nedostaje u Postman workspaceu).
    INSERT INTO staff_mobilities (
        reporting_period_id, staff_member_id, organizational_unit_id, mobility_type,
        program_name, host_institution, destination_country_id, start_date, end_date,
        duration_days, mobility_purpose, activities, results, notes, created_by, updated_by
    ) VALUES
        (v_period_id, v_staff_1_id, v_unit_id, 'Erasmus+ mobilnost u svrhu podučavanja',
         'Erasmus+ KA131', 'University of Bologna', v_it_id, DATE '2026-02-02', DATE '2026-02-06',
         5, 'Održavanje nastave i razmjena dobrih praksi.', 'Osam sati nastave i sastanci s istraživačkom skupinom.',
         'Dogovorena razmjena studenata i zajednička radionica.', 'Mobilnost uspješno završena.', v_user_id, v_user_id),
        (v_period_id, v_staff_2_id, v_unit_id, 'Erasmus+ mobilnost u svrhu osposobljavanja',
         'Erasmus+ KA131', 'University of Ljubljana', v_si_id, DATE '2025-12-01', DATE '2025-12-05',
         5, 'Stručno usavršavanje.', 'Radionice o digitalizaciji administrativnih procesa.',
         'Primijenjene preporuke za unaprjeđenje izvještavanja.', NULL, v_user_id, v_user_id);

    INSERT INTO staff_mobility_unit_analyses (
        reporting_period_id, organizational_unit_id, employee_count,
        people_in_mobility_count, mobility_count, average_per_person,
        erasmus_teaching_count, erasmus_training_count, ceepus_count,
        bilateral_count, other_count, total_days, created_by, updated_by
    ) VALUES (v_period_id, v_unit_id, 34, 2, 2, 1.00, 1, 1, 0, 0, 0, 10, v_user_id, v_user_id);

    INSERT INTO staff_multiple_mobility_analyses (
        reporting_period_id, staff_member_id, organizational_unit_id,
        mobility_count, total_days, countries, programs, created_by, updated_by
    ) VALUES (v_period_id, v_staff_1_id, v_unit_id, 2, 9, 'Italija; Slovenija',
              'Erasmus+ KA131', v_user_id, v_user_id);

    INSERT INTO staff_mobility_country_analyses (
        reporting_period_id, country_id, country_name, mobility_count,
        people_count, total_days, most_common_program, created_by, updated_by
    ) VALUES
        (v_period_id, v_it_id, 'Italija', 1, 1, 5, 'Erasmus+ KA131', v_user_id, v_user_id),
        (v_period_id, v_si_id, 'Slovenija', 1, 1, 5, 'Erasmus+ KA131', v_user_id, v_user_id);

    -- Međunarodna suradnja.
    INSERT INTO new_international_cooperations (
        reporting_period_id, partner_institution, country_id, cooperation_kind,
        cooperation_field, start_date, duration, agreement_type, unipu_contact_person,
        organizational_unit_id, planned_activities, agreement_link, status,
        notes, created_by, updated_by
    ) VALUES (
        v_period_id, 'Utrecht University', v_nl_id, 'SCIENTIFIC',
        'Umjetna inteligencija u obrazovanju', DATE '2026-01-20', '4 godine',
        'Memorandum o suradnji', 'Ivan Horvat', v_unit_id,
        'Razmjena istraživača, zajedničke publikacije i projektne prijave.',
        'https://www.uu.nl/', 'U provedbi', 'Prve aktivnosti planirane su za ljeto 2026.',
        v_user_id, v_user_id
    );

    INSERT INTO active_international_agreements (
        reporting_period_id, partner_institution, country_id, cooperation_kind,
        agreement_type, signed_on, valid_until, responsible_person,
        organizational_unit_id, completed_activities, planned_activities,
        status, document_link, notes, created_by, updated_by
    ) VALUES (
        v_period_id, 'University of Bologna', v_it_id, 'SCIENTIFIC',
        'Erasmus+ međuinstitucijski sporazum', DATE '2023-09-01', DATE '2028-08-31',
        'Marija Kovač', v_unit_id, 'Četiri odlazne i tri dolazne mobilnosti.',
        'Zajednički intenzivni program i dvije gostujuće radionice.', 'Aktivno',
        'https://www.unibo.it/', 'Suradnja se provodi prema planu.', v_user_id, v_user_id
    );

    INSERT INTO international_cooperation_region_analyses (
        reporting_period_id, region, scientific_count, artistic_count,
        professional_count, total_count, new_count, created_by, updated_by
    ) VALUES
        (v_period_id, 'EU', 8, 2, 3, 13, 3, v_user_id, v_user_id),
        (v_period_id, 'OTHER_EUROPE', 2, 0, 1, 3, 1, v_user_id, v_user_id);

    -- Optimizacija rasporeda.
    SELECT id
    INTO v_optimization_id
    FROM schedule_optimization_reports
    WHERE academic_year = '2025./2026.'
      AND organizational_unit_id = v_unit_id
    ORDER BY id
    LIMIT 1;

    IF v_optimization_id IS NULL THEN
        INSERT INTO schedule_optimization_reports (
            reporting_period_id, organizational_unit_id, academic_year,
            created_by, updated_by
        ) VALUES (
            v_period_id, v_unit_id, '2025./2026.', v_user_id, v_user_id
        )
        RETURNING id INTO v_optimization_id;
    ELSE
        UPDATE schedule_optimization_reports
        SET reporting_period_id = v_period_id,
            updated_by = v_user_id
        WHERE id = v_optimization_id;
    END IF;

    INSERT INTO schedule_overload_cases (
        report_id, staff_member_id, teaching_norm, current_load, overload_percent,
        courses_to_reassign, relief_proposal, proposed_course_holder,
        planned_reduction, status, notes, created_by, updated_by
    ) VALUES (
        v_optimization_id, v_staff_2_id, 300, 390, 30.00,
        'Baze podataka 2', 'Preraspodjela dijela seminarske nastave.',
        'Marija Kovač', 60, 'U provedbi', 'Rasterećenje planirano od ljetnog semestra.',
        v_user_id, v_user_id
    );

    INSERT INTO academic_promotion_cases (
        report_id, staff_member_id, current_title, candidate_title, election_deadline,
        current_load, proposed_load, courses_to_reassign,
        replacement_course_holder, research_time, procedure_status,
        notes, created_by, updated_by
    ) VALUES (
        v_optimization_id, v_staff_1_id, 'doc. dr. sc.', 'izv. prof. dr. sc.',
        DATE '2026-06-30', 330, 270, 'Uvod u podatkovnu znanost',
        'Ivan Horvat', 180, 'Pokrenut postupak',
        'Predloženo rasterećenje radi dovršetka istraživanja.', v_user_id, v_user_id
    );

    INSERT INTO schedule_optimization_summaries (
        report_id, teachers_over_norm_count, teachers_in_reelection_count,
        redistribution_hours, courses_for_redistribution_count,
        replacement_holders_needed, estimated_research_time_hours,
        created_by, updated_by
    ) VALUES (v_optimization_id, 3, 2, 150, 4, 2, 420, v_user_id, v_user_id)
    ON CONFLICT (report_id) DO NOTHING;

    -- Prilagodba rasporeda.
    INSERT INTO schedule_adjustment_reports (
        reporting_period_id, organizational_unit_id, academic_year, created_by, updated_by
    ) VALUES (v_period_id, v_unit_id, '2025./2026.', v_user_id, v_user_id)
    RETURNING id INTO v_adjustment_id;

    INSERT INTO schedule_adjustment_measures (
        report_id, measure_type, measure_description, beneficiary_count,
        released_hours_per_week, application_period, status, created_by, updated_by
    ) VALUES (
        v_adjustment_id, 'Rasterećenje nastavne norme',
        'Smanjenje nastavnog opterećenja radi provedbe kompetitivnog projekta.',
        2, 4, 'Ljetni semestar 2025./2026.', 'Odobreno', v_user_id, v_user_id
    );

    INSERT INTO schedule_adjustment_beneficiaries (
        report_id, staff_member_id, measure_type, adjustment_reason,
        research_project_activity, released_time, application_period,
        results, status, created_by, updated_by
    ) VALUES (
        v_adjustment_id, v_staff_1_id, 'Rasterećenje nastavne norme',
        'Voditeljica međunarodnog istraživačkog projekta.',
        'Koordinacija radnih paketa i priprema znanstvenih publikacija.',
        '4 sata tjedno', 'Ljetni semestar 2025./2026.',
        'Predan jedan Q1 rad i pripremljena nova projektna prijava.', 'Aktivno',
        v_user_id, v_user_id
    );

    INSERT INTO planned_schedule_adjustments (
        report_id, staff_member_id, planned_measure, reason,
        planned_period, expected_results, created_by, updated_by
    ) VALUES (
        v_adjustment_id, v_staff_2_id, 'Blok-nastava u prvom dijelu semestra',
        'Planirana tromjesečna istraživačka mobilnost.', 'Zimski semestar 2026./2027.',
        'Kontinuirana izvedba nastave i neometana provedba mobilnosti.', v_user_id, v_user_id
    );

    INSERT INTO schedule_adjustment_effect_analyses (
        report_id, adjusted_teacher_count, released_research_hours,
        submitted_research_project_count, published_paper_count,
        q1_q2_paper_count, average_productivity_increase_percent,
        created_by, updated_by
    ) VALUES (v_adjustment_id, 2, 240, 2, 4, 3, 18.50, v_user_id, v_user_id);

    -- Slobodna studijska godina.
    INSERT INTO sabbatical_reports (
        reporting_period_id, monitoring_period, created_by, updated_by
    ) VALUES (v_period_id, 'Akademska godina 2025./2026.', v_user_id, v_user_id)
    RETURNING id INTO v_sabbatical_id;

    INSERT INTO sabbatical_users (
        report_id, staff_member_id, organizational_unit_id, usage_period,
        q1_paper_count, q2_paper_count, other_paper_count, monograph_count,
        total_paper_count, status, notes, created_by, updated_by
    ) VALUES (
        v_sabbatical_id, v_staff_3_id, v_unit_2_id, '1. 10. 2025. – 30. 9. 2026.',
        2, 1, 1, 1, 4, 'U tijeku',
        'Plan istraživačkog rada ostvaruje se prema predviđenoj dinamici.', v_user_id, v_user_id
    );

    INSERT INTO sabbatical_q1_q2_papers (
        report_id, authors, paper_title, journal, quartile,
        publication_year, doi_or_link, notes, created_by, updated_by
    ) VALUES (
        v_sabbatical_id, 'Marić, P.; Kovač, M.',
        'Sustainable digital transformation in higher education institutions',
        'Journal of Higher Education Policy', 'Q1', 2026,
        'https://doi.org/10.0000/unipu.demo.3', 'Rad prihvaćen za objavu.', v_user_id, v_user_id
    );

    INSERT INTO sabbatical_monographs (
        report_id, authors, monograph_title, publisher, publication_year,
        isbn, page_count, link_or_reviews, created_by, updated_by
    ) VALUES (
        v_sabbatical_id, 'Petra Marić', 'Digitalna transformacija sveučilišta',
        'Sveučilište Jurja Dobrile u Puli', 2026, '978-953-000-000-0', 214,
        'Recenzije dvaju sveučilišnih profesora.', v_user_id, v_user_id
    );

    -- Zajednička događanja.
    INSERT INTO held_joint_events (
        reporting_period_id, event_name, event_type, event_date, location,
        unipu_organizers, partner_organizations, partner_country_id,
        participant_count, presentation_count, thematic_field,
        program_report_link, media_coverage, cost_eur, notes, created_by, updated_by
    ) VALUES (
        v_period_id, 'Dani znanosti i gospodarstva 2026.', 'Stručna konferencija',
        DATE '2026-05-08', 'Pula', 'FIPU; FET', 'Infobip; IDA; HGK', v_hr_id,
        185, 16, 'Digitalna transformacija gospodarstva', 'https://www.unipu.hr/',
        'Lokalni mediji i mrežne stranice partnera', 7850.00,
        'Događanje je okupilo predstavnike akademske zajednice i gospodarstva.',
        v_user_id, v_user_id
    );

    INSERT INTO planned_joint_events (
        reporting_period_id, event_name, event_type, planned_date, location,
        unipu_organizer, potential_partners, country_id,
        expected_participant_count, thematic_field, preparation_status,
        estimated_cost_eur, funding_source, responsible_person,
        notes, created_by, updated_by
    ) VALUES (
        v_period_id, 'Adriatic AI Forum', 'Međunarodni forum', DATE '2026-09-18',
        'Pula', 'Fakultet informatike u Puli', 'University of Bologna; Infobip', v_it_id,
        120, 'Odgovorna primjena umjetne inteligencije', 'U pripremi', 12000.00,
        'Kotizacije i sponzorstva', 'Ivan Horvat',
        'Programski odbor i okvirni proračun su definirani.', v_user_id, v_user_id
    );

    INSERT INTO joint_event_type_analyses (
        reporting_period_id, event_type, held_count, planned_count,
        total_participants, average_participants, created_by, updated_by
    ) VALUES
        (v_period_id, 'Stručne konferencije', 3, 2, 420, 140, v_user_id, v_user_id),
        (v_period_id, 'Radionice i forumi', 5, 3, 275, 55, v_user_id, v_user_id);

    -- Projektne prijave.
    INSERT INTO project_applications (
        reporting_period_id, proposal_name, funding_source, call_name, call_link,
        unipu_role, involved_units, partner_institutions, total_project_amount_eur,
        unipu_share_eur, implementation_duration, project_type, planned_activities,
        unipu_project_team, submission_deadline, application_status,
        contract_or_partnership_reference, contract_project_code,
        notes, created_by, updated_by
    ) VALUES
        (v_period_id, 'Responsible AI for Inclusive Higher Education', 'Obzor Europa',
         'HORIZON-CL2-2025-TRANSFORMATIONS', 'https://research-and-innovation.ec.europa.eu/',
         'Projektni partner', 'FIPU; FOOZ', 'Utrecht University; University of Bologna',
         780000.00, 145000.00, '36 mjeseci', 'INTERNATIONAL',
         'Razvoj smjernica, pilot-alata i programa edukacije nastavnika.',
         'Marija Kovač; Ivan Horvat; Petra Marić', DATE '2025-11-27', 'APPROVED',
         'Grant Agreement – demo', 'RAIHE-2026', 'Projekt odobren i ugovaranje je u tijeku.',
         v_user_id, v_user_id),
        (v_period_id, 'Digitalni pokazatelji kvalitete studiranja', 'Hrvatska zaklada za znanost',
         'Istraživački projekti 2025.', 'https://hrzz.hr/', 'Nositelj projekta', 'FIPU',
         'Institut Ruđer Bošković', 198500.00, 198500.00, '48 mjeseci', 'DOMESTIC',
         'Razvoj modela pokazatelja i validacija na više visokih učilišta.',
         'Ivan Horvat; Marija Kovač', DATE '2025-09-15', 'REJECTED', NULL, NULL,
         'Prijava pozitivno ocijenjena, ali nije financirana zbog ograničenog proračuna.',
         v_user_id, v_user_id);

    -- Planovi mjera prema studentskim anketama.
    INSERT INTO survey_action_plans (
        reporting_period_id, staff_member_id, inclusion_reasons,
        observed_deficiency, improvement_measures, executed_measures_report,
        target_value, created_by, updated_by
    ) VALUES (
        v_period_id, v_staff_2_id,
        'Rezultat studentske ankete ispod prosjeka sastavnice u području povratnih informacija.',
        'Studenti navode da povratne informacije o projektnim zadacima dolaze prekasno.',
        'Uvesti tjedne konzultacije i rubrike za vrednovanje dostupne prije predaje zadatka.',
        'Uvedene su konzultacije i standardizirane rubrike u sustavu za e-učenje.',
        'Prosječna ocjena povratnih informacija najmanje 4,2/5.', v_user_id, v_user_id
    );

    -- Glavno fakultetsko izvješće i njegove tablice.
    INSERT INTO faculty_reports (
        reporting_period_id, organizational_unit_id, dean_name, report_date,
        strategic_framework_text, human_capital_text, community_networking_text,
        entrepreneurship_infrastructure_text, regional_development_text,
        international_visibility_text, research_integrity_text,
        postgraduate_education_text, technology_education_text,
        study_program_development_text, student_experience_text,
        created_by, updated_by
    ) VALUES (
        v_period_id, v_unit_id, 'prof. dr. sc. Ana Jurić', DATE '2026-07-15',
        'Aktivnosti sastavnice usklađene su sa strateškim ciljevima digitalne transformacije, internacionalizacije i društvenog utjecaja Sveučilišta.',
        'Tijekom izvještajnog razdoblja ojačani su istraživački kapaciteti, pokrenuta su dva izbora u viša zvanja i zaposlen je jedan novi nastavnik.',
        'Suradnja s gospodarstvom i lokalnom zajednicom ostvarena je kroz stručne radionice, studentske projekte i Dane znanosti i gospodarstva.',
        'Nastavljen je razvoj laboratorija za umjetnu inteligenciju i podatkovnu znanost uz potporu partnera iz gospodarstva.',
        'Sastavnica doprinosi regionalnom razvoju prijenosom znanja, stručnim analizama i uključivanjem studenata u stvarne projekte.',
        'Međunarodna vidljivost povećana je mobilnostima, gostujućim istraživačima, konferencijama i novim sporazumima.',
        'Provedene su edukacije o istraživačkoj čestitosti, upravljanju podacima i odgovornoj uporabi umjetne inteligencije.',
        'Doktorski studenti uključeni su u istraživačke skupine, međunarodne mobilnosti i projektne prijave.',
        'U nastavu su dodatno uvedeni alati za suradnju, analitiku učenja i virtualne laboratorije.',
        'Ažurirani su ishodi učenja i sadržaji kolegija iz područja umjetne inteligencije, kibernetičke sigurnosti i podatkovne znanosti.',
        'Studentima su omogućeni dodatni mentorski programi, stručna praksa i sudjelovanje na natjecanjima.',
        v_user_id, v_user_id
    )
    ON CONFLICT (reporting_period_id, organizational_unit_id) DO UPDATE
    SET dean_name = EXCLUDED.dean_name,
        report_date = EXCLUDED.report_date,
        strategic_framework_text = EXCLUDED.strategic_framework_text,
        human_capital_text = EXCLUDED.human_capital_text,
        community_networking_text = EXCLUDED.community_networking_text,
        entrepreneurship_infrastructure_text = EXCLUDED.entrepreneurship_infrastructure_text,
        regional_development_text = EXCLUDED.regional_development_text,
        international_visibility_text = EXCLUDED.international_visibility_text,
        research_integrity_text = EXCLUDED.research_integrity_text,
        postgraduate_education_text = EXCLUDED.postgraduate_education_text,
        technology_education_text = EXCLUDED.technology_education_text,
        study_program_development_text = EXCLUDED.study_program_development_text,
        student_experience_text = EXCLUDED.student_experience_text,
        updated_by = EXCLUDED.updated_by
    RETURNING id INTO v_faculty_report_id;

    INSERT INTO staff_elections (
        faculty_report_id, staff_name, election_type, job_position, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Marija Kovač', 'Izbor u više zvanje',
         'izvanredna profesorica', v_user_id, v_user_id),
        (v_faculty_report_id, 'Ivan Horvat', 'Reizbor',
         'docent', v_user_id, v_user_id);

    INSERT INTO newly_employed_teachers (
        faculty_report_id, staff_name, academic_title, employment_date, created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Lana Babić', 'asistentica', DATE '2026-02-01',
        v_user_id, v_user_id
    );

    INSERT INTO retired_teachers (
        faculty_report_id, staff_name, academic_title, retirement_date, created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Milan Radić', 'prof. dr. sc.', DATE '2025-12-31',
        v_user_id, v_user_id
    );

    INSERT INTO doctoral_assistants (
        faculty_report_id, assistant_name, study_name_provider, current_status,
        created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Lana Babić', 'Doktorski studij Informatika, Sveučilište u Zagrebu',
         'Upisana druga godina; istraživanje se provodi prema planu.', v_user_id, v_user_id),
        (v_faculty_report_id, 'Nikola Grgić', 'Doktorski studij Društvo znanja i prijenos informacija, Sveučilište u Zadru',
         'Prijavljena tema doktorskog rada.', v_user_id, v_user_id);

    INSERT INTO faculty_committees (
        faculty_report_id, committee_name, members, mandate, report_link,
        created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Povjerenstvo za kvalitetu',
         'Marija Kovač; Ivan Horvat; predstavnik studenata', '2024.–2026.',
         'https://www.unipu.hr/kvaliteta', v_user_id, v_user_id),
        (v_faculty_report_id, 'Etičko povjerenstvo',
         'Petra Marić; Ana Jurić; vanjski član', '2025.–2027.',
         'https://www.unipu.hr/', v_user_id, v_user_id);

    INSERT INTO faculty_council_statistics (
        faculty_report_id, meeting_count, meetings_with_students_count,
        created_by, updated_by
    ) VALUES (v_faculty_report_id, 11, 4, v_user_id, v_user_id)
    ON CONFLICT (faculty_report_id) DO NOTHING;

    INSERT INTO faculty_council_meeting_records (
        faculty_report_id, record_title, meeting_date, record_link,
        created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Zapisnik 4. sjednice Fakultetskog vijeća',
         DATE '2026-02-25', 'https://www.unipu.hr/', v_user_id, v_user_id),
        (v_faculty_report_id, 'Zapisnik 8. sjednice Fakultetskog vijeća',
         DATE '2026-05-27', 'https://www.unipu.hr/', v_user_id, v_user_id);

    INSERT INTO alumni_organizations (
        faculty_report_id, alumni_name, founded_on, current_member_count,
        previous_member_count, president_contact, annual_activity_count,
        created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Alumni FIPU', DATE '2021-06-18', 186, 149,
        'alumni.fipu@example.hr', 7, v_user_id, v_user_id
    );

    INSERT INTO business_partners (
        faculty_report_id, institution_name, sector, cooperation_type,
        status, agreement_year, annual_results, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Infobip d.o.o.', 'Informacijske tehnologije',
         'Stručna praksa, mentoriranje i gostujuća predavanja', 'Aktivno', 2022,
         'Provedeno 12 stručnih praksi, 4 gostujuća predavanja i jedan hackathon.',
         v_user_id, v_user_id),
        (v_faculty_report_id, 'Istarska razvojna agencija', 'Regionalni razvoj',
         'Projektna suradnja i transfer znanja', 'Aktivno', 2023,
         'Zajednički pripremljene dvije projektne prijave.', v_user_id, v_user_id);

    INSERT INTO funded_projects (
        faculty_report_id, project_name, acronym, funding_program, amount_eur,
        start_date, end_date, project_leader, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Responsible AI for Inclusive Higher Education', 'RAIHE',
         'Obzor Europa', 145000.00, DATE '2026-03-01', DATE '2029-02-28',
         'Marija Kovač', v_user_id, v_user_id),
        (v_faculty_report_id, 'Digitalne kompetencije za održivi turizam', 'DigiTour',
         'Erasmus+', 98000.00, DATE '2025-09-01', DATE '2027-08-31',
         'Ivan Horvat', v_user_id, v_user_id);

    INSERT INTO doctoral_generation_statistics (
        faculty_report_id, enrollment_year_label, enrolled_count,
        employed_outside_unipu_count, active_status_count,
        withdrawn_no_status_count, graduated_count, mobility_count,
        created_by, updated_by
    ) VALUES
        (v_faculty_report_id, '2023./24.', 8, 5, 7, 1, 0, 2, v_user_id, v_user_id),
        (v_faculty_report_id, '2024./25.', 10, 6, 9, 1, 0, 1, v_user_id, v_user_id);

    INSERT INTO defended_doctoral_dissertations (
        faculty_report_id, doctoral_student_name, dissertation_title,
        defense_date, mentor_name, created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Marko Perić',
        'Modeli strojnog učenja za predviđanje uspješnosti studiranja',
        DATE '2026-03-12', 'prof. dr. sc. Ana Jurić', v_user_id, v_user_id
    );

    INSERT INTO doctoral_co_mentors (
        faculty_report_id, co_mentor_name, home_unit_country,
        dissertation_and_student, created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Luca Rossi', 'University of Bologna, Italija',
        'Responsible AI in Education — Lana Babić', v_user_id, v_user_id
    );

    INSERT INTO external_doctoral_mentorships (
        faculty_report_id, teacher_name, doctoral_study_university,
        dissertation_and_student, appointed_on, created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Marija Kovač', 'Sveučilište u Zagrebu',
        'Analitika učenja u visokom obrazovanju — Ivana Savić',
        DATE '2025-10-15', v_user_id, v_user_id
    );

    INSERT INTO specialist_generation_statistics (
        faculty_report_id, enrollment_year_label, enrolled_count,
        employed_outside_unipu_count, active_status_count,
        withdrawn_no_status_count, graduated_count, mobility_count,
        created_by, updated_by
    ) VALUES
        (v_faculty_report_id, '2024./25.', 18, 15, 14, 2, 2, 1, v_user_id, v_user_id),
        (v_faculty_report_id, '2025./26.', 21, 17, 20, 1, 0, 2, v_user_id, v_user_id);

    INSERT INTO defended_specialist_works (
        faculty_report_id, student_name, work_title, defense_date,
        mentor_name, created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Ivana Savić',
        'Uvođenje poslovne analitike u srednje poduzeće', DATE '2026-04-22',
        'doc. dr. sc. Ivan Horvat', v_user_id, v_user_id
    );

    INSERT INTO digital_tool_usage (
        faculty_report_id, tool_type, course_count, teacher_count,
        usage_type, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Moodle', 42, 26,
         'Materijali, provjere znanja, predaja zadataka i komunikacija.', v_user_id, v_user_id),
        (v_faculty_report_id, 'Microsoft Teams', 31, 22,
         'Online nastava, konzultacije i suradnja na projektima.', v_user_id, v_user_id),
        (v_faculty_report_id, 'GitHub Classroom', 12, 9,
         'Programski zadaci, timski projekti i praćenje verzija.', v_user_id, v_user_id);

    INSERT INTO innovative_teaching_methods (
        faculty_report_id, method_type, course_count, teacher_count,
        created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Projektno učenje', 18, 15, v_user_id, v_user_id),
        (v_faculty_report_id, 'Obrnuta učionica', 9, 8, v_user_id, v_user_id),
        (v_faculty_report_id, 'Učenje temeljeno na izazovima', 7, 6, v_user_id, v_user_id);

    INSERT INTO full_time_study_enrollments (
        faculty_report_id, study_name, study_year, first_enrollment_count,
        repeat_enrollment_count, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Informatika', 1, 72, 11, v_user_id, v_user_id),
        (v_faculty_report_id, 'Informatika', 2, 58, 9, v_user_id, v_user_id),
        (v_faculty_report_id, 'Informatika', 3, 49, 7, v_user_id, v_user_id),
        (v_faculty_report_id, 'Informatika', 4, 34, 5, v_user_id, v_user_id);

    INSERT INTO part_time_study_enrollments (
        faculty_report_id, study_name, study_year, first_enrollment_count,
        repeat_enrollment_count, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Informatika – izvanredni studij', 1, 28, 6, v_user_id, v_user_id),
        (v_faculty_report_id, 'Informatika – izvanredni studij', 2, 21, 5, v_user_id, v_user_id),
        (v_faculty_report_id, 'Informatika – izvanredni studij', 3, 18, 4, v_user_id, v_user_id);

    INSERT INTO english_course_statistics (
        faculty_report_id, current_year_count, previous_year_count,
        created_by, updated_by
    ) VALUES (v_faculty_report_id, 9, 6, v_user_id, v_user_id)
    ON CONFLICT (faculty_report_id) DO NOTHING;

    INSERT INTO foreign_student_statistics (
        faculty_report_id, study_name, current_total, current_eu, current_non_eu,
        previous_total, previous_eu, previous_non_eu, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Informatika', 17, 12, 5, 11, 8, 3, v_user_id, v_user_id),
        (v_faculty_report_id, 'Data Science', 9, 6, 3, 5, 4, 1, v_user_id, v_user_id);

    INSERT INTO commission_exams (
        faculty_report_id, student_name, courses, committee, held_on,
        created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Luka Pavlović', 'Algoritmi i strukture podataka',
        'Marija Kovač; Ivan Horvat; Lana Babić', DATE '2026-02-17',
        v_user_id, v_user_id
    );

    INSERT INTO external_teachers (
        faculty_report_id, teacher_name, academic_title, courses,
        contact_hours, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Luca Rossi', 'prof. dr. sc.',
         'Napredni informacijski sustavi', 20, v_user_id, v_user_id),
        (v_faculty_report_id, 'Ana Novak', 'doc. dr. sc.',
         'Vizualizacija podataka', 15, v_user_id, v_user_id);

    INSERT INTO lifelong_learning_programs (
        faculty_report_id, program_name, current_participant_count,
        previous_participant_count, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Programiranje u Pythonu za početnike', 46, 32, v_user_id, v_user_id),
        (v_faculty_report_id, 'Analitika podataka u poslovanju', 29, 24, v_user_id, v_user_id);

    INSERT INTO student_mobility_statistics (
        faculty_report_id, mobility_direction, current_erasmus,
        previous_erasmus, current_other, previous_other,
        created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'OUTGOING', 14, 10, 3, 2, v_user_id, v_user_id),
        (v_faculty_report_id, 'INCOMING', 18, 12, 4, 3, v_user_id, v_user_id);

    INSERT INTO field_teaching_activities (
        faculty_report_id, courses, activity_date, location_institution,
        activity_description, learning_outcomes, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'Informacijski sustavi; Upravljanje projektima',
         DATE '2026-03-18', 'Infobip, Vodnjan',
         'Stručni posjet razvojnom centru i radionica s projektnim timovima.',
         'Studenti razumiju organizaciju razvoja velikih softverskih sustava.',
         v_user_id, v_user_id),
        (v_faculty_report_id, 'Podatkovna znanost', DATE '2026-05-06',
         'Istarska razvojna agencija, Pula',
         'Analiza otvorenih regionalnih podataka i izrada prijedloga vizualizacija.',
         'Studenti primjenjuju metode analize podataka na stvarnom skupu podataka.',
         v_user_id, v_user_id);

    INSERT INTO student_competitions (
        faculty_report_id, competition_name, organizer_location,
        competition_type, event_date, participants, result_award,
        created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Hacknite 2026', 'Zagreb', 'Studentski hackathon',
        DATE '2026-04-11', 'Luka Pavlović; Mia Grgić; Elena Marić',
        '2. mjesto i posebna nagrada za društveni utjecaj', v_user_id, v_user_id
    );

    INSERT INTO student_awards (
        faculty_report_id, student_name, work_title, work_type,
        award_name, awarding_body, awarded_on, mentor_name,
        created_by, updated_by
    ) VALUES (
        v_faculty_report_id, 'Mia Grgić',
        'Sustav za rano prepoznavanje rizika od odustajanja od studija',
        'Diplomski rad', 'Rektorova nagrada',
        'Sveučilište Jurja Dobrile u Puli', DATE '2026-06-05',
        'izv. prof. dr. sc. Marija Kovač', v_user_id, v_user_id
    );

    INSERT INTO extracurricular_activities (
        faculty_report_id, activity_name, activity_type, students_and_year,
        organizer, short_description, created_by, updated_by
    ) VALUES
        (v_faculty_report_id, 'FIPU Coding Club', 'Studentska stručna aktivnost',
         'Studenti svih godina', 'Studentski zbor FIPU',
         'Tjedni susreti, radionice i priprema za programerska natjecanja.',
         v_user_id, v_user_id),
        (v_faculty_report_id, 'Digitalna pomoć umirovljenicima', 'Volonterski program',
         '18 studenata 2. i 3. godine', 'FIPU i Grad Pula',
         'Studenti održavaju radionice osnovnih digitalnih vještina za starije građane.',
         v_user_id, v_user_id);

    RAISE NOTICE 'UNIPU Track demo podaci uspješno su dodani.';
END;
$seed$;

COMMIT;
