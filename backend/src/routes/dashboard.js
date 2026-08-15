import express from "express";
import pool from "../db/pool.js";

const router = express.Router();

function isPositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
}

router.get("/recent", async (req, res, next) => {
    const { user_id } = req.query;

    if (!isPositiveInteger(user_id)) {
        return res.status(400).json({
            message: "user_id je obavezan i mora biti pozitivan cijeli broj."
        });
    }

    try {
        const result = await pool.query(
            `
                SELECT *
                FROM v_recent_records
                WHERE updated_by = $1
                ORDER BY updated_at DESC
                LIMIT 10
            `,
            [Number(user_id)]
        );

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/filters/memberships", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM v_membership_filter_options
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/filters/professional-developments", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM v_professional_development_filter_options
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/filters/event-participations", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM v_event_participation_filter_options
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/filters/workshops", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM v_workshop_filter_options
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

router.get("/filters/projects", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM v_project_filter_options
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
});

export default router;