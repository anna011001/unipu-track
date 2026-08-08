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

function validateBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    return [];
}

function validateRequiredId(
    body,
    field,
    label,
    errors,
    required = true
) {
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
        errors.push(
            `${label} mora biti pozitivan cijeli broj ili null.`
        );
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
        errors.push(
            `${label} smije imati najviše ${maxLength} znakova.`
        );
    }
}

function validateOptionalText(
    body,
    field,
    label,
    maxLength,
    errors
) {
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
        errors.push(
            `${label} smije imati najviše ${maxLength} znakova.`
        );
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

function validateOptionalInteger(
    body,
    field,
    label,
    min,
    max,
    errors
) {
    if (body[field] === undefined || body[field] === null) {
        return;
    }

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
        "host_unit_id",
        "organizational_unit_id",
        "duration_days",
        "visit_count",
        "total_days",
        "lecture_count",
        "publication_count",
        "project_count",
        "created_by",
        "updated_by"
    ];

    if (value === null) {
        return null;
    }

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
            message:
                "Jedan od navedenih povezanih zapisa ne postoji."
        });
    }

    if (error.code === "23505") {
        return res.status(409).json({
            message:
                "Zapis s tom kombinacijom podataka već postoji."
        });
    }

    if (error.code === "23514") {
        return res.status(400).json({
            message: "Podaci krše pravila baze podataka."
        });
    }

    return next(error);
}

