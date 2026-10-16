// The match: a flip scoreboard zip-tied to the chain-link at a public court, the kind you flip at changeovers. Both fighters stand
// in front of it as their jelly bodies (web/jelly-core.js). The court's sign hangs above. Same paper, ink and clay as home.
//
// Plates are real compound pendulums on a rod, not canned flips. Each plate hangs from the rod at the top of its row's panel:
// phi = 0 hangs straight down in front, pi points straight up, 2 pi hangs down behind. The panel stops it on either side. Each plate's
// ring has slack, so it rides one plate-thickness further out than the one under it and slides across the rod as it goes over.
//
// Motion spec. Everything integrates at 1/120 s.
// - Plate: phi'' = -(3g / 2h) sin(phi) - 2 zeta w phi', h 0.6, g 9.8, so w^2 = 24.5 (a 1.27 s swing), zeta 0.04.
//   Hitting the panel or the stack: restitution 0.3, a clack scaled by speed. Below 0.6 rad/s it just settles.
// - Swipe up on a cell: the front plate's bottom edge follows your finger on a 12 Hz, ratio 1 spring. Carry it past the rod and
//   it is committed: it goes over and drops behind, and the number under it shows. Swipe down: the back plate comes up over the top
//   and drops in front, taking the game back. Tap: a 12.8 rad/s kick, enough to clear the top with a short hang. One plate flies per cell at a
//   time; quick taps queue.
// - The last plate in a set (7) is riveted: a flip there only rattles the stack.
// - Breeze: every 4 to 7 s a gust runs left to right across the boards, lifting the outer plates 0.4 to 0.9 rad/s, 70 ms apart.
// - A new set: its plates drop onto the rod from 1.3 above on a 2.6 Hz, ratio 0.45 spring and clack once.
// - A set won: a clay ring is drawn round the winner's number in 360 ms on the enter curve (0.16, 1, 0.3, 1). Their jelly hops.
// - Match point settled: the winner's name plate spins once (1.8 Hz, ratio 0.5), the winner jumps twice, the loser slumps,
//   and the slide strip comes up to seal it.
// - The court sign hangs from one S-hook and swings on a 1.1 Hz pendulum, ratio 0.08. Tap it to change the court.
// - Camera: 30 degree lens, 7 degrees above, never parked: 0.6 degree yaw on a 9 s sine.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { MTB_MAX, SET_MAX, matchState } from '../src/lib/tennis.ts';
import { ENTER, SoftBody } from './jelly-core.js';
import { post } from './lib/bridge.js';
import { createSlide } from './lib/slide.js';
import { spring } from './lib/spring.js';

const PAPER = 0xefece5;
const INK = '#16181d';
const CREAM = '#fffdf0';
const CLAY = '#e2562f';
const rad = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const DT = 1 / 120;

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(PAPER, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.5));
const sun = new THREE.DirectionalLight(0xfff4e4, 1.7);
sun.position.set(-3, 8, 7);
scene.add(sun);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });
const rbox = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material);
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const tex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const MONO = (px, w = 800) => `${w} ${px}px ui-monospace, "SF Mono", Menlo, monospace`;
const HEAVY = (px) => `italic 900 ${px}px -apple-system, "Helvetica Neue", Helvetica, sans-serif`;
const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

// ---------- Layout (world units; the ground is y = 0, the fence is z = -0.45) ----------
const PW = 0.5; // plate width
const PH = 0.6; // plate height, hinge to bottom edge
const PANEL_T = 0.05;
const CELL_X = [0.14, 0.75, 1.36];
const NAME_X = -0.98;
const NAME_W = 1.36;
const PANEL_X0 = -1.74;
const PANEL_X1 = 1.7;
const ROD_Y = [4.05, 3.0];
const SIGN_Y = 5.58; // the S-hook
const W2 = (3 * 9.8) / (2 * PH);
const ZETA = 0.04;
const FLICK = 12.8;

// ---------- The fence ----------
const linkTex = tex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.lineCap = 'round';
  // Wire, then a thin highlight on its upper edge so the weave reads as round steel.
  for (const [col, lw, dy] of [['#4d564f', 7, 0], ['#9aa49b', 2, -2]]) {
    g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath();
    g.moveTo(0, h / 2 + dy); g.lineTo(w / 2, dy); g.lineTo(w, h / 2 + dy); g.lineTo(w / 2, h + dy); g.closePath();
    g.stroke();
  }
});
linkTex.wrapS = linkTex.wrapT = THREE.RepeatWrapping;
linkTex.repeat.set(12 / 0.32, 9 / 0.32);
const fence = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), new THREE.MeshStandardMaterial({ map: linkTex, transparent: true, alphaTest: 0.35, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }));
fence.position.set(0, 4.5 - 0.02, -0.45);
scene.add(fence);
const pipe = mat(0x8e968f, { roughness: 0.35, metalness: 0.7 });
for (const x of [-2.12, 2.12]) scene.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 9, 16), pipe), x, 4.5, -0.4));
const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 12, 12), pipe);
rail.rotation.z = Math.PI / 2;
scene.add(at(rail, 0, 6.3, -0.4));

