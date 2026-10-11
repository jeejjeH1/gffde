// GenLayer — Appeals motion graphic. Pure function of time: render(t).
const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const C = {
  p1: '#ff87ff', p2: '#dc00ff', g: '#b4ffd2', bg: '#07040c',
  white: '#f6effa', dim: 'rgba(246,239,250,0.55)',
};
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const buf = document.createElement('canvas'); buf.width = W; buf.height = H;
const bctx = buf.getContext('2d');

// ---------- utils ----------
const EVENTS = [];
const ev = (t, type, extra = {}) => EVENTS.push({ t, type, ...extra });
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eOut = t => 1 - Math.pow(1 - clamp(t), 3);
const eInOut = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eExpo = t => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
const eBack = t => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const hash = n => rng(Math.floor(n * 7919) + 12345)();
function grad(x0, y0, x1, y1, stops = [C.p1, C.p2]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  return g;
}
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function ring(x, y, r, lw, color, a) {
  if (a <= 0 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function mono(text, x, y, size, color, align = 'left', a = 1, track = 3) {
  ctx.save(); ctx.globalAlpha *= a; ctx.font = `600 ${size}px "DejaVu Sans Mono", monospace`;
  ctx.letterSpacing = track + 'px';
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y); ctx.restore();
}
function text(str, x, y, font, fill, align = 'center', a = 1, glow = 0, glowColor = C.p2, track = 0) {
  ctx.save(); ctx.globalAlpha *= a; ctx.font = font; ctx.fillStyle = fill;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = track + 'px';
  if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = glowColor; }
  ctx.fillText(str, x, y); ctx.restore();
}

// ---------- typewriter text ----------
// [word] = pink/purple gradient highlight, {word} = green highlight
class TT {
  constructor(o) {
    Object.assign(this, {
      cps: 34, size: 56, weight: 700, lineH: 1.28, maxW: 1500, align: 'center',
      color: C.white, sound: true, cursor: true, cursorHold: 0.9, scramble: true, track: 0,
    }, o);
    this.tokens = [];
    let style = 'n';
    for (const ch of this.text) {
      if (ch === '[') { style = 'h'; continue; }
      if (ch === '{') { style = 'g'; continue; }
      if (ch === ']' || ch === '}') { style = 'n'; continue; }
      this.tokens.push({ ch, style });
    }
    this.n = this.tokens.length;
    this.end = this.at + this.n / this.cps;
    if (this.sound) {
      this.tokens.forEach((tk, i) => {
        if (tk.ch !== ' ') ev(this.at + i / this.cps, 'click', { seed: Math.floor(hash(this.at + i * 0.37) * 1e6), hl: tk.style !== 'n' });
      });
    }
    this.laid = false;
  }
  font() { return `${this.weight} ${this.size}px Inter`; }
  layout() {
    ctx.save(); ctx.font = this.font(); ctx.letterSpacing = this.track + 'px';
    const words = []; let cur = null;
    this.tokens.forEach((tk, i) => {
      if (tk.ch === ' ') { if (cur) { words.push(cur); cur = null; } return; }
      if (!cur) cur = { chars: [] };
      cur.chars.push({ ...tk, i });
    });
    if (cur) words.push(cur);
    const sp = ctx.measureText(' ').width;
    for (const w of words) {
      let acc = '';
      for (const c of w.chars) { c.x = ctx.measureText(acc).width; acc += c.ch; c.w = ctx.measureText(acc).width - c.x; }
      w.w = ctx.measureText(acc).width;
    }
    const lines = []; let line = { words: [], w: 0 };
    for (const w of words) {
      const gap = line.words.length ? sp : 0;
      if (line.words.length && line.w + gap + w.w > this.maxW) { lines.push(line); line = { words: [], w: 0 }; }
      w.x = line.w + (line.words.length ? sp : 0);
      line.w = w.x + w.w; line.words.push(w);
    }
    lines.push(line);
    this.lines = lines; this.laid = true;
    this.lh = this.size * this.lineH;
    this.height = lines.length * this.lh;
    ctx.restore();
  }
  draw(t, x, y, alpha = 1) {
    if (t < this.at - 0.0001) return;
    if (!this.laid) this.layout();
    const rev = Math.min(this.n, Math.floor((t - this.at) * this.cps) + 1);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.font = this.font(); ctx.textBaseline = 'middle';
    ctx.letterSpacing = this.track + 'px';
    const y0 = y - (this.lines.length - 1) * this.lh / 2;
    let cur = null;
    const R = rng(Math.floor(t * 30) + 7);
    this.lines.forEach((ln, li) => {
      const lx = this.align === 'center' ? x - ln.w / 2 : this.align === 'right' ? x - ln.w : x;
      const ly = y0 + li * this.lh;
      if (!cur) cur = { x: lx, y: ly };
      for (const w of ln.words) {
        const wx = lx + w.x;
        for (const c of w.chars) {
          if (c.i >= rev) continue;
          const age = t - (this.at + c.i / this.cps);
          const k = eOut(age / 0.18);
          let fill = this.color, glow = 0, gcol = C.p2;
          if (c.style === 'h') { fill = grad(wx, ly - this.size / 2, wx + w.w, ly + this.size / 2); glow = 26; gcol = C.p2; }
          if (c.style === 'g') { fill = C.g; glow = 22; gcol = 'rgba(120,255,180,0.8)'; }
          ctx.fillStyle = fill;
          ctx.shadowBlur = glow; ctx.shadowColor = gcol;
          let ch = c.ch;
          if (this.scramble && age < 0.06) { ch = '#%&@/<>01*+'[Math.floor(R() * 11)]; ctx.fillStyle = C.g; }
          ctx.globalAlpha = alpha * (0.35 + 0.65 * k);
          ctx.fillText(ch, wx + c.x, ly + (1 - k) * this.size * 0.18);
          if (c.i === rev - 1) cur = { x: wx + c.x + c.w, y: ly };
        }
      }
    });
    ctx.shadowBlur = 0;
    // cursor
    if (this.cursor) {
      const typing = t < this.end;
      const vis = typing || (t < this.end + this.cursorHold && Math.floor(t * 4) % 2 === 0);
      if (vis && cur) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = C.g; ctx.shadowBlur = 16; ctx.shadowColor = C.g;
        ctx.fillRect(cur.x + this.size * 0.08, cur.y - this.size * 0.42, Math.max(3, this.size * 0.07), this.size * 0.84);
      }
    }
    ctx.restore();
  }
}

