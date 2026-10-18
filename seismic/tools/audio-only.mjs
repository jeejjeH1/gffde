// Re-synthesize just the soundtrack (out/audio.wav) without re-rendering frames.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { synth } from './audio.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'out', 'audio.wav'));
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + root + '/index.html?t=0'); await p.evaluate(() => window.READY);
const { events, duration } = await p.evaluate(() => ({ events: window.EVENTS, duration: window.DURATION }));
await b.close();
console.time('synth');
fs.writeFileSync(out, synth(events, duration));
console.timeEnd('synth');
console.log('wrote', out, events.length, 'events');
