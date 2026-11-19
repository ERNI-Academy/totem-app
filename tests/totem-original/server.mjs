import http from 'node:http';
import {createReadStream,existsSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {repository} from './repository.mjs';

const reference = path.resolve('../totem-web');
const source = path.resolve(process.env.TOTEM_REFERENCE || (existsSync(path.join(reference,'index.html')) ? reference : 'packages/totem-original/web'));
const apk = path.resolve('packages/totem-original/dist/android');
const installed = path.resolve(process.env.TOTEM_SIMULATOR_CACHE || 'packages/totem-original/dist/simulator-cache');
const api = repository(installed,process.env.TOTEM_BACKOFFICE_URL || 'http://127.0.0.1:3000');
const port = Number(process.env.TOTEM_SIMULATOR_PORT || 4317);
let origin;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.json':'application/json','.svg':'image/svg+xml'};

const simulator = http.createServer(async(req,res) => {
  try {
    const parts = decodeURIComponent(new URL(req.url,origin).pathname).split('/').filter(Boolean);
    const kind = parts.shift();
    if (kind === 'repository') {
      const action = parts.join('/');
      if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['x-totem-simulator'] !== '1' ||
          !Object.hasOwn(api,action)) {res.writeHead(403).end(); return;}
      let body = '';
      for await (const chunk of req) {body += chunk; if (body.length > 1024) throw Error('Petición inválida.');}
      res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store'});
      const send = event => res.write(JSON.stringify(event)+'\n');
      try {send({result:await api[action](JSON.parse(body),progress=>send({progress}))});}
      catch {send({error:'No se pudo completar la petición.'});}
      res.end(); return;
    }
    const base = {apk,reference:source,installed}[kind];
    if (!base || !['GET','HEAD'].includes(req.method)) throw Error();
    if (parts.some(part => part.startsWith('.') || part.includes('\\'))) throw Error();
    const file = path.resolve(base,parts.join('/') || 'index.html');
    if (!file.startsWith(base+path.sep)) throw Error();
    const info = await stat(file);
    if (!info.isFile()) throw Error();
    res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Accept-Ranges','bytes');
    let start = 0, end = info.size-1;
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      start=Number(range[1]); if (range[2]) end=Math.min(Number(range[2]),end);
      if (start>end) {res.writeHead(416).end();return;}
      res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
      res.statusCode=206;
    }
    res.setHeader('Content-Length',Math.max(0,end-start+1));
    if (req.method==='HEAD' || !info.size) {res.end();return;}
    const stream=createReadStream(file,{start,end});
    res.on('close',()=>stream.destroy()); stream.on('error',()=>res.destroy()); stream.pipe(res);
  } catch {if (!res.headersSent) res.writeHead(404);res.end();}
});
simulator.listen(port,'127.0.0.1',()=>{
  origin = 'http://127.0.0.1:'+simulator.address().port;
  console.log('Totem simulator: '+origin+'/apk/launcher.html');
});
