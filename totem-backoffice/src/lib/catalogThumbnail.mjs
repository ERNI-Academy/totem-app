import { chromium } from 'playwright-core';
import sharp from 'sharp';

const origin = 'https://publication.invalid';
const types = {html:'text/html', css:'text/css', js:'text/javascript', jpg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', mp4:'video/mp4', woff2:'font/woff2'};

export async function renderThumbnail(files) {
  let launchOptions = {executablePath: process.env.TOTEM_CHROMIUM || chromium.executablePath(), args:['--enable-unsafe-swiftshader']};
  if (process.env.VERCEL) {
    const {default: serverChromium} = await import('@sparticuz/chromium');
    launchOptions = {executablePath: await serverChromium.executablePath(), args:serverChromium.args};
  }
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({viewport:{width:1080,height:1920}, serviceWorkers:'block'});
    const context = page.context();
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      const name = decodeURIComponent(url.pathname.slice(1));
      const body = url.origin === origin && files.get(name);
      if (!body) return route.abort();
      const headers = {'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'"};
      await route.fulfill({body, headers, contentType:types[name.split('.').pop()] || 'application/octet-stream'});
    });
    await page.goto(origin + '/index.html', {waitUntil:'load', timeout:25000});
    await page.evaluate(async () => {
      await document.fonts.ready;

      await Promise.all([...document.images].filter(img => img.getBoundingClientRect().width > 0 && img.currentSrc).map(img => img.decode()));
      await Promise.all([...document.querySelectorAll('video')].filter(video => video.getBoundingClientRect().width > 0).map(async video => {
        if (video.readyState < 2 && video.poster) {
          const poster = new Image(); poster.src = video.poster; await poster.decode();
        } else if (video.readyState < 2 && (video.currentSrc || video.src)) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Video frame unavailable')), 8000);
            video.addEventListener('loadeddata', () => {clearTimeout(timeout); resolve();}, {once:true});
          });
        }
      }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    return await sharp(await page.screenshot({timeout:10000})).resize(270,480).webp({quality:85}).toBuffer();
  } finally { await browser.close(); }
}
