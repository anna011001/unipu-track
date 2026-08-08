import express from "express";
import pool from "../db/pool.js";
import { validateId } from "../middleware/validateId.js";

const router = express.Router();

const allowedTargetGroups = [
  "STUDENTS",
  "TEACHERS",
  "PUBLIC",
  "EMPLOYEES",
  "DOCTORAL_STUDENTS",
];

function isPositiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0;
}

function isIntegerInRange(value, min, max) {
  const number = Number(value);

  return Number.isInteger(number) && number >= min && number <= max;
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

function validateOptionalDate(body, field, label, errors) {
  if (body[field] === undefined || body[field] === null) {
    return;
  }

  if (!isValidDate(body[field])) {
    errors.push(`${label} mora biti u formatu YYYY-MM-DD.`);
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
    "leader_signature_file_id",
    "workshop_id",
    "participant_count",
    "duration_hours",
    "created_by",
    "updated_by",
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
      message: "Zapis s tim povezanim podacima već postoji.",
    });
  }

  if (error.code === "23514") {
    return res.status(400).json({
      message: "Podaci krše pravila baze podataka.",
    });
  }

  return next(error);
}

function validateWorkshop(body, mode = "create") {
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

  validateRequiredText(
    body,
    "workshop_name",
    "Naziv radionice",
    250,
    errors,
    !partial,
  );

  validateOptionalText(
    body,
    "workshop_leaders",
    "Voditelji radionice",
    null,
    errors,
  );

  validateNullableId(body, "organizational_unit_id", "ID sastavnice", errors);

  if (!partial || body.target_group !== undefined) {
    if (!allowedTargetGroups.includes(body.target_group)) {
      errors.push(
        `Ciljna skupina mora biti: ${allowedTargetGroups.join(", ")}.`,
      );
    }
  }

  validateOptionalInteger(
    body,
    "participant_count",
    "Broj sudionika",
    0,
    9999,
    errors,
  );

  validateOptionalText(body, "location", "Mjesto održavanja", 150, errors);

  validateOptionalDate(body, "held_on", "Datum održavanja", errors);

  validateOptionalInteger(
    body,
    "duration_hours",
    "Trajanje u satima",
    0,
    999,
    errors,
  );

  validateOptionalText(
    body,
    "content_description",
    "Opis sadržaja",
    null,
    errors,
  );

  validateNullableId(
    body,
    "leader_signature_file_id",
    "ID datoteke potpisa voditelja",
    errors,
  );

  validateOptionalText(body, "media_link", "Poveznica na medij", null, errors);

  validateOptionalText(body, "notes", "Napomene", null, errors);

  validateAuditFields(body, mode, errors);

  return errors;
}

function validateWorkshopDetails(body, mode = "create") {
  const errors = validateBody(body);

  if (errors.length > 0) {
    return errors;
  }

  const partial = mode === "patch";

  validateRequiredId(body, "workshop_id", "ID radionice", errors, !partial);

  validateOptionalText(body, "goals", "Ciljevi", null, errors);

  validateOptionalText(
    body,
    "learning_outcomes",
    "Ishodi učenja",
    null,
    errors,
  );

  validateOptionalText(body, "work_methods", "Metode rada", null, errors);

  validateOptionalText(
    body,
    "materials_resources",
    "Materijali i resursi",
    null,
    errors,
  );

  validateOptionalText(body, "evaluation", "Evaluacija", null, errors);

  validateAuditFields(body, mode, errors);

  return errors;
}

function validateWorkshopMedia(body, mode = "create") {
  const errors = validateBody(body);

  if (errors.length > 0) {
    return errors;
  }

  const partial = mode === "patch";

  validateNullableId(body, "workshop_id", "ID radionice", errors);

  validateRequiredText(
    body,
    "workshop_name",
    "Naziv radionice",
    250,
    errors,
    !partial,
  );

  validateOptionalText(body, "media_type", "Vrsta medija", 80, errors);

  validateRequiredText(
    body,
    "media_link",
    "Poveznica na medij",
    null,
    errors,
    !partial,
  );

  validateOptionalDate(body, "published_on", "Datum objave", errors);

  validateAuditFields(body, mode, errors);

  return errors;
}

