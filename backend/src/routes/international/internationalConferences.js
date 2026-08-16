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
    return (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value))
    );
}

function validateBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    return [];
}

function validateRequiredId(body, field, label, errors, required = true) {
    if (body[field] === undefined) {
        if (required) {
            errors.push(`${label} je obavezan.`);
        }

        return;
    }

    if (!isPositiveInteger(body[field])) {
        errors.push(`${label} mora biti pozitivan cijeli broj.`);
    }
}

function validateNullableId(body, field, label, errors) {
    if (
        body[field] !== undefined &&
        body[field] !== null &&
        !isPositiveInteger(body[field])
    ) {
        errors.push(`${label} mora biti pozitivan cijeli broj ili null.`);
    }
}

function validateRequiredText(body, field, label, maxLength, errors, required = true) {
    if (body[field] === undefined) {
        if (required) {
            errors.push(`${label} je obavezan.`);
        }

        return;
    }

    if (typeof body[field] !== "string" || body[field].trim() === "") {
        errors.push(`${label} mora biti neprazan tekst.`);
        return;
    }

    if (maxLength !== null && body[field].trim().length > maxLength) {
        errors.push(`${label} smije imati najviše ${maxLength} znakova.`);
    }
}

function validateOptionalText(body, field, label, maxLength, errors) {
    if (body[field] === undefined || body[field] === null) return;

    if (typeof body[field] !== "string") {
        errors.push(`${label} mora biti tekst.`);
        return;
    }

    if (maxLength !== null && body[field].trim().length > maxLength) {
        errors.push(`${label} smije imati najviše ${maxLength} znakova.`);
    }
}

function validateOptionalDate(body, field, label, errors) {
    if (body[field] === undefined || body[field] === null) {
        return;
    }

    if (!isValidDate(body[field])) {
        errors.push(`${label} mora biti u formatu YYYY-MM-DD.`);
    }
}

function validateOptionalInteger(body, field, label, min, max, errors) {
    if (body[field] === undefined || body[field] === null) return;

    if (!isIntegerInRange(body[field], min, max)) {
        errors.push(`${label} mora biti cijeli broj između ${min} i ${max}.`);
    }
}

function validateOptionalNumber(body, field, label, min, max, errors) {
    if (body[field] === undefined || body[field] === null) return;

    if (!isNumberInRange(body[field], min, max)) {
        errors.push(`${label} mora biti broj između ${min} i ${max}.`);
    }
}

function validateAuditFields(body, mode, errors) {
    if (mode === "create") {
        validateRequiredId(
            body,
            "created_by",
            "ID korisnika koji stvara zapis",
            errors
        );

        validateRequiredId(
            body,
            "updated_by",
            "ID korisnika koji uređuje zapis",
            errors
        );

        return;
    }

    validateRequiredId(
        body,
        "updated_by",
        "ID korisnika koji uređuje zapis",
        errors
    );
}

function validateAllowedFields(body, allowedFields) {
    const fields = Object.keys(body ?? {});

    if (fields.length === 0) {
        return ["Niste poslali nijedno polje za izmjenu."];
    }

    const invalidFields = fields.filter(
        field => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
        return [`Nedopuštena polja: ${invalidFields.join(", ")}`];
    }

    return [];
}

function normalizeValue(field, value) {
    const integerFields = [
        "reporting_period_id",
        "organizer_unit_id",
        "total_participants",
        "foreign_participants",
        "country_count",
        "presentation_count",
        "published_paper_count",
        "conference_id",
        "submitted_abstract_count",
        "accepted_abstract_count",
        "plenary_lecture_count",
        "section_count",
        "country_id",
        "participant_count",
        "created_by",
        "updated_by"
    ];

    const numberFields = [
        "organization_cost_eur",
        "share_percent"
    ];

    if (value === null) return null;

    if (integerFields.includes(field)) {
        return Number(value);
    }

    if (numberFields.includes(field)) {
        return Number(value);
    }

    if (typeof value === "string") {
        return value.trim() || null;
    }

    return value;
}

