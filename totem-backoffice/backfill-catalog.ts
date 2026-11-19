// Run from totem-backoffice with tsx and the react-server export condition.
import pg from "pg";
import { getDb } from "./src/lib/db";
import { buildWebBundle } from "./src/lib/webPublication";
import { storeArtifact } from "./src/lib/catalogArtifact";

async function backfill() {
  if (process.argv.includes("--azure")) {
    if (!process.env.AZURE_APP_DATABASE_URL || !process.env.AZURE_ADMIN_DATABASE_URL) throw Error("Missing Azure migration configuration.");
    process.env.DATABASE_URL = process.env.AZURE_APP_DATABASE_URL;
    process.env.AZURE_STORAGE_CONTAINER = "totem-media";
    process.env.APP_ENV = "production";
  }
  const ddl = new pg.Client({connectionString:process.argv.includes("--azure") ? process.env.AZURE_ADMIN_DATABASE_URL : process.env.DATABASE_URL});
  await ddl.connect();
  try { await ddl.query("ALTER TABLE visualisation_versions ADD COLUMN IF NOT EXISTS catalog_artifact jsonb"); }
  finally { await ddl.end(); }
  const db = getDb();
  try {
    const {rows} = await db.query(`SELECT latest.* FROM (
      SELECT DISTINCT ON (v.id) p.id, v.name, v.is_protected, p.version_number, p.document_json, p.catalog_artifact
      FROM visualisations v JOIN visualisation_versions p ON p.visualisation_id=v.id
      WHERE NOT v.is_deleted ORDER BY v.id, p.version_number DESC
    ) latest WHERE catalog_artifact IS NULL`);
    for (const row of rows) {
      const bundle = await buildWebBundle(row.document_json,row.is_protected);
      const artifact = await storeArtifact(row.id,bundle);
      await db.query("UPDATE visualisation_versions SET catalog_artifact=$2 WHERE id=$1 AND catalog_artifact IS NULL", [row.id,artifact]);
      console.log(`Prepared ${row.name} v${row.version_number} (${artifact.size} bytes).`);
    }
    console.log(`Catalogue ready. ${rows.length} version(s) prepared.`);
  } finally { await db.end(); }
}
backfill().catch(error => {console.error("Catalogue preparation failed:", error.code || error.message);process.exitCode=1;});
