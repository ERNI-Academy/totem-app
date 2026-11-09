import {test,expect} from '@playwright/test';
import pg from 'pg';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import http from 'node:http';
import {execFileSync} from 'node:child_process';

const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const userId=randomUUID(),token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
const ids=[];
test.beforeAll(async()=>{
  await pool.query("INSERT INTO users(id,email,display_name,role,password_hash) VALUES($1,$2,'Editor verification','user','test-session-only')",[userId,`editor-${userId}@example.invalid`]);
  await pool.query("INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",[userId,hash]);
});
test.beforeEach(async({context})=>{await context.addCookies([{name:'totem_session',value:token,url:process.env.TOTEM_TEST_URL||'http://localhost:3000',httpOnly:true,sameSite:'Lax'}]);});
test.afterAll(async()=>{
  for(const id of ids){
    await pool.query('DELETE FROM version_assets WHERE version_id IN (SELECT id FROM visualisation_versions WHERE visualisation_id=$1)',[id]);
    await pool.query('DELETE FROM visualisation_versions WHERE visualisation_id=$1',[id]);
    await pool.query('DELETE FROM visualisations WHERE id=$1',[id]);
    await pool.query("DELETE FROM audit_events WHERE entity_id=$1",[id]);
  }
  await pool.query('DELETE FROM users WHERE id=$1',[userId]);await pool.end();
});

async function create(context,name,document){
  const response=await context.request.post('/api/visualisations',{data:{name,document}});expect(response.ok(),await response.text()).toBe(true);
  const data=await response.json();ids.push(data.id);return data;
}
async function open(page,name){await page.goto('/');await page.getByRole('button',{name:`Open ${name}`,exact:true}).click();await expect(page.locator('iframe')).toBeVisible();return page.frameLocator('iframe');}
async function save(page){const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&/\/api\/visualisations\/[^/]+$/.test(r.url()));await page.getByRole('button',{name:'Save',exact:true}).click();expect((await saved).ok()).toBe(true);}

