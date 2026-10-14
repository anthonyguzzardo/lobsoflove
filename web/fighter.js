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
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { bodyGeometry, clamp, det3, ENTER, EXIT, EXTRUDE, extractRotation, FACE, FEEL, inv3, makeClusters, NL, NN, nid, POP, quatMat, v, weightsFor } from './jelly-core.js';

const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));

const PAPER = 0xefece5;
const INK = 0x16181d;
const $ = (id) => document.getElementById(id);

const CASTS = ['wall', 'moon', 'bot', 'goblin', 'grunter', 'junk', 'comet', 'ghost', 'lobber', 'rabbit'];
const LABEL = {
  wall: ['THE WALL', 'Everything comes back.'], moon: ['MOONBALLER', 'Twelve feet over the net, every time.'],
  bot: ['SERVE BOT', 'Ace or double fault. No third option.'], goblin: ['DROPSHOT GOBLIN', 'You will run. You will not get there.'],
  grunter: ['THE GRUNTER', 'Heard from three courts away.'], junk: ['JUNKBALLER', 'No pace, no spin, no rhythm, no mercy.'],
  comet: ['NET RUSHER', 'Chip, charge, pray.'], ghost: ['THE NO-SHOW', '"Running five late."'],
  lobber: ['GOT YOU, BITCH', "Come to the net. I dare you."], rabbit: ['THE JACKRABBIT', 'Faster than a certain blue hedgehog.'],
};
const COLORS = ['#d7f205', '#ff3d7f', '#35d6ff', '#ff8a1f', '#9b6bff', '#2fe08a', '#ff5252', '#f4f1e6'];

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
const { clusters, count } = makeClusters();

function setBody(cast, keepNodes) {
  const geo = bodyGeometry(cast);
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
  // Chest targets for the Wall's drill: front-facing points below the face and above the floor.
  {
    const nr = geo.attributes.normal.array;
    B.chest = [];
    for (let i = 0; i < n; i += 1) if (nr[i * 3 + 2] > 0.85 && pos.array[i * 3 + 1] < faceRest.y - 0.16 && pos.array[i * 3 + 1] > 0.18) B.chest.push(i);
  }
  if (B.geo) B.geo.dispose();
  B.geo = geo; B.count = n; B.W = W; B.cast = cast; B.feel = FEEL[cast];
  WALL.x = Math.max(1.0, (box.max.x - box.min.x) * 0.85);
  drink.t = -1; bottle.visible = false;
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

const Rup = new Float32Array(9);
const POSE = [Math.sin(-0.08), 0, 0, Math.cos(-0.08)]; // rest pose: leaned back 0.16 rad about x
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
  const free = grab.on || clock < fx.freeUntil; // off while held, and while a dash or lunge is running
  const hx = free ? 0 : -hw * (cx - HOME.x) * H - 2 * 0.9 * 2 * Math.PI * 1.1 * mvx * H;
  const hz = free ? 0 : -hw * (cz - HOME.z) * H - 2 * 0.9 * 2 * Math.PI * 1.1 * mvz * H;
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
      // A weeble, not a melon: left alone it climbs back to its pose and turns to face you. The pose leans back 0.16 rad
      // so the face points up at the camera instead of at the floor. Pull 0.025 per step: back up within about half a second.
      const up = cl.up || (cl.up = [0, 0, 0, 1]);
      // Twice as strong once a move is over, so it settles back to itself between bits.
      const k = clock > fx.freeUntil + 0.3 && swap.phase === 'idle' ? 0.05 : 0.025;
      const d = cl.q[0] * POSE[0] + cl.q[3] * POSE[3] < 0 ? -1 : 1;
      for (let i = 0; i < 4; i += 1) up[i] = cl.q[i] * d * (1 - k) + POSE[i] * k;
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
    if (B.p[o + 1] < 0) { floorHit = Math.max(floorHit, -B.v[o + 1]); B.p[o + 1] = 0; B.p[o] -= (B.p[o] - B.x[o]) * 0.15; B.p[o + 2] -= (B.p[o + 2] - B.x[o + 2]) * 0.15; } // light grip, so a tipped body can slide its feet back under it
    if (B.p[o + 1] > WALL.top) B.p[o + 1] = WALL.top;
    if (B.p[o] < -WALL.x) B.p[o] = -WALL.x; else if (B.p[o] > WALL.x) B.p[o] = WALL.x;
    if (B.p[o + 2] < WALL.zb) B.p[o + 2] = WALL.zb; else if (B.p[o + 2] > WALL.zf) B.p[o + 2] = WALL.zf;
  }
  for (let m = 0; m < NN * 3; m += 1) {
    B.v[m] = (B.p[m] - B.x[m]) / H;
    if (B.v[m] > 16) B.v[m] = 16; else if (B.v[m] < -16) B.v[m] = -16;
    B.x[m] = B.p[m];
  }
  if (floorHit > 5 && clock - lastThud > 0.4) { lastThud = clock; post({ type: 'thud', v: Math.min(1, floorHit / 10) }); }
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
// Shout bubble over the head, face overrides, and a short camera shake.
const fx = { shoutUntil: -1, happyUntil: -1, winceUntil: -1, shakeUntil: -1, sipUntil: -1, freeUntil: -1, slyUntil: -1 };
function showShout(text, dur) { $('shout').textContent = text; fx.shoutUntil = clock + dur; }
const flex = new THREE.Vector3(1, 1, 1);
const TICS = {
  wall: { every: 6, go() { startDrink(); } },
  moon: { every: 4.0, go() { fx.freeUntil = clock + 0.9; kick(0, 6.4, 0); spin(0, (Math.random() - 0.5) * 2); post({ type: 'boing' }); } },
  bot: { every: 4.0, go() { fx.freeUntil = clock + 0.4; spin(Math.random() < 0.5 ? 4.5 : -4.5); post({ type: 'beep' }); } },
  goblin: { every: 4.0, go() { fx.freeUntil = clock + 0.45; const s = com().x > 0 ? -1 : 1; kick(2.4 * s, 3.2, 0); } },
  grunter: { every: 4.5, go() { [0, 60, 120, 180].forEach((ms, i) => setTimeout(() => kick(i % 2 ? -1.8 : 1.8, 0.6, 0), ms)); shoutAt = clock; showShout('HNNGH!', 0.7); post({ type: 'grunt' }); } },
  junk: { every: 4.0, go() { const m = Math.floor(Math.random() * NN); const p = new THREE.Vector3(B.x[m * 3], B.x[m * 3 + 1], B.x[m * 3 + 2]); poke(p, new THREE.Vector3(Math.random() - 0.5, -0.4, Math.random() - 0.5).normalize(), 2.6, 0.5); } },
  comet: { every: 4.5, go() { fx.freeUntil = clock + 0.4; kick(0, 2.4, 4.2); post({ type: 'swish' }); } },
  ghost: { every: 4.5, go() { fx.freeUntil = clock + 0.6; spin(3.2); } },
  // GOT YOU baits a net rusher and lobs it. See LURE.
  lobber: { every: 6, go() { startLure(); } },
  // Zips to one wall, back across to the other, then brakes: 230 ms per leg.
  rabbit: { every: 4.5, go() {
    const sd = com().x > 0 ? -1 : 1;
    fx.freeUntil = clock + 0.8;
    kick(9 * sd, 0.6, 0); post({ type: 'dash' });
    setTimeout(() => { kick(-17 * sd, 4, 0); post({ type: 'dash' }); }, 230); // the way back is a leap
    setTimeout(() => kick(8 * sd, 0, 0), 460);
  } },
};
let nextTic = 2.2;


