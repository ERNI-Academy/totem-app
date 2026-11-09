import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
const root='packages/totem-original',manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');

test('every APK web file is byte-identical to the reference project',async()=>{
  for(const entry of manifest.webFiles){const source=await readFile(path.join(root,'web',entry.path)),apk=await readFile(path.join(root,'dist/android',entry.path));expect(source.length,entry.path).toBe(entry.bytes);expect(sha(source),entry.path).toBe(entry.sha256);expect(apk.equals(source),entry.path).toBe(true);}
  const publication=JSON.parse(await readFile(`${root}/dist/android/publication.json`,'utf8'));expect(publication.isDefault).toBe(true);expect(publication.webSha256).toBe(manifest.webSha256);
  expect(manifest.webFiles.some(f=>f.path==='index.html')).toBe(true);
  expect(manifest.webFiles.some(f=>f.path==='vendor/three.min.js')).toBe(true);
});

for(const kind of ['reference','apk'])test(`${kind}: source interactions, all cards and original media operate offline`,async({page})=>{
  const failures=[];page.on('pageerror',error=>failures.push(error.message));
  await page.goto(`http://127.0.0.1:4317/${kind}/`);await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('#grid .tile')).toHaveCount(5);await expect(page.locator('#tgrid .tile')).toHaveCount(2);
  await expect(page.locator('#heroVid')).toHaveAttribute('src','media/hero.mp4');
  const urls=[];page.on('request',request=>urls.push(request.url()));
  await page.locator('#grid .tile').nth(0).click();await expect(page.locator('#modal')).toHaveClass(/open/);await expect(page.locator('#sceneWrap svg')).toHaveCount(1);
  await expect.poll(()=>page.locator('#sceneWrap svg').evaluate(node=>node.outerHTML.length)).toBeGreaterThan(300);
  await page.keyboard.press('ArrowRight');await expect(page.locator('#mtitle')).toHaveText('Vision‑guided lab automation');
  await page.locator('[data-act="close"]').first().click();await page.locator('#grid .tile').nth(3).click();await page.locator('.vtoggle button').getByText('Photo',{exact:true}).click();await expect(page.locator('.layer.on img')).toHaveAttribute('src',/sifu-robot-piano/);
  await page.locator('[data-act="close"]').first().click();await page.locator('#vband').click();await expect(page.locator('#vision')).toHaveClass(/open/);await expect(page.locator('#pills .pl')).toHaveCount(5);await page.keyboard.press('Escape');await expect(page.locator('#vision')).not.toHaveClass(/open/);
  await page.locator('#tgrid .tile').nth(1).click();await expect(page.locator('#player')).toHaveClass(/open/);await expect(page.locator('#pvid')).toHaveAttribute('src',/talent-arena\.mp4/);await page.locator('[data-p="close"]').first().click();
  expect(failures).toEqual([]);expect(urls.every(url=>url.startsWith(`http://127.0.0.1:4317/${kind}/`))).toBe(true);
});

test('PNG derivatives remain available for re-use and have transparent backgrounds',async()=>{
  const icons=manifest.resources.filter(f=>f.path.startsWith('icons/')&&f.path.endsWith('.png'));expect(icons.length).toBeGreaterThanOrEqual(36);
  for(const item of icons){const data=await readFile(path.join(root,'resources',item.path));expect(sha(data),item.path).toBe(item.sha256);const info=await sharp(data).metadata();expect(info.width,item.path).toBe(512);expect(info.hasAlpha,item.path).toBe(true);}
});

test('web editor adapter persists layout, leaf text, dynamic content and replacement icons',async({page})=>{
  await page.goto('http://127.0.0.1:4317/reference/');
  await page.setContent('<main id="stage" style="position:relative;width:1080px;height:1920px"><p id="editable" style="position:absolute;left:40px;top:20px;width:300px;height:80px;margin:0">Original</p><svg id="icon" viewBox="0 0 10 10"><circle r="4" cx="5" cy="5"/></svg></main>');
  await page.evaluate(()=>{window.__TOTEM_WEB_OVERRIDES__={};window.__TOTEM_WEB_MEDIA__={};window.addEventListener('message',e=>{if(e.data?.type==='totem-element-selected')window.__selected=e.data.element;});});
  await page.addScriptTag({path:'packages/totem-original/web-editor/adapter.js'});
  await page.evaluate(()=>window.postMessage({type:'totem-editor-mode',enabled:true},location.origin));
  await page.locator('#editable').click();await expect.poll(()=>page.evaluate(()=>window.__selected?.selector)).toBe('#editable');
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/gZsAAAAASUVORK5CYII=';
  await page.evaluate(png=>window.postMessage({type:'totem-web-overrides',overrides:{'#editable':{text:'Edited headline',x:150,y:90,width:220,height:55}}},location.origin),png);
  await expect(page.locator('#editable')).toHaveText('Edited headline');await expect(page.locator('#editable')).toHaveCSS('width','220px');await expect(page.locator('#editable')).toHaveCSS('translate','110px 70px');
  await page.locator('#editable').evaluate(node=>node.textContent='Replaced dynamically');await expect(page.locator('#editable')).toHaveText('Edited headline');
  await page.evaluate(png=>window.postMessage({type:'totem-web-media',media:{'#icon':png}},location.origin),png);await expect(page.locator('#stage img')).toHaveCount(1);await expect(page.locator('#stage svg')).toHaveCount(0);
});
