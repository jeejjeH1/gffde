// Startale × JPYSC — "Can stablecoins transform cross-border payments?"
// 16:9 motion graphic. Everything is a pure function of time: render(t).
// Three.js draws the 3D layer (holographic materials, bubbles, globe), a 2D canvas
// composites it with typography, glass cards and effects.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const W = 1920, H = 1080, DURATION = 69;
window.DURATION = DURATION;
let resolveReady; window.READY = new Promise(r => (resolveReady = r));

// ---------------------------------------------------------------- math
const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const eo3 = p => 1 - (1 - p) ** 3;
const eo4 = p => 1 - (1 - p) ** 4;
const ei2 = p => p * p;
const ei3 = p => p ** 3;
const eio3 = p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
const eoExpo = p => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
const eoBack = (p, s = 1.70158) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;
const env = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(eo3(seg(t, a, a + fi)), 1 - ei2(seg(t, b - fo, b)));
const hit = (t, t0, k = 6) => (t < t0 ? 0 : Math.exp(-(t - t0) * k));
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- palette
const INK = '#1a1638', MUTED = '#5f5a7d', SOFT = '#8b86a6';
const HG = ['#f04fa8', '#9b5cf6', '#3b82f6', '#13b5a5'];

// ---------------------------------------------------------------- three setup
const out = document.getElementById('c');
const ctx = out.getContext('2d');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0xf4f2f8, 1);
const glc = renderer.domElement;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 120);
const U = { time: { value: 0 }, sweep: { value: -99 } };
const all = [];
function add(o, parent = scene) { parent.add(o); all.push(o); return o; }

const PAL = /* glsl */ `
vec3 holo(float t){
  vec3 c0=vec3(0.96,0.63,0.87), c1=vec3(0.73,0.67,0.99), c2=vec3(0.56,0.81,0.99), c3=vec3(0.57,0.94,0.80), c4=vec3(0.99,0.93,0.68);
  t=fract(t)*5.0; float f=fract(t); f=f*f*(3.0-2.0*f); float i=floor(t);
  vec3 a=c0,b=c1;
  if(i>3.5){a=c4;b=c0;} else if(i>2.5){a=c3;b=c4;} else if(i>1.5){a=c2;b=c3;} else if(i>0.5){a=c1;b=c2;}
  return mix(a,b,f);
}`;

