// Home: a cream-paper diorama. Your fighter hops across floating tiles, one per place in the app.
// After docs/mo-design/vids/claude-bot-jumper-video.mov (mascot, tiles, lamps, checklist, one accent)
// and youtube-city-pop-bike-video.mov (record sleeve with the vinyl peeking out, waveform, title banner, dust and grain).
//
// Motion spec. Springs are damped oscillators integrated at 1/120 s.
// - Hop: 420 ms per tile. Anticipation: squash to 0.78 tall for 90 ms. Flight: a parabola 0.95 high, stretched to 1.14 tall.
//   Landing: squash to 0.72, back on a spring at 3.2 Hz, damping ratio 0.45 (playful). The tile dips 0.07 and returns at 2.6 Hz, ratio 0.5.
// - Camera: follows the mascot at 1.3 Hz, ratio 1 (no bounce on a camera), and never parks: a 0.5 degree orbit on a 9 s sine.
// - Tiles: each bobs 0.035 on its own 3.4 to 4.6 s sine. The lit tile's stripe and pad glow ease in over 240 ms.
// - Ball on the court tile bounces 0.34 high every 0.9 s. Dust: 70 motes drifting up at 0.05 to 0.12 units a second.
// - Idle mascot: breathes 2.5% on a 2.2 s sine and blinks for 110 ms every 3.1 s.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { brushUnderline } from './lib/brush.js';
import { RainbowTrail, SoftBody } from './jelly-core.js';

const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));

const INK = 0x16181d;
const PAPER = 0xefece5;
const CLAY = 0xe2562f; // the one accent
const rad = THREE.MathUtils.degToRad;
const $ = (id) => document.getElementById(id);

const PLACES = [
  { key: 'play', label: 'PLAY', head: ['PLAY A MATCH.', 'PICK YOUR OPPONENT.'], blurb: 'pick an opponent, pick a court, log the score' },
  { key: 'courts', label: 'COURTS', head: ['291 COURTS.', 'EVERY ONE A STAGE.'], blurb: 'san diego county, nearest first' },
  { key: 'standings', label: 'STANDINGS', head: ['THE TABLE.', 'WHO IS ON TOP.'], blurb: 'season points, streaks, every match' },
  { key: 'fighter', label: 'FIGHTER', head: ['YOUR FIGHTER.', 'NAME. STYLE. COLOR.'], blurb: 'change how you show up' },
  { key: 'write', label: 'WRITE', head: ['JUST WRITE IT.', 'NO FORMS.'], blurb: 'a score, a time, a restring: write it with your finger' },
  { key: 'gear', label: 'GEAR', head: ['YOUR GEAR.', 'WHAT IS WORN OUT.'], blurb: 'rackets, shoes, balls, overgrips' },
];

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(PAPER, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.55));
const sun = new THREE.DirectionalLight(0xfff4e4, 2.1);
sun.position.set(-5, 9, 4);
scene.add(sun, sun.target);

