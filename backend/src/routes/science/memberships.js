import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const organizationKinds = [
    "SCIENTIFIC",
    "PROFESSIONAL",
    "ARTISTIC"
];

const organizationLevels = [
    "INTERNATIONAL",
    "NATIONAL",
    "REGIONAL"
];

function isPositiveInteger(value) {
    const number = Number(value);

    return Number.isInteger(number) && number > 0;
}

function isValidDate(value) {
    return (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value))
    );
}

function validateNullableId(body, field, label, errors) {
    if (body[field] !== undefined && body[field] !== null) {
        if (!isPositiveInteger(body[field])) {
            errors.push(
                `${label} mora biti pozitivan cijeli broj ili null.`
            );
        }
    }
}

function validateRequiredId(
    body,
    field,
    label,
    errors,
    partial = false
) {
    if (!partial || body[field] !== undefined) {
        if (!isPositiveInteger(body[field])) {
            errors.push(
                `${label} mora biti pozitivan cijeli broj.`
            );
        }
    }
}

function validateOptionalText(
    body,
    field,
    label,
    maxLength,
    errors
) {
    if (body[field] !== undefined && body[field] !== null) {
        if (typeof body[field] !== "string") {
            errors.push(`${label} mora biti tekst.`);
        } else if (body[field].trim().length > maxLength) {
            errors.push(
                `${label} smije imati najviše ${maxLength} znakova.`
            );
        }
    }
}

function validateNewMembership(body, partial = false) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    validateRequiredId(
        body,
        "reporting_period_id",
        "ID izvještajnog razdoblja",
        errors,
        partial
    );

    validateNullableId(
        body,
        "organization_id",
        "ID organizacije",
        errors
    );

    if (!partial || body.organization_name !== undefined) {
        if (
            typeof body.organization_name !== "string" ||
            body.organization_name.trim() === ""
        ) {
            errors.push("Naziv organizacije je obavezan.");
        } else if (
            body.organization_name.trim().length > 200
        ) {
            errors.push(
                "Naziv organizacije smije imati najviše 200 znakova."
            );
        }
    }

    if (!partial || body.organization_kind !== undefined) {
        if (!organizationKinds.includes(body.organization_kind)) {
            errors.push(
                `Vrsta organizacije mora biti: ${organizationKinds.join(", ")}.`
            );
        }
    }

    if (!partial || body.organization_level !== undefined) {
        if (!organizationLevels.includes(body.organization_level)) {
            errors.push(
                `Razina organizacije mora biti: ${organizationLevels.join(", ")}.`
            );
        }
    }

    validateNullableId(
        body,
        "headquarters_country_id",
        "ID države sjedišta",
        errors
    );

    if (
        body.joined_on !== undefined &&
        body.joined_on !== null &&
        !isValidDate(body.joined_on)
    ) {
        errors.push(
            "Datum učlanjenja mora biti u formatu YYYY-MM-DD."
        );
    }

    validateOptionalText(
        body,
        "membership_type",
        "Vrsta članstva",
        40,
        errors
    );

    if (
        body.annual_fee_eur !== undefined &&
        body.annual_fee_eur !== null
    ) {
        const fee = Number(body.annual_fee_eur);

        if (
            !Number.isFinite(fee) ||
            fee < 0 ||
            fee > 999.99
        ) {
            errors.push(
                "Godišnja članarina mora biti između 0 i 999.99 eura."
            );
        }
    }

    validateNullableId(
        body,
        "unipu_member_id",
        "ID člana Sveučilišta",
        errors
    );

    validateNullableId(
        body,
        "organizational_unit_id",
        "ID sastavnice",
        errors
    );

    validateRequiredId(
        body,
        partial ? "updated_by" : "created_by",
        partial
            ? "ID korisnika koji uređuje zapis"
            : "ID korisnika koji stvara zapis",
        errors,
        false
    );

    if (!partial) {
        validateRequiredId(
            body,
            "updated_by",
            "ID korisnika koji uređuje zapis",
            errors
        );
    }

    return errors;
}