// ---------- logo ----------
const logo = new Image();
let logoTint = {}, logoPts = [];
const LOGO_AR = 402 / 379;
function tintLogo(fillFn) {
  const c = document.createElement('canvas'); c.width = logo.width; c.height = logo.height;
  const x = c.getContext('2d'); x.drawImage(logo, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = fillFn(x, c); x.fillRect(0, 0, c.width, c.height);
  return c;
}
function prepLogo() {
  logoTint.grad = tintLogo((x, c) => { const g = x.createLinearGradient(0, 0, c.width * 0.4, c.height); g.addColorStop(0, C.p1); g.addColorStop(1, C.p2); return g; });
  logoTint.white = tintLogo(() => C.white);
  logoTint.green = tintLogo(() => C.g);
  const c = document.createElement('canvas'); c.width = logo.width; c.height = logo.height;
  const x = c.getContext('2d'); x.drawImage(logo, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const R = rng(42), pts = [];
  for (let yy = 0; yy < c.height; yy += 5) for (let xx = 0; xx < c.width; xx += 5) {
    if (d[(yy * c.width + xx) * 4 + 3] > 140) pts.push({ x: xx / c.height - LOGO_AR / 2, y: yy / c.height - 0.5 });
  }
  pts.forEach(p => {
    const a = R() * Math.PI * 2, r = 700 + R() * 900;
    p.sx = Math.cos(a) * r; p.sy = Math.sin(a) * r; p.d = R() * 0.55; p.col = [C.p1, C.p2, C.g, C.white][Math.floor(R() * 4)]; p.s = 1.5 + R() * 2.5;
  });
  logoPts = pts;
}
function drawLogo(img, x, y, h, a = 1, glow = 0, glowColor = C.p2) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  if (glow) { ctx.shadowBlur = glow; ctx.shadowColor = glowColor; }
  ctx.drawImage(img, x - h * LOGO_AR / 2, y - h / 2, h * LOGO_AR, h);
  ctx.restore();
}

// ---------- background ----------
const BG_PARTS = (() => { const R = rng(7); return Array.from({ length: 140 }, () => ({ x: R() * W, y: R() * H, s: 0.6 + R() * 2.2, v: 8 + R() * 30, ph: R() * 6.28, c: R() < 0.2 ? C.g : R() < 0.6 ? C.p1 : C.white })); })();
const GRAIN = (() => {
  return [0, 1, 2, 3].map(k => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); const im = x.createImageData(256, 256); const R = rng(99 + k);
    for (let i = 0; i < im.data.length; i += 4) { const v = R() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0); return ctx.createPattern(c, 'repeat');
  });
})();
const SCAN = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, 0, 4, 1); return ctx.createPattern(c, 'repeat'); })();

function drawBG(t, energy) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // glow blobs
  const blobs = [
    [CX + Math.sin(t * 0.21) * 520, CY + Math.cos(t * 0.17) * 260, 820, 'rgba(220,0,255,0.20)'],
    [CX + Math.cos(t * 0.15 + 1) * 640, CY + Math.sin(t * 0.23) * 300, 700, 'rgba(255,135,255,0.12)'],
    [CX + Math.sin(t * 0.11 + 3) * 700, CY + 300 + Math.cos(t * 0.19) * 120, 600, 'rgba(180,255,210,0.06)'],
  ];
  for (const [x, y, r, c] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * (1 + energy * 0.15));
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // perspective grid floor
  ctx.save();
  const hz = 700;
  const vg = ctx.createLinearGradient(0, hz, 0, H);
  vg.addColorStop(0, 'rgba(220,0,255,0)'); vg.addColorStop(1, 'rgba(220,0,255,0.10)');
  ctx.strokeStyle = vg; ctx.lineWidth = 1;
  for (let i = -16; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(CX + i * 40, hz); ctx.lineTo(CX + i * 260, H); ctx.stroke(); }
  ctx.strokeStyle = C.p2;
  for (let k = 0; k < 12; k++) {
    const z = ((k + (t * 0.6) % 1) / 12);
    const y = hz + Math.pow(z, 2.2) * (H - hz);
    ctx.globalAlpha = 0.09 * z * z;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();
  // dot matrix
  ctx.save(); ctx.fillStyle = 'rgba(255,135,255,0.08)';
  for (let y = 60; y < 680; y += 48) for (let x = 48 + ((y / 48) % 2) * 24; x < W; x += 48) ctx.fillRect(x, y, 2, 2);
  ctx.restore();
  // particles
  ctx.save();
  for (const p of BG_PARTS) {
    const y = ((p.y - t * p.v) % H + H) % H;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + p.ph));
    ctx.globalAlpha = 0.5 * tw; ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x + Math.sin(t * 0.5 + p.ph) * 12, y, p.s, 0, 6.28); ctx.fill();
  }
  ctx.restore();
}

