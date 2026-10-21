// The domain: where retired gear goes. Every racket you have worn out stands planted head-first in a field of broken court
// concrete, grip up like a sword hilt; dead shoes hang off the grips by their laces. A red string cord, knotted, runs across the
// sky. Your fighter stands on a pillar and a ghost made of old gear looms behind it. Drawn like a manga page: paper and ink,
// ink outlines, the sky going black overhead, one red.
//
// The domain is entered on purpose. The page opens outside it: paper ground, your fighter, the ghost holding the gear you use.
// Press and hold your fighter to expand it; back collapses it into the ground again.
//
// Motion spec. Everything integrates at 1/120 s.
// - Charge: holding your fighter fills 0 to 1 over 1.1 s. Ink closes in round it, the jelly squashes, the ghost leans down over
//   it and the camera trembles; a tick at each quarter. Let go early and it all eases back (3 per s).
// - Expansion (at full charge): ink covers the page, the title stamps in at 0.15 s, the ink lifts 0.3-0.9 s. Pillars rise out of the
//   ground on a 2.2 Hz spring, ratio 0.55; rackets shoot up on 2.6 Hz, ratio 0.45, staggered by distance from the fighter
//   (60 ms per unit), and twang when they pass their rest. The cord draws itself across the sky 0.6-1.7 s. The ghost swells in.
// - Twang: a planted racket rocks about the point it enters the ground. theta'' = -w^2 theta - 2 zeta w theta', 4.2 Hz, zeta 0.07,
//   so it buzzes for about a second and a half like a sword stuck in a beam.
// - Pull: drag a racket up. It sticks (static friction 0.1 of the pull), then breaks loose in jerks: each jerk throws dirt and a tick.
//   Drag sideways and it leans with your finger. Let go early and it sinks back. Pull it all the way and it comes free and flies
//   to your face on a 3 Hz, ratio 0.8 spring, turning slowly, with its record on the panel.
// - Plant: tap anywhere and it goes back: a 0.5 s arc, driven in, dirt burst, camera shake (6 Hz, ratio 0.25), twang.
// - The ghost bobs on a 4.6 s sine; tapping it or your fighter pokes the jelly.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { SoftBody } from './jelly-core.js';
import { post } from './lib/bridge.js';
import { createSlide } from './lib/slide.js';

const INK = 0x16181d;
const PAPER = 0xefece5;
const CLAY = 0xe2562f;
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Seeded random, so the field is laid out the same every visit. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__still });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
scene.fog = new THREE.Fog(PAPER, 9, 24);

const tex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// The sky: black overhead going to paper at the horizon, as in the panel, with a few speed lines.
const paperSky = tex(16, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#e4e0d6'); gr.addColorStop(0.6, '#efece5'); gr.addColorStop(1, '#efece5');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const inkSky = tex(16, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#0e0f12'); gr.addColorStop(0.28, '#24262b'); gr.addColorStop(0.5, '#8d8b86'); gr.addColorStop(0.64, '#efece5'); gr.addColorStop(1, '#efece5');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
scene.background = paperSky;

scene.add(new THREE.HemisphereLight(0xffffff, 0x9a958a, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-4, 7, 5);
scene.add(sun);

// Manga shading: three flat tones, and an ink line round everything.
const tones = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
tones.minFilter = tones.magFilter = THREE.NearestFilter;
tones.needsUpdate = true;
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: tones, ...extra });
const lineMat = (thick) => new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { thick: { value: thick }, color: { value: new THREE.Color(INK) } }]),
  vertexShader: `uniform float thick;
#include <fog_pars_vertex>
void main(){ vec4 mvPosition = modelViewMatrix * vec4(position + normal * thick, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
  fragmentShader: `uniform vec3 color;
