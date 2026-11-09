import {readFile,writeFile} from 'node:fs/promises';
import manifest from '../packages/totem-original/manifest.json' with {type:'json'};
const report=JSON.parse(await readFile('tests/totem-original/test-results/totem-results.json','utf8'));
const differences=[];
function visit(suite){for(const spec of suite.specs||[])for(const test of spec.tests||[])for(const a of test.annotations||[])if(a.type==='pixel-difference')differences.push(Number(a.description));for(const nested of suite.suites||[])visit(nested);}
for(const suite of report.suites)visit(suite);
const summary={sourceSha256:manifest.sourceSha256,webSha256:manifest.webSha256,packSha256:manifest.packSha256,passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,animationFramesCompared:differences.length,maximumDifferentPixelFraction:differences.length?Math.max(...differences):null,durationMs:report.stats.duration};
await writeFile('docs/TOTEM_ORIGINAL_TEST_RESULTS.json',JSON.stringify(summary,null,2)+'\n');console.log(summary);
