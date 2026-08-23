import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const EVENT_TYPES = [
    "Međunarodne konferencije",
    "Domaće konferencije",
    "Znanstveni skupovi",
    "Stručni skupovi",
    "Okrugli stolovi",
    "Radionice"
];

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

    if (
        typeof body[field] !== "string" ||
        body[field].trim() === ""
    ) {
        errors.push(`${label} mora biti neprazan tekst.`);
        return;
    }

    if (
        maxLength !== null &&
        body[field].trim().length > maxLength
    ) {
        errors.push(`${label} smije imati najviše ${maxLength} znakova.`);
    }
}

function validateOptionalText(body, field, label, maxLength, errors) {
    if (body[field] === undefined || body[field] === null) {
        return;
    }

    if (typeof body[field] !== "string") {
        errors.push(`${label} mora biti tekst.`);
        return;
    }

    if (
        maxLength !== null &&
        body[field].trim().length > maxLength
    ) {
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
    if (body[field] === undefined || body[field] === null) {
        return;
    }

    if (!isIntegerInRange(body[field], min, max)) {
        errors.push(
            `${label} mora biti cijeli broj između ${min} i ${max}.`
        );
    }
}

function validateOptionalNumber(body, field, label, min, max, errors) {
    if (body[field] === undefined || body[field] === null) {
        return;
    }

    if (!isNumberInRange(body[field], min, max)) {
        errors.push(
            `${label} mora biti broj između ${min} i ${max}.`
        );
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
        return [
            `Nedopuštena polja: ${invalidFields.join(", ")}`
        ];
    }

    return [];
}

function normalizeValue(field, value) {
    const integerFields = [
        "reporting_period_id",
        "partner_country_id",
        "country_id",
        "participant_count",
        "presentation_count",
        "expected_participant_count",
        "held_count",
        "planned_count",
        "total_participants",
        "average_participants",
        "created_by",
        "updated_by"
    ];

    const numberFields = [
        "cost_eur",
        "estimated_cost_eur"
    ];

    if (value === null) {
        return null;
    }

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

function validateHeldEvent(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

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
        "event_name",
        "Naziv događanja",
        250,
        errors,
        !partial
    );

    const textFields = [
        ["event_type", "Vrsta događanja", 100],
        ["location", "Lokacija", 150],
        ["unipu_organizers", "Organizatori s UNIPU-a", null],
        ["partner_organizations", "Partnerske organizacije", null],
        ["thematic_field", "Tematsko područje", 150],
        ["program_report_link", "Poveznica na program ili izvješće", null],
        ["media_coverage", "Medijska pokrivenost", null],
        ["notes", "Napomene", null]
    ];

    for (const [field, label, maxLength] of textFields) {
        validateOptionalText(body, field, label, maxLength, errors);
    }

    if (
        body.event_type !== undefined &&
        typeof body.event_type === "string" &&
        !EVENT_TYPES.includes(body.event_type.trim())
    ) {
        errors.push("Vrsta događanja nije dopuštena.");
    }

    validateOptionalDate(
        body,
        "event_date",
        "Datum događanja",
        errors
    );

    validateNullableId(
        body,
        "partner_country_id",
        "ID države partnera",
        errors
    );

    const integerFields = [
        ["participant_count", "Broj sudionika", 0, 9999],
        ["presentation_count", "Broj prezentacija", 0, 9999]
    ];

    for (const [field, label, min, max] of integerFields) {
        validateOptionalInteger(body, field, label, min, max, errors);
    }

    validateOptionalNumber(
        body,
        "cost_eur",
        "Trošak",
        0,
        999999.99,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validatePlannedEvent(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

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
        "event_name",
        "Naziv događanja",
        250,
        errors,
        !partial
    );

    const textFields = [
        ["event_type", "Vrsta događanja", 100],
        ["location", "Lokacija", 150],
        ["unipu_organizer", "Organizator s UNIPU-a", 200],
        ["potential_partners", "Potencijalni partneri", null],
        ["thematic_field", "Tematsko područje", 150],
        ["preparation_status", "Status pripreme", 40],
        ["funding_source", "Izvor financiranja", 150],
        ["responsible_person", "Odgovorna osoba", 120],
        ["notes", "Napomene", null]
    ];

    for (const [field, label, maxLength] of textFields) {
        validateOptionalText(body, field, label, maxLength, errors);
    }

    if (
        body.event_type !== undefined &&
        typeof body.event_type === "string" &&
        !EVENT_TYPES.includes(body.event_type.trim())
    ) {
        errors.push("Vrsta događanja nije dopuštena.");
    }

    validateOptionalDate(
        body,
        "planned_date",
        "Planirani datum",
        errors
    );

    validateNullableId(
        body,
        "country_id",
        "ID države",
        errors
    );

    validateOptionalInteger(
        body,
        "expected_participant_count",
        "Očekivani broj sudionika",
        0,
        9999,
        errors
    );

    validateOptionalNumber(
        body,
        "estimated_cost_eur",
        "Procijenjeni trošak",
        0,
        999999.99,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateTypeAnalysis(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

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
        "event_type",
        "Vrsta događanja",
        100,
        errors,
        !partial
    );

    const integerFields = [
        ["held_count", "Broj održanih događanja", 0, 9999],
        ["planned_count", "Broj planiranih događanja", 0, 9999],
        ["total_participants", "Ukupan broj sudionika", 0, 999999],
        ["average_participants", "Prosječan broj sudionika", 0, 9999]
    ];

    for (const [field, label, min, max] of integerFields) {
        validateOptionalInteger(body, field, label, min, max, errors);
    }

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/held", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                hje.*,
                rp.label AS reporting_period_label,
                c.name_hr AS partner_country_name_hr,
                c.name_en AS partner_country_name_en
            FROM held_joint_events hje
            JOIN reporting_periods rp
                ON rp.id = hje.reporting_period_id
            LEFT JOIN countries c
                ON c.id = hje.partner_country_id
            ORDER BY
                hje.event_date DESC NULLS LAST,
                hje.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/held/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    hje.*,
                    rp.label AS reporting_period_label,
                    c.name_hr AS partner_country_name_hr,
                    c.name_en AS partner_country_name_en
                FROM held_joint_events hje
                JOIN reporting_periods rp
                    ON rp.id = hje.reporting_period_id
                LEFT JOIN countries c
                    ON c.id = hje.partner_country_id
                WHERE hje.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Održano zajedničko događanje nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/held", async (req, res, next) => {
    const errors = validateHeldEvent(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        event_name,
        event_type = null,
        event_date = null,
        location = null,
        unipu_organizers = null,
        partner_organizations = null,
        partner_country_id = null,
        participant_count = null,
        presentation_count = null,
        thematic_field = null,
        program_report_link = null,
        media_coverage = null,
        cost_eur = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO held_joint_events (
                    reporting_period_id,
                    event_name,
                    event_type,
                    event_date,
                    location,
                    unipu_organizers,
                    partner_organizations,
                    partner_country_id,
                    participant_count,
                    presentation_count,
                    thematic_field,
                    program_report_link,
                    media_coverage,
                    cost_eur,
                    notes,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16, $17
                )
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                event_name.trim(),
                event_type?.trim() || null,
                event_date,
                location?.trim() || null,
                unipu_organizers?.trim() || null,
                partner_organizations?.trim() || null,
                partner_country_id === null ? null : Number(partner_country_id),
                participant_count === null ? null : Number(participant_count),
                presentation_count === null ? null : Number(presentation_count),
                thematic_field?.trim() || null,
                program_report_link?.trim() || null,
                media_coverage?.trim() || null,
                cost_eur === null ? null : Number(cost_eur),
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

router.put("/held/:id", validateId, async (req, res, next) => {
    const errors = validateHeldEvent(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        event_name,
        event_type = null,
        event_date = null,
        location = null,
        unipu_organizers = null,
        partner_organizations = null,
        partner_country_id = null,
        participant_count = null,
        presentation_count = null,
        thematic_field = null,
        program_report_link = null,
        media_coverage = null,
        cost_eur = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE held_joint_events
                SET
                    reporting_period_id = $1,
                    event_name = $2,
                    event_type = $3,
                    event_date = $4,
                    location = $5,
                    unipu_organizers = $6,
                    partner_organizations = $7,
                    partner_country_id = $8,
                    participant_count = $9,
                    presentation_count = $10,
                    thematic_field = $11,
                    program_report_link = $12,
                    media_coverage = $13,
                    cost_eur = $14,
                    notes = $15,
                    updated_by = $16,
                    updated_at = NOW()
                WHERE id = $17
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                event_name.trim(),
                event_type?.trim() || null,
                event_date,
                location?.trim() || null,
                unipu_organizers?.trim() || null,
                partner_organizations?.trim() || null,
                partner_country_id === null ? null : Number(partner_country_id),
                participant_count === null ? null : Number(participant_count),
                presentation_count === null ? null : Number(presentation_count),
                thematic_field?.trim() || null,
                program_report_link?.trim() || null,
                media_coverage?.trim() || null,
                cost_eur === null ? null : Number(cost_eur),
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Održano zajedničko događanje nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/held/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "event_name",
        "event_type",
        "event_date",
        "location",
        "unipu_organizers",
        "partner_organizations",
        "partner_country_id",
        "participant_count",
        "presentation_count",
        "thematic_field",
        "program_report_link",
        "media_coverage",
        "cost_eur",
        "notes",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(req.body, allowedFields);

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateHeldEvent(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "held_joint_events",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Održano zajedničko događanje nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/held/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM held_joint_events
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Održano zajedničko događanje nije pronađeno."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/planned", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                pje.*,
                rp.label AS reporting_period_label,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en
            FROM planned_joint_events pje
            JOIN reporting_periods rp
                ON rp.id = pje.reporting_period_id
            LEFT JOIN countries c
                ON c.id = pje.country_id
            ORDER BY
                pje.planned_date ASC NULLS LAST,
                pje.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/planned/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    pje.*,
                    rp.label AS reporting_period_label,
                    c.name_hr AS country_name_hr,
                    c.name_en AS country_name_en
                FROM planned_joint_events pje
                JOIN reporting_periods rp
                    ON rp.id = pje.reporting_period_id
                LEFT JOIN countries c
                    ON c.id = pje.country_id
                WHERE pje.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Planirano zajedničko događanje nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/planned", async (req, res, next) => {
    const errors = validatePlannedEvent(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        event_name,
        event_type = null,
        planned_date = null,
        location = null,
        unipu_organizer = null,
        potential_partners = null,
        country_id = null,
        expected_participant_count = null,
        thematic_field = null,
        preparation_status = null,
        estimated_cost_eur = null,
        funding_source = null,
        responsible_person = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO planned_joint_events (
                    reporting_period_id,
                    event_name,
                    event_type,
                    planned_date,
                    location,
                    unipu_organizer,
                    potential_partners,
                    country_id,
                    expected_participant_count,
                    thematic_field,
                    preparation_status,
                    estimated_cost_eur,
                    funding_source,
                    responsible_person,
                    notes,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16, $17
                )
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                event_name.trim(),
                event_type?.trim() || null,
                planned_date,
                location?.trim() || null,
                unipu_organizer?.trim() || null,
                potential_partners?.trim() || null,
                country_id === null ? null : Number(country_id),
                expected_participant_count === null ? null : Number(expected_participant_count),
                thematic_field?.trim() || null,
                preparation_status?.trim() || null,
                estimated_cost_eur === null ? null : Number(estimated_cost_eur),
                funding_source?.trim() || null,
                responsible_person?.trim() || null,
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

router.put("/planned/:id", validateId, async (req, res, next) => {
    const errors = validatePlannedEvent(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        event_name,
        event_type = null,
        planned_date = null,
        location = null,
        unipu_organizer = null,
        potential_partners = null,
        country_id = null,
        expected_participant_count = null,
        thematic_field = null,
        preparation_status = null,
        estimated_cost_eur = null,
        funding_source = null,
        responsible_person = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE planned_joint_events
                SET
                    reporting_period_id = $1,
                    event_name = $2,
                    event_type = $3,
                    planned_date = $4,
                    location = $5,
                    unipu_organizer = $6,
                    potential_partners = $7,
                    country_id = $8,
                    expected_participant_count = $9,
                    thematic_field = $10,
                    preparation_status = $11,
                    estimated_cost_eur = $12,
                    funding_source = $13,
                    responsible_person = $14,
                    notes = $15,
                    updated_by = $16,
                    updated_at = NOW()
                WHERE id = $17
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                event_name.trim(),
                event_type?.trim() || null,
                planned_date,
                location?.trim() || null,
                unipu_organizer?.trim() || null,
                potential_partners?.trim() || null,
                country_id === null ? null : Number(country_id),
                expected_participant_count === null ? null : Number(expected_participant_count),
                thematic_field?.trim() || null,
                preparation_status?.trim() || null,
                estimated_cost_eur === null ? null : Number(estimated_cost_eur),
                funding_source?.trim() || null,
                responsible_person?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Planirano zajedničko događanje nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/planned/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "event_name",
        "event_type",
        "planned_date",
        "location",
        "unipu_organizer",
        "potential_partners",
        "country_id",
        "expected_participant_count",
        "thematic_field",
        "preparation_status",
        "estimated_cost_eur",
        "funding_source",
        "responsible_person",
        "notes",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(req.body, allowedFields);

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validatePlannedEvent(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "planned_joint_events",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Planirano zajedničko događanje nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/planned/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM planned_joint_events
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Planirano zajedničko događanje nije pronađeno."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/type-analyses", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                jeta.*,
                rp.label AS reporting_period_label
            FROM joint_event_type_analyses jeta
            JOIN reporting_periods rp
                ON rp.id = jeta.reporting_period_id
            ORDER BY
                rp.start_date DESC,
                jeta.event_type
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/type-analyses/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    jeta.*,
                    rp.label AS reporting_period_label
                FROM joint_event_type_analyses jeta
                JOIN reporting_periods rp
                    ON rp.id = jeta.reporting_period_id
                WHERE jeta.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza vrste događanja nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/type-analyses", async (req, res, next) => {
    const errors = validateTypeAnalysis(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        event_type,
        held_count = 0,
        planned_count = 0,
        total_participants = 0,
        average_participants = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO joint_event_type_analyses (
                    reporting_period_id,
                    event_type,
                    held_count,
                    planned_count,
                    total_participants,
                    average_participants,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                event_type.trim(),
                Number(held_count),
                Number(planned_count),
                Number(total_participants),
                average_participants === null ? null : Number(average_participants),
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/type-analyses/:id", validateId, async (req, res, next) => {
    const errors = validateTypeAnalysis(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        event_type,
        held_count = 0,
        planned_count = 0,
        total_participants = 0,
        average_participants = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE joint_event_type_analyses
                SET
                    reporting_period_id = $1,
                    event_type = $2,
                    held_count = $3,
                    planned_count = $4,
                    total_participants = $5,
                    average_participants = $6,
                    updated_by = $7,
                    updated_at = NOW()
                WHERE id = $8
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                event_type.trim(),
                Number(held_count),
                Number(planned_count),
                Number(total_participants),
                average_participants === null ? null : Number(average_participants),
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza vrste događanja nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/type-analyses/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "event_type",
        "held_count",
        "planned_count",
        "total_participants",
        "average_participants",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(req.body, allowedFields);

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateTypeAnalysis(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "joint_event_type_analyses",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza vrste događanja nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/type-analyses/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM joint_event_type_analyses
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza vrste događanja nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
