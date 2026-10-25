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

import { post } from './lib/bridge.js';
import { brushUnderline } from './lib/brush.js';
import { mountMark } from './lib/mark.js';
import { createDock } from './lib/dock.js';
import { createHero, STYLES } from './lib/hero.js';
import { createSlide } from './lib/slide.js';
import { spring } from './lib/spring.js';

const INK = 0x16181d;
const PAPER = 0xefece5;
const CLAY = 0xe2562f; // the one accent
const rad = THREE.MathUtils.degToRad;
const $ = (id) => document.getElementById(id);
mountMark($('mark'), { onTap: () => { post({ type: 'press' }); post({ type: 'go', to: 'intro' }); } });

const PLACES = [
  { key: 'play', label: 'PLAY', head: ['PLAY A MATCH.', 'PICK YOUR OPPONENT.'], blurb: 'pick an opponent, pick a court, log the score' },
  { key: 'courts', label: 'COURTS', head: ['291 COURTS.', 'EVERY ONE A STAGE.'], blurb: 'san diego county, nearest first' },
  { key: 'standings', label: 'STANDINGS', head: ['THE TABLE.', 'WHO IS ON TOP.'], blurb: 'season points, streaks, every match' },
  { key: 'fighter', label: 'FIGHTER', head: ['YOUR FIGHTER.', 'NAME. STYLE. COLOR.'], blurb: 'change how you show up' },
  { key: 'write', label: 'WRITE', head: ['JUST WRITE IT.', 'NO FORMS.'], blurb: 'a score, a time, a restring: write it with your finger' },
  { key: 'gear', label: 'GEAR', head: ['YOUR GEAR.', 'WHAT IS WORN OUT.'], blurb: 'rackets, shoes, balls, overgrips' },
  { key: 'crew', label: 'CREW', head: ['YOUR CREW.', 'WHO YOU PLAY.'], blurb: 'the friends your season counts against. start one, text them the link.' },
  { key: 'drill', label: 'DRILL', head: ['PRACTICE.', 'TWO THUMBS. ONE BALL.'], blurb: 'a ball machine and a robot. move, turn, swing.' },
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
const spots = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => FWD.clone().multiplyScalar(i * STEP).add(RIGHT.clone().multiplyScalar(i === 0 ? 0 : (i % 2 ? 0.8 : -0.8))).setY(i === 0 ? 0 : 0.12 + 0.16 * ((i * 7) % 3)));

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

const crewJellies = [];
{
  const tile = tiles[7];
  const t = propGroup(tile); // the crew's team photo: three jellies on a two-step riser, taking turns to hop
  t.add(at(rbox(0.96, 0.12, 0.34, 0.02, mat(0xe6e1d7)), 0, 0.06, 0.16));
  t.add(at(rbox(0.96, 0.26, 0.3, 0.02, mat(0xffffff)), 0, 0.13, -0.16));
  const eye = mat(0xfffdf0, { roughness: 0.2 });
  const pupil = mat(INK, { roughness: 0.4 });
  [[-0.3, 0.12, 0.16, 0xd7f205], [0.3, 0.12, 0.16, 0xff6fb1], [0, 0.26, -0.16, 0x35d6ff]].forEach(([x, y, z, c]) => {
    const j = new THREE.Group();
    const body = at(rbox(0.24, 0.24, 0.24, 0.07, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1 })), 0, 0.12, 0);
    j.add(body);
    for (const ex of [-0.05, 0.05]) {
      j.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), eye), ex, 0.15, 0.12));
      j.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 6), pupil), ex, 0.15, 0.145));
    }
    j.position.set(x, y, z);
    j.rotation.y = rad(45); // faces the camera, like your fighter
    j.userData.y = y;
    t.add(j);
    crewJellies.push({ j, body });
  });
}

{
  const tile = tiles[8];
  const t = propGroup(tile); // a little ball machine that pops a ball out on a loop
  const m = new THREE.Group();
  m.add(at(rbox(0.36, 0.3, 0.36, 0.05, mat(0x2b2f36)), 0, 0.15, 0));
  m.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.2, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xfffdf0, transparent: true, opacity: 0.45, side: THREE.DoubleSide })), 0, 0.4, 0));
  for (let k = 0; k < 7; k += 1) m.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), mat(0xd7f205, { roughness: 0.6 })), Math.cos(k * 2.4) * (0.04 + (k % 2) * 0.06), 0.36 + (k % 3) * 0.03, Math.sin(k * 2.4) * (0.04 + (k % 2) * 0.06)));
  const mouth = at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 12), mat(CLAY)), 0.12, 0.22, 0.12);
  mouth.rotation.set(rad(60), rad(45), 0, 'YXZ');
  m.add(mouth);
  m.traverse((o) => { o.castShadow = true; });
  t.add(m);
  const fed = at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mat(0xd7f205, { roughness: 0.6 })), 0, 0, 0);
  fed.castShadow = true;
  t.add(fed);
  tile.userData.machine = m;
  tile.userData.fed = fed;
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

