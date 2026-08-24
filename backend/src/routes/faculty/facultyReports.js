import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

function isPositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
}

function isIntegerInRange(value, min, max) {
    const number = Number(value);

    return (
        Number.isInteger(number) && number >= min && number <= max
    );
}

function isNumberInRange(value, min, max) {
    const number = Number(value);

    return (
        Number.isFinite(number) && number >= min && number <= max
    );
}

function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function normalizeValue(field, value, config) {
    if (value === null || value === undefined) {
        return value;
    }

    const definition = config.fields.find(
        item => item.name === field
    );

    if (!definition) {
        if (field === "created_by" || field === "updated_by") {
            return Number(value);
        }

        return value;
    }

    if (
        definition.type === "id" ||
        definition.type === "integer" ||
        definition.type === "number"
    ) {
        return Number(value);
    }

    if (definition.type === "text") {
        return value.trim() || null;
    }

    return value;
}

function validateField(body, definition, errors, required) {
    const value = body[definition.name];

    if (value === undefined) {
        if (required) {
            errors.push(`${definition.label} je obavezan.`);
        }

        return;
    }

    if (value === null) {
        if (required) {
            errors.push(`${definition.label} je obavezan.`);
        }

        return;
    }

    if (definition.type === "id") {
        if (!isPositiveInteger(value)) {
            errors.push(
                `${definition.label} mora biti pozitivan cijeli broj.`
            );
        }

        return;
    }

    if (definition.type === "text") {
        if (typeof value !== "string") {
            errors.push(`${definition.label} mora biti tekst.`);
            return;
        }

        if (required && value.trim() === "") {
            errors.push(`${definition.label} ne smije biti prazan.`);
            return;
        }

        if (
            definition.maxLength &&
            value.trim().length > definition.maxLength
        ) {
            errors.push(
                `${definition.label} smije imati najviše ${definition.maxLength} znakova.`
            );
        }

        return;
    }

    if (definition.type === "date") {
        if (!isValidDate(value)) {
            errors.push(
                `${definition.label} mora biti u formatu YYYY-MM-DD.`
            );
        }

        return;
    }

    if (definition.type === "integer") {
        if (
            !isIntegerInRange(
                value,
                definition.min,
                definition.max
            )
        ) {
            errors.push(
                `${definition.label} mora biti cijeli broj između ${definition.min} i ${definition.max}.`
            );
        }

        return;
    }

    if (definition.type === "number") {
        if (
            !isNumberInRange(
                value,
                definition.min,
                definition.max
            )
        ) {
            errors.push(
                `${definition.label} mora biti broj između ${definition.min} i ${definition.max}.`
            );
        }
    }
}

function validateRecord(body, config, mode) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    const partial = mode === "patch";

    for (const definition of config.fields) {
        const required = definition.required && !partial;

        if (
            partial &&
            body[definition.name] === undefined
        ) {
            continue;
        }

        validateField(
            body,
            definition,
            errors,
            required
        );
    }

    if (mode === "create") {
        if (!isPositiveInteger(body.created_by)) {
            errors.push(
                "ID korisnika koji stvara zapis je obavezan i mora biti pozitivan cijeli broj."
            );
        }
    }

    if (!isPositiveInteger(body.updated_by)) {
        errors.push(
            "ID korisnika koji uređuje zapis je obavezan i mora biti pozitivan cijeli broj."
        );
    }

    if (
        config.enumFields
    ) {
        for (const [field, allowedValues] of Object.entries(config.enumFields)) {
            if (
                body[field] !== undefined &&
                body[field] !== null &&
                !allowedValues.includes(body[field])
            ) {
                errors.push(
                    `${field} mora imati jednu od vrijednosti: ${allowedValues.join(", ")}.`
                );
            }
        }
    }

    if (
        config.table === "funded_projects" &&
        body.start_date &&
        body.end_date &&
        body.end_date < body.start_date
    ) {
        errors.push(
            "Datum završetka projekta ne može biti prije datuma početka."
        );
    }

    if (config.table === "foreign_student_statistics") {
        const currentTotal = body.current_total !== undefined ? Number(body.current_total) : null;

        const currentEu = body.current_eu !== undefined ? Number(body.current_eu) : null;

        const currentNonEu = body.current_non_eu !== undefined ? Number(body.current_non_eu) : null;

        const previousTotal = body.previous_total !== undefined ? Number(body.previous_total) : null;

        const previousEu = body.previous_eu !== undefined ? Number(body.previous_eu) : null;

        const previousNonEu =
            body.previous_non_eu !== undefined ? Number(body.previous_non_eu) : null;

        if (
            currentTotal !== null &&
            currentEu !== null &&
            currentNonEu !== null &&
            currentEu + currentNonEu > currentTotal
        ) {
            errors.push(
                "Zbroj EU i non-EU studenata ne smije biti veći od ukupnog broja studenata."
            );
        }

        if (
            previousTotal !== null &&
            previousEu !== null &&
            previousNonEu !== null &&
            previousEu + previousNonEu > previousTotal
        ) {
            errors.push(
                "Zbroj EU i non-EU studenata prethodne godine ne smije biti veći od ukupnog broja."
            );
        }
    }

    return errors;
}

