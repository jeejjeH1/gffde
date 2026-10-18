// Renders the Golem Brawl trailer: loads ../golem-brawl/index.html?film in headless Chromium,
// injects director.js, captures every frame, synthesizes the sound, and muxes a 1920x1080 MP4.
//
//   npm install            (fetches three@0.160.0 locally; the render runs offline)
//   node render.mjs [outDir] [--from=shotName] [--only=shotName]
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { synth } from './audio.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const outDir = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(here, 'out'));
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const WORKERS = Number(process.env.WORKERS || 2);
const threeDir = process.env.THREE_DIR || fs.realpathSync(path.join(here, 'node_modules/three'));
const gamePage = 'file://' + path.resolve(here, '../golem-brawl/index.html') + '?film';
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(outDir, '.tmp-'));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => r.fulfill({ body: fs.readFileSync(r.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.160.0', threeDir)), contentType: 'application/javascript' }));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(gamePage);
  await page.waitForFunction(() => window.__film && window.__film.ready, null, { timeout: 120000 });
  await page.evaluate((dir) => { window.TRAILER_FONTS = dir; }, 'file://' + path.join(here, 'fonts'));
  await page.addScriptTag({ path: path.join(here, 'director.js') });
  await page.evaluate(() => window.READY);
  return page;
}

const first = await openPage();
const { DURATION, FPS, shots } = await first.evaluate(() => window.TRAILER);
const work = shots.filter((s) => !only || s.name === only).map((s) => ({ ...s, frames: Math.round(s.dur * FPS), f0: Math.round(s.start * FPS) }));
const total = work.reduce((n, s) => n + s.frames, 0);
console.log(`trailer ${DURATION}s, ${total} frames, ${work.length} shots, ${WORKERS} workers`);

// Give each worker whole shots, balanced by frame count (shots are independent).
const lanes = Array.from({ length: WORKERS }, () => ({ shots: [], frames: 0 }));
for (const s of [...work].sort((a, b) => b.frames - a.frames)) { const l = lanes.reduce((m, x) => (x.frames < m.frames ? x : m)); l.shots.push(s); l.frames += s.frames; }

let done = 0; const t0 = Date.now();
async function renderShot(page, s) {
  const file = path.join(tmp, `${String(s.f0).padStart(5, '0')}-${s.name}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((r) => ff.on('close', r));
  for (let f = 0; f < s.frames; f++) {
    await page.evaluate((t) => window.filmFrame(t), (s.f0 + f) / FPS);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (++done % 60 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${total} frames, ${(el / done).toFixed(2)}s/frame, ~${Math.round((el / done) * (total - done) / 60)} min left`); }
  }
  ff.stdin.end(); await closed;
  return file;
}
const pages = [first, ...(await Promise.all(Array.from({ length: WORKERS - 1 }, openPage)))];
const results = await Promise.all(lanes.map(async (lane, k) => { const files = []; for (const s of lane.shots) files.push(await renderShot(pages[k], s)); return files; }));
const sfx = (await Promise.all(pages.map((p) => p.evaluate(() => window.TRAILER.SFX)))).flat().sort((a, b) => a.t - b.t);
await browser.close();

const segs = results.flat().sort();
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map((s) => `file '${s}'`).join('\n'));
fs.writeFileSync(path.join(tmp, 'audio.wav'), synth({ duration: DURATION, shots, sfx }));
fs.writeFileSync(path.join(outDir, 'sfx.json'), JSON.stringify(sfx));
const out = path.join(outDir, only ? `golem-brawl-trailer-${only}.mp4` : 'golem-brawl-trailer.mp4');
const audioArgs = only ? ['-an'] : ['-i', path.join(tmp, 'audio.wav'), '-c:a', 'aac', '-b:a', '192k', '-shortest'];
await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), ...audioArgs, '-c:v', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', out, `in ${Math.round((Date.now() - t0) / 60000)} min`);