#include <fog_pars_fragment>
void main(){ gl_FragColor = vec4(color, 1.0);
#include <fog_fragment>
}`,
  side: THREE.BackSide, fog: true,
});
const LINE = { thin: lineMat(0.012), mid: lineMat(0.02), fat: lineMat(0.035) };
/** An ink outline: a copy of the mesh pushed out along its normals, drawn back faces only. */
function inked(mesh, line = LINE.thin) {
  const hull = new THREE.Mesh(mesh.geometry, line);
  hull.raycast = () => {};
  mesh.add(hull);
  return mesh;
}
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

// ---------- Ground and rubble ----------
const groundTex = tex(512, 512, (g, w, h) => {
  g.fillStyle = '#e7e2d6'; g.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < 900; i += 1) {
    g.fillStyle = `rgba(22,24,29,${0.08 + r() * 0.3})`;
    const s = 1 + r() * 3.5;
    g.fillRect(r() * w, r() * h, s, s * (0.5 + r()));
  }
  g.strokeStyle = 'rgba(22,24,29,.35)'; g.lineWidth = 1.4;
  for (let i = 0; i < 40; i += 1) { const x = r() * w; const y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k += 1) g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 30); g.stroke(); }
});
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(14, 14);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshToonMaterial({ map: groundTex, gradientMap: tones }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Broken concrete: cream with ink cracks and hatching on the shadow side.
const crackTex = tex(256, 512, (g, w, h) => {
  g.fillStyle = '#f2eee5'; g.fillRect(0, 0, w, h);
  const r = rng(11);
  g.strokeStyle = '#16181d'; g.lineCap = 'round';
  for (let i = 0; i < 16; i += 1) {
    let x = r() * w; let y = r() * h;
    g.lineWidth = 1 + r() * 2.2;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k += 1) { x += (r() - 0.5) * 50; y += 10 + r() * 40; g.lineTo(x, y); }
    g.stroke();
  }
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(22,24,29,.5)';
  for (let y = h * 0.62; y < h; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 14); g.stroke(); }
  for (let i = 0; i < 260; i += 1) { g.fillStyle = `rgba(22,24,29,${0.15 + r() * 0.4})`; g.fillRect(r() * w, r() * h, 2, 2); }
});
const concrete = new THREE.MeshToonMaterial({ map: crackTex, gradientMap: tones });

const rise = []; // things the expansion lifts out of the ground: { g, y0, s: {x, v}, delay }
const pillars = [];
function slab(w, h, d, x, y, z, rx, ry, rz, delay = 0) {
  const g = new THREE.Group();
  const m = inked(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.03), concrete), LINE.mid);
  g.add(m);
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  scene.add(g);
  pillars.push(m);
  // Asleep, it is buried deep enough that no corner of it shows, however it is tilted.
  const down = -(y + Math.max(w, h, d) + 0.3);
  rise.push({ g, y0: y, s: { x: down, v: 0 }, down, delay, hz: 2.2, ratio: 0.55 });
  return g;
}

const R = rng(42);
// Your pillar, left of center, with a crossbar like a grave marker, and the ghost's leaning post on the right.
const YOU_AT = new THREE.Vector3(-0.62, 2.35, -0.9);
slab(0.5, 2.35, 0.5, YOU_AT.x, 2.35 / 2, YOU_AT.z, 0, 0.25, 0.02, 0);
const youPillar = rise[rise.length - 1]; // your fighter rides it up out of the ground
const OUT_SPOT = new THREE.Vector3(-0.55, 0, -0.45); // where your fighter stands outside the domain
slab(1.5, 0.28, 0.32, YOU_AT.x + 0.15, 1.6, YOU_AT.z + 0.05, 0, 0.3, -0.18, 0.05);
slab(0.42, 2.9, 0.42, 1.05, 1.3, -2.1, 0, -0.2, -0.16, 0.1);
slab(1.3, 0.26, 0.3, 1.0, 2.05, -2.0, 0, -0.3, 0.22, 0.12);
// Crosses and leaning slabs further back.
for (let i = 0; i < 9; i += 1) {
  const z = -2.6 - R() * 7;
  const x = (R() - 0.5) * (3.4 + -z * 0.8);
  const h = 1.2 + R() * 2.2;
  const lean = (R() - 0.5) * 0.7;
  slab(0.32 + R() * 0.3, h, 0.32 + R() * 0.2, x, h / 2 - 0.1, z, (R() - 0.5) * 0.3, R() * 3, lean, 0.15 + R() * 0.3);
  if (R() < 0.6) slab(0.9 + R() * 0.8, 0.22, 0.26, x + lean * h * -0.35, h * (0.55 + R() * 0.25), z + 0.1, 0, R() * 3, (R() - 0.5) * 0.6, 0.25 + R() * 0.3);
}
// The rubble field: broken blocks heaped low.
for (let i = 0; i < 26; i += 1) {
  const z = 1.2 - R() * 9;
  const x = (R() - 0.5) * (4 + -z * 0.7);
  if (Math.abs(x - YOU_AT.x) < 0.4 && Math.abs(z - YOU_AT.z) < 0.4) continue;
  if (z > -0.6 && Math.abs(x - 0.2) < 1.35) continue; // the stage where the gear in use stands
  const s = 0.25 + R() * 0.7;
  slab(s * (1 + R()), s * (0.5 + R() * 0.6), s * (0.8 + R()), x, s * 0.2, z, (R() - 0.5) * 0.9, R() * 3, (R() - 0.5) * 0.9, 0.1 + R() * 0.35);
}

// Little blades stuck all over the concrete, as in the panel: dark grips with a round guard.
{
  const N = 170;
  const grip = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 6).translate(0, 0.12, 0), toon(INK), N);
  const guard = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 10), toon(0x3a3c42), N);
  const rr = rng(5);
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
  scene.updateMatrixWorld(true);
  let n = 0;
  for (let i = 0; i < N * 3 && n < N; i += 1) {
    const p = pillars[Math.floor(rr() * pillars.length)];
    const box = p.geometry.parameters || { width: 0.4, height: 1, depth: 0.4 };
    const face = Math.floor(rr() * 3);
    const sgn = rr() < 0.5 ? -1 : 1;
    const local = new THREE.Vector3((rr() - 0.5) * box.width, (rr() - 0.5) * box.height, (rr() - 0.5) * box.depth);
    const nrm = new THREE.Vector3();
    if (face === 0) { local.x = sgn * box.width / 2; nrm.x = sgn; } else if (face === 1) { local.z = sgn * box.depth / 2; nrm.z = sgn; } else { local.y = box.height / 2; nrm.y = 1; }
    const wp = local.clone().applyMatrix4(p.matrixWorld);
    const wn = nrm.transformDirection(p.matrixWorld).add(new THREE.Vector3((rr() - 0.5) * 0.9, (rr() - 0.2) * 0.9, (rr() - 0.5) * 0.9)).normalize();
    if (wp.y < 0.05) continue;
    q.setFromUnitVectors(up, wn);
    const s = 0.6 + rr() * 0.9;
    m4.compose(wp, q, new THREE.Vector3(s, s, s));
    grip.setMatrixAt(n, m4);
    m4.compose(wp.clone().addScaledVector(wn, 0.02 * s), q, new THREE.Vector3(s, s, s));
    guard.setMatrixAt(n, m4);
    n += 1;
  }
  grip.count = guard.count = n;
  scene.add(grip, guard);
  rise.push({ g: grip, y0: 0, s: { x: -7, v: 0 }, down: -7, delay: 0.3, hz: 2, ratio: 0.7 });
  rise.push({ g: guard, y0: 0, s: { x: -7, v: 0 }, down: -7, delay: 0.3, hz: 2, ratio: 0.7 });
}

// ---------- The red cord ----------
// A mizuhiki cord: several red strands bound side by side, swooping across the sky, tied in a knot over the middle.
const cordTex = tex(8, 64, (g, w, h) => {
  for (let y = 0; y < h; y += 1) { const k = y % 8; g.fillStyle = k === 0 ? '#7a2414' : k === 1 ? '#f08a6a' : '#e2562f'; g.fillRect(0, y, w, 1); }
});
cordTex.wrapS = cordTex.wrapT = THREE.RepeatWrapping;
cordTex.repeat.set(1, 3);
const cordMat = toon(0xffffff, { map: cordTex });
const cords = [];
function cord(points, radius = 0.06) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, 160, radius, 10, false);
  const m = inked(new THREE.Mesh(geo, cordMat), LINE.thin);
  m.hull = m.children[0];
  scene.add(m);
  cords.push(m);
  return m;
}
const KNOT = new THREE.Vector3(-0.15, 3.55, -2.4);
cord([[-4.2, 5.2, -3.6], [-2.6, 3.4, -3.0], [-1.5, 3.0, -2.6], [-0.75, 3.4, -2.45], [KNOT.x - 0.28, KNOT.y, KNOT.z]]);
cord([[KNOT.x + 0.28, KNOT.y, KNOT.z], [0.6, 3.15, -2.5], [1.6, 2.9, -2.7], [2.6, 3.6, -3.1], [4.2, 5.4, -3.8]]);
// The two big loops at the top corners.
cord([[-2.9, 6.6, -3.2], [-1.9, 4.6, -2.8], [-1.0, 5.1, -2.8], [-1.3, 5.8, -3.0], [-2.3, 5.2, -3.1], [-3.6, 4.3, -3.4]], 0.07);
cord([[3.0, 6.6, -3.2], [2.0, 4.6, -2.8], [1.2, 5.1, -2.8], [1.5, 5.8, -3.0], [2.5, 5.2, -3.1], [3.8, 4.3, -3.4]], 0.07);
const knot = inked(new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.06, 220, 12, 2, 3), cordMat), LINE.thin);
knot.position.copy(KNOT);
knot.scale.set(1, 0.85, 0.45);
scene.add(knot);

// ---------- Rackets, planted ----------
const tsukaTex = tex(128, 128, (g, w, h) => {
  // The sword-grip wrap: ink cord crossing over a pale ground, leaving a row of diamonds.
  g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#efece5';
  for (const cx of [w * 0.25, w * 0.75]) {
    g.beginPath(); g.moveTo(cx, h * 0.16); g.lineTo(cx + w * 0.17, h * 0.5); g.lineTo(cx, h * 0.84); g.lineTo(cx - w * 0.17, h * 0.5); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, h * 0.48, w, 3);
});
tsukaTex.wrapS = tsukaTex.wrapT = THREE.RepeatWrapping;
tsukaTex.repeat.set(1, 6);
const bedTex = tex(256, 320, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(22,24,29,.85)'; g.lineWidth = 2;
  for (let x = 12; x < w; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 12; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});
const frameMat = toon(0xf4f1ea);
const gripMat = toon(0xffffff, { map: tsukaTex });
const darkMat = toon(0x2a2c31);
const bedMat = new THREE.MeshBasicMaterial({ map: bedTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true });
const pickMat = new THREE.MeshBasicMaterial({ visible: false });
const shadowTex = tex(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, 'rgba(22,24,29,.55)'); r.addColorStop(0.5, 'rgba(22,24,29,.2)'); r.addColorStop(1, 'rgba(22,24,29,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});

/** Where the ground cuts a planted racket, in its own units (the head's center is 0, the butt is at 1.6). */
const GROUND = 0.12;
const OUT = GROUND + 0.47; // how far it rises to clear the ground

function buildRacket() {
  const body = new THREE.Group();
  const head = inked(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.034, 10, 64), frameMat), LINE.thin);
  head.scale.set(1, 1.3, 1);
  body.add(head);
  const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 40), bedMat);
  bed.scale.set(0.31, 0.415, 1);
  body.add(bed);
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(s * 0.2, 0.36, 0);
    const b = new THREE.Vector3(s * 0.045, 0.8, 0);
    const arm = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, a.distanceTo(b), 8), frameMat), LINE.thin);
    arm.position.copy(a).add(b).multiplyScalar(0.5);
    arm.rotation.z = -Math.atan2(b.x - a.x, b.y - a.y);
    body.add(arm);
  }
  body.add(inked(at(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 8), frameMat), 0, 0.86, 0), LINE.thin));
  // A round guard where the throat meets the grip: the thing that makes it read as a sword.
  body.add(inked(at(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.024, 20), darkMat), 0, 0.93, 0), LINE.thin));
  const handle = inked(at(new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.056, 0.62, 8), gripMat), 0, 1.25, 0), LINE.thin);
  body.add(handle);
  body.add(inked(at(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.05, 10), darkMat), 0, 1.58, 0), LINE.thin));
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.9, 8), pickMat);
  hit.position.y = 0.75;
  body.add(hit);
  return { body, hit, bed, handle };
}

// Slots, nearest first: two giants in the foreground at the edges (cut by the frame, like the panel), then the field behind.
function slotList(n) {
  const out = [
    { p: new THREE.Vector3(-1.4, 0, 1.7), s: 1.75, tilt: [0.12, -0.24] },
    { p: new THREE.Vector3(1.6, 0, 1.25), s: 1.55, tilt: [-0.1, 0.18] },
    { p: new THREE.Vector3(-0.2, 0, -2.3), s: 1.05, tilt: [0.06, 0.1] },
    { p: new THREE.Vector3(-1.55, 0, -0.2), s: 1.0, tilt: [0.05, -0.28] },
    { p: new THREE.Vector3(1.75, 0, -0.6), s: 1.0, tilt: [0.0, 0.3] },
  ];
  const r = rng(99);
  for (let i = out.length; i < n; i += 1) {
    const z = -1.4 - (i - out.length) * 0.55 - r() * 0.6;
    const x = (r() - 0.5) * (3.6 + -z * 0.75);
    out.push({ p: new THREE.Vector3(x, 0, z), s: 0.75 + r() * 0.35, tilt: [(r() - 0.5) * 0.4, (r() - 0.5) * 0.6] });
  }
  return out.slice(0, n);
}

// ---------- Your fighter and the ghost ----------
const you = { body: null, carrier: new THREE.Group(), cast: null, color: null };
you.carrier.position.copy(YOU_AT);
you.carrier.scale.setScalar(0.34);
scene.add(you.carrier);
const ghost = { body: new SoftBody({ cast: 'ghost', color: '#ece6d6', edge: 0.16, transmission: 0.06 }), carrier: new THREE.Group(), grow: { x: 0, v: 0 } };
ghost.body.feel = { ...ghost.body.feel, alpha: Math.max(ghost.body.feel.alpha, 0.03) };
ghost.carrier.add(ghost.body.group);
ghost.carrier.position.set(0.75, 2.2, -2.6);
scene.add(ghost.carrier);
inked(ghost.body.mesh, LINE.mid);
ghost.body.mat.transmission = 0; // solid bone, not glass
ghost.body.mat.clearcoat = 0.3;
// Its own face: two black sockets with pinprick lights, and a wide open maw.
for (const e of ghost.body.eyes) e.visible = false;
ghost.sockets = [-1, 1].map((sx) => {
  const g = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), toon(INK));
  hole.scale.set(0.95, 1.5, 0.35);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  glint.position.set(0.012 * sx, 0.03, 0.04);
  g.add(hole, glint);
  g.userData = { sx, glint };
  ghost.body.face.add(g);
  return g;
});
// The bond: a thin red cord from your fighter to the ghost.
const bond = new THREE.Mesh(new THREE.BufferGeometry(), cordMat);
scene.add(bond);

function setYou(f) {
  if (!f) return;
  if (you.body && you.cast === f.cast) { you.body.setColor(f.color); return; }
  if (you.body) you.carrier.remove(you.body.group);
  you.body = new SoftBody({ cast: f.cast, color: f.color, edge: 0.13, transmission: 0.2 });
  inked(you.body.mesh, LINE.mid);
  you.carrier.add(you.body.group);
  you.cast = f.cast;
}

// ---------- Dirt ----------
const DUST = 260;
const dust = { p: new Float32Array(DUST * 3), v: new Float32Array(DUST * 3), life: new Float32Array(DUST), next: 0 };
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dust.p, 3));
const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x3a342b, size: 0.05, sizeAttenuation: true, fog: true }));
dustPts.frustumCulled = false;
scene.add(dustPts);
for (let i = 0; i < DUST; i += 1) dust.p[i * 3 + 1] = -10;
function burst(at, n, power) {
  for (let k = 0; k < n; k += 1) {
    const i = dust.next; dust.next = (dust.next + 1) % DUST;
    const a = Math.random() * TAU;
    const sp = power * (0.4 + Math.random());
    dust.p.set([at.x + Math.cos(a) * 0.08, at.y + 0.02, at.z + Math.sin(a) * 0.08], i * 3);
    dust.v.set([Math.cos(a) * sp * 0.6, sp * (0.8 + Math.random()), Math.sin(a) * sp * 0.6], i * 3);
    dust.life[i] = 0.6 + Math.random() * 0.5;
  }
}

// ---------- State ----------
const st = {
  clock: 0,
  open: false,
  t: 99, // seconds since the domain last opened or closed
  charge: { x: 0, holding: false, ticks: 0 },
  rackets: new Map(), // id -> racket
  shoes: new Map(),
  items: [],
  focus: null,
  held: null,
  yaw: { x: 0, v: 0, target: 0 },
  shake: { x: 0, v: 0 },
  queue: [],
  gone: new Map(), // where something in use was when it was retired
  row: null,
  cam: { pos: new THREE.Vector3(0, 3.0, 6.6), look: new THREE.Vector3(0, 1.3, -1) },
};

function makeRacket(it, slot) {
  const { body, hit } = buildRacket();
  const root = new THREE.Group();
  const wob = new THREE.Group();
  root.add(wob);
  wob.add(body);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(root, shadow);
  const r = { id: it.id, it, root, wob, body, hit, shadow, slot, e: { x: -3, v: 0 }, w: { x: 0, v: 0 }, lean: 0, mode: 'planted', pull: null, fly: null, hold: null, delay: 0, rose: false };
  hit.userData.racket = r;
  place(r);
  // The one the ghost is about to bury waits out of sight until it comes down.
  if (it.id === st.planting) { r.mode = 'waiting'; root.visible = false; shadow.visible = false; }
  return r;
}

/** Puts a racket back on its slot: upright, tilted, scaled by how much it was played. */
function place(r) {
  const s = r.slot.s * (0.82 + 0.3 * clamp((r.it.matches || 0) / 30, 0, 1));
  r.scale = s;
  r.root.position.copy(r.slot.p);
  r.root.quaternion.setFromEuler(new THREE.Euler(r.slot.tilt[0], 0, r.slot.tilt[1]));
  r.root.scale.setScalar(s);
  r.shadow.position.set(r.slot.p.x, 0.004, r.slot.p.z);
  r.shadow.scale.setScalar(s * 0.9);
}

function layout() {
  const rackets = st.items.filter((i) => i.kind === 'racket');
  // Most played stands nearest and biggest.
  const order = [...rackets].sort((a, b) => (b.matches || 0) - (a.matches || 0));
  const slots = slotList(Math.max(order.length, 1));
  const keep = new Set(order.map((i) => i.id));
  for (const [id, r] of st.rackets) if (!keep.has(id)) { r.root.removeFromParent(); r.shadow.removeFromParent(); st.rackets.delete(id); }
  // Planted rackets keep their spots; a new one takes the nearest free spot (on first load that is most played first).
  const taken = new Set([...st.rackets.values()].filter((r) => keep.has(r.id) && r.k < slots.length).map((r) => r.k));
  order.forEach((it) => {
    const had = st.rackets.get(it.id);
    if (had && had.k < slots.length) return;
    let k = 0;
    while (taken.has(k)) k += 1;
    taken.add(k);
    if (had) had.k = k; else it.k = k;
  });
  order.forEach((it) => {
    let r = st.rackets.get(it.id);
    const k = r ? r.k : it.k;
    if (!r) {
      r = makeRacket(it, slots[k]);
      r.k = k;
      r.delay = 0.35 + r.slot.p.distanceTo(YOU_AT) * 0.06;
      if (st.open && st.t > 1.2) { r.e.x = -3; r.delay = st.t + 0.05 * k; }
      st.rackets.set(it.id, r);
    }
    r.it = it;
    r.slot = slots[r.k];
    if (r.mode === 'planted') place(r);
  });
  // Shoes hang by their laces off the grips, nearest racket first; with no rackets, off your pillar's crossbar.
  const shoes = st.items.filter((i) => i.kind === 'shoes');
  const keepS = new Set(shoes.map((i) => i.id));
  for (const [id, s] of st.shoes) if (!keepS.has(id)) { s.g.removeFromParent(); st.shoes.delete(id); }
  shoes.forEach((it, k) => {
    let s = st.shoes.get(it.id);
    if (!s) { s = makeShoes(it); st.shoes.set(it.id, s); }
    s.it = it;
    s.on = order.length ? order[Math.min(order.length - 1, 2 + k)].id : null;
    s.side = k % 2 ? -1 : 1;
  });
}

/** A pair of court shoes. Hanging, toes down; standing, flat on the ground. */
function shoePair(hanging) {
  const pair = new THREE.Group();
  const upperMat = toon(0xf4f1ea);
  pair.userData.upperMat = upperMat;
  for (const sx of [-1, 1]) {
    const shoe = new THREE.Group();
    const upper = inked(new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.09, 0.3, 3, 0.04), upperMat), LINE.thin);
    upper.position.y = 0.02;
    const sole = inked(new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.035, 0.3, 2, 0.015), toon(0x2a2c31)), LINE.thin);
    sole.position.y = -0.045;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.02, 0.12), toon(CLAY));
    stripe.position.set(0, 0.02, 0.0);
    // The opening at the heel, and the laces down the top.
    const collar = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), toon(INK));
    collar.rotation.x = -Math.PI / 2; collar.scale.set(1, 1.5, 1); collar.position.set(0, 0.066, -0.08);
    for (let k = 0; k < 3; k += 1) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.012), toon(INK)); l.position.set(0, 0.066, 0.0 + k * 0.035); shoe.add(l); }
    shoe.add(upper, sole, stripe, collar);
    if (hanging) { shoe.position.set(sx * 0.07, 0, 0); shoe.rotation.set(1.4, sx * 0.25, sx * 0.12); } else { shoe.position.set(sx * 0.085, 0.064, 0); shoe.rotation.set(0, sx * 0.12, 0); }
    pair.add(shoe);
  }
  return pair;
}

function makeShoes(it) {
  const g = new THREE.Group();
  const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 4).translate(0, -0.5, 0), toon(INK));
  g.add(lace);
  const pair = shoePair(true);
  g.add(pair);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), pickMat);
  pair.add(hit);
  scene.add(g);
  const s = { g, lace, pair, hit, it, a: { x: 0.3, v: 0 }, b: { x: 0, v: 0 }, len: 0.38 };
  hit.userData.shoes = s;
  return s;
}

/** Called by the app: { you: { cast, color, name }, items: [{ id, kind, name, matches, record, lines: [] }], title, sub }. */
window.setDomain = (data) => {
  st.data = data;
  if (data.planting && !st.rackets.has(data.planting)) { st.planting = data.planting; st.queue.push(data.planting); }
  setYou(data.you);
  st.items = data.items || [];
  layout();
  setNow(data.gear);
  panel();
};

/** The ghost buries something new: it comes down from over the ghost's head and is driven in. */
window.plant = (id) => {
  if (st.open && st.t < 2.2) { if (!st.queue.includes(id)) st.queue.push(id); return; }
  const r = st.rackets.get(id);
  if (!r) return;
  r.root.visible = true;
  const from = st.gone.get(id) || ghost.carrier.position.clone().add(new THREE.Vector3(0, 1.4, 0.2));
  st.gone.delete(id);
  r.mode = 'fly';
  r.fly = { t: 0, dur: 0.75, from, fromQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI)), fromS: r.scale * 0.7, spin: 2 };
  r.e.x = 0.3;
  ghost.body.kick(0, -2.5, 0);
  post({ type: 'ghost' });
};


// ---------- What you use now: the duo holds it ----------
// Rackets in use float in front of the ghost, head up, fanned like blades it is holding: strings go brown and the grip greys as
// they wear, and a clay tag hangs off anything due. Shoes stand at the foot of your pillar, with the ball cans and overgrip rolls.
// Where something could go, a dashed outline waits; tap it to add one.
const NOW_RACKETS = [
  { p: new THREE.Vector3(0.06, 1.95, -0.55), rz: 0.4 },
  { p: new THREE.Vector3(0.6, 2.15, -0.7), rz: 0.0 },
  { p: new THREE.Vector3(1.1, 1.95, -0.55), rz: -0.4 },
];
const NOW_SHOES = [new THREE.Vector3(0.48, 0, 0.0), new THREE.Vector3(0.98, 0, -0.1)];
const CAN_AT = new THREE.Vector3(0.0, 0, 0.05);
const ROLL_AT = new THREE.Vector3(-0.42, 0, 0.12);
const DEAD = new THREE.Color(0xb39a68);
const now = { rackets: new Map(), shoes: new Map(), balls: null, grips: null, list: [], slotR: null, slotS: null, max: { racket: 3, shoes: 2 } };

function label(text, bg, fg, w = 0.62) {
  const t = tex(512, 112, (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = '#16181d'; g.lineWidth = 10; g.strokeRect(5, 5, cw - 10, ch - 10);
    g.fillStyle = fg; g.font = '800 52px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, cw / 2, ch / 2 + 3);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false }));
  sp.scale.set(w, w * 112 / 512, 1);
  sp.renderOrder = 4;
  sp.userData.text = text;
  return sp;
}
function setTag(o, text) {
  if (!text) { if (o.tag) o.tag.visible = false; return; }
  if (o.tag && o.tag.userData.text === text) { o.tag.visible = true; return; }
  if (o.tag) { scene.remove(o.tag); o.tag.material.map.dispose(); }
  o.tag = label(text, '#e2562f', '#16181d');
  scene.add(o.tag);
}
const rowsOf = (it) => it.rows || [];
const wornOf = (it, s) => (rowsOf(it).find((r) => r.s === s) || { worn: 0 }).worn;
const dueWord = (it) => { const r = rowsOf(it).filter((x) => x.worn >= 1).sort((a, b) => b.worn - a.worn)[0]; return r ? r.verb : (it.low ? 'ORDER MORE' : ''); };

function makeNowRacket(it) {
  const { body, hit, bed, handle } = buildRacket();
  const g = new THREE.Group();
  // Head up: flipped, and lifted so the racket's middle sits on the slot.
  body.rotation.z = Math.PI;
  body.position.y = 0.55;
  g.add(body);
  g.scale.setScalar(0.66);
  const r = { id: it.id, it, g, body, hit, spin: { x: 0, v: 0 }, sway: { x: 0, v: 0 }, ph: Math.random() * TAU, slot: 0, tag: null, rise: { x: -3, v: 0 } };
  r.gripMat = gripMat.clone(); handle.material = r.gripMat;
  const back = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: DEAD, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: true }));
  back.scale.copy(bed.scale); back.position.z = -0.004;
  body.add(back);
  r.back = back;
  hit.userData.now = r;
  scene.add(g);
  return r;
}
function nowRacketWear(r) {
  const ws = wornOf(r.it, 'strings'); const wo = wornOf(r.it, 'overgrip');
  r.back.material.opacity = 0.12 + 0.6 * clamp(ws, 0, 1);
  r.gripMat.color.set(0xffffff).lerp(new THREE.Color(0x8f8a80), clamp(wo, 0, 1));
  setTag(r, dueWord(r.it));
}

function makeNowShoes(it) {
  const g = new THREE.Group();
  const pair = shoePair(false);
  g.add(pair);
  g.scale.setScalar(1.7);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.36), pickMat);
  hit.position.y = 0.08;
  g.add(hit);
  const o = { id: it.id, it, g, pair, hit, hop: { x: 0, v: 0 }, tag: null };
  hit.userData.now = o;
  scene.add(g);
  return o;
}

// Ball cans: up to three on the ground; an open one has its lid off and a ball sitting in the mouth.
const canTex = tex(256, 128, (g, w, h) => {
  g.fillStyle = '#f2eee5'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#16181d'; g.fillRect(0, h * 0.3, w, h * 0.4);
  g.fillStyle = '#e2562f'; g.fillRect(0, h * 0.42, w, h * 0.16);
});
function makeCans() {
  const g = new THREE.Group();
  const cans = [];
  for (let k = 0; k < 4; k += 1) {
    const c = new THREE.Group();
    c.add(inked(at(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 18), toon(0xffffff, { map: canTex })), 0, 0.13, 0), LINE.thin));
    const lid = inked(at(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 18), toon(INK)), 0, 0.272, 0), LINE.thin);
    const ball = inked(at(new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), toon(0xd7f205)), 0, 0.29, 0), LINE.thin);
    c.add(lid, ball);
    c.userData = { lid, ball };
    c.position.set((k % 2) * 0.17 - 0.08, 0, Math.floor(k / 2) * -0.17);
    g.add(c);
    cans.push(c);
  }
  g.scale.setScalar(1.45);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), pickMat);
  hit.position.set(0, 0.18, -0.08);
  g.add(hit);
  g.position.copy(CAN_AT);
  scene.add(g);
  const o = { g, cans, hit, hop: { x: 0, v: 0 }, tag: null, it: null };
  hit.userData.now = o;
  return o;
}
// Overgrip rolls: little white wraps lying in a heap.
function makeRolls() {
  const g = new THREE.Group();
  const rolls = [];
  for (let k = 0; k < 4; k += 1) {
    const r = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 16), toon(0xf4f1ea)), LINE.thin);
    r.rotation.set(0, k * 0.7, Math.PI / 2);
    r.position.set((k % 2) * 0.12 - 0.06, 0.05 + (k > 1 ? 0.09 : 0), (k > 1 ? -0.03 : 0) + (k % 2) * -0.05);
    g.add(r);
    rolls.push(r);
  }
  g.scale.setScalar(1.45);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.32), pickMat);
  hit.position.y = 0.1;
  g.add(hit);
  g.position.copy(ROLL_AT);
  scene.add(g);
  const o = { g, rolls, hit, hop: { x: 0, v: 0 }, tag: null, it: null };
  hit.userData.now = o;
  return o;
}

// Dashed outlines where something could go.
const dashMat = new THREE.LineDashedMaterial({ color: CLAY, linewidth: 2, dashSize: 0.05, gapSize: 0.035, fog: false });
function dashed(points, closed) {
  const geo = new THREE.BufferGeometry().setFromPoints(closed ? [...points, points[0]] : points);
  const l = new THREE.Line(geo, dashMat);
  l.computeLineDistances();
  return l;
}
function racketOutline() {
  const g = new THREE.Group();
  const head = [];
  for (let k = 0; k < 48; k += 1) { const a = (k / 48) * TAU; head.push(new THREE.Vector3(Math.cos(a) * 0.33, 0.55 + Math.sin(a) * 0.43, 0)); }
  g.add(dashed(head, true));
  g.add(dashed([new THREE.Vector3(-0.2, 0.2, 0), new THREE.Vector3(-0.05, -0.25, 0), new THREE.Vector3(-0.055, -1.05, 0), new THREE.Vector3(0.055, -1.05, 0), new THREE.Vector3(0.05, -0.25, 0), new THREE.Vector3(0.2, 0.2, 0)], false));
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.7, 0.3), pickMat);
  hit.position.y = -0.1;
  g.add(hit);
  g.scale.setScalar(0.66);
  const tag = label('ADD A RACKET', '#efece5', '#16181d', 0.5);
  tag.position.set(0, -0.15, 0.05);
  tag.scale.multiplyScalar(1 / 0.66);
  g.add(tag);
  scene.add(g);
  const o = { g, hit, add: 'racket' };
  hit.userData.now = o;
  return o;
}
function shoesOutline() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let k = 0; k < 24; k += 1) { const a = (k / 24) * TAU; pts.push(new THREE.Vector3(sx * 0.085 + Math.cos(a) * 0.065, 0.004, Math.sin(a) * 0.16)); }
    g.add(dashed(pts, true));
  }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.4), pickMat);
  hit.position.y = 0.08;
  g.add(hit);
  g.scale.setScalar(1.7);
  const tag = label('ADD SHOES', '#efece5', '#16181d', 0.4);
  tag.position.set(0, 0.16, 0);
  tag.scale.multiplyScalar(1 / 1.7);
  g.add(tag);
  scene.add(g);
  const o = { g, hit, add: 'shoes' };
  hit.userData.now = o;
  return o;
}
now.slotR = racketOutline();
now.slotS = shoesOutline();
now.balls = makeCans();
now.grips = makeRolls();

/** The gear in use, from the app: [{ id, kind, name, stock, low, hasOpen, rows: [{ s, word, verb, text, worn }] }]. */
function setNow(list) {
  now.list = list || [];
  const rackets = now.list.filter((i) => i.kind === 'racket').slice(0, now.max.racket);
  for (const [id, r] of now.rackets) if (!rackets.find((i) => i.id === id)) { scene.remove(r.g); if (r.tag) scene.remove(r.tag); st.gone.set(id, r.g.getWorldPosition(new THREE.Vector3())); now.rackets.delete(id); burst(r.g.position, 20, 1.4); }
  rackets.forEach((it, k) => {
    let r = now.rackets.get(it.id);
    if (!r) { r = makeNowRacket(it); now.rackets.set(it.id, r); if (st.clock > 1) r.rise.x = -1; }
    r.it = it; r.slot = k;
    nowRacketWear(r);
  });
  now.slotR.g.visible = rackets.length < now.max.racket;
  now.slotR.k = rackets.length;
  const shoes = now.list.filter((i) => i.kind === 'shoes').slice(0, now.max.shoes);
  for (const [id, o] of now.shoes) if (!shoes.find((i) => i.id === id)) { scene.remove(o.g); if (o.tag) scene.remove(o.tag); now.shoes.delete(id); }
  shoes.forEach((it, k) => {
    let o = now.shoes.get(it.id);
    if (!o) { o = makeNowShoes(it); now.shoes.set(it.id, o); }
    o.it = it;
    o.g.position.copy(NOW_SHOES[k]);
    o.g.rotation.y = k ? -0.35 : 0.25;
    o.pair.userData.upperMat.color.set(0xf4f1ea).lerp(new THREE.Color(0xa49d8e), clamp(wornOf(it, 'soles'), 0, 1));
    setTag(o, dueWord(it));
  });
  now.slotS.g.visible = shoes.length < now.max.shoes;
  if (now.slotS.g.visible) { now.slotS.g.position.copy(NOW_SHOES[shoes.length]); }
  const balls = now.list.find((i) => i.kind === 'balls');
  now.balls.it = balls || null;
  now.balls.g.visible = !!balls;
  if (balls) {
    const shown = Math.min(3, balls.stock || 0) + (balls.hasOpen ? 1 : 0);
    now.balls.cans.forEach((c, k) => {
      c.visible = k < shown;
      const open = balls.hasOpen && k === shown - 1;
      c.userData.lid.visible = !open;
      c.userData.ball.visible = open;
      if (open) c.userData.ball.material.color.set(0xd7f205).lerp(new THREE.Color(0xa9a77e), clamp(wornOf(balls, 'can'), 0, 1));
    });
    setTag(now.balls, dueWord(balls));
  }
  const grips = now.list.find((i) => i.kind === 'grips');
  now.grips.it = grips || null;
  now.grips.g.visible = !!grips;
  if (grips) {
    now.grips.rolls.forEach((r, k) => { r.visible = k < Math.min(4, grips.stock || 0); });
    setTag(now.grips, dueWord(grips));
  }
}
const nowById = (id) => now.rackets.get(id) || now.shoes.get(id) || (now.balls.it && now.balls.it.id === id ? now.balls : null) || (now.grips.it && now.grips.it.id === id ? now.grips : null);

function stepNow(dt) {
  for (const r of now.rackets.values()) {
    const slot = NOW_RACKETS[r.slot];
    if (st.clock > 0.25 + r.slot * 0.12) spring1(r.rise, 0, dt, 2.2, 0.55);
    spring1(r.spin, 0, dt, 1.2, 0.18);
    spring1(r.sway, 0, dt, 3, 0.2);
    r.g.position.copy(slot.p);
    r.g.position.y += r.rise.x + 0.05 * Math.sin(st.clock * 1.3 + r.ph);
    r.g.rotation.set(0, r.spin.x, slot.rz + 0.04 * Math.sin(st.clock * 0.9 + r.ph) + r.sway.x);
    if (r.tag) r.tag.position.copy(r.g.localToWorld(new THREE.Vector3(0, 1.1, 0.1)));
  }
  if (now.slotR.g.visible) {
    const slot = NOW_RACKETS[Math.min(now.slotR.k, 2)];
    now.slotR.g.position.copy(slot.p);
    now.slotR.g.position.y += 0.04 * Math.sin(st.clock * 1.1);
    now.slotR.g.rotation.set(0, 0, slot.rz);
    dashMat.dashOffset = -st.clock * 0.08;
  }
  for (const o of [...now.shoes.values(), now.balls, now.grips]) {
    spring1(o.hop, 0, dt, 3.2, 0.35);
    o.g.position.y = Math.max(0, o.hop.x);
    if (o.tag) o.tag.position.copy(o.g.position).add(new THREE.Vector3(0, 0.55, 0.1));
  }
}

// ---------- The slide strip: log the job on the thing you are looking at ----------
const slide = createSlide({ post, onSlid: () => onSlid() });
function onSlid() {
  const o = st.focus && nowById(st.focus);
  if (!o || !o.it) return;
  post({ type: 'slid' });
  if (o.it.kind === 'balls') {
    if ((o.it.stock || 0) <= 0) return;
    o.hop.v += 3; burst(o.g.position, 14, 1.5);
    post({ type: 'crack' });
    return;
  }
  if (!st.row) return;
  if (o.spin) { o.spin.v += 14; } else { o.hop.v += 3; }
  burst(o.g.position, 16, 1.4);
  post({ type: 'service', id: o.it.id, s: st.row });
}

// ---------- Panel ----------
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const KIND = { racket: 'RACKET', shoes: 'SHOES', balls: 'BALLS', grips: 'OVERGRIPS' };
function panel() {
  const ui = $('ui');
  const past = st.focus && (st.rackets.get(st.focus) || st.shoes.get(st.focus));
  const cur = !past && st.focus && nowById(st.focus);
  ui.classList.toggle('focus', !!(past || cur));
  ui.classList.toggle('past', !!past);
  ui.classList.toggle('now', !!cur);
  if (past) {
    const d = past.it;
    $('kind').textContent = d.kind === 'shoes' ? 'SHOES' : 'RACKET';
    $('name').textContent = d.name;
    $('wl').textContent = d.record || '0-0';
    $('sub').textContent = 'WON-LOST WITH IT';
    $('facts').replaceChildren(...(d.lines || []).map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
    $('how').textContent = st.held ? 'tap anywhere to put it back in the ground' : 'pull it up out of the ground';
    slide.setKey('', '', '');
    return;
  }
  if (cur) {
    const it = cur.it;
    $('nkind').textContent = KIND[it.kind];
    $('nname').textContent = it.name;
    const rows = rowsOf(it);
    if (!st.row || !rows.find((r) => r.s === st.row)) st.row = rows.length ? [...rows].sort((a, b) => b.worn - a.worn)[0].s : null;
    let html = rows.map((r) => `<button class="row${r.s === st.row && rows.length > 1 ? ' on' : ''}${r.worn >= 1 ? ' due' : ''}" data-s="${r.s}"><b>${r.word}</b><span>${esc(r.text)}</span><i class="bar"><u style="width:${Math.round(Math.min(1, r.worn) * 100)}%"></u></i><em>${r.worn >= 1 ? 'DUE NOW' : r.worn >= 0.6 ? 'WEARING' : 'FRESH'}</em></button>`).join('');
    if (it.kind === 'balls' || it.kind === 'grips') {
      const n = it.stock || 0;
      const what = it.kind === 'balls' ? (n === 1 ? 'can' : 'cans') : (n === 1 ? 'overgrip' : 'overgrips');
      html += `<div class="stock${it.low ? ' due' : ''}"><b>${n}</b><span>${what} left${it.low ? '. running low.' : ''}</span><button id="addone">+1</button><button id="order">ORDER</button></div>`;
    }
    if (it.kind === 'racket' || it.kind === 'shoes') html += '<p class="how">tap the name to rename it. hold it to retire it into the ground.</p>';
    $('rows').innerHTML = html;
    const row = rows.find((r) => r.s === st.row);
    if (it.kind === 'balls') slide.setKey((it.stock || 0) > 0 ? '01' : '', 'CRACK A NEW CAN', 'SLIDE TO OPEN ONE');
    else if (row) slide.setKey('01', row.verb, 'SLIDE WHEN IT IS DONE');
    else slide.setKey('', '', '');
    return;
  }
  slide.setKey('', '', '');
  const d = st.data || {};
  const inside = d.inside || {};
  $('h1').textContent = st.open ? 'YOUR DOMAIN.' : d.title || 'YOUR GEAR.';
  $('h2').textContent = st.open ? inside.sub || '' : d.sub || '';
  const due = st.open ? [] : d.due || [];
  $('due').innerHTML = due.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('');
  $('hint').textContent = st.open ? inside.hint || '' : d.hint || 'hold your fighter to expand your domain';
}
function focus(id) {
  if (st.focus !== id) st.row = null;
  st.focus = id;
  panel();
  post({ type: 'focus', id });
}
$('rows').addEventListener('click', (e) => {
  const b = e.target.closest('.row');
  if (b && b.dataset.s !== st.row) { st.row = b.dataset.s; post({ type: 'tick' }); panel(); }
  const o = st.focus && nowById(st.focus);
  if (!o || !o.it) return;
  if (e.target.closest('#order')) post({ type: 'order', kind: o.it.kind });
  if (e.target.closest('#addone')) { o.hop.v += 2.5; post({ type: 'restock', kind: o.it.kind }); }
});
let pressTimer = 0;
$('nname').addEventListener('pointerdown', () => { pressTimer = setTimeout(() => { pressTimer = -1; post({ type: 'remove', id: st.focus }); }, 650); });
$('nname').addEventListener('pointerup', () => { if (pressTimer !== -1) { clearTimeout(pressTimer); post({ type: 'edit', id: st.focus }); } pressTimer = 0; });
$('nname').addEventListener('pointercancel', () => { clearTimeout(pressTimer); pressTimer = 0; });

/** The app retired something in use: it leaves the ghost's hands and gets planted. */
window.retire = (id) => {
  const r = now.rackets.get(id);
  if (r) st.gone.set(id, r.g.getWorldPosition(new THREE.Vector3()));
  st.planting = id;
  st.queue.push(id);
  if (st.focus === id) focus(null);
};

// ---------- Input ----------
const ray = new THREE.Raycaster();
const ndc = (x, y) => new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
let down = null;

function pick(x, y) {
  ray.setFromCamera(ndc(x, y), camera);
  const objs = [];
  for (const r of st.rackets.values()) if ((r.mode === 'planted' && st.open && r.e.x > -0.3) || r.mode === 'held') objs.push(r.hit);
  for (const s of st.shoes.values()) objs.push(s.hit);
  for (const r of now.rackets.values()) objs.push(r.hit);
  for (const o of now.shoes.values()) objs.push(o.hit);
  for (const o of [now.balls, now.grips, now.slotR, now.slotS]) if (o.g.visible) objs.push(o.hit);
  if (you.body) objs.push(you.body.mesh);
  objs.push(ghost.body.mesh);
  const hit = ray.intersectObjects(objs, false)[0];
  if (!hit) return null;
  const o = hit.object;
  if (o.userData.now) return { now: o.userData.now, point: hit.point };
  if (o.userData.racket) return { racket: o.userData.racket, point: hit.point };
  if (o.userData.shoes) return { shoes: o.userData.shoes, point: hit.point };
  if (you.body && o === you.body.mesh) return { jelly: you, point: hit.point };
  return { jelly: ghost, point: hit.point };
}

function putBack(r) {
  r.mode = 'fly';
  r.fly = { t: 0, dur: 0.5, from: r.root.position.clone(), fromQ: r.root.quaternion.clone(), fromS: r.root.scale.x, spin: 0 };
  st.held = null;
  post({ type: 'fling' });
  panel();
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  down = { x: e.clientX, y: e.clientY, t: performance.now(), hit: pick(e.clientX, e.clientY), yaw0: st.yaw.target, moved: 0 };
  if (st.held) return;
  // Pressing your fighter outside the domain starts the charge.
  if (!st.open && down.hit && down.hit.jelly === you) { st.charge.holding = true; st.charge.ticks = 0; post({ type: 'grab' }); return; }
  const r = down.hit && down.hit.racket;
  if (r && r.mode === 'planted') {
    r.pull = { target: 0, bend: 0, lastTick: 0 };
    post({ type: 'grab' });
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x; const dy = e.clientY - down.y;
  down.moved = Math.max(down.moved, Math.hypot(dx, dy));
  if (st.held) return;
  const r = down.hit && down.hit.racket;
  if (r && r.pull) {
    r.pull.target = Math.max(0, -dy) / (window.innerHeight * 0.22);
    r.pull.bend = clamp(dx / window.innerWidth, -0.35, 0.35) * 1.6;
    return;
  }
  if (!down.hit) st.yaw.target = clamp(down.yaw0 - (dx / window.innerWidth) * 0.9, -0.4, 0.4);
});
function release() {
  if (!down) return;
  const tap = down.moved < 10 && performance.now() - down.t < 350;
  const hit = down.hit;
  down = null;
  if (st.charge.holding) {
    st.charge.holding = false;
    if (!tap && st.charge.x > 0.15) { post({ type: 'fizzle' }); return; }
  }
  if (st.held) { if (tap) putBack(st.held); return; }
  if (hit && hit.racket) {
    const r = hit.racket;
    if (r.mode !== 'planted') return;
    if (r.pull) {
      r.pull = null;
      if (tap) { r.w.v += 3.2 * (Math.random() < 0.5 ? -1 : 1); post({ type: 'twang', v: 0.6 }); focus(r.id); return; }
      if (r.e.x > 0.02) post({ type: 'sink' });
    }
    return;
  }
  if (!tap) return;
  if (hit && hit.now) {
    const o = hit.now;
    if (o.add) { post({ type: 'add', kind: o.add }); return; }
    if (o.spin) { o.spin.v += 9; o.sway.v += 2; post({ type: 'swish' }); } else { o.hop.v += 2.4; post({ type: 'hop' }); }
    if (o.it) focus(o.it.id);
    return;
  }
  if (hit && hit.shoes) { hit.shoes.a.v += 3; post({ type: 'swing' }); focus(hit.shoes.it.id); return; }
  if (hit && hit.jelly) {
    const j = hit.jelly;
    const local = j.body.group.worldToLocal(hit.point.clone());
    j.body.poke(local, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.25, -1).normalize(), j === ghost ? 4 : 6, 0.5);
    post({ type: j === ghost ? 'ghost' : 'poke' });
    return;
  }
  if (st.focus) focus(null);
}
canvas.addEventListener('pointerup', release);

// ---------- Expanding and collapsing ----------
function expand() {
  if (st.open) return;
  st.open = true; st.t = 0;
  st.charge.holding = false; st.charge.x = 0;
  if (down) down = null;
  if (you.body) { you.body.squash = 0; you.body.kick(0, 3.5, 0); }
  ghost.body.kick(0, 2, 0);
  st.shake.v += 7;
  burst(new THREE.Vector3(YOU_AT.x, 0, YOU_AT.z), 50, 2.8);
  if (st.focus) focus(null);
  post({ type: 'expand' });
  panel();
}
function collapse() {
  if (!st.open) return;
  st.open = false; st.t = 0;
  st.shake.v += 4;
  if (st.focus) focus(null);
  post({ type: 'collapse' });
  panel();
}
window.expand = expand;
window.collapse = collapse;
canvas.addEventListener('pointercancel', release);

/** The app's back button: put down what you are holding, then let go of the focus, then leave. Returns true if it did something. */
window.unfocus = () => {
  if (st.held) { putBack(st.held); return true; }
  if (st.focus) { focus(null); return true; }
  return false;
};

// ---------- Simulation ----------
const v3 = new THREE.Vector3();
function spring1(s, target, dt, hz, ratio) { const w = hz * TAU; s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt; s.x += s.v * dt; }
function sprV(p, vel, target, dt, hz, ratio) { const w = TAU * hz; vel.addScaledVector(v3.copy(p).sub(target), -w * w * dt).addScaledVector(vel, -2 * ratio * w * dt); p.addScaledVector(vel, dt); }

/** Where a racket is shown when it is in your hand: in front of the camera, a little low, upright. */
function heldPose(r) {
  const p = camera.localToWorld(new THREE.Vector3(0, 0.42, -3.4));
  const q = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(st.clock * 0.9) * 0.5, 0.06 * Math.sin(st.clock * 1.3))));
  const s = 0.95;
  // The racket's middle (y = 0.8 in its own units, lifted out) sits on p.
  const mid = new THREE.Vector3(0, (OUT - GROUND + 0.8) * s, 0).applyQuaternion(q);
  return { p: p.sub(mid), q, s };
}

function stepRacket(r, dt) {
  // Rising out of the ground in the expansion, or sinking back after a half pull.
  if (r.mode === 'planted' && !st.open) {
    // Outside the domain everything planted sleeps under the ground.
    r.rose = false; r.pull = null;
    spring1(r.e, -3, dt, 2.4, 1);
  } else if (r.mode === 'planted') {
    if (st.t >= r.delay) {
      const was = r.e.x;
      if (r.pull) {
        // Stick, then slip: it only moves when you pull harder than it holds, and then in a jerk.
        const f = r.pull.target - r.e.x;
        if (f > 0.1) {
          const jerk = (f - 0.07) * 9 * dt;
          r.e.x += jerk; r.e.v = 0;
          r.w.v += (Math.random() - 0.5) * 9 * jerk * 10;
          if (Math.random() < jerk * 40) burst(r.slot.p, 3, 1.2);
          if (r.e.x - r.pull.lastTick > 0.1) { r.pull.lastTick = r.e.x; post({ type: 'tick' }); }
        }
        if (r.e.x >= 1) {
          r.pull = null; r.mode = 'held'; st.held = r;
          r.hold = { pos: r.root.position.clone(), vel: new THREE.Vector3(), q: r.root.quaternion.clone(), s: { x: r.root.scale.x, v: 0 } };
          burst(r.slot.p, 30, 2.4);
          post({ type: 'free' });
          focus(r.id);
        }
      } else {
        spring1(r.e, 0, dt, r.rose ? 3.4 : 2.6, r.rose ? 0.9 : 0.45);
        if (!r.rose && was < 0 && r.e.x >= 0) { r.rose = true; r.w.v += (r.slot.tilt[1] > 0 ? 1 : -1) * 4.5; burst(r.slot.p, 10, 1.6); post({ type: 'rise' }); }
      }
    }
  }
  if (r.mode === 'planted') {
    const bendTarget = r.pull ? r.pull.bend : 0;
    spring1(r.w, bendTarget, dt, 4.2, 0.07);
    r.wob.rotation.z = -r.w.x * 0.22;
    r.wob.rotation.x = r.w.x * 0.05;
    r.body.position.y = -GROUND + clamp(r.e.x, -3.5, 1) * OUT;
    r.shadow.visible = r.e.x > -0.9;
    return;
  }
  if (r.mode === 'waiting') return;
  if (r.mode === 'held') {
    const want = heldPose(r);
    sprV(r.hold.pos, r.hold.vel, want.p, dt, 3, 0.8);
    r.hold.q.slerp(want.q, 1 - Math.exp(-dt * 9));
    spring1(r.hold.s, want.s, dt, 3, 0.8);
    r.root.position.copy(r.hold.pos);
    r.root.quaternion.copy(r.hold.q);
    r.root.scale.setScalar(r.hold.s.x);
    r.wob.rotation.set(0, 0, 0);
    r.body.position.y = -GROUND + OUT;
    r.shadow.visible = false;
    return;
  }
  if (r.mode === 'fly') {
    const f = r.fly;
    f.t += dt / f.dur;
    const k = Math.min(1, f.t);
    const e = k * k; // falls faster as it comes down
    const home = r.slot.p;
    const homeQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.slot.tilt[0], 0, r.slot.tilt[1]));
    r.root.position.lerpVectors(f.from, home, e);
    r.root.position.y += Math.sin(Math.PI * k) * 0.8;
    r.root.quaternion.slerpQuaternions(f.fromQ, homeQ, Math.min(1, k * 1.3));
    if (f.spin) r.root.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, f.spin * TAU * (1 - k), 0)));
    r.root.scale.setScalar(lerp(f.fromS, r.scale, k));
    r.body.position.y = -GROUND + OUT * (1 - k) * 0.6;
    if (k >= 1) {
      r.mode = 'planted'; r.fly = null; r.rose = true;
      place(r);
      r.e.x = -0.12; r.e.v = 0;
      r.w.v += 6 * (Math.random() < 0.5 ? -1 : 1);
      burst(home, 40, 2.6);
      st.shake.v += 4;
      post({ type: 'plant' });
      panel();
    }
  }
}

function stepShoes(s, dt) {
  const r = s.on && st.rackets.get(s.on);
  if ((r && (r.mode !== 'planted' || r.e.x < -0.4)) || (!r && !st.open)) { s.g.visible = false; return; }
  s.g.visible = true;
  // Hung from the butt of the grip, or the crossbar of your pillar.
  const top = r ? r.body.localToWorld(new THREE.Vector3(0, 1.6, 0)) : new THREE.Vector3(YOU_AT.x + 0.55, 1.55, YOU_AT.z + 0.2);
  // A pendulum: theta'' = -(g/L) sin theta, lightly damped, pushed by the twang of what it hangs from.
  const gL = 9.8 / s.len;
  s.a.v += (-gL * Math.sin(s.a.x) - 0.5 * s.a.v + (r ? r.w.v * 0.6 : 0)) * dt;
  s.a.x += s.a.v * dt;
  s.b.v += (-gL * Math.sin(s.b.x) - 0.4 * s.b.v) * dt;
  s.b.x += s.b.v * dt;
  s.g.position.copy(top);
  s.g.rotation.set(s.b.x, 0, s.a.x);
  s.lace.scale.y = s.len;
  s.pair.position.y = -s.len - 0.06;
  s.pair.rotation.y = 0.4 + 0.2 * Math.sin(st.clock * 0.8 + s.side);
}

function cordProgress(k) {
  for (const m of cords) {
    const n = m.geometry.index.count;
    const c = Math.floor(n * clamp(k, 0, 1) / 6) * 6;
    m.geometry.setDrawRange(0, c);
  }
  knot.visible = k > 0.55;
  knot.scale.set(1, 0.85, 0.45).multiplyScalar(clamp((k - 0.55) / 0.2, 0, 1));
}

function bondCord() {
  if (!you.body) { bond.visible = false; return; }
  const a = you.carrier.localToWorld(you.body.com().add(new THREE.Vector3(0.45, 0.1, 0)));
  const b = ghost.carrier.localToWorld(ghost.body.com().add(new THREE.Vector3(-0.5, -0.1, 0.1)));
  const mid = a.clone().lerp(b, 0.5); mid.y -= 0.35;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  bond.geometry.dispose();
  bond.geometry = new THREE.TubeGeometry(curve, 24, 0.022, 6, false);
  bond.visible = ghost.grow.x > 0.5;
}

function step(dt) {
  st.clock += dt;
  st.t += dt;
  for (const x of rise) {
    if (st.open && st.t < x.delay) continue;
    spring1(x.s, st.open ? 0 : x.down, dt, x.hz, st.open ? x.ratio : 1);
    x.g.position.y = x.y0 + x.s.x;
  }
  // The charge: hold your fighter and it fills; let go and it drains.
  const c = st.charge;
  if (c.holding && !st.open) {
    c.x = Math.min(1, c.x + dt / 1.1);
    const q = Math.floor(c.x * 4);
    if (q > c.ticks) { c.ticks = q; post({ type: 'charge', v: c.x }); }
    st.shake.v += (Math.random() - 0.5) * 30 * c.x * dt * 10;
    if (c.x >= 1) expand();
  } else c.x = Math.max(0, c.x - dt * 3);
  if (you.body) you.body.squash = c.x * 0.7;
  // Outside, your fighter stands front and center. As your pillar comes up it hops on and rides it; as it sinks it hops off.
  const k = clamp(1 - youPillar.s.x / youPillar.down, 0, 1);
  const hop = Math.sin(Math.PI * clamp(k * 1.6, 0, 1)) * 0.5;
  you.carrier.position.set(lerp(OUT_SPOT.x, YOU_AT.x, clamp(k * 1.6, 0, 1)), Math.max(0, YOU_AT.y + youPillar.s.x) * k + hop * (1 - k), lerp(OUT_SPOT.z, YOU_AT.z, clamp(k * 1.6, 0, 1)));
  you.carrier.scale.setScalar(lerp(0.44, 0.34, k));
  // The sky turns while the ink covers the page.
  scene.background = (st.open ? st.t > 0.3 : st.t < 0.22) && st.t < 90 ? inkSky : paperSky;
  for (const r of st.rackets.values()) stepRacket(r, dt);
  for (const s of st.shoes.values()) stepShoes(s, dt);
  stepNow(dt);
  slide.step(dt);
  // The ghost swells in after the field, and bobs.
  if (st.clock > 0.2) spring1(ghost.grow, 1, dt, 1.6, 0.5);
  ghost.carrier.scale.setScalar(1.25 * Math.max(0, ghost.grow.x) * (1 + 0.12 * c.x));
  // While you charge, the ghost leans down over your fighter.
  ghost.carrier.position.set(lerp(0.75, YOU_AT.x + 0.7, c.x * 0.5), 2.2 - c.x * 0.5 + 0.08 * Math.sin((st.clock * TAU) / 4.6), -2.6 + c.x * 0.6);
  ghost.body.simulate(dt, st.clock);
  if (you.body) you.body.simulate(dt, st.clock + 0.7);
  // Dirt.
  for (let i = 0; i < DUST; i += 1) {
    if (dust.life[i] <= 0) continue;
    dust.life[i] -= dt;
    dust.v[i * 3 + 1] -= 9 * dt;
    for (let k = 0; k < 3; k += 1) dust.p[i * 3 + k] += dust.v[i * 3 + k] * dt;
    if (dust.p[i * 3 + 1] < 0.01) { dust.p[i * 3 + 1] = 0.01; dust.v[i * 3] *= 0.6; dust.v[i * 3 + 2] *= 0.6; dust.v[i * 3 + 1] = 0; }
    if (dust.life[i] <= 0) dust.p[i * 3 + 1] = -10;
  }
  dustGeo.attributes.position.needsUpdate = true;
  spring1(st.yaw, st.yaw.target, dt, 1.6, 1);
  spring1(st.shake, 0, dt, 6, 0.25);
  if (st.queue.length && (!st.open || st.t > 2.2)) window.plant(st.queue.shift());
}

function frameCam() {
  const yaw = st.yaw.x + (REDUCED ? 0 : 0.03 * Math.sin((st.clock * TAU) / 11));
  const look = st.cam.look;
  const d = st.cam.pos.clone().sub(look);
  const r = Math.hypot(d.x, d.z);
  const lookNow = look;
  camera.position.set(lookNow.x + Math.sin(yaw) * r, st.cam.pos.y, lookNow.z + Math.cos(yaw) * r);
  camera.position.y += st.shake.x * 0.03;
  camera.position.x += st.shake.x * 0.02;
  camera.lookAt(lookNow);
  camera.updateMatrixWorld();
}

function pose() {
  cordProgress(st.open ? (REDUCED ? 1 : (st.t - 0.6) / 1.1) : 1 - st.t / 0.35);
  bondCord();
  ghost.body.render(st.clock);
  // The ghost is not cute: pinprick pupils and a wide open maw where the smile would be.
  ghost.body.smile.visible = false;
  ghost.body.mouthO.visible = true;
  ghost.body.mouthO.scale.set(1.9 + 0.15 * Math.sin(st.clock * 2.1), 2.3 + 0.2 * Math.sin(st.clock * 1.7), 0.3);
  ghost.body.mouthO.position.set(0, -0.3, 0.03);
  for (const e of ghost.sockets) { e.position.set(e.userData.sx * 0.15, 0.06, 0.02); e.rotation.z = -e.userData.sx * 0.25; e.userData.glint.visible = (st.clock % 3.7) > 0.12; }
  if (you.body) you.body.render(st.clock + 0.7);
  // Ink: closing in round your fighter as you charge, covering everything as it opens, a blink as it closes.
  const vd = st.open ? clamp(1 - (st.t - 0.3) / 0.6, 0, 1) : st.t < 0.45 ? Math.sin((Math.PI * st.t) / 0.45) * 0.9 : 0;
  $('void').style.opacity = REDUCED ? 0 : vd;
  const veil = $('veil');
  if (st.charge.x > 0.001 && !st.open) {
    const p = you.carrier.position.clone().add(new THREE.Vector3(0, 0.3, 0)).project(camera);
    const x = (p.x * 0.5 + 0.5) * 100; const y = (-p.y * 0.5 + 0.5) * 100;
    const r = 140 - 125 * st.charge.x;
    veil.style.opacity = 1;
    veil.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(11,12,14,0) ${r * 0.55}%, rgba(11,12,14,.96) ${r}%)`;
  } else veil.style.opacity = 0;
  document.body.classList.toggle('open', st.open && st.t > 0.15);
}