// The court floor in front of the fence, and the baseline you stand behind.
const floorMat = mat(0x3f8f5a, { roughness: 0.95 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, 3.4);
scene.add(floor);
const baseline = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.09), new THREE.MeshBasicMaterial({ color: 0xf6f3ea }));
baseline.rotation.x = -Math.PI / 2;
baseline.position.set(0, 0.002, 2.25);
scene.add(baseline);

const blobTex = tex(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, 'rgba(20,24,20,0.55)'); r.addColorStop(0.5, 'rgba(20,24,20,0.2)'); r.addColorStop(1, 'rgba(20,24,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
const blob = (sx, sz, opacity) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(sx, sz, 1);
  return m;
};

// ---------- The board ----------
const steel = mat(0x23272e, { roughness: 0.55, metalness: 0.35 });
const board = new THREE.Group();
scene.add(board);
// Two brackets zip-tied to the fence carry both rows.
for (const x of [PANEL_X0 + 0.08, PANEL_X1 - 0.08]) {
  board.add(at(rbox(0.07, ROD_Y[0] - ROD_Y[1] + PH + 0.5, 0.05, 0.015, steel), x, (ROD_Y[0] + ROD_Y[1] - PH) / 2 + 0.1, -0.3));
  for (const y of [ROD_Y[0] + 0.12, ROD_Y[1] - PH + 0.05]) board.add(at(rbox(0.12, 0.035, 0.12, 0.01, mat(0x16181d)), x, y, -0.36));
}

// The header across the top: which column is which set.
const headTex = tex(1024, 64, (g, w, h) => {
  g.fillStyle = INK; g.fillRect(0, 0, w, h);
  g.fillStyle = CREAM; g.font = MONO(30); g.textBaseline = 'middle';
  const u = (x) => ((x - PANEL_X0) / (PANEL_X1 - PANEL_X0)) * w;
  g.fillText('PLAYERS', u(PANEL_X0 + 0.12), h / 2 + 2);
  g.textAlign = 'center';
  CELL_X.forEach((x, i) => g.fillText(`SET ${i + 1}`, u(x), h / 2 + 2));
});
const header = rbox(PANEL_X1 - PANEL_X0, 0.17, 0.05, 0.02, [steel, steel, steel, steel, new THREE.MeshStandardMaterial({ map: headTex, roughness: 0.6 }), steel]);
header.position.set((PANEL_X0 + PANEL_X1) / 2, ROD_Y[0] + 0.24, -0.02);
board.add(header);

/** The row's panel: ink steel, with the column numbers stenciled where no plates hang yet. */
const panelTex = tex(1024, 192, (g, w, h) => {
  g.fillStyle = '#23272e'; g.fillRect(0, 0, w, h);
  const u = (x) => ((x - PANEL_X0) / (PANEL_X1 - PANEL_X0)) * w;
  g.strokeStyle = 'rgba(239,236,229,.16)'; g.lineWidth = 3; g.setLineDash([10, 8]);
  CELL_X.forEach((x) => { roundRect(g, u(x - PW / 2) + 4, 12, u(x + PW / 2) - u(x - PW / 2) - 8, h - 24, 10); g.stroke(); });
  g.setLineDash([]);
  g.fillStyle = 'rgba(239,236,229,.14)'; g.font = HEAVY(96); g.textAlign = 'center'; g.textBaseline = 'middle';
  CELL_X.forEach((x, i) => g.fillText(String(i + 1), u(x), h / 2 + 4));
});
const panelFront = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.6, metalness: 0.2 });
const rodMat = mat(0xc9ccd2, { roughness: 0.25, metalness: 0.85 });
for (const y of ROD_Y) {
  board.add(at(rbox(PANEL_X1 - PANEL_X0, PH + 0.06, PANEL_T, 0.015, [steel, steel, steel, steel, panelFront, steel]), (PANEL_X0 + PANEL_X1) / 2, y - PH / 2 - 0.02, 0));
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, PANEL_X1 - PANEL_X0 + 0.1, 14), rodMat);
  rod.rotation.z = Math.PI / 2;
  board.add(at(rod, (PANEL_X0 + PANEL_X1) / 2, y, 0));
  // Rings round the rod at each cell: the plates hang off these.
  for (const x of CELL_X) for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), rodMat);
    ring.rotation.y = Math.PI / 2;
    board.add(at(ring, x + s * 0.15, y - 0.02, 0));
  }
}