async function patchRecord(table, body, id) {
    const fields = Object.keys(body);
    const values = [];
    const updates = [];

    for (const field of fields) {
        values.push(normalizeValue(field, body[field]));
        updates.push(`${field} = $${values.length}`);
    }

    updates.push("updated_at = NOW()");
    values.push(id);

    return pool.query(
        `
            UPDATE ${table}
            SET ${updates.join(", ")}
            WHERE id = $${values.length}
            RETURNING *
        `,
        values
    );
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

function validateConference(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) return errors;

    const partial = mode === "patch";

    validateRequiredId(
        body,
        "reporting_period_id",
        "ID izvještajnog razdoblja",
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "conference_name",
        "Naziv konferencije",
        250,
        errors,
        !partial
    );

    validateOptionalDate(
        body,
        "held_on",
        "Datum održavanja",
        errors
    );

    validateOptionalText(
        body,
        "location",
        "Lokacija",
        150,
        errors
    );

    validateNullableId(
        body,
        "organizer_unit_id",
        "ID sastavnice organizatora",
        errors
    );

    validateOptionalText(
        body,
        "coorganizers",
        "Suorganizatori",
        null,
        errors
    );

    validateOptionalText(
        body,
        "scientific_field",
        "Znanstveno područje",
        150,
        errors
    );

    validateOptionalInteger(
        body,
        "total_participants",
        "Ukupan broj sudionika",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "foreign_participants",
        "Broj stranih sudionika",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "country_count",
        "Broj država",
        0,
        250,
        errors
    );

    validateOptionalInteger(
        body,
        "presentation_count",
        "Broj izlaganja",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "published_paper_count",
        "Broj objavljenih radova",
        0,
        9999,
        errors
    );

    validateOptionalText(
        body,
        "web_or_proceedings_link",
        "Poveznica na web ili zbornik",
        null,
        errors
    );

    validateOptionalText(
        body,
        "notes",
        "Napomene",
        null,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateConferenceDetails(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateRequiredId(
        body,
        "conference_id",
        "ID konferencije",
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "english_name",
        "Naziv na engleskom jeziku",
        250,
        errors
    );

    validateOptionalText(
        body,
        "date_and_location",
        "Datum i lokacija",
        250,
        errors
    );

    validateOptionalText(
        body,
        "organizing_committee_chair",
        "Predsjednik organizacijskog odbora",
        120,
        errors
    );

    validateOptionalText(
        body,
        "program_committee_chair",
        "Predsjednik programskog odbora",
        120,
        errors
    );

    validateOptionalText(
        body,
        "unipu_program_members",
        "Članovi programskog odbora UNIPU-a",
        null,
        errors
    );

    validateOptionalText(
        body,
        "foreign_program_members",
        "Strani članovi programskog odbora",
        null,
        errors
    );

    validateOptionalInteger(
        body,
        "submitted_abstract_count",
        "Broj prijavljenih sažetaka",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "accepted_abstract_count",
        "Broj prihvaćenih sažetaka",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "plenary_lecture_count",
        "Broj plenarnih predavanja",
        0,
        999,
        errors
    );

    validateOptionalInteger(
        body,
        "section_count",
        "Broj sekcija",
        0,
        999,
        errors
    );

    validateOptionalText(
        body,
        "proceedings_indexing",
        "Indeksiranje zbornika",
        150,
        errors
    );

    validateOptionalText(
        body,
        "conference_website",
        "Web stranica konferencije",
        null,
        errors
    );

    validateOptionalText(
        body,
        "media_coverage",
        "Medijska pokrivenost",
        null,
        errors
    );

    validateOptionalNumber(
        body,
        "organization_cost_eur",
        "Trošak organizacije",
        0,
        999999.99,
        errors
    );

    validateOptionalText(
        body,
        "funding_sources",
        "Izvori financiranja",
        null,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateCountryStatistic(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateRequiredId(
        body,
        "conference_id",
        "ID konferencije",
        errors,
        !partial
    );

    validateNullableId(
        body,
        "country_id",
        "ID države",
        errors
    );

    validateRequiredText(
        body,
        "country_name",
        "Naziv države",
        100,
        errors,
        !partial
    );

    validateOptionalInteger(
        body,
        "participant_count",
        "Broj sudionika",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "presentation_count",
        "Broj izlaganja",
        0,
        9999,
        errors
    );

    validateOptionalNumber(
        body,
        "share_percent",
        "Udio u postocima",
        0,
        100,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                ic.*,
                rp.label AS reporting_period_label,
                ou.name AS organizer_unit_name
            FROM international_conferences ic
            JOIN reporting_periods rp
                ON rp.id = ic.reporting_period_id
            LEFT JOIN organizational_units ou
                ON ou.id = ic.organizer_unit_id
            ORDER BY
                ic.held_on DESC NULLS LAST,
                ic.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    ic.*,
                    rp.label AS reporting_period_label,
                    ou.name AS organizer_unit_name
                FROM international_conferences ic
                JOIN reporting_periods rp
                    ON rp.id = ic.reporting_period_id
                LEFT JOIN organizational_units ou
                    ON ou.id = ic.organizer_unit_id
                WHERE ic.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Međunarodna konferencija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    const errors = validateConference(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        conference_name,
        held_on = null,
        location = null,
        organizer_unit_id = null,
        coorganizers = null,
        scientific_field = null,
        total_participants = null,
        foreign_participants = null,
        country_count = null,
        presentation_count = null,
        published_paper_count = null,
        web_or_proceedings_link = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO international_conferences (
                    reporting_period_id,
                    conference_name,
                    held_on,
                    location,
                    organizer_unit_id,
                    coorganizers,
                    scientific_field,
                    total_participants,
                    foreign_participants,
                    country_count,
                    presentation_count,
                    published_paper_count,
                    web_or_proceedings_link,
                    notes,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14, $15, $16
                )
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                conference_name.trim(),
                held_on,
                location?.trim() || null,
                organizer_unit_id === null ? null : Number(organizer_unit_id),
                coorganizers?.trim() || null,
                scientific_field?.trim() || null,
                total_participants === null ? null : Number(total_participants),
                foreign_participants === null ? null : Number(foreign_participants),
                country_count === null ? null : Number(country_count),
                presentation_count === null ? null : Number(presentation_count),
                published_paper_count === null ? null : Number(published_paper_count),
                web_or_proceedings_link?.trim() || null,
                notes?.trim() || null,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/:id", validateId, async (req, res, next) => {
    const errors = validateConference(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        conference_name,
        held_on = null,
        location = null,
        organizer_unit_id = null,
        coorganizers = null,
        scientific_field = null,
        total_participants = null,
        foreign_participants = null,
        country_count = null,
        presentation_count = null,
        published_paper_count = null,
        web_or_proceedings_link = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE international_conferences
                SET
                    reporting_period_id = $1,
                    conference_name = $2,
                    held_on = $3,
                    location = $4,
                    organizer_unit_id = $5,
                    coorganizers = $6,
                    scientific_field = $7,
                    total_participants = $8,
                    foreign_participants = $9,
                    country_count = $10,
                    presentation_count = $11,
                    published_paper_count = $12,
                    web_or_proceedings_link = $13,
                    notes = $14,
                    updated_by = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                conference_name.trim(),
                held_on,
                location?.trim() || null,
                organizer_unit_id === null ? null : Number(organizer_unit_id),
                coorganizers?.trim() || null,
                scientific_field?.trim() || null,
                total_participants === null ? null : Number(total_participants),
                foreign_participants === null ? null : Number(foreign_participants),
                country_count === null ? null : Number(country_count),
                presentation_count === null ? null : Number(presentation_count),
                published_paper_count === null ? null : Number(published_paper_count),
                web_or_proceedings_link?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Međunarodna konferencija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "conference_name",
        "held_on",
        "location",
        "organizer_unit_id",
        "coorganizers",
        "scientific_field",
        "total_participants",
        "foreign_participants",
        "country_count",
        "presentation_count",
        "published_paper_count",
        "web_or_proceedings_link",
        "notes",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(
        req.body,
        allowedFields
    );

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateConference(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "international_conferences",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Međunarodna konferencija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM international_conferences
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Međunarodna konferencija nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/details/all", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                icd.*,
                ic.conference_name
            FROM international_conference_details icd
            JOIN international_conferences ic
                ON ic.id = icd.conference_id
            ORDER BY icd.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/details/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    icd.*,
                    ic.conference_name
                FROM international_conference_details icd
                JOIN international_conferences ic
                    ON ic.id = icd.conference_id
                WHERE icd.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Detalji konferencije nisu pronađeni."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/details", async (req, res, next) => {
    const errors = validateConferenceDetails(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        conference_id,
        english_name = null,
        date_and_location = null,
        organizing_committee_chair = null,
        program_committee_chair = null,
        unipu_program_members = null,
        foreign_program_members = null,
        submitted_abstract_count = null,
        accepted_abstract_count = null,
        plenary_lecture_count = null,
        section_count = null,
        proceedings_indexing = null,
        conference_website = null,
        media_coverage = null,
        organization_cost_eur = null,
        funding_sources = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO international_conference_details (
                    conference_id,
                    english_name,
                    date_and_location,
                    organizing_committee_chair,
                    program_committee_chair,
                    unipu_program_members,
                    foreign_program_members,
                    submitted_abstract_count,
                    accepted_abstract_count,
                    plenary_lecture_count,
                    section_count,
                    proceedings_indexing,
                    conference_website,
                    media_coverage,
                    organization_cost_eur,
                    funding_sources,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16, $17, $18
                )
                RETURNING *
            `,
            [
                Number(conference_id),
                english_name?.trim() || null,
                date_and_location?.trim() || null,
                organizing_committee_chair?.trim() || null,
                program_committee_chair?.trim() || null,
                unipu_program_members?.trim() || null,
                foreign_program_members?.trim() || null,
                submitted_abstract_count === null ? null : Number(submitted_abstract_count),
                accepted_abstract_count === null ? null : Number(accepted_abstract_count),
                plenary_lecture_count === null ? null : Number(plenary_lecture_count),
                section_count === null ? null : Number(section_count),
                proceedings_indexing?.trim() || null,
                conference_website?.trim() || null,
                media_coverage?.trim() || null,
                organization_cost_eur === null ? null : Number(organization_cost_eur),
                funding_sources?.trim() || null,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/details/:id", validateId, async (req, res, next) => {
    const errors = validateConferenceDetails(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        conference_id,
        english_name = null,
        date_and_location = null,
        organizing_committee_chair = null,
        program_committee_chair = null,
        unipu_program_members = null,
        foreign_program_members = null,
        submitted_abstract_count = null,
        accepted_abstract_count = null,
        plenary_lecture_count = null,
        section_count = null,
        proceedings_indexing = null,
        conference_website = null,
        media_coverage = null,
        organization_cost_eur = null,
        funding_sources = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE international_conference_details
                SET
                    conference_id = $1,
                    english_name = $2,
                    date_and_location = $3,
                    organizing_committee_chair = $4,
                    program_committee_chair = $5,
                    unipu_program_members = $6,
                    foreign_program_members = $7,
                    submitted_abstract_count = $8,
                    accepted_abstract_count = $9,
                    plenary_lecture_count = $10,
                    section_count = $11,
                    proceedings_indexing = $12,
                    conference_website = $13,
                    media_coverage = $14,
                    organization_cost_eur = $15,
                    funding_sources = $16,
                    updated_by = $17,
                    updated_at = NOW()
                WHERE id = $18
                RETURNING *
            `,
            [
                Number(conference_id),
                english_name?.trim() || null,
                date_and_location?.trim() || null,
                organizing_committee_chair?.trim() || null,
                program_committee_chair?.trim() || null,
                unipu_program_members?.trim() || null,
                foreign_program_members?.trim() || null,
                submitted_abstract_count === null ? null : Number(submitted_abstract_count),
                accepted_abstract_count === null ? null : Number(accepted_abstract_count),
                plenary_lecture_count === null ? null : Number(plenary_lecture_count),
                section_count === null ? null : Number(section_count),
                proceedings_indexing?.trim() || null,
                conference_website?.trim() || null,
                media_coverage?.trim() || null,
                organization_cost_eur === null ? null : Number(organization_cost_eur),
                funding_sources?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Detalji konferencije nisu pronađeni."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/details/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "conference_id",
        "english_name",
        "date_and_location",
        "organizing_committee_chair",
        "program_committee_chair",
        "unipu_program_members",
        "foreign_program_members",
        "submitted_abstract_count",
        "accepted_abstract_count",
        "plenary_lecture_count",
        "section_count",
        "proceedings_indexing",
        "conference_website",
        "media_coverage",
        "organization_cost_eur",
        "funding_sources",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(
        req.body,
        allowedFields
    );

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateConferenceDetails(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "international_conference_details",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Detalji konferencije nisu pronađeni."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/details/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM international_conference_details
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Detalji konferencije nisu pronađeni."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/countries/all", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                ccs.*,
                ic.conference_name,
                c.name_hr AS database_country_name_hr,
                c.name_en AS database_country_name_en
            FROM conference_country_statistics ccs
            JOIN international_conferences ic
                ON ic.id = ccs.conference_id
            LEFT JOIN countries c
                ON c.id = ccs.country_id
            ORDER BY
                ic.conference_name,
                ccs.country_name
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/countries/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    ccs.*,
                    ic.conference_name,
                    c.name_hr AS database_country_name_hr,
                    c.name_en AS database_country_name_en
                FROM conference_country_statistics ccs
                JOIN international_conferences ic
                    ON ic.id = ccs.conference_id
                LEFT JOIN countries c
                    ON c.id = ccs.country_id
                WHERE ccs.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Statistika države nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/countries", async (req, res, next) => {
    const errors = validateCountryStatistic(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        conference_id,
        country_id = null,
        country_name,
        participant_count = null,
        presentation_count = null,
        share_percent = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO conference_country_statistics (
                    conference_id,
                    country_id,
                    country_name,
                    participant_count,
                    presentation_count,
                    share_percent,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                Number(conference_id),
                country_id === null ? null : Number(country_id),
                country_name.trim(),
                participant_count === null ? null : Number(participant_count),
                presentation_count === null ? null : Number(presentation_count),
                share_percent === null ? null : Number(share_percent),
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/countries/:id", validateId, async (req, res, next) => {
    const errors = validateCountryStatistic(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        conference_id,
        country_id = null,
        country_name,
        participant_count = null,
        presentation_count = null,
        share_percent = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE conference_country_statistics
                SET
                    conference_id = $1,
                    country_id = $2,
                    country_name = $3,
                    participant_count = $4,
                    presentation_count = $5,
                    share_percent = $6,
                    updated_by = $7,
                    updated_at = NOW()
                WHERE id = $8
                RETURNING *
            `,
            [
                Number(conference_id),
                country_id === null ? null : Number(country_id),
                country_name.trim(),
                participant_count === null ? null : Number(participant_count),
                presentation_count === null ? null : Number(presentation_count),
                share_percent === null ? null : Number(share_percent),
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Statistika države nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/countries/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "conference_id",
        "country_id",
        "country_name",
        "participant_count",
        "presentation_count",
        "share_percent",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(
        req.body,
        allowedFields
    );

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateCountryStatistic(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "conference_country_statistics",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Statistika države nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/countries/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM conference_country_statistics
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Statistika države nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