// The Wall's drill. A ball machine where you stand fires 10 balls at its chest, 90 ms apart, on a flat 0.28 s line.
// Each one dents the jelly where it lands (4 inward) and stays there, half sunk into the surface, riding every wobble.
// 380 ms after the last one lands the Wall braces (squashes 1.8 from the top), then fires them all back at you,
// 50 ms apart at 11 units/s straight at the camera, each push swelling the jelly outward. Everything comes back.
const ballTex = (() => {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#e8f74a'); gr.addColorStop(1, '#c4dc00');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#fffdf0'; g.lineWidth = 7;
  g.beginPath();
  for (let x = 0; x <= 256; x += 4) { const y = 64 + 36 * Math.sin((x / 256) * Math.PI * 4); x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const BALL_R = 0.17;
const ballGeo = new THREE.SphereGeometry(BALL_R, 24, 16);
const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.9 });
const balls = [];
const drill = { on: false, queue: [], total: 0, landed: 0, braceAt: -1, returnAt: -1, flexAt: -1, burst: false, cheer: 0 };
let drilled = false;
function startDrill(n, delay) {
  if (drill.on || B.cast !== 'wall') return;
  // The full drill is the Wall's entrance: once per visit, not every time you come back to it.
  if (n >= 3) { if (drilled) return; drilled = true; }
  Object.assign(drill, { on: true, queue: [], total: n, landed: 0, braceAt: -1, returnAt: -1, flexAt: -1, burst: false, cheer: 0 });
  // A full drill is a burst of fire, 90 ms apart; a single ball is just a rally ball.
  for (let i = 0; i < n; i += 1) drill.queue.push(clock + delay + i * 0.09);
}
function fireBall() {
  // Aim at an open spot on the chest: of 16 random chest points, the one farthest from every ball already stuck or on its way.
  const rv = B.restV; const arr = B.geo.attributes.position.array;
  let best = B.chest[0]; let bestD = -1;
  for (let k = 0; k < 16 && B.chest.length; k += 1) {
    const vi = B.chest[Math.floor(Math.random() * B.chest.length)];
    let d = Infinity;
    for (const b of balls) if (b.aim >= 0) d = Math.min(d, Math.hypot(rv[vi * 3] - rv[b.aim * 3], rv[vi * 3 + 1] - rv[b.aim * 3 + 1]));
    if (d > bestD) { bestD = d; best = vi; }
  }
  const target = new THREE.Vector3(arr[best * 3], arr[best * 3 + 1], arr[best * 3 + 2]);
  const start = new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.7), 0.5 + Math.random() * 0.6, 6.5);
  const T = 0.28; // flat and fast: about 22 units/s
  const v = target.clone().sub(start).divideScalar(T);
  v.y += 0.5 * 9.8 * T;
  const m = new THREE.Mesh(ballGeo, ballMat);
  m.position.copy(start);
  scene.add(m);
  balls.push({ m, v, state: 'fly', vi: -1, outAt: 0, aim: best });
  post({ type: 'serve' });
}
function dropBalls() {
  // The body is about to be replaced: anything stuck in it just falls out.
  for (const b of balls) if (b.state === 'stuck') { b.state = 'out'; b.v.set((Math.random() - 0.5) * 2, 1.5, 1); }
  drill.on = false; drill.queue = []; drill.flexAt = -1; flex.set(1, 1, 1);
}
const nrm = new THREE.Vector3();
function ballsStep(dt) {
  while (drill.queue.length && clock >= drill.queue[0]) { drill.queue.shift(); fireBall(); }
  const pos = B.geo ? B.geo.attributes.position.array : null;
  const nor = B.geo ? B.geo.attributes.normal.array : null;
  for (let i = balls.length - 1; i >= 0; i -= 1) {
    const b = balls[i];
    if (b.state === 'fly') {
      b.v.y -= 9.8 * dt;
      const len = b.v.length() * dt;
      raycaster.set(b.m.position, b.v.clone().normalize());
      raycaster.far = len + BALL_R;
      const hit = raycaster.intersectObject(bodyMesh, false)[0];
      if (hit) {
        b.state = 'stuck'; b.vi = hit.face.a;
        // Each hit punches a deep dent, knocks the whole body back a step, and makes it wince for 140 ms.
        poke(hit.point, b.v.clone().normalize(), 5.5, 0.45);
        kick(0, 0, -0.9);
        fx.winceUntil = clock + 0.14;
        drill.landed += 1;
        post({ type: 'pock' });
      } else if (b.m.position.z < -2 || b.m.position.y < -1) {
        scene.remove(b.m); balls.splice(i, 1); drill.landed += 1; continue;
      } else b.m.position.addScaledVector(b.v, dt);
      b.m.rotation.x += dt * 14;
    } else if (b.state === 'stuck') {
      nrm.set(nor[b.vi * 3], nor[b.vi * 3 + 1], nor[b.vi * 3 + 2]);
      b.m.position.set(pos[b.vi * 3], pos[b.vi * 3 + 1], pos[b.vi * 3 + 2]).addScaledVector(nrm, BALL_R * 0.2); // embedded like pellets
      if (b.outAt && clock >= b.outAt) {
        b.state = 'out'; b.drive = true;
        const dir = camera.position.clone().sub(b.m.position).normalize();
        dir.x += (Math.random() - 0.5) * 0.08; dir.y += (Math.random() - 0.5) * 0.08;
        b.v.copy(dir.normalize().multiplyScalar(11));
        poke(b.m.position, nrm, 1.5, 0.45);
        post({ type: 'return' });
      }
    } else {
      // Returns are flat drives at the camera (no gravity), so they hold their spot on screen and swell toward you.
      if (!b.drive) b.v.y -= 9.8 * dt;
      b.m.position.addScaledVector(b.v, dt);
      b.m.rotation.y += dt * 18;
      // Loose balls bounce on the paper, losing 45% each time, and roll off after three.
      if (!b.drive && b.m.position.y < BALL_R && b.v.y < 0) {
        b.m.position.y = BALL_R; b.v.y *= -0.55; b.v.x *= 0.85; b.v.z *= 0.85;
        b.bounces = (b.bounces || 0) + 1;
        if (b.bounces === 1) post({ type: 'ballbounce' });
      }
      if (b.m.position.distanceTo(camera.position) < 1.2 || b.bounces > 3 || Math.abs(b.m.position.x) > 5) { scene.remove(b.m); balls.splice(i, 1); }
    }
  }
  const allIn = drill.on && !drill.queue.length && drill.landed >= drill.total;
  if (allIn && drill.total >= 3 && drill.flexAt < 0) drill.flexAt = clock + 0.32; // a beat to show off the pellets
  else if (allIn && drill.total < 3 && drill.braceAt < 0) { drill.braceAt = clock + 0.24; drill.returnAt = clock + 0.38; }
  if (drill.flexAt > 0) flexStep();
  if (drill.braceAt > 0 && clock >= drill.braceAt) {
    drill.braceAt = 0;
    const c = com();
    poke(new THREE.Vector3(c.x, c.y + 1, c.z), new THREE.Vector3(0, -1, 0), 1.8, 0.7);
  }
  if (drill.returnAt > 0 && clock >= drill.returnAt) {
    drill.returnAt = 0;
    let k = 0;
    for (const b of balls) if (b.state === 'stuck') { b.outAt = clock + 0.05 * k; k += 1; }
    drill.on = false;
  }
}

