// The fighter as a jelly body, shared by every page that shows one (web/fighter.js, web/home.js).
// Shapes, faces and how each play style is made of jelly live here, plus SoftBody: a self-contained character you can drop into
// any three.js scene. The simulation is the same as the fighter page's (see the header of web/fighter.js for the method):
// a 4x4x4 Bezier lattice, shape matching at 240 Hz with 27 local clusters and one global cluster, and a weeble pose it climbs back to.
import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const INK = 0x16181d;
export const clamp = THREE.MathUtils.clamp;

export const bez = (x1, y1, x2, y2) => (t) => {
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
export const EXIT = bez(0.7, 0, 0.84, 0);
export const POP = bez(0.34, 1.56, 0.64, 1);
export const ENTER = bez(0.16, 1, 0.3, 1);

// Silhouettes, drawn in the same 200x200 box as the 2D avatars (y down), mapped to units (1 unit = 100 px, y up).
export const v = (x, y) => [(x - 100) / 100, (100 - y) / 100];
export function path() {
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
export const SHAPES = {
  wall: () => [rrect(38, 36, 124, 130, 16)],
  moon: () => [crescent()],
  bot: () => [circle(100, 14, 9), rrect(96, 14, 8, 26, 3), rrect(46, 38, 108, 82, 18), rrect(62, 122, 76, 50, 12), rrect(28, 64, 16, 32, 7), rrect(156, 64, 16, 32, 7)],
  goblin: () => [path().ell(100, 106, 58, 62).shape, poly([[50, 100], [6, 58], [60, 76]]), poly([[150, 100], [194, 58], [140, 76]])],
  grunter: () => [circle(100, 100, 72)],
  junk: () => [rrect(38, 44, 124, 18, 9), rrect(84, 28, 32, 18, 7), poly([[48, 66], [152, 66], [142, 174], [58, 174]])],
  comet: () => [circle(112, 108, 62), poly([[12, 50], [92, 66], [62, 88]]), poly([[6, 104], [56, 96], [54, 120]]), poly([[22, 154], [62, 128], [74, 152]])],
  // An arch: the path of a lob.
  lobber: () => [path().m(24, 176).l(24, 120).arc(100, 120, 76, Math.PI, 0, true).l(176, 176).l(134, 176).l(134, 120).arc(100, 120, 34, 0, Math.PI, false).l(66, 176).shape],
  rabbit: () => [path().ell(74, 52, 15, 40).shape, path().ell(126, 52, 15, 40).shape, path().ell(100, 124, 62, 54).shape],
  ghost: () => [path().m(42, 176).l(42, 88).arc(100, 88, 58, Math.PI, 0, true).l(158, 176).l(135, 162).l(117, 178).l(100, 162).l(83, 178).l(65, 162).shape],
};
/** Where the face sits on each body (svg box). */
export const FACE = {
  wall: [100, 90], moon: [62, 104], bot: [100, 76], goblin: [100, 100],
  grunter: [100, 86], junk: [100, 108], comet: [116, 102], ghost: [100, 88], lobber: [100, 63], rabbit: [100, 122],
};

// How each play style is made of jelly. alpha: shape stiffness per 240 Hz step. beta: how much it stretches as a whole.
// grav: weight. damp: how fast the wobble dies (1/s). pull: how hard a finger can drag it. float: hover height (the ghost).
export const FEEL = {
  wall: { alpha: 0.03, beta: 0.0, grav: 18, damp: 7, pull: 0.12 },
  moon: { alpha: 0.012, beta: 0.15, grav: 13, damp: 4.5, pull: 0.3 },
  bot: { alpha: 0.05, beta: 0.0, grav: 15, damp: 9, pull: 0.25 },
  goblin: { alpha: 0.01, beta: 0.3, grav: 14, damp: 4, pull: 0.3 },
  grunter: { alpha: 0.014, beta: 0.1, grav: 16, damp: 4.2, pull: 0.25 },
  junk: { alpha: 0.0055, beta: 0.5, grav: 14, damp: 3, pull: 0.35 },
  comet: { alpha: 0.018, beta: 0.15, grav: 14, damp: 5, pull: 0.3 },
  ghost: { alpha: 0.012, beta: 0.2, grav: 0, damp: 3.5, pull: 0.35, float: 0.35 },
  lobber: { alpha: 0.013, beta: 0.2, grav: 12, damp: 4.2, pull: 0.3 },
  rabbit: { alpha: 0.022, beta: 0.12, grav: 16, damp: 5.5, pull: 0.35 },
};

// Lattice.
export const NL = 4;
export const NN = NL * NL * NL;
export const nid = (i, j, k) => i + NL * (j + NL * k);
const bern = (s) => [(1 - s) ** 3, 3 * s * (1 - s) ** 2, 3 * s * s * (1 - s), s ** 3];
export function weightsFor(p, box) {
  const s = (p.x - box.min.x) / (box.max.x - box.min.x);
  const t = (p.y - box.min.y) / (box.max.y - box.min.y);
  const u = (p.z - box.min.z) / (box.max.z - box.min.z);
  const bs = bern(clamp(s, 0, 1)); const bt = bern(clamp(t, 0, 1)); const bu = bern(clamp(u, 0, 1));
  const w = new Float32Array(NN);
  for (let k = 0; k < NL; k += 1) for (let j = 0; j < NL; j += 1) for (let i = 0; i < NL; i += 1) w[nid(i, j, k)] = bs[i] * bt[j] * bu[k];
  return w;
}

export const EXTRUDE = { depth: 0.4, bevelEnabled: true, bevelThickness: 0.17, bevelSize: 0.1, bevelSegments: 6, curveSegments: 28, steps: 1 };
/** The play style's silhouette, extruded with a fat bevel. `edge` tessellates it so the lattice can bend it smoothly (0 = no). */
export function bodyGeometry(cast, edge = 0.085) {
  let g = new THREE.ExtrudeGeometry(SHAPES[cast](), EXTRUDE);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  if (edge) g = new TessellateModifier(edge, 8).modify(g);
  g = mergeVertices(g, 1e-4);
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.userData.off = [-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2];
  g.translate(...g.userData.off);
  g.computeBoundingBox();
  g.computeVertexNormals();
  return g;
}
/** The face's spot on the body's front surface, in the body's own coordinates. */
export function faceRestPoint(cast, g) {
  const [ox, oy, oz] = g.userData.off;
  const [fx, fy] = v(...FACE[cast]);
  return new THREE.Vector3(fx + ox, fy + oy, EXTRUDE.depth + EXTRUDE.bevelThickness + oz);
}

// Small 3x3 math on flat arrays, column-major.
export function quatMat(q, out) {
  const [x, y, z, w] = q;
  out[0] = 1 - 2 * (y * y + z * z); out[1] = 2 * (x * y + z * w); out[2] = 2 * (x * z - y * w);
  out[3] = 2 * (x * y - z * w); out[4] = 1 - 2 * (x * x + z * z); out[5] = 2 * (y * z + x * w);
  out[6] = 2 * (x * z + y * w); out[7] = 2 * (y * z - x * w); out[8] = 1 - 2 * (x * x + y * y);
  return out;
}
const Rm = new Float32Array(9);
/** Rotation part of A, warm-started from q (Muller et al. 2016, "A Robust Method to Extract the Rotational Part of Deformations"). */
export function extractRotation(A, q) {
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
export function inv3(m, out) {
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
export const det3 = (m) => m[0] * (m[4] * m[8] - m[7] * m[5]) - m[3] * (m[1] * m[8] - m[7] * m[2]) + m[6] * (m[1] * m[5] - m[4] * m[2]);

/** Overlapping 2x2x2 clusters plus one global cluster, and how many clusters each node belongs to (global counts double). */
export function makeClusters() {
  const clusters = [];
  for (let k = 0; k < NL - 1; k += 1) for (let j = 0; j < NL - 1; j += 1) for (let i = 0; i < NL - 1; i += 1) {
    const idx = [];
    for (let c = 0; c < 8; c += 1) idx.push(nid(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1)));
    clusters.push({ idx, q: [0, 0, 0, 1], global: false });
  }
  clusters.push({ idx: [...Array(NN).keys()], q: [0, 0, 0, 1], global: true });
  const count = new Float32Array(NN);
  for (const c of clusters) for (const m of c.idx) count[m] += c.global ? 2 : 1;
  return { clusters, count };
}

const POSE = [Math.sin(-0.08), 0, 0, Math.cos(-0.08)]; // rest pose: leaned back 0.16 rad so the face looks up at the camera
const H = 1 / 240;
const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0xfffdf0, roughness: 0.15, clearcoat: 1 });
const inkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.35 });

