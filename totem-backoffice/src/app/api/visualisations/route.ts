import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { syncDraftAssetReferences } from "@/lib/assetReferences";
import type { VisualisationDocument } from "@/types/content";

export const runtime = "nodejs";
const element = z.object({ id:z.string().min(1),type:z.enum(["text","image","video","card","button"]),x:z.number().finite(),y:z.number().finite(),width:z.number().positive().max(1080),height:z.number().positive().max(1920),text:z.string().max(5000).optional(),title:z.string().max(240).optional(),description:z.string().max(2000).optional(),color:z.string().max(32).optional(),fontSize:z.number().positive().max(240).optional(),background:z.string().max(64).optional(),src:z.string().max(1_500_000).optional(),target:z.string().max(120).optional(),locked:z.boolean().optional() });
const documentSchema=z.object({schemaVersion:z.literal(1),width:z.literal(1080),height:z.literal(1920),name:z.string().max(160),regions:z.record(z.string(),z.object({x:z.number(),y:z.number(),width:z.number(),height:z.number(),locked:z.boolean()})).optional(),screens:z.array(z.object({id:z.string().min(1),name:z.string().min(1).max(160),mode:z.enum(["embedded","fullscreen"]),elements:z.array(element).max(250)})).min(1).max(40)});
const createSchema=z.object({name:z.string().trim().min(2).max(160),document:documentSchema.optional()});
const blank=(name:string)=>({schemaVersion:1 as const,width:1080 as const,height:1920 as const,name,screens:[{id:"home",name:"Inicio",mode:"embedded" as const,elements:[]}]});

export async function GET() {
  try {
    const auth=await requireUser(); if(auth.error)return auth.error;
    const db=await getDb(); const result=await db.request().query("SELECT v.Id AS id,v.Name AS name,v.Kind AS kind,v.IsProtected AS isProtected,v.OwnerId AS ownerId,v.UpdatedAt AS updatedAt,d.Revision AS revision,d.DocumentJson AS documentJson,(SELECT MAX(VersionNumber) FROM dbo.VisualisationVersions x WHERE x.VisualisationId=v.Id) AS latestPublishedVersion FROM dbo.Visualisations v LEFT JOIN dbo.VisualisationDrafts d ON d.VisualisationId=v.Id WHERE v.IsDeleted=0 ORDER BY v.IsProtected DESC,v.UpdatedAt DESC");
    const items=result.recordset.map((row:{documentJson:string;[key:string]:unknown})=>{const {documentJson,...item}=row;return {...item,document:JSON.parse(documentJson)}});
    return NextResponse.json({visualisations:items});
  } catch(error){return apiError(error);}
}

export async function POST(request:Request) {
  try {
    const auth=await requireUser(); if(auth.error)return auth.error;
    const body=createSchema.parse(await request.json()); const id=randomUUID();const doc=body.document??blank(body.name);
    const pool=await getDb();const tx=new sql.Transaction(pool);await tx.begin();
    try{
      const duplicate=await new sql.Request(tx).input("name",sql.NVarChar(160),body.name).query("SELECT TOP 1 Id FROM dbo.Visualisations WHERE IsDeleted=0 AND UPPER(Name)=UPPER(@name)");
      if(duplicate.recordset.length){await tx.rollback();return NextResponse.json({error:"A visualisation with this name already exists."},{status:409});}
      await new sql.Request(tx).input("id",sql.UniqueIdentifier,id).input("name",sql.NVarChar(160),body.name).input("owner",sql.UniqueIdentifier,auth.user.id)
        .query("INSERT dbo.Visualisations(Id,Name,Kind,OwnerId) VALUES(@id,@name,'visualisation',@owner)");
      await new sql.Request(tx).input("id",sql.UniqueIdentifier,id).input("doc",sql.NVarChar(sql.MAX),JSON.stringify({...doc,name:body.name})).input("owner",sql.UniqueIdentifier,auth.user.id)
        .query("INSERT dbo.VisualisationDrafts(VisualisationId,DocumentJson,UpdatedBy) VALUES(@id,@doc,@owner)");
      await syncDraftAssetReferences(tx, id, { ...doc, name: body.name } as VisualisationDocument);
      await tx.commit();return NextResponse.json({id,name:body.name,revision:1,document:doc},{status:201});
    }catch(e){await tx.rollback();throw e;}
  }catch(error){return apiError(error);}
}
