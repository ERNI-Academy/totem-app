import { documentSchema } from "@/lib/contentSchema";
import { createCanvasDocument } from "@/lib/canvasDocument";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { syncDraftAssetReferences } from "@/lib/assetReferences";
import type { VisualisationDocument } from "@/types/content";
export const runtime = "nodejs";
const createSchema=z.object({name:z.string().trim().min(2).max(160),document:documentSchema.optional()});

export async function GET() {
  try {
    const auth=await requireUser(); if(auth.error)return auth.error;
    const result=await getDb().query(
      "SELECT v.id,v.name,v.kind,v.is_protected AS \"isProtected\",v.owner_id AS \"ownerId\",v.updated_at AS \"updatedAt\",d.revision,d.document_json AS document,(SELECT max(version_number) FROM visualisation_versions x WHERE x.visualisation_id=v.id) AS \"latestPublishedVersion\" FROM visualisations v LEFT JOIN visualisation_drafts d ON d.visualisation_id=v.id WHERE v.is_deleted=false ORDER BY v.is_protected DESC,v.updated_at DESC",
    );
    return NextResponse.json({visualisations:result.rows});
  } catch(error){return apiError(error);}
}
export async function POST(request:Request) {
  try {
    const auth=await requireUser(); if(auth.error)return auth.error;
    const body=createSchema.parse(await request.json()); const id=randomUUID(); const doc=body.document??createCanvasDocument(JSON.parse(await readFile(path.resolve(process.cwd(),"..","packages/totem-original/document.json"),"utf8")),body.name);
    const document={...doc,name:body.name};
    const conflict=await withTransaction(async(client)=>{
      const duplicate=await client.query("SELECT 1 FROM visualisations WHERE is_deleted=false AND upper(name)=upper($1) LIMIT 1",[body.name]);
      if(duplicate.rowCount)return true;
      await client.query("INSERT INTO visualisations(id,name,kind,owner_id) VALUES($1,$2,'visualisation',$3)",[id,body.name,auth.user.id]);
      await client.query("INSERT INTO visualisation_drafts(visualisation_id,document_json,updated_by) VALUES($1,$2,$3)",[id,document,auth.user.id]);
      await syncDraftAssetReferences(client,id,document as VisualisationDocument);
      return false;
    });
    if(conflict)return NextResponse.json({error:"A visualisation with this name already exists."},{status:409});
    return NextResponse.json({id,name:body.name,revision:1,document},{status:201});
  }catch(error){if((error as {code?:string})?.code==="23505")return NextResponse.json({error:"A visualisation with this name already exists."},{status:409});return apiError(error);}
}
