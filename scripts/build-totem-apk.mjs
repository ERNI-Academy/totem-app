import { mkdir, cp, writeFile, rm } from 'node:fs/promises';
import manifest from '../packages/totem-original/manifest.json' with { type: 'json' };

const outdir='packages/totem-original/dist/android';
await rm(outdir,{recursive:true,force:true});
await mkdir(outdir,{recursive:true});
await cp('packages/totem-original/web',outdir,{recursive:true});
await writeFile(`${outdir}/publication.json`,JSON.stringify({visualisationId:'00000000-0000-4000-8000-000000000001',name:'Totem original',isDefault:true,isPublished:true,sourceSha256:manifest.sourceSha256,webSha256:manifest.webSha256,files:manifest.webFiles},null,2));
console.log(`Bundled exact standalone Totem web publication (${manifest.webFiles.length} source files, ${manifest.webSha256}) for Android.`);
