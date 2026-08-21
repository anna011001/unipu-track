import express from "express";
import pool from "../../db/pool.js";
import { validateId } from "../../middleware/validateId.js";

const router = express.Router();

const fields = [
    "reporting_period_id", "staff_member_id", "organizational_unit_id",
    "mobility_type", "program_name", "host_institution",
    "destination_country_id", "start_date", "end_date", "duration_days",
    "mobility_purpose", "activities", "results", "notes"
];

const textLimits = {
    mobility_type: 100,
    program_name: 100,
    host_institution: 200
};

function positiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
}

function validDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validate(body, partial = false) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return ["Tijelo zahtjeva mora biti JSON objekt."];
    }

    const errors = [];
    const allowed = [...fields, "created_by", "updated_by"];
    const invalid = Object.keys(body).filter(field => !allowed.includes(field));
    if (invalid.length) errors.push(`Nedopuštena polja: ${invalid.join(", ")}`);

    for (const [field, label] of [
        ["reporting_period_id", "Izvještajno razdoblje"],
        ["staff_member_id", "Djelatnik"]
    ]) {
        if (!partial && body[field] === undefined) errors.push(`${label} je obavezan.`);
        else if (body[field] !== undefined && !positiveInteger(body[field])) errors.push(`${label} mora biti pozitivan cijeli broj.`);
    }

    for (const [field, label] of [
        ["organizational_unit_id", "Sastavnica"],
        ["destination_country_id", "Država odredišta"]
    ]) {
        if (body[field] !== undefined && body[field] !== null && !positiveInteger(body[field])) errors.push(`${label} mora biti pozitivan cijeli broj ili null.`);
    }

    if (!partial && body.mobility_type === undefined) errors.push("Vrsta mobilnosti je obavezna.");
    if (body.mobility_type !== undefined && (typeof body.mobility_type !== "string" || !body.mobility_type.trim())) errors.push("Vrsta mobilnosti mora biti neprazan tekst.");

    for (const [field, limit] of Object.entries(textLimits)) {
        if (body[field] !== undefined && body[field] !== null && (typeof body[field] !== "string" || body[field].trim().length > limit)) {
            errors.push(`${field} mora biti tekst s najviše ${limit} znakova.`);
        }
    }

    for (const field of ["mobility_purpose", "activities", "results", "notes"]) {
        if (body[field] !== undefined && body[field] !== null && typeof body[field] !== "string") errors.push(`${field} mora biti tekst.`);
    }

    for (const [field, label] of [["start_date", "Datum početka"], ["end_date", "Datum završetka"]]) {
        if (body[field] !== undefined && body[field] !== null && !validDate(body[field])) errors.push(`${label} mora biti u formatu YYYY-MM-DD.`);
    }

    if (body.duration_days !== undefined && body.duration_days !== null) {
        const duration = Number(body.duration_days);
        if (!Number.isInteger(duration) || duration < 0 || duration > 999) errors.push("Trajanje mora biti cijeli broj između 0 i 999 dana.");
    }

    if (body.start_date && body.end_date && body.end_date < body.start_date) errors.push("Datum završetka ne smije biti prije datuma početka.");

    if (!partial && !positiveInteger(body.created_by)) errors.push("ID korisnika koji stvara zapis je obavezan.");
    if (!positiveInteger(body.updated_by)) errors.push("ID korisnika koji uređuje zapis je obavezan.");
    return errors;
}

function normalized(field, value) {
    if (value === null) return null;
    if (["reporting_period_id", "staff_member_id", "organizational_unit_id", "destination_country_id", "duration_days", "created_by", "updated_by"].includes(field)) return Number(value);
    return typeof value === "string" ? value.trim() || null : value;
}

function databaseError(error, res, next) {
    if (error.code === "23503") return res.status(400).json({ message: "Jedan od navedenih povezanih zapisa ne postoji." });
    if (error.code === "23514") return res.status(400).json({ message: "Podaci krše pravila baze podataka." });
    return next(error);
}

function periodId(req, res) {
    if (req.query.reporting_period_id === undefined) return null;
    if (!positiveInteger(req.query.reporting_period_id)) {
        res.status(400).json({ message: "Izvještajno razdoblje mora biti pozitivan cijeli broj." });
        return undefined;
    }
    return Number(req.query.reporting_period_id);
}

