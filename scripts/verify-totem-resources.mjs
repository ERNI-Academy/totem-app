import {readFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import manifest from '../packages/totem-original/manifest.json' with {type:'json'};
export async function verifyTotemResources(){
 for(const entry of manifest.resources){
  const file=new URL(`../packages/totem-original/resources/${entry.path}`,import.meta.url);
  try{await readFile(file);}catch(error){
   if(error.code!=='ENOENT'||!entry.path.startsWith('media/'))throw error;
   await mkdir(path.dirname(file.pathname),{recursive:true});
   await copyFile(new URL(`../totem-web/${entry.path}`,import.meta.url),file);
  }
  const buffer=await readFile(file);
  if(entry.path.startsWith('icons/')&&entry.path.endsWith('.png')){const info=await sharp(buffer).metadata();if(info.width!==512||!info.hasAlpha)throw new Error(`Invalid reusable PNG: ${entry.path}`);}
  if(createHash('sha256').update(buffer).digest('hex')!==entry.sha256)throw new Error(`Resource differs from published manifest: ${entry.path}. Import the updated source explicitly before rebuilding.`);
 }
}
