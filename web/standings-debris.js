// Tennis wreckage drifting through the tesseract toward the camera: balls, rackets whole and snapped, umpire chairs,
// loose court lines and chunks of court, scraps of net, ball cans, and score tiles (LOVE, 15, 30, 40, DEUCE, AD).
//
// Motion spec.
// - Each piece drifts toward the camera at 0.5 to 1.5 units/s and tumbles on its own axis at 0.2 to 0.9 rad/s.
// - A piece that passes the camera respawns 26 to 32 units ahead, somewhere new, so the stream never runs out or repeats.
// - Knocked (tapped): an impulse of 4 units/s along the finger's ray plus a 7 rad/s spin, both easing back to the drift at 0.8/s.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const gridTex = (cells, line, color) => canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = color; g.lineWidth = line;
  for (let i = 0; i <= cells; i += 1) {
    const p = (i / cells) * w;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
  }
});

// Shared geometry and materials.
const FELT = std(0xd7f205, { roughness: 0.95 });
const SEAM = std(0xfffdf0, { roughness: 0.6 });
const INK = std(0x16181d, { roughness: 0.4 });
const WHITE = std(0xf4f1e6, { roughness: 0.7 });
const WOOD = std(0x1f5a3c, { roughness: 0.6 });
const STRINGS = new THREE.MeshBasicMaterial({ map: gridTex(12, 5, 'rgba(244,241,230,0.85)'), transparent: true, side: THREE.DoubleSide, depthWrite: false });
const NET = new THREE.MeshBasicMaterial({ map: gridTex(10, 4, 'rgba(230,226,215,0.75)'), transparent: true, side: THREE.DoubleSide, depthWrite: false });
const FRAMES = [0xd2232a, 0x1f4fbf, 0x16181d, 0xf4f1e6, 0xff8a1f].map((c) => std(c, { roughness: 0.35, metalness: 0.2 }));
const COURTS = [0x2e5aa8, 0x3f7a4a, 0xb5583a].map((c) => std(c, { roughness: 0.9 }));
const CANS = [0xd2232a, 0xf4f1e6, 0x1f4fbf].map((c) => std(c, { roughness: 0.3, metalness: 0.5 }));

const ballSeam = (() => {
  // The classic two-lobe seam on a unit sphere.
  const pts = [];
  for (let i = 0; i <= 96; i += 1) {
    const t = (i / 96) * TAU;
    pts.push(new THREE.Vector3(Math.cos(t) + 0.45 * Math.cos(3 * t), Math.sin(t) - 0.45 * Math.sin(3 * t), 1.1 * Math.sin(2 * t)).normalize().multiplyScalar(1.01));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.045, 5, true);
})();
const SPHERE = new THREE.SphereGeometry(1, 20, 14);

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const rod = (r, len, mat, x, y, z, rz = 0) => { const m = mesh(new THREE.CylinderGeometry(r, r, len, 10), mat, x, y, z); m.rotation.z = rz; return m; };

function tennisBall() {
  const g = new THREE.Group();
  const b = mesh(SPHERE, FELT); const s = mesh(ballSeam, SEAM);
  g.add(b, s);
  g.scale.setScalar(0.075);
  return g;
}

function racket(r, broken) {
  const g = new THREE.Group();
  const frame = FRAMES[Math.floor(r() * FRAMES.length)];
  const head = mesh(new THREE.TorusGeometry(0.17, 0.016, 8, 44, broken ? TAU * 0.74 : TAU), frame, 0, 0.44, 0);
  head.scale.set(1, 1.32, 1);
  if (broken) head.rotation.z = 2.2; // the gap where the frame cracked
  g.add(head);
  if (!broken) {
    const strings = mesh(new THREE.PlaneGeometry(0.32, 0.43), STRINGS, 0, 0.44, 0);
    g.add(strings);
  } else {
    // Snapped strings hanging out of the crack.
    for (let i = 0; i < 4; i += 1) g.add(rod(0.003, 0.16 + r() * 0.12, WHITE, 0.08 + i * 0.03, 0.3 - i * 0.02, 0.01, 0.4 + r() * 0.6));
  }
  g.add(rod(0.012, 0.15, frame, -0.045, 0.2, 0, -0.38), rod(0.012, 0.15, frame, 0.045, 0.2, 0, 0.38));
  // Shaft and grip; on a broken one the handle is bent off at the throat.
  const handle = new THREE.Group();
  handle.add(rod(0.016, 0.1, frame, 0, -0.05, 0), rod(0.023, 0.24, r() < 0.5 ? INK : WHITE, 0, -0.22, 0));
  handle.position.y = 0.13;
  if (broken) handle.rotation.z = 0.9 + r() * 0.5;
  g.add(handle);
  return g;
}

function umpireChair() {
  const g = new THREE.Group();
  const w = 0.36; const d = 0.3;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(box(0.03, 1.0, 0.03, WOOD, x * 1.15, 0, z * 1.15));
  for (let i = 0; i < 4; i += 1) g.add(box(w, 0.025, 0.025, WOOD, 0, -0.36 + i * 0.22, d / 2 * 1.12)); // ladder
  g.add(box(w + 0.06, 0.04, d + 0.04, WHITE, 0, 0.52, 0)); // seat
  g.add(box(w + 0.06, 0.26, 0.03, WOOD, 0, 0.68, -d / 2 - 0.02)); // back
  g.add(box(0.03, 0.12, d, WOOD, -w / 2 - 0.03, 0.6, 0), box(0.03, 0.12, d, WOOD, w / 2 + 0.03, 0.6, 0)); // arms
  g.add(box(w + 0.06, 0.03, 0.12, WOOD, 0, 0.14, d / 2 + 0.06)); // footrest
  g.scale.setScalar(0.8);
  return g;
}

