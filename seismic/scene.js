// Seismic — onchain privacy × stablecoin finance. Keynote-style motion graphic.
// Pure function of time: render(t). Every scene boundary sits on the 96 BPM bar grid
// so the synthesized score (tools/audio.mjs) lands with the picture.
const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const C = {
  mauve: '#825A6D', purple: '#523542', mauveLt: '#B8909F',
  white: '#FFFFFF', g50: '#FCFCFC', g200: '#E8E8E8', g300: '#D4D4D4',
  g400: '#A4A3A1', g500: '#737373', g800: '#282826', black: '#161616',
};
const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
const DURATION = 95;
const DISPLAY = '"Inter Display"', TEXT = 'Inter';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ---------- utils ----------
const EVENTS = [];
const ev = (t, type, extra = {}) => EVENTS.push({ t, type, ...extra });
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t;
  const dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    x = clamp(x); if (x === 0 || x === 1) return x;
    let t = x;
    for (let i = 0; i < 10; i++) { const d = dx(t); if (Math.abs(d) < 1e-6) break; t = clamp(t - (sx(t) - x) / d); }
    return sy(t);
  };
}
const eOut = bezier(0.16, 1, 0.3, 1);
const eInOut = bezier(0.65, 0, 0.35, 1);
const eIn = bezier(0.55, 0, 0.75, 0.2);
const spring = p => (p <= 0 ? 0 : p >= 1.6 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(8.5 * p));
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const beat = n => n * BEAT;