function handleDatabaseError(error, res, next) {
    if (error.code === "23503") {
        return res.status(400).json({
            message: "Jedan od navedenih povezanih zapisa ne postoji."
        });
    }

    if (error.code === "23505") {
        return res.status(409).json({
            message: "Zapis s tom kombinacijom podataka već postoji."
        });
    }

    if (error.code === "23514") {
        return res.status(400).json({
            message: "Podaci krše pravila baze podataka."
        });
    }

    return next(error);
}

const currentYear = new Date().getFullYear();

const configs = [
    {
        path: "reports",
        table: "faculty_reports",
        fields: [
            { name: "reporting_period_id", label: "ID izvještajnog razdoblja", type: "id", required: true },
            { name: "organizational_unit_id", label: "ID sastavnice", type: "id", required: true },
            { name: "dean_name", label: "Ime dekana", type: "text", maxLength: 120 },
            { name: "report_date", label: "Datum izvješća", type: "date" },
            { name: "strategic_framework_text", label: "Strateški okvir", type: "text" },
            { name: "human_capital_text", label: "Ljudski kapital", type: "text" },
            { name: "community_networking_text", label: "Umrežavanje sa zajednicom", type: "text" },
            { name: "entrepreneurship_infrastructure_text", label: "Poduzetništvo i infrastruktura", type: "text" },
            { name: "regional_development_text", label: "Regionalni razvoj", type: "text" },
            { name: "international_visibility_text", label: "Međunarodna vidljivost", type: "text" },
            { name: "research_integrity_text", label: "Istraživački integritet", type: "text" },
            { name: "postgraduate_education_text", label: "Poslijediplomsko obrazovanje", type: "text" },
            { name: "technology_education_text", label: "Tehnološko obrazovanje", type: "text" },
            { name: "study_program_development_text", label: "Razvoj studijskih programa", type: "text" },
            { name: "student_experience_text", label: "Studentsko iskustvo", type: "text" }
        ]
    },
    {
        path: "staff-elections",
        table: "staff_elections",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "staff_name", label: "Ime nastavnika", type: "text", maxLength: 120, required: true },
            { name: "election_type", label: "Vrsta izbora", type: "text", maxLength: 30 },
            { name: "job_position", label: "Radno mjesto", type: "text", maxLength: 100 }
        ]
    },
    {
        path: "newly-employed-teachers",
        table: "newly_employed_teachers",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "staff_name", label: "Ime nastavnika", type: "text", maxLength: 120, required: true },
            { name: "academic_title", label: "Akademsko zvanje", type: "text", maxLength: 30 },
            { name: "employment_date", label: "Datum zaposlenja", type: "date" }
        ]
    },
    {
        path: "retired-teachers",
        table: "retired_teachers",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "staff_name", label: "Ime nastavnika", type: "text", maxLength: 120, required: true },
            { name: "academic_title", label: "Akademsko zvanje", type: "text", maxLength: 30 },
            { name: "retirement_date", label: "Datum umirovljenja", type: "date" }
        ]
    },
    {
        path: "doctoral-assistants",
        table: "doctoral_assistants",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "assistant_name", label: "Ime asistenta", type: "text", maxLength: 120, required: true },
            { name: "study_name_provider", label: "Studij i ustanova", type: "text", maxLength: 250 },
            { name: "current_status", label: "Trenutni status", type: "text" }
        ]
    },
    {
        path: "committees",
        table: "faculty_committees",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "committee_name", label: "Naziv povjerenstva", type: "text", maxLength: 150, required: true },
            { name: "members", label: "Članovi", type: "text" },
            { name: "mandate", label: "Mandat", type: "text", maxLength: 100 },
            { name: "report_link", label: "Poveznica na izvješće", type: "text" }
        ]
    },
    {
        path: "council-statistics",
        table: "faculty_council_statistics",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "meeting_count", label: "Broj sjednica", type: "integer", min: 0, max: 999 },
            { name: "meetings_with_students_count", label: "Broj sjednica sa studentima", type: "integer", min: 0, max: 999 }
        ]
    },
    {
        path: "council-meeting-records",
        table: "faculty_council_meeting_records",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "record_title", label: "Naziv sjednice ili zapisnika", type: "text", maxLength: 250, required: true },
            { name: "meeting_date", label: "Datum sjednice", type: "date" },
            { name: "record_link", label: "Poveznica na zapisnik", type: "text", required: true }
        ]
    },
    {
        path: "alumni-organizations",
        table: "alumni_organizations",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "alumni_name", label: "Naziv alumni organizacije", type: "text", maxLength: 150, required: true },
            { name: "founded_on", label: "Datum osnutka", type: "date" },
            { name: "current_member_count", label: "Trenutni broj članova", type: "integer", min: 0, max: 9999 },
            { name: "previous_member_count", label: "Prethodni broj članova", type: "integer", min: 0, max: 9999 },
            { name: "president_contact", label: "Predsjednik i mail", type: "text", maxLength: 180 },
            { name: "annual_activity_count", label: "Broj aktivnosti u godini", type: "integer", min: 0, max: 999 }
        ]
    },
    {
        path: "business-partners",
        table: "business_partners",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "institution_name", label: "Naziv institucije", type: "text", maxLength: 200, required: true },
            { name: "sector", label: "Sektor", type: "text", maxLength: 100 },
            { name: "cooperation_type", label: "Vrsta suradnje", type: "text", maxLength: 150 },
            { name: "status", label: "Status", type: "text", maxLength: 30 },
            { name: "agreement_year", label: "Godina sporazuma", type: "integer", min: 1950, max: currentYear + 1 },
            { name: "annual_results", label: "Godišnji rezultati", type: "text" }
        ],
        enumFields: {
            sector: ["Ustanova", "Državna uprava", "Javni sektor"],
            cooperation_type: ["Stručna praksa i zapošljavanje studenata", "Strateško partnerstvo"],
            status: ["Postojeći", "Novi"]
        }
    },
    {
        path: "funded-projects",
        table: "funded_projects",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "project_name", label: "Naziv projekta", type: "text", maxLength: 250, required: true },
            { name: "acronym", label: "Akronim", type: "text", maxLength: 30 },
            { name: "funding_program", label: "Program financiranja", type: "text", maxLength: 150 },
            { name: "amount_eur", label: "Iznos projekta", type: "number", min: 0, max: 999999.99 },
            { name: "start_date", label: "Datum početka", type: "date" },
            { name: "end_date", label: "Datum završetka", type: "date" },
            { name: "project_leader", label: "Voditelj projekta", type: "text", maxLength: 120 }
        ]
    },
    {
        path: "doctoral-generation-statistics",
        table: "doctoral_generation_statistics",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "enrollment_year_label", label: "Generacija", type: "text", maxLength: 10, required: true },
            { name: "enrolled_count", label: "Broj upisanih", type: "integer", min: 0, max: 9999 },
            { name: "employed_outside_count", label: "Zaposleni izvan Sveučilišta", type: "integer", min: 0, max: 9999 },
            { name: "active_count", label: "Aktivni", type: "integer", min: 0, max: 9999 },
            { name: "withdrawn_count", label: "Odustali", type: "integer", min: 0, max: 9999 },
            { name: "graduated_count", label: "Završili", type: "integer", min: 0, max: 9999 },
            { name: "mobility_count", label: "Mobilnosti", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "defended-doctoral-dissertations",
        table: "defended_doctoral_dissertations",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "doctoral_student_name", label: "Ime doktoranda", type: "text", maxLength: 120, required: true },
            { name: "dissertation_title", label: "Naslov disertacije", type: "text" },
            { name: "defense_date", label: "Datum obrane", type: "date" },
            { name: "mentor_name", label: "Mentor", type: "text", maxLength: 120 }
        ]
    },
    {
        path: "doctoral-co-mentors",
        table: "doctoral_co_mentors",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "co_mentor_name", label: "Ime komentora", type: "text", maxLength: 120, required: true },
            { name: "home_unit_country", label: "Matična ustanova i država", type: "text", maxLength: 250 },
            { name: "dissertation_and_student", label: "Disertacija i student", type: "text" }
        ]
    },
    {
        path: "external-doctoral-mentorships",
        table: "external_doctoral_mentorships",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "teacher_name", label: "Ime nastavnika", type: "text", maxLength: 120, required: true },
            { name: "doctoral_study_university", label: "Doktorski studij i sveučilište", type: "text", maxLength: 250 },
            { name: "dissertation_and_student", label: "Disertacija i student", type: "text" },
            { name: "appointed_on", label: "Datum imenovanja", type: "date" }
        ]
    },
    {
        path: "specialist-generation-statistics",
        table: "specialist_generation_statistics",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "enrollment_year_label", label: "Generacija", type: "text", maxLength: 10, required: true },
            { name: "enrolled_count", label: "Broj upisanih", type: "integer", min: 0, max: 9999 },
            { name: "employed_outside_count", label: "Zaposleni izvan Sveučilišta", type: "integer", min: 0, max: 9999 },
            { name: "active_count", label: "Aktivni", type: "integer", min: 0, max: 9999 },
            { name: "withdrawn_count", label: "Odustali", type: "integer", min: 0, max: 9999 },
            { name: "graduated_count", label: "Završili", type: "integer", min: 0, max: 9999 },
            { name: "mobility_count", label: "Mobilnosti", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "defended-specialist-works",
        table: "defended_specialist_works",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "student_name", label: "Ime studenta", type: "text", maxLength: 120, required: true },
            { name: "work_title", label: "Naslov rada", type: "text" },
            { name: "defense_date", label: "Datum obrane", type: "date" },
            { name: "mentor_name", label: "Mentor", type: "text", maxLength: 120 }
        ]
    },
    {
        path: "digital-tool-usage",
        table: "digital_tool_usage",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "tool_type", label: "Vrsta digitalnog alata", type: "text", maxLength: 100, required: true },
            { name: "course_count", label: "Broj kolegija", type: "integer", min: 0, max: 9999 },
            { name: "teacher_count", label: "Broj nastavnika", type: "integer", min: 0, max: 9999 },
            { name: "usage_type", label: "Način korištenja", type: "text" }
        ]
    },
    {
        path: "innovative-teaching-methods",
        table: "innovative_teaching_methods",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "method_type", label: "Vrsta metode", type: "text", maxLength: 150, required: true },
            { name: "course_count", label: "Broj kolegija", type: "integer", min: 0, max: 9999 },
            { name: "teacher_count", label: "Broj nastavnika", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "full-time-study-enrollments",
        table: "full_time_study_enrollments",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "study_name", label: "Naziv studija", type: "text", maxLength: 200, required: true },
            { name: "study_year", label: "Godina studija", type: "integer", min: 1, max: 4, required: true },
            { name: "first_enrollment_count", label: "Prvi upis", type: "integer", min: 0, max: 9999 },
            { name: "repeat_enrollment_count", label: "Ponovni upis", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "part-time-study-enrollments",
        table: "part_time_study_enrollments",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "study_name", label: "Naziv studija", type: "text", maxLength: 200, required: true },
            { name: "study_year", label: "Godina studija", type: "integer", min: 1, max: 4, required: true },
            { name: "first_enrollment_count", label: "Prvi upis", type: "integer", min: 0, max: 9999 },
            { name: "repeat_enrollment_count", label: "Ponovni upis", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "english-course-statistics",
        table: "english_course_statistics",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "current_year_count", label: "Trenutni broj kolegija", type: "integer", min: 0, max: 9999 },
            { name: "previous_year_count", label: "Prethodni broj kolegija", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "foreign-student-statistics",
        table: "foreign_student_statistics",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "study_name", label: "Naziv studija", type: "text", maxLength: 200, required: true },
            { name: "current_total", label: "Ukupno trenutno", type: "integer", min: 0, max: 9999 },
            { name: "current_eu", label: "EU trenutno", type: "integer", min: 0, max: 9999 },
            { name: "current_non_eu", label: "Non-EU trenutno", type: "integer", min: 0, max: 9999 },
            { name: "previous_total", label: "Ukupno prethodno", type: "integer", min: 0, max: 9999 },
            { name: "previous_eu", label: "EU prethodno", type: "integer", min: 0, max: 9999 },
            { name: "previous_non_eu", label: "Non-EU prethodno", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "commission-exams",
        table: "commission_exams",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "student_name", label: "Ime studenta", type: "text", maxLength: 120, required: true },
            { name: "courses", label: "Kolegiji", type: "text" },
            { name: "committee", label: "Povjerenstvo", type: "text" },
            { name: "held_on", label: "Datum održavanja", type: "date" }
        ]
    },
    {
        path: "external-teachers",
        table: "external_teachers",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "teacher_name", label: "Ime nastavnika", type: "text", maxLength: 120, required: true },
            { name: "academic_title", label: "Akademsko zvanje", type: "text", maxLength: 30 },
            { name: "courses", label: "Kolegiji", type: "text" },
            { name: "contact_hours", label: "Kontakt sati", type: "integer", min: 0, max: 999 }
        ]
    },
    {
        path: "lifelong-learning-programs",
        table: "lifelong_learning_programs",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "program_name", label: "Naziv programa", type: "text", maxLength: 250, required: true },
            { name: "current_participant_count", label: "Trenutni broj polaznika", type: "integer", min: 0, max: 9999 },
            { name: "previous_participant_count", label: "Prethodni broj polaznika", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "student-mobility-statistics",
        table: "student_mobility_statistics",
        enumFields: {
            mobility_direction: ["OUTGOING", "INCOMING"]
        },
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "mobility_direction", label: "Smjer mobilnosti", type: "text", maxLength: 10, required: true },
            { name: "current_erasmus_count", label: "Trenutni Erasmus", type: "integer", min: 0, max: 9999 },
            { name: "previous_erasmus_count", label: "Prethodni Erasmus", type: "integer", min: 0, max: 9999 },
            { name: "current_other_count", label: "Trenutne ostale mobilnosti", type: "integer", min: 0, max: 9999 },
            { name: "previous_other_count", label: "Prethodne ostale mobilnosti", type: "integer", min: 0, max: 9999 }
        ]
    },
    {
        path: "field-teaching-activities",
        table: "field_teaching_activities",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "courses", label: "Kolegiji", type: "text" },
            { name: "activity_date", label: "Datum aktivnosti", type: "date" },
            { name: "location_institution", label: "Lokacija ili institucija", type: "text", maxLength: 250 },
            { name: "activity_description", label: "Opis aktivnosti", type: "text" },
            { name: "learning_outcomes", label: "Ishodi učenja", type: "text" }
        ]
    },
    {
        path: "student-competitions",
        table: "student_competitions",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "competition_name", label: "Naziv natjecanja", type: "text", maxLength: 250, required: true },
            { name: "organizer_location", label: "Organizator i lokacija", type: "text", maxLength: 250 },
            { name: "competition_type", label: "Vrsta natjecanja", type: "text", maxLength: 80 },
            { name: "event_date", label: "Datum", type: "date" },
            { name: "participants", label: "Sudionici", type: "text" },
            { name: "result_award", label: "Rezultat ili nagrada", type: "text" }
        ]
    },
    {
        path: "student-awards",
        table: "student_awards",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "student_name", label: "Ime studenta", type: "text", maxLength: 120, required: true },
            { name: "work_title", label: "Naslov rada", type: "text" },
            { name: "work_type", label: "Vrsta rada", type: "text", maxLength: 100 },
            { name: "award_name", label: "Naziv nagrade", type: "text", maxLength: 200 },
            { name: "awarding_body", label: "Dodjeljivač", type: "text", maxLength: 200 },
            { name: "awarded_on", label: "Datum dodjele", type: "date" },
            { name: "mentor_name", label: "Mentor", type: "text", maxLength: 120 }
        ]
    },
    {
        path: "extracurricular-activities",
        table: "extracurricular_activities",
        fields: [
            { name: "faculty_report_id", label: "ID izvješća fakulteta", type: "id", required: true },
            { name: "activity_name", label: "Naziv aktivnosti", type: "text", maxLength: 250, required: true },
            { name: "activity_type", label: "Vrsta aktivnosti", type: "text", maxLength: 100 },
            { name: "students_and_year", label: "Studenti i godina", type: "text" },
            { name: "organizer", label: "Organizator", type: "text", maxLength: 200 },
            { name: "short_description", label: "Kratki opis", type: "text" }
        ]
    }
];

