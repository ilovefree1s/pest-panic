// ============================================================================
//  PEST PANIC HD  -  engine: renderer, textures, kitchen, models, sprite batches
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const ARENA_BASE = 46;
let ARENA = ARENA_BASE;   // grows 10% per extra player (see setArena)
const IS_TOUCH = matchMedia('(pointer:coarse)').matches;

// ---------------------------------------------------------------- renderer
const stage = document.getElementById('stage');
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d1013');
scene.fog = new THREE.Fog('#0d1013', 70, 130);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 300);
const hemi = new THREE.HemisphereLight('#fff3e2', '#2b3038', 0.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d8', 2.4);
sun.position.set(-18, 40, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
const sc = sun.shadow.camera;
sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 110;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// boss mood: the kitchen lights dim, go cold, and a red glow follows the boss
const dreadLight = new THREE.PointLight('#ff2a1a', 0, 40, 1.3);
dreadLight.position.set(0, 6, 0);
scene.add(dreadLight);
const MOODC = { hemiC: new THREE.Color('#fff3e2'), hemiCold: new THREE.Color('#8fa2d6'), hemiG: new THREE.Color('#2b3038'), hemiGRed: new THREE.Color('#3a1416'),
  sunC: new THREE.Color('#fff0d8'), sunCold: new THREE.Color('#aab8ff') };
// g = how dark (0 normal .. 1 full boss mood), flick = light flicker multiplier (1 steady, lower = dipped), boss = {x,z} or null
export function setMood(g, flick, boss) {
  hemi.intensity = 0.75 * (1 - 0.7 * g) * flick;
  sun.intensity = 2.4 * (1 - 0.66 * g) * flick;
  hemi.color.copy(MOODC.hemiC).lerp(MOODC.hemiCold, g * 0.8);
  hemi.groundColor.copy(MOODC.hemiG).lerp(MOODC.hemiGRed, g);
  sun.color.copy(MOODC.sunC).lerp(MOODC.sunCold, g * 0.7);
  renderer.toneMappingExposure = 1 - 0.4 * g;
  scene.fog.near = 70 - 32 * g; scene.fog.far = 130 - 40 * g;
  dreadLight.intensity = boss ? g * 40 * (0.85 + 0.15 * flick) : 0;
  if (boss) dreadLight.position.set(boss.x, 9, boss.z);
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.4, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

export function setArena(a) { ARENA = a; }
export const view = { w: 1, h: 1, dist: 40, pitch: 0.98, spawnR: 26, visR: 22, bloomOn: true, shadowsOn: true };

export function resize() {
  const r = stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  view.w = w; view.h = h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  // keep the short side of the view about 30 world units wide
  const S = 30, t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const vert = camera.aspect >= 1 ? S : S / camera.aspect;
  view.dist = Math.min(95, (vert / 2) / t * 1.08);
  camera.updateProjectionMatrix();
  // how far from the player the screen corners reach on the floor
  placeCamera(0, 0, 0, 0, true);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new V3(0, 1, 0), 0), hit = new V3();
  let far = 0;
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ray.setFromCamera(new THREE.Vector2(x, y), camera);
    if (ray.ray.intersectPlane(plane, hit)) far = Math.max(far, Math.hypot(hit.x, hit.z));
  }
  view.visR = Math.min(far, 60);
  view.spawnR = view.visR + 3;
}

const camPos = new V3(), camLook = new V3();
export function placeCamera(x, z, shakeX, shakeZ, snap) {
  const d = view.dist, p = view.pitch;
  const tx = x + shakeX, tz = z + shakeZ;
  const want = new V3(tx, Math.sin(p) * d, tz + Math.cos(p) * d);
  if (snap) camPos.copy(want); else camPos.lerp(want, 1);
  camera.position.copy(camPos);
  camLook.set(tx, 0, tz - 1.5);
  camera.lookAt(camLook);
  sun.position.set(x - 18, 40, z + 14);
  sun.target.position.set(x, 0, z);
}

export function render() {
  if (view.bloomOn) composer.render(); else renderer.render(scene, camera);
}
export function setQuality(level) {
  // 2 = full, 1 = lower resolution, 0 = no bloom / no shadows
  const pr = Math.min(devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2);
  renderer.setPixelRatio(level >= 2 ? pr : 1);
  view.bloomOn = level >= 1;
  if (view.shadowsOn !== (level >= 1)) {
    view.shadowsOn = level >= 1;
    renderer.shadowMap.enabled = view.shadowsOn;
    scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(mm => mm.needsUpdate = true); } });
  }
  resize();
}

// ---------------------------------------------------------------- canvas textures
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true, repeat = 0) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4;
  return t;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function floorTextures() {
  const N = 1024, T = 256, G = 7;
  const [c, x] = cnv(N, N);
  const r = rng(7);
  const hgt = new Float32Array(N * N);
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
    const a = (tx + ty) & 1;
    const base = a ? [64, 76, 84] : [54, 64, 72];
    const shade = (r() - 0.5) * 10;
    for (let y = 0; y < T; y++) for (let xx = 0; xx < T; xx++) {
      const gx = tx * T + xx, gy = ty * T + y;
      const e = Math.min(xx, y, T - 1 - xx, T - 1 - y);
      const h = e < G / 2 ? 0 : Math.min(1, (e - G / 2) / 6);
      hgt[gy * N + gx] = h;
    }
    x.fillStyle = `rgb(${base.map(v => v + shade).join(',')})`;
    x.fillRect(tx * T, ty * T, T, T);
    // subtle mottling
    for (let i = 0; i < 900; i++) {
      const px = tx * T + r() * T, py = ty * T + r() * T, s = 1 + r() * 3;
      x.fillStyle = `rgba(${a ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.03})`;
      x.fillRect(px, py, s, s);
    }
  }
  // grout
  x.fillStyle = '#23292e';
  for (let i = 0; i <= 4; i++) { x.fillRect(i * T - G / 2, 0, G, N); x.fillRect(0, i * T - G / 2, N, G); }
  // normal map from height
  const [nc, nx] = cnv(N, N);
  const img = nx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
    const hL = hgt[y * N + ((xx + N - 1) % N)], hR = hgt[y * N + ((xx + 1) % N)];
    const hU = hgt[((y + N - 1) % N) * N + xx], hD = hgt[((y + 1) % N) * N + xx];
    const dx = (hL - hR) * 2.2, dy = (hU - hD) * 2.2;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * N + xx) * 4;
    img.data[i] = (dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
  // roughness: grout rough, tiles semi gloss
  const [rc, rx] = cnv(256, 256);
  rx.fillStyle = '#8a8a8a'; rx.fillRect(0, 0, 256, 256);
  rx.fillStyle = '#e0e0e0';
  for (let i = 0; i <= 4; i++) { rx.fillRect(i * 64 - 2, 0, 4, 256); rx.fillRect(0, i * 64 - 2, 256, 4); }
  return { map: tex(c, true), normal: tex(nc, false), rough: tex(rc, false) };
}

