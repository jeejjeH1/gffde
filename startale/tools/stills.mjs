// node tools/stills.mjs <outdir> t1 t2 ...   — renders individual frames as JPEGs
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import path from 'path';
import { serve } from './serve.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(process.argv[2]); const times = process.argv.slice(3).map(Number);
const srv = await serve(root);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(srv.url + 'index.html?t=0'); await p.waitForFunction(() => window.READY); await p.evaluate(() => window.READY);
for (const t of times) {
  const t0 = Date.now(); await p.evaluate(t => render(t), t);
  await p.screenshot({ path: `${out}/s_${t}.jpg`, type: 'jpeg', quality: 82 }); console.log(t, Date.now() - t0, 'ms');
}
await b.close(); srv.close();
