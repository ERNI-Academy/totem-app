import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the SQL setup creates the protected base and usable database views", async () => {
  const sql = await readFile(new URL("../../database/sql/create-schema.sql", import.meta.url), "utf8");
  for (const name of ["Users", "Visualisations", "VisualisationDrafts", "VisualisationVersions", "Templates", "Assets", "Devices", "AuditEvents"]) {
    assert.match(sql, new RegExp(`CREATE TABLE dbo\\.${name}\\b`));
  }
  for (const view of ["vw_VisualisationOverview", "vw_PublicationHistory", "vw_AssetUsage", "vw_UserOverview", "vw_AuditTimeline"]) {
    assert.ok(sql.includes(`dbo.${view}`), `missing ${view}`);
  }
  assert.match(sql, /N'Totem original','system',1/);
  assert.match(sql, /N'ERNI base'/);
});

test("SQL script never includes a default administrator credential", async () => {
  const sql = await readFile(new URL("../../database/sql/create-schema.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /INSERT\s+dbo\.Users\b/i);
  assert.doesNotMatch(sql, /password\s*=\s*['"][^<]/i);
});