// ---------- Plates ----------
const geoCache = new Map();
const plateGeom = (t) => {
  if (!geoCache.has(t)) {
    const g = new RoundedBoxGeometry(PW, PH - 0.05, t, 2, Math.min(0.03, t / 2 - 0.0005));
    g.translate(0, -(PH - 0.05) / 2 - 0.05, 0); // hinge at the origin, plate hanging below it
    geoCache.set(t, g);
  }
  return geoCache.get(t);
};
const texCache = new Map();
function numberTex(n, color) {
  const k = `${n}|${color}`;
  if (!texCache.has(k)) {
    texCache.set(k, tex(200, 236, (g, w, h) => {
      g.fillStyle = CREAM; g.fillRect(0, 0, w, h);
      // Two punched holes at the top for the rings.
      g.fillStyle = '#2b2f37';
      for (const x of [w * 0.2, w * 0.8]) { g.beginPath(); g.arc(x, 13, 7, 0, TAU); g.fill(); }
      g.fillStyle = color; g.fillRect(0, h - 26, w, 26);
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(0, h - 26); g.lineTo(w, h - 26); g.stroke();
      g.fillStyle = INK; g.font = HEAVY(n >= 10 ? 128 : 168); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(n), w / 2 - 4, h / 2 + 2);
    }));
  }
  return texCache.get(k);
}
const backTex = tex(200, 236, (g, w, h) => {
  g.fillStyle = '#2b2f37'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(239,236,229,.5)'; g.font = MONO(20); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LOBS', w / 2, h / 2 - 12); g.fillText('OF LOVE', w / 2, h / 2 + 14);
});
const edgeMat = mat(0xe9e4d8, { roughness: 0.5 });
const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.55 });

/** A clay pen ring drawn round a number when that row takes the set. `p` runs 0 to 1 as it is drawn. */
function ringTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 300;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, t, drawn: -1 };
}
function drawRing(r, p) {
  if (Math.abs(r.drawn - p) < 0.004) return;
  r.drawn = p;
  const g = r.c.getContext('2d');
  g.clearRect(0, 0, r.c.width, r.c.height);
  if (p <= 0) { r.t.needsUpdate = true; return; }
  g.strokeStyle = CLAY; g.lineWidth = 15; g.lineCap = 'round';
  g.beginPath();
  // A hand ring: starts upper right, goes round once and overshoots a little, slightly tilted.
  const a0 = -0.9; const sweep = TAU * 1.12 * p;
  for (let k = 0; k <= 60; k += 1) {
    const a = a0 - (sweep * k) / 60;
    const wob = 1 + 0.035 * Math.sin(a * 3 + 1);
    const x = 128 + Math.cos(a) * 104 * wob + Math.sin(a) * 6;
    const y = 146 + Math.sin(a) * 128 * wob;
    if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  r.t.needsUpdate = true;
}

const cells = []; // cells[row][col]
let mtb = false;
let players = [{ name: 'YOU', color: '#d7f205', cast: 'wall' }, { name: 'THEM', color: '#ff3d7f', cast: 'moon' }];

// Where a plate stops on each side (a hair off vertical, fanning out with the stack), and how far out its ring rides.
function frontRest(c, i) { return 0.03 + 0.15 * c.pt * (c.max - i); }
function backRest(c, i) { return TAU - 0.03 - 0.15 * c.pt * i; }
const frontZ = (c, i) => PANEL_T / 2 + c.pt * (0.5 + (c.max - i));
const backZ = (c, i) => -(PANEL_T / 2 + c.pt * (0.5 + i));
/** The ring slides across the rod while the plate is high: front side below 0.35 pi, back side past 1.65 pi. */
function ringZ(c, p) {
  const u = clamp((p.phi - 0.35 * Math.PI) / (1.3 * Math.PI), 0, 1);
  const k = u * u * (3 - 2 * u);
  return frontZ(c, p.i) + (backZ(c, p.i) - frontZ(c, p.i)) * k;
}

/** (Re)hang a cell's plates for this many games, numbered 0..max, showing `v`. */
function buildCell(row, col, v) {
  const old = cells[row]?.[col];
  if (old) { board.remove(old.group); }
  const max = col === 2 && mtb ? MTB_MAX : SET_MAX;
  const pt = max > SET_MAX ? 0.007 : 0.013;
  const group = new THREE.Group();
  group.position.set(CELL_X[col], ROD_Y[row], 0);
  const c = { row, col, max, pt, group, plates: [], queue: 0, held: null, drop: old ? old.drop : { x: 0, v: 0 }, shown: old ? old.shown : false, ring: old ? old.ring : null, ringP: old ? old.ringP : 0, ringOn: old ? old.ringOn : false, rattle: 0 };
  const geo = plateGeom(pt);
  for (let i = 0; i <= max; i += 1) {
    const front = new THREE.MeshStandardMaterial({ map: numberTex(i, players[row].color), roughness: 0.5 });
    const m = new THREE.Mesh(geo, [edgeMat, edgeMat, edgeMat, edgeMat, front, backMat]);
    const p = { i, m, phi: 0, w: 0 };
    p.phi = i < v ? backRest(c, i) : frontRest(c, i);
    m.rotation.x = -p.phi;
    m.position.z = ringZ(c, p);
    group.add(m);
    c.plates.push(p);
  }
  if (!c.ring) {
    c.ring = ringTex();
    c.ringMesh = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.18, PH * 1.1), new THREE.MeshBasicMaterial({ map: c.ring.t, transparent: true, depthWrite: false }));
  } else c.ringMesh = old.ringMesh;
  c.ringMesh.position.set(0, -PH / 2 - 0.02, 0.2);
  group.add(c.ringMesh);
  group.visible = c.shown;
  board.add(group);
  cells[row] = cells[row] || [];
  cells[row][col] = c;
  return c;
}