const HOLO_V = /* glsl */ `
varying vec3 vN; varying vec3 vP; varying vec3 vV; varying vec2 vUv; varying vec3 vL;
#ifdef ISAT
attribute float aSat; varying float vSat;
#endif
void main(){
  vec4 p=vec4(position,1.0); vec3 n=normal;
  #ifdef USE_INSTANCING
  p=instanceMatrix*p; n=mat3(instanceMatrix)*n;
  #endif
  #ifdef ISAT
  vSat=aSat;
  #endif
  vec4 wp=modelMatrix*p;
  vP=wp.xyz; vN=normalize(mat3(modelMatrix)*n); vV=cameraPosition-wp.xyz; vUv=uv; vL=position;
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const HOLO_F = /* glsl */ `
uniform float uTime, uSweep, uAlpha, uSat, uShift, uGlow, uUseMap, uLk;
uniform sampler2D uMap;
varying vec3 vN; varying vec3 vP; varying vec3 vV; varying vec2 vUv; varying vec3 vL;
#ifdef ISAT
varying float vSat;
#endif
${PAL}
void main(){
  vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N;
  vec3 V=normalize(vV);
  float ndv=clamp(dot(N,V),0.0,1.0);
  float fr=pow(1.0-ndv,2.0);
  vec3 R=reflect(-V,N);
  float t=R.y*0.32+R.x*0.24+N.z*0.08+fr*0.5+dot(vL,vec3(0.5,0.42,0.3))*uLk+uShift+uTime*0.035;
  vec3 col=mix(holo(t),holo(t*1.6+0.37),0.28);
  vec3 L1=normalize(vec3(-0.5,0.85,0.75));
  float dif=clamp(dot(N,L1),0.0,1.0);
  col*=0.74+0.32*dif;
  col*=0.93+0.07*N.y;
  vec3 H1=normalize(L1+V);
  float nh=clamp(dot(N,H1),0.0,1.0);
  col+=pow(nh,90.0)*0.85+pow(nh,10.0)*0.10;
  vec3 L2=normalize(vec3(0.85,-0.25,0.45));
  col+=pow(clamp(dot(N,normalize(L2+V)),0.0,1.0),36.0)*0.30*vec3(0.85,0.95,1.0);
  col=mix(col,vec3(1.0),fr*0.34);
  if(uUseMap>0.5){
    float m=texture2D(uMap,vUv).a;
    float m2=texture2D(uMap,vUv+vec2(-0.004,0.004)).a;
    col=mix(col,col*vec3(0.70,0.66,0.92)+vec3(0.02,0.0,0.08),m*0.9);
    col+=clamp(m2-m,0.0,1.0)*0.55;
    col-=clamp(m-m2,0.0,1.0)*0.18;
  }
  float sw=uSweep-(vP.x*0.8+vP.y*0.6);
  col+=smoothstep(0.35,0.0,abs(sw))*0.55;
  float sat=uSat;
  #ifdef ISAT
  sat*=vSat;
  #endif
  float g=dot(col,vec3(0.299,0.587,0.114));
  col=mix(vec3(g)*vec3(0.97,0.97,1.02),col,sat);
  col+=uGlow;
  gl_FragColor=vec4(col,uAlpha);
}`;

function holoMat(o = {}) {
  const pre = o.isat ? '#define ISAT\n' : '';
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.time, uSweep: U.sweep, uAlpha: { value: 1 }, uSat: { value: 1 }, uShift: { value: o.shift || 0 },
      uGlow: { value: 0 }, uLk: { value: o.lk ?? 0.8 }, uMap: { value: o.map || null }, uUseMap: { value: o.map ? 1 : 0 },
    },
    vertexShader: pre + HOLO_V, fragmentShader: pre + HOLO_F, transparent: true,
  });
}

const BUBBLE_F = /* glsl */ `
uniform float uAlpha, uTime, uShift;
varying vec3 vN; varying vec3 vP; varying vec3 vV; varying vec2 vUv;
void main(){
  vec3 N=normalize(vN), V=normalize(vV);
  float ndv=clamp(dot(N,V),0.0,1.0);
  float fr=pow(1.0-ndv,1.7);
  float t=fr*1.4+N.y*0.35+N.x*0.2+uShift+uTime*0.05;
  vec3 film=0.5+0.5*cos(6.2831*(t+vec3(0.0,0.33,0.67)));
  film=mix(vec3(0.93,0.62,0.95),film,0.55);
  film=mix(film,vec3(0.72,0.66,1.0),0.25);
  vec3 L=normalize(vec3(-0.55,0.7,0.8));
  float sp=pow(clamp(dot(N,normalize(L+V)),0.0,1.0),140.0);
  float sp2=pow(clamp(dot(N,normalize(vec3(0.55,-0.6,0.6)+V)),0.0,1.0),8.0)*0.25;
  vec3 col=mix(film,vec3(1.0),clamp(sp*1.4+sp2,0.0,1.0));
  float a=(0.05+fr*0.72)*uAlpha+sp*uAlpha+sp2*0.6*uAlpha;
  gl_FragColor=vec4(col,clamp(a,0.0,1.0));
}`;
function bubbleMat(shift) {
  return new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 1 }, uTime: U.time, uShift: { value: shift } },
    vertexShader: HOLO_V, fragmentShader: BUBBLE_F, transparent: true, depthWrite: false,
  });
}

// background: flowing pastel mesh gradient + halftone dot clusters
const BG_F = /* glsl */ `
uniform float uTime, uSat, uDots, uBright; uniform vec2 uRes;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return v; }
void main(){
  vec2 uv=vUv; vec2 p=uv*vec2(1.7778,1.0);
  float t=uTime*0.045;
  vec2 q=vec2(fbm(p*1.1+vec2(t,0.0)),fbm(p*1.1+vec2(3.1,-t)));
  vec2 r=p+q*0.9;
  vec3 col=vec3(0.957,0.950,0.975);
  float a=smoothstep(0.42,0.78,fbm(r*1.25+vec2(0.0,t)));
  float b=smoothstep(0.42,0.80,fbm(r*1.05+vec2(5.2,-t)));
  float c=smoothstep(0.45,0.80,fbm(r*1.45+vec2(-3.7,t*0.7)));
  float d=smoothstep(0.48,0.82,fbm(r*0.9+vec2(8.1,t*0.5)));
  col=mix(col,vec3(0.975,0.80,0.925),a*0.85);
  col=mix(col,vec3(0.76,0.95,0.87),b*0.75);
  col=mix(col,vec3(0.78,0.90,0.985),c*0.8);
  col=mix(col,vec3(0.87,0.82,0.99),d*0.7);
  float cg=length((uv-vec2(0.5,0.52))*vec2(1.7778,1.0));
  col=mix(col,vec3(0.985,0.982,0.995),smoothstep(0.85,0.0,cg)*0.5);
  vec2 g=gl_FragCoord.xy/24.0; vec2 cell=fract(g)-0.5;
  vec2 cuv=(floor(g)+0.5)*24.0/uRes;
  float m1=smoothstep(0.36,0.0,length((cuv-vec2(0.0,1.0))*vec2(1.7778,1.0)));
  float m2=smoothstep(0.36,0.0,length((cuv-vec2(1.0,0.0))*vec2(1.7778,1.0)));
  float m=max(m1,m2)*uDots;
  col=mix(col,col*vec3(0.95,0.94,0.99),m*0.6);
  float rad=0.40*m;
  col=mix(col,vec3(1.0),smoothstep(rad,rad-0.1,length(cell))*step(0.02,m)*0.9);
  float gr=dot(col,vec3(0.333)); col=mix(vec3(gr),col,uSat);
  col=col*uBright+(1.0-uBright)*0.0;
  gl_FragColor=vec4(col,1.0);
}`;
const bgMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.time, uSat: { value: 1 }, uDots: { value: 1 }, uBright: { value: 1 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0); }',
  fragmentShader: BG_F, depthWrite: false, depthTest: false,
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

// ---------------------------------------------------------------- objects
// logo: 8 rounded cubes on a ring, each turned so a corner points outward
const cubeGeo = new RoundedBoxGeometry(0.6, 0.6, 0.6, 4, 0.07);
const cubes = [];
for (let k = 0; k < 8; k++) {
  const m = add(new THREE.Mesh(cubeGeo, holoMat({ shift: k * 0.07, lk: 1.3 })));
  m.rotation.order = 'XYZ';
  cubes.push(m);
}

// coin
let faceTex;
const coin = add(new THREE.Group());
const coinBody = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 96, 1, true), holoMat({ shift: 0.2 }));
coinBody.rotation.x = PI / 2; coin.add(coinBody);
const rimGeo = new THREE.TorusGeometry(0.95, 0.075, 20, 120);
const rimF = new THREE.Mesh(rimGeo, holoMat({ shift: 0.4 })); rimF.position.z = 0.06; coin.add(rimF);
const rimB = new THREE.Mesh(rimGeo, holoMat({ shift: 0.4 })); rimB.position.z = -0.06; coin.add(rimB);
const faceGeo = new THREE.CircleGeometry(0.95, 96);
const faceF = new THREE.Mesh(faceGeo, holoMat({ shift: 0.1 })); faceF.position.z = 0.07; coin.add(faceF);
const faceB = new THREE.Mesh(faceGeo, holoMat({ shift: 0.1 })); faceB.position.z = -0.07; faceB.rotation.y = PI; coin.add(faceB);
const coinMats = [coinBody, rimF, rimB, faceF, faceB].map(m => m.material);
function coinLook(alpha, sat = 1, glow = 0) { for (const m of coinMats) { m.uniforms.uAlpha.value = alpha; m.uniforms.uSat.value = sat; m.uniforms.uGlow.value = glow; } }

// the four shapes from the theme
const shapes = [
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.34, 96, 1), holoMat({ shift: 0.0 }))),
  add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 0), holoMat({ shift: 0.25 }))),
  add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.45, 96, 1), holoMat({ shift: 0.5 }))),
  add(new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.0, 1.0, 2, 0.035), holoMat({ shift: 0.75 }))),
];
const shapeBase = [[0.95, 0, -0.42], [0.3, 0.5, 0.1], [0.15, 0, -0.62], [0.55, 0.72, 0.1]];

// intermediaries (frosted, low saturation)
const midGeo = new RoundedBoxGeometry(0.72, 0.72, 0.72, 3, 0.1);
const mids = [0, 1, 2, 3].map(i => add(new THREE.Mesh(midGeo, holoMat({ shift: i * 0.2 }))));

// bubbles
const bubbles = [];
{
  const r = rng(42);
  const sphere = new THREE.SphereGeometry(1, 48, 32);
  for (let i = 0; i < 18; i++) {
    const b = add(new THREE.Mesh(sphere, bubbleMat(r())));
    b.userData = { x: (r() * 2 - 1) * 7.5, y0: r() * 12, z: -7 + r() * 9, s: 0.08 + r() ** 2 * 0.42, sp: 0.12 + r() * 0.25, ph: r() * TAU };
    bubbles.push(b);
  }
}

// globe: dotted sphere with a "land" mask, translucent shell, arcs
const globe = add(new THREE.Group());
const GLOBE_R = 2.0;
{
  const N = 2600, pos = new Float32Array(N * 3), land = new Float32Array(N);
  const r = rng(7);
  const ns = (x, y, z) => Math.sin(x * 2.1 + Math.sin(y * 1.7) * 1.3) * Math.cos(y * 2.3 + z * 1.1) + Math.sin(z * 2.7 + x * 0.9) * 0.6;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + 0.5) / N * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    pos.set([x * GLOBE_R, y * GLOBE_R, z * GLOBE_R], i * 3);
    land[i] = clamp((ns(x * 1.6, y * 1.6, z * 1.6) - 0.15) * 2.5) * 0.85 + r() * 0.15;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aLand', new THREE.BufferAttribute(land, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 1 }, uTime: U.time },
    vertexShader: `attribute float aLand; uniform float uAlpha, uTime; varying float vA; varying vec3 vC; ${PAL}
      void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vec3 n=normalize(mat3(modelMatrix)*position);
        float facing=dot(n,normalize(cameraPosition-wp.xyz)); vec4 mv=viewMatrix*wp;
        gl_PointSize=(3.5+aLand*6.5)*(10.0/-mv.z); gl_Position=projectionMatrix*mv;
        vA=(smoothstep(-0.2,0.5,facing)*0.85+0.12)*(0.3+0.7*aLand)*uAlpha;
        vC=mix(holo(position.y*0.18+position.x*0.12+uTime*0.03),vec3(0.36,0.30,0.74),0.55); }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard;
        gl_FragColor=vec4(vC,smoothstep(0.5,0.25,d)*vA); }`,
    transparent: true, depthWrite: false,
  });
  globe.add(new THREE.Points(g, m));
  globe.userData.dots = m;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R * 0.985, 64, 48), bubbleMat(0.3));
  globe.add(shell); globe.userData.shell = shell.material;
}
const dirFromLL = (lat, lon) => new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
const ORIGIN = dirFromLL(0.55, -0.35);
const DESTS = [dirFromLL(0.95, 0.75), dirFromLL(0.05, 0.95), dirFromLL(-0.55, 0.45), dirFromLL(-0.35, -1.15), dirFromLL(0.25, -1.45)];
const ARC_F = /* glsl */ `uniform float uHead, uTail, uAlpha; varying vec2 vUv;
  void main(){ float u=vUv.x; if(u>uHead||u<uTail) discard;
    vec3 a=vec3(0.94,0.31,0.66), b=vec3(0.55,0.36,0.96), c=vec3(0.23,0.51,0.96);
    vec3 col=u<0.5?mix(a,b,u*2.0):mix(b,c,u*2.0-1.0);
    float k=smoothstep(uTail,uTail+0.25,u)*(0.55+0.45*smoothstep(uHead-0.15,uHead,u));
    gl_FragColor=vec4(col+0.15,k*uAlpha); }`;
const arcs = DESTS.map(d => {
  const pts = [];
  const om = ORIGIN.angleTo(d);
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    const v = new THREE.Vector3().copy(ORIGIN).multiplyScalar(Math.sin((1 - u) * om) / Math.sin(om))
      .add(d.clone().multiplyScalar(Math.sin(u * om) / Math.sin(om)));
    pts.push(v.normalize().multiplyScalar(GLOBE_R * (1.01 + 0.32 * Math.sin(PI * u) * om / 1.5)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uHead: { value: 0 }, uTail: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: ARC_F, transparent: true, depthWrite: false,
  });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.034, 8, false), mat);
  globe.add(tube);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), holoMat({ shift: 0.1 }));
  globe.add(head);
  const block = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.2, 2, 0.03), holoMat({ shift: 0.6 }));
  globe.add(block);
  return { curve, mat, tube, head, block, dest: d };
});

// coin stream (instanced) for the "new ways to move money" scene
const STREAM_N = 26;
const stream = add(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 40), holoMat({ isat: true }), STREAM_N));
const streamSat = new Float32Array(STREAM_N);
stream.geometry.setAttribute('aSat', new THREE.InstancedBufferAttribute(streamSat, 1));
stream.frustumCulled = false;

// ---------------------------------------------------------------- 2D assets
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
let raysSprite, bokehSprite, grain = [];
function buildSprites() {
  // rays burst
  raysSprite = makeCanvas(1400, 1400);
  {
    const g = raysSprite.getContext('2d');
    const cg = g.createConicGradient(0, 700, 700);
    for (let i = 0; i <= 48; i++) {
      const c = ['rgba(240,79,168,', 'rgba(155,92,246,', 'rgba(59,130,246,', 'rgba(19,181,165,'][i % 4];
      cg.addColorStop(i / 48, i % 2 ? c + '0.0)' : c + '0.55)');
    }
    g.fillStyle = cg; g.fillRect(0, 0, 1400, 1400);
    g.globalCompositeOperation = 'destination-in';
    const rg = g.createRadialGradient(700, 700, 60, 700, 700, 700);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.15, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 1400, 1400);
  }
  // soft foreground bokeh bubble
  bokehSprite = makeCanvas(420, 420);
  {
    const g = bokehSprite.getContext('2d');
    g.filter = 'blur(10px)';
    const rg = g.createRadialGradient(210, 210, 60, 210, 210, 175);
    rg.addColorStop(0, 'rgba(255,255,255,0.10)'); rg.addColorStop(0.75, 'rgba(225,190,250,0.30)'); rg.addColorStop(0.93, 'rgba(250,180,230,0.65)'); rg.addColorStop(1, 'rgba(190,240,240,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(210, 210, 176, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(150, 145, 42, 24, -0.7, 0, TAU); g.fill();
  }
  for (let k = 0; k < 4; k++) {
    const c = makeCanvas(256, 256), g = c.getContext('2d'), id = g.createImageData(256, 256), r = rng(100 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); grain.push(ctx.createPattern(c, 'repeat'));
  }
  // coin face emboss mask
  const fc = makeCanvas(1024, 1024), g = fc.getContext('2d');
  g.translate(512, 512);
  g.strokeStyle = '#000'; g.fillStyle = '#000';
  g.lineWidth = 16; g.beginPath(); g.arc(0, 0, 400, 0, TAU); g.stroke();
  for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; g.beginPath(); g.arc(Math.cos(a) * 455, Math.sin(a) * 455, 9, 0, TAU); g.fill(); }
  g.font = '700 470px Unbounded'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('¥', 0, 20);
  g.font = '600 50px Unbounded'; g.letterSpacing = '14px';
  g.fillText('JPYSC', 8, 290);
  faceTex = new THREE.CanvasTexture(fc);
  faceTex.anisotropy = 4;
  for (const m of [faceF, faceB]) { m.material.uniforms.uMap.value = faceTex; m.material.uniforms.uUseMap.value = 1; }
}

// ---------------------------------------------------------------- 2D helpers
let NOW = 0;
const FONT = (k, s, w) => (k === 'U' ? `${w || 700} ${s}px Unbounded` : k === 'M' ? `${w || 500} ${s}px JBMono` : `${w || 600} ${s}px InterD`);
function holoGrad(x0, y0, x1, y1, sh = NOW * 0.12) {
  const w = Math.max(1, x1 - x0), off = ((sh % 1) + 1) % 1;
  const xa = x0 - off * w, g = ctx.createLinearGradient(xa, y0, xa + 2 * w, y1);
  for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, HG[i % 4]);
  return g;
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// animated line of text; words (or chars) rise in with blur, leave upward.
function say(str, x, y, o) {
  const T = NOW;
  if (T < o.t0 - 0.01) return null;
  if (o.t1 != null && T > o.t1 + 1.5) return null;
  ctx.save();
  ctx.font = FONT(o.k, o.s, o.w); ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.textBaseline = 'alphabetic';
  const units = o.chars ? [...str] : str.split(' ');
  const sp = o.chars ? 0 : ctx.measureText(' ').width;
  const ws = units.map(u => ctx.measureText(u).width);
  const total = ws.reduce((a, b) => a + b, 0) + sp * (units.length - 1);
  const x0 = o.al === 'center' ? x - total / 2 : o.al === 'right' ? x - total : x;
  const fill = o.grad ? holoGrad(x0, y - o.s, x0 + total, y) : o.c || INK;
  const st = o.st ?? (o.chars ? 0.035 : 0.075);
  let cx = x0;
  units.forEach((u, i) => {
    const d = o.t0 + i * st;
    const pin = eo4(seg(T, d, d + (o.dur || 0.8)));
    const pout = o.t1 == null ? 0 : ei3(seg(T, o.t1 + i * 0.02, o.t1 + i * 0.02 + 0.42));
    const a = pin * (1 - pout) * (o.a ?? 1);
    if (a > 0.003) {
      const dy = (1 - pin) * o.s * (o.rise ?? 0.6) - pout * o.s * 0.5;
      const bl = (1 - pin) * 10 + pout * 8;
      ctx.globalAlpha = a; ctx.filter = bl > 0.4 ? `blur(${bl.toFixed(1)}px)` : 'none';
      ctx.fillStyle = fill;
      if (o.chars && (o.pop ?? true)) {
        const sc = lerp(1.35, 1, pin);
        ctx.save(); ctx.translate(cx + ws[i] / 2, y + dy); ctx.scale(sc, sc); ctx.fillText(u, -ws[i] / 2, 0); ctx.restore();
      } else ctx.fillText(u, cx, y + dy);
    }
    cx += ws[i] + sp;
  });
  ctx.restore();
  return { x0, x1: x0 + total, w: total };
}

function glass(x, y, w, h, r, a = 1, tint = null) {
  if (a <= 0.003) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(95,70,180,0.16)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 16;
  rr(x, y, w, h, r); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); rr(x, y, w, h, r); ctx.clip();
  const sx = clamp(x - 40, 0, W), sy = clamp(y - 40, 0, H), sw = clamp(x + w + 40, 0, W) - sx, sh = clamp(y + h + 40, 0, H) - sy;
  if (sw > 2 && sh > 2) { ctx.filter = 'blur(18px)'; ctx.drawImage(glc, sx, sy, sw, sh, sx, sy, sw, sh); ctx.filter = 'none'; }
  ctx.fillStyle = 'rgba(255,255,255,0.52)'; ctx.fillRect(x, y, w, h);
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(x, y, w, h); }
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.65)'); g.addColorStop(0.45, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0.18)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, 'rgba(255,255,255,0.95)'); bg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); bg.addColorStop(1, 'rgba(255,255,255,0.8)');
  rr(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r); ctx.lineWidth = 1.5; ctx.strokeStyle = bg; ctx.stroke();
  ctx.restore();
}

// glass pill with optional icon; anim p 0..1
function pillMetrics(label, o = {}) {
  const hgt = o.h || 66, fs = o.fs || 28;
  ctx.save(); ctx.font = FONT(o.k || 'I', fs, o.w || 600); ctx.letterSpacing = (o.ls || 0) + 'px';
  const tw = ctx.measureText(label).width; ctx.restore();
  const L = hgt * 0.38, iw = o.icon ? hgt * 0.42 : 0, gap = o.icon ? hgt * 0.2 : 0;
  return { w: L + iw + gap + tw + hgt * 0.42, L, iw, gap, hgt, fs };
}
function pill(cx, cy, label, o = {}) {
  const p = o.p ?? 1; if (p <= 0.003) return 0;
  const M = pillMetrics(label, o);
  const x = o.al === 'left' ? cx : cx - M.w / 2, yy = cy + (1 - p) * 26;
  const sc = lerp(0.82, 1, eoBack(p, 2));
  const pw = M.w * sc, ph = M.hgt * sc, px = x + (M.w - pw) / 2, py = yy - ph / 2;
  const a = clamp(p * 1.4) * (o.a ?? 1);
  glass(px, py, pw, ph, ph / 2, a, o.tint);
  ctx.save(); ctx.globalAlpha = a;
  if (o.icon) o.icon(px + (M.L + M.iw / 2) * sc, yy, M.iw * 0.62 * sc, o.ic || HG[1]);
  ctx.font = FONT(o.k || 'I', M.fs * sc, o.w || 600); ctx.letterSpacing = (o.ls || 0) + 'px';
  ctx.fillStyle = o.c || INK; ctx.textBaseline = 'middle';
  ctx.fillText(label, px + (M.L + M.iw + M.gap) * sc, yy + 1);
  ctx.restore();
  return M.w;
}

// ---- icons (line style)
function icStroke(c, lw) { ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
const icons = {
  fee(x, y, s, c) { icStroke(c, s * 0.14); ctx.beginPath(); ctx.arc(x, y, s * 0.78, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y); ctx.lineTo(x + s * 0.36, y); ctx.stroke(); },
  nodes(x, y, s, c) {
    icStroke(c, s * 0.12); const p = [[-0.62, 0.38], [0, -0.5], [0.62, 0.38]];
    ctx.beginPath(); ctx.moveTo(x + p[0][0] * s, y + p[0][1] * s); ctx.lineTo(x + p[1][0] * s, y + p[1][1] * s); ctx.lineTo(x + p[2][0] * s, y + p[2][1] * s); ctx.closePath(); ctx.stroke();
    for (const q of p) { ctx.beginPath(); ctx.arc(x + q[0] * s, y + q[1] * s, s * 0.22, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); }
  },
  clock(x, y, s, c, a = NOW * 3) {
    icStroke(c, s * 0.14); ctx.beginPath(); ctx.arc(x, y, s * 0.78, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * s * 0.5, y - Math.cos(a) * s * 0.5); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a / 12) * s * 0.32, y - Math.cos(a / 12) * s * 0.32); ctx.stroke();
  },
  check(x, y, s, c) { icStroke(c, s * 0.16); ctx.beginPath(); ctx.arc(x, y, s * 0.8, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.08, y + s * 0.3); ctx.lineTo(x + s * 0.4, y - s * 0.28); ctx.stroke(); },
  shield(x, y, s, c) { icStroke(c, s * 0.13); ctx.beginPath(); ctx.moveTo(x, y - s * 0.8); ctx.lineTo(x + s * 0.65, y - s * 0.5); ctx.quadraticCurveTo(x + s * 0.62, y + s * 0.5, x, y + s * 0.85); ctx.quadraticCurveTo(x - s * 0.62, y + s * 0.5, x - s * 0.65, y - s * 0.5); ctx.closePath(); ctx.stroke(); },
  drop(x, y, s, c) { icStroke(c, s * 0.13); ctx.beginPath(); ctx.moveTo(x, y - s * 0.85); ctx.bezierCurveTo(x + s * 0.4, y - s * 0.3, x + s * 0.65, y + 0.05 * s, x + s * 0.6, y + s * 0.3); ctx.arc(x, y + s * 0.28, s * 0.6, 0.05, PI - 0.05); ctx.bezierCurveTo(x - s * 0.65, y + 0.05 * s, x - s * 0.4, y - s * 0.3, x, y - s * 0.85); ctx.stroke(); },
  users(x, y, s, c) {
    icStroke(c, s * 0.13);
    ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 0.3, s * 0.28, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - s * 0.25, y + s * 0.75, s * 0.55, PI * 1.15, PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + s * 0.42, y - s * 0.18, s * 0.22, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + s * 0.45, y + s * 0.72, s * 0.42, PI * 1.2, PI * 1.8); ctx.stroke();
  },
  person(x, y, s, c) { icStroke(c, s * 0.13); ctx.beginPath(); ctx.arc(x, y - s * 0.3, s * 0.32, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y + s * 0.85, s * 0.66, PI * 1.12, PI * 1.88); ctx.stroke(); },
};

function logo2D(cx, cy, size, fill, a = 1, rot = 0) {
  const R = size / 2 / 1.403, s = 0.6 * R;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = fill;
  for (let k = 0; k < 8; k++) {
    const th = k * PI / 4 + rot;
    ctx.save(); ctx.translate(cx + Math.cos(th) * R, cy - Math.sin(th) * R); ctx.rotate(-(th + PI / 4));
    ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.08); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function shock(x, y, t0, scale = 1) {
  const p = seg(NOW, t0, t0 + 1.1); if (p <= 0 || p >= 1) return;
  for (const [d, k] of [[0, 1], [0.12, 0.6]]) {
    const q = seg(NOW, t0 + d, t0 + d + 1.0); if (q <= 0 || q >= 1) continue;
    const r = (60 + eo3(q) * 820) * scale;
    const cg = ctx.createConicGradient(NOW, x, y);
    HG.concat(HG[0]).forEach((c, i) => cg.addColorStop(i / 4, c));
    ctx.save(); ctx.globalAlpha = (1 - q) ** 1.5 * 0.75 * k; ctx.strokeStyle = cg; ctx.lineWidth = 22 * (1 - q) * scale + 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
  }
}
function rays(x, y, t0, dur = 2.2, scale = 1) {
  const p = seg(NOW, t0, t0 + dur); if (p <= 0 || p >= 1) return;
  const a = Math.min(eo3(seg(NOW, t0, t0 + 0.12)), (1 - p) ** 2) * 0.5;
  const s = (0.6 + eo3(p) * 0.9) * scale;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(NOW * 0.25); ctx.scale(s, s);
  ctx.drawImage(raysSprite, -700, -700); ctx.restore();
}
function flash(a, c = '255,255,255') { if (a <= 0.003) return; ctx.save(); ctx.fillStyle = `rgba(${c},${clamp(a)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
const tmp = makeCanvas(W, H), tctx = tmp.getContext('2d');
function zoomBlur(amount, cx = W / 2, cy = H / 2) {
  if (amount <= 0.002) return;
  tctx.clearRect(0, 0, W, H); tctx.drawImage(out, 0, 0);
  ctx.save();
  for (let i = 1; i <= 6; i++) {
    const s = 1 + amount * i / 6;
    ctx.globalAlpha = 0.32; ctx.setTransform(s, 0, 0, s, cx * (1 - s), cy * (1 - s)); ctx.drawImage(tmp, 0, 0);
  }
  ctx.restore();
}

const _v = new THREE.Vector3();
function scr(v) { _v.copy(v).project(camera); return [(_v.x * 0.5 + 0.5) * W, (0.5 - _v.y * 0.5) * H]; }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- timeline
// scene boundaries (seconds)
const S = { intro: 0, q: 5.5, prob: 10.5, enter: 19, jpysc: 24, bridge: 28.8, globe: 33.5, ben: 40.5, chal: 50.5, shift: 55, outro: 60.5, lock: 64.4 };
const IMPACT1 = 2.6, IMPACT2 = 20.2, IMPACT3 = 65.6;
const HOP0 = 11.6, HOP = 1.25, HOPT = 0.45;
const BEN0 = 41.0, BEN_D = 1.55;
const ARC0 = 34.6, ARC_D = 0.62;

// ---------------------------------------------------------------- cube choreography
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const AX = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) };
function quat(list) { // world-first list of [axis, angle] or ['e', x, y, z]
  const q = new THREE.Quaternion();
  for (const it of list) {
    if (it[0] === 'e') { _e.set(it[1], it[2], it[3]); _q.setFromEuler(_e); }
    else _q.setFromAxisAngle(AX[it[0]], it[1]);
    q.multiply(_q);
  }
  return q;
}
// ring layout: center, scale, ring orientation list
function ringState(k, c, s, ori, extra = []) {
  const th = k * PI / 4, qr = quat(ori);
  const pos = V3(Math.cos(th), Math.sin(th), 0).applyQuaternion(qr).multiplyScalar(s).add(c);
  const q = qr.clone().multiply(quat([['z', th + PI / 4], ...extra]));
  return { pos, q, s, a: 1 };
}
const scatterR = rng(9);
const START1 = [...Array(8)].map((_, k) => ({ a: k * PI / 4 + 1.6 + scatterR() * 0.9, r: 3.2 + scatterR() * 2.2, z: -3 + scatterR() * 5.5, e: [scatterR() * 6 - 3, scatterR() * 6 - 3, scatterR() * 6 - 3] }));
const SCATTER = [[-5.3, 2.35, -1.2], [5.1, 2.25, -2], [-4.7, -2.3, 0.4], [4.9, -2.1, -0.4], [-1.9, 3.0, -3.4], [2.3, -3.0, -2.5], [-6.6, 0.1, -3.2], [6.5, 0.35, -3.4]];

