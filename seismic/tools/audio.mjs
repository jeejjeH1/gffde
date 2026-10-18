// Score + sound design, synthesized from scratch. A 96 BPM bed in D major (pad, FM e‑piano,
// plucked arp, round bass, soft kick/clap/shaker) that follows the scene sections, plus
// UI-scale effects (glass tinks, marimba, swishes, the encrypt shimmer) placed by EVENTS.
// Everything feeds a Freeverb-style hall, then a gentle limiter.
const SR = 48000, TAU = Math.PI * 2;
const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const TBL = 8192, SIN = new Float32Array(TBL + 1);
for (let i = 0; i <= TBL; i++) SIN[i] = Math.sin(i / TBL * TAU);
const sin = ph => { const x = (ph / TAU) % 1; const p = (x < 0 ? x + 1 : x) * TBL, i = p | 0; return SIN[i] + (SIN[i + 1] - SIN[i]) * (p - i); };

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// Chamberlin state-variable filter
function svf() {
  let lp = 0, bp = 0;
  return (x, fc, q = 0.7) => { const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR); const hp = x - lp - q * bp; bp += f * hp; lp += f * bp; return { lp, bp, hp }; };
}

const CH = {
  D: { p: [50, 57, 61, 64, 66], b: 38 }, Bm: { p: [54, 57, 61, 62, 66], b: 35 },
  G: { p: [55, 59, 62, 66, 69], b: 43 }, A: { p: [52, 57, 59, 62, 64], b: 45 },
  Em: { p: [52, 55, 59, 62, 66], b: 40 }, G7: { p: [55, 59, 61, 66], b: 43 },
};
const PROG = [[0, 'D'], [5, 'Bm'], [10, 'G'], [15, 'A'], [20, 'D'], [25, 'Bm'], [30, 'G'], [35, 'A'], [40, 'D'],
  [45, 'Bm'], [50, 'Em'], [55, 'G7'], [60, 'D'], [65, 'Bm'], [70, 'G'], [75, 'A'], [80, 'D'], [85, 'G'], [87.5, 'A'], [90, 'D']];
const chordAt = t => { let c = PROG[0][1]; for (const [s, n] of PROG) if (t >= s - 1e-6) c = n; return CH[c]; };
const section = t => t < 15 ? 'intro' : t < 20 ? 'pause' : t < 45 ? 'grooveA' : t < 60 ? 'dark' : t < 82.5 ? 'grooveB' : t < 90 ? 'outro' : 'end';
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88, 90];

