import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BlobServiceClient} from '@azure/storage-blob';
import pg from 'pg';
import manifest from '../packages/totem-original/manifest.json' with {type:'json'};
const service=BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const prefix=`totem-original/${manifest.packSha256}`;
const resources=[...manifest.resources,...manifest.webFiles.map(e=>({...e,path:`web/${e.path}`})),{path:'manifest.json',sha256:createHash('sha256').update(JSON.stringify(manifest,null,2)).digest('hex')}];
const report={sourceSha256:manifest.sourceSha256,webSha256:manifest.webSha256,packSha256:manifest.packSha256,verifiedAt:new Date().toISOString(),containers:{}};
for(const name of ['totem-media-dev','totem-media']){
 const container=service.getContainerClient(name);let bytes=0;
 for(let i=0;i<resources.length;i+=4)await Promise.all(resources.slice(i,i+4).map(async entry=>{
  const response=await container.getBlobClient(`${prefix}/${entry.path}`).download();
  const h=createHash('sha256');for await(const chunk of response.readableStreamBody){h.update(chunk);bytes+=chunk.length;}
  if(h.digest('hex')!==entry.sha256)throw new Error(`Downloaded bytes differ: ${name}/${entry.path}`);
 }));
 report.containers[name]={resources:resources.length,downloadedBytes:bytes,sha256Matches:true};console.log(`${name}: ${resources.length} downloaded SHA-256 checks passed`);
}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
 const r=await pool.query("SELECT environment,count(*)::int AS count FROM assets WHERE storage_key LIKE $1 GROUP BY environment",[`${prefix}/%`]);report.library=r.rows;
 const v=await pool.query("SELECT version_number,document_json->'experience' AS experience,document_json->'webPublication' AS webPublication FROM visualisation_versions WHERE visualisation_id='00000000-0000-4000-8000-000000000001' ORDER BY version_number DESC LIMIT 1");report.defaultPublication=v.rows[0];
}finally{await pool.end();}
await writeFile('docs/TOTEM_ORIGINAL_BLOB_VERIFICATION.json',JSON.stringify(report,null,2)+'\n');
