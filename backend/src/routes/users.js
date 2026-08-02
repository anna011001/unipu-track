import express from 'express';
import bcrypt from 'bcrypt';
import pool from "../db/pool.js";
import { validateId } from "../middleware/validateId.js";

const router = express.Router();

const allowedRoles = ["PROFESSOR", "ADMIN"];
const saltRounds = 12;

function validateUser(body, partial = false) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    if (!partial || body.email !== undefined) {
        if (
            typeof body.email !== "string" ||
            body.email.trim() === ""
        ) {
            errors.push("E-mail je obavezan.");
        } else if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
        ) {
            errors.push("E-mail adresa nije ispravna.");
        }
    }

    if (!partial || body.first_name !== undefined) {
        if (
            typeof body.first_name !== "string" ||
            body.first_name.trim() === ""
        ) {
            errors.push("Ime je obavezno.");
        } else if (body.first_name.trim().length > 50) {
            errors.push("Ime smije imati najviše 50 znakova.");
        }
    }

    if (!partial || body.last_name !== undefined) {
        if (
            typeof body.last_name !== "string" ||
            body.last_name.trim() === ""
        ) {
            errors.push("Prezime je obavezno.");
        } else if (body.last_name.trim().length > 80) {
            errors.push("Prezime smije imati najviše 80 znakova.");
        }
    }

    if (!partial || body.password !== undefined) {
        if (
            typeof body.password !== "string" ||
            body.password.length < 8
        ) {
            errors.push("Lozinka mora imati najmanje 8 znakova.");
        }
    }

    if (body.role !== undefined) {
        if (!allowedRoles.includes(body.role)) {
            errors.push("Uloga mora biti PROFESSOR ili ADMIN.");
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

// GET /api/users
router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                email,
                first_name,
                last_name,
                role,
                is_active,
                last_login_at,
                created_at,
                updated_at
            FROM users
            ORDER BY last_name, first_name
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET /api/users/:id
router.get("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    id,
                    email,
                    first_name,
                    last_name,
                    role,
                    is_active,
                    last_login_at,
                    created_at,
                    updated_at
                FROM users
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Korisnik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST /api/users
router.post("/", async (req, res, next) => {
    const errors = validateUser(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        email,
        password,
        first_name,
        last_name,
        role = "PROFESSOR",
        is_active = true
    } = req.body;

    try {
        const passwordHash = await bcrypt.hash(
            password,
            saltRounds
        );

        const result = await pool.query(
            `
                INSERT INTO users (
                    email,
                    password_hash,
                    first_name,
                    last_name,
                    role,
                    is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING
                    id,
                    email,
                    first_name,
                    last_name,
                    role,
                    is_active,
                    last_login_at,
                    created_at,
                    updated_at
            `,
            [
                email.trim().toLowerCase(),
                passwordHash,
                first_name.trim(),
                last_name.trim(),
                role,
                is_active
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Korisnik s tim e-mailom već postoji."
            });
        }

        if (error.code === "23514") {
            return res.status(400).json({
                message: "Uloga korisnika nije dopuštena."
            });
        }

        next(error);
    }
});

// PUT /api/users/:id
router.put("/:id", validateId, async (req, res, next) => {
    const errors = validateUser(req.body);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        email,
        password,
        first_name,
        last_name,
        role = "PROFESSOR",
        is_active = true
    } = req.body;

    try {
        const passwordHash = await bcrypt.hash(
            password,
            saltRounds
        );

        const result = await pool.query(
            `
                UPDATE users
                SET
                    email = $1,
                    password_hash = $2,
                    first_name = $3,
                    last_name = $4,
                    role = $5,
                    is_active = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING
                    id,
                    email,
                    first_name,
                    last_name,
                    role,
                    is_active,
                    last_login_at,
                    created_at,
                    updated_at
            `,
            [
                email.trim().toLowerCase(),
                passwordHash,
                first_name.trim(),
                last_name.trim(),
                role,
                is_active,
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Korisnik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Korisnik s tim e-mailom već postoji."
            });
        }

        if (error.code === "23514") {
            return res.status(400).json({
                message: "Uloga korisnika nije dopuštena."
            });
        }

        next(error);
    }
});

// PATCH /api/users/:id
router.patch("/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "email",
        "password",
        "first_name",
        "last_name",
        "role",
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

    const errors = validateUser(req.body, true);

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const values = [];
    const updates = [];

    for (const field of suppliedFields) {
        let databaseField = field;
        let value = req.body[field];

        if (field === "password") {
            databaseField = "password_hash";
            value = await bcrypt.hash(value, saltRounds);
        }

        if (field === "email") {
            value = value.trim().toLowerCase();
        }

        if (
            field === "first_name" ||
            field === "last_name"
        ) {
            value = value.trim();
        }

        values.push(value);
        updates.push(`${databaseField} = $${values.length}`);
    }

    updates.push("updated_at = NOW()");
    values.push(req.resourceId);

    try {
        const result = await pool.query(
            `
                UPDATE users
                SET ${updates.join(", ")}
                WHERE id = $${values.length}
                RETURNING
                    id,
                    email,
                    first_name,
                    last_name,
                    role,
                    is_active,
                    last_login_at,
                    created_at,
                    updated_at
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Korisnik nije pronađen."
            });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Korisnik s tim e-mailom već postoji."
            });
        }

        if (error.code === "23514") {
            return res.status(400).json({
                message: "Uloga korisnika nije dopuštena."
            });
        }

        next(error);
    }
});

// DELETE /api/users/:id
router.delete("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM users
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Korisnik nije pronađen."
            });
        }

        return res.status(204).send();
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({
                message:
                    "Korisnik se ne može obrisati jer ga koriste drugi zapisi."
            });
        }

        next(error);
    }
});

export default router;