function cubeState(k, T) {
  const th = k * PI / 4, R = START1[k];
  // intro assembly
  if (T < 5.25) {
    const c = V3(0, 0.45, 0);
    const p = eio3(seg(T, 0.15 + k * 0.07, IMPACT1));
    const punch = 1 + 0.09 * Math.sin(seg(T, IMPACT1, IMPACT1 + 0.45) * PI);
    const spin = eio3(seg(T, 2.8, 4.4)) * TAU;
    const wave = seg(T, 4.2, 4.6) * 0.32 * Math.sin(T * 3.2 - k * PI / 4);
    if (p >= 1) return ringState(k, c, punch, [['y', spin], ['x', Math.sin(T * 0.9) * 0.08]], [['x', wave]]);
    const a = lerp(R.a, th, p), r = lerp(R.r, 1, p), z = lerp(R.z, 0, p);
    const tumble = R.e.map(v => (v + T * 0.6) * (1 - p));
    return { pos: V3(Math.cos(a) * r, Math.sin(a) * r + 0.45 * p, z), q: quat([['z', th + PI / 4], ['e', ...tumble]]), s: eoBack(seg(T, 0.05 + k * 0.06, 0.75 + k * 0.06), 1.8), a: 1 };
  }
  // fly-through
  if (T < 6.2) {
    const p = ei3(seg(T, 5.25, 6.15));
    const st = ringState(k, V3(0, 0.45 * (1 - p), p * 10.8), 1 + p * 0.3, [['y', Math.sin(T * 0.9) * 0.05], ['z', p * 1.4]]);
    st.a = T > 6.12 ? 0 : 1; return st;
  }
  if (T < 19.1) return null;
  // Startale enters: from behind the camera into the ring
  if (T < 23.6) {
    const c = V3(0, 0.85, 0), sc = 0.85;
    const p = eio3(seg(T, 19.15 + k * 0.05, IMPACT2));
    const rz = (T - IMPACT2) * 0.35;
    const flip = eio3(seg(T, 21.7 + k * 0.08, 22.25 + k * 0.08)) * PI / 2;
    const punch = 1 + 0.1 * Math.sin(seg(T, IMPACT2, IMPACT2 + 0.45) * PI);
    if (p >= 1) return ringState(k, c, sc * punch, [['z', rz], ['x', Math.sin(T * 0.7) * 0.1]], [['x', flip]]);
    const a = lerp(th - 2.4, th, p) + rz * p, r = lerp(3.4, 1, p) * sc;
    return { pos: V3(Math.cos(a) * r, Math.sin(a) * r + 0.85 * p, lerp(13.5, 0, p)), q: quat([['z', a + PI / 4], ['e', (1 - p) * 4, (1 - p) * 3, 0]]), s: sc, a: 1 };
  }
  // orbit around the JPYSC coin
  if (T < 33.6) {
    const cc = coinCenter(T);
    const shrink = eio3(seg(T, S.bridge - 0.2, S.bridge + 0.6));
    const ro = lerp(2.15, 1.65, shrink), so = lerp(0.46, 0.34, shrink);
    const a = th + (T - 24) * 0.55;
    const orb = { pos: V3(cc.x + Math.cos(a) * ro, cc.y + Math.sin(a) * ro * 0.3, Math.sin(a) * ro * 0.9), q: quat([['e', T * 1.1 + k, T * 0.8 + k * 2, k]]), s: so, a: 1 };
    const out = ei3(seg(T, 32.95, 33.5));
    orb.s *= 1 - out; orb.pos.y += out * 1.5;
    const b = eio3(seg(T, 23.55 + k * 0.03, 24.75 + k * 0.03));
    if (b >= 1) return orb;
    return mixState(cubeState(k, 23.59), orb, b);
  }
  if (T < 54.9) return null;
  // portal ring in "new ways to move money"
  const portal = (t) => ringState(k, V3(2.9, -0.1, 0), 1.18, [['y', -0.5], ['z', t * 0.4]]);
  if (T < 60.3) {
    const p = eio3(seg(T, 54.95 + k * 0.05, 56.1));
    if (p >= 1) return portal(T);
    const st = { pos: V3(9 + R.r * 0.5, Math.sin(R.a) * 4, -4 + R.z), q: quat([['e', ...R.e]]), s: 1.18, a: 1 };
    return mixState(st, portal(T), p);
  }
  // scatter around the closing question, then converge into the logo
  const sp = SCATTER[k];
  const sc = { pos: V3(sp[0] + Math.sin(T * 0.5 + k) * 0.18, sp[1] + Math.cos(T * 0.43 + k * 2) * 0.16, sp[2]), q: quat([['e', T * 0.5 + k, T * 0.37 + k * 1.3, k * 0.7]]), s: 0.85, a: 1 };
  if (T < S.lock) return mixState(portal(T), sc, eio3(seg(T, 60.2 + k * 0.04, 61.4 + k * 0.04)));
  const c = V3(0, 0.45, 0);
  const spin = eio3(seg(T, 65.8, 67.5)) * TAU;
  const punch = 1 + 0.09 * Math.sin(seg(T, IMPACT3, IMPACT3 + 0.45) * PI);
  const fin = ringState(k, c, punch, [['y', spin], ['x', Math.sin(T * 0.9) * 0.08]]);
  const p = eio3(seg(T, S.lock + k * 0.05, IMPACT3));
  if (p >= 1) return fin;
  return mixState(sc, fin, p);
}
function mixState(a, b, p) {
  if (!a) return b; if (!b) return a;
  return { pos: a.pos.clone().lerp(b.pos, p), q: a.q.clone().slerp(b.q, p), s: lerp(a.s, b.s, p), a: lerp(a.a, b.a, p) };
}
function coinCenter(T) {
  const p = eio3(seg(T, S.bridge - 0.2, S.bridge + 0.7));
  return V3(lerp(2.75, 0, p), lerp(0.1, -0.15, p), 0);
}

