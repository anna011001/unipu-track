import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const allowedRegions = [
    "EU",
    "OTHER_EUROPE",
    "NORTH_AMERICA",
    "SOUTH_AMERICA",
    "ASIA",
    "AFRICA",
    "OCEANIA"
];

function validateCountry(body, partial = false) {
    const errors = [];

    if (!partial || body.name_hr !== undefined) {
        if (
            typeof body.name_hr !== "string" ||
            body.name_hr.trim() === ""
        ) {
            errors.push("Naziv države na hrvatskom jeziku je obavezan.");
        } else if (body.name_hr.trim().length > 100) {
            errors.push(
                "Naziv države na hrvatskom jeziku smije imati najviše 100 znakova."
            );
        }
    }

    if (body.iso2_code !== undefined && body.iso2_code !== null) {
        if (
            typeof body.iso2_code !== "string" ||
            !/^[A-Za-z]{2}$/.test(body.iso2_code.trim())
        ) {
            errors.push(
                "ISO2 oznaka mora sadržavati točno dva slova."
            );
        }
    }

    if (body.name_en !== undefined && body.name_en !== null) {
        if (typeof body.name_en !== "string") {
            errors.push(
                "Naziv države na engleskom jeziku mora biti tekst."
            );
        } else if (body.name_en.trim().length > 100) {
            errors.push(
                "Naziv države na engleskom jeziku smije imati najviše 100 znakova."
            );
        }
    }

    if (body.region !== undefined && body.region !== null) {
        if (!allowedRegions.includes(body.region)) {
            errors.push(
                `Regija mora biti jedna od vrijednosti: ${allowedRegions.join(", ")}.`
            );
        }
    }

    return errors;
}

// GET /api/countries
router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM countries
            ORDER BY name_hr
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET /api/countries/:id
router.get("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM countries
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Država nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST /api/countries
router.post("/", async (req, res, next) => {
    const errors = validateCountry(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        iso2_code = null,
        name_hr,
        name_en = null,
        region = null
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO countries (
                    iso2_code,
                    name_hr,
                    name_en,
                    region
                )
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `,
            [
                iso2_code?.trim().toUpperCase() || null,
                name_hr.trim(),
                name_en?.trim() || null,
                region
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Država s tim nazivom ili ISO2 oznakom već postoji."
            });
        }

        if (error.code === "23514") {
            return res.status(400).json({
                message: "Vrijednost regije nije dopuštena."
            });
        }

        next(error);
    }
});

// PUT /api/countries/:id
router.put("/:id", validateId, async (req, res, next) => {
    const errors = validateCountry(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        iso2_code = null,
        name_hr,
        name_en = null,
        region = null
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE countries
                SET
                    iso2_code = $1,
                    name_hr = $2,
                    name_en = $3,
                    region = $4
                WHERE id = $5
                RETURNING *
            `,
            [
                iso2_code?.trim().toUpperCase() || null,
                name_hr.trim(),
                name_en?.trim() || null,
                region,
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Država nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Država s tim nazivom ili ISO2 oznakom već postoji."
            });
        }

        if (error.code === "23514") {
            return res.status(400).json({
                message: "Vrijednost regije nije dopuštena."
            });
        }

        next(error);
    }
});

// PATCH /api/countries/:id
router.patch("/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "iso2_code",
        "name_hr",
        "name_en",
        "region"
    ];

    const suppliedFields = Object.keys(req.body);

    if (suppliedFields.length === 0) {
        return res.status(400).json({
            message: "Niste poslali nijedno polje za izmjenu."
        });
    }

    const invalidFields = suppliedFields.filter(
        field => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
        return res.status(400).json({
            message: `Nedopuštena polja: ${invalidFields.join(", ")}`
        });
    }

    const errors = validateCountry(req.body, true);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const values = [];
    const updates = [];

    for (const field of suppliedFields) {
        let value = req.body[field];

        if (field === "iso2_code") {
            value =
                typeof value === "string"
                    ? value.trim().toUpperCase() || null
                    : value;
        }

        if (field === "name_hr" || field === "name_en") {
            value =
                typeof value === "string"
                    ? value.trim() || null
                    : value;
        }

        values.push(value);
        updates.push(`${field} = $${values.length}`);
    }

    values.push(req.resourceId);

    try {
        const result = await pool.query(
            `
                UPDATE countries
                SET ${updates.join(", ")}
                WHERE id = $${values.length}
                RETURNING *
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Država nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Država s tim nazivom ili ISO2 oznakom već postoji."
            });
        }

        if (error.code === "23514") {
            return res.status(400).json({
                message: "Vrijednost regije nije dopuštena."
            });
        }

        next(error);
    }
});

// DELETE /api/countries/:id
router.delete("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM countries
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Država nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                message:
                    "Država se ne može obrisati jer je koriste drugi zapisi."
            });
        }

        next(error);
    }
});

export default router;
