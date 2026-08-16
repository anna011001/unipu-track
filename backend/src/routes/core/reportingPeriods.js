import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const allowedPeriodTypes = ["CALENDAR_YEAR", "ACADEMIC_YEAR", "CUSTOM"];

function validateReportingPeriod(body, partial = false) {
  const errors = [];

  if (!partial || body.label !== undefined) {
    if (typeof body.label !== "string" || body.label.trim() === "") {
      errors.push("Oznaka razdoblja je obavezna.");
    }
  }

  if (!partial || body.period_type !== undefined) {
    if (!allowedPeriodTypes.includes(body.period_type)) {
      errors.push(
        "Vrsta razdoblja mora biti CALENDAR_YEAR, ACADEMIC_YEAR ili CUSTOM.",
      );
    }
  }

  if (!partial || body.start_date !== undefined) {
    if (
      typeof body.start_date !== "string" ||
      Number.isNaN(Date.parse(body.start_date))
    ) {
      errors.push("Početni datum mora biti ispravan datum.");
    }
  }

  if (!partial || body.end_date !== undefined) {
    if (
      typeof body.end_date !== "string" ||
      Number.isNaN(Date.parse(body.end_date))
    ) {
      errors.push("Završni datum mora biti ispravan datum.");
    }
  }

  if (body.is_closed !== undefined && typeof body.is_closed !== "boolean") {
    errors.push("Polje is_closed mora biti true ili false.");
  }

  const hasValidStartDate =
    body.start_date !== undefined && !Number.isNaN(Date.parse(body.start_date));

  const hasValidEndDate =
    body.end_date !== undefined && !Number.isNaN(Date.parse(body.end_date));

  if (
    hasValidStartDate &&
    hasValidEndDate &&
    new Date(body.end_date) < new Date(body.start_date)
  ) {
    errors.push("Završni datum ne smije biti prije početnog datuma.");
  }

  return errors;
}

router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT *
            FROM reporting_periods
            ORDER BY start_date DESC
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
                FROM reporting_periods
                WHERE id = $1
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Izvještajno razdoblje nije pronađeno.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const errors = validateReportingPeriod(req.body);

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    label,
    period_type,
    start_date,
    end_date,
    is_closed = false,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO reporting_periods (
                    label,
                    period_type,
                    start_date,
                    end_date,
                    is_closed
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `,
      [label.trim(), period_type, start_date, end_date, is_closed],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Izvještajno razdoblje s tom oznakom već postoji.",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        message: "Podaci krše pravila izvještajnog razdoblja.",
      });
    }

    next(error);
  }
});

router.put("/:id", validateId, async (req, res, next) => {
  const errors = validateReportingPeriod(req.body);

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    label,
    period_type,
    start_date,
    end_date,
    is_closed = false,
  } = req.body;

  try {
    const result = await pool.query(
      `
                UPDATE reporting_periods
                SET
                    label = $1,
                    period_type = $2,
                    start_date = $3,
                    end_date = $4,
                    is_closed = $5,
                    updated_at = NOW()
                WHERE id = $6
                RETURNING *
            `,
      [
        label.trim(),
        period_type,
        start_date,
        end_date,
        is_closed,
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Izvještajno razdoblje nije pronađeno.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Izvještajno razdoblje s tom oznakom već postoji.",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        message: "Podaci krše pravila izvještajnog razdoblja.",
      });
    }

    next(error);
  }
});

router.patch("/:id", validateId, async (req, res, next) => {
  const allowedFields = [
    "label",
    "period_type",
    "start_date",
    "end_date",
    "is_closed",
  ];

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

  const errors = validateReportingPeriod(req.body, true);

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const currentResult = await pool.query(
      `
                SELECT *
                FROM reporting_periods
                WHERE id = $1
            `,
      [req.resourceId],
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        message: "Izvještajno razdoblje nije pronađeno.",
      });
    }

    const current = currentResult.rows[0];

    const mergedData = {
      label: req.body.label ?? current.label,
      period_type: req.body.period_type ?? current.period_type,
      start_date: req.body.start_date ?? current.start_date,
      end_date: req.body.end_date ?? current.end_date,
      is_closed: req.body.is_closed ?? current.is_closed,
    };

    const mergedErrors = validateReportingPeriod(mergedData);

    if (mergedErrors.length > 0) {
      return res.status(400).json({
        message: "Podaci nisu ispravni.",
        errors: mergedErrors,
      });
    }

    const values = [];
    const updates = [];

    for (const field of suppliedFields) {
      const value =
        field === "label" ? req.body[field].trim() : req.body[field];

      values.push(value);
      updates.push(`${field} = $${values.length}`);
    }

    updates.push("updated_at = NOW()");

    values.push(req.resourceId);

    const result = await pool.query(
      `
                UPDATE reporting_periods
                SET ${updates.join(", ")}
                WHERE id = $${values.length}
                RETURNING *
            `,
      values,
    );

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Izvještajno razdoblje s tom oznakom već postoji.",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        message: "Podaci krše pravila izvještajnog razdoblja.",
      });
    }

    next(error);
  }
});

router.delete("/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                DELETE FROM reporting_periods
                WHERE id = $1
                RETURNING id
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Izvještajno razdoblje nije pronađeno.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        message: "Razdoblje se ne može obrisati jer ga koriste drugi zapisi.",
      });
    }

    next(error);
  }
});

export default router;
