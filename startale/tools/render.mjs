// Renders index.html frame-by-frame with Playwright, synthesizes the soundtrack,
// and muxes everything into a 1920x1080 30fps H.264/AAC MP4 (X/Twitter-ready).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { synth } from './audio.mjs';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'out'));
const FPS = 30, WORKERS = Number(process.env.WORKERS || 4), NAME = 'startale-jpysc';
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(outDir, '.tmp-'));
const run = args => new Promise((res, rej) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));

const srv = await serve(root);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function openPage() {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('page error:', e.message));
  await p.goto(srv.url + 'index.html?t=0');
  await p.waitForFunction(() => window.READY); await p.evaluate(() => window.READY);
  return p;
}
const first = await openPage();
const { events, duration, sections } = await first.evaluate(() => ({ events: window.EVENTS, duration: window.DURATION, sections: window.SECTIONS }));
const total = Math.round(duration * FPS);
console.log(`frames: ${total}, events: ${events.length}`);
fs.writeFileSync(path.join(tmp, 'audio.wav'), synth(events, duration, sections));
if (process.env.AUDIO_ONLY) { fs.copyFileSync(path.join(tmp, 'audio.wav'), path.join(outDir, 'audio.wav')); process.exit(0); }

const per = Math.ceil(total / WORKERS);
let done = 0; const t0 = Date.now();
async function worker(k, page) {
  const a = k * per, b = Math.min(total, a + per);
  const seg = path.join(tmp, `seg${k}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise(r => ff.on('close', r));
  for (let f = a; f < b; f++) {
    await page.evaluate(t => render(t), f / FPS);
    const img = await page.screenshot({ type: 'jpeg', quality: 96 });
    if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 60 === 0) console.log(`${done}/${total}  ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await closed;
  return seg;
}
const pages = [first, ...(await Promise.all(Array.from({ length: WORKERS - 1 }, openPage)))];
const segs = await Promise.all(pages.map((p, k) => worker(k, p)));
await browser.close(); srv.close();

fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
const master = path.join(tmp, 'master.mp4');
await run(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', master]);
const out = path.join(outDir, `${NAME}.mp4`);
await run(['-y', '-loglevel', 'error', '-i', master, '-i', path.join(tmp, 'audio.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', out, `in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
