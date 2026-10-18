// Offline sound for the Golem Brawl trailer: a 120 BPM score cut to the shots, plus every game
// sound effect the director logged (punches, booms, zaps, explosions) at the frame it happened.
const SR = 48000;

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function synth({ duration, shots, sfx }) {
  const N = Math.ceil((duration + 1) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const add = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); } };
  const S = Object.fromEntries(shots.map((s) => [s.name, s.start]));

  /* ---------- instruments ---------- */
  const kick = (t0, g = 1) => { const s = Math.floor(t0 * SR), n = Math.floor(0.45 * SR); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (2 * Math.PI * (45 + 95 * Math.exp(-t * 28))) / SR; add(s + i, Math.sin(ph) * Math.exp(-t * 7) * 0.9 * g + (i < 60 ? (Math.random() - 0.5) * 0.3 * g : 0)); } };
  const snare = (t0, g = 1) => { const r = rng(Math.floor(t0 * 977)); const s = Math.floor(t0 * SR), n = Math.floor(0.3 * SR); let lp = 0, ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const w = r() * 2 - 1; lp += (w - lp) * 0.5; ph += (2 * Math.PI * 190) / SR; add(s + i, ((w - lp) * Math.exp(-t * 16) * 0.55 + Math.sin(ph) * Math.exp(-t * 30) * 0.35) * g); } };
  const hat = (t0, g = 1, pan = 0.25) => { const r = rng(Math.floor(t0 * 1931)); const s = Math.floor(t0 * SR), n = Math.floor(0.06 * SR); let lp = 0; for (let i = 0; i < n; i++) { const t = i / SR; const w = r() * 2 - 1; lp += (w - lp) * 0.7; add(s + i, (w - lp) * Math.exp(-t * 70) * 0.22 * g, pan); } };
  const bass = (t0, f, dur, g = 1) => { const s = Math.floor(t0 * SR), n = Math.floor(dur * SR); let ph = 0, lp = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += f / SR; const saw = 2 * (ph % 1) - 1; const cut = 0.04 + 0.12 * Math.exp(-t * 9); lp += (saw - lp) * cut; const env = Math.min(1, t * 200) * Math.min(1, (dur - t) * 60); add(s + i, (lp * 0.6 + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.35) * env * 0.55 * g); } };
  const pad = (t0, t1, notes, g = 1) => { const s = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR); const fs = notes.map(note); const ph = fs.map(() => [0, 0]); let lpL = 0, lpR = 0; for (let i = 0; i < n; i++) { const t = i / SR; let vl = 0, vr = 0; fs.forEach((f, k) => { ph[k][0] += (f * 1.003) / SR; ph[k][1] += (f * 0.997) / SR; vl += 2 * (ph[k][0] % 1) - 1; vr += 2 * (ph[k][1] % 1) - 1; }); lpL += (vl - lpL) * 0.02; lpR += (vr - lpR) * 0.02; const env = Math.min(1, t / 1.2) * Math.min(1, (t1 - t0 - t) / 0.8) * 0.07 * g; add(s + i, lpL * env, -0.4); add(s + i, lpR * env, 0.4); } };
  const riser = (t0, dur, g = 1) => { const r = rng(5); const s = Math.floor(t0 * SR), n = Math.floor(dur * SR); let lp = 0; for (let i = 0; i < n; i++) { const p = i / n; lp += ((r() * 2 - 1) - lp) * (0.01 + 0.4 * p * p); add(s + i, lp * p * p * 0.6 * g, Math.sin(p * 20) * 0.3); } };
  const boom = (t0, g = 1, len = 2.2) => { const r = rng(7); const s = Math.floor(t0 * SR), n = Math.floor(len * SR); let ph = 0, lp = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (2 * Math.PI * (34 + 90 * Math.exp(-t * 6))) / SR; lp += ((r() * 2 - 1) - lp) * 0.06; add(s + i, (Math.sin(ph) * Math.exp(-t * 2) * 0.85 + lp * Math.exp(-t * 4) * 0.7) * g); } };
  const whoosh = (t0, g = 1, dur = 0.55) => { const r = rng(Math.floor(t0 * 1000) + 3); const s = Math.floor(t0 * SR), n = Math.floor(dur * SR); let lp = 0, lp2 = 0; for (let i = 0; i < n; i++) { const p = i / n; const env = Math.pow(Math.sin(Math.PI * Math.pow(p, 0.6)), 2); const k = 0.03 + 0.3 * Math.sin(Math.PI * p); lp += ((r() * 2 - 1) - lp) * k; lp2 += (lp - lp2) * k; add(s + i, lp2 * env * 0.6 * g, Math.sin(p * Math.PI * 2) * 0.6); } };
  const tone = (t0, type, f0, f1, dur, g, pan = 0) => { const s = Math.floor(t0 * SR), n = Math.floor(dur * SR); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = f0 * Math.pow(f1 / f0, t / dur); ph += f / SR; const x = ph % 1; const v = type === 'sine' ? Math.sin(2 * Math.PI * x) : type === 'square' ? (x < 0.5 ? 1 : -1) : 2 * x - 1; add(s + i, v * Math.min(1, t * 300) * Math.exp(-t * (4 / dur)) * g, pan); } };
  const noise = (t0, dur, g, cut = 0.3, seed = 1, pan = 0) => { const r = rng(seed); const s = Math.floor(t0 * SR), n = Math.floor(dur * SR); let lp = 0; for (let i = 0; i < n; i++) { const t = i / SR; lp += ((r() * 2 - 1) - lp) * cut; add(s + i, lp * Math.exp(-t * (5 / dur)) * g, pan); } };

  /* ---------- score ---------- */
  const BEAT = 0.5;
  // Cold open: low pad, heartbeat pulse, riser into the landing
  pad(0.2, S.land + 1.2, [33, 45, 48, 52], 1.1);
  for (let t = S.bots; t < S.land; t += BEAT * 2) kick(t, 0.45);
  for (let t = 1.0; t < S.land; t += BEAT) hat(t + 0.25, 0.35);
  riser(S.land - 2.2, 2.4, 1.1);
  // The groove from the hero shot to the card
  const bassline = [33, 33, 36, 31];
  for (let t = S.hero; t < S.end - 0.01; t += BEAT) {
    const beat = Math.round((t - S.hero) / BEAT);
    const inFlex = t >= S.flex && t < S.card;
    if (beat % 2 === 0 || !inFlex) kick(t, inFlex ? 0.8 : 1);
    if (beat % 2 === 1 && !inFlex) snare(t, 0.85);
    hat(t + BEAT / 2, 0.8, beat % 2 ? 0.3 : -0.3); hat(t, 0.4);
    const n = bassline[Math.floor(beat / 4) % 4];
    bass(t, note(n + (beat % 4 === 3 ? 12 : 0)), BEAT * 0.9, inFlex ? 0.7 : 1);
  }
  pad(S.hero, S.end + 0.2, [57, 60, 64], 0.8);
  // Cuts: a whoosh into every feature shot
  for (const name of ['punch', 'slam', 'throw', 'return', 'flex', 'card']) whoosh(S[name] - 0.28, 0.8);
  // Ending: a final hit and a long tail
  boom(S.end, 0.9, 3); pad(S.end, S.end + 5, [45, 52, 57, 60], 1.2);

  /* ---------- game sound effects from the director's log ---------- */
  let charge = null;
  for (const e of sfx) {
    const t = e.t, p = e.p || 1;
    switch (e.type) {
      case 'hit': tone(t, 'sine', 160, 50, 0.22, 0.75 * Math.min(1.4, p)); noise(t, 0.14, 0.5 * p, 0.6, Math.floor(t * 100)); break;
      case 'boom': boom(t, 0.55 + 0.4 * Math.min(1.4, p), 1.2 + p); break;
      case 'explode': noise(t, 0.5, 0.65, 0.25, Math.floor(t * 77)); tone(t, 'saw', 160, 40, 0.3, 0.18); break;
      case 'zap': tone(t, 'saw', 1500, 280, 0.25, 0.16, 0.2); tone(t + 0.01, 'square', 1520, 300, 0.25, 0.06, -0.2); break;
      case 'clank': tone(t, 'square', 900, 600, 0.09, 0.08); noise(t, 0.08, 0.2, 0.9, 3); break;
      case 'whoosh': whoosh(t, 0.6 * Math.min(1.4, p), 0.3); break;
      case 'step': tone(t, 'sine', 80, 40, 0.14, 0.3); break;
      case 'roar': tone(t, 'saw', 70, 45, 1.1, 0.25); tone(t, 'saw', 73, 44, 1.1, 0.2); noise(t, 1.0, 0.25, 0.08, 9); break;
      case 'beep': tone(t, 'square', 1100, 1100, 0.06, 0.04); break;
      case 'pick': tone(t, 'sine', 1200, 1800, 0.14, 0.12); tone(t + 0.06, 'sine', 1800, 2400, 0.16, 0.08); break;
      case 'chargeStart': charge = t; break;
      case 'chargeStop': if (charge !== null) { const d = t - charge; tone(charge, 'saw', 38, 90, d + 0.05, 0.08); riser(charge, d, 0.5); charge = null; } break;
    }
  }

  /* ---------- master: soft clip and normalize ---------- */
  let peak = 0;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 0.9); R[i] = Math.tanh(R[i] * 0.9); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const gain = 0.89 / (peak || 1);
  const fade = Math.floor(0.6 * SR), end = Math.floor(duration * SR);
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    const f = i > end - fade ? Math.max(0, (end - i) / fade) : 1;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain * f)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain * f)) * 32767), 46 + i * 4);
  }
  return buf;
}