/** Games in a cell: how many plates have gone over. */
const valueOf = (c) => c.plates.reduce((n, p) => n + (p.phi > Math.PI ? 1 : 0), 0);
const flying = (c) => c.plates.some((p) => p.flying);

function stepPlate(c, p, dt) {
  const lo = frontRest(c, p.i);
  const hi = backRest(c, p.i);
  if (c.held && c.held.p === p) {
    const w = 12 * TAU;
    p.w += (-w * w * (p.phi - c.held.target) - 2 * w * p.w) * dt;
  } else {
    p.w += (-W2 * Math.sin(p.phi) - 2 * ZETA * Math.sqrt(W2) * p.w) * dt;
  }
  p.phi += p.w * dt;
  if (p.phi < lo) {
    p.phi = lo;
    if (p.w < -0.6) { post({ type: 'clack', v: Math.min(1, -p.w / 9) }); p.w = -p.w * 0.3; } else p.w = Math.max(0, p.w);
  } else if (p.phi > hi) {
    p.phi = hi;
    if (p.w > 0.6) { post({ type: 'clack', v: Math.min(1, p.w / 9) }); p.w = -p.w * 0.3; } else p.w = Math.min(0, p.w);
  }
  const resting = (Math.abs(p.phi - lo) < 1e-3 || Math.abs(p.phi - hi) < 1e-3) && Math.abs(p.w) < 0.05;
  p.flying = !(resting && !(c.held && c.held.p === p));
  p.m.rotation.x = -p.phi;
  p.m.position.z = ringZ(c, p);
}

/** The plate a flip up would take (the front one) or a flip down would bring back (the outer back one). */
const outerFront = (c) => c.plates.find((p) => p.phi < Math.PI);
const outerBack = (c) => [...c.plates].reverse().find((p) => p.phi > Math.PI);

function launch(c, dir) {
  if (dir > 0) {
    const p = outerFront(c);
    if (!p || p.i >= c.max) { c.rattle = 0.25; post({ type: 'stuck' }); return; }
    p.w = FLICK;
  } else {
    const p = outerBack(c);
    if (!p) return;
    p.w = -FLICK;
  }
  post({ type: 'lift' });
}

// ---------- Name plates ----------
function nameTex(f) {
  return tex(512, 216, (g, w, h) => {
    g.fillStyle = f.color; roundRect(g, 6, 6, w - 12, h - 12, 22); g.fill();
    g.strokeStyle = INK; g.lineWidth = 9; g.stroke();
    g.fillStyle = INK;
    for (const x of [30, w - 30]) { g.beginPath(); g.arc(x, h / 2, 8, 0, TAU); g.fill(); }
    let px = 92;
    g.font = HEAVY(px);
    const label = f.name.toUpperCase();
    while (g.measureText(label).width > w - 96 && px > 30) { px -= 4; g.font = HEAVY(px); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, w / 2, h / 2 + 4);
  });
}
const names = ROD_Y.map((y) => {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.45 });
  const plate = rbox(NAME_W, PH * 0.62, 0.035, 0.03, [edgeMat, edgeMat, edgeMat, edgeMat, m, edgeMat]);
  const pivot = new THREE.Group();
  pivot.position.set(NAME_X, y - PH / 2 - 0.02, 0.05);
  pivot.add(plate);
  board.add(pivot);
  return { pivot, m, spin: { x: 0, v: 0 }, target: 0 };
});
// Sets won, as tennis balls in a little cup on each name plate's right.
const ballMat = new THREE.MeshStandardMaterial({ color: 0xd7f205, roughness: 0.75 });
const tally = ROD_Y.map((y) => [0, 1].map((k) => {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), ballMat);
  b.position.set(NAME_X + NAME_W / 2 - 0.12 - k * 0.2, y - PH + 0.03, 0.14);
  b.scale.setScalar(0.001);
  board.add(b);
  return { m: b, s: { x: 0, v: 0 } };
}));