// The Jackrabbit's rainbow: a six-band ribbon behind its body that grows while it moves faster than 2.2 units/s
// and burns down 2 points a frame when it slows. Up to 26 points, bands 0.06 tall, fading to nothing at the tail.
const RAINBOW = [0xff4d4d, 0xff9a1f, 0xffe23a, 0x3ee07a, 0x35b8ff, 0x9b6bff].map((h) => new THREE.Color(h));
const trailPts = [];
const TRAIL_N = 26; const BAND = 0.06;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6 * 2 * 3), 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6 * 2 * 4), 4));
{
  const idx = [];
  for (let b = 0; b < 6; b += 1) for (let i = 0; i < TRAIL_N - 1; i += 1) {
    const a = (b * TRAIL_N + i) * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  trailGeo.setIndex(idx);
}
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
trail.frustumCulled = false;
scene.add(trail);
function trailStep() {
  let vx = 0; let vy = 0;
  for (let m = 0; m < NN; m += 1) { vx += B.v[m * 3]; vy += B.v[m * 3 + 1]; }
  const speed = Math.hypot(vx / NN, vy / NN);
  if (B.cast === 'rabbit' && speed > 2.2) {
    const c = com();
    trailPts.unshift(new THREE.Vector3(c.x, c.y - 0.05, c.z - 0.3));
    if (trailPts.length > TRAIL_N) trailPts.pop();
  } else { trailPts.pop(); trailPts.pop(); }
  const pos = trailGeo.attributes.position.array; const col = trailGeo.attributes.color.array;
  const n = trailPts.length;
  for (let b = 0; b < 6; b += 1) for (let i = 0; i < TRAIL_N; i += 1) {
    const p = trailPts[Math.min(i, Math.max(0, n - 1))];
    const a = (b * TRAIL_N + i) * 2;
    const y0 = (2.5 - b) * BAND;
    const alpha = n > 1 && i < n ? (1 - i / (n - 1)) * 0.9 : 0;
    for (let e = 0; e < 2; e += 1) {
      const o = (a + e) * 3;
      pos[o] = p ? p.x : 0; pos[o + 1] = p ? p.y + y0 + (e ? -BAND : 0) : -10; pos[o + 2] = p ? p.z : 0;
      const q = (a + e) * 4;
      col[q] = RAINBOW[b].r; col[q + 1] = RAINBOW[b].g; col[q + 2] = RAINBOW[b].b; col[q + 3] = alpha;
    }
  }
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.color.needsUpdate = true;
}

// The Wall's lull: it chugs a sports drink (t in s). 0-0.35 the bottle swings up to its mouth (enter curve).
// 0.35-1.4 it tips up to 60 degrees and drains, eyes shut, three gulps that ripple down the jelly at 0.6, 0.9 and 1.2.
// 1.4-1.55 it crushes the bottle (exit curve), 1.55 tosses it over its shoulder, 1.6 a satisfied shudder and "AHHH."
const bottle = new THREE.Group();
const liquid = new THREE.Group();
{
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.4, 20).translate(0, -0.27, 0), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.08, clearcoat: 1 }));
  const juice = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.36, 16).translate(0, -0.18, 0), new THREE.MeshPhysicalMaterial({ color: 0x2bb5ff, roughness: 0.15, clearcoat: 1, emissive: 0x0a3a66, emissiveIntensity: 0.4 }));
  liquid.position.y = -0.08; liquid.add(juice);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16).translate(0, -0.04, 0), new THREE.MeshStandardMaterial({ color: 0xfffdf0, roughness: 0.4 }));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.089, 0.089, 0.11, 20).translate(0, -0.3, 0), new THREE.MeshStandardMaterial({ color: 0xe2562f, roughness: 0.5 }));
  bottle.add(shell, liquid, cap, band);
  bottle.visible = false;
  face.add(bottle);
}
const drink = { t: -1, fired: 0 };
const DRINK_EVENTS = [[0.6, 'gulp'], [0.9, 'gulp'], [1.2, 'gulp'], [1.4, 'crush'], [1.6, 'ahh']];
function startDrink() { if (drink.t >= 0) return; drink.t = 0; drink.fired = 0; bottle.visible = true; }
function drinkStep(dt) {
  if (drink.t < 0) return;
  drink.t += dt;
  const t = drink.t;
  let th = 60; let off = 0; let crush = 0; let fly = 0;
  if (t < 0.35) { const k = ENTER(t / 0.35); th = -40 + 50 * k; off = 1 - k; }
  else if (t < 1.4) th = 10 + 50 * inOut(Math.min(1, ((t - 0.35) / 1.05) * 1.4));
  else if (t < 1.55) crush = EXIT((t - 1.4) / 0.15);
  else { crush = 1; fly = t - 1.55; }
  fx.sipUntil = t > 0.35 && t < 1.4 ? clock + 0.05 : fx.sipUntil;
  liquid.scale.y = Math.max(0.02, 1 - Math.max(0, t - 0.45) / 0.9);
  bottle.rotation.z = Math.PI / 2 + THREE.MathUtils.degToRad(th);
  bottle.position.set(0.02 + 0.8 * off - 1.4 * fly, -0.2 - 0.8 * off + 2.6 * fly - 6 * fly * fly, 0.22);
  const BS = 2.2; // bottle size against the Wall's face
  bottle.scale.set(BS * (1 - 0.6 * crush), BS * (1 - 0.3 * crush), BS * (1 - 0.6 * crush));
  while (drink.fired < DRINK_EVENTS.length && t >= DRINK_EVENTS[drink.fired][0]) {
    const ev = DRINK_EVENTS[drink.fired][1];
    drink.fired += 1;
    if (ev === 'gulp') { poke(face.position.clone(), new THREE.Vector3(0, -1, 0), 1.3, 0.5); post({ type: 'gulp' }); }
    else if (ev === 'crush') post({ type: 'crush' });
    else {
      [0, 50, 100, 150, 200].forEach((ms, i) => setTimeout(() => kick(i % 2 ? -1.4 : 1.4, 0.3, 0), ms));
      fx.happyUntil = clock + 1; showShout('AHHH.', 0.9);
      post({ type: 'ahh' });
    }
  }
  if (t > 2.3) { drink.t = -1; bottle.visible = false; }
}

