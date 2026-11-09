import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createBlobName, createBlobSas } from "@/lib/blobStorage";
import { getMediaEnvironment } from "@/lib/env";
export const runtime = "nodejs";
const types = ["image/jpeg", "image/png", "image/webp", "video/mp4"] as const;
const maxBytes = 250 * 1024 * 1024;
const uploadSchema = z.object({ fileName: z.string().trim().min(1).max(260), contentType: z.enum(types), sizeBytes: z.number().int().positive().max(maxBytes) });
export async function GET() {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const result = await getDb().query(
      "SELECT id,file_name AS \"fileName\",content_type AS \"contentType\",tags, size_bytes AS \"sizeBytes\",created_at AS \"createdAt\",storage_key LIKE 'totem-original/%' AS \"isSystem\" FROM assets WHERE environment=$1 ORDER BY created_at DESC",
      [getMediaEnvironment()],
    );
    return NextResponse.json({ assets: result.rows.map((asset) => ({ ...asset, sizeBytes: Number(asset.sizeBytes), url: `/api/assets/${asset.id}/file` })) });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const body = uploadSchema.parse(await request.json());
    if (body.sizeBytes > maxBytes) return NextResponse.json({ error: "Media files must be 250 MB or smaller." }, { status: 413 });
    const assetId = randomUUID(); const blobName = createBlobName(assetId);
    return NextResponse.json({ assetId, blobName, uploadUrl: createBlobSas(blobName, "cw", 15), expiresInSeconds: 900 }, { status: 201 });
  } catch (error) { return apiError(error); }
}