function validateActiveMembership(body, partial = false) {
    const errors = validateNewMembership(
        {
            ...body,
            headquarters_country_id: body.country_id,
            joined_on: undefined,
            unipu_member_id: body.unipu_representative_id
        },
        partial
    );

    if (
        body.joined_year !== undefined &&
        body.joined_year !== null
    ) {
        const year = Number(body.joined_year);
        const currentYear = new Date().getFullYear();

        if (
            !Number.isInteger(year) ||
            year < 1950 ||
            year > currentYear
        ) {
            errors.push(
                `Godina učlanjenja mora biti između 1950. i ${currentYear}.`
            );
        }
    }

    validateOptionalText(
        body,
        "membership_status",
        "Status članstva",
        20,
        errors
    );

    return errors;
}

function validateMembershipSummary(body, partial = false) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    validateRequiredId(
        body,
        "reporting_period_id",
        "ID izvještajnog razdoblja",
        errors,
        partial
    );

    if (!partial || body.category_name !== undefined) {
        if (
            typeof body.category_name !== "string" ||
            body.category_name.trim() === ""
        ) {
            errors.push("Naziv kategorije je obavezan.");
        } else if (body.category_name.trim().length > 100) {
            errors.push(
                "Naziv kategorije smije imati najviše 100 znakova."
            );
        }
    }

    const countFields = [
        "existing_memberships",
        "new_memberships",
        "total_memberships"
    ];

    for (const field of countFields) {
        if (body[field] !== undefined) {
            const value = Number(body[field]);

            if (
                !Number.isInteger(value) ||
                value < 0 ||
                value > 9999
            ) {
                errors.push(
                    `${field} mora biti cijeli broj između 0 i 9999.`
                );
            }
        }
    }

    if (
        body.share_percent !== undefined &&
        body.share_percent !== null
    ) {
        const value = Number(body.share_percent);

        if (
            !Number.isFinite(value) ||
            value < 0 ||
            value > 100
        ) {
            errors.push(
                "Postotak udjela mora biti između 0 i 100."
            );
        }
    }

    validateRequiredId(
        body,
        partial ? "updated_by" : "created_by",
        partial
            ? "ID korisnika koji uređuje zapis"
            : "ID korisnika koji stvara zapis",
        errors,
        false
    );

    if (!partial) {
        validateRequiredId(
            body,
            "updated_by",
            "ID korisnika koji uređuje zapis",
            errors
        );
    }

    return errors;
}

function normalizeValue(field, value) {
    const integerFields = [
        "reporting_period_id",
        "organization_id",
        "headquarters_country_id",
        "country_id",
        "unipu_member_id",
        "unipu_representative_id",
        "organizational_unit_id",
        "created_by",
        "updated_by",
        "existing_memberships",
        "new_memberships",
        "total_memberships",
        "joined_year"
    ];

    const numericFields = [
        "annual_fee_eur",
        "share_percent"
    ];

    if (value === null) {
        return null;
    }

    if (integerFields.includes(field)) {
        return Number(value);
    }

    if (numericFields.includes(field)) {
        return Number(value);
    }

    if (typeof value === "string") {
        return value.trim() || null;
    }

    return value;
}