// ---------- The tiebreak tag (one set all: third set or a breaker to 10) ----------
const tagTex = tex(256, 300, (g, w, h) => {
  const side = (x0, top, bottom, ink) => {
    g.fillStyle = ink ? INK : CREAM; roundRect(g, x0 + 6, 6, w / 2 - 12, h - 12, 16); g.fill();
    g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
    g.fillStyle = ink ? CREAM : INK; g.textAlign = 'center';
    g.font = MONO(24); g.fillText(top, x0 + w / 4, h * 0.36);
    g.font = MONO(15); g.fillText(bottom, x0 + w / 4, h * 0.6);
    g.fillText('tap to flip', x0 + w / 4, h * 0.8);
  };
  side(0, 'SET 3', 'full set', false);
  side(w / 2, 'TO 10', 'breaker', true);
});
const tagFront = tagTex.clone(); tagFront.repeat.set(0.5, 1); tagFront.needsUpdate = true;
const tagBack = tagTex.clone(); tagBack.repeat.set(0.5, 1); tagBack.offset.set(0.5, 0); tagBack.needsUpdate = true;
const tag = new THREE.Group();
const tagCard = rbox(0.42, 0.5, 0.02, 0.012, [edgeMat, edgeMat, edgeMat, edgeMat, new THREE.MeshStandardMaterial({ map: tagFront, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: tagBack, roughness: 0.6 })]);
tagCard.position.y = -0.33;
tag.add(tagCard);
const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), rodMat);
chain.position.y = -0.04;
tag.add(chain);
tag.position.set(CELL_X[2], ROD_Y[1] - PH - 0.04, 0.06);
tag.visible = false;
board.add(tag);
const tagSpin = { x: 0, v: 0 };
const tagSwing = { x: 0, v: 0 };

// ---------- The court sign ----------
let court = null;
const signMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
function paintSign() {
  signMat.map?.dispose();
  signMat.map = tex(640, 168, (g, w, h) => {
    g.fillStyle = court ? CREAM : CLAY; roundRect(g, 6, 6, w - 12, h - 12, 18); g.fill();
    g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    const top = court ? court.name.toUpperCase() : 'WHICH COURT?';
    let px = 50; g.font = MONO(px);
    while (g.measureText(top).width > w - 60 && px > 22) { px -= 2; g.font = MONO(px); }
    g.fillText(top, w / 2, h * 0.42);
    g.font = MONO(22, 700); g.globalAlpha = 0.65;
    g.fillText(court ? `${court.area ? `${court.area.toUpperCase()} · ` : ''}TAP TO CHANGE` : 'TAP TO PICK WHERE YOU PLAYED', w / 2, h * 0.74);
    g.globalAlpha = 1;
  });
  signMat.needsUpdate = true;
}
const sign = new THREE.Group();
sign.position.set(0.25, SIGN_Y, -0.3);
const signBoard = rbox(2.5, 0.66, 0.04, 0.03, [edgeMat, edgeMat, edgeMat, edgeMat, signMat, edgeMat]);
signBoard.position.y = -0.47;
sign.add(signBoard);
const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 18, Math.PI * 1.5), rodMat);
hook.position.y = -0.07;
sign.add(hook);
scene.add(sign);
const signSwing = { x: 0, v: 0 };
paintSign();

// ---------- The fighters ----------
const fighters = [];
function buildFighters() {
  for (const f of fighters) scene.remove(f.carrier);
  fighters.length = 0;
  players.forEach((p, i) => {
    const body = new SoftBody({ cast: p.cast, color: p.color, edge: 0.14, transmission: 0.14 });
    const size = 1.25 / body.height;
    body.group.scale.setScalar(size);
    const carrier = new THREE.Group();
    carrier.position.set(i === 0 ? -0.92 : 0.92, 0, 1.0);
    carrier.rotation.y = i === 0 ? rad(12) : rad(-12);
    carrier.add(body.group);
    carrier.add(at(blob(1.2, 0.6, 0.5), 0, 0.004, 0));
    scene.add(carrier);
    fighters.push({ body, carrier, size, slump: 0 });
  });
}

// ---------- The slide strip ----------
const slide = createSlide({ post, onSlid: () => post({ type: 'slid' }) });
const ui = { line: $('line') };

// ---------- State ----------
const st = { clock: 0, gustAt: 3, rules: null, posted: '', visible: 1, last: null };

function setsNow() { return [0, 1, 2].map((col) => [valueOf(cells[0][col]), valueOf(cells[1][col])]); }