// Layout. The path climbs away from the camera in a zigzag, so a tall phone screen shows every tile at once.
const FWD = new THREE.Vector3(-1, 0, -1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const STEP = 1.95;
const spots = [0, 1, 2, 3, 4, 5, 6].map((i) => FWD.clone().multiplyScalar(i * STEP).add(RIGHT.clone().multiplyScalar(i === 0 ? 0 : (i % 2 ? 0.8 : -0.8))).setY(i === 0 ? 0 : 0.12 + 0.16 * ((i * 7) % 3)));

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
const rbox = (w, h, d, r, material) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

function edgeLabel(text, lit) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, 512, 96);
  g.fillStyle = lit ? '#e2562f' : '#16181d'; g.fillRect(0, 0, 512, 14);
  g.fillStyle = '#16181d';
  g.font = '700 40px ui-monospace, Menlo, monospace';
  g.textBaseline = 'middle';
  g.fillText(text, 26, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const TILE = 1.5;
/** Where the mascot stands on a tile: the corner nearest the camera, leaving the prop in view behind it. */
const STAND = new THREE.Vector3(0.36, 0, 0.36);
const PROP = new THREE.Vector3(-0.2, 0, -0.2);
const tiles = [];
function makeTile(i, text) {
  const g = new THREE.Group();
  const slab = rbox(TILE, 0.34, TILE, 0.05, mat(0xf4f1ea));
  slab.position.y = -0.17;
  g.add(slab);
  // Label on the two edges that face the camera.
  const faces = [edgeLabel(text, false), edgeLabel(text, true)];
  const labelMat = new THREE.MeshBasicMaterial({ map: faces[0] });
  for (const [x, z, ry] of [[0, TILE / 2 + 0.002, 0], [TILE / 2 + 0.002, 0, Math.PI / 2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(TILE - 0.12, 0.26), labelMat);
    p.position.set(x, -0.17, z);
    p.rotation.y = ry;
    g.add(p);
  }
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(TILE - 0.18, TILE - 0.18), new THREE.MeshBasicMaterial({ color: CLAY, transparent: true, opacity: 0, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.004;
  g.add(pad);
  g.userData = { i, base: spots[i].clone(), phase: i * 1.7, period: 3.4 + (i % 3) * 0.6, dip: { x: 0, v: 0 }, glow: 0, pad, labelMat, faces };
  g.traverse((o) => { o.userData.tile = i; });
  scene.add(g);
  tiles.push(g);
  return g;
}

makeTile(0, 'START');
const propGroup = (t) => { const g = new THREE.Group(); g.position.copy(PROP); t.add(g); return g; };
PLACES.forEach((p, k) => makeTile(k + 1, `0${k + 1} ${p.label}`));

// What sits on each tile.
const ball = at(new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), mat(0xd7f205, { roughness: 0.6 })), 0.3, 0.3, 0.1);
ball.castShadow = true;
{
  const tile = tiles[1];
  const t = propGroup(tile);
  t.add(at(rbox(1.24, 0.03, 0.74, 0.01, mat(0x3f8f5a)), 0, 0.016, 0));
  t.add(at(rbox(1.0, 0.012, 0.52, 0.004, mat(0x2f6fd6)), 0, 0.036, 0));
  const line = mat(0xffffff, { roughness: 0.6 });
  for (const [w, d, x, z] of [[1.0, 0.014, 0, 0.26], [1.0, 0.014, 0, -0.26], [0.014, 0.52, 0.5, 0], [0.014, 0.52, -0.5, 0], [0.5, 0.012, 0, 0], [0.012, 0.52, 0.25, 0], [0.012, 0.52, -0.25, 0]]) {
    t.add(at(new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, d), line), x, 0.045, z));
  }
  t.add(at(rbox(0.016, 0.13, 0.6, 0.004, mat(INK)), 0, 0.1, 0));
  t.add(ball);
}
{
  const tile = tiles[2];
  const t = propGroup(tile); // postcards: one per stage color
  [[0x35d6ff, -0.34, -0.1, 0.18], [0xff8a1f, 0, 0.08, -0.06], [0x9b6bff, 0.34, -0.06, 0.12]].forEach(([c, x, z, ry]) => {
    const card = at(rbox(0.36, 0.5, 0.03, 0.012, mat(c, { roughness: 0.6 })), x, 0.27, z);
    card.rotation.set(rad(-10), ry, 0);
    t.add(card);
  });
  const pin = new THREE.Group();
  pin.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), mat(CLAY, { roughness: 0.5 })), 0, 0.3, 0));
  const tip = at(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 16), mat(CLAY, { roughness: 0.5 })), 0, 0.12, 0);
  tip.rotation.x = Math.PI;
  pin.add(tip);
  pin.traverse((o) => { o.castShadow = true; });
  pin.position.set(0.02, 0, 0.42);
  t.add(pin);
  tile.userData.pin = pin;
}
{
  const tile = tiles[3];
  const t = propGroup(tile); // podium and cup
  [[0, 0.36, 0], [-0.4, 0.24, 0.02], [0.4, 0.16, 0.02]].forEach(([x, h], k) => t.add(at(rbox(0.38, h, 0.42, 0.02, mat(k === 0 ? 0xffffff : 0xe6e1d7)), x, h / 2, 0)));
  const gold = mat(0xe9b535, { roughness: 0.3, metalness: 0.7 });
  const cup = new THREE.Group();
  cup.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.16, 20), gold), 0, 0.14, 0));
  cup.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 10), gold), 0, 0.035, 0));
  cup.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 20), gold), 0, 0.005, 0));
  cup.traverse((o) => { o.castShadow = true; });
  cup.position.set(0, 0.36, 0);
  t.add(cup);
  tile.userData.cup = cup;
}
const mirrorDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 40), mat(0xd7f205, { roughness: 0.35, metalness: 0.3 }));
{
  const tile = tiles[4];
  const t = propGroup(tile); // a jewel case on a stand
  const stand = new THREE.Group();
  stand.add(rbox(0.74, 0.74, 0.07, 0.02, new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.05, clearcoat: 1 })));
  mirrorDisc.rotation.x = Math.PI / 2;
  mirrorDisc.castShadow = true;
  stand.add(mirrorDisc);
  stand.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), mat(0xf4f5f8)), 0, 0, 0.02).rotateX(Math.PI / 2));
  stand.position.set(0, 0.46, 0);
  stand.rotation.set(rad(-14), rad(24), 0);
  t.add(stand);
  tile.userData.stand = stand;
}
{
  const tile = tiles[6];
  const t = propGroup(tile); // a little locker, doors open, a racket swinging on its hook
  const steel = mat(0x262a31, { roughness: 0.55, metalness: 0.35 });
  const box = new THREE.Group();
  box.add(at(rbox(0.66, 0.9, 0.36, 0.02, steel), 0, 0.45, -0.02));
  box.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.8), mat(0xf1ebdf)), 0, 0.46, 0.161));
  for (const s of [-1, 1]) {
    const door = at(rbox(0.31, 0.88, 0.025, 0.01, steel), s * 0.43, 0.45, 0.25);
    door.rotation.y = s * rad(62);
    box.add(door);
  }
  const racket = new THREE.Group();
  const frame = mat(0x2f6fd6, { roughness: 0.35 });
  const head = at(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 8, 32), frame), 0, -0.13, 0);
  head.scale.y = 1.3;
  racket.add(head);
  racket.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), mat(0xf7f5ef)), 0, -0.42, 0));
  racket.position.set(0, 0.8, 0.2);
  box.add(racket);
  box.rotation.y = rad(20);
  t.add(box);
  tile.userData.racket = racket;
}
{
  const tile = tiles[5];
  const t = propGroup(tile); // a scorepad with a pencil scribbling on it
  const pad = new THREE.Group();
  pad.add(at(rbox(0.62, 0.05, 0.8, 0.015, mat(0xfffdf4, { roughness: 0.95 })), 0, 0.025, 0));
  pad.add(at(rbox(0.64, 0.06, 0.12, 0.02, mat(CLAY)), 0, 0.03, -0.38)); // the binding
  const rule = mat(0x9bb6d8);
  for (let k = 0; k < 5; k += 1) pad.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.004, 0.008), rule), 0, 0.052, -0.22 + k * 0.11));
  // Ink already on the page: a score in two quick strokes.
  const inkMat = mat(INK);
  for (const [x, z, w, r] of [[-0.14, -0.17, 0.14, 0.4], [0.08, -0.17, 0.1, -0.5], [-0.12, -0.06, 0.18, 0.1]]) {
    const m = at(new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, 0.018), inkMat), x, 0.054, z);
    m.rotation.y = r;
    pad.add(m);
  }
  pad.rotation.y = rad(-18);
  t.add(pad);
  const pencil = new THREE.Group();
  const body = at(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6), mat(0xf2c230, { roughness: 0.55 })), 0, 0.31, 0);
  const tip = at(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 6), mat(0xe8cfa6)), 0, -0.05, 0);
  tip.rotation.x = Math.PI;
  const lead = at(new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.035, 6), mat(INK)), 0, -0.088, 0);
  lead.rotation.x = Math.PI;
  const eraser = at(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.07, 12), mat(0xf08aa0)), 0, 0.655, 0);
  pencil.add(body, tip, lead, eraser);
  pencil.traverse((o) => { o.castShadow = true; });
  pencil.rotation.set(rad(28), 0, rad(-24));
  pencil.position.set(0.04, 0.17, 0.08);
  t.add(pencil);
  tile.userData.pencil = pencil;
}