// The mascot is your fighter (web/lib/hero.js): the same jelly as the fighter screen, hopping tile to tile in its play style.
const H = createHero(scene, { scale: 0.42, unit: STEP });
const { mascot, hero } = H;

// State.
const st = {
  at: 0, target: 0, hop: null, clock: 0, lit: 0,
  cam: { x: spots[0].x, y: spots[0].y, z: spots[0].z, vx: 0, vy: 0, vz: 0 },
};

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// UI. The one control on the page is the slide strip (web/lib/slide.js): slide the ball down the court to go in.
const slide = createSlide({ post, onSlid: () => { H.cheer(); post({ type: 'slid' }); setTimeout(enter, 260); } });
// The dock (web/lib/dock.js): a platform per place; START has none, so the ball waits at the left end.
const dock = createDock({ slots: PLACES.map((p, k) => ({ i: k + 1, label: p.label })), onPick: (i) => goTo(i), post });

function paint() {
  const i = st.target;
  dock.mark(i);
  const p = PLACES[i - 1];
  $('h1').textContent = p ? p.head[0] : 'WHERE TO?';
  $('h2').textContent = p ? p.head[1] : 'TAP A TILE.';
  $('blurb').textContent = p ? (i === 3 && st.record ? st.record : i === 6 && st.gear ? st.gear : i === 7 && st.crew ? `${st.crew.name}: ${st.crew.n} fighter${st.crew.n === 1 ? '' : 's'}. call them up for a game.` : p.blurb) : 'your fighter hops there. swipe up works too.';
  if (p) slide.setKey(`0${i}`, p.label, 'SLIDE TO ENTER'); else slide.setKey('', '', '');
}

// The top of the screen is paper. The tour feed (src/lib/tour.ts) still arrives in setHome; it is for a scoreboard on the
// standings tile, not a bar over the scene. Only one thing happens here: your pro won, so the jelly is happy, once per result.
function setTop(d) {
  if (d.pro && d.pro.won && d.pro.matchId && st.cheered !== d.pro.matchId) { st.cheered = d.pro.matchId; hero.mood.happy = 1.6; hero.kick(0, 5, 0); }
}
function goTo(i) {
  i = Math.max(0, Math.min(PLACES.length, i));
  if (i === st.target) return;
  st.target = i;
  dock.hop(i);
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
  H.set(d);
  mirrorDisc.material.color.set(d.color);
  st.record = d.record; // shown on the standings key, where a record means something
  st.gear = d.gear; // what is worn out, shown on the gear key
  st.crew = d.crew; // { name, n, colors } once you are in a crew
  if (d.crew?.colors) d.crew.colors.slice(0, 3).forEach((c, k) => crewJellies[k]?.body.material.color.set(c));
  setTop(d);
  paint();
};
paint();

