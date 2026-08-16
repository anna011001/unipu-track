import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

function validateStaffMember(body, partial = false) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    if (!partial || body.first_name !== undefined) {
        if (
            typeof body.first_name !== "string" ||
            body.first_name.trim() === ""
        ) {
            errors.push("Ime djelatnika je obavezno.");
        } else if (body.first_name.trim().length > 50) {
            errors.push("Ime smije imati najviše 50 znakova.");
        }
    }

    if (!partial || body.last_name !== undefined) {
        if (
            typeof body.last_name !== "string" ||
            body.last_name.trim() === ""
        ) {
            errors.push("Prezime djelatnika je obavezno.");
        } else if (body.last_name.trim().length > 80) {
            errors.push("Prezime smije imati najviše 80 znakova.");
        }
    }

    if (
        body.academic_title !== undefined &&
        body.academic_title !== null
    ) {
        if (typeof body.academic_title !== "string") {
            errors.push("Akademska titula mora biti tekst.");
        } else if (body.academic_title.trim().length > 30) {
            errors.push(
                "Akademska titula smije imati najviše 30 znakova."
            );
        }
    }

    if (body.email !== undefined && body.email !== null) {
        if (typeof body.email !== "string") {
            errors.push("E-mail mora biti tekst.");
        } else if (
            body.email.trim() !== "" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
        ) {
            errors.push("E-mail adresa nije ispravna.");
        }
    }

    if (body.user_id !== undefined && body.user_id !== null) {
        const userId = Number(body.user_id);

        if (!Number.isInteger(userId) || userId <= 0) {
            errors.push(
                "ID korisnika mora biti pozitivan cijeli broj ili null."
            );
        }
    }

    if (
        body.organizational_unit_id !== undefined &&
        body.organizational_unit_id !== null
    ) {
        const unitId = Number(body.organizational_unit_id);

        if (!Number.isInteger(unitId) || unitId <= 0) {
            errors.push(
                "ID sastavnice mora biti pozitivan cijeli broj ili null."
            );
        }
    }

    if (
        body.is_active !== undefined &&
        typeof body.is_active !== "boolean"
    ) {
        errors.push("Polje is_active mora biti true ili false.");
    }

    return errors;
}

// GET /api/staff-members
router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                sm.*,
                ou.name AS organizational_unit_name,
                ou.short_name AS organizational_unit_short_name
            FROM staff_members sm
            LEFT JOIN organizational_units ou
                ON ou.id = sm.organizational_unit_id
            ORDER BY sm.last_name, sm.first_name
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET /api/staff-members/:id
router.get("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    sm.*,
                    ou.name AS organizational_unit_name,
                    ou.short_name AS organizational_unit_short_name
                FROM staff_members sm
                LEFT JOIN organizational_units ou
                    ON ou.id = sm.organizational_unit_id
                WHERE sm.id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Djelatnik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST /api/staff-members
router.post("/", async (req, res, next) => {
    const errors = validateStaffMember(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        user_id = null,
        organizational_unit_id = null,
        first_name,
        last_name,
        academic_title = null,
        email = null,
        is_active = true
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO staff_members (
                    user_id,
                    organizational_unit_id,
                    first_name,
                    last_name,
                    academic_title,
                    email,
                    is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `,
            [
                user_id === null ? null : Number(user_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                first_name.trim(),
                last_name.trim(),
                academic_title?.trim() || null,
                email?.trim() || null,
                is_active
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23503") {
            return res.status(400).json({
                message:
                    "Korisnik ili sastavnica s navedenim ID-em ne postoji."
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Navedeni korisnički račun već je povezan s drugim djelatnikom."
            });
        }

        next(error);
    }
});

// PUT /api/staff-members/:id
router.put("/:id", validateId, async (req, res, next) => {
    const errors = validateStaffMember(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        user_id = null,
        organizational_unit_id = null,
        first_name,
        last_name,
        academic_title = null,
        email = null,
        is_active = true
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE staff_members
                SET
                    user_id = $1,
                    organizational_unit_id = $2,
                    first_name = $3,
                    last_name = $4,
                    academic_title = $5,
                    email = $6,
                    is_active = $7,
                    updated_at = NOW()
                WHERE id = $8
                RETURNING *
            `,
            [
                user_id === null ? null : Number(user_id),
                organizational_unit_id === null
                    ? null
                    : Number(organizational_unit_id),
                first_name.trim(),
                last_name.trim(),
                academic_title?.trim() || null,
                email?.trim() || null,
                is_active,
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Djelatnik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23503") {
            return res.status(400).json({
                message:
                    "Korisnik ili sastavnica s navedenim ID-em ne postoji."
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Navedeni korisnički račun već je povezan s drugim djelatnikom."
            });
        }

        next(error);
    }
});

// PATCH /api/staff-members/:id
router.patch("/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "user_id",
        "organizational_unit_id",
        "first_name",
        "last_name",
        "academic_title",
        "email",
        "is_active"
    ];

    const suppliedFields = Object.keys(req.body ?? {});

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

    const errors = validateStaffMember(req.body, true);

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
            field === "first_name" ||
            field === "last_name" ||
            field === "academic_title" ||
            field === "email"
        ) {
            value =
                typeof value === "string"
                    ? value.trim() || null
                    : value;
        }

        if (
            (field === "user_id" ||
                field === "organizational_unit_id") &&
            value !== null
        ) {
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
                UPDATE staff_members
                SET ${updates.join(", ")}
                WHERE id = $${values.length}
                RETURNING *
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Djelatnik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23503") {
            return res.status(400).json({
                message:
                    "Korisnik ili sastavnica s navedenim ID-em ne postoji."
            });
        }

        if (error.code === "23505") {
            return res.status(409).json({
                message:
                    "Navedeni korisnički račun već je povezan s drugim djelatnikom."
            });
        }

        next(error);
    }
});

// DELETE /api/staff-members/:id
router.delete("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM staff_members
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Djelatnik nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                message:
                    "Djelatnik se ne može obrisati jer ga koriste drugi zapisi."
            });
        }

        next(error);
    }
});

export default router;
