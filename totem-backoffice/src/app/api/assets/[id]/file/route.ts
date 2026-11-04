import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createBlobSas } from "@/lib/blobStorage";
import { getMediaEnvironment } from "@/lib/env";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const { id } = await params; const db = await getDb();
    const result = await db.request().input("id", sql.UniqueIdentifier, id).input("environment", sql.VarChar(20), getMediaEnvironment()).query<{ storageKey: string }>("SELECT StorageKey AS storageKey FROM dbo.Assets WHERE Id=@id AND Environment=@environment");
    const asset = result.recordset[0]; if (!asset) return NextResponse.json({ error: "Media not found." }, { status: 404 });
    return NextResponse.redirect(createBlobSas(asset.storageKey, "r", 10), { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) { return apiError(error); }
}
