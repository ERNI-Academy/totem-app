import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildWebBundle, getWebSourceFile, injectWebEditor, resolveDocumentMedia, templateOverridesScript } from "@/lib/webPublication";
import { getMediaEnvironment } from "@/lib/env";
import { getBlobClient } from "@/lib/blobStorage";
import type { VisualisationDocument } from "@/types/content";
import manifest from "../../../../../../../../packages/totem-original/manifest.json";

export const runtime = "nodejs";
const mime:Record<string,string>={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".mp4":"video/mp4",".woff2":"font/woff2"};
const repoRoot=path.resolve(process.cwd(),"..");
const responseBody=(data:Uint8Array)=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer;
type Context={params:Promise<{id:string;path:string[]}>};

export async function GET(request:Request,{params}:Context){
  try{
    const auth=await requireUser();if(auth.error)return auth.error;
    const {id,path:parts}=await params;
    const result=await getDb().query<{document:VisualisationDocument;isProtected:boolean}>("SELECT d.document_json AS document,v.is_protected AS \"isProtected\" FROM visualisation_drafts d JOIN visualisations v ON v.id=d.visualisation_id WHERE v.id=$1 AND v.is_deleted=false",[id]);
    const row=result.rows[0];if(!row)return NextResponse.json({error:"Visualisation not found."},{status:404});
    const rel=parts.join("/")||"index.html";
    if(rel.startsWith("/")||rel.split("/").some(part=>part===".."))return NextResponse.json({error:"Invalid path."},{status:400});
    let bytes:Uint8Array;
    let contentType:string|undefined;
    if(row.isProtected){
      if(!manifest.webFiles.some(item=>item.path===rel))return NextResponse.json({error:"File not found."},{status:404});
      bytes=new Uint8Array(await getWebSourceFile(row.document,rel));
    }else if(row.document.webTemplate?.id==="totem-original"){
      const template=row.document.webTemplate;
      if(/^live-media\/[0-9a-f-]{36}$/i.test(rel)){
        const asset=await getDb().query<{storageKey:string;contentType:string}>("SELECT storage_key AS \"storageKey\",content_type AS \"contentType\" FROM assets WHERE id=$1 AND environment=$2",[rel.slice("live-media/".length),getMediaEnvironment()]);
        if(!asset.rows[0])return NextResponse.json({error:"Media not found."},{status:404});
        contentType=asset.rows[0].contentType;bytes=new Uint8Array(await getBlobClient(asset.rows[0].storageKey).downloadToBuffer());
      }
      else if(rel==="index.html")bytes=injectWebEditor(await getWebSourceFile(row.document,"index.html"));
      else if(rel==="web-editor/adapter.js")bytes=new Uint8Array(await readFile(path.join(repoRoot,"packages/totem-original/web-editor/adapter.js")));
      else if(rel==="web-editor/overrides.js"){const {mediaMap,screens}=await resolveDocumentMedia(row.document);bytes=new Uint8Array(templateOverridesScript(template,mediaMap,screens));}
      else if(rel.startsWith("custom-media/")){const {records}=await resolveDocumentMedia(row.document);const asset=records.get(rel);if(!asset)return NextResponse.json({error:"File not found."},{status:404});bytes=new Uint8Array(await getBlobClient(asset.storageKey).downloadToBuffer());}
      else if(rel.startsWith("resources/")){const resource=rel.slice("resources/".length);if(!manifest.resources.some(item=>item.path===resource))return NextResponse.json({error:"File not found."},{status:404});const filename=resource.startsWith("media/")?null:path.resolve(repoRoot,"packages/totem-original/resources",resource);bytes=new Uint8Array(filename?await readFile(filename):await getWebSourceFile(row.document,resource));}
      else if((template.sourceFiles||manifest.webFiles).some(item=>item.path===rel))bytes=new Uint8Array(await getWebSourceFile(row.document,rel));
      else return NextResponse.json({error:"File not found."},{status:404});
    }else{
      const bundle=await buildWebBundle(row.document);
      const file=bundle.files.get(rel);if(!file)return NextResponse.json({error:"File not found."},{status:404});
      bytes=new Uint8Array(file);
    }
    const headers=new Headers({"Cache-Control":"private, no-store","X-Frame-Options":"SAMEORIGIN","Content-Security-Policy":"frame-ancestors 'self'; default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; media-src 'self' blob: data:; img-src 'self' data: blob:; font-src 'self' data:"});
    headers.set("Content-Type",contentType||mime[path.extname(rel)]||"application/octet-stream");
    const range=request.headers.get("range");if((rel.endsWith(".mp4")||contentType?.startsWith("video/")))headers.set("Accept-Ranges","bytes");
    if(range&&(rel.endsWith(".mp4")||contentType?.startsWith("video/"))){const match=/bytes=(\d*)-(\d*)/.exec(range);if(match){const start=Number(match[1]||0),end=Math.min(Number(match[2]||bytes.length-1),bytes.length-1);if(start<=end){headers.set("Content-Range",`bytes ${start}-${end}/${bytes.length}`);headers.set("Content-Length",String(end-start+1));return new NextResponse(responseBody(bytes.subarray(start,end+1)),{status:206,headers});}}}
    return new NextResponse(responseBody(bytes),{headers});
  }catch(error){console.error("Web preview failed:",error);return NextResponse.json({error:"Could not load preview package."},{status:500});}
}