// Studio dressing: a softbox, a desk lamp, loose slabs and loose balls.
const softbox = new THREE.Group();
softbox.add(at(rbox(0.34, 1.1, 0.12, 0.03, new THREE.MeshBasicMaterial({ color: 0xfffdf4 })), 0, 2.3, 0));
softbox.add(at(rbox(0.4, 1.16, 0.1, 0.03, mat(INK)), 0, 2.3, -0.06));
softbox.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8), mat(INK)), 0, 0.9, -0.05));
softbox.position.copy(spots[4]).add(RIGHT.clone().multiplyScalar(-1.5)).add(FWD.clone().multiplyScalar(1.2)).setY(-0.3);
softbox.scale.setScalar(0.85);
softbox.rotation.y = rad(55);
scene.add(softbox);
const lamp = new THREE.Group();
lamp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 8), mat(INK)), 0, 1.3, 0));
const arm = at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.7, 8), mat(INK)), -0.78, 2.72, 0);
arm.rotation.z = rad(72);
lamp.add(arm);
const shade = at(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.26, 20, 1, true), mat(INK, { side: THREE.DoubleSide })), -1.58, 2.86, 0);
lamp.add(shade);
lamp.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c9 })), -1.58, 2.74, 0));
lamp.position.copy(spots[2]).add(RIGHT.clone().multiplyScalar(2.5)).setY(-0.5);
scene.add(lamp);

const loose = [];
[[1, -2.2, 1.1], [2, 2.4, 0.5], [3.2, -2.5, 1.5], [4.3, 2.2, 1.2], [0.4, 2.1, -0.3]].forEach(([f, r, y], k) => {
  const s = rbox(0.7 + (k % 2) * 0.25, 0.16, 0.55, 0.03, mat(0xe7e2d8));
  s.position.copy(FWD.clone().multiplyScalar(f * STEP).add(RIGHT.clone().multiplyScalar(r))).setY(y);
  s.userData = { y, phase: k * 2.1 };
  scene.add(s);
  loose.push(s);
});
const strays = [];
for (let k = 0; k < 9; k += 1) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + (k % 3) * 0.015, 14, 10), mat(k % 4 === 0 ? CLAY : 0xd7f205, { roughness: 0.65 }));
  const f = 0.3 + (k * 0.53) % 4.2;
  const r = (k % 2 ? 1 : -1) * (1.3 + ((k * 0.37) % 1.2));
  s.position.copy(FWD.clone().multiplyScalar(f * STEP).add(RIGHT.clone().multiplyScalar(r))).setY(0.5 + ((k * 0.61) % 1.6));
  s.userData = { y: s.position.y, phase: k * 1.3 };
  s.castShadow = true;
  scene.add(s);
  strays.push(s);
}

// Contact shadows are painted blobs, as in the reference: one wide and faint on the paper far below each tile, one tight under the mascot.
const blobTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, 'rgba(40,34,26,0.55)'); r.addColorStop(0.5, 'rgba(40,34,26,0.2)'); r.addColorStop(1, 'rgba(40,34,26,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const blob = (size, opacity) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
};
const FLOOR_Y = -1.25;
for (const t of tiles) { t.userData.floorShadow = blob(3.1, 0.5); scene.add(t.userData.floorShadow); }
const footShadow = blob(1.0, 0.75);
scene.add(footShadow);

// Dust motes.
const DUST = 70;
const dustPos = new Float32Array(DUST * 3);
const dustV = new Float32Array(DUST);
for (let k = 0; k < DUST; k += 1) {
  const f = (k * 0.137) % 1 * 5.2 * STEP - STEP;
  const r = ((k * 0.619) % 1 - 0.5) * 7;
  const p = FWD.clone().multiplyScalar(f).add(RIGHT.clone().multiplyScalar(r));
  dustPos.set([p.x, (k * 0.311) % 1 * 4 - 0.5, p.z], k * 3);
  dustV[k] = 0.05 + ((k * 0.73) % 1) * 0.07;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.85, depthWrite: false })));

// The mascot is your fighter: the same jelly body, face and color as the fighter screen (web/jelly-core.js).
// `mascot` is the carrier that walks the path; the jelly rides it and feels every takeoff and landing (SoftBody.shove).
const mascot = new THREE.Group();
const HERO_SCALE = 0.42;
const hero = new SoftBody({ cast: 'wall', color: '#d7f205', edge: 0.14 });
hero.group.scale.setScalar(HERO_SCALE);
mascot.add(hero.group);
mascot.rotation.y = rad(45); // the face looks straight down the camera's diagonal
scene.add(mascot);
const trail = new RainbowTrail(scene, { n: 22, band: 0.03 });

