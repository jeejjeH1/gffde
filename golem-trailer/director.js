// Golem Brawl trailer director.
// Injected into ../golem-brawl/index.html?film. It stages each shot with real game objects,
// drives the camera, steps the simulation one frame at a time, and lays kinetic type on top.
// window.filmFrame(t) renders the frame at trailer time t; shots are independent so frames
// can be rendered by several workers in parallel.
(() => {
  const FPS = 30, DT = 1 / FPS;
  const F = window.__film, G = window.__golem, THREE = F.THREE;
  const golem = G.Golem;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const backOut = (t) => { t = clamp(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const L3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  /* ---------- Fonts from the repo (Google Fonts is not reachable while rendering) ---------- */
  const fontDir = window.TRAILER_FONTS;
  const fontCss = document.createElement('style');
  fontCss.textContent = [
    ['Unbounded', 700, 'unbounded-latin-700-normal'], ['Unbounded', 900, 'unbounded-latin-900-normal'],
    ['Geist Mono', 400, 'geist-mono-latin-400-normal'], ['Geist Mono', 600, 'geist-mono-latin-600-normal'],
    ['Geist', 400, 'geist-sans-latin-400-normal'], ['Geist', 500, 'geist-sans-latin-500-normal'],
  ].map(([f, w, file]) => `@font-face{font-family:"${f}";font-weight:${w};font-style:normal;src:url("${fontDir}/${file}.woff2") format("woff2");}`).join('\n');
  document.head.appendChild(fontCss);

  /* ---------- Sound log: game SFX are recorded with trailer time, synthesized offline ---------- */
  const SFX = [];
  let recording = false, T = 0;
  for (const name of ['whoosh', 'hit', 'clank', 'boom', 'step', 'explode', 'zap', 'hurt', 'pick', 'wave', 'roar', 'beep', 'chargeStart', 'chargeStop']) {
    F.Snd[name] = (p) => { if (recording) SFX.push({ t: +T.toFixed(4), type: name, p: typeof p === 'number' ? +p.toFixed(3) : 1 }); };
  }
  F.Snd.chargeUpdate = () => {};
  F.Snd.init = () => {};

  /* ---------- Page chrome off, overlay on ---------- */
  for (const id of ['menu', 'hud', 'pause', 'over']) document.getElementById(id).hidden = true;
  const ov = document.createElement('div');
  ov.id = 'trailer';
  ov.innerHTML = `
  <style>
    #trailer { position: absolute; inset: 0; z-index: 20; pointer-events: none; font-family: Geist, sans-serif; color: #f4edf0; overflow: hidden; }
    #trailer * { box-sizing: border-box; }
    .tr-bar { position: absolute; left: 0; right: 0; height: 0; background: #0b0709; }
    .tr-bar.tr-top { top: 0; } .tr-bar.tr-bot { bottom: 0; }
    .tr-cap { position: absolute; left: 120px; bottom: 150px; font: 600 40px "Geist Mono", monospace; letter-spacing: 0.01em; white-space: pre; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
    .tr-cap em { font-style: normal; color: #ff5a73; }
    .tr-cap .tr-caret { display: inline-block; width: 20px; height: 42px; margin-left: 6px; vertical-align: -7px; background: #e9b9ce; }
    .tr-eyebrow { position: absolute; left: 120px; top: 92px; font: 600 20px "Geist Mono", monospace; letter-spacing: 0.18em; color: #e9b9ce; display: flex; align-items: center; gap: 14px; }
    .tr-eyebrow::before { content: ""; width: 14px; height: 17px; background: #e9b9ce; clip-path: polygon(40% 0, 100% 18%, 100% 70%, 60% 100%, 0 75%, 0 30%); }
    .tr-big { position: absolute; left: 0; right: 0; text-align: center; font: 900 150px Unbounded, sans-serif; letter-spacing: -0.035em; line-height: 0.86; text-transform: uppercase; -webkit-text-stroke: 4px #0b0709; paint-order: stroke fill; text-shadow: 0 10px 0 #523542; }
    .tr-big .tr-rose { color: #e9b9ce; }
    .tr-title { position: absolute; left: 0; right: 0; top: 150px; text-align: center; font: 900 230px Unbounded, sans-serif; letter-spacing: -0.04em; line-height: 0.82; text-transform: uppercase; -webkit-text-stroke: 5px #0b0709; paint-order: stroke fill; text-shadow: 0 14px 0 #523542; }
    .tr-title .tr-row { display: block; white-space: nowrap; }
    .tr-title .tr-l { display: inline-block; }
    .tr-title .tr-rose { color: #e9b9ce; }
    .tr-chip { position: absolute; left: 120px; bottom: 120px; display: flex; align-items: stretch; background: rgba(18,13,16,0.9); clip-path: polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px); }
    .tr-chip .tr-n { display: grid; place-items: center; width: 120px; font: 900 54px Unbounded, sans-serif; color: #120d10; background: #e9b9ce; }
    .tr-chip .tr-tx { padding: 22px 40px 24px 30px; display: flex; flex-direction: column; gap: 6px; }
    .tr-chip b { font: 900 64px Unbounded, sans-serif; letter-spacing: -0.02em; text-transform: uppercase; line-height: 0.95; }
    .tr-chip span { font: 600 22px "Geist Mono", monospace; letter-spacing: 0.08em; color: #c9b5bf; text-transform: uppercase; }
    .tr-cleared { position: absolute; right: 120px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: flex-end; gap: 18px; }
    .tr-cleared .tr-k { font: 600 24px "Geist Mono", monospace; letter-spacing: 0.2em; color: #e9b9ce; }
    .tr-cleared .tr-v { font: 900 120px Unbounded, sans-serif; line-height: 0.85; letter-spacing: -0.03em; text-transform: uppercase; -webkit-text-stroke: 4px #0b0709; paint-order: stroke fill; text-shadow: 0 10px 0 #523542; }
    .tr-meter { display: flex; gap: 8px; }
    .tr-meter i { width: 34px; height: 18px; background: rgba(233,185,206,0.18); clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%); }
    .tr-meter i.tr-on { background: #e9b9ce; }
    .tr-cardwrap { position: absolute; left: 50%; top: 55%; width: 1000px; transform-origin: 50% 50%; }
    .tr-cardwrap img { display: block; width: 100%; box-shadow: 0 40px 120px rgba(0,0,0,0.6); }
    .tr-cardhead { position: absolute; left: 0; right: 0; top: 70px; text-align: center; font: 900 76px Unbounded, sans-serif; letter-spacing: -0.02em; text-transform: uppercase; -webkit-text-stroke: 3px #0b0709; paint-order: stroke fill; }
    .tr-cardhead .tr-x { display: inline-grid; place-items: center; width: 92px; height: 92px; margin-left: 18px; vertical-align: -10px; background: #f4edf0; color: #120d10; clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px); -webkit-text-stroke: 0; }
    .tr-cardhead .tr-x svg { width: 50px; height: 50px; fill: currentColor; }
    .tr-end { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding-left: 140px; gap: 28px; background: linear-gradient(90deg, rgba(18,13,16,0.94) 0%, rgba(18,13,16,0.7) 45%, rgba(18,13,16,0) 70%); }
    .tr-end .tr-t { font: 900 196px Unbounded, sans-serif; line-height: 0.84; letter-spacing: -0.04em; text-transform: uppercase; }
    .tr-end .tr-t .tr-rose { color: #e9b9ce; }
    .tr-end .tr-tag { font: 500 40px Geist, sans-serif; color: #e4d6dc; }
    .tr-end .tr-verbs { display: flex; gap: 16px; }
    .tr-end .tr-verbs span { font: 700 28px Unbounded, sans-serif; text-transform: uppercase; padding: 14px 24px; color: #120d10; background: #e9b9ce; clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px); }
    .tr-end .tr-meta { font: 600 24px "Geist Mono", monospace; letter-spacing: 0.12em; color: #a6949d; text-transform: uppercase; }
    .tr-black { position: absolute; inset: 0; background: #000; opacity: 0; }
    .tr-flash { position: absolute; inset: 0; background: #f4e1e8; opacity: 0; }
  </style>
  <div class="tr-bar tr-top"></div><div class="tr-bar tr-bot"></div>
  <div class="tr-eyebrow" id="tEyebrow">SEISMIC COMMUNITY ARCADE</div>
  <div class="tr-cap" id="tCap"></div>
  <div class="tr-big" id="tMeet" style="top: 300px">Meet the <span class="tr-rose">golem</span></div>
  <div class="tr-title" id="tTitle"><span class="tr-row" id="tRow1"></span><span class="tr-row tr-rose" id="tRow2"></span></div>
  <div class="tr-chip" id="tChip"><div class="tr-n" id="tChipN">01</div><div class="tr-tx"><b id="tChipB">Punch</b><span id="tChipS">Three-hit combo</span></div></div>
  <div class="tr-cleared" id="tCleared"><div class="tr-k">BLOCK 05</div><div class="tr-v">Cleared</div><div class="tr-k">THREAT 5/10</div><div class="tr-meter" id="tMeter"></div></div>
  <div class="tr-cardhead" id="tCardHead">Share your score <span class="tr-x"><svg viewBox="0 0 24 24"><path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.3h7l4.8 6.4zm-1.2 17.9h1.9L7.1 4.2h-2z"/></svg></span></div>
  <div class="tr-cardwrap" id="tCard"><img id="tCardImg" alt=""></div>
  <div class="tr-end" id="tEnd">
    <div class="tr-meta">Seismic community arcade</div>
    <div class="tr-t">Golem<br><span class="tr-rose">Brawl</span></div>
    <div class="tr-tag">Spy bots in the plaza. One very heavy golem.</div>
    <div class="tr-verbs"><span>Punch</span><span>Slam</span><span>Throw</span></div>
    <div class="tr-meta">Fan-made · #Seismic</div>
  </div>
  <div class="tr-flash" id="tFlash"></div>
  <div class="tr-black" id="tBlack"></div>`;
  document.getElementById('app').appendChild(ov);
  const $ = (id) => document.getElementById(id);
  const letters = (el, word) => { el.innerHTML = ''; return [...word].map((ch) => { const s = document.createElement('span'); s.className = 'tr-l'; s.textContent = ch; el.appendChild(s); return s; }); };
  const row1 = letters($('tRow1'), 'GOLEM'), row2 = letters($('tRow2'), 'BRAWL');
  for (let i = 0; i < 10; i++) { const m = document.createElement('i'); $('tMeter').appendChild(m); }
  const show = (id, on, style) => { const el = $(id); el.style.display = on ? '' : 'none'; if (on && style) Object.assign(el.style, style); return el; };

  /* ---------- Helpers for staging ---------- */
  function bot(type, x, z, opts = {}) {
    const b = G.spawnBot(type, x, z);
    b.pos.y = type === 'drone' ? b.hover : 0; b.vel.set(0, 0, 0); b.state = 'move'; b.st = 0; b.air = type === 'drone';
    if (b.marker) { F.scene.remove(b.marker); b.marker = null; }
    b.cool = opts.cool ?? 99; if (opts.speed !== undefined) b.speed = opts.speed;
    if (opts.orbitA !== undefined) b.orbitA = opts.orbitA;
    b.g.rotation.y = Math.atan2(golem.pos.x - x, golem.pos.z - z);
    return b;
  }
  function reset(warm = 5.2) {
    F.clearBots();
    golem.reset(); golem.root.visible = true; golem.setState('idle'); golem.inv = 999;
    F.film.golemY = null; F.film.cam = { pos: [0, 6, 12], look: [0, 1.5, 0], fov: 40 };
    Object.assign(G.clock, { slow: 0, hitStop: 0, trauma: 0, fovKick: 0, scale: 1 });
    G.S.mode = 'play'; G.S.wave = 0; G.S.hits = 0;
    document.querySelectorAll('.pow').forEach((e) => e.remove());
    const was = recording; recording = false;
    for (let i = 0; i < Math.round(warm * FPS); i++) F.step(DT, false);
    recording = was;
  }
  const preroll = (sec) => { const was = recording; recording = false; for (let i = 0; i < Math.round(sec * FPS); i++) F.step(DT, false); recording = was; };
  const at = (t, a) => Math.round(t * FPS) === Math.round(a * FPS); // fires once, on the frame nearest a

  /* ---------- Shots ---------- */
  const shots = [];
  const shot = (name, dur, def) => shots.push({ name, dur, ...def });

  shot('city', 4, {
    setup() { reset(); golem.root.visible = false; },
    frame(t) { const k = ease(t / 4); F.film.cam = { pos: L3([-6, 34, 46], [0, 7.5, 17], k), look: L3([0, 6, -10], [0, 1.2, 0], k), fov: 44 }; },
  });
  let spyBots = [];
  shot('bots', 4, {
    setup() { reset(); golem.root.visible = false; spyBots = []; },
    frame(t) {
      const drops = [[-3.2, -8.5, 0.1], [3.4, -9.0, 0.3], [-1.4, -10.5, 0.5], [1.6, -7.4, 0.7], [-4.6, -6.6, 0.9], [4.8, -6.2, 1.1], [0, -6, 1.35]];
      for (const [x, z, a] of drops) if (at(t, a)) { const b = G.spawnBot('peeper', x, z); b.cool = 99; b.speed = 0; spyBots.push(b); }
      const k = ease(t / 4);
      F.film.cam = { pos: L3([0, 2.4, 1.5], [0.15, 1.05, -3.3], k), look: L3([0, 1.6, -7.5], [0, 0.85, -6], k), fov: 40 };
    },
  });
  shot('land', 3.5, {
    setup() {
      reset();
      const ring = [[0, -4.2], [-3.4, -2.6], [3.6, -2.2], [-4.3, 1.6], [4.0, 2.2], [-1.6, 4.2], [2.0, 4.0], [0.4, -6.8]];
      for (const [x, z] of ring) bot('peeper', x, z, { speed: 0.4 });
      golem.root.visible = true; golem.setState('slamUp'); golem.slamPower = 1; F.film.golemY = 16;
    },
    frame(t) {
      const fall = 0.9;
      if (t < fall) { golem.st = 0.1; F.film.golemY = 16 * (1 - Math.pow(t / fall, 2)); }
      if (at(t, fall)) { F.film.golemY = 0; golem.y = 0; golem.setState('slamDown'); golem.st = 0.099; F.film.golemY = null; }
      const k = ease(t / 3.5);
      const gy = F.film.golemY === null ? 0 : F.film.golemY;
      F.film.cam = { pos: L3([0, 2.6, 15], [0, 2.4, 11], k), look: [0, Math.max(2.4, Math.min(gy + 2.2, 9)), 0], fov: 46 };
    },
  });
  shot('hero', 4, {
    setup() { reset(); golem.setState('roar'); golem.st = 0; },
    frame(t) {
      if (at(t, 2.2)) golem.setState('taunt');
      const a = lerp(-0.55, 0.45, ease(t / 4)); const r = lerp(6.2, 5.2, ease(t / 4));
      F.film.cam = { pos: [Math.sin(a) * r, lerp(2.0, 2.8, ease(t / 4)), Math.cos(a) * r], look: [0, 2.9, 0], fov: 38 };
    },
  });
  let punchBots = [];
  shot('punch', 3.5, {
    setup() {
      reset(); golem.targetFacing = golem.facing = Math.PI / 2;
      punchBots = [bot('peeper', 2.15, 0.35, { speed: 0 }), bot('peeper', 2.5, -1.4, { speed: 0 }), bot('peeper', 3.6, 1.2, { speed: 0 })];
      preroll(0.4);
    },
    frame(t) {
      for (const a of [0.25, 0.47, 0.69, 1.75, 1.97, 2.19]) if (at(t, a)) G.actions.punch = true;
      const k = ease(t / 3.5); const gx = golem.pos.x;
      F.film.cam = { pos: [gx + lerp(0.6, 1.4, k), lerp(2.2, 2.5, k), lerp(7.6, 6.8, k)], look: [gx + 1.4, 1.7, -0.2], fov: 42 };
    },
  });
  shot('slam', 4, {
    setup() {
      reset(); golem.targetFacing = golem.facing = 0;
      const n = 9; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.3; const r = 3.6 + (i % 3) * 1.1; bot('peeper', Math.sin(a) * r, Math.cos(a) * r, { speed: 0 }); }
      bot('drone', 0, -6, { orbitA: Math.PI });
      preroll(0.5);
    },
    frame(t) {
      if (at(t, 0.2)) G.actions.slamDown = true;
      if (at(t, 1.45)) G.actions.slamUp = true;
      const k = ease(t / 4);
      F.film.cam = { pos: L3([-3, 8.5, 10.5], [-1.5, 10.5, 12.5], k), look: [0, 0.6, 0], fov: 42 };
    },
  });
  shot('throw', 4, {
    setup() {
      reset(); golem.pos.set(-3.2, 0, 0); golem.targetFacing = golem.facing = Math.PI / 2;
      bot('peeper', -1.4, 0.1, { speed: 0 });
      for (const [x, z] of [[3.6, -0.6], [4.4, 0.7], [5.0, -0.1], [3.9, 1.8], [4.8, -1.6]]) bot('peeper', x, z, { speed: 0 });
      preroll(0.4);
    },
    frame(t) {
      if (at(t, 0.3)) G.actions.grab = true;
      if (at(t, 1.6)) G.actions.grab = true;
      const k = ease(t / 4);
      F.film.cam = { pos: L3([-0.5, 3.0, 9.5], [1.2, 3.6, 9.0], k), look: L3([-1.5, 2.2, 0], [2.2, 1.4, 0], ease(seg(t, 1.4, 2.4))), fov: 42 };
    },
  });
  let drone = null;
  shot('return', 3, {
    setup() {
      reset(); golem.targetFacing = golem.facing = Math.PI;
      drone = bot('drone', 0, -6.5, { orbitA: Math.PI }); drone.pos.y = drone.hover = 2.4;
      bot('peeper', -3.5, -4.5, { speed: 0 });
      preroll(0.6);
    },
    frame(t) {
      if (drone) drone.orbitA = Math.PI;
      if (at(t, 0.25) && drone && !drone.dead) { const from = new THREE.Vector3(); drone.parts.eye.getWorldPosition(from); F.fireOrb(from, new THREE.Vector3(golem.pos.x, 2.1, golem.pos.z)); }
      if (at(t, 0.68)) G.actions.punch = true;
      const k = ease(t / 3);
      F.film.cam = { pos: L3([4.4, 3.2, 5.2], [3.8, 3.0, 4.4], k), look: [-0.6, 2.1, -3.0], fov: 44 };
    },
  });
  shot('flex', 3.5, {
    setup() { reset(); golem.targetFacing = golem.facing = 0; golem.setState('flex'); },
    frame(t) {
      if (at(t, 1.8)) golem.setState('flex');
      if (at(t, 0.1)) for (let i = 0; i < 6; i++) Particles_spark(i);
      const k = ease(t / 3.5);
      F.film.cam = { pos: L3([1.6, 1.6, 10.2], [2.0, 1.9, 8.8], k), look: [2.6, 2.3, 0], fov: 40 };
    },
  });
  function Particles_spark(i) { const a = i * 1.1; F.Particles.spark(Math.sin(a) * 1.6, 3 + (i % 2), Math.cos(a) * 1.6, 8, [3, 1.6, 2.2], 5); }
  let cardUrl = '';
  shot('card', 3.5, {
    async setup() {
      reset(); golem.targetFacing = golem.facing = 0;
      Object.assign(G.S, { score: 12480, kills: 58, bestHits: 23, wave: 7, bowled: 9 });
      const blob = await F.makeCard();
      G.S.wave = 0;
      if (cardUrl) URL.revokeObjectURL(cardUrl);
      cardUrl = URL.createObjectURL(blob);
      const img = $('tCardImg'); img.src = cardUrl; await img.decode().catch(() => {});
    },
    frame(t) {
      const a = t * 0.18 + 0.6;
      F.film.cam = { pos: [Math.sin(a) * 8, 3.2, Math.cos(a) * 8], look: [0, 2, 0], fov: 40 };
    },
  });
  shot('end', 5, {
    setup() { reset(); golem.targetFacing = golem.facing = -0.35; },
    frame(t) {
      if (at(t, 0.8)) golem.setState('taunt');
      if (at(t, 2.6)) golem.setState('flex');
      const k = ease(t / 5);
      F.film.cam = { pos: L3([-5.2, 2.3, 8.6], [-4.6, 2.5, 7.6], k), look: [-2.2, 2.2, 0], fov: 40 };
    },
  });

  let acc = 0; for (const s of shots) { s.start = acc; acc += s.dur; }
  const DURATION = acc;

  /* ---------- Overlay timeline ---------- */
  const S0 = Object.fromEntries(shots.map((s) => [s.name, s.start]));
  function typed(text, t, cps = 26) { const n = Math.floor(clamp(t, 0, 99) * cps); return text.slice(0, n); }
  function overlay(t) {
    // Letterbox for the cold open
    const lb = t < S0.hero + 1.5 ? 1 : 1 - seg(t, S0.hero + 1.5, S0.hero + 2.2);
    $('trailer').querySelector('.tr-bar.tr-top').style.height = $('trailer').querySelector('.tr-bar.tr-bot').style.height = (96 * ease(lb) * ease(seg(t, 0, 0.6) + (t > 1 ? 1 : 0))) + 'px';
    // Captions
    let cap = '', capOn = false;
    if (t < S0.bots) { const lt = t - 0.5; cap = typed('Every transaction in this city is encrypted.', lt); capOn = lt > 0; }
    else if (t < S0.land) { const lt = t - S0.bots - 0.6; const full = 'Spy bots want to read them.'; const txt = typed(full, lt); cap = txt.replace('read', '<em>read</em>'); capOn = lt > 0; }
    const capEl = show('tCap', capOn && t < S0.land - 0.15);
    if (capOn) capEl.innerHTML = cap + (Math.floor(t * 2.5) % 2 === 0 ? '<span class="tr-caret"></span>' : '');
    // Meet the golem
    const meetT = t - (S0.land + 1.25);
    const meet = show('tMeet', meetT > 0 && t < S0.hero, { transform: `scale(${lerp(1.6, 1, backOut(meetT / 0.35))})`, opacity: String(clamp(meetT / 0.12, 0, 1) * (1 - seg(t, S0.hero - 0.25, S0.hero))) });
    // Title letters
    const titT = t - (S0.hero + 1.6);
    const titOn = titT > 0 && t < S0.punch;
    show('tTitle', titOn, { opacity: String(1 - seg(t, S0.punch - 0.3, S0.punch)) });
    if (titOn) [...row1, ...row2].forEach((el, i) => { const p = backOut((titT - i * 0.05) / 0.32); el.style.transform = `translateY(${(1 - p) * -260}px) rotate(${(1 - p) * -14}deg)`; el.style.opacity = String(clamp((titT - i * 0.05) / 0.08, 0, 1)); });
    // Eyebrow during features
    show('tEyebrow', t > S0.punch && t < S0.card, { opacity: String(seg(t, S0.punch, S0.punch + 0.4)) });
    // Feature chips
    const chips = [['punch', '01', 'Punch', 'Three-hit combo'], ['slam', '02', 'Slam', 'Hold to shake harder'], ['throw', '03', 'Throw', 'Bowl them over'], ['return', '04', 'Return', 'Punch orbs back']];
    let chipOn = false;
    for (const [name, n, b, s] of chips) {
      const sh = shots.find((x) => x.name === name); const lt = t - sh.start;
      if (lt >= 0 && lt < sh.dur) {
        chipOn = true; $('tChipN').textContent = n; $('tChipB').textContent = b; $('tChipS').textContent = s;
        const pin = backOut(lt / 0.35), pout = seg(lt, sh.dur - 0.25, sh.dur);
        Object.assign($('tChip').style, { display: '', transform: `translateX(${(1 - pin) * -700 + pout * -60}px)`, opacity: String(1 - pout) });
      }
    }
    if (!chipOn) $('tChip').style.display = 'none';
    // Block cleared
    const ct = t - S0.flex - 0.4;
    show('tCleared', ct > 0 && t < S0.card, { opacity: String(clamp(ct / 0.15, 0, 1) * (1 - seg(t, S0.card - 0.25, S0.card))), transform: `translateY(-50%) translateX(${(1 - backOut(ct / 0.35)) * 500}px)` });
    $('tMeter').querySelectorAll('i').forEach((m, i) => m.classList.toggle('tr-on', i < Math.min(5, Math.floor(clamp(ct - 0.4, 0, 9) * 9))));
    // Share card
    const kt = t - S0.card;
    const cardOn = kt > 0.15 && t < S0.end;
    show('tCardHead', cardOn, { opacity: String(clamp((kt - 0.15) / 0.2, 0, 1) * (1 - seg(t, S0.end - 0.25, S0.end))), transform: `translateY(${(1 - easeOut((kt - 0.15) / 0.4)) * -40}px)` });
    const cp = backOut((kt - 0.3) / 0.6);
    show('tCard', cardOn && kt > 0.3, { opacity: String(clamp((kt - 0.3) / 0.2, 0, 1) * (1 - seg(t, S0.end - 0.25, S0.end))), transform: `translate(-50%, -50%) perspective(1600px) translateY(${(1 - cp) * 500}px) rotateX(${(1 - cp) * 35 + Math.sin(kt * 1.4) * 2}deg) rotateY(${Math.sin(kt * 0.9) * 6 - 3}deg) rotateZ(${(1 - cp) * -6}deg)` });
    // End card
    const et = t - S0.end - 0.2;
    show('tEnd', et > 0, { opacity: String(clamp(et / 0.4, 0, 1)) });
    if (et > 0) $('tEnd').querySelectorAll(':scope > *').forEach((el, i) => { const p = easeOut((et - i * 0.12) / 0.5); el.style.transform = `translateX(${(1 - p) * -80}px)`; el.style.opacity = String(clamp((et - i * 0.12) / 0.3, 0, 1)); });
    // Flash on the landing and fades at both ends
    const ft = t - (S0.land + 0.9);
    $('tFlash').style.opacity = String(ft > 0 ? Math.max(0, 0.9 - ft * 3.5) : 0);
    $('tBlack').style.opacity = String(Math.max(1 - seg(t, 0, 0.8), seg(t, DURATION - 0.7, DURATION)));
  }

  /* ---------- Frame driver ---------- */
  let current = null;
  function syncCss(t) {
    for (const a of document.getAnimations()) { if (a._ft === undefined) { a._ft = t; a.pause(); } a.currentTime = Math.max(0, (t - a._ft) * 1000); }
    document.querySelectorAll('.pow').forEach((el) => { if (el._ft === undefined) el._ft = t; if (t - el._ft > 0.78) el.remove(); });
  }
  window.filmFrame = async (t, draw = true) => {
    const s = shots.find((x) => t >= x.start - 1e-6 && t < x.start + x.dur - 1e-6) || shots[shots.length - 1];
    if (current !== s) { current = s; s.lt = 0; recording = false; await s.setup(); recording = true; }
    const lt = t - s.start;
    T = t;
    s.frame(lt);
    golem.inv = 999;
    F.step(DT, draw);
    syncCss(t);
    if (draw) overlay(t);
  };
  window.TRAILER = { DURATION, FPS, shots: shots.map((s) => ({ name: s.name, start: s.start, dur: s.dur })), SFX };
  window.READY = document.fonts.ready.then(() => true);
})();
