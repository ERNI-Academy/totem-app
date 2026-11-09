import { documentSchema } from "@/lib/contentSchema";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { syncDraftAssetReferences } from "@/lib/assetReferences";
import type { VisualisationDocument } from "@/types/content";
export const runtime = "nodejs";
const schema=z.object({name:z.string().trim().min(2).max(160),revision:z.number().int().positive(),document:documentSchema});
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
  try{
    const auth=await requireUser();if(auth.error)return auth.error;const{id}=await params;
    const result=await getDb().query("SELECT v.id,v.name,v.kind,v.is_protected AS \"isProtected\",d.revision,d.document_json AS document FROM visualisations v JOIN visualisation_drafts d ON d.visualisation_id=v.id WHERE v.id=$1 AND v.is_deleted=false",[id]);
    const row=result.rows[0];if(!row)return NextResponse.json({error:"Not found."},{status:404});return NextResponse.json(row);
  }catch(error){return apiError(error);}
}
export async function PUT(request:Request,{params}:Context){
  try{
    const auth=await requireUser();if(auth.error)return auth.error;const{id}=await params;const body=schema.parse(await request.json());
    const document={...body.document,name:body.name} as VisualisationDocument;
    const result=await withTransaction(async(client)=>{
      const current=await client.query<{isProtected:boolean}>("SELECT is_protected AS \"isProtected\" FROM visualisations WHERE id=$1 AND is_deleted=false FOR UPDATE",[id]);
      if(!current.rows[0])return "missing";if(current.rows[0].isProtected)return "protected";
      const saved=await client.query("UPDATE visualisation_drafts SET document_json=$1,revision=revision+1,updated_by=$2,updated_at=now() WHERE visualisation_id=$3 AND revision=$4 RETURNING revision",[document,auth.user.id,id,body.revision]);
      if(!saved.rowCount)return "stale";
      await client.query("UPDATE visualisations SET name=$1,updated_at=now() WHERE id=$2",[body.name,id]);
      await syncDraftAssetReferences(client,id,document);
      return "saved";
    });
    if(result==="missing")return NextResponse.json({error:"Not found."},{status:404});
    if(result==="protected")return NextResponse.json({error:"The protected system visualisation cannot be edited."},{status:403});
    if(result==="stale")return NextResponse.json({error:"This draft changed in another session. Reload it before saving."},{status:409});
    return NextResponse.json({ok:true,revision:body.revision+1});
  }catch(error){if((error as {code?:string})?.code==="23505")return NextResponse.json({error:"A visualisation with this name already exists."},{status:409});return apiError(error);}
}
export async function DELETE(_request:Request,{params}:Context){
  try{
    const auth=await requireUser();if(auth.error)return auth.error;const{id}=await params;
    const result=await getDb().query("UPDATE visualisations SET is_deleted=true,updated_at=now() WHERE id=$1 AND is_deleted=false AND is_protected=false RETURNING id",[id]);
    if(!result.rowCount)return NextResponse.json({error:"Not found or protected."},{status:404});return NextResponse.json({ok:true});
  }catch(error){return apiError(error);}
}
