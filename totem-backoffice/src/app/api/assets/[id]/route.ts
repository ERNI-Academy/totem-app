import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getBlobClient } from "@/lib/blobStorage";
import { getMediaEnvironment } from "@/lib/env";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({ fileName: z.string().trim().min(1).max(260), tags: z.array(z.string().trim().min(1).max(40)).max(20) });
export async function PATCH(request: Request, { params }: Context) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const tags = [...new Set(body.tags.map(tag => tag.trim()).filter(Boolean))];
    const result = await getDb().query(
      // System media files stay protected from deletion, but their catalogue
      // name and tags are user metadata and can be edited like any other asset.
      "UPDATE assets SET file_name=$1,tags=$2 WHERE id=$3 AND environment=$4 RETURNING id,file_name AS \"fileName\",content_type AS \"contentType\",tags,size_bytes AS \"sizeBytes\",created_at AS \"createdAt\"",
      [body.fileName, tags, id, getMediaEnvironment()],
    );
    const asset = result.rows[0];
    if (!asset) return NextResponse.json({ error: "This media item could not be found." }, { status: 404 });
    return NextResponse.json({ asset: { ...asset, sizeBytes: Number(asset.sizeBytes), url: `/api/assets/${asset.id}/file` } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const { id } = await params;
    const result = await withTransaction(async (client) => {
      const asset = await client.query<{ storageKey: string }>("SELECT storage_key AS \"storageKey\" FROM assets WHERE id=$1 AND environment=$2 FOR UPDATE", [id, getMediaEnvironment()]);
      const row = asset.rows[0]; if (!row) return { status: 404 as const };
      if (row.storageKey.startsWith('totem-original/')) return { status: 403 as const };
      const refs = await client.query<{ drafts: string; versions: string }>(
        "SELECT (SELECT count(*) FROM draft_assets WHERE asset_id=$1)::text AS drafts,(SELECT count(*) FROM version_assets WHERE asset_id=$1)::text AS versions", [id],
      );
      const drafts = Number(refs.rows[0].drafts); const versions = Number(refs.rows[0].versions);
      if (drafts + versions > 0) return { status: 409 as const, drafts, versions };
      await getBlobClient(row.storageKey).deleteIfExists();
      await client.query("DELETE FROM assets WHERE id=$1", [id]);
      return { status: 200 as const };
    });
    if (result.status === 404) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    if (result.status === 403) return NextResponse.json({ error: "This resource belongs to the default published Totem original." }, { status: 403 });
    if (result.status === 409) return NextResponse.json({ error: `This image is still used in ${result.drafts} draft(s) and ${result.versions} published version(s). Remove it from those visualisations first.` }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
