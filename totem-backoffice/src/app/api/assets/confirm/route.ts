import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getBlobClient } from "@/lib/blobStorage";
import { getMediaEnvironment } from "@/lib/env";

export const runtime = "nodejs";
const schema = z.object({ assetId: z.uuid(), blobName: z.string().regex(/^assets\/[0-9a-f-]{36}$/i), fileName: z.string().trim().min(1).max(260), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]) });
export async function POST(request: Request) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const body = schema.parse(await request.json());
    if (body.blobName !== `assets/${body.assetId}`) return NextResponse.json({ error: "The upload reference is invalid." }, { status: 403 });
    const blob = getBlobClient(body.blobName); const properties = await blob.getProperties();
    const size = Number(properties.contentLength ?? 0);
    if (!size || size > 20 * 1024 * 1024 || properties.contentType !== body.contentType) {
      await blob.deleteIfExists();
      return NextResponse.json({ error: "Uploaded file size or content type is not allowed." }, { status: 400 });
    }
    const download = await blob.download();
    if (!download.readableStreamBody) throw new Error("Could not read uploaded file for integrity check.");
    const hash = createHash("sha256");
    let head = Buffer.alloc(0);
    for await (const chunk of download.readableStreamBody) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
      if (head.length < 16) head = Buffer.concat([head, bytes.subarray(0, 16 - head.length)]);
      hash.update(bytes);
    }
    const actualType = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff ? "image/jpeg"
      : head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
      : head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
    if (actualType !== body.contentType) {
      await blob.deleteIfExists();
      return NextResponse.json({ error: "The file contents do not match the selected image format." }, { status: 400 });
    }
    const sha256 = hash.digest("hex");
    const db = await getDb();
    const inserted = await db.request()
      .input("id", sql.UniqueIdentifier, body.assetId).input("name", sql.NVarChar(260), body.fileName)
      .input("type", sql.VarChar(120), body.contentType).input("size", sql.BigInt, size)
      .input("hash", sql.Char(64), sha256).input("key", sql.NVarChar(600), body.blobName)
      .input("user", sql.UniqueIdentifier, auth.user.id)
      .input("environment", sql.VarChar(20), getMediaEnvironment())
      .query("INSERT dbo.Assets(Id,FileName,ContentType,SizeBytes,Sha256,StorageKey,CreatedBy,Environment) OUTPUT inserted.Id AS id,inserted.FileName AS fileName,inserted.ContentType AS contentType,inserted.SizeBytes AS sizeBytes,inserted.CreatedAt AS createdAt VALUES(@id,@name,@type,@size,@hash,@key,@user,@environment)");
    return NextResponse.json({ asset: { ...inserted.recordset[0], url: `/api/assets/${body.assetId}/file` } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
