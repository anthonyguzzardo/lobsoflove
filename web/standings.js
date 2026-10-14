// Standings: the tesseract. Every fighter is its real jelly body (web/jelly-core.js), weightless in the void like an astronaut,
// stacked top to bottom by rank in front of a corridor of books smeared through time. Scrolling down is falling down the table.
// After docs/mo-design/vids/blackhole-scene-interstellar.mov (the shelves behind the bookcase: streaks of cream, amber, rust,
// rose and slate on black, warm lattice light).
//
// Motion spec.
// - Corridor: a 24-unit segment tiled four deep, flowing toward the camera at 0.6 units/s, so the hold is never frozen.
//   Lattice frames every 4 units. Fog from 8 to 28 swallows the far end. The corridor rides along with the camera as it
//   scrolls, so it reads as an endless shaft.
// - Fighters: no gravity, held at their float height by the jelly's own float spring (0.9 Hz). The carrier tumbles
//   +-17 deg roll on a 9 s sine, +-11 deg pitch on 7 s, +-23 deg yaw on 11 s, each with its own phase, and bobs 0.08 on 5 s.
// - Ranks: 1.45 units apart down a column, swaying 0.32 to 0.42 left and right of center; the leader floats 1.25x bigger.
// - Camera: rides height on a spring at 1.4 Hz, damping ratio 1 (no bounce on a camera). Drag scrolls 1:1 with the finger,
//   with a fling that decays at 4/s. Tap a fighter to center it.
// - Dock: one floating platform per rank along the bottom, in the fighter's color. A ball hops to whichever rank the camera
//   Each platform carries a little flat cutout of its fighter, from the same silhouettes as the jelly bodies. The ball hops
//   between their heads: 360 ms, arc 22 px plus 5 px per platform crossed, squash 0.8 on takeoff and landing, and keeps
//   bouncing 8 px on the head of whoever is in view. Tap or drag along the dock to fly there.
// - Tap: pokes the jelly where your finger hit (power 7, sigma 0.5), spins it, and kicks the carrier's tumble 1.4 rad/s,
//   decaying at 0.7/s, so it rolls away and drifts back.
import * as THREE from 'three';

import { FACE, FEEL, SHAPES, SoftBody } from './jelly-core.js';
import { Debris } from './standings-debris.js';

const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));

const $ = (id) => document.getElementById(id);
const VOID = 0x050507;
const LIT = [0xefe3cf, 0xe0a35a, 0xb5583a, 0xc99a95, 0x3d4f66, 0x8a94a3, 0x6b5a4c];
const DARK = [0x1c1512, 0x2a1d17, 0x231a16, 0x16120f, 0x3a2c24];
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(VOID, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(VOID, 8, 28);
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 60);
scene.add(new THREE.HemisphereLight(0xffe2b8, 0x18202c, 1.1));
const key = new THREE.DirectionalLight(0xffc98a, 2.6);
key.position.set(-2, 4, 5);
const rim = new THREE.DirectionalLight(0x9fb4e6, 1.6);
rim.position.set(2.5, 1, -4);
scene.add(key, rim);

