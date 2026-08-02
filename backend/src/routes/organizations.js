import express from "express";
import pool from "../db/pool.js";
import { validateId } from "../middleware/validateId.js";

const router = express.Router();

function validateOrganization(body, partial = false) {
    const errors = [];

    if (!partial || body.name !== undefined) {
        if (
            typeof body.name !== "string" ||
            body.name.trim() === ""
        ) {
            errors.push("Naziv organizacije je obavezan.");
        } else if (body.name.trim().length > 100) {
            errors.push(
                "Naziv organizacije smije imati najviše 100 znakova."
            );
        }
    }

    if (
        body.organization_type !== undefined &&
        body.organization_type !== null
    ) {
        if (typeof body.organization_type !== "string") {
            errors.push("Vrsta organizacije mora biti tekst.");
        } else if (body.organization_type.trim().length > 50) {
            errors.push(
                "Vrsta organizacije smije imati najviše 50 znakova."
            );
        }
    }

    if (body.country_id !== undefined && body.country_id !== null) {
        const countryId = Number(body.country_id);

        if (!Number.isInteger(countryId) || countryId <= 0) {
            errors.push(
                "ID države mora biti pozitivan cijeli broj ili null."
            );
        }
    }

    if (body.city !== undefined && body.city !== null) {
        if (typeof body.city !== "string") {
            errors.push("Grad mora biti tekst.");
        } else if (body.city.trim().length > 50) {
            errors.push("Grad smije imati najviše 50 znakova.");
        }
    }

    return errors;
}

// GET /api/organizations
router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                o.*,
                c.name_hr AS country_name_hr,
                c.name_en AS country_name_en
            FROM organizations o
            LEFT JOIN countries c
                ON c.id = o.country_id
            ORDER BY o.name
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET /api/organizations/:id
router.get("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    o.*,
                    c.name_hr AS country_name_hr,
                    c.name_en AS country_name_en
                FROM organizations o
                LEFT JOIN countries c
                    ON c.id = o.country_id
                WHERE o.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Organizacija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST /api/organizations
router.post("/", async (req, res, next) => {
    const errors = validateOrganization(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        name,
        organization_type = null,
        country_id = null,
        city = null
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO organizations (
                    name,
                    organization_type,
                    country_id,
                    city
                )
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `,
            [
                name.trim(),
                organization_type?.trim() || null,
                country_id === null ? null : Number(country_id),
                city?.trim() || null
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23503") { // kresenje foreign keya
            return res.status(400).json({
                message: "Država s navedenim ID-em ne postoji."
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Organizacija s tim nazivom i državom već postoji."
            });
        }

        next(error);
    }
});

// PUT /api/organizations/:id
router.put("/:id", validateId, async (req, res, next) => {
    const errors = validateOrganization(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        name,
        organization_type = null,
        country_id = null,
        city = null
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE organizations
                SET
                    name = $1,
                    organization_type = $2,
                    country_id = $3,
                    city = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `,
            [
                name.trim(),
                organization_type?.trim() || null,
                country_id === null ? null : Number(country_id),
                city?.trim() || null,
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Organizacija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23503") {
            return res.status(400).json({
                message: "Država s navedenim ID-em ne postoji."
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Organizacija s tim nazivom i državom već postoji."
            });
        }

        next(error);
    }
});

// PATCH /api/organizations/:id
router.patch("/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "name",
        "organization_type",
        "country_id",
        "city"
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

    const errors = validateOrganization(req.body, true);

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

        if (
            field === "name" ||
            field === "organization_type" ||
            field === "city"
        ) {
            value =
                typeof value === "string"
                    ? value.trim() || null
                    : value;
        }

        if (field === "country_id" && value !== null) {
            value = Number(value);
        }

        values.push(value);
        updates.push(`${field} = $${values.length}`);
    }

    updates.push("updated_at = NOW()");
    values.push(req.resourceId);

    try {
        const result = await pool.query(
            `
                UPDATE organizations
                SET ${updates.join(", ")}
                WHERE id = $${values.length}
                RETURNING *
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Organizacija nije pronađena."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23503") {
            return res.status(400).json({
                message: "Država s navedenim ID-em ne postoji."
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Organizacija s tim nazivom i državom već postoji."
            });
        }

        next(error);
    }
});

// DELETE /api/organizations/:id
router.delete("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM organizations
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Organizacija nije pronađena."
            });
        }

        return res.status(204).send();
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                message:
                    "Organizacija se ne može obrisati jer je koriste drugi zapisi."
            });
        }

        next(error);
    }
});

export default router;