// How each play style gets from tile to tile (s and world units). pre: wind-up squash before it leaves. dur: time in the air.
// h: arc height. The jelly does the rest: it squashes as the carrier launches, floats at the top and splats when it stops.
const HOPS = {
  wall: { pre: 0.16, dur: 0.5, h: 0.35, heavy: true }, // barely leaves the ground, lands like a brick
  moon: { pre: 0.12, dur: 0.78, h: 2.1 }, // a huge floaty moonball
  bot: { pre: 0.06, dur: 0.4, h: 0.8, turn: true }, // snaps round in robotic quarter turns
  goblin: { pre: 0.05, dur: 0.5, h: 0.32, double: true }, // two sneaky little skips
  grunter: { pre: 0.24, dur: 0.45, h: 1.0 }, // a long effortful load-up
  junk: { pre: 0.09, dur: 0.52, h: 0.8, wobble: true }, // wobbles off line and back
  comet: { pre: 0.04, dur: 0.3, h: 0.4 }, // a low lunge
  ghost: { pre: 0.1, dur: 0.72, h: 0.5, glide: true }, // glides over, never really lands
  lobber: { pre: 0.12, dur: 0.62, h: 1.6, sly: true }, // lobs itself, smug about it
  rabbit: { pre: 0.03, dur: 0.2, h: 0.22, trail: true }, // zips, leaving a rainbow
};
const hopOf = () => HOPS[hero.cast] || HOPS.wall;
// What each one does while it waits on a tile (every 4.5 s or so).
const IDLE = {
  rabbit: () => [0, 40, 80, 120, 160, 200].forEach((ms, i) => setTimeout(() => hero.kick(i % 2 ? -1.2 : 1.2, 0, 0), ms)), // can't keep still
  moon: () => hero.kick(0, 4.5, 0),
  bot: () => hero.spin(Math.random() < 0.5 ? 4 : -4),
  goblin: () => hero.kick(Math.random() < 0.5 ? 1.5 : -1.5, 2.4, 0),
  grunter: () => [0, 60, 120].forEach((ms, i) => setTimeout(() => hero.kick(i % 2 ? -1.4 : 1.4, 0.4, 0), ms)),
  junk: () => hero.poke(hero.com().add(new THREE.Vector3(0.3, 0.5, 0.3)), new THREE.Vector3(-0.5, -0.5, 0), 2.4),
  comet: () => hero.kick(0, 1.8, 2.2),
  ghost: () => hero.spin(2.4),
  lobber: () => { hero.mood.sly = 1.4; },
  wall: () => hero.poke(hero.com().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(0, -1, 0), 1.4, 0.7),
};
const carrier = { p: new THREE.Vector3(), v: new THREE.Vector3(), ready: false, idleAt: 4 };