function showColumn(col, now) {
  for (const row of [0, 1]) {
    const c = cells[row][col];
    if (c.shown) continue;
    c.shown = true;
    c.group.visible = true;
    if (now) { c.drop.x = 0; c.drop.v = 0; } else { c.drop.x = 1.3; c.drop.v = 0; c.dropping = true; }
  }
}

/** Reads the board after any plate settles: columns to hang, sets won, the match, what to say under the board. */
function judge(silent) {
  const all = setsNow();
  let shown = 0;
  for (let col = 0; col < 3; col += 1) if (cells[0][col].shown) shown = col + 1;
  const sets = all.slice(0, shown);
  const r = matchState(sets, mtb, [players[0].name, players[1].name]);
  // Hang the next set when every set so far is finished and nobody has two (a 1-0 lead still gets a second column).
  if (r.live < 0 && r.won[0] < 2 && r.won[1] < 2 && shown < 3 && !r.sets.includes('bad')) showColumn(shown, silent);
  const prev = st.rules;
  st.rules = r;
  // Rings round each set's winner.
  r.sets.forEach((s, col) => {
    for (const row of [0, 1]) {
      const on = s === (row === 0 ? 'p1' : 'p2');
      const c = cells[row][col];
      if (on && !c.ringOn) { c.ringOn = true; c.ringT = silent ? 1 : 0; if (!silent) { post({ type: 'set', side: row }); cheer(row, 1); } }
      if (!on && c.ringOn) { c.ringOn = false; }
    }
  });
  // Tally balls.
  for (const row of [0, 1]) tally[row].forEach((b, k) => { b.on = r.won[row] > k; });
  // The decider tag: one set all, before the third set has a game in it.
  const third = all[2];
  tag.visible = cells[0][2].shown && (r.needsDecider || r.live === 2 || mtb);
  tag.userData.locked = third[0] + third[1] > 0;
  if (!silent && r.sets.includes('bad') && !(prev && prev.sets.includes('bad'))) post({ type: 'bad' });
  if (r.winner !== null && (!prev || prev.winner !== r.winner)) {
    if (!silent) { post({ type: 'match', winner: r.winner }); cheer(r.winner, 2); }
    names[r.winner].target += TAU;
    fighters[1 - r.winner].slump = 1;
  }
  if (r.winner === null) for (const f of fighters) f.slump = 0;
  const line = sets.map(([a, b], i) => (mtb && i === 2 ? `[${a}-${b}]` : `${a}-${b}`)).filter((s, i) => i === 0 || all[i][0] + all[i][1] > 0).join('  ');
  slide.setKey(r.winner !== null ? 1 : 0, r.winner !== null ? 'SEAL IT' : '', r.winner !== null ? `${line} · photo next` : '');
  ui.line.textContent = r.line;
  ui.line.classList.toggle('bad', r.sets.includes('bad'));
  ui.line.classList.toggle('won', r.winner !== null);
  // Tell the app, but only when the score itself changed.
  const key = JSON.stringify([all, mtb]);
  if (key !== st.posted) {
    st.posted = key;
    let keep = 3;
    while (keep > 1 && all[keep - 1][0] + all[keep - 1][1] === 0) keep -= 1;
    post({ type: 'score', sets: all.slice(0, keep), mtb });
  }
}

/** A fighter celebrates: a hop (or two for the match) and a happy face. */
function cheer(row, hops) {
  const f = fighters[row];
  if (!f) return;
  f.body.mood.happy = hops > 1 ? 2.4 : 1.2;
  f.hops = (f.hops || 0) + hops;
  f.hopAt = 0;
}

// ---------- Input ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.05);
const toWorld = (e) => {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  ray.ray.intersectPlane(zPlane, p);
  return p;
};
function cellAt(p) {
  for (const row of [0, 1]) {
    if (p.y > ROD_Y[row] + 0.22 || p.y < ROD_Y[row] - PH - 0.15) continue;
    for (let col = 0; col < 3; col += 1) if (Math.abs(p.x - CELL_X[col]) < 0.31 && cells[row][col].shown) return cells[row][col];
  }
  return null;
}
let touch = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = toWorld(e);
  touch = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), p0: p, cell: cellAt(p), grabbed: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!touch || touch.id !== e.pointerId) return;
  const p = toWorld(e);
  const c = touch.cell;
  if (!c) return;
  const dy = p.y - touch.p0.y;
  if (!touch.grabbed && Math.abs(e.clientY - touch.y) > 8) {
    if (flying(c)) { touch.cell = null; return; }
    const plate = dy > 0 ? outerFront(c) : outerBack(c);
    if (!plate || (dy > 0 && plate.i >= c.max)) { c.rattle = 0.25; post({ type: 'stuck' }); touch.cell = null; return; }
    touch.grabbed = true;
    touch.dir = dy > 0 ? 1 : -1;
    c.held = { p: plate, target: plate.phi };
    post({ type: 'lift' });
  }
  if (!touch.grabbed) return;
  // The plate's bottom edge follows the finger. Up: it rises in front; down: the back plate rises from behind.
  const rise = Math.max(0, touch.dir * dy);
  const tip = clamp((PH - rise) / PH, -1, 1);
  let phi = Math.acos(tip);
  if (rise > PH * 1.85) phi = Math.PI + 0.35; // past the top: committed
  c.held.target = touch.dir > 0 ? Math.max(phi, frontRest(c, c.held.p.i)) : Math.min(TAU - phi, backRest(c, c.held.p.i));
});
const release = (e) => {
  if (!touch || touch.id !== e.pointerId) return;
  const c = touch.cell;
  const quick = performance.now() - touch.t < 320 && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) < 10;
  if (c && c.held) c.held = null;
  else if (c && quick) { if (flying(c)) c.queue = Math.min(3, c.queue + 1); else launch(c, 1); }
  else if (quick) tapThing(touch.p0, e);
  touch = null;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