export function synth(events, duration) {
  const N = Math.ceil((duration + 0.6) * SR);
  const L = new Float32Array(N), R = new Float32Array(N), S = new Float32Array(N);
  const duck = new Float32Array(N).fill(1);
  const gainL = pan => Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gainR = pan => Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
  // voice(t0, seconds, sampleFn(t, i) -> value, pan, send, ducked)
  function voice(t0, len, fn, pan = 0, send = 0.2, ducked = false) {
    const s = Math.floor(t0 * SR), n = Math.floor(len * SR), gl = gainL(pan), gr = gainR(pan);
    for (let i = 0; i < n; i++) {
      const j = s + i; if (j < 0) continue; if (j >= N) break;
      let v = fn(i / SR, i); if (ducked) v *= duck[j];
      L[j] += v * gl; R[j] += v * gr; S[j] += v * send;
    }
  }
  const noiseFn = seed => { const r = rng(seed); return () => r() * 2 - 1; };

  // ---------------- instruments ----------------
  function kick(t0, g = 0.55) {
    let ph = 0;
    voice(t0, 0.5, t => { ph += TAU * (46 + 95 * Math.exp(-t * 32)) / SR; return (sin(ph) * Math.exp(-t * 7) + (t < 0.004 ? (1 - t / 0.004) * 0.3 : 0)) * g; }, 0, 0.04);
    const s = Math.floor(t0 * SR);
    for (let i = 0; i < 0.4 * SR && s + i < N; i++) if (s + i >= 0) duck[s + i] = Math.min(duck[s + i], 1 - 0.42 * Math.exp(-i / SR * 9));
  }
  function clap(t0, g = 0.11) {
    const nz = noiseFn(Math.floor(t0 * 977)), f = svf();
    voice(t0, 0.35, t => {
      const e = [0, 0.011, 0.022].reduce((a, d) => a + (t >= d ? Math.exp(-(t - d) * 160) : 0), 0) * 0.6 + (t > 0.022 ? Math.exp(-(t - 0.022) * 16) : 0) * 0.5;
      return f(nz(), 1300, 0.9).bp * e * g * 2.2;
    }, 0.08, 0.5);
  }
  function shaker(t0, g = 0.03, pan = 0.25) {
    const nz = noiseFn(Math.floor(t0 * 1931)), f = svf();
    voice(t0, 0.09, t => f(nz(), 7000, 0.6).hp * Math.min(1, t / 0.006) * Math.exp(-t * 55) * g, pan, 0.15);
  }
  function bass(t0, m, len = 0.4, g = 0.17) {
    const f0 = mtof(m); let ph = 0;
    voice(t0, len + 0.12, t => {
      ph += TAU * f0 / SR;
      const env = Math.min(1, t / 0.006) * Math.exp(-t * 3.2) * (t > len ? Math.exp(-(t - len) * 40) : 1);
      return (sin(ph) + 0.35 * sin(2 * ph) * Math.exp(-t * 6) + 0.12 * sin(3 * ph) * Math.exp(-t * 10)) * env * g;
    }, 0, 0.02, true);
  }
  function epiano(t0, m, g = 0.07, len = 1.6, pan = 0, send = 0.32) {
    const f0 = mtof(m); let ph = 0;
    voice(t0, len + 0.5, t => {
      ph += TAU * f0 / SR;
      const I = 1.4 * Math.exp(-t * 2.8) + 0.25;
      const env = Math.min(1, t / 0.003) * Math.exp(-t * 0.9) * (t > len ? Math.exp(-(t - len) * 9) : 1);
      return (sin(ph + I * sin(ph)) + 0.12 * sin(ph * 14) * Math.exp(-t * 22)) * env * g;
    }, pan, send, true);
  }
  function chordStab(t0, ch, g = 0.05, len = 1.6, top = 12) {
    ch.p.forEach((m, k) => epiano(t0 + k * 0.012, m, g, len, (k - 2) * 0.18));
    epiano(t0 + 0.05, ch.p[ch.p.length - 1] + top, g * 0.5, len, 0.3);
  }
  function pluck(t0, m, g = 0.045, pan = 0) {
    const f0 = mtof(m); let ph = 0;
    voice(t0, 0.55, t => {
      ph += TAU * f0 / SR; let v = 0;
      for (let k = 1; k <= 5; k++) v += sin(ph * k) / k * Math.exp(-t * (5 + k * 4));
      return v * Math.min(1, t / 0.002) * g;
    }, pan, 0.4, true);
  }
  function bell(t0, m, g = 0.1, pan = 0, send = 0.55) {
    const f0 = mtof(m); let ph = 0;
    voice(t0, 3.2, t => {
      ph += TAU * f0 / SR;
      const I = 2.2 * Math.exp(-t * 3);
      return sin(ph + I * sin(ph * 3.5)) * Math.min(1, t / 0.002) * Math.exp(-t * 1.6) * g;
    }, pan, send);
  }
  function marimba(t0, m, g = 0.15, pan = 0) {
    const f0 = mtof(m); let ph = 0;
    voice(t0, 0.9, t => {
      ph += TAU * f0 / SR;
      return (sin(ph) * Math.exp(-t * 6.5) + 0.3 * sin(ph * 3.99) * Math.exp(-t * 28) + 0.08 * sin(ph * 9.8) * Math.exp(-t * 60)) * Math.min(1, t / 0.0015) * g;
    }, pan, 0.3);
  }
  function glass(t0, m, g = 0.12, pan = 0) {
    const f0 = mtof(m), P = [[1, 1, 2.6], [2.76, 0.45, 5], [5.4, 0.22, 9], [8.93, 0.1, 15]];
    voice(t0, 2.4, t => P.reduce((a, [r, amp, d]) => a + Math.sin(TAU * f0 * r * t) * amp * Math.exp(-t * d), 0) * Math.min(1, t / 0.001) * g, pan, 0.6);
  }
  function noiseSweep(t0, len, f0, f1, g, pan0 = 0, pan1 = 0, q = 0.9, seed = 1, shape = 'arch') {
    const nz = noiseFn(seed), f = svf(), n = Math.floor(len * SR), s = Math.floor(t0 * SR);
    for (let i = 0; i < n; i++) {
      const j = s + i; if (j < 0 || j >= N) continue;
      const p = i / n;
      const env = shape === 'rise' ? Math.pow(p, 2.2) * (p > 0.96 ? (1 - p) / 0.04 : 1) : Math.pow(Math.sin(Math.PI * Math.pow(p, 0.6)), 2);
      const fc = f0 * Math.pow(f1 / f0, shape === 'rise' ? p * p : Math.sin(Math.PI / 2 * p));
      const v = f(nz(), fc, q).bp * env * g, pan = pan0 + (pan1 - pan0) * p;
      L[j] += v * gainL(pan); R[j] += v * gainR(pan); S[j] += v * 0.45;
    }
  }
  function sub(t0, f0, f1, len, g) {
    let ph = 0;
    voice(t0, len, t => { ph += TAU * (f1 + (f0 - f1) * Math.exp(-t * 5)) / SR; return sin(ph) * Math.min(1, t / 0.005) * Math.exp(-t * 3 / len) * g; }, 0, 0.1);
  }

  // ---------------- the score ----------------
  // pad: one swelling voice per chord segment, detuned pair, warm few-harmonic tone
  PROG.forEach(([t0, name], k) => {
    const t1 = k + 1 < PROG.length ? PROG[k + 1][0] : duration;
    const ch = CH[name], dark = t0 >= 45 && t0 < 60, first = k === 0, last = k === PROG.length - 1;
    const atk = first ? 3.5 : 1.2, rel = last ? 1.2 : 2.0, len = t1 - t0 + rel;
    ch.p.forEach((m, vi) => {
      [-1, 1].forEach(side => {
        const f0 = mtof(m) * (1 + side * 0.0025); let ph = vi * 1.7 + side;
        const H = dark ? [1, 0.18, 0.05] : [1, 0.32, 0.12, 0.05];
        voice(t0 - (first ? 0 : 0.6), len + (first ? 0 : 0.6), t => {
          ph += TAU * f0 / SR;
          let v = 0; for (let h = 0; h < H.length; h++) v += sin(ph * (h + 1)) * H[h];
          const tt = t - (first ? 0 : 0.6);
          const env = Math.min(1, Math.max(0, (t) / atk)) * (tt > t1 - t0 ? Math.max(0, 1 - (tt - (t1 - t0)) / rel) : 1);
          const lfo = 0.75 + 0.25 * Math.sin(TAU * (0.07 + vi * 0.011) * (t0 + t) + vi);
          return v * env * lfo * (dark ? 0.03 : 0.024);
        }, side * 0.55, 0.5, true);
      });
    });
  });
  for (let bar = 0; bar * BAR < duration - 0.01; bar++) {
    const t0 = bar * BAR, sec = section(t0 + 0.01), ch = chordAt(t0 + 0.01);
    const groove = sec === 'grooveA' || sec === 'grooveB';
    // drums
    if (groove) {
      const four = sec === 'grooveB';
      for (let b = 0; b < 4; b++) {
        if (four || b % 2 === 0) kick(t0 + b * BEAT, four ? 0.5 : 0.55);
        if ((b === 1 || b === 3) && (t0 >= 32.5 || four)) clap(t0 + b * BEAT);
        const steps = four ? 4 : 2;
        for (let s = 0; s < steps; s++) { const off = s / steps; shaker(t0 + (b + off) * BEAT, (off === 0.5 ? 0.04 : 0.022) * (four ? 1 : 0.85), s % 2 ? -0.25 : 0.25); }
      }
      [0, 1.5, 2, 3.5].forEach((o, k) => bass(t0 + o * BEAT, ch.b + (k === 3 ? 12 : 0), k === 0 ? 0.55 : 0.3));
    }
    // keys
    if (sec === 'intro' && t0 >= 2.5) { chordStab(t0, ch, 0.04, 2.0); epiano(t0 + 2.5 * BEAT, ch.p[ch.p.length - 1] + 12, 0.03, 0.8, 0.35); }
    if (sec === 'pause' && t0 < 17.4) chordStab(t0, ch, 0.035, 4);
    if (groove) { chordStab(t0, ch, 0.04, 1.2); chordStab(t0 + 1.5 * BEAT, ch, 0.026, 0.5); }
    if (sec === 'outro') chordStab(t0, ch, 0.045, 2.2);
    // arp (from 25s in A, all of B, outro)
    if ((sec === 'grooveA' && t0 >= 25) || sec === 'grooveB' || (sec === 'outro' && t0 < 87.4) || (sec === 'intro' && t0 >= 7.5)) {
      const pat = [0, 2, 4, 1, 3, 4, 2, 1], ga = sec === 'intro' ? 0.028 : 0.04;
      for (let s = 0; s < 8; s++) pluck(t0 + s * BEAT / 2, ch.p[pat[s] % ch.p.length] + 12, ga * (s % 2 ? 0.7 : 1), s % 2 ? 0.35 : -0.35);
    }
    // dark: heartbeat sub + sparse bells
    if (sec === 'dark') {
      sub(t0, 70, 46, 0.5, 0.32); sub(t0 + 0.42 * BEAT, 64, 44, 0.4, 0.2);
      const r = rng(bar * 13 + 5), pool = [66, 69, 71, 74, 78, 81];
      bell(t0 + BEAT * 1.5, pool[Math.floor(r() * pool.length)] + 12, 0.045, (r() - 0.5) * 0.8, 0.7);
      if (bar % 2) bell(t0 + BEAT * 3, pool[Math.floor(r() * pool.length)] + 12, 0.035, (r() - 0.5) * 0.8, 0.7);
    }
  }
  // final resolve chord
  [38, 50, 57, 62, 66, 69, 74, 76].forEach((m, k) => epiano(90 + k * 0.02, m, m < 45 ? 0.06 : 0.045, 4.5, (k - 4) * 0.12, 0.5));

  // ---------------- effects ----------------
  const fx = {
    tink: e => glass(e.t, PENTA[(e.n * 2) % PENTA.length] + 12, 0.11, ((e.n % 5) - 2) * 0.3),
    hit: e => { sub(e.t, 90, 42, 1.6, 0.42); noiseSweep(e.t, 0.5, 4000, 600, 0.12, 0, 0, 1.2, 9); },
    glint: e => [0, 4, 7, 9, 12, 16].forEach((s, k) => bell(e.t + k * 0.035, 86 + s, 0.018, -0.6 + k * 0.24, 0.8)),
    swish: e => noiseSweep(e.t, 0.38, 700, 6000, 0.22, (e.pan || 0) - 0.4, (e.pan || 0) + 0.4, 1.4, Math.floor(e.t * 31)),
    whoosh: e => noiseSweep(e.t - 0.25, 0.85, 300, 3200, 0.3, (e.pan || 0) * 0.3 - 0.5, (e.pan || 0) + 0.5, 1.1, Math.floor(e.t * 17)),
    thud: e => { sub(e.t, 120, 55, 0.4, 0.3); marimba(e.t, 62, 0.06); },
    bell: e => bell(e.t, PENTA[e.n % PENTA.length] + 12, 0.075, 0, 0.55),
    riser: e => noiseSweep(e.t, e.len || 0.8, 300, 5000, 0.16, 0, 0, 1.6, Math.floor(e.t * 7), 'rise'),
    ding: e => { marimba(e.t, 81, 0.12, 0.4); marimba(e.t + 0.09, 86, 0.11, 0.45); },
    thunk: e => { sub(e.t, 160, 90, 0.18, 0.22); },
    marimba: e => marimba(e.t, [62, 66, 69, 71, 74, 78][e.n % 6] + 12, 0.13, -0.5 + e.n * 0.2),
    pop: e => { const f0 = mtof(PENTA[e.n % PENTA.length] + 12); let ph = 0; voice(e.t, 0.2, t => { ph += TAU * f0 * (1 + 0.5 * Math.exp(-t * 90)) / SR; return sin(ph) * Math.exp(-t * 22) * 0.1; }, 0, 0.3); },
    sweep: e => noiseSweep(e.t, 1.0, 900, 3500, 0.07, -0.5, 0.6, 1.5, 4),
    drop: e => sub(e.t, 140, 32, 2.2, 0.45),
    tick: e => { const f0 = 2400 + e.n * 150; voice(e.t, 0.03, t => Math.sin(TAU * f0 * t) * Math.exp(-t * 200) * 0.06, -0.3 + e.n * 0.2, 0.2); },
    encrypt: e => {
      const r = rng(77);
      for (let k = 0; k < 140; k++) {
        const p = k / 140, tt = e.t + p * 1.5 + r() * 0.02, f0 = 2600 + r() * 5200;
        voice(tt, 0.06, t => Math.sin(TAU * f0 * t) * Math.exp(-t * 90) * 0.03 * Math.sin(Math.PI * p), -0.85 + p * 1.7, 0.6);
      }
      noiseSweep(e.t, 1.5, 1500, 5000, 0.07, -0.8, 0.8, 1.2, 12);
    },
    lock: e => {
      [0, 0.06].forEach((d, k) => voice(e.t + d, 0.05, t => (Math.sin(TAU * (1700 - k * 500) * t) * 0.7 + (rng(k + 3)() - 0.5)) * Math.exp(-t * 130) * 0.2, 0.3, 0.2));
      sub(e.t + 0.06, 110, 60, 0.3, 0.25); bell(e.t + 0.14, 86, 0.06, 0.2, 0.6);
    },
    lift: e => noiseSweep(e.t - 0.2, 0.9, 400, 4500, 0.18, -0.3, 0.3, 1.2, 21, 'rise'),
    roll: e => voice(e.t, 0.03, t => Math.sin(TAU * 1300 * t) * Math.exp(-t * 180) * 0.05, -0.4, 0.2),
    check: e => { marimba(e.t, 81, 0.12, 0.4); marimba(e.t + 0.08, 86, 0.12, 0.45); },
    strike: e => noiseSweep(e.t, 0.45, 2000, 4500, 0.1, -0.3, 0.4, 2.2, 33),
    final: e => { sub(e.t, 95, 38, 3.2, 0.5); noiseSweep(e.t - 0.9, 0.9, 300, 6000, 0.14, 0, 0, 1.4, 5, 'rise'); [0, 7, 12, 16].forEach((s, k) => bell(e.t + 0.05 + k * 0.06, 86 + s, 0.03, -0.45 + k * 0.3, 0.8)); },
  };
  for (const e of events) (fx[e.type] || (() => {}))(e);

  // ---------------- reverb (Freeverb) ----------------
  const sc = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  function verb(spread) {
    const out = new Float32Array(N);
    const cb = combs.map(l => ({ b: new Float32Array(Math.floor((l + spread) * sc)), i: 0, f: 0 }));
    const ab = aps.map(l => ({ b: new Float32Array(Math.floor((l + spread) * sc)), i: 0 }));
    const fb = 0.86, damp = 0.28;
    for (let n = 0; n < N; n++) {
      const x = S[n] * 0.015; let y = 0;
      for (const c of cb) { const o = c.b[c.i]; c.f = o * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * fb; c.i = (c.i + 1) % c.b.length; y += o; }
      for (const a of ab) { const o = a.b[a.i]; const v = -y + o; a.b[a.i] = y + o * 0.5; a.i = (a.i + 1) % a.b.length; y = v; }
      out[n] = y;
    }
    return out;
  }
  const VL = verb(0), VR = verb(23);
  // ---------------- master ----------------
  const fadeStart = (duration - 1.6) * SR, fadeEnd = duration * SR;
  const hpL = svf(), hpR = svf();
  for (let i = 0; i < N; i++) {
    L[i] = hpL(L[i] + VL[i] * 2.4, 28, 1.2).hp; R[i] = hpR(R[i] + VR[i] * 2.4, 28, 1.2).hp;
  }
  // drive so the 99.9th-percentile sample sits at the knee of a soft limiter
  const sample = []; for (let i = 0; i < N; i += 7) sample.push(Math.max(Math.abs(L[i]), Math.abs(R[i])));
  sample.sort((a, b) => a - b);
  const drive = 0.75 / (sample[Math.floor(sample.length * 0.999)] || 1);
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const fade = i < fadeStart ? 1 : Math.max(0, 1 - (i - fadeStart) / (fadeEnd - fadeStart));
    L[i] = Math.tanh(L[i] * drive) * fade; R[i] = Math.tanh(R[i] * drive) * fade;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const gain = 0.89 / (peak || 1);
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
  }
  return buf;
}
