// Synthesized soundtrack: a dreamy 100 BPM pastel-pop bed (pad, plucked arps, soft
// kick/hats, sub bass with sidechain) plus sound design synced to the scene events.
const SR = 48000;
const mtof = m => 440 * 2 ** ((m - 69) / 12);
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function synth(events, duration, S) {
  const N = Math.ceil((duration + 0.2) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);   // dry bus
  const RL = new Float32Array(N), RR = new Float32Array(N); // reverb send
  const add = (i, v, pan = 0, send = 0) => {
    if (i < 0 || i >= N) return;
    const l = v * Math.min(1, 1 - pan), r = v * Math.min(1, 1 + pan);
    L[i] += l; R[i] += r; if (send) { RL[i] += l * send; RR[i] += r * send; }
  };

  // ---------------------------------------------------------------- music
  const BEAT = 0.6, BAR = 2.4;
  const CH = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 57, 59], [45, 52, 54, 59, 62]];
  const chordAt = t => CH[Math.floor(t / (BAR * 2)) % 4];
  const on = (t, ranges) => ranges.some(([a, b]) => t >= a && t < b);
  const ARP = [[5.5, 50.3], [55.0, 64.4]];
  const KICK = [[10.5, 50.3], [56.2, 64.2]];
  const HAT = [[19.8, 50.3], [57.0, 64.2]];
  const BASS = [[10.5, 50.3], [55.0, 64.6]];

  // kick times (for sidechain)
  const kicks = [];
  for (let t = 0; t < duration; t += BEAT) if (on(t, KICK)) kicks.push(t);
  const duck = new Float32Array(N).fill(1);
  for (const k of kicks) { const s = Math.floor(k * SR); for (let i = 0; i < SR * 0.45 && s + i < N; i++) duck[s + i] = Math.min(duck[s + i], 1 - 0.55 * Math.exp(-i / SR * 9)); }

  // pad: detuned sine stack per chord, crossfaded, gently filtered
  {
    let lpL = 0, lpR = 0;
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const ci = Math.floor(t / (BAR * 2)), local = t - ci * BAR * 2;
      const fadeIn = clamp(local / 0.8), prevW = 1 - fadeIn;
      let l = 0, r = 0;
      for (const [c, w] of [[CH[ci % 4], fadeIn], [CH[(ci + 3) % 4], ci > 0 ? prevW : 0]]) {
        if (w <= 0) continue;
        for (let k = 0; k < c.length; k++) {
          const f = mtof(c[k] + 12);
          const lfo = 0.75 + 0.25 * Math.sin(t * (0.3 + k * 0.07) + k);
          l += (Math.sin(2 * Math.PI * f * 1.003 * t + k) + 0.25 * Math.sin(4 * Math.PI * f * t)) * w * lfo / (k + 2);
          r += (Math.sin(2 * Math.PI * f * 0.997 * t + k * 1.7) + 0.25 * Math.sin(4 * Math.PI * f * 1.001 * t)) * w * lfo / (k + 2);
        }
      }
      const breakdown = on(t, [[50.3, 55.0]]) ? 0.6 : 1;
      const lvl = 0.05 * clamp(t / 2.5) * clamp((duration - t) / 2.0) * breakdown * (0.55 + 0.45 * duck[i]);
      const k = on(t, [[50.3, 55.0]]) ? 0.05 : 0.18;
      lpL += (l - lpL) * k; lpR += (r - lpR) * k;
      L[i] += lpL * lvl; R[i] += lpR * lvl; RL[i] += lpL * lvl * 0.5; RR[i] += lpR * lvl * 0.5;
    }
  }

  // plucked arpeggio (Karplus-Strong)
  function pluck(t0, midi, g, pan, seed) {
    const f = mtof(midi), p = Math.max(2, Math.round(SR / f)), buf = new Float32Array(p), r = rng(seed);
    for (let i = 0; i < p; i++) buf[i] = r() * 2 - 1;
    const s = Math.floor(t0 * SR), n = Math.floor(0.9 * SR); let idx = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const cur = buf[idx], nxt = buf[(idx + 1) % p];
      const v = 0.497 * (cur + nxt); buf[idx] = v; idx = (idx + 1) % p;
      const o = (v + last) * 0.5; last = v;
      const d = s + i < N ? duck[s + i] : 1;
      add(s + i, o * g * Math.min(1, i / 60) * (0.6 + 0.4 * d), pan, 0.45);
    }
  }
  {
    const pat = [0, 2, 4, 1, 3, 4, 2, 1];
    let n = 0;
    for (let t = 0; t < duration; t += BEAT / 2, n++) {
      if (!on(t, ARP)) continue;
      const c = chordAt(t), note = c[pat[n % 8] % c.length] + 24 - (pat[n % 8] > 2 ? 12 : 0);
      const ramp = on(t, [[5.5, 10.5]]) ? clamp((t - 5.5) / 2) * 0.8 : 1;
      pluck(t, note, 0.16 * ramp * (n % 2 ? 0.75 : 1), (n % 2 ? 0.35 : -0.35), n + 1);
    }
  }

  // kick
  for (const k of kicks) {
    const s = Math.floor(k * SR); let ph = 0;
    for (let i = 0; i < SR * 0.35; i++) { const t = i / SR; ph += 2 * Math.PI * (48 + 110 * Math.exp(-t * 32)) / SR; add(s + i, Math.sin(ph) * Math.exp(-t * 9) * 0.42); }
  }
  // hats (offbeats) + shaker
  {
    const r = rng(9);
    for (let t = BEAT / 2; t < duration; t += BEAT) {
      if (!on(t, HAT)) continue;
      const s = Math.floor(t * SR); let hp = 0, prev = 0;
      for (let i = 0; i < SR * 0.08; i++) { const x = r() * 2 - 1; hp = 0.85 * (hp + x - prev); prev = x; add(s + i, hp * Math.exp(-i / SR * 55) * 0.07, 0.25, 0.1); }
    }
  }
  // sub bass on chord roots (eighth pulses)
  for (let t = 0; t < duration; t += BEAT / 2) {
    if (!on(t, BASS)) continue;
    const f = mtof(chordAt(t)[0] - 12 + (chordAt(t)[0] < 46 ? 12 : 0)), s = Math.floor(t * SR);
    for (let i = 0; i < SR * 0.28; i++) {
      const tt = i / SR, d = duck[Math.min(N - 1, s + i)];
      add(s + i, (Math.sin(2 * Math.PI * f * tt) + 0.2 * Math.sin(4 * Math.PI * f * tt)) * Math.min(1, tt * 200) * Math.exp(-tt * 5) * 0.16 * d);
    }
  }

  // ---------------------------------------------------------------- sound design
  const noiseSweep = (t0, len, g, f0, f1, shape = 'bell', pan = 0, send = 0.3, seed = 1) => {
    const r = rng(seed), s = Math.floor(t0 * SR), n = Math.floor(len * SR); let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n, e = shape === 'rise' ? p ** 2.2 : shape === 'fall' ? (1 - p) ** 2 : Math.sin(Math.PI * p ** 0.7) ** 2;
      const k = clamp((f0 + (f1 - f0) * (shape === 'rise' ? p * p : Math.sin(Math.PI * p))) / SR * 6.28);
      a += ((r() * 2 - 1) - a) * k; b += (a - b) * k;
      add(s + i, b * e * g, pan * Math.sin(p * Math.PI * 2), send);
    }
  };
  const tone = (t0, f, len, g, decay, pan = 0, send = 0.4, type = 'sine') => {
    const s = Math.floor(t0 * SR), n = Math.floor(len * SR);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = Math.sin(2 * Math.PI * f * t);
      if (type === 'bell') v = Math.sin(2 * Math.PI * f * t + 1.8 * Math.exp(-t * 3) * Math.sin(2 * Math.PI * f * 3.5 * t)) + 0.3 * Math.sin(2 * Math.PI * f * 2.01 * t) * Math.exp(-t * 4);
      add(s + i, v * Math.exp(-t * decay) * Math.min(1, t * 800) * g, pan, send);
    }
  };
  const S_ = {
    shimmer(t0) { const r = rng(Math.floor(t0 * 7)); for (let k = 0; k < 10; k++) tone(t0 + k * 0.07, mtof(86 + [0, 4, 7, 11, 14][k % 5] + (k > 4 ? 12 : 0)), 1.6, 0.02, 2.5, r() - 0.5, 0.8); },
    swish(t0, e) { noiseSweep(t0, 0.5, 0.12, 400, 3500, 'bell', 0.6, 0.2, e.seed + 3); },
    riser(t0, e) { const len = e.len || 1.2; noiseSweep(t0, len, 0.35, 150, 6000, 'rise', 0, 0.3, 4); const s = Math.floor(t0 * SR), n = Math.floor(len * SR); let ph = 0; for (let i = 0; i < n; i++) { const p = i / n; ph += 2 * Math.PI * (220 + 880 * p * p) / SR; add(s + i, Math.sin(ph) * p * p * 0.06, 0, 0.4); } },
    impact(t0) {
      const s = Math.floor(t0 * SR); let ph = 0; const r = rng(5); let a = 0;
      for (let i = 0; i < SR * 2.2; i++) { const t = i / SR; ph += 2 * Math.PI * (36 + 120 * Math.exp(-t * 12)) / SR; a += ((r() * 2 - 1) - a) * 0.25; add(s + i, Math.sin(ph) * Math.exp(-t * 2.4) * 0.75 + a * Math.exp(-t * 14) * 0.5, 0, 0.35); }
    },
    bell(t0, e) { (e.notes || [74]).forEach((m, k) => tone(t0 + k * (e.soft ? 0 : 0.045), mtof(m + 12), 2.5, e.soft ? 0.06 : 0.07, 1.6, (k % 2 ? 0.3 : -0.3), 0.7, 'bell')); },
    whoosh(t0) { noiseSweep(t0 - 0.2, 0.75, 0.35, 300, 2600, 'bell', 0.7, 0.25, Math.floor(t0 * 10)); },
    whooshBig(t0) { noiseSweep(t0 - 0.45, 1.1, 0.55, 120, 3800, 'bell', 0.5, 0.35, 77); tone(t0, 55, 1.2, 0.25, 3, 0, 0.2); },
    sparkle(t0) { const r = rng(Math.floor(t0 * 13)); for (let k = 0; k < 9; k++) tone(t0 + k * 0.055 + r() * 0.02, mtof(98 - k * 2 + Math.floor(r() * 3)), 0.6, 0.03, 7, r() * 1.4 - 0.7, 0.7); },
    tick(t0) { tone(t0, 2400, 0.05, 0.05, 90, 0.2, 0.2); },
    pop(t0, e) { const s = Math.floor(t0 * SR); let ph = 0; for (let i = 0; i < SR * 0.16; i++) { const t = i / SR; ph += 2 * Math.PI * ((e.f || 600) * 0.5 + (e.f || 600) * Math.exp(-t * 30)) / SR; add(s + i, Math.sin(ph) * Math.exp(-t * 26) * 0.22, 0, 0.3); } },
    hop(t0) { const s = Math.floor(t0 * SR); let ph = 0; for (let i = 0; i < SR * 0.3; i++) { const t = i / SR; ph += 2 * Math.PI * (500 + 700 * t / 0.3) / SR; add(s + i, Math.sin(ph) * Math.sin(Math.PI * t / 0.3) * 0.07, 0, 0.3); } },
    fee(t0, e) { tone(t0, mtof(72 - (e.i || 0)), 0.25, 0.08, 14, 0.1, 0.3, 'bell'); tone(t0 + 0.09, mtof(67 - (e.i || 0)), 0.35, 0.08, 10, 0.1, 0.3, 'bell'); },
    blip(t0, e) { tone(t0, e.f || 1000, 0.18, 0.07, 26, 0, 0.35); tone(t0, (e.f || 1000) * 2, 0.1, 0.02, 40, 0, 0.3); },
    thud(t0) { tone(t0, 70, 0.5, 0.3, 9, 0, 0.1); tone(t0, mtof(62), 0.6, 0.05, 6, 0, 0.4, 'bell'); },
    shatter(t0) { const r = rng(3); for (let k = 0; k < 14; k++) tone(t0 + r() * 0.25, 2500 + r() * 4000, 0.3, 0.025, 18, r() * 2 - 1, 0.5); noiseSweep(t0, 0.5, 0.2, 3000, 8000, 'fall', 0, 0.3, 8); },
    click(t0, e) { tone(t0, 1800 + (e.seed || 0) * 120, 0.06, 0.045, 70, ((e.seed || 0) / 7 - 0.5), 0.3); },
    zip(t0) { const s = Math.floor(t0 * SR); let ph = 0; for (let i = 0; i < SR * 0.9; i++) { const t = i / SR, p = t / 0.9; ph += 2 * Math.PI * (600 + 1600 * p) / SR; add(s + i, Math.sin(ph) * Math.sin(Math.PI * p) * 0.025, p - 0.5, 0.5); } },
    ping(t0, e) { tone(t0, e.f || 1500, 1.2, 0.06, 4.5, 0.4, 0.8, 'bell'); },
    down(t0) { const s = Math.floor(t0 * SR); let ph = 0; for (let i = 0; i < SR * 1.4; i++) { const t = i / SR; ph += 2 * Math.PI * (330 * Math.exp(-t * 0.8)) / SR; add(s + i, Math.sin(ph) * Math.exp(-t * 2) * Math.min(1, t * 20) * 0.1, 0, 0.6); } },
    strike(t0) { noiseSweep(t0, 0.45, 0.25, 1500, 5000, 'bell', 0.8, 0.2, 21); },
  };
  for (const e of events) (S_[e.type] || (() => {}))(e.t, e);

  // ---------------------------------------------------------------- reverb (Schroeder)
  function reverb(inp, delays, seedShift) {
    const outp = new Float32Array(N);
    for (const d0 of delays) {
      const d = Math.floor(d0 * SR / 1000) + seedShift, buf = new Float32Array(d); let j = 0, lp = 0;
      for (let i = 0; i < N; i++) { const y = buf[j]; lp = y * 0.6 + lp * 0.4; buf[j] = inp[i] + lp * 0.84; j = (j + 1) % d; outp[i] += y / delays.length; }
    }
    for (const [d0, g] of [[5.0, 0.7], [1.7, 0.7]]) {
      const d = Math.floor(d0 * SR / 1000), buf = new Float32Array(d); let j = 0;
      for (let i = 0; i < N; i++) { const b = buf[j], y = -g * outp[i] + b; buf[j] = outp[i] + g * b; outp[i] = y; j = (j + 1) % d; }
    }
    return outp;
  }
  const wl = reverb(RL, [29.7, 37.1, 41.1, 43.7], 0), wr = reverb(RR, [30.9, 35.3, 40.3, 45.1], 7);
  for (let i = 0; i < N; i++) { L[i] += wl[i] * 0.55; R[i] += wr[i] * 0.55; }

  // master: soft clip + normalize to -1 dBFS, short fades
  let peak = 0;
  for (let i = 0; i < N; i++) { const f = Math.min(1, i / (SR * 0.05), (N - i) / (SR * 0.3)); L[i] = Math.tanh(L[i] * 1.3) * f; R[i] = Math.tanh(R[i] * 1.3) * f; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const gain = 0.89 / (peak || 1);
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(Math.round(clamp(L[i] * gain, -1, 1) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(clamp(R[i] * gain, -1, 1) * 32767), 46 + i * 4);
  }
  return buf;
}