function post(t, glitch, flash, flashColor) {
  // flash
  if (flash > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash;
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1100);
    g.addColorStop(0, flashColor); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // glitch slices + rgb ghost
  if (glitch > 0.01) {
    bctx.clearRect(0, 0, W, H); bctx.drawImage(cv, 0, 0);
    const R = rng(Math.floor(t * 30) * 13 + 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * glitch;
    ctx.drawImage(buf, 14 * glitch, 0); ctx.drawImage(buf, -14 * glitch, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const n = Math.floor(4 + 10 * glitch);
    for (let i = 0; i < n; i++) {
      const y = R() * H, h = 6 + R() * 70, dx = (R() - 0.5) * 140 * glitch;
      ctx.drawImage(buf, 0, y, W, h, dx, y, W, h);
      if (R() < 0.3) { ctx.globalAlpha = 0.5 * glitch; ctx.fillStyle = R() < 0.5 ? C.p2 : C.g; ctx.fillRect(R() * W, y, 80 + R() * 400, 3); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  }
  // vignette
  const v = ctx.createRadialGradient(CX, CY, 380, CX, CY, 1150);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // scanlines + grain
  ctx.save(); ctx.fillStyle = SCAN; ctx.globalAlpha = 0.35; ctx.fillRect(0, 0, W, H);
  const f = Math.floor(t * 30);
  ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
  ctx.translate((f * 37) % 256, (f * 91) % 256); ctx.fillStyle = GRAIN[f % 4]; ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
}

// ---------- HUD ----------
function drawHUD(t, idx, total, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const m = 44, L = 34;
  ctx.strokeStyle = 'rgba(255,135,255,0.55)'; ctx.lineWidth = 2;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke();
  });
  drawLogo(logoTint.grad, 96, 92, 34, 1, 12);
  mono('GENLAYER', 126, 92, 18, C.white, 'left', 0.9, 5);
  mono('// APPEALS', 262, 92, 18, C.g, 'left', 0.8, 3);
  mono(String(idx).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'), W - 92, 92, 18, C.white, 'right', 0.8, 4);
  const blink = Math.floor(t * 2) % 2 === 0;
  ctx.fillStyle = blink ? C.p1 : 'rgba(255,135,255,0.3)'; ctx.beginPath(); ctx.arc(W - 300, 92, 6, 0, 6.28); ctx.fill();
  mono('LIVE', W - 286, 92, 16, C.p1, 'left', 0.9, 3);
  // progress
  const p = clamp(t / DURATION);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(96, H - 74, W - 192, 3);
  ctx.fillStyle = grad(96, 0, W - 96, 0, [C.g, C.p1, C.p2]); ctx.fillRect(96, H - 74, (W - 192) * p, 3);
  ctx.fillStyle = C.g; ctx.shadowBlur = 12; ctx.shadowColor = C.g; ctx.fillRect(96 + (W - 192) * p - 3, H - 79, 6, 13);
  ctx.shadowBlur = 0;
  mono('OPTIMISTIC DEMOCRACY', 96, H - 54, 14, C.dim, 'left', 0.9, 4);
  mono('T+' + t.toFixed(2).padStart(5, '0') + 's', W - 96, H - 54, 14, C.dim, 'right', 0.9, 3);
  ctx.restore();
}

// ---------- icons ----------
function iconStroke(col, lw = 4) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
function check(x, y, s, p, col = C.g) {
  if (p <= 0) return;
  ctx.save(); iconStroke(col, s * 0.18); ctx.shadowBlur = 14; ctx.shadowColor = col;
  const pts = [[-0.5, 0], [-0.12, 0.38], [0.55, -0.4]];
  const seg1 = clamp(p * 2), seg2 = clamp(p * 2 - 1);
  ctx.beginPath(); ctx.moveTo(x + pts[0][0] * s, y + pts[0][1] * s);
  ctx.lineTo(x + lerp(pts[0][0], pts[1][0], seg1) * s, y + lerp(pts[0][1], pts[1][1], seg1) * s);
  if (seg2 > 0) ctx.lineTo(x + lerp(pts[1][0], pts[2][0], seg2) * s, y + lerp(pts[1][1], pts[2][1], seg2) * s);
  ctx.stroke(); ctx.restore();
}
function iconMag(x, y, s, col) { ctx.save(); iconStroke(col); ring(x - s * .1, y - s * .1, s * .32, 4, col, 1); ctx.beginPath(); ctx.moveTo(x + s * .14, y + s * .14); ctx.lineTo(x + s * .42, y + s * .42); ctx.stroke(); ctx.restore(); }
function iconFlag(x, y, s, col) { ctx.save(); iconStroke(col); ctx.beginPath(); ctx.moveTo(x - s * .3, y + s * .45); ctx.lineTo(x - s * .3, y - s * .45); ctx.lineTo(x + s * .35, y - s * .3); ctx.lineTo(x - s * .3, y - s * .05); ctx.stroke(); ctx.restore(); }
function iconNodes(x, y, s, col) {
  ctx.save(); iconStroke(col, 3);
  const pts = [[0, -.38], [-.38, .28], [.38, .28]];
  ctx.beginPath(); pts.forEach((p, i) => { const q = pts[(i + 1) % 3]; ctx.moveTo(x + p[0] * s, y + p[1] * s); ctx.lineTo(x + q[0] * s, y + q[1] * s); }); ctx.stroke();
  pts.forEach(p => { ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(x + p[0] * s, y + p[1] * s, s * .13, 0, 6.28); ctx.fill(); ctx.stroke(); });
  ctx.restore();
}
function iconShield(x, y, s, col) {
  ctx.save(); iconStroke(col);
  ctx.beginPath(); ctx.moveTo(x, y - s * .45); ctx.lineTo(x + s * .38, y - s * .3); ctx.lineTo(x + s * .34, y + s * .1);
  ctx.quadraticCurveTo(x + s * .25, y + s * .35, x, y + s * .48); ctx.quadraticCurveTo(x - s * .25, y + s * .35, x - s * .34, y + s * .1);
  ctx.lineTo(x - s * .38, y - s * .3); ctx.closePath(); ctx.stroke(); ctx.restore();
  check(x, y, s * .42, 1, col);
}
function iconX(x, y, s, col) { ctx.save(); iconStroke(col, 4); ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); ctx.restore(); }

// ---------- scenes ----------
const SCENES = [];
function S(a, b, draw, opts = {}) { SCENES.push({ a, b, draw, ...opts }); return SCENES[SCENES.length - 1]; }

// 0 — INTRO
let t0 = 0;
const introName = new TT({ text: 'GenLayer', at: 2.0, cps: 14, size: 92, weight: 800, cursor: false, scramble: true });
const introTag = new TT({ text: 'THE RIGHT TO CHALLENGE', at: 2.75, cps: 30, size: 26, weight: 600, cursor: false, track: 10 });
ev(1.25, 'boom'); ev(0.05, 'riser');
S(0, 4.6, (lt) => {
  const form = 1.25;
  const lift = eInOut(prog(lt, 1.7, 2.4));
  const ly = CY - 10 - lift * 110, lh = lerp(360, 300, lift);
  // particles forming the logo
  if (lt < form + 0.6) {
    ctx.save();
    const fadeP = 1 - prog(lt, form, form + 0.6);
    for (const p of logoPts) {
      const k = eExpo(prog(lt, 0.05 + p.d, form));
      const x = CX + lerp(p.sx, p.x * lh, k), y = ly + lerp(p.sy, p.y * lh, k);
      ctx.globalAlpha = fadeP * (0.3 + 0.7 * k); ctx.fillStyle = p.col;
      ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
    ctx.restore();
  }
  // solid logo
  const la = prog(lt, form - 0.05, form + 0.25);
  const pulse = 1 + 0.06 * Math.exp(-(lt - form) * 6) * (lt > form ? 1 : 0);
  drawLogo(logoTint.grad, CX, ly, lh * pulse, la, 50 + 30 * Math.exp(-Math.max(0, lt - form) * 3));
  // shockwaves
  for (let i = 0; i < 3; i++) {
    const q = prog(lt, form + i * 0.12, form + 1.3 + i * 0.12);
    if (q > 0 && q < 1) ring(CX, ly, 120 + eOut(q) * (700 + i * 200), 3 - i * 0.6, i === 1 ? C.g : C.p1, 1 - q);
  }
  // orbit ring
  const oa = prog(lt, form + 0.2, form + 0.8);
  if (oa > 0) {
    ctx.save(); ctx.translate(CX, ly); ctx.rotate(lt * 0.6);
    ctx.globalAlpha = oa * 0.7; ctx.strokeStyle = C.p1; ctx.lineWidth = 2; ctx.setLineDash([4, 14]);
    ctx.beginPath(); ctx.arc(0, 0, lh * 0.72, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = C.g; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, lh * 0.72, 0, 0.6); ctx.stroke();
    ctx.strokeStyle = C.p2; ctx.beginPath(); ctx.arc(0, 0, lh * 0.72, Math.PI, Math.PI + 0.9); ctx.stroke();
    ctx.restore();
  }
  introName.draw(lt, CX, CY + 230, 1);
  introTag.draw(lt, CX, CY + 312, 0.85);
  // lines flanking the tag
  const lp = eOut(prog(lt, 2.8, 3.4));
  ctx.fillStyle = C.p2; ctx.globalAlpha = 0.8;
  ctx.fillRect(CX - 260 - 160 * lp, CY + 311, 160 * lp, 2); ctx.fillRect(CX + 260, CY + 311, 160 * lp, 2);
  ctx.globalAlpha = 1;
}, { hud: false, flashAt: 1.25 });

// 1 — QUESTION
const q1 = new TT({ text: 'Why is the ability to [challenge a decision] important in {GenLayer}?', at: 4.6 + 0.9, size: 76, weight: 800, maxW: 1400 });
S(4.6, 11.2, (lt, t) => {
  mono('// THE QUESTION', CX, 330, 22, C.g, 'center', eOut(prog(lt, 0.2, 0.6)), 8);
  const w = 120 * eOut(prog(lt, 0.3, 0.9));
  ctx.fillStyle = grad(CX - w, 0, CX + w, 0); ctx.fillRect(CX - w, 362, w * 2, 3);
  q1.draw(t, CX, 520);
  // big faint question mark
  const qa = eOut(prog(lt, 3.0, 4.0));
  text('?', CX + 640, 560 + Math.sin(lt * 2) * 10, '900 460px Inter', 'rgba(220,0,255,0.10)', 'center', qa);
});

// 2 — TRADITIONAL BLOCKCHAINS
const tA = 11.2;
const q2 = new TT({ text: 'In traditional blockchains, [consensus] helps validate transactions and state changes.', at: tA + 0.6, size: 56, maxW: 1400 });
for (let i = 0; i < 5; i++) ev(tA + 3.0 + i * 0.42, 'blip', { f: 900 + i * 90 });
S(tA, 18.4, (lt, t) => {
  mono('01 · TRADITIONAL BLOCKCHAINS', CX, 230, 20, C.p1, 'center', eOut(prog(lt, 0.1, 0.5)), 6);
  q2.draw(t, CX, 340);
  const by = 680, bw = 190, bh = 130, gap = 270;
  const x0 = CX - gap * 2;
  const labels = ['TX', 'TX', 'STATE', 'TX', 'STATE'];
  // chain links
  for (let i = 0; i < 4; i++) {
    const p = eOut(prog(lt, 1.5 + i * 0.25 + 0.2, 1.9 + i * 0.25 + 0.2));
    const xa = x0 + i * gap + bw / 2, xb = xa + (gap - bw) * p;
    ctx.strokeStyle = 'rgba(255,135,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xa, by); ctx.lineTo(xb, by); ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const p = eBack(prog(lt, 1.4 + i * 0.25, 1.9 + i * 0.25));
    if (p <= 0) continue;
    const x = x0 + i * gap, y = by + (1 - p) * 60;
    ctx.save(); ctx.globalAlpha = clamp(p);
    rrect(x - bw / 2, y - bh / 2, bw, bh, 18);
    ctx.fillStyle = 'rgba(20,8,32,0.9)'; ctx.fill();
    ctx.strokeStyle = grad(x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2); ctx.lineWidth = 2.5; ctx.stroke();
    mono('#' + (18420 + i), x - bw / 2 + 18, y - bh / 2 + 24, 15, C.dim, 'left', 1, 2);
    mono(labels[i], x - bw / 2 + 18, y + 28, 22, C.white, 'left', 1, 4);
    const cp = prog(lt, 3.0 + i * 0.42, 3.3 + i * 0.42);
    if (cp > 0) { ring(x + bw / 2 - 34, y + 20, 22, 2, C.g, 0.5 * cp); check(x + bw / 2 - 34, y + 20, 26, cp); }
    ctx.restore();
  }
  // scan light
  const sp = prog(lt, 3.0, 5.2);
  if (sp > 0 && sp < 1) {
    const sx = lerp(x0 - bw, x0 + gap * 4 + bw, sp);
    const g = ctx.createLinearGradient(sx - 120, 0, sx + 120, 0);
    g.addColorStop(0, 'rgba(180,255,210,0)'); g.addColorStop(0.5, 'rgba(180,255,210,0.25)'); g.addColorStop(1, 'rgba(180,255,210,0)');
    ctx.fillStyle = g; ctx.fillRect(sx - 120, by - 100, 240, 200);
  }
  mono('CONSENSUS: VALIDATED', CX, 830, 20, C.g, 'center', eOut(prog(lt, 5.0, 5.5)), 6);
});

// 3 — AI DECISION
const tB = 18.4;
const q3 = new TT({ text: 'But what happens when an [AI-powered smart contract] reaches a decision that may be {incorrect}?', at: tB + 0.6, size: 54, maxW: 1450 });
ev(tB + 4.4, 'alert');
S(tB, 25.8, (lt, t) => {
  mono('02 · THE PROBLEM', CX, 220, 20, C.p1, 'center', eOut(prog(lt, 0.1, 0.5)), 6);
  q3.draw(t, CX, 330);
  const ay = 690, ax = CX - 360;
  const ap = eBack(prog(lt, 1.0, 1.6));
  if (ap > 0) {
    ctx.save(); ctx.translate(ax, ay); ctx.scale(ap, ap);
    // hexagon core
    for (let k = 0; k < 2; k++) {
      ctx.save(); ctx.rotate(lt * (k ? -0.5 : 0.4));
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; const r = k ? 130 : 96; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.strokeStyle = k ? 'rgba(255,135,255,0.4)' : grad(-96, -96, 96, 96); ctx.lineWidth = k ? 2 : 4;
      if (k) ctx.setLineDash([6, 10]);
      ctx.shadowBlur = k ? 0 : 30; ctx.shadowColor = C.p2; ctx.stroke(); ctx.restore();
    }
    text('AI', 0, 4, '900 64px Inter', grad(-40, -30, 40, 30), 'center', 1, 20);
    for (let i = 0; i < 6; i++) {
      const a = lt * 1.6 + i * 1.047;
      ctx.fillStyle = i % 2 ? C.g : C.p1; ctx.beginPath(); ctx.arc(Math.cos(a) * 170, Math.sin(a) * 170 * 0.45, 5, 0, 6.28); ctx.fill();
    }
    ctx.restore();
    mono('SMART CONTRACT · LLM', ax, ay + 200, 16, C.dim, 'center', ap, 4);
  }
  // data stream arrow
  const sp = prog(lt, 1.8, 2.4);
  if (sp > 0) {
    const xa = ax + 170, xb = lerp(xa, CX + 160, eOut(sp));
    ctx.save(); ctx.strokeStyle = C.p1; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -lt * 60;
    ctx.beginPath(); ctx.moveTo(xa, ay); ctx.lineTo(xb, ay); ctx.stroke(); ctx.restore();
  }
  // decision card
  const cp = eBack(prog(lt, 2.4, 2.9));
  if (cp > 0) {
    const cx = CX + 360, cw = 400, ch = 220;
    const warn = prog(lt, 4.4, 4.6);
    const jitter = warn > 0 && lt < 5.0 ? (hash(Math.floor(t * 30)) - 0.5) * 24 : 0;
    ctx.save(); ctx.globalAlpha = clamp(cp); ctx.translate(cx + jitter, ay); ctx.scale(cp, cp);
    rrect(-cw / 2, -ch / 2, cw, ch, 22); ctx.fillStyle = 'rgba(20,8,32,0.92)'; ctx.fill();
    ctx.strokeStyle = warn > 0 ? C.p1 : 'rgba(255,135,255,0.5)'; ctx.lineWidth = 3; ctx.shadowBlur = warn * 30; ctx.shadowColor = C.p2; ctx.stroke(); ctx.shadowBlur = 0;
    mono('DECISION', -cw / 2 + 28, -ch / 2 + 34, 16, C.dim, 'left', 1, 5);
    const flick = warn > 0 && Math.floor(t * 15) % 3 === 0;
    text(flick ? 'ACC#PT' : 'ACCEPT', -cw / 2 + 28, 6, '800 58px Inter', C.white, 'left', 1);
    if (warn > 0) {
      const wb = eBack(prog(lt, 4.4, 4.8));
      ctx.save(); ctx.translate(cw / 2 - 20, -ch / 2 + 10); ctx.scale(wb, wb);
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, 6.28); ctx.fillStyle = grad(-40, -40, 40, 40); ctx.shadowBlur = 30; ctx.shadowColor = C.p2; ctx.fill();
      text('?', 0, 3, '900 52px Inter', '#fff', 'center');
      ctx.restore();
      mono('MAY BE INCORRECT', -cw / 2 + 28, ch / 2 - 34, 16, C.p1, 'left', warn, 4);
    }
    ctx.restore();
    if (warn > 0) for (let i = 0; i < 2; i++) { const q = prog(lt, 4.4 + i * 0.2, 5.6 + i * 0.2); if (q > 0 && q < 1) ring(cx + cw / 2 - 20, ay - ch / 2 + 10, 40 + q * 220, 2, C.p1, 1 - q); }
  }
}, { glitchAt: tB + 4.4 });

// 4 — APPEALS
const tC = 25.8;
const q4a = new TT({ text: 'This is where', at: tC + 0.3, size: 52, weight: 500, color: C.dim, cursor: false });
const q4b = new TT({ text: 'come in.', at: tC + 1.9, size: 52, weight: 500, color: C.dim });
ev(tC + 1.1, 'boom');
S(tC, 30.0, (lt, t) => {
  q4a.draw(t, CX, 360);
  const p = prog(lt, 1.1, 1.5);
  if (p > 0) {
    const s = lerp(1.9, 1, eExpo(p));
    ctx.save(); ctx.translate(CX, 540); ctx.scale(s, s);
    ctx.globalAlpha = clamp(p * 3);
    const f = '900 230px Inter';
    // chromatic layers
    const off = 10 * (1 - eOut(prog(lt, 1.1, 2.2))) + 3;
    ctx.globalCompositeOperation = 'lighter';
    text('APPEALS', -off, 0, f, 'rgba(180,255,210,0.55)', 'center', 1, 0, C.p2, 14);
    text('APPEALS', off, 0, f, 'rgba(220,0,255,0.7)', 'center', 1, 0, C.p2, 14);
    ctx.globalCompositeOperation = 'source-over';
    text('APPEALS', 0, 0, f, grad(-700, -100, 700, 100, [C.p1, C.p2, C.p1]), 'center', 1, 60, C.p2, 14);
    ctx.restore();
    for (let i = 0; i < 3; i++) { const q = prog(lt, 1.1 + i * 0.1, 2.3 + i * 0.1); if (q > 0 && q < 1) ring(CX, 540, 200 + eOut(q) * 900, 3, i === 1 ? C.g : C.p2, 1 - q); }
    // speed lines
    const R = rng(3);
    ctx.save(); ctx.globalAlpha = 0.6 * (1 - prog(lt, 1.1, 2.0));
    for (let i = 0; i < 40; i++) { const a = R() * 6.28, r1 = 400 + R() * 200 + p * 300; ctx.strokeStyle = R() < 0.5 ? C.p1 : C.g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * r1, 540 + Math.sin(a) * r1 * 0.6); ctx.lineTo(CX + Math.cos(a) * (r1 + 160), 540 + Math.sin(a) * (r1 + 160) * 0.6); ctx.stroke(); }
    ctx.restore();
  }
  q4b.draw(t, CX, 730);
}, { flashAt: tC + 1.1, glitchAt: tC + 1.1 });

// 5 — OPTIMISTIC DEMOCRACY
const tD = 30.0;
const q5 = new TT({ text: "With GenLayer's [Optimistic Democracy], a proposed result can be {challenged}, triggering further review.", at: tD + 0.5, size: 46, maxW: 1500 });
const R5 = rng(55);
const ring1 = Array.from({ length: 5 }, (_, i) => ({ a: -Math.PI / 2 + i / 5 * 6.283 }));
const ring2 = Array.from({ length: 11 }, (_, i) => ({ a: -Math.PI / 2 + (i + 0.5) / 11 * 6.283, d: R5() }));
ring1.forEach((n, i) => ev(tD + 2.6 + i * 0.16, 'blip', { f: 1000 + i * 70 }));
ev(tD + 4.6, 'zap'); ev(tD + 5.4, 'riser2');
ring2.forEach((n, i) => ev(tD + 5.6 + i * 0.09, 'blip', { f: 700 + i * 40, v: 0.5 }));
S(tD, 40.0, (lt, t) => {
  mono('03 · OPTIMISTIC DEMOCRACY', CX, 175, 20, C.p1, 'center', eOut(prog(lt, 0.1, 0.5)), 6);
  q5.draw(t, CX, 270);
  const nx = CX, ny = 640, r1 = 150, r2 = 255;
  const chal = prog(lt, 4.6, 4.9);
  // ring 2 (further review)
  const r2p = prog(lt, 5.4, 6.4);
  if (r2p > 0) {
    ring(nx, ny, r2, 1.5, C.p1, 0.25 * r2p);
    ring2.forEach((n, i) => {
      const p = eBack(prog(lt, 5.6 + i * 0.09, 6.0 + i * 0.09)); if (p <= 0) return;
      const x = nx + Math.cos(n.a + lt * 0.05) * r2, y = ny + Math.sin(n.a + lt * 0.05) * r2;
      ctx.save(); ctx.globalAlpha = 0.35 * clamp(p); ctx.strokeStyle = C.p1; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
      const pulse = 0.5 + 0.5 * Math.sin(lt * 5 + i);
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, 6.28); ctx.fillStyle = '#14081f'; ctx.fill();
      ctx.strokeStyle = C.p1; ctx.lineWidth = 2.5; ctx.shadowBlur = 10 + pulse * 14; ctx.shadowColor = C.p2; ctx.stroke();
      ctx.fillStyle = C.p1; ctx.beginPath(); ctx.arc(0, 0, 4 + pulse * 2, 0, 6.28); ctx.fill();
      ctx.restore();
    });
    // review sweep
    const sw = lt * 2.2;
    ctx.save(); ctx.globalAlpha = 0.18 * r2p; ctx.fillStyle = C.p1;
    ctx.beginPath(); ctx.moveTo(nx, ny); ctx.arc(nx, ny, r2 + 20, sw, sw + 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // ring 1
  const r1p = prog(lt, 1.6, 2.2);
  if (r1p > 0) ring(nx, ny, r1, 1.5, C.g, 0.3 * r1p);
  ring1.forEach((n, i) => {
    const p = eBack(prog(lt, 1.6 + i * 0.12, 2.0 + i * 0.12)); if (p <= 0) return;
    const x = nx + Math.cos(n.a) * r1, y = ny + Math.sin(n.a) * r1;
    const vote = prog(lt, 2.6 + i * 0.16, 2.9 + i * 0.16);
    const col = chal > 0 ? C.p1 : C.g;
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(lerp(nx, x, clamp(p)), lerp(ny, y, clamp(p))); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.28); ctx.fillStyle = '#14081f'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    if (vote > 0) check(x, y, 22, vote, col);
  });
  // leader / proposed result
  const lp = eBack(prog(lt, 1.0, 1.5));
  if (lp > 0) {
    ctx.save(); ctx.translate(nx, ny); ctx.scale(lp, lp);
    const shake = chal > 0 && lt < 5.2 ? (hash(Math.floor(t * 30)) - 0.5) * 14 : 0;
    ctx.translate(shake, 0);
    rrect(-95, -42, 190, 84, 42); ctx.fillStyle = 'rgba(28,10,44,0.95)'; ctx.fill();
    ctx.strokeStyle = grad(-95, 0, 95, 0); ctx.lineWidth = 3; ctx.shadowBlur = 24 + chal * 30; ctx.shadowColor = C.p2; ctx.stroke(); ctx.shadowBlur = 0;
    mono('PROPOSED', 0, -12, 14, C.dim, 'center', 1, 4);
    mono('RESULT', 0, 12, 20, C.white, 'center', 1, 4);
    ctx.restore();
  }
  // challenge bolt
  if (lt > 4.5 && lt < 5.6) {
    const bp = eOut(prog(lt, 4.5, 4.7)), ba = 1 - prog(lt, 5.0, 5.6);
    const R = rng(Math.floor(t * 20));
    const xa = 1650, ya = 380;
    ctx.save(); ctx.globalAlpha = ba; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.shadowBlur = 40; ctx.shadowColor = C.p2;
    ctx.beginPath(); ctx.moveTo(xa, ya);
    const steps = 9;
    for (let i = 1; i <= steps * bp; i++) { const q = i / steps; ctx.lineTo(lerp(xa, nx + 95, q) + (i < steps ? (R() - 0.5) * 60 : 0), lerp(ya, ny, q) + (i < steps ? (R() - 0.5) * 60 : 0)); }
    ctx.stroke(); ctx.strokeStyle = C.p1; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    mono('APPEAL', xa, ya - 34, 22, C.p1, 'center', ba, 5);
  }
  for (let i = 0; i < 2; i++) { const q = prog(lt, 4.7 + i * 0.15, 5.8 + i * 0.15); if (q > 0 && q < 1) ring(nx, ny, 60 + eOut(q) * 420, 3, C.p1, 1 - q); }
  // steps bar
  const steps = [['PROPOSE', 1.0], ['CHALLENGE', 4.6], ['FURTHER REVIEW', 5.4]];
  const sa = eOut(prog(lt, 0.8, 1.3));
  const sy = 935, sx0 = CX - 420;
  steps.forEach(([label, at], i) => {
    const x = sx0 + i * 420, on = prog(lt, at, at + 0.3);
    ctx.save(); ctx.globalAlpha = sa;
    if (i < 2) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 20, sy - 1, 380, 2); ctx.fillStyle = grad(x, 0, x + 420, 0); ctx.fillRect(x + 20, sy - 1, 380 * prog(lt, steps[i + 1][1] - 0.4, steps[i + 1][1]), 2); }
    ctx.beginPath(); ctx.arc(x, sy, 10, 0, 6.28); ctx.fillStyle = on > 0 ? (i === 0 ? C.g : C.p1) : '#2a1838'; ctx.shadowBlur = on * 20; ctx.shadowColor = i === 0 ? C.g : C.p2; ctx.fill();
    ctx.restore();
    mono(label, x, sy + 34, 16, on > 0 ? C.white : C.dim, 'center', sa, 4);
  });
}, { glitchAt: tD + 4.6, flashAt: tD + 4.6 });

