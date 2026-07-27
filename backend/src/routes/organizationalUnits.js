import express from "express";
import pool from "../db/pool.js";
import { validateId } from "../middleware/validateId.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT *
            FROM organizational_units
            ORDER BY name
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
                FROM organizational_units
                WHERE id = $1
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Sastavnica nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const { name, short_name = null } = req.body;

  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({
      message: "Naziv sastavnice je obavezan.",
    });
  }

  try {
    const result = await pool.query(
      `
            INSERT INTO organizational_units (
                name,
                short_name
            )
            VALUES ($1, $2)
            RETURNING *
            `,
      [name.trim(), short_name?.trim() || null],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") { // krsenje UNIQUE
      return res.status(409).json({
        message: "Sastavnica s tim nazivom već postoji.",
      });
    }

    next(error);
  }
});

router.put("/:id", validateId, async (req, res, next) => {
  const { name, short_name = null } = req.body;

  if (typeof name != "string" || name.trim() === "") {
    return res.status(400).json({
      message: "Naziv sastavnice je obavezan.",
    });
  }

  try {
    const result = await pool.query(
      `
                UPDATE organizational_units
                SET 
                    name = $1,
                    short_name = $2
                WHERE id = $3
                RETURNING *
            `,
      [name.trim(), short_name?.trim() || null, req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Sastavnica nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Sastavnica s tim nazivom već postoji.",
      });
    }

    next(error);
  }
});

router.patch("/:id", validateId, async (req, res, next) => {
  const allowedFields = ["name", "short_name"];
  const suppliedFields = Object.keys(req.body);

  if (suppliedFields.length === 0) {
    return res.status(400).json({
      message: "Niste poslali nijedno polje za izmjenu.",
    });
  }

  const invalidFields = suppliedFields.filter(
    (field) => !allowedFields.includes(field),
  );

  if (invalidFields.length > 0) {
    return res.status(400).json({
      message: `Nedopuštena polja: ${invalidFields.join(", ")}`,
    });
  }

  if (
    req.body.name !== undefined &&
    (typeof req.body.name !== "string" || req.body.name.trim() === "")
  ) {
    return res.status(400).json({
      message: "Naziv ne smije biti prazan.",
    });
  }

  const values = [];
  const updates = [];

  for (const field of suppliedFields) {
    values.push(
      typeof req.body[field] === "string"
        ? req.body[field].trim() || null
        : req.body[field],
    );

    updates.push(`${field} = $${values.length}`);
  }

  values.push(req.resourceId);

  try {
    const result = await pool.query(
      `
                UPDATE organizational_units
                SET ${updates.join(", ")}
                WHERE id = $${values.length}
                RETURNING *
            `,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Sastavnica nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Sastavnica s tim nazivom već postoji.",
      });
    }

    next(error);
  }
});

router.delete("/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                DELETE FROM organizational_units
                WHERE id = $1
                RETURNING id
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Sastavnica nije pronađena.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
