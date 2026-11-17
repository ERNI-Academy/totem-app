import { createHash } from 'node:crypto';
import { mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { BlobServiceClient } from '@azure/storage-blob';
import manifest from '../packages/totem-original/manifest.json' with { type: 'json' };

const { Pool } = pg;
const root = process.cwd();
const sourceDir = path.join(root, 'packages/totem-original/web');
const outdir = path.join(root, 'packages/totem-original/dist/android');
const originalId = '00000000-0000-4000-8000-000000000001';
const hash = value => createHash('sha256').update(value).digest('hex');
const scriptValue = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const safeExt = name => /\.[a-z0-9]{1,8}$/i.exec(name)?.[0].toLowerCase() || '.bin';
const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await cp(sourceDir, outdir, { recursive: true });
await writeFile(path.join(outdir, 'publication.json'), JSON.stringify({ visualisationId: originalId, name: 'Totem original', isDefault: true, sourceSha256: manifest.sourceSha256, webSha256: manifest.webSha256, files: manifest.webFiles }, null, 2));

const connectionString = process.env.DATABASE_URL;
const storageConnection = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER;
if (!connectionString || !storageConnection || !containerName) throw new Error('APK catalog build requires DATABASE_URL, AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER in totem-backoffice/.env.local.');
let included = [{ id: originalId, name: 'Totem original', path: 'index.html', isDefault: true }];
{
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 7000 });
  const blobService = BlobServiceClient.fromConnectionString(storageConnection);
  const container = blobService.getContainerClient(containerName);
  try {
    const rows = await pool.query(`
    SELECT DISTINCT ON (v.id) v.id::text AS id, v.name, p.version_number AS version, p.document_json AS document
    FROM visualisations v JOIN visualisation_versions p ON p.visualisation_id=v.id
    WHERE v.is_deleted=false AND v.is_protected=false
    ORDER BY v.id,p.version_number DESC
    `);
    for (const row of rows.rows) {
      const bundleRoot = `visualisations/${row.id}`;
      const destination = path.join(outdir, bundleRoot);
      await mkdir(destination, { recursive: true });
      const files = new Map();
      let mediaIndex = 0;
      const document = row.document;
      if (document.webTemplate?.id === 'totem-original') {
        const template = document.webTemplate;
        const sourceFiles = template.sourceFiles || manifest.webFiles;
        const packageSha = document.experience?.packSha256;
        for (const entry of sourceFiles) {
          let data;
          const local = manifest.webFiles.find(item => item.path === entry.path && item.sha256 === entry.sha256);
          if (local) data = await readFile(path.join(sourceDir, entry.path));
          else if (packageSha) data = await container.getBlobClient(`totem-original/${packageSha}/web/${entry.path}`).downloadToBuffer();
          else throw new Error(`Source file ${entry.path} for ${row.name} is unavailable.`);
          if (data.length !== entry.bytes || hash(data) !== entry.sha256) throw new Error(`Source checksum mismatch in ${row.name}: ${entry.path}`);
          files.set(entry.path, data);
        }
        const mediaMap = {};
        const allMedia = { ...(template.media || {}) };
        if (template.contentMode === 'canvas') for (const screen of document.screens || []) for (const element of screen.elements || []) if (element.src) allMedia[`canvas:${element.id}`] = element.src;
        for (const [selector, url] of Object.entries(allMedia)) {
          if (selector.startsWith('canvas:')) continue;
          const assetId = /^\/api\/assets\/([0-9a-f-]{36})\/file(?:\?.*)?$/i.exec(url)?.[1];
          if (assetId) {
            const asset = (await pool.query('SELECT storage_key,file_name FROM assets WHERE id=$1', [assetId])).rows[0];
            if (!asset) throw new Error(`Published asset ${assetId} in ${row.name} is missing.`);
            const name = `custom-media/asset-${mediaIndex++}${safeExt(asset.file_name)}`;
            files.set(name, await container.getBlobClient(asset.storage_key).downloadToBuffer()); mediaMap[selector] = name;
          } else {
            const templateFile = /\/api\/template-media\/([^/?]+)/.exec(url)?.[1];
            const originalFile = /\/api\/totem-original\/(.+)$/.exec(url)?.[1];
            if (templateFile && manifest.webFiles.some(item => item.path === `media/${templateFile}`)) mediaMap[selector] = `media/${templateFile}`;
            else if (originalFile) {
              const source = path.join(root, 'packages/totem-original/resources', originalFile);
              const name = `resources/${originalFile}`; files.set(name, await readFile(source)); mediaMap[selector] = name;
            } else if (manifest.webFiles.some(item => item.path === url)) mediaMap[selector] = url;
            else throw new Error(`Unsupported published media URL in ${row.name}: ${url}`);
          }
        }
        for (const [selector, url] of Object.entries(allMedia)) if (selector.startsWith('canvas:')) {
          const assetId = /^\/api\/assets\/([0-9a-f-]{36})\/file(?:\?.*)?$/i.exec(url)?.[1];
          if (assetId) {
            const asset = (await pool.query('SELECT storage_key,file_name FROM assets WHERE id=$1', [assetId])).rows[0];
            if (!asset) throw new Error(`Published canvas asset ${assetId} in ${row.name} is missing.`);
            const name = `custom-media/asset-${mediaIndex++}${safeExt(asset.file_name)}`;
            files.set(name, await container.getBlobClient(asset.storage_key).downloadToBuffer()); mediaMap[selector] = name;
          } else mediaMap[selector] = url;
        }
        const screens = (document.screens || []).map(screen => ({ ...screen, elements: (screen.elements || []).map(element => ({ ...element, src: element.src ? (mediaMap[`canvas:${element.id}`] || element.src) : undefined })) }));
        files.set('web-editor/overrides.js', Buffer.from(`window.__TOTEM_WEB_OVERRIDES__=${scriptValue(template.overrides || {})};window.__TOTEM_WEB_MEDIA__=${scriptValue(Object.fromEntries(Object.entries(mediaMap).filter(([key]) => !key.startsWith('canvas:'))))};window.__TOTEM_WEB_DOCUMENT__=${scriptValue({ contentMode: template.contentMode || 'original', screens })};`));
        const adapter = template.adapterSource || await readFile(path.join(root, 'packages/totem-original/web-editor/adapter.js'), 'utf8');
        files.set('web-editor/adapter.js', Buffer.from(adapter));
        const html = files.get('index.html');
        if (!html) throw new Error(`Published HTML entrypoint is missing for ${row.name}.`);
        files.set('index.html', Buffer.from(html.toString('utf8').replace(/<\/body>/i, '<script src="web-editor/overrides.js"></script><script src="web-editor/adapter.js"></script></body>')));
      } else {
        const screens = [];
        for (const screen of document.screens || []) {
          const denominator = screen.mode === 'embedded' ? 1080 : 1920;
          const elements = [];
          for (const element of screen.elements || []) {
            let content = '';
            if ((element.type === 'image' || element.type === 'video') && element.src) {
              const assetId = /^\/api\/assets\/([0-9a-f-]{36})\/file(?:\?.*)?$/i.exec(element.src)?.[1];
              if (!assetId) throw new Error(`Unsupported canvas media in ${row.name}.`);
              const asset = (await pool.query('SELECT storage_key,file_name FROM assets WHERE id=$1', [assetId])).rows[0];
              if (!asset) throw new Error(`Published canvas asset ${assetId} in ${row.name} is missing.`);
              const mediaName = `custom-media/asset-${mediaIndex++}${safeExt(asset.file_name)}`;
              files.set(mediaName, await container.getBlobClient(asset.storage_key).downloadToBuffer());
              content = element.type === 'video' ? `<video src="${mediaName}" controls muted playsinline></video>` : `<img src="${mediaName}" alt="${escapeHtml(element.title)}">`;
            } else if (element.type === 'card') content = `<strong>${escapeHtml(element.title || element.text)}</strong><small>${escapeHtml(element.description)}</small>`;
            else content = escapeHtml(element.text || element.title || '');
            const style = `left:${element.x / 1080 * 100}%;top:${element.y / denominator * 100}%;width:${element.width / 1080 * 100}%;height:${element.height / denominator * 100}%;font-size:${element.fontSize || 28}px;color:${element.color || '#17366f'};background:${element.background || 'transparent'};`;
            elements.push(`<div class="element ${element.type}" style="${style}" ${element.target ? `data-target="${escapeHtml(element.target)}"` : ''}>${content}</div>`);
          }
          screens.push(`<section class="screen ${screen.mode}" id="screen-${escapeHtml(screen.id)}" ${screens.length ? 'hidden' : ''}>${elements.join('')}</section>`);
        }
        files.set('index.html', Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>${escapeHtml(row.name)}</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07182e;font-family:Arial,sans-serif}.stage{position:absolute;left:50%;top:50%;width:min(100vw,56.25vh);aspect-ratio:9/16;transform:translate(-50%,-50%);background:white;container-type:inline-size}.screen{position:absolute;inset:0;overflow:hidden}.screen[hidden]{display:none}.element{position:absolute;display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding:2%;white-space:pre-wrap}.element.card{padding:3%;gap:1%;border-top:4px solid #00bef4}.element img,.element video{width:100%;height:100%;object-fit:cover}.element.button{align-items:center;background:#033778;color:white;cursor:pointer}</style></head><body><main class="stage">${screens.join('')}</main><script>document.addEventListener('click',e=>{const t=e.target.closest('[data-target]');if(!t)return;const d=document.getElementById('screen-'+t.dataset.target);if(d){document.querySelectorAll('.screen').forEach(s=>s.hidden=true);d.hidden=false}});document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.screen').forEach((s,i)=>s.hidden=i!==0)})</script></body></html>`));
      }
      for (const [name, data] of files) { const target = path.resolve(destination, name); if (!target.startsWith(destination + path.sep)) throw new Error('Unsafe publication path.'); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, data); }
      const entries = [...files].map(([file, data]) => ({ path: file, bytes: data.length, sha256: hash(data) })).sort((a, b) => a.path.localeCompare(b.path));
      const bundleSha256 = hash(JSON.stringify(entries));
      const publication = { visualisationId: row.id, name: row.name, version: Number(row.version), isDefault: false, isPublished: true, bundleSha256, files: entries };
      await writeFile(path.join(destination, 'publication.json'), JSON.stringify(publication, null, 2));
      included.push({ id: row.id, name: row.name, version: Number(row.version), path: `${bundleRoot}/index.html`, isDefault: false });
    }
  } finally { await pool.end(); }
}

