import { readFile } from 'node:fs/promises';
import { verifyTotemResources } from './verify-totem-resources.mjs';
await verifyTotemResources();
import { createHash } from 'node:crypto';
import { BlobServiceClient } from '@azure/storage-blob';
import pg from 'pg';
import { applyOriginalPublication } from '../totem-backoffice/db-original.mjs';
import manifest from '../packages/totem-original/manifest.json' with {type:'json'};

const service=BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const prefix=`totem-original/${manifest.packSha256}`;
const types={'.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.mp4':'video/mp4','.woff2':'font/woff2','.css':'text/css','.js':'text/javascript','.json':'application/json','.html':'text/html','.md':'text/markdown'};
const displayName=path=>{const file=path.split('/').pop();const names={'ui-01':'arrow-forward','ui-02':'arrow-back','ui-03':'close','ui-04':'chevron-forward','ui-05':'ai-vision-roof','ui-06':'video-placeholder','talent-0':'talent-purpose','talent-1':'talent-arena'};return Object.entries(names).reduce((s,[a,b])=>s.replace(a+'-',b+'-'),file);};
const contentType=path=>types[path.slice(path.lastIndexOf('.'))]||'application/octet-stream';
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
function assetId(path,environment) {const h=sha(`totem-original/${manifest.sourceSha256}/${path}:${environment}`).slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20)}`;}
const all=[...manifest.resources.map(e=>({...e,sourcePath:e.path.startsWith('media/')?`web/${e.path}`:`resources/${e.path}`})),...manifest.webFiles.map(e=>({...e,path:`web/${e.path}`,sourcePath:`web/${e.path}`})),{path:'manifest.json',sourcePath:'manifest.json',bytes:0,sha256:''}];
let uploaded=0,verified=0;
for(const name of ['totem-media-dev','totem-media']) {
  const container=service.getContainerClient(name);
  await container.createIfNotExists();
  for(let start=0;start<all.length;start+=4) await Promise.all(all.slice(start,start+4).map(async entry=>{
    const data=entry.path==='manifest.json'?Buffer.from(JSON.stringify(manifest,null,2)):await readFile(new URL(`../packages/totem-original/${entry.sourcePath}`,import.meta.url));
    const checksum=sha(data);
    if(entry.sha256&&entry.sha256!==checksum)throw new Error(`Local checksum mismatch: ${entry.path}`);
    const blob=container.getBlockBlobClient(`${prefix}/${entry.path}`);
    const existing=await blob.getProperties().catch(e=>e.statusCode===404?null:Promise.reject(e));
    if(existing&&existing.metadata?.source_sha256!==checksum)throw new Error(`Immutable destination differs: ${name}/${entry.path}`);
    if(!existing){await blob.uploadData(data,{conditions:{ifNoneMatch:'*'},blobHTTPHeaders:{blobContentType:contentType(entry.path),blobCacheControl:'private, max-age=86400'},metadata:{source_sha256:checksum}});uploaded++;}
    const props=await blob.getProperties();
    if(props.contentLength!==data.length||props.metadata?.source_sha256!==checksum)throw new Error(`Remote verification failed: ${entry.path}`);
    verified++;
  }));
  console.log(`${name}: ${all.length} resources verified`);
}
if(process.env.DATABASE_URL){
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    for(const environment of ['development','production']) for(const entry of manifest.resources.filter(e=>/\.(png|jpg|mp4)$/.test(e.path))) {
      await client.query('INSERT INTO assets(id,file_name,content_type,size_bytes,sha256,storage_key,environment) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET file_name=excluded.file_name,storage_key=excluded.storage_key,sha256=excluded.sha256,size_bytes=excluded.size_bytes',[assetId(entry.path,environment),displayName(entry.path),contentType(entry.path),entry.bytes,entry.sha256,`${prefix}/${entry.path}`,environment]);
    }
    await applyOriginalPublication(client);
    await client.query('COMMIT');
    console.log('Reusable images, PNG icons and videos registered for development and production in the configured database.');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
}
console.log(`Uploaded=${uploaded}; verified=${verified}; prefix=${prefix}`);
