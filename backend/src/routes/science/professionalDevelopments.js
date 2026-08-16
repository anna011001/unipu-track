import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const allowedDevelopmentTypes = [
    "STUDY_VISIT",
    "WORKSHOP",
    "CONFERENCE",
    "COURSE_CERTIFICATE",
    "SUMMER_SCHOOL"
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

function validateRequiredId(
    body,
    field,
    label,
    errors,
    partial = false
) {
    if (!partial || body[field] !== undefined) {
        if (!isPositiveInteger(body[field])) {
            errors.push(`${label} mora biti pozitivan cijeli broj.`);
        }
    }
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

function validateOptionalDate(body, field, label, errors) {
    if (
        body[field] !== undefined &&
        body[field] !== null &&
        !isValidDate(body[field])
    ) {
        errors.push(`${label} mora biti u formatu YYYY-MM-DD.`);
    }
}

function validateProfessionalDevelopment(body, partial = false) {
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

    validateRequiredId(
        body,
        "staff_member_id",
        "ID djelatnika",
        errors,
        partial
    );

    validateNullableId(
        body,
        "organizational_unit_id",
        "ID sastavnice",
        errors
    );

    if (!partial || body.development_type !== undefined) {
        if (!allowedDevelopmentTypes.includes(body.development_type)) {
            errors.push(
                `Vrsta usavršavanja mora biti: ${allowedDevelopmentTypes.join(", ")}.`
            );
        }
    }

    if (!partial || body.program_name !== undefined) {
        if (
            typeof body.program_name !== "string" ||
            body.program_name.trim() === ""
        ) {
            errors.push("Naziv programa je obavezan.");
        } else if (body.program_name.trim().length > 250) {
            errors.push(
                "Naziv programa smije imati najviše 250 znakova."
            );
        }
    }

    validateNullableId(
        body,
        "host_organization_id",
        "ID ustanove domaćina",
        errors
    );

    validateOptionalText(
        body,
        "host_organization_name",
        "Naziv ustanove domaćina",
        200,
        errors
    );

    validateNullableId(
        body,
        "country_id",
        "ID države",
        errors
    );

    validateOptionalDate(
        body,
        "start_date",
        "Početni datum",
        errors
    );

    validateOptionalDate(
        body,
        "end_date",
        "Završni datum",
        errors
    );

    if (
        body.start_date !== undefined &&
        body.start_date !== null &&
        body.end_date !== undefined &&
        body.end_date !== null &&
        isValidDate(body.start_date) &&
        isValidDate(body.end_date) &&
        new Date(body.end_date) < new Date(body.start_date)
    ) {
        errors.push(
            "Završni datum ne smije biti prije početnog datuma."
        );
    }

    if (!partial) {
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
    } else if (body.updated_by !== undefined) {
        validateRequiredId(
            body,
            "updated_by",
            "ID korisnika koji uređuje zapis",
            errors,
            true
        );
    }

    return errors;
}

function validateConfirmation(body, partial = false) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    validateNullableId(
        body,
        "professional_development_id",
        "ID stručnog usavršavanja",
        errors
    );

    if (!partial || body.institution_name !== undefined) {
        if (
            typeof body.institution_name !== "string" ||
            body.institution_name.trim() === ""
        ) {
            errors.push("Naziv ustanove je obavezan.");
        } else if (
            body.institution_name.trim().length > 200
        ) {
            errors.push(
                "Naziv ustanove smije imati najviše 200 znakova."
            );
        }
    }

    validateOptionalText(
        body,
        "signer_name",
        "Ime potpisnika",
        40,
        errors
    );

    validateOptionalText(
        body,
        "signer_function",
        "Funkcija potpisnika",
        40,
        errors
    );

    validateOptionalDate(
        body,
        "confirmation_date",
        "Datum potvrde",
        errors
    );

    if (
        body.seal_present !== undefined &&
        body.seal_present !== null &&
        typeof body.seal_present !== "boolean"
    ) {
        errors.push(
            "Polje seal_present mora biti true, false ili null."
        );
    }

    if (!partial) {
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
    } else if (body.updated_by !== undefined) {
        validateRequiredId(
            body,
            "updated_by",
            "ID korisnika koji uređuje zapis",
            errors,
            true
        );
    }

    return errors;
}

function validateMedia(body, partial = false) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    validateNullableId(
        body,
        "professional_development_id",
        "ID stručnog usavršavanja",
        errors
    );

    if (!partial || body.development_name !== undefined) {
        if (
            typeof body.development_name !== "string" ||
            body.development_name.trim() === ""
        ) {
            errors.push("Naziv usavršavanja je obavezan.");
        } else if (
            body.development_name.trim().length > 250
        ) {
            errors.push(
                "Naziv usavršavanja smije imati najviše 250 znakova."
            );
        }
    }

    validateOptionalText(
        body,
        "media_type",
        "Vrsta medija",
        80,
        errors
    );

    if (!partial || body.media_link !== undefined) {
        if (
            typeof body.media_link !== "string" ||
            body.media_link.trim() === ""
        ) {
            errors.push("Poveznica na medij je obavezna.");
        }
    }

    validateOptionalDate(
        body,
        "published_on",
        "Datum objave",
        errors
    );

    if (!partial) {
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
    } else if (body.updated_by !== undefined) {
        validateRequiredId(
            body,
            "updated_by",
            "ID korisnika koji uređuje zapis",
            errors,
            true
        );
    }

    return errors;
}