const revision = hash(JSON.stringify(included.map(item => [item.id, item.version, item.path])));
const catalog = { defaultId: originalId, revision, visualisations: included };
await writeFile(path.join(outdir, 'catalog.json'), JSON.stringify(catalog, null, 2));
await writeFile(path.join(outdir, 'launcher.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="color-scheme" content="dark"><title>Totem</title><link rel="stylesheet" href="launcher.css"></head><body><iframe id="totem" title="Totem" allow="autoplay; fullscreen"></iframe><section id="picker" hidden role="dialog" aria-modal="true" aria-labelledby="picker-title"><div class="picker-card"><h1 id="picker-title">Seleccionar visualización</h1><p>Toca una visualización para mostrarla en el tótem.</p><div id="items"></div><button id="close" type="button">Volver</button></div></section><script src="launcher.js"></script></body></html>`);
await writeFile(path.join(outdir, 'launcher.css'), `*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#06152e;font-family:Arial,sans-serif}#totem{position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff}#picker[hidden]{display:none}#picker{position:fixed;inset:0;z-index:10;background:#00122ce8;display:grid;place-items:center;padding:24px;color:#fff}.picker-card{width:min(100%,560px);max-height:90vh;overflow:auto;background:#10294b;padding:24px;border:1px solid #ffffff30;box-shadow:0 12px 40px #0008}.picker-card h1{margin:0 0 8px;font-size:24px}.picker-card p{margin:0 0 20px;color:#c9d8ea}.picker-card #items{display:grid;gap:8px}.picker-card #items button,#close{width:100%;min-height:54px;text-align:left;padding:14px 16px;border:1px solid #ffffff38;background:#173b68;color:#fff;font-size:17px;cursor:pointer}.picker-card #items button:focus,#close:focus{outline:3px solid #00bef4}.picker-card #items button span{display:block;font-size:12px;color:#9db6d5;margin-top:4px}.picker-card #close{margin-top:16px;text-align:center;background:transparent}`);
await writeFile(path.join(outdir, 'launcher.js'), `(()=>{const catalogUrl='catalog.json';const frame=document.getElementById('totem'),picker=document.getElementById('picker'),items=document.getElementById('items');let catalog,clicks=0,timer;const KEY='totem-active-publication';const entry=id=>catalog.visualisations.find(item=>item.id===id)||catalog.visualisations.find(item=>item.id===catalog.defaultId);function show(id){const selected=entry(id);if(!selected)return;localStorage.setItem(KEY,selected.id);frame.src=selected.path;picker.hidden=true;attachLogo();}function open(){items.replaceChildren(...catalog.visualisations.map(item=>{const b=document.createElement('button');b.type='button';b.textContent=item.name;const meta=document.createElement('span');meta.textContent=item.isDefault?'Visualización predeterminada':('Publicada · versión '+item.version);b.append(meta);b.addEventListener('click',()=>show(item.id));return b;}));picker.hidden=false;document.getElementById('close').focus();}function attachLogo(){try{const doc=frame.contentDocument,logo=doc?.querySelector('.hdr .logo');if(!logo||logo.dataset.totemTripleBound)return;logo.dataset.totemTripleBound='1';logo.addEventListener('click',event=>{clicks++;clearTimeout(timer);timer=setTimeout(()=>clicks=0,700);if(clicks>=3){clicks=0;event.preventDefault();open();}});}catch{}}document.getElementById('close').addEventListener('click',()=>{picker.hidden=true;frame.focus();});picker.addEventListener('click',event=>{if(event.target===picker)picker.hidden=true;});window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!picker.hidden)picker.hidden=true;});fetch(catalogUrl).then(response=>{if(!response.ok)throw Error('catalog');return response.json();}).then(data=>{catalog=data;const previousRevision=localStorage.getItem('totem-catalog-revision');if(previousRevision!==catalog.revision){localStorage.setItem(KEY,catalog.defaultId);localStorage.setItem('totem-catalog-revision',catalog.revision);}const saved=localStorage.getItem(KEY),start=entry(saved)||entry(catalog.defaultId);if(!catalog.visualisations.some(item=>item.id===saved))localStorage.setItem(KEY,start.id);frame.addEventListener('load',attachLogo);frame.src=start.path;}).catch(()=>{frame.src='index.html';});})();`);
console.log(`Bundled ${included.length} offline visualisation(s), catalog revision ${revision}.`);
