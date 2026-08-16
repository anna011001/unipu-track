import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const allowedCategories = [
    "WOS_SCOPUS_Q1_Q2",
    "WOS_SCOPUS_Q3_Q4",
    "OTHER_INTERNATIONAL_JOURNALS",
    "DOMESTIC_JOURNALS",
    "BOOK_CHAPTERS",
    "CONFERENCE_PROCEEDINGS",
    "TOTAL"
];

function isPositiveInteger(value) {
    const number = Number(value);

    return Number.isInteger(number) && number > 0;
}

function isIntegerInRange(value, min, max) {
    const number = Number(value);

    return (
        Number.isInteger(number) &&
        number >= min &&
        number <= max
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

function validateRequiredYear(
    body,
    field,
    label,
    errors,
    required = true
) {
    if (body[field] === undefined) {
        if (required) {
            errors.push(`${label} je obavezna.`);
        }

        return;
    }

    const maxYear = new Date().getFullYear() + 1;

    if (!isIntegerInRange(body[field], 2000, maxYear)) {
        errors.push(
            `${label} mora biti između 2000. i ${maxYear}.`
        );
    }
}

function validateOptionalCount(
    body,
    field,
    label,
    errors
) {
    if (body[field] === undefined || body[field] === null) {
        return;
    }

    if (!isIntegerInRange(body[field], 0, 9999)) {
        errors.push(
            `${label} mora biti cijeli broj između 0 i 9999.`
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
        "calendar_year",
        "publication_year",
        "paper_count",
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

function validateYearTotal(body, mode = "create") {
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

    validateRequiredYear(
        body,
        "calendar_year",
        "Kalendarska godina",
        errors,
        !partial
    );

    validateOptionalCount(
        body,
        "paper_count",
        "Broj radova",
        errors
    );

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
        "reporting_period_id",
        "ID izvještajnog razdoblja",
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "authors_and_title",
        "Autori i naslov rada",
        null,
        errors,
        !partial
    );

    validateRequiredYear(
        body,
        "publication_year",
        "Godina objave",
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "publication_link",
        "Poveznica na rad",
        null,
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

function validateCategorySummary(body, mode = "create") {
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

    if (!partial || body.category !== undefined) {
        if (!allowedCategories.includes(body.category)) {
            errors.push(
                `Kategorija mora biti: ${allowedCategories.join(", ")}.`
            );
        }
    }

    validateRequiredYear(
        body,
        "calendar_year",
        "Kalendarska godina",
        errors,
        !partial
    );

    validateOptionalCount(
        body,
        "paper_count",
        "Broj radova",
        errors
    );

    validateAuditFields(body, mode, errors);

    return errors;
}

router.get("/year-totals", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                cyt.*,
                rp.label AS reporting_period_label
            FROM coauthorship_year_totals cyt
            JOIN reporting_periods rp
                ON rp.id = cyt.reporting_period_id
            ORDER BY
                cyt.calendar_year DESC,
                cyt.created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/year-totals/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    SELECT
                        cyt.*,
                        rp.label AS reporting_period_label
                    FROM coauthorship_year_totals cyt
                    JOIN reporting_periods rp
                        ON rp.id = cyt.reporting_period_id
                    WHERE cyt.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Godišnji podatak o koautorstvu nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post("/year-totals", async (req, res, next) => {
    const errors = validateYearTotal(
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
        calendar_year,
        paper_count = 0,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO coauthorship_year_totals (
                    reporting_period_id,
                    calendar_year,
                    paper_count,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                Number(calendar_year),
                Number(paper_count),
                Number(created_by),
                Number(updated_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/year-totals/:id", validateId, async (req, res, next) => {
        const errors = validateYearTotal(
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
            calendar_year,
            paper_count = 0,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE coauthorship_year_totals
                    SET
                        reporting_period_id = $1,
                        calendar_year = $2,
                        paper_count = $3,
                        updated_by = $4,
                        updated_at = NOW()
                    WHERE id = $5
                    RETURNING *
                `,
                [
                    Number(reporting_period_id),
                    Number(calendar_year),
                    Number(paper_count),
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Godišnji podatak o koautorstvu nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.patch("/year-totals/:id", validateId, async (req, res, next) => {
        const allowedFields = [
            "reporting_period_id",
            "calendar_year",
            "paper_count",
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

        const errors = validateYearTotal(
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
                "coauthorship_year_totals",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Godišnji podatak o koautorstvu nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.delete("/year-totals/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE FROM coauthorship_year_totals
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Godišnji podatak o koautorstvu nije pronađen."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.get("/papers", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                cp.*,
                rp.label AS reporting_period_label
            FROM coauthored_papers cp
            JOIN reporting_periods rp
                ON rp.id = cp.reporting_period_id
            ORDER BY
                cp.publication_year DESC,
                cp.created_at DESC
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
                    SELECT
                        cp.*,
                        rp.label AS reporting_period_label
                    FROM coauthored_papers cp
                    JOIN reporting_periods rp
                        ON rp.id = cp.reporting_period_id
                    WHERE cp.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Koautorski rad nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post("/papers", async (req, res, next) => {
    const errors = validatePaper(
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
        authors_and_title,
        publication_year,
        publication_link = null,
        created_by,
        updated_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO coauthored_papers (
                    reporting_period_id,
                    authors_and_title,
                    publication_year,
                    publication_link,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `,
            [
                Number(reporting_period_id),
                authors_and_title.trim(),
                Number(publication_year),
                publication_link?.trim() || null,
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
        const errors = validatePaper(
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
            authors_and_title,
            publication_year,
            publication_link = null,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE coauthored_papers
                    SET
                        reporting_period_id = $1,
                        authors_and_title = $2,
                        publication_year = $3,
                        publication_link = $4,
                        updated_by = $5,
                        updated_at = NOW()
                    WHERE id = $6
                    RETURNING *
                `,
                [
                    Number(reporting_period_id),
                    authors_and_title.trim(),
                    Number(publication_year),
                    publication_link?.trim() || null,
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Koautorski rad nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.patch("/papers/:id", validateId, async (req, res, next) => {
        const allowedFields = [
            "reporting_period_id",
            "authors_and_title",
            "publication_year",
            "publication_link",
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

        const errors = validatePaper(
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
                "coauthored_papers",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Koautorski rad nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.delete("/papers/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE FROM coauthored_papers
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Koautorski rad nije pronađen."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.get("/category-summaries", async (req, res, next) => {
        try {
            const result = await pool.query(`
                SELECT
                    ccs.*,
                    rp.label AS reporting_period_label
                FROM coauthorship_category_summaries ccs
                JOIN reporting_periods rp
                    ON rp.id = ccs.reporting_period_id
                ORDER BY
                    ccs.calendar_year DESC,
                    ccs.category,
                    ccs.created_at DESC
            `);

            return res.status(200).json(result.rows);
        } catch (error) {
            next(error);
        }
    }
);

router.get("/category-summaries/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    SELECT
                        ccs.*,
                        rp.label AS reporting_period_label
                    FROM coauthorship_category_summaries ccs
                    JOIN reporting_periods rp
                        ON rp.id = ccs.reporting_period_id
                    WHERE ccs.id = $1
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Sažetak kategorije nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    "/category-summaries", async (req, res, next) => {
        const errors = validateCategorySummary(
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
            category,
            calendar_year,
            paper_count = 0,
            created_by,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    INSERT INTO coauthorship_category_summaries (
                        reporting_period_id,
                        category,
                        calendar_year,
                        paper_count,
                        created_by,
                        updated_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING *
                `,
                [
                    Number(reporting_period_id),
                    category,
                    Number(calendar_year),
                    Number(paper_count),
                    Number(created_by),
                    Number(updated_by)
                ]
            );

            return res.status(201).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.put("/category-summaries/:id", validateId, async (req, res, next) => {
        const errors = validateCategorySummary(
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
            category,
            calendar_year,
            paper_count = 0,
            updated_by
        } = req.body;

        try {
            const result = await pool.query(
                `
                    UPDATE coauthorship_category_summaries
                    SET
                        reporting_period_id = $1,
                        category = $2,
                        calendar_year = $3,
                        paper_count = $4,
                        updated_by = $5,
                        updated_at = NOW()
                    WHERE id = $6
                    RETURNING *
                `,
                [
                    Number(reporting_period_id),
                    category,
                    Number(calendar_year),
                    Number(paper_count),
                    Number(updated_by),
                    req.resourceId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Sažetak kategorije nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.patch(
    "/category-summaries/:id", validateId, async (req, res, next) => {
        const allowedFields = [
            "reporting_period_id",
            "category",
            "calendar_year",
            "paper_count",
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

        const errors = validateCategorySummary(
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
                "coauthorship_category_summaries",
                req.body,
                req.resourceId
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Sažetak kategorije nije pronađen."
                });
            }

            return res.status(200).json(result.rows[0]);
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

router.delete("/category-summaries/:id", validateId, async (req, res, next) => {
        try {
            const result = await pool.query(
                `
                    DELETE
                    FROM coauthorship_category_summaries
                    WHERE id = $1
                    RETURNING id
                `,
                [req.resourceId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Sažetak kategorije nije pronađen."
                });
            }

            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(error, res, next);
        }
    }
);

export default router;