// State.
const st = {
  at: 0, target: 0, hop: null, clock: 0, lit: 0,
  cam: { x: spots[0].x, y: spots[0].y, z: spots[0].z, vx: 0, vy: 0, vz: 0 },
};
function spring(s, target, dt, hz, ratio) {
  const w = hz * Math.PI * 2;
  s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt;
  s.x += s.v * dt;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// UI.
// The one control on the page: a strip of court with a ball on it. You slide the ball down the strip to go in.
// Motion spec:
// - The ball rolls without slipping: it turns distance / radius, so the seam moves exactly as a real ball's would.
// - It leaves a skid mark as wide as the ball and throws a dust puff every 14 px of travel (each lives 520 ms).
// - Crossing a court line (at 1/3 and 2/3 of the strip) ticks. Pulling loads the fighter: it squashes up to 22% with the pull.
// - Release short of 78% and the ball rolls home on a spring at 2.4 Hz, damping ratio 0.5 (one overshoot).
//   Release past 78%, or flick faster than 900 px/s from past 40%, and it runs out to the baseline at 5 Hz, ratio 1; the fighter springs.
// - At rest it is never frozen: every 2.4 s the ball rocks 9 px forward and settles back, the way you bounce one before a serve.
const key = $('enter');
const sl = { x: 0, v: 0, max: 1, held: false, finishing: false, done: false, grab: 0, lastX: 0, lastT: 0, flick: 0, puffAt: 0, zone: 0 };
const BALL = 50;
let charge = 0;
function setKey(num, labelText, sub) {
  const next = num ? `${num}|${labelText}|${sub}` : '';
  if (key.dataset.k === next) return;
  key.dataset.k = next;
  key.classList.toggle('show', !!num);
  Object.assign(sl, { x: 0, v: 0, held: false, finishing: false, done: false, zone: 0 });
  if (!num) return;
  $('klbl').textContent = labelText;
  $('ksub').textContent = sub;
  key.classList.remove('swap');
  void key.offsetWidth; // restart the pop
  key.classList.add('swap');
}
key.addEventListener('pointerdown', (e) => {
  if (sl.done || sl.finishing) return;
  const r = key.getBoundingClientRect();
  sl.max = Math.max(1, r.width - BALL - 16);
  // Grab the ball where it is; a touch elsewhere on the strip does not teleport it.
  sl.grab = THREE.MathUtils.clamp(e.clientX - r.left - 8 - sl.x, 0, BALL);
  sl.held = true; sl.v = 0; sl.flick = 0; sl.lastX = e.clientX; sl.lastT = performance.now();
  key.setPointerCapture(e.pointerId);
  key.classList.add('held');
  post({ type: 'press' });
});
key.addEventListener('pointermove', (e) => {
  if (!sl.held) return;
  const r = key.getBoundingClientRect();
  const now = performance.now();
  sl.x = THREE.MathUtils.clamp(e.clientX - r.left - 8 - sl.grab, 0, sl.max);
  sl.flick = 0.6 * ((e.clientX - sl.lastX) / Math.max(1, now - sl.lastT)) * 1000 + 0.4 * sl.flick;
  sl.lastX = e.clientX; sl.lastT = now;
});
const letGo = () => {
  if (!sl.held) return;
  sl.held = false;
  key.classList.remove('held');
  const p = sl.x / sl.max;
  if (p > 0.78 || (sl.flick > 900 && p > 0.4)) { sl.finishing = true; sl.v = Math.max(sl.flick, 600); } else sl.v = Math.min(0, sl.flick);
};
key.addEventListener('pointerup', letGo);
key.addEventListener('pointercancel', letGo);

/** Test hook: pull the ball to a fraction of the strip over 800 ms and let go, as a finger would. */
window.demoSlide = (to) => {
  sl.max = Math.max(1, key.getBoundingClientRect().width - BALL - 16);
  sl.held = true;
  const t0 = performance.now();
  const id = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / 800);
    sl.x = sl.max * to * (1 - Math.pow(1 - k, 3));
    if (k >= 1) { clearInterval(id); sl.flick = 0; letGo(); }
  }, 16);
};

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
      key.classList.add('hit');
      for (let k = 0; k < 7; k += 1) puff(sl.max + 10);
      onSlid();
      // Back from the next screen the strip should be ready again.
      setTimeout(() => { Object.assign(sl, { x: 0, v: 0, done: false, zone: 0 }); key.classList.remove('hit'); }, 1400);
    }
  }
  if (Math.abs(sl.x - sl.puffAt) > 14 && sl.x > 4) { sl.puffAt = sl.x; puff(sl.x); }
  const zone = Math.floor((sl.x / sl.max) * 3 + 0.0001);
  if (zone !== sl.zone && sl.x > 2 && !sl.done) { sl.zone = zone; post({ type: 'line' }); }
  charge = sl.done ? 0 : sl.x / sl.max;
}
function slideRender(t) {
  const u = (t % 2.4) / 0.5;
  const idle = !sl.held && !sl.finishing && !sl.done && sl.x < 1 && u < 1 ? 9 * Math.sin(Math.PI * u) : 0;
  const x = sl.x + idle;
  $('ballw').style.transform = `translate3d(${x}px,0,0)`;
  $('ball').style.transform = `rotate(${x / (BALL / 2)}rad)`;
  $('skid').style.width = `${sl.x > 2 ? sl.x + BALL / 2 + 6 : 0}px`;
}
/** The ball reached the baseline: the fighter springs, then we go in. */
function onSlid() { hero.kick(0, 6, 0); hero.mood.happy = 0.8; post({ type: 'slid' }); setTimeout(enter, 260); }
const dock = $('dock');
dock.insertAdjacentHTML('beforeend', PLACES.map((p, k) => `<button class="slot" data-i="${k + 1}"><span class="pf"></span><span class="lbl">${p.label}</span></button>`).join(''));
dock.addEventListener('click', (e) => { const b = e.target.closest('.slot'); if (b) goTo(Number(b.dataset.i)); });
// The dock ball is real physics: gravity, a launch sized to the gap, and bounces that lose 58% each time.
const dk = { x: 0, y: 0, vx: 0, vy: 0, to: 0, flying: false, squash: 0, rot: 0, at: 0, load: null, queued: null };
const G = 1500;
const slotX = (i) => {
  const r = dock.getBoundingClientRect();
  if (!i) return 18; // START: the ball waits at the left end
  const el = dock.children[1 + i]; // after the shadow and the ball
  const b = el.getBoundingClientRect();
  return b.left + b.width / 2 - r.left;
};
const restY = () => dock.clientHeight - 49; // sitting on a platform top
const DOCK_READY = null;
// The dock ball moves like a ball that got hit, not one that wants to go somewhere: the platform it sits on kicks it,
// it flies a true ballistic arc at a fixed 60 degree launch (so a longer gap needs a harder hit, and it gets one),
// horizontal speed constant in the air, spin from its speed, and it lands dead on the target and bounces out its energy.
function dockHop(i) {
  // Wind-up first: the ball sinks into its platform with it for 130 ms, the way a ball loads into the strings, then gets launched.
  if (dk.flying || dk.load) { dk.queued = i; return; }
  dk.load = { to: i, t: 0, slot: dock.querySelector(`.slot[data-i="${dk.at}"]`) };
  if (dk.load.slot) dk.load.slot.classList.add('load');
  dk.vy = 0;
}
function launch(i, from, slot) {
  dk.to = slotX(i); dk.at = i;
  const R = dk.to - from;
  // A softer, floatier hit than before: lower gravity and a 64 degree launch, so even the long hop takes most of a second.
  const T = Math.tan((64 * Math.PI) / 180);
  const vy = Math.max(260, Math.sqrt((Math.abs(R) * G * T) / 2));
  dk.vy = -vy;
  dk.vx = R / ((2 * vy) / G); // lands exactly on the target platform
  dk.x = from;
  dk.flying = true;
  if (slot) { slot.classList.remove('load'); slot.classList.remove('kick'); void slot.offsetWidth; slot.classList.add('kick'); }
  post({ type: 'press' });
}
function dockStep(dt) {
  if (DOCK_READY && !DOCK_READY()) return;
  if (!dk.x) { dk.x = slotX(dk.at); dk.y = restY(); }
  const floor = restY();
  if (dk.load) {
    dk.load.t += dt;
    const k = Math.min(1, dk.load.t / 0.13);
    dk.y = restY() + 6 * k * k;
    dk.squash = 0.18 * k;
    if (k >= 1) { const l = dk.load; dk.load = null; dk.y = restY(); launch(l.to, dk.x || slotX(dk.at), l.slot); }
    return;
  }
  if (dk.flying) dk.x += dk.vx * dt;
  dk.rot += (dk.vx * dt) / 12; // rolls through the air at its own speed (radius 12 px)
  dk.vy += G * dt;
  dk.y += dk.vy * dt;
  if (dk.y >= floor && dk.vy > 0) {
    const hit = dk.vy;
    dk.y = floor;
    if (dk.flying) { dk.flying = false; dk.x = dk.to; dk.vx = 0; if (dk.queued != null) { const q = dk.queued; dk.queued = null; setTimeout(() => dockHop(q), 60); } }
    dk.vy = hit > 140 ? -hit * 0.42 : 0;
    if (hit > 140) {
      dk.squash = Math.min(0.35, hit / 2200);
      const s = dock.querySelector(`.slot[data-i="${dk.at}"]`);
      if (s) { s.classList.add('land'); setTimeout(() => s.classList.remove('land'), 110); }
    }
  }
  dk.squash *= Math.exp(-dt * 14);
}
function dockRender() {
  $('dball').style.transform = `translate3d(${dk.x}px,${dk.y}px,0) scale(${1 + dk.squash},${1 - dk.squash})`;
  $('dball').firstElementChild.style.transform = `rotate(${dk.rot}rad)`;
  const lift = Math.min(1, (restY() - dk.y) / 90);
  $('dshadow').style.transform = `translateX(${dk.x}px) scale(${1 - 0.5 * lift})`;
  $('dshadow').style.opacity = String(1 - 0.6 * lift);
}