function resize() {
  const w = window.innerWidth; const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // A narrow phone sees less of the field side to side, so it stands further back.
  camera.fov = w / h < 0.6 ? 46 : 40;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
/** Stills: `window.paused = true` stops the clock; `window.advance(sec)` runs exactly that much and draws it. */
window.paused = false;
window.advance = (sec) => {
  for (let t = 0; t < sec; t += 1 / 120) { frameCam(); step(1 / 120); }
  frameCam(); pose();
  renderer.render(scene, camera);
};
function frame(now) {
  requestAnimationFrame(frame);
  let remaining = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!window.paused) {
    while (remaining > 1e-6) { const dt = Math.min(remaining, 1 / 120); remaining -= dt; frameCam(); step(dt); }
  }
  frameCam();
  pose();
  slide.render(st.clock);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Test hooks for stills.
window.demoDomain = (planting = null) => window.setDomain({
  planting,
  you: { cast: 'wall', color: '#d7f205', name: 'TONY' },
  title: 'YOUR GEAR.', sub: '2 THINGS DUE.', inside: { sub: '6 PLANTED. 112 MATCHES IN THE GROUND.', hint: 'pull one up to see what it won. back closes it.' }, due: ['PURE AERO: restring', 'balls: order more'], hint: 'hold your fighter to expand your domain',
  gear: [
    { id: 'n1', kind: 'racket', name: 'PURE AERO 2026', rows: [{ s: 'strings', word: 'STRINGS', verb: 'RESTRING', text: '17 of 15 matches, 64 of 90 days', worn: 1.13 }, { s: 'overgrip', word: 'OVERGRIP', verb: 'NEW OVERGRIP', text: '2 of 5 matches, 9 of 30 days', worn: 0.4 }] },
    { id: 'n2', kind: 'racket', name: 'BLADE 98 V9', rows: [{ s: 'strings', word: 'STRINGS', verb: 'RESTRING', text: '4 of 15 matches, 20 of 90 days', worn: 0.27 }, { s: 'overgrip', word: 'OVERGRIP', verb: 'NEW OVERGRIP', text: '4 of 5 matches, 25 of 30 days', worn: 0.83 }] },
    { id: 'n3', kind: 'shoes', name: 'GEL RESOLUTION', rows: [{ s: 'soles', word: 'SOLES', verb: 'NEW PAIR', text: '30 of 50 matches, 100 of 180 days', worn: 0.6 }] },
    { id: 'balls', kind: 'balls', name: 'PENN', stock: 1, low: true, hasOpen: true, rows: [{ s: 'can', word: 'OPEN CAN', verb: 'CRACK A NEW CAN', text: '2 of 3 matches, 9 of 14 days', worn: 0.66 }] },
    { id: 'grips', kind: 'grips', name: 'OVERGRIPS', stock: 3, rows: [] },
  ],
  items: [
    { id: 'a', kind: 'racket', name: 'PURE AERO', matches: 41, record: '27-14', lines: ['41 matches over 7 months', 'best win 6-1 6-2 over DANIEL', 'planted MAR 2026'] },
    { id: 'b', kind: 'racket', name: 'BLADE 98', matches: 33, record: '19-14', lines: ['33 matches over 5 months', 'best win 7-6 6-0 over GARY', 'planted JUL 2026'] },
    { id: 'c', kind: 'racket', name: 'EZONE 100', matches: 18, record: '8-10', lines: ['18 matches over 3 months'] },
    { id: 'd', kind: 'racket', name: 'PRESTIGE', matches: 9, record: '5-4', lines: ['9 matches over 2 months'] },
    { id: 'e', kind: 'racket', name: 'SPEED MP', matches: 4, record: '1-3', lines: ['4 matches over 3 weeks'] },
    { id: 'f', kind: 'racket', name: 'CLASH 100', matches: 7, record: '4-3', lines: ['7 matches'] },
    { id: 's1', kind: 'shoes', name: 'GEL RESOLUTION', matches: 52, record: '30-22', lines: ['52 matches, soles worn through'] },
  ],
});
window.__pull = (id, e) => { const r = st.rackets.get(id); if (r) { r.mode = 'planted'; r.e.x = e; } };
window.__hold = (id) => { const r = st.rackets.get(id); if (!r) return; r.pull = { target: 2, bend: 0, lastTick: 0 }; };
window.__st = st;
window.__focus = (id) => focus(id);
window.__charge = (on) => { st.charge.holding = on; };

post({ type: 'ready' });