function tapThing(p, e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([signBoard, tagCard, ...fighters.map((f) => f.body.mesh), ...names.map((n) => n.pivot)], true);
  const hit = hits[0];
  if (!hit) return;
  if (hit.object === signBoard) { signSwing.v += hit.point.x > sign.position.x ? -2.2 : 2.2; post({ type: 'court' }); return; }
  if (hit.object === tagCard) {
    if (tag.userData.locked) { tagSwing.v += 3; post({ type: 'stuck' }); return; }
    mtb = !mtb;
    for (const row of [0, 1]) buildCell(row, 2, 0);
    tagSwing.v += 2;
    post({ type: 'tb', on: mtb });
    judge(true);
    return;
  }
  const n = names.findIndex((x) => hit.object.parent === x.pivot || hit.object === x.pivot);
  if (n >= 0) { names[n].spin.v += 9; post({ type: 'poke' }); return; }
  const f = fighters.find((x) => x.body.mesh === hit.object);
  if (f) {
    f.body.group.updateMatrixWorld();
    const inv = new THREE.Matrix4().copy(f.body.group.matrixWorld).invert();
    f.body.poke(hit.point.clone().applyMatrix4(inv), ray.ray.direction.clone().transformDirection(inv), 7, 0.5);
    f.body.mood.happy = 0.9;
    post({ type: 'poke' });
  }
}

// ---------- Simulation ----------
function step(dt) {
  st.clock += dt;
  // Breeze.
  if (st.clock > st.gustAt) {
    st.gustAt = st.clock + 4 + Math.random() * 3;
    const power = 0.4 + Math.random() * 0.5;
    cells.flat().forEach((c) => { if (!c.shown || flying(c) || c.held) return; c.gust = { at: st.clock + 0.07 * (c.col + c.row * 0.5), w: power }; });
  }
  let settled = false;
  for (const c of cells.flat()) {
    if (c.gust && st.clock >= c.gust.at) { const p = outerFront(c); if (p) p.w += c.gust.w; c.gust = null; }
    if (c.rattle > 0) { c.rattle -= dt; c.plates.forEach((p, k) => { if (p.phi < Math.PI) p.w += Math.sin(st.clock * 70 + k) * 0.6; }); }
    const was = flying(c);
    for (const p of c.plates) stepPlate(c, p, dt);
    if (was && !flying(c)) settled = true;
    if (!flying(c) && !c.held && c.queue > 0) { c.queue -= 1; launch(c, 1); }
    if (c.dropping) {
      spring(c.drop, 0, dt, 2.6, 0.45);
      if (c.drop.x < 0 && c.drop.v < 0 && !c.clacked) { c.clacked = true; post({ type: 'clack', v: 0.7 }); }
      if (Math.abs(c.drop.x) < 1e-3 && Math.abs(c.drop.v) < 1e-2) { c.dropping = false; c.drop.x = 0; }
    }
    if (c.ringOn) c.ringT = Math.min(1, (c.ringT ?? 0) + dt / 0.36); else c.ringT = Math.max(0, (c.ringT ?? 0) - dt / 0.18);
  }
  // A plate crossing the top changes the score at once; settling re-reads it too.
  const now = JSON.stringify(setsNow());
  if (now !== st.last || settled) { st.last = now; judge(false); }
  for (const n of names) spring(n.spin, n.target, dt, 1.8, 0.5);
  for (const row of [0, 1]) tally[row].forEach((b) => spring(b.s, b.on ? 1 : 0, dt, 3.2, 0.45));
  spring(signSwing, 0, dt, 1.1, 0.08);
  spring(tagSpin, mtb ? Math.PI : 0, dt, 3, 0.5);
  spring(tagSwing, 0, dt, 1.6, 0.1);
  fighters.forEach((f, i) => {
    f.hopAt = (f.hopAt ?? 0) + dt;
    if (f.hops > 0 && f.hopAt > 0.18) { f.hops -= 1; f.hopAt = -0.35; f.body.kick(0, 5.5, 0); f.body.spin(i === 0 ? -2 : 2); }
    f.body.squash = THREE.MathUtils.lerp(f.body.squash, f.slump * 0.55, 1 - Math.exp(-dt * 4));
    f.body.simulate(dt, st.clock + i * 0.7);
  });
  slide.step(dt);
}

