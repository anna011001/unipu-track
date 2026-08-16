import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

function isPositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
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

function validateRequiredText(body, field, label, errors, required = true) {
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
    }
}

function validateOptionalText(body, field, label, errors) {
    if (body[field] === undefined || body[field] === null) {
        return;
    }

    if (typeof body[field] !== "string") {
        errors.push(`${label} mora biti tekst.`);
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

function validateActionPlan(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateNullableId(
        body,
        "reporting_period_id",
        "ID izvještajnog razdoblja",
        errors
    );

    validateRequiredId(
        body,
        "staff_member_id",
        "ID nastavnika",
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "inclusion_reasons",
        "Razlozi uključivanja",
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "observed_deficiency",
        "Uočeni nedostatak",
        errors
    );

    validateOptionalText(
        body,
        "improvement_measures",
        "Mjere poboljšanja",
        errors
    );

    validateOptionalText(
        body,
        "executed_measures_report",
        "Izvješće o provedenim mjerama",
        errors
    );

    validateOptionalText(
        body,
        "target_value",
        "Ciljana vrijednost",
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function normalizeValue(field, value) {
    const integerFields = [
        "reporting_period_id",
        "staff_member_id",
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

async function patchRecord(body, id) {
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
            UPDATE survey_action_plans
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

router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM survey_action_plans
            ORDER BY created_at DESC
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
                SELECT *
                FROM survey_action_plans
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Akcijski plan nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    const errors = validateActionPlan(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id = null,
        staff_member_id,
        inclusion_reasons,
        observed_deficiency = null,
        improvement_measures = null,
        executed_measures_report = null,
        target_value = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO survey_action_plans (
                    reporting_period_id,
                    staff_member_id,
                    inclusion_reasons,
                    observed_deficiency,
                    improvement_measures,
                    executed_measures_report,
                    target_value,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `,
            [
                reporting_period_id === null
                    ? null
                    : Number(reporting_period_id),
                Number(staff_member_id),
                inclusion_reasons.trim(),
                observed_deficiency?.trim() || null,
                improvement_measures?.trim() || null,
                executed_measures_report?.trim() || null,
                target_value?.trim() || null,
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
    const errors = validateActionPlan(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id = null,
        staff_member_id,
        inclusion_reasons,
        observed_deficiency = null,
        improvement_measures = null,
        executed_measures_report = null,
        target_value = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE survey_action_plans
                SET
                    reporting_period_id = $1,
                    staff_member_id = $2,
                    inclusion_reasons = $3,
                    observed_deficiency = $4,
                    improvement_measures = $5,
                    executed_measures_report = $6,
                    target_value = $7,
                    updated_by = $8,
                    updated_at = NOW()
                WHERE id = $9
                RETURNING *
            `,
            [
                reporting_period_id === null
                    ? null
                    : Number(reporting_period_id),
                Number(staff_member_id),
                inclusion_reasons.trim(),
                observed_deficiency?.trim() || null,
                improvement_measures?.trim() || null,
                executed_measures_report?.trim() || null,
                target_value?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Akcijski plan nije pronađen."
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
        "staff_member_id",
        "inclusion_reasons",
        "observed_deficiency",
        "improvement_measures",
        "executed_measures_report",
        "target_value",
        "updated_by"
    ];

    const fieldErrors = validateAllowedFields(req.body, allowedFields);

    if (fieldErrors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldErrors
        });
    }

    const errors = validateActionPlan(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Akcijski plan nije pronađen."
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
                DELETE FROM survey_action_plans
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Akcijski plan nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
