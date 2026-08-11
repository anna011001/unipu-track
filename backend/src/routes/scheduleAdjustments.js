import express from "express";
import pool from "../db/pool.js";
import { validateId } from "../middleware/validateId.js";

const router = express.Router();

function isPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function isIntegerInRange(value, min, max) {
  const number = Number(value);

  return Number.isInteger(number) && number >= min && number <= max;
}

function isNumberInRange(value, min, max) {
  const number = Number(value);

  return Number.isFinite(number) && number >= min && number <= max;
}

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return ["Tijelo zahtjeva mora biti JSON objekt."];
  }

  return [];
}

function validateRequiredId(body, field, label, errors, required = true) {
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
    errors.push(`${label} mora biti pozitivan cijeli broj ili null.`);
  }
}

function validateRequiredText(
  body,
  field,
  label,
  maxLength,
  errors,
  required = true,
) {
  if (body[field] === undefined) {
    if (required) {
      errors.push(`${label} je obavezan.`);
    }

    return;
  }

  if (typeof body[field] !== "string" || body[field].trim() === "") {
    errors.push(`${label} mora biti neprazan tekst.`);
    return;
  }

  if (maxLength !== null && body[field].trim().length > maxLength) {
    errors.push(`${label} smije imati najviše ${maxLength} znakova.`);
  }
}

function validateOptionalText(body, field, label, maxLength, errors) {
  if (body[field] === undefined || body[field] === null) {
    return;
  }

  if (typeof body[field] !== "string") {
    errors.push(`${label} mora biti tekst.`);
    return;
  }

  if (maxLength !== null && body[field].trim().length > maxLength) {
    errors.push(`${label} smije imati najviše ${maxLength} znakova.`);
  }
}

function validateOptionalInteger(body, field, label, min, max, errors) {
  if (body[field] === undefined || body[field] === null) {
    return;
  }

  if (!isIntegerInRange(body[field], min, max)) {
    errors.push(`${label} mora biti cijeli broj između ${min} i ${max}.`);
  }
}

function validateOptionalNumber(body, field, label, min, max, errors) {
  if (body[field] === undefined || body[field] === null) {
    return;
  }

  if (!isNumberInRange(body[field], min, max)) {
    errors.push(`${label} mora biti broj između ${min} i ${max}.`);
  }
}

function validateAuditFields(body, mode, errors) {
  if (mode === "create") {
    validateRequiredId(
      body,
      "created_by",
      "ID korisnika koji stvara zapis",
      errors,
    );

    validateRequiredId(
      body,
      "updated_by",
      "ID korisnika koji uređuje zapis",
      errors,
    );

    return;
  }

  validateRequiredId(
    body,
    "updated_by",
    "ID korisnika koji uređuje zapis",
    errors,
  );
}

function validateAllowedFields(body, allowedFields) {
  const fields = Object.keys(body ?? {});

  if (fields.length === 0) {
    return ["Niste poslali nijedno polje za izmjenu."];
  }

  const invalidFields = fields.filter(
    (field) => !allowedFields.includes(field),
  );

  if (invalidFields.length > 0) {
    return [`Nedopuštena polja: ${invalidFields.join(", ")}`];
  }

  return [];
}

function normalizeValue(field, value) {
  const integerFields = [
    "reporting_period_id",
    "organizational_unit_id",
    "report_id",
    "staff_member_id",
    "beneficiary_count",
    "released_hours_per_week",
    "adjusted_teacher_count",
    "submitted_research_project_count",
    "published_paper_count",
    "q1_q2_paper_count",
    "released_research_hours",
    "created_by",
    "updated_by",
  ];

  const numberFields = ["average_productivity_increase_percent"];

  if (value === null) return null;

  if (integerFields.includes(field)) {
    return Number(value);
  }

  if (numberFields.includes(field)) {
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
    values,
  );
}

function handleDatabaseError(error, res, next) {
  if (error.code === "23503") {
    return res.status(400).json({
      message: "Jedan od navedenih povezanih zapisa ne postoji.",
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      message: "Zapis s tom kombinacijom podataka već postoji.",
    });
  }

  if (error.code === "23514") {
    return res.status(400).json({
      message: "Podaci krše pravila baze podataka.",
    });
  }

  return next(error);
}

function validateAdjustmentReport(body, mode = "create") {
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
    !partial,
  );

  validateNullableId(body, "organizational_unit_id", "ID sastavnice", errors);

  validateRequiredText(
    body,
    "academic_year",
    "Akademska godina",
    11,
    errors,
    !partial,
  );

  validateAuditFields(body, mode, errors);

  return errors;
}