function registerCrudRoutes(config) {
    const allowedFields = [...config.fields.map(field => field.name), "updated_by"];

    router.get(`/${config.path}`, async (req, res, next) => {
        try {
            const result = await pool.query(`
                SELECT *
                FROM ${config.table}
                ORDER BY created_at DESC
            `);

            return res.status(200).json(result.rows);
        } catch (error) {
            next(error);
        }
    });

    router.get(`/${config.path}/:id`, validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    SELECT *
                    FROM ${config.table}
                    WHERE id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Zapis nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    });

    router.post(`/${config.path}`, async (req, res, next) => {
        const errors = validateRecord(
            req.body,
            config,
            "create"
        );

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors
            });
        }

        const columns = [
            ...config.fields.map(field => field.name),
            "created_by",
            "updated_by"
        ];

        const values = config.fields.map(field => {
            const value = req.body[field.name];

            if (value === undefined) {
                if (
                    field.type === "integer" &&
                    field.required !== true
                ) {
                    return 0;
                }

                return null;
            }

            return normalizeValue(
                field.name,
                value,
                config
            );
        });

        values.push(
            Number(req.body.created_by),
            Number(req.body.updated_by)
        );

        const placeholders = values.map(
            (_, index) => `$${index + 1}`
        );

        try {
            const result = await pool.query(
                `
                    INSERT INTO ${config.table} (
                        ${columns.join(", ")}
                    )
                    VALUES (${placeholders.join(", ")})
                    RETURNING *
                `,
                values
            );

            return res.status(201).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    });

    router.put(`/${config.path}/:id`, validateId, async (req, res, next) => {
        const errors = validateRecord(
            req.body,
            config,
            "put"
        );

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors
            });
        }

        const values = config.fields.map(field => {
            const value = req.body[field.name];

            if (value === undefined) {
                if (
                    field.type === "integer" &&
                    field.required !== true
                ) {
                    return 0;
                }

                return null;
            }

            return normalizeValue(
                field.name,
                value,
                config
            );
        });

        values.push(Number(req.body.updated_by));

        const updates = config.fields.map(
            (field, index) =>
                `${field.name} = $${index + 1}`
        );

        updates.push(
            `updated_by = $${values.length}`
        );

        values.push(req.resourceId);

        try {
            const result = await pool.query(
                `
                    UPDATE ${config.table}
                    SET
                        ${updates.join(", ")},
                        updated_at = NOW()
                    WHERE id = $${values.length}
                    RETURNING *
                `,
                values
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Zapis nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    });

    router.patch(`/${config.path}/:id`, validateId, async (req, res, next) => {
        const suppliedFields = Object.keys(req.body ?? {});

        if (suppliedFields.length === 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors: ["Niste poslali nijedno polje za izmjenu."]
            });
        }

        const invalidFields = suppliedFields.filter(
            field => !allowedFields.includes(field)
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors: [
                    `Nedopuštena polja: ${invalidFields.join(", ")}`
                ]
            });
        }

        const errors = validateRecord(
            req.body,
            config,
            "patch"
        );

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors
            });
        }

        const fields = suppliedFields;
        const values = [];
        const updates = [];

        for (const field of fields) {
            values.push(
                normalizeValue(
                    field,
                    req.body[field],
                    config
                )
            );

            updates.push(
                `${field} = $${values.length}`
            );
        }

        updates.push("updated_at = NOW()");
        values.push(req.resourceId);

        try {
            const result = await pool.query(
                `
                    UPDATE ${config.table}
                    SET ${updates.join(", ")}
                    WHERE id = $${values.length}
                    RETURNING *
                `,
                values
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Zapis nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    });

    router.delete(`/${config.path}/:id`, validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE FROM ${config.table}
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Zapis nije pronađen."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    });
}

for (const config of configs) {
    registerCrudRoutes(config);
}

export default router;
