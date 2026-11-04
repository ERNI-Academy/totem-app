import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createBlobName, createBlobSas } from "@/lib/blobStorage";
import { getMediaEnvironment } from "@/lib/env";

export const runtime = "nodejs";
const types = ["image/jpeg", "image/png", "image/webp"] as const;
const maxBytes = 20 * 1024 * 1024;
const uploadSchema = z.object({ fileName: z.string().trim().min(1).max(260), contentType: z.enum(types), sizeBytes: z.number().int().positive().max(maxBytes) });

export async function GET() {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const db = await getDb();
    const result = await db.request().input("environment", sql.VarChar(20), getMediaEnvironment()).query("SELECT Id AS id,FileName AS fileName,ContentType AS contentType,SizeBytes AS sizeBytes,CreatedAt AS createdAt FROM dbo.Assets WHERE Environment=@environment ORDER BY CreatedAt DESC");
    return NextResponse.json({ assets: result.recordset.map((asset: { id: string; fileName: string; contentType: string; sizeBytes: number; createdAt: Date }) => ({ ...asset, url: `/api/assets/${asset.id}/file` })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const body = uploadSchema.parse(await request.json());
    if (body.sizeBytes > maxBytes) return NextResponse.json({ error: "Images must be 20 MB or smaller." }, { status: 413 });
    const assetId = randomUUID(); const blobName = createBlobName(assetId);
    const uploadUrl = createBlobSas(blobName, "cw", 15);
    return NextResponse.json({ assetId, blobName, uploadUrl, expiresInSeconds: 900 }, { status: 201 });
  } catch (error) { return apiError(error); }
}