// 6 — WHY DOES THIS MATTER
const tE = 40.0;
const q6 = new TT({ text: 'Why does this {matter}?', at: tE + 0.4, size: 72, weight: 800 });
const cards = [
  ['Disputed outcomes can receive [additional scrutiny].', iconMag],
  ['Potentially incorrect decisions [can be challenged].', iconFlag],
  ['Validators get [another opportunity] to review disagreements.', iconNodes],
  ['The decision-making process becomes [more robust].', iconShield],
].map(([s, icon], i) => {
  const at = tE + 1.5 + i * 2.0;
  ev(at - 0.25, 'pop');
  return { tt: new TT({ text: s, at, size: 34, weight: 600, maxW: 520, align: 'left', cps: 38, lineH: 1.3 }), icon, at };
});
S(tE, 51.5, (lt, t) => {
  q6.draw(t, CX, 230);
  const cw = 780, ch = 190;
  cards.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = CX - cw - 20 + col * (cw + 40), y = 400 + row * (ch + 40);
    const p = eOut(prog(t, c.at - 0.3, c.at + 0.2));
    if (p <= 0) return;
    ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - p) * (col ? 80 : -80), 0);
    rrect(x, y, cw, ch, 24); ctx.fillStyle = 'rgba(22,9,36,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,135,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    // accent bar
    ctx.fillStyle = grad(0, y, 0, y + ch); ctx.fillRect(x, y + 24, 5, ch - 48);
    // icon tile
    rrect(x + 36, y + ch / 2 - 52, 104, 104, 20); ctx.fillStyle = 'rgba(220,0,255,0.12)'; ctx.fill();
    c.icon(x + 88, y + ch / 2, 64, i === 3 ? C.g : C.p1);
    mono('0' + (i + 1), x + cw - 40, y + 34, 16, C.g, 'right', 0.9, 3);
    ctx.restore();
    c.tt.draw(t, x + 172, y + ch / 2, p);
  });
});

