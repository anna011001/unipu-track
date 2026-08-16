import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const allowedParticipationTypes = [
    "ORAL_PRESENTATION",
    "POSTER_PRESENTATION",
    "PLENARY_LECTURE",
    "PANELIST",
    "ORGANIZING_COMMITTEE_MEMBER"
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

function normalizeValue(field, value) {
    const integerFields = [
        "reporting_period_id",
        "staff_member_id",
        "organizational_unit_id",
        "event_participation_id",
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

function validateAllowedFields(body, allowedFields) {
    const fields = Object.keys(body ?? {});

    if (fields.length === 0) {
        return {
            fields,
            errors: ["Niste poslali nijedno polje za izmjenu."]
        };
    }

    const invalidFields = fields.filter(
        field => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
        return {
            fields,
            errors: [
                `Nedopuštena polja: ${invalidFields.join(", ")}`
            ]
        };
    }

    return {
        fields,
        errors: []
    };
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

function validateEventParticipation(body, mode = "create") {
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
        "staff_member_id",
        "ID djelatnika",
        errors,
        !partial
    );

    validateNullableId(
        body,
        "organizational_unit_id",
        "ID sastavnice",
        errors
    );

    if (
        !partial ||
        body.participation_type !== undefined
    ) {
        if (
            !allowedParticipationTypes.includes(
                body.participation_type
            )
        ) {
            errors.push(
                `Vrsta sudjelovanja mora biti: ${allowedParticipationTypes.join(", ")}.`
            );
        }
    }

    validateRequiredText(
        body,
        "event_name",
        "Naziv skupa",
        250,
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "organizer_name",
        "Naziv organizatora",
        200,
        errors
    );

    validateOptionalText(
        body,
        "location",
        "Mjesto održavanja",
        150,
        errors
    );

    validateOptionalDate(
        body,
        "event_date",
        "Datum održavanja",
        errors
    );

    validateOptionalText(
        body,
        "presentation_title",
        "Naslov izlaganja",
        null,
        errors
    );

    validateOptionalText(
        body,
        "program_link",
        "Poveznica na program",
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

function validateConfirmation(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateNullableId(
        body,
        "event_participation_id",
        "ID sudjelovanja na skupu",
        errors
    );

    validateRequiredText(
        body,
        "event_name",
        "Naziv skupa",
        250,
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "committee_president_name",
        "Ime predsjednika odbora",
        120,
        errors
    );

    validateOptionalText(
        body,
        "organizer_institution",
        "Ustanova organizatora",
        200,
        errors
    );

    validateOptionalDate(
        body,
        "confirmation_date",
        "Datum potvrde",
        errors
    );

    validateOptionalText(
        body,
        "impressum_link",
        "Poveznica na impresum",
        null,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateMedia(body, mode = "create") {
    const errors = validateBody(body);

    if (errors.length > 0) {
        return errors;
    }

    const partial = mode === "patch";

    validateNullableId(
        body,
        "event_participation_id",
        "ID sudjelovanja na skupu",
        errors
    );

    validateRequiredText(
        body,
        "event_name",
        "Naziv skupa",
        250,
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "media_type",
        "Vrsta medija",
        80,
        errors
    );

    validateRequiredText(
        body,
        "media_link",
        "Poveznica na medij",
        null,
        errors,
        !partial
    );

    validateOptionalDate(
        body,
        "published_on",
        "Datum objave",
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/confirmations", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                eoc.*,
                ep.event_name AS participation_event_name
            FROM event_organizer_confirmations eoc
            LEFT JOIN event_participations ep
                ON ep.id = eoc.event_participation_id
            ORDER BY
                eoc.confirmation_date DESC NULLS LAST,
                eoc.created_at DESC
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
                        eoc.*,
                        ep.event_name
                            AS participation_event_name
                    FROM event_organizer_confirmations eoc
                    LEFT JOIN event_participations ep
                        ON ep.id =
                           eoc.event_participation_id
                    WHERE eoc.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Potvrda organizatora nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post("/confirmations", async (req, res, next) => {
    const errors = validateConfirmation(
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
        event_participation_id = null,
        event_name,
        committee_president_name = null,
        organizer_institution = null,
        confirmation_date = null,
        impressum_link = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO event_organizer_confirmations (
                    event_participation_id,
                    event_name,
                    committee_president_name,
                    organizer_institution,
                    confirmation_date,
                    impressum_link,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                event_participation_id === null
                    ? null
                    : Number(event_participation_id),
                event_name.trim(),
                committee_president_name?.trim() || null,
                organizer_institution?.trim() || null,
                confirmation_date,
                impressum_link?.trim() || null,
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
        const errors = validateConfirmation(
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
            event_participation_id = null,
            event_name,
            committee_president_name = null,
            organizer_institution = null,
            confirmation_date = null,
            impressum_link = null,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE event_organizer_confirmations
                    SET
                        event_participation_id = $1,
                        event_name = $2,
                        committee_president_name = $3,
                        organizer_institution = $4,
                        confirmation_date = $5,
                        impressum_link = $6,
                        updated_by = $7,
                        updated_at = NOW()
                    WHERE id = $8
                    RETURNING *
                `,
                [
                    event_participation_id === null
                        ? null
                        : Number(event_participation_id),
                    event_name.trim(),
                    committee_president_name?.trim() || null,
                    organizer_institution?.trim() || null,
                    confirmation_date,
                    impressum_link?.trim() || null,
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Potvrda organizatora nije pronađena."
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
            "event_participation_id",
            "event_name",
            "committee_president_name",
            "organizer_institution",
            "confirmation_date",
            "impressum_link",
            "updated_by"
        ];

        const fieldValidation = validateAllowedFields(
            req.body,
            allowedFields
        );

        if (fieldValidation.errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors: fieldValidation.errors
            });
        }

        const errors = validateConfirmation(
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
                "event_organizer_confirmations",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Potvrda organizatora nije pronađena."
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
                    FROM event_organizer_confirmations
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Potvrda organizatora nije pronađena."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.get("/media", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                em.*,
                ep.event_name AS participation_event_name
            FROM event_media em
            LEFT JOIN event_participations ep
                ON ep.id = em.event_participation_id
            ORDER BY
                em.published_on DESC NULLS LAST,
                em.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get(
    "/media/:id",
    validateId,
    async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    SELECT
                        em.*,
                        ep.event_name
                            AS participation_event_name
                    FROM event_media em
                    LEFT JOIN event_participations ep
                        ON ep.id =
                           em.event_participation_id
                    WHERE em.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Medijska objava nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post("/media", async (req, res, next) => {
    const errors = validateMedia(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        event_participation_id = null,
        event_name,
        media_type = null,
        media_link,
        published_on = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO event_media (
                    event_participation_id,
                    event_name,
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
                event_participation_id === null
                    ? null
                    : Number(event_participation_id),
                event_name.trim(),
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

router.put(
    "/media/:id",
    validateId,
    async (req, res, next) => {
        const errors = validateMedia(req.body, "put");

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors
            });
        }

        const {
            event_participation_id = null,
            event_name,
            media_type = null,
            media_link,
            published_on = null,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE event_media
                    SET
                        event_participation_id = $1,
                        event_name = $2,
                        media_type = $3,
                        media_link = $4,
                        published_on = $5,
                        updated_by = $6,
                        updated_at = NOW()
                    WHERE id = $7
                    RETURNING *
                `,
                [
                    event_participation_id === null
                        ? null
                        : Number(event_participation_id),
                    event_name.trim(),
                    media_type?.trim() || null,
                    media_link.trim(),
                    published_on,
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Medijska objava nije pronađena."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.patch(
    "/media/:id",
    validateId,
    async (req, res, next) => {
        const allowedFields = [
            "event_participation_id",
            "event_name",
            "media_type",
            "media_link",
            "published_on",
            "updated_by"
        ];

        const fieldValidation = validateAllowedFields(
            req.body,
            allowedFields
        );

        if (fieldValidation.errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors: fieldValidation.errors
            });
        }

        const errors = validateMedia(req.body, "patch");

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Podaci nisu ispravni.",
                errors
            });
        }

        try {
            const result = await patchRecord(
                "event_media",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Medijska objava nije pronađena."
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
                    DELETE FROM event_media
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Medijska objava nije pronađena."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                ep.*,
                sm.first_name AS staff_first_name,
                sm.last_name AS staff_last_name,
                ou.name AS organizational_unit_name
            FROM event_participations ep
            JOIN staff_members sm
                ON sm.id = ep.staff_member_id
            LEFT JOIN organizational_units ou
                ON ou.id = ep.organizational_unit_id
            ORDER BY
                ep.event_date DESC NULLS LAST,
                ep.created_at DESC
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
                    ep.*,
                    sm.first_name AS staff_first_name,
                    sm.last_name AS staff_last_name,
                    ou.name AS organizational_unit_name
                FROM event_participations ep
                JOIN staff_members sm
                    ON sm.id = ep.staff_member_id
                LEFT JOIN organizational_units ou
                    ON ou.id = ep.organizational_unit_id
                WHERE ep.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message:
                    "Sudjelovanje na skupu nije pronađeno."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/", async (req, res, next) => {
    const errors = validateEventParticipation(
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
        staff_member_id,
        organizational_unit_id = null,
        participation_type,
        event_name,
        organizer_name = null,
        location = null,
        event_date = null,
        presentation_title = null,
        program_link = null,
        notes = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO event_participations (
                    reporting_period_id,
                    staff_member_id,
                    organizational_unit_id,
                    participation_type,
                    event_name,
                    organizer_name,
                    location,
                    event_date,
                    presentation_title,
                    program_link,
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
                Number(reporting_period_id),
                Number(staff_member_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                participation_type,
                event_name.trim(),
                organizer_name?.trim() || null,
                location?.trim() || null,
                event_date,
                presentation_title?.trim() || null,
                program_link?.trim() || null,
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
    const errors = validateEventParticipation(
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
        staff_member_id,
        organizational_unit_id = null,
        participation_type,
        event_name,
        organizer_name = null,
        location = null,
        event_date = null,
        presentation_title = null,
        program_link = null,
        notes = null,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE event_participations
                SET
                    reporting_period_id = $1,
                    staff_member_id = $2,
                    organizational_unit_id = $3,
                    participation_type = $4,
                    event_name = $5,
                    organizer_name = $6,
                    location = $7,
                    event_date = $8,
                    presentation_title = $9,
                    program_link = $10,
                    notes = $11,
                    updated_by = $12,
                    updated_at = NOW()
                WHERE id = $13
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                Number(staff_member_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                participation_type,
                event_name.trim(),
                organizer_name?.trim() || null,
                location?.trim() || null,
                event_date,
                presentation_title?.trim() || null,
                program_link?.trim() || null,
                notes?.trim() || null,
                Number(updated_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message:
                    "Sudjelovanje na skupu nije pronađeno."
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
        "participation_type",
        "event_name",
        "organizer_name",
        "location",
        "event_date",
        "presentation_title",
        "program_link",
        "notes",
        "updated_by"
    ];

    const fieldValidation = validateAllowedFields(
        req.body,
        allowedFields
    );

    if (fieldValidation.errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: fieldValidation.errors
        });
    }

    const errors = validateEventParticipation(
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
            "event_participations",
            req.body,
            req.resourceId
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message:
                    "Sudjelovanje na skupu nije pronađeno."
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
                DELETE FROM event_participations
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message:
                    "Sudjelovanje na skupu nije pronađeno."
            });
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
