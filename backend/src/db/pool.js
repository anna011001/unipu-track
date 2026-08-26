import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
    path: fileURLToPath(new URL("../../.env.local", import.meta.url))
});
dotenv.config({
    path: fileURLToPath(new URL("../../.env", import.meta.url))
});

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: "-c search_path=unipu_track,public",
    ...(process.env.DATABASE_SSL === "true" && {
        ssl: { rejectUnauthorized: false }
    })
});

pool.on("error", error => {
    console.error("PostgreSQL error:", error);
});

export default pool;