// 7 — AI MODELS ARE NOT PERFECT
const tF = 51.5;
const q7 = new TT({ text: 'AI models are not [perfect].', at: tF + 0.4, size: 88, weight: 800 });
const q7b = new TT({ text: 'They can…', at: tF + 1.6, size: 30, weight: 500, color: C.dim, cursor: false });
const chips = ['misinterpret evidence', 'rely on unreliable sources', 'reach different conclusions'].map((s, i) => {
  const at = tF + 2.3 + i * 1.1; ev(at - 0.2, 'pop');
  return { tt: new TT({ text: s, at, size: 36, weight: 600, align: 'left', cps: 40, cursor: false }), at };
});
ev(tF + 1.25, 'glitch');
S(tF, 58.8, (lt, t) => {
  q7.draw(t, CX, 300);
  // glitch on "perfect"
  const gp = prog(lt, 1.2, 1.5);
  if (gp > 0 && gp < 1) { const R = rng(Math.floor(t * 30)); ctx.fillStyle = C.p2; for (let i = 0; i < 6; i++) ctx.fillRect(CX + (R() - 0.2) * 500, 260 + R() * 80, 40 + R() * 160, 4); }
  q7b.draw(t, CX, 450);
  chips.forEach((c, i) => {
    const p = eBack(prog(t, c.at - 0.2, c.at + 0.2)); if (p <= 0) return;
    const y = 560 + i * 120, w = 680, x = CX - w / 2;
    ctx.save(); ctx.globalAlpha = clamp(p); ctx.translate(CX, y); ctx.scale(lerp(0.8, 1, p), lerp(0.8, 1, p)); ctx.translate(-CX, -y);
    rrect(x, y - 44, w, 88, 44); ctx.fillStyle = 'rgba(22,9,36,0.9)'; ctx.fill();
    ctx.strokeStyle = grad(x, 0, x + w, 0); ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 46, y, 24, 0, 6.28); ctx.fillStyle = 'rgba(220,0,255,0.25)'; ctx.fill();
    iconX(x + 46, y, 9, C.p1);
    ctx.restore();
    c.tt.draw(t, x + 92, y, clamp(p));
  });
}, { glitchAt: tF + 1.25 });

