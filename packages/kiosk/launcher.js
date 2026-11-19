import {call} from './transport.js';

const byId = id => document.getElementById(id);
const dialog = byId('picker'), status = byId('status'), progress = byId('progress');
const original = await fetch('original.json').then(response => response.json());
const storageKey = 'totem-repository-v1';
let state;
if (window.TotemNative) state = (await call('loadState')).state;
if (!state) {
  try { state = JSON.parse(localStorage.getItem(storageKey)); } catch {}
}
if (!state?.installed || typeof state.installed !== 'object') state = {installed:{}, active:original.id};
let activeFrame, catalogue, generation = 0, busy = false;

async function persist(next) {
  if (window.TotemNative) await call('saveState',{state:next});
  else localStorage.setItem(storageKey, JSON.stringify(next));
  state = next;
}

// Runs inside the sandboxed publication. The parent accepts events only from its own frame.
function frameControls() {
  const taps = [];
  addEventListener('pointerdown', event => {
    if (!event.isTrusted || !event.isPrimary || event.button !== 0) return;
    const rect = document.querySelector('.hdr .logo')?.getBoundingClientRect();
    const scale = Math.min(innerWidth / 1080, innerHeight / 1920);
    const x = (event.clientX - (innerWidth - 1080 * scale) / 2) / scale;
    const y = (event.clientY - (innerHeight - 1920 * scale) / 2) / scale;
    const inLogo = rect && rect.width && event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inLogo && !(x >= 56 && x <= 268 && y >= 27 && y <= 83)) { taps.length = 0; return; }
    const now = performance.now();
    while (taps.length && now - taps[0] > 700) taps.shift();
    taps.push(now);
    if (taps.length === 3) { taps.length = 0; parent.postMessage('totem:menu','*'); }
  },true);
  let failed = false;
  addEventListener('error', event => {
    if (event.message || event.target?.tagName === 'SCRIPT' || event.target?.tagName === 'LINK') failed = true;
  },true);
  addEventListener('load', () => {
    parent.postMessage(!failed && document.body?.children.length ? 'totem:ready' : 'totem:failed','*');
  }, {once:true});
}

async function mount(entry) {
  const dir = entry.folder ? '/installed/' + entry.folder + '/' : './';
  const base = new URL(dir, location.href);
  const response = await fetch(new URL('index.html',base), {cache:'no-store'});
  if (!response.ok) throw Error('No se ha podido abrir la plantilla.');
  const html = await response.text();
  const frame = document.createElement('iframe');
  frame.title = entry.name;
  frame.sandbox = 'allow-scripts';
  frame.allow = 'autoplay; fullscreen';
  const code = '<base href="'+base.href+'"><script>('+frameControls.toString()+')()</script>';
  frame.srcdoc = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, head => head + code) : code + html;
  await new Promise((resolve,reject) => {
    const finish = error => {
      clearTimeout(timer);
      removeEventListener('message',listener);
      if (error) { frame.remove(); reject(Error('La plantilla no pudo iniciarse.')); } else resolve();
    };
    const listener = event => {
      if (event.source !== frame.contentWindow) return;
      if (event.data === 'totem:ready') finish(false);
      if (event.data === 'totem:failed') finish(true);
    };
    const timer = setTimeout(() => finish(true), 20000);
    addEventListener('message', listener);
    byId('screen').prepend(frame);
  });
  return frame;
}