router.get("/analyses/units", async (req, res, next) => {
    const reportingPeriodId = periodId(req, res);
    if (reportingPeriodId === undefined) return;
    try {
        const result = await pool.query(`
            WITH employees AS (
                SELECT organizational_unit_id, COUNT(*)::int AS employee_count
                FROM staff_members WHERE is_active = TRUE GROUP BY organizational_unit_id
            ), mobilities AS (
                SELECT organizational_unit_id,
                    COUNT(DISTINCT staff_member_id)::int AS people_in_mobility_count,
                    COUNT(*)::int AS mobility_count,
                    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT staff_member_id), 0), 2) AS average_per_person,
                    COUNT(*) FILTER (WHERE program_name ILIKE '%erasmus%' AND (mobility_type ILIKE '%nastav%' OR mobility_type ILIKE '%teach%'))::int AS erasmus_teaching_count,
                    COUNT(*) FILTER (WHERE program_name ILIKE '%erasmus%' AND (mobility_type ILIKE '%usavr%' OR mobility_type ILIKE '%train%'))::int AS erasmus_training_count,
                    COUNT(*) FILTER (WHERE program_name ILIKE '%ceepus%')::int AS ceepus_count,
                    COUNT(*) FILTER (WHERE program_name ILIKE '%bilateral%')::int AS bilateral_count,
                    COUNT(*) FILTER (WHERE COALESCE(program_name, '') NOT ILIKE '%erasmus%' AND COALESCE(program_name, '') NOT ILIKE '%ceepus%' AND COALESCE(program_name, '') NOT ILIKE '%bilateral%')::int AS other_count,
                    COALESCE(SUM(duration_days), 0)::int AS total_days
                FROM staff_mobilities
                WHERE ($1::int IS NULL OR reporting_period_id = $1)
                GROUP BY organizational_unit_id
            )
            SELECT ou.id AS organizational_unit_id, ou.name AS organizational_unit_name, ou.short_name AS organizational_unit_short_name,
                COALESCE(e.employee_count, 0) AS employee_count,
                COALESCE(m.people_in_mobility_count, 0) AS people_in_mobility_count,
                COALESCE(m.mobility_count, 0) AS mobility_count,
                COALESCE(m.average_per_person, 0) AS average_per_person,
                COALESCE(m.erasmus_teaching_count, 0) AS erasmus_teaching_count,
                COALESCE(m.erasmus_training_count, 0) AS erasmus_training_count,
                COALESCE(m.ceepus_count, 0) AS ceepus_count,
                COALESCE(m.bilateral_count, 0) AS bilateral_count,
                COALESCE(m.other_count, 0) AS other_count,
                COALESCE(m.total_days, 0) AS total_days
            FROM organizational_units ou
            LEFT JOIN employees e ON e.organizational_unit_id = ou.id
            LEFT JOIN mobilities m ON m.organizational_unit_id = ou.id
            ORDER BY ou.name
        `, [reportingPeriodId]);
        return res.status(200).json(result.rows);
    } catch (error) { next(error); }
});

router.get("/analyses/multiple", async (req, res, next) => {
    const reportingPeriodId = periodId(req, res);
    if (reportingPeriodId === undefined) return;
    try {
        const result = await pool.query(`
            SELECT sm.staff_member_id, s.first_name, s.last_name, ou.name AS organizational_unit_name, ou.short_name AS organizational_unit_short_name,
                COUNT(*)::int AS mobility_count, COALESCE(SUM(sm.duration_days), 0)::int AS total_days,
                STRING_AGG(DISTINCT c.name_hr, ', ' ORDER BY c.name_hr) AS countries,
                STRING_AGG(DISTINCT sm.program_name, ', ' ORDER BY sm.program_name) AS programs
            FROM staff_mobilities sm
            JOIN staff_members s ON s.id = sm.staff_member_id
            LEFT JOIN organizational_units ou ON ou.id = sm.organizational_unit_id
            LEFT JOIN countries c ON c.id = sm.destination_country_id
            WHERE ($1::int IS NULL OR sm.reporting_period_id = $1)
            GROUP BY sm.staff_member_id, s.first_name, s.last_name, ou.name, ou.short_name
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC, s.last_name, s.first_name
        `, [reportingPeriodId]);
        return res.status(200).json(result.rows);
    } catch (error) { next(error); }
});

