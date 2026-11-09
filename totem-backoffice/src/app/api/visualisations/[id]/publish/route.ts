import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { syncVersionAssetReferences } from "@/lib/assetReferences";
import type { VisualisationDocument } from "@/types/content";
import { buildWebBundle } from "@/lib/webPublication";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function POST(_request:Request,{params}:Context){
  try{
    const auth=await requireUser();if(auth.error)return auth.error;const{id}=await params;
    const result=await withTransaction(async(client)=>{
      const draft=await client.query<{isProtected:boolean;document:VisualisationDocument}>("SELECT v.is_protected AS \"isProtected\",d.document_json AS document FROM visualisations v JOIN visualisation_drafts d ON d.visualisation_id=v.id WHERE v.id=$1 AND v.is_deleted=false FOR UPDATE OF v,d",[id]);
      const row=draft.rows[0];if(!row)return {status:"missing" as const};if(row.isProtected)return {status:"protected" as const};
      if(row.document.webTemplate?.id==="totem-original"){
        const adapterSource=await readFile(path.resolve(process.cwd(),"..","packages/totem-original/web-editor/adapter.js"),"utf8");
        row.document={...row.document,webTemplate:{...row.document.webTemplate,adapterSource}};
      }
      const bundle=await buildWebBundle(row.document);
      row.document={...row.document,webPublication:bundle.manifest};
      const next=await client.query<{version:number}>("SELECT coalesce(max(version_number),0)+1 AS version FROM visualisation_versions WHERE visualisation_id=$1",[id]);
      const version=Number(next.rows[0].version);const versionId=randomUUID();
      await client.query("INSERT INTO visualisation_versions(id,visualisation_id,version_number,document_json,published_by) VALUES($1,$2,$3,$4,$5)",[versionId,id,version,row.document,auth.user.id]);
      await syncVersionAssetReferences(client,versionId,row.document);
      await client.query("INSERT INTO audit_events(user_id,action,entity_type,entity_id,details_json) VALUES($1,'publish','visualisation',$2,$3)",[auth.user.id,id,{version}]);
      return {status:"published" as const,version};
    });
    if(result.status==="missing")return NextResponse.json({error:"Not found."},{status:404});
    if(result.status==="protected")return NextResponse.json({error:"Protected content cannot be published from the editor."},{status:403});
    return NextResponse.json({published:true,version:result.version},{status:201});
  }catch(error){return apiError(error);}
}