function paint() {
  const i = st.target;
  [...dock.querySelectorAll('.slot')].forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === i));
  const p = PLACES[i - 1];
  $('h1').textContent = p ? p.head[0] : 'WHERE TO?';
  $('h2').textContent = p ? p.head[1] : 'TAP A TILE.';
  $('blurb').textContent = p ? (i === 3 && st.record ? st.record : i === 6 && st.gear ? st.gear : p.blurb) : 'your fighter hops there. swipe up works too.';
  if (p) setKey(`0${i}`, p.label, 'SLIDE TO ENTER'); else setKey('', '', '');
}

// The top of the screen: the LOL mark (the O is a ball lobbed over a little net) and one split-flap scoreboard that
// clacks through your season, the tour (LIVE / FINAL / NEXT) and your pro, after docs/mo-design/vids/type-writer.mov's
// little machines. Each frame holds 4.2 s; a changing letter shuffles through 2 to 4 random flaps at 55 ms a flap,
// staggered 22 ms left to right, so a new line rolls in like a stadium board.
const FLAP_CHARS = 'ABCDEFGHIJKLMNOPRSTUVWXYZ0123456789';
const board = { key: '', frames: [], at: 0, timer: 0, cells: [], n: 0 };
function boardFit() {
  const box = $('flaps');
  if (!box) return;
  const n = Math.max(8, Math.floor(box.clientWidth / 17)); // 16 px flaps with a 1 px gap
  if (n === board.n) return;
  board.n = n;
  box.textContent = '';
  board.cells = Array.from({ length: n }, () => { const c = document.createElement('i'); c.textContent = ' '; box.append(c); return c; });
  if (board.frames.length) { board.frames = chunkFrames(board.items); show(board.at % board.frames.length); }
}
function chunk(text, n) {
  // Split on words into lines that fit the board; a word longer than the board is cut.
  const out = []; let line = '';
  for (const w of text.toUpperCase().split(/\s+/).filter(Boolean)) {
    const word = w.slice(0, n);
    if (!line) line = word;
    else if (line.length + 1 + word.length <= n) line += ` ${word}`;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}
function chunkFrames(items) {
  return items.flatMap((it) => chunk(it.text, board.n).map((line) => ({ tag: it.tag, cls: it.cls, line })));
}
function flapTo(cell, target, delay) {
  if (cell.textContent === target) return;
  const steps = 2 + Math.floor(Math.random() * 3);
  for (let k = 0; k <= steps; k += 1) {
    setTimeout(() => {
      cell.classList.remove('f');
      void cell.offsetWidth; // restart the flap
      cell.classList.add('f');
      setTimeout(() => { cell.textContent = k === steps ? target : FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)]; }, 30);
    }, delay + k * 55);
  }
}
function show(i) {
  const f = board.frames[i];
  if (!f) return;
  board.at = i;
  const tag = $('btag');
  if (tag.textContent !== f.tag) { tag.className = `f ${f.cls}`; tag.textContent = f.tag; }
  const line = f.line.padEnd(board.n, ' ');
  board.cells.forEach((c, k) => flapTo(c, line[k] === ' ' ? ' ' : line[k], k * 22));
  post({ type: 'flap' }); // the board clacks
}
function cycle() {
  clearTimeout(board.timer);
  if (board.frames.length > 1) board.timer = setTimeout(() => { show((board.at + 1) % board.frames.length); cycle(); }, 4200);
}
function setTop(d) {
  const items = [];
  if (d.season) items.push({ tag: 'YOU', cls: 'you', text: d.season });
  if (d.tour) items.push({ tag: d.tour.tab, cls: d.tour.live ? 'live' : 'tour', text: d.tour.text });
  if (d.pro && d.pro.text) items.push({ tag: 'PRO', cls: d.pro.won ? 'won' : 'pro', text: d.pro.text });
  $('board').classList.toggle('live', !!(d.tour && d.tour.live));
  const key = JSON.stringify(items);
  if (key !== board.key) {
    board.key = key;
    board.items = items;
    boardFit();
    board.frames = chunkFrames(items);
    show(Math.min(board.at, board.frames.length - 1));
    cycle();
  }
  // Your pro won: the jelly is happy about it, once per result.
  if (d.pro && d.pro.won && d.pro.matchId && st.cheered !== d.pro.matchId) { st.cheered = d.pro.matchId; hero.mood.happy = 1.6; hero.kick(0, 5, 0); }
}
window.addEventListener('resize', boardFit);
function goTo(i) {
  i = Math.max(0, Math.min(PLACES.length, i));
  if (i === st.target) return;
  st.target = i;
  dockHop(i);
  paint();
}
function enter() {
  const p = PLACES[st.target - 1];
  if (p && !st.hop && st.at === st.target) post({ type: 'go', to: p.key });
  else if (p) st.enterOnLand = true;
}