function courtChunk(r) {
  const g = new THREE.Group();
  const surface = COURTS[Math.floor(r() * COURTS.length)];
  const w = 0.6 + r() * 0.5; const d = 0.35 + r() * 0.3;
  g.add(box(w, 0.05, d, surface, 0, 0, 0));
  g.add(box(w, 0.056, 0.035, WHITE, 0, 0, d * (r() - 0.5) * 0.6)); // a line across it
  if (r() < 0.6) g.add(box(0.035, 0.056, d, WHITE, w * (r() - 0.5) * 0.6, 0, 0)); // and a T
  return g;
}

const courtLine = (r) => box(0.9 + r() * 0.9, 0.02, 0.045, WHITE, 0, 0, 0);

function netScrap(r) {
  const g = new THREE.Group();
  const w = 0.7 + r() * 0.4;
  g.add(mesh(new THREE.PlaneGeometry(w, 0.38), NET, 0, 0, 0));
  g.add(box(w, 0.045, 0.012, WHITE, 0, 0.2, 0));
  return g;
}

function ballCan(r) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 16), CANS[Math.floor(r() * CANS.length)], 0, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 16), std(0xf4f1e6, { roughness: 0.4 }), 0, 0.14, 0));
  return g;
}

const SCORES = ['LOVE', '15', '30', '40', 'DEUCE', 'AD'];
const scoreMats = SCORES.map((s) => new THREE.MeshBasicMaterial({
  map: canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e0a35a'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#efe3cf'; g.font = `800 ${s.length > 3 ? 54 : 74}px -apple-system, Helvetica, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, w / 2, h / 2 + 4);
  }),
}));
function scoreTile(r) {
  const g = new THREE.Group();
  const mat = scoreMats[Math.floor(r() * scoreMats.length)];
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.25, 0.04), [INK, INK, INK, INK, mat, mat], 0, 0, 0));
  return g;
}

// How often each kind turns up.
const KINDS = [
  [tennisBall, 30], [(r) => racket(r, false), 13], [(r) => racket(r, true), 12], [umpireChair, 5], [courtChunk, 8],
  [courtLine, 10], [netScrap, 7], [ballCan, 7], [scoreTile, 8],
];
const TOTAL = KINDS.reduce((s, [, w]) => s + w, 0);

export class Debris {
  constructor(scene, { count = 26, halfW, halfH, rng }) {
    this.r = rng;
    this.halfW = halfW; this.halfH = halfH;
    this.items = [];
    for (let i = 0; i < count; i += 1) {
      let pick = this.r() * TOTAL;
      const [make] = KINDS.find(([, w]) => (pick -= w) < 0) || KINDS[0];
      const obj = make(this.r);
      const it = { obj, vel: new THREE.Vector3(), kick: new THREE.Vector3(), axis: new THREE.Vector3(), w: 0, spin: 0 };
      this.respawn(it, 4.5 - this.r() * 32); // the first stream is already in flight
      scene.add(obj);
      this.items.push(it);
    }
  }

  respawn(it, z) {
    const r = this.r;
    let x = (r() * 2 - 1) * (this.halfW - 0.35);
    let y = (r() * 2 - 1) * (this.halfH - 0.35);
    // Keep the camera's own lane clear so nothing flies straight through the lens.
    if (Math.abs(x) < 0.45 && Math.abs(y) < 0.6) { x += Math.sign(x || 1) * 0.6; y += Math.sign(y || 1) * 0.4; }
    it.obj.position.set(x, y, z);
    it.obj.quaternion.setFromEuler(new THREE.Euler(r() * TAU, r() * TAU, r() * TAU));
    it.vel.set((r() - 0.5) * 0.08, (r() - 0.5) * 0.08, 0.5 + r() * 1.0);
    it.kick.set(0, 0, 0);
    it.axis.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    it.w = 0.2 + r() * 0.7;
    it.spin = 0;
  }

  update(dt, camZ, still) {
    const q = new THREE.Quaternion();
    for (const it of this.items) {
      const ease = Math.exp(-0.8 * dt);
      it.kick.multiplyScalar(ease);
      it.spin *= ease;
      const drift = still ? 0.15 : 1;
      it.obj.position.addScaledVector(it.vel, dt * drift).addScaledVector(it.kick, dt);
      q.setFromAxisAngle(it.axis, (it.w * drift + it.spin) * dt);
      it.obj.quaternion.premultiply(q);
      // Walls are walls: knocked pieces bounce off them.
      const p = it.obj.position;
      if (Math.abs(p.x) > this.halfW - 0.2) { p.x = Math.sign(p.x) * (this.halfW - 0.2); it.kick.x *= -0.6; }
      if (Math.abs(p.y) > this.halfH - 0.2) { p.y = Math.sign(p.y) * (this.halfH - 0.2); it.kick.y *= -0.6; }
      if (p.z > camZ + 0.6) this.respawn(it, camZ - 26 - this.r() * 6);
      else if (p.z < camZ - 40) this.respawn(it, camZ - 26 - this.r() * 6);
    }
  }

  /** Knocks the first piece the ray hits. Returns true if it hit one. */
  knock(raycaster) {
    const hits = raycaster.intersectObjects(this.items.map((it) => it.obj), true);
    if (!hits.length) return false;
    let o = hits[0].object;
    while (o.parent && !this.items.some((it) => it.obj === o)) o = o.parent;
    const it = this.items.find((x) => x.obj === o);
    if (!it) return false;
    it.kick.copy(raycaster.ray.direction).multiplyScalar(4);
    it.axis.set(this.r() - 0.5, this.r() - 0.5, this.r() - 0.5).normalize();
    it.spin = 7;
    return true;
  }
}
