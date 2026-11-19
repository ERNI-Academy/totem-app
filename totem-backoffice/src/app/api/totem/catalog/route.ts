import { getDb } from "@/lib/db";
import { createBlobSas } from "@/lib/blobStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"no-store", "Access-Control-Allow-Origin":"*"};
export async function GET() {
  try {
    const result = await getDb().query(`
      SELECT v.id, p.name, v.is_protected AS "isDefault", p.version_number AS version, p.catalog_artifact AS artifact
      FROM visualisations v
      JOIN LATERAL (
        SELECT version_number, catalog_artifact, document_json->>'name' AS name FROM visualisation_versions
        WHERE visualisation_id = v.id AND catalog_artifact IS NOT NULL
        ORDER BY version_number DESC LIMIT 1
      ) p ON true
      WHERE NOT v.is_deleted ORDER BY v.is_protected DESC, lower(p.name), v.id`);
    const visualisations = result.rows.map(({artifact, ...row}) => ({
      ...row, size:artifact.size, sha256:artifact.sha256, bundleSha256:artifact.bundleSha256,
      downloadUrl:createBlobSas(artifact.zipKey,"r",60), thumbnailUrl:createBlobSas(artifact.thumbKey,"r",60)
    }));
    return Response.json({visualisations}, {headers});
  } catch {
    return Response.json({error:"Catalogue temporarily unavailable."}, {status:503,headers});
  }
}
