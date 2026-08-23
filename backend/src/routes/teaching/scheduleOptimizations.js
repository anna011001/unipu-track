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
    if (body[field] === undefined || body[field] === null) {
        return;
    }

    if (typeof body[field] !== "string") {
        errors.push(`${label} mora biti tekst.`);
        return;
    }

    if (maxLength !== null && body[field].trim().length > maxLength
    ) {
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
        errors.push(`${label} mora biti cijeli broj između ${min} i ${max}.`);
    }
}

function validateOptionalNumber(body, field, label, min, max, errors) {
    if (body[field] === undefined || body[field] === null) return;

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
        return [`Nedopuštena polja: ${invalidFields.join(", ")}`];
    }

    return [];
}

function normalizeValue(field, value) {
    const integerFields = [
        "reporting_period_id",
        "organizational_unit_id",
        "report_id",
        "staff_member_id",
        "teaching_norm",
        "current_load",
        "planned_reduction",
        "proposed_load",
        "research_time",
        "teachers_over_norm_count",
        "teachers_in_reelection_count",
        "courses_for_redistribution_count",
        "replacement_holders_needed",
        "redistribution_hours",
        "estimated_research_time_hours",
        "created_by",
        "updated_by"
    ];

    const numberFields = [
        "overload_percent"
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

function validateOptimizationReport(body, mode = "create") {
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

    validateRequiredId(
        body,
        "organizational_unit_id",
        "ID sastavnice",
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "academic_year",
        "Akademska godina",
        11,
        errors,
        !partial
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateOverloadCase(body, mode = "create") {
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

    const integerFields = [
        ["teaching_norm", "Nastavna norma", 0, 9999],
        ["current_load", "Trenutno opterećenje", 0, 9999],
        ["planned_reduction", "Planirano smanjenje", 0, 9999]
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

    validateOptionalNumber(
        body,
        "overload_percent",
        "Postotak prekoračenja",
        0,
        999.99,
        errors
    );

    const textFields = [
        ["courses_to_reassign", "Kolegiji za preraspodjelu", null],
        ["relief_proposal", "Prijedlog rasterećenja", null],
        ["proposed_course_holder", "Predloženi nositelj kolegija", 120],
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

    validateAuditFields(body, mode, errors);

    return errors;
}

function validatePromotionCase(body, mode = "create") {
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

    const textFields = [
        ["current_title", "Trenutno zvanje", 30],
        ["candidate_title", "Zvanje za koje je nastavnik kandidat", 30],
        ["courses_to_reassign", "Kolegiji za preraspodjelu", null],
        ["replacement_course_holder", "Zamjenski nositelj kolegija", 120],
        ["procedure_status", "Status postupka", 40],
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

    validateOptionalDate(
        body,
        "election_deadline",
        "Rok izbora",
        errors
    );

    const integerFields = [
        ["current_load", "Trenutno opterećenje", 0, 9999],
        ["proposed_load", "Predloženo opterećenje", 0, 9999],
        ["research_time", "Vrijeme za istraživanje", 0, 999999]
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

function validateOptimizationSummary(body, mode = "create") {
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

    const integerFields = [
        [
            "teachers_over_norm_count",
            "Broj nastavnika iznad norme",
            9999
        ],
        [
            "teachers_in_reelection_count",
            "Broj nastavnika u reizboru",
            9999
        ],
        [
            "courses_for_redistribution_count",
            "Broj kolegija za preraspodjelu",
            9999
        ],
        [
            "replacement_holders_needed",
            "Broj potrebnih zamjenskih nositelja",
            9999
        ],
        [
            "redistribution_hours",
            "Broj sati za preraspodjelu",
            999999
        ],
        [
            "estimated_research_time_hours",
            "Procijenjeni broj sati za istraživanje",
            999999
        ]
    ];

    for (const [field, label, max] of integerFields) {
        validateOptionalInteger(
            body,
            field,
            label,
            0,
            max,
            errors
        );
    }

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/reports", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                sor.*,
                rp.label AS reporting_period_label,
                ou.name AS organizational_unit_name
            FROM schedule_optimization_reports sor
            JOIN reporting_periods rp
                ON rp.id = sor.reporting_period_id
            LEFT JOIN organizational_units ou
                ON ou.id = sor.organizational_unit_id
            ORDER BY
                rp.start_date DESC,
                sor.created_at DESC
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
                    sor.*,
                    rp.label AS reporting_period_label,
                    ou.name AS organizational_unit_name
                FROM schedule_optimization_reports sor
                JOIN reporting_periods rp
                    ON rp.id = sor.reporting_period_id
                LEFT JOIN organizational_units ou
                    ON ou.id = sor.organizational_unit_id
                WHERE sor.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Izvješće o optimizaciji rasporeda nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/reports", async (req, res, next) => {
    const errors = validateOptimizationReport(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        organizational_unit_id,
        academic_year,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO schedule_optimization_reports (
                    reporting_period_id,
                    organizational_unit_id,
                    academic_year,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                Number(organizational_unit_id),
                academic_year.trim(),
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
    const errors = validateOptimizationReport(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        organizational_unit_id,
        academic_year,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE schedule_optimization_reports
                SET
                    reporting_period_id = $1,
                    organizational_unit_id = $2,
                    academic_year = $3,
                    updated_by = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                Number(organizational_unit_id),
                academic_year.trim(),
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Izvješće o optimizaciji rasporeda nije pronađeno."
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
        "organizational_unit_id",
        "academic_year",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(req.body, allowedFields);

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateOptimizationReport(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "schedule_optimization_reports",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Izvješće o optimizaciji rasporeda nije pronađeno."
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
                DELETE FROM schedule_optimization_reports
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Izvješće o optimizaciji rasporeda nije pronađeno."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/overload-cases", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM schedule_overload_cases
            ORDER BY created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/overload-cases/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM schedule_overload_cases
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Slučaj prekoračenja norme nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/overload-cases", async (req, res, next) => {
    const errors = validateOverloadCase(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        staff_member_id,
        teaching_norm = null,
        current_load = null,
        overload_percent = null,
        courses_to_reassign = null,
        relief_proposal = null,
        proposed_course_holder = null,
        planned_reduction = null,
        status = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO schedule_overload_cases (
                    report_id,
                    staff_member_id,
                    teaching_norm,
                    current_load,
                    overload_percent,
                    courses_to_reassign,
                    relief_proposal,
                    proposed_course_holder,
                    planned_reduction,
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
                teaching_norm === null ? null : Number(teaching_norm),
                current_load === null ? null : Number(current_load),
                overload_percent === null ? null : Number(overload_percent),
                courses_to_reassign?.trim() || null,
                relief_proposal?.trim() || null,
                proposed_course_holder?.trim() || null,
                planned_reduction === null
                    ? null
                    : Number(planned_reduction),
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

router.put("/overload-cases/:id", validateId, async (req, res, next) => {
    const errors = validateOverloadCase(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        staff_member_id,
        teaching_norm = null,
        current_load = null,
        overload_percent = null,
        courses_to_reassign = null,
        relief_proposal = null,
        proposed_course_holder = null,
        planned_reduction = null,
        status = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE schedule_overload_cases
                SET
                    report_id = $1,
                    staff_member_id = $2,
                    teaching_norm = $3,
                    current_load = $4,
                    overload_percent = $5,
                    courses_to_reassign = $6,
                    relief_proposal = $7,
                    proposed_course_holder = $8,
                    planned_reduction = $9,
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
                teaching_norm === null ? null : Number(teaching_norm),
                current_load === null ? null : Number(current_load),
                overload_percent === null ? null : Number(overload_percent),
                courses_to_reassign?.trim() || null,
                relief_proposal?.trim() || null,
                proposed_course_holder?.trim() || null,
                planned_reduction === null ? null : Number(planned_reduction),
                status?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Slučaj prekoračenja norme nije pronađen."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/overload-cases/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "report_id",
        "staff_member_id",
        "teaching_norm",
        "current_load",
        "overload_percent",
        "courses_to_reassign",
        "relief_proposal",
        "proposed_course_holder",
        "planned_reduction",
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

    const errors = validateOverloadCase(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "schedule_overload_cases",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Slučaj prekoračenja norme nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/overload-cases/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM schedule_overload_cases
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Slučaj prekoračenja norme nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/promotion-cases", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM academic_promotion_cases
            ORDER BY election_deadline ASC NULLS LAST, created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/promotion-cases/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM academic_promotion_cases
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Slučaj izbora ili reizbora nije pronađen."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/promotion-cases", async (req, res, next) => {
    const errors = validatePromotionCase(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        staff_member_id,
        current_title = null,
        candidate_title = null,
        election_deadline = null,
        current_load = null,
        proposed_load = null,
        courses_to_reassign = null,
        replacement_course_holder = null,
        research_time = null,
        procedure_status = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO academic_promotion_cases (
                    report_id,
                    staff_member_id,
                    current_title,
                    candidate_title,
                    election_deadline,
                    current_load,
                    proposed_load,
                    courses_to_reassign,
                    replacement_course_holder,
                    research_time,
                    procedure_status,
                    notes,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13, $14
                )
                RETURNING *
            `,
            [
                Number(report_id),
                Number(staff_member_id),
                current_title?.trim() || null,
                candidate_title?.trim() || null,
                election_deadline,
                current_load === null ? null : Number(current_load),
                proposed_load === null ? null : Number(proposed_load),
                courses_to_reassign?.trim() || null,
                replacement_course_holder?.trim() || null,
                research_time === null ? null : Number(research_time),
                procedure_status?.trim() || null,
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

router.put("/promotion-cases/:id", validateId, async (req, res, next) => {
    const errors = validatePromotionCase(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        staff_member_id,
        current_title = null,
        candidate_title = null,
        election_deadline = null,
        current_load = null,
        proposed_load = null,
        courses_to_reassign = null,
        replacement_course_holder = null,
        research_time = null,
        procedure_status = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE academic_promotion_cases
                SET
                    report_id = $1,
                    staff_member_id = $2,
                    current_title = $3,
                    candidate_title = $4,
                    election_deadline = $5,
                    current_load = $6,
                    proposed_load = $7,
                    courses_to_reassign = $8,
                    replacement_course_holder = $9,
                    research_time = $10,
                    procedure_status = $11,
                    notes = $12,
                    updated_by = $13,
                    updated_at = NOW()
                WHERE id = $14
                RETURNING *
            `,
            [
                Number(report_id),
                Number(staff_member_id),
                current_title?.trim() || null,
                candidate_title?.trim() || null,
                election_deadline,
                current_load === null ? null : Number(current_load),
                proposed_load === null ? null : Number(proposed_load),
                courses_to_reassign?.trim() || null,
                replacement_course_holder?.trim() || null,
                research_time === null ? null : Number(research_time),
                procedure_status?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Slučaj izbora ili reizbora nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/promotion-cases/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "report_id",
        "staff_member_id",
        "current_title",
        "candidate_title",
        "election_deadline",
        "current_load",
        "proposed_load",
        "courses_to_reassign",
        "replacement_course_holder",
        "research_time",
        "procedure_status",
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

    const errors = validatePromotionCase(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "academic_promotion_cases",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Slučaj izbora ili reizbora nije pronađen."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/promotion-cases/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM academic_promotion_cases
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Slučaj izbora ili reizbora nije pronađen."
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
            FROM schedule_optimization_summaries
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
                FROM schedule_optimization_summaries
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak optimizacije nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/summaries", async (req, res, next) => {
    const errors = validateOptimizationSummary(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        teachers_over_norm_count = 0,
        teachers_in_reelection_count = 0,
        courses_for_redistribution_count = 0,
        replacement_holders_needed = 0,
        redistribution_hours = 0,
        estimated_research_time_hours = 0,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO schedule_optimization_summaries (
                    report_id,
                    teachers_over_norm_count,
                    teachers_in_reelection_count,
                    courses_for_redistribution_count,
                    replacement_holders_needed,
                    redistribution_hours,
                    estimated_research_time_hours,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `,
            [
                Number(report_id),
                Number(teachers_over_norm_count),
                Number(teachers_in_reelection_count),
                Number(courses_for_redistribution_count),
                Number(replacement_holders_needed),
                Number(redistribution_hours),
                Number(estimated_research_time_hours),
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
    const errors = validateOptimizationSummary(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        report_id,
        teachers_over_norm_count = 0,
        teachers_in_reelection_count = 0,
        courses_for_redistribution_count = 0,
        replacement_holders_needed = 0,
        redistribution_hours = 0,
        estimated_research_time_hours = 0,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE schedule_optimization_summaries
                SET
                    report_id = $1,
                    teachers_over_norm_count = $2,
                    teachers_in_reelection_count = $3,
                    courses_for_redistribution_count = $4,
                    replacement_holders_needed = $5,
                    redistribution_hours = $6,
                    estimated_research_time_hours = $7,
                    updated_by = $8,
                    updated_at = NOW()
                WHERE id = $9
                RETURNING *
            `,
            [
                Number(report_id),
                Number(teachers_over_norm_count),
                Number(teachers_in_reelection_count),
                Number(courses_for_redistribution_count),
                Number(replacement_holders_needed),
                Number(redistribution_hours),
                Number(estimated_research_time_hours),
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak optimizacije nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/summaries/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "report_id",
        "teachers_over_norm_count",
        "teachers_in_reelection_count",
        "courses_for_redistribution_count",
        "replacement_holders_needed",
        "redistribution_hours",
        "estimated_research_time_hours",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(req.body, allowedFields);

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateOptimizationSummary(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "schedule_optimization_summaries",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak optimizacije nije pronađen."
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
                DELETE FROM schedule_optimization_summaries
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak optimizacije nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
