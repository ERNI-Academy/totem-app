import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { syncDraftAssetReferences } from "@/lib/assetReferences";
import type { VisualisationDocument } from "@/types/content";

export const runtime = "nodejs";
const elementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "image", "video", "card", "button"]),
  x: z.number().finite(), y: z.number().finite(),
  width: z.number().positive().max(1080), height: z.number().positive().max(1920),
  text: z.string().max(5000).optional(), title: z.string().max(240).optional(),
  description: z.string().max(2000).optional(), color: z.string().max(32).optional(),
  fontSize: z.number().positive().max(240).optional(), background: z.string().max(64).optional(),
  src: z.string().max(1_500_000).optional(), target: z.string().max(120).optional(), locked: z.boolean().optional(),
});
const schema = z.object({
  name: z.string().trim().min(2).max(160),
  revision: z.number().int().positive(),
  document: z.object({
    schemaVersion: z.literal(1), width: z.literal(1080), height: z.literal(1920), name: z.string().max(160),
    screens: z.array(z.object({
      id: z.string().min(1), name: z.string().min(1).max(160), mode: z.enum(["embedded", "fullscreen"]),
      elements: z.array(elementSchema).max(250),
    })).min(1).max(40),
  }),
});
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const { id } = await params; const db = await getDb();
    const result = await db.request().input("id", sql.UniqueIdentifier, id).query(
      "SELECT v.Id AS id,v.Name AS name,v.Kind AS kind,v.IsProtected AS isProtected,d.Revision AS revision,d.DocumentJson AS documentJson FROM dbo.Visualisations v JOIN dbo.VisualisationDrafts d ON d.VisualisationId=v.Id WHERE v.Id=@id AND v.IsDeleted=0"
    );
    const row = result.recordset[0];
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ...row, document: JSON.parse(row.documentJson) });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const { id } = await params; const body = schema.parse(await request.json());
    const pool = await getDb(); const tx = new sql.Transaction(pool); await tx.begin();
    try {
      const current = await new sql.Request(tx).input("id", sql.UniqueIdentifier, id).query(
        "SELECT IsProtected FROM dbo.Visualisations WHERE Id=@id AND IsDeleted=0"
      );
      if (!current.recordset[0]) { await tx.rollback(); return NextResponse.json({ error: "Not found." }, { status: 404 }); }
      if (current.recordset[0].IsProtected) { await tx.rollback(); return NextResponse.json({ error: "The protected system visualisation cannot be edited." }, { status: 403 }); }
      const saved = await new sql.Request(tx)
        .input("id", sql.UniqueIdentifier, id).input("revision", sql.Int, body.revision)
        .input("name", sql.NVarChar(160), body.name).input("doc", sql.NVarChar(sql.MAX), JSON.stringify({ ...body.document, name: body.name }))
        .input("user", sql.UniqueIdentifier, auth.user.id).query(
          "UPDATE dbo.VisualisationDrafts SET DocumentJson=@doc,Revision=Revision+1,UpdatedBy=@user,UpdatedAt=SYSUTCDATETIME() WHERE VisualisationId=@id AND Revision=@revision; SELECT @@ROWCOUNT AS affected"
        );
      if (saved.recordset.at(-1)?.affected !== 1) {
        await tx.rollback(); return NextResponse.json({ error: "This draft changed in another session. Reload it before saving." }, { status: 409 });
      }
      await new sql.Request(tx).input("id", sql.UniqueIdentifier, id).input("name", sql.NVarChar(160), body.name)
        .query("UPDATE dbo.Visualisations SET Name=@name,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id");
      await syncDraftAssetReferences(tx, id, { ...body.document, name: body.name } as VisualisationDocument);
      await tx.commit(); return NextResponse.json({ ok: true, revision: body.revision + 1 });
    } catch (error) { await tx.rollback(); throw error; }
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const auth = await requireUser(); if (auth.error) return auth.error;
    const { id } = await params; const db = await getDb();
    const result = await db.request().input("id", sql.UniqueIdentifier, id).query(
      "UPDATE dbo.Visualisations SET IsDeleted=1,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id AND IsDeleted=0 AND IsProtected=0; SELECT @@ROWCOUNT AS affected"
    );
    if (!result.recordset.at(-1)?.affected) return NextResponse.json({ error: "Not found or protected." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