async function patchRecord({
    table,
    allowedFields,
    body,
    id
}) {
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

function handleDatabaseError(error, next, res) {
    if (error.code === "23503") {
        return res.status(400).json({
            message:
                "Jedan od navedenih povezanih zapisa ne postoji."
        });
    }

    if (error.code === "23505") {
        return res.status(409).json({
            message: "Zapis s tim podacima već postoji."
        });
    }

    if (error.code === "23514") {
        return res.status(400).json({
            message: "Podaci krše pravila baze podataka."
        });
    }

    next(error);
}

// NOVA ČLANSTVA

// GET /api/memberships/new
router.get("/new", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM new_memberships
            ORDER BY created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET /api/memberships/new/:id
router.get("/new/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM new_memberships
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Novo članstvo nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST /api/memberships/new
router.post("/new", async (req, res, next) => {
    const errors = validateNewMembership(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        organization_id = null,
        organization_name,
        organization_kind,
        organization_level,
        headquarters_country_id = null,
        joined_on = null,
        membership_type = null,
        annual_fee_eur = null,
        unipu_member_id = null,
        organizational_unit_id = null,
        membership_benefits = null,
        evidence_link = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO new_memberships (
                    reporting_period_id,
                    organization_id,
                    organization_name,
                    organization_kind,
                    organization_level,
                    headquarters_country_id,
                    joined_on,
                    membership_type,
                    annual_fee_eur,
                    unipu_member_id,
                    organizational_unit_id,
                    membership_benefits,
                    evidence_link,
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
                organization_id === null
                    ? null
                    : Number(organization_id),
                organization_name.trim(),
                organization_kind,
                organization_level,
                headquarters_country_id === null
                    ? null
                    : Number(headquarters_country_id),
                joined_on,
                membership_type?.trim() || null,
                annual_fee_eur === null
                    ? null
                    : Number(annual_fee_eur),
                unipu_member_id === null
                    ? null
                    : Number(unipu_member_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                membership_benefits?.trim() || null,
                evidence_link?.trim() || null,
                notes?.trim() || null,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

// PUT /api/memberships/new/:id
router.put("/new/:id", validateId, async (req, res, next) => {
    const errors = validateNewMembership(req.body, true);

    const requiredFields = [
        "reporting_period_id",
        "organization_name",
        "organization_kind",
        "organization_level",
        "updated_by"
    ];

    for (const field of requiredFields) {
        if (req.body[field] === undefined) {
            errors.push(`Polje ${field} je obavezno.`);
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        organization_id = null,
        organization_name,
        organization_kind,
        organization_level,
        headquarters_country_id = null,
        joined_on = null,
        membership_type = null,
        annual_fee_eur = null,
        unipu_member_id = null,
        organizational_unit_id = null,
        membership_benefits = null,
        evidence_link = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE new_memberships
                SET
                    reporting_period_id = $1,
                    organization_id = $2,
                    organization_name = $3,
                    organization_kind = $4,
                    organization_level = $5,
                    headquarters_country_id = $6,
                    joined_on = $7,
                    membership_type = $8,
                    annual_fee_eur = $9,
                    unipu_member_id = $10,
                    organizational_unit_id = $11,
                    membership_benefits = $12,
                    evidence_link = $13,
                    notes = $14,
                    updated_by = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                organization_id === null
                    ? null
                    : Number(organization_id),
                organization_name.trim(),
                organization_kind,
                organization_level,
                headquarters_country_id === null
                    ? null
                    : Number(headquarters_country_id),
                joined_on,
                membership_type?.trim() || null,
                annual_fee_eur === null
                    ? null
                    : Number(annual_fee_eur),
                unipu_member_id === null
                    ? null
                    : Number(unipu_member_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                membership_benefits?.trim() || null,
                evidence_link?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Novo članstvo nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

// PATCH /api/memberships/new/:id
router.patch("/new/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "organization_id",
        "organization_name",
        "organization_kind",
        "organization_level",
        "headquarters_country_id",
        "joined_on",
        "membership_type",
        "annual_fee_eur",
        "unipu_member_id",
        "organizational_unit_id",
        "membership_benefits",
        "evidence_link",
        "notes",
        "updated_by"
    ];

    const fields = Object.keys(req.body ?? {});

    if (fields.length === 0) {
        return res.status(400).json({
            message: "Niste poslali nijedno polje za izmjenu."
        });
    }

    const invalidFields = fields.filter(
        field => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
        return res.status(400).json({
            message: `Nedopuštena polja: ${invalidFields.join(", ")}`
        });
    }

    const errors = validateNewMembership(req.body, true);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord({
            table: "new_memberships",
            allowedFields,
            body: req.body,
            id: req.resourceId
        });

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Novo članstvo nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

// DELETE /api/memberships/new/:id
router.delete("/new/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM new_memberships
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Novo članstvo nije pronađeno."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

// AKTIVNA ČLANSTVA

router.get("/active", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM active_memberships
            ORDER BY created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/active/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM active_memberships
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Aktivno članstvo nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/active", async (req, res, next) => {
    const errors = validateActiveMembership(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        organization_id = null,
        organization_name,
        organization_kind,
        organization_level,
        country_id = null,
        joined_year = null,
        membership_type = null,
        annual_fee_eur = null,
        unipu_representative_id = null,
        organizational_unit_id = null,
        organization_activities = null,
        membership_status = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO active_memberships (
                    reporting_period_id,
                    organization_id,
                    organization_name,
                    organization_kind,
                    organization_level,
                    country_id,
                    joined_year,
                    membership_type,
                    annual_fee_eur,
                    unipu_representative_id,
                    organizational_unit_id,
                    organization_activities,
                    membership_status,
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
                organization_id === null
                    ? null
                    : Number(organization_id),
                organization_name.trim(),
                organization_kind,
                organization_level,
                country_id === null ? null : Number(country_id),
                joined_year === null ? null : Number(joined_year),
                membership_type?.trim() || null,
                annual_fee_eur === null
                    ? null
                    : Number(annual_fee_eur),
                unipu_representative_id === null
                    ? null
                    : Number(unipu_representative_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                organization_activities?.trim() || null,
                membership_status?.trim() || null,
                notes?.trim() || null,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

router.put("/active/:id", validateId, async (req, res, next) => {
    const requiredFields = [
        "reporting_period_id",
        "organization_name",
        "organization_kind",
        "organization_level",
        "updated_by"
    ];

    const errors = validateActiveMembership(req.body, true);

    for (const field of requiredFields) {
        if (req.body[field] === undefined) {
            errors.push(`Polje ${field} je obavezno.`);
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        organization_id = null,
        organization_name,
        organization_kind,
        organization_level,
        country_id = null,
        joined_year = null,
        membership_type = null,
        annual_fee_eur = null,
        unipu_representative_id = null,
        organizational_unit_id = null,
        organization_activities = null,
        membership_status = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE active_memberships
                SET
                    reporting_period_id = $1,
                    organization_id = $2,
                    organization_name = $3,
                    organization_kind = $4,
                    organization_level = $5,
                    country_id = $6,
                    joined_year = $7,
                    membership_type = $8,
                    annual_fee_eur = $9,
                    unipu_representative_id = $10,
                    organizational_unit_id = $11,
                    organization_activities = $12,
                    membership_status = $13,
                    notes = $14,
                    updated_by = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                organization_id === null
                    ? null
                    : Number(organization_id),
                organization_name.trim(),
                organization_kind,
                organization_level,
                country_id === null ? null : Number(country_id),
                joined_year === null ? null : Number(joined_year),
                membership_type?.trim() || null,
                annual_fee_eur === null
                    ? null
                    : Number(annual_fee_eur),
                unipu_representative_id === null
                    ? null
                    : Number(unipu_representative_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                organization_activities?.trim() || null,
                membership_status?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Aktivno članstvo nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

router.patch("/active/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "reporting_period_id",
        "organization_id",
        "organization_name",
        "organization_kind",
        "organization_level",
        "country_id",
        "joined_year",
        "membership_type",
        "annual_fee_eur",
        "unipu_representative_id",
        "organizational_unit_id",
        "organization_activities",
        "membership_status",
        "notes",
        "updated_by"
    ];

    const fields = Object.keys(req.body ?? {});

    if (fields.length === 0) {
        return res.status(400).json({
            message: "Niste poslali nijedno polje za izmjenu."
        });
    }

    const invalidFields = fields.filter(
        field => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
        return res.status(400).json({
            message: `Nedopuštena polja: ${invalidFields.join(", ")}`
        });
    }

    const errors = validateActiveMembership(req.body, true);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await patchRecord({
            table: "active_memberships",
            allowedFields,
            body: req.body,
            id: req.resourceId
        });

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Aktivno članstvo nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

router.delete("/active/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM active_memberships
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Aktivno članstvo nije pronađeno."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

// SAŽECI ČLANSTAVA

router.get("/summary", async (req, res, next) => {
    try {
        const result = await pool.query(`
            WITH membership_counts AS (
                SELECT
                    reporting_period_id,
                    organization_kind,
                    organization_level,
                    COUNT(*)::int AS existing_memberships,
                    0::int AS new_memberships
                FROM active_memberships
                GROUP BY
                    reporting_period_id,
                    organization_kind,
                    organization_level

                UNION ALL

                SELECT
                    reporting_period_id,
                    organization_kind,
                    organization_level,
                    0::int AS existing_memberships,
                    COUNT(*)::int AS new_memberships
                FROM new_memberships
                GROUP BY
                    reporting_period_id,
                    organization_kind,
                    organization_level
            ),
            grouped_memberships AS (
                SELECT
                    reporting_period_id,
                    organization_kind,
                    organization_level,
                    SUM(existing_memberships)::int AS existing_memberships,
                    SUM(new_memberships)::int AS new_memberships,
                    (
                        SUM(existing_memberships) +
                        SUM(new_memberships)
                    )::int AS total_memberships
                FROM membership_counts
                GROUP BY
                    reporting_period_id,
                    organization_kind,
                    organization_level
            )
            SELECT
                reporting_period_id,
                organization_kind,
                organization_level,
                existing_memberships,
                new_memberships,
                total_memberships,
                ROUND(
                    total_memberships * 100.0 /
                    NULLIF(
                        SUM(total_memberships) OVER (
                            PARTITION BY reporting_period_id
                        ),
                        0
                    ),
                    2
                ) AS share_percent
            FROM grouped_memberships
            ORDER BY
                reporting_period_id,
                organization_kind,
                organization_level
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/summaries", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM membership_category_summaries
            ORDER BY category_name
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
                FROM membership_category_summaries
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak članstava nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/summaries", async (req, res, next) => {
    const errors = validateMembershipSummary(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        category_name,
        existing_memberships = 0,
        new_memberships = 0,
        total_memberships = 0,
        share_percent = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO membership_category_summaries (
                    reporting_period_id,
                    category_name,
                    existing_memberships,
                    new_memberships,
                    total_memberships,
                    share_percent,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                category_name.trim(),
                Number(existing_memberships),
                Number(new_memberships),
                Number(total_memberships),
                share_percent === null
                    ? null
                    : Number(share_percent),
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

router.put("/summaries/:id", validateId, async (req, res, next) => {
    const requiredFields = [
        "reporting_period_id",
        "category_name",
        "existing_memberships",
        "new_memberships",
        "total_memberships",
        "updated_by"
    ];

    const errors = validateMembershipSummary(req.body, true);

    for (const field of requiredFields) {
        if (req.body[field] === undefined) {
            errors.push(`Polje ${field} je obavezno.`);
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        category_name,
        existing_memberships,
        new_memberships,
        total_memberships,
        share_percent = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE membership_category_summaries
                SET
                    reporting_period_id = $1,
                    category_name = $2,
                    existing_memberships = $3,
                    new_memberships = $4,
                    total_memberships = $5,
                    share_percent = $6,
                    updated_by = $7,
                    updated_at = NOW()
                WHERE id = $8
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                category_name.trim(),
                Number(existing_memberships),
                Number(new_memberships),
                Number(total_memberships),
                share_percent === null
                    ? null
                    : Number(share_percent),
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Sažetak članstava nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, next, res);
    }
});

router.patch(
    "/summaries/:id",
    validateId,
    async (req, res, next) => {
        const allowedFields = [
            "reporting_period_id",
            "category_name",
            "existing_memberships",
            "new_memberships",
            "total_memberships",
            "share_percent",
            "updated_by"
        ];

        const fields = Object.keys(req.body ?? {});

        if (fields.length === 0) {
            return res.status(400).json({
                message: "Niste poslali nijedno polje za izmjenu."
            });
        }

        const invalidFields = fields.filter(
            field => !allowedFields.includes(field)
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                message:
                    `Nedopuštena polja: ${invalidFields.join(", ")}`
            });
        }

        const errors = validateMembershipSummary(
            req.body,
            true
        );

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors
            });
        }

        try {
            const result = await patchRecord({
                table: "membership_category_summaries",
                allowedFields,
                body: req.body,
                id: req.resourceId
            });

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Sažetak članstava nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, next, res);
        }
    }
);

router.delete(
    "/summaries/:id",
    validateId,
    async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE FROM membership_category_summaries
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Sažetak članstava nije pronađen."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, next, res);
        }
    }
);

export default router;
