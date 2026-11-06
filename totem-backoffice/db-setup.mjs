import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL in .env.local before preparing the database.");

const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
  const schema = await readFile(new URL("../database/postgres/create-schema.sql", import.meta.url), "utf8");
  await client.query("BEGIN");
  try {
    await client.query(schema);
    await client.query("COMMIT");
    console.log("PostgreSQL schema and Totem baseline are ready.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  client.release();
  await pool.end();
}