// 8 — APPEAL MECHANISM
const tG = 58.8;
const q8a = new TT({ text: 'An appeal mechanism does not guarantee the correct answer,', at: tG + 0.4, size: 46, weight: 500, color: C.dim, maxW: 1500 });
const q8b = new TT({ text: 'but it provides a process for [questioning decisions] and {reviewing disputes}.', at: tG + 2.4, size: 54, weight: 700, maxW: 1400 });
S(tG, 66.6, (lt, t) => {
  mono('04 · THE PROCESS', CX, 230, 20, C.p1, 'center', eOut(prog(lt, 0.1, 0.5)), 6);
  q8a.draw(t, CX, 330);
  q8b.draw(t, CX, 470);
  // review loop
  const lp = eOut(prog(lt, 4.4, 5.2));
  if (lp > 0) {
    const cx = CX, cy = 780, r = 110;
    const labels = ['QUESTION', 'REVIEW', 'RESOLVE'];
    ctx.save(); ctx.globalAlpha = lp;
    ctx.strokeStyle = grad(cx - r, cy - r, cx + r, cy + r, [C.p1, C.p2, C.g]); ctx.lineWidth = 4; ctx.shadowBlur = 20; ctx.shadowColor = C.p2;
    const rot = lt * 1.2;
    for (let i = 0; i < 3; i++) {
      const a0 = rot + i * 2.094, a1 = a0 + 1.7 * lp;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
      const hx = cx + Math.cos(a1) * r, hy = cy + Math.sin(a1) * r, ta = a1 + Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(ta) * 14, hy + Math.sin(ta) * 14);
      ctx.lineTo(hx + Math.cos(ta + 2.5) * 14, hy + Math.sin(ta + 2.5) * 14);
      ctx.moveTo(hx + Math.cos(ta) * 14, hy + Math.sin(ta) * 14);
      ctx.lineTo(hx + Math.cos(ta - 2.5) * 14, hy + Math.sin(ta - 2.5) * 14); ctx.stroke();
    }
    ctx.restore();
    drawLogo(logoTint.grad, cx, cy, 70, lp, 20);
    labels.forEach((l, i) => {
      const a = -Math.PI / 2 + i * 2.094, x = cx + Math.cos(a) * (r + 120), y = cy + Math.sin(a) * (r + 40);
      const on = Math.floor(lt * 1.2) % 3 === i;
      mono(l, x, y, 18, on ? C.g : C.dim, 'center', lp, 5);
    });
  }
});