function pose() {
  for (const c of cells.flat()) {
    c.group.position.y = ROD_Y[c.row] + c.drop.x;
    drawRing(c.ring, ENTER(clamp(c.ringT ?? 0, 0, 1)));
  }
  for (const n of names) n.pivot.rotation.y = n.spin.x;
  for (const row of [0, 1]) tally[row].forEach((b) => b.m.scale.setScalar(Math.max(0.001, b.s.x)));
  sign.rotation.z = signSwing.x + 0.012 * Math.sin((st.clock * TAU) / 5.3);
  tag.rotation.y = tagSpin.x;
  tag.rotation.z = 0.08 * tagSwing.x;
  tag.rotation.x = -0.25 * Math.abs(tagSwing.x);
  const yaw = rad(0.6) * Math.sin((st.clock * TAU) / 9);
  camera.position.set(st.cam.d * Math.sin(yaw), st.cam.y + st.cam.d * Math.tan(rad(7)), st.cam.d * Math.cos(yaw));
  camera.lookAt(0, st.cam.y, 0);
  fighters.forEach((f, i) => f.body.render(st.clock + i * 0.7));
  slide.render(st.clock);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Fit the board 3.72 wide and from under the floor (where the strip sits) up past the sign.
  const half = Math.tan(rad(15));
  const top = 6.4; const bottom = -1.7;
  const d = Math.max(1.86 / (half * camera.aspect), (top - bottom) / 2 / half);
  st.cam = { d, y: (top + bottom) / 2 };
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let lastT = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  // `window.paused` (a test hook) holds the simulation so `advance` can pose exact frames.
  while (acc >= DT) { if (!window.paused) step(DT); acc -= DT; }
  pose();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- The app's calls ----------
/**
 * Set the whole board: { you: {name, color, cast}, opp: {...}, sets: [[a, b], ...], mtb, court: {name, area} | null, ground }.
 * Rebuilds plates without a sound or a cheer, so a saved match in progress comes back exactly as it was left.
 */
window.setBoard = (d) => {
  players = [d.you, d.opp];
  mtb = !!d.mtb;
  names.forEach((n, i) => { n.m.map?.dispose(); n.m.map = nameTex(players[i]); n.m.needsUpdate = true; n.spin.x = 0; n.spin.v = 0; n.target = 0; });
  if (d.ground) floorMat.color.set(d.ground);
  const sets = d.sets && d.sets.length ? d.sets : [[0, 0]];
  for (let col = 0; col < 3; col += 1) for (const row of [0, 1]) {
    const c = buildCell(row, col, (sets[col] || [0, 0])[row]);
    c.shown = col < sets.length || col === 0;
    c.group.visible = c.shown;
    c.ringOn = false; c.ringT = 0;
  }
  buildFighters();
  st.rules = null;
  st.posted = '';
  window.setCourt(d.court);
  judge(true);
  // Rings for sets already won appear drawn.
  cells.flat().forEach((c) => { if (c.ringOn) c.ringT = 1; });
};
window.setCourt = (c) => { court = c || null; paintSign(); signSwing.v += 1.2; };
/** The court surface in the venue's own color (src/lib/themes.ts). */
window.setGround = (hex) => { floorMat.color.set(hex); };
/** Test hook: flip a cell up (1) or down (-1) as a tap would. */
window.flipCell = (row, col, dir = 1) => { const c = cells[row][col]; if (flying(c)) c.queue += dir > 0 ? 1 : 0; else launch(c, dir); };
/** Test hook: step the real simulation `sec` seconds and draw. */
window.advance = (sec) => { for (let k = 0; k < sec * 120; k += 1) step(DT); pose(); renderer.render(scene, camera); };
/** Plays a set by itself, for recording: games land every 0.7 s. */
window.demoScore = () => {
  const order = [0, 1, 0, 0, 1, 0, 1, 0, 0];
  order.forEach((row, k) => setTimeout(() => window.flipCell(row, 0, 1), 1200 + k * 700));
  setTimeout(() => window.flipCell(0, 1, 1), 1200 + order.length * 700 + 1500);
};

window.setBoard({ you: players[0], opp: players[1], sets: [[0, 0]], mtb: false, court: null });
requestAnimationFrame(frame);
post({ type: 'ready' });