// ---------------------------------------------------------------- per-frame 3D
function set3D(T) {
  for (const o of all) o.visible = false;
  U.time.value = T;
  // camera drift + shake
  const sh = hit(T, IMPACT1, 7) + hit(T, IMPACT2, 7) + hit(T, IMPACT3, 7);
  camera.position.set(Math.sin(T * 0.21) * 0.12 + Math.sin(T * 47) * sh * 0.05, Math.cos(T * 0.17) * 0.08 + Math.cos(T * 53) * sh * 0.05, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  // background mood
  const dull = env(T, S.chal + 0.2, S.shift + 0.2, 0.9, 0.8);
  bgMat.uniforms.uSat.value = 1 - dull * 0.55;
  bgMat.uniforms.uDots.value = 0.6 + 0.4 * Math.sin(T * 0.3) ** 2;
  bgMat.uniforms.uBright.value = 1;

  // light sweep across holographic surfaces
  const sweeps = [[IMPACT1 + 0.1, 1.1], [IMPACT2 + 0.1, 1.1], [S.jpysc + 1.0, 1.4], [BEN0 + 4 * BEN_D + 0.5, 1.6], [IMPACT3 + 0.15, 1.1]];
  U.sweep.value = -99;
  for (const [t0, d] of sweeps) if (T > t0 && T < t0 + d) U.sweep.value = lerp(-9, 9, (T - t0) / d);

  // bubbles
  for (const b of bubbles) {
    const u = b.userData; b.visible = true;
    const y = ((u.y0 + T * u.sp) % 12) - 6;
    b.position.set(u.x + Math.sin(T * 0.4 + u.ph) * 0.3, y, u.z);
    b.scale.setScalar(u.s * (1 + Math.sin(T * 1.3 + u.ph) * 0.03));
    b.material.uniforms.uAlpha.value = clamp((6 - Math.abs(y)) / 1.5) * (1 - dull * 0.5);
  }

  // logo cubes
  for (let k = 0; k < 8; k++) {
    const st = cubeState(k, T), c = cubes[k];
    if (!st || st.a <= 0.002 || st.s <= 0.002) continue;
    c.visible = true; c.position.copy(st.pos); c.quaternion.copy(st.q); c.scale.setScalar(st.s);
    c.material.uniforms.uAlpha.value = st.a;
    c.material.uniforms.uGlow.value = 0.25 * (hit(T, IMPACT1, 5) + hit(T, IMPACT2, 5) + hit(T, IMPACT3, 5));
  }

  // coin
  coin.rotation.set(0, 0, 0);
  if (T > HOP0 - 0.4 && T < S.enter + 0.4) {
    // S3: travelling through intermediaries, losing value at every hop
    let x, y = -0.78, hops = 0, rotY = 0;
    const nodesX = [-4.7, -2.7, -0.9, 0.9, 2.7, 4.7];
    x = nodesX[0];
    for (let i = 0; i < 5; i++) {
      const t0 = HOP0 + i * HOP, p = eio3(seg(T, t0, t0 + HOPT));
      if (T >= t0) { x = lerp(nodesX[i], nodesX[i + 1], p); y = -0.78 + Math.sin(p * PI) * 0.55; rotY += p * TAU; if (p >= 1) hops = i + 1; }
    }
    const pop = eoBack(seg(T, HOP0 - 0.4, HOP0 - 0.05), 2.2);
    const out = ei3(seg(T, 18.5, 19.0));
    coin.visible = true;
    coin.position.set(x, y, 0.95);
    coin.rotation.set(0.12, rotY + Math.sin(T * 2) * 0.25, 0);
    coin.scale.setScalar((0.42 - hops * 0.03) * pop * (1 - out));
    coinLook(1, 1 - hops * 0.16, 0);
  } else if (T > S.jpysc - 0.3 && T < S.globe + 0.1) {
    const cc = coinCenter(T);
    const pin = eo4(seg(T, S.jpysc - 0.25, S.jpysc + 1.0));
    const out = ei3(seg(T, 32.95, 33.5));
    const sc = lerp(1.38, 1.0, eio3(seg(T, S.bridge - 0.2, S.bridge + 0.7)));
    coin.visible = true;
    coin.position.set(lerp(7.5, cc.x, pin), lerp(1.2, cc.y, pin) + Math.sin(T * 1.1) * 0.06, lerp(-4, 0, pin));
    coin.rotation.set(Math.sin(T * 0.7) * 0.12 + 0.05, (1 - pin) * 3 * TAU + Math.sin(T * 0.9) * 0.42 + out * 6, Math.sin(T * 0.5) * 0.05);
    coin.scale.setScalar(sc * (1 - out));
    coinLook(1, 1, 0.12 * hit(T, S.jpysc + 0.9, 4));
  }

  // shapes
  const benOut = ei3(seg(T, 54.4, 55.0));
  for (let i = 0; i < 4; i++) {
    const m = shapes[i], b = shapeBase[i], u = m.material.uniforms;
    let vis = 0;
    if (T > S.q + 0.3 && T < S.prob + 0.4) {
      // S2: floating at the edges of the frame
      const posQ = [[-5.0, -2.1, -2.5], [5.3, 2.2, -3.2], [5.2, -2.2, -1.5], [-5.4, 2.3, -3.6]][i];
      const pin = eo3(seg(T, S.q + 0.5 + i * 0.15, S.q + 1.8 + i * 0.15)), pout = ei3(seg(T, 9.9, 10.6));
      vis = pin * (1 - pout);
      m.position.set(posQ[0] * lerp(1.4, 1, pin) * lerp(1, 1.4, pout), posQ[1] + Math.sin(T * 0.6 + i) * 0.15, posQ[2]);
      m.rotation.set(b[0] + T * 0.25, b[1] + T * 0.35 + i, b[2]);
      m.scale.setScalar(0.85);
      u.uSat.value = 1;
    } else if (T > BEN0 - 0.2 && T < S.shift) {
      // S7 benefits row, S8 challenges (desaturated, pushed back)
      const t0 = BEN0 + i * BEN_D;
      const pin = seg(T, t0, t0 + 0.9);
      const x = [-4.05, -1.35, 1.35, 4.05][i];
      const hop = Math.sin(seg(T, 47.3 + i * 0.12, 47.9 + i * 0.12) * PI) * 0.25;
      const ch = eio3(seg(T, S.chal - 0.1, S.chal + 1.1));
      vis = clamp(pin * 3) * (1 - benOut) * lerp(1, 0.4, ch);
      m.position.set(x * lerp(1, 1.12, ch), lerp(-2.2, 0.62, eoBack(pin, 1.6)) + Math.sin(T * 0.8 + i) * 0.06 + hop + ch * 1.55, lerp(0, -3.2, ch));
      const spin = (1 - eo4(pin)) * 5;
      m.rotation.set(b[0] + spin + Math.sin(T * 0.5 + i) * 0.15, b[1] + T * 0.3 + spin + hop * 2, b[2]);
      m.scale.setScalar(eoBack(pin, 2) * 1.0);
      u.uSat.value = 1 - ch * 0.85;
      u.uGlow.value = 0.2 * hit(T, t0 + 0.35, 4);
    }
    if (vis > 0.003) { m.visible = true; u.uAlpha.value = vis; }
  }

  // intermediaries
  for (let i = 0; i < 4; i++) {
    const m = mids[i], u = m.material.uniforms;
    if (T < 10.6 || T > 21) continue;
    const pin = eoBack(seg(T, 10.9 + i * 0.12, 11.5 + i * 0.12), 2);
    const ta = HOP0 + i * HOP + HOPT;
    const pulse = hit(T, ta, 5) * (T > ta ? 1 : 0);
    const x = [-2.7, -0.9, 0.9, 2.7][i];
    const ex = eo3(seg(T, 19.55 + i * 0.04, 20.5));
    const r = rng(300 + i); const dir = V3(x * 1.5 + (r() - 0.5) * 2, (r() - 0.5) * 6, 4 + r() * 3);
    m.visible = pin > 0.01 && ex < 0.99;
    m.position.set(x + dir.x * ex, -0.78 + Math.sin(T * 1.2 + i) * 0.04 + dir.y * ex, dir.z * ex);
    m.rotation.set(0.35 + Math.sin(T * 0.6 + i) * 0.1 + ex * 6, 0.6 + T * 0.15 + i + ex * 5, 0.0);
    m.scale.setScalar(pin * (1 + pulse * 0.12));
    u.uSat.value = 0.16 + pulse * 0.5; u.uGlow.value = pulse * 0.12; u.uAlpha.value = 1 - ex;
  }

  // globe
  if (T > S.globe - 0.2 && T < S.ben + 0.5) {
    const pin = eo4(seg(T, S.globe, S.globe + 1.2)), pout = ei3(seg(T, 40.1, 40.75));
    globe.visible = true;
    const gs = lerp(0.6, 1, pin) * (1 - pout * 0.6);
    globe.scale.setScalar(gs);
    globe.position.set(2.55, -0.15 + (1 - pin) * -1, 0);
    globe.rotation.set(0.18, -0.25 + (T - S.globe) * 0.09 + (1 - pin) * 1.2, 0);
    globe.userData.dots.uniforms.uAlpha.value = pin * (1 - pout);
    globe.userData.shell.uniforms.uAlpha.value = 0.22 * pin * (1 - pout);
    arcs.forEach((a, i) => {
      const t0 = ARC0 + i * ARC_D;
      const head = eio3(seg(T, t0, t0 + 1.0)), tail = eio3(seg(T, t0 + 0.75, t0 + 2.2)) * 0.82;
      a.mat.uniforms.uHead.value = head; a.mat.uniforms.uTail.value = tail; a.mat.uniforms.uAlpha.value = 1 - pout;
      a.tube.visible = head > 0.001;
      a.head.visible = head > 0.001 && head < 0.999;
      a.head.position.copy(a.curve.getPointAt(Math.min(head, 1)));
      const bp = eoBack(seg(T, t0 + 0.95, t0 + 1.35), 2.5);
      a.block.visible = bp > 0.01;
      a.block.position.copy(a.dest).multiplyScalar(GLOBE_R * 1.07);
      a.block.rotation.set(T * 1.2 + i, T * 0.8, 0);
      a.block.scale.setScalar(bp * (1 - pout));
    });
  }

  // coin stream through the portal
  if (T > S.shift - 0.2 && T < S.outro + 0.6) {
    stream.visible = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), r = rng(77);
    const fade = env(T, S.shift + 0.6, S.outro + 0.4, 1.0, 0.7);
    for (let i = 0; i < STREAM_N; i++) {
      const ph = r(), sp = 0.09 + r() * 0.03, yo = (r() - 0.5) * 0.5, zo = (r() - 0.5) * 0.6, spin = r() * TAU;
      const u = ((T * sp + ph) % 1);
      const x = lerp(-8, 10, u);
      // path: low on the left, rising into the portal at (2.9,-0.1), leaving to the right
      const y = x < 2.9 ? lerp(-2.6, -0.1, Math.pow(clamp((x + 8) / 10.9), 1.6)) + yo * (1 - clamp((x + 1) / 3.9)) : -0.1 + (x - 2.9) * 0.12 + yo * clamp((x - 2.9) / 4);
      const z = x < 2.9 ? zo * (1 - clamp((x + 1) / 3.9)) : zo * clamp((x - 2.9) / 4);
      const sz = clamp(Math.min((x + 8) / 2, (10 - x) / 2)) * fade;
      q.setFromEuler(_e.set(PI / 2 + Math.sin(T * 2 + spin) * 0.4, T * 2.5 + spin, 0.3));
      m.compose(V3(x, y, z), q, V3(sz, sz, sz));
      stream.setMatrixAt(i, m);
      streamSat[i] = 0.08 + 0.92 * clamp((x - 2.4) / 1.2);
    }
    stream.instanceMatrix.needsUpdate = true;
    stream.geometry.attributes.aSat.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- per-frame 2D
function badge(T) {
  const a = Math.max(env(T, 6.3, 18.8, 0.6, 0.5), env(T, 24.4, 60.2, 0.6, 0.5));
  if (a <= 0.003) return;
  ctx.save(); ctx.globalAlpha = a;
  logo2D(96, 82, 46, holoGrad(70, 60, 122, 104, NOW * 0.2), 1, NOW * 0.15);
  ctx.font = FONT('U', 24, 600); ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.letterSpacing = '1px';
  ctx.fillText('Startale', 136, 84);
  ctx.restore();
}

function draw2D(T) {
  NOW = T;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(glc, 0, 0);

  // ---------- S1 intro
  if (T < 6.4) {
    const [lx, ly] = scr(V3(0, 0.45, 0));
    if (T > IMPACT1) { rays(lx, ly, IMPACT1, 2.4, 1.1); shock(lx, ly, IMPACT1); }
    say('STARTALE', W / 2, 838, { k: 'U', s: 92, w: 700, chars: true, ls: 18, al: 'center', t0: 3.0, t1: 5.15, st: 0.05, grad: false, c: INK });
    say('ONCHAIN FINANCE  ·  STABLECOINS  ·  JPYSC', W / 2, 906, { k: 'M', s: 22, w: 500, ls: 6, al: 'center', t0: 3.65, t1: 5.1, c: MUTED, st: 0.04 });
  }
  // ---------- S2 question
  if (T > 5.7 && T < 11) {
    say('STABLECOINS  ×  PAYMENTS', W / 2, 400, { k: 'M', s: 22, ls: 6, al: 'center', t0: 6.0, t1: 9.95, c: MUTED });
    say('Can stablecoins transform', W / 2, 515, { k: 'U', s: 80, w: 700, al: 'center', t0: 6.1, t1: 10.0 });
    const r = say('cross-border payments?', W / 2, 625, { k: 'U', s: 80, w: 700, al: 'center', t0: 6.5, t1: 10.05, grad: true });
    if (r) {
      const p = eo4(seg(T, 7.3, 8.3)), po = ei3(seg(T, 10.0, 10.4));
      ctx.save(); ctx.globalAlpha = 1 - po; ctx.fillStyle = holoGrad(r.x0, 0, r.x1, 0);
      rr(W / 2 - r.w / 2 * p, 668, r.w * p, 7, 4); ctx.fill(); ctx.restore();
    }
  }
  // ---------- S3 the problem
  if (T > 10.5 && T < 19.5) problem2D(T);
  // ---------- S4 Startale enters
  if (T > 19.0 && T < 24.6) {
    const [lx, ly] = scr(V3(0, 0.85, 0));
    if (T > IMPACT2) { rays(lx, ly, IMPACT2, 2.8, 1.0); shock(lx, ly, IMPACT2, 0.9); }
    say('This is where', W / 2, 772, { k: 'I', s: 40, w: 500, al: 'center', t0: 19.3, t1: 23.45, c: MUTED });
    say('Startale', W / 2, 892, { k: 'U', s: 118, w: 800, al: 'center', chars: true, t0: IMPACT2 + 0.02, t1: 23.5, grad: true, st: 0.04 });
    say('comes into the picture.', W / 2, 965, { k: 'I', s: 40, w: 500, al: 'center', t0: 20.75, t1: 23.55, c: MUTED });
  }
  // ---------- S5 JPYSC
  if (T > 23.9 && T < 34) jpysc2D(T);
  // ---------- S6 globe
  if (T > 33.4 && T < 41) globe2D(T);
  // ---------- S7 benefits
  if (T > 40.3 && T < 51) benefits2D(T);
  // ---------- S8 challenges
  if (T > 50.3 && T < 55.5) challenges2D(T);
  // ---------- S9 shift
  if (T > 54.9 && T < 61) shift2D(T);
  // ---------- S10 outro
  if (T > 60.4) outro2D(T);

  badge(T);
  bokeh(T);
  post(T);
}

function problem2D(T) {
  const tOut = 18.45;
  say('Sending money across borders', W / 2, 168, { k: 'U', s: 54, w: 700, al: 'center', t0: 10.7, t1: tOut });
  say('can still mean…', W / 2, 238, { k: 'I', s: 42, w: 500, al: 'center', t0: 11.05, t1: tOut, c: MUTED });
  // problem pills
  const pills = [['High fees', icons.fee, 12.15], ['Multiple intermediaries', icons.nodes, 13.4], ['Unnecessary delays', icons.clock, 14.65]];
  const ws = pills.map(([l, ic]) => pillMetrics(l, { icon: ic, fs: 30, h: 70 }).w), gap = 26, tot = ws.reduce((a, b) => a + b) + gap * 2;
  let x = W / 2 - tot / 2;
  pills.forEach(([label, ic, t0], i) => {
    const p = eo3(seg(T, t0, t0 + 0.55)) * (1 - ei3(seg(T, tOut + i * 0.05, tOut + 0.4 + i * 0.05)));
    pill(x + ws[i] / 2, 352, label, { p, icon: ic, ic: HG[i], fs: 30, h: 70 });
    x += ws[i] + gap;
  });
  // pipeline
  const fade = 1 - ei3(seg(T, tOut, tOut + 0.5));
  const nodesX = [-4.7, -2.7, -0.9, 0.9, 2.7, 4.7];
  const P = nodesX.map(nx => scr(V3(nx, -0.78, 0)));
  const lineIn = eo3(seg(T, 10.9, 11.9));
  ctx.save(); ctx.globalAlpha = fade * 0.9;
  ctx.setLineDash([3, 12]); ctx.lineCap = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(95,90,125,0.55)';
  for (let i = 0; i < 5; i++) {
    const a = P[i], b = P[i + 1], pad0 = i === 0 ? 60 : 78, pad1 = i === 4 ? 60 : 78;
    const xa = a[0] + pad0, xb = lerp(xa, b[0] - pad1, clamp(lineIn * 5 - i));
    if (xb > xa) { ctx.beginPath(); ctx.moveTo(xa, a[1]); ctx.lineTo(xb, a[1]); ctx.stroke(); }
  }
  ctx.restore();
  const labels = ['BANK', 'CORRESPONDENT', 'FX DESK', 'CLEARING'];
  for (let i = 0; i < 4; i++) {
    const p = eo3(seg(T, 11.1 + i * 0.12, 11.7 + i * 0.12)) * fade;
    ctx.save(); ctx.globalAlpha = p; ctx.font = FONT('M', 18, 500); ctx.letterSpacing = '3px'; ctx.fillStyle = MUTED; ctx.textAlign = 'center';
    ctx.fillText(labels[i], P[i + 1][0], P[i + 1][1] + 110 + (1 - p) * 12); ctx.restore();
    // fee chip
    const ta = HOP0 + i * HOP + HOPT, q = seg(T, ta, ta + 1.7);
    if (q > 0 && q < 1) {
      const a = Math.min(eo3(q * 5), 1 - ei2(seg(q, 0.6, 1)));
      pill(P[i + 1][0], P[i + 1][1] - 112 - eo3(q) * 40, '− FEE', { p: a, k: 'M', fs: 20, h: 44, w: 700, ls: 2, c: '#d6337f', tint: 'rgba(240,79,168,0.08)' });
    }
  }
  // sender / receiver
  [[0, 'SENDER', 10.9], [5, 'RECEIVER', 11.2]].forEach(([n, lab, t0]) => {
    const p = eo3(seg(T, t0, t0 + 0.6)) * fade, [x, y] = P[n];
    glass(x - 52, y - 52, 104, 104, 52, p);
    ctx.save(); ctx.globalAlpha = p; icons.person(x, y + 2, 26, INK);
    ctx.font = FONT('M', 18, 500); ctx.letterSpacing = '3px'; ctx.fillStyle = MUTED; ctx.textAlign = 'center';
    ctx.fillText(lab, x, y + 110); ctx.restore();
  });
  // arrival
  const arr = HOP0 + 4 * HOP + HOPT;
  if (T > arr) {
    const p = eo3(seg(T, arr, arr + 0.5)) * fade;
    pill(P[5][0], P[5][1] - 118, 'Less arrives', { p, k: 'I', fs: 22, h: 46, c: '#d6337f' });
  }
  // settlement timer
  const tp = eo3(seg(T, 11.3, 11.9)) * fade;
  const hrs = Math.floor(72 * eio3(seg(T, HOP0, arr)));
  const val = `T+${Math.floor(hrs / 24)}d ${String(hrs % 24).padStart(2, '0')}h`;
  if (tp > 0.003) {
    const w = 420, h = 74, x = W / 2 - w / 2, y = 950 - h / 2 + (1 - tp) * 20;
    glass(x, y, w, h, h / 2, tp);
    ctx.save(); ctx.globalAlpha = tp; ctx.textBaseline = 'middle';
    icons.clock(x + 44, y + h / 2, 17, HG[1], T * 6);
    ctx.font = FONT('M', 18, 500); ctx.letterSpacing = '3px'; ctx.fillStyle = MUTED; ctx.fillText('SETTLEMENT', x + 76, y + h / 2 + 1);
    ctx.font = FONT('M', 30, 700); ctx.letterSpacing = '1px'; ctx.fillStyle = T > arr ? '#d6337f' : INK; ctx.textAlign = 'right';
    ctx.fillText(val, x + w - 34, y + h / 2 + 1);
    ctx.restore();
  }
}

function jpysc2D(T) {
  const o1 = S.bridge - 0.35;
  say('ONCHAIN FINANCE', 150, 372, { k: 'M', s: 22, ls: 6, t0: 24.35, t1: o1, c: MUTED });
  say('JPYSC', 144, 520, { k: 'U', s: 158, w: 800, chars: true, t0: 24.5, t1: o1, grad: true, st: 0.06 });
  say('A yen-denominated stablecoin', 150, 610, { k: 'I', s: 50, w: 600, t0: 25.05, t1: o1 });
  const p = eo3(seg(T, 25.7, 26.3)) * (1 - ei3(seg(T, o1, o1 + 0.4)));
  if (p > 0.003) {
    ctx.save(); ctx.font = FONT('I', 28, 500);
    const w1 = ctx.measureText('Developed with ').width; ctx.font = FONT('I', 28, 700); const w2 = ctx.measureText('SBI Holdings').width; ctx.restore();
    const w = w1 + w2 + 64 + 48, h = 68, x = 150, y = 668 + (1 - p) * 20;
    glass(x, y, w, h, h / 2, p);
    ctx.save(); ctx.globalAlpha = p; ctx.textBaseline = 'middle';
    ctx.fillStyle = holoGrad(x, y, x + 60, y + 60); ctx.beginPath(); ctx.arc(x + 38, y + h / 2, 9, 0, TAU); ctx.fill();
    ctx.font = FONT('I', 28, 500); ctx.fillStyle = MUTED; ctx.fillText('Developed with ', x + 64, y + h / 2 + 1);
    ctx.font = FONT('I', 28, 700); ctx.fillStyle = INK; ctx.fillText('SBI Holdings', x + 64 + w1, y + h / 2 + 1);
    ctx.restore();
  }
  // bridge part
  if (T < S.bridge) return;
  const tOut = 32.85;
  say('Connecting traditional currencies', W / 2, 160, { k: 'U', s: 52, w: 700, al: 'center', t0: S.bridge + 0.3, t1: tOut });
  say('with the onchain economy', W / 2, 236, { k: 'U', s: 52, w: 700, al: 'center', t0: S.bridge + 0.6, t1: tOut, grad: true });
  say('VIA BLOCKCHAIN INFRASTRUCTURE', W / 2, 1000, { k: 'M', s: 20, ls: 6, al: 'center', t0: S.bridge + 1.6, t1: tOut, c: MUTED });
  const fade = 1 - ei3(seg(T, tOut, tOut + 0.5));
  const pL = eo3(seg(T, S.bridge + 0.7, S.bridge + 1.4)) * fade, pR = eo3(seg(T, S.bridge + 0.9, S.bridge + 1.6)) * fade;
  const cw = 400, ch = 300, cy = 560 - ch / 2;
  const Lx = 130 - (1 - pL) * 60, Rx = W - 130 - cw + (1 - pR) * 60;
  // flows
  const [ccx, ccy] = scr(coinCenter(T));
  const flowIn = eo3(seg(T, S.bridge + 1.2, S.bridge + 2.0)) * fade;
  if (flowIn > 0.003) {
    const paths = [[[Lx + cw + 10, 560], [ccx - 190, ccy]], [[ccx + 190, ccy], [Rx - 10, 560]]];
    paths.forEach(([a, b], j) => {
      ctx.save(); ctx.globalAlpha = flowIn;
      ctx.lineWidth = 3; ctx.setLineDash([2, 10]); ctx.lineCap = 'round';
      ctx.strokeStyle = j === 0 ? 'rgba(95,90,125,0.5)' : holoGrad(a[0], 0, b[0], 0);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.bezierCurveTo(lerp(a[0], b[0], 0.5), a[1], lerp(a[0], b[0], 0.5), b[1], b[0], b[1]); ctx.stroke();
      ctx.setLineDash([]);
      for (let k = 0; k < 6; k++) {
        const u = ((T * 0.55 + k / 6) % 1), mu = 1 - u;
        const xm = lerp(a[0], b[0], 0.5);
        const px = mu ** 3 * a[0] + 3 * mu * mu * u * xm + 3 * mu * u * u * xm + u ** 3 * b[0];
        const py = mu ** 3 * a[1] + 3 * mu * mu * u * a[1] + 3 * mu * u * u * b[1] + u ** 3 * b[1];
        ctx.globalAlpha = flowIn * Math.sin(u * PI);
        ctx.fillStyle = j === 0 ? '#8d88a8' : HG[k % 4];
        ctx.beginPath(); ctx.arc(px, py, j === 0 ? 6 : 7, 0, TAU); ctx.fill();
      }
      ctx.restore();
    });
  }
  // left card: traditional currencies
  glass(Lx, cy, cw, ch, 30, pL);
  glass(Rx, cy, cw, ch, 30, pR);
  ctx.save();
  ctx.globalAlpha = pL; ctx.font = FONT('M', 18, 500); ctx.letterSpacing = '4px'; ctx.fillStyle = MUTED; ctx.fillText('TRADITIONAL', Lx + 34, cy + 52);
  ctx.font = FONT('U', 28, 700); ctx.letterSpacing = '0px'; ctx.fillStyle = INK; ctx.fillText('Currencies', Lx + 34, cy + 96);
  ['¥', '$', '€', '£'].forEach((s, i) => {
    const q = eoBack(seg(T, S.bridge + 1.0 + i * 0.1, S.bridge + 1.5 + i * 0.1), 2) * fade;
    const tx = Lx + 34 + i * 86, ty = cy + 136;
    ctx.save(); ctx.globalAlpha = clamp(q) * pL; ctx.translate(tx + 36, ty + 36 + (i === 0 ? Math.sin(T * 3) * 3 : 0)); ctx.scale(q, q);
    ctx.fillStyle = i === 0 ? 'rgba(155,92,246,0.14)' : 'rgba(95,90,125,0.08)'; rr(-36, -36, 72, 72, 18); ctx.fill();
    ctx.font = FONT('U', 32, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = i === 0 ? HG[1] : MUTED; ctx.fillText(s, 0, 2);
    ctx.restore();
  });
  ctx.globalAlpha = pL; ctx.font = FONT('I', 22, 500); ctx.fillStyle = MUTED; ctx.fillText('Banks · FX · Clearing', Lx + 34, cy + 262);
  // right card: onchain economy
  ctx.globalAlpha = pR; ctx.font = FONT('M', 18, 500); ctx.letterSpacing = '4px'; ctx.fillStyle = MUTED; ctx.fillText('ONCHAIN', Rx + 34, cy + 52);
  ctx.font = FONT('U', 28, 700); ctx.letterSpacing = '0px'; ctx.fillStyle = INK; ctx.fillText('Economy', Rx + 34, cy + 96);
  for (let i = 0; i < 4; i++) {
    const q = eoBack(seg(T, S.bridge + 1.2 + i * 0.12, S.bridge + 1.7 + i * 0.12), 2) * fade;
    const bx = Rx + 34 + i * 86, by = cy + 136;
    if (i < 3) { ctx.save(); ctx.globalAlpha = pR * clamp(q); ctx.strokeStyle = holoGrad(bx, 0, bx + 120, 0); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + 72, by + 36); ctx.lineTo(bx + 86, by + 36); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = pR * clamp(q); ctx.translate(bx + 36, by + 36); ctx.scale(q, q);
    ctx.fillStyle = holoGrad(-36, -36, 36, 36, NOW * 0.2 + i * 0.25); ctx.globalAlpha *= 0.9; rr(-32, -32, 64, 64, 14); ctx.fill();
    ctx.globalAlpha = pR * clamp(q); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; rr(-32, -32, 64, 64, 14); ctx.stroke();
    ctx.font = FONT('M', 16, 700); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('#' + (1042 + i), 0, 1);
    ctx.restore();
  }
  ctx.globalAlpha = pR; ctx.font = FONT('I', 22, 500); ctx.fillStyle = MUTED; ctx.fillText('Apps · DeFi · Web3', Rx + 34, cy + 262);
  ctx.restore();
}

function globe2D(T) {
  const tOut = 40.05;
  say('IMAGINE', 150, 300, { k: 'M', s: 22, ls: 8, t0: 33.8, t1: tOut, c: MUTED });
  say('A future where', 150, 372, { k: 'I', s: 44, w: 500, t0: 33.95, t1: tOut, c: MUTED });
  say('digital yen', 146, 474, { k: 'U', s: 96, w: 800, t0: 34.15, t1: tOut, grad: true, chars: true, st: 0.035 });
  say('can…', 150, 548, { k: 'I', s: 44, w: 500, t0: 34.5, t1: tOut, c: MUTED });
  const items = ['Move across borders', 'Settle on blockchain networks', 'Support new financial applications'];
  items.forEach((s, i) => {
    const t0 = ARC0 + 0.95 + i * 1.15;
    const p = eo3(seg(T, t0, t0 + 0.5)) * (1 - ei3(seg(T, tOut + i * 0.05, tOut + 0.45 + i * 0.05)));
    if (p <= 0.003) return;
    const y = 640 + i * 84;
    ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - p) * -30, 0);
    const pb = eoBack(seg(T, t0, t0 + 0.5), 3);
    ctx.save(); ctx.translate(174, y); ctx.scale(pb, pb); icons.check(0, 0, 22, HG[i + 1]); ctx.restore();
    ctx.font = FONT('I', 38, 600); ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(s, 222, y + 2);
    ctx.restore();
  });
  // origin label + landing pings
  if (T > S.globe + 0.8 && T < 40.6) {
    const wp = ORIGIN.clone().multiplyScalar(GLOBE_R * 1.02).applyMatrix4(globe.matrixWorld);
    const [ox, oy] = scr(wp);
    const p = eo3(seg(T, 34.2, 34.8)) * (1 - ei3(seg(T, tOut, tOut + 0.4)));
    ctx.save(); ctx.globalAlpha = p;
    const pr = (T * 0.8) % 1;
    ctx.strokeStyle = HG[0]; ctx.lineWidth = 2.5; ctx.globalAlpha = p * (1 - pr); ctx.beginPath(); ctx.arc(ox, oy, 10 + pr * 36, 0, TAU); ctx.stroke();
    ctx.globalAlpha = p; ctx.fillStyle = HG[0]; ctx.beginPath(); ctx.arc(ox, oy, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy, 3.5, 0, TAU); ctx.fill();
    ctx.restore();
    pill(ox - 120, oy - 62, '¥  JPYSC', { p, k: 'U', fs: 22, h: 54, w: 700, c: INK });
    arcs.forEach((a, i) => {
      const t0 = ARC0 + i * ARC_D + 1.0, q = seg(T, t0, t0 + 0.9);
      if (q <= 0 || q >= 1) return;
      const [dx, dy] = scr(a.dest.clone().multiplyScalar(GLOBE_R * 1.07).applyMatrix4(globe.matrixWorld));
      ctx.save(); ctx.globalAlpha = (1 - q) * 0.9; ctx.strokeStyle = HG[(i + 1) % 4]; ctx.lineWidth = 3 * (1 - q) + 1;
      ctx.beginPath(); ctx.arc(dx, dy, 8 + eo3(q) * 46, 0, TAU); ctx.stroke(); ctx.restore();
    });
  }
}

function benefits2D(T) {
  const tOut = 50.1;
  say('THE POTENTIAL BENEFITS', W / 2, 118, { k: 'M', s: 22, ls: 8, al: 'center', t0: 40.6, t1: tOut, c: MUTED });
  say('What could change', W / 2, 196, { k: 'U', s: 56, w: 700, al: 'center', t0: 40.75, t1: tOut });
  const B = [['Faster', 'settlement'], ['More accessible', 'digital payments'], ['New opportunities', 'for onchain finance'], ['Greater interoperability', 'TradFi ⇄ Web3']];
  B.forEach(([l1, l2], i) => {
    const t0 = BEN0 + i * BEN_D + 0.2;
    const p = eo3(seg(T, t0, t0 + 0.6)) * (1 - ei3(seg(T, tOut + i * 0.05, tOut + 0.4 + i * 0.05)));
    if (p <= 0.003) return;
    const [cx] = scr(V3([-4.05, -1.35, 1.35, 4.05][i], 0, 0));
    const w = 410, h = 178, x = cx - w / 2, y = 742 + (1 - p) * 40;
    glass(x, y, w, h, 28, p);
    ctx.save(); ctx.globalAlpha = p;
    ctx.font = FONT('M', 22, 700); ctx.letterSpacing = '2px'; ctx.fillStyle = holoGrad(x + 30, 0, x + 80, 0, i * 0.25); ctx.fillText('0' + (i + 1), x + 30, y + 50);
    ctx.fillStyle = 'rgba(95,90,125,0.25)'; ctx.fillRect(x + 76, y + 42, w - 106, 1.5);
    ctx.letterSpacing = '0px'; ctx.font = FONT('I', 33, 700); ctx.fillStyle = INK; ctx.fillText(l1, x + 30, y + 106);
    ctx.font = FONT('I', 33, 500); ctx.fillStyle = MUTED; ctx.fillText(l2, x + 30, y + 148);
    ctx.restore();
  });
}

function challenges2D(T) {
  const tOut = 54.5;
  say('Of course,', W / 2, 430, { k: 'I', s: 44, w: 500, al: 'center', t0: 50.75, t1: tOut, c: MUTED });
  const C = [['Regulation', icons.shield], ['Liquidity', icons.drop], ['Real-world adoption', icons.users]];
  C.forEach(c => c.push(pillMetrics(c[0], { icon: c[1], fs: 34, h: 84, w: 700 }).w));
  const gap = 28, tot = C.reduce((a, c) => a + c[2], 0) + gap * 2;
  let x = W / 2 - tot / 2;
  C.forEach(([l, ic, w], i) => {
    const t0 = 51.15 + i * 0.32;
    const p = eo3(seg(T, t0, t0 + 0.55)) * (1 - ei3(seg(T, tOut + i * 0.05, tOut + 0.4 + i * 0.05)));
    pill(x + w / 2, 580, l, { p, icon: ic, ic: '#7a6fa8', fs: 34, h: 84, w: 700 });
    x += w + gap;
  });
  say('remain critical challenges.', W / 2, 760, { k: 'U', s: 58, w: 700, al: 'center', t0: 52.35, t1: tOut });
}

function shift2D(T) {
  const tOut = 60.05;
  say('Blockchain is not just about', 150, 250, { k: 'I', s: 46, w: 500, t0: 55.25, t1: tOut, c: MUTED });
  const r = say('digital assets.', 146, 352, { k: 'U', s: 74, w: 700, t0: 55.55, t1: tOut, a: lerp(1, 0.38, eo3(seg(T, 56.9, 57.4))) });
  if (r) {
    const p = eio3(seg(T, 56.75, 57.25)), po = ei3(seg(T, tOut, tOut + 0.4));
    ctx.save(); ctx.globalAlpha = 1 - po; ctx.strokeStyle = holoGrad(r.x0, 0, r.x1, 0); ctx.lineWidth = 8; ctx.lineCap = 'round';
    if (p > 0) { ctx.beginPath(); ctx.moveTo(r.x0 - 6, 328); ctx.lineTo(lerp(r.x0 - 6, r.x1 + 6, p), 328 - 6 * p); ctx.stroke(); }
    ctx.restore();
  }
  say("It's also about building", 150, 470, { k: 'I', s: 46, w: 500, t0: 57.45, t1: tOut, c: MUTED });
  say('new ways to', 146, 568, { k: 'U', s: 74, w: 700, t0: 57.75, t1: tOut, grad: true });
  say('move money.', 146, 660, { k: 'U', s: 74, w: 700, t0: 58.0, t1: tOut, grad: true });
}

function outro2D(T) {
  const tOut = 64.15;
  say('Could yen-denominated stablecoins', W / 2, 430, { k: 'U', s: 58, w: 700, al: 'center', t0: 60.8, t1: tOut });
  say('become an important part of the', W / 2, 515, { k: 'U', s: 58, w: 700, al: 'center', t0: 61.2, t1: tOut });
  say('next generation of global payments?', W / 2, 600, { k: 'U', s: 58, w: 700, al: 'center', t0: 61.6, t1: tOut, grad: true });
  if (T > IMPACT3 - 0.1) {
    const [lx, ly] = scr(V3(0, 0.45, 0));
    rays(lx, ly, IMPACT3, 3.0, 1.1); shock(lx, ly, IMPACT3);
  }
  say('STARTALE', W / 2, 838, { k: 'U', s: 92, w: 700, chars: true, ls: 18, al: 'center', t0: 65.8, st: 0.05 });
  say('JPYSC  ·  ONCHAIN FINANCE  ·  GLOBAL PAYMENTS', W / 2, 906, { k: 'M', s: 22, w: 500, ls: 6, al: 'center', t0: 66.4, c: MUTED, st: 0.04 });
}

// foreground bokeh bubbles drifting past the lens
const BOKEH = (() => { const r = rng(5); return [...Array(5)].map(() => ({ x: r(), y0: r(), s: 0.5 + r() * 0.9, sp: 0.018 + r() * 0.02, ph: r() * TAU })); })();
function bokeh(T) {
  ctx.save();
  for (const b of BOKEH) {
    const y = 1.25 - ((b.y0 + T * b.sp) % 1.5);
    const x = (b.x < 0.5 ? b.x * 0.3 : 0.7 + b.x * 0.3) * W + Math.sin(T * 0.3 + b.ph) * 30;
    const sz = 420 * b.s;
    ctx.globalAlpha = 0.4;
    ctx.drawImage(bokehSprite, x - sz / 2, y * H - sz / 2, sz, sz);
  }
  ctx.restore();
}

function post(T) {
  // transition zoom blur
  const zb = Math.max(
    Math.sin(seg(T, 5.35, 6.45) * PI) * 0.22,
    Math.sin(seg(T, 19.6, 20.35) * PI) * 0.12,
    Math.sin(seg(T, 33.2, 33.9) * PI) * 0.1,
    Math.sin(seg(T, 40.15, 40.85) * PI) * 0.1,
    Math.sin(seg(T, 64.6, 65.7) * PI) * 0.1,
  );
  zoomBlur(zb);
  // flashes
  flash(1 - eo3(seg(T, 0, 0.9)));
  flash(0.55 * hit(T, IMPACT1, 5) + 0.6 * hit(T, IMPACT2, 5) + 0.55 * hit(T, IMPACT3, 5));
  flash(Math.sin(seg(T, 5.85, 6.35) * PI) * 0.5);
  flash(ei3(seg(T, 68.3, 69)) * 0.85, '246,244,250');
  // vignette
  ctx.save();
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(120,100,180,0)'); vg.addColorStop(1, 'rgba(120,100,180,0.12)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // grain
  const r = rng(Math.floor(T * 30) + 1);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07;
  ctx.fillStyle = grain[Math.floor(r() * 4)];
  ctx.translate(-r() * 256, -r() * 256); ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

// ---------------------------------------------------------------- sound events
const EV = [];
const ev = (t, type, o = {}) => EV.push({ t, type, ...o });
ev(0.05, 'shimmer');
for (let k = 0; k < 8; k++) ev(0.3 + k * 0.1, 'swish', { seed: k });
ev(1.4, 'riser', { len: 1.2 });
ev(IMPACT1, 'impact'); ev(IMPACT1, 'bell', { notes: [74, 78, 81, 86] });
ev(2.85, 'whoosh');
ev(3.0, 'sparkle');
ev(5.1, 'riser', { len: 0.9 }); ev(5.95, 'whooshBig');
ev(6.1, 'tick'); ev(6.5, 'tick');
ev(7.3, 'sparkle');
ev(10.3, 'whoosh');
ev(10.9, 'pop', { f: 520 }); ev(11.03, 'pop', { f: 600 }); ev(11.15, 'pop', { f: 680 }); ev(11.27, 'pop', { f: 760 });
ev(HOP0 - 0.4, 'pop', { f: 900 });
for (let i = 0; i < 5; i++) { ev(HOP0 + i * HOP, 'hop'); if (i < 4) ev(HOP0 + i * HOP + HOPT, 'fee', { i }); }
ev(12.15, 'blip', { f: 880 }); ev(13.4, 'blip', { f: 990 }); ev(14.65, 'blip', { f: 1108 });
ev(HOP0 + 4 * HOP + HOPT, 'thud');
ev(18.45, 'whoosh');
ev(18.95, 'riser', { len: 1.25 });
ev(19.55, 'shatter');
ev(IMPACT2, 'impact'); ev(IMPACT2, 'bell', { notes: [74, 81, 86, 90] });
for (let k = 0; k < 8; k++) ev(21.7 + k * 0.08 + 0.3, 'click', { seed: k });
ev(23.5, 'whoosh');
ev(24.4, 'shimmer'); ev(24.5, 'sparkle');
ev(25.7, 'blip', { f: 1175 });
ev(S.bridge - 0.3, 'whoosh');
ev(S.bridge + 1.0, 'pop', { f: 700 }); ev(S.bridge + 1.2, 'pop', { f: 820 });
ev(33.15, 'whooshBig');
ev(34.0, 'shimmer');
for (let i = 0; i < 5; i++) { ev(ARC0 + i * ARC_D, 'zip'); ev(ARC0 + i * ARC_D + 1.0, 'ping', { f: [1319, 1480, 1568, 1760, 1976][i] }); }
ev(40.2, 'whoosh');
for (let i = 0; i < 4; i++) { ev(BEN0 + i * BEN_D, 'pop', { f: 600 + i * 110 }); ev(BEN0 + i * BEN_D + 0.35, 'bell', { notes: [[74], [78], [81], [86]][i], soft: 1 }); }
ev(47.3, 'sparkle');
ev(50.3, 'down');
ev(51.15, 'blip', { f: 660 }); ev(51.47, 'blip', { f: 587 }); ev(51.79, 'blip', { f: 523 });
ev(54.6, 'whoosh');
ev(55.0, 'shimmer');
ev(56.75, 'strike');
ev(57.7, 'sparkle');
ev(60.2, 'whoosh');
ev(63.9, 'riser', { len: 1.7 });
ev(64.3, 'whoosh');
ev(IMPACT3, 'impact'); ev(IMPACT3, 'bell', { notes: [62, 69, 74, 78, 81, 86] });
ev(65.85, 'sparkle');
window.EVENTS = EV;
window.SECTIONS = S;

// ---------------------------------------------------------------- entry
window.render = function (t) {
  set3D(t);
  renderer.render(scene, camera);
  draw2D(t);
};

(async () => {
  await Promise.all(['700 50px Unbounded', '800 50px Unbounded', '500 20px JBMono', '700 20px JBMono', '500 20px InterD', '600 20px InterD', '700 20px InterD'].map(f => document.fonts.load(f, '¥$€£ABCabc')));
  buildSprites();
  const t0 = Number(new URLSearchParams(location.search).get('t') || 0);
  window.render(t0);
  resolveReady(true);
  if (new URLSearchParams(location.search).has('live')) {
    const start = performance.now() - t0 * 1000;
    const loop = () => { window.render(((performance.now() - start) / 1000) % DURATION); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
