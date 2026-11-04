import "server-only";
import sql from "mssql";
import { getEnv } from "./env";

declare global { var totemSqlPool: Promise<sql.ConnectionPool> | undefined }

export async function getDb(): Promise<sql.ConnectionPool> {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not configured for this environment.");
  if (!global.totemSqlPool) {
    global.totemSqlPool = new sql.ConnectionPool(DATABASE_URL).connect().catch((error) => {
      global.totemSqlPool = undefined;
      throw error;
    });
  }
  return global.totemSqlPool;
}
export { sql };