// The corridor: walls of books smeared into streaks, a sparse lattice above and below, amber frames.
const CW = 2.3;
const CH = 3.8;
const SEG = 24;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function segment() {
  const r = rng(11);
  const lit = []; const dark = [];
  const run = (place, lo, hi, litChance, minT, maxT) => {
    let u = lo;
    while (u < hi) {
      const thick = minT + r() * (maxT - minT);
      let z = 0;
      while (z > -SEG) {
        const len = Math.min(1.5 + r() * 7, z + SEG);
        const isLit = r() < litChance;
        const color = isLit ? LIT[Math.floor(r() * LIT.length)] : DARK[Math.floor(r() * DARK.length)];
        (isLit ? lit : dark).push({ ...place(u + thick / 2, thick), z: z - len / 2, len, color });
        z -= len + r() * 0.5;
      }
      u += thick + r() * 0.03;
    }
  };
  // Side walls: the bookshelves, dense, a third of them lit.
  for (const sx of [-1, 1]) run((y, t) => ({ x: sx * CW, y, sx: 0.12, sy: t }), -CH, CH, 0.24, 0.03, 0.16);
  // Ceiling and floor: the lattice, sparse and dark.
  for (const sy of [-1, 1]) run((x, t) => ({ x, y: sy * CH, sx: t, sy: 0.08 }), -CW, CW, 0.12, 0.04, 0.12);
  const frames = [];
  for (let z = 0; z > -SEG; z -= 4) {
    frames.push({ x: 0, y: CH, sx: 2 * CW, sy: 0.05, z, len: 0.05 }, { x: 0, y: -CH, sx: 2 * CW, sy: 0.05, z, len: 0.05 });
    frames.push({ x: CW, y: 0, sx: 0.05, sy: 2 * CH, z, len: 0.05 }, { x: -CW, y: 0, sx: 0.05, sy: 2 * CH, z, len: 0.05 });
  }
  return { lit, dark, frames };
}
const corridor = new THREE.Group();
scene.add(corridor);
{
  const { lit, dark, frames } = segment();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const COPIES = [SEG, 0, -SEG, -2 * SEG];
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const c = new THREE.Color();
  const fill = (items, material, colored) => {
    const mesh = new THREE.InstancedMesh(box, material, items.length * COPIES.length);
    let k = 0;
    for (const off of COPIES) for (const s of items) {
      m4.compose(new THREE.Vector3(s.x, s.y, s.z + off), q, new THREE.Vector3(s.sx, s.sy, s.len));
      mesh.setMatrixAt(k, m4);
      if (colored) mesh.setColorAt(k, c.set(s.color));
      k += 1;
    }
    mesh.frustumCulled = false;
    corridor.add(mesh);
  };
  // Lit spines are light, not paint: unlit material so they glow out of the dark and fade only into fog.
  fill(lit, new THREE.MeshBasicMaterial({ color: 0xffffff }), true);
  fill(dark, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), true);
  fill(frames, new THREE.MeshBasicMaterial({ color: 0x9a6a38 }), false);
}
// Dust in the light, drifting with the corridor.
const DUST = 180;
const dustPos = new Float32Array(DUST * 3);
{
  const r = rng(5);
  for (let i = 0; i < DUST; i += 1) dustPos.set([(r() * 2 - 1) * CW * 0.95, (r() * 2 - 1) * CH * 0.95, -r() * SEG * 2 + SEG * 0.4], i * 3);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xf2d6a8, size: 0.03, transparent: true, opacity: 0.7, depthWrite: false }));
scene.add(dust);

// The fighters.
const DY = 1.45; // height between ranks
const SCALE = 0.44;
const LEAD = 1.25; // the leader floats this much bigger
const CAM_DIST = 7; // camera distance in front of the column: about five ranks fit on a phone
const FOCUS = 1.5; // the camera looks this far below the rank in focus, so it sits in the upper third with the next ones below
const FLOAT = 0.45;
let floaters = [];
const tagsEl = $('tags');
const dockEl = $('dock');
const ballEl = $('dball');
const st = { camY: -FOCUS, camV: 0, target: -FOCUS, fling: 0, sel: 0, frame: 0, at: -1, hop: null, ball: null, rest: 0 };
// The corridor, its dust and the wreckage ride with the camera's height, so scrolling never reaches a floor.
const rig = new THREE.Group();
scene.add(rig);
rig.add(corridor, dust);
const debris = new Debris(rig, { halfW: CW, halfH: CH, rng: rng(23) });

