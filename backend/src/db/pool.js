import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: "-c search_path=unipu_track,public"
});

pool.on('error', error => {
    console.error('PostgreSQL error:', error);
});

export default pool;