// The flex, after a full drill (t from the flex start, s):
// 0-0.22 crouch and suck in (1.08 wide, 0.86 tall, 0.88 deep, ease in-out). 0.22-0.34 the gut flexes out on the pop curve
// (1.16 wide, 1.04 tall, 1.75 deep). 0.27 every pellet blows off at 13 along the surface, 6 toward you, 4.5 to 7.5 up, fanned out from the middle, 180 ms camera shake.
// 0.34-0.8 settles on the pop curve. 0.8 cheer: a 6.5 hop with a twirl, grin and "UNBREAKABLE!". 1.22 a second, smaller hop.
const inOut = (k) => (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2);
function flexStep() {
  const t = clock - drill.flexAt;
  if (t < 0) return;
  const lerp3 = (a, b, k) => flex.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
  const IN = [1.08, 0.86, 0.88]; const OUT = [1.16, 1.04, 1.75]; const REST = [1, 1, 1];
  if (t < 0.22) { lerp3(REST, IN, inOut(t / 0.22)); if (!drill.cheer) { drill.cheer = 1; post({ type: 'flex' }); } }
  else if (t < 0.34) lerp3(IN, OUT, POP((t - 0.22) / 0.12));
  else if (t < 0.8) lerp3(OUT, REST, POP((t - 0.34) / 0.46));
  else flex.set(1, 1, 1);
  if (t >= 0.27 && !drill.burst) {
    drill.burst = true;
    const toCam = new THREE.Vector3();
    for (const b of balls) {
      if (b.state !== 'stuck') continue;
      const n = new THREE.Vector3(B.geo.attributes.normal.array[b.vi * 3], B.geo.attributes.normal.array[b.vi * 3 + 1], B.geo.attributes.normal.array[b.vi * 3 + 2]);
      toCam.copy(camera.position).sub(b.m.position).normalize();
      b.state = 'out'; b.drive = false; b.aim = -1;
      b.v.copy(n.multiplyScalar(13)).addScaledVector(toCam, 6).add(new THREE.Vector3((b.m.position.x - com().x) * 6 + (Math.random() - 0.5) * 3, 4.5 + Math.random() * 3, 0));
    }
    const c = com();
    poke(new THREE.Vector3(c.x, c.y, c.z + 0.5), new THREE.Vector3(0, 0, 1), 4, 0.8);
    fx.shakeUntil = clock + 0.18;
    post({ type: 'burst' });
  }
  if (t >= 0.8 && drill.cheer === 1) {
    drill.cheer = 2;
    kick(0, 6.5, 0); spin(7);
    fx.happyUntil = clock + 1.5;
    showShout('UNBREAKABLE!', 1.2);
    post({ type: 'cheer' });
  }
  if (t >= 1.22 && drill.cheer === 2) {
    drill.cheer = 3;
    kick(0, 4.2, 0);
    drill.flexAt = -1; drill.on = false;
  }
}

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
  if (swap.phase === 'idle') { B.S.set(base.x * flex.x, base.y * flex.y, base.z * flex.z); return; }
  swap.t += dt;
  const PUD = { x: 1.35, y: 0.18, z: 1.25 };
  if (swap.phase === 'out') {
    const k = EXIT(clamp(swap.t / 0.24, 0, 1));
    B.S.set(THREE.MathUtils.lerp(base.x, PUD.x, k), THREE.MathUtils.lerp(base.y, PUD.y, k), THREE.MathUtils.lerp(base.z, PUD.z, k));
    if (swap.t >= 0.24) {
      dropBalls();
      setBody(swap.next, true);
      setLabel(swap.next);
      swap.phase = 'in'; swap.t = 0;
      kick(0, 2.6, 0);
      post({ type: 'bloop', cast: swap.next });
      if (swap.next === 'wall') { nextTic = clock + 4; startDrill(10, 0.55); }
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
function faceOn(m, g, cast) {
  const [ox, oy, oz] = g.userData.off;
  const [fx, fy] = v(...FACE[cast]);
  const fz = EXTRUDE.depth + EXTRUDE.bevelThickness + oz + 0.02;
  const fyy = fy + oy - (g.userData.halfH || 0);
  const pupils = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(miniEyeGeo, eyeMat); w.scale.set(0.9, 1.25, 0.45); w.position.set(fx + ox + sx * 0.1, fyy + 0.03, fz);
    const pu = new THREE.Mesh(miniPupilGeo, inkMat); pu.scale.set(1, 1.35, 0.5); pu.position.set(fx + ox + sx * 0.1, fyy + 0.03, fz + 0.04);
    pu.userData.y0 = pu.position.y;
    m.add(w, pu);
    pupils.push(pu);
  }
  const sm = new THREE.Mesh(miniSmileGeo, inkMat); sm.rotation.z = Math.PI; sm.position.set(fx + ox, fyy - 0.15, fz);
  m.add(sm);
  return { pupils, smile: sm };
}
const miniEyeGeo = new THREE.SphereGeometry(0.1, 16, 12);
const miniPupilGeo = new THREE.SphereGeometry(0.05, 12, 10);
const miniSmileGeo = new THREE.TorusGeometry(0.11, 0.026, 8, 20, Math.PI);
const padGeo = new RoundedBoxGeometry(40, 7, 14, 2, 2.5);
const minis = CASTS.map((cast, i) => {
  const g = bodyGeometry(cast, 0);
  g.userData.halfH = g.boundingBox.max.y / 2;
  g.translate(0, -g.boundingBox.max.y / 2, 0);
  g.computeBoundingBox();
  const mat = new THREE.MeshPhysicalMaterial({ color: COLORS[0], roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4 });
  const m = new THREE.Mesh(g, mat);
  // A little face on the front of every candy, at the same spot as the big one's, so none of them read as lying face-down.
  faceOn(m, g, cast);
  // Each candy stands on its own little platform, drawn in the same 3D pass so the candy sits on it, never behind it.
  const pad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.8 }));
  shelfScene.add(pad);
  m.userData = { cast, i, h: g.boundingBox.max.y - g.boundingBox.min.y, pad, hop: { x: 0, v: 0 }, show: { x: 0, v: 0 }, paintAt: -1, paint: null };
  shelfScene.add(m);
  return m;
});
// LURE: GOT YOU's bait, played on our side of the net (GOT YOU faces the camera, so the net is in front of it). t in s.
// 0-0.6 a gray Net Rusher charges in from the camera side (z 4.2 to the net at 1.4, 0.85 to the left), back to us, hopping 0.15.
// 0.6-0.8 GOT YOU coils (86% tall, sly half-shut eyes cut at the rusher). 0.8 it flicks a 1.3 s lob over the rusher, landing
// 3.2 behind it, toward the camera, and springs back up on the pop curve. 1.0-1.2 the rusher leans back to look up;
// 1.2-1.45 it spins round to face us, mouth wide; then scrambles back toward the camera at 1.4 units/s, too slow.
// 2.1 the ball lands; 2.15 the rusher faceplants toward the camera (0.25 s, exit curve), "GOT YOU." with a grin, twirl and hop.
// 2.9-3.3 it sinks into the paper. The camera pulls back 45% and drifts left for the whole bit.
const victim = (() => {
  const g = bodyGeometry('comet', 0);
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0xa7abb3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }));
  m.userData.face = faceOn(m, g, 'comet');
  // Panic mouth for when it turns round and sees the ball going over.
  const o = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), inkMat);
  o.scale.set(1, 1.2, 0.3);
  o.position.copy(m.userData.face.smile.position).add(new THREE.Vector3(0, -0.04, 0));
  o.visible = false;
  m.add(o);
  m.userData.panic = o;
  m.rotation.order = 'YXZ'; // turn first, then fall forward in the turned frame
  m.visible = false;
  scene.add(m);
  return m;
})();
const victimShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadow.material.map, transparent: true, depthWrite: false }));
victimShadow.rotation.x = -Math.PI / 2;
victimShadow.visible = false;
scene.add(victimShadow);
const lure = { t: -1, fired: false, planted: false };
function startLure() { if (lure.t >= 0) return; Object.assign(lure, { t: 0, fired: false, planted: false }); victim.visible = victimShadow.visible = true; }
function lureStep(dt) {
  if (lure.t < 0) return;
  if (B.cast !== 'lobber') { lure.t = -1; victim.visible = victimShadow.visible = false; return; }
  lure.t += dt;
  const t = lure.t;
  const X = -0.85; const NET = 1.4; const LAND = 4.6; const S = 0.45;
  let z = NET; let y = 0; let ry = Math.PI; let rx = 0; let sc = S; let panic = false;
  if (t < 0.6) { z = 4.2 + (NET - 4.2) * ENTER(t / 0.6); y = 0.15 * Math.abs(Math.sin(t * 16)); sc = S * Math.min(1, t / 0.15); }
  else if (t < 1.45) { rx = t > 1.0 ? -0.3 * Math.min(1, (t - 1.0) / 0.12) : 0; if (t > 1.2) { ry = Math.PI * (1 - inOut(Math.min(1, (t - 1.2) / 0.25))); panic = true; } }
  else if (t < 2.15) { z = NET + 1.4 * (t - 1.45); y = 0.12 * Math.abs(Math.sin(t * 22)); ry = 0; panic = true; }
  else { z = NET + 1.4 * 0.7; ry = 0; panic = true; rx = 1.5 * EXIT(Math.min(1, (t - 2.15) / 0.25)); if (t > 2.9) sc = S * (1 - Math.min(1, (t - 2.9) / 0.4)); }
  const look = panic; // eyes up at the ball going over
  victim.userData.panic.visible = panic;
  victim.userData.face.smile.visible = !panic;
  victim.position.set(X, y, z);
  victim.rotation.set(rx, ry, 0);
  victim.scale.setScalar(Math.max(0.0001, sc));
  victimShadow.position.set(X, 0.003, z);
  victimShadow.scale.set(sc * 2.2, sc * 1.2, 1);
  victimShadow.material.opacity = 0.8 / (1 + y * 4);
  for (const p of victim.userData.face.pupils) p.position.y = p.userData.y0 + (look ? 0.035 : 0);
  // GOT YOU: coil, then release.
  if (t >= 0.6 && t < 0.8) { const k = inOut((t - 0.6) / 0.2); flex.set(1 + 0.08 * k, 1 - 0.14 * k, 1); fx.slyUntil = clock + 0.1; }
  else if (t >= 0.8 && t < 1.2) { const k = POP((t - 0.8) / 0.4); flex.set(1.08 - 0.08 * k, 0.86 + 0.14 * k, 1); }
  else flex.set(1, 1, 1);
  if (t >= 0.8 && !lure.fired) {
    lure.fired = true;
    const c = com();
    const start = new THREE.Vector3(c.x, c.y + 0.8, c.z);
    const T = 1.3;
    const vel = new THREE.Vector3(X, BALL_R, LAND).sub(start).divideScalar(T);
    vel.y += 0.5 * 9.8 * T;
    const m = new THREE.Mesh(ballGeo, ballMat);
    m.position.copy(start);
    scene.add(m);
    balls.push({ m, v: vel, state: 'out', drive: false, vi: -1, aim: -1 });
    kick(0, 2, 0);
    fx.slyUntil = clock + 1.2;
    post({ type: 'pock' });
  }
  if (t >= 2.15 && !lure.planted) {
    lure.planted = true;
    showShout('GOT YOU.', 1.1);
    fx.happyUntil = clock + 1.1;
    spin(4); kick(0, 3, 0);
    post({ type: 'gotyou' });
  }
  if (t > 3.3) { lure.t = -1; victim.visible = victimShadow.visible = false; flex.set(1, 1, 1); }
}

