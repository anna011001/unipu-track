import express from "express";
import pool from "../db/pool.js";
import { validateId } from "../middleware/validateId.js";

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

function isValidDate(value) {
    return (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value))
    );
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
        body[field] !== undefined && body[field] !== null && !isPositiveInteger(body[field])
    ) {
        errors.push(`${label} mora biti pozitivan cijeli broj ili null.`);
    }
}

function validateRequiredText(
    body,
    field,
    label,
    maxLength,
    errors,
    required = true
) {
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

    if (maxLength !== null && body[field].trim().length > maxLength
    ) {
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
    if (body[field] === undefined || body[field] === null) return;

    if (!isValidDate(body[field])) {
        errors.push(`${label} mora biti u formatu YYYY-MM-DD.`);
    }
}

function validateOptionalEmail(body, field, label, errors) {
    if (body[field] === undefined || body[field] === null) return;

    if (typeof body[field] !== "string") {
        errors.push(`${label} mora biti tekst.`);
        return;
    }

    if (body[field].trim() !== "" && !isValidEmail(body[field].trim())) {
        errors.push(`${label} nije ispravna.`);
    }
}

function validateOptionalBoolean(body, field, label, errors) {
    if (body[field] === undefined || body[field] === null) return;

    if (typeof body[field] !== "boolean") {
        errors.push(`${label} mora biti true ili false.`);
    }
}

function validateOptionalInteger(body, field, label, min, max, errors) {
    if (body[field] === undefined || body[field] === null) return;

    if (!isIntegerInRange(body[field], min, max)) {
        errors.push(`${label} mora biti cijeli broj između ${min} i ${max}.`);
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
        "organizational_unit_id",
        "stakeholder_analysis_id",
        "country_id",
        "priority",
        "science_stakeholder_count",
        "art_stakeholder_count",
        "profession_stakeholder_count",
        "total_stakeholder_count",
        "existing_cooperation_count",
        "high_potential_count",
        "planned_new_cooperation_count",
        "created_by",
        "updated_by"
    ];

    if (value === null) return null;

    if (integerFields.includes(field)) {
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

function validateAnalysis(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) return errors;

    validateOptionalDate(
        body,
        "analysis_date",
        "Datum analize",
        errors
    );

    validateNullableId(
        body,
        "organizational_unit_id",
        "ID sastavnice",
        errors
    );

    validateOptionalText(
        body,
        "responsible_person",
        "Odgovorna osoba",
        120,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateStakeholder(body, mode = "create", professional = false) {
    const errors = validateBody(body);

    if (errors.length > 0) return errors;

    const partial = mode === "patch";

    validateRequiredId(
        body,
        "stakeholder_analysis_id",
        "ID analize dionika",
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "organization_name",
        "Naziv organizacije",
        200,
        errors,
        !partial
    );

    const optionalTextFields = professional
        ? [
            ["organization_kind", "Vrsta organizacije", 100],
            ["activity_field", "Područje djelovanja", 150]
        ]
        : [
            ["stakeholder_type", "Vrsta dionika", 100],
            ["scientific_field", "Znanstveno područje", 150]
        ];

    optionalTextFields.push(
        ["contact_name", "Kontakt osoba", 120],
        ["cooperation_type", "Vrsta suradnje", 120],
        ["cooperation_potential", "Potencijal suradnje", null],
        ["planned_activities", "Planirane aktivnosti", null],
        ["status", "Status", 40],
        ["notes", "Napomene", null]
    );

    for (const [field, label, maxLength] of optionalTextFields) {
        validateOptionalText(
            body,
            field,
            label,
            maxLength,
            errors
        );
    }

    if (professional) {
        validateOptionalBoolean(
            body,
            "unipu_membership",
            "Članstvo UNIPU-a",
            errors
        );
    } else {
        validateOptionalBoolean(
            body,
            "existing_cooperation",
            "Postojeća suradnja",
            errors
        );
    }

    validateNullableId(
        body,
        "country_id",
        "ID države",
        errors
    );

    validateOptionalEmail(
        body,
        "contact_email",
        "E-mail adresa",
        errors
    );

    validateOptionalInteger(
        body,
        "priority",
        "Prioritet",
        1,
        5,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateSummary(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateRequiredId(
        body,
        "stakeholder_analysis_id",
        "ID analize dionika",
        errors,
        !partial
    );

    const countFields = [
        ["science_stakeholder_count", "Broj znanstvenih dionika"],
        ["art_stakeholder_count", "Broj umjetničkih dionika"],
        ["profession_stakeholder_count", "Broj stručnih dionika"],
        ["total_stakeholder_count", "Ukupan broj dionika"],
        ["existing_cooperation_count", "Broj postojećih suradnji"],
        ["high_potential_count", "Broj dionika visokog potencijala"],
        ["planned_new_cooperation_count", "Broj planiranih novih suradnji"]
    ];

    for (const [field, label] of countFields) {
        validateOptionalInteger(
            body,
            field,
            label,
            0,
            9999,
            errors
        );
    }

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/analyses", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                sa.*,
                ou.name AS organizational_unit_name
            FROM stakeholder_analyses sa
            LEFT JOIN organizational_units ou
                ON ou.id = sa.organizational_unit_id
            ORDER BY
                sa.analysis_date DESC NULLS LAST,
                sa.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/analyses/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    sa.*,
                    ou.name AS organizational_unit_name
                FROM stakeholder_analyses sa
                LEFT JOIN organizational_units ou
                    ON ou.id = sa.organizational_unit_id
                WHERE sa.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza dionika nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/analyses", async (req, res, next) => {
    const errors = validateAnalysis(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        analysis_date = null,
        organizational_unit_id = null,
        responsible_person = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO stakeholder_analyses (
                    analysis_date,
                    organizational_unit_id,
                    responsible_person,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `,
            [
                analysis_date,
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                responsible_person?.trim() || null,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/analyses/:id", validateId, async (req, res, next) => {
    const errors = validateAnalysis(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        analysis_date = null,
        organizational_unit_id = null,
        responsible_person = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE stakeholder_analyses
                SET
                    analysis_date = $1,
                    organizational_unit_id = $2,
                    responsible_person = $3,
                    updated_by = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `,
            [
                analysis_date,
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                responsible_person?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza dionika nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/analyses/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "analysis_date",
        "organizational_unit_id",
        "responsible_person",
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

    const errors = validateAnalysis(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "stakeholder_analyses",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza dionika nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/analyses/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM stakeholder_analyses
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza dionika nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/science", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                ss.*,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en
            FROM science_stakeholders ss
            LEFT JOIN countries c
                ON c.id = ss.country_id
            ORDER BY ss.organization_name
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/science/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    ss.*,
                    c.name_hr AS country_name_hr,
                    c.name_en AS country_name_en
                FROM science_stakeholders ss
                LEFT JOIN countries c
                    ON c.id = ss.country_id
                WHERE ss.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Znanstveni dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/science", async (req, res, next) => {
    const errors = validateStakeholder(
        req.body,
        "create"
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        stakeholder_analysis_id,
        organization_name,
        stakeholder_type = null,
        country_id = null,
        scientific_field = null,
        contact_name = null,
        contact_email = null,
        existing_cooperation = null,
        cooperation_type = null,
        cooperation_potential = null,
        priority = null,
        planned_activities = null,
        status = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO science_stakeholders (
                    stakeholder_analysis_id,
                    organization_name,
                    stakeholder_type,
                    country_id,
                    scientific_field,
                    contact_name,
                    contact_email,
                    existing_cooperation,
                    cooperation_type,
                    cooperation_potential,
                    priority,
                    planned_activities,
                    status,
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
                Number(stakeholder_analysis_id),
                organization_name.trim(),
                stakeholder_type?.trim() || null,
                country_id === null ? null : Number(country_id),
                scientific_field?.trim() || null,
                contact_name?.trim() || null,
                contact_email?.trim() || null,
                existing_cooperation,
                cooperation_type?.trim() || null,
                cooperation_potential?.trim() || null,
                priority === null ? null : Number(priority),
                planned_activities?.trim() || null,
                status?.trim() || null,
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

router.put("/science/:id", validateId, async (req, res, next) => {
    const errors = validateStakeholder(
        req.body,
        "put"
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        stakeholder_analysis_id,
        organization_name,
        stakeholder_type = null,
        country_id = null,
        scientific_field = null,
        contact_name = null,
        contact_email = null,
        existing_cooperation = null,
        cooperation_type = null,
        cooperation_potential = null,
        priority = null,
        planned_activities = null,
        status = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE science_stakeholders
                SET
                    stakeholder_analysis_id = $1,
                    organization_name = $2,
                    stakeholder_type = $3,
                    country_id = $4,
                    scientific_field = $5,
                    contact_name = $6,
                    contact_email = $7,
                    existing_cooperation = $8,
                    cooperation_type = $9,
                    cooperation_potential = $10,
                    priority = $11,
                    planned_activities = $12,
                    status = $13,
                    notes = $14,
                    updated_by = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `,
            [
                Number(stakeholder_analysis_id),
                organization_name.trim(),
                stakeholder_type?.trim() || null,
                country_id === null ? null : Number(country_id),
                scientific_field?.trim() || null,
                contact_name?.trim() || null,
                contact_email?.trim() || null,
                existing_cooperation,
                cooperation_type?.trim() || null,
                cooperation_potential?.trim() || null,
                priority === null ? null : Number(priority),
                planned_activities?.trim() || null,
                status?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Znanstveni dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/science/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "stakeholder_analysis_id",
        "organization_name",
        "stakeholder_type",
        "country_id",
        "scientific_field",
        "contact_name",
        "contact_email",
        "existing_cooperation",
        "cooperation_type",
        "cooperation_potential",
        "priority",
        "planned_activities",
        "status",
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

    const errors = validateStakeholder(
        req.body,
        "patch"
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "science_stakeholders",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Znanstveni dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/science/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM science_stakeholders
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Znanstveni dionik nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/artistic", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                ars.*,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en
            FROM artistic_stakeholders ars
            LEFT JOIN countries c
                ON c.id = ars.country_id
            ORDER BY ars.organization_name
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/artistic/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    ars.*,
                    c.name_hr AS country_name_hr,
                    c.name_en AS country_name_en
                FROM artistic_stakeholders ars
                LEFT JOIN countries c
                    ON c.id = ars.country_id
                WHERE ars.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Umjetnički dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/artistic", async (req, res, next) => {
    const errors = validateStakeholder(
        req.body,
        "create"
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        stakeholder_analysis_id,
        organization_name,
        stakeholder_type = null,
        country_id = null,
        scientific_field = null,
        contact_name = null,
        contact_email = null,
        existing_cooperation = null,
        cooperation_type = null,
        cooperation_potential = null,
        priority = null,
        planned_activities = null,
        status = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO artistic_stakeholders (
                    stakeholder_analysis_id,
                    organization_name,
                    stakeholder_type,
                    country_id,
                    scientific_field,
                    contact_name,
                    contact_email,
                    existing_cooperation,
                    cooperation_type,
                    cooperation_potential,
                    priority,
                    planned_activities,
                    status,
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
                Number(stakeholder_analysis_id),
                organization_name.trim(),
                stakeholder_type?.trim() || null,
                country_id === null ? null : Number(country_id),
                scientific_field?.trim() || null,
                contact_name?.trim() || null,
                contact_email?.trim() || null,
                existing_cooperation,
                cooperation_type?.trim() || null,
                cooperation_potential?.trim() || null,
                priority === null ? null : Number(priority),
                planned_activities?.trim() || null,
                status?.trim() || null,
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

router.put("/artistic/:id", validateId, async (req, res, next) => {
    const errors = validateStakeholder(
        req.body,
        "put"
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        stakeholder_analysis_id,
        organization_name,
        stakeholder_type = null,
        country_id = null,
        scientific_field = null,
        contact_name = null,
        contact_email = null,
        existing_cooperation = null,
        cooperation_type = null,
        cooperation_potential = null,
        priority = null,
        planned_activities = null,
        status = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE artistic_stakeholders
                SET
                    stakeholder_analysis_id = $1,
                    organization_name = $2,
                    stakeholder_type = $3,
                    country_id = $4,
                    scientific_field = $5,
                    contact_name = $6,
                    contact_email = $7,
                    existing_cooperation = $8,
                    cooperation_type = $9,
                    cooperation_potential = $10,
                    priority = $11,
                    planned_activities = $12,
                    status = $13,
                    notes = $14,
                    updated_by = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `,
            [
                Number(stakeholder_analysis_id),
                organization_name.trim(),
                stakeholder_type?.trim() || null,
                country_id === null ? null : Number(country_id),
                scientific_field?.trim() || null,
                contact_name?.trim() || null,
                contact_email?.trim() || null,
                existing_cooperation,
                cooperation_type?.trim() || null,
                cooperation_potential?.trim() || null,
                priority === null ? null : Number(priority),
                planned_activities?.trim() || null,
                status?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Umjetnički dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/artistic/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "stakeholder_analysis_id",
        "organization_name",
        "stakeholder_type",
        "country_id",
        "scientific_field",
        "contact_name",
        "contact_email",
        "existing_cooperation",
        "cooperation_type",
        "cooperation_potential",
        "priority",
        "planned_activities",
        "status",
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

    const errors = validateStakeholder(
        req.body,
        "patch"
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "artistic_stakeholders",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Umjetnički dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/artistic/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM artistic_stakeholders
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Umjetnički dionik nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/professional", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                ps.*,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en
            FROM professional_stakeholders ps
            LEFT JOIN countries c
                ON c.id = ps.country_id
            ORDER BY ps.organization_name
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/professional/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    ps.*,
                    c.name_hr AS country_name_hr,
                    c.name_en AS country_name_en
                FROM professional_stakeholders ps
                LEFT JOIN countries c
                    ON c.id = ps.country_id
                WHERE ps.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Stručni dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/professional", async (req, res, next) => {
    const errors = validateStakeholder(
        req.body,
        "create",
        true
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        stakeholder_analysis_id,
        organization_name,
        organization_kind = null,
        country_id = null,
        activity_field = null,
        contact_name = null,
        contact_email = null,
        unipu_membership = null,
        cooperation_type = null,
        cooperation_potential = null,
        priority = null,
        planned_activities = null,
        status = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO professional_stakeholders (
                    stakeholder_analysis_id,
                    organization_name,
                    organization_kind,
                    country_id,
                    activity_field,
                    contact_name,
                    contact_email,
                    unipu_membership,
                    cooperation_type,
                    cooperation_potential,
                    priority,
                    planned_activities,
                    status,
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
                Number(stakeholder_analysis_id),
                organization_name.trim(),
                organization_kind?.trim() || null,
                country_id === null ? null : Number(country_id),
                activity_field?.trim() || null,
                contact_name?.trim() || null,
                contact_email?.trim() || null,
                unipu_membership,
                cooperation_type?.trim() || null,
                cooperation_potential?.trim() || null,
                priority === null ? null : Number(priority),
                planned_activities?.trim() || null,
                status?.trim() || null,
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

router.put("/professional/:id", validateId, async (req, res, next) => {
    const errors = validateStakeholder(
        req.body,
        "put",
        true
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        stakeholder_analysis_id,
        organization_name,
        organization_kind = null,
        country_id = null,
        activity_field = null,
        contact_name = null,
        contact_email = null,
        unipu_membership = null,
        cooperation_type = null,
        cooperation_potential = null,
        priority = null,
        planned_activities = null,
        status = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE professional_stakeholders
                SET
                    stakeholder_analysis_id = $1,
                    organization_name = $2,
                    organization_kind = $3,
                    country_id = $4,
                    activity_field = $5,
                    contact_name = $6,
                    contact_email = $7,
                    unipu_membership = $8,
                    cooperation_type = $9,
                    cooperation_potential = $10,
                    priority = $11,
                    planned_activities = $12,
                    status = $13,
                    notes = $14,
                    updated_by = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `,
            [
                Number(stakeholder_analysis_id),
                organization_name.trim(),
                organization_kind?.trim() || null,
                country_id === null ? null : Number(country_id),
                activity_field?.trim() || null,
                contact_name?.trim() || null,
                contact_email?.trim() || null,
                unipu_membership,
                cooperation_type?.trim() || null,
                cooperation_potential?.trim() || null,
                priority === null ? null : Number(priority),
                planned_activities?.trim() || null,
                status?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Stručni dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/professional/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "stakeholder_analysis_id",
        "organization_name",
        "organization_kind",
        "country_id",
        "activity_field",
        "contact_name",
        "contact_email",
        "unipu_membership",
        "cooperation_type",
        "cooperation_potential",
        "priority",
        "planned_activities",
        "status",
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

    const errors = validateStakeholder(
        req.body,
        "patch",
        true
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "professional_stakeholders",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Stručni dionik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/professional/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM professional_stakeholders
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Stručni dionik nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/summaries", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM stakeholder_analysis_summaries
            ORDER BY created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/summaries/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM stakeholder_analysis_summaries
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak analize nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/summaries", async (req, res, next) => {
    const errors = validateSummary(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        stakeholder_analysis_id,
        science_stakeholder_count = 0,
        art_stakeholder_count = 0,
        profession_stakeholder_count = 0,
        total_stakeholder_count = 0,
        existing_cooperation_count = 0,
        high_potential_count = 0,
        planned_new_cooperation_count = 0,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO stakeholder_analysis_summaries (
                    stakeholder_analysis_id,
                    science_stakeholder_count,
                    art_stakeholder_count,
                    profession_stakeholder_count,
                    total_stakeholder_count,
                    existing_cooperation_count,
                    high_potential_count,
                    planned_new_cooperation_count,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10
                )
                RETURNING *
            `,
            [
                Number(stakeholder_analysis_id),
                Number(science_stakeholder_count),
                Number(art_stakeholder_count),
                Number(profession_stakeholder_count),
                Number(total_stakeholder_count),
                Number(existing_cooperation_count),
                Number(high_potential_count),
                Number(planned_new_cooperation_count),
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/summaries/:id", validateId, async (req, res, next) => {
    const errors = validateSummary(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        stakeholder_analysis_id,
        science_stakeholder_count = 0,
        art_stakeholder_count = 0,
        profession_stakeholder_count = 0,
        total_stakeholder_count = 0,
        existing_cooperation_count = 0,
        high_potential_count = 0,
        planned_new_cooperation_count = 0,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE stakeholder_analysis_summaries
                SET
                    stakeholder_analysis_id = $1,
                    science_stakeholder_count = $2,
                    art_stakeholder_count = $3,
                    profession_stakeholder_count = $4,
                    total_stakeholder_count = $5,
                    existing_cooperation_count = $6,
                    high_potential_count = $7,
                    planned_new_cooperation_count = $8,
                    updated_by = $9,
                    updated_at = NOW()
                WHERE id = $10
                RETURNING *
            `,
            [
                Number(stakeholder_analysis_id),
                Number(science_stakeholder_count),
                Number(art_stakeholder_count),
                Number(profession_stakeholder_count),
                Number(total_stakeholder_count),
                Number(existing_cooperation_count),
                Number(high_potential_count),
                Number(planned_new_cooperation_count),
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak analize nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/summaries/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "stakeholder_analysis_id",
        "science_stakeholder_count",
        "art_stakeholder_count",
        "profession_stakeholder_count",
        "total_stakeholder_count",
        "existing_cooperation_count",
        "high_potential_count",
        "planned_new_cooperation_count",
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

    const errors = validateSummary(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "stakeholder_analysis_summaries",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak analize nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/summaries/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM stakeholder_analysis_summaries
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak analize nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;