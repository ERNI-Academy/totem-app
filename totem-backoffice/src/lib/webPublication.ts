import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db";
import { getBlobClient } from "./blobStorage";
import type { VisualisationDocument } from "@/types/content";
import manifest from "../../../packages/totem-original/manifest.json";

const repoRoot=path.resolve(process.cwd(),"..");
const sourceRoot=path.join(repoRoot,"packages/totem-original/web");
const sha=(data:Buffer|string)=>createHash("sha256").update(data).digest("hex");
const safeExt=(name:string)=>/\.[a-z0-9]{1,8}$/i.exec(name)?.[0].toLowerCase()||".bin";

export type WebBundle={files:Map<string,Buffer>;manifest:{sourceSha256:string;webSha256:string;bundleSha256:string;files:{path:string;bytes:number;sha256:string}[]}};
export async function resolveTemplateMedia(media:Record<string,string>={}){
  const mediaMap:Record<string,string>={},records=new Map<string,{storageKey:string;fileName:string}>();let index=0;
  for(const [selector,url] of Object.entries(media)){
    if(manifest.webFiles.some(item=>item.path===url)){mediaMap[selector]=url;continue;}
    const templateMedia=/\/api\/template-media\/([^/?]+)/.exec(url)?.[1];
    if(templateMedia&&manifest.webFiles.some(item=>item.path===`media/${templateMedia}`)){mediaMap[selector]=`media/${templateMedia}`;continue;}
    const original=/\/api\/totem-original\/(.+)$/.exec(url)?.[1];
    if(original&&manifest.resources.some(item=>item.path===original)){mediaMap[selector]=`resources/${original}`;continue;}
    const id=/\/api\/assets\/([0-9a-f-]{36})\/file(?:\?.*)?$/i.exec(url)?.[1];if(!id)throw new Error(`Media for ${selector} must be selected from the media library.`);
    const result=await getDb().query<{storageKey:string;fileName:string}>("SELECT storage_key AS \"storageKey\",file_name AS \"fileName\" FROM assets WHERE id=$1",[id]);const asset=result.rows[0];if(!asset)throw new Error(`Media asset ${id} was not found.`);
    const name=`custom-media/asset-${index++}${safeExt(asset.fileName)}`;mediaMap[selector]=name;records.set(name,asset);
  }
  return {mediaMap,records};
}
export async function resolveDocumentMedia(document:VisualisationDocument){
  const media={...document.webTemplate?.media};
  if(document.webTemplate?.contentMode==="canvas") for(const screen of document.screens)for(const el of screen.elements)if(el.src)media[`canvas:${el.id}`]=el.src;
  const resolved=await resolveTemplateMedia(media);
  const screens=document.screens.map(screen=>({...screen,elements:screen.elements.map(el=>({...el,src:el.src?(resolved.mediaMap[`canvas:${el.id}`]??el.src):undefined}))}));
  return {...resolved,screens};
}
export function templateOverridesScript(template:NonNullable<VisualisationDocument["webTemplate"]>,mediaMap:Record<string,string>,screens:VisualisationDocument["screens"]=[]){
  const scriptValue=(value:unknown)=>JSON.stringify(value).replaceAll("<","\\u003c");
  return Buffer.from(`window.__TOTEM_WEB_OVERRIDES__=${scriptValue(template.overrides||{})};window.__TOTEM_WEB_MEDIA__=${scriptValue(Object.fromEntries(Object.entries(mediaMap).filter(([key])=>!key.startsWith("canvas:"))))};window.__TOTEM_WEB_DOCUMENT__=${scriptValue({contentMode:template.contentMode||"original",screens})};`);
}
export function injectWebEditor(html:Buffer){return Buffer.from(html.toString("utf8").replace(/<\/body>/i,'<script src="web-editor/overrides.js"></script><script src="web-editor/adapter.js"></script></body>'));}

