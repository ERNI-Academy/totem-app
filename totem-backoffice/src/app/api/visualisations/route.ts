import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { syncDraftAssetReferences } from "@/lib/assetReferences";
import type { VisualisationDocument } from "@/types/content";
export const runtime = "nodejs";
const element = z.object({ id:z.string().min(1),type:z.enum(["text","image","video","card","button"]),x:z.number().finite(),y:z.number().finite(),width:z.number().positive().max(1080),height:z.number().positive().max(1920),text:z.string().max(5000).optional(),title:z.string().max(240).optional(),description:z.string().max(2000).optional(),color:z.string().max(32).optional(),fontSize:z.number().positive().max(240).optional(),background:z.string().max(64).optional(),src:z.string().max(1_500_000).optional(),target:z.string().max(120).optional(),locked:z.boolean().optional(),imageNoPadding:z.boolean().optional() });
const documentSchema=z.object({schemaVersion:z.literal(1),width:z.literal(1080),height:z.literal(1920),name:z.string().max(160),regions:z.record(z.string(),z.object({x:z.number(),y:z.number(),width:z.number(),height:z.number(),locked:z.boolean()})).optional(),screens:z.array(z.object({id:z.string().min(1),name:z.string().min(1).max(160),mode:z.enum(["embedded","fullscreen"]),elements:z.array(element).max(250)})).min(1).max(40)});
const createSchema=z.object({name:z.string().trim().min(2).max(160),document:documentSchema.optional()});
const blank=(name:string)=>({schemaVersion:1 as const,width:1080 as const,height:1920 as const,name,screens:[{id:"home",name:"Inicio",mode:"embedded" as const,elements:[]}]});
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
    const body=createSchema.parse(await request.json()); const id=randomUUID(); const doc=body.document??blank(body.name);
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
