import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the PostgreSQL setup creates the protected base and usable database views", async () => {
  const sql = await readFile(new URL("../../database/postgres/create-schema.sql", import.meta.url), "utf8");
  for (const name of ["users", "visualisations", "visualisation_drafts", "visualisation_versions", "templates", "assets", "devices", "audit_events"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\b`));
  }
  for (const view of ["vw_visualisation_overview", "vw_publication_history", "vw_asset_usage", "vw_user_overview", "vw_audit_timeline"]) {
    assert.ok(sql.includes(`VIEW ${view}`), `missing ${view}`);
  }
  assert.match(sql, /'Totem original', 'system', true/);
  assert.match(sql, /'ERNI base'/);
});

test("PostgreSQL script never includes a default administrator credential", async () => {
  const sql = await readFile(new URL("../../database/postgres/create-schema.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+users\b/i);
  assert.doesNotMatch(sql, /password\s*=\s*['"][^<]/i);
});