export async function getWebSourceFile(document:VisualisationDocument,relativePath:string){
  if(relativePath.startsWith("/")||relativePath.split("/").some(part=>part===".."))throw new Error("Invalid source path.");
  const template=document.webTemplate,entries=template?.sourceFiles||manifest.webFiles,entry=entries.find(item=>item.path===relativePath);
  if(!entry)throw new Error(`Source file ${relativePath} is not part of this template version.`);
  if(!template||template.webSha256===manifest.webSha256){
    const known=manifest.webFiles.find(item=>item.path===relativePath);if(!known||known.sha256!==entry.sha256)throw new Error(`Source checksum mismatch for ${relativePath}.`);
    return readFile(path.resolve(sourceRoot,relativePath));
  }
  const packageSha=document.experience?.packSha256;if(!packageSha)throw new Error("The source package hash is missing from this publication.");
  const data=await getBlobClient(`totem-original/${packageSha}/web/${relativePath}`).downloadToBuffer();
  if(sha(data)!==entry.sha256||data.length!==entry.bytes)throw new Error(`Stored source checksum mismatch for ${relativePath}.`);
  return data;
}

async function packageAsset(url:string,files:Map<string,Buffer>,index:number){
  const id=/\/api\/assets\/([0-9a-f-]{36})\/file(?:\?.*)?$/i.exec(url)?.[1];
  if(id){const result=await getDb().query<{storageKey:string;fileName:string}>("SELECT storage_key AS \"storageKey\",file_name AS \"fileName\" FROM assets WHERE id=$1",[id]);const asset=result.rows[0];if(!asset)throw new Error(`Media asset ${id} was not found.`);const name=`custom-media/asset-${index}${safeExt(asset.fileName)}`;files.set(name,await getBlobClient(asset.storageKey).downloadToBuffer());return name;}
  const original=/\/api\/totem-original\/(.+)$/.exec(url)?.[1];
  if(original&&manifest.resources.some(item=>item.path===original)){const name=`resources/${original}`;const from=original.startsWith("media/")?path.join(sourceRoot,original):path.join(repoRoot,"packages/totem-original/resources",original);files.set(name,await readFile(from));return name;}
  const templateMedia=/\/api\/template-media\/([^/?]+)/.exec(url)?.[1];
  if(templateMedia&&manifest.resources.some(item=>item.path===`media/${templateMedia}`)){const name=`media/${templateMedia}`;files.set(name,await readFile(path.join(sourceRoot,"media",templateMedia)));return name;}
  throw new Error("Only media stored in this Backoffice or Totem original can be exported offline.");
}