function validateRealizedResearcher(body, mode = "create") {
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
        "researcher_name",
        "Ime istraživača",
        120,
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "academic_title",
        "Akademska titula",
        30,
        errors
    );

    validateOptionalText(
        body,
        "home_institution",
        "Matična ustanova",
        200,
        errors
    );

    validateNullableId(
        body,
        "country_id",
        "ID države",
        errors
    );

    validateOptionalText(
        body,
        "scientific_field",
        "Znanstveno područje",
        150,
        errors
    );

    validateOptionalDate(
        body,
        "arrival_date",
        "Datum dolaska",
        errors
    );

    validateOptionalDate(
        body,
        "departure_date",
        "Datum odlaska",
        errors
    );

    if (
        body.arrival_date !== undefined &&
        body.arrival_date !== null &&
        body.departure_date !== undefined &&
        body.departure_date !== null &&
        isValidDate(body.arrival_date) &&
        isValidDate(body.departure_date) &&
        new Date(body.departure_date) <
            new Date(body.arrival_date)
    ) {
        errors.push(
            "Datum odlaska ne smije biti prije datuma dolaska."
        );
    }

    validateOptionalInteger(
        body,
        "duration_days",
        "Trajanje u danima",
        0,
        999,
        errors
    );

    validateNullableId(
        body,
        "host_unit_id",
        "ID sastavnice domaćina",
        errors
    );

    validateOptionalText(
        body,
        "mentor_contact",
        "Kontakt mentora",
        150,
        errors
    );

    validateOptionalText(
        body,
        "activities_during_stay",
        "Aktivnosti tijekom boravka",
        null,
        errors
    );

    validateOptionalText(
        body,
        "results",
        "Rezultati",
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

function validatePlannedResearcher(body, mode = "create") {
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
        "researcher_name",
        "Ime istraživača",
        120,
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "academic_title",
        "Akademska titula",
        30,
        errors
    );

    validateOptionalText(
        body,
        "home_institution",
        "Matična ustanova",
        200,
        errors
    );

    validateNullableId(
        body,
        "country_id",
        "ID države",
        errors
    );

    validateOptionalText(
        body,
        "scientific_field",
        "Znanstveno područje",
        150,
        errors
    );

    validateOptionalText(
        body,
        "planned_period",
        "Planirano razdoblje",
        100,
        errors
    );

    validateOptionalText(
        body,
        "duration",
        "Trajanje",
        60,
        errors
    );

    validateNullableId(
        body,
        "host_unit_id",
        "ID sastavnice domaćina",
        errors
    );

    validateOptionalText(
        body,
        "mentor",
        "Mentor",
        120,
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
        "invitation_status",
        "Status poziva",
        40,
        errors
    );

    validateOptionalText(
        body,
        "funding_source",
        "Izvor financiranja",
        150,
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

function validateUnitAnalysis(body, mode = "create") {
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

    validateRequiredId(
        body,
        "organizational_unit_id",
        "ID sastavnice",
        errors,
        !partial
    );

    validateOptionalInteger(
        body,
        "visit_count",
        "Broj gostovanja",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "total_days",
        "Ukupan broj dana",
        0,
        999999,
        errors
    );

    validateOptionalInteger(
        body,
        "lecture_count",
        "Broj predavanja",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "publication_count",
        "Broj publikacija",
        0,
        9999,
        errors
    );

    validateOptionalInteger(
        body,
        "project_count",
        "Broj projekata",
        0,
        9999,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/realized", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                rvr.*,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en,
                ou.name AS host_unit_name,
                rp.label AS reporting_period_label
            FROM realized_visiting_researchers rvr
            JOIN reporting_periods rp
                ON rp.id = rvr.reporting_period_id
            LEFT JOIN countries c
                ON c.id = rvr.country_id
            LEFT JOIN organizational_units ou
                ON ou.id = rvr.host_unit_id
            ORDER BY
                rvr.arrival_date DESC NULLS LAST,
                rvr.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/realized/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    SELECT
                        rvr.*,
                        c.name_hr AS country_name_hr,
                        c.name_en AS country_name_en,
                        ou.name AS host_unit_name,
                        rp.label AS reporting_period_label
                    FROM realized_visiting_researchers rvr
                    JOIN reporting_periods rp
                        ON rp.id = rvr.reporting_period_id
                    LEFT JOIN countries c
                        ON c.id = rvr.country_id
                    LEFT JOIN organizational_units ou
                        ON ou.id = rvr.host_unit_id
                    WHERE rvr.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Realizirano gostovanje nije pronađeno."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post("/realized", async (req, res, next) => {
    const errors = validateRealizedResearcher(
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
        reporting_period_id,
        researcher_name,
        academic_title = null,
        home_institution = null,
        country_id = null,
        scientific_field = null,
        arrival_date = null,
        departure_date = null,
        duration_days = null,
        host_unit_id = null,
        mentor_contact = null,
        activities_during_stay = null,
        results = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO realized_visiting_researchers (
                    reporting_period_id,
                    researcher_name,
                    academic_title,
                    home_institution,
                    country_id,
                    scientific_field,
                    arrival_date,
                    departure_date,
                    duration_days,
                    host_unit_id,
                    mentor_contact,
                    activities_during_stay,
                    results,
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
                researcher_name.trim(),
                academic_title?.trim() || null,
                home_institution?.trim() || null,
                country_id === null
                    ? null
                    : Number(country_id),
                scientific_field?.trim() || null,
                arrival_date,
                departure_date,
                duration_days === null
                    ? null
                    : Number(duration_days),
                host_unit_id === null
                    ? null
                    : Number(host_unit_id),
                mentor_contact?.trim() || null,
                activities_during_stay?.trim() || null,
                results?.trim() || null,
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

router.put("/realized/:id", validateId, async (req, res, next) => {
        const errors = validateRealizedResearcher(
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
            reporting_period_id,
            researcher_name,
            academic_title = null,
            home_institution = null,
            country_id = null,
            scientific_field = null,
            arrival_date = null,
            departure_date = null,
            duration_days = null,
            host_unit_id = null,
            mentor_contact = null,
            activities_during_stay = null,
            results = null,
            notes = null,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE realized_visiting_researchers
                    SET
                        reporting_period_id = $1,
                        researcher_name = $2,
                        academic_title = $3,
                        home_institution = $4,
                        country_id = $5,
                        scientific_field = $6,
                        arrival_date = $7,
                        departure_date = $8,
                        duration_days = $9,
                        host_unit_id = $10,
                        mentor_contact = $11,
                        activities_during_stay = $12,
                        results = $13,
                        notes = $14,
                        updated_by = $15,
                        updated_at = NOW()
                    WHERE id = $16
                    RETURNING *
                `,
                [
                    Number(reporting_period_id),
                    researcher_name.trim(),
                    academic_title?.trim() || null,
                    home_institution?.trim() || null,
                    country_id === null
                        ? null
                        : Number(country_id),
                    scientific_field?.trim() || null,
                    arrival_date,
                    departure_date,
                    duration_days === null
                        ? null
                        : Number(duration_days),
                    host_unit_id === null
                        ? null
                        : Number(host_unit_id),
                    mentor_contact?.trim() || null,
                    activities_during_stay?.trim() || null,
                    results?.trim() || null,
                    notes?.trim() || null,
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Realizirano gostovanje nije pronađeno."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.patch("/realized/:id", validateId, async (req, res, next) => {
        const allowedFields = [
            "reporting_period_id",
            "researcher_name",
            "academic_title",
            "home_institution",
            "country_id",
            "scientific_field",
            "arrival_date",
            "departure_date",
            "duration_days",
            "host_unit_id",
            "mentor_contact",
            "activities_during_stay",
            "results",
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

        const errors = validateRealizedResearcher(
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
            /*
             * Kod PATCH-a možda mijenjamo samo jedan datum.
             * Zato dohvaćamo postojeće datume da možemo
             * provjeriti konačnu kombinaciju.
             */
            const currentResult = await pool.query(
                `
                    SELECT arrival_date, departure_date
                    FROM realized_visiting_researchers
                    WHERE id = $1
                `,
                [req.resourceId]
            );

            if (currentResult.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Realizirano gostovanje nije pronađeno."
                });
            }

            const current = currentResult.rows[0];

            const finalArrivalDate =
                req.body.arrival_date !== undefined
                    ? req.body.arrival_date
                    : current.arrival_date;

            const finalDepartureDate =
                req.body.departure_date !== undefined
                    ? req.body.departure_date
                    : current.departure_date;

            if (
                finalArrivalDate !== null &&
                finalDepartureDate !== null &&
                new Date(finalDepartureDate) <
                    new Date(finalArrivalDate)
            ) {
                return res.status(400).json({
                    message: "Podaci nisu ispravni.",
                    errors: [
                        "Datum odlaska ne smije biti prije datuma dolaska."
                    ]
                });
            }

            const result = await patchRecord(
                "realized_visiting_researchers",
                req.body,
                req.resourceId
            );

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.delete("/realized/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE FROM realized_visiting_researchers
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Realizirano gostovanje nije pronađeno."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.get("/planned", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                pvr.*,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en,
                ou.name AS host_unit_name,
                rp.label AS reporting_period_label
            FROM planned_visiting_researchers pvr
            JOIN reporting_periods rp
                ON rp.id = pvr.reporting_period_id
            LEFT JOIN countries c
                ON c.id = pvr.country_id
            LEFT JOIN organizational_units ou
                ON ou.id = pvr.host_unit_id
            ORDER BY pvr.created_at DESC
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
                        pvr.*,
                        c.name_hr AS country_name_hr,
                        c.name_en AS country_name_en,
                        ou.name AS host_unit_name,
                        rp.label AS reporting_period_label
                    FROM planned_visiting_researchers pvr
                    JOIN reporting_periods rp
                        ON rp.id = pvr.reporting_period_id
                    LEFT JOIN countries c
                        ON c.id = pvr.country_id
                    LEFT JOIN organizational_units ou
                        ON ou.id = pvr.host_unit_id
                    WHERE pvr.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Planirano gostovanje nije pronađeno."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post("/planned", async (req, res, next) => {
    const errors = validatePlannedResearcher(
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
        reporting_period_id,
        researcher_name,
        academic_title = null,
        home_institution = null,
        country_id = null,
        scientific_field = null,
        planned_period = null,
        duration = null,
        host_unit_id = null,
        mentor = null,
        planned_activities = null,
        invitation_status = null,
        funding_source = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO planned_visiting_researchers (
                    reporting_period_id,
                    researcher_name,
                    academic_title,
                    home_institution,
                    country_id,
                    scientific_field,
                    planned_period,
                    duration,
                    host_unit_id,
                    mentor,
                    planned_activities,
                    invitation_status,
                    funding_source,
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
                researcher_name.trim(),
                academic_title?.trim() || null,
                home_institution?.trim() || null,
                country_id === null ? null : Number(country_id),
                scientific_field?.trim() || null,
                planned_period?.trim() || null,
                duration?.trim() || null,
                host_unit_id === null ? null : Number(host_unit_id),
                mentor?.trim() || null,
                planned_activities?.trim() || null,
                invitation_status?.trim() || null,
                funding_source?.trim() || null,
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
        const errors = validatePlannedResearcher(
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
            reporting_period_id,
            researcher_name,
            academic_title = null,
            home_institution = null,
            country_id = null,
            scientific_field = null,
            planned_period = null,
            duration = null,
            host_unit_id = null,
            mentor = null,
            planned_activities = null,
            invitation_status = null,
            funding_source = null,
            notes = null,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE planned_visiting_researchers
                    SET
                        reporting_period_id = $1,
                        researcher_name = $2,
                        academic_title = $3,
                        home_institution = $4,
                        country_id = $5,
                        scientific_field = $6,
                        planned_period = $7,
                        duration = $8,
                        host_unit_id = $9,
                        mentor = $10,
                        planned_activities = $11,
                        invitation_status = $12,
                        funding_source = $13,
                        notes = $14,
                        updated_by = $15,
                        updated_at = NOW()
                    WHERE id = $16
                    RETURNING *
                `,
                [
                    Number(reporting_period_id),
                    researcher_name.trim(),
                    academic_title?.trim() || null,
                    home_institution?.trim() || null,
                    country_id === null ? null : Number(country_id),
                    scientific_field?.trim() || null,
                    planned_period?.trim() || null,
                    duration?.trim() || null,
                    host_unit_id === null ? null : Number(host_unit_id),
                    mentor?.trim() || null,
                    planned_activities?.trim() || null,
                    invitation_status?.trim() || null,
                    funding_source?.trim() || null,
                    notes?.trim() || null,
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Planirano gostovanje nije pronađeno."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.patch("/planned/:id", validateId, async (req, res, next) => {
        const allowedFields = [
            "reporting_period_id",
            "researcher_name",
            "academic_title",
            "home_institution",
            "country_id",
            "scientific_field",
            "planned_period",
            "duration",
            "host_unit_id",
            "mentor",
            "planned_activities",
            "invitation_status",
            "funding_source",
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

        const errors = validatePlannedResearcher(
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
                "planned_visiting_researchers",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Planirano gostovanje nije pronađeno."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.delete("/planned/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE FROM planned_visiting_researchers
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Planirano gostovanje nije pronađeno."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.get("/unit-analyses", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                vra.*,
                ou.name AS organizational_unit_name,
                rp.label AS reporting_period_label
            FROM visiting_researcher_unit_analyses vra
            JOIN reporting_periods rp
                ON rp.id = vra.reporting_period_id
            JOIN organizational_units ou
                ON ou.id = vra.organizational_unit_id
            ORDER BY
                rp.start_date DESC,
                ou.name
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/unit-analyses/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    SELECT
                        vra.*,
                        ou.name AS organizational_unit_name,
                        rp.label AS reporting_period_label
                    FROM visiting_researcher_unit_analyses vra
                    JOIN reporting_periods rp
                        ON rp.id = vra.reporting_period_id
                    JOIN organizational_units ou
                        ON ou.id = vra.organizational_unit_id
                    WHERE vra.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Analiza gostovanja nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post("/unit-analyses", async (req, res, next) => {
    const errors = validateUnitAnalysis(
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
        reporting_period_id,
        organizational_unit_id,
        visit_count = 0,
        total_days = 0,
        lecture_count = 0,
        publication_count = 0,
        project_count = 0,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO visiting_researcher_unit_analyses (
                    reporting_period_id,
                    organizational_unit_id,
                    visit_count,
                    total_days,
                    lecture_count,
                    publication_count,
                    project_count,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9
                )
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                Number(organizational_unit_id),
                Number(visit_count),
                Number(total_days),
                Number(lecture_count),
                Number(publication_count),
                Number(project_count),
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/unit-analyses/:id", validateId, async (req, res, next) => {
        const errors = validateUnitAnalysis(
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
            reporting_period_id,
            organizational_unit_id,
            visit_count = 0,
            total_days = 0,
            lecture_count = 0,
            publication_count = 0,
            project_count = 0,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE visiting_researcher_unit_analyses
                    SET
                        reporting_period_id = $1,
                        organizational_unit_id = $2,
                        visit_count = $3,
                        total_days = $4,
                        lecture_count = $5,
                        publication_count = $6,
                        project_count = $7,
                        updated_by = $8,
                        updated_at = NOW()
                    WHERE id = $9
                    RETURNING *
                `,
                [
                    Number(reporting_period_id),
                    Number(organizational_unit_id),
                    Number(visit_count),
                    Number(total_days),
                    Number(lecture_count),
                    Number(publication_count),
                    Number(project_count),
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Analiza gostovanja nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.patch("/unit-analyses/:id", validateId, async (req, res, next) => {
        const allowedFields = [
            "reporting_period_id",
            "organizational_unit_id",
            "visit_count",
            "total_days",
            "lecture_count",
            "publication_count",
            "project_count",
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

        const errors = validateUnitAnalysis(
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
                "visiting_researcher_unit_analyses",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Analiza gostovanja nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.delete("/unit-analyses/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE
                    FROM visiting_researcher_unit_analyses
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Analiza gostovanja nije pronađena."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

export default router;