import { readFile, writeFile, mkdir, cp, rm, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import sharp from 'sharp';

const preferredSource='/home/davidwalker/Projects/totem-web';
const sourceDir=path.resolve(process.argv[2]||(await access(preferredSource).then(()=>preferredSource).catch(()=> 'totem-web')));
const dest=path.resolve('packages/totem-original'), webDir=path.join(dest,'web'), resources=path.join(dest,'resources');
const hash=value=>createHash('sha256').update(value).digest('hex');
const html=await readFile(path.join(sourceDir,'index.html'),'utf8');
await rm(webDir,{recursive:true,force:true});await cp(sourceDir,webDir,{recursive:true,filter:src=>!src.includes('/.git')});
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const contentCode=between('const ICONS =','/* ===================== HELPERS')+between('const TALENT=','const tgrid=')+between('const PILLARS=','/* the mini house')+between('const INDUSTRIES=','function ctxHTML');
const content=JSON.parse(vm.runInNewContext(contentCode+'; JSON.stringify({ICONS,DEMOS,TALENT,PILLARS,PSVG,INDUSTRIES,PCTX})'));
const sceneTemplates=Object.fromEntries([...html.matchAll(/<template id="tpl-([^"]+)">([\s\S]*?)<\/template>/g)].map(m=>[m[1],m[2].trim()]));
await rm(resources,{recursive:true,force:true});await mkdir(resources,{recursive:true});
await cp(path.join(sourceDir,'media'),path.join(resources,'media'),{recursive:true});await cp(path.join(sourceDir,'fonts'),path.join(resources,'fonts'),{recursive:true});
await mkdir(path.join(resources,'animations'),{recursive:true});
for(const [name,svg] of Object.entries(sceneTemplates))await writeFile(path.join(resources,'animations',name+'.svg'),svg);
const icons=[...Object.entries(content.ICONS).map(([name,svg])=>['demo-'+name,svg]),...content.TALENT.map((v,i)=>['talent-'+i,v.icon]),...Object.entries(content.PSVG).map(([name,svg])=>['ai-'+name,`<svg viewBox="0 0 24 24">${svg}</svg>`])];
const markupSvgs=[...between('<div id="stage">','<!-- ================= SCENE TEMPLATES').matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m=>m[0]);
const seen=new Set(icons.map(([,svg])=>svg));for(const svg of markupSvgs)if(!seen.has(svg)){seen.add(svg);icons.push(['ui-'+String(icons.length-11).padStart(2,'0'),svg]);}
await mkdir(path.join(resources,'icons'),{recursive:true});
for(const [name,svg] of icons)for(const [variant,color] of [['navy','#033778'],['white','#ffffff']]){
  const styled=svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace('>',`><style>svg{fill:none;stroke:${color};stroke-width:${name.startsWith('ai-')?1.7:name.startsWith('ui-')?3:2.6};stroke-linecap:round;stroke-linejoin:round}.acc{fill:#00BEF4;stroke:#00BEF4}.accl{stroke:#00BEF4;fill:none}</style>`);
  await writeFile(path.join(resources,'icons',name+'-'+variant+'.svg'),styled);await sharp(Buffer.from(styled)).resize({width:512}).png().toFile(path.join(resources,'icons',name+'-'+variant+'.png'));
}
async function inventory(dir,base){const out=[];for(const f of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,f.name);if(f.isDirectory())out.push(...await inventory(full,base));else{const data=await readFile(full);out.push({path:path.relative(base,full).replaceAll('\\','/'),bytes:data.length,sha256:hash(data)});}}return out;}
const resourcesList=(await inventory(resources,resources)).sort((a,b)=>a.path.localeCompare(b.path));
const webFiles=(await inventory(webDir,webDir)).sort((a,b)=>a.path.localeCompare(b.path));
const sourceSha256=hash(html),webSha256=hash(JSON.stringify(webFiles)),resourceSha256=hash(JSON.stringify(resourcesList));
const packSha256=hash(JSON.stringify({resourceSha256,webSha256}));
const manifest={packSha256,schemaVersion:2,id:'totem-original',sourceSha256,webSha256,renderer:'web',defaultPublished:true,webFiles,animationDurations:{assembly:12,lab:12,caricature:13,sifu:10.4,dpcr:26},resources:resourcesList};
await writeFile(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const webPublication={sourceSha256,webSha256,bundleSha256:webSha256,files:webFiles};
const document={schemaVersion:1,width:1080,height:1920,name:'Totem original',experience:{id:'totem-original',sourceSha256,packSha256,defaultPublished:true},webTemplate:{id:'totem-original',sourceSha256,webSha256,sourceFiles:webFiles,overrides:{}},webPublication,screens:[{id:'home',name:'Inicio',mode:'embedded',elements:[...content.DEMOS.map((d,i)=>({id:'demo-'+d.id,type:'card',x:i===4?56:56+(i%2)*494,y:142+Math.floor(i/2)*200,width:i===4?968:474,height:180,title:d.tile,description:d.line,target:d.id,locked:true})),...content.TALENT.map((v,i)=>({id:'talent-'+i,type:'video',x:56+i*494,y:958,width:474,height:180,title:v.title,locked:true}))]},...content.DEMOS.map(d=>({id:d.id,name:d.tile,mode:'fullscreen',elements:[{id:d.id+'-title',type:'text',x:56,y:1010,width:968,height:100,text:d.title,locked:true},{id:d.id+'-lead',type:'text',x:56,y:1130,width:968,height:240,text:d.lead,locked:true}]}))]};
await writeFile(path.join(dest,'document.json'),JSON.stringify(document,null,2)+'\n');
console.log(`Imported byte-identical web project (${webFiles.length} files; SHA-256 ${webSha256}) and ${icons.length} reusable SVG/PNG icons.`);
