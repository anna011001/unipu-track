import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const allowedCooperationKinds = [
    "SCIENTIFIC",
    "ARTISTIC",
    "PROFESSIONAL"
];

const allowedRegions = [
    "EU",
    "OTHER_EUROPE",
    "NORTH_AMERICA",
    "SOUTH_AMERICA",
    "ASIA",
    "AFRICA",
    "OCEANIA"
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

    if (maxLength !== null && body[field].trim().length > maxLength) {
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

function validateOptionalInteger(body, field, label, min, max, errors) {
    if (body[field] === undefined || body[field] === null) return;

    if (!isIntegerInRange(body[field], min, max)) {
        errors.push(
            `${label} mora biti cijeli broj između ${min} i ${max}.`
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
        "country_id",
        "organizational_unit_id",
        "scientific_count",
        "artistic_count",
        "professional_count",
        "total_count",
        "new_count",
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

function validateNewCooperation(body, mode = "create") {
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
        "partner_institution",
        "Partnerska institucija",
        100,
        errors,
        !partial
    );

    validateNullableId(
        body,
        "country_id",
        "ID države",
        errors
    );

    if (!partial || body.cooperation_kind !== undefined) {
        if (body.cooperation_kind !== undefined &&
            body.cooperation_kind !== null &&
            !allowedCooperationKinds.includes(body.cooperation_kind)) {
            errors.push(
                `Vrsta suradnje mora biti: ${allowedCooperationKinds.join(", ")}.`
            );
        }
    }

    validateOptionalText(
        body,
        "cooperation_field",
        "Područje suradnje",
        150,
        errors
    );

    validateOptionalDate(
        body,
        "start_date",
        "Datum početka",
        errors
    );

    validateOptionalText(
        body,
        "duration",
        "Trajanje",
        80,
        errors
    );

    validateOptionalText(
        body,
        "agreement_type",
        "Vrsta sporazuma",
        100,
        errors
    );

    validateOptionalText(
        body,
        "unipu_contact_person",
        "Kontakt osoba UNIPU-a",
        120,
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
        "planned_activities",
        "Planirane aktivnosti",
        null,
        errors
    );

    validateOptionalText(
        body,
        "agreement_link",
        "Poveznica na sporazum",
        null,
        errors
    );

    validateOptionalText(
        body,
        "status",
        "Status",
        40,
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

function validateAgreement(body, mode = "create") {
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
        "partner_institution",
        "Partnerska institucija",
        100,
        errors,
        !partial
    );

    validateNullableId(
        body,
        "country_id",
        "ID države",
        errors
    );

    if (!partial || body.cooperation_kind !== undefined) {
        if (
            body.cooperation_kind !== undefined &&
            body.cooperation_kind !== null &&
            !allowedCooperationKinds.includes(body.cooperation_kind)
        ) {
            errors.push(
                `Vrsta suradnje mora biti: ${allowedCooperationKinds.join(", ")}.`
            );
        }
    }

    validateOptionalText(
        body,
        "agreement_type",
        "Vrsta sporazuma",
        100,
        errors
    );

    validateOptionalDate(
        body,
        "signed_on",
        "Datum potpisivanja",
        errors
    );

    validateOptionalDate(
        body,
        "valid_until",
        "Datum valjanosti",
        errors
    );

    if (
        body.signed_on !== undefined &&
        body.signed_on !== null &&
        body.valid_until !== undefined &&
        body.valid_until !== null &&
        isValidDate(body.signed_on) &&
        isValidDate(body.valid_until) &&
        new Date(body.valid_until) < new Date(body.signed_on)
    ) {
        errors.push(
            "Datum valjanosti ne smije biti prije datuma potpisivanja."
        );
    }

    validateOptionalText(
        body,
        "responsible_person",
        "Odgovorna osoba",
        120,
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
        "completed_activities",
        "Provedene aktivnosti",
        null,
        errors
    );

    validateOptionalText(
        body,
        "planned_activities",
        "Planirane aktivnosti",
        null,
        errors
    );

    validateOptionalText(
        body,
        "status",
        "Status",
        40,
        errors
    );

    validateOptionalText(
        body,
        "document_link",
        "Poveznica na dokument",
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

function validateRegionAnalysis(body, mode = "create") {
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

    if (!partial || body.region !== undefined) {
        if (!allowedRegions.includes(body.region)) {
            errors.push(
                `Regija mora biti: ${allowedRegions.join(", ")}.`
            );
        }
    }

    validateOptionalInteger(
        body,
        "scientific_count",
        "Broj znanstvenih suradnji",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "artistic_count",
        "Broj umjetničkih suradnji",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "professional_count",
        "Broj stručnih suradnji",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "total_count",
        "Ukupan broj suradnji",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "new_count",
        "Broj novih suradnji",
        0,
        9999,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/new", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                nic.*,
                rp.label AS reporting_period_label,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en,
                ou.name AS organizational_unit_name
            FROM new_international_cooperations nic
            JOIN reporting_periods rp
                ON rp.id = nic.reporting_period_id
            LEFT JOIN countries c
                ON c.id = nic.country_id
            LEFT JOIN organizational_units ou
                ON ou.id = nic.organizational_unit_id
            ORDER BY
                nic.start_date DESC NULLS LAST,
                nic.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/new/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    nic.*,
                    rp.label AS reporting_period_label,
                    c.name_hr AS country_name_hr,
                    c.name_en AS country_name_en,
                    ou.name AS organizational_unit_name
                FROM new_international_cooperations nic
                JOIN reporting_periods rp
                    ON rp.id = nic.reporting_period_id
                LEFT JOIN countries c
                    ON c.id = nic.country_id
                LEFT JOIN organizational_units ou
                    ON ou.id = nic.organizational_unit_id
                WHERE nic.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Nova međunarodna suradnja nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/new", async (req, res, next) => {
    const errors = validateNewCooperation(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        partner_institution,
        country_id = null,
        cooperation_kind = null,
        cooperation_field = null,
        start_date = null,
        duration = null,
        agreement_type = null,
        unipu_contact_person = null,
        organizational_unit_id = null,
        planned_activities = null,
        agreement_link = null,
        status = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO new_international_cooperations (
                    reporting_period_id,
                    partner_institution,
                    country_id,
                    cooperation_kind,
                    cooperation_field,
                    start_date,
                    duration,
                    agreement_type,
                    unipu_contact_person,
                    organizational_unit_id,
                    planned_activities,
                    agreement_link,
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
                Number(reporting_period_id),
                partner_institution.trim(),
                country_id === null ? null : Number(country_id),
                cooperation_kind,
                cooperation_field?.trim() || null,
                start_date,
                duration?.trim() || null,
                agreement_type?.trim() || null,
                unipu_contact_person?.trim() || null,
                organizational_unit_id === null ? null : Number(organizational_unit_id),
                planned_activities?.trim() || null,
                agreement_link?.trim() || null,
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

router.put("/new/:id", validateId, async (req, res, next) => {
    const errors = validateNewCooperation(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        partner_institution,
        country_id = null,
        cooperation_kind = null,
        cooperation_field = null,
        start_date = null,
        duration = null,
        agreement_type = null,
        unipu_contact_person = null,
        organizational_unit_id = null,
        planned_activities = null,
        agreement_link = null,
        status = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE new_international_cooperations
                SET
                    reporting_period_id = $1,
                    partner_institution = $2,
                    country_id = $3,
                    cooperation_kind = $4,
                    cooperation_field = $5,
                    start_date = $6,
                    duration = $7,
                    agreement_type = $8,
                    unipu_contact_person = $9,
                    organizational_unit_id = $10,
                    planned_activities = $11,
                    agreement_link = $12,
                    status = $13,
                    notes = $14,
                    updated_by = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                partner_institution.trim(),
                country_id === null ? null : Number(country_id),
                cooperation_kind,
                cooperation_field?.trim() || null,
                start_date,
                duration?.trim() || null,
                agreement_type?.trim() || null,
                unipu_contact_person?.trim() || null,
                organizational_unit_id === null ? null : Number(organizational_unit_id),
                planned_activities?.trim() || null,
                agreement_link?.trim() || null,
                status?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Nova međunarodna suradnja nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/new/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "partner_institution",
        "country_id",
        "cooperation_kind",
        "cooperation_field",
        "start_date",
        "duration",
        "agreement_type",
        "unipu_contact_person",
        "organizational_unit_id",
        "planned_activities",
        "agreement_link",
        "status",
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

    const errors = validateNewCooperation(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "new_international_cooperations",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Nova međunarodna suradnja nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/new/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM new_international_cooperations
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Nova međunarodna suradnja nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/agreements", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                aia.*,
                rp.label AS reporting_period_label,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en,
                ou.name AS organizational_unit_name
            FROM active_international_agreements aia
            JOIN reporting_periods rp
                ON rp.id = aia.reporting_period_id
            LEFT JOIN countries c
                ON c.id = aia.country_id
            LEFT JOIN organizational_units ou
                ON ou.id = aia.organizational_unit_id
            ORDER BY
                aia.signed_on DESC NULLS LAST,
                aia.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/agreements/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    aia.*,
                    rp.label AS reporting_period_label,
                    c.name_hr AS country_name_hr,
                    c.name_en AS country_name_en,
                    ou.name AS organizational_unit_name
                FROM active_international_agreements aia
                JOIN reporting_periods rp
                    ON rp.id = aia.reporting_period_id
                LEFT JOIN countries c
                    ON c.id = aia.country_id
                LEFT JOIN organizational_units ou
                    ON ou.id = aia.organizational_unit_id
                WHERE aia.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Međunarodni sporazum nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/agreements", async (req, res, next) => {
    const errors = validateAgreement(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        partner_institution,
        country_id = null,
        cooperation_kind = null,
        agreement_type = null,
        signed_on = null,
        valid_until = null,
        responsible_person = null,
        organizational_unit_id = null,
        completed_activities = null,
        planned_activities = null,
        status = null,
        document_link = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO active_international_agreements (
                    reporting_period_id,
                    partner_institution,
                    country_id,
                    cooperation_kind,
                    agreement_type,
                    signed_on,
                    valid_until,
                    responsible_person,
                    organizational_unit_id,
                    completed_activities,
                    planned_activities,
                    status,
                    document_link,
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
                partner_institution.trim(),
                country_id === null ? null : Number(country_id),
                cooperation_kind,
                agreement_type?.trim() || null,
                signed_on,
                valid_until,
                responsible_person?.trim() || null,
                organizational_unit_id === null ? null : Number(organizational_unit_id),
                completed_activities?.trim() || null,
                planned_activities?.trim() || null,
                status?.trim() || null,
                document_link?.trim() || null,
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

router.put("/agreements/:id", validateId, async (req, res, next) => {
    const errors = validateAgreement(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        partner_institution,
        country_id = null,
        cooperation_kind = null,
        agreement_type = null,
        signed_on = null,
        valid_until = null,
        responsible_person = null,
        organizational_unit_id = null,
        completed_activities = null,
        planned_activities = null,
        status = null,
        document_link = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE active_international_agreements
                SET
                    reporting_period_id = $1,
                    partner_institution = $2,
                    country_id = $3,
                    cooperation_kind = $4,
                    agreement_type = $5,
                    signed_on = $6,
                    valid_until = $7,
                    responsible_person = $8,
                    organizational_unit_id = $9,
                    completed_activities = $10,
                    planned_activities = $11,
                    status = $12,
                    document_link = $13,
                    notes = $14,
                    updated_by = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                partner_institution.trim(),
                country_id === null ? null : Number(country_id),
                cooperation_kind,
                agreement_type?.trim() || null,
                signed_on,
                valid_until,
                responsible_person?.trim() || null,
                organizational_unit_id === null ? null : Number(organizational_unit_id),
                completed_activities?.trim() || null,
                planned_activities?.trim() || null,
                status?.trim() || null,
                document_link?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Međunarodni sporazum nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/agreements/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "partner_institution",
        "country_id",
        "cooperation_kind",
        "agreement_type",
        "signed_on",
        "valid_until",
        "responsible_person",
        "organizational_unit_id",
        "completed_activities",
        "planned_activities",
        "status",
        "document_link",
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

    const errors = validateAgreement(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const currentResult = await pool.query(
            `
                SELECT signed_on, valid_until
                FROM active_international_agreements
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({
                message: "Međunarodni sporazum nije pronađen."
            });
        }

        const current = currentResult.rows[0];

        const finalSignedOn =
            req.body.signed_on !== undefined ? req.body.signed_on : current.signed_on;

        const finalValidUntil =
            req.body.valid_until !== undefined ? req.body.valid_until : current.valid_until;

        if (
            finalSignedOn !== null &&
            finalValidUntil !== null &&
            new Date(finalValidUntil) < new Date(finalSignedOn)
        ) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors: [
                    "Datum valjanosti ne smije biti prije datuma potpisivanja."
                ]
            });
        }

        const result = await patchRecord(
            "active_international_agreements",
            req.body,
            req.resourceId
        );

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/agreements/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM active_international_agreements
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Međunarodni sporazum nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/region-analyses", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                icra.*,
                rp.label AS reporting_period_label
            FROM international_cooperation_region_analyses icra
            JOIN reporting_periods rp
                ON rp.id = icra.reporting_period_id
            ORDER BY
                rp.start_date DESC,
                icra.region
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/region-analyses/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    icra.*,
                    rp.label AS reporting_period_label
                FROM international_cooperation_region_analyses icra
                JOIN reporting_periods rp
                    ON rp.id = icra.reporting_period_id
                WHERE icra.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza međunarodne suradnje nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/region-analyses", async (req, res, next) => {
    const errors = validateRegionAnalysis(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        region,
        scientific_count = 0,
        artistic_count = 0,
        professional_count = 0,
        total_count = 0,
        new_count = 0,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO international_cooperation_region_analyses (
                    reporting_period_id,
                    region,
                    scientific_count,
                    artistic_count,
                    professional_count,
                    total_count,
                    new_count,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                region,
                Number(scientific_count),
                Number(artistic_count),
                Number(professional_count),
                Number(total_count),
                Number(new_count),
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/region-analyses/:id", validateId, async (req, res, next) => {
    const errors = validateRegionAnalysis(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        region,
        scientific_count = 0,
        artistic_count = 0,
        professional_count = 0,
        total_count = 0,
        new_count = 0,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE international_cooperation_region_analyses
                SET
                    reporting_period_id = $1,
                    region = $2,
                    scientific_count = $3,
                    artistic_count = $4,
                    professional_count = $5,
                    total_count = $6,
                    new_count = $7,
                    updated_by = $8,
                    updated_at = NOW()
                WHERE id = $9
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                region,
                Number(scientific_count),
                Number(artistic_count),
                Number(professional_count),
                Number(total_count),
                Number(new_count),
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza međunarodne suradnje nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/region-analyses/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "region",
        "scientific_count",
        "artistic_count",
        "professional_count",
        "total_count",
        "new_count",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(req.body, allowedFields);

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateRegionAnalysis(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "international_cooperation_region_analyses",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza međunarodne suradnje nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/region-analyses/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM international_cooperation_region_analyses
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Analiza međunarodne suradnje nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
