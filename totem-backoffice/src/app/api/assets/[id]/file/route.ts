import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createBlobSas } from "@/lib/blobStorage";
import { getMediaEnvironment } from "@/lib/env";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const { id } = await params;
    const result = await getDb().query<{ storageKey: string }>("SELECT storage_key AS \"storageKey\" FROM assets WHERE id=$1 AND environment=$2", [id, getMediaEnvironment()]);
    const asset = result.rows[0]; if (!asset) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    return NextResponse.redirect(createBlobSas(asset.storageKey, "r", 10), { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) { return apiError(error); }
}
