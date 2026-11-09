import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/http";
import { buildWebBundle, makeZip } from "@/lib/webPublication";
import type { VisualisationDocument } from "@/types/content";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};

export async function GET(request:Request,{params}:Context){
  try{
    const auth=await requireUser();if(auth.error)return auth.error;
    const {id}=await params, version=new URL(request.url).searchParams.get("version");
    if(version&&!/^[1-9]\d*$/.test(version))return NextResponse.json({error:"Version must be a positive integer."},{status:400});
    const lookup=version
      ? await getDb().query<{name:string;isProtected:boolean;document:VisualisationDocument;version:number}>("SELECT v.name,v.is_protected AS \"isProtected\",p.document_json AS document,p.version_number AS version FROM visualisations v JOIN visualisation_versions p ON p.visualisation_id=v.id WHERE v.id=$1 AND v.is_deleted=false AND p.version_number=$2",[id,Number(version)])
      : await getDb().query<{name:string;isProtected:boolean;document:VisualisationDocument;version:number}>("SELECT v.name,v.is_protected AS \"isProtected\",p.document_json AS document,p.version_number AS version FROM visualisations v JOIN LATERAL (SELECT document_json,version_number FROM visualisation_versions WHERE visualisation_id=v.id ORDER BY version_number DESC LIMIT 1) p ON true WHERE v.id=$1 AND v.is_deleted=false",[id]);
    const row=lookup.rows[0];if(!row)return NextResponse.json({error:"Published version not found."},{status:404});
    const bundle=await buildWebBundle(row.document,row.isProtected);
    const zip=makeZip(bundle.files);
    const slug=row.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"totem";
    return new NextResponse(zip,{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename=\"${slug}-v${version||row.version}.zip\"`,"Content-Length":String(zip.length),"X-Totem-Source-SHA256":bundle.manifest.sourceSha256,"X-Totem-Bundle-SHA256":bundle.manifest.bundleSha256,"Cache-Control":"private, no-store"}});
  }catch(error){return apiError(error);}
}