const ray = new THREE.Raycaster();
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x;
  const dy = e.clientY - down.y;
  const quick = performance.now() - down.t < 450;
  down = null;
  if (Math.hypot(dx, dy) < 10 && quick) {
    ray.setFromCamera(new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1), camera);
    const hit = ray.intersectObjects(tiles, true)[0];
    if (hit && hit.object.userData.tile != null) {
      const i = hit.object.userData.tile;
      if (i === st.target && i > 0) enter(); else goTo(i);
    }
  } else if (Math.abs(dy) > 44 && Math.abs(dy) > Math.abs(dx)) {
    goTo(st.target + (dy < 0 ? 1 : -1)); // the path climbs the screen: swipe up to go on
  }
});

window.setHome = (d) => {
  hero.setColor(d.color);
  if (d.cast && d.cast !== hero.cast) hero.setCast(d.cast, false);
  mirrorDisc.material.color.set(d.color);
  st.record = d.record; // shown on the standings key, where a record means something
  st.gear = d.gear; // what is worn out, shown on the gear key
  setTop(d);
  paint();
};
paint();

function advance(dt) {
  st.clock += dt;
  slideStep(dt);
  dockStep(dt);
  // Walk the path one tile at a time toward the target.
  if (!st.hop && st.at !== st.target) {
    const to = st.at + Math.sign(st.target - st.at);
    st.hop = { from: st.at, to, t: 0 };
    if (hopOf().sly) hero.mood.sly = 1;
    post({ type: 'hop' });
  }
  if (st.hop) {
    st.hop.t += dt;
    const hp = hopOf();
    if (st.hop.t >= hp.pre + hp.dur) {
      st.at = st.hop.to;
      st.hop = null;
      tiles[st.at].userData.dip.x = hp.heavy ? 0.16 : 0.07; tiles[st.at].userData.dip.v = 0;
      if (hp.heavy) hero.kick(0, -4, 0);
      carrier.idleAt = st.clock + 4.5;
      post({ type: 'land' });
      if (st.at === st.target && st.enterOnLand) { st.enterOnLand = false; setTimeout(enter, 260); }
    }
  }
  // Carry the jelly: place the carrier on its path, then hand the jelly the carrier's acceleration (in its own units, capped).
  {
    const p = carrierPos();
    if (!carrier.ready) { carrier.p.copy(p); carrier.ready = true; }
    const vel = p.clone().sub(carrier.p).divideScalar(dt);
    const acc = vel.clone().sub(carrier.v).divideScalar(dt);
    carrier.p.copy(p); carrier.v.copy(vel);
    // Up and down it only feels the jolts (takeoff, landing), not the smooth arc between, or it would float off its own feet.
    if (Math.abs(acc.y) < 150) acc.y = 0;
    const local = acc.applyQuaternion(mascot.quaternion.clone().invert()).multiplyScalar(0.6 / HERO_SCALE);
    const dv = local.multiplyScalar(dt).clampLength(0, 5);
    hero.kick(-dv.x, -dv.y, -dv.z);
    const hp = hopOf();
    const pre = st.hop && st.hop.t < hp.pre ? st.hop.t / hp.pre : 0;
    hero.squash = Math.max(pre * (hp.heavy ? 0.9 : 0.7), 0.7 * charge); // wind-up, or pulling the ball loads the fighter
    hero.simulate(dt, st.clock);
    if (!st.hop && st.clock > carrier.idleAt) { carrier.idleAt = st.clock + 4.5 + Math.random(); (IDLE[hero.cast] || (() => {}))(); }
  }
  for (const t of tiles) {
    spring(t.userData.dip, 0, dt, 2.6, 0.5);
    const want = t.userData.i === st.target && t.userData.i > 0 ? 1 : 0;
    t.userData.glow += (want - t.userData.glow) * Math.min(1, dt / 0.08);
  }
  const m = mascot.position;
  spring({ get x() { return st.cam.x; }, set x(v) { st.cam.x = v; }, get v() { return st.cam.vx; }, set v(v) { st.cam.vx = v; } }, m.x, dt, 1.3, 1);
  spring({ get x() { return st.cam.y; }, set x(v) { st.cam.y = v; }, get v() { return st.cam.vy; }, set v(v) { st.cam.vy = v; } }, tileY(st.hop ? st.hop.to : st.at), dt, 1.3, 1);
  spring({ get x() { return st.cam.z; }, set x(v) { st.cam.z = v; }, get v() { return st.cam.vz; }, set v(v) { st.cam.vz = v; } }, m.z, dt, 1.3, 1);
  for (let k = 0; k < DUST; k += 1) {
    dustPos[k * 3 + 1] += dustV[k] * dt;
    if (dustPos[k * 3 + 1] > 3.6) dustPos[k * 3 + 1] = -0.6;
  }
}

const tileY = (i) => tiles[i].position.y;