function validateMeasure(body, mode = "create") {
  const errors = validateBody(body);

  if (errors.length > 0) {
    return errors;
  }

  const partial = mode === "patch";

  validateRequiredId(body, "report_id", "ID izvješća", errors, !partial);

  validateRequiredText(
    body,
    "measure_type",
    "Vrsta mjere",
    100,
    errors,
    !partial,
  );

  const textFields = [
    ["measure_description", "Opis mjere", null],
    ["application_period", "Razdoblje primjene", 100],
    ["status", "Status", 40],
  ];

  for (const [field, label, maxLength] of textFields) {
    validateOptionalText(body, field, label, maxLength, errors);
  }

  const integerFields = [
    ["beneficiary_count", "Broj korisnika", 0, 9999],
    ["released_hours_per_week", "Broj oslobođenih sati tjedno", 0, 168],
  ];

  for (const [field, label, min, max] of integerFields) {
    validateOptionalInteger(body, field, label, min, max, errors);
  }

  validateAuditFields(body, mode, errors);

  return errors;
}

function validateBeneficiary(body, mode = "create") {
  const errors = validateBody(body);

  if (errors.length > 0) {
    return errors;
  }

  const partial = mode === "patch";

  validateRequiredId(body, "report_id", "ID izvješća", errors, !partial);

  validateRequiredId(
    body,
    "staff_member_id",
    "ID nastavnika",
    errors,
    !partial,
  );

  const textFields = [
    ["measure_type", "Vrsta mjere", 100],
    ["adjustment_reason", "Razlog prilagodbe", null],
    ["research_project_activity", "Aktivnost na istraživačkom projektu", null],
    ["released_time", "Oslobođeno vrijeme", 100],
    ["application_period", "Razdoblje primjene", 100],
    ["results", "Rezultati", null],
    ["status", "Status", 40],
  ];

  for (const [field, label, maxLength] of textFields) {
    validateOptionalText(body, field, label, maxLength, errors);
  }

  validateAuditFields(body, mode, errors);

  return errors;
}

function validatePlannedAdjustment(body, mode = "create") {
  const errors = validateBody(body);

  if (errors.length > 0) {
    return errors;
  }

  const partial = mode === "patch";

  validateRequiredId(body, "report_id", "ID izvješća", errors, !partial);

  validateRequiredId(
    body,
    "staff_member_id",
    "ID nastavnika",
    errors,
    !partial,
  );

  const textFields = [
    ["planned_measure", "Planirana mjera", 120],
    ["reason", "Razlog", null],
    ["planned_period", "Planirano razdoblje", 100],
    ["expected_results", "Očekivani rezultati", null],
  ];

  for (const [field, label, maxLength] of textFields) {
    validateOptionalText(body, field, label, maxLength, errors);
  }

  validateAuditFields(body, mode, errors);

  return errors;
}

function validateEffectAnalysis(body, mode = "create") {
  const errors = validateBody(body);

  if (errors.length > 0) {
    return errors;
  }

  const partial = mode === "patch";

  validateRequiredId(body, "report_id", "ID izvješća", errors, !partial);

  const integerFields = [
    ["adjusted_teacher_count", "Broj nastavnika s prilagodbom", 0, 9999],
    [
      "submitted_research_project_count",
      "Broj prijavljenih istraživačkih projekata",
      0,
      9999,
    ],
    ["published_paper_count", "Broj objavljenih radova", 0, 9999],
    ["q1_q2_paper_count", "Broj Q1/Q2 radova", 0, 9999],
    [
      "released_research_hours",
      "Broj oslobođenih istraživačkih sati",
      0,
      999999,
    ],
  ];

  for (const [field, label, min, max] of integerFields) {
    validateOptionalInteger(body, field, label, min, max, errors);
  }

  validateOptionalNumber(
    body,
    "average_productivity_increase_percent",
    "Prosječno povećanje produktivnosti",
    0,
    999.99,
    errors,
  );

  validateAuditFields(body, mode, errors);

  return errors;
}