/**
 * A fighter you can put in any scene. Its coordinates are its own: it stands on y = 0 and is pulled back toward x = z = 0.
 * Put `group` where the fighter should stand and scale it. Call `shove(ax, ay, az, dt)` with the acceleration of the thing
 * carrying it (in its own units) so the jelly lags, stretches and splats when it is carried around, and `update(dt, t)` each frame.
 */
export class SoftBody {
  constructor({ cast, color, edge = 0.12, transmission = 0.28 }) {
    this.group = new THREE.Group();
    this.mat = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07, sheen: 0.4, sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff), transmission, thickness: 0.9, ior: 1.35,
    });
    this.baseTransmission = transmission;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.edge = edge;
    this.x = new Float32Array(NN * 3); this.v = new Float32Array(NN * 3); this.p = new Float32Array(NN * 3); this.r = new Float32Array(NN * 3);
    this.rs = new Float32Array(NN * 3); this.goal = new Float32Array(NN * 3);
    this.scratch = { Apq: new Float32Array(9), Aqq: new Float32Array(9), AqqI: new Float32Array(9), Alin: new Float32Array(9), Rup: new Float32Array(9) };
    const { clusters, count } = makeClusters();
    this.clusters = clusters; this.count = count;
    this.S = new THREE.Vector3(1, 1, 1); // rest-shape scale it reaches for (squash and stretch, breathing)
    this.squash = 0; // extra vertical squash, 0..1
    this.acc = 0;
    this.lean = 0; // extra lean about z, radians (into a hop)
    this.blinkAt = 3.1;
    this.mood = { sly: 0, happy: 0 }; // seconds left
    this.buildFace();
    this.setCast(cast, false);
  }

  buildFace() {
    const face = new THREE.Group();
    this.eyes = [-1, 1].map((sx) => {
      const g = new THREE.Group();
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), eyeMat);
      white.scale.set(0.9, 1.25, 0.45);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), inkMat);
      pupil.scale.set(1, 1.35, 0.5);
      pupil.position.z = 0.04;
      g.add(white, pupil);
      g.userData = { sx, pupil };
      face.add(g);
      return g;
    });
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 8, 24, Math.PI), inkMat);
    this.smile.rotation.z = Math.PI;
    this.mouthO = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), inkMat);
    this.mouthO.scale.set(1, 1, 0.3);
    this.mouthBar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), inkMat);
    this.brows = [-1, 1].map((sx) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.16, 4, 8), inkMat); b.rotation.z = Math.PI / 2 + sx * 0.45; b.userData.sx = sx; face.add(b); return b; });
    face.add(this.smile, this.mouthO, this.mouthBar);
    this.face = face;
    this.group.add(face);
  }

  setColor(color) { this.mat.color.set(color); }

  setCast(cast, keepNodes) {
    const geo = bodyGeometry(cast, this.edge);
    const box = geo.boundingBox.clone().expandByScalar(0.015);
    const pos = geo.attributes.position;
    const n = pos.count;
    const W = new Float32Array(n * NN);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < n; i += 1) W.set(weightsFor(tmp.fromBufferAttribute(pos, i), box), i * NN);
    for (let k = 0; k < NL; k += 1) for (let j = 0; j < NL; j += 1) for (let i = 0; i < NL; i += 1) {
      const m = nid(i, j, k) * 3;
      this.r[m] = THREE.MathUtils.lerp(box.min.x, box.max.x, i / (NL - 1));
      this.r[m + 1] = THREE.MathUtils.lerp(box.min.y, box.max.y, j / (NL - 1));
      this.r[m + 2] = THREE.MathUtils.lerp(box.min.z, box.max.z, k / (NL - 1));
    }
    const fr = faceRestPoint(cast, geo);
    this.faceW = [fr, fr.clone().add(new THREE.Vector3(0.1, 0, 0)), fr.clone().add(new THREE.Vector3(0, 0.1, 0))].map((p) => weightsFor(p, box));
    if (this.geo) this.geo.dispose();
    this.geo = geo; this.n = n; this.W = W; this.cast = cast; this.feel = FEEL[cast];
    this.height = box.max.y - box.min.y;
    this.mesh.geometry = geo;
    for (const cl of this.clusters) cl.q = [0, 0, 0, 1];
    if (!keepNodes) for (let m = 0; m < NN * 3; m += 1) { this.x[m] = this.r[m]; this.v[m] = 0; }
    this.mat.transmission = cast === 'ghost' ? 0.72 : this.baseTransmission;
    this.smile.visible = !['bot', 'grunter'].includes(cast);
    this.mouthBar.visible = cast === 'bot';
    for (const b of this.brows) b.visible = cast === 'goblin';
  }

  com() {
    let x = 0; let y = 0; let z = 0;
    for (let m = 0; m < NN; m += 1) { x += this.x[m * 3]; y += this.x[m * 3 + 1]; z += this.x[m * 3 + 2]; }
    return new THREE.Vector3(x / NN, y / NN, z / NN);
  }

  kick(vx, vy, vz) { for (let m = 0; m < NN; m += 1) { this.v[m * 3] += vx; this.v[m * 3 + 1] += vy; this.v[m * 3 + 2] += vz; } }

  spin(wy, wz = 0) {
    const c = this.com();
    for (let m = 0; m < NN; m += 1) {
      const rx = this.x[m * 3] - c.x; const ry = this.x[m * 3 + 1] - c.y; const rz = this.x[m * 3 + 2] - c.z;
      this.v[m * 3] += wy * rz - wz * ry; this.v[m * 3 + 1] += wz * rx; this.v[m * 3 + 2] += -wy * rx;
    }
  }

  poke(p, dir, power, sigma = 0.45) {
    for (let m = 0; m < NN; m += 1) {
      const o = m * 3;
      const d2 = (this.x[o] - p.x) ** 2 + (this.x[o + 1] - p.y) ** 2 + (this.x[o + 2] - p.z) ** 2;
      const w = Math.exp(-d2 / (sigma * sigma));
      this.v[o] += dir.x * power * w; this.v[o + 1] += dir.y * power * w; this.v[o + 2] += dir.z * power * w;
    }
  }

  /** The carrier accelerated by (ax, ay, az) this frame: the jelly feels the opposite, so it lags behind, stretches and splats. */
  shove(ax, ay, az, dt) { this.kick(-ax * dt, -ay * dt, -az * dt); }

  step(t) {
    const f = this.feel; const S = this.S; const X = this.x; const V = this.v; const P = this.p; const R = this.r; const rs = this.rs;
    let rcx = 0; let rcy = 0; let rcz = 0;
    for (let m = 0; m < NN; m += 1) { rcx += R[m * 3]; rcy += R[m * 3 + 1]; rcz += R[m * 3 + 2]; }
    rcx /= NN; rcy /= NN; rcz /= NN;
    const sy = S.y * (1 - 0.3 * this.squash); const sx = S.x * (1 + 0.15 * this.squash);
    for (let m = 0; m < NN; m += 1) {
      rs[m * 3] = rcx + (R[m * 3] - rcx) * sx;
      rs[m * 3 + 1] = rcy + (R[m * 3 + 1] - rcy) * sy;
      rs[m * 3 + 2] = rcz + (R[m * 3 + 2] - rcz) * S.z;
    }
    let mvx = 0; let mvy = 0; let mvz = 0; let cx = 0; let cy = 0; let cz = 0;
    for (let m = 0; m < NN; m += 1) { mvx += V[m * 3]; mvy += V[m * 3 + 1]; mvz += V[m * 3 + 2]; cx += X[m * 3]; cy += X[m * 3 + 1]; cz += X[m * 3 + 2]; }
    mvx /= NN; mvy /= NN; mvz /= NN; cx /= NN; cy /= NN; cz /= NN;
    const kd = Math.exp(-f.damp * H); const ka = Math.exp(-0.4 * H);
    // Pulled back to its spot (1.6 Hz, nearly critically damped), so whatever carries it decides where it stands.
    const hw = 2 * Math.PI * 1.6;
    const hx = -hw * hw * cx * H - 2 * 0.9 * hw * mvx * H;
    const hz = -hw * hw * cz * H - 2 * 0.9 * hw * mvz * H;
    let hy = -f.grav * H;
    if (f.float !== undefined) {
      const target = f.float + rcy + 0.06 * Math.sin(t * 2.1);
      hy = -((2 * Math.PI * 0.9) ** 2) * (cy - target) * H - 2 * 0.6 * 2 * Math.PI * 0.9 * mvy * H;
    }
    for (let m = 0; m < NN; m += 1) {
      const o = m * 3;
      V[o] = (mvx + (V[o] - mvx) * kd) * ka + hx;
      V[o + 1] = (mvy + (V[o + 1] - mvy) * kd) * ka + hy;
      V[o + 2] = (mvz + (V[o + 2] - mvz) * kd) * ka + hz;
      P[o] = X[o] + V[o] * H; P[o + 1] = X[o + 1] + V[o + 1] * H; P[o + 2] = X[o + 2] + V[o + 2] * H;
    }
    const goal = this.goal;
    goal.fill(0);
    const { Apq, Aqq, AqqI, Alin, Rup } = this.scratch;
    for (const cl of this.clusters) {
      const idx = cl.idx; const n = idx.length;
      let px = 0; let py = 0; let pz = 0; let qx = 0; let qy = 0; let qz = 0;
      for (const m of idx) { px += P[m * 3]; py += P[m * 3 + 1]; pz += P[m * 3 + 2]; qx += rs[m * 3]; qy += rs[m * 3 + 1]; qz += rs[m * 3 + 2]; }
      px /= n; py /= n; pz /= n; qx /= n; qy /= n; qz /= n;
      Apq.fill(0);
      if (cl.global) Aqq.fill(0);
      for (const m of idx) {
        const ax = P[m * 3] - px; const ay = P[m * 3 + 1] - py; const az = P[m * 3 + 2] - pz;
        const bx = rs[m * 3] - qx; const by = rs[m * 3 + 1] - qy; const bz = rs[m * 3 + 2] - qz;
        Apq[0] += ax * bx; Apq[1] += ay * bx; Apq[2] += az * bx;
        Apq[3] += ax * by; Apq[4] += ay * by; Apq[5] += az * by;
        Apq[6] += ax * bz; Apq[7] += ay * bz; Apq[8] += az * bz;
        if (cl.global) {
          Aqq[0] += bx * bx; Aqq[1] += by * bx; Aqq[2] += bz * bx; Aqq[3] += bx * by; Aqq[4] += by * by; Aqq[5] += bz * by; Aqq[6] += bx * bz; Aqq[7] += by * bz; Aqq[8] += bz * bz;
        }
      }
      let Rr = extractRotation(Apq, cl.q);
      if (cl.global) {
        // Weeble: climbs back to its pose (leaned back to face the camera), with an extra lean into a hop.
        const pose = this.lean ? [POSE[0], 0, Math.sin(this.lean / 2), POSE[3]] : POSE;
        const k = 0.05;
        const d = cl.q[0] * pose[0] + cl.q[2] * pose[2] + cl.q[3] * pose[3] < 0 ? -1 : 1;
        const up = [0, 0, 0, 0];
        for (let i = 0; i < 4; i += 1) up[i] = cl.q[i] * d * (1 - k) + pose[i] * k;
        const l = Math.hypot(up[0], up[1], up[2], up[3]);
        for (let i = 0; i < 4; i += 1) up[i] /= l;
        Rr = quatMat(up, Rup);
      }
      let M = Rr;
      if (cl.global && f.beta > 0 && inv3(Aqq, AqqI)) {
        for (let c = 0; c < 3; c += 1) for (let r = 0; r < 3; r += 1) {
          let s = 0;
          for (let k = 0; k < 3; k += 1) s += Apq[k * 3 + r] * AqqI[c * 3 + k];
          Alin[c * 3 + r] = s;
        }
        const d = det3(Alin);
        if (d > 1e-6) {
          const sc = 1 / Math.cbrt(d);
          for (let i = 0; i < 9; i += 1) Alin[i] = f.beta * Alin[i] * sc + (1 - f.beta) * Rr[i];
          M = Alin;
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
    for (let m = 0; m < NN; m += 1) {
      const o = m * 3; const c = this.count[m];
      P[o] += (goal[o] / c - P[o]) * a;
      P[o + 1] += (goal[o + 1] / c - P[o + 1]) * a;
      P[o + 2] += (goal[o + 2] / c - P[o + 2]) * a;
      if (P[o + 1] < 0) { P[o + 1] = 0; P[o] -= (P[o] - X[o]) * 0.15; P[o + 2] -= (P[o + 2] - X[o + 2]) * 0.15; }
    }
    for (let m = 0; m < NN * 3; m += 1) {
      V[m] = (P[m] - X[m]) / H;
      if (V[m] > 16) V[m] = 16; else if (V[m] < -16) V[m] = -16;
      X[m] = P[m];
    }
  }

  /** Physics only (call as often as you like); `render(t)` draws it. `update` does both. */
  update(dt, t) { this.simulate(dt, t); this.render(t); }

  simulate(dt, t) {
    const breath = 1 + 0.025 * Math.sin((t * Math.PI * 2) / 2.2);
    this.S.set(1 - 0.012 * Math.sin((t * Math.PI * 2) / 2.2), breath, 1);
    this.acc += Math.min(dt, 0.05);
    while (this.acc >= H) { this.step(t); this.acc -= H; }
    this.mood.sly = Math.max(0, this.mood.sly - dt);
    this.mood.happy = Math.max(0, this.mood.happy - dt);
  }

  render(t) {
    const arr = this.geo.attributes.position.array; const W = this.W; const X = this.x;
    for (let i = 0, n = this.n; i < n; i += 1) {
      let x = 0; let y = 0; let z = 0;
      const base = i * NN;
      for (let m = 0; m < NN; m += 1) { const w = W[base + m]; const o = m * 3; x += w * X[o]; y += w * X[o + 1]; z += w * X[o + 2]; }
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    // Face rides the surface.
    const ffd = (Wf) => { let x = 0; let y = 0; let z = 0; for (let m = 0; m < NN; m += 1) { const w = Wf[m]; x += w * X[m * 3]; y += w * X[m * 3 + 1]; z += w * X[m * 3 + 2]; } return new THREE.Vector3(x, y, z); };
    const a = ffd(this.faceW[0]);
    const ax = ffd(this.faceW[1]).sub(a).normalize();
    const ay = ffd(this.faceW[2]).sub(a).normalize();
    const az = new THREE.Vector3().crossVectors(ax, ay).normalize();
    ay.crossVectors(az, ax);
    this.face.position.copy(a);
    this.face.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, ay, az));
    const blink = (t % 3.1) < 0.11 ? 0.12 : 1;
    const happy = this.mood.happy > 0; const sly = this.mood.sly > 0;
    const sp = this.cast === 'wall' ? 0.24 : 0.2;
    for (const e of this.eyes) {
      e.position.set(e.userData.sx * sp / 2, 0.03, 0.02);
      e.scale.set(1, happy ? 0.16 : sly ? 0.5 : blink, 1);
      e.userData.pupil.position.set(sly ? 0.03 : 0.015 * Math.sin(t * 0.7), 0.01 * Math.sin(t * 0.5), 0.04);
    }
    for (const b of this.brows) b.position.set(b.userData.sx * 0.11, 0.17, 0.03);
    this.smile.position.set(0, -0.15, 0.03);
    this.smile.visible = !['bot', 'grunter'].includes(this.cast) && !happy;
    this.mouthO.visible = this.cast === 'grunter' || happy;
    this.mouthO.position.set(0, -0.2, 0.03);
    const open = happy ? 1.2 : 0.9;
    this.mouthO.scale.set(open, open * 0.95, 0.3);
    this.mouthBar.position.set(0, -0.17, 0.03);
  }
}

/** A six-band rainbow ribbon that follows a point while it moves fast and burns down when it slows (the Jackrabbit's). */
export class RainbowTrail {
  constructor(scene, { n = 26, band = 0.06 } = {}) {
    this.n = n; this.band = band; this.pts = [];
    this.colors = [0xff4d4d, 0xff9a1f, 0xffe23a, 0x3ee07a, 0x35b8ff, 0x9b6bff].map((h) => new THREE.Color(h));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12 * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 12 * 4), 4));
    const idx = [];
    for (let b = 0; b < 6; b += 1) for (let i = 0; i < n - 1; i += 1) { const a = (b * n + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(point, on) {
    if (on) { this.pts.unshift(point.clone()); if (this.pts.length > this.n) this.pts.pop(); } else { this.pts.pop(); this.pts.pop(); }
    const pos = this.geo.attributes.position.array; const col = this.geo.attributes.color.array;
    const n = this.pts.length;
    for (let b = 0; b < 6; b += 1) for (let i = 0; i < this.n; i += 1) {
      const p = this.pts[Math.min(i, Math.max(0, n - 1))];
      const a = (b * this.n + i) * 2;
      const y0 = (2.5 - b) * this.band;
      const alpha = n > 1 && i < n ? (1 - i / (n - 1)) * 0.9 : 0;
      for (let e = 0; e < 2; e += 1) {
        const o = (a + e) * 3;
        pos[o] = p ? p.x : 0; pos[o + 1] = p ? p.y + y0 + (e ? -this.band : 0) : -10; pos[o + 2] = p ? p.z : 0;
        const q = (a + e) * 4;
        col[q] = this.colors[b].r; col[q + 1] = this.colors[b].g; col[q + 2] = this.colors[b].b; col[q + 3] = alpha;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
