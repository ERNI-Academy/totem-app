import {createHash} from 'node:crypto';
import {openAsBlob,createWriteStream} from 'node:fs';
import {mkdir, mkdtemp, open, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Writable} from 'node:stream';
import {BlobReader, ZipReader} from '@zip.js/zip.js';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const digest = /^[0-9a-f]{64}$/;
const folderPattern = /^[0-9a-f-]{36}-[0-9a-f]{64}$/;
const limit = 1024 ** 3;
export function repository(cache, origin) {
  let latest = [];
  async function catalog() {
    const response = await fetch(new URL('/api/totem/catalog',origin), {cache:'no-store', signal:AbortSignal.timeout(8000), redirect:'error'});
    if (!response.ok) throw Error('Catálogo no disponible.');
    const {visualisations} = await response.json();
    for (const item of visualisations) {
      if (!uuid.test(item.id) || !digest.test(item.sha256) || !Number.isSafeInteger(item.size) ||
          item.size <= 0 || item.size > limit || !Number.isInteger(item.version)) throw Error('Publicación inválida.');
      for (const url of [item.downloadUrl,item.thumbnailUrl]) {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.origin !== new URL(origin).origin) throw Error('URL inválida.');
      }
    }
    latest = visualisations;
    return {visualisations};
  }
  async function stage({id,sha256}, progress) {
    const item = latest.find(entry => entry.id === id && entry.sha256 === sha256);
    if (!item) throw Error('Actualiza el catálogo.');
    const folder = id + '-' + sha256, destination = path.join(cache,folder);
    if (await stat(path.join(destination,'index.html')).then(s=>s.size>0,()=>false)) return {folder};
    await mkdir(cache,{recursive:true});
    const temp = await mkdtemp(path.join(cache,'.download-'));
    const content = path.join(temp,'content'), zip = path.join(temp,'archive.zip');
    try {
      await mkdir(content);
      const response = await fetch(item.downloadUrl,{signal:AbortSignal.timeout(300000),redirect:'error'});
      if (!response.ok) throw Error('Descarga no disponible.');
      const hash = createHash('sha256');
      let bytes = 0, lastProgress = -1;
      const handle = await open(zip,'wx');
      try {
        for await (const chunk of response.body) {
          bytes += chunk.length;
          if (bytes > item.size) throw Error('Tamaño incorrecto.');
          await handle.writeFile(chunk);
          hash.update(chunk);
          const percent = Math.floor(bytes / item.size * 100);
          if (percent !== lastProgress) {progress(percent); lastProgress = percent;}
        }
      } finally {await handle.close();}
      if (bytes !== item.size || hash.digest('hex') !== sha256) throw Error('ZIP incompleto o dañado.');
      const reader = new ZipReader(new BlobReader(await openAsBlob(zip)),{useWebWorkers:false});
      let total = 0;
      try {
        const entries = await reader.getEntries();
        if (entries.length > 65535) throw Error('Demasiados archivos.');
        for (const entry of entries) {
          const name = entry.rawFilename ? new TextDecoder('utf-8',{fatal:true}).decode(entry.rawFilename) : entry.filename;
          if (entry.directory || entry.encrypted || entry.compressionMethod !== 0 || name !== entry.filename ||
              name === '__cover.webp' || /[\\:\x00-\x1f]/.test(name) || name.split('/').some(p => !p || p === '.' || p === '..'))
            throw Error('Ruta de paquete inválida.');
          total += entry.uncompressedSize;
          if (total > item.size || entry.uncompressedSize !== entry.compressedSize) throw Error('Tamaño inválido.');
          const target = path.join(content,name);
          await mkdir(path.dirname(target),{recursive:true});
          await entry.getData(Writable.toWeb(createWriteStream(target,{flags:'wx'})),{checkSignature:true});
        }
      } finally {await reader.close();}
      if (!(await stat(path.join(content,'index.html'))).size) throw Error('Falta index.html.');
      const cover = await fetch(item.thumbnailUrl,{signal:AbortSignal.timeout(15000),redirect:'error'});
      if (!cover.ok) throw Error('Miniatura no disponible.');
      await writeFile(path.join(content,'__cover.webp'),new Uint8Array(await cover.arrayBuffer()));
      await rename(content,destination);
      return {folder};
    } finally {await rm(temp,{recursive:true,force:true});}
  }
  async function remove({folder}) {
    if (!folderPattern.test(folder)) throw Error('Directorio inválido.');
    await rm(path.join(cache,folder),{recursive:true,force:true});
    return {};
  }
  return {catalog,stage,remove};
}