function display(frame) {
  const previous = activeFrame;
  activeFrame = frame;
  frame.id = 'totem';
  previous?.remove();
}
function local(id) { return state.installed[id] || (id === original.id ? original : undefined); }
function matches(item, installed) {
  if (!installed) return false;
  if (!installed.folder && item.id === original.id) return original.bundleSha256 === item.bundleSha256;
  return item.version === installed.version && item.sha256 === installed.sha256;
}
function offlineEntries() {
  return [local(original.id), ...Object.values(state.installed).filter(item => item.id !== original.id &&
    (!state.visible || state.visible.includes(item.id)))];
}
function render() {
  byId('items').replaceChildren();
  for (const item of catalogue || offlineEntries()) {
    const installed = local(item.id);
    const tile = document.createElement('button'), image = document.createElement('img'), title = document.createElement('strong');
    tile.className = 'tile';
    tile.disabled = busy;
    tile.setAttribute('aria-current', String(state.active === item.id));
    const localCover = installed?.folder ? '/installed/'+installed.folder+'/__cover.webp' : 'original.webp';
    image.src = item.thumbnailUrl || localCover;
    if (installed && item.thumbnailUrl) image.onerror = () => {image.onerror = null; image.src = localCover;};
    image.alt = ''; title.textContent = item.name;
    tile.append(image,title);
    if (catalogue && installed && !matches(item,installed)) {
      const icon = document.createElement('span');
      icon.className = 'update'; icon.textContent = '↻'; icon.title = 'Actualización disponible';
      icon.setAttribute('role','img'); icon.setAttribute('aria-label',icon.title); tile.append(icon);
    }
    tile.onclick = () => select(item);
    byId('items').append(tile);
  }
}
async function refresh() {
  const token = ++generation;
  byId('saved').hidden = true;
  catalogue = null;
  status.textContent = 'Consultando las visualizaciones publicadas…';
  byId('retry').hidden = true;
  byId('items').replaceChildren();
  try {
    const {visualisations} = await call('catalog');
    if (generation !== token) return;
    catalogue = visualisations;
    await persist({...state, visible:visualisations.map(entry => entry.id)});
    status.textContent = catalogue.length ? '' : 'No hay visualizaciones publicadas.';
  } catch {
    if (generation !== token) return;
    status.textContent = 'Catálogo sin conexión. Puedes abrir las plantillas guardadas.';
    byId('retry').hidden = false;
  }
  render();
}
function openGallery() {
  if (dialog.open || busy) return;
  dialog.showModal();
  refresh();
}
async function select(item, useLocal = false) {
  if (busy) return;
  busy = true;
  byId('saved').hidden = true;
  byId('close').disabled = true; byId('retry').hidden = true; render();
  const old = local(item.id);
  let entry = old, staged, candidate, committed = false;
  try {
    if (!useLocal && catalogue && !matches(item,old)) {
      if (item.id === original.id && item.bundleSha256 === original.bundleSha256) entry = original;
      else {
        status.textContent = 'Descargando '+item.name+'…'; progress.value = 0; progress.hidden = false;
        staged = await call('stage',{id:item.id,sha256:item.sha256},value => progress.value = value);
        entry = {id:item.id,name:item.name,version:item.version,sha256:item.sha256,folder:staged.folder};
      }
    }
    status.textContent = 'Abriendo '+item.name+'…';
    candidate = await mount(entry);
    const installed = {...state.installed};
    if (entry.folder) installed[item.id] = entry; else delete installed[item.id];
    await persist({...state, active:item.id, installed});
    display(candidate); committed = true;
    dialog.close();
    if (old?.folder && old.folder !== entry.folder) await call('remove',{folder:old.folder}).catch(()=>{});
  } catch {
    if (!committed) candidate?.remove();
    if (staged && staged.folder !== old?.folder) await call('remove',{folder:staged.folder}).catch(()=>{});
    status.textContent = 'No se pudo abrir la publicación.';
    if (old && !useLocal) {
      byId('saved').hidden = false;
      byId('saved').onclick = () => select(old,true);
    }
    byId('retry').hidden = false;
  } finally {
    busy = false; byId('close').disabled = false; progress.hidden = true; if (dialog.open) render();
  }
}
addEventListener('message', event => {
  if (event.source === activeFrame?.contentWindow && event.data === 'totem:menu') openGallery();
});
dialog.oncancel = event => { if (busy) event.preventDefault(); };
dialog.onclose = () => {generation++;};
byId('close').onclick = () => dialog.close();
byId('retry').onclick = refresh;
try { display(await mount(local(state.active) || original)); }
catch {
  await persist({...state,active:original.id});
  try {display(await mount(original));} catch {openGallery();}
}
