import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const allowedProjectTypes = [
    "DOMESTIC",
    "INTERNATIONAL"
];

const allowedApplicationStatuses = [
    "APPROVED",
    "REJECTED"
];

function isPositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
}

function isNumberInRange(value, min, max) {
    const number = Number(value);

    return (
        Number.isFinite(number) &&
        number >= min &&
        number <= max
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
        "created_by",
        "updated_by"
    ];

    const numberFields = [
        "total_project_amount_eur",
        "unipu_share_eur"
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

function validateProjectApplication(body, mode = "create") {
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
        "proposal_name",
        "Naziv projektnog prijedloga",
        250,
        errors,
        !partial
    );

    const textFields = [
        ["funding_source", "Izvor financiranja", 150],
        ["call_name", "Naziv poziva", 250],
        ["call_link", "Poveznica na poziv", null],
        ["unipu_role", "Uloga UNIPU-a", 100],
        ["involved_units", "Uključene sastavnice", null],
        ["partner_institutions", "Partnerske institucije", null],
        ["implementation_duration", "Trajanje provedbe", 100],
        ["planned_activities", "Planirane aktivnosti", null],
        ["unipu_project_team", "Projektni tim UNIPU-a", null],
        ["contract_or_partnership_reference", "Referenca ugovora ili partnerstva", 150],
        ["contract_project_code", "Šifra projekta", 80],
        ["notes", "Napomene", null]
    ];

    for (const [field, label, maxLength] of textFields) {
        validateOptionalText(body, field, label, maxLength, errors);
    }

    validateOptionalNumber(
        body,
        "total_project_amount_eur",
        "Ukupni iznos projekta",
        0,
        999999.99,
        errors
    );

    validateOptionalNumber(
        body,
        "unipu_share_eur",
        "Udio UNIPU-a",
        0,
        999999.99,
        errors
    );

    if (
        body.project_type !== undefined &&
        body.project_type !== null &&
        !allowedProjectTypes.includes(body.project_type)
    ) {
        errors.push(
            "Vrsta projekta mora biti DOMESTIC ili INTERNATIONAL."
        );
    }

    validateOptionalDate(
        body,
        "submission_deadline",
        "Rok prijave",
        errors
    );

    if (
        body.application_status !== undefined &&
        body.application_status !== null &&
        !allowedApplicationStatuses.includes(body.application_status)
    ) {
        errors.push(
            "Status prijave mora biti APPROVED ili REJECTED."
        );
    }

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM project_applications
            ORDER BY submission_deadline DESC NULLS LAST, created_at DESC
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
                FROM project_applications
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Projektna prijava nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    const errors = validateProjectApplication(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        proposal_name,
        funding_source = null,
        call_name = null,
        call_link = null,
        unipu_role = null,
        involved_units = null,
        partner_institutions = null,
        total_project_amount_eur = null,
        unipu_share_eur = null,
        implementation_duration = null,
        project_type = null,
        planned_activities = null,
        unipu_project_team = null,
        submission_deadline = null,
        application_status = null,
        contract_or_partnership_reference = null,
        contract_project_code = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO project_applications (
                    reporting_period_id,
                    proposal_name,
                    funding_source,
                    call_name,
                    call_link,
                    unipu_role,
                    involved_units,
                    partner_institutions,
                    total_project_amount_eur,
                    unipu_share_eur,
                    implementation_duration,
                    project_type,
                    planned_activities,
                    unipu_project_team,
                    submission_deadline,
                    application_status,
                    contract_or_partnership_reference,
                    contract_project_code,
                    notes,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13,
                    $14, $15, $16, $17, $18, $19,
                    $20, $21
                )
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                proposal_name.trim(),
                funding_source?.trim() || null,
                call_name?.trim() || null,
                call_link?.trim() || null,
                unipu_role?.trim() || null,
                involved_units?.trim() || null,
                partner_institutions?.trim() || null,
                total_project_amount_eur === null ? null : Number(total_project_amount_eur),
                unipu_share_eur === null ? null : Number(unipu_share_eur),
                implementation_duration?.trim() || null,
                project_type,
                planned_activities?.trim() || null,
                unipu_project_team?.trim() || null,
                submission_deadline,
                application_status,
                contract_or_partnership_reference?.trim() || null,
                contract_project_code?.trim() || null,
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
    const errors = validateProjectApplication(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        proposal_name,
        funding_source = null,
        call_name = null,
        call_link = null,
        unipu_role = null,
        involved_units = null,
        partner_institutions = null,
        total_project_amount_eur = null,
        unipu_share_eur = null,
        implementation_duration = null,
        project_type = null,
        planned_activities = null,
        unipu_project_team = null,
        submission_deadline = null,
        application_status = null,
        contract_or_partnership_reference = null,
        contract_project_code = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE project_applications
                SET
                    reporting_period_id = $1,
                    proposal_name = $2,
                    funding_source = $3,
                    call_name = $4,
                    call_link = $5,
                    unipu_role = $6,
                    involved_units = $7,
                    partner_institutions = $8,
                    total_project_amount_eur = $9,
                    unipu_share_eur = $10,
                    implementation_duration = $11,
                    project_type = $12,
                    planned_activities = $13,
                    unipu_project_team = $14,
                    submission_deadline = $15,
                    application_status = $16,
                    contract_or_partnership_reference = $17,
                    contract_project_code = $18,
                    notes = $19,
                    updated_by = $20,
                    updated_at = NOW()
                WHERE id = $21
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                proposal_name.trim(),
                funding_source?.trim() || null,
                call_name?.trim() || null,
                call_link?.trim() || null,
                unipu_role?.trim() || null,
                involved_units?.trim() || null,
                partner_institutions?.trim() || null,
                total_project_amount_eur === null ? null : Number(total_project_amount_eur),
                unipu_share_eur === null ? null : Number(unipu_share_eur),
                implementation_duration?.trim() || null,
                project_type,
                planned_activities?.trim() || null,
                unipu_project_team?.trim() || null,
                submission_deadline,
                application_status,
                contract_or_partnership_reference?.trim() || null,
                contract_project_code?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Projektna prijava nije pronađena."
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
        "proposal_name",
        "funding_source",
        "call_name",
        "call_link",
        "unipu_role",
        "involved_units",
        "partner_institutions",
        "total_project_amount_eur",
        "unipu_share_eur",
        "implementation_duration",
        "project_type",
        "planned_activities",
        "unipu_project_team",
        "submission_deadline",
        "application_status",
        "contract_or_partnership_reference",
        "contract_project_code",
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

    const errors = validateProjectApplication(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord(
            "project_applications",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Projektna prijava nije pronađena."
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
                DELETE FROM project_applications
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Projektna prijava nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
