import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getBlobClient } from "@/lib/blobStorage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const { id } = await params; const db = await getDb(); const transaction = new sql.Transaction(db);
    await transaction.begin();
    try {
      const assetResult = await new sql.Request(transaction).input("id", sql.UniqueIdentifier, id)
        .query<{ storageKey: string }>("SELECT StorageKey AS storageKey FROM dbo.Assets WITH (XLOCK,HOLDLOCK) WHERE Id=@id");
      const asset = assetResult.recordset[0];
      if (!asset) { await transaction.rollback(); return NextResponse.json({ error: "Image not found." }, { status: 404 }); }

      const refs = await new sql.Request(transaction).input("id", sql.UniqueIdentifier, id).query<{ drafts: number; versions: number }>(
        "SELECT (SELECT COUNT(*) FROM dbo.DraftAssets WHERE AssetId=@id) AS drafts,(SELECT COUNT(*) FROM dbo.VersionAssets WHERE AssetId=@id) AS versions"
      );
      const drafts = Number(refs.recordset[0].drafts); const versions = Number(refs.recordset[0].versions);
      if (drafts + versions > 0) {
        await transaction.rollback();
        return NextResponse.json({ error: `This image is still used in ${drafts} draft(s) and ${versions} published version(s). Remove it from those visualisations first.` }, { status: 409 });
      }

      await getBlobClient(asset.storageKey).deleteIfExists();
      await new sql.Request(transaction).input("id", sql.UniqueIdentifier, id).query("DELETE dbo.Assets WHERE Id=@id");
      await transaction.commit();
      return NextResponse.json({ ok: true });
    } catch (error) { await transaction.rollback(); throw error; }
  } catch (error) { return apiError(error); }
}
