import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/pool.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'UNIPU Track API is running.'
    });
});

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
            NOW() AS database_time,
            current_database() AS database_name
        `);

        res.json({
            status: 'ok',
            database: result.rows[0]
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: 'error',
            message: 'Not possible to connect to db.'
        });
    }
});

app.listen(port, () => {
    console.log(`UNIPU Track API is listening on port ${port}.`);
});