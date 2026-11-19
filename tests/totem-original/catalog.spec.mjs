import {test, expect} from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ZipWriter,Uint8ArrayReader,Uint8ArrayWriter} from '@zip.js/zip.js';

test('fresh catalogue, install, restart, interrupted update, withdrawal and offline fallback', async ({page}) => {
  const temp = await mkdtemp(path.join(os.tmpdir(),'kiosk-test-'));
  const original = JSON.parse(await readFile('packages/totem-original/dist/android/original.json'));
  const thumb = await readFile('packages/kiosk/original.webp');
  const id = '19ffc05a-308d-43c2-aaaa-b50a0ba82990';
  const builds = [];
  for (const label of ['Primera','Segunda']) {
    const writer = new ZipWriter(new Uint8ArrayWriter(),{level:0,useWebWorkers:false});
    await writer.add('index.html',new Uint8ArrayReader(Buffer.from('<!doctype html><html><head></head><body><h1>'+label+'</h1></body></html>')));
    const zip = Buffer.from(await writer.close());
    builds.push({zip,sha256:createHash('sha256').update(zip).digest('hex')});
  }

  let version = 0, queries = 0, downloads = 0, interrupt = false, offline = false;
  const upstream = http.createServer((req,res) => {
    const base = 'http://127.0.0.1:'+upstream.address().port;
    if (req.url === '/api/totem/catalog') {
      queries++;
      if (offline) {res.writeHead(503).end();return;}
      const entries = [{...original,version:5,isDefault:true,size:1,sha256:'0'.repeat(64),downloadUrl:base+'/original.zip',thumbnailUrl:base+'/thumb'}];
      if (version) entries.push({id,name:'Prueba',version,size:builds[version-1].zip.length,sha256:builds[version-1].sha256,downloadUrl:base+'/zip',thumbnailUrl:base+'/thumb'});
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({visualisations:entries}));
    } else if (req.url === '/zip') {
      downloads++;
      const {zip} = builds[version-1];
      res.writeHead(200).end(interrupt ? zip.subarray(0,13) : zip);
    } else if (req.url === '/thumb') res.writeHead(200,{'Content-Type':'image/webp'}).end(thumb);
    else res.writeHead(404).end();
  });
  upstream.listen(0,'127.0.0.1'); await once(upstream,'listening');
  const sim = spawn(process.execPath,['tests/totem-original/server.mjs'],{env:{...process.env,TOTEM_BACKOFFICE_URL:'http://127.0.0.1:'+upstream.address().port,TOTEM_SIMULATOR_CACHE:temp,TOTEM_SIMULATOR_PORT:'0'}});
  // The simulator prints its bound port once it is ready.
  try {
    const [line] = await once(sim.stdout,'data');
    const url = line.toString().match(/http:\/\/\S+/)[0];
    await page.goto(url);
    const frame = page.frameLocator('#totem'), picker = page.locator('#picker');
    const menu = async () => {
      await expect(page.locator('#totem')).toHaveCount(1);
      await page.mouse.click(100,48,{clickCount:3,delay:50});
      await expect(picker).toBeVisible();
    };
    const tile = page.getByRole('button',{name:/Prueba/});
    await expect(frame.locator('#grid .tile')).toHaveCount(5);
    await page.mouse.click(400,48,{clickCount:3}); await expect(picker).toBeHidden();
    await page.mouse.click(100,48,{clickCount:2}); await page.waitForTimeout(750);
    await page.mouse.click(100,48); await expect(picker).toBeHidden();
    await menu(); await expect(page.locator('.tile strong')).toHaveCount(1);
    await page.getByRole('button',{name:'Cerrar galería'}).click();
    version = 1;
    await menu(); await expect(tile).toBeVisible(); expect(queries).toBe(2);
    await tile.click(); await expect(frame.locator('h1')).toHaveText('Primera');
    expect(downloads).toBe(1);
    await page.reload(); await expect(frame.locator('h1')).toHaveText('Primera');
    await menu(); await tile.click(); await expect(picker).toBeHidden(); expect(downloads).toBe(1);
    version = 2; interrupt = true;
    await menu(); await expect(tile.getByRole('img',{name:'Actualización disponible'})).toBeVisible();
    await tile.click(); await expect(page.locator('#status')).toContainText('No se pudo');
    await expect(frame.locator('h1')).toHaveText('Primera');
    await page.getByRole('button',{name:'Abrir copia guardada'}).click();
    await expect(picker).toBeHidden(); expect(downloads).toBe(2);
    interrupt = false; await menu(); await tile.click(); await expect(frame.locator('h1')).toHaveText('Segunda');
    await expect.poll(async()=> (await readdir(temp)).filter(f => !f.startsWith('.')).length).toBe(1);
    offline = true; await page.reload(); await expect(frame.locator('h1')).toHaveText('Segunda');
    await menu(); await expect(page.getByRole('button',{name:'Reintentar'})).toBeVisible();
    await page.getByRole('button',{name:original.name}).click(); await expect(frame.locator('#grid .tile')).toHaveCount(5);
    await menu(); await tile.click(); await expect(frame.locator('h1')).toHaveText('Segunda');
    expect(downloads).toBe(3);
    offline=false; version=0; await menu(); await expect(page.locator('.tile strong')).toHaveCount(1);
    await expect(tile).toHaveCount(0); await expect(frame.locator('h1')).toHaveText('Segunda');
  } finally {
    sim.kill(); upstream.closeAllConnections(); upstream.close();
    await rm(temp,{recursive:true,force:true});
  }
});