router.get("/analyses/countries", async (req, res, next) => {
    const reportingPeriodId = periodId(req, res);
    if (reportingPeriodId === undefined) return;
    try {
        const result = await pool.query(`
            SELECT sm.destination_country_id AS country_id, c.name_hr AS country_name,
                COUNT(*)::int AS mobility_count, COUNT(DISTINCT sm.staff_member_id)::int AS people_count,
                COALESCE(SUM(sm.duration_days), 0)::int AS total_days,
                MODE() WITHIN GROUP (ORDER BY sm.program_name) FILTER (WHERE sm.program_name IS NOT NULL) AS most_common_program
            FROM staff_mobilities sm
            JOIN countries c ON c.id = sm.destination_country_id
            WHERE ($1::int IS NULL OR sm.reporting_period_id = $1)
            GROUP BY sm.destination_country_id, c.name_hr
            ORDER BY COUNT(*) DESC, c.name_hr
        `, [reportingPeriodId]);
        return res.status(200).json(result.rows);
    } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT sm.*, rp.label AS reporting_period_label,
                s.first_name AS staff_first_name, s.last_name AS staff_last_name, s.academic_title AS staff_academic_title,
                ou.name AS organizational_unit_name, ou.short_name AS organizational_unit_short_name,
                c.name_hr AS destination_country_name
            FROM staff_mobilities sm
            JOIN reporting_periods rp ON rp.id = sm.reporting_period_id
            JOIN staff_members s ON s.id = sm.staff_member_id
            LEFT JOIN organizational_units ou ON ou.id = sm.organizational_unit_id
            LEFT JOIN countries c ON c.id = sm.destination_country_id
            ORDER BY sm.start_date DESC NULLS LAST, sm.updated_at DESC
        `);
        return res.status(200).json(result.rows);
    } catch (error) { next(error); }
});

router.get("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query("SELECT * FROM staff_mobilities WHERE id = $1", [req.resourceId]);
        if (!result.rows.length) return res.status(404).json({ message: "Mobilnost osoblja nije pronađena." });
        return res.status(200).json(result.rows[0]);
    } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ message: "Podaci nisu ispravni.", errors });
    const columns = [...fields, "created_by", "updated_by"];
    try {
        const values = columns.map(field => normalized(field, req.body[field] ?? null));
        const result = await pool.query(`INSERT INTO staff_mobilities (${columns.join(", ")}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING *`, values);
        return res.status(201).json(result.rows[0]);
    } catch (error) { return databaseError(error, res, next); }
});

router.patch("/:id", validateId, async (req, res, next) => {
    const errors = validate(req.body, true);
    if (!Object.keys(req.body || {}).length) errors.push("Niste poslali nijedno polje za izmjenu.");
    if (errors.length) return res.status(400).json({ message: "Podaci nisu ispravni.", errors });
    try {
        const currentResult = await pool.query("SELECT start_date, end_date FROM staff_mobilities WHERE id = $1", [req.resourceId]);
        if (!currentResult.rows.length) return res.status(404).json({ message: "Mobilnost osoblja nije pronađena." });
        const startDate = req.body.start_date !== undefined ? req.body.start_date : currentResult.rows[0].start_date;
        const endDate = req.body.end_date !== undefined ? req.body.end_date : currentResult.rows[0].end_date;
        if (startDate && endDate && String(endDate).slice(0, 10) < String(startDate).slice(0, 10)) return res.status(400).json({ message: "Podaci nisu ispravni.", errors: ["Datum završetka ne smije biti prije datuma početka."] });
        const columns = Object.keys(req.body);
        const values = columns.map(field => normalized(field, req.body[field]));
        values.push(req.resourceId);
        const result = await pool.query(`UPDATE staff_mobilities SET ${columns.map((field, index) => `${field} = $${index + 1}`).join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
        return res.status(200).json(result.rows[0]);
    } catch (error) { return databaseError(error, res, next); }
});

router.delete("/:id", validateId, async (req, res, next) => {
    try {
        const result = await pool.query("DELETE FROM staff_mobilities WHERE id = $1 RETURNING id", [req.resourceId]);
        if (!result.rows.length) return res.status(404).json({ message: "Mobilnost osoblja nije pronađena." });
        return res.status(204).send();
    } catch (error) { return databaseError(error, res, next); }
});

export default router;