router.get("/reports", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT
                sar.*,
                rp.label AS reporting_period_label,
                ou.name AS organizational_unit_name
            FROM schedule_adjustment_reports sar
            JOIN reporting_periods rp
                ON rp.id = sar.reporting_period_id
            LEFT JOIN organizational_units ou
                ON ou.id = sar.organizational_unit_id
            ORDER BY
                rp.start_date DESC,
                sar.created_at DESC
        `);

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/reports/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                SELECT
                    sar.*,
                    rp.label AS reporting_period_label,
                    ou.name AS organizational_unit_name
                FROM schedule_adjustment_reports sar
                JOIN reporting_periods rp
                    ON rp.id = sar.reporting_period_id
                LEFT JOIN organizational_units ou
                    ON ou.id = sar.organizational_unit_id
                WHERE sar.id = $1
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Izvješće o prilagodbi rasporeda nije pronađeno.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/reports", async (req, res, next) => {
  const errors = validateAdjustmentReport(req.body, "create");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    reporting_period_id,
    organizational_unit_id = null,
    academic_year,
    created_by,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO schedule_adjustment_reports (
                    reporting_period_id,
                    organizational_unit_id,
                    academic_year,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `,
      [
        Number(reporting_period_id),
        organizational_unit_id === null ? null : Number(organizational_unit_id),
        academic_year.trim(),
        Number(created_by),
        Number(updated_by),
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.put("/reports/:id", validateId, async (req, res, next) => {
  const errors = validateAdjustmentReport(req.body, "put");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    reporting_period_id,
    organizational_unit_id = null,
    academic_year,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                UPDATE schedule_adjustment_reports
                SET
                    reporting_period_id = $1,
                    organizational_unit_id = $2,
                    academic_year = $3,
                    updated_by = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `,
      [
        Number(reporting_period_id),
        organizational_unit_id === null ? null : Number(organizational_unit_id),
        academic_year.trim(),
        Number(updated_by),
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Izvješće o prilagodbi rasporeda nije pronađeno.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.patch("/reports/:id", validateId, async (req, res, next) => {
  const allowedFields = [
    "reporting_period_id",
    "organizational_unit_id",
    "academic_year",
    "updated_by",
  ];

  const fieldErrors = validateAllowedFields(req.body, allowedFields);

  if (fieldErrors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors: fieldErrors,
    });
  }

  const errors = validateAdjustmentReport(req.body, "patch");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const result = await patchRecord(
      "schedule_adjustment_reports",
      req.body,
      req.resourceId,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Izvješće o prilagodbi rasporeda nije pronađeno.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.delete("/reports/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                DELETE FROM schedule_adjustment_reports
                WHERE id = $1
                RETURNING id
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Izvješće o prilagodbi rasporeda nije pronađeno.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.get("/measures", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT *
            FROM schedule_adjustment_measures
            ORDER BY created_at DESC
        `);

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/measures/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                SELECT *
                FROM schedule_adjustment_measures
                WHERE id = $1
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Mjera prilagodbe nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/measures", async (req, res, next) => {
  const errors = validateMeasure(req.body, "create");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    report_id,
    measure_type,
    measure_description = null,
    beneficiary_count = null,
    released_hours_per_week = null,
    application_period = null,
    status = null,
    created_by,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO schedule_adjustment_measures (
                    report_id,
                    measure_type,
                    measure_description,
                    beneficiary_count,
                    released_hours_per_week,
                    application_period,
                    status,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `,
      [
        Number(report_id),
        measure_type.trim(),
        measure_description?.trim() || null,
        beneficiary_count === null ? null : Number(beneficiary_count),
        released_hours_per_week === null
          ? null
          : Number(released_hours_per_week),
        application_period?.trim() || null,
        status?.trim() || null,
        Number(created_by),
        Number(updated_by),
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.put("/measures/:id", validateId, async (req, res, next) => {
  const errors = validateMeasure(req.body, "put");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    report_id,
    measure_type,
    measure_description = null,
    beneficiary_count = null,
    released_hours_per_week = null,
    application_period = null,
    status = null,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                UPDATE schedule_adjustment_measures
                SET
                    report_id = $1,
                    measure_type = $2,
                    measure_description = $3,
                    beneficiary_count = $4,
                    released_hours_per_week = $5,
                    application_period = $6,
                    status = $7,
                    updated_by = $8,
                    updated_at = NOW()
                WHERE id = $9
                RETURNING *
            `,
      [
        Number(report_id),
        measure_type.trim(),
        measure_description?.trim() || null,
        beneficiary_count === null ? null : Number(beneficiary_count),
        released_hours_per_week === null
          ? null
          : Number(released_hours_per_week),
        application_period?.trim() || null,
        status?.trim() || null,
        Number(updated_by),
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Mjera prilagodbe nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.patch("/measures/:id", validateId, async (req, res, next) => {
  const allowedFields = [
    "report_id",
    "measure_type",
    "measure_description",
    "beneficiary_count",
    "released_hours_per_week",
    "application_period",
    "status",
    "updated_by",
  ];

  const fieldErrors = validateAllowedFields(req.body, allowedFields);

  if (fieldErrors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors: fieldErrors,
    });
  }

  const errors = validateMeasure(req.body, "patch");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const result = await patchRecord(
      "schedule_adjustment_measures",
      req.body,
      req.resourceId,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Mjera prilagodbe nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.delete("/measures/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                DELETE FROM schedule_adjustment_measures
                WHERE id = $1
                RETURNING id
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Mjera prilagodbe nije pronađena.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.get("/beneficiaries", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT *
            FROM schedule_adjustment_beneficiaries
            ORDER BY created_at DESC
        `);

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/beneficiaries/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                SELECT *
                FROM schedule_adjustment_beneficiaries
                WHERE id = $1
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Korisnik prilagodbe nije pronađen.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/beneficiaries", async (req, res, next) => {
  const errors = validateBeneficiary(req.body, "create");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    report_id,
    staff_member_id,
    measure_type = null,
    adjustment_reason = null,
    research_project_activity = null,
    released_time = null,
    application_period = null,
    results = null,
    status = null,
    created_by,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO schedule_adjustment_beneficiaries (
                    report_id,
                    staff_member_id,
                    measure_type,
                    adjustment_reason,
                    research_project_activity,
                    released_time,
                    application_period,
                    results,
                    status,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11
                )
                RETURNING *
            `,
      [
        Number(report_id),
        Number(staff_member_id),
        measure_type?.trim() || null,
        adjustment_reason?.trim() || null,
        research_project_activity?.trim() || null,
        released_time?.trim() || null,
        application_period?.trim() || null,
        results?.trim() || null,
        status?.trim() || null,
        Number(created_by),
        Number(updated_by),
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.put("/beneficiaries/:id", validateId, async (req, res, next) => {
  const errors = validateBeneficiary(req.body, "put");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    report_id,
    staff_member_id,
    measure_type = null,
    adjustment_reason = null,
    research_project_activity = null,
    released_time = null,
    application_period = null,
    results = null,
    status = null,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                UPDATE schedule_adjustment_beneficiaries
                SET
                    report_id = $1,
                    staff_member_id = $2,
                    measure_type = $3,
                    adjustment_reason = $4,
                    research_project_activity = $5,
                    released_time = $6,
                    application_period = $7,
                    results = $8,
                    status = $9,
                    updated_by = $10,
                    updated_at = NOW()
                WHERE id = $11
                RETURNING *
            `,
      [
        Number(report_id),
        Number(staff_member_id),
        measure_type?.trim() || null,
        adjustment_reason?.trim() || null,
        research_project_activity?.trim() || null,
        released_time?.trim() || null,
        application_period?.trim() || null,
        results?.trim() || null,
        status?.trim() || null,
        Number(updated_by),
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Korisnik prilagodbe nije pronađen.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.patch("/beneficiaries/:id", validateId, async (req, res, next) => {
  const allowedFields = [
    "report_id",
    "staff_member_id",
    "measure_type",
    "adjustment_reason",
    "research_project_activity",
    "released_time",
    "application_period",
    "results",
    "status",
    "updated_by",
  ];

  const fieldErrors = validateAllowedFields(req.body, allowedFields);

  if (fieldErrors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors: fieldErrors,
    });
  }

  const errors = validateBeneficiary(req.body, "patch");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const result = await patchRecord(
      "schedule_adjustment_beneficiaries",
      req.body,
      req.resourceId,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Korisnik prilagodbe nije pronađen.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.delete("/beneficiaries/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                DELETE FROM schedule_adjustment_beneficiaries
                WHERE id = $1
                RETURNING id
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Korisnik prilagodbe nije pronađen.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.get("/planned", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT *
            FROM planned_schedule_adjustments
            ORDER BY created_at DESC
        `);

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/planned/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                SELECT *
                FROM planned_schedule_adjustments
                WHERE id = $1
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Planirana prilagodba nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/planned", async (req, res, next) => {
  const errors = validatePlannedAdjustment(req.body, "create");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    report_id,
    staff_member_id,
    planned_measure = null,
    reason = null,
    planned_period = null,
    expected_results = null,
    created_by,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO planned_schedule_adjustments (
                    report_id,
                    staff_member_id,
                    planned_measure,
                    reason,
                    planned_period,
                    expected_results,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
      [
        Number(report_id),
        Number(staff_member_id),
        planned_measure?.trim() || null,
        reason?.trim() || null,
        planned_period?.trim() || null,
        expected_results?.trim() || null,
        Number(created_by),
        Number(updated_by),
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.put("/planned/:id", validateId, async (req, res, next) => {
  const errors = validatePlannedAdjustment(req.body, "put");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    report_id,
    staff_member_id,
    planned_measure = null,
    reason = null,
    planned_period = null,
    expected_results = null,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                UPDATE planned_schedule_adjustments
                SET
                    report_id = $1,
                    staff_member_id = $2,
                    planned_measure = $3,
                    reason = $4,
                    planned_period = $5,
                    expected_results = $6,
                    updated_by = $7,
                    updated_at = NOW()
                WHERE id = $8
                RETURNING *
            `,
      [
        Number(report_id),
        Number(staff_member_id),
        planned_measure?.trim() || null,
        reason?.trim() || null,
        planned_period?.trim() || null,
        expected_results?.trim() || null,
        Number(updated_by),
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Planirana prilagodba nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.patch("/planned/:id", validateId, async (req, res, next) => {
  const allowedFields = [
    "report_id",
    "staff_member_id",
    "planned_measure",
    "reason",
    "planned_period",
    "expected_results",
    "updated_by",
  ];

  const fieldErrors = validateAllowedFields(req.body, allowedFields);

  if (fieldErrors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors: fieldErrors,
    });
  }

  const errors = validatePlannedAdjustment(req.body, "patch");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const result = await patchRecord(
      "planned_schedule_adjustments",
      req.body,
      req.resourceId,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Planirana prilagodba nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.delete("/planned/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                DELETE FROM planned_schedule_adjustments
                WHERE id = $1
                RETURNING id
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Planirana prilagodba nije pronađena.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.get("/effect-analyses", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT *
            FROM schedule_adjustment_effect_analyses
            ORDER BY created_at DESC
        `);

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/effect-analyses/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                SELECT *
                FROM schedule_adjustment_effect_analyses
                WHERE id = $1
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Analiza učinka nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/effect-analyses", async (req, res, next) => {
  const errors = validateEffectAnalysis(req.body, "create");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    report_id,
    adjusted_teacher_count = 0,
    submitted_research_project_count = 0,
    published_paper_count = 0,
    q1_q2_paper_count = 0,
    released_research_hours = 0,
    average_productivity_increase_percent = null,
    created_by,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO schedule_adjustment_effect_analyses (
                    report_id,
                    adjusted_teacher_count,
                    submitted_research_project_count,
                    published_paper_count,
                    q1_q2_paper_count,
                    released_research_hours,
                    average_productivity_increase_percent,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `,
      [
        Number(report_id),
        Number(adjusted_teacher_count),
        Number(submitted_research_project_count),
        Number(published_paper_count),
        Number(q1_q2_paper_count),
        Number(released_research_hours),
        average_productivity_increase_percent === null
          ? null
          : Number(average_productivity_increase_percent),
        Number(created_by),
        Number(updated_by),
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.put("/effect-analyses/:id", validateId, async (req, res, next) => {
  const errors = validateEffectAnalysis(req.body, "put");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    report_id,
    adjusted_teacher_count = 0,
    submitted_research_project_count = 0,
    published_paper_count = 0,
    q1_q2_paper_count = 0,
    released_research_hours = 0,
    average_productivity_increase_percent = null,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                UPDATE schedule_adjustment_effect_analyses
                SET
                    report_id = $1,
                    adjusted_teacher_count = $2,
                    submitted_research_project_count = $3,
                    published_paper_count = $4,
                    q1_q2_paper_count = $5,
                    released_research_hours = $6,
                    average_productivity_increase_percent = $7,
                    updated_by = $8,
                    updated_at = NOW()
                WHERE id = $9
                RETURNING *
            `,
      [
        Number(report_id),
        Number(adjusted_teacher_count),
        Number(submitted_research_project_count),
        Number(published_paper_count),
        Number(q1_q2_paper_count),
        Number(released_research_hours),
        average_productivity_increase_percent === null
          ? null
          : Number(average_productivity_increase_percent),
        Number(updated_by),
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Analiza učinka nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.patch("/effect-analyses/:id", validateId, async (req, res, next) => {
  const allowedFields = [
    "report_id",
    "adjusted_teacher_count",
    "submitted_research_project_count",
    "published_paper_count",
    "q1_q2_paper_count",
    "released_research_hours",
    "average_productivity_increase_percent",
    "updated_by",
  ];

  const fieldErrors = validateAllowedFields(req.body, allowedFields);

  if (fieldErrors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors: fieldErrors,
    });
  }

  const errors = validateEffectAnalysis(req.body, "patch");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const result = await patchRecord(
      "schedule_adjustment_effect_analyses",
      req.body,
      req.resourceId,
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Analiza učinka nije pronađena." });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.delete("/effect-analyses/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                DELETE FROM schedule_adjustment_effect_analyses
                WHERE id = $1
                RETURNING id
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Analiza učinka nije pronađena." });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

export default router;