function escapeHtml(value:string){return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
async function canvasBundle(document:VisualisationDocument,files:Map<string,Buffer>){
  let mediaIndex=0;const screens=[];
  for(const screen of document.screens){const denominator=screen.mode==="embedded"?1080:1920;const elements=[];
    for(const el of screen.elements){let content="";if(el.type==="image"&&el.src){const src=await packageAsset(el.src,files,mediaIndex++);content=`<img src="${src}" alt="${escapeHtml(el.title||"")}">`;}
      else if(el.type==="video"&&el.src){const src=await packageAsset(el.src,files,mediaIndex++);content=`<video src="${src}" controls muted playsinline></video>`;}
      else if(el.type==="card")content=`<strong>${escapeHtml(el.title||el.text||"")}</strong><small>${escapeHtml(el.description||"")}</small>`;
      else content=escapeHtml(el.text||el.title||"");
      const style=`left:${el.x/1080*100}%;top:${el.y/denominator*100}%;width:${el.width/1080*100}%;height:${el.height/denominator*100}%;font-size:${el.fontSize||28}px;color:${el.color||"#17366f"};background:${el.background||"transparent"};`;
      elements.push(`<div class="element ${el.type}" style="${style}" ${el.target?`data-target="${escapeHtml(el.target)}"`:""}>${content}</div>`);
    }
    screens.push(`<section class="screen ${screen.mode}" id="screen-${escapeHtml(screen.id)}" ${screens.length?"hidden":""}>${elements.join("")}</section>`);
  }
  files.set("index.html",Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>${escapeHtml(document.name)}</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07182e;font-family:Arial,sans-serif}.stage{position:absolute;left:50%;top:50%;width:min(100vw,56.25vh);aspect-ratio:9/16;transform:translate(-50%,-50%);background:white;container-type:inline-size}.screen{position:absolute;inset:0;overflow:hidden}.screen[hidden]{display:none}.element{position:absolute;display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding:2%;white-space:pre-wrap}.element.card{padding:3%;gap:1%;border-top:4px solid #00bef4}.element img,.element video{width:100%;height:100%;object-fit:cover}.element.button{align-items:center;background:#033778;color:white;cursor:pointer}</style></head><body><main class="stage">${screens.join("")}</main><script>document.addEventListener('click',e=>{const target=e.target.closest('[data-target]');if(!target)return;const dest=document.getElementById('screen-'+target.dataset.target);if(dest){document.querySelectorAll('.screen').forEach(s=>s.hidden=true);dest.hidden=false}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.screen').forEach((s,i)=>s.hidden=i!==0)}})</script></body></html>`));
}

export async function buildWebBundle(document:VisualisationDocument, exactSource=false):Promise<WebBundle>{
  const files=new Map<string,Buffer>();
  if(document.webTemplate?.id==="totem-original"||exactSource){const sourceFiles=document.webTemplate?.sourceFiles||manifest.webFiles;for(const entry of sourceFiles)files.set(entry.path,await getWebSourceFile(document,entry.path));}
  const template=document.webTemplate;
  if(!exactSource&&template?.id==="totem-original"){
    const {mediaMap,records,screens}=await resolveDocumentMedia(document);
    for(const [name,asset] of records)files.set(name,await getBlobClient(asset.storageKey).downloadToBuffer());
    for(const url of Object.values(mediaMap)){if(url.startsWith("resources/")){const original=url.slice("resources/".length);if(manifest.resources.some(item=>item.path===original)){const from=original.startsWith("media/")?path.join(sourceRoot,original):path.join(repoRoot,"packages/totem-original/resources",original);files.set(url,await readFile(from));}}}
    files.set("web-editor/overrides.js",templateOverridesScript(template,mediaMap,screens));
    const adapter=template.adapterSource?Buffer.from(template.adapterSource):await readFile(path.join(repoRoot,"packages/totem-original/web-editor/adapter.js"));
    files.set("web-editor/adapter.js",adapter);
    files.set("index.html",injectWebEditor(files.get("index.html")!));
  }
  if(!exactSource&&!template)await canvasBundle(document,files);
  const entries=[...files].map(([file,data])=>({path:file,bytes:data.length,sha256:sha(data)})).sort((a,b)=>a.path.localeCompare(b.path));
  const bundleSha256=sha(JSON.stringify(entries));
  return {files,manifest:{sourceSha256:manifest.sourceSha256,webSha256:manifest.webSha256,bundleSha256,files:entries}};
}

export function makeZip(files:Map<string,Buffer>){
  const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  const crc32=(b:Buffer)=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
  const dosDate=new Date(),time=(dosDate.getHours()<<11)|(dosDate.getMinutes()<<5)|(dosDate.getSeconds()>>1),date=((dosDate.getFullYear()-1980)<<9)|((dosDate.getMonth()+1)<<5)|dosDate.getDate();
  const locals:Buffer[]=[],centrals:Buffer[]=[];let offset=0;
  for(const [name,data] of files){const filename=Buffer.from(name),crc=crc32(data),local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(0,8);local.writeUInt16LE(time,10);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);local.writeUInt16LE(0,28);locals.push(local,filename,data);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(0,10);central.writeUInt16LE(time,12);central.writeUInt16LE(date,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt16LE(0,30);central.writeUInt16LE(0,32);central.writeUInt16LE(0,34);central.writeUInt16LE(0,36);central.writeUInt32LE(0,38);central.writeUInt32LE(offset,42);centrals.push(central,filename);offset+=local.length+filename.length+data.length;
  }
  const centralSize=centrals.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,...centrals,end]);
}
