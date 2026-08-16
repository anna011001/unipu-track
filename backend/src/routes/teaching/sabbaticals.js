import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const allowedQuartiles = ["Q1", "Q2"];

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

function validateOptionalInteger(body, field, label, min, max, errors) {
    if (body[field] === undefined || body[field] === null) return;

    if (!isIntegerInRange(body[field], min, max)) {
        errors.push(
            `${label} mora biti cijeli broj između ${min} i ${max}.`
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
        "report_id",
        "staff_member_id",
        "organizational_unit_id",
        "q1_paper_count",
        "q2_paper_count",
        "other_paper_count",
        "monograph_count",
        "total_paper_count",
        "publication_year",
        "page_count",
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

function validateReport(body, mode = "create") {
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

    validateOptionalText(
        body,
        "monitoring_period",
        "Razdoblje praćenja",
        100,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateSabbaticalUser(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateRequiredId(
        body,
        "report_id",
        "ID izvješća",
        errors,
        !partial
    );

    validateRequiredId(
        body,
        "staff_member_id",
        "ID nastavnika",
        errors,
        !partial
    );

    validateNullableId(
        body,
        "organizational_unit_id",
        "ID sastavnice",
        errors
    );

    const textFields = [
        ["usage_period", "Razdoblje korištenja", 100],
        ["status", "Status", 40],
        ["notes", "Napomene", null]
    ];

    for (const [field, label, maxLength] of textFields) {
        validateOptionalText(
            body,
            field,
            label,
            maxLength,
            errors
        );
    }

    const integerFields = [
        ["q1_paper_count", "Broj Q1 radova", 0, 999],
        ["q2_paper_count", "Broj Q2 radova", 0, 999],
        ["other_paper_count", "Broj ostalih radova", 0, 999],
        ["monograph_count", "Broj monografija", 0, 999],
        ["total_paper_count", "Ukupan broj radova", 0, 999]
    ];

    for (const [field, label, min, max] of integerFields) {
        validateOptionalInteger(
            body,
            field,
            label,
            min,
            max,
            errors
        );
    }

    validateAuditFields(body, mode, errors);

    return errors;
}

function validatePaper(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateRequiredId(
        body,
        "report_id",
        "ID izvješća",
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "authors",
        "Autori",
        null,
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "paper_title",
        "Naslov rada",
        null,
        errors,
        !partial
    );

    const textFields = [
        ["journal", "Časopis", 200],
        ["doi_or_link", "DOI ili poveznica", null],
        ["notes", "Napomene", null]
    ];

    for (const [field, label, maxLength] of textFields) {
        validateOptionalText(
            body,
            field,
            label,
            maxLength,
            errors
        );
    }

    if (
        body.quartile !== undefined &&
        body.quartile !== null &&
        !allowedQuartiles.includes(body.quartile)
    ) {
        errors.push("Kvartil mora biti Q1 ili Q2.");
    }

    if (
        body.publication_year !== undefined &&
        body.publication_year !== null
    ) {
        const maxYear = new Date().getFullYear() + 1;

        validateOptionalInteger(
            body,
            "publication_year",
            "Godina objave",
            2000,
            maxYear,
            errors
        );
    }

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateMonograph(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateRequiredId(
        body,
        "report_id",
        "ID izvješća",
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "authors",
        "Autori",
        null,
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "monograph_title",
        "Naslov monografije",
        null,
        errors,
        !partial
    );

    const textFields = [
        ["publisher", "Izdavač", 200],
        ["isbn", "ISBN", 17],
        ["link_or_reviews", "Poveznica ili recenzije", null]
    ];

    for (const [field, label, maxLength] of textFields) {
        validateOptionalText(
            body,
            field,
            label,
            maxLength,
            errors
        );
    }

    if (
        body.publication_year !== undefined &&
        body.publication_year !== null
    ) {
        const maxYear = new Date().getFullYear() + 1;

        validateOptionalInteger(
            body,
            "publication_year",
            "Godina objave",
            2000,
            maxYear,
            errors
        );
    }

    validateOptionalInteger(
        body,
        "page_count",
        "Broj stranica",
        1,
        9999,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/reports", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                sr.*,
                rp.label AS reporting_period_label
            FROM sabbatical_reports sr
            JOIN reporting_periods rp
                ON rp.id = sr.reporting_period_id
            ORDER BY rp.start_date DESC, sr.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/reports/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    sr.*,
                    rp.label AS reporting_period_label
                FROM sabbatical_reports sr
                JOIN reporting_periods rp
                    ON rp.id = sr.reporting_period_id
                WHERE sr.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Izvješće o slobodnoj studijskoj godini nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/reports", async (req, res, next) => {
    const errors = validateReport(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        monitoring_period = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO sabbatical_reports (
                    reporting_period_id,
                    monitoring_period,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                monitoring_period?.trim() || null,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/reports/:id", validateId, async (req, res, next) => {
    const errors = validateReport(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        monitoring_period = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE sabbatical_reports
                SET
                    reporting_period_id = $1,
                    monitoring_period = $2,
                    updated_by = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                monitoring_period?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Izvješće o slobodnoj studijskoj godini nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/reports/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "monitoring_period",
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

    const errors = validateReport(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "sabbatical_reports",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Izvješće o slobodnoj studijskoj godini nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/reports/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM sabbatical_reports
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Izvješće o slobodnoj studijskoj godini nije pronađeno."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/users", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                su.*,
                ou.name AS organizational_unit_name
            FROM sabbatical_users su
            LEFT JOIN organizational_units ou
                ON ou.id = su.organizational_unit_id
            ORDER BY su.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/users/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    su.*,
                    ou.name AS organizational_unit_name
                FROM sabbatical_users su
                LEFT JOIN organizational_units ou
                    ON ou.id = su.organizational_unit_id
                WHERE su.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Korisnik slobodne studijske godine nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/users", async (req, res, next) => {
    const errors = validateSabbaticalUser(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        staff_member_id,
        organizational_unit_id = null,
        usage_period = null,
        q1_paper_count = 0,
        q2_paper_count = 0,
        other_paper_count = 0,
        monograph_count = 0,
        total_paper_count = 0,
        status = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO sabbatical_users (
                    report_id,
                    staff_member_id,
                    organizational_unit_id,
                    usage_period,
                    q1_paper_count,
                    q2_paper_count,
                    other_paper_count,
                    monograph_count,
                    total_paper_count,
                    status,
                    notes,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13
                )
                RETURNING *
            `,
            [
                Number(report_id),
                Number(staff_member_id),
                organizational_unit_id === null ? null : Number(organizational_unit_id),
                usage_period?.trim() || null,
                Number(q1_paper_count),
                Number(q2_paper_count),
                Number(other_paper_count),
                Number(monograph_count),
                Number(total_paper_count),
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

router.put("/users/:id", validateId, async (req, res, next) => {
    const errors = validateSabbaticalUser(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        staff_member_id,
        organizational_unit_id = null,
        usage_period = null,
        q1_paper_count = 0,
        q2_paper_count = 0,
        other_paper_count = 0,
        monograph_count = 0,
        total_paper_count = 0,
        status = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE sabbatical_users
                SET
                    report_id = $1,
                    staff_member_id = $2,
                    organizational_unit_id = $3,
                    usage_period = $4,
                    q1_paper_count = $5,
                    q2_paper_count = $6,
                    other_paper_count = $7,
                    monograph_count = $8,
                    total_paper_count = $9,
                    status = $10,
                    notes = $11,
                    updated_by = $12,
                    updated_at = NOW()
                WHERE id = $13
                RETURNING *
            `,
            [
                Number(report_id),
                Number(staff_member_id),
                organizational_unit_id === null ? null : Number(organizational_unit_id),
                usage_period?.trim() || null,
                Number(q1_paper_count),
                Number(q2_paper_count),
                Number(other_paper_count),
                Number(monograph_count),
                Number(total_paper_count),
                status?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Korisnik slobodne studijske godine nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/users/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "report_id",
        "staff_member_id",
        "organizational_unit_id",
        "usage_period",
        "q1_paper_count",
        "q2_paper_count",
        "other_paper_count",
        "monograph_count",
        "total_paper_count",
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

    const errors = validateSabbaticalUser(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "sabbatical_users",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Korisnik slobodne studijske godine nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/users/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM sabbatical_users
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Korisnik slobodne studijske godine nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/papers", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM sabbatical_q1_q2_papers
            ORDER BY publication_year DESC NULLS LAST, created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/papers/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM sabbatical_q1_q2_papers
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Q1/Q2 rad nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/papers", async (req, res, next) => {
    const errors = validatePaper(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        authors,
        paper_title,
        journal = null,
        quartile = null,
        publication_year = null,
        doi_or_link = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO sabbatical_q1_q2_papers (
                    report_id,
                    authors,
                    paper_title,
                    journal,
                    quartile,
                    publication_year,
                    doi_or_link,
                    notes,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `,
            [
                Number(report_id),
                authors.trim(),
                paper_title.trim(),
                journal?.trim() || null,
                quartile,
                publication_year === null ? null : Number(publication_year),
                doi_or_link?.trim() || null,
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

router.put("/papers/:id", validateId, async (req, res, next) => {
    const errors = validatePaper(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        authors,
        paper_title,
        journal = null,
        quartile = null,
        publication_year = null,
        doi_or_link = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE sabbatical_q1_q2_papers
                SET
                    report_id = $1,
                    authors = $2,
                    paper_title = $3,
                    journal = $4,
                    quartile = $5,
                    publication_year = $6,
                    doi_or_link = $7,
                    notes = $8,
                    updated_by = $9,
                    updated_at = NOW()
                WHERE id = $10
                RETURNING *
            `,
            [
                Number(report_id),
                authors.trim(),
                paper_title.trim(),
                journal?.trim() || null,
                quartile,
                publication_year === null ? null : Number(publication_year),
                doi_or_link?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Q1/Q2 rad nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/papers/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "report_id",
        "authors",
        "paper_title",
        "journal",
        "quartile",
        "publication_year",
        "doi_or_link",
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

    const errors = validatePaper(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "sabbatical_q1_q2_papers",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Q1/Q2 rad nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/papers/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM sabbatical_q1_q2_papers
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Q1/Q2 rad nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/monographs", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM sabbatical_monographs
            ORDER BY publication_year DESC NULLS LAST, created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/monographs/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM sabbatical_monographs
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Monografija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/monographs", async (req, res, next) => {
    const errors = validateMonograph(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        authors,
        monograph_title,
        publisher = null,
        publication_year = null,
        isbn = null,
        page_count = null,
        link_or_reviews = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO sabbatical_monographs (
                    report_id,
                    authors,
                    monograph_title,
                    publisher,
                    publication_year,
                    isbn,
                    page_count,
                    link_or_reviews,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `,
            [
                Number(report_id),
                authors.trim(),
                monograph_title.trim(),
                publisher?.trim() || null,
                publication_year === null ? null : Number(publication_year),
                isbn?.trim() || null,
                page_count === null ? null : Number(page_count),
                link_or_reviews?.trim() || null,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/monographs/:id", validateId, async (req, res, next) => {
    const errors = validateMonograph(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        authors,
        monograph_title,
        publisher = null,
        publication_year = null,
        isbn = null,
        page_count = null,
        link_or_reviews = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE sabbatical_monographs
                SET
                    report_id = $1,
                    authors = $2,
                    monograph_title = $3,
                    publisher = $4,
                    publication_year = $5,
                    isbn = $6,
                    page_count = $7,
                    link_or_reviews = $8,
                    updated_by = $9,
                    updated_at = NOW()
                WHERE id = $10
                RETURNING *
            `,
            [
                Number(report_id),
                authors.trim(),
                monograph_title.trim(),
                publisher?.trim() || null,
                publication_year === null ? null : Number(publication_year),
                isbn?.trim() || null,
                page_count === null ? null : Number(page_count),
                link_or_reviews?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Monografija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/monographs/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "report_id",
        "authors",
        "monograph_title",
        "publisher",
        "publication_year",
        "isbn",
        "page_count",
        "link_or_reviews",
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

    const errors = validateMonograph(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "sabbatical_monographs",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Monografija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/monographs/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM sabbatical_monographs
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Monografija nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/summary", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM v_sabbatical_summary
            ORDER BY report_id DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/summary/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM v_sabbatical_summary
                WHERE report_id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak slobodne studijske godine nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

export default router;
