// Make your fighter: your fighter is a lump of jelly candy on a paper studio, and you build it with your hands.
// After docs/mo-design/vids/melon-motion.mov (a gummy you grab, stretch, twist and drop, wobbling back with weight)
// and the Motion Lab cheat sheet (docs/mo-design/images/03): playful characters ring on a 0.5-ish spring, holds are never frozen.
//
// The body is a real soft body, not a canned animation:
// - The mesh is the play style's silhouette extruded with a fat bevel and tessellated to ~0.08 edges, then bent by a 4x4x4 Bezier lattice.
// - The 64 lattice nodes are simulated at 240 Hz with shape matching (Muller 2005): 27 overlapping 2x2x2 clusters let it bend and twist
//   locally, one global cluster (rigid blended with linear by `beta`) keeps the overall shape. Stiffness, softness, weight and damping
//   are per play style, so the Wall is a brick of jelly and the Junkballer barely holds together.
// - Grab it anywhere: lattice nodes near your finger follow it (Gaussian, sigma 0.45), the rest drag behind. Let go and it flings,
//   tumbles, hits the paper and wobbles out. Tap it: it gets poked where you tapped.
//
// Motion spec (times in ms):
// - Intro: dropped from 2.6 above the floor, lands and rings out on its own spring.
// - Style swap: 0-240 the body slumps into a puddle (rest height to 18%, width to 135%) on the exit curve (0.7, 0, 0.84, 0).
//   At 240 the new body takes over the same lattice. 240-660 it pours back up on the pop curve (0.34, 1.56, 0.64, 1) with a 2.6 up-kick,
//   so the overshoot rings through the jelly. The mini you tapped leaves the shelf (scale to 0, 200 ms); the old one pops back (pop curve, 320 ms).
// - Color: a drop of paint falls from 3.2 (g 14), splats where it hits, kicks the nodes under it down 2.4, and the new color floods
//   through the body from the impact point at 2.4 units/s with a 0.14 soft front.
// - Hold: breathes 2.5% on a 2.2 s sine, blinks 110 ms every 3.1 s, and each play style has its own tic (see TICS).
// - Camera: 30 degree lens, follows the body at 1.3 Hz ratio 1, orbits 2 degrees on a 9 s sine. Never parked.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));