// 9 — TRUST
const tH = 66.6;
const q9a = new TT({ text: 'Because trust is not just about reaching consensus.', at: tH + 0.5, size: 58, weight: 600, maxW: 1600 });
const q9b = new TT({ text: "It's also about having a way to [challenge it].", at: tH + 2.6, size: 80, weight: 800, maxW: 1700 });
ev(tH + 2.6 + q9b.n / q9b.cps + 0.1, 'boom');
S(tH, 74.0, (lt, t) => {
  const done = prog(t, q9b.end + 0.1, q9b.end + 0.6);
  const up = eInOut(prog(t, q9b.at - 0.4, q9b.at));
  q9a.draw(t, CX, 470 - up * 80, 1 - up * 0.45);
  q9b.draw(t, CX, 560);
  if (done > 0) {
    for (let i = 0; i < 3; i++) { const q = prog(t, q9b.end + 0.1 + i * 0.12, q9b.end + 1.5 + i * 0.12); if (q > 0 && q < 1) ring(CX, 560, 100 + eOut(q) * 1000, 3, i === 1 ? C.g : C.p1, 1 - q); }
    const w = 520 * eOut(done);
    ctx.fillStyle = grad(CX - w, 0, CX + w, 0, [C.g, C.p1, C.p2]); ctx.fillRect(CX - w, 660, w * 2, 4);
  }
}, { flashAt: tH + 2.6 + q9b.n / q9b.cps + 0.1, glitchAt: tH + 2.6 + q9b.n / q9b.cps + 0.1 });

