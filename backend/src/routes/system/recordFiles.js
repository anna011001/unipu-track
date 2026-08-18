import express from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();
const uploadsDirectory = fileURLToPath(
    new URL("../../../uploads/", import.meta.url)
);

fs.mkdirSync(uploadsDirectory, { recursive: true });

const allowedMimeTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png"
]);

const upload = multer({
    storage: multer.diskStorage({
        destination: uploadsDirectory,
        filename(req, file, callback) {
            const extension = path.extname(file.originalname).toLowerCase();
            callback(null, `${randomUUID()}${extension}`);
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    },
    fileFilter(req, file, callback) {
        if (!allowedMimeTypes.has(file.mimetype)) {
            return callback(
                new Error(
                    "Dopuštene su PDF, Word, PNG i JPG datoteke."
                )
            );
        }

        callback(null, true);
    }
});

function receiveFile(req, res, next) {
    upload.single("file")(req, res, error => {
        if (!error) {
            return next();
        }

        const message = error instanceof multer.MulterError &&
            error.code === "LIMIT_FILE_SIZE"
            ? "Datoteka smije imati najviše 10 MB."
            : error.message;

        return res.status(400).json({ message });
    });
}

async function removeUploadedFile(filePath) {
    if (!filePath) return;

    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}

function isPositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
}

function isIntegerInRange(value, min, max) {
    const number = Number(value);

    return (
        Number.isInteger(number) && number >= min && number <= max
    );
}

function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
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

    if (typeof body[field] !== "string" || body[field].trim() === "") {
        errors.push(`${label} mora biti neprazan tekst.`);
        return;
    }

    if (maxLength && body[field].trim().length > maxLength) {
        errors.push(`${label} smije imati najviše ${maxLength} znakova.`);
    }
}

function validateOptionalText(
    body,
    field,
    label,
    maxLength,
    errors
) {
    if (body[field] === undefined || body[field] === null) return;

    if (typeof body[field] !== "string") {
        errors.push(`${label} mora biti tekst.`);
        return;
    }

    if (maxLength && body[field].trim().length > maxLength) {
        errors.push(
            `${label} smije imati najviše ${maxLength} znakova.`
        );
    }
}

function validateFile(body, mode) {
    const errors = [];
    const partial = mode === "patch";

    validateRequiredText(
        body,
        "record_type",
        "Vrsta zapisa",
        30,
        errors,
        !partial
    );

    if ((!partial || body.record_id !== undefined) && !isPositiveInteger(body.record_id)) {
        errors.push(
            "ID zapisa mora biti pozitivan cijeli broj."
        );
    }

    validateOptionalText(
        body,
        "file_role",
        "Uloga datoteke",
        30,
        errors
    );

    validateRequiredText(
        body,
        "file_name",
        "Naziv datoteke",
        50,
        errors,
        !partial
    );

    validateRequiredText(
        body,
        "storage_path",
        "Putanja datoteke",
        null,
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "mime_type",
        "MIME tip",
        50,
        errors
    );

    if (
        body.file_size_bytes !== undefined &&
        body.file_size_bytes !== null &&
        !isIntegerInRange(
            body.file_size_bytes,
            0,
            2147483647
        )
    ) {
        errors.push(
            "Veličina datoteke mora biti cijeli broj između 0 i 2147483647."
        );
    }

    if ((!partial || body.uploaded_by !== undefined) && !isPositiveInteger(body.uploaded_by)) {
        errors.push("ID korisnika koji je učitao datoteku mora biti pozitivan cijeli broj.");
    }

    return errors;
}

function validateSignature(body, mode) {
    const errors = [];
    const partial = mode === "patch";

    validateRequiredText(
        body,
        "record_type",
        "Vrsta zapisa",
        60,
        errors,
        !partial
    );

    if (
        (!partial || body.record_id !== undefined) &&
        !isPositiveInteger(body.record_id)
    ) {
        errors.push(
            "ID zapisa mora biti pozitivan cijeli broj."
        );
    }

    validateRequiredText(
        body,
        "signer_role",
        "Uloga potpisnika",
        40,
        errors,
        !partial
    );

    validateOptionalText(
        body,
        "signer_name",
        "Ime potpisnika",
        40,
        errors
    );

    if (
        body.signed_on !== undefined &&
        body.signed_on !== null &&
        !isValidDate(body.signed_on)
    ) {
        errors.push(
            "Datum potpisa mora biti u formatu YYYY-MM-DD."
        );
    }

    if (
        body.signature_file_id !== undefined &&
        body.signature_file_id !== null &&
        !isPositiveInteger(body.signature_file_id)
    ) {
        errors.push("ID datoteke potpisa mora biti pozitivan cijeli broj ili null.");
    }

    return errors;
}