router.get("/details", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT
                wd.*,
                w.workshop_name
            FROM workshop_details wd
            JOIN workshops w
                ON w.id = wd.workshop_id
            ORDER BY wd.created_at DESC
        `);

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/details/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                    SELECT
                        wd.*,
                        w.workshop_name
                    FROM workshop_details wd
                    JOIN workshops w
                        ON w.id = wd.workshop_id
                    WHERE wd.id = $1
                `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Detalji radionice nisu pronađeni.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/details", async (req, res, next) => {
  const errors = validateWorkshopDetails(req.body, "create");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    workshop_id,
    goals = null,
    learning_outcomes = null,
    work_methods = null,
    materials_resources = null,
    evaluation = null,
    created_by,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO workshop_details (
                    workshop_id,
                    goals,
                    learning_outcomes,
                    work_methods,
                    materials_resources,
                    evaluation,
                    created_by,
                    updated_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
      [
        Number(workshop_id),
        goals?.trim() || null,
        learning_outcomes?.trim() || null,
        work_methods?.trim() || null,
        materials_resources?.trim() || null,
        evaluation?.trim() || null,
        Number(created_by),
        Number(updated_by),
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.put("/details/:id", validateId, async (req, res, next) => {
  const errors = validateWorkshopDetails(req.body, "put");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    workshop_id,
    goals = null,
    learning_outcomes = null,
    work_methods = null,
    materials_resources = null,
    evaluation = null,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                    UPDATE workshop_details
                    SET
                        workshop_id = $1,
                        goals = $2,
                        learning_outcomes = $3,
                        work_methods = $4,
                        materials_resources = $5,
                        evaluation = $6,
                        updated_by = $7,
                        updated_at = NOW()
                    WHERE id = $8
                    RETURNING *
                `,
      [
        Number(workshop_id),
        goals?.trim() || null,
        learning_outcomes?.trim() || null,
        work_methods?.trim() || null,
        materials_resources?.trim() || null,
        evaluation?.trim() || null,
        Number(updated_by),
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Detalji radionice nisu pronađeni.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.patch("/details/:id", validateId, async (req, res, next) => {
  const allowedFields = [
    "workshop_id",
    "goals",
    "learning_outcomes",
    "work_methods",
    "materials_resources",
    "evaluation",
    "updated_by",
  ];

  const fieldErrors = validateAllowedFields(req.body, allowedFields);

  if (fieldErrors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors: fieldErrors,
    });
  }

  const errors = validateWorkshopDetails(req.body, "patch");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const result = await patchRecord(
      "workshop_details",
      req.body,
      req.resourceId,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Detalji radionice nisu pronađeni.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.delete("/details/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                    DELETE FROM workshop_details
                    WHERE id = $1
                    RETURNING id
                `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Detalji radionice nisu pronađeni.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.get("/media", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT
                wm.*,
                w.workshop_name AS linked_workshop_name
            FROM workshop_media wm
            LEFT JOIN workshops w
                ON w.id = wm.workshop_id
            ORDER BY
                wm.published_on DESC NULLS LAST,
                wm.created_at DESC
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
                        wm.*,
                        w.workshop_name
                            AS linked_workshop_name
                    FROM workshop_media wm
                    LEFT JOIN workshops w
                        ON w.id = wm.workshop_id
                    WHERE wm.id = $1
                `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Medijska objava radionice nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/media", async (req, res, next) => {
  const errors = validateWorkshopMedia(req.body, "create");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    workshop_id = null,
    workshop_name,
    media_type = null,
    media_link,
    published_on = null,
    created_by,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO workshop_media (
                    workshop_id,
                    workshop_name,
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
        workshop_id === null ? null : Number(workshop_id),
        workshop_name.trim(),
        media_type?.trim() || null,
        media_link.trim(),
        published_on,
        Number(created_by),
        Number(updated_by),
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.put("/media/:id", validateId, async (req, res, next) => {
  const errors = validateWorkshopMedia(req.body, "put");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    workshop_id = null,
    workshop_name,
    media_type = null,
    media_link,
    published_on = null,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                    UPDATE workshop_media
                    SET
                        workshop_id = $1,
                        workshop_name = $2,
                        media_type = $3,
                        media_link = $4,
                        published_on = $5,
                        updated_by = $6,
                        updated_at = NOW()
                    WHERE id = $7
                    RETURNING *
                `,
      [
        workshop_id === null ? null : Number(workshop_id),
        workshop_name.trim(),
        media_type?.trim() || null,
        media_link.trim(),
        published_on,
        Number(updated_by),
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Medijska objava radionice nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.patch("/media/:id", validateId, async (req, res, next) => {
  const allowedFields = [
    "workshop_id",
    "workshop_name",
    "media_type",
    "media_link",
    "published_on",
    "updated_by",
  ];

  const fieldErrors = validateAllowedFields(req.body, allowedFields);

  if (fieldErrors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors: fieldErrors,
    });
  }

  const errors = validateWorkshopMedia(req.body, "patch");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const result = await patchRecord(
      "workshop_media",
      req.body,
      req.resourceId,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Medijska objava radionice nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.delete("/media/:id", validateId, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
                    DELETE FROM workshop_media
                    WHERE id = $1
                    RETURNING id
                `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Medijska objava radionice nije pronađena.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`
            SELECT
                w.*,
                ou.name AS organizational_unit_name,
                rf.file_name AS leader_signature_file_name,
                rf.storage_path AS leader_signature_storage_path
            FROM workshops w
            LEFT JOIN organizational_units ou
                ON ou.id = w.organizational_unit_id
            LEFT JOIN record_files rf
                ON rf.id = w.leader_signature_file_id
            ORDER BY
                w.held_on DESC NULLS LAST,
                w.created_at DESC
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
                    w.*,
                    ou.name AS organizational_unit_name,
                    rf.file_name AS leader_signature_file_name,
                    rf.storage_path
                        AS leader_signature_storage_path
                FROM workshops w
                LEFT JOIN organizational_units ou
                    ON ou.id = w.organizational_unit_id
                LEFT JOIN record_files rf
                    ON rf.id = w.leader_signature_file_id
                WHERE w.id = $1
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Radionica nije pronađena.",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const errors = validateWorkshop(req.body, "create");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    reporting_period_id,
    workshop_name,
    workshop_leaders = null,
    organizational_unit_id = null,
    target_group,
    participant_count = null,
    location = null,
    held_on = null,
    duration_hours = null,
    content_description = null,
    leader_signature_file_id = null,
    media_link = null,
    notes = null,
    created_by,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                INSERT INTO workshops (
                    reporting_period_id,
                    workshop_name,
                    workshop_leaders,
                    organizational_unit_id,
                    target_group,
                    participant_count,
                    location,
                    held_on,
                    duration_hours,
                    content_description,
                    leader_signature_file_id,
                    media_link,
                    notes,
                    created_by,
                    updated_by
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15
                )
                RETURNING *
            `,
      [
        Number(reporting_period_id),
        workshop_name.trim(),
        workshop_leaders?.trim() || null,
        organizational_unit_id === null ? null : Number(organizational_unit_id),
        target_group,
        participant_count === null ? null : Number(participant_count),
        location?.trim() || null,
        held_on,
        duration_hours === null ? null : Number(duration_hours),
        content_description?.trim() || null,
        leader_signature_file_id === null
          ? null
          : Number(leader_signature_file_id),
        media_link?.trim() || null,
        notes?.trim() || null,
        Number(created_by),
        Number(updated_by),
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

router.put("/:id", validateId, async (req, res, next) => {
  const errors = validateWorkshop(req.body, "put");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  const {
    reporting_period_id,
    workshop_name,
    workshop_leaders = null,
    organizational_unit_id = null,
    target_group,
    participant_count = null,
    location = null,
    held_on = null,
    duration_hours = null,
    content_description = null,
    leader_signature_file_id = null,
    media_link = null,
    notes = null,
    updated_by,
  } = req.body;

  try {
    const result = await pool.query(
      `
                UPDATE workshops
                SET
                    reporting_period_id = $1,
                    workshop_name = $2,
                    workshop_leaders = $3,
                    organizational_unit_id = $4,
                    target_group = $5,
                    participant_count = $6,
                    location = $7,
                    held_on = $8,
                    duration_hours = $9,
                    content_description = $10,
                    leader_signature_file_id = $11,
                    media_link = $12,
                    notes = $13,
                    updated_by = $14,
                    updated_at = NOW()
                WHERE id = $15
                RETURNING *
            `,
      [
        Number(reporting_period_id),
        workshop_name.trim(),
        workshop_leaders?.trim() || null,
        organizational_unit_id === null ? null : Number(organizational_unit_id),
        target_group,
        participant_count === null ? null : Number(participant_count),
        location?.trim() || null,
        held_on,
        duration_hours === null ? null : Number(duration_hours),
        content_description?.trim() || null,
        leader_signature_file_id === null
          ? null
          : Number(leader_signature_file_id),
        media_link?.trim() || null,
        notes?.trim() || null,
        Number(updated_by),
        req.resourceId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Radionica nije pronađena.",
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
    "workshop_name",
    "workshop_leaders",
    "organizational_unit_id",
    "target_group",
    "participant_count",
    "location",
    "held_on",
    "duration_hours",
    "content_description",
    "leader_signature_file_id",
    "media_link",
    "notes",
    "updated_by",
  ];

  const fieldErrors = validateAllowedFields(req.body, allowedFields);

  if (fieldErrors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors: fieldErrors,
    });
  }

  const errors = validateWorkshop(req.body, "patch");

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Podaci nisu ispravni.",
      errors,
    });
  }

  try {
    const result = await patchRecord("workshops", req.body, req.resourceId);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Radionica nije pronađena.",
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
                DELETE FROM workshops
                WHERE id = $1
                RETURNING id
            `,
      [req.resourceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Radionica nije pronađena.",
      });
    }

    return res.status(204).send();
  } catch (error) {
    return handleDatabaseError(error, res, next);
  }
});

export default router;