test('new editor: palette, gestures, shell media, persistence, publishing and offline ZIP',async({page,context})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const name=`Canvas verification ${Date.now()}`;
  await page.goto('/');
  page.once('dialog',dialog=>dialog.accept(name));
  const created=page.waitForResponse(r=>r.url().endsWith('/api/visualisations')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'New visualisation',exact:true}).click();
  const row=await (await created).json();ids.push(row.id);
  expect(row.document.webTemplate.contentMode).toBe('canvas');expect(row.document.screens[0].elements).toEqual([]);expect(row.document.experience.defaultPublished).toBe(false);
  const frame=await open(page,name);
  await expect(frame.locator('#bo-canvas')).toBeVisible();await expect(frame.locator('#bo-canvas .bo-element')).toHaveCount(0);
  await expect(frame.locator('section.demos').first()).toBeHidden();await expect(frame.locator('.hero')).toBeVisible();await expect(frame.locator('#vband')).toBeVisible();
  const tools=page.locator('.element-tools');
  await tools.getByRole('button',{name:'Add text',exact:true}).click();
  await expect(frame.locator('.bo-element.text')).toHaveCount(1);
  await page.locator('.props-panel').getByLabel('Text content',{exact:true}).fill('Texto del lienzo');
  await expect(frame.locator('.bo-element.text')).toHaveText('Texto del lienzo');
  const el=frame.locator('.bo-element.text');const before=await el.boundingBox();
  await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(before.x+before.width/2+35,before.y+before.height/2+25,{steps:8});await page.mouse.up();
  await expect.poll(async()=>Number(await page.locator('.props-panel').getByLabel('X',{exact:true}).inputValue())).toBeGreaterThan(72);
  const width=Number(await page.locator('.props-panel').getByLabel('Width',{exact:true}).inputValue());
  const handle=frame.locator('[data-handle=se]');const hb=await handle.boundingBox();
  await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2+20,hb.y+hb.height/2+15,{steps:6});await page.mouse.up();
  await expect.poll(async()=>Number(await page.locator('.props-panel').getByLabel('Width',{exact:true}).inputValue())).toBeGreaterThan(width);
  for(const kind of ['Image','Video','Card','Button'])await tools.getByRole('button',{name:`Add ${kind.toLowerCase()}`,exact:true}).click();
  await expect(frame.locator('.bo-element')).toHaveCount(5);
  // Native browser drag from the palette into the iframe.
  const imageTool=await tools.getByRole('button',{name:'Add image',exact:true}).boundingBox(),canvas=await frame.locator('#bo-canvas').boundingBox();
  await page.mouse.move(imageTool.x+imageTool.width/2,imageTool.y+imageTool.height/2);await page.mouse.down();
  await page.mouse.move(imageTool.x+imageTool.width/2+8,imageTool.y+imageTool.height/2,{steps:4});
  await page.mouse.move(canvas.x+canvas.width*.7,canvas.y+canvas.height*.65,{steps:20});await page.mouse.up();
  await expect(frame.locator('.bo-element')).toHaveCount(6);
  // Locking, ordering and deletion remain available through the original controls.
  await tools.getByRole('button',{name:'Add text',exact:true}).click();
  const temporary=await frame.locator('.bo-element.text').last().getAttribute('data-bo-element');
  await page.locator(`[data-layer-id="${temporary}"] .layer-lock`).click();
  await expect(page.locator('.props-panel').getByLabel('Text content',{exact:true})).toHaveCount(0);
  await expect(frame.locator('.bo-handle:visible')).toHaveCount(0);
  await page.locator(`[data-layer-id="${temporary}"] .layer-lock`).click();
  await page.getByRole('button',{name:'Send back',exact:true}).click();
  await expect(frame.locator('.bo-element').nth(5)).toHaveAttribute('data-bo-element',temporary);
  await page.getByRole('button',{name:'Bring forward',exact:true}).click();
  await expect(frame.locator('.bo-element').last()).toHaveAttribute('data-bo-element',temporary);
  await page.getByRole('button',{name:'Remove element',exact:true}).click();
  await expect(frame.locator('.bo-element')).toHaveCount(6);
  // Select the header video through the layer, despite the overlay text.
  await page.getByRole('button',{name:'Vídeo del header',exact:true}).click();
  await expect(page.locator('.props-panel .property-type')).toHaveText('WEB ELEMENT · VIDEO');await expect(page.locator('.props-panel textarea')).toHaveCount(0);
  await page.locator('.props-panel').getByRole('button',{name:'Choose media from library'}).click();
  const mediaCards=page.locator('.media-card');await expect(mediaCards.first()).toBeVisible();
  await mediaCards.filter({hasText:'talent-arena.mp4'}).first().getByRole('button').first().click();
  await expect(frame.locator('#heroVid')).toHaveAttribute('src',/live-media\//);
  await expect.poll(()=>frame.locator('#heroVid').evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
  await page.getByRole('button',{name:'Título del header',exact:true}).click();
  await page.locator('.props-panel').getByLabel('Text',{exact:true}).fill('Mi título\nSegunda línea');
  await expect(frame.locator('.hero h1')).toHaveText('Mi título\nSegunda línea');
  // Replace an SVG via the library, retaining the stable identifier.
  await page.getByRole('button',{name:'Icono del botón',exact:true}).click();
  await page.locator('.props-panel').getByRole('button',{name:'Choose media from library'}).click();
  await expect(page.locator('.media-card').first()).toBeVisible();
  await page.locator('.media-card').filter({hasText:'erni-logo.png'}).first().getByRole('button').first().click();
  await expect(frame.locator('[data-totem-shell="footer-icon"]')).toHaveJSProperty('tagName','IMG');
  // Centre image and video, using local template files for a fully offline bundle.
  const imageId=await frame.locator('.bo-element.image').first().getAttribute('data-bo-element');await page.locator(`[data-layer-id="${imageId}"] .layer-name`).click();
  await page.locator('.props-panel').getByLabel('Template image',{exact:true}).selectOption('hero-poster.jpg');
  await page.locator('.props-panel').getByLabel('Image margins').selectOption('none');
  const videoId=await frame.locator('.bo-element.video').getAttribute('data-bo-element');await page.locator(`[data-layer-id="${videoId}"] .layer-name`).click();
  await page.locator('.props-panel').getByLabel('Template video',{exact:true}).selectOption('sifu.mp4');
  await save(page);await page.reload();await page.getByRole('button',{name:`Open ${name}`,exact:true}).click();
  await expect(frame.locator('.hero h1')).toHaveText('Mi título\nSegunda línea');await expect(frame.locator('.bo-element')).toHaveCount(6);
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await expect(frame.locator('.bo-element')).toHaveCount(6);await expect(page.locator('.tools-panel')).toBeHidden();
  await frame.locator('#vband').click();await expect(frame.locator('#vision')).toHaveClass(/open/);await frame.locator('[data-v=close]').first().click();
  await page.getByRole('button',{name:'Editing',exact:true}).click();
  // Publish also saves unsaved shell changes.
  await page.getByRole('button',{name:'Subtítulo del header',exact:true}).click();
  await page.locator('.props-panel').getByLabel('Text',{exact:true}).fill('Cambio sin guardar antes de publicar');
  page.once('dialog',d=>d.accept());const published=page.waitForResponse(r=>r.url().endsWith('/publish'));
  await page.getByRole('button',{name:'Publish',exact:true}).click();expect((await published).ok()).toBe(true);
  const exported=await context.request.get(`/api/visualisations/${row.id}/export?version=1`);expect(exported.status()).toBe(200);
  const temp=await mkdtemp(path.join(tmpdir(),'totem-canvas-'));const zip=path.join(temp,'bundle.zip');await writeFile(zip,await exported.body());execFileSync('unzip',['-q',zip,'-d',path.join(temp,'web')]);
  const web=path.join(temp,'web');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
  // Opening index.html directly also works, without a local web server.
  const direct=await context.newPage(),directErrors=[],directRequests=[];
  direct.on('pageerror',error=>directErrors.push(error.message));direct.on('request',request=>directRequests.push(request.url()));
  try{await direct.goto(pathToFileURL(path.join(web,'index.html')).href);await expect(direct.locator('.hero h1')).toHaveText('Mi título\nSegunda línea');await expect(direct.locator('.bo-element')).toHaveCount(6);await expect.poll(()=>direct.locator('#heroVid').evaluate(video=>video.readyState)).toBeGreaterThanOrEqual(2);expect(directErrors).toEqual([]);expect(directRequests.every(url=>/^(file:|data:|blob:)/.test(url))).toBe(true);}
  finally{await direct.close();}
  const server=http.createServer(async(req,res)=>{try{const rel=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.join(web,rel==='/'?'index.html':rel);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const offline=await context.newPage();const requests=[];offline.on('request',r=>requests.push(r.url()));
  try{await offline.goto(base);await expect(offline.locator('.hero h1')).toHaveText('Mi título\nSegunda línea');await expect(offline.locator('.hero p')).toHaveText('Cambio sin guardar antes de publicar');await expect(offline.locator('.bo-element')).toHaveCount(6);await expect.poll(()=>offline.locator('#heroVid').evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);await offline.locator('#vband').click();await expect(offline.locator('#vision')).toHaveClass(/open/);expect(requests.every(url=>url.startsWith(base))).toBe(true);expect((await readFile(path.join(web,'index.html'),'utf8'))).not.toMatch(/_next\/|react-dom/);}
  finally{await offline.close();await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});}
  expect(errors).toEqual([]);
});

test('independent shells, full-screen destinations, bounds and migration recovery',async({page,context})=>{
  const a=await create(context,`Isolation A ${Date.now()}`),b=await create(context,`Isolation B ${Date.now()}`);
  const doc=a.document;doc.webTemplate.overrides['[data-totem-shell="hero-title"]']={text:'Only A'};
  doc.screens[0].elements=[{id:'link',type:'card',x:30,y:30,width:500,height:200,title:'Open detail',target:'detail'}];
  doc.screens.push({id:'detail',name:'Detail',mode:'fullscreen',elements:[{id:'detail-text',type:'text',x:70,y:100,width:600,height:100,text:'Full screen destination'}]});
  expect((await context.request.put(`/api/visualisations/${a.id}`,{data:{name:doc.name,revision:1,document:doc}})).ok()).toBe(true);
  const frame=await open(page,a.name);await expect(frame.locator('.hero h1')).toHaveText('Only A');
  await page.getByRole('button',{name:'Preview',exact:true}).click();await frame.getByText('Open detail',{exact:true}).click();await expect(frame.getByText('Full screen destination')).toBeVisible();await page.keyboard.press('Escape');await expect(frame.getByText('Open detail',{exact:true})).toBeVisible();await frame.getByText('Open detail',{exact:true}).click();await frame.getByRole('button',{name:'← Inicio'}).click();await expect(frame.getByText('Open detail',{exact:true})).toBeVisible();
  await open(page,b.name);await expect(frame.locator('.hero h1')).toHaveText('Swiss TechCenter');
  const invalid=structuredClone(b.document);invalid.screens[0].elements=[{id:'outside',type:'image',x:1000,y:1000,width:200,height:200}];
  expect((await context.request.put(`/api/visualisations/${b.id}`,{data:{name:b.name,revision:1,document:invalid}})).status()).toBe(400);
  // A stale save must stop publishing, preserving the server draft.
  expect((await context.request.put(`/api/visualisations/${b.id}`,{data:{name:b.name,revision:1,document:b.document}})).ok()).toBe(true);
  let publicationRequested=false;page.on('request',r=>{if(r.url().endsWith('/publish'))publicationRequested=true;});
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Publish',exact:true}).click();
  await expect(page.getByText('This draft changed in another session. Reload it before saving.',{exact:true})).toBeVisible();
  expect(publicationRequested).toBe(false);
  const records=(await pool.query("SELECT v.name,d.document_json AS document FROM visualisations v JOIN visualisation_drafts d ON d.visualisation_id=v.id WHERE v.name IN ('new','new (antes del cambio)') AND NOT v.is_deleted")).rows;
  expect(records.find(r=>r.name==='new')?.document.screens[0].elements).toEqual([]);
  expect(records.find(r=>r.name==='new')?.document.webTemplate.contentMode).toBe('canvas');
  expect(records.find(r=>r.name==='new (antes del cambio)')?.document.webTemplate.contentMode).not.toBe('canvas');
});

test('create from template starts empty, while duplication keeps canvas and original modes',async({page,context})=>{
  const name=`Template verification ${Date.now()}`;
  await page.goto('/');await page.getByRole('button',{name:'Templates',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept(name));
  const created=page.waitForResponse(r=>r.url().endsWith('/api/visualisations')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Create from template',exact:true}).click();
  const canvas=await (await created).json();ids.push(canvas.id);
  expect(canvas.document.webTemplate.contentMode).toBe('canvas');expect(canvas.document.screens[0].elements).toEqual([]);
  await page.goto('/');const firstCopy=page.waitForResponse(r=>r.url().endsWith('/api/visualisations')&&r.request().method()==='POST');
  await page.locator('.visual-card').filter({has:page.getByRole('heading',{name,exact:true})}).getByTitle('Duplicate',{exact:true}).click();
  const copiedCanvas=await (await firstCopy).json();ids.push(copiedCanvas.id);expect(copiedCanvas.document.webTemplate.contentMode).toBe('canvas');
  const template=(await (await context.request.get('/api/templates')).json()).templates.find(t=>t.id==='totem-original');
  const original=await create(context,`Original mode verification ${Date.now()}`,template.document);
  await page.goto('/');const duplicate=page.waitForResponse(r=>r.url().endsWith('/api/visualisations')&&r.request().method()==='POST');
  await page.locator('.visual-card').filter({has:page.getByRole('heading',{name:original.name,exact:true})}).getByTitle('Duplicate',{exact:true}).click();
  const copy=await (await duplicate).json();ids.push(copy.id);
  expect(copy.document.webTemplate.contentMode??'original').toBe('original');expect(copy.document.experience.defaultPublished).toBe(false);
  const frame=await open(page,copy.name);await expect(frame.locator('#grid .tile')).toHaveCount(5);await expect(frame.locator('#grid')).toBeVisible();await expect(frame.locator('#bo-canvas')).toHaveCount(0);
  await frame.locator('.hero h1').click();await page.locator('.props-panel').getByLabel('Text',{exact:true}).fill('Título de la plantilla completa');await expect(frame.locator('.hero h1')).toHaveText('Título de la plantilla completa');
});
