// Minimal synthesized sound design: soft key ticks for typing, whooshes on cuts,
// sub booms on hits, blips for UI, a quiet ambient pad underneath.
const SR = 48000;

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function synth(events, duration) {
  const N = Math.ceil((duration + 0.5) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const add = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); } };

  const sounds = {
    click(t0, e) { // soft minimal key tick
      const r = rng(e.seed || 1); const f = 2200 + r() * 900 + (e.hl ? 500 : 0); const pan = (r() - 0.5) * 0.4;
      const g = 0.11 + r() * 0.04; let lp = 0;
      const n = Math.floor(0.045 * SR), s = Math.floor(t0 * SR);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const noise = (r() * 2 - 1); lp += (noise - lp) * 0.35;
        const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 160) * 0.7 + (noise - lp) * Math.exp(-t * 400) * 0.6 + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 90) * 0.35;
        add(s + i, v * g, pan);
      }
    },
    whoosh(t0) {
      const r = rng(Math.floor(t0 * 1000)); const n = Math.floor(0.7 * SR), s = Math.floor(t0 * SR); let lp = 0, lp2 = 0;
      for (let i = 0; i < n; i++) {
        const p = i / n; const env = Math.pow(Math.sin(Math.PI * Math.pow(p, 0.7)), 2);
        const k = 0.02 + 0.25 * Math.sin(Math.PI * p);
        lp += ((r() * 2 - 1) - lp) * k; lp2 += (lp - lp2) * k;
        const pan = Math.sin(p * Math.PI * 2) * 0.6;
        add(s + i, lp2 * env * 0.55, pan);
      }
    },
    boom(t0) {
      const r = rng(7); const n = Math.floor(2.2 * SR), s = Math.floor(t0 * SR); let ph = 0, lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR; const f = 38 + 90 * Math.exp(-t * 7); ph += 2 * Math.PI * f / SR;
        lp += ((r() * 2 - 1) - lp) * 0.08;
        const v = Math.sin(ph) * Math.exp(-t * 2.2) * 0.75 + lp * Math.exp(-t * 6) * 0.5 + Math.sin(ph * 2.01) * Math.exp(-t * 5) * 0.15;
        add(s + i, v * 0.7);
      }
    },
    blip(t0, e) {
      const f = e.f || 1000, n = Math.floor(0.14 * SR), s = Math.floor(t0 * SR), g = 0.09 * (e.v || 1);
      for (let i = 0; i < n; i++) { const t = i / SR; add(s + i, (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t)) * Math.exp(-t * 35) * Math.min(1, t * 400) * g); }
    },
    pop(t0) {
      const n = Math.floor(0.18 * SR), s = Math.floor(t0 * SR); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (300 + 700 * Math.exp(-t * 30)) / SR; add(s + i, Math.sin(ph) * Math.exp(-t * 28) * 0.22); }
    },
    alert(t0) {
      for (const [d, f] of [[0, 1320], [0.11, 990]]) {
        const n = Math.floor(0.2 * SR), s = Math.floor((t0 + d) * SR);
        for (let i = 0; i < n; i++) { const t = i / SR; const sq = Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.25 + Math.sin(2 * Math.PI * f * t) * 0.75; add(s + i, sq * Math.exp(-t * 18) * 0.08); }
      }
      sounds.glitch(t0);
    },
    glitch(t0) {
      const r = rng(Math.floor(t0 * 100)); const n = Math.floor(0.28 * SR), s = Math.floor(t0 * SR); let hold = 0, v = 0;
      for (let i = 0; i < n; i++) { if (hold-- <= 0) { hold = Math.floor(r() * 400); v = (r() * 2 - 1) * (r() < 0.3 ? 0 : 1); } add(s + i, v * 0.08 * (1 - i / n), (r() - 0.5)); }
    },
    zap(t0) {
      const r = rng(11); const n = Math.floor(0.6 * SR), s = Math.floor(t0 * SR); let lp = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR; lp += ((r() * 2 - 1) - lp) * 0.5; ph += 2 * Math.PI * (1800 * Math.exp(-t * 8) + 120) / SR;
        add(s + i, (lp * 0.6 + Math.sin(ph) * 0.4) * Math.exp(-t * 7) * 0.35, (r() - 0.5) * 0.5);
      }
      sounds.boom(t0 + 0.02);
    },
    riser(t0, e, len = 1.25) {
      const r = rng(3); const n = Math.floor(len * SR), s = Math.floor(t0 * SR); let lp = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const p = i / n; const k = 0.01 + 0.3 * p * p; lp += ((r() * 2 - 1) - lp) * k; ph += 2 * Math.PI * (200 + 900 * p * p) / SR;
        add(s + i, (lp * 0.6 + Math.sin(ph) * 0.12) * Math.pow(p, 2) * 0.35);
      }
    },
    riser2(t0, e) { sounds.riser(t0 - 0.6, e, 0.7); },
  };
  for (const e of events) (sounds[e.type] || (() => {}))(e.t, e);

  // ambient pad (A minor add9), slowly breathing, fades in/out
  const chord = [55, 110, 164.81, 220, 246.94, 329.63];
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 3) * Math.min(1, Math.max(0, (duration - t) / 2.5));
    let l = 0, r = 0;
    chord.forEach((f, k) => {
      const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * (0.05 + k * 0.013) * t + k);
      l += Math.sin(2 * Math.PI * f * 1.0015 * t + k) * lfo / (k + 1.5);
      r += Math.sin(2 * Math.PI * f * 0.9985 * t + k * 2) * lfo / (k + 1.5);
    });
    L[i] += l * 0.035 * env; R[i] += r * 0.035 * env;
  }

  // soft clip + normalize to -1 dBFS
  let peak = 0;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
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