function rugTexture() {
  const N = 512, [c, x] = cnv(N, N), r = rng(3);
  const cols = ['#6a3a32', '#8c7650', '#3a5258', '#9c917a', '#5a3434', '#4c5e4a'];
  for (let ring = 0; ring < 22; ring++) {
    const rad = N / 2 - ring * 11;
    x.beginPath(); x.arc(N / 2, N / 2, rad, 0, TAU);
    x.fillStyle = cols[ring % cols.length]; x.fill();
    // braid texture
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2;
    for (let a = 0; a < TAU; a += 0.08) {
      x.beginPath(); x.arc(N / 2, N / 2, rad - 5, a, a + 0.04); x.stroke();
    }
  }
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.05})`; x.fillRect(r() * N, r() * N, 2, 2); }
  return tex(c, true);
}
function runnerTexture() {
  const W = 256, H = 1024, [c, x] = cnv(W, H);
  x.fillStyle = '#5b2f3a'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#d9b979'; x.fillRect(14, 14, W - 28, H - 28);
  x.fillStyle = '#7a3a47'; x.fillRect(26, 26, W - 52, H - 52);
  for (let y = 60; y < H - 60; y += 70) {
    x.save(); x.translate(W / 2, y); x.rotate(Math.PI / 4);
    x.fillStyle = '#d9b979'; x.fillRect(-24, -24, 48, 48);
    x.fillStyle = '#2f5d63'; x.fillRect(-14, -14, 28, 28);
    x.restore();
  }
  for (let i = 0; i < 40; i++) { x.fillStyle = '#e8d6aa'; x.fillRect(4 + (i % 2) * (W - 12), 0, 4, H); }
  return tex(c, true);
}
function cabinetTexture() {
  const [c, x] = cnv(512, 256);
  x.fillStyle = '#3d6b74'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2; i++) {
    const ox = 18 + i * 250;
    x.fillStyle = '#35606a'; x.fillRect(ox, 18, 226, 220);
    x.strokeStyle = '#2a4d55'; x.lineWidth = 6; x.strokeRect(ox + 16, 34, 194, 188);
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 2; x.strokeRect(ox + 22, 40, 182, 176);
    x.fillStyle = '#d8c48f'; x.fillRect(ox + (i ? 24 : 190), 110, 10, 40);
  }
  return tex(c, true);
}
function counterTopTexture() {
  const [c, x] = cnv(512, 512), r = rng(11);
  x.fillStyle = '#e9e4da'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    x.strokeStyle = `rgba(120,120,130,${0.05 + r() * 0.12})`; x.lineWidth = 1 + r() * 2;
    x.beginPath(); let px = r() * 512, py = r() * 512; x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 120; py += (r() - 0.5) * 120; x.lineTo(px, py); }
    x.stroke();
  }
  return tex(c, true);
}
function subwayTexture() {
  const [c, x] = cnv(512, 512);
  x.fillStyle = '#c9c6bd'; x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) {
    const ox = col * 64 + (row & 1) * 32, oy = row * 32;
    const g = x.createLinearGradient(0, oy, 0, oy + 30);
    g.addColorStop(0, '#f4f2ec'); g.addColorStop(1, '#dedad0');
    x.fillStyle = g; x.fillRect(ox + 2, oy + 2, 60, 28);
  }
  return tex(c, true);
}
// food crumbs spilled on the floor (irregular bits with soft shadows, nothing round and gold)
function crumbTexture(kind, seed) {
  const S = 256, [c, x] = cnv(S, S), r = rng(seed);
  const blob = (px, py, rad, col, edge) => {
    const n = 5 + ((r() * 4) | 0), pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * TAU + r() * 0.5, d = rad * (0.55 + r() * 0.6); pts.push([px + Math.cos(a) * d, py + Math.sin(a) * d]); }
    x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); pts.forEach(([u, v], k) => k ? x.lineTo(u + 1.6, v + 2) : x.moveTo(u + 1.6, v + 2)); x.closePath(); x.fill();
    x.fillStyle = col; x.beginPath(); pts.forEach(([u, v], k) => k ? x.lineTo(u, v) : x.moveTo(u, v)); x.closePath(); x.fill();
    if (edge) { x.strokeStyle = edge; x.lineWidth = 1; x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(px - rad * 0.25, py - rad * 0.25, rad * 0.3, 0, TAU); x.fill();
  };
  const spot = () => { const a = r() * TAU, d = Math.pow(r(), 0.7) * 112; return [128 + Math.cos(a) * d, 128 + Math.sin(a) * d]; };
  if (kind === 'bread') {
    for (let i = 0; i < 90; i++) { const [px, py] = spot(); blob(px, py, 1.5 + r() * 4.5, ['#e6cc98', '#d6ad72', '#c8945a', '#efdcb4'][i % 4], 'rgba(120,80,30,.35)'); }
    for (let i = 0; i < 3; i++) { const [px, py] = spot(); blob(px, py, 9 + r() * 5, '#b97a3c', '#8a5424'); blob(px, py, 6 + r() * 3, '#efdcb4'); }   // crust bits
  } else if (kind === 'cookie') {
    { const px = 110, py = 120; blob(px, py, 34, '#a8723e', '#7a4c22'); for (let k = 0; k < 7; k++) blob(px + (r() - 0.5) * 40, py + (r() - 0.5) * 40, 3 + r() * 3, '#3b2214'); }
    for (let i = 0; i < 70; i++) { const [px, py] = spot(); blob(px, py, 1.5 + r() * 4, i % 5 === 0 ? '#3b2214' : ['#a8723e', '#93602f', '#bd8a52'][i % 3], 'rgba(60,30,10,.3)'); }
  } else {   // sprinkles: little coloured rods
    for (let i = 0; i < 120; i++) {
      const [px, py] = spot(), a = r() * Math.PI, L = 5 + r() * 4;
      x.lineCap = 'round'; x.lineWidth = 3.2;
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.moveTo(px + 1.5, py + 2); x.lineTo(px + 1.5 + Math.cos(a) * L, py + 2 + Math.sin(a) * L); x.stroke();
      x.strokeStyle = ['#ff6fa8', '#4fb3ff', '#7ddc5a', '#fff4e6', '#b78cff', '#ff8a3c'][i % 6];
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke();
    }
  }
  return tex(c, true);
}
function softTex(inner = 0, size = 128) {
  const [c, x] = cnv(size, size);
  const g = x.createRadialGradient(size / 2, size / 2, inner, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return tex(c, false);
}
function puffTex() {
  const S = 128, [c, x] = cnv(S, S), r = rng(9);
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU, d = r() * 26, rad = 18 + r() * 22;
    const px = 64 + Math.cos(a) * d, py = 64 + Math.sin(a) * d;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
  return tex(c, false);
}
function splatTex(seed) {
  const S = 128, [c, x] = cnv(S, S), r = rng(seed);
  x.fillStyle = '#fff';
  x.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = i / n * TAU, rad = 26 + r() * 16;
    const px = 64 + Math.cos(a) * rad, py = 64 + Math.sin(a) * rad;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath(); x.fill();
  for (let i = 0; i < 14; i++) {
    const a = r() * TAU, d = 38 + r() * 22, rad = 2 + r() * 6;
    x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rad, 0, TAU); x.fill();
    x.lineWidth = rad * 0.8; x.strokeStyle = '#fff';
    x.beginPath(); x.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30); x.lineTo(64 + Math.cos(a) * d, 64 + Math.sin(a) * d); x.stroke();
  }
  // glossy inner shading in the alpha
  const g = x.createRadialGradient(56, 56, 2, 64, 64, 40);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(210,210,210,1)');
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, S, S);
  return tex(c, false);
}
function ringTex() {
  const S = 256, [c, x] = cnv(S, S);
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,.9)'); g.addColorStop(0.7, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const g2 = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.4);
  g2.addColorStop(0, 'rgba(255,255,255,.12)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g2; x.fillRect(0, 0, S, S);
  return tex(c, false);
}
function flameTex() {
  const S = 128, [c, x] = cnv(S, S);
  const g = x.createRadialGradient(64, 82, 2, 64, 70, 54);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(64, 8); x.bezierCurveTo(98, 52, 104, 86, 64, 120); x.bezierCurveTo(24, 86, 30, 52, 64, 8); x.fill();
  return tex(c, false);
}
function sparkTex() {
  const S = 128, [c, x] = cnv(S, S);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'lighter';
  for (const a of [0, Math.PI / 2]) {
    x.save(); x.translate(64, 64); x.rotate(a);
    const l = x.createLinearGradient(-64, 0, 64, 0);
    l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, 'rgba(255,255,255,.9)'); l.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = l; x.fillRect(-64, -3, 128, 6); x.restore();
  }
  return tex(c, false);
}
function dropTex() {
  const S = 64, [c, x] = cnv(S, S);
  x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 24, 0, TAU); x.fill();
  x.globalCompositeOperation = 'source-atop';
  const g = x.createRadialGradient(24, 22, 2, 32, 32, 26);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#d9d9d9'); g.addColorStop(1, '#9a9a9a');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return tex(c, false);
}
function newspaperTexture() {
  const [c, x] = cnv(256, 128), r = rng(2);
  x.fillStyle = '#e8e3d3'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#222'; x.font = '900 30px Georgia,serif'; x.fillText('BUGS!', 8, 34);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 3; col++) {
    for (let k = 0; k < 9; k++) {
      x.fillStyle = `rgba(30,30,30,${0.35 + r() * 0.3})`;
      x.fillRect(8 + col * 82, 46 + row * 10, 20 + r() * 50, 3);
    }
  }
  x.fillStyle = '#9b2b25'; x.fillRect(150, 8, 98, 30);
  return tex(c, true);
}
function swatTexture() {
  const [c, x] = cnv(128, 128);
  x.fillStyle = '#d23a2c'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#7a1710';
  for (let i = 8; i < 128; i += 12) { x.fillRect(i, 0, 4, 128); x.fillRect(0, i, 128, 4); }
  x.strokeStyle = '#ff7a64'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
  return tex(c, true);
}
function glueTexture() {
  const [c, x] = cnv(128, 128);
  x.fillStyle = '#c9a36b'; x.fillRect(0, 0, 128, 128);
  const g = x.createRadialGradient(54, 50, 4, 64, 64, 60);
  g.addColorStop(0, '#fff6b8'); g.addColorStop(0.4, '#f6d64a'); g.addColorStop(1, '#d9a91c');
  x.fillStyle = g; x.fillRect(14, 14, 100, 100);
  x.fillStyle = 'rgba(80,50,10,.6)'; x.font = '900 13px system-ui'; x.fillText('STICKY', 38, 122);
  return tex(c, true);
}

export const TEX = {
  floor: floorTextures(), rug: rugTexture(), runner: runnerTexture(), cab: cabinetTexture(), top: counterTopTexture(),
  subway: subwayTexture(), crumbs: [crumbTexture('bread', 11), crumbTexture('cookie', 23), crumbTexture('sprinkles', 37), crumbTexture('bread', 41)],
  soft: softTex(), puff: puffTex(), splat: [splatTex(1), splatTex(2), splatTex(3)], ring: ringTex(), flame: flameTex(),
  spark: sparkTex(), drop: dropTex(), paper: newspaperTexture(), swat: swatTexture(), glue: glueTexture(),
};

// ---------------------------------------------------------------- kitchen
function std(opts) { return new THREE.MeshStandardMaterial(opts); }
export function buildKitchen() {
  const g = new THREE.Group();
  const f = TEX.floor;
  const rep = 240 / 12;
  for (const t of [f.map, f.normal, f.rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240),
    std({ map: f.map, normalMap: f.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: f.rough, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // rugs
  const rug = new THREE.Mesh(new THREE.CircleGeometry(7, 64), std({ map: TEX.rug, roughness: 0.95, envMapIntensity: 0.2 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-18, 0.03, 12); rug.receiveShadow = true; g.add(rug);
  const run = new THREE.Mesh(new THREE.PlaneGeometry(7, 26), std({ map: TEX.runner, roughness: 0.95, envMapIntensity: 0.2 }));
  run.rotation.x = -Math.PI / 2; run.rotation.z = 0.12; run.position.set(20, 0.03, -14); run.receiveShadow = true; g.add(run);
  // crumbs from snacks, scattered around the floor
  for (const [k, x, z, s, rot] of [[1, 14, 20, 6, 0.4], [0, -26, -8, 6.5, 1.1], [2, 8, -27, 5.5, 2.2], [3, -8, 31, 4.5, 0.2], [1, 32, 4, 4.5, 2.8], [2, -33, 24, 4.5, 1.7], [0, 27, -32, 5, 0.9]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), std({ map: TEX.crumbs[k], transparent: true, roughness: 0.85, envMapIntensity: 0.15, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, 0.04, z); m.receiveShadow = true; g.add(m);
  }
  // counters on three sides, a low baseboard on the camera side
  const cabMat = std({ map: TEX.cab, roughness: 0.6, envMapIntensity: 0.5 });
  const topMat = std({ map: TEX.top, roughness: 0.25, envMapIntensity: 1.0 });
  const wallMat = std({ map: TEX.subway, roughness: 0.3, envMapIntensity: 0.7 });
  TEX.cab.wrapS = THREE.RepeatWrapping; TEX.subway.wrapS = TEX.subway.wrapT = THREE.RepeatWrapping;
  TEX.top.wrapS = TEX.top.wrapT = THREE.RepeatWrapping;
  const E = ARENA + 1.2, L = 2 * E + 8, H = 4.2, D = 3.6;
  const side = (x, z, rotY, len) => {
    const grp = new THREE.Group();
    const cabTex = TEX.cab.clone(); cabTex.repeat.set(len / 7, 1); cabTex.needsUpdate = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(len, H, D), [std({ color: '#2f555e', roughness: .7 }), std({ color: '#2f555e', roughness: .7 }),
      std({ color: '#2f555e' }), std({ color: '#2f555e' }), std({ map: cabTex, color: '#a9b4b6', roughness: 0.7, envMapIntensity: 0.3 }), std({ color: '#2f555e' })]);
    cab.position.set(0, H / 2, -D / 2); cab.castShadow = cab.receiveShadow = true; grp.add(cab);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.3), std({ color: '#1b1f22', roughness: 0.9 }));
    kick.position.set(0, 0.25, 0.05); grp.add(kick);
    const topTex = TEX.top.clone(); topTex.repeat.set(len / 10, 0.4); topTex.needsUpdate = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.35, D + 0.5), std({ map: topTex, color: '#6f6b64', roughness: 0.6, envMapIntensity: 0.25 }));
    top.position.set(0, H + 0.17, -D / 2 + 0.25); top.castShadow = top.receiveShadow = true; grp.add(top);
    const wt = TEX.subway.clone(); wt.repeat.set(len / 8, 1); wt.needsUpdate = true;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 8), std({ map: wt, color: '#5d5a54', roughness: 0.7, envMapIntensity: 0.15 }));
    wall.position.set(0, H + 4, -D); grp.add(wall);
    grp.position.set(x, 0, z); grp.rotation.y = rotY;
    g.add(grp);
    return grp;
  };
  side(0, -E, 0, L);            // back
  side(-E, 0, Math.PI / 2, L);  // left
  side(E, 0, -Math.PI / 2, L);  // right
  const base = new THREE.Mesh(new THREE.BoxGeometry(L, 0.7, 0.6), std({ color: '#6b5a48', roughness: 0.7, envMapIntensity: 0.3 }));
  base.position.set(0, 0.35, E + 0.3); base.castShadow = true; g.add(base);
  // fridge and stove on the back wall
  const fridge = new THREE.Mesh(new THREE.BoxGeometry(7, 13, 5), std({ color: '#6f757b', metalness: 0.6, roughness: 0.5, envMapIntensity: 0.4 }));
  fridge.position.set(E - 6, 6.5, -E - 2); fridge.castShadow = true; g.add(fridge);
  for (const [y, h] of [[9.2, 6.4], [3.1, 5.4]]) {
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, h * 0.6, 0.4), std({ color: '#7a8086', metalness: 1, roughness: 0.2 }));
    h1.position.set(E - 8.9, y, -E + 0.6); g.add(h1);
  }
  const stove = new THREE.Group();
  const sBody = new THREE.Mesh(new THREE.BoxGeometry(8, H + 0.4, D + 0.4), std({ color: '#6c7074', metalness: 0.5, roughness: 0.5, envMapIntensity: 0.4 }));
  sBody.position.set(0, (H + 0.4) / 2, -D / 2); sBody.castShadow = true; stove.add(sBody);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.6), std({ color: '#5a2a12', emissive: '#ff6a1a', emissiveIntensity: 0.35, roughness: 0.4 }));
  win.position.set(0, 1.9, 0.22); stove.add(win);
  for (const dx of [-2, 2]) for (const dz of [-1, 1]) {
    const burner = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 8, 24), std({ color: '#222', roughness: .5 }));
    burner.rotation.x = Math.PI / 2; burner.position.set(dx, H + 0.45, -D / 2 + dz * 0.8); stove.add(burner);
  }
  stove.position.set(-16, 0, -E); g.add(stove);
  // shade outside the arena so the edge reads clearly
  return g;
}

// ---------------------------------------------------------------- geometry helpers
function colorize(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function P(geo, hex, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new V3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new V3(...scl));
  geo.applyMatrix4(m);
  return colorize(geo, hex);
}
function seg(a, b, r0, r1, hex, sides = 6) {
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()));
  g.translate(A.x, A.y, A.z);
  return colorize(g, hex);
}
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const merge = parts => mergeGeometries(parts);

// all bug models face +z and stand on y = 0
export const GEO = {};
GEO.antBody = merge([
  P(sph(0.42), '#7d1a12', [0, 0.42, -0.5], [0.15, 0, 0], [0.82, 0.72, 1.15]),
  P(sph(0.42), '#9c2417', [0, 0.47, -0.52], [0.15, 0, 0], [0.5, 0.35, 0.8]),
  P(sph(0.1), '#5a120c', [0, 0.38, -0.06]),
  P(sph(0.2), '#8e1f14', [0, 0.4, 0.12], [0, 0, 0], [0.75, 0.75, 1.35]),
  P(sph(0.25), '#7a1a11', [0, 0.44, 0.48], [0, 0, 0], [1, 0.85, 1]),
  P(sph(0.07), '#0d0d0d', [0.16, 0.5, 0.58]), P(sph(0.07), '#0d0d0d', [-0.16, 0.5, 0.58]),
  seg([0.08, 0.36, 0.68], [0.18, 0.36, 0.82], 0.035, 0.02, '#2c0905'), seg([-0.08, 0.36, 0.68], [-0.18, 0.36, 0.82], 0.035, 0.02, '#2c0905'),
  seg([0.08, 0.58, 0.6], [0.26, 0.82, 0.85], 0.025, 0.02, '#3a0d08'), seg([0.26, 0.82, 0.85], [0.38, 0.72, 1.1], 0.02, 0.015, '#3a0d08'),
  seg([-0.08, 0.58, 0.6], [-0.26, 0.82, 0.85], 0.025, 0.02, '#3a0d08'), seg([-0.26, 0.82, 0.85], [-0.38, 0.72, 1.1], 0.02, 0.015, '#3a0d08'),
]);
GEO.antLeg = merge([seg([0, 0, 0], [0.34, 0.14, 0], 0.04, 0.032, '#4a0f0a'), seg([0.34, 0.14, 0], [0.66, -0.36, 0], 0.032, 0.018, '#3a0b07')]);
GEO.antLegs = [[0.1, 0.38, 0.22, 0.65], [0.12, 0.38, 0.1, 0], [0.1, 0.38, -0.02, -0.6]]; // attach x, y, z, yaw

GEO.flyBody = merge([
  P(sph(0.24), '#363c35', [0, 0, 0.05], [0, 0, 0], [1, 0.9, 1.1]),
  P(sph(0.24), '#44523f', [0, -0.02, -0.32], [0.1, 0, 0], [0.9, 0.75, 1.35]),
  P(sph(0.18), '#2b2f2b', [0, 0.02, 0.33]),
  P(sph(0.13), '#b8201c', [0.12, 0.06, 0.38]), P(sph(0.13), '#b8201c', [-0.12, 0.06, 0.38]),
  seg([0.12, -0.08, 0.1], [0.3, -0.42, 0.25], 0.025, 0.015, '#151715'), seg([-0.12, -0.08, 0.1], [-0.3, -0.42, 0.25], 0.025, 0.015, '#151715'),
  seg([0.14, -0.08, -0.02], [0.34, -0.45, -0.1], 0.025, 0.015, '#151715'), seg([-0.14, -0.08, -0.02], [-0.34, -0.45, -0.1], 0.025, 0.015, '#151715'),
  seg([0.1, -0.08, -0.15], [0.26, -0.44, -0.42], 0.025, 0.015, '#151715'), seg([-0.1, -0.08, -0.15], [-0.26, -0.44, -0.42], 0.025, 0.015, '#151715'),
]);
{
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(0.2, 0.18, 0.62, 0.16, 0.7, 0.02); s.bezierCurveTo(0.62, -0.14, 0.2, -0.12, 0, 0);
  const w = new THREE.ShapeGeometry(s, 10);
  w.rotateX(-Math.PI / 2);
  GEO.wing = w;
}
GEO.spiderBody = merge([
  P(sph(0.55), '#24152f', [0, 0.62, -0.55], [0.2, 0, 0], [1, 0.82, 1.15]),
  P(sph(0.2), '#d43c2a', [0, 1.02, -0.5], [0.2, 0, 0], [0.6, 0.2, 1.1]),
  P(sph(0.12), '#f0b13a', [0, 1.05, -0.2], [0.2, 0, 0], [1, 0.3, 1]),
  P(sph(0.34), '#3a2350', [0, 0.52, 0.2], [0, 0, 0], [1, 0.8, 1.05]),
  P(sph(0.06), '#ff2a2a', [0.09, 0.72, 0.46]), P(sph(0.06), '#ff2a2a', [-0.09, 0.72, 0.46]),
  P(sph(0.04), '#ff2a2a', [0.18, 0.68, 0.42]), P(sph(0.04), '#ff2a2a', [-0.18, 0.68, 0.42]),
  seg([0.08, 0.42, 0.45], [0.1, 0.22, 0.6], 0.05, 0.02, '#120a18'), seg([-0.08, 0.42, 0.45], [-0.1, 0.22, 0.6], 0.05, 0.02, '#120a18'),
]);
GEO.spiderLeg = merge([seg([0, 0, 0], [0.55, 0.5, 0], 0.055, 0.045, '#2a1838'), P(sph(0.06), '#1a0f24', [0.55, 0.5, 0]),
  seg([0.55, 0.5, 0], [1.2, -0.5, 0], 0.045, 0.02, '#1f1229')]);
GEO.spiderLegs = [[0.16, 0.5, 0.32, 0.95], [0.2, 0.5, 0.22, 0.35], [0.2, 0.5, 0.1, -0.2], [0.16, 0.5, -0.02, -0.75]];

// wasp: like the fly's build but yellow-and-black with a pointed striped abdomen and stinger (faces +z)
GEO.waspBody = merge([
  P(sph(0.2), '#1b1b1b', [0, 0, 0.05], [0, 0, 0], [1, 0.9, 1.1]),
  P(sph(0.2), '#f2c21b', [0, -0.02, -0.25], [0.1, 0, 0], [0.95, 0.85, 0.9]),
  P(sph(0.19), '#1b1b1b', [0, -0.04, -0.45], [0.1, 0, 0], [0.9, 0.8, 0.85]),
  P(sph(0.17), '#f2c21b', [0, -0.06, -0.63], [0.1, 0, 0], [0.85, 0.75, 0.85]),
  P(sph(0.13), '#1b1b1b', [0, -0.08, -0.79], [0.1, 0, 0], [0.8, 0.7, 0.9]),
  seg([0, -0.09, -0.86], [0, -0.12, -1.05], 0.05, 0.005, '#111111'),
  P(sph(0.16), '#f2c21b', [0, 0.02, 0.3]),
  P(sph(0.09), '#2a1608', [0.1, 0.05, 0.36]), P(sph(0.09), '#2a1608', [-0.1, 0.05, 0.36]),
  seg([0.05, 0.12, 0.38], [0.14, 0.3, 0.55], 0.02, 0.012, '#111111'), seg([-0.05, 0.12, 0.38], [-0.14, 0.3, 0.55], 0.02, 0.012, '#111111'),
  seg([0.1, -0.08, 0.1], [0.28, -0.4, 0.2], 0.022, 0.012, '#1b1b1b'), seg([-0.1, -0.08, 0.1], [-0.28, -0.4, 0.2], 0.022, 0.012, '#1b1b1b'),
  seg([0.1, -0.08, -0.05], [0.3, -0.42, -0.12], 0.022, 0.012, '#f2c21b'), seg([-0.1, -0.08, -0.05], [-0.3, -0.42, -0.12], 0.022, 0.012, '#f2c21b'),
]);
GEO.coin = (() => { const c = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 22); c.rotateX(Math.PI / 2); return c; })();
GEO.paper = (() => { const c = new THREE.CylinderGeometry(0.2, 0.2, 1.1, 14, 1, false); return c; })();
GEO.glue = new THREE.BoxGeometry(1.3, 0.08, 1.3);
// flip-flop: pink foam sole, lighter footbed, blue V strap (lies flat, toe toward +z)
GEO.flip = merge([
  P(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 22), '#ff4f93', [0, 0, 0], [0, 0, 0], [0.56, 1, 1.05]),
  P(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 22), '#ffd3e6', [0, 0.07, 0], [0, 0, 0], [0.5, 1, 0.98]),
  seg([0, 0.08, 0.3], [0.25, 0.16, -0.08], 0.045, 0.045, '#2b9cff', 6),
  seg([0, 0.08, 0.3], [-0.25, 0.16, -0.08], 0.045, 0.045, '#2b9cff', 6),
  P(sph(0.06), '#1e7fe0', [0, 0.1, 0.3]),
]);

// ---------------------------------------------------------------- materials for instanced things
export const MAT = {
  bug: std({ vertexColors: true, roughness: 0.32, metalness: 0.08, envMapIntensity: 0.9 }),
  leg: std({ vertexColors: true, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.5 }),
  wing: new THREE.MeshStandardMaterial({ color: '#d4ecf8', transparent: true, opacity: 0.42, side: THREE.DoubleSide, roughness: 0.08, metalness: 0.4, depthWrite: false, envMapIntensity: 1.2 }),
  coin: std({ color: '#f5c242', metalness: 1, roughness: 0.22, emissive: '#5a3a00', emissiveIntensity: 0.6, envMapIntensity: 1.4 }),
  coinBig: std({ color: '#ffd96a', metalness: 1, roughness: 0.18, emissive: '#8a5a00', emissiveIntensity: 1.0, envMapIntensity: 1.6 }),
  paper: [std({ map: TEX.paper, roughness: 0.8 }), std({ color: '#d7d2c2', roughness: 0.8 }), std({ color: '#d7d2c2', roughness: 0.8 })],
  flip: std({ vertexColors: true, roughness: 0.55, envMapIntensity: 0.5 }),
  glue: (() => { const m = std({ color: '#e4e4df', roughness: 0.95, metalness: 0, envMapIntensity: 0.2 }); return [m, m, m, m, m, m]; })(),
};

export function instanced(geo, mat, max, shadow = false) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.castShadow = shadow;
  m.count = 0;
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------- characters
function mesh(geo, mat, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = false; return m; }
export function buildPlayer(suitHex = '#3a86bd', capHex = '#d43a2b') {
  const root = new THREE.Group();
  const suit = std({ color: suitHex, roughness: 0.55 });
  const suitD = std({ color: new THREE.Color(suitHex).multiplyScalar(0.72), roughness: 0.6 });
  const skin = std({ color: '#eab48a', roughness: 0.6 });
  const red = std({ color: capHex, roughness: 0.45 });
  const black = std({ color: '#1c1d22', roughness: 0.4 });
  const steel = std({ color: '#c6ccd4', metalness: 0.9, roughness: 0.25 });
  const yellow = std({ color: '#f2c53d', roughness: 0.4 });
  const body = new THREE.Group(); root.add(body);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.16 * s, 0.72, 0);
    const l = mesh(new THREE.CapsuleGeometry(0.13, 0.42, 4, 10), suitD); l.position.y = -0.33; leg.add(l);
    const boot = mesh(new THREE.BoxGeometry(0.22, 0.16, 0.36), black); boot.position.set(0, -0.68, 0.06); leg.add(boot);
    body.add(leg); legs.push(leg);
  }
  const torso = mesh(new THREE.CapsuleGeometry(0.31, 0.38, 6, 14), suit); torso.position.y = 1.08; body.add(torso);
  // backpack sprayer: white tank, orange cap and pump handle, hose round to the wand
  { const tankM = std({ color: '#dcdcd6', roughness: 0.75, envMapIntensity: 0.35 }), orange = std({ color: '#ff7a1f', roughness: 0.45 });
    const tank = mesh(new THREE.CapsuleGeometry(0.22, 0.32, 6, 12), tankM); tank.scale.set(1.15, 1, 0.75); tank.position.set(0, 1.18, -0.42); body.add(tank);
    const capB = mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.08, 14), orange); capB.position.set(0, 1.62, -0.42); body.add(capB);
    const pump = mesh(new THREE.BoxGeometry(0.06, 0.34, 0.06), orange); pump.position.set(0.3, 1.12, -0.42); body.add(pump);
    const base = mesh(new THREE.BoxGeometry(0.46, 0.08, 0.3), orange); base.position.set(0, 0.84, -0.42); body.add(base);
    for (const s of [-1, 1]) { const strap = mesh(new THREE.BoxGeometry(0.06, 0.5, 0.05), black); strap.position.set(0.17 * s, 1.24, -0.2); body.add(strap); } }
  const belt = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 18), black); belt.position.y = 0.86; body.add(belt);
  const badge = mesh(new THREE.CircleGeometry(0.07, 12), yellow, false); badge.position.set(-0.13, 1.2, 0.3); body.add(badge);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.38 * s, 1.3, 0);
    const a = mesh(new THREE.CapsuleGeometry(0.1, 0.38, 4, 10), suit); a.position.y = -0.27; arm.add(a);
    const hand = mesh(sph(0.1, 10, 8), skin); hand.position.y = -0.55; arm.add(hand);
    body.add(arm); arms.push(arm);
  }
  // spray wand in the right hand
  // backpack sprayer gun: black trigger grip, long dark lance, brass nozzle
  const wand = new THREE.Group();
  const gunM = std({ color: '#26282d', roughness: 0.5 }), lanceM = std({ color: '#4a4f56', metalness: 0.3, roughness: 0.6, envMapIntensity: 0.4 }), brass = std({ color: '#3a3d42', metalness: 0.2, roughness: 0.7, envMapIntensity: 0.3 });   // dull nozzle, no glare
  const grip = mesh(new THREE.BoxGeometry(0.09, 0.2, 0.14), gunM); grip.position.set(0, -0.04, 0); grip.rotation.x = 0.35; wand.add(grip);
  const valve = mesh(new THREE.BoxGeometry(0.1, 0.09, 0.22), gunM); valve.position.set(0, 0.06, 0.08); wand.add(valve);
  const trig = mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), std({ color: '#ff7a1f', roughness: 0.5 })); trig.position.set(0, -0.02, 0.1); wand.add(trig);
  const lance = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.95, 8), lanceM); lance.rotation.x = Math.PI / 2; lance.position.set(0, 0.06, 0.66); wand.add(lance);
  const noz = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.1, 10), brass); noz.rotation.x = Math.PI / 2; noz.position.set(0, 0.06, 1.17); wand.add(noz);
  wand.position.set(0, -0.55, 0.05); wand.rotation.x = 1.05; arms[1].add(wand);   // held low, pointing at the ground ahead
  // citronella candle in the other hand: a little tin bucket with a flame (only shown once you pick Citronella)
  const candle = new THREE.Group();
  const tin = mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.16, 14), std({ color: '#d9c27a', metalness: 0.6, roughness: 0.35 })); candle.add(tin);
  const wax = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 14), std({ color: '#f3e6a8', roughness: 0.7 })); wax.position.y = 0.08; candle.add(wax);
  const flame = mesh(new THREE.ConeGeometry(0.045, 0.14, 8), std({ color: '#ffb347', emissive: '#ff8a1a', emissiveIntensity: 2.2 }), false); flame.position.y = 0.17; candle.add(flame);
  candle.position.set(0, -0.62, 0.06); candle.visible = false; arms[0].add(candle);
  const head = new THREE.Group(); head.position.y = 1.72; body.add(head);
  head.add(mesh(sph(0.27, 18, 14), skin));
  const cap = mesh(new THREE.SphereGeometry(0.29, 18, 10, 0, TAU, 0, Math.PI / 2), red); cap.position.y = 0.04; head.add(cap);
  const brim = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16, 1, false, -Math.PI / 2, Math.PI), red); brim.position.set(0, 0.07, 0.2); head.add(brim);
  const band = mesh(new THREE.TorusGeometry(0.27, 0.045, 8, 24), black); band.rotation.x = Math.PI / 2; band.position.y = 0.0; head.add(band);
  for (const s of [-1, 1]) {
    const lens = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 14), std({ color: '#9ff3ff', emissive: '#3ad0ff', emissiveIntensity: 1.2, roughness: 0.1 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(0.1 * s, 0.0, 0.26); head.add(lens);
  }
  const mask = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 12), black); mask.rotation.x = Math.PI / 2; mask.position.set(0, -0.13, 0.25); head.add(mask);
  const filt = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), steel); filt.rotation.x = Math.PI / 2; filt.position.set(0, -0.15, 0.34); head.add(filt);
  // pesticide tank
  const tank = null;
  const hose = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0.18, 0.86, -0.5), new V3(0.42, 0.62, -0.25), new V3(0.46, 0.68, 0.08)]), 12, 0.03, 6), black);
  body.add(hose);
  const tipMark = new THREE.Object3D(); tipMark.position.set(0, 0.06, 1.24); wand.add(tipMark);   // the very end of the nozzle
  arms[1].rotation.order = 'YXZ';   // the spraying arm swings left/right at the shoulder first
  root.userData = { body, legs, arms, head, tank, candle, tip: tipMark };
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  root.scale.setScalar(1.6);
  return root;
}

export function buildQueen() {
  const root = new THREE.Group();
  const shell = std({ color: '#3e1f0d', roughness: 0.28, metalness: 0.1, envMapIntensity: 0.9 });
  const shell2 = std({ color: '#5a2e12', roughness: 0.24, metalness: 0.1, envMapIntensity: 0.9 });
  const dark = std({ color: '#2d170b', roughness: 0.35 });
  const legM = std({ color: '#4b2a15', roughness: 0.4, envMapIntensity: 0.8 });
  const gold = std({ color: '#f3c24a', metalness: 1, roughness: 0.2, emissive: '#6a4300', emissiveIntensity: 0.6 });
  const gem = std({ color: '#ff3048', emissive: '#ff1030', emissiveIntensity: 2.2, roughness: 0.1 });
  const body = new THREE.Group(); root.add(body);
  const abd = mesh(sph(1, 28, 18), shell); abd.scale.set(1.9, 0.75, 2.8); abd.position.set(0, 1.05, -1.2); body.add(abd);
  for (const s of [-1, 1]) {
    const wing = mesh(sph(1, 24, 14), shell2); wing.scale.set(0.98, 0.42, 2.6); wing.position.set(0.93 * s, 1.5, -1.0); wing.rotation.z = -0.18 * s; body.add(wing);
  }
  for (let i = 0; i < 4; i++) {
    const r = mesh(new THREE.TorusGeometry(1, 0.05, 6, 30), dark); r.scale.set(1.75 - i * 0.18, 2.4 - i * 0.2, 1);
    r.rotation.x = Math.PI / 2; r.position.set(0, 1.0, -2.2 - i * 0.55); body.add(r);
  }
  const pro = mesh(sph(1, 24, 14), shell2); pro.scale.set(1.55, 0.5, 1.05); pro.position.set(0, 1.25, 1.15); body.add(pro);
  const rim = mesh(new THREE.TorusGeometry(1, 0.08, 8, 32), std({ color: '#a8702e', roughness: 0.3 })); rim.scale.set(1.5, 1.0, 1); rim.rotation.x = Math.PI / 2; rim.position.set(0, 1.25, 1.15); body.add(rim);
  const head = new THREE.Group(); head.position.set(0, 0.95, 2.15); body.add(head);
  const hm = mesh(sph(0.6, 20, 14), dark); hm.scale.set(1, 0.8, 0.9); head.add(hm);
  for (const s of [-1, 1]) {
    const eye = mesh(sph(0.2, 12, 10), std({ color: '#120604', roughness: 0.05, metalness: 0.3 })); eye.position.set(0.38 * s, 0.12, 0.25); head.add(eye);
    const ant = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0.2 * s, 0.3, 0.4), new V3(1.2 * s, 1.2, 2.2), new V3(2.6 * s, 0.9, 4.2), new V3(3.6 * s, 0.4, 5.4)]), 24, 0.05, 6), legM);
    head.add(ant);
  }
  const crown = new THREE.Group(); crown.position.set(0, 0.5, 0); head.add(crown);
  const band = mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.22, 20, 1, true), gold); crown.add(band);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const sp = mesh(new THREE.ConeGeometry(0.1, 0.38, 8), gold); sp.position.set(Math.cos(a) * 0.43, 0.26, Math.sin(a) * 0.43); crown.add(sp);
    const g = mesh(sph(0.07, 8, 6), gem, false); g.position.set(Math.cos(a) * 0.45, 0.02, Math.sin(a) * 0.45); crown.add(g);
  }
  const legs = [];
  const legGeo = mergeGeometries([seg([0, 0, 0], [1.6, 1.1, 0], 0.14, 0.11, '#ffffff', 8), seg([1.6, 1.1, 0], [3.4, -1.0, 0], 0.11, 0.04, '#ffffff', 8)]);
  for (const [z, yaw] of [[1.1, 0.6], [0.2, 0.0], [-0.7, -0.6]]) for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(0.9 * s, 1.0, z);
    const m = mesh(legGeo, legM); if (s < 0) m.scale.x = -1; g.add(m);
    g.userData = { yaw: yaw * s, side: s };
    body.add(g); legs.push(g);
  }
  const mats = [shell, shell2, dark, legM];
  root.userData = { body, legs, head, crown, mats };
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  root.scale.setScalar(1.15);
  return root;
}

// ---------------------------------------------------------------- bug bosses built from the regular bug parts, scaled up and crowned
function crownMesh(scale) {
  const gold = std({ color: '#f3c24a', metalness: 1, roughness: 0.2, emissive: '#6a4300', emissiveIntensity: 0.6 });
  const gem = std({ color: '#ff3048', emissive: '#ff1030', emissiveIntensity: 2.2, roughness: 0.1 });
  const crown = new THREE.Group();
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.22, 20, 1, true), gold));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 8), gold); sp.position.set(Math.cos(a) * 0.43, 0.26, Math.sin(a) * 0.43); crown.add(sp);
    const g = new THREE.Mesh(sph(0.07, 8, 6), gem); g.position.set(Math.cos(a) * 0.45, 0.02, Math.sin(a) * 0.45); crown.add(g);
  }
  crown.scale.setScalar(scale);
  return crown;
}
export function buildBugBoss(kind) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = std({ vertexColors: true, roughness: 0.28, metalness: 0.1, envMapIntensity: 0.9 });
  const legMat = std({ vertexColors: true, roughness: 0.45, envMapIntensity: 0.6 });
  const legs = [], wings = [];
  let S = 4, crown;
  const addLegs = (geo, table, S) => {
    for (let i = 0; i < table.length * 2; i++) {
      const L = table[i >> 1], side = i & 1 ? -1 : 1;
      const g = new THREE.Group(); g.position.set(L[0] * side * S, L[1] * S, L[2] * S);
      const m = new THREE.Mesh(geo, legMat); m.scale.setScalar(S); m.castShadow = true; g.add(m);
      g.userData = { yaw: L[3], side, row: i >> 1 };
      body.add(g); legs.push(g);
    }
  };
  if (kind === 'spider') {
    S = 4.2;
    const m = new THREE.Mesh(GEO.spiderBody, mat); m.scale.setScalar(S); body.add(m);
    addLegs(GEO.spiderLeg, GEO.spiderLegs, S);
    crown = crownMesh(1.5); crown.position.set(0, 0.86 * S, 0.22 * S);
  } else if (kind === 'ant') {
    S = 4.4;
    const m = new THREE.Mesh(GEO.antBody, mat); m.scale.setScalar(S); body.add(m);
    addLegs(GEO.antLeg, GEO.antLegs, S);
    crown = crownMesh(1.05); crown.position.set(0, 0.7 * S, 0.46 * S);
  } else {
    S = 3.8;
    const m = new THREE.Mesh(GEO.flyBody, mat); m.scale.setScalar(S); body.add(m);
    const wm = MAT.wing.clone(); wm.opacity = 0.5;
    for (const side of [1, -1]) {
      const g = new THREE.Group(); g.position.set(0.08 * side * S, 0.12 * S, 0.02 * S);
      const w = new THREE.Mesh(GEO.wing, wm); w.scale.setScalar(S); g.add(w);
      g.userData = { side }; body.add(g); wings.push(g);
    }
    crown = crownMesh(0.95); crown.position.set(0, 0.3 * S, 0.3 * S);
  }
  body.add(crown);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  root.userData = { body, legs, wings, crown, mats: [mat, legMat], kind, S };
  root.visible = false;
  scene.add(root);
  return root;
}

export function buildSwatter() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 1.15), [std({ color: '#a32416' }), std({ color: '#a32416' }), std({ map: TEX.swat, roughness: 0.5 }), std({ map: TEX.swat, roughness: 0.5 }), std({ color: '#a32416' }), std({ color: '#a32416' })]);
  head.position.z = 0.9; head.castShadow = true; g.add(head);
  // the group's +z points away from the player: handle toward them, head out toward the bugs
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.9, 8), std({ color: '#f0ece2', roughness: 0.4 }));
  handle.rotation.x = Math.PI / 2; handle.position.z = -0.55; handle.castShadow = true; g.add(handle);
  scene.add(g);
  return g;
}
export function buildRoomba() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1, 0.3, 32), std({ color: '#2a2e34', metalness: 0.35, roughness: 0.35, envMapIntensity: 0.6 }));
  body.position.y = 0.17; body.castShadow = true; g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.04, 32), std({ color: '#454c55', metalness: 0.5, roughness: 0.3 }));
  top.position.y = 0.34; g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 6, 32), std({ color: '#9aa3ad', metalness: 0.8, roughness: 0.25 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.36; g.add(ring);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), std({ color: '#d7dbe0', roughness: 0.4 }));
  btn.position.y = 0.37; g.add(btn);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std({ color: '#6dff7a', emissive: '#3cff55', emissiveIntensity: 1.1 }));
  led.position.set(0, 0.37, 0.42); g.add(led);
  const bump = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.18, 24, 1, true, -Math.PI / 2, Math.PI), std({ color: '#111316', roughness: 0.7, side: THREE.DoubleSide }));
  bump.position.y = 0.14; g.add(bump);
  const brush = new THREE.Group();
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.55), std({ color: '#c9b27a', roughness: 0.9 })); b.position.z = 0.26; const a = new THREE.Group(); a.rotation.y = k * Math.PI * 2 / 3; a.add(b); brush.add(a); }
  brush.position.set(0.62, 0.03, 0.62); g.add(brush);
  g.userData = { brush };
  g.visible = false;
  scene.add(g);
  return g;
}
// magnifying glass: brass rim, clear lens, wooden handle. The lens faces local -y (down at the floor).
export function buildMagnifier() {
  const g = new THREE.Group();
  const rimM = std({ color: '#c9a24a', metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.13, 12, 40), rimM); rim.rotation.x = Math.PI / 2; rim.castShadow = true; g.add(rim);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.08, 40), new THREE.MeshStandardMaterial({ color: '#cfeaff', transparent: true, opacity: 0.28, roughness: 0.02, metalness: 0.1, envMapIntensity: 2.2, depthWrite: false }));
  g.add(glass);
  const shine = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 24, 1.2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
  shine.rotation.x = Math.PI / 2; shine.rotation.z = 2.3; shine.position.y = 0.06; g.add(shine);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 10), rimM); neck.rotation.z = Math.PI / 2; neck.position.x = 1.45; g.add(neck);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1.7, 12), std({ color: '#7a4a24', roughness: 0.55 })); handle.rotation.z = Math.PI / 2; handle.position.x = 2.5; handle.castShadow = true; g.add(handle);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), rimM); cap.position.x = 3.35; g.add(cap);
  g.visible = false;
  scene.add(g);
  return g;
}
// the light cone from lens to floor: unit height along +y, scaled per frame
export function buildBeam() {
  const geo = new THREE.CylinderGeometry(1, 0.08, 1, 32, 1, true); geo.translate(0, -0.5, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 16; m.visible = false; m.frustumCulled = false;
  scene.add(m);
  return m;
}
// wasp nest: a papery grey-tan lump with layered ridges and a dark entrance hole near the bottom
export function buildNest() {
  const g = new THREE.Group();
  const paper = std({ color: '#b9aa8d', roughness: 0.95, envMapIntensity: 0.25 }), ridge = std({ color: '#9a8b70', roughness: 0.95, envMapIntensity: 0.2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.7, 28, 20), paper); body.scale.set(1, 1.2, 1); body.position.y = 2.05; body.castShadow = true; g.add(body);
  for (const [y, r] of [[0.95, 1.18], [1.55, 1.58], [2.15, 1.7], [2.75, 1.52], [3.3, 1.1]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 6, 36), ridge); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t);
  }
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.6, 10), ridge); stalk.position.y = 4.2; g.add(stalk);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), new THREE.MeshBasicMaterial({ color: '#120d07' })); hole.position.set(0, 1.25, 1.42); hole.rotation.x = -0.35; g.add(hole);
  g.userData = { body, mats: [paper, ridge] };
  g.visible = false;
  scene.add(g);
  return g;
}
export function buildZapper() {
  const g = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16), std({ color: '#b48cff', emissive: '#8a5cff', emissiveIntensity: 2.4, roughness: 0.2 }));
  g.add(glow);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.66, 10, 4, true), new THREE.MeshStandardMaterial({ color: '#222', wireframe: true }));
  g.add(cage);
  for (const y of [-0.38, 0.38]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), std({ color: '#2a2d33', metalness: 0.6, roughness: 0.4 })); cap.position.y = y; g.add(cap); }
  const light = { intensity: 0 };
  g.userData = { glow, light };
  g.visible = false;
  scene.add(g);
  return g;
}

// ---------------------------------------------------------------- sprite batches (particles, decals, shadows)
const VS = `
attribute vec3 aOffset; attribute vec4 aColor; attribute vec2 aSR;
uniform float uBill;
varying vec2 vUv; varying vec4 vColor;
void main(){
  vUv = uv; vColor = aColor;
  float c = cos(aSR.y), s = sin(aSR.y);
  vec2 p = vec2(c*position.x - s*position.y, s*position.x + c*position.y) * aSR.x;
  if (uBill > 0.5) {
    vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
    mv.xy += p;
    gl_Position = projectionMatrix * mv;
  } else {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(aOffset + vec3(p.x, 0.0, p.y), 1.0);
  }
}`;
const FS = `
uniform sampler2D map; varying vec2 vUv; varying vec4 vColor;
void main(){
  vec4 t = texture2D(map, vUv);
  float a = t.a * vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(t.rgb * vColor.rgb, a);
}`;
export class Batch {
  constructor(map, max, { bill = true, add = false, order = 10 } = {}) {
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(base.index); g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    this.off = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.sr = new Float32Array(max * 2);
    this.aOff = new THREE.InstancedBufferAttribute(this.off, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSR = new THREE.InstancedBufferAttribute(this.sr, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aOffset', this.aOff); g.setAttribute('aColor', this.aCol); g.setAttribute('aSR', this.aSR);
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: map }, uBill: { value: bill ? 1 : 0 } }, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
    this.g = g; this.max = max; this.n = 0;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  add(x, y, z, size, rot, r, g, b, a) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.off[i * 3] = x; this.off[i * 3 + 1] = y; this.off[i * 3 + 2] = z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.sr[i * 2] = size; this.sr[i * 2 + 1] = rot;
  }
  end() {
    this.g.instanceCount = this.n;
    this.aOff.needsUpdate = this.aCol.needsUpdate = this.aSR.needsUpdate = true;
    // only upload what is used
    for (const [a, s] of [[this.aOff, 3], [this.aCol, 4], [this.aSR, 2]]) {
      if (a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, this.n) * s); }
    }
  }
}

// lightning arcs: camera-facing ribbons
export class Arcs {
  constructor(maxArcs = 10, pts = 12) {
    this.pts = pts; this.max = maxArcs;
    const nv = maxArcs * pts * 2;
    this.pos = new Float32Array(nv * 3); this.alpha = new Float32Array(nv);
    const idx = [];
    for (let a = 0; a < maxArcs; a++) for (let i = 0; i < pts - 1; i++) {
      const v = (a * pts + i) * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aA = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aA', this.aA);
    const m = new THREE.ShaderMaterial({
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(1.6,1.9,3.2) * vA, vA); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 20;
    this.g = g; this.list = [];
    scene.add(this.mesh);
  }
  spawn(a, b) {
    const pts = [];
    for (let i = 0; i < this.pts; i++) {
      const t = i / (this.pts - 1);
      const p = new V3().lerpVectors(a, b, t);
      if (i && i < this.pts - 1) { const j = 0.55 * Math.sin(t * Math.PI); p.x += (Math.random() - 0.5) * j * 1.6; p.y += (Math.random() - 0.5) * j; p.z += (Math.random() - 0.5) * j * 1.6; }
      pts.push(p);
    }
    this.list.push({ pts, life: 0.22, max: 0.22 });
    if (this.list.length > this.max) this.list.shift();
  }
  update(dt) {
    const fwd = new V3(); camera.getWorldDirection(fwd);
    let v = 0;
    this.pos.fill(0); this.alpha.fill(0);
    this.list = this.list.filter(a => (a.life -= dt) > 0);
    for (const a of this.list) {
      const k = a.life / a.max;
      for (let i = 0; i < this.pts; i++) {
        const p = a.pts[i], q = a.pts[Math.min(i + 1, this.pts - 1)], o = a.pts[Math.max(i - 1, 0)];
        const dir = new V3().subVectors(q, o).normalize();
        const side = new V3().crossVectors(dir, fwd).normalize().multiplyScalar(0.09 + 0.1 * k);
        this.pos.set([p.x + side.x, p.y + side.y, p.z + side.z], v * 3);
        this.pos.set([p.x - side.x, p.y - side.y, p.z - side.z], v * 3 + 3);
        this.alpha[v] = this.alpha[v + 1] = k;
        v += 2;
      }
    }
    this.aPos.needsUpdate = this.aA.needsUpdate = true;
  }
}

export { THREE, scene, camera, renderer, ARENA, ARENA_BASE, TAU, IS_TOUCH, stage };