/** A fighter as a flat cutout for the dock: its silhouette in its color, ink outline, two eyes. Returns where its head is. */
function miniFighter(cast, color, size = 40) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const c = document.createElement('canvas');
  c.className = 'mini';
  c.width = size * dpr; c.height = size * dpr;
  c.style.width = `${size}px`; c.style.height = `${size}px`;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const parts = SHAPES[cast]().map((sh) => sh.extractPoints(24));
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const p of parts) for (const q of p.shape) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  const k = Math.min((size - 6) / (x1 - x0), (size - 4) / (y1 - y0));
  const X = (x) => size / 2 + (x - (x0 + x1) / 2) * k;
  const Y = (y) => size - 2 - (y - y0) * k; // standing on the bottom edge, so it sits on its platform
  const trace = (pts) => { pts.forEach((q, j) => (j ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y)))); g.closePath(); };
  g.beginPath();
  for (const p of parts) { trace(p.shape); for (const h of p.holes) trace(h); }
  g.fillStyle = color; g.fill('evenodd');
  g.lineWidth = 2; g.lineJoin = 'round'; g.strokeStyle = '#16181d'; g.stroke();
  const [fx, fy] = FACE[cast];
  const ex = (fx - 100) / 100; const ey = (100 - fy) / 100;
  for (const sx of [-1, 1]) {
    g.beginPath(); g.arc(X(ex + sx * 0.11), Y(ey + 0.03), 0.075 * k, 0, TAU); g.fillStyle = '#fffdf0'; g.fill();
    g.beginPath(); g.arc(X(ex + sx * 0.11) + 0.01 * k, Y(ey + 0.03), 0.04 * k, 0, TAU); g.fillStyle = '#16181d'; g.fill();
  }
  return { canvas: c, head: Y(y1) };
}