/** Where the carrier is right now: on its tile, or somewhere along this play style's hop. */
function carrierPos() {
  if (!st.hop) return tiles[st.at].position.clone().add(STAND);
  const hp = hopOf();
  const a = tiles[st.hop.from].position.clone().add(STAND);
  const b = tiles[st.hop.to].position.clone().add(STAND);
  const k = THREE.MathUtils.clamp((st.hop.t - hp.pre) / hp.dur, 0, 1);
  const kk = hp.glide ? k * k * (3 - 2 * k) : k;
  const p = a.clone().lerp(b, kk);
  p.y += hp.double ? hp.h * Math.abs(Math.sin(Math.PI * 2 * k)) : hp.h * 4 * k * (1 - k);
  if (hp.wobble) p.addScaledVector(new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize(), 0.25 * Math.sin(Math.PI * 3 * k) * (1 - k));
  return p;
}

function pose() {
  const t = st.clock;
  for (const g of tiles) {
    const u = g.userData;
    g.position.copy(u.base);
    g.position.y += 0.035 * Math.sin((t * Math.PI * 2) / u.period + u.phase) - u.dip.x;
    u.pad.material.opacity = 0.2 * u.glow;
    const lit = u.glow > 0.5 ? 1 : 0;
    if (u.labelMat.map !== u.faces[lit]) { u.labelMat.map = u.faces[lit]; u.labelMat.needsUpdate = true; }
    u.floorShadow.position.set(g.position.x + 0.3, FLOOR_Y, g.position.z + 0.3);
  }
  // Mascot: the carrier sits on its path; the jelly draws itself.
  mascot.position.copy(carrierPos());
  const hp = hopOf();
  const hk = st.hop ? THREE.MathUtils.clamp((st.hop.t - hp.pre) / hp.dur, 0, 1) : 0;
  mascot.rotation.y = rad(45) + (st.hop && hp.turn ? (Math.PI / 2) * Math.floor(hk * 4) : 0);
  hero.render(t);
  trail.update(hero.group.localToWorld(hero.com()), !!st.hop && hp.trail && hk > 0 && hk < 1);
  // Its shadow stays on the tile it is over and tightens as it rises.
  const ground = st.hop ? THREE.MathUtils.lerp(tiles[st.hop.from].position.y, tiles[st.hop.to].position.y, hk) : tiles[st.at].position.y;
  const height = Math.max(0, mascot.position.y - ground);
  footShadow.position.set(mascot.position.x, ground + 0.012, mascot.position.z);
  footShadow.scale.setScalar(1 - 0.45 * Math.min(1, height / 0.95));
  footShadow.material.opacity = 0.75 - 0.4 * Math.min(1, height / 0.95);
  slideRender(t);
  dockRender();
  // Props.
  const bt = (t % 0.9) / 0.9;
  ball.position.y = 0.13 + 0.34 * 4 * bt * (1 - bt);
  tiles[2].userData.pin.position.y = 0.05 * Math.sin(t * 2.2);
  tiles[3].userData.cup.rotation.y = t * 0.8;
  tiles[4].userData.stand.rotation.y = rad(24) + 0.35 * Math.sin(t * 0.7);
  tiles[6].userData.racket.rotation.z = 0.28 * Math.sin(t * 2.6);
  // The pencil writes: quick side-to-side strokes across the line, a lift, then the next character.
  {
    const p = tiles[5].userData.pencil;
    const c = t % 1.6;
    const writing = c < 1.1;
    p.position.x = 0.04 + (writing ? 0.05 * Math.sin(c * 19) + 0.12 * (c / 1.1) - 0.06 : 0.06 - 0.12 * ((c - 1.1) / 0.5));
    p.position.z = 0.08 + (writing ? 0.03 * Math.sin(c * 11) : 0);
    p.position.y = 0.17 + (writing ? 0 : 0.08 * Math.sin(Math.PI * ((c - 1.1) / 0.5)));
  }
  for (const s of loose) s.position.y = s.userData.y + 0.06 * Math.sin(t * 0.8 + s.userData.phase);
  for (const s of strays) s.position.y = s.userData.y + 0.09 * Math.sin(t * 1.1 + s.userData.phase);
  dustGeo.attributes.position.needsUpdate = true;
  // Camera: sits back along the path's diagonal. It aims a little past the mascot and is shifted so the mascot rides at about 56% of the
  // screen height: above the headline and record strip, with the next two tiles in view above it.
  const orbit = rad(0.5) * Math.sin((t * Math.PI * 2) / 9);
  const look = new THREE.Vector3(st.cam.x, st.cam.y, st.cam.z).add(FWD.clone().multiplyScalar(STEP * 0.35)).setY(st.cam.y + 0.3);
  const narrow = camera.aspect < 0.62 ? 1 : 0.86;
  const dir = new THREE.Vector3(Math.sin(rad(45) + orbit), 0.78, Math.cos(rad(45) + orbit)).normalize();
  camera.position.copy(look).add(dir.multiplyScalar(15.5 * narrow));
  camera.lookAt(look);
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, window.innerHeight * 0.07, window.innerWidth, window.innerHeight);
  sun.target.position.copy(look);
  sun.position.copy(look).add(new THREE.Vector3(-5, 9, 4));
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let remaining = Math.min((now - last) / 1000, 0.1);
  last = now;
  while (remaining > 1e-6) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    advance(dt);
  }
  pose();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
window.demoHomeSlide = () => { setTimeout(() => goTo(2), 1200); setTimeout(() => window.demoSlide(0.55), 3800); setTimeout(() => window.demoSlide(0.95), 6600); };
window.demoHome = () => { [1, 2, 3, 4, 5].forEach((i, k) => setTimeout(() => goTo(i), 1400 + k * 1900)); };
// The headline's second line gets a self-drawing brush stroke under it; it redraws whenever the headline changes.
brushUnderline(document.getElementById('h2'));
post({ type: 'ready' });
