// Run against a booted Android emulator with the debug APK and two available publications.
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {strict as assert} from 'node:assert';
import {chromium} from 'playwright';

const serial = process.env.ANDROID_SERIAL;
if (!/^emulator-\d+$/.test(serial || '')) throw Error('Set ANDROID_SERIAL to the test emulator.');
const adb = (...args) => execFileSync('adb',['-s',serial,...args],{encoding:'utf8',timeout:15000}).trim();
const application = 'com.erni.totem';
let browser, port;
async function disconnect() {
  await browser?.close().catch(()=>{});
  if (port) adb('forward','--remove','tcp:'+port);
  browser = port = undefined;
}
async function launch() {
  adb('shell','am','start','-W','-n',application+'/.MainActivity');
  const socket = 'webview_devtools_remote_'+adb('shell','pidof',application);
  for (let i=0;i<50;i++) {
    if (adb('shell','cat','/proc/net/unix').includes('@'+socket)) break;
    await delay(200);
  }
  port = adb('forward','tcp:0','localabstract:'+socket);
  browser = await chromium.connectOverCDP('http://127.0.0.1:'+port,{noDefaults:true});
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.waitForEvent('page');
  await page.locator('#totem').waitFor();
  return page;
}

try {
  let page = await launch();
  const previous = await page.locator('#totem').getAttribute('title');
  const position = await page.evaluate(()=>{
    const scale=Math.min(innerWidth/1080,innerHeight/1920);
    return {x:(innerWidth-scale*1080)/2+scale*100,y:(innerHeight-scale*1920)/2+scale*50};
  });
  await page.mouse.click(position.x,position.y,{clickCount:3,delay:50});
  const target = page.locator('#items button[aria-current=false]').first();
  await target.waitFor(); const selected = await target.locator('strong').innerText();
  await target.click();
  await page.locator('#picker').waitFor({state:'hidden',timeout:300000});
  assert.notEqual(previous,selected);
  // Killing immediately after activation exposed WebView localStorage's deferred writes.
  adb('shell','am','force-stop',application);
  await disconnect();
  page = await launch();
  assert.equal(await page.locator('#totem').getAttribute('title'),selected);
  console.log('The confirmed selection survived an immediate process kill:',selected);
} finally {
  await disconnect();
}