function advance(dt) {
  st.clock += dt;
  slide.step(dt);
  dock.step(dt);
  // One jump straight to the target, sized to the gap: further means a deeper crouch, a harder push and a higher arc.
  if (!st.hop && st.at !== st.target) {
    const to = st.target;
    st.hop = { from: st.at, to, t: 0, pushed: false, dur: H.jump(standAt(st.at), standAt(to)) };
    post({ type: 'hop' });
  }
  if (st.hop) {
    st.hop.t += dt;
    const power = H.power();
    // The tile it pushes off sinks with the push.
    if (!st.hop.pushed && st.hop.t >= H.crouch()) { st.hop.pushed = true; tiles[st.hop.from].userData.dip.x = 0.04 + 0.03 * power; tiles[st.hop.from].userData.dip.v = 0; }
    if (st.hop.t >= st.hop.dur) {
      st.at = st.hop.to;
      st.hop = null;
      tiles[st.at].userData.dip.x = Math.min(0.3, (STYLES[hero.cast]?.heavy ? 0.12 : 0.05) * (0.6 + 0.4 * power)); tiles[st.at].userData.dip.v = 0;
      H.landed(st.clock);
      post({ type: 'land' });
      if (st.at === st.target && st.enterOnLand) { st.enterOnLand = false; setTimeout(enter, 260); }
    }
  }
  H.step(dt, st.clock, carrierPos(), st.hop ? st.hop.t : null, slide.charge); // carry the jelly along its path
  for (const t of tiles) {
    spring(t.userData.dip, 0, dt, 2.6, 0.5);
    const want = t.userData.i === st.target && t.userData.i > 0 ? 1 : 0;
    t.userData.glow += (want - t.userData.glow) * Math.min(1, dt / 0.08);
  }
  const m = mascot.position;
  spring({ get x() { return st.cam.x; }, set x(v) { st.cam.x = v; }, get v() { return st.cam.vx; }, set v(v) { st.cam.vx = v; } }, m.x, dt, 1.3, 1);
  const air = st.hop ? Math.max(0, m.y - tileY(st.hop.to)) : 0; // rise with a big jump so it stays in frame
  spring({ get x() { return st.cam.y; }, set x(v) { st.cam.y = v; }, get v() { return st.cam.vy; }, set v(v) { st.cam.vy = v; } }, tileY(st.hop ? st.hop.to : st.at) + 0.7 * air, dt, 1.3, 1);
  spring({ get x() { return st.cam.z; }, set x(v) { st.cam.z = v; }, get v() { return st.cam.vz; }, set v(v) { st.cam.vz = v; } }, m.z, dt, 1.3, 1);
  for (let k = 0; k < DUST; k += 1) {
    dustPos[k * 3 + 1] += dustV[k] * dt;
    if (dustPos[k * 3 + 1] > 3.6) dustPos[k * 3 + 1] = -0.6;
  }
}

const tileY = (i) => tiles[i].position.y;

const standAt = (i) => tiles[i].position.clone().add(STAND);

/** Where the carrier is right now: on its tile, or somewhere along its jump. */
function carrierPos() {
  return st.hop ? H.along(st.hop.t) : standAt(st.at);
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
  const hk = H.render(t, carrierPos(), st.hop ? st.hop.t : null);
  // Its shadow stays on the tile it is over and tightens as it rises.
  const ground = st.hop ? THREE.MathUtils.lerp(tiles[st.hop.from].position.y, tiles[st.hop.to].position.y, hk) : tiles[st.at].position.y;
  const height = Math.max(0, mascot.position.y - ground);
  footShadow.position.set(mascot.position.x, ground + 0.012, mascot.position.z);
  footShadow.scale.setScalar(1 - 0.45 * Math.min(1, height / 0.95));
  footShadow.material.opacity = 0.75 - 0.4 * Math.min(1, height / 0.95);
  slide.render(t);
  dock.render();
  // Props.
  const bt = (t % 0.9) / 0.9;
  ball.position.y = 0.13 + 0.34 * 4 * bt * (1 - bt);
  tiles[2].userData.pin.position.y = 0.05 * Math.sin(t * 2.2);
  tiles[3].userData.cup.rotation.y = t * 0.8;
  tiles[4].userData.stand.rotation.y = rad(24) + 0.35 * Math.sin(t * 0.7);
  tiles[6].userData.racket.rotation.z = 0.28 * Math.sin(t * 2.6);
  // The machine feeds one every 1.4 s: a little recoil, the ball arcs out toward the camera corner and drops off the tile.
  {
    const c = (t % 1.4) / 1.4;
    const { machine, fed } = tiles[8].userData;
    machine.position.set(-0.02 * Math.exp(-c * 10), 0, -0.02 * Math.exp(-c * 10));
    fed.visible = c < 0.8;
    const u = c / 0.8;
    fed.position.set(0.14 + 0.6 * u, 0.24 + 0.5 * u - 0.9 * u * u, 0.14 + 0.6 * u);
  }
  // The crew hop in turn, one every 0.7 s, like friends who cannot stand still for the photo.
  crewJellies.forEach(({ j }, k) => {
    const c = ((t - k * 0.7) % 2.1 + 2.1) % 2.1;
    const h = c < 0.42 ? Math.sin((Math.PI * c) / 0.42) : 0;
    j.position.y = j.userData.y + 0.14 * h;
    j.scale.set(1 + 0.06 * (1 - h) * (c < 0.5 ? 1 : 0), 1 + 0.1 * h, 1);
  });
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
  let remaining = window.paused ? 0 : Math.min((now - last) / 1000, 0.1);
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
window.__goTo = (i) => goTo(i); // test hook: headless stills hop straight to a tile
// Test hook: with window.paused set, step the scene exactly `sec` seconds and draw it.
window.advanceBy = (sec) => { for (let k = 0; k < sec * 120; k += 1) { advance(1 / 120); pose(); } renderer.render(scene, camera); };
