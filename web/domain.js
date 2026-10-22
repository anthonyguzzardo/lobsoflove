// The domain: where retired gear goes. Every racket you have worn out stands planted head-first in a field of broken court
// concrete, grip up like a sword hilt; dead shoes hang off the grips by their laces. A red string cord, knotted, runs across the
// sky. Your fighter stands on a pillar and a gloating tennis legend floats behind it. Drawn like a manga page: paper and ink,
// ink outlines, the sky going black overhead, one red.
//
// The domain is entered on purpose. The page opens outside it: paper ground, your fighter, the legend holding the gear you use.
// Press and hold your fighter to expand it; back collapses it into the ground again.
//
// Motion spec. Everything integrates at 1/120 s.
// - Charge: holding your fighter fills 0 to 1 over 1.1 s. Ink closes in round it, the jelly squashes, the legend leans down over
//   it and the camera trembles; a tick at each quarter. Let go early and it all eases back (3 per s).
// - Expansion (at full charge): ink covers the page, the title stamps in at 0.15 s, the ink lifts 0.3-0.9 s. Pillars rise out of the
//   ground on a 2.2 Hz spring, ratio 0.55; rackets shoot up on 2.6 Hz, ratio 0.45, staggered by distance from the fighter
//   (60 ms per unit), and twang when they pass their rest. The cord draws itself across the sky 0.6-1.7 s. The legend swells in.
// - Twang: a planted racket rocks about the point it enters the ground. theta'' = -w^2 theta - 2 zeta w theta', 4.2 Hz, zeta 0.07,
//   so it buzzes for about a second and a half like a sword stuck in a beam.
// - Pull: drag a racket up. It sticks (static friction 0.1 of the pull), then breaks loose in jerks: each jerk throws dirt and a tick.
//   Drag sideways and it leans with your finger. Let go early and it sinks back. Pull it all the way and it comes free and flies
//   to your face on a 3 Hz, ratio 0.8 spring, turning slowly, with its record on the panel.
// - Plant: tap anywhere and it goes back: a 0.5 s arc, driven in, dirt burst, camera shake (6 Hz, ratio 0.25), twang.
// - The legend bobs on a 4.6 s sine and raises a brow every 4.3 s; tap him and he laughs, tap your fighter and the jelly gets poked.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { SoftBody } from './jelly-core.js';
import { post } from './lib/bridge.js';
import { BRUSH_WIDTH, drawBrush } from './lib/brush.js';
import { createDock } from './lib/dock.js';
import { COLORS, GAUGES, RACKETS, SHOES, STRINGS, paintOf, stringColor } from './lib/gear-catalog.js';
import { blobArt, brandArt, coilArt, numArt, wordArt } from './lib/toss-art.js';

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
  // Clean paper: only a faint grain, so nothing on the ground fights the characters.
  g.fillStyle = '#ebe7dd'; g.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < 220; i += 1) { g.fillStyle = `rgba(22,24,29,${0.03 + r() * 0.05})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
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
// Your pillar, left of center, with a crossbar like a grave marker, and the legend's leaning post on the right.
const YOU_AT = new THREE.Vector3(-0.62, 2.35, -0.9);
slab(0.5, 2.35, 0.5, YOU_AT.x, 2.35 / 2, YOU_AT.z, 0, 0.25, 0.02, 0);
const youPillar = rise[rise.length - 1]; // your fighter rides it up out of the ground
const OUT_SPOT = new THREE.Vector3(0.2, 0, -0.3); // where your fighter stands outside the domain
// Where the legend crouches: low over your fighter outside; up behind your pillar inside.
const G_OUT = new THREE.Vector3(0.2, 1.15, -1.75);
const G_IN = new THREE.Vector3(0.55, 1.55, -2.4);
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

// ---------- Your fighter and the legend ----------
const you = { body: null, carrier: new THREE.Group(), cast: null, color: null };
you.carrier.position.copy(YOU_AT);
you.carrier.scale.setScalar(0.34);
scene.add(you.carrier);
// The legend: a big, gloating tennis spirit who floats behind your fighter. Seventies hair under a red headband, a white polo
// with the collar popped, red wristbands, arms crossed, chin up, one eyebrow raised and a smirk. No legs: he trails off in a wisp.
// He is an archetype, not anyone real. Tap him and he laughs at you.
const legend = { carrier: new THREE.Group(), grow: { x: 0, v: 0 }, jolt: { x: 0, v: 0 }, laugh: 0, brow: { x: 0, v: 0 } };
{
  const L = new THREE.Group();
  const skin = toon(0xf1d3b3); const shirt = toon(0xf7f4ec); const red = toon(CLAY); const hair = toon(0xd2a65a); const ink = toon(INK);
  const put = (m, x, y, z, line = LINE.thin) => { inked(m, line); m.position.set(x, y, z); L.add(m); return m; };
  /** A rounded limb from a to b. */
  const limb = (a, b, r, m) => {
    const len = a.distanceTo(b);
    const c = put(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), m), (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return c;
  };
  // The wisp he rises out of.
  const wisp = put(new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.15, 28), shirt), 0, -0.52, 0, LINE.mid);
  wisp.rotation.set(Math.PI, 0, 0.12);
  // Torso, with red and ink stripes over the shoulders.
  const torso = put(new THREE.Mesh(new RoundedBoxGeometry(1.05, 1.02, 0.56, 4, 0.22), shirt), 0, 0.48, 0, LINE.mid);
  for (const [y, m] of [[0.86, red], [0.8, ink]]) put(new THREE.Mesh(new THREE.BoxGeometry(1.07, 0.035, 0.58), m), 0, y, 0, LINE.thin);
  // Popped collar.
  for (const sx of [-1, 1]) {
    const flap = put(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.03), shirt), sx * 0.12, 1.03, 0.16);
    flap.rotation.set(-0.35, sx * 0.3, -sx * 0.55);
  }
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 14), skin), 0, 1.03, 0);
  // Head, chin up.
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0.02);
  L.add(head);
  const hput = (m, x, y, z, line = LINE.thin) => { if (line) inked(m, line); m.position.set(x, y, z); head.add(m); return m; };
  hput(new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 20), skin), 0, 0, 0, LINE.mid).scale.set(0.94, 1.1, 0.95);
  // Hair: a cap on top and long locks down the sides and back.
  hput(new THREE.Mesh(new THREE.SphereGeometry(0.39, 24, 16, 0, TAU, 0, Math.PI * 0.5), hair), 0, 0.06, -0.03).scale.set(1, 1.05, 1);
  for (const sx of [-1, 1]) hput(new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.62, 0.36, 3, 0.07), hair), sx * 0.33, -0.12, -0.08).rotation.z = sx * 0.08;
  hput(new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.6, 0.14, 3, 0.07), hair), 0, -0.12, -0.3);
  const band = hput(new THREE.Mesh(new THREE.TorusGeometry(0.375, 0.048, 10, 40), red), 0, 0.15, 0);
  band.rotation.x = Math.PI / 2 - 0.12;
  band.scale.set(0.96, 0.98, 1);
  // Face: lids half down, one brow up, a smirk off to one side.
  for (const sx of [-1, 1]) {
    const eye = hput(new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), ink), sx * 0.12, 0.0, 0.345, null);
    eye.scale.set(1.15, 0.5, 0.5);
  }
  const brows = [-1, 1].map((sx) => {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.12, 4, 8), toon(0x8a6a34));
    b.rotation.z = Math.PI / 2 + (sx > 0 ? -0.35 : 0.08);
    b.position.set(sx * 0.13, 0.1, 0.35);
    head.add(b);
    return b;
  });
  hput(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), skin), 0, -0.07, 0.34);
  const smirk = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 6, 20, 1.7), ink);
  smirk.position.set(0.04, -0.15, 0.33);
  smirk.rotation.z = Math.PI + 0.55;
  head.add(smirk);
  const grin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10), ink);
  grin.scale.set(1.3, 0.8, 0.4);
  grin.position.set(0.02, -0.17, 0.32);
  grin.visible = false;
  head.add(grin);
  // Arms on joints, so he can move between poses: crossed (gloating), wristband to his lips, the hand sign, arms flung wide.
  const bone = (m, r) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 14), m); inked(c, LINE.thin); L.add(c); return c; };
  const ball = (m, r) => { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); inked(c, LINE.thin); L.add(c); return c; };
  const arms = [-1, 1].map((sx) => {
    const a = { sx, shoulder: new THREE.Vector3(sx * 0.56, 0.86, 0), upper: bone(shirt, 0.12), fore: bone(skin, 0.1), elbow: ball(skin, 0.1), hand: ball(skin, 0.11) };
    a.cuff = ball(shirt, 0.125);
    a.band = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.11, 16), red);
    inked(a.band, LINE.thin);
    L.add(a.band);
    a.finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8), skin);
    inked(a.finger, LINE.thin);
    L.add(a.finger);
    return a;
  });
  legend.arms = arms;
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.9, 0.9), pickMat);
  hit.position.y = 0.55;
  L.add(hit);
  legend.carrier.add(L);
  legend.parts = { L, head, brows, smirk, grin, torso, arms };
  legend.body = {
    mesh: hit,
    group: L,
    kick(x, y) { legend.jolt.v += y * 0.6; },
    poke() { legend.laugh = 0.9; legend.jolt.v += 1.5; },
    simulate(dt, t) {
      spring1(legend.jolt, 0, dt, 2.6, 0.35);
      spring1(legend.brow, 0, dt, 5, 0.3);
      legend.laugh = Math.max(0, legend.laugh - dt);
      // Every few seconds the brow goes up again: still gloating.
      if (t % 4.3 < dt) legend.brow.v += 3;
      // Arms are posed here, before anything he holds is placed in his hand.
      poseArms(gesture());
    },
    render(t) {
      const { head, brows, smirk, grin, torso } = legend.parts;
      const g = gesture();
      const lg = legend.laugh > 0 || g.wide > 0.5;
      // Head down for the kiss, back for the laugh.
      head.rotation.set(-0.16 + 0.03 * Math.sin(t * 0.8) + 0.3 * g.kiss - 0.25 * g.wide + (lg ? 0.08 * Math.sin(t * 34) : 0), 0.12 * Math.sin(t * 0.37) * (1 - g.sign), 0.06 * Math.sin(t * 0.6));
      brows[1].position.y = 0.1 + 0.04 * clamp(legend.brow.x, -1, 1.5) + 0.02;
      torso.scale.set(1, 1 + 0.02 * Math.sin(t * 1.9) + (lg ? 0.03 * Math.sin(t * 30) : 0), 1);
      smirk.visible = !lg; grin.visible = lg;
      legend.parts.L.position.y = legend.jolt.x * 0.1 + (lg ? 0.03 * Math.abs(Math.sin(t * 17)) : 0);
    },
  };
}
legend.carrier.position.set(0.75, 2.2, -2.6);

// ---------- The legend's routine ----------
// Each pose is where the elbows and hands go (his own units; shoulders at x = +-0.56, y = 0.86). The charge walks him from
// crossed to the wristband kiss (0 to 0.35), holds the kiss, then into the hand sign (0.7 to 1). The expansion flings his arms
// wide in 0.22 s, holds them up laughing to 1.3 s, and lets them fall back to crossed by 2.1 s.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const POSE = {
  crossed: { L: [V(-0.5, 0.36, 0.28), V(0.3, 0.5, 0.42)], R: [V(0.5, 0.4, 0.32), V(-0.3, 0.57, 0.48)] },
  kiss: { L: [V(-0.66, 0.44, 0.08), V(-0.45, 0.16, 0.24)], R: [V(0.46, 0.72, 0.5), V(0.1, 1.2, 0.5)] },
  sign: { L: [V(-0.46, 0.58, 0.38), V(-0.05, 1.16, 0.56)], R: [V(0.46, 0.58, 0.38), V(0.05, 1.16, 0.56)] },
  wide: { L: [V(-0.98, 1.05, 0.12), V(-1.32, 1.55, 0.25)], R: [V(0.98, 1.05, 0.12), V(1.32, 1.55, 0.25)] },
  // Reaching behind his back, and holding it up at you with the other hand on his hip.
  behind: { L: [V(-0.5, 0.36, 0.28), V(0.3, 0.5, 0.42)], R: [V(0.72, 0.52, -0.22), V(0.42, 0.5, -0.55)] },
  present: { L: [V(-0.66, 0.44, 0.08), V(-0.45, 0.16, 0.24)], R: [V(0.86, 0.42, 0.34), V(0.92, 0.56, 0.66)] },
};
const smooth = (x) => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };
/** How far into each pose he is right now. */
function gesture() {
  const sh = st.show;
  if (sh) {
    if (sh.phase === 'in') {
      if (sh.t < 0.3) return { from: 'crossed', to: 'behind', k: smooth(sh.t / 0.3), back: 0, kiss: 0, sign: 0, wide: 0 };
      const k = smooth((sh.t - 0.3) / 0.45);
      return { from: 'behind', to: 'present', k: k + 0.12 * Math.sin(Math.PI * k), back: 0, kiss: 0, sign: 0, wide: 0 };
    }
    if (sh.phase === 'out') {
      if (sh.t < 0.3) return { from: 'present', to: 'behind', k: smooth(sh.t / 0.3), back: 0, kiss: 0, sign: 0, wide: 0 };
      return { from: 'behind', to: 'crossed', k: smooth((sh.t - 0.3) / 0.2), back: 0, kiss: 0, sign: 0, wide: 0 };
    }
    return { from: 'present', to: 'present', k: 1, back: 0, kiss: 0, sign: 0, wide: 0 };
  }
  if (st.leave) {
    const k = smooth(st.leave.t / 0.2);
    return { from: 'crossed', to: 'sign', k, back: 0, kiss: 0, sign: k, wide: 0 };
  }
  if (st.open && st.t < 2.1) {
    const out = smooth(st.t / 0.22);
    const back = smooth((st.t - 1.3) / 0.8);
    return { from: 'sign', to: 'wide', k: out, back, kiss: 0, sign: 1 - out, wide: out * (1 - back) };
  }
  const c = st.charge.x;
  if (c <= 0.35) { const k = smooth(c / 0.35); return { from: 'crossed', to: 'kiss', k, back: 0, kiss: k, sign: 0, wide: 0 }; }
  if (c <= 0.7) return { from: 'kiss', to: 'kiss', k: 1, back: 0, kiss: 1, sign: 0, wide: 0 };
  const k = smooth((c - 0.7) / 0.3);
  return { from: 'kiss', to: 'sign', k, back: 0, kiss: 1 - k, sign: k, wide: 0 };
}
const placeBone = (m, a, b) => {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  m.scale.set(1, a.distanceTo(b), 1);
};
function poseArms(g) {
  for (const a of legend.arms) {
    const side = a.sx < 0 ? 'L' : 'R';
    const A = POSE[g.from][side]; const B = POSE[g.to][side];
    let elbow = A[0].clone().lerp(B[0], g.k); let hand = A[1].clone().lerp(B[1], g.k);
    if (g.back > 0) { const C = POSE.crossed[side]; elbow = elbow.lerp(C[0], g.back); hand = hand.lerp(C[1], g.back); }
    // Arms up and wide shake with the laugh.
    if (g.wide > 0.5) hand.y += 0.04 * Math.sin(st.clock * 30 + a.sx);
    placeBone(a.upper, a.shoulder, elbow);
    placeBone(a.fore, elbow, hand);
    a.elbow.position.copy(elbow);
    a.cuff.position.copy(a.shoulder.clone().lerp(elbow, 0.85));
    a.hand.position.copy(hand);
    const wrist = elbow.clone().lerp(hand, 0.78);
    a.band.position.copy(wrist);
    a.band.quaternion.copy(a.fore.quaternion);
    // Index finger up for the sign.
    a.finger.visible = g.sign > 0.5;
    // Throwing: his free arm winds down and flings up (0.55 s), whatever the rest of him is doing.
    if (a.sx < 0 && st.flingT < 0.55) {
      const u = st.flingT / 0.55;
      const w = Math.sin(Math.PI * u);
      const up = smooth(u * 1.6);
      const e2 = V(-0.62, lerp(0.3, 1.0, up), 0.3); const h2 = V(-0.5, lerp(0.05, 1.6, up), lerp(0.3, 0.6, up));
      elbow = elbow.lerp(e2, w); hand = hand.lerp(h2, w);
      placeBone(a.upper, a.shoulder, elbow); placeBone(a.fore, elbow, hand);
      a.elbow.position.copy(elbow); a.hand.position.copy(hand);
      a.cuff.position.copy(a.shoulder.clone().lerp(elbow, 0.85));
      a.band.position.copy(elbow.clone().lerp(hand, 0.78)); a.band.quaternion.copy(a.fore.quaternion);
    }
    // While the logos float, his free hand points up at them, finger out.
    if (a.sx < 0 && st.aside.x > 0.01 && st.flingT >= 0.55) {
      const u = clamp(st.aside.x, 0, 1);
      const sway = 0.06 * Math.sin(st.clock * 1.4);
      elbow = elbow.lerp(V(-0.78, 0.92, 0.32), u); hand = hand.lerp(V(-1.0 + sway, 1.42, 0.5), u);
      placeBone(a.upper, a.shoulder, elbow); placeBone(a.fore, elbow, hand);
      a.elbow.position.copy(elbow); a.hand.position.copy(hand);
      a.cuff.position.copy(a.shoulder.clone().lerp(elbow, 0.85));
      a.band.position.copy(elbow.clone().lerp(hand, 0.78)); a.band.quaternion.copy(a.fore.quaternion);
      if (u > 0.5) a.finger.visible = true;
    }
    a.finger.position.copy(hand).add(V(0, 0.13, 0.02));
  }
}

scene.add(legend.carrier);

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
  leave: null, // { t, sent } while your fighter hops off the page
  gone: new Map(), // where something in use was when it was retired
  lean: { x: 0, v: 0 },
  row: null,
  cam: { pos: new THREE.Vector3(0, 3.0, 6.6), look: new THREE.Vector3(0, 1.2, -1) },
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
  // The one the legend is about to bury waits out of sight until it comes down.
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
  const stripeMat = toon(CLAY);
  pair.userData.upperMat = upperMat;
  pair.userData.stripeMat = stripeMat;
  for (const sx of [-1, 1]) {
    const shoe = new THREE.Group();
    const upper = inked(new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.09, 0.3, 3, 0.04), upperMat), LINE.thin);
    upper.position.y = 0.02;
    const sole = inked(new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.035, 0.3, 2, 0.015), toon(0x2a2c31)), LINE.thin);
    sole.position.y = -0.045;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.02, 0.12), stripeMat);
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
/** Paints a pair in its colorway: the upper in the main color, the swoosh stripe in the accent. Wear greys the upper. */
function paintShoes(pair, it, worn = 0) {
  const c = (it && it.colors) || [];
  pair.userData.upperMat.color.set(c[0] || '#f4f1ea').lerp(new THREE.Color(0x9e978a), clamp(worn, 0, 1) * 0.6);
  pair.userData.stripeMat.color.set(c[1] || (c[0] && c[0] !== '#e2562f' ? '#16181d' : '#e2562f'));
}

function makeShoes(it) {
  const g = new THREE.Group();
  const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 4).translate(0, -0.5, 0), toon(INK));
  g.add(lace);
  const pair = shoePair(true);
  paintShoes(pair, it, 1);
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

/** The legend buries something new: it comes down from over the legend's head and is driven in. */
window.plant = (id) => {
  if (st.open && st.t < 2.2) { if (!st.queue.includes(id)) st.queue.push(id); return; }
  const r = st.rackets.get(id);
  if (!r) return;
  r.root.visible = true;
  const from = st.gone.get(id) || legend.carrier.position.clone().add(new THREE.Vector3(0, 2.4, 0.2));
  st.gone.delete(id);
  r.mode = 'fly';
  r.fly = { t: 0, dur: 0.75, from, fromQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI)), fromS: r.scale * 0.7, spin: 2 };
  r.e.x = 0.3;
  legend.body.kick(0, -2.5, 0);
  post({ type: 'laugh' });
};


// ---------- What you use now: the legend pulls it out ----------
// Nothing in use sits in the scene. Pick RACKET or SHOES in the dock and the legend reaches behind his back, whips it out and
// holds it up at you: strings browning (one snapped when they are dead), the wear lettered next to it with an ink line to the
// part, your name for it on a tag. Scrub the strings with your finger and fresh string paints in under it; scrub the shoes and
// the scuff comes off. Pick the same tab again (or swipe) and he swaps in the next one; past your last he holds up a blank.
//
// Motion: pull out 0.85 s (0-0.3 s the hand goes behind his back, it comes out with the thing spinning once and swings up with a
// little overshoot); put away 0.5 s, the reverse. The shoes hang from his finger by the laces: a pendulum, kicked on arrival.
const now = { list: [], max: { racket: 3, shoes: 6 } };
const rowsOf = (it) => it.rows || [];
const wornOf = (it, s) => (rowsOf(it).find((r) => r.s === s) || { worn: 0 }).worn;
const dueWord = (it) => { const r = rowsOf(it).filter((x) => x.worn >= 1).sort((a, b) => b.worn - a.worn)[0]; return r ? r.verb : ''; };
const ofKind = (kind) => now.list.filter((i) => i.kind === kind).slice(0, now.max[kind]);

// The racket he shows. Its own string bed, drawn on a canvas so your finger can paint new string in.
const bedCanvas = document.createElement('canvas');
bedCanvas.width = 256; bedCanvas.height = 320;
const bedG = bedCanvas.getContext('2d');
const showBedTex = new THREE.CanvasTexture(bedCanvas);
showBedTex.colorSpace = THREE.SRGBColorSpace;
let FRESH_STR = '#fbfaf3';
const DEAD_STR = '#9c7f4a';
function strings(g, col, clip) {
  g.save();
  if (clip) { g.beginPath(); g.arc(clip.x, clip.y, clip.r, 0, TAU); g.clip(); }
  g.strokeStyle = col; g.lineWidth = 4.5; g.lineCap = 'round';
  for (let x = 14; x < 256; x += 19) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 320); g.stroke(); }
  for (let y = 14; y < 320; y += 19) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.restore();
}
function drawBed(worn, fresh) {
  bedG.clearRect(0, 0, 256, 320);
  if (fresh) { strings(bedG, FRESH_STR); showBedTex.needsUpdate = true; return; }
  const col = new THREE.Color(FRESH_STR).lerp(new THREE.Color(DEAD_STR), clamp(worn, 0, 1)).getStyle();
  strings(bedG, col);
  if (worn >= 1) {
    // One main string snapped: a gap with the two ends curling away.
    bedG.clearRect(122, 120, 16, 70);
    bedG.strokeStyle = col; bedG.lineWidth = 4.5;
    bedG.beginPath(); bedG.moveTo(128, 120); bedG.quadraticCurveTo(140, 132, 150, 126); bedG.stroke();
    bedG.beginPath(); bedG.moveTo(128, 190); bedG.quadraticCurveTo(114, 178, 104, 186); bedG.stroke();
  }
  showBedTex.needsUpdate = true;
}
const showR = (() => {
  const { body, hit, bed } = buildRacket();
  bed.material = new THREE.MeshBasicMaterial({ map: showBedTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  // Its own paint, so the one he holds is drawn in its model's colors.
  const paint = toon(0xf4f1ea);
  body.traverse((o) => { if (o.material === frameMat) o.material = paint; });
  body.rotation.z = Math.PI; // head up
  body.position.y = 1.6; // butt in his hand
  const g = new THREE.Group();
  g.add(body);
  g.scale.setScalar(0.9);
  g.visible = false;
  bed.userData.bed = true;
  hit.userData.show = true;
  return { g, body, bed, hit, paint, frame: body.children[0] };
})();
const showS = (() => {
  const g = new THREE.Group();
  const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, -0.5, 0), toon(INK));
  const pair = shoePair(true);
  g.add(lace, pair);
  g.scale.setScalar(2.1);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), pickMat);
  pair.add(hit);
  hit.userData.show = true;
  g.visible = false;
  return { g, lace, pair, hit, a: { x: 0, v: 0 }, len: 0.3 };
})();
legend.parts.L.add(showR.g, showS.g);

// What is out: { kind, idx, t, phase: 'in' | 'held' | 'out', then } (then: what to pull out once this one is put away).
st.show = null;
st.scrub = null; // { cells: Set, n, progress, done, dist, last: {x,y} }
const currentOf = (sh) => { const list = ofKind(sh.kind); return sh.idx < list.length ? list[sh.idx] : null; };
function showCount(kind) { const n = ofKind(kind).length; return n + (n < now.max[kind] ? 1 : 0); }
function pullOut(kind, idx) {
  if (st.show && st.show.phase !== 'out') { st.show.phase = 'out'; st.show.t = 0; st.show.then = { kind, idx }; return; }
  if (st.show && st.show.phase === 'out') { st.show.then = { kind, idx }; return; }
  st.show = { kind, idx, t: 0, phase: 'in', then: null };
  st.scrub = null;
  const it = currentOf(st.show);
  dress(it, kind);
  post({ type: 'reach' });
  focus(it ? it.id : null, true);
  panel();
}
/** Paints what he is about to hold: the frame in its model's colors and its string in the bed, or the shoes in their colorway. */
function dress(it, kind) {
  if (kind === 'racket') {
    showR.paint.color.set(paintOf(it && (it.model || it.name)));
    FRESH_STR = stringColor(it && it.setup && it.setup.string);
    drawBed(it ? wornOf(it, 'strings') : 0, false);
  } else paintShoes(showS.pair, it, it ? wornOf(it, 'soles') : 0);
}
function putAway() {
  if (!st.show || st.show.phase === 'out') return;
  st.show.phase = 'out'; st.show.t = 0; st.show.then = null;
  post({ type: 'fling' });
}
/** Pick a tab: the first time pulls one out (the most worn first); again, the next one. */
function tab(kind) {
  if (st.show && st.show.kind === kind && st.show.phase !== 'out') { pullOut(kind, (st.show.idx + 1) % showCount(kind)); return; }
  const list = ofKind(kind);
  let idx = 0;
  list.forEach((it, k) => { if (dueWord(it) && !dueWord(list[idx])) idx = k; });
  pullOut(kind, idx);
}

/** The gear in use, from the app: [{ id, kind, name, rows: [{ s, word, verb, text, worn }] }]. */
function setNow(list) {
  const before = new Set(now.list.map((i) => i.id));
  now.list = (list || []).filter((i) => i.kind === 'racket' || i.kind === 'shoes');
  // Something just came in (named on the write page): keep showing it.
  if (st.show) {
    const n = ofKind(st.show.kind).length;
    if (st.show.idx > n) st.show.idx = n;
    const it = currentOf(st.show);
    if (it && !before.has(it.id)) dress(it, st.show.kind);
    else if (it && st.show.kind === 'racket' && stringColor(it.setup && it.setup.string) !== FRESH_STR) dress(it, 'racket');
    if (it && st.scrub && st.scrub.done && st.show.kind === 'racket') { drawBed(wornOf(it, 'strings'), wornOf(it, 'strings') < 0.05); }
  }
  buildDock();
}

function stepShow(dt) {
  const sh = st.show;
  if (!sh) { showR.g.visible = false; showS.g.visible = false; return; }
  sh.t += dt;
  if (sh.phase === 'in' && sh.t >= 0.85) sh.phase = 'held';
  if (sh.phase === 'out' && sh.t >= 0.5) {
    const then = sh.then;
    st.show = null;
    showR.g.visible = false; showS.g.visible = false;
    if (then) pullOut(then.kind, then.idx); else { focus(null); panel(); }
    return;
  }
  const item = sh.kind === 'racket' ? showR : showS;
  const other = sh.kind === 'racket' ? showS : showR;
  other.g.visible = false;
  // In his hand once it has come out from behind his back.
  const out = sh.phase === 'in' ? sh.t >= 0.3 : sh.phase === 'held' || sh.t < 0.3;
  item.g.visible = out;
  const hand = legend.arms[1].hand.position;
  const blank = !currentOf(sh);
  if (sh.kind === 'racket') {
    const spin = sh.phase === 'in' ? TAU * (1 - smooth((sh.t - 0.3) / 0.55)) : 0;
    const grow = sh.phase === 'in' ? 0.25 + 0.75 * smooth((sh.t - 0.3) / 0.3) : sh.phase === 'out' ? 1 - smooth(sh.t / 0.3) : 1;
    showR.g.position.copy(hand);
    showR.g.rotation.set(0, spin + 0.12 * Math.sin(st.clock * 0.9), 0.22 + 0.04 * Math.sin(st.clock * 1.3));
    showR.g.scale.setScalar(0.9 * Math.max(0.05, grow));
    showR.bed.visible = !blank;
    showR.frame.material = blank ? blankMat : showR.paint;
  } else {
    // A pendulum off his finger, pushed when he swings it out.
    const gL = 9.8 / (showS.len * 2.1);
    if (sh.phase === 'in' && Math.abs(sh.t - 0.62) < dt) showS.a.v += 4;
    showS.a.v += (-gL * Math.sin(showS.a.x) - 0.8 * showS.a.v) * dt;
    showS.a.x += showS.a.v * dt;
    showS.g.position.copy(hand).add(V(0, 0.08, 0));
    showS.g.rotation.set(0, 0.5 + 0.3 * Math.sin(st.clock * 0.7), showS.a.x);
    showS.lace.scale.y = showS.len;
    showS.pair.position.y = -showS.len - 0.06;
    const grow = sh.phase === 'in' ? 0.3 + 0.7 * smooth((sh.t - 0.3) / 0.3) : sh.phase === 'out' ? 1 - smooth(sh.t / 0.3) : 1;
    showS.g.scale.setScalar(2.1 * Math.max(0.05, grow));
    showS.pair.userData.upperMat.opacity = blank ? 0.35 : 1;
    showS.pair.userData.upperMat.transparent = blank;
  }
}
const blankMat = new THREE.MeshToonMaterial({ color: 0xf4f1ea, gradientMap: tones, transparent: true, opacity: 0.35 });

// Scrubbing: paint new string where your finger goes; done at three quarters of the bed.
const CELLS_X = 8; const CELLS_Y = 10;
const bedCells = (() => { const out = []; for (let j = 0; j < CELLS_Y; j += 1) for (let i = 0; i < CELLS_X; i += 1) { const u = (i + 0.5) / CELLS_X; const v = (j + 0.5) / CELLS_Y; if ((u - 0.5) ** 2 + (v - 0.5) ** 2 < 0.24) out.push(j * CELLS_X + i); } return new Set(out); })();
function scrubAt(x, y) {
  const sh = st.show;
  const it = sh && currentOf(sh);
  if (!it || !st.scrub || st.scrub.done) return;
  ray.setFromCamera(ndc(x, y), camera);
  if (sh.kind === 'racket') {
    const hit = ray.intersectObject(showR.bed, false)[0];
    if (!hit || !hit.uv) return;
    const px = hit.uv.x * 256; const py = (1 - hit.uv.y) * 320;
    bedG.clearRect(px - 26, py - 26, 52, 52);
    strings(bedG, FRESH_STR, { x: px, y: py, r: 26 });
    showBedTex.needsUpdate = true;
    const cell = Math.floor((1 - hit.uv.y) * CELLS_Y) * CELLS_X + Math.floor(hit.uv.x * CELLS_X);
    if (bedCells.has(cell) && !st.scrub.cells.has(cell)) {
      st.scrub.cells.add(cell);
      if (st.scrub.cells.size % 3 === 0) post({ type: 'tick' });
    }
    st.scrub.progress = st.scrub.cells.size / bedCells.size;
    if (Math.random() < 0.3) burst(hit.point, 2, 0.6);
    if (st.scrub.progress >= 0.75) finishScrub(it, 'strings', hit.point);
  } else {
    const hit = ray.intersectObject(showS.hit, false)[0];
    if (!hit) return;
    if (st.scrub.last) st.scrub.dist += Math.hypot(x - st.scrub.last.x, y - st.scrub.last.y);
    st.scrub.last = { x, y };
    st.scrub.progress = clamp(st.scrub.dist / 1300, 0, 1);
    paintShoes(showS.pair, it, wornOf(it, 'soles') * (1 - st.scrub.progress));
    showS.a.v += (Math.random() - 0.5) * 0.8;
    if (Math.random() < 0.35) burst(hit.point, 3, 1);
    if (Math.floor(st.scrub.progress * 10) > (st.scrub.ticks || 0)) { st.scrub.ticks = Math.floor(st.scrub.progress * 10); post({ type: 'tick' }); }
    if (st.scrub.progress >= 1) finishScrub(it, 'soles', hit.point);
  }
  notes();
}
function finishScrub(it, s, at) {
  st.scrub.done = true;
  panel();
  if (s === 'strings') drawBed(0, true);
  else paintShoes(showS.pair, it, 0);
  burst(at, 30, 2);
  legend.laugh = 0.6;
  post({ type: 'service', id: it.id, s });
  notes();
}

// ---------- The dock ----------
// The same floating platforms and hopping ball as home. Back sits small on the far left, then RACKET, SHOES and the domain,
// which is its own kind of button. Back closes the domain first; outside it, your fighter hops off the left edge and the page goes.
let dock = null;
let dockSig = '';
st.dockSlots = [];
function buildDock() {
  const slots = [
    { back: true, label: '' },
    { kind: 'racket', label: 'RACKET', due: ofKind('racket').some((i) => dueWord(i)) },
    { kind: 'shoes', label: 'SHOES', due: ofKind('shoes').some((i) => dueWord(i)) },
    { domain: true, label: 'DOMAIN' },
  ];
  const sig = JSON.stringify(slots);
  if (sig === dockSig) { markDock(); return; }
  dockSig = sig;
  st.dockSlots = slots;
  // A fresh element each time, so old click handlers go with the old one.
  const old = $('dock');
  const fresh = old.cloneNode(false);
  fresh.innerHTML = '<div id="dshadow"></div><div id="dball"><i></i></div>';
  old.replaceWith(fresh);
  dock = createDock({ slots: slots.map((x, k) => ({ i: k + 1, label: x.label })), onPick: (i) => pickSlot(i), post });
  fresh.querySelectorAll('.slot').forEach((b, k) => { b.classList.toggle('due', !!slots[k].due); b.classList.toggle('dom', !!slots[k].domain); b.classList.toggle('bk', !!slots[k].back); });
  const bk = fresh.querySelector('.slot.bk .pf');
  // The old back button, shrunk onto a platform: motley paint drifting under ink, a smoke wisp, a cream chevron.
  if (bk) bk.innerHTML = '<span class="mot">' + '<i></i>'.repeat(6) + '<b></b><b></b></span>'
    + '<svg class="chev" viewBox="0 0 30 30"><path d="M19 5L8 15L19 25" stroke="#16181d" stroke-width="9"/><path d="M19 5L8 15L19 25" stroke="#fffdf0" stroke-width="4.5"/></svg>';
  // Its own felt ball sits on the right end. Press winds it up; let go and it rushes off the left edge on a candy rope,
  // smoke blooming behind it.
  if (bk) bk.insertAdjacentHTML('afterend', '<svg class="trail" viewBox="0 0 180 26" preserveAspectRatio="none">'
    + '<path d="M180 15C164 4 150 24 132 13S96 4 80 15S44 24 28 12S8 6 0 14" stroke="#2f6bff" stroke-width="4"/>'
    + '<path d="M180 9C162 20 148 4 128 12S92 22 76 10S40 4 24 14S6 18 0 10" stroke="#ff9a1f" stroke-width="4"/>'
    + '<path d="M180 9C162 20 148 4 128 12S92 22 76 10S40 4 24 14S6 18 0 10" stroke="#b84dff" stroke-width="4" stroke-dasharray="5 5" stroke-linecap="butt"/>'
    + '<path d="M180 13C166 4 148 22 130 12S96 4 78 14S42 22 26 12S8 8 0 13" stroke="#ff3b30" stroke-width="6"/>'
    + '<path d="M180 13C166 4 148 22 130 12S96 4 78 14S42 22 26 12S8 8 0 13" stroke="#fffdf0" stroke-width="2.2" stroke-dasharray="0.1 6"/></svg>'
    + '<i class="puff"></i>'.repeat(4)
    + '<span class="bball"><svg viewBox="0 0 28 28"><defs><radialGradient id="felt" cx="30%" cy="25%" r="80%"><stop offset="0" stop-color="#f1ff8d"/><stop offset=".55" stop-color="#d7f205"/><stop offset="1" stop-color="#8ca511"/></radialGradient></defs>'
    + '<circle cx="14" cy="14" r="12.6" fill="url(#felt)" stroke="#16181d" stroke-width="1.6"/><path class="seam" d="M5 4C16 9 16 19 5 24M23 4C12 9 12 19 23 24" fill="none" stroke="#fffdf0" stroke-width="2"/></svg></span>');
  // Every platform goes down under your finger and springs back when you let go.
  const press = (on) => (e) => {
    const b = e.target.closest && e.target.closest('.slot');
    if (on && b) { b.classList.add('press'); if (b.classList.contains('bk')) post({ type: 'grab' }); return; }
    fresh.querySelectorAll('.slot.press').forEach((el) => el.classList.remove('press'));
  };
  fresh.addEventListener('pointerdown', press(true));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) fresh.addEventListener(ev, press(false));
  const pf = fresh.querySelector('.slot.dom .pf');
  if (pf) pf.insertAdjacentHTML('afterbegin', '<svg class="knot" viewBox="0 0 44 16"><path d="M4 8c6-7 12-7 18 0s12 7 18 0M4 8c6 7 12 7 18 0s12-7 18 0"/></svg>');
  dock.place(4);
  markDock();
}
function markDock() {
  if (!dock) return;
  const k = st.show ? st.dockSlots.findIndex((x) => x.kind === st.show.kind) : st.open ? st.dockSlots.findIndex((x) => x.domain) : -1;
  dock.mark(k >= 0 ? k + 1 : -1);
}
function pickSlot(i) {
  const x = st.dockSlots[i - 1];
  if (!x) return;
  // While he throws, back just stops the throwing; another tab stops it and goes there.
  if (flow) {
    window.closePick();
    if (x.back) return;
  }
  if (x.back) {
    // The back pill's own ball does the leaving; the dock ball stays where it is.
    const el = $('dock').querySelector('.slot.bk');
    if (el && !st.open) { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
    leave();
    return;
  }
  dock.hop(i);
  if (x.kind) { tab(x.kind); markDock(); return; }
  if (x.domain) {
    putAway();
    if (st.open) collapse(); else if (!st.charge.auto) { st.charge.auto = true; st.charge.ticks = 0; }
  }
}

/** Back from the dock: close the domain if it is open; otherwise your fighter hops off left, the legend salutes, and the page goes. */
function leave() {
  if (st.open) { collapse(); return; }
  if (st.leave) return;
  putAway();
  st.charge.holding = false; st.charge.auto = false;
  st.leave = { t: 0, sent: false };
  if (you.body) you.body.kick(-2.5, 3, 0);
  legend.body.poke();
  post({ type: 'swish' });
}

// ---------- The hint reads itself out ----------
// What to do is the one line people skip, so it does not sit still: a bold wave rolls through it letter by letter every few
// seconds, and the doing words (hold, tap, scrub...) stay in clay. Rebuilt only when the words change, so the wave never restarts.
const VERB = /^(hold|tap|scrub|circle|swipe|pull|drag|slide)$/i;
let hintWas = null;
function setHint(text) {
  if (text === hintWas) return;
  hintWas = text;
  let i = 0;
  $('hint').innerHTML = text.split(/(\s+)/).map((w) => {
    if (!w.trim()) return w;
    const bare = w.replace(/[^a-z]/gi, '');
    const letters = [...w].map((c) => `<i style="--i:${i++}">${esc(c)}</i>`).join('');
    i += 1;
    return `<span class="wd${VERB.test(bare) ? ' v' : ''}">${letters}</span>`;
  }).join('');
}

// ---------- The card follows the scrub ----------
function notes() {
  const sh = st.show;
  if (sh && st.scrub && !st.scrub.done && st.scrub.progress > 0) $('h2').textContent = `${sh.kind === 'racket' ? 'RESTRINGING' : 'CLEANING'} ${Math.round(st.scrub.progress * 100)}%`;
}

// ---------- Ink: draw on the scene with your finger ----------
// The same brush as the TYPE / WRITE page. A stroke stays while it means something and fades after.
const inkCv = document.createElement('canvas');
inkCv.id = 'ink';
canvas.insertAdjacentElement('afterend', inkCv);
const inkG = inkCv.getContext('2d');
const inkStrokes = []; // { pts, brush, fade: null | seconds left }
function sizeInk() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  inkCv.width = window.innerWidth * dpr; inkCv.height = window.innerHeight * dpr;
  inkG.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeInk();
window.addEventListener('resize', sizeInk);
function drawInk(dt) {
  inkG.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (let i = inkStrokes.length - 1; i >= 0; i -= 1) {
    const sk = inkStrokes[i];
    if (sk.fade != null) { sk.fade -= dt; if (sk.fade <= 0) { inkStrokes.splice(i, 1); continue; } }
    if (sk.pts.length > 1) drawBrush(inkG, [sk], sk.fade == null ? 1 : Math.min(1, sk.fade / 0.3), BRUSH_WIDTH * 0.85);
  }
}
/** Is a stroke a loop? Its ends meet, near enough for its size. */
function loopOf(pts) {
  if (pts.length < 6) return null;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const [x0, y0] = pts[0]; const [x1, y1] = pts[pts.length - 1];
  if (diag < 40 || Math.hypot(x1 - x0, y1 - y0) > Math.max(70, diag * 0.45)) return null;
  return { cx: xs.reduce((s, v) => s + v, 0) / pts.length, cy: ys.reduce((s, v) => s + v, 0) / pts.length, diag };
}
function insideLoop(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const toScreen = (p) => { const q = p.clone().project(camera); return [(q.x * 0.5 + 0.5) * window.innerWidth, (-q.y * 0.5 + 0.5) * window.innerHeight]; };

// ---------- The toss: he flings choices into the air and you circle one ----------
// He steps aside and flings them up with his free hand; they fly out on a spring (2.4 Hz, ratio 0.5), staggered 45 ms, and
// float in the upper half of the screen, each bobbing on its own. Circle one with the ink: it pops, flies to his hand and the rest
// fall out of the air. Tap empty space and they all fall: that step is skipped. Tension numbers: swipe sideways for the next range.
//
// Adding is short on purpose: a racket is the brand and how many; shoes are the brand and the color. Everything else (model,
// string, gauge, tension, accent) is optional: circle the thing he holds and he throws those up one at a time. What you pick is
// kept as you go, so stopping halfway loses nothing.
const TOSS_D = 4; // how far in front of the camera they float
const tokens = []; // { sp, val, ndc: [x, y], p, v, state, t, delay, w, h, spin, seed }
let flow = null; // { kind, steps, i, item, add: {} }
st.aside = { x: 0, v: 0 };
st.flingT = 9;

function pxWorld() { return (2 * TOSS_D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / window.innerHeight; }
const ndcPoint = (x, y, out) => out.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(TOSS_D).add(camera.position);

/**
 * Floating slots, in screen space: a grid in the band between the status bar and the characters (who have shrunk into the
 * lower right). Each cell is one choice; fit scales every choice down until the biggest one fits its cell, so nothing overlaps.
 */
function slots(n, cols, arts) {
  const W = window.innerWidth; const H = window.innerHeight;
  const rows = Math.ceil(n / cols);
  const top = (parseFloat(getComputedStyle($('ui')).paddingTop) || 30) + 8;
  const bottom = H * (rows > 2 ? 0.48 : 0.42);
  const rowH = (bottom - top) / rows; const colW = (W - 24) / cols;
  const fit = Math.min(1, (rowH * 0.92) / Math.max(...arts.map((a) => a.h)), (colW * 0.94) / Math.max(...arts.map((a) => a.w)));
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const r = Math.floor(k / cols); const inRow = Math.min(cols, n - r * cols); const c = k % cols;
    const px = 12 + ((cols - inRow) * colW) / 2 + colW * (c + 0.5) + (inRow < cols ? 0 : (r % 2 ? 1 : -1) * colW * 0.04);
    const py = top + rowH * (r + 0.5);
    out.push([(px / W) * 2 - 1, 1 - (py / H) * 2]);
  }
  return { where: out, fit };
}

function spawn(opts, cols) {
  for (const tk of tokens) if (tk.state !== 'chosen') drop(tk);
  const hand = legend.arms[0].hand.getWorldPosition(new THREE.Vector3());
  const arts = opts.map((o) => o.art());
  const { where, fit } = slots(opts.length, cols, arts);
  opts.forEach((o, k) => {
    const art = arts[k];
    const tex2 = new THREE.CanvasTexture(art.canvas);
    tex2.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex2, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    sp.renderOrder = 20;
    sp.material.rotation = (Math.random() - 0.5) * 0.06;
    sp.visible = false;
    sp.position.copy(hand);
    scene.add(sp);
    tokens.push({
      sp, val: o.val, o, ndc: where[k], p: hand.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 1.5, 1.5),
      state: 'fly', t: 0, delay: 0.12 + k * 0.045, w: art.w * fit, h: art.h * fit, spin: 0, seed: Math.random() * 10,
    });
  });
  st.flingT = 0;
  post({ type: 'toss' });
}
function drop(tk) {
  if (tk.state === 'drop') return;
  tk.state = 'drop'; tk.t = 0;
  tk.v.set((Math.random() - 0.5) * 1.5, Math.random() * 1.2, 0);
  tk.spin = (Math.random() - 0.5) * 6;
}
function stepTokens(dt) {
  const k = pxWorld();
  const target = new THREE.Vector3();
  const hand = legend.arms[0].hand.getWorldPosition(new THREE.Vector3());
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const tk = tokens[i];
    tk.t += dt;
    let scale = 1; let alpha = 1;
    if (tk.state === 'fly' || tk.state === 'float') {
      if (tk.t < tk.delay) { tk.p.copy(hand); tk.sp.visible = false; continue; }
      tk.sp.visible = true;
      const u = tk.t - tk.delay;
      if (tk.state === 'fly' && u > 0.9) tk.state = 'float';
      ndcPoint(tk.ndc[0] + 0.008 * Math.sin(st.clock * 1.3 + tk.seed), tk.ndc[1] + 0.006 * Math.sin(st.clock * 1.7 + tk.seed * 2), target);
      sprV(tk.p, tk.v, target, dt, 2.4, 0.5);
      scale = 0.35 + 0.65 * smooth(u / 0.35);
    } else if (tk.state === 'chosen') {
      // Pops, then flies to his hand and is gone.
      if (tk.t > 0.18) sprV(tk.p, tk.v, hand, dt, 3, 0.8);
      scale = tk.t < 0.18 ? 1 + 0.3 * Math.sin((Math.PI * tk.t) / 0.18) : Math.max(0, 1 - (tk.t - 0.18) / 0.35);
      if (tk.t > 0.55) { scene.remove(tk.sp); tk.sp.material.map.dispose(); tk.sp.material.dispose(); tokens.splice(i, 1); continue; }
    } else {
      tk.v.y -= 7 * dt;
      tk.p.addScaledVector(tk.v, dt);
      tk.sp.material.rotation += tk.spin * dt;
      alpha = Math.max(0, 1 - tk.t / 0.7);
      if (tk.t > 0.7) { scene.remove(tk.sp); tk.sp.material.map.dispose(); tk.sp.material.dispose(); tokens.splice(i, 1); continue; }
    }
    tk.sp.position.copy(tk.p);
    tk.sp.scale.set(tk.w * k * scale, tk.h * k * scale, 1);
    tk.sp.material.opacity = alpha;
  }
}
const live = () => tokens.filter((tk) => tk.state === 'fly' || tk.state === 'float');

// The steps. Each throws its choices and says what to do with the pick.
const opt = (val, art) => ({ val, art });
const colorName = (hex) => (COLORS.find(([, h]) => h === hex) || ['', ''])[0];
const STEP = {
  brand: { say: 'CIRCLE THE BRAND.', cols: 2, opts: (f) => Object.keys(f.kind === 'racket' ? RACKETS : SHOES).map((b) => opt(b, () => brandArt(b))) },
  count: { say: 'HOW MANY OF THEM?', cols: 3, opts: () => [1, 2, 3].map((n) => opt(n, () => numArt(`x${n}`, n === 1 ? 'JUST ONE' : 'SAME FRAME'))) },
  color: { say: 'WHAT COLOR ARE THEY?', cols: 4, opts: () => COLORS.map(([n, h], k) => opt(h, () => blobArt(n, h, k))) },
  accent: { say: 'AND THE ACCENT?', cols: 4, opts: () => COLORS.map(([n, h], k) => opt(h, () => blobArt(n, h, k + 3))) },
  model: { say: 'WHICH ONE?', cols: 2, opts: (f) => ((f.kind === 'racket' ? RACKETS : SHOES)[f.add.brand || (f.item && f.item.brand)] || []).map((m) => opt(m, () => wordArt(m))) },
  string: { say: 'WHAT STRING IS IN IT?', cols: 3, opts: () => STRINGS.map(([n, h]) => opt(n, () => coilArt(n, h))) },
  gauge: { say: 'WHAT GAUGE?', cols: 3, opts: () => GAUGES.map((g) => opt(g, () => numArt(g, ''))) },
  mains: { say: 'MAINS TENSION, IN LB?', write: true, cols: 1, opts: (f) => [opt(setupOf(f.item).mains, () => numArt(String(setupOf(f.item).mains), ''))] },
  crosses: { say: 'CROSSES TENSION, IN LB?', write: true, cols: 1, opts: (f) => [opt(setupOf(f.item).crosses, () => numArt(String(setupOf(f.item).crosses), ''))] },
};
const DEFAULT_SETUP = { string: null, gauge: '16', mains: 52, crosses: 52 };
const setupOf = (it) => ({ ...DEFAULT_SETUP, ...((it && it.setup) || {}) });
const specOf = (it) => {
  const s = it && it.setup;
  if (!s) return '';
  const t = s.mains === s.crosses ? `${s.mains}` : `${s.mains}/${s.crosses}`;
  return [s.string, s.gauge ? `${s.gauge} GA` : '', `${t} LB`].filter(Boolean).join(' / ');
};

/** Start a run of throws. kind: racket | shoes; item: what he holds (details), or null (adding a new one). */
function startFlow(kind, item) {
  if (flow) return;
  let steps;
  if (!item) steps = kind === 'racket' ? ['brand', 'count'] : ['brand', 'color'];
  else if (kind === 'racket') steps = [...(item.brand ? [] : ['brand']), 'model', 'string', 'gauge', 'mains', 'crosses'];
  else steps = [...(item.brand ? [] : ['brand']), 'model', 'color', 'accent'];
  flow = { kind, steps, i: -1, item, add: {}, pen: null };
  post({ type: 'pick', open: true });
  nextStep();
}
function nextStep() {
  flow.i += 1;
  penClear();
  // A step with nothing to throw (no models listed for that brand) is passed over.
  while (flow.i < flow.steps.length && !STEP[flow.steps[flow.i]].opts(flow).length) flow.i += 1;
  if (flow.i >= flow.steps.length) { endFlow(true); return; }
  const def = STEP[flow.steps[flow.i]];
  spawn(def.opts(flow), def.cols);
  panel();
}
function endFlow(finished) {
  const f = flow;
  penClear();
  flow = null;
  for (const tk of tokens) if (tk.state !== 'chosen') drop(tk);
  post({ type: 'pick', open: false });
  if (finished && !f.item) {
    const a = f.add;
    if (f.kind === 'racket') post({ type: 'add', kind: 'racket', brand: a.brand, name: a.brand || 'RACKET', count: a.count || 1 });
    else {
      const colors = a.color ? [a.color] : [];
      post({ type: 'add', kind: 'shoes', brand: a.brand, colors, name: [a.brand, colorName(a.color)].filter(Boolean).join(' ') || 'COURT SHOES' });
    }
  }
  panel();
}
window.closePick = () => { if (flow) { post({ type: 'swish' }); endFlow(false); } };

/** What a pick does. Details are saved the moment they are picked. */
function apply(step, val) {
  const it = flow.item;
  if (!it) { flow.add[step] = val; return; }
  if (step === 'brand') { flow.add.brand = val; it.brand = val; post({ type: 'detail', id: it.id, patch: { brand: val } }); return; }
  if (step === 'model') { it.model = val; it.name = val; post({ type: 'detail', id: it.id, patch: { model: val, name: val } }); return; }
  if (step === 'color' || step === 'accent') {
    const c = [...(it.colors || [])];
    c[step === 'color' ? 0 : 1] = val;
    if (!c[0]) c[0] = '#f4f1ea';
    it.colors = c;
    post({ type: 'detail', id: it.id, patch: { colors: c } });
    dress(it, 'shoes');
    return;
  }
  const s = setupOf(it);
  if (step === 'string') s.string = val;
  if (step === 'gauge') s.gauge = val;
  if (step === 'mains') { s.mains = val; s.crosses = val; }
  if (step === 'crosses') s.crosses = val;
  it.setup = s;
  post({ type: 'setup', id: it.id, setup: s });
  if (step === 'string') dress(it, 'racket');
}

/** A finished stroke while he is throwing. */
function judge(pts) {
  const sk = inkStrokes[inkStrokes.length - 1];
  const fly = live();
  const at = fly.map((tk) => toScreen(tk.p));
  const loop = loopOf(pts);
  let best = -1;
  if (loop) {
    let d0 = Infinity;
    at.forEach(([x, y], k) => {
      const d = Math.hypot(x - loop.cx, y - loop.cy);
      if ((insideLoop(pts, x, y) || d < 45) && d < d0) { best = k; d0 = d; }
    });
  } else {
    const [x0, y0] = pts[0]; const [x1, y1] = pts[pts.length - 1];
    const moved = Math.hypot(...pts.reduce(([w, h], [x, y]) => [Math.max(w, Math.abs(x - x0)), Math.max(h, Math.abs(y - y0))], [0, 0]));
    // A tap: on one picks it; on empty air skips the step.
    if (moved < 14 && pts.length < 12 && !flow.pen) {
      at.forEach(([x, y], k) => { const tk = fly[k]; if (Math.abs(pts[0][0] - x) < tk.w / 2 && Math.abs(pts[0][1] - y) < tk.h / 2) best = k; });
      if (best < 0) { sk.fade = 0.01; post({ type: 'swish' }); for (const tk of tokens) drop(tk); nextStep(); return; }
    }
  }
  // On tension, anything that is not circling his number is you writing yours.
  if (best < 0 && STEP[flow.steps[flow.i]].write) { penAdd(sk); return; }
  if (best < 0) { sk.fade = 0.3; return; }
  penClear();
  sk.fade = 0.6;
  const tk = fly[best];
  tk.state = 'chosen'; tk.t = 0; tk.v.set(0, 0, 0);
  for (const o of fly) if (o !== tk) drop(o);
  choose(tk);
}
function choose(tk) {
  post({ type: 'circled' });
  legend.laugh = 0.3;
  apply(flow.steps[flow.i], tk.val);
  const at = flow.i;
  setTimeout(() => { if (flow && flow.i === at) nextStep(); }, 380);
}

// ---------- Writing a number ----------
// On tension you write the number where his guess floats. The strokes wait 0.8 s after your finger lifts (a 5 then an 8),
// then go to the app, which reads the handwriting and hands back its guesses. The first one that is a tension wins: it
// becomes a number in the air and flies to his hand, like a circled one.
function penAdd(sk) {
  if (!flow.pen) flow.pen = { strokes: [], timer: 0, sent: false };
  const pen = flow.pen;
  if (pen.sent) return;
  pen.strokes.push(sk);
  clearTimeout(pen.timer);
  pen.timer = setTimeout(penSend, 800);
  setHint('keep writing, or wait and he reads it.');
}
function penHold() { if (flow && flow.pen && !flow.pen.sent) clearTimeout(flow.pen.timer); }
function penSend() {
  const pen = flow && flow.pen;
  if (!pen || pen.sent) return;
  pen.sent = true;
  const all = pen.strokes.flatMap((sk) => sk.pts);
  const x0 = Math.min(...all.map((p) => p[0])) - 10; const y0 = Math.min(...all.map((p) => p[1])) - 10;
  const w = Math.max(...all.map((p) => p[0])) - x0 + 10; const h = Math.max(...all.map((p) => p[1])) - y0 + 10;
  const t0 = pen.strokes[0].ts[0];
  post({ type: 'read', w, h, strokes: pen.strokes.map((sk) => sk.pts.map(([x, y], k) => [x - x0, y - y0, Math.round(sk.ts[k] - t0)])) });
  setHint('reading it...');
  pen.giveUp = setTimeout(() => window.readNum(null), 5000);
}
function penClear() {
  if (!flow || !flow.pen) return;
  clearTimeout(flow.pen.timer); clearTimeout(flow.pen.giveUp);
  for (const sk of flow.pen.strokes) if (sk.fade == null) sk.fade = 0.3;
  flow.pen = null;
}
const DIGIT = { o: '0', O: '0', D: '0', l: '1', I: '1', i: '1', '|': '1', z: '2', Z: '2', S: '5', s: '5', b: '6', G: '6', B: '8', g: '9', q: '9' };
/** The app's reading of what you wrote: guesses, best first; null when it could not read. */
window.readNum = (cands) => {
  const pen = flow && flow.pen;
  if (!pen || !pen.sent) return;
  clearTimeout(pen.giveUp);
  const nums = (cands || []).map((c) => Number([...c.replace(/\s/g, '')].map((ch) => DIGIT[ch] ?? ch).join('')));
  const v = nums.find((n) => Number.isInteger(n) && n >= 30 && n <= 80);
  const all = pen.strokes.flatMap((sk) => sk.pts);
  const cx = all.reduce((a, p) => a + p[0], 0) / all.length; const cy = all.reduce((a, p) => a + p[1], 0) / all.length;
  penClear();
  if (v == null) { post({ type: 'swish' }); setHint('he could not read that. write it again, bigger.'); return; }
  // Your number appears where you wrote it and flies to him.
  for (const tk of tokens) if (tk.state !== 'chosen') drop(tk);
  const art = numArt(String(v), '');
  const tex2 = new THREE.CanvasTexture(art.canvas);
  tex2.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex2, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  sp.renderOrder = 20;
  scene.add(sp);
  const p = ndcPoint((cx / window.innerWidth) * 2 - 1, 1 - (cy / window.innerHeight) * 2, new THREE.Vector3());
  const tk = { sp, val: v, ndc: [0, 0], p, v: new THREE.Vector3(), state: 'chosen', t: 0, delay: 0, w: art.w, h: art.h, spin: 0, seed: 0 };
  tokens.push(tk);
  choose(tk);
};

// The name on the card: tap to rename, hold to retire. On a blank, tap to add one.
let pressTimer = 0;
const arm = (on) => { $('h1').classList.toggle('arming', on); if (!on) panel(); };
$('h1').addEventListener('pointerdown', () => {
  const it = st.show && currentOf(st.show);
  if (!it) return;
  arm(true);
  $('h2').textContent = 'KEEP HOLDING TO RETIRE IT';
  pressTimer = setTimeout(() => { pressTimer = -1; arm(false); post({ type: 'remove', id: it.id }); }, 900);
});
$('h1').addEventListener('pointerup', () => {
  if (!st.show) return;
  const it = currentOf(st.show);
  if (!it) { startFlow(st.show.kind, null); return; }
  if (pressTimer !== -1) { clearTimeout(pressTimer); arm(false); post({ type: 'edit', id: it.id }); }
  pressTimer = 0;
});
for (const ev of ['pointercancel', 'pointerleave']) $('h1').addEventListener(ev, () => { if (pressTimer > 0) { clearTimeout(pressTimer); arm(false); } pressTimer = 0; });

// ---------- Panel ----------
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
function panel() {
  const ui = $('ui');
  const past = st.focus && (st.rackets.get(st.focus) || st.shoes.get(st.focus));
  ui.classList.toggle('focus', !!past);
  ui.classList.toggle('past', !!past);
  if (past) {
    const d = past.it;
    $('kind').textContent = d.kind === 'shoes' ? 'SHOES' : 'RACKET';
    $('name').textContent = d.name;
    $('wl').textContent = d.record || '0-0';
    $('sub').textContent = 'WON-LOST WITH IT';
    $('facts').replaceChildren(...(d.lines || []).map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
    $('how').textContent = st.held ? 'tap anywhere to put it back in the ground' : 'pull it up out of the ground';
    return;
  }
  const d = st.data || {};
  const inside = d.inside || {};
  const sh = st.show;
  document.body.classList.toggle('showing', !!sh);
  document.body.classList.toggle('tossing', !!flow);
  if (flow && flow.i >= 0 && flow.i < flow.steps.length) {
    const def = STEP[flow.steps[flow.i]];
    $('h2').classList.remove('ok');
    $('h1').textContent = def.say;
    $('h2').textContent = flow.steps.length > 1 ? `${flow.i + 1} OF ${flow.steps.length}` : '';
    $('due').innerHTML = '';
    if (!flow.pen) setHint(def.write ? 'write the number with your finger. circle his to keep it. tap empty space to skip.' : 'circle one with your finger. tap empty space to skip.');
    return;
  }
  if (sh) {
    const n = ofKind(sh.kind).length;
    const it = currentOf(sh);
    const s = sh.kind === 'racket' ? 'strings' : 'soles';
    const row = it && rowsOf(it).find((r) => r.s === s);
    const w = row ? row.worn : 0;
    const done = st.scrub && st.scrub.done;
    const word = done ? 'FRESH' : w >= 1 ? (s === 'strings' ? 'DEAD' : 'WORN OUT') : w >= 0.6 ? 'TIRED' : 'FRESH';
    $('h1').textContent = it ? `${it.name}${it.count > 1 ? ` x${it.count}` : ''}` : sh.kind === 'racket' ? '+ NEW RACKET' : '+ NEW SHOES';
    $('h2').textContent = it ? `${s.toUpperCase()} ${word}${n > 1 ? `  ${sh.idx + 1} OF ${n}` : ''}` : 'TAP THE NAME TO ADD ONE';
    $('h2').classList.toggle('ok', !!it && (done || w < 0.6));
    // Two kinds of line: what is in it now, and what has been done to it (newest first).
    const racket = sh.kind === 'racket';
    const lines = !it ? [] : [
      racket ? ['IN IT', specOf(it) || 'not set. circle the racket to add it.'] : null,
      ...(it.log || []).map((t, k) => [k ? '' : 'LOG', t]),
    ].filter(Boolean);
    $('due').innerHTML = lines.map(([b, t]) => `<li class="log"><b>${b}</b><span>${esc(t)}</span></li>`).join('');
    setHint(!it ? 'tap it and he throws you the brands'
      : done ? (racket ? 'restrung. logged.' : 'new pair. logged.')
        : racket ? 'just restrung? scrub the strings. circle the racket to change the string. done with it? hold the name and it goes to your DOMAIN.'
          : 'new pair? scrub them. circle the shoes for model and color. done with them? hold the name and they go to your DOMAIN.');
    return;
  }
  $('h2').classList.remove('ok');
  $('h1').textContent = st.open ? 'YOUR DOMAIN.' : d.title || 'YOUR GEAR.';
  $('h2').textContent = st.open ? inside.sub || '' : d.sub || '';
  // Outside: one line per dock button, saying exactly what you have and what shape it is in.
  $('due').innerHTML = st.open ? '' : [['racket', 'RACKET', 'strings'], ['shoes', 'SHOES', 'soles']].map(([kind, label, s]) => {
    const list = ofKind(kind);
    if (!list.length) return `<li class="none"><b>${label}</b><span>none yet. tap ${label} to add one.</span></li>`;
    const it = list.reduce((a, b) => (wornOf(b, s) > wornOf(a, s) ? b : a));
    const w = wornOf(it, s);
    const row = rowsOf(it).find((r) => r.s === s);
    const n = row ? parseInt(row.text, 10) : 0;
    const shape = s === 'strings' ? (w >= 1 ? 'strings dead' : w >= 0.6 ? 'strings tired' : 'strings fresh') : (w >= 1 ? 'worn out' : w >= 0.6 ? 'getting worn' : 'fine');
    const since = Number.isFinite(n) ? `, ${n} match${n === 1 ? '' : 'es'} ${s === 'strings' ? 'since a restring' : 'on them'}` : '';
    const more = list.length > 1 ? ` (+${list.length - 1} more)` : '';
    return `<li class="${w >= 1 ? 'bad' : w >= 0.6 ? 'meh' : 'ok'}"><b>${label}</b><span>${esc(it.name)}${more}: ${shape}${since}</span></li>`;
  }).join('');
  setHint(st.open ? inside.hint || '' : d.hint || 'hold your fighter, or tap DOMAIN, to expand it');
}
function focus(id, quiet) {
  st.focus = id;
  markDock();
  panel();
  if (!quiet) post({ type: 'focus', id });
}

/** The app retired something in use: it leaves his hand and gets planted. */
window.retire = (id) => {
  if (st.show && showR.g.visible) st.gone.set(id, showR.bed.getWorldPosition(new THREE.Vector3()));
  else if (st.show && showS.g.visible) st.gone.set(id, showS.pair.getWorldPosition(new THREE.Vector3()));
  st.planting = id;
  st.queue.push(id);
  // Gone from his hand at once.
  st.show = null; showR.g.visible = false; showS.g.visible = false;
  focus(null, true);
};

// ---------- Input ----------
const ray = new THREE.Raycaster();
const ndc = (x, y) => new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
let down = null;
let down_dx = 0;

function pick(x, y) {
  ray.setFromCamera(ndc(x, y), camera);
  const objs = [];
  for (const r of st.rackets.values()) if ((r.mode === 'planted' && st.open && r.e.x > -0.3) || r.mode === 'held') objs.push(r.hit);
  for (const s of st.shoes.values()) objs.push(s.hit);
  if (showR.g.visible) objs.push(showR.bed, showR.hit);
  if (showS.g.visible) objs.push(showS.hit);
  if (you.body) objs.push(you.body.mesh);
  objs.push(legend.body.mesh);
  const hit = ray.intersectObjects(objs, false)[0];
  if (!hit) return null;
  const o = hit.object;
  if (o.userData.show || o.userData.bed) return { show: true, point: hit.point };
  if (o.userData.racket) return { racket: o.userData.racket, point: hit.point };
  if (o.userData.shoes) return { shoes: o.userData.shoes, point: hit.point };
  if (you.body && o === you.body.mesh) return { jelly: you, point: hit.point };
  return { jelly: legend, point: hit.point };
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
  // While he is throwing, your finger is ink.
  if (flow) { penHold(); down.ink = { pts: [[e.clientX, e.clientY]], ts: [performance.now()], brush: null, fade: null }; inkStrokes.push(down.ink); return; }
  if (st.held) return;
  // Your finger on what he is holding: scrub it.
  if (down.hit && down.hit.show && st.show && st.show.phase === 'held' && currentOf(st.show)) {
    if (!st.scrub) st.scrub = { cells: new Set(), progress: 0, dist: 0, last: null, done: false };
    st.scrub.last = null;
    down.scrub = true;
    scrubAt(e.clientX, e.clientY);
    return;
  }
  // While he holds something, a finger off it draws: circle what he holds for its details.
  if (st.show && st.show.phase === 'held' && currentOf(st.show) && !(down.hit && down.hit.jelly)) {
    down.ink = { pts: [[e.clientX, e.clientY]], brush: null, fade: null, loose: true };
    inkStrokes.push(down.ink);
  }
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
  down.dx = dx; down_dx = dx;
  if (down.ink) {
    const l = down.ink.pts[down.ink.pts.length - 1];
    if (Math.hypot(e.clientX - l[0], e.clientY - l[1]) > 3) { down.ink.pts.push([e.clientX, e.clientY]); if (down.ink.ts) down.ink.ts.push(performance.now()); }
    if (flow) return;
  }
  if (st.held) return;
  if (down.scrub) { scrubAt(e.clientX, e.clientY); return; }
  const r = down.hit && down.hit.racket;
  if (r && r.pull) {
    r.pull.target = Math.max(0, -dy) / (window.innerHeight * 0.22);
    r.pull.bend = clamp(dx / window.innerWidth, -0.35, 0.35) * 1.6;
    return;
  }
  if (!down.hit && !st.show) st.yaw.target = clamp(down.yaw0 - (dx / window.innerWidth) * 0.9, -0.4, 0.4);
});
function release() {
  if (!down) return;
  const tap = down.moved < 10 && performance.now() - down.t < 350;
  const hit = down.hit;
  const wasScrub = down.scrub;
  const swipe = !wasScrub && Math.abs(down.dx || 0) > 60;
  const ink = down.ink;
  down = null;
  if (ink && flow) { judge(ink.pts); return; }
  if (ink) {
    // A loop round what he holds: he starts throwing its details.
    const loop = loopOf(ink.pts);
    const sh = st.show;
    const at = sh && toScreen((sh.kind === 'racket' ? showR.bed : showS.pair).getWorldPosition(new THREE.Vector3()));
    if (loop && at && (insideLoop(ink.pts, at[0], at[1]) || Math.hypot(at[0] - loop.cx, at[1] - loop.cy) < 70)) {
      ink.fade = 0.6;
      post({ type: 'circled' });
      startFlow(sh.kind, currentOf(sh));
      return;
    }
    ink.fade = loop ? 0.3 : 0.12;
  }
  if (wasScrub) return;
  if (swipe && st.show) { pullOut(st.show.kind, (st.show.idx + (down_dx > 0 ? showCount(st.show.kind) - 1 : 1)) % showCount(st.show.kind)); return; }
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
  if (hit && hit.show) {
    if (st.show && !currentOf(st.show)) startFlow(st.show.kind, null);
    return;
  }
  // Tapping anywhere else while he holds something: he puts it away.
  if (st.show) { putAway(); if (hit && hit.jelly === legend) { legend.body.poke(); post({ type: 'laugh' }); } return; }
  if (hit && hit.shoes) { hit.shoes.a.v += 3; post({ type: 'swing' }); focus(hit.shoes.it.id); return; }
  if (hit && hit.jelly) {
    const j = hit.jelly;
    const local = j.body.group.worldToLocal(hit.point.clone());
    j.body.poke(local, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.25, -1).normalize(), j === legend ? 4 : 6, 0.5);
    post({ type: j === legend ? 'laugh' : 'poke' });
    return;
  }
  if (st.focus) focus(null);
}
canvas.addEventListener('pointerup', release);

// ---------- Expanding and collapsing ----------
function expand() {
  if (st.open) return;
  st.open = true; st.t = 0;
  st.charge.holding = false; st.charge.auto = false; st.charge.x = 0;
  if (down) down = null;
  putAway();
  if (you.body) { you.body.squash = 0; you.body.kick(0, 3.5, 0); }
  legend.body.kick(0, 2, 0);
  st.shake.v += 7;
  burst(new THREE.Vector3(YOU_AT.x, 0, YOU_AT.z), 50, 2.8);
  if (st.focus) focus(null);
  post({ type: 'expand' });
  buildDock();
  if (dock) dock.hop(4);
  panel();
}
function collapse() {
  if (!st.open) return;
  st.open = false; st.t = 0;
  st.shake.v += 4;
  if (st.focus) focus(null);
  post({ type: 'collapse' });
  buildDock();
  panel();
}
window.expand = expand;
window.collapse = collapse;
canvas.addEventListener('pointercancel', release);

/** The app's back button: put down what you are holding, then let go of the focus, then leave. Returns true if it did something. */
window.unfocus = () => {
  if (st.held) { putBack(st.held); return true; }
  if (st.show) { putAway(); return true; }
  if (st.focus) { focus(null); return true; }
  return false;
};


// ---------- The domain itself: a ball of ink ----------
// Drawn inside out, so only its far side shows: it sits behind your fighter and the legend, never over them. Charging grows it
// round the two of them; at full charge it swells past the camera in 0.5 s and the whole world is inside; then it thins away
// into the domain's sky. Closing, it starts all round you and shrinks to nothing in 0.55 s, letting the paper back in.
const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x0b0c0e, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
dome.renderOrder = -1;
scene.add(dome);
function domeFrame() {
  const centre = you.carrier.position.clone().lerp(legend.carrier.position, 0.5).add(V(0, 0.6, 0));
  dome.position.copy(centre);
  let r = 0; let o = 1;
  if (st.open) {
    r = st.t < 0.5 ? lerp(2.4, 40, smooth(st.t / 0.5) ** 2) : 40;
    o = 1 - smooth((st.t - 0.6) / 0.7);
  } else if (st.t < 0.55 && st.t < 90) {
    r = lerp(40, 0.01, smooth(st.t / 0.55));
  } else if (st.charge.x > 0.001) {
    r = 0.4 + 2.0 * smooth(st.charge.x);
    o = 0.4 + 0.6 * st.charge.x;
  }
  dome.visible = r > 0.02 && o > 0.01 && !REDUCED;
  dome.scale.setScalar(Math.max(0.01, r));
  dome.material.opacity = o;
}

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
  if ((c.holding || c.auto) && !st.open) {
    c.x = Math.min(1, c.x + dt / 1.1);
    const q = Math.floor(c.x * 4);
    if (q > c.ticks) { c.ticks = q; post({ type: 'charge', v: c.x }); }
    if (!c.kissed && c.x >= 0.42) { c.kissed = true; post({ type: 'kiss' }); }
    st.shake.v += (Math.random() - 0.5) * 30 * c.x * dt * 10;
    if (c.x >= 1) expand();
  } else { c.x = Math.max(0, c.x - dt * 3); if (c.x < 0.3) c.kissed = false; }
  if (you.body) you.body.squash = c.x * 0.7;
  // Outside, your fighter stands front and center. As your pillar comes up it hops on and rides it; as it sinks it hops off.
  const k = clamp(1 - youPillar.s.x / youPillar.down, 0, 1);
  const hop = Math.sin(Math.PI * clamp(k * 1.6, 0, 1)) * 0.5;
  you.carrier.position.set(lerp(OUT_SPOT.x, YOU_AT.x, clamp(k * 1.6, 0, 1)), Math.max(0, YOU_AT.y + youPillar.s.x) * k + hop * (1 - k), lerp(OUT_SPOT.z, YOU_AT.z, clamp(k * 1.6, 0, 1)));
  you.carrier.scale.setScalar(lerp(0.44, 0.34, k));
  // Leaving: a hop off the left edge, then the app goes back.
  if (st.leave) {
    st.leave.t += dt;
    const lt = clamp(st.leave.t / 0.55, 0, 1);
    you.carrier.position.x -= 4 * lt * lt;
    you.carrier.position.y += 1.1 * Math.sin(Math.PI * Math.min(1, lt * 1.3));
    if (st.leave.t > 0.5 && !st.leave.sent) { st.leave.sent = true; post({ type: 'leave' }); }
  }
  // The sky turns while the ink covers the page.
  scene.background = st.open && st.t > 0.3 ? inkSky : paperSky;
  for (const r of st.rackets.values()) stepRacket(r, dt);
  for (const s of st.shoes.values()) stepShoes(s, dt);
  if (dock) dock.step(dt);
  // The legend swells in after the field, and bobs.
  if (st.clock > 0.2) spring1(legend.grow, 1, dt, 1.6, 0.5);
  legend.carrier.scale.setScalar(1.2 * Math.max(0, legend.grow.x) * (1 + 0.08 * c.x));
  // It crouches over your fighter wherever your fighter is; while you charge it leans further down over it.
  const gb = G_OUT.clone().lerp(G_IN, k);
  spring1(st.lean, st.show && st.show.phase !== 'out' ? 1 : 0, dt, 1.8, 0.8);
  // He steps aside to throw, so what he throws has the middle of the page.
  spring1(st.aside, flow ? 1 : 0, dt, 1.6, 0.7);
  st.flingT += dt;
  // While he throws, he and your fighter shrink into the lower right corner, so what he throws floats over open page.
  const a = st.aside.x;
  legend.carrier.position.set(gb.x - 0.7 * st.lean.x * (1 - a) + 0.35 * a, -1.0 * a + gb.y - c.x * 0.35 + 0.06 * Math.sin((st.clock * TAU) / 4.6), gb.z + c.x * 0.4 + 0.9 * a);
  legend.carrier.scale.multiplyScalar(1 - 0.55 * a);
  you.carrier.position.x += 0.55 * a;
  you.carrier.position.z += 0.9 * a;
  you.carrier.scale.multiplyScalar(1 - 0.5 * a);
  legend.carrier.rotation.x = c.x * 0.25; // leans in over your fighter while you charge
  legend.body.simulate(dt, st.clock);
  stepShow(dt);
  stepTokens(dt);
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
  // Your fighter never stands behind the card: when its feet would go under the card's top edge, the whole picture slides
  // up until they clear it by 24 px. The card grows and shrinks with what it says, so this is measured, not guessed.
  camera.clearViewOffset();
  const q = you.carrier.getWorldPosition(v3).project(camera);
  const feet = (-q.y * 0.5 + 0.5) * window.innerHeight;
  const want = Math.max(0, feet - (cardTop - 24));
  st.lift += (want - st.lift) * 0.08;
  if (st.lift > 0.5) camera.setViewOffset(window.innerWidth, window.innerHeight, 0, st.lift, window.innerWidth, window.innerHeight);
}
st.lift = 0;
let cardTop = window.innerHeight;
const measureCard = () => { cardTop = $('panel').getBoundingClientRect().top; };
new ResizeObserver(measureCard).observe($('panel'));
window.addEventListener('resize', measureCard);

function pose() {
  cordProgress(st.open ? (REDUCED ? 1 : (st.t - 0.6) / 1.1) : 1 - st.t / 0.35);
  legend.body.render(st.clock);
  if (you.body) you.body.render(st.clock + 0.7);
  domeFrame();
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
  notes();
  drawInk(window.paused ? 0 : Math.min((now - (frame.prev || now)) / 1000, 0.1));
  frame.prev = now;
  if (dock) dock.render();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// Test hooks for stills.
window.demoDomain = (planting = null) => window.setDomain({
  planting,
  you: { cast: 'wall', color: '#d7f205', name: 'TONY' },
  title: 'YOUR GEAR.', sub: '1 THING NEEDS WORK.', inside: { sub: '6 PLANTED. 112 MATCHES IN THE GROUND.', hint: 'pull one up to see what it won. the arrow closes it.' }, due: ['PURE AERO: restring'], hint: 'tap RACKET or SHOES and he pulls it out. tap DOMAIN, or hold your fighter, to see your old gear.',
  gear: [
    { id: 'n1', kind: 'racket', name: 'PURE AERO 2026', setup: { string: 'POLY TOUR REV', gauge: '17', mains: 58, crosses: 61 }, log: ['restrung AUG 30: POLY TOUR REV, 17 GA, 58/61 LB', 'restrung JUN 12: RPM BLAST, 17 GA, 55 LB', '4 restrings since JAN 3'], rows: [{ s: 'strings', word: 'STRINGS', verb: 'RESTRING', text: '17 of 15 matches, 64 of 90 days', worn: 1.13 }] },
    { id: 'n2', kind: 'racket', name: 'BLADE 98 V9', rows: [{ s: 'strings', word: 'STRINGS', verb: 'RESTRING', text: '4 of 15 matches, 20 of 90 days', worn: 0.27 }] },
    { id: 'n3', kind: 'shoes', name: 'GEL RESOLUTION', rows: [{ s: 'soles', word: 'SOLES', verb: 'NEW PAIR', text: '30 of 50 matches, 100 of 180 days', worn: 0.6 }] },
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
window.__pose = (c) => { st.charge.x = c; };
window.__tab = (k) => tab(k);
window.__skip = (n = 1) => { for (let k = 0; k < n; k += 1) if (flow) nextStep(); };
// Where each floating choice is on screen, and its value: for circling in tests.
window.__tokens = () => live().map((tk) => ({ val: tk.val, at: toScreen(tk.p) }));
window.__flow = (kind, id) => startFlow(kind, id ? now.list.find((i) => i.id === id) : null);
window.__scrub = (pts) => { if (!st.scrub) st.scrub = { cells: new Set(), progress: 0, dist: 0, last: null, done: false }; for (const [x, y] of pts) scrubAt(x, y); };

post({ type: 'ready' });
