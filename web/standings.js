// Standings: the tesseract. Every fighter is its real jelly body (web/jelly-core.js), weightless in the void like an astronaut,
// ranked by depth: the leader floats nearest, the rest drift away down a corridor of books smeared through time.
// After docs/mo-design/vids/blackhole-scene-interstellar.mov (the shelves behind the bookcase: streaks of cream, amber, rust,
// rose and slate on black, warm lattice light).
//
// Motion spec.
// - Corridor: a 24-unit segment tiled four deep, flowing toward the camera at 0.6 units/s, so the hold is never frozen.
//   Lattice frames every 4 units. Fog from 3 to 24 swallows the far end.
// - Fighters: no gravity, held at their float height by the jelly's own float spring (0.9 Hz). The carrier tumbles
//   +-17 deg roll on a 9 s sine, +-11 deg pitch on 7 s, +-23 deg yaw on 11 s, each with its own phase, and bobs 0.08 on 5 s.
// - Camera: rides depth on a spring at 1.4 Hz, damping ratio 1 (no bounce on a camera). Drag to fly through the ranks,
//   with a fling that decays at 4/s. Tap a fighter to fly to it.
// - Tap: pokes the jelly where your finger hit (power 7, sigma 0.5), spins it, and kicks the carrier's tumble 1.4 rad/s,
//   decaying at 0.7/s, so it rolls away and drifts back.
import * as THREE from 'three';

import { FEEL, SoftBody } from './jelly-core.js';

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
scene.fog = new THREE.Fog(VOID, 3, 24);
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
const DZ = 2.4; // depth between ranks
const SCALE = 0.44;
const CAM_BACK = 4.8; // camera distance in front of the fighter it is looking at
const FLOAT = 0.45;
let floaters = [];
const tagsEl = $('tags');
const railEl = $('rail');
const st = { camZ: CAM_BACK, camV: 0, target: CAM_BACK, fling: 0, sel: 0, frame: 0 };

function slotFor(i) {
  if (i === 0) return new THREE.Vector3(0, 0.1, 0);
  // Behind the leader they scatter to the four corners in turn (upper right, lower left, upper left, lower right), so no one hides behind anyone.
  const sx = i % 4 === 1 || i % 4 === 0 ? 1 : -1;
  const sy = i % 2 ? 1 : -1;
  return new THREE.Vector3(sx * (0.6 + 0.12 * ((i * 0.618) % 1)), sy * (1.0 + 0.25 * ((i * 0.37) % 1)), -i * DZ);
}

function clear() {
  for (const f of floaters) {
    scene.remove(f.carrier);
    f.body.geo.dispose();
    f.body.mat.dispose();
  }
  floaters = [];
  tagsEl.textContent = '';
  railEl.textContent = '';
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
    body.group.scale.setScalar(SCALE);
    body.group.position.y = -(FLOAT + body.height / 2) * SCALE; // the carrier's origin is the body's middle, so it tumbles about it
    const carrier = new THREE.Group();
    carrier.add(body.group);
    const home = slotFor(i);
    carrier.position.copy(home);
    scene.add(carrier);
    const r = rng(i * 97 + 3);
    const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
    const tag = el('div', `tag${i === 0 && f.points > 0 ? ' lead' : ''}`);
    tag.append(el('b', 'rk', String(i + 1)));
    const mid = el('div');
    mid.append(el('div', 'nm', f.name), el('div', 'sub', `${f.wins}–${f.losses}${f.streak > 1 ? `  W${f.streak}` : f.streak < -1 ? `  L${-f.streak}` : ''}`));
    tag.append(mid, el('div', 'pt', String(f.points)));
    tagsEl.append(tag);
    const stop = el('button', '', String(i + 1));
    stop.setAttribute('aria-label', `Fly to number ${i + 1}, ${f.name}`);
    stop.addEventListener('click', () => select(i, false));
    railEl.append(stop);
    floaters.push({ f, body, carrier, home, ph, tag, stop, spin: 0, roll: 0 });
  });
  select(Math.min(st.sel, floaters.length - 1), true);
  st.camZ = st.target;
}

function select(i, quiet) {
  if (!floaters.length) return;
  st.sel = Math.max(0, Math.min(floaters.length - 1, i));
  st.target = floaters[st.sel].home.z + CAM_BACK;
  st.fling = 0;
  floaters.forEach((g, k) => { g.tag.classList.toggle('on', k === st.sel); g.stop.classList.toggle('on', k === st.sel); });
  if (!quiet) post({ type: 'line' });
}

// Matches along the bottom: each one pushes in under the finger and opens its card.
function matchStrip(matches) {
  const box = $('matches');
  box.textContent = '';
  $('empty').style.display = matches.length ? 'none' : 'block';
  for (const m of matches) {
    const b = el('button', 'm');
    const spine = el('i');
    spine.style.background = m.color;
    const txt = el('div');
    const names = el('div', 'mn');
    const a = el('span', m.winner === 'a' ? 'w' : '', m.a);
    const z = el('span', m.winner === 'b' ? 'w' : '', m.b);
    names.append(a, document.createTextNode('  vs  '), z);
    txt.append(names, el('div', 'ms', `${m.score}  ·  ${m.court}`));
    b.append(spine, txt);
    b.addEventListener('click', () => post({ type: 'match', id: m.id }));
    box.append(b);
  }
}

window.setStandings = (d) => {
  build(d.fighters);
  matchStrip(d.matches);
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
  const k = 0.014; // units of depth per pixel: a full-screen drag covers about six ranks
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

function clampTarget(z) {
  const near = CAM_BACK + 0.6;
  const far = (floaters.length ? floaters[floaters.length - 1].home.z : 0) + CAM_BACK - 0.6;
  return Math.max(far, Math.min(near, z));
}

function tap(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(floaters.map((g) => g.body.mesh), false);
  if (!hits.length) return;
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
  st.camV += (-w * w * (st.camZ - st.target) - 2 * w * st.camV) * dt;
  st.camZ += st.camV * dt;
  const near = floaters.length ? Math.max(0, Math.min(floaters.length - 1, Math.round((CAM_BACK - st.camZ) / DZ))) : 0;
  const lookX = floaters[near] ? floaters[near].home.x * 0.35 : 0;
  camera.position.set(lookX + 0.06 * Math.sin((t * TAU) / 9), 0.25 + 0.04 * Math.sin((t * TAU) / 7), st.camZ);
  camera.lookAt(lookX * 0.6, 0, st.camZ - 6);
  floaters.forEach((g, k) => { g.stop.classList.toggle('on', k === near); });

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
    const dist = st.camZ - g.home.z;
    // Far ones are mostly fog: draw them every other frame, and not at all past the fog.
    if (dist > -0.5 && dist < 26 && (dist < 7 || (st.frame + i) % 2 === 0)) g.body.render(t + i * 0.7);
    g.body.group.visible = dist > -0.5 && dist < 26;

    // Its line hangs just under it, sized and faded by distance.
    v3.copy(g.carrier.position);
    v3.y -= SCALE * 0.95;
    v3.project(camera);
    const show = dist > 0.8 && dist < 11 && v3.z < 1;
    const fade = show ? Math.max(0, Math.min(1, 1 - (dist - 5.5) / 4.5)) : 0;
    const s = Math.max(0.55, Math.min(1.15, 4.2 / dist));
    const x = (v3.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v3.y * 0.5 + 0.5) * window.innerHeight;
    g.tag.style.opacity = fade.toFixed(3);
    g.tag.style.zIndex = String(100 - i);
    g.tag.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translateX(-50%) scale(${s.toFixed(3)})`;
  });

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
post({ type: 'ready' });