/** The dock number's personality, cooler toward the top and sadder toward the bottom (styles in the page's CSS). */
function tierOf(i, n) {
  if (i === 0) return 'fire';
  if (i === 1) return 'zap';
  if (i === 2) return 'bronze roman';
  if (i === n - 1) return 'last';
  if (i === n - 2 && n >= 5) return 'droop';
  return ['bounce', 'dizzy', 'jitter'][(i - 3) % 3]; // the middle of the pack, each one different from its neighbors
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/** Flips 3rd place's number to Roman numerals and back, now and then. */
function romanFlip() {
  const pool = [...dockEl.querySelectorAll('.lbl.roman:not(.flipping)')];
  if (pool.length && !REDUCED) {
    const e = pool[Math.floor(Math.random() * pool.length)];
    const flip = (text) => { e.classList.remove('flip'); void e.offsetWidth; e.classList.add('flip'); setTimeout(() => { e.textContent = text; }, 140); };
    e.classList.add('flipping');
    flip(ROMAN[Number(e.dataset.n)] || e.dataset.n);
    setTimeout(() => { flip(e.dataset.n); setTimeout(() => e.classList.remove('flipping'), 300); }, 1700);
  }
  setTimeout(romanFlip, 1800 + Math.random() * 2400);
}
setTimeout(romanFlip, 2000);

function slotFor(i) {
  if (i === 0) return new THREE.Vector3(0, 0, 0);
  // Down the column, swaying right and left so the stack reads as floating, not filed.
  return new THREE.Vector3((i % 2 ? 1 : -1) * (0.32 + 0.1 * ((i * 0.618) % 1)), -i * DY, -0.35 * ((i * 0.37) % 1));
}

function clear() {
  for (const f of floaters) {
    scene.remove(f.carrier);
    f.body.geo.dispose();
    f.body.mat.dispose();
  }
  floaters = [];
  tagsEl.textContent = '';
  for (const s of dockEl.querySelectorAll('.slot')) s.remove();
  st.at = -1;
  st.ball = null;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function build(fighters) {
  clear();
  fighters.forEach((f, i) => {
    const body = new SoftBody({ cast: f.cast, color: f.color, edge: 0.14, transmission: 0.14 });
    body.feel = { ...FEEL[f.cast], grav: 0, float: FLOAT }; // weightless: held at its float height, nothing to stand on
    const size = SCALE * (i === 0 ? LEAD : 1);
    body.group.scale.setScalar(size);
    body.group.position.y = -(FLOAT + body.height / 2) * size; // the carrier's origin is the body's middle, so it tumbles about it
    const carrier = new THREE.Group();
    carrier.add(body.group);
    const home = slotFor(i);
    carrier.position.copy(home);
    scene.add(carrier);
    const r = rng(i * 97 + 3);
    const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
    // Its plate: a rank badge, a sticker in its own color with its record, and a points block, all ink-outlined.
    const tag = el('div', `tag${i === 0 && f.points > 0 ? ' lead' : ''}`);
    tag.style.setProperty('--pc', f.color);
    const rk = el('div', 'rk');
    rk.append(el('span', '', String(i + 1)));
    const plate = el('div', 'plate');
    const chips = el('div', 'chips');
    chips.append(el('b', '', `${f.wins}–${f.losses}`));
    if (f.streak > 1) chips.append(el('b', 'hot', `W${f.streak}`));
    else if (f.streak < -1) chips.append(el('b', 'cold', `L${-f.streak}`));
    plate.append(el('div', 'nm', f.name), chips);
    const pt = el('div', 'pt');
    pt.append(el('b', '', String(f.points)), el('small', '', 'PTS'));
    tag.append(rk, plate, pt);
    tagsEl.append(tag);
    const stop = el('div', 'slot');
    stop.style.setProperty('--pc', f.color);
    stop.style.animationDelay = `${-(i * 0.9) % 3.6}s`;
    stop.setAttribute('role', 'button');
    stop.setAttribute('aria-label', `Fly to number ${i + 1}, ${f.name}`);
    const mini = miniFighter(f.cast, f.color);
    const lbl = el('div', `lbl ${tierOf(i, fighters.length)}`, String(i + 1));
    lbl.dataset.n = String(i + 1);
    stop.append(mini.canvas, el('div', 'pf'), lbl);
    dockEl.append(stop);
    floaters.push({ f, body, carrier, home, ph, tag, stop, mini, spin: 0, roll: 0, tilt: 0 });
  });
  select(Math.min(st.sel, floaters.length - 1), true);
  st.camY = st.target;
}

function select(i, quiet) {
  if (!floaters.length) return;
  st.sel = Math.max(0, Math.min(floaters.length - 1, i));
  st.target = floaters[st.sel].home.y - FOCUS;
  st.fling = 0;
  floaters.forEach((g, k) => { g.tag.classList.toggle('on', k === st.sel); });
  if (!quiet) post({ type: 'line' });
}

// The dock: tap a platform, or drag along it, to fly to that rank.
function slotAt(clientX) {
  let best = 0; let bd = Infinity;
  floaters.forEach((g, i) => {
    const r = g.stop.getBoundingClientRect();
    const d = Math.abs(clientX - (r.left + r.width / 2));
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
let scrubbing = false;
dockEl.addEventListener('pointerdown', (e) => {
  if (!floaters.length) return;
  scrubbing = true;
  dockEl.setPointerCapture(e.pointerId);
  const i = slotAt(e.clientX);
  if (i !== st.sel || Math.abs(st.target - (floaters[i].home.y - FOCUS)) > 0.01) select(i, true);
});
dockEl.addEventListener('pointermove', (e) => {
  if (!scrubbing) return;
  const i = slotAt(e.clientX);
  if (i !== st.sel) select(i, true);
});
const endScrub = () => { scrubbing = false; };
dockEl.addEventListener('pointerup', endScrub);
dockEl.addEventListener('pointercancel', endScrub);

/** Where the ball sits on fighter i's head, in dock coordinates. */
function perch(i) {
  const d = dockEl.getBoundingClientRect();
  const m = floaters[i].mini;
  const r = m.canvas.getBoundingClientRect();
  return { x: r.left + r.width / 2 - d.left, y: r.top + m.head * (r.height / 40) - d.top - 10 };
}
function hopTo(i) {
  if (i === st.at || !floaters[i]) return;
  const now = performance.now();
  if (st.at < 0 || !st.ball) {
    st.ball = perch(i);
    st.rest = now;
  } else {
    // Take off from wherever the ball is drawn right now (mid-bounce or mid-hop), never from a remembered spot.
    st.hop = { from: { ...st.ball }, t0: now, dur: 360, h: 22 + 5 * Math.abs(i - st.at), i };
    const from = floaters[st.at].stop; // the platform it leaves dips under the push-off
    from.classList.add('land');
    setTimeout(() => from.classList.remove('land'), 120);
    post({ type: 'line' });
  }
  floaters.forEach((g, k) => g.stop.classList.toggle('on', k === i));
  st.at = i;
}
function drawBall(now) {
  if (!st.ball || st.at < 0) { ballEl.style.opacity = '0'; return; }
  ballEl.style.opacity = '1';
  // The head it is heading for is measured every frame: platforms bob and the active cutout grows, so a target taken
  // at takeoff would be stale by landing.
  const to = perch(st.at);
  let x; let y; let sx = 1; let sy = 1;
  if (st.hop) {
    const u = Math.min(1, (now - st.hop.t0) / st.hop.dur);
    x = st.hop.from.x + (to.x - st.hop.from.x) * u;
    y = st.hop.from.y + (to.y - st.hop.from.y) * u - st.hop.h * 4 * u * (1 - u);
    const squash = u < 0.12 ? 1 - u / 0.12 : u > 0.88 ? (u - 0.88) / 0.12 : 0;
    sx = 1 + 0.2 * squash; sy = 1 - 0.2 * squash;
    if (u >= 1) {
      const g = floaters[st.hop.i];
      if (g) { g.stop.classList.add('land'); setTimeout(() => g.stop.classList.remove('land'), 140); }
      st.hop = null;
      st.rest = now; // the bounce starts from the head, so there is no jump
    }
  } else {
    // Resting: it keeps bouncing on their head, like it is about to be served. Squashes a little on each touch.
    const ph = (now - st.rest) / 300;
    x = to.x;
    y = to.y - 8 * Math.abs(Math.sin(ph));
    const touch = Math.max(0, 1 - Math.abs(Math.sin(ph)) * 6);
    sx = 1 + 0.14 * touch; sy = 1 - 0.14 * touch;
  }
  st.ball = { x, y };
  ballEl.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
}

window.setStandings = (d) => {
  build(d.fighters);
};

// Touch: drag flies through the ranks, a tap pokes whoever it lands on.
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
const canvas = $('c');
canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, lastY: e.clientY, t: performance.now(), lastT: performance.now(), moved: false };
  st.fling = 0;
});
canvas.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dy = e.clientY - down.lastY;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
  if (!down.moved) return;
  const now = performance.now();
  const k = (2 * CAM_DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / window.innerHeight; // the column tracks the finger 1:1
  st.target = clampTarget(st.target + dy * k);
  const dtm = Math.max(1, now - down.lastT);
  down.v = (dy * k) / (dtm / 1000);
  down.lastY = e.clientY; down.lastT = now;
});
const endDrag = (e) => {
  if (!down) return;
  if (!down.moved && performance.now() - down.t < 350) tap(e.clientX, e.clientY);
  else if (down.v) st.fling = Math.max(-14, Math.min(14, down.v));
  down = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { down = null; });

function clampTarget(y) {
  const top = 0.3 - FOCUS;
  const bottom = (floaters.length ? floaters[floaters.length - 1].home.y : 0) - FOCUS - 0.3;
  return Math.max(bottom, Math.min(top, y));
}

function tap(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(floaters.map((g) => g.body.mesh), false);
  if (!hits.length) {
    if (debris.knock(ray)) post({ type: 'poke' });
    return;
  }
  const hit = hits[0];
  const i = floaters.findIndex((g) => g.body.mesh === hit.object);
  const g = floaters[i];
  g.body.group.updateMatrixWorld();
  const inv = new THREE.Matrix4().copy(g.body.group.matrixWorld).invert();
  const p = hit.point.clone().applyMatrix4(inv);
  const dir = ray.ray.direction.clone().transformDirection(inv);
  g.body.poke(p, dir, 7, 0.5);
  g.body.spin(hit.point.x > g.carrier.position.x ? -3 : 3, 1.2);
  g.spin += hit.point.x > g.carrier.position.x ? -1.4 : 1.4;
  g.roll += 0.8;
  g.body.mood.happy = 0.9;
  g.tag.classList.remove('pop');
  void g.tag.offsetWidth; // restart the jiggle
  g.tag.classList.add('pop');
  post({ type: 'poke' });
  select(i, true); // the poke already buzzed
}

function resize() {
  const w = window.innerWidth; const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const v3 = new THREE.Vector3();
let clock = 0;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  const t = clock;
  st.frame += 1;

  // The corridor flows toward you; one segment later it is exactly where it started.
  corridor.position.z = REDUCED ? 0 : (t * 0.6) % SEG;
  dust.position.z = REDUCED ? 0 : (t * 0.6) % SEG;

  // Camera: fling, then a critically damped spring onto the target depth.
  if (st.fling) {
    st.target = clampTarget(st.target + st.fling * dt);
    st.fling *= Math.exp(-4 * dt);
    if (Math.abs(st.fling) < 0.05) st.fling = 0;
  }
  const w = TAU * 1.4;
  st.camV += (-w * w * (st.camY - st.target) - 2 * w * st.camV) * dt;
  st.camY += st.camV * dt;
  const near = floaters.length ? Math.max(0, Math.min(floaters.length - 1, Math.round(-(st.camY + FOCUS) / DY))) : 0;
  camera.position.set(0.06 * Math.sin((t * TAU) / 9), st.camY + 0.15 + 0.04 * Math.sin((t * TAU) / 7), CAM_DIST);
  camera.lookAt(0, st.camY, -6);
  rig.position.y = st.camY;
  if (floaters.length) hopTo(near);
  drawBall(now);
  debris.update(dt, CAM_DIST, REDUCED);

  const amp = REDUCED ? 0.3 : 1;
  floaters.forEach((g, i) => {
    const [a, b, c, d] = g.ph;
    g.spin *= Math.exp(-0.7 * dt);
    g.roll *= Math.exp(-0.7 * dt);
    g.carrier.rotation.set(
      amp * 0.19 * Math.sin((t * TAU) / 7 + b) + g.roll,
      amp * 0.4 * Math.sin((t * TAU) / 11 + c) + g.spin,
      amp * 0.3 * Math.sin((t * TAU) / 9 + a) + 0.5 * g.roll,
    );
    g.carrier.position.set(g.home.x, g.home.y + amp * 0.08 * Math.sin((t * TAU) / 5 + d), g.home.z);
    g.body.simulate(dt, t + i * 0.7);
    const off = Math.abs(g.home.y - st.camY);
    // Off screen: skip drawing. Near the edges: draw every other frame.
    const onScreen = off < 4.2;
    if (onScreen && (off < 3 || (st.frame + i) % 2 === 0)) g.body.render(t + i * 0.7);
    g.body.group.visible = onScreen;

    // Its plate hangs just under it and swings after the fighter's roll on a lag.
    v3.copy(g.carrier.position);
    v3.y -= SCALE * (i === 0 ? LEAD : 1) * 0.95;
    v3.project(camera);
    const fade = onScreen ? Math.max(0, Math.min(1, 1 - (off - 3.1) / 0.6)) : 0;
    g.tilt += (g.carrier.rotation.z * 0.5 - g.tilt) * (1 - Math.exp(-5 * dt));
    const s = i === 0 ? 1 : 0.86;
    const x = (v3.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v3.y * 0.5 + 0.5) * window.innerHeight;
    // Plates fade out as they slide down under the dock, so its numbers never sit on top of a plate's.
    const dockTop = dockEl.getBoundingClientRect().top;
    const underDock = Math.max(0, Math.min(1, (dockTop - 10 - y) / 60));
    g.tag.style.opacity = (fade * underDock).toFixed(3);
    g.tag.style.zIndex = String(100 - i);
    g.tag.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translateX(-50%) rotate(${(g.tilt * 57.3).toFixed(2)}deg) scale(${s.toFixed(3)})`;
  });

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
post({ type: 'ready' });
