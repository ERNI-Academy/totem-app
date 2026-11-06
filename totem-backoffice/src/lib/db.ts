import "server-only";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { getEnv } from "./env";

declare global { var totemPostgresPool: Pool | undefined }

export function getDb(): Pool {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not configured for this environment.");
  if (!global.totemPostgresPool) {
    global.totemPostgresPool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    global.totemPostgresPool.on("error", (error) => console.error("Unexpected PostgreSQL pool error", error));
  }
  return global.totemPostgresPool;
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type DbClient = Pool | PoolClient;
export type DbResult<T extends QueryResultRow = QueryResultRow> = QueryResult<T>;
