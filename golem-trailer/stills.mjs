// Quick look at the trailer: simulates every frame (cheaply) and saves a still at chosen times.
//   node stills.mjs [outDir] [t1,t2,...]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.resolve(process.argv[2] || path.join(here, 'out/stills'));
const threeDir = process.env.THREE_DIR || fs.realpathSync(path.join(here, 'node_modules/three'));
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ body: fs.readFileSync(r.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.160.0', threeDir)), contentType: 'application/javascript' }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
await page.goto('file://' + path.resolve(here, '../golem-brawl/index.html') + '?film');
await page.waitForFunction(() => window.__film && window.__film.ready, null, { timeout: 120000 });
await page.evaluate((dir) => { window.TRAILER_FONTS = dir; }, 'file://' + path.join(here, 'fonts'));
await page.addScriptTag({ path: path.join(here, 'director.js') });
await page.evaluate(() => window.READY);
const { DURATION, FPS } = await page.evaluate(() => window.TRAILER);
const want = (process.argv[3] || '').split(',').filter(Boolean).map(Number);
const times = want.length ? want : [1.5, 3.8, 6.5, 8.2, 9.4, 10.6, 13, 14.7, 16.4, 17.9, 20.2, 21.0, 24.0, 25.0, 28.3, 31.5, 35.5, 39.5];
const frames = new Set(times.map((t) => Math.round(t * FPS)));
const last = Math.max(...frames);
for (let f = 0; f <= last; f++) {
  const draw = frames.has(f);
  await page.evaluate(([t, d]) => window.filmFrame(t, d), [f / FPS, draw]);
  if (draw) { await page.screenshot({ path: path.join(outDir, `t${(f / FPS).toFixed(1).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 85 }); console.log('still', (f / FPS).toFixed(2)); }
}
console.log('duration', DURATION);
await browser.close();