function paintMinis(hex) {
  // Left to right, 50 ms apart.
  minis.forEach((m, i) => { m.userData.paintAt = clock + 0.05 * i; m.userData.paint = hex; });
}
function shelfLaunch(cast) {
  // The candy you picked hops on its platform; it stays on the shelf, lifted, so you can always see which one you are.
  for (const m of minis) if (m.userData.cast === cast) m.userData.hop.v = 7;
}
// Candies draw 16 px above the shelf box so a lifted one never clips.
const SHELF_PAD = 16;
function shelfRect() { return $('shelf').getBoundingClientRect(); }
function shelfStep(dt) {
  const r = shelfRect();
  shelfCam.left = 0; shelfCam.right = r.width; shelfCam.top = SHELF_PAD; shelfCam.bottom = -r.height;
  shelfCam.updateProjectionMatrix();
  const cols = 5; const cw = r.width / cols; const rh = r.height / 2;
  for (const m of minis) {
    const u = m.userData;
    const col = u.i % cols; const row = Math.floor(u.i / cols);
    springTo(u.hop, 0, dt, 5, 0.4);
    const on = u.cast === (swap.next || B.cast);
    // Lift: the picked candy rises 4 px and grows 14% on a 0.45 spring; the rest sit a touch smaller.
    springTo(u.show, on ? 1 : 0, dt, 4.2, 0.45);
    const s = 26 * (0.94 + 0.14 * u.show.x);
    const base = -(row * rh + rh * 0.5) + 3 * Math.sin(clock * 1.7 + u.i);
    const y = base + 4 * u.show.x;
    m.position.set(col * cw + cw / 2, y + u.hop.x * 10, 0);
    m.scale.setScalar(s);
    // Platform under the candy's feet (at rest size), tipped 0.35 rad so its top face shows. Yours is clay.
    u.pad.position.set(col * cw + cw / 2, base - (u.h * 26 * 0.94) / 2 - 7, -14);
    u.pad.rotation.x = 0.35;
    u.pad.material.color.set(on ? 0xe2562f : 0xf4f1ea);
    m.rotation.set(-0.18, on ? 0.6 * Math.sin(clock * 1.6) : 0.3 * Math.sin(clock * 0.9 + u.i * 0.8), 0.04 * Math.sin(clock * 1.3 + u.i));
    if (u.paint && clock >= u.paintAt) { m.material.color.set(u.paint); u.paint = null; u.hop.v = 3.5; }
  }
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
    const col = Math.floor(((e.clientX - sr.left) / sr.width) * 5);
    const row = Math.floor(((e.clientY - sr.top) / sr.height) * 2);
    const cast = CASTS[clamp(row, 0, 1) * 5 + clamp(col, 0, 4)];
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
// Stat icons, drawn on a 24 px grid in ink.
const ICONS = {
  bio: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H11l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
  pro: '<svg viewBox="0 0 24 24"><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a3 3 0 0 0 3 4M17 6h2.5a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
  court: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M5 12h14M12 7v10M8 7h8M8 17h8M8 3v18M16 3v18"/></svg>',
  racket: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="6" ry="7"/><path d="M9 4.5v9M12 2.5v13M15 4.5v9M6.5 7h11M6 10h12M7 13h10M12 16v6"/></svg>',
};
function fillText() {
  const raw = (current.name || '').trim().toUpperCase();
  const named = raw && raw !== 'YOU';
  const nm = named ? raw : 'TAP TO NAME';
  if ($('name').dataset.v !== nm) { $('name').dataset.v = nm; letters($('name'), nm); }
  $('name').classList.toggle('empty', !named);
  for (const [id, k, label] of [['bio', 'bio', 'TRASH TALK'], ['pro', 'favoritePro', 'FAVORITE PRO'], ['court', 'homeCourt', 'HOME COURT'], ['racket', 'racket', 'RACKET']]) {
    const val = current[k];
    $(id).innerHTML = ICONS[id];
    $(id).setAttribute('aria-label', val ? `${label}: ${val}` : `Add ${label.toLowerCase()}`);
    $(id).classList.toggle('full', !!val);
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
    // Dropped in from above. The Wall gets drilled as soon as it has its feet.
    for (let m = 0; m < NN; m += 1) B.x[m * 3 + 1] += 2.6;
    if (current.cast === 'wall') { nextTic = clock + 5; startDrill(10, 1.0); }
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
  // Sly: half-shut eyes cut sideways at the net rusher.
  const sly = clock < fx.slyUntil;
  let lx = grab.on ? clamp((grab.T.x - tmpA.x) * 0.4, -0.03, 0.03) : 0.015 * Math.sin(clock * 0.7);
  let ly = grab.on ? clamp((grab.T.y - tmpA.y) * 0.4, -0.03, 0.03) : 0.01 * Math.sin(clock * 0.5);
  if (sly) { lx = -0.03; ly = -0.012; }
  for (const e of eyes) {
    e.position.set(e.userData.sx * sp / 2, 0.03, 0.02);
    const happy = clock < fx.happyUntil; const wince = clock < fx.winceUntil;
    e.scale.set(1, happy || clock < fx.sipUntil ? 0.16 : wince ? 0.28 : sly ? 0.5 : blink * (1 - 0.7 * g) * (1 + 0.25 * surprise), 1);
    e.userData.pupil.position.set(lx, ly, 0.04);
  }
  for (const b of brows) b.position.set(b.userData.sx * 0.11, 0.17, 0.03);
  smile.position.set(0, -0.15, 0.03);
  smile.visible = !['bot', 'grunter'].includes(B.cast) && g < 0.5;
  const grin = clock < fx.happyUntil;
  const sip = clock < fx.sipUntil;
  if (grin || sip) smile.visible = false;
  mouthO.visible = B.cast === 'grunter' || g >= 0.5 || surprise > 0 || grin || sip;
  mouthO.position.set(0, -0.2, 0.03);
  const open = sip ? 0.45 : grin ? 1.3 : B.cast === 'grunter' ? 0.9 + 0.5 * surprise : 0.6 + 0.4 * g;
  mouthO.scale.set(open, open * 0.95, 0.3);
  mouthBar.position.set(0, -0.17, 0.03);
  mouthBar.visible = B.cast === 'bot' && g < 0.5;
}

// Loop.
let clock = 0;
let acc = 0;
const cam = { x: { x: 0, v: 0 }, y: { x: 0.8, v: 0 }, d: { x: 11, v: 0 } };
function advance(dt) {
  clock += dt;
  acc += dt;
  swapStep(dt);
  if (B.cast) {
    while (acc >= H) { step(); acc -= H; }
    if (swap.phase === 'idle' && !grab.on && clock > nextTic) { TICS[B.cast].go(); nextTic = clock + TICS[B.cast].every + Math.random() * 0.6; }
  }
  dropsStep(dt);
  ballsStep(dt);
  drinkStep(dt);
  lureStep(dt);
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
    trailStep();
    poseFace(dt);
    const c = com();
    let low = Infinity;
    for (let m = 0; m < NN; m += 1) low = Math.min(low, B.x[m * 3 + 1]);
    const lift = Math.max(0, low);
    shadow.position.set(c.x, 0.002, c.z);
    shadow.scale.set(2.3 + lift * 0.6, 1.3 + lift * 0.4, 1);
    shadow.material.opacity = 1 / (1 + lift * 1.6);
    // During GOT YOU's lure the camera pulls back 45% and drifts left so the net rusher is in the shot too.
    const wide = lure.t >= 0 && lure.t < 3.1;
    springTo(cam.x, c.x * 0.45 + (wide ? -0.45 : 0), dt, 1.3, 1);
    // Frame the rest shape to the stage: its height fills 56% of the stage, its width 66% of the screen. The camera aims at the
    // middle of the body (plus the ghost's hover) and only drifts 30% after hops, so a jump reads as a jump.
    const rb = B.geo.boundingBox; const bh = rb.max.y - rb.min.y; const bw = rb.max.x - rb.min.x;
    const stH = Math.max(120, $('stage').getBoundingClientRect().height);
    const tan = 2 * Math.tan(THREE.MathUtils.degToRad(15));
    const fitH = (bh / 0.5) * (window.innerHeight / stH) / tan;
    const availW = Math.max(120, $('stage').getBoundingClientRect().width);
    const fitW = (bw / 0.6) * (window.innerWidth / availW) / (tan * camera.aspect);
    springTo(cam.d, Math.max(fitH, fitW) * (wide ? 1.45 : 1), dt, 1.3, 1);
    const mid = bh / 2 + (B.feel.float || 0);
    springTo(cam.y, mid + Math.max(0, c.y - mid) * 0.3, dt, 1.3, 1);
  }
  // The grunt, written over its head.
  const sh = $('shout');
  if (clock < fx.shoutUntil) {
    const p = com().add(new THREE.Vector3(0, 1.25, 0)).project(camera);
    // Kept inside the stage: never up under the back button, never off the edges.
    const st0 = $('stage').getBoundingClientRect(); const half = sh.offsetWidth / 2 + 12;
    const sx = clamp((p.x * 0.5 + 0.5) * window.innerWidth, half, window.innerWidth - half);
    const sy = Math.max(st0.top + 30, (-p.y * 0.5 + 0.5) * window.innerHeight);
    sh.style.transform = `translate(${sx}px,${sy}px)`;
    sh.classList.add('on');
  } else sh.classList.remove('on');
  // Camera: 30 degree lens, 2 degree orbit on a 9 s sine, and shifted so the body sits between the header and the shelf.
  const orbit = THREE.MathUtils.degToRad(2) * Math.sin((clock * Math.PI * 2) / 9);
  const look = new THREE.Vector3(cam.x.x, cam.y.x, 0);
  const D = cam.d.x;
  camera.position.set(look.x + D * Math.sin(orbit), look.y + D * 0.15, D * Math.cos(orbit));
  if (clock < fx.shakeUntil) {
    const k = (fx.shakeUntil - clock) / 0.18;
    camera.position.x += (Math.random() - 0.5) * 0.16 * k; camera.position.y += (Math.random() - 0.5) * 0.16 * k;
  }
  camera.lookAt(look);
  const w = window.innerWidth; const h = window.innerHeight;
  const st = $('stage').getBoundingClientRect();
  const cx = st.left + st.width / 2;
  camera.setViewOffset(w, h, w / 2 - cx, h / 2 - (st.top + st.height * 0.5), w, h);
  slideRender(clock);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.render(scene, camera);
  const r = shelfRect();
  renderer.setViewport(r.left, h - r.bottom, r.width, r.height + SHELF_PAD);
  renderer.setScissor(r.left, h - r.bottom, r.width, r.height + SHELF_PAD);
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
/** Test hook: switch style as if its candy were tapped. */
window.demoStyle = (cast) => changeStyle(cast);
window.demoDrink = () => { if (B.cast === 'wall') startDrink(); };
post({ type: 'ready' });
