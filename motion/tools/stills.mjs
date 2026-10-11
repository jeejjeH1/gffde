import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import path from 'path';
const dir = path.resolve(process.argv[2]); const out = process.argv[3];
const times = process.argv.slice(4).map(Number);
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file://' + dir + '/index.html?t=0'); await p.evaluate(() => window.READY);
for (const t of times) { await p.evaluate(t => render(t), t); await p.screenshot({ path: `${out}/s_${t}.jpg`, type: 'jpeg', quality: 80 }); }
await b.close();