// 10 — OUTRO
const tI = 74.0;
const outroName = new TT({ text: 'GenLayer', at: tI + 1.0, cps: 16, size: 96, weight: 800, cursor: false });
const outroTag = new TT({ text: 'OPTIMISTIC DEMOCRACY  ·  APPEALS', at: tI + 1.7, cps: 34, size: 24, weight: 600, color: C.g, cursor: false, track: 8 });
ev(tI + 0.3, 'boom');
const DURATION = 80.0;
S(tI, DURATION, (lt, t) => {
  const p = eExpo(prog(lt, 0.2, 1.0));
  drawLogo(logoTint.grad, CX, CY - 90, lerp(80, 280, p), clamp(p * 2), 60);
  for (let i = 0; i < 3; i++) { const q = prog(lt, 0.3 + i * 0.12, 1.6 + i * 0.12); if (q > 0 && q < 1) ring(CX, CY - 90, 100 + eOut(q) * 800, 3, i === 1 ? C.g : C.p1, 1 - q); }
  ctx.save(); ctx.translate(CX, CY - 90); ctx.rotate(lt * 0.4); ctx.globalAlpha = p * 0.6; ctx.strokeStyle = C.p1; ctx.lineWidth = 2; ctx.setLineDash([4, 14]);
  ctx.beginPath(); ctx.arc(0, 0, 220, 0, 6.28); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = C.g; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 220, 0, 0.7); ctx.stroke(); ctx.restore();
  outroName.draw(t, CX, CY + 150);
  outroTag.draw(t, CX, CY + 230, 0.9);
}, { hud: false, flashAt: tI + 0.3, fadeOut: 1.2 });

// whooshes + glitches at every cut
const CUTS = SCENES.slice(1).map(s => s.a);
CUTS.forEach(c => ev(c - 0.3, 'whoosh'));

// ---------- render ----------
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.letterSpacing = '0px';
  let flash = 0, flashColor = 'rgba(220,0,255,0.9)', glitch = 0, energy = 0;
  for (const s of SCENES) {
    if (s.flashAt != null) { const d = t - s.flashAt; if (d >= 0) { flash = Math.max(flash, 0.55 * Math.exp(-d * 5)); energy = Math.max(energy, Math.exp(-d * 2)); } }
    if (s.glitchAt != null) { const d = Math.abs(t - s.glitchAt); if (d < 0.25) glitch = Math.max(glitch, 1 - d / 0.25); }
  }
  for (const c of CUTS) { const d = Math.abs(t - c); if (d < 0.14) glitch = Math.max(glitch, 0.8 * (1 - d / 0.14)); }
  drawBG(t, energy);
  const idx = SCENES.findIndex(s => t >= s.a && t < s.b);
  const cur = SCENES[idx < 0 ? SCENES.length - 1 : idx];
  const lt = t - cur.a, dur = cur.b - cur.a;
  const fin = eOut(lt / 0.35);
  const fout = cur.fadeOut ? 1 - eInOut((lt - (dur - cur.fadeOut)) / cur.fadeOut) : 1 - eInOut((lt - (dur - 0.3)) / 0.3);
  const sa = clamp(Math.min(fin, fout));
  ctx.save();
  ctx.globalAlpha = sa;
  const z = 1 + 0.035 * (1 - fin) - 0.02 * (1 - fout) + lt * 0.002;
  ctx.translate(CX, CY); ctx.scale(z, z); ctx.translate(-CX, -CY);
  cur.draw(lt, t);
  ctx.restore();
  const hudA = SCENES.map(s => s.hud === false ? 0 : 1);
  const ha = (t > 4.3 && t < 73.9) ? clamp(Math.min((t - 4.3) / 0.6, (73.9 - t) / 0.5)) : 0;
  ctx.globalAlpha = 1;
  drawHUD(t, Math.max(1, idx), SCENES.length - 1, ha);
  post(t, glitch, flash, flashColor);
  // final fade to black
  const end = prog(t, DURATION - 0.6, DURATION);
  if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}

window.READY = (async () => {
  await new Promise(r => { logo.onload = r; logo.src = LOGO_SRC; });
  await Promise.all(['400', '500', '600', '700', '800', '900'].map(w => document.fonts.load(`${w} 40px Inter`)));
  await document.fonts.load('600 20px "DejaVu Sans Mono"');
  prepLogo();
  EVENTS.sort((a, b) => a.t - b.t);
  window.EVENTS = EVENTS; window.DURATION = DURATION;
  const q = new URLSearchParams(location.search).get('t');
  if (q != null) render(parseFloat(q));
  else { const st = performance.now(); const loop = () => { render(((performance.now() - st) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); }
  return true;
})();
