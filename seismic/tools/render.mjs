// Renders index.html frame-by-frame with Playwright, synthesizes the sound design,
// and muxes everything into a 1920x1080 H.264/AAC MP4.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { synth } from './audio.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'out'));
const FPS = 30, WORKERS = Number(process.env.WORKERS || 4);
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(outDir, '.tmp-'));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
async function openPage() {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('page error:', e.message));
  await p.goto('file://' + root + '/index.html?t=0');
  await p.evaluate(() => window.READY);
  return p;
}
const first = await openPage();
const { events, duration } = await first.evaluate(() => ({ events: window.EVENTS, duration: window.DURATION }));
const total = Math.round(duration * FPS);
console.log(`frames: ${total}, events: ${events.length}`);

// audio
fs.writeFileSync(path.join(tmp, 'audio.wav'), synth(events, duration));

// video segments in parallel
const per = Math.ceil(total / WORKERS);
let done = 0;
async function worker(k, page) {
  const a = k * per, b = Math.min(total, a + per);
  const seg = path.join(tmp, `seg${k}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise(r => ff.on('close', r));
  for (let f = a; f < b; f++) {
    await page.evaluate(t => render(t), f / FPS);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 150 === 0) console.log(`${done}/${total}`);
  }
  ff.stdin.end(); await closed;
  return seg;
}
const pages = [first, ...await Promise.all(Array.from({ length: WORKERS - 1 }, openPage))];
const segs = await Promise.all(pages.map((p, k) => worker(k, p)));
await browser.close();

fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
const out = path.join(outDir, 'seismic-infrastructure.mp4');
await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
  '-i', path.join(tmp, 'audio.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out],
  { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
fs.copyFileSync(path.join(tmp, 'audio.wav'), path.join(outDir, 'audio.wav'));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', out);
