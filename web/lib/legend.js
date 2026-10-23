// The tennis legend: the gloating spirit from the gear page (web/domain.js), built here so other pages can show the same
// character. Seventies hair under a red headband, a white polo with the collar popped, red wristbands, arms on joints, no legs:
// he trails off in a wisp. An archetype, not anyone real.
//
// Pages pass their own ink kit (toon materials and the ink outline), so he is shaded like the rest of their scene. `inkKit()`
// makes one for a page that has none.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const INK = 0x16181d;
export const CLAY = 0xe2562f;
const TAU = Math.PI * 2;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Manga shading: three flat tones, and an ink line round everything. */
export function inkKit() {
  const tones = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  tones.minFilter = tones.magFilter = THREE.NearestFilter;
  tones.needsUpdate = true;
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: tones, ...extra });
  const lineMat = (thick) => new THREE.ShaderMaterial({
    uniforms: { thick: { value: thick }, color: { value: new THREE.Color(INK) } },
    vertexShader: 'uniform float thick; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thick, 1.0); }',
    fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }',
    side: THREE.BackSide,
  });
  const LINE = { thin: lineMat(0.012), mid: lineMat(0.02), fat: lineMat(0.035) };
  const inked = (mesh, line = LINE.thin) => {
    const hull = new THREE.Mesh(mesh.geometry, line);
    hull.raycast = () => {};
    mesh.add(hull);
    return mesh;
  };
  return { tones, toon, LINE, inked };
}

/**
 * Builds his figure in his own units (shoulders at x = +-0.56, y = 0.86; head at 1.42; wisp tip near -1.1). Returns the group and
 * the parts a page animates: head, brows, smirk, grin, torso, the two posable arms, and an invisible hit box.
 */
export function buildLegend({ toon, inked, LINE, pickMat = new THREE.MeshBasicMaterial({ visible: false }) }) {
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
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.9, 0.9), pickMat);
  hit.position.y = 0.55;
  L.add(hit);
  return { L, head, brows, smirk, grin, torso, arms, hit };
}

// Where the elbows and hands go for each pose (his own units).
export const POSE = {
  crossed: { L: [V(-0.5, 0.36, 0.28), V(0.3, 0.5, 0.42)], R: [V(0.5, 0.4, 0.32), V(-0.3, 0.57, 0.48)] },
  kiss: { L: [V(-0.66, 0.44, 0.08), V(-0.45, 0.16, 0.24)], R: [V(0.46, 0.72, 0.5), V(0.1, 1.2, 0.5)] },
  sign: { L: [V(-0.46, 0.58, 0.38), V(-0.05, 1.16, 0.56)], R: [V(0.46, 0.58, 0.38), V(0.05, 1.16, 0.56)] },
  wide: { L: [V(-0.98, 1.05, 0.12), V(-1.32, 1.55, 0.25)], R: [V(0.98, 1.05, 0.12), V(1.32, 1.55, 0.25)] },
  // Reaching behind his back, and holding it up at you with the other hand on his hip.
  behind: { L: [V(-0.5, 0.36, 0.28), V(0.3, 0.5, 0.42)], R: [V(0.72, 0.52, -0.22), V(0.42, 0.5, -0.55)] },
  present: { L: [V(-0.66, 0.44, 0.08), V(-0.45, 0.16, 0.24)], R: [V(0.86, 0.42, 0.34), V(0.92, 0.56, 0.66)] },
};
export const placeBone = (m, a, b) => {
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  m.scale.set(1, a.distanceTo(b), 1);
};
export const smooth = (x) => { const k = THREE.MathUtils.clamp(x, 0, 1); return k * k * (3 - 2 * k); };

/** Puts both arms partway (k) from one pose to another. */
export function setArms(arms, from, to, k) {
  for (const a of arms) {
    const side = a.sx < 0 ? 'L' : 'R';
    const A = POSE[from][side]; const B = POSE[to][side];
    const elbow = A[0].clone().lerp(B[0], k); const hand = A[1].clone().lerp(B[1], k);
    placeBone(a.upper, a.shoulder, elbow);
    placeBone(a.fore, elbow, hand);
    a.elbow.position.copy(elbow);
    a.cuff.position.copy(a.shoulder.clone().lerp(elbow, 0.85));
    a.hand.position.copy(hand);
    a.band.position.copy(elbow.clone().lerp(hand, 0.78));
    a.band.quaternion.copy(a.fore.quaternion);
    a.finger.visible = false;
  }
}

// ---------- Racket heads ----------
export function headPts(kind, a, b, n = 160) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const th = Math.PI / 2 + (i / n) * TAU;
    const c = Math.cos(th); const sn = Math.sin(th);
    // Squarer at the top shoulders for iso, rounder toward the throat.
    const e = kind === 'iso' ? (sn < 0 ? 2 / 3.4 : 2 / 2.3) : 1;
    pts.push([a * Math.sign(c) * Math.abs(c) ** e, b * Math.sign(sn) * Math.abs(sn) ** e]);
  }
  return pts;
}
const headGeo = {};
export function headGeos(kind) {
  if (headGeo[kind]) return headGeo[kind];
  const ring = headPts(kind, 0.33, 0.43);
  const curve = new THREE.CatmullRomCurve3(ring.map(([x, y]) => new THREE.Vector3(x, y, 0)), true);
  const frame = new THREE.TubeGeometry(curve, 160, 0.034, 10, true);
  const unit = headPts(kind, 1, 1, 64);
  const bed = new THREE.ShapeGeometry(new THREE.Shape(unit.map(([x, y]) => new THREE.Vector2(x, y))));
  const uv = bed.attributes.uv; const pos = bed.attributes.position;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, (pos.getX(i) + 1) / 2, (pos.getY(i) + 1) / 2);
  headGeo[kind] = { frame, bed };
  return headGeo[kind];
}