function normalizeValue(field, value) {
    const integerFields = [
        "reporting_period_id",
        "staff_member_id",
        "organizational_unit_id",
        "host_organization_id",
        "country_id",
        "professional_development_id",
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

    if (error.code === "23514") {
        return res.status(400).json({
            message: "Podaci krše pravila baze podataka."
        });
    }

    return next(error);
}

/* =========================================================
   POTVRDE
   ========================================================= */

router.get("/confirmations", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                pdc.*,
                pd.program_name
            FROM professional_development_confirmations pdc
            LEFT JOIN professional_developments pd
                ON pd.id = pdc.professional_development_id
            ORDER BY pdc.confirmation_date DESC NULLS LAST,
                     pdc.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get(
    "/confirmations/:id",
    validateId,
    async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    SELECT
                        pdc.*,
                        pd.program_name
                    FROM professional_development_confirmations pdc
                    LEFT JOIN professional_developments pd
                        ON pd.id =
                           pdc.professional_development_id
                    WHERE pdc.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Potvrda nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post("/confirmations", async (req, res, next) => {
    const errors = validateConfirmation(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        professional_development_id = null,
        institution_name,
        signer_name = null,
        signer_function = null,
        confirmation_date = null,
        seal_present = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO professional_development_confirmations (
                    professional_development_id,
                    institution_name,
                    signer_name,
                    signer_function,
                    confirmation_date,
                    seal_present,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                professional_development_id === null
                    ? null
                    : Number(professional_development_id),
                institution_name.trim(),
                signer_name?.trim() || null,
                signer_function?.trim() || null,
                confirmation_date,
                seal_present,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put(
    "/confirmations/:id",
    validateId,
    async (req, res, next) => {
        const errors = validateConfirmation(req.body, true);

        const requiredFields = [
            "institution_name",
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
            professional_development_id = null,
            institution_name,
            signer_name = null,
            signer_function = null,
            confirmation_date = null,
            seal_present = null,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE professional_development_confirmations
                    SET
                        professional_development_id = $1,
                        institution_name = $2,
                        signer_name = $3,
                        signer_function = $4,
                        confirmation_date = $5,
                        seal_present = $6,
                        updated_by = $7,
                        updated_at = NOW()
                    WHERE id = $8
                    RETURNING *
                `,
                [
                    professional_development_id === null
                        ? null
                        : Number(professional_development_id),
                    institution_name.trim(),
                    signer_name?.trim() || null,
                    signer_function?.trim() || null,
                    confirmation_date,
                    seal_present,
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Potvrda nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.patch(
    "/confirmations/:id",
    validateId,
    async (req, res, next) => {
        const allowedFields = [
            "professional_development_id",
            "institution_name",
            "signer_name",
            "signer_function",
            "confirmation_date",
            "seal_present",
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

        const errors = validateConfirmation(req.body, true);

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors
            });
        }

        try {
            const result = await patchRecord(
                "professional_development_confirmations",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Potvrda nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.delete(
    "/confirmations/:id",
    validateId,
    async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE
                    FROM professional_development_confirmations
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Potvrda nije pronađena."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

/* =========================================================
   MEDIJSKE OBJAVE
   ========================================================= */

router.get("/media", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                pdm.*,
                pd.program_name
            FROM professional_development_media pdm
            LEFT JOIN professional_developments pd
                ON pd.id = pdm.professional_development_id
            ORDER BY pdm.published_on DESC NULLS LAST,
                     pdm.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/media/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    pdm.*,
                    pd.program_name
                FROM professional_development_media pdm
                LEFT JOIN professional_developments pd
                    ON pd.id =
                       pdm.professional_development_id
                WHERE pdm.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Medijska objava nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/media", async (req, res, next) => {
    const errors = validateMedia(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        professional_development_id = null,
        development_name,
        media_type = null,
        media_link,
        published_on = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO professional_development_media (
                    professional_development_id,
                    development_name,
                    media_type,
                    media_link,
                    published_on,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `,
            [
                professional_development_id === null
                    ? null
                    : Number(professional_development_id),
                development_name.trim(),
                media_type?.trim() || null,
                media_link.trim(),
                published_on,
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/media/:id", validateId, async (req, res, next) => {
    const errors = validateMedia(req.body, true);

    const requiredFields = [
        "development_name",
        "media_link",
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
        professional_development_id = null,
        development_name,
        media_type = null,
        media_link,
        published_on = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE professional_development_media
                SET
                    professional_development_id = $1,
                    development_name = $2,
                    media_type = $3,
                    media_link = $4,
                    published_on = $5,
                    updated_by = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING *
            `,
            [
                professional_development_id === null
                    ? null
                    : Number(professional_development_id),
                development_name.trim(),
                media_type?.trim() || null,
                media_link.trim(),
                published_on,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Medijska objava nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch(
    "/media/:id",
    validateId,
    async (req, res, next) => {
        const allowedFields = [
            "professional_development_id",
            "development_name",
            "media_type",
            "media_link",
            "published_on",
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

        const errors = validateMedia(req.body, true);

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors
            });
        }

        try {
            const result = await patchRecord(
                "professional_development_media",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Medijska objava nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.delete(
    "/media/:id",
    validateId,
    async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE FROM professional_development_media
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Medijska objava nije pronađena."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

/* =========================================================
   STRUČNA USAVRŠAVANJA
   ========================================================= */

router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                pd.*,
                sm.first_name AS staff_first_name,
                sm.last_name AS staff_last_name,
                ou.name AS organizational_unit_name,
                o.name AS host_organization_database_name,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en
            FROM professional_developments pd
            JOIN staff_members sm
                ON sm.id = pd.staff_member_id
            LEFT JOIN organizational_units ou
                ON ou.id = pd.organizational_unit_id
            LEFT JOIN organizations o
                ON o.id = pd.host_organization_id
            LEFT JOIN countries c
                ON c.id = pd.country_id
            ORDER BY pd.start_date DESC NULLS LAST,
                     pd.created_at DESC
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
                    pd.*,
                    sm.first_name AS staff_first_name,
                    sm.last_name AS staff_last_name,
                    ou.name AS organizational_unit_name,
                    o.name AS host_organization_database_name,
                    c.name_hr AS country_name_hr,
                    c.name_en AS country_name_en
                FROM professional_developments pd
                JOIN staff_members sm
                    ON sm.id = pd.staff_member_id
                LEFT JOIN organizational_units ou
                    ON ou.id = pd.organizational_unit_id
                LEFT JOIN organizations o
                    ON o.id = pd.host_organization_id
                LEFT JOIN countries c
                    ON c.id = pd.country_id
                WHERE pd.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Stručno usavršavanje nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    const errors = validateProfessionalDevelopment(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        reporting_period_id,
        staff_member_id,
        organizational_unit_id = null,
        development_type,
        program_name,
        host_organization_id = null,
        host_organization_name = null,
        country_id = null,
        start_date = null,
        end_date = null,
        media_link = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO professional_developments (
                    reporting_period_id,
                    staff_member_id,
                    organizational_unit_id,
                    development_type,
                    program_name,
                    host_organization_id,
                    host_organization_name,
                    country_id,
                    start_date,
                    end_date,
                    media_link,
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
                Number(reporting_period_id),
                Number(staff_member_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                development_type,
                program_name.trim(),
                host_organization_id === null
                    ? null
                    : Number(host_organization_id),
                host_organization_name?.trim() || null,
                country_id === null
                    ? null
                    : Number(country_id),
                start_date,
                end_date,
                media_link?.trim() || null,
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
    const errors = validateProfessionalDevelopment(
        req.body,
        true
    );

    const requiredFields = [
        "reporting_period_id",
        "staff_member_id",
        "development_type",
        "program_name",
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
        staff_member_id,
        organizational_unit_id = null,
        development_type,
        program_name,
        host_organization_id = null,
        host_organization_name = null,
        country_id = null,
        start_date = null,
        end_date = null,
        media_link = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE professional_developments
                SET
                    reporting_period_id = $1,
                    staff_member_id = $2,
                    organizational_unit_id = $3,
                    development_type = $4,
                    program_name = $5,
                    host_organization_id = $6,
                    host_organization_name = $7,
                    country_id = $8,
                    start_date = $9,
                    end_date = $10,
                    media_link = $11,
                    notes = $12,
                    updated_by = $13,
                    updated_at = NOW()
                WHERE id = $14
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                Number(staff_member_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                development_type,
                program_name.trim(),
                host_organization_id === null
                    ? null
                    : Number(host_organization_id),
                host_organization_name?.trim() || null,
                country_id === null
                    ? null
                    : Number(country_id),
                start_date,
                end_date,
                media_link?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Stručno usavršavanje nije pronađeno."
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
        "organizational_unit_id",
        "development_type",
        "program_name",
        "host_organization_id",
        "host_organization_name",
        "country_id",
        "start_date",
        "end_date",
        "media_link",
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
            message:
                `Nedopuštena polja: ${invalidFields.join(", ")}`
        });
    }

    const errors = validateProfessionalDevelopment(
        req.body,
        true
    );

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    /*
     * Ako PATCH mijenja samo jedan datum, dohvaćamo postojeći
     * zapis kako bismo provjerili odnos start_date/end_date.
     */
    try {
        const currentResult = await pool.query(
            `
                SELECT start_date, end_date
                FROM professional_developments
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (currentResult.rows.length === 0) {
            return res.status(404).json({
                message: "Stručno usavršavanje nije pronađeno."
            });
        }

        const current = currentResult.rows[0];

        const finalStartDate =
            req.body.start_date !== undefined
                ? req.body.start_date
                : current.start_date;

        const finalEndDate =
            req.body.end_date !== undefined
                ? req.body.end_date
                : current.end_date;

        if (
            finalStartDate !== null &&
            finalEndDate !== null &&
            new Date(finalEndDate) < new Date(finalStartDate)
        ) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors: [
                    "Završni datum ne smije biti prije početnog datuma."
                ]
            });
        }

        const result = await patchRecord(
            "professional_developments",
            req.body,
            req.resourceId
        );

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM professional_developments
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Stručno usavršavanje nije pronađeno."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