function withBlur(px, fn) {
  if (px > 0.35) { ctx.save(); ctx.filter = `blur(${px.toFixed(1)}px)`; fn(); ctx.restore(); } else fn();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function label(str, x, y, size, color, { weight = 500, font = TEXT, align = 'center', a = 1, track = 0 } = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = track + 'px';
  ctx.fillText(str, x, y); ctx.restore();
}
function measure(str, size, weight = 500, font = TEXT, track = 0) {
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.letterSpacing = track + 'px';
  const w = ctx.measureText(str).width; ctx.restore(); return w;
}

// ---------- word-by-word reveal (blur + rise), the core typographic move ----------
// *word* (or *several words*) is set in the accent color.
const layoutCache = new Map();
function layoutText(text, size, weight, font, track, lineH) {
  const key = [text, size, weight, font, track, lineH].join('|');
  if (layoutCache.has(key)) return layoutCache.get(key);
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.letterSpacing = track + 'px';
  const sp = ctx.measureText(' ').width;
  let hl = false, idx = 0;
  const lines = text.split('\n').map(line => {
    const words = []; let x = 0;
    for (let raw of line.split(' ')) {
      let on = hl;
      if (raw.startsWith('*')) { raw = raw.slice(1); on = hl = true; }
      if (raw.endsWith('*')) { raw = raw.slice(0, -1); hl = false; }
      const w = ctx.measureText(raw).width;
      words.push({ s: raw, x, w, hl: on, i: idx++ });
      x += w + sp;
    }
    return { words, w: x - sp };
  });
  ctx.restore();
  const L = { lines, lh: size * lineH, n: idx, size };
  layoutCache.set(key, L);
  return L;
}
function words(t, o) {
  const { text, x = CX, y = CY, size = 80, weight = 600, font = DISPLAY, color = C.black, hl = C.mauve,
    at = 0, out = Infinity, stagger = 0.055, dur = 1.0, align = 'center', lineH = 1.12, a = 1, rise = 0.42 } = o;
  const track = o.track ?? -size * 0.022;
  const L = layoutText(text, size, weight, font, track, lineH);
  if (t < at || a <= 0) return L;
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.letterSpacing = track + 'px';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const y0 = y - (L.lines.length - 1) * L.lh / 2;
  L.lines.forEach((ln, li) => {
    const lx = align === 'center' ? x - ln.w / 2 : align === 'right' ? x - ln.w : x;
    for (const wd of ln.words) {
      const s = at + wd.i * stagger;
      const p = eOut(prog(t, s, s + dur));
      if (p <= 0) continue;
      const so = out + wd.i * stagger * 0.35;
      const q = out === Infinity ? 0 : eIn(prog(t, so, so + 0.45));
      const al = p * (1 - q) * a;
      if (al <= 0.003) continue;
      const blur = (1 - p) * 18 + q * 14;
      ctx.globalAlpha = al;
      ctx.fillStyle = wd.hl ? hl : color;
      wd.cx = lx + wd.x; wd.cy = y0 + li * L.lh;
      const draw = () => ctx.fillText(wd.s, lx + wd.x, y0 + li * L.lh + (1 - p) * size * rise - q * size * 0.22);
      if (blur > 0.4) { ctx.filter = `blur(${blur.toFixed(1)}px)`; draw(); ctx.filter = 'none'; } else draw();
    }
  });
  ctx.restore();
  return L;
}

// ---------- the Seismic gem (vectorized from the supplied logo) ----------
const GEM_H = 303, GEM_CX = 197.5, GEM_CY = 201.5;
const GEM = [
  { c: '#6d5660', p: [[198, 50], [195, 100], [265, 191], [274, 84]] },
  { c: '#5f4650', p: [[190, 60], [117, 193], [187, 100]] },
  { c: '#583d49', p: [[191, 107], [95, 234], [165, 345], [263, 202]] },
  { c: '#88787f', p: [[280, 112], [272, 200], [300, 233]] },
  { c: '#745f68', p: [[269, 207], [171, 353], [262, 352], [300, 247]] },
].map(f => {
  const n = f.p.length;
  const cx = f.p.reduce((s, q) => s + q[0], 0) / n, cy = f.p.reduce((s, q) => s + q[1], 0) / n;
  return { ...f, cx, cy };
});
const GEM_LIGHT = ['#f3ecef', '#e6dbe0', '#ffffff', '#d9c9d0', '#efe6ea'];
const GEM_DARK = ['#9a7d8b', '#86697a', '#b8909f', '#cbb6bf', '#a88a98'];
// f(i) -> { p: 0..1 assembled, a: alpha }; palette optional
function drawGem(x, y, h, f = () => ({ p: 1, a: 1 }), palette = null, glint = -1) {
  const s = h / GEM_H;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  GEM.forEach((g, i) => {
    const { p, a = 1, blur = 0 } = f(i);
    if (a <= 0) return;
    const dx = g.cx - GEM_CX, dy = g.cy - GEM_CY, d = Math.hypot(dx, dy) || 1;
    const off = (1 - p) * 520;
    ctx.save();
    ctx.globalAlpha *= clamp(a);
    ctx.translate(g.cx - GEM_CX + dx / d * off, g.cy - GEM_CY + dy / d * off - (1 - p) * 120);
    ctx.rotate((1 - p) * (i % 2 ? 0.9 : -0.7));
    const sc = lerp(1.9, 1, clamp(p, 0, 1.2));
    ctx.scale(sc, sc);
    if (blur > 0.4) ctx.filter = `blur(${(blur / s).toFixed(1)}px)`;
    ctx.beginPath();
    g.p.forEach(([px, py], k) => k ? ctx.lineTo(px - g.cx, py - g.cy) : ctx.moveTo(px - g.cx, py - g.cy));
    ctx.closePath();
    ctx.fillStyle = palette ? palette[i] : g.c; ctx.fill();
    ctx.restore();
  });
  if (glint > 0 && glint < 1) {
    ctx.beginPath();
    for (const g of GEM) g.p.forEach(([px, py], k) => k ? ctx.lineTo(px - GEM_CX, py - GEM_CY) : ctx.moveTo(px - GEM_CX, py - GEM_CY));
    ctx.clip();
    const gx = lerp(-260, 260, glint);
    const gr = ctx.createLinearGradient(gx - 80, -30, gx + 80, 30);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(-200, -200, 400, 400);
  }
  ctx.restore();
}
function gemAssemble(t, start, step = 0.16, dur = 1.1, order = [2, 0, 4, 1, 3]) {
  return i => {
    const k = order.indexOf(i);
    const p = spring(prog(t, start + k * step, start + k * step + dur) * 1.6);
    return { p, a: prog(t, start + k * step, start + k * step + 0.25), blur: (1 - clamp(p)) * 24 };
  };
}
function gemSounds(start, step = 0.16, base = 0) {
  [2, 0, 4, 1, 3].forEach((f, k) => ev(start + k * step + 0.22, 'tink', { n: base + k }));
}

// ---------- shared pieces ----------
function chapter(t, num, title, at, settle, dark) {
  // eyebrow + title, centered, then glides up to become the scene heading
  const m = eInOut(prog(t, settle, settle + 0.9));
  const sc = lerp(1, 0.52, m), ty = lerp(CY - 20, 150, m);
  ctx.save(); ctx.translate(CX, ty); ctx.scale(sc, sc);
  words(t, { text: num, y: -136, size: 46, weight: 600, font: TEXT, color: dark ? C.mauveLt : C.mauve, track: 6, at, out: o_(t) });
  words(t, { text: title, y: 20, size: 108, color: dark ? C.white : C.black, at: at + 0.15, stagger: 0.07, out: o_(t) });
  ctx.restore();
}
let OUT = Infinity; const o_ = () => OUT;
function coin(x, y, r, a = 1, grey = 0) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, grey ? '#bdbcba' : C.mauve); g.addColorStop(1, grey ? '#8f8e8c' : C.purple);
  ctx.shadowColor = 'rgba(82,53,66,0.28)'; ctx.shadowBlur = r * 0.6; ctx.shadowOffsetY = r * 0.18;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = r * 0.04; ctx.stroke();
  ctx.font = `600 ${r * 1.05}px ${DISPLAY}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, r * 0.04);
  ctx.restore();
}
function card(x, y, w, h, r, { fill = C.white, a = 1, border = C.g200, shadow = 0.07, scale = 1 } = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.scale(scale, scale);
  if (shadow) { ctx.shadowColor = `rgba(40,20,30,${shadow})`; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18; }
  rr(-w / 2, -h / 2, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.shadowColor = 'transparent';
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.restore();
}
function pill(x, y, str, { size = 44, fill = C.white, color = C.black, border = C.g200, a = 1, scale = 1, blur = 0, dot = null, padX = 46, h = null } = {}) {
  if (a <= 0) return 0;
  const tw = measure(str, size, 500);
  const dw = dot ? size * 0.32 + 18 : 0;
  const w = tw + padX * 2 + dw, hh = h || size * 2.2;
  withBlur(blur, () => {
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(scale, scale);
    rr(-w / 2, -hh / 2, w, hh, hh / 2); ctx.fillStyle = fill; ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke(); }
    if (dot) { ctx.beginPath(); ctx.arc(-w / 2 + padX + size * 0.16, 0, size * 0.16, 0, Math.PI * 2); ctx.fillStyle = dot; ctx.fill(); }
    ctx.font = `500 ${size}px ${TEXT}`; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(str, -w / 2 + padX + dw, 1);
    ctx.restore();
  });
  return w;
}
const pillW = (str, size = 44, dot = false, padX = 46) => measure(str, size, 500) + padX * 2 + (dot ? size * 0.32 + 18 : 0);
function ripple(x, y, t0, t, color = C.mauve, maxR = 160, a = 0.5) {
  const p = prog(t, t0, t0 + 1.1); if (p <= 0 || p >= 1) return;
  ctx.save(); ctx.globalAlpha = (1 - p) * a; ctx.strokeStyle = color; ctx.lineWidth = 3 * (1 - p) + 1;
  ctx.beginPath(); ctx.arc(x, y, eOut(p) * maxR, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

// ---------- background ----------
function bgLight(t) {
  ctx.fillStyle = C.g50; ctx.fillRect(0, 0, W, H);
  const gx = CX + Math.sin(t * 0.11) * 420, gy = CY + Math.cos(t * 0.08) * 160;
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 1100);
  g.addColorStop(0, 'rgba(130,90,109,0.07)'); g.addColorStop(1, 'rgba(130,90,109,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function bgDark(t) {
  ctx.fillStyle = C.black; ctx.fillRect(0, 0, W, H);
  const gx = CX + Math.sin(t * 0.13) * 380, gy = CY + 120;
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 1000);
  g.addColorStop(0, 'rgba(130,90,109,0.22)'); g.addColorStop(1, 'rgba(82,53,66,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// =====================================================================
// SCENES — [a, b) in seconds on the bar grid (BAR = 2.5s)
// =====================================================================
const SCENES = [];
const scene = (a, b, o) => SCENES.push({ a, b, bg: 'light', enter: 'cut', ...o });

// ---- 1. Logo assembles, wordmark (0 – 7.5) ----
scene(0, 7.5, {
  setup() { gemSounds(0.5); ev(1.5, 'hit'); ev(1.95, 'glint'); ev(3.35, 'swish', { pan: 0.4 }); ev(7.05, 'whoosh'); },
  draw(t) {
    const m = eInOut(prog(t, 3.3, 4.5));
    const wordW = measure('Seismic', 168, 600, DISPLAY, -4);
    const gh = lerp(440, 230, m), gw = gh * 205 / GEM_H;
    const total = gw + 60 + wordW;
    const gx = lerp(CX, CX - total / 2 + gw / 2, m);
    const ex = eIn(prog(t, 6.6, 7.5));
    ctx.save(); ctx.translate(CX, CY); const z = 1 + ex * 0.08 + t * 0.003; ctx.scale(z, z); ctx.translate(-CX, -CY);
    ctx.globalAlpha = 1 - ex;
    withBlur(ex * 16, () => {
      drawGem(gx, CY, gh, gemAssemble(t, 0.5), null, prog(t, 1.9, 2.8));
      const tx = CX - total / 2 + gw + 60;
      // letters rise from behind a mask line
      ctx.save(); ctx.beginPath(); ctx.rect(tx - 20, CY - 140, wordW + 60, 230); ctx.clip();
      ctx.font = `600 168px ${DISPLAY}`; ctx.letterSpacing = '-4px'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.black;
      let acc = '';
      for (const [k, ch] of [...'Seismic'].entries()) {
        const x = tx + ctx.measureText(acc).width; acc += ch;
        const p = eOut(prog(t, 3.75 + k * 0.045, 4.85 + k * 0.045));
        ctx.globalAlpha = (1 - ex) * clamp(p * 1.4);
        ctx.fillText(ch, x, CY + 6 + (1 - p) * 190);
      }
      ctx.restore();
    });
    ctx.restore();
  },
});

// ---- 2. Privacy ⟷ stablecoin finance, closer together (7.5 – 15) ----
scene(7.5, 15, {
  setup(a) { ev(a + 0.7, 'whoosh', { pan: -0.6 }); ev(a + 0.8, 'whoosh', { pan: 0.6 }); ev(a + 3.85, 'thud'); ev(a + 6.8, 'swish'); },
  draw(t) {
    OUT = 6.7;
    words(t, { text: 'Seismic is building infrastructure that brings', y: 330, size: 46, weight: 500, font: TEXT, color: C.g500, at: 0.15, stagger: 0.04, out: 6.7, track: 0 });
    const L = 'Onchain privacy', R = 'Stablecoin-powered financial services';
    const wl = pillW(L, 46), wr = pillW(R, 46);
    const enter = eOut(prog(t, 0.7, 2.0)), close = spring(prog(t, 3.4, 4.4) * 1.6);
    const gap = lerp(200, 14, close);
    const cxL = CX - (wl + wr + gap) / 2 + wl / 2, cxR = cxL + wl / 2 + gap + wr / 2;
    const xo = (1 - enter) * 1300;
    const ex = eIn(prog(t, 6.7, 7.3));
    const y = 530;
    if (close > 0.5) ripple(CX - (wl + wr + gap) / 2 + wl + gap / 2, y, 3.85, t, C.mauve, 260, 0.35);
    pill(cxL - xo + ex * 60, y, L, { size: 46, fill: C.mauve, color: C.white, border: null, a: enter * (1 - ex), blur: (1 - enter) * 20 + ex * 14 });
    pill(cxR + xo - ex * 60, y, R, { size: 46, fill: C.purple, color: C.white, border: null, a: enter * (1 - ex), blur: (1 - enter) * 20 + ex * 14 });
    words(t, { text: 'closer *together.*', y: 730, size: 120, at: 3.95, stagger: 0.09, out: 6.75 });
  },
});

// ---- 3. But why does this matter? (15 – 20) ----
scene(15, 20, {
  setup(a) { ev(a + 0.3 + 4 * 0.11, 'bell', { n: 4 }); ev(a + 4.3, 'riser', { len: 0.7 }); },
  draw(t) {
    words(t, { text: 'But why does this *matter?*', size: 132, at: 0.3, stagger: 0.11, dur: 1.2, out: 4.3 });
  },
});

// ---- 4. Stablecoins move money — but that's not enough (20 – 32.5) ----
const NEEDS = ['Payment rails', 'Seamless settlements', 'Cross-border payments', 'Currency conversion', 'Compliance tools', 'Financial privacy'];
scene(20, 32.5, {
  setup(a) {
    ev(a + 1.85, 'whoosh', { pan: 0.3 }); ev(a + 2.5, 'ding');
    ev(a + 4.6, 'thunk');
    NEEDS.forEach((_, i) => ev(a + 7.5 + i * beat(0.5), 'marimba', { n: i }));
    ev(a + 11.8, 'swish');
  },
  draw(t) {
    // A — a coin flies across
    words(t, { text: 'Stablecoins made moving money\n*faster* and more *accessible.*', y: 290, size: 80, at: 0.2, out: 3.9 });
    const x0 = 470, x1 = 1450, yy = 650;
    const gone = eIn(prog(t, 6.0, 6.6));
    const grey = prog(t, 4.3, 4.9);
    const lineP = eInOut(prog(t, 1.0, 1.7));
    if (t > 0.8 && gone < 1) {
      ctx.save(); ctx.globalAlpha = 1 - gone;
      ctx.setLineDash([2, 14]); ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C.g300;
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(lerp(x0, x1, lineP), yy); ctx.stroke(); ctx.setLineDash([]);
      // endpoints
      const ea = eOut(prog(t, 0.8, 1.5));
      ctx.globalAlpha = (1 - gone) * ea;
      ctx.beginPath(); ctx.arc(x0, yy, 92, 0, Math.PI * 2); ctx.strokeStyle = C.g200; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x1, yy, 92, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      label('Sender', x0, yy + 140, 32, C.g500, { a: ea * (1 - gone) });
      label('Recipient', x1, yy + 140, 32, C.g500, { a: ea * (1 - gone) });
      const mv = eInOut(prog(t, 1.85, 2.5));
      const cxp = lerp(x0, x1, mv);
      const bump = t > 4.6 ? Math.sin((t - 4.6) * 40) * Math.exp(-(t - 4.6) * 7) * 14 : 0;
      for (let k = 6; k >= 1; k--) {
        const mk = eInOut(prog(t - k * 0.022, 1.85, 2.5));
        if (mv > 0 && mv < 1) coin(lerp(x0, x1, mk), yy, 66, 0.12 * (1 - gone) * (1 - k / 7), grey);
      }
      coin(cxp + bump, yy, 66, eOut(prog(t, 0.8, 1.4)) * (1 - gone), grey);
      ripple(x1, yy, 2.5, t, C.mauve, 180, 0.5);
      const ok = spring(prog(t, 2.55, 3.4) * 1.6) * (1 - grey);
      if (ok > 0) {
        pill(x1, yy - 150, 'Sent', { size: 34, fill: C.white, color: C.black, a: clamp(ok) * (1 - gone), scale: ok, dot: C.mauve });
      }
    }
    // B — not enough
    words(t, { text: 'But transferring a token\nis *not enough.*', y: 290, size: 80, at: 4.05, out: 6.2 });
    // C — what businesses need
    words(t, { text: 'Businesses need more.', y: 300, size: 92, at: 6.6, out: 11.8 });
    const rows = [NEEDS.slice(0, 3), NEEDS.slice(3)];
    let i = 0;
    rows.forEach((row, ri) => {
      const ws = row.map(s => pillW(s, 40, true, 40));
      const tot = ws.reduce((s, w) => s + w, 0) + 26 * (row.length - 1);
      let x = CX - tot / 2;
      row.forEach((s, k) => {
        const st = 7.5 + i * beat(0.5);
        const p = spring(prog(t, st, st + 0.9) * 1.6);
        const q = eIn(prog(t, 11.8 + i * 0.04, 12.3 + i * 0.04));
        const last = i === NEEDS.length - 1;
        pill(x + ws[k] / 2, 560 + ri * 136 + (1 - clamp(p)) * 40, s, {
          size: 40, padX: 40, fill: last ? C.mauve : C.white, color: last ? C.white : C.g800,
          border: last ? null : C.g200, dot: last ? C.white : C.mauve, a: clamp(p * 1.5) * (1 - q), scale: 0.85 + 0.15 * p, blur: q * 12,
        });
        x += ws[k] + 26; i++;
      });
    });
  },
});

// ---- 5. 01 Better financial infrastructure (32.5 – 45) ----
const RAILS = [['Payments', 'arrow'], ['Settlements', 'check'], ['Accounts', 'bank'], ['Treasury', 'stack']];
function icon(kind, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.11; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'arrow') { ctx.moveTo(-s * 0.4, 0); ctx.lineTo(s * 0.4, 0); ctx.moveTo(s * 0.12, -s * 0.28); ctx.lineTo(s * 0.4, 0); ctx.lineTo(s * 0.12, s * 0.28); }
  if (kind === 'check') { ctx.moveTo(-s * 0.36, 0); ctx.lineTo(-s * 0.1, s * 0.26); ctx.lineTo(s * 0.38, -s * 0.26); }
  if (kind === 'bank') { ctx.moveTo(-s * 0.42, -s * 0.12); ctx.lineTo(0, -s * 0.4); ctx.lineTo(s * 0.42, -s * 0.12); for (const k of [-0.28, 0, 0.28]) { ctx.moveTo(s * k, -s * 0.04); ctx.lineTo(s * k, s * 0.26); } ctx.moveTo(-s * 0.42, s * 0.38); ctx.lineTo(s * 0.42, s * 0.38); }
  if (kind === 'stack') { for (const k of [-0.26, 0, 0.26]) { ctx.moveTo(-s * 0.38, s * k); ctx.lineTo(s * 0.38, s * k); } }
  if (kind === 'lock') { ctx.rect(-s * 0.32, -s * 0.05, s * 0.64, s * 0.46); ctx.moveTo(-s * 0.2, -s * 0.05); ctx.arc(0, -s * 0.05, s * 0.2, Math.PI, 0); }
  if (kind === 'eye') { ctx.moveTo(-s * 0.45, 0); ctx.quadraticCurveTo(0, -s * 0.42, s * 0.45, 0); ctx.quadraticCurveTo(0, s * 0.42, -s * 0.45, 0); ctx.moveTo(s * 0.13, 0); ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2); }
  ctx.stroke(); ctx.restore();
}
function bez(p0, p1, p2, p3, u) {
  const v = 1 - u;
  return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
          v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
}
scene(32.5, 45, {
  setup(a) {
    ev(a + 0.2, 'bell', { n: 0 }); ev(a + 2.7, 'swish', { pan: -0.2 });
    ev(a + 3.2, 'pop', { n: 0 }); ev(a + 3.5, 'pop', { n: 2 });
    RAILS.forEach((_, k) => ev(a + 3.8 + k * 0.16, 'pop', { n: 3 + k }));
    ev(a + 4.3, 'sweep');
    ev(a + 11.6, 'riser', { len: 0.9 });
  },
  draw(t) {
    OUT = 11.6;
    chapter(t, '01', 'Better Financial\nInfrastructure', 0.2, 2.6);
    const ex = eIn(prog(t, 11.6, 12.3));
    const A = 1 - ex;
    const hub = [960, 590], src = [450, 590];
    const ys = [400, 530, 660, 790], rx = 1470;
    // links
    const lp = eInOut(prog(t, 4.3, 5.3));
    ctx.save(); ctx.globalAlpha = A; ctx.lineCap = 'round';
    ctx.strokeStyle = C.g300; ctx.lineWidth = 3;
    if (lp > 0) {
      ctx.beginPath(); ctx.moveTo(src[0] + 90, src[1]); ctx.lineTo(lerp(src[0] + 90, hub[0] - 120, clamp(lp * 2)), src[1]); ctx.stroke();
      const lp2 = clamp(lp * 2 - 1);
      ys.forEach(yk => {
        const P = [[hub[0] + 120, hub[1]], [hub[0] + 260, hub[1]], [rx - 330, yk], [rx - 190, yk]];
        ctx.beginPath();
        for (let u = 0; u <= lp2 + 1e-6; u += 0.02) { const q = bez(...P, Math.min(u, lp2)); u ? ctx.lineTo(...q) : ctx.moveTo(...q); }
        ctx.stroke();
      });
    }
    // pulses travelling the rails
    if (t > 5.3) {
      ys.forEach((yk, k) => {
        const P = [[hub[0] + 120, hub[1]], [hub[0] + 260, hub[1]], [rx - 330, yk], [rx - 190, yk]];
        const ph = ((t - 5.3) / BAR * 2 + k * 0.25) % 1;
        let px, py;
        if (ph < 0.45) { px = lerp(src[0] + 90, hub[0] - 120, ph / 0.45); py = src[1]; }
        else if (ph < 0.55) return;
        else [px, py] = bez(...P, (ph - 0.55) / 0.45);
        const fa = clamp(Math.min(ph / 0.08, (1 - ph) / 0.08)) * prog(t, 5.3, 5.8);
        const g = ctx.createRadialGradient(px, py, 0, px, py, 26);
        g.addColorStop(0, `rgba(130,90,109,${0.9 * fa})`); g.addColorStop(1, 'rgba(130,90,109,0)');
        ctx.fillStyle = g; ctx.fillRect(px - 26, py - 26, 52, 52);
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fillStyle = `rgba(130,90,109,${fa})`; ctx.fill();
      });
    }
    ctx.restore();
    // nodes
    const pc = spring(prog(t, 3.2, 4.1) * 1.6);
    coin(src[0], src[1], 78 * pc, clamp(pc * 2) * A);
    label('Onchain money', src[0], src[1] + 140, 32, C.g500, { a: clamp(pc) * A });
    const ph = spring(prog(t, 3.5, 4.4) * 1.6);
    card(hub[0], hub[1], 230, 230, 56, { a: clamp(ph * 2) * A, scale: 0.6 + 0.4 * ph, shadow: 0.1 });
    if (ph > 0) drawGem(hub[0], hub[1], 150 * ph, () => ({ p: 1, a: clamp(ph * 2) * A }));
    label('Seismic', hub[0], hub[1] + 160, 32, C.black, { a: clamp(ph) * A, weight: 600 });
    RAILS.forEach(([name, ic], k) => {
      const p = spring(prog(t, 3.8 + k * 0.16, 4.7 + k * 0.16) * 1.6);
      const x = rx + (1 - clamp(p)) * 60;
      card(x, ys[k], 380, 100, 28, { a: clamp(p * 2) * A, shadow: 0.06 });
      if (p > 0) {
        ctx.save(); ctx.globalAlpha = clamp(p * 2) * A;
        rr(x - 170, ys[k] - 30, 60, 60, 18); ctx.fillStyle = 'rgba(130,90,109,0.1)'; ctx.fill();
        icon(ic, x - 140, ys[k], 40, C.mauve); ctx.restore();
        label(name, x - 86, ys[k] + 1, 36, C.black, { align: 'left', a: clamp(p * 2) * A });
      }
    });
    words(t, { text: 'Connecting onchain money with the infrastructure *businesses already rely on.*', y: 960, size: 40, weight: 500, font: TEXT, color: C.g500, at: 6.4, stagger: 0.035, out: 11.6, track: 0 });
  },
});

// ---- 6. 02 Privacy (dark) (45 – 60) ----
const LEDGER = [
  ['Payroll', '0x7a3e…9f21', '$248,000.00'],
  ['Supplier', '0x91c4…20be', '$1,204,500.00'],
  ['Revenue', '0x3fe0…aa90', '+$3,250,000.00'],
  ['Partner', '0x55d2…c713', '$86,400.00'],
];
const HEX = '0123456789abcdef$#%&@';
scene(45, 60, {
  bg: 'dark', enter: 'circle',
  setup(a) {
    ev(a, 'whoosh'); ev(a + 0.15, 'drop'); ev(a + 2.7, 'swish', { pan: 0.2 });
    LEDGER.forEach((_, k) => ev(a + 3.9 + k * 0.12, 'tick', { n: k }));
    ev(a + 7.5, 'encrypt'); ev(a + 9.0, 'lock'); ev(a + 14.2, 'riser', { len: 0.8 });
  },
  draw(t) {
    OUT = 14.0;
    chapter(t, '02', 'Privacy in\nOnchain Finance', 0.6, 2.8, true);
    const ex = eIn(prog(t, 14.0, 14.7)), A = 1 - ex;
    const cw = 1120, chh = 470, cx = CX, cy = 560;
    const pin = eOut(prog(t, 3.4, 4.4));
    if (pin <= 0) return;
    const L = cx - cw / 2, T = cy - chh / 2;
    withBlur(ex * 14 + (1 - pin) * 12, () => {
      ctx.save(); ctx.globalAlpha = pin * A; ctx.translate(0, (1 - pin) * 60);
      rr(L, T, cw, chh, 36); ctx.fillStyle = '#20201f'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1.5; ctx.stroke();
      label('Transactions', L + 56, T + 64, 34, C.white, { align: 'left', weight: 600, font: DISPLAY });
      // status tag
      const lock = prog(t, 8.9, 9.3), lk = spring(prog(t, 8.9, 9.8) * 1.6);
      const tagW = 196, tx = L + cw - 56 - tagW / 2;
      ctx.save(); ctx.translate(tx, T + 64); ctx.scale(lock > 0 ? 0.9 + 0.1 * lk : 1, lock > 0 ? 0.9 + 0.1 * lk : 1);
      rr(-tagW / 2, -28, tagW, 56, 28);
      ctx.fillStyle = lock > 0 ? C.mauve : 'rgba(255,255,255,0.06)'; ctx.fill();
      if (!lock) { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke(); }
      icon(lock > 0 ? 'lock' : 'eye', -tagW / 2 + 40, 0, 28, lock > 0 ? C.white : C.g400);
      label(lock > 0 ? 'Private' : 'Public', -tagW / 2 + 66, 1, 28, lock > 0 ? C.white : C.g400, { align: 'left' });
      ctx.restore();
      const cols = [L + 56, L + 360, L + cw - 56];
      [['Type', 'left'], ['Counterparty', 'left'], ['Amount', 'right']].forEach(([s, al], k) => label(s, cols[k], T + 140, 24, C.g500, { align: al, track: 1 }));
      const scan = lerp(L - 40, L + cw + 40, eInOut(prog(t, 7.5, 9.0)));
      LEDGER.forEach((row, r) => {
        const ry = T + 210 + r * 76;
        const ra = eOut(prog(t, 3.9 + r * 0.12, 4.6 + r * 0.12));
        ctx.save(); ctx.globalAlpha *= ra;
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(L + 56, ry - 38, cw - 112, 1.5);
        label(row[0], cols[0], ry, 32, C.white, { align: 'left' });
        [1, 2].forEach(k => {
          const str = row[k], al = k === 2 ? 'right' : 'left';
          const w = measure(str, 32, 500, TEXT);
          const x0 = al === 'right' ? cols[k] - w : cols[k];
          const passed = scan - (x0 + w / 2);
          if (passed < 0) { label(str, cols[k], ry, 32, k === 2 ? C.white : C.g400, { align: al }); return; }
          const sp = clamp(passed / 260);
          const pw = w + 20, px = x0 - 10;
          if (sp < 1) {
            ctx.save(); rr(px, ry - 24, pw, 48, 24); ctx.clip();
            const R = rng(Math.floor(t * 24) + r * 7 + k * 31);
            const sc = [...str].map(ch => (/[0-9a-f$,.+x…]/i.test(ch) && R() < 0.9) ? HEX[Math.floor(R() * HEX.length)] : ch).join('');
            label(sc, cols[k], ry, 32, C.mauveLt, { align: al, a: 1 - sp });
            ctx.restore();
          }
          // sealed pill
          ctx.save(); ctx.globalAlpha *= eOut(sp);
          const g = ctx.createLinearGradient(px, 0, px + pw, 0);
          const sh = (t * 0.6 + r * 0.17 + k * 0.3) % 1;
          g.addColorStop(0, 'rgba(130,90,109,0.38)'); g.addColorStop(clamp(sh), 'rgba(184,144,159,0.62)'); g.addColorStop(1, 'rgba(130,90,109,0.38)');
          rr(px, ry - 22, pw, 44, 22); ctx.fillStyle = g; ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          const n = Math.floor(pw / 26);
          for (let d = 0; d < n; d++) { ctx.beginPath(); ctx.arc(px + pw / 2 + (d - (n - 1) / 2) * 22, ry, 4.5, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        });
        ctx.restore();
      });
      // scan bar
      if (t > 7.5 && t < 9.1) {
        const g = ctx.createLinearGradient(scan - 120, 0, scan + 6, 0);
        g.addColorStop(0, 'rgba(184,144,159,0)'); g.addColorStop(1, 'rgba(184,144,159,0.35)');
        ctx.save(); rr(L, T, cw, chh, 36); ctx.clip();
        ctx.fillStyle = g; ctx.fillRect(scan - 120, T, 126, chh);
        ctx.fillStyle = 'rgba(230,210,220,0.95)'; ctx.fillRect(scan, T, 3, chh);
        ctx.restore();
      }
      ctx.restore();
    });
    words(t, { text: 'On public blockchains, transaction data is often *visible to everyone.*', y: 920, size: 40, weight: 500, font: TEXT, color: C.g400, hl: C.white, at: 4.6, stagger: 0.035, out: 7.4, track: 0 });
    words(t, { text: 'Seismic gives developers tools to build apps that *protect sensitive data.*', y: 920, size: 40, weight: 500, font: TEXT, color: C.g400, hl: C.mauveLt, at: 9.4, stagger: 0.035, out: 14.0, track: 0 });
  },
});

// ---- 7. 03 Real-world finance (60 – 72.5) ----
const FX = ['EUR', 'GBP', 'MXN', 'SGD', 'BRL', 'JPY'];
scene(60, 72.5, {
  enter: 'circle',
  setup(a) {
    ev(a, 'whoosh'); ev(a + 0.15, 'lift'); ev(a + 2.7, 'swish', { pan: -0.2 });
    [0, 1, 2].forEach(k => ev(a + 3.4 + k * 0.2, 'pop', { n: 2 + k * 2 }));
    for (let k = 1; k < 6; k++) ev(a + 4.0 + k * beat(2), 'roll');
    ev(a + 5.2, 'check'); ev(a + 11.7, 'swish');
  },
  draw(t) {
    OUT = 11.7;
    chapter(t, '03', 'Connecting Crypto to\nReal-World Finance', 0.6, 2.8);
    const ex = eIn(prog(t, 11.7, 12.4)), A = 1 - ex;
    const xs = [500, 960, 1420], cy = 585, cw = 410, chh = 450;
    xs.forEach((x, k) => {
      const p = spring(prog(t, 3.4 + k * 0.2, 4.4 + k * 0.2) * 1.6);
      if (p <= 0) return;
      const a = clamp(p * 2) * A;
      const y = cy + (1 - clamp(p)) * 90 - ex * 30;
      withBlur(ex * 12, () => {
        card(x, y, cw, chh, 44, { a, scale: (k === 1 ? 1.05 : 1) * (0.92 + 0.08 * p), shadow: k === 1 ? 0.12 : 0.07 });
        ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); if (k === 1) ctx.scale(1.05, 1.05);
        const titles = [['Cross-border', 'payments & FX'], ['Virtual accounts', 'for businesses'], ['Compliance', 'infrastructure']][k];
        label(titles[0], 0, 132, 36, C.black, { weight: 600, font: DISPLAY });
        label(titles[1], 0, 178, 28, C.g500);
        if (k === 0) {
          // currency route
          const ay = -60;
          ctx.strokeStyle = C.g300; ctx.lineWidth = 3; ctx.setLineDash([2, 12]); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-110, ay + 30); ctx.quadraticCurveTo(0, ay - 90, 110, ay + 30); ctx.stroke(); ctx.setLineDash([]);
          const u = ((t - 4.0) / beat(2)) % 1;
          if (t > 4.0) {
            const bx = (1 - u) * (1 - u) * -110 + 2 * (1 - u) * u * 0 + u * u * 110, by = (1 - u) * (1 - u) * (ay + 30) + 2 * (1 - u) * u * (ay - 90) + u * u * (ay + 30);
            ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fillStyle = C.mauve; ctx.globalAlpha = a * clamp(Math.min(u, 1 - u) * 8); ctx.fill(); ctx.globalAlpha = a;
          }
          ctx.beginPath(); ctx.arc(-110, ay + 30, 10, 0, Math.PI * 2); ctx.fillStyle = C.purple; ctx.fill();
          ctx.beginPath(); ctx.arc(110, ay + 30, 10, 0, Math.PI * 2); ctx.fillStyle = C.mauve; ctx.fill();
          label('USD', -110, ay + 84, 34, C.black, { weight: 600, font: DISPLAY });
          // rolling destination currency
          const idx = Math.max(0, Math.floor((t - 4.0) / beat(2)));
          const fr = t > 4.0 ? eInOut(clamp(((t - 4.0) % beat(2)) / 0.45)) : 1;
          ctx.save(); ctx.beginPath(); ctx.rect(40, ay + 58, 140, 54); ctx.clip();
          label(FX[idx % FX.length], 110, ay + 84 + (1 - fr) * 50, 34, C.mauve, { weight: 600, font: DISPLAY });
          if (idx > 0) label(FX[(idx - 1) % FX.length], 110, ay + 84 - fr * 50, 34, C.mauve, { weight: 600, font: DISPLAY, a: 1 - fr });
          ctx.restore();
        }
        if (k === 1) {
          // business card
          const bw = 320, bh = 200, by = -62;
          const fl = Math.sin((t - 4) * 0.8) * 0.03;
          ctx.save(); ctx.translate(0, by); ctx.rotate(-0.04 + fl);
          ctx.shadowColor = 'rgba(82,53,66,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
          const g = ctx.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh / 2);
          g.addColorStop(0, C.mauve); g.addColorStop(1, C.purple);
          rr(-bw / 2, -bh / 2, bw, bh, 22); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
          ctx.save(); ctx.clip();
          const sx = lerp(-300, 300, ((t - 3.4) / 3.5) % 1);
          const sg = ctx.createLinearGradient(sx - 80, -100, sx + 80, 100);
          sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.18)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = sg; ctx.fillRect(-bw / 2, -bh / 2, bw, bh); ctx.restore();
          drawGem(-bw / 2 + 40, -bh / 2 + 46, 52, undefined, GEM_LIGHT);
          label('Virtual account', -bw / 2 + 26, bh / 2 - 66, 20, 'rgba(255,255,255,0.7)', { align: 'left' });
          label('•••• 4821', -bw / 2 + 26, bh / 2 - 34, 30, C.white, { align: 'left', weight: 600, font: DISPLAY, track: 2 });
          label('USDC', bw / 2 - 26, -bh / 2 + 40, 22, 'rgba(255,255,255,0.85)', { align: 'right', weight: 600, track: 1 });
          ctx.restore();
        }
        if (k === 2) {
          // shield + check
          const sp = eInOut(prog(t, 4.0, 5.1)), cp = eOut(prog(t, 5.2, 5.7));
          ctx.save(); ctx.translate(0, -66);
          ctx.beginPath();
          ctx.moveTo(0, -100); ctx.bezierCurveTo(40, -78, 70, -74, 88, -74); ctx.lineTo(88, -8);
          ctx.bezierCurveTo(88, 50, 44, 82, 0, 102); ctx.bezierCurveTo(-44, 82, -88, 50, -88, -8); ctx.lineTo(-88, -74);
          ctx.bezierCurveTo(-70, -74, -40, -78, 0, -100); ctx.closePath();
          ctx.fillStyle = `rgba(130,90,109,${0.1 * cp})`; ctx.fill();
          ctx.setLineDash([620 * sp, 1000]); ctx.strokeStyle = C.g800; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke(); ctx.setLineDash([]);
          if (cp > 0) {
            ctx.beginPath(); ctx.moveTo(-34, 2); ctx.lineTo(-8, 28); ctx.lineTo(38, -22);
            ctx.setLineDash([120 * cp, 200]); ctx.strokeStyle = C.mauve; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]);
          }
          ctx.restore();
        }
        ctx.restore();
      });
    });
    words(t, { text: 'Making stablecoin-powered financial services *practical for businesses.*', y: 945, size: 40, weight: 500, font: TEXT, color: C.g500, at: 6.6, stagger: 0.035, out: 11.7, track: 0 });
  },
});

// ---- 8. The future: payments, privacy, financial services — together (72.5 – 82.5) ----
const TRIO = [['Payments', C.white, C.black, C.g200], ['Privacy', C.mauve, C.white, null], ['Financial services', C.purple, C.white, null]];
scene(72.5, 82.5, {
  setup(a) {
    ev(a + 2.45, 'strike');
    TRIO.forEach((_, k) => ev(a + 4.4 + k * BEAT, 'bell', { n: [2, 3, 5][k] }));
    ev(a + 6.6, 'swish'); ev(a + 7.25, 'hit'); ev(a + 7.25, 'glint');
    ev(a + 9.6, 'riser', { len: 0.8 });
  },
  draw(t) {
    const L = words(t, { text: "The future of stablecoins\nisn't just about moving money *faster.*", size: 84, at: 0.2, out: 3.55 });
    const last = L.lines[1].words.at(-1);
    const sk = eInOut(prog(t, 2.45, 2.9)), sq = eIn(prog(t, 3.55, 4.0));
    if (sk > 0 && last.cx != null) {
      ctx.save(); ctx.globalAlpha = 1 - sq; ctx.strokeStyle = C.mauve; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(last.cx - 6, last.cy + 4); ctx.lineTo(last.cx - 6 + (last.w + 12) * sk, last.cy + 4); ctx.stroke(); ctx.restore();
    }
    words(t, { text: "It's about bringing", y: 340, size: 76, at: 3.9, out: 9.3 });
    const ws = TRIO.map(([s]) => pillW(s, 54, false, 52));
    const tot = ws.reduce((s, w) => s + w, 0) + 30 * 2;
    const conv = eInOut(prog(t, 6.55, 7.3));
    let x = CX - tot / 2;
    TRIO.forEach(([s, fill, color, border], k) => {
      const st = 4.4 + k * BEAT;
      const p = spring(prog(t, st, st + 0.9) * 1.6);
      const px = lerp(x + ws[k] / 2, CX, conv);
      pill(px, 560 + (1 - clamp(p)) * 50, s, { size: 54, padX: 52, fill, color, border, a: clamp(p * 1.6) * (1 - conv), scale: lerp(0.85 + 0.15 * p, 0.3, conv), blur: conv * 10 });
      x += ws[k] + 30;
    });
    const gp = spring(prog(t, 7.2, 8.1) * 1.6), gq = eIn(prog(t, 9.3, 9.9));
    if (gp > 0) {
      ripple(CX, 560, 7.25, t, C.mauve, 240, 0.4);
      withBlur(gq * 14, () => drawGem(CX, 560, 200 * gp, () => ({ p: 1, a: clamp(gp * 2) * (1 - gq) }), null, prog(t, 7.4, 8.3)));
    }
    words(t, { text: '*together.*', y: 800, size: 110, at: 7.35, out: 9.3 });
  },
});

// ---- 9. The money layer → end card (82.5 – 95) ----
function slab(x, y, s, th, top, side, side2, a, text, textColor) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y);
  const hw = s, hh = s / 2;
  // sides
  ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(0, hh); ctx.lineTo(0, hh + th); ctx.lineTo(-hw, th); ctx.closePath(); ctx.fillStyle = side; ctx.fill();
  ctx.beginPath(); ctx.moveTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(0, hh + th); ctx.lineTo(hw, th); ctx.closePath(); ctx.fillStyle = side2; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(-hw, 0); ctx.closePath(); ctx.fillStyle = top; ctx.fill();
  // label lying on the top face
  ctx.save(); ctx.transform(0.5, 0.25, -0.5, 0.25, 0, 0);
  ctx.font = `600 64px ${DISPLAY}`; ctx.fillStyle = textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.letterSpacing = '-1px'; ctx.fillText(text, 0, 0);
  ctx.restore();
  ctx.restore();
}
scene(82.5, 95, {
  setup(a) {
    ev(a + 0.5, 'lift'); ev(a + 2.75, 'thud');
    ev(a + 6.5, 'whoosh');
    gemSounds(a + 6.9, 0.09, 2); ev(a + 7.5, 'final');
  },
  draw(t) {
    const ex = eIn(prog(t, 6.4, 7.0)), A = 1 - ex;
    const sx = 600;
    withBlur(ex * 14, () => {
      const b = spring(prog(t, 0.5, 1.5) * 1.6);
      ctx.save(); ctx.translate(sx, 0);
      slab(0, 760 + (1 - clamp(b)) * 120, 300, 54, '#ece4e8', '#d6c8cf', '#c4b2ba', clamp(b * 2) * A, 'Money layer', C.mauve);
      const u = prog(t, 2.5, 2.8), d = u < 1 ? eIn(u) : 1 + Math.sin((t - 2.8) * 18) * Math.exp(-(t - 2.8) * 8) * 0.012;
      slab(0, lerp(180, 480, d), 300, 54, C.mauve, '#6b4a5a', C.purple, clamp(u * 4) * A, 'Infrastructure', C.white);
      ctx.restore();
      words(t, { text: 'Stablecoins are\nthe *money layer.*', x: 1060, y: 470, align: 'left', size: 96, at: 0.4, out: 6.4, a: 1 });
      words(t, { text: 'Better infrastructure could unlock\ntheir *next stage* of adoption.', x: 1062, y: 690, align: 'left', size: 42, weight: 500, font: TEXT, color: C.g500, at: 3.0, stagger: 0.045, out: 6.4, track: 0 });
    });
    // end card
    if (t > 6.8) {
      const wordW = measure('Seismic', 168, 600, DISPLAY, -4);
      const gh = 230, gw = gh * 205 / GEM_H, total = gw + 60 + wordW;
      const gx = CX - total / 2 + gw / 2, tx = CX - total / 2 + gw + 60;
      drawGem(gx, CY - 40, gh, gemAssemble(t, 6.9, 0.09, 0.9), null, prog(t, 7.6, 8.5));
      ctx.save(); ctx.beginPath(); ctx.rect(tx - 20, CY - 180, wordW + 60, 230); ctx.clip();
      ctx.font = `600 168px ${DISPLAY}`; ctx.letterSpacing = '-4px'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.black;
      let acc = '';
      for (const [k, ch] of [...'Seismic'].entries()) {
        const x = tx + ctx.measureText(acc).width; acc += ch;
        const p = eOut(prog(t, 7.45 + k * 0.045, 8.55 + k * 0.045));
        ctx.globalAlpha = clamp(p * 1.4);
        ctx.fillText(ch, x, CY - 34 + (1 - p) * 190);
      }
      ctx.restore();
      words(t, { text: 'Payments.  Privacy.  Financial services.', y: CY + 150, size: 40, weight: 500, font: TEXT, color: C.g500, at: 8.6, stagger: 0.08, track: 0 });
    }
  },
});

SCENES.forEach(s => s.setup && s.setup(s.a));

// ---------- compositor ----------
const CIRCLE = 1.0;
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  let base = SCENES.findIndex(s => t >= s.a && t < s.b);
  if (base < 0) base = SCENES.length - 1;
  const cur = SCENES[base];
  // a circle-entered scene keeps the previous one alive underneath until the wipe finishes
  const wiping = cur.enter === 'circle' && t - cur.a < CIRCLE && base > 0;
  const under = wiping ? SCENES[base - 1] : cur;
  (under.bg === 'dark' ? bgDark : bgLight)(t);
  drawScene(under, t);
  if (wiping) {
    const p = eInOut((t - cur.a) / CIRCLE);
    ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, p * 1150 + 1, 0, Math.PI * 2); ctx.clip();
    (cur.bg === 'dark' ? bgDark : bgLight)(t);
    drawScene(cur, t);
    ctx.restore();
  }
}
function drawScene(s, t) {
  OUT = Infinity;
  ctx.save();
  // the slowest of camera drifts — keeps every hold alive
  const lt = t - s.a, z = 1 + lt * 0.0025;
  ctx.translate(CX, CY); ctx.scale(z, z); ctx.translate(-CX, -CY);
  s.draw(lt, t);
  ctx.restore();
}

window.READY = (async () => {
  await Promise.all([
    ...['500', '600', '700'].map(w => document.fonts.load(`${w} 40px ${DISPLAY}`)),
    ...['400', '500', '600'].map(w => document.fonts.load(`${w} 40px ${TEXT}`)),
  ]);
  EVENTS.sort((a, b) => a.t - b.t);
  window.EVENTS = EVENTS; window.DURATION = DURATION; window.MUSIC = { bpm: BPM };
  const q = new URLSearchParams(location.search).get('t');
  if (q != null) render(parseFloat(q));
  else { const st = performance.now(); const loop = () => { render(((performance.now() - st) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); }
  return true;
})();
