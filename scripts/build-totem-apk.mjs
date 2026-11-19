import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import manifest from '../packages/totem-original/manifest.json' with {type:'json'};

const root = path.resolve('packages/totem-original');
const dist = path.join(root,'dist');
const defaultId = '00000000-0000-4000-8000-000000000001';
await mkdir(dist,{recursive:true});
const temp = await mkdtemp(path.join(dist,'android-build-'));
try {
  for (const item of manifest.webFiles) {
    const bytes = await readFile(path.join(root,'web',item.path));
    if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error('Original changed: ' + item.path);
  }
  await cp(path.join(root,'web'),temp,{recursive:true});
  await cp('packages/kiosk',temp,{recursive:true});
  const publication = {visualisationId:defaultId, name:'Totem original', isDefault:true, webSha256:manifest.webSha256, files:manifest.webFiles};
  await writeFile(path.join(temp,'publication.json'),JSON.stringify(publication));
  const config = {id:defaultId, name:publication.name, bundleSha256:manifest.webSha256};
  await writeFile(path.join(temp,'original.json'),JSON.stringify(config));
  await rm(path.join(dist,'android'),{recursive:true,force:true});
  await rename(temp,path.join(dist,'android'));
} finally {await rm(temp,{recursive:true,force:true});}
console.log('Totem original and the online catalogue launcher are ready.');