const PAPER = 0xefece5;
const INK = 0x16181d;
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const bez = (x1, y1, x2, y2) => (t) => {
  // Cubic bezier easing, solved for x by Newton steps.
  let u = t;
  for (let i = 0; i < 6; i += 1) {
    const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
    const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u = clamp(u - x / dx, 0, 1);
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
};
const EXIT = bez(0.7, 0, 0.84, 0);
const POP = bez(0.34, 1.56, 0.64, 1);
const ENTER = bez(0.16, 1, 0.3, 1);

const CASTS = ['wall', 'moon', 'bot', 'goblin', 'grunter', 'junk', 'comet', 'ghost'];
const LABEL = {
  wall: ['THE WALL', 'Everything comes back.'], moon: ['MOONBALLER', 'Twelve feet over the net, every time.'],
  bot: ['SERVE BOT', 'Ace or double fault. No third option.'], goblin: ['DROPSHOT GOBLIN', 'You will run. You will not get there.'],
  grunter: ['THE GRUNTER', 'Heard from three courts away.'], junk: ['JUNKBALLER', 'No pace, no spin, no rhythm, no mercy.'],
  comet: ['NET RUSHER', 'Chip, charge, pray.'], ghost: ['THE NO-SHOW', '"Running five late."'],
};
const COLORS = ['#d7f205', '#ff3d7f', '#35d6ff', '#ff8a1f', '#9b6bff', '#2fe08a', '#ff5252', '#f4f1e6'];

// Silhouettes, drawn in the same 200x200 box as the 2D avatars (y down), mapped to units (1 unit = 100 px, y up).
const v = (x, y) => [(x - 100) / 100, (100 - y) / 100];
function path() {
  const s = new THREE.Shape();
  const api = {
    m(x, y) { s.moveTo(...v(x, y)); return api; },
    l(x, y) { s.lineTo(...v(x, y)); return api; },
    q(cx, cy, x, y) { s.quadraticCurveTo(...v(cx, cy), ...v(x, y)); return api; },
    arc(cx, cy, r, a0, a1, cw) { s.absarc(...v(cx, cy), r / 100, a0, a1, cw); return api; },
    ell(cx, cy, rx, ry) { s.absellipse(...v(cx, cy), rx / 100, ry / 100, 0, Math.PI * 2, false); return api; },
    shape: s,
  };
  return api;
}
const rrect = (x, y, w, h, r) => path().m(x + r, y).l(x + w - r, y).q(x + w, y, x + w, y + r).l(x + w, y + h - r).q(x + w, y + h, x + w - r, y + h)
  .l(x + r, y + h).q(x, y + h, x, y + h - r).l(x, y + r).q(x, y, x + r, y).shape;
const poly = (pts) => { const p = path().m(...pts[0]); pts.slice(1).forEach((q) => p.l(...q)); return p.shape; };
const circle = (cx, cy, r) => path().ell(cx, cy, r, r).shape;
function crescent() {
  // Outer disc minus an offset disc, as one polygon (an off-center hole would break the triangulator).
  const c1 = new THREE.Vector2(0, 0); const r1 = 0.76;
  const c2 = new THREE.Vector2(0.4, 0.18); const r2 = 0.6;
  const d = c1.distanceTo(c2);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const tu = Math.atan2(c2.y - c1.y, c2.x - c1.x);
  const al = Math.atan2(h, a);
  const be = Math.atan2(h, d - a);
  const s = new THREE.Shape();
  const N = 64;
  for (let i = 0; i <= N; i += 1) {
    const t = tu + al + ((Math.PI * 2 - 2 * al) * i) / N;
    i ? s.lineTo(c1.x + r1 * Math.cos(t), c1.y + r1 * Math.sin(t)) : s.moveTo(c1.x + r1 * Math.cos(t), c1.y + r1 * Math.sin(t));
  }
  for (let i = 0; i <= N; i += 1) {
    const t = tu + Math.PI + be - (2 * be * i) / N;
    s.lineTo(c2.x + r2 * Math.cos(t), c2.y + r2 * Math.sin(t));
  }
  return s;
}
const SHAPES = {
  wall: () => [rrect(38, 36, 124, 130, 16)],
  moon: () => [crescent()],
  bot: () => [circle(100, 14, 9), rrect(96, 14, 8, 26, 3), rrect(46, 38, 108, 82, 18), rrect(62, 122, 76, 50, 12), rrect(28, 64, 16, 32, 7), rrect(156, 64, 16, 32, 7)],
  goblin: () => [path().ell(100, 106, 58, 62).shape, poly([[50, 100], [6, 58], [60, 76]]), poly([[150, 100], [194, 58], [140, 76]])],
  grunter: () => [circle(100, 100, 72)],
  junk: () => [rrect(38, 44, 124, 18, 9), rrect(84, 28, 32, 18, 7), poly([[48, 66], [152, 66], [142, 174], [58, 174]])],
  comet: () => [circle(112, 108, 62), poly([[12, 50], [92, 66], [62, 88]]), poly([[6, 104], [56, 96], [54, 120]]), poly([[22, 154], [62, 128], [74, 152]])],
  ghost: () => [path().m(42, 176).l(42, 88).arc(100, 88, 58, Math.PI, 0, true).l(158, 176).l(135, 162).l(117, 178).l(100, 162).l(83, 178).l(65, 162).shape],
};
/** Where the face sits on each body (svg box), and how far forward of the front face. */
const FACE = {
  wall: [100, 90], moon: [62, 104], bot: [100, 76], goblin: [100, 100],
  grunter: [100, 86], junk: [100, 108], comet: [116, 102], ghost: [100, 88],
};

// How each play style is made of jelly. alpha: shape stiffness per 240 Hz step. beta: how much it stretches as a whole.
// grav: weight. damp: how fast the wobble dies (1/s). pull: how hard a finger can drag it. float: hover height (the ghost).
const FEEL = {
  wall: { alpha: 0.03, beta: 0.0, grav: 18, damp: 7, pull: 0.12 },
  moon: { alpha: 0.012, beta: 0.15, grav: 13, damp: 4.5, pull: 0.3 },
  bot: { alpha: 0.05, beta: 0.0, grav: 15, damp: 9, pull: 0.25 },
  goblin: { alpha: 0.01, beta: 0.3, grav: 14, damp: 4, pull: 0.3 },
  grunter: { alpha: 0.014, beta: 0.1, grav: 16, damp: 4.2, pull: 0.25 },
  junk: { alpha: 0.0055, beta: 0.5, grav: 14, damp: 3, pull: 0.35 },
  comet: { alpha: 0.018, beta: 0.15, grav: 14, damp: 5, pull: 0.3 },
  ghost: { alpha: 0.012, beta: 0.2, grav: 0, damp: 3.5, pull: 0.35, float: 0.35 },
};

// Renderer and studio.
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(PAPER, 1);
renderer.autoClear = false;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const scene = new THREE.Scene();
scene.environment = env;
scene.environmentIntensity = 0.75;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.1));
const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
key.position.set(-4, 7, 5);
const rim = new THREE.DirectionalLight(0xffffff, 1.6);
rim.position.set(3, 4, -6);
scene.add(key, rim);
// The paper backdrop catches the body: a big soft-gradient sweep, lighter in the middle.
{
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#e6e2d9'); gr.addColorStop(0.55, '#f2efe8'); gr.addColorStop(1, '#e3ded4');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}

// A painted contact shadow (three's shadow maps darken everything inside this WebView).
function blobTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(30,24,16,${inner})`); gr.addColorStop(0.5, `rgba(30,24,16,${outer})`); gr.addColorStop(1, 'rgba(30,24,16,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(0.55, 0.2), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.renderOrder = -1;
scene.add(shadow);

// Lattice.
const NL = 4;
const NN = NL * NL * NL;
const nid = (i, j, k) => i + NL * (j + NL * k);
const bern = (s) => [(1 - s) ** 3, 3 * s * (1 - s) ** 2, 3 * s * s * (1 - s), s ** 3];
function weightsFor(p, box) {
  const s = (p.x - box.min.x) / (box.max.x - box.min.x);
  const t = (p.y - box.min.y) / (box.max.y - box.min.y);
  const u = (p.z - box.min.z) / (box.max.z - box.min.z);
  const bs = bern(clamp(s, 0, 1)); const bt = bern(clamp(t, 0, 1)); const bu = bern(clamp(u, 0, 1));
  const w = new Float32Array(NN);
  for (let k = 0; k < NL; k += 1) for (let j = 0; j < NL; j += 1) for (let i = 0; i < NL; i += 1) w[nid(i, j, k)] = bs[i] * bt[j] * bu[k];
  return w;
}

const EXTRUDE = { depth: 0.4, bevelEnabled: true, bevelThickness: 0.17, bevelSize: 0.1, bevelSegments: 6, curveSegments: 28, steps: 1 };
function bodyGeometry(cast, fine) {
  let g = new THREE.ExtrudeGeometry(SHAPES[cast](), EXTRUDE);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  if (fine) g = new TessellateModifier(0.085, 8).modify(g);
  g = mergeVertices(g, 1e-4);
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.userData.off = [-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2];
  g.translate(...g.userData.off);
  g.computeBoundingBox();
  g.computeVertexNormals();
  return g;
}

const jelly = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07,
  transmission: 0.28, thickness: 0.9, ior: 1.35, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 1,
});
renderer.transmissionResolutionScale = 0.5;
const bodyMesh = new THREE.Mesh(new THREE.BufferGeometry(), jelly);
bodyMesh.frustumCulled = false;
scene.add(bodyMesh);

// Face: glossy eyes and an ink mouth that ride the jelly.
const face = new THREE.Group();
const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0xfffdf0, roughness: 0.15, clearcoat: 1 });
const inkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.35 });
const eyes = [-1, 1].map((sx) => {
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), eyeMat);
  white.scale.set(0.9, 1.25, 0.45);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), inkMat);
  pupil.scale.set(1, 1.35, 0.5);
  pupil.position.z = 0.04;
  g.add(white, pupil);
  g.userData = { sx, pupil, white };
  face.add(g);
  return g;
});
const smile = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 10, 28, Math.PI), inkMat);
smile.rotation.z = Math.PI;
const mouthO = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), inkMat);
mouthO.scale.set(1, 1, 0.3);
const mouthBar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), inkMat);
const brows = [-1, 1].map((sx) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.16, 4, 8), inkMat); b.rotation.z = Math.PI / 2 + sx * 0.45; b.userData.sx = sx; face.add(b); return b; });
face.add(smile, mouthO, mouthBar);
scene.add(face);

// The simulated body.
const B = {
  cast: null, feel: FEEL.wall, geo: null, count: 0, W: null, rest: null, restV: null, faceW: null, faceRest: null,
  x: new Float32Array(NN * 3), v: new Float32Array(NN * 3), p: new Float32Array(NN * 3), r: new Float32Array(NN * 3),
  colors: null, colorFrom: null, flood: null,
  S: new THREE.Vector3(1, 1, 1),
};
let clusters = [];
{
  for (let k = 0; k < NL - 1; k += 1) for (let j = 0; j < NL - 1; j += 1) for (let i = 0; i < NL - 1; i += 1) {
    const idx = [];
    for (let c = 0; c < 8; c += 1) idx.push(nid(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1)));
    clusters.push({ idx, q: [0, 0, 0, 1], global: false });
  }
  clusters.push({ idx: [...Array(NN).keys()], q: [0, 0, 0, 1], global: true });
}
const count = new Float32Array(NN);
for (const c of clusters) for (const m of c.idx) count[m] += c.global ? 2 : 1;

function setBody(cast, keepNodes) {
  const geo = bodyGeometry(cast, true);
  const box = geo.boundingBox.clone().expandByScalar(0.015);
  const pos = geo.attributes.position;
  const n = pos.count;
  const W = new Float32Array(n * NN);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < n; i += 1) W.set(weightsFor(tmp.fromBufferAttribute(pos, i), box), i * NN);
  // Rest lattice: an evenly spaced box around the body.
  for (let k = 0; k < NL; k += 1) for (let j = 0; j < NL; j += 1) for (let i = 0; i < NL; i += 1) {
    const m = nid(i, j, k) * 3;
    B.r[m] = THREE.MathUtils.lerp(box.min.x, box.max.x, i / (NL - 1));
    B.r[m + 1] = THREE.MathUtils.lerp(box.min.y, box.max.y, j / (NL - 1));
    B.r[m + 2] = THREE.MathUtils.lerp(box.min.z, box.max.z, k / (NL - 1));
  }
  const [fx, fy] = v(...FACE[cast]);
  const fz = EXTRUDE.depth + EXTRUDE.bevelThickness; // front face, before centering
  const [ox, oy, oz] = geo.userData.off;
  const faceRest = new THREE.Vector3(fx + ox, fy + oy, fz + oz);
  B.faceRest = faceRest;
  B.faceW = [
    weightsFor(faceRest, box),
    weightsFor(faceRest.clone().add(new THREE.Vector3(0.1, 0, 0)), box),
    weightsFor(faceRest.clone().add(new THREE.Vector3(0, 0.1, 0)), box),
  ];
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color(B.color || COLORS[0]);
  for (let i = 0; i < n; i += 1) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  B.colors = colors;
  B.colorFrom = colors.slice();
  B.flood = null;
  B.restV = pos.array.slice();
  if (B.geo) B.geo.dispose();
  B.geo = geo; B.count = n; B.W = W; B.cast = cast; B.feel = FEEL[cast];
  bodyMesh.geometry = geo;
  for (const cl of clusters) cl.q = [0, 0, 0, 1];
  if (!keepNodes) {
    for (let m = 0; m < NN * 3; m += 1) { B.x[m] = B.r[m]; B.v[m] = 0; }
  }
  jelly.transmission = cast === 'ghost' ? 0.72 : 0.28;
  smile.visible = !['bot', 'grunter'].includes(cast);
  mouthBar.visible = cast === 'bot';
  for (const b of brows) b.visible = cast === 'goblin';
}

// Small 3x3 math on flat arrays, column-major.
function quatMat(q, out) {
  const [x, y, z, w] = q;
  out[0] = 1 - 2 * (y * y + z * z); out[1] = 2 * (x * y + z * w); out[2] = 2 * (x * z - y * w);
  out[3] = 2 * (x * y - z * w); out[4] = 1 - 2 * (x * x + z * z); out[5] = 2 * (y * z + x * w);
  out[6] = 2 * (x * z + y * w); out[7] = 2 * (y * z - x * w); out[8] = 1 - 2 * (x * x + y * y);
  return out;
}
const Rm = new Float32Array(9);
const Rup = new Float32Array(9);
/** Rotation part of A, warm-started from q (Muller et al. 2016, "A Robust Method to Extract the Rotational Part of Deformations"). */
function extractRotation(A, q) {
  for (let it = 0; it < 6; it += 1) {
    quatMat(q, Rm);
    let ox = 0; let oy = 0; let oz = 0; let dot = 0;
    for (let c = 0; c < 3; c += 1) {
      const rx = Rm[c * 3]; const ry = Rm[c * 3 + 1]; const rz = Rm[c * 3 + 2];
      const ax = A[c * 3]; const ay = A[c * 3 + 1]; const az = A[c * 3 + 2];
      ox += ry * az - rz * ay; oy += rz * ax - rx * az; oz += rx * ay - ry * ax;
      dot += rx * ax + ry * ay + rz * az;
    }
    const inv = 1 / (Math.abs(dot) + 1e-9);
    ox *= inv; oy *= inv; oz *= inv;
    const w = Math.hypot(ox, oy, oz);
    if (w < 1e-9) break;
    const s = Math.sin(w / 2) / w; const cw = Math.cos(w / 2);
    const ax = ox * s; const ay = oy * s; const az = oz * s;
    const [qx, qy, qz, qw] = q;
    q[0] = cw * qx + ax * qw + ay * qz - az * qy;
    q[1] = cw * qy - ax * qz + ay * qw + az * qx;
    q[2] = cw * qz + ax * qy - ay * qx + az * qw;
    q[3] = cw * qw - ax * qx - ay * qy - az * qz;
    const l = Math.hypot(q[0], q[1], q[2], q[3]);
    q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
  }
  return quatMat(q, Rm);
}
function inv3(m, out) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h; const Bq = -(d * i - f * g); const C = d * h - e * g;
  const det = a * A + b * Bq + c * C;
  if (Math.abs(det) < 1e-12) return false;
  const id = 1 / det;
  out[0] = A * id; out[3] = Bq * id; out[6] = C * id;
  out[1] = -(b * i - c * h) * id; out[4] = (a * i - c * g) * id; out[7] = -(a * h - b * g) * id;
  out[2] = (b * f - c * e) * id; out[5] = -(a * f - c * d) * id; out[8] = (a * e - b * d) * id;
  return true;
}
const det3 = (m) => m[0] * (m[4] * m[8] - m[7] * m[5]) - m[3] * (m[1] * m[8] - m[7] * m[2]) + m[6] * (m[1] * m[5] - m[4] * m[2]);

const goal = new Float32Array(NN * 3);
const rs = new Float32Array(NN * 3); // scaled rest positions this step
const Apq = new Float32Array(9); const Aqq = new Float32Array(9); const AqqI = new Float32Array(9); const Alin = new Float32Array(9);
const grab = { on: false, w: new Float32Array(NN), o: new Float32Array(NN * 3), T: new THREE.Vector3(), plane: new THREE.Plane(), moved: false, sx: 0, sy: 0, hit: null };
const HOME = new THREE.Vector3(0, 0, 0);
const WALL = { x: 1.35, zb: -1.1, zf: 1.2, top: 2.5 };
const H = 1 / 240;

function step() {
  const f = B.feel;
  const S = B.S;
  // Scaled rest shape about the rest center, so slumps and breaths are things the jelly reaches for, not things done to it.
  let rcx = 0; let rcy = 0; let rcz = 0;
  for (let m = 0; m < NN; m += 1) { rcx += B.r[m * 3]; rcy += B.r[m * 3 + 1]; rcz += B.r[m * 3 + 2]; }
  rcx /= NN; rcy /= NN; rcz /= NN;
  for (let m = 0; m < NN; m += 1) {
    rs[m * 3] = rcx + (B.r[m * 3] - rcx) * S.x;
    rs[m * 3 + 1] = rcy + (B.r[m * 3 + 1] - rcy) * S.y;
    rs[m * 3 + 2] = rcz + (B.r[m * 3 + 2] - rcz) * S.z;
  }
  // Mean velocity: damping acts on the wobble (velocity relative to the body), with only a little air drag on the whole.
  let mvx = 0; let mvy = 0; let mvz = 0; let cx = 0; let cy = 0; let cz = 0;
  for (let m = 0; m < NN; m += 1) { mvx += B.v[m * 3]; mvy += B.v[m * 3 + 1]; mvz += B.v[m * 3 + 2]; cx += B.x[m * 3]; cy += B.x[m * 3 + 1]; cz += B.x[m * 3 + 2]; }
  mvx /= NN; mvy /= NN; mvz /= NN; cx /= NN; cy /= NN; cz /= NN;
  const kd = Math.exp(-f.damp * H); const ka = Math.exp(-0.4 * H);
  // Home: a soft pull back to center stage on the floor (1.1 Hz), off while you hold it.
  const hw = (2 * Math.PI * 1.1) ** 2;
  const hx = grab.on ? 0 : -hw * (cx - HOME.x) * H - 2 * 0.9 * 2 * Math.PI * 1.1 * mvx * H;
  const hz = grab.on ? 0 : -hw * (cz - HOME.z) * H - 2 * 0.9 * 2 * Math.PI * 1.1 * mvz * H;
  let hy = -f.grav * H;
  if (f.float !== undefined && !grab.on) {
    const target = f.float + rcy + 0.06 * Math.sin(clock * 2.1);
    hy = -((2 * Math.PI * 0.9) ** 2) * (cy - target) * H - 2 * 0.6 * 2 * Math.PI * 0.9 * mvy * H;
  }
  for (let m = 0; m < NN; m += 1) {
    const o = m * 3;
    B.v[o] = (mvx + (B.v[o] - mvx) * kd) * ka + hx;
    B.v[o + 1] = (mvy + (B.v[o + 1] - mvy) * kd) * ka + hy;
    B.v[o + 2] = (mvz + (B.v[o + 2] - mvz) * kd) * ka + hz;
    B.p[o] = B.x[o] + B.v[o] * H; B.p[o + 1] = B.x[o + 1] + B.v[o + 1] * H; B.p[o + 2] = B.x[o + 2] + B.v[o + 2] * H;
  }
  if (grab.on) {
    const k = f.pull;
    for (let m = 0; m < NN; m += 1) {
      const w = grab.w[m] * k;
      if (w < 1e-4) continue;
      const o = m * 3;
      B.p[o] += (grab.T.x + grab.o[o] - B.p[o]) * w;
      B.p[o + 1] += (grab.T.y + grab.o[o + 1] - B.p[o + 1]) * w;
      B.p[o + 2] += (grab.T.z + grab.o[o + 2] - B.p[o + 2]) * w;
    }
  }
  // Shape matching.
  goal.fill(0);
  for (const cl of clusters) {
    const idx = cl.idx; const n = idx.length;
    let px = 0; let py = 0; let pz = 0; let qx = 0; let qy = 0; let qz = 0;
    for (const m of idx) { px += B.p[m * 3]; py += B.p[m * 3 + 1]; pz += B.p[m * 3 + 2]; qx += rs[m * 3]; qy += rs[m * 3 + 1]; qz += rs[m * 3 + 2]; }
    px /= n; py /= n; pz /= n; qx /= n; qy /= n; qz /= n;
    Apq.fill(0);
    if (cl.global) Aqq.fill(0);
    for (const m of idx) {
      const ax = B.p[m * 3] - px; const ay = B.p[m * 3 + 1] - py; const az = B.p[m * 3 + 2] - pz;
      const bx = rs[m * 3] - qx; const by = rs[m * 3 + 1] - qy; const bz = rs[m * 3 + 2] - qz;
      Apq[0] += ax * bx; Apq[1] += ay * bx; Apq[2] += az * bx;
      Apq[3] += ax * by; Apq[4] += ay * by; Apq[5] += az * by;
      Apq[6] += ax * bz; Apq[7] += ay * bz; Apq[8] += az * bz;
      if (cl.global) {
        Aqq[0] += bx * bx; Aqq[1] += by * bx; Aqq[2] += bz * bx; Aqq[3] += bx * by; Aqq[4] += by * by; Aqq[5] += bz * by; Aqq[6] += bx * bz; Aqq[7] += by * bz; Aqq[8] += bz * bz;
      }
    }
    let R = extractRotation(Apq, cl.q);
    if (cl.global && !grab.on) {
      // A weeble, not a melon: left alone it climbs back upright and turns to face you (about 1.5 Hz with the jelly's own ring).
      const up = cl.up || (cl.up = [0, 0, 0, 1]);
      const k = 0.012;
      const d = cl.q[3] < 0 ? -1 : 1;
      for (let i = 0; i < 3; i += 1) up[i] = cl.q[i] * d * (1 - k);
      up[3] = cl.q[3] * d * (1 - k) + k;
      const l = Math.hypot(up[0], up[1], up[2], up[3]);
      for (let i = 0; i < 4; i += 1) up[i] /= l;
      R = quatMat(up, Rup);
    }
    let M = R;
    if (cl.global) {
      cl.c = [px, py, pz];
      if (f.beta > 0 && inv3(Aqq, AqqI)) {
        // Linear part A = Apq Aqq^-1, volume-normalized, blended with the rotation.
        for (let c = 0; c < 3; c += 1) for (let r = 0; r < 3; r += 1) {
          let s = 0;
          for (let k = 0; k < 3; k += 1) s += Apq[k * 3 + r] * AqqI[c * 3 + k];
          Alin[c * 3 + r] = s;
        }
        const d = det3(Alin);
        if (d > 1e-6) {
          const sc = 1 / Math.cbrt(d);
          for (let i = 0; i < 9; i += 1) Alin[i] = f.beta * Alin[i] * sc + (1 - f.beta) * R[i];
          M = Alin;
        }
      }
    }
    const wgt = cl.global ? 2 : 1;
    for (const m of idx) {
      const bx = rs[m * 3] - qx; const by = rs[m * 3 + 1] - qy; const bz = rs[m * 3 + 2] - qz;
      goal[m * 3] += wgt * (M[0] * bx + M[3] * by + M[6] * bz + px);
      goal[m * 3 + 1] += wgt * (M[1] * bx + M[4] * by + M[7] * bz + py);
      goal[m * 3 + 2] += wgt * (M[2] * bx + M[5] * by + M[8] * bz + pz);
    }
  }
  const a = f.alpha;
  let floorHit = 0;
  for (let m = 0; m < NN; m += 1) {
    const o = m * 3; const c = count[m];
    B.p[o] += (goal[o] / c - B.p[o]) * a;
    B.p[o + 1] += (goal[o + 1] / c - B.p[o + 1]) * a;
    B.p[o + 2] += (goal[o + 2] / c - B.p[o + 2]) * a;
    // Paper floor, side walls, back wall and the glass in front: hits keep half their skid.
    if (B.p[o + 1] < 0) { floorHit = Math.max(floorHit, -B.v[o + 1]); B.p[o + 1] = 0; B.p[o] -= (B.p[o] - B.x[o]) * 0.35; B.p[o + 2] -= (B.p[o + 2] - B.x[o + 2]) * 0.35; }
    if (B.p[o + 1] > WALL.top) B.p[o + 1] = WALL.top;
    if (B.p[o] < -WALL.x) B.p[o] = -WALL.x; else if (B.p[o] > WALL.x) B.p[o] = WALL.x;
    if (B.p[o + 2] < WALL.zb) B.p[o + 2] = WALL.zb; else if (B.p[o + 2] > WALL.zf) B.p[o + 2] = WALL.zf;
  }
  for (let m = 0; m < NN * 3; m += 1) {
    B.v[m] = (B.p[m] - B.x[m]) / H;
    if (B.v[m] > 16) B.v[m] = 16; else if (B.v[m] < -16) B.v[m] = -16;
    B.x[m] = B.p[m];
  }
  if (floorHit > 3.2 && clock - lastThud > 0.25) { lastThud = clock; post({ type: 'thud', v: Math.min(1, floorHit / 10) }); }
}
let lastThud = 0;

const ffd = (W, base, out) => {
  let x = 0; let y = 0; let z = 0;
  for (let m = 0; m < NN; m += 1) { const w = W[base + m]; x += w * B.x[m * 3]; y += w * B.x[m * 3 + 1]; z += w * B.x[m * 3 + 2]; }
  return out.set(x, y, z);
};
function deform() {
  const arr = B.geo.attributes.position.array;
  const W = B.W; const X = B.x;
  for (let i = 0, n = B.count; i < n; i += 1) {
    let x = 0; let y = 0; let z = 0;
    const base = i * NN;
    for (let m = 0; m < NN; m += 1) { const w = W[base + m]; const o = m * 3; x += w * X[o]; y += w * X[o + 1]; z += w * X[o + 2]; }
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
  }
  B.geo.attributes.position.needsUpdate = true;
  B.geo.computeVertexNormals();
  B.geo.computeBoundingSphere();
}

// Color flood.
function startFlood(hex, originRest) {
  const to = new THREE.Color(hex);
  B.colorFrom = B.colors.slice();
  B.flood = { to, origin: originRest, t0: clock };
}
function floodStep() {
  if (!B.flood) return;
  const { to, origin, t0 } = B.flood;
  const front = (clock - t0) * 2.4;
  const rv = B.restV; const col = B.colors; const from = B.colorFrom;
  let done = true;
  for (let i = 0, n = B.count; i < n; i += 1) {
    const d = Math.hypot(rv[i * 3] - origin.x, rv[i * 3 + 1] - origin.y, rv[i * 3 + 2] - origin.z);
    const u = clamp((front - d) / 0.14, 0, 1);
    if (u < 1) done = false;
    const k = u * u * (3 - 2 * u);
    col[i * 3] = from[i * 3] + (to.r - from[i * 3]) * k;
    col[i * 3 + 1] = from[i * 3 + 1] + (to.g - from[i * 3 + 1]) * k;
    col[i * 3 + 2] = from[i * 3 + 2] + (to.b - from[i * 3 + 2]) * k;
  }
  B.geo.attributes.color.needsUpdate = true;
  if (done) B.flood = null;
}

// Paint drops.
const drops = [];
const dropGeo = new THREE.SphereGeometry(0.13, 24, 16);
const raycaster = new THREE.Raycaster();
function dropPaint(hex) {
  const mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.12, clearcoat: 1, transmission: 0.15, thickness: 0.3 });
  const m = new THREE.Mesh(dropGeo, mat);
  const c = com();
  m.position.set(c.x + (Math.random() - 0.5) * 0.2, 3.3, c.z + 0.1);
  scene.add(m);
  drops.push({ m, vy: 0, hex, splat: -1 });
  B.color = hex;
}
function dropsStep(dt) {
  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const d = drops[i];
    if (d.splat >= 0) {
      d.splat += dt;
      const k = clamp(d.splat / 0.14, 0, 1);
      d.m.scale.set(1 + 1.6 * ENTER(k), 1 - 0.85 * ENTER(k), 1 + 1.6 * ENTER(k));
      d.m.material.opacity = 1 - k; d.m.material.transparent = true;
      if (k >= 1) { scene.remove(d.m); d.m.material.dispose(); drops.splice(i, 1); }
      continue;
    }
    d.vy -= 14 * dt;
    const step = d.vy * dt;
    // Stretch along the fall, like a real drop.
    const st = clamp(1 + Math.abs(d.vy) * 0.035, 1, 1.45);
    d.m.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
    raycaster.set(d.m.position, new THREE.Vector3(0, -1, 0));
    raycaster.far = Math.abs(step) + 0.13;
    const hit = raycaster.intersectObject(bodyMesh, false)[0];
    if (hit || d.m.position.y < 0.1) {
      d.splat = 0;
      const p = hit ? hit.point : d.m.position.clone();
      d.m.position.copy(p);
      // Kick the nodes under the splat and flood from the rest-space point we hit.
      const origin = hit ? new THREE.Vector3(B.restV[hit.face.a * 3], B.restV[hit.face.a * 3 + 1], B.restV[hit.face.a * 3 + 2]) : new THREE.Vector3(0, 0, 0);
      poke(p, new THREE.Vector3(0, -1, 0), 2.4, 0.5);
      startFlood(d.hex, origin);
      paintMinis(d.hex);
      post({ type: 'splat' });
    } else d.m.position.y += step;
  }
}

function com() {
  let x = 0; let y = 0; let z = 0;
  for (let m = 0; m < NN; m += 1) { x += B.x[m * 3]; y += B.x[m * 3 + 1]; z += B.x[m * 3 + 2]; }
  return new THREE.Vector3(x / NN, y / NN, z / NN);
}
function poke(p, dir, power, sigma = 0.45) {
  for (let m = 0; m < NN; m += 1) {
    const o = m * 3;
    const d2 = (B.x[o] - p.x) ** 2 + (B.x[o + 1] - p.y) ** 2 + (B.x[o + 2] - p.z) ** 2;
    const w = Math.exp(-d2 / (sigma * sigma));
    B.v[o] += dir.x * power * w; B.v[o + 1] += dir.y * power * w; B.v[o + 2] += dir.z * power * w;
  }
}
const kick = (vx, vy, vz) => { for (let m = 0; m < NN; m += 1) { B.v[m * 3] += vx; B.v[m * 3 + 1] += vy; B.v[m * 3 + 2] += vz; } };
function spin(wy, wz = 0) {
  const c = com();
  for (let m = 0; m < NN; m += 1) {
    const rx = B.x[m * 3] - c.x; const ry = B.x[m * 3 + 1] - c.y; const rz = B.x[m * 3 + 2] - c.z;
    B.v[m * 3] += wy * rz - wz * ry; B.v[m * 3 + 1] += wz * rx; B.v[m * 3 + 2] += -wy * rx;
  }
}

// Each play style's tic while it waits: the way it would fidget at the net.
let shoutAt = -10;
const TICS = {
  wall: { every: 3.4, go() { const c = com(); poke(new THREE.Vector3(c.x, c.y + 1, c.z), new THREE.Vector3(0, -1, 0), 1.6, 0.7); } },
  moon: { every: 3.0, go() { kick(0, 6.4, 0); spin(0, (Math.random() - 0.5) * 2); post({ type: 'boing' }); } },
  bot: { every: 2.4, go() { spin(Math.random() < 0.5 ? 4.5 : -4.5); post({ type: 'beep' }); } },
  goblin: { every: 2.8, go() { const s = com().x > 0 ? -1 : 1; kick(2.4 * s, 3.2, 0); } },
  grunter: { every: 2.6, go() { [0, 60, 120, 180].forEach((ms, i) => setTimeout(() => kick(i % 2 ? -1.8 : 1.8, 0.6, 0), ms)); shoutAt = clock; post({ type: 'grunt' }); } },
  junk: { every: 2.2, go() { const m = Math.floor(Math.random() * NN); const p = new THREE.Vector3(B.x[m * 3], B.x[m * 3 + 1], B.x[m * 3 + 2]); poke(p, new THREE.Vector3(Math.random() - 0.5, -0.4, Math.random() - 0.5).normalize(), 2.6, 0.5); } },
  comet: { every: 3.0, go() { kick(0, 2.4, 4.2); post({ type: 'swish' }); } },
  ghost: { every: 3.2, go() { spin(3.2); } },
};
let nextTic = 2.2;

// Style swap.
const swap = { phase: 'idle', t: 0, next: null };
function changeStyle(cast) {
  if (cast === B.cast && swap.phase === 'idle') return;
  swap.phase = 'out'; swap.t = 0; swap.next = cast;
  post({ type: 'squish' });
  shelfLaunch(cast);
}
function swapStep(dt) {
  const breath = 1 + 0.025 * Math.sin((clock * Math.PI * 2) / 2.2);
  const base = { x: 1 - 0.012 * Math.sin((clock * Math.PI * 2) / 2.2), y: breath, z: 1 };
  if (swap.phase === 'idle') { B.S.set(base.x, base.y, base.z); return; }
  swap.t += dt;
  const PUD = { x: 1.35, y: 0.18, z: 1.25 };
  if (swap.phase === 'out') {
    const k = EXIT(clamp(swap.t / 0.24, 0, 1));
    B.S.set(THREE.MathUtils.lerp(base.x, PUD.x, k), THREE.MathUtils.lerp(base.y, PUD.y, k), THREE.MathUtils.lerp(base.z, PUD.z, k));
    if (swap.t >= 0.24) {
      setBody(swap.next, true);
      setLabel(swap.next);
      swap.phase = 'in'; swap.t = 0;
      kick(0, 2.6, 0);
      post({ type: 'bloop', cast: swap.next });
    }
  } else {
    const k = POP(clamp(swap.t / 0.42, 0, 1));
    B.S.set(THREE.MathUtils.lerp(PUD.x, base.x, k), THREE.MathUtils.lerp(PUD.y, base.y, k), THREE.MathUtils.lerp(PUD.z, base.z, k));
    if (swap.t >= 0.42) swap.phase = 'idle';
  }
}

// The shelf: one small candy per play style, drawn by a second camera into the strip the page lays out for it.
const shelfScene = new THREE.Scene();
shelfScene.environment = env;
shelfScene.environmentIntensity = 0.8;
shelfScene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.2));
{ const k2 = new THREE.DirectionalLight(0xfff4e8, 2.2); k2.position.set(-3, 6, 8); shelfScene.add(k2); }
const shelfCam = new THREE.OrthographicCamera(0, 1, 0, -1, -100, 100);
const minis = CASTS.map((cast, i) => {
  const g = bodyGeometry(cast, false);
  g.translate(0, -g.boundingBox.max.y / 2, 0);
  const mat = new THREE.MeshPhysicalMaterial({ color: COLORS[0], roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4 });
  const m = new THREE.Mesh(g, mat);
  m.userData = { cast, i, hop: { x: 0, v: 0 }, show: { x: 1, v: 0 }, gone: false, launch: -1, paintAt: -1, paint: null };
  shelfScene.add(m);
  return m;
});
function paintMinis(hex) {
  // Left to right, 50 ms apart.
  minis.forEach((m, i) => { m.userData.paintAt = clock + 0.05 * i; m.userData.paint = hex; });
}
function shelfLaunch(cast) {
  for (const m of minis) {
    const u = m.userData;
    if (u.cast === cast) { u.launch = 0; u.hop.v = -6; }
    else if (u.gone) { u.gone = false; u.launch = -1; u.show.x = 0; u.show.v = 0; }
  }
}
function shelfRect() { return $('shelf').getBoundingClientRect(); }
function shelfStep(dt) {
  const r = shelfRect();
  shelfCam.left = 0; shelfCam.right = r.width; shelfCam.top = 0; shelfCam.bottom = -r.height;
  shelfCam.updateProjectionMatrix();
  const cols = 4; const cw = r.width / cols; const rh = r.height / 2;
  for (const m of minis) {
    const u = m.userData;
    const col = u.i % cols; const row = Math.floor(u.i / cols);
    springTo(u.hop, 0, dt, 5, 0.4);
    springTo(u.show, u.gone ? 0 : 1, dt, 4.2, 0.45);
    let s = 34 * u.show.x;
    let y = -(row * rh + rh * 0.46) + 4 * Math.sin(clock * 1.7 + u.i);
    if (u.launch >= 0) {
      u.launch += dt;
      const k = EXIT(clamp(u.launch / 0.2, 0, 1));
      s *= 1 - k; y += 60 * k;
      if (u.launch >= 0.2) { u.gone = true; u.launch = -1; u.show.x = 0; }
    } else if (u.gone) s = 0;
    m.position.set(col * cw + cw / 2, y + u.hop.x * 10, 0);
    m.scale.setScalar(Math.max(0.0001, s));
    m.rotation.set(-0.18, 0.45 * Math.sin(clock * 0.9 + u.i * 0.8), 0.04 * Math.sin(clock * 1.3 + u.i));
    if (u.paint && clock >= u.paintAt) { m.material.color.set(u.paint); u.paint = null; u.hop.v = -3.5; }
  }
  // The empty cell where your current style sits is lit in the accent.
  document.querySelectorAll('#shelf i').forEach((el, i) => el.classList.toggle('on', CASTS[i] === (swap.next || B.cast)));
}
function springTo(s, target, dt, hz, ratio) {
  const w = hz * Math.PI * 2;
  s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt;
  s.x += s.v * dt;
}

// Pointer: grab the jelly, tap it, or tap a candy on the shelf.
const ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', (e) => {
  const sr = shelfRect();
  if (e.clientY >= sr.top && e.clientY <= sr.bottom && e.clientX >= sr.left && e.clientX <= sr.right) {
    const col = Math.floor(((e.clientX - sr.left) / sr.width) * 4);
    const row = Math.floor(((e.clientY - sr.top) / sr.height) * 2);
    const cast = CASTS[clamp(row, 0, 1) * 4 + clamp(col, 0, 3)];
    if (cast !== (swap.next || B.cast)) { changeStyle(cast); post({ type: 'cast', cast }); }
    return;
  }
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.far = 100;
  const hit = raycaster.intersectObject(bodyMesh, false)[0];
  if (!hit) return;
  canvas.setPointerCapture(e.pointerId);
  grab.hit = hit.point.clone();
  grab.sx = e.clientX; grab.sy = e.clientY; grab.moved = false;
  grab.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), hit.point);
  grab.T.copy(hit.point);
  for (let m = 0; m < NN; m += 1) {
    const o = m * 3;
    const d2 = (B.x[o] - hit.point.x) ** 2 + (B.x[o + 1] - hit.point.y) ** 2 + (B.x[o + 2] - hit.point.z) ** 2;
    grab.w[m] = Math.exp(-d2 / (0.45 * 0.45));
    grab.o[o] = B.x[o] - hit.point.x; grab.o[o + 1] = B.x[o + 1] - hit.point.y; grab.o[o + 2] = B.x[o + 2] - hit.point.z;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!grab.hit) return;
  if (!grab.moved && Math.hypot(e.clientX - grab.sx, e.clientY - grab.sy) > 6) { grab.moved = true; grab.on = true; post({ type: 'grab' }); }
  if (!grab.on) return;
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(grab.plane, p)) { p.y = Math.max(p.y, 0.05); grab.T.copy(p); }
});
const release = () => {
  if (!grab.hit) return;
  if (!grab.moved) {
    poke(grab.hit, grab.hit.clone().sub(camera.position).normalize(), 3.4);
    post({ type: 'poke' });
  } else post({ type: 'fling' });
  grab.on = false; grab.hit = null;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// Page UI.
let current = { name: 'YOU', bio: '', favoritePro: '', homeCourt: '', racket: '', cast: null, color: COLORS[0] };
function letters(el, text) {
  el.innerHTML = '';
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? ' ' : ch;
    s.style.animationDelay = `${i * 30}ms`;
    el.appendChild(s);
  });
}
function setLabel(cast) {
  letters($('style'), LABEL[cast][0]);
  const t = $('tag');
  t.textContent = LABEL[cast][1];
  t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
}
$('drops').innerHTML = COLORS.map((c) => `<button class="drop" data-c="${c}" style="--c:${c}" aria-label="Color ${c}"><i></i></button>`).join('');
$('drops').addEventListener('click', (e) => {
  const b = e.target.closest('.drop');
  if (!b) return;
  const c = b.dataset.c;
  b.classList.remove('tap'); void b.offsetWidth; b.classList.add('tap');
  current.color = c;
  markDrop();
  dropPaint(c);
  post({ type: 'color', color: c });
});
const markDrop = () => document.querySelectorAll('.drop').forEach((d) => d.classList.toggle('on', d.dataset.c === current.color));
$('shelf').innerHTML = CASTS.map(() => '<i></i>').join('');
document.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', () => post({ type: 'edit', field: el.dataset.edit })));
function fillText() {
  const nm = (current.name || 'YOU').toUpperCase();
  if ($('name').dataset.v !== nm) { $('name').dataset.v = nm; letters($('name'), nm); }
  $('bio').textContent = current.bio ? `"${current.bio}"` : 'tap to add one line of trash talk';
  $('bio').classList.toggle('empty', !current.bio);
  for (const [id, k, empty] of [['pro', 'favoritePro', 'FAVORITE PRO'], ['court', 'homeCourt', 'HOME COURT'], ['racket', 'racket', 'RACKET']]) {
    $(id).innerHTML = current[k] ? `<b>${empty}</b> ${current[k].replace(/</g, '&lt;')}` : `<b>+</b> ${empty}`;
    $(id).classList.toggle('empty', !current[k]);
  }
}
window.setFighter = (f) => {
  const first = current.cast === null;
  current = { ...current, ...f };
  fillText();
  markDrop();
  if (first) {
    B.color = current.color;
    setBody(current.cast, false);
    setLabel(current.cast);
    minis.forEach((m) => m.material.color.set(current.color));
    for (const m of minis) if (m.userData.cast === current.cast) { m.userData.gone = true; m.userData.show.x = 0; }
    // Dropped in from above.
    for (let m = 0; m < NN; m += 1) B.x[m * 3 + 1] += 2.6;
  }
};

// The slide-to-lock-in strip, same control as home and courts: roll the ball down the court.
const keyEl = $('enter');
const sl = { x: 0, v: 0, max: 1, held: false, finishing: false, done: false, grab: 0, lastX: 0, lastT: 0, flick: 0, puffAt: 0, zone: 0 };
const BALL = 50;
$('klbl').textContent = 'LOCK IN';
$('ksub').textContent = 'SLIDE TO SAVE';
keyEl.classList.add('show');
keyEl.addEventListener('pointerdown', (e) => {
  if (sl.done || sl.finishing) return;
  const r = keyEl.getBoundingClientRect();
  sl.max = Math.max(1, r.width - BALL - 16);
  sl.grab = clamp(e.clientX - r.left - 8 - sl.x, 0, BALL);
  sl.held = true; sl.v = 0; sl.flick = 0; sl.lastX = e.clientX; sl.lastT = performance.now();
  keyEl.setPointerCapture(e.pointerId);
  keyEl.classList.add('held');
  post({ type: 'press' });
});
keyEl.addEventListener('pointermove', (e) => {
  if (!sl.held) return;
  const r = keyEl.getBoundingClientRect();
  const now = performance.now();
  sl.x = clamp(e.clientX - r.left - 8 - sl.grab, 0, sl.max);
  sl.flick = 0.6 * ((e.clientX - sl.lastX) / Math.max(1, now - sl.lastT)) * 1000 + 0.4 * sl.flick;
  sl.lastX = e.clientX; sl.lastT = now;
});
const letGo = () => {
  if (!sl.held) return;
  sl.held = false;
  keyEl.classList.remove('held');
  const p = sl.x / sl.max;
  if (p > 0.78 || (sl.flick > 900 && p > 0.4)) { sl.finishing = true; sl.v = Math.max(sl.flick, 600); } else sl.v = Math.min(0, sl.flick);
};
keyEl.addEventListener('pointerup', letGo);
keyEl.addEventListener('pointercancel', letGo);
function puff(x) {
  const d = document.createElement('i');
  d.style.left = `${x + 8 + Math.random() * 14}px`;
  d.style.setProperty('--dx', `${-10 - Math.random() * 22}px`);
  d.style.setProperty('--dy', `${-8 - Math.random() * 16}px`);
  d.style.setProperty('--s', String(0.6 + Math.random() * 0.9));
  $('dust').appendChild(d);
  setTimeout(() => d.remove(), 540);
}
function slideStep(dt) {
  if (!sl.held && !sl.done) {
    const hz = sl.finishing ? 5 : 2.4;
    const ratio = sl.finishing ? 1 : 0.5;
    const target = sl.finishing ? sl.max : 0;
    const w = hz * Math.PI * 2;
    sl.v += (-w * w * (sl.x - target) - 2 * ratio * w * sl.v) * dt;
    sl.x += sl.v * dt;
    if (sl.x < 0) { sl.x = 0; sl.v = Math.abs(sl.v) * 0.3; }
    if (sl.finishing && sl.x > sl.max - 1.5) {
      sl.x = sl.max; sl.done = true; sl.finishing = false;
      keyEl.classList.add('hit');
      for (let k = 0; k < 7; k += 1) puff(sl.max + 10);
      // The fighter jumps for joy, then we save.
      kick(0, 7, 0);
      post({ type: 'slid' });
      setTimeout(() => post({ type: 'save' }), 520);
      setTimeout(() => { Object.assign(sl, { x: 0, v: 0, done: false, zone: 0 }); keyEl.classList.remove('hit'); }, 1400);
    }
  }
  if (Math.abs(sl.x - sl.puffAt) > 14 && sl.x > 4) { sl.puffAt = sl.x; puff(sl.x); }
  const zone = Math.floor((sl.x / sl.max) * 3 + 0.0001);
  if (zone !== sl.zone && sl.x > 2 && !sl.done) { sl.zone = zone; post({ type: 'line' }); }
}
function slideRender(t) {
  const u = (t % 2.4) / 0.5;
  const idle = !sl.held && !sl.finishing && !sl.done && sl.x < 1 && u < 1 ? 9 * Math.sin(Math.PI * u) : 0;
  const x = sl.x + idle;
  $('ballw').style.transform = `translate3d(${x}px,0,0)`;
  $('ball').style.transform = `rotate(${x / (BALL / 2)}rad)`;
  $('skid').style.width = `${sl.x > 2 ? sl.x + BALL / 2 + 6 : 0}px`;
}

// Layout: aim the camera so the body sits in the gap between the header and the shelf.
function resize() {
  const w = window.innerWidth; const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Face pose.
const expr = { grab: { x: 0, v: 0 }, look: new THREE.Vector2() };
const tmpA = new THREE.Vector3(); const tmpB = new THREE.Vector3(); const tmpC = new THREE.Vector3();
const basis = new THREE.Matrix4();
function poseFace(dt) {
  if (!B.faceW) return;
  const W = B.faceW;
  ffd(W[0], 0, tmpA); ffd(W[1], 0, tmpB); ffd(W[2], 0, tmpC);
  const ax = tmpB.sub(tmpA).normalize();
  const ay = tmpC.sub(tmpA).normalize();
  const az = new THREE.Vector3().crossVectors(ax, ay).normalize();
  ay.crossVectors(az, ax);
  basis.makeBasis(ax, ay, az);
  face.position.copy(tmpA);
  face.quaternion.setFromRotationMatrix(basis);
  springTo(expr.grab, grab.on ? 1 : 0, dt, 6, 0.7);
  const g = clamp(expr.grab.x, 0, 1);
  const blink = (clock % 3.1) < 0.11 ? 0.12 : 1;
  const surprise = clock - shoutAt < 0.5 ? 1 : 0;
  const sp = B.cast === 'wall' ? 0.24 : 0.2;
  // Pupils follow the finger when held, otherwise drift to the camera with a slow saccade.
  const lx = grab.on ? clamp((grab.T.x - tmpA.x) * 0.4, -0.03, 0.03) : 0.015 * Math.sin(clock * 0.7);
  const ly = grab.on ? clamp((grab.T.y - tmpA.y) * 0.4, -0.03, 0.03) : 0.01 * Math.sin(clock * 0.5);
  for (const e of eyes) {
    e.position.set(e.userData.sx * sp / 2, 0.03, 0.02);
    e.scale.set(1, blink * (1 - 0.7 * g) * (1 + 0.25 * surprise), 1);
    e.userData.pupil.position.set(lx, ly, 0.04);
  }
  for (const b of brows) b.position.set(b.userData.sx * 0.11, 0.17, 0.03);
  smile.position.set(0, -0.15, 0.03);
  smile.visible = !['bot', 'grunter'].includes(B.cast) && g < 0.5;
  mouthO.visible = B.cast === 'grunter' || g >= 0.5 || surprise > 0;
  mouthO.position.set(0, -0.2, 0.03);
  const open = B.cast === 'grunter' ? 0.9 + 0.5 * surprise : 0.6 + 0.4 * g;
  mouthO.scale.set(open, open * 0.95, 0.3);
  mouthBar.position.set(0, -0.17, 0.03);
  mouthBar.visible = B.cast === 'bot' && g < 0.5;
}

// Loop.
let clock = 0;
let acc = 0;
const cam = { x: { x: 0, v: 0 }, y: { x: 0.8, v: 0 } };
function advance(dt) {
  clock += dt;
  acc += dt;
  swapStep(dt);
  if (B.cast) {
    while (acc >= H) { step(); acc -= H; }
    if (swap.phase === 'idle' && !grab.on && clock > nextTic) { TICS[B.cast].go(); nextTic = clock + TICS[B.cast].every + Math.random() * 0.6; }
  }
  dropsStep(dt);
  slideStep(dt);
  shelfStep(dt);
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  advance(dt);
  if (B.cast) {
    deform();
    floodStep();
    poseFace(dt);
    const c = com();
    let low = Infinity;
    for (let m = 0; m < NN; m += 1) low = Math.min(low, B.x[m * 3 + 1]);
    const lift = Math.max(0, low);
    shadow.position.set(c.x, 0.002, c.z);
    shadow.scale.set(2.3 + lift * 0.6, 1.3 + lift * 0.4, 1);
    shadow.material.opacity = 1 / (1 + lift * 1.6);
    springTo(cam.x, c.x * 0.45, dt, 1.3, 1);
    springTo(cam.y, 0.85 + Math.max(0, c.y - 0.85) * 0.3, dt, 1.3, 1);
  }
  // The grunt, written over its head.
  const sh = $('shout');
  if (clock - shoutAt < 0.7 && B.cast === 'grunter') {
    const p = com().add(new THREE.Vector3(0.5, 1.0, 0)).project(camera);
    sh.style.transform = `translate(${(p.x * 0.5 + 0.5) * window.innerWidth}px,${(-p.y * 0.5 + 0.5) * window.innerHeight}px)`;
    sh.classList.add('on');
  } else sh.classList.remove('on');
  // Camera: 30 degree lens, 2 degree orbit on a 9 s sine, and shifted so the body sits between the header and the shelf.
  const orbit = THREE.MathUtils.degToRad(2) * Math.sin((clock * Math.PI * 2) / 9);
  const D = 11;
  const look = new THREE.Vector3(cam.x.x, cam.y.x, 0);
  camera.position.set(look.x + D * Math.sin(orbit), look.y + D * 0.2, D * Math.cos(orbit));
  camera.lookAt(look);
  const w = window.innerWidth; const h = window.innerHeight;
  const top = $('head').getBoundingClientRect().bottom;
  const bottom = shelfRect().top;
  const mid = (top + bottom) / 2;
  camera.setViewOffset(w, h, 0, h / 2 - mid + 30, w, h);
  slideRender(clock);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.render(scene, camera);
  const r = shelfRect();
  renderer.setViewport(r.left, h - r.bottom, r.width, r.height);
  renderer.setScissor(r.left, h - r.bottom, r.width, r.height);
  renderer.setScissorTest(true);
  renderer.clearDepth();
  renderer.render(shelfScene, shelfCam);
  renderer.setScissorTest(false);
}
requestAnimationFrame(frame);

/** Self-plays the screen for recording: poke, grab and fling, a paint drop, two style swaps. */
window.demoFighter = () => {
  const at = (s, fn) => setTimeout(fn, s * 1000);
  at(1.6, () => { const c = com(); poke(c.clone().add(new THREE.Vector3(0.2, 0.3, 0.4)), new THREE.Vector3(0, 0, -1), 3.4); post({ type: 'poke' }); });
  at(2.8, () => {
    const c = com().add(new THREE.Vector3(0.3, 0.5, 0.3));
    grab.hit = c.clone(); grab.moved = true; grab.on = true; grab.T.copy(c);
    for (let m = 0; m < NN; m += 1) {
      const o = m * 3;
      const d2 = (B.x[o] - c.x) ** 2 + (B.x[o + 1] - c.y) ** 2 + (B.x[o + 2] - c.z) ** 2;
      grab.w[m] = Math.exp(-d2 / (0.45 * 0.45));
      grab.o[o] = B.x[o] - c.x; grab.o[o + 1] = B.x[o + 1] - c.y; grab.o[o + 2] = B.x[o + 2] - c.z;
    }
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = (performance.now() - t0) / 1000;
      grab.T.set(c.x + 0.9 * Math.sin(k * 3), c.y + 0.9 * k, c.z);
      if (k > 0.9) { clearInterval(id); grab.on = false; grab.hit = null; post({ type: 'fling' }); }
    }, 16);
  });
  at(5.4, () => { current.color = COLORS[1]; markDrop(); dropPaint(COLORS[1]); });
  at(7.6, () => changeStyle('moon'));
  at(10.6, () => changeStyle('grunter'));
  at(13.4, () => { current.color = COLORS[2]; markDrop(); dropPaint(COLORS[2]); });
};
post({ type: 'ready' });