function handleDatabaseError(error, res, next) {
    if (error.code === "23503") {
        return res.status(400).json({message: "Jedan od navedenih povezanih zapisa ne postoji."});
    }

    if (error.code === "23514") {
        return res.status(400).json({message: "Podaci krše pravila baze podataka."});
    }

    return next(error);
}

router.get("/files", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM record_files
            ORDER BY created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.post("/files/upload", receiveFile, async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            message: "Datoteka je obavezna."
        });
    }

    const fileData = {
        record_type: req.body.record_type,
        record_id: req.body.record_id,
        file_role: req.body.file_role || null,
        file_name: req.file.originalname,
        storage_path: `/uploads/${req.file.filename}`,
        mime_type: req.file.mimetype,
        file_size_bytes: req.file.size,
        uploaded_by: req.body.uploaded_by
    };
    const errors = validateFile(fileData, "create");

    if (errors.length > 0) {
        await removeUploadedFile(req.file.path);

        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    try {
        const result = await pool.query(
            `
                INSERT INTO record_files (
                    record_type,
                    record_id,
                    file_role,
                    file_name,
                    storage_path,
                    mime_type,
                    file_size_bytes,
                    uploaded_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                fileData.record_type.trim(),
                Number(fileData.record_id),
                fileData.file_role?.trim() || null,
                fileData.file_name.trim(),
                fileData.storage_path,
                fileData.mime_type,
                Number(fileData.file_size_bytes),
                Number(fileData.uploaded_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        await removeUploadedFile(req.file.path);
        return handleDatabaseError(error, res, next);
    }
});

router.get("/files/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM record_files
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Datoteka nije pronađena."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/files", async (req, res, next) => {
    const errors = validateFile(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        record_type,
        record_id,
        file_role = null,
        file_name,
        storage_path,
        mime_type = null,
        file_size_bytes = null,
        uploaded_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO record_files (
                    record_type,
                    record_id,
                    file_role,
                    file_name,
                    storage_path,
                    mime_type,
                    file_size_bytes,
                    uploaded_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                record_type.trim(),
                Number(record_id),
                file_role?.trim() || null,
                file_name.trim(),
                storage_path.trim(),
                mime_type?.trim() || null,
                file_size_bytes === null
                    ? null
                    : Number(file_size_bytes),
                Number(uploaded_by)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/files/:id", validateId, async (req, res, next) => {
    const errors = validateFile(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        record_type,
        record_id,
        file_role = null,
        file_name,
        storage_path,
        mime_type = null,
        file_size_bytes = null,
        uploaded_by
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE record_files
                SET
                    record_type = $1,
                    record_id = $2,
                    file_role = $3,
                    file_name = $4,
                    storage_path = $5,
                    mime_type = $6,
                    file_size_bytes = $7,
                    uploaded_by = $8
                WHERE id = $9
                RETURNING *
            `,
            [
                record_type.trim(),
                Number(record_id),
                file_role?.trim() || null,
                file_name.trim(),
                storage_path.trim(),
                mime_type?.trim() || null,
                file_size_bytes === null ? null : Number(file_size_bytes),
                Number(uploaded_by),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Datoteka nije pronađena."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/files/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "record_type",
        "record_id",
        "file_role",
        "file_name",
        "storage_path",
        "mime_type",
        "file_size_bytes",
        "uploaded_by"
    ];

    const fields = Object.keys(req.body ?? {});

    if (fields.length === 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: ["Niste poslali nijedno polje za izmjenu."]
        });
    }

    const invalidFields = fields.filter(
        field => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: [
                `Nedopuštena polja: ${invalidFields.join(", ")}`
            ]
        });
    }

    const errors = validateFile(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const values = [];
    const updates = [];

    for (const field of fields) {
        let value = req.body[field];

        if (
            ["record_id", "file_size_bytes", "uploaded_by"].includes(field) &&
            value !== null
        ) {
            value = Number(value);
        }

        if (typeof value === "string") {
            value = value.trim() || null;
        }

        values.push(value);
        updates.push(`${field} = $${values.length}`);
    }

    values.push(req.resourceId);

    try {
        const result = await pool.query(
            `
                UPDATE record_files
                SET ${updates.join(", ")}
                WHERE id = $${values.length}
                RETURNING *
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Datoteka nije pronađena."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/files/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM record_files
                WHERE id = $1
                RETURNING id, storage_path
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Datoteka nije pronađena."});
        }

        const storagePath = result.rows[0].storage_path;

        if (storagePath?.startsWith("/uploads/")) {
            const storedFileName = path.basename(storagePath);
            await removeUploadedFile(
                path.join(uploadsDirectory, storedFileName)
            );
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.get("/signatures", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM record_signatures
            ORDER BY created_at DESC
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/signatures/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM record_signatures
                WHERE id = $1
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Potpis nije pronađen."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

router.post("/signatures", async (req, res, next) => {
    const errors = validateSignature(req.body, "create");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        record_type,
        record_id,
        signer_role,
        signer_name = null,
        signed_on = null,
        signature_file_id = null
    } = req.body;

    try {
        const result = await pool.query(
            `
                INSERT INTO record_signatures (
                    record_type,
                    record_id,
                    signer_role,
                    signer_name,
                    signed_on,
                    signature_file_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `,
            [
                record_type.trim(),
                Number(record_id),
                signer_role.trim(),
                signer_name?.trim() || null,
                signed_on,
                signature_file_id === null ? null : Number(signature_file_id)
            ]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.put("/signatures/:id", validateId, async (req, res, next) => {
    const errors = validateSignature(req.body, "put");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const {
        record_type,
        record_id,
        signer_role,
        signer_name = null,
        signed_on = null,
        signature_file_id = null
    } = req.body;

    try {
        const result = await pool.query(
            `
                UPDATE record_signatures
                SET
                    record_type = $1,
                    record_id = $2,
                    signer_role = $3,
                    signer_name = $4,
                    signed_on = $5,
                    signature_file_id = $6
                WHERE id = $7
                RETURNING *
            `,
            [
                record_type.trim(),
                Number(record_id),
                signer_role.trim(),
                signer_name?.trim() || null,
                signed_on,
                signature_file_id === null ? null : Number(signature_file_id),
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Potpis nije pronađen."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.patch("/signatures/:id", validateId, async (req, res, next) => {
    const allowedFields = [
        "record_type",
        "record_id",
        "signer_role",
        "signer_name",
        "signed_on",
        "signature_file_id"
    ];

    const fields = Object.keys(req.body ?? {});

    if (fields.length === 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: ["Niste poslali nijedno polje za izmjenu."]
        });
    }

    const invalidFields = fields.filter(
        field => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors: [`Nedopuštena polja: ${invalidFields.join(", ")}`]
        });
    }

    const errors = validateSignature(req.body, "patch");

    if (errors.length > 0) {
        return res.status(400).json({
            message: "Podaci nisu ispravni.",
            errors
        });
    }

    const values = [];
    const updates = [];

    for (const field of fields) {
        let value = req.body[field];

        if (
            ["record_id", "signature_file_id"].includes(field) &&
            value !== null
        ) {
            value = Number(value);
        }

        if (typeof value === "string") {
            value = value.trim() || null;
        }

        values.push(value);
        updates.push(`${field} = $${values.length}`);
    }

    values.push(req.resourceId);

    try {
        const result = await pool.query(
            `
                UPDATE record_signatures
                SET ${updates.join(", ")}
                WHERE id = $${values.length}
                RETURNING *
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Potpis nije pronađen."});
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

router.delete("/signatures/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query(
            `
                DELETE FROM record_signatures
                WHERE id = $1
                RETURNING id
            `,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: "Potpis nije pronađen."});
        }

        return res.status(204).send();
    } catch (error) {
        return handleDatabaseError(error, res, next);
    }
});

export default router;
