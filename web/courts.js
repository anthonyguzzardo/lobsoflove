// Courts: six small arenas, one per favorite venue. Each shows that venue's one signature court at regulation proportions and on its
// real compass bearing (from OpenStreetMap via scripts/build-venues.mjs), walled in, with the venue's song running along the back walls
// like a sponsor board. The mascot hops between arenas; sliding the ball drops the camera down into the court.
// Same paper, ink and clay language as web/home.js, after docs/mo-design/vids/claude-bot-jumper-video.mov.
//
// Motion spec. Springs are damped oscillators integrated at 1/120 s.
// - Hop: your fighter hops island to island in its own play style (web/lib/hero.js), stretched for the distance.
//   The landed tile dips 0.07 and returns at 2.6 Hz, ratio 0.5.
// - Dive: the other arenas sink 7 units (1.4 Hz, ratio 0.9), the mascot hops onto the baseline and shrinks to player size, and the camera
//   comes down from 17.5 back and steep to 5 back and low at 1.0 Hz, ratio 1. The page reports the pick 1.5 s in.
// - Wall boards scroll 0.07 of their length a second.
// - Camera follows at 1.3 Hz, ratio 1, and orbits 0.5 degrees on a 9 s sine. Islands bob 0.035 on 3.4 to 4.6 s sines.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { post } from './lib/bridge.js';
import { COURT_ICONS } from './lib/court-icons.js';
import { createHexDock } from './lib/hexdock.js';
import { SoftBody } from './jelly-core.js';
import { createHero } from './lib/hero.js';
import { createSlide } from './lib/slide.js';
import { sp, spring } from './lib/spring.js';

const INK = 0x16181d;
const PAPER = 0xefece5;
const CLAY = 0xe2562f;
const rad = THREE.MathUtils.degToRad;
const $ = (id) => document.getElementById(id);

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(PAPER, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAPER, 33, 48); // the world below a tile you just left falls away into the paper
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 120);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.55));
const sun = new THREE.DirectionalLight(0xfff4e4, 2.1);
sun.position.set(-5, 9, 4);
scene.add(sun);

const FWD = new THREE.Vector3(-1, 0, -1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const STEP = 4.7;
const SIDE = 2.45; // the concrete apron each court sits on, flat on its place's ground (no floating tile)
const COURT_L = 1.5; // a court is drawn 1.5 units long, so one unit is about 15.8 m
const M = 23.77 / COURT_L;
const CAM = new THREE.Vector3(1, 0, 1).normalize();
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
const ink = mat(INK);
const rbox = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), material);
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const cyl = (r1, r2, h, material, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), material);
const cone = (r, h, material, seg = 16) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), material);
const ball = (r, material) => new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), material);

function label(text, lit, accent) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, 640, 96);
  g.fillStyle = lit ? accent : '#16181d'; g.fillRect(0, 0, 640, 14);
  g.fillStyle = '#16181d';
  let size = 40;
  g.font = `700 ${size}px ui-monospace, Menlo, monospace`;
  while (g.measureText(text).width > 590 && size > 20) { size -= 2; g.font = `700 ${size}px ui-monospace, Menlo, monospace`; }
  g.textBaseline = 'middle';
  g.fillText(text, 24, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

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

// Your fighter (web/lib/hero.js): the same jelly as home and the fighter screen. The arenas are far apart, so its hops reach further.
const H = createHero(scene, { scale: 0.42, unit: STEP });
const { mascot } = H;
const footShadow = blob(1.0, 0.75);
scene.add(footShadow);

// Dust.
const DUST = 80;
const dustPos = new Float32Array(DUST * 3);
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.85, depthWrite: false })));



let venues = [];
const islands = [];
const st = { at: 0, target: 0, hop: null, clock: 0, muted: false, cam: { x: sp(), y: sp(), z: sp() }, diving: false, dive: sp(), jump: null, you: sp(1), land: sp(0) };

// Presence (src/lib/presence.ts): who is on which island. Friends stand as small jellies on the tile beside the court; someone
// coming later stands faint with their time over their head. Your beacon is a pennant in your color on the island you landed on.
// mode 'meet' (from home): sliding lands you; sliding where you landed plays. mode 'pick' (from a match): sliding picks the court.
let presence = { you: null, venues: {}, mode: 'meet', demo: false };
const crowd = new Map(); // `${venue}|${name}` -> { body, holder, island, here, idleAt, tag }
const SPOTS = [[0.35, 0.92], [-0.3, 0.92], [1.08, 0.62], [-0.9, 0.92], [1.08, -0.62], [-1.0, 0.62]]; // later arrivals: outside, along the front edges
// Who is here plays, so the format reads from where they stand (tile-local; +x is the baseline nearer the camera, the court is
// 1.5 long and 0.69 wide). One serves; two rally baseline to baseline; three: the first here holds the far side as king, the next
// challenges, the third waits on the sideline; four play doubles, one up and one back a side; anyone past four waits.
const SLOTS = {
  1: [[0.66, 0.08]],
  2: [[-0.66, -0.08], [0.66, 0.08]],
  3: [[-0.66, 0], [0.66, 0], [0.42, 0.43]],
  4: [[-0.66, -0.16], [-0.28, 0.17], [0.66, 0.16], [0.3, -0.17]],
};
const WAIT = [[0.42, 0.43], [0.08, 0.43], [-0.26, 0.43]];
const slotsFor = (n) => (n <= 4 ? SLOTS[n] || [] : [...SLOTS[4], ...WAIT.slice(0, n - 4)]);
// Who hits to whom: two and three rally the first two; doubles goes crosscourt round the four.
const RALLY = { 2: [0, 1], 3: [0, 1], 4: [2, 0, 3, 1] };
const CORNER = new THREE.Vector3(SIDE / 2 - 0.3, 0, SIDE / 2 - 0.3); // where you stand on an island you have not landed on
const FRIEND = 0.26; // a friend waiting outside the court
const PLAYER = 0.2; // anyone in the court, sized to it (you shrink to match: YOU_IN)
const YOU_IN = 0.5;
const rallies = new Map(); // island index -> { ball, hitters, k, t }

/** The sign on the island's right edge: what the headcount plays, in big type. Empty islands just show their name. */
const signCache = new Map();
function headcountTex(text, accent) {
  const k = `${text}|${accent}`;
  if (signCache.has(k)) return signCache.get(k);
  const c = document.createElement('canvas');
  c.width = 640; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#16181d'; g.fillRect(0, 0, 640, 96);
  g.fillStyle = accent; g.fillRect(0, 0, 640, 12);
  g.fillStyle = accent; g.beginPath(); g.arc(44, 56, 13, 0, Math.PI * 2); g.fill();
  let size = 44;
  g.font = `800 ${size}px ui-monospace, Menlo, monospace`;
  while (g.measureText(text).width > 540 && size > 22) { size -= 2; g.font = `800 ${size}px ui-monospace, Menlo, monospace`; }
  g.fillStyle = '#fffdf0'; g.textBaseline = 'middle';
  g.fillText(text, 76, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  signCache.set(k, t);
  return t;
}
let youColor = '#d7f205';
const tagLayer = document.createElement('div');
tagLayer.id = 'ptags';
document.body.appendChild(tagLayer);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const pennant = (() => {
  const g = new THREE.Group();
  g.add(at(cyl(0.012, 0.014, 0.62, ink, 6), 0, 0.31, 0));
  const cloth = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.26, -0.07, 0), new THREE.Vector3(0, -0.15, 0)]), new THREE.MeshBasicMaterial({ color: youColor, side: THREE.DoubleSide }));
  cloth.position.y = 0.6;
  g.add(cloth);
  g.userData.cloth = cloth;
  g.visible = false;
  return g;
})();

/** Put everyone where the app says they are: add the new, drop the gone, and wake anyone whose time has come. */
function syncCrowd() {
  if (!islands.length) return;
  const seen = new Set();
  venues.forEach((v, i) => {
    const room = presence.venues[v.id];
    const people = room?.people || [];
    const mine = presence.mode === 'meet' && presence.you === v.id;
    const players = people.filter((p) => p.here).length + (mine ? 1 : 0);
    const slots = slotsFor(players);
    let inCourt = 0;
    let outside = 0;
    const hitters = [];
    // The edge sign: the headcount when there is one, the place's name when there is not.
    const u = islands[i].userData;
    if (u.signMat) { const tex = room?.sign ? headcountTex(room.sign, v.accent) : null; u.signMat.map = tex || u.labelMat.map; u.signMat.userData.live = !!tex; u.signMat.needsUpdate = true; }
    people.forEach((p) => {
      const id = `${v.id}|${p.name}`;
      seen.add(id);
      let c = crowd.get(id);
      if (!c) {
        const body = new SoftBody({ cast: p.cast, color: p.color, edge: 0.14 });
        body.group.scale.setScalar(FRIEND);
        const holder = new THREE.Group();
        holder.rotation.y = rad(45); // faces down the camera's diagonal, like yours
        holder.add(body.group);
        holder.traverse((o) => { o.userData.island = i; });
        islands[i].add(holder);
        const tag = document.createElement('div');
        tagLayer.appendChild(tag);
        c = { body, holder, island: i, here: null, idleAt: st.clock + 1 + Math.random() * 3, tag };
        crowd.set(id, c);
      }
      const [x, z] = p.here ? slots[inCourt] : SPOTS[outside % SPOTS.length];
      if (p.here) hitters[inCourt++] = { pos: new THREE.Vector3(x, 0, z), hit: () => { c.body.kick(0, 2.2, 0); } };
      else outside += 1;
      c.holder.position.set(x, 0, z);
      c.body.group.scale.setScalar(p.here ? PLAYER : FRIEND);
      if (c.here === false && p.here) { c.body.kick(0, 5, 0); c.body.mood.happy = 1; } // they just got here
      c.here = p.here;
      c.body.mat.transparent = !p.here;
      c.body.mat.opacity = p.here ? 1 : 0.32;
      c.body.mat.depthWrite = p.here;
      c.body.mat.needsUpdate = true;
      c.body.face.visible = p.here;
      c.tag.className = `ptag${p.here ? '' : ' later'}`;
      c.tag.textContent = p.here ? p.name : `${p.name} ${p.time}`;
    });
    dock?.people(i, [...(mine ? [{ color: youColor, here: true }] : []), ...people.map((p) => ({ color: p.color, here: p.here }))]);
    // You: on an island you landed on you take the next place in the court; anywhere else you stand in the corner.
    const stand = mine ? new THREE.Vector3(slots[inCourt][0], 0, slots[inCourt][1]) : CORNER.clone();
    if (mine) hitters[inCourt] = { pos: stand.clone(), hit: () => { H.hero.kick(0, 2.6, 0); } };
    if (!u.stand.equals(stand)) {
      const from = standOn(i);
      u.stand.copy(stand);
      // Already standing here: hop to the new spot instead of snapping to it.
      if (st.at === i && !st.hop && !st.diving) { const b = u.base.clone().add(stand); st.hop = { from, b, to: i, t: 0, pushed: false, dur: H.jump(from, b) }; post({ type: 'hop' }); }
    }
    // The rally: a ball between whoever is hitting. One player alone serves into the far box.
    const order = players >= 2 ? (RALLY[Math.min(players, 4)] || []).map((k) => hitters[k]).filter(Boolean) : hitters.length ? [hitters[0], { pos: new THREE.Vector3(-0.35, 0, -0.12), hit: () => {} }] : [];
    let r = rallies.get(i);
    if (order.length >= 2) {
      if (!r) { const ballMesh = ball(0.045, new THREE.MeshBasicMaterial({ color: 0xe4ff1a })); islands[i].add(ballMesh); r = { ball: ballMesh, k: 0, t: Math.random() }; rallies.set(i, r); }
      r.hitters = order;
      r.serve = players === 1;
      r.k %= order.length;
    } else if (r) { islands[i].remove(r.ball); rallies.delete(i); }
  });
  for (const [id, c] of crowd) {
    if (seen.has(id)) continue;
    islands[c.island].remove(c.holder);
    c.body.geo.dispose();
    c.tag.remove();
    crowd.delete(id);
  }
  const b = venues.findIndex((v) => v.id === presence.you);
  if (pennant.parent) pennant.parent.remove(pennant);
  pennant.visible = b >= 0 && presence.mode === 'meet';
  if (pennant.visible) { pennant.position.set(1.62, 0, 0.98); islands[b].add(pennant); }
}

/** Land on the island you are on (or headed for): that is the beacon. Everyone already there says hello. */
function land() {
  const v = venues[st.target];
  if (!v) return;
  presence.you = v.id;
  post({ type: 'beacon', id: v.id });
  for (const c of crowd.values()) if (c.island === st.target && c.here) { setTimeout(() => { c.body.kick(0, 4.5, 0); c.body.mood.happy = 0.9; }, 200 + Math.random() * 300); }
  syncCrowd();
  paint();
}

window.setPresence = (p) => { presence = { ...presence, ...p }; syncCrowd(); if (islands.length) paint(); };

const line = new THREE.MeshBasicMaterial({ color: 0xfffdf0 });
const SURROUND = mat(0x3f8f5a);
const PLAY = mat(0x2f6fd6);

/** One court at true size: 23.77 x 10.97 m of play inside its run-off, with every line a real court has. */
/** Court colors per venue, matched to the founder's photos. `wall` is the windscreen color where it is not the default charcoal. */
const SURFACE = {
  ucsd: { inner: 0x1f3a8f, outer: 0x6aa6dd, wall: 0x1e3350, mural: true }, // navy windscreens; one carries a painted mural
  lindavista: { inner: 0x5b4cae, outer: 0xa3a6ab }, // violet-indigo court, soft grey run-off
  balboa: { inner: 0x3a6fc6, outer: 0x6aa86b, wall: 0x2b5638, stands: [0xbdb9b0, 0xa9a59c] }, // the stadium: green windscreens, concrete stands
  roosevelt: { inner: 0x4a8bd4, outer: 0x5f9a5c },
  northpark: { inner: 0x3d8a52, outer: 0x8a2c34 }, // green courts on burgundy
  barnes: { inner: 0x2f6fb8, outer: 0x5f9a6a }, // not from a photo yet: classic blue on green until the founder sends one
};

function court(c, m, colors) {
  const g = new THREE.Group();
  const L = c.w; // baseline to baseline
  const W = c.d; // doubles sideline to sideline
  g.add(at(rbox(L + 11 / m, 0.02, W + 6.4 / m, 0.008, colors ? mat(colors.outer) : SURROUND), 0, 0.012, 0));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(L, 0.006, W), colors ? mat(colors.inner) : PLAY), 0, 0.026, 0));
  const t = Math.max(0.006, 0.12 / m);
  const add = (w, d, x, z) => g.add(at(new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, d), line), x, 0.031, z));
  add(L, t, 0, W / 2); add(L, t, 0, -W / 2); // doubles sidelines
  add(L, t, 0, W * 0.375); add(L, t, 0, -W * 0.375); // singles sidelines (8.23 of 10.97 m)
  add(t, W, L / 2, 0); add(t, W, -L / 2, 0); // baselines
  const svc = L * (6.4 / 23.77);
  add(t, W * 0.75, svc, 0); add(t, W * 0.75, -svc, 0); // service lines
  add(svc * 2, t, 0, 0); // center service line
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(t * 1.4, 1.0 / m, W + 1.8 / m), ink), 0, 0.03 + 0.5 / m, 0)); // net, 0.91 m
  if (c.lit) {
    for (const [x, z] of [[L / 2 + 3 / m, W / 2 + 2 / m], [-L / 2 - 3 / m, W / 2 + 2 / m], [L / 2 + 3 / m, -W / 2 - 2 / m], [-L / 2 - 3 / m, -W / 2 - 2 / m]]) {
      g.add(at(cyl(0.008, 0.008, 9 / m, ink, 6), x, 4.5 / m, z));
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.4 / m, 0.4 / m, 0.8 / m), new THREE.MeshBasicMaterial({ color: 0xfff6cf })), x, 9 / m, z));
    }
  }
  g.position.set(c.x, 0, c.z);
  g.rotation.y = c.rot;
  return g;
}

/** An original mural for a navy windscreen: a gold trident striking through lightning. Not any school's mascot or mark. */
function mural() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1e3350'; g.fillRect(0, 0, 1024, 256);
  g.globalAlpha = 0.08; g.strokeStyle = '#fff';
  for (let x = -256; x < 1024; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 256, 256); g.moveTo(x + 256, 0); g.lineTo(x, 256); g.stroke(); }
  g.globalAlpha = 1;
  const bolt = (x, y, s, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 * s, y + 70 * s); g.lineTo(x + 18 * s, y + 70 * s); g.lineTo(x + 52 * s, y + 150 * s); g.lineTo(x - 4 * s, y + 60 * s); g.lineTo(x + 18 * s, y + 60 * s); g.closePath(); g.fill(); };
  bolt(150, 40, 1.1, '#d9dde5'); bolt(820, 30, 1.25, '#d9dde5'); bolt(880, 70, 0.8, '#c9a94e');
  g.save(); g.translate(512, 128); g.rotate(-0.42);
  g.fillStyle = '#c9a94e'; g.strokeStyle = '#f2ead2'; g.lineWidth = 5;
  g.fillRect(-300, -9, 470, 18); g.strokeRect(-300, -9, 470, 18);
  g.beginPath(); g.moveTo(170, -58); g.lineTo(170, 58); g.lineTo(196, 58); g.lineTo(196, -58); g.closePath(); g.fill(); g.stroke();
  for (const y of [-46, 0, 46]) { g.beginPath(); g.moveTo(196, y - 11); g.lineTo(300, y); g.lineTo(196, y + 11); g.closePath(); g.fill(); g.stroke(); }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function board(text, accent) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = '700 40px ui-monospace, Menlo, monospace';
  c.width = Math.ceil(g.measureText(text).width) + 60;
  c.height = 64;
  g.fillStyle = '#101216'; g.fillRect(0, 0, c.width, 64);
  g.font = '700 40px ui-monospace, Menlo, monospace';
  g.fillStyle = accent; g.textBaseline = 'middle';
  g.fillText(text, 30, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return { t, unit: (c.width / 64) * 0.2 }; // world length of one pass of the text on a 0.2-high board
}

/** What makes each place itself, set at the back corner of its tile. */
const FLAVOR = {
  ucsd(g) { [[-1.2, -0.75, 1.0], [-0.95, -1.15, 1.25], [-0.6, -1.25, 0.9]].forEach(([x, z, h]) => { g.add(at(cyl(0.025, 0.03, h * 0.6, ink, 6), x, h * 0.3, z)); const top = at(ball(0.2, mat(0x3d6b52)), x, h * 0.72, z); top.scale.y = 1.7; g.add(top); });
    // Flyovers: the air station is next door. Every 19 s two fighter jets streak over; later an Osprey thumps across, rotors up.
    const grey = mat(0x7d848c, { metalness: 0.5, roughness: 0.5 });
    const jet = () => {
      const j = new THREE.Group();
      j.add(at(rbox(0.06, 0.04, 0.36, 0.015, grey), 0, 0, 0));
      j.add(at(cone(0.03, 0.12, grey, 8).rotateX(Math.PI / 2), 0, 0, 0.23));
      const wing = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.22, 0, -0.08), new THREE.Vector3(0.22, 0, -0.08), new THREE.Vector3(0, 0, 0.12)]), grey);
      wing.material = mat(0x7d848c, { metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
      j.add(wing);
      for (const x of [-0.035, 0.035]) j.add(at(rbox(0.008, 0.08, 0.06, 0.004, grey), x, 0.05, -0.15).rotateZ(x > 0 ? -0.35 : 0.35));
      j.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb347 })), 0, 0, -0.19)); // afterburner glow
      return j;
    };
    const jets = [jet(), jet()];
    jets[1].userData.offset = new THREE.Vector3(0.28, 0.04, -0.3);
    jets[0].userData.offset = new THREE.Vector3(0, 0, 0);
    const osprey = new THREE.Group();
    osprey.add(at(rbox(0.09, 0.08, 0.36, 0.03, mat(0x6b726d)), 0, 0, 0));
    osprey.add(at(rbox(0.5, 0.02, 0.07, 0.008, mat(0x6b726d)), 0, 0.05, 0.02));
    osprey.add(at(rbox(0.012, 0.09, 0.08, 0.004, mat(0x6b726d)), 0, 0.06, -0.16));
    const rotors = [];
    for (const x of [-0.25, 0.25]) {
      osprey.add(at(cyl(0.022, 0.022, 0.1, mat(0x6b726d), 8), x, 0.09, 0.02));
      const r = at(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.004, 24), new THREE.MeshBasicMaterial({ color: 0x3a3d42, transparent: true, opacity: 0.35 })), x, 0.145, 0.02);
      osprey.add(r);
      rotors.push(r);
    }
    for (const o of [...jets, osprey]) { o.visible = false; o.userData.air = true; g.add(o); }
    const from = new THREE.Vector3(-3.4, 1.05, 1.6);
    const to = new THREE.Vector3(3.2, 1.2, -2.2);
    const dir = to.clone().sub(from).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    return (t) => {
      const c = t % 19;
      const jk = c / 2.2; // the jets cross in 2.2 s
      for (const j of jets) {
        j.visible = jk < 1;
        if (j.visible) { j.position.lerpVectors(from, to, jk).add(j.userData.offset); j.rotation.set(0, yaw, -0.25); }
      }
      const ok = (c - 7) / 9; // the Osprey takes 9 s
      osprey.visible = ok > 0 && ok < 1;
      if (osprey.visible) {
        osprey.position.lerpVectors(new THREE.Vector3(3.2, 0.95, -1.2), new THREE.Vector3(-3.2, 0.9, 2.0), ok);
        osprey.position.y += 0.03 * Math.sin(t * 3);
        osprey.rotation.set(0, Math.atan2(-6.4, 3.4), 0);
        for (const r of rotors) r.rotation.y = t * 30;
      }
    };
  },
  lindavista(g) {
    // Linda Vista skate park, after the founder's photos: grey concrete, flowing bowls with red coping, red ledges and rails,
    // a stair set, and the rust-red truss footbridge crossing over, with palms and tall light poles. It sits on its own strip behind the courts.
    const conc = mat(0xcfccc6, { roughness: 0.95 });
    const red = mat(0xd9443a, { roughness: 0.6 });
    const rust = mat(0x7a3524, { roughness: 0.7, metalness: 0.3 });
    const SZ = -2.1;
    const P = new THREE.Group();
    P.position.set(0, 0, SZ);
    P.add(at(rbox(SIDE, 0.02, 1.25, 0.01, conc), 0, 0.01, 0));
    const bowl = (r, x, z, depth) => {
      P.add(at(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.55, depth, 36, 1, true), mat(0xbab7b1, { roughness: 0.9, side: THREE.DoubleSide })), x, depth / 2, z));
      P.add(at(new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 30), mat(0xd6c9bd)).rotateX(-Math.PI / 2), x, 0.003, z));
      const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 6, 40), red); lip.rotation.x = Math.PI / 2; lip.position.set(x, depth, z); P.add(lip);
    };
    bowl(0.34, -0.85, 0.05, 0.13); // the big kidney: two bowls run together
    bowl(0.25, -0.38, -0.12, 0.11);
    bowl(0.18, 0.05, 0.22, 0.09);
    // Street section: red ledges, a three-step stair with a red handrail, a quarter pipe with a red edge.
    for (const [x, z, w] of [[0.5, 0.35, 0.36], [0.95, -0.3, 0.3]]) { P.add(at(rbox(w, 0.06, 0.08, 0.015, conc), x, 0.03, z)); P.add(at(rbox(w, 0.012, 0.085, 0.004, red), x, 0.064, z)); }
    for (let k = 0; k < 3; k += 1) P.add(at(rbox(0.28, 0.035 * (3 - k), 0.07, 0.006, conc), 0.95, 0.0175 * (3 - k), 0.12 + 0.07 * k));
    const rail = at(rbox(0.012, 0.012, 0.24, 0.004, red), 1.1, 0.12, 0.19); rail.rotation.x = 0.4; P.add(rail);
    for (const z of [0.1, 0.28]) P.add(at(cyl(0.005, 0.005, 0.1, red, 5), 1.1, 0.07 + (0.28 - z) * 0.3, z));
    const qp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 14, 1, true, 0, Math.PI / 2), mat(0xc5c2bc, { side: THREE.DoubleSide, roughness: 0.9 }));
    qp.rotation.set(Math.PI / 2, 0, Math.PI); qp.position.set(0.45, 0.15, -0.47); P.add(qp);
    P.add(at(rbox(0.4, 0.015, 0.03, 0.005, red), 0.45, 0.3, -0.47));
    // The rust-red truss footbridge, crossing the park front to back.
    const BX = -0.12; const BL = 1.25; const BY = 0.42;
    P.add(at(rbox(0.14, 0.025, BL, 0.006, rust), BX, BY, 0));
    for (const sx of [-0.07, 0.07]) {
      P.add(at(rbox(0.01, 0.01, BL, 0.003, rust), BX + sx, BY + 0.12, 0));
      for (let k = 0; k < 8; k += 1) { const d = at(rbox(0.008, 0.13, 0.008, 0.002, rust), BX + sx, BY + 0.06, -BL / 2 + (k + 0.5) * (BL / 8)); d.rotation.x = k % 2 ? 0.55 : -0.55; P.add(d); }
    }
    for (const z of [-BL / 2 + 0.03, BL / 2 - 0.03]) P.add(at(rbox(0.16, BY, 0.05, 0.01, conc), BX, BY / 2, z));
    // Palms and tall light poles.
    const palm = (x, z, h) => {
      P.add(at(cyl(0.012, 0.018, h, mat(0x8a7356), 6), x, h / 2, z));
      for (let k = 0; k < 6; k += 1) { const f = at(rbox(0.2, 0.01, 0.045, 0.005, mat(0x3f7f4b)), x + Math.cos(k * 1.05) * 0.08, h + 0.01, z + Math.sin(k * 1.05) * 0.08); f.rotation.set(0, -k * 1.05, -0.35); P.add(f); }
    };
    palm(0.3, -0.05, 0.42); palm(1.25, 0.45, 0.5); palm(-1.3, -0.45, 0.46);
    for (const [x, z] of [[-1.3, 0.5], [0.75, -0.55]]) { P.add(at(cyl(0.008, 0.01, 0.75, mat(0xb9bdc4), 6), x, 0.375, z)); P.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff3b8 })), x, 0.76, z)); }
    // A skater carving the big bowl.
    const sk = new THREE.Group();
    sk.add(at(rbox(0.07, 0.007, 0.022, 0.003, mat(0x16181d)), 0, 0, 0));
    sk.add(at(rbox(0.018, 0.05, 0.018, 0.006, mat(0x2f6fd6)), 0, 0.03, 0));
    sk.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), mat(0xc9906a)), 0, 0.065, 0));
    P.add(sk);
    g.add(P);

    // The police helicopter: every 26 s it circles low over the courts for 15 s, searchlight sweeping the ground.
    const heli = new THREE.Group();
    const black = mat(0x1b1d22, { metalness: 0.3, roughness: 0.5 });
    heli.add(at(rbox(0.12, 0.09, 0.22, 0.04, black), 0, 0, 0));
    heli.add(at(rbox(0.122, 0.035, 0.12, 0.012, mat(0xf4f4f0)), 0, -0.02, 0.03)); // white doors
    heli.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0x9fc4dd, roughness: 0.1 })), 0, 0.005, 0.11));
    heli.add(at(rbox(0.025, 0.025, 0.26, 0.008, black), 0, 0.02, -0.22));
    heli.add(at(rbox(0.008, 0.07, 0.05, 0.003, black), 0, 0.05, -0.34));
    for (const x of [-0.05, 0.05]) heli.add(at(rbox(0.008, 0.008, 0.24, 0.003, black), x, -0.065, 0.01));
    const blade = new THREE.Group();
    blade.add(at(rbox(0.5, 0.004, 0.02, 0.002, black), 0, 0, 0));
    blade.add(at(rbox(0.02, 0.004, 0.5, 0.002, black), 0, 0, 0));
    blade.position.y = 0.075;
    heli.add(blade);
    const tail = at(rbox(0.004, 0.09, 0.012, 0.002, black), 0.015, 0.05, -0.34);
    heli.add(tail);
    const flash = [at(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2b2b })), -0.06, 0.05, 0.02), at(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: 0x2b6bff })), 0.06, 0.05, 0.02)];
    flash.forEach((f) => heli.add(f));
    const beamH = 1.3;
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.28, beamH, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = -beamH / 2 - 0.05;
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.35, depthWrite: false }));
    spot.rotation.x = -Math.PI / 2;
    heli.add(beam);
    heli.userData.air = true; spot.userData.air = true;
    g.add(heli, spot);
    return (t) => {
      const a = t * 2.3;
      sk.position.set(-0.85 + Math.cos(a) * 0.24, 0.02 + 0.09 * (0.5 + 0.5 * Math.sin(a * 2)), 0.05 + Math.sin(a) * 0.24);
      sk.rotation.set(0, -a, 0.3);
      sk.position.add(P.position);
      sk.position.sub(P.position);
      const c = t % 26;
      const on = c < 15;
      heli.visible = on; spot.visible = on;
      if (!on) return;
      const ease = Math.min(1, c / 2, (15 - c) / 2); // swoops in and out
      const ang = c * 0.5;
      const R = 1.15 + (1 - ease) * 2.5;
      heli.position.set(Math.cos(ang) * R, 1.15 + (1 - ease) * 0.6, Math.sin(ang) * R - 0.4);
      heli.rotation.set(0.12, -ang, 0.18);
      blade.rotation.y = t * 40;
      flash[0].visible = Math.floor(t * 4) % 2 === 0; flash[1].visible = !flash[0].visible;
      // The light points down and leans toward the middle of the courts.
      const gx = heli.position.x * 0.45 + 0.15 * Math.sin(t * 1.7); const gz = heli.position.z * 0.45 - 0.2 + 0.15 * Math.cos(t * 1.3);
      spot.position.set(gx, 0.05, gz);
      spot.material.opacity = 0.35 * ease;
      beam.material.opacity = 0.18 * ease;
    };
  },

  balboa(g) { g.add(at(rbox(0.16, 1.1, 0.16, 0.02, mat(0xe8d9b8)), -1.18, 0.55, -1.18)); g.add(at(cone(0.14, 0.24, mat(0xc2562b), 4), -1.18, 1.22, -1.18).rotateY(Math.PI / 4)); },
  roosevelt(g) {
    // The concrete hitting walls along the back: a run of arches, like an old aqueduct, with a flat face toward the courts.
    const concrete = mat(0xe8e3d8, { roughness: 0.95 });
    const AZ = -1.27; const ax0 = -0.75; const bay = 0.36; const bays = 5;
    g.add(at(rbox(bay * bays + 0.08, 0.07, 0.16, 0.015, concrete), ax0 + (bay * bays) / 2, 0.36, AZ));
    for (let k = 0; k <= bays; k += 1) g.add(at(rbox(0.07, 0.36, 0.16, 0.01, concrete), ax0 + k * bay, 0.18, AZ));
    for (let k = 0; k < bays; k += 1) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(bay / 2 - 0.035, 0.035, 6, 16, Math.PI), concrete);
      arch.position.set(ax0 + bay / 2 + k * bay, 0.2, AZ);
      g.add(arch);
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(bay - 0.07, 0.05, 0.16), concrete), ax0 + bay / 2 + k * bay, 0.31, AZ));
    }
    g.add(at(rbox(0.09, 0.95, 0.09, 0.03, mat(0xe9b535)), -1.15, 0.6, -1.2).rotateZ(rad(-7)));
    g.add(at(rbox(0.22, 0.11, 0.11, 0.04, mat(0xe9b535)), -1.03, 1.1, -1.2));
    // The zoo side: a strip of zoo ground off the tile's back-left edge, a train line on it, and elephants beyond the tracks.
    const zooFrom = g.children.length; // everything from here on is the zoo strip, laid along the back edge below
    const ZX = -1.82; // center of the strip, kept narrow
    g.add(at(rbox(0.72, 0.02, SIDE, 0.01, mat(0x8fae6a)), ZX, 0.01, 0));
    const RAIL_X = -1.63;
    for (const dx of [-0.04, 0.04]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, SIDE - 0.1), mat(0x6b6f78, { metalness: 0.6, roughness: 0.4 })), RAIL_X + dx, 0.012, 0));
    for (let z = -1.36; z <= 1.37; z += 0.11) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, 0.028), mat(0x6a4a2c)), RAIL_X, 0.005, z));
    // Tunnels at both ends, so the train comes from somewhere and goes somewhere.
    for (const z of [-1.3, 1.3]) {
      g.add(at(rbox(0.22, 0.18, 0.16, 0.05, mat(0x7a6a52)), RAIL_X, 0.09, z));
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.17), new THREE.MeshBasicMaterial({ color: 0x15130f })), RAIL_X, 0.06, z));
    }
    const train = new THREE.Group();
    const engine = new THREE.Group();
    engine.add(at(rbox(0.13, 0.11, 0.26, 0.03, mat(0xd13a2f, { roughness: 0.5 })), 0, 0.075, 0));
    engine.add(at(rbox(0.13, 0.09, 0.1, 0.02, mat(0xd13a2f, { roughness: 0.5 })), 0, 0.17, 0.07));
    engine.add(at(cyl(0.022, 0.03, 0.09, ink, 10), 0, 0.17, -0.07));
    engine.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.035, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff3b8 })), 0, 0.19, 0.07));
    train.add(engine);
    const cars = [engine];
    [0xe9b535, 0x2f8f5a, 0xe9b535].forEach((c, k) => {
      const car = new THREE.Group();
      car.add(at(rbox(0.13, 0.08, 0.22, 0.025, mat(c, { roughness: 0.6 })), 0, 0.06, 0));
      car.add(at(rbox(0.14, 0.015, 0.24, 0.006, mat(0xf4f1ea)), 0, 0.2, 0));
      for (const x of [-0.055, 0.055]) for (const z of [-0.08, 0.08]) car.add(at(cyl(0.007, 0.007, 0.1, ink, 5), x, 0.15, z));
      car.position.z = 0.27 * (k + 1);
      train.add(car);
      cars.push(car);
    });
    train.position.set(RAIL_X, 0, 0);
    train.scale.setScalar(0.68);
    g.add(train);
    // Elephants walk the far side, slower and the other way.
    const hide = mat(0x8d8f97, { roughness: 0.9 });
    const elephants = [0, 1, 2].map((k) => {
      const e = new THREE.Group();
      const s = k === 2 ? 0.62 : 1; // the last one is a calf
      e.add(at(rbox(0.16, 0.14, 0.27, 0.06, hide), 0, 0.17, 0));
      e.add(at(rbox(0.14, 0.13, 0.12, 0.05, hide), 0, 0.22, 0.17));
      const trunk = at(cyl(0.022, 0.014, 0.16, hide, 8), 0, 0.14, 0.24);
      trunk.rotation.x = rad(-12);
      e.add(trunk);
      for (const x of [-0.085, 0.085]) e.add(at(rbox(0.02, 0.11, 0.1, 0.01, mat(0x9fa1aa)), x, 0.22, 0.14));
      const legs = [];
      for (const [x, z] of [[-0.05, -0.08], [0.05, -0.08], [-0.05, 0.08], [0.05, 0.08]]) {
        const leg = at(cyl(0.026, 0.026, 0.12, hide, 8), x, 0.06, z);
        e.add(leg);
        legs.push(leg);
      }
      e.scale.setScalar(s * 0.62);
      e.userData = { legs, offset: k * 0.62 + (k === 2 ? 0.08 : 0) };
      e.rotation.y = Math.PI; // walking toward -z
      g.add(e);
      return e;
    });
    // Lay the zoo strip along the back edge (it was drawn running front to back) so it fits behind the court.
    const zoo = new THREE.Group();
    for (const o of g.children.slice(zooFrom)) zoo.add(o);
    zoo.rotation.y = -Math.PI / 2;
    g.add(zoo);
    const span = SIDE - 0.4;
    const LAP = 9; // seconds for the train to cross
    return (t) => {
      // Train: crosses from tunnel to tunnel, cars hidden while inside one.
      const head = -span / 2 + ((t / LAP) % 1) * (span + 1.2) - 0.6;
      for (const [k, c] of cars.entries()) {
        const z = head - 0.27 * 0.68 * k;
        c.position.z = z / 0.68;
        c.visible = z > -1.2 && z < 1.2;
        c.position.y = 0.006 * Math.sin(t * 22 + k);
      }
      // Elephants: a slow loop the other way, legs swinging in diagonal pairs.
      for (const e of elephants) {
        const p = ((t / 26 + e.userData.offset / span) % 1);
        e.position.set(-1.96, 0, span / 2 - p * span);
        e.visible = p > 0.02 && p < 0.98;
        const sw = Math.sin(t * 5 + e.userData.offset * 7);
        e.userData.legs.forEach((leg, j) => { leg.rotation.x = 0.35 * sw * (j === 0 || j === 3 ? 1 : -1); });
        e.position.y = 0.01 * Math.abs(sw);
      }
    };
  },
  northpark(g) {
    // The North Park water tower: silver-green riveted tank, rust cone roof with antenna masts, green bowl, green lattice legs.
    const T = new THREE.Group();
    T.position.set(-1.0, 0, -1.0);
    const green = mat(0x3f8f62, { metalness: 0.4, roughness: 0.5 });
    const silver = mat(0xb9c4bd, { metalness: 0.55, roughness: 0.45 });
    const LEG_R = 0.27; const TOP = 0.78;
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      const leg = at(rbox(0.035, TOP, 0.035, 0.008, green), Math.cos(a) * LEG_R, TOP / 2, Math.sin(a) * LEG_R);
      T.add(leg);
    }
    for (const y of [0.35, 0.72]) { const band = new THREE.Mesh(new THREE.TorusGeometry(LEG_R, 0.009, 6, 32), green); band.rotation.x = Math.PI / 2; band.position.y = y; T.add(band); }
    for (let k = 0; k < 8; k += 1) { // cross bracing between neighbouring legs
      const a = ((k + 0.5) / 8) * Math.PI * 2;
      const br = at(cyl(0.004, 0.004, 0.52, ink, 4), Math.cos(a) * LEG_R * 0.98, 0.54, Math.sin(a) * LEG_R * 0.98);
      br.rotation.set(0, -a, rad(38));
      T.add(br);
    }
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.31, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), green);
    bowl.position.y = TOP + 0.02; bowl.scale.y = 0.7; T.add(bowl);
    const walk = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.012, 6, 36), green); walk.rotation.x = Math.PI / 2; walk.position.y = TOP + 0.03; T.add(walk);
    const tank = at(cyl(0.31, 0.31, 0.42, silver, 28), 0, TOP + 0.23, 0); T.add(tank);
    for (const y of [0.1, 0.2, 0.3]) { const seam = new THREE.Mesh(new THREE.TorusGeometry(0.312, 0.004, 4, 36), mat(0x9aa69f)); seam.rotation.x = Math.PI / 2; seam.position.y = TOP + 0.02 + y + 0.03; T.add(seam); }
    const roof = at(cone(0.35, 0.17, mat(0x7a4a32, { roughness: 0.9 }), 28), 0, TOP + 0.52, 0); T.add(roof);
    T.add(at(cyl(0.035, 0.035, 0.04, silver, 10), 0, TOP + 0.62, 0));
    for (let k = 0; k < 6; k += 1) { const a = (k / 6) * Math.PI * 2 + 0.3; T.add(at(cyl(0.004, 0.004, 0.26 + 0.08 * (k % 2), mat(0xf4f4f0), 4), Math.cos(a) * 0.27, TOP + 0.6 + 0.04 * (k % 2), Math.sin(a) * 0.27)); }
    g.add(T);
    // An aircraft light blinking on the tallest mast.
    const beacon = at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b2f })), Math.cos(0.3 + Math.PI / 3) * 0.27, TOP + 0.79, Math.sin(0.3 + Math.PI / 3) * 0.27);
    T.add(beacon);
    return (t) => { beacon.visible = t % 1.6 < 0.25; };
  },

};

/**
 * The world under the tiles: the ground around the court you are on, filling the whole screen beneath the floating arenas. Only the
 * current venue's world is up; hopping drops the old one away into the paper and raises the next. Nothing here is bound by the tile.
 * Each world is built facing the camera: local x runs to screen right, local -z runs up the screen (away from you).
 */
const WORLD_Y = 0.09; // the place's ground, just under the court
const CLEAR = 1.5; // nothing grows or stands within this of the court (the old tile hid what was under it)
const NEAR = 3.2; // no flat lots or lawns within this: the ground around the court is just the place's ground
const AWAY = 0.001; // the arenas you are not on shrink away to nothing: there is one stage, and one court on it at a time
const facing = () => { const f = new THREE.Group(); f.rotation.y = Math.PI / 4; return f; };

/**
 * Building blocks for the worlds, in a facing frame (x to screen right, -z up the screen, ground at y 0). One unit is about 16 m,
 * the same scale as the arenas. On a phone the ground shows roughly from x -3 to 3: a band across the top (z below -7.5), strips
 * either side of the arena, and a little under it (z above -2). Everything is also laid out well past that so no edge ever shows.
 * Trees and houses are instanced so a whole neighbourhood is a handful of draw calls.
 */
/**
 * The worlds were drawn as backdrops behind a tile that hid their front half, so that half is bare. Now the court sits on the
 * ground, fill it with the world's own back half, mirrored across the court (camera side), and kept 3 units off it so nothing
 * stands between you and the court.
 */
const frontOf = (items) => items.filter(([x, z]) => x + z < -1).map(([x, z, ...rest]) => [-z, -x, ...rest]).filter(([x, z]) => Math.hypot(x, z) > 3);

/**
 * The court pops up in the middle of its place, so the place gives it room: anything that overlaps where the court and its
 * people stand (the court, its lights, the strip either side where friends wait) is taken out. Ground that covers the whole
 * spot stays; that is what the court stands on.
 */
const SHIFT = { barnes: CAM.clone().multiplyScalar(-6) };
const SPOT = new THREE.Box3(new THREE.Vector3(-1.35, -1, -1.2), new THREE.Vector3(1.35, 5, 1.2));
function clearSpot(world) {
  world.updateMatrixWorld(true);
  const box = new THREE.Box3();
  // Walk down to things: a mesh, or a small group that is one thing (a car, a bench). Big groups are containers: look inside.
  const visit = (o) => {
    if (o.isInstancedMesh) return; // trees and houses already keep clear (CLEAR)
    box.setFromObject(o);
    if (box.isEmpty() || !box.intersectsBox(SPOT)) return;
    const w = box.max.x - box.min.x; const d = box.max.z - box.min.z;
    if (!o.isMesh && (w > 3 || d > 3)) { [...o.children].forEach(visit); return; }
    // Flat ground running under the middle of the court (a lawn, Barnes's beach) is what it stands on: it stays.
    const ground = box.max.y - box.min.y < 0.35 && box.min.x < 0 && box.max.x > 0 && box.min.z < 0 && box.max.z > 0;
    if (!ground) o.visible = false;
  };
  [...world.children].forEach(visit);
}

function worldKit(B, g, seed0) {
  let seed = seed0;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const movers = [];
  const anims = [];
  const flat = (color, x0, x1, z0, z1, y) => B.add(at(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.02, z1 - z0), mat(color, { roughness: 1 })), (x0 + x1) / 2, y - 0.01, (z0 + z1) / 2));
  const k = {
    rnd,
    ground(color) { B.add(at(new THREE.Mesh(new THREE.PlaneGeometry(70, 70).rotateX(-Math.PI / 2), mat(color, { roughness: 1 })), 0, 0, -12)); },
    // A flat patch (a lot, a lawn) beside the court is left out; one the court stands on (it covers the middle) is its ground.
    patch(color, x0, x1, z0, z1, y = 0.01) {
      const near = !(x1 < -NEAR || x0 > NEAR || z1 < -NEAR || z0 > NEAR);
      const under = x0 < 0 && x1 > 0 && z0 < 0 && z1 > 0;
      if (!near || under) flat(color, x0, x1, z0, z1, y);
    },
    /** A road along z (at x = c) or along x (at z = c), with a dashed center line; `cars` drive both ways. */
    road(axis, c, a0, a1, cars = 0, width = 0.5) {
      const len = a1 - a0; const mid = (a0 + a1) / 2;
      if (axis === 'z') flat(0x4b4e56, c - width / 2, c + width / 2, a0, a1, 0.02); else flat(0x4b4e56, a0, a1, c - width / 2, c + width / 2, 0.02);
      for (let d = a0 + 0.1; d < a1; d += 0.34) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(axis === 'z' ? 0.03 : 0.17, 0.004, axis === 'z' ? 0.17 : 0.03), new THREE.MeshBasicMaterial({ color: 0xe9c46a }));
        dash.position.set(axis === 'z' ? c : d, 0.032, axis === 'z' ? d : c);
        B.add(dash);
      }
      const palette = [0xd9443a, 0xf4f1ea, 0x2f6fd6, 0x2a2d35, 0xe9b535, 0x8a8f99, 0x3f8f62];
      for (let n = 0; n < cars; n += 1) {
        const car = new THREE.Group();
        const col = palette[Math.floor(rnd() * palette.length)];
        car.add(at(rbox(0.13, 0.06, 0.28, 0.02, mat(col, { roughness: 0.4, metalness: 0.2 })), 0, 0.05, 0));
        car.add(at(rbox(0.11, 0.05, 0.14, 0.02, mat(0x2a2d35, { roughness: 0.3 })), 0, 0.1, -0.01));
        const dir = n % 2 ? 1 : -1;
        if (axis === 'x') car.rotation.y = Math.PI / 2;
        B.add(car);
        movers.push({ car, axis, c: c + dir * width * 0.22, a0, len, dir, speed: 0.7 + rnd() * 0.5, off: rnd() * len });
      }
      return mid;
    },
    /**
     * Instanced trees. 'euc' is a eucalyptus: a tall, thin, pale trunk that leans, bare most of the way up, with a few small
     * drooping blue-grey clumps hung high and off to the sides. 'round' is a park shade tree: short trunk, full rounded crown.
     */
    trees(all, kind = 'round') {
      const points = [...all, ...frontOf(all)].filter(([x, z]) => Math.max(Math.abs(x), Math.abs(z)) > CLEAR);
      const n = points.length;
      if (!n) return;
      const euc = kind === 'euc';
      const per = euc ? 4 : 2;
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(euc ? 0.016 : 0.025, euc ? 0.03 : 0.035, 1, 6).translate(0, 0.5, 0), mat(euc ? 0xe3dccd : 0x6b5236), n);
      const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 9, 7), mat(0xffffff, { roughness: 0.95 }), n * per);
      const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const c = new THREE.Color(); const e = new THREE.Euler();
      const top = new THREE.Vector3();
      points.forEach(([x, z, h], i) => {
        const lean = euc ? (rnd() - 0.5) * 0.28 : 0; const dir = rnd() * Math.PI * 2;
        q.setFromEuler(e.set(Math.cos(dir) * lean, 0, Math.sin(dir) * lean));
        const th = h * (euc ? 1.0 : 0.55);
        m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, th, 1));
        trunk.setMatrixAt(i, m);
        top.set(0, th, 0).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
        for (let j = 0; j < per; j += 1) {
          let pos; let sc; let col;
          if (euc) {
            const a = dir + j * 1.9 + rnd(); const out = 0.06 + rnd() * 0.1;
            pos = new THREE.Vector3(top.x + Math.cos(a) * out * h, top.y - (0.05 + j * 0.09 + rnd() * 0.06) * h, top.z + Math.sin(a) * out * h);
            const r = (0.07 + rnd() * 0.05) * h;
            sc = new THREE.Vector3(r * 1.1, r * 1.5, r); // hanging, longer than wide
            col = [0x7d9483, 0x8aa08c, 0x6c8574, 0x93a58f][(i + j) % 4];
          } else {
            pos = new THREE.Vector3(x + (j ? 0.08 : -0.04) * h, h * (0.62 + j * 0.12), z + (j ? -0.05 : 0.03) * h);
            const r = 0.24 * h * (j ? 0.8 : 1);
            sc = new THREE.Vector3(r, r * 0.9, r);
            col = [0x4f8a4a, 0x5f9a52, 0x3f7a44][(i + j) % 3];
          }
          m.compose(pos, new THREE.Quaternion(), sc);
          crown.setMatrixAt(i * per + j, m);
          crown.setColorAt(i * per + j, c.set(col));
        }
      });
      B.add(trunk, crown);
    },
    /** Instanced houses: [x, z, w, d, h, wall, roof]; roof is a hip roof, or flat when roof is null. */
    houses(every) {
      const list = every.filter(([x, z, w, d]) => Math.abs(x) - w / 2 > CLEAR || Math.abs(z) - d / 2 > CLEAR);
      const n = list.length;
      if (!n) return;
      const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat(0xffffff, { roughness: 0.9 }), n);
      const roofs = list.filter((h) => h[6] != null);
      const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), mat(0xffffff, { roughness: 0.9 }), Math.max(1, roofs.length));
      const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const c = new THREE.Color();
      let r = 0;
      list.forEach(([x, z, w, d, h, wall, rf], i) => {
        m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d));
        body.setMatrixAt(i, m);
        body.setColorAt(i, c.set(wall));
        if (rf != null) {
          m.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(w * 1.12, Math.min(w, d) * 0.45, d * 1.12));
          roof.setMatrixAt(r, m);
          roof.setColorAt(r, c.set(rf));
          r += 1;
        }
      });
      roof.count = r;
      B.add(body, roof);
    },
    palm(x, z, h, lean = 0) {
      const p = new THREE.Group();
      p.position.set(x, 0, z);
      let y = 0; let dx = 0;
      for (let s = 0; s < 5; s += 1) {
        const len = h / 5; const tilt = lean * (0.4 + (s / 5) * 0.9);
        const seg = at(cyl(0.022 - s * 0.002, 0.028 - s * 0.002, len * 1.05, mat(0x8a7356), 6), dx + (Math.sin(tilt) * len) / 2, y + (Math.cos(tilt) * len) / 2, 0);
        seg.rotation.z = -tilt;
        p.add(seg);
        dx += Math.sin(tilt) * len; y += Math.cos(tilt) * len;
      }
      const crown = new THREE.Group();
      crown.position.set(dx, y, 0);
      for (let f = 0; f < 7; f += 1) {
        const arm = new THREE.Group();
        arm.rotation.y = (f / 7) * Math.PI * 2 + x;
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.07).translate(0.15, 0, 0).rotateX(-Math.PI / 2), mat(0x3f7f4b, { side: THREE.DoubleSide }));
        leaf.rotation.z = -0.5 - (f % 2) * 0.2;
        arm.add(leaf);
        crown.add(arm);
      }
      p.add(crown);
      B.add(p);
      const phase = x * 3.1 + z;
      anims.push((t) => { p.rotation.z = 0.03 * Math.sin(t * 1.1 + phase); });
    },
    /** One real-size tennis court on the ground, long axis along z (or x). */
    court(x, z, colors, alongX = false) {
      const c = court({ x, z, w: COURT_L, d: COURT_L * (10.97 / 23.77), rot: alongX ? 0 : Math.PI / 2, lit: false }, M, colors);
      c.position.y = 0.01;
      B.add(c);
    },
    /** One of the venue's landmark props (from FLAVOR), centered on (x, z) at scale s. Aircraft keep flying over the tile. */
    landmark(key, x, z, s, rotY = 0) {
      const props = new THREE.Group();
      const anim = FLAVOR[key]?.(props);
      for (const o of [...props.children]) if (o.userData.air) g.add(o);
      if (anim) { anim(0); anims.push(anim); }
      const holder = new THREE.Group();
      props.rotation.y = rotY;
      holder.add(props);
      holder.scale.setScalar(s);
      holder.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(holder);
      holder.position.set(x - (bb.min.x + bb.max.x) / 2, -bb.min.y, z - (bb.min.z + bb.max.z) / 2);
      B.add(holder);
    },
    /** True where nothing should stand: under the arena (a diamond in this frame) and along the given roads/lots. */
    free(x, z, keepOut = []) {
      if (Math.abs(x) + Math.abs(z + 0.4) < 2.9) return false;
      return !keepOut.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
    },
    scatter(x0, x1, z0, z1, step, keepOut, fn) {
      for (let x = x0; x < x1; x += step) for (let z = z0; z < z1; z += step) {
        const jx = x + (rnd() - 0.5) * step * 0.6; const jz = z + (rnd() - 0.5) * step * 0.6;
        if (k.free(jx, jz, keepOut)) fn(jx, jz);
      }
    },
    anim(t) {
      for (const m of movers) {
        const a = m.a0 + ((((m.off + t * m.speed * m.dir) % m.len) + m.len) % m.len);
        if (m.axis === 'z') m.car.position.set(m.c, 0, a); else m.car.position.set(a, 0, m.c);
        m.car.rotation.y = (m.axis === 'z' ? 0 : Math.PI / 2) + (m.dir > 0 ? 0 : Math.PI);
      }
      for (const f of anims) f(t);
    },
  };
  return k;
}

/** A painted sign: text on a dark board, for place names (OCEAN BEACH, GLIDERPORT). */
function signTex(text, color, bg = '#16181d') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 112);
  g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(8, 8, 496, 96);
  g.font = '800 64px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color;
  g.fillText(text, 256, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A rubble-mound jetty like the two at the San Diego River mouth: a low trapezoid mound of dark wet rock running out from the
 * shore, packed with boulders along the crest and flanks, a rounded head at the tip, and spray that bursts at the head.
 */
function jetty(B, x, z0, z1, rnd) {
  const len = z0 - z1;
  const shape = new THREE.Shape([new THREE.Vector2(-0.22, 0), new THREE.Vector2(0.22, 0), new THREE.Vector2(0.09, 0.13), new THREE.Vector2(-0.09, 0.13)]);
  const mound = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }), mat(0x5d5850, { roughness: 1 }));
  mound.position.set(x, -0.04, z1);
  B.add(mound);
  const n = Math.floor(len / 0.045) * 4 + 40;
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat(0xffffff, { roughness: 1 }), n);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const c = new THREE.Color();
  const tones = [0x8b8478, 0x7a746a, 0x9c958a, 0x6d685f, 0xa39b8c];
  let i = 0;
  const put = (px, py, pz, r) => {
    if (i >= n) return;
    q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
    m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(r, r * (0.7 + rnd() * 0.3), r));
    rocks.setMatrixAt(i, m); rocks.setColorAt(i, c.set(tones[Math.floor(rnd() * tones.length)])); i += 1;
  };
  for (let z = z0; z > z1 + 0.1; z -= 0.045) {
    for (const [ox, oy] of [[-0.11, 0.06], [-0.04, 0.11], [0.04, 0.11], [0.11, 0.06]]) put(x + ox + (rnd() - 0.5) * 0.03, oy + rnd() * 0.02, z + (rnd() - 0.5) * 0.03, 0.035 + rnd() * 0.025);
  }
  for (let k = 0; k < 40; k += 1) { const a = rnd() * Math.PI; const r = 0.05 + rnd() * 0.14; put(x + Math.cos(a) * r, 0.04 + rnd() * 0.06, z1 + 0.1 - Math.sin(a) * r, 0.04 + rnd() * 0.03); }
  rocks.count = i;
  B.add(rocks);
  // Spray at the head: a burst of white that rises and falls back every few seconds.
  const spray = new THREE.Group();
  const drops = [];
  for (let k = 0; k < 7; k += 1) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    d.userData.v = new THREE.Vector3((rnd() - 0.5) * 0.5, 0.6 + rnd() * 0.5, -0.1 - rnd() * 0.3);
    spray.add(d); drops.push(d);
  }
  spray.position.set(x, 0.1, z1 + 0.05);
  B.add(spray);
  const phase = rnd() * 4;
  return (t) => {
    const u = ((t + phase) % 4.2) / 1.1; // a burst, then calm
    spray.visible = u < 1;
    if (!spray.visible) return;
    for (const d of drops) {
      const v = d.userData.v;
      d.position.set(v.x * u, v.y * u - 0.9 * u * u, v.z * u);
      d.scale.setScalar(0.6 + u);
      d.material.opacity = 0.85 * (1 - u);
    }
  };
}

/** Surfers sitting on their boards in the lineup, rising and falling with the swell `swell(x, z, t)`. */
function surfers(B, spots, y0, swell) {
  const list = spots.map(([x, z], k) => {
    const s = new THREE.Group();
    s.add(at(rbox(0.05, 0.012, 0.2, 0.006, mat([0xf4f1ea, 0xe9b535, 0xd9443a, 0x7ec8e3][k % 4], { roughness: 0.5 })), 0, 0, 0));
    s.add(at(rbox(0.035, 0.06, 0.03, 0.012, mat(0x16181d)), 0, 0.04, 0.01));
    s.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), mat(0x8a5a3c)), 0, 0.085, 0.01));
    s.position.set(x, y0, z);
    s.rotation.y = (k * 1.7) % 1 - 0.5;
    B.add(s);
    return { s, x, z };
  });
  return (t) => { for (const { s, x, z } of list) { s.position.y = y0 + swell(x, z, t) + 0.01; s.rotation.z = 0.15 * Math.sin(t * 1.3 + x); } };
}

const WORLD = {
  ucsd(w, g) {
    // UCSD North: courts in a eucalyptus grove on the mesa. Up the screen, the mesa ends at the sandstone cliffs: the Torrey
    // Pines Gliderport on the edge with paragliders riding the lift over the drop, Black's Beach at the bottom with surfers
    // in the lineup, and the Pacific. Concrete campus buildings in the trees, a bronze Triton with his trident in a plaza,
    // North Torrey Pines Road with traffic, and the air station's jets overhead.
    const B = facing(); w.add(B);
    const k = worldKit(B, g, 11);
    const EDGE = -9.4; const DROP = 1.0;
    k.patch(0xa39b78, -40, 40, EDGE, 30, 0.0); // the mesa
    // The cliff face: sandstone with darker strata, dropping to the beach.
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(80, DROP, 0.3), mat(0xd9a86c, { roughness: 1 })), 0, -DROP / 2, EDGE - 0.15));
    for (const [y, c] of [[-0.25, 0xc28e58], [-0.55, 0xe3b981], [-0.8, 0xb98250]]) B.add(at(new THREE.Mesh(new THREE.BoxGeometry(80, 0.07, 0.31), mat(c, { roughness: 1 })), 0, y, EDGE - 0.15));
    k.patch(0xe8d6ad, -40, 40, EDGE - 1.0, EDGE - 0.3, -DROP); // Black's Beach
    const sea = new THREE.PlaneGeometry(80, 40, 60, 30).rotateX(-Math.PI / 2);
    const rest = Float32Array.from(sea.attributes.position.array);
    B.add(at(new THREE.Mesh(sea, mat(0x3f8fbf, { roughness: 0.25, metalness: 0.1 })), 0, -DROP - 0.02, EDGE - 1.0 - 20));
    const swell = (x, z, t) => 0.025 * Math.sin(x * 2 + t * 1.2) + 0.015 * Math.sin(x * 4 - z * 3 + t * 2);
    // Waves rolling in to the beach.
    const breakers = [0, 1, 2].map(() => { const f = new THREE.Mesh(new THREE.BoxGeometry(80, 0.01, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); B.add(f); return f; });
    const lineup = surfers(B, [[-1.6, EDGE - 1.6], [-0.9, EDGE - 1.9], [0.2, EDGE - 1.7], [1.1, EDGE - 2.1], [-2.4, EDGE - 2.0]], -DROP - 0.01, swell);
    // The gliderport: a dirt pad on the cliff edge, a little clubhouse, a windsock, and its sign.
    k.patch(0xc8b48a, 0.5, 3.4, EDGE, EDGE + 1.4, 0.012);
    k.houses([[2.6, EDGE + 0.9, 0.5, 0.35, 0.16, 0xf0e6d2, 0x7a3a2a]]);
    B.add(at(cyl(0.006, 0.006, 0.36, ink, 5), 1.0, 0.18, EDGE + 0.3));
    const sock = at(cone(0.03, 0.14, mat(0xe2562f), 10), 1.0, 0.34, EDGE + 0.3);
    B.add(sock);
    const gsign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.135), new THREE.MeshBasicMaterial({ map: signTex('GLIDERPORT', '#ffb347') }));
    gsign.position.set(1.8, 0.22, EDGE + 1.3); B.add(gsign);
    for (const x of [1.52, 2.08]) B.add(at(cyl(0.006, 0.006, 0.16, ink, 4), x, 0.08, EDGE + 1.29));
    // Paragliders riding the ridge lift, and one hang glider.
    const wingColors = [0xe2562f, 0x2f6fd6, 0xe9b535, 0x9b6bff];
    const gliders = wingColors.map((col, n) => {
      const p = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 16, Math.PI * 0.75), mat(col, { roughness: 0.6, side: THREE.DoubleSide }));
      canopy.rotation.z = Math.PI * 0.125; canopy.scale.set(1, 0.5, 1.6);
      canopy.position.y = 0.2;
      p.add(canopy);
      for (const x of [-0.14, 0.14]) { const l = at(cyl(0.002, 0.002, 0.28, ink, 3), x * 0.5, 0.14, 0); l.rotation.z = x > 0 ? 0.45 : -0.45; p.add(l); }
      p.add(at(rbox(0.035, 0.05, 0.035, 0.01, mat(0x16181d)), 0, 0.0, 0));
      B.add(p);
      return { p, ph: n * 1.6 };
    });
    const hang = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, 0, 0.1), new THREE.Vector3(0.3, 0, 0.1), new THREE.Vector3(0, 0.02, -0.22)]), mat(0xf4f1ea, { side: THREE.DoubleSide }));
    B.add(hang);
    // Triton: an original bronze figure on a stone pedestal in a paved plaza, coiled fish tail, trident raised.
    const T = new THREE.Group();
    const bronze = mat(0x5f7d66, { metalness: 0.5, roughness: 0.45 });
    T.add(at(cyl(0.14, 0.16, 0.16, mat(0xd9d2c4), 18), 0, 0.08, 0));
    const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(0.04, 0.3, 0.02), new THREE.Vector3(0.09, 0.22, -0.04), new THREE.Vector3(0.02, 0.18, -0.09), new THREE.Vector3(-0.07, 0.2, -0.03)]), 16, 0.035, 8), bronze);
    T.add(tail);
    T.add(at(cone(0.05, 0.06, bronze, 6).rotateZ(1.2), -0.1, 0.22, -0.02)); // tail fin
    T.add(at(cyl(0.04, 0.032, 0.18, bronze, 10), 0, 0.5, 0)); // torso
    T.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 10), bronze), 0, 0.63, 0)); // head
    T.add(at(cone(0.022, 0.05, bronze, 8).rotateX(Math.PI), 0, 0.59, 0.02)); // beard
    const arm = at(cyl(0.012, 0.012, 0.15, bronze, 6), 0.06, 0.62, 0); arm.rotation.z = -0.5; T.add(arm);
    T.add(at(cyl(0.006, 0.006, 0.55, bronze, 6), 0.1, 0.6, 0)); // trident shaft
    for (const x of [-0.03, 0, 0.03]) T.add(at(cone(0.008, 0.06, bronze, 5), 0.1 + x, 0.9, 0));
    T.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.01, 0.01), bronze), 0.1, 0.86, 0));
    const larm = at(cyl(0.012, 0.012, 0.13, bronze, 6), -0.06, 0.52, 0.02); larm.rotation.z = 0.9; T.add(larm);
    T.scale.setScalar(1.25);
    T.position.set(-2.3, 0, -5.4);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(0.55, 28).rotateX(-Math.PI / 2), mat(0xd9d2c4, { roughness: 0.9 }));
    plaza.position.set(-2.3, 0.015, -5.4); B.add(plaza, T);
    // Concrete campus buildings: stacked slabs with dark window bands.
    const conc = 0xcfc9bc;
    k.houses([[-2.4, -7.6, 1.0, 0.8, 0.5, conc, null], [-2.4, -7.6, 1.3, 1.0, 0.26, 0xbdb6a8, null], [-0.2, -8.3, 1.2, 0.7, 0.4, conc, null], [-4.0, -6.4, 0.9, 1.1, 0.34, conc, null]]);
    for (const [x, z, wd, y] of [[-2.4, -7.6, 1.01, 0.18], [-2.4, -7.6, 1.01, 0.38], [-0.2, -8.3, 1.21, 0.2], [-0.2, -8.3, 1.21, 0.32]]) B.add(at(new THREE.Mesh(new THREE.BoxGeometry(wd, 0.05, 0.72), mat(0x2f3540)), x, y, z));
    k.road('z', 2.35, EDGE + 1.5, 6, 4);
    k.road('x', -4.8, -10, 2.1, 2);
    const trees = [];
    k.scatter(-9, 9, EDGE + 0.3, 5, 0.5, [[2.0, 2.7, EDGE + 1.4, 7], [-10, 2.1, -5.1, -4.5], [0.4, 3.5, EDGE, EDGE + 1.5], [-3.0, -1.6, -6.1, -4.7], [-3.1, 0.5, -8.9, -7.0], [-4.6, -3.4, -7.1, -5.7]], (x, z) => trees.push([x, z, 0.9 + k.rnd() * 0.7]));
    k.trees(trees, 'euc');
    const pos = sea.attributes.position;
    return (t) => {
      k.anim(t);
      for (let i = 0; i < pos.count; i += 1) pos.array[i * 3 + 1] = swell(rest[i * 3], rest[i * 3 + 2] + EDGE - 21, t);
      pos.needsUpdate = true;
      sea.computeVertexNormals();
      breakers.forEach((f, n) => { const u = ((t / 5 + n / 3) % 1); f.position.set(0, -DROP + 0.01, EDGE - 3.2 + u * 2.2); f.material.opacity = Math.sin(Math.PI * u) * 0.8; });
      lineup(t);
      sock.rotation.z = -Math.PI / 2 + 0.15 * Math.sin(t * 2.3);
      sock.rotation.y = 0.3 * Math.sin(t * 0.7);
      for (const { p, ph } of gliders) {
        const a = t * 0.12 + ph;
        p.position.set(3.2 * Math.sin(a), 1.1 + 0.35 * Math.sin(t * 0.3 + ph), EDGE - 0.7 + 0.35 * Math.sin(a * 2));
        p.rotation.y = Math.atan2(3.2 * Math.cos(a), 0.7 * Math.cos(a * 2)) + Math.PI / 2;
        p.rotation.z = 0.25 * Math.cos(a);
      }
      const ha = t * 0.09 + 2;
      hang.position.set(-3.5 * Math.cos(ha), 1.7 + 0.2 * Math.sin(t * 0.4), EDGE - 1.0 + 0.4 * Math.sin(ha));
      hang.rotation.set(0.1, ha + Math.PI / 2, 0.3 * Math.sin(ha));
    };
  },
  lindavista(w, g) {
    // Linda Vista Community Park: the big skate park across the top, Linda Vista Road beyond it with apartments, the rec
    // center and its lot beside the courts, palms and lawn all round. The police helicopter still circles.
    const B = facing(); w.add(B);
    const k = worldKit(B, g, 23);
    k.ground(0xa9a98a);
    k.patch(0x8fae6a, -6, 6, -10.6, 4); // park lawn
    k.landmark('lindavista', 0, -8.9, 1.6);
    k.road('x', -11.4, -14, 14, 4, 0.6);
    k.road('z', 3.2, -11.1, 6, 2);
    k.patch(0x6b6e75, 1.9, 2.95, -5.2, -2.6); // the rec center lot
    for (let z = -5.0; z < -2.7; z += 0.22) B.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.02), new THREE.MeshBasicMaterial({ color: 0xf4f1ea })), 2.42, 0.024, z));
    k.houses([[-2.5, -4.2, 0.9, 1.3, 0.28, 0xd8c7a6, null], [-2.5, -4.2, 0.95, 1.35, 0.03, 0x9a7a5a, null]]); // rec center
    const apts = [];
    for (let x = -9; x < 9; x += 1.15) for (const z of [-12.6, -13.9]) apts.push([x, z, 0.95, 0.8, 0.3 + k.rnd() * 0.25, [0xe8dcc4, 0xd9c9a8, 0xf0e6d2, 0xc9b896][Math.floor(k.rnd() * 4)], null]);
    k.houses(apts);
    for (let x = -8; x < 8; x += 1.3) k.palm(x, -10.75, 0.9 + k.rnd() * 0.4, (k.rnd() - 0.5) * 0.4);
    for (let z = -6; z < 2; z += 1.4) k.palm(-2.2, z, 0.85 + k.rnd() * 0.35, (k.rnd() - 0.5) * 0.4);
    const trees = [];
    k.scatter(-9, 9, -10.4, 5, 0.9, [[-3.2, 3.2, -10.6, -7.4], [2.9, 3.5, -11, 7], [1.8, 3.0, -5.3, -2.5], [-3.1, -1.9, -5, -3.4]], (x, z) => { if (k.rnd() < 0.5) trees.push([x, z, 0.8 + k.rnd() * 0.5]); });
    k.trees(trees, 'round');
    return (t) => k.anim(t);
  },
  balboa(w, g) {
    // Balboa Tennis Club at Morley Field: courts in every direction (twenty-five of them), green windscreens, eucalyptus
    // between the blocks, the parking lot, and the California Tower rising over Balboa Park in the distance.
    const B = facing(); w.add(B);
    const k = worldKit(B, g, 37);
    k.ground(0x86a865);
    const colors = SURFACE.balboa;
    const blocks = [[-2.55, -7.2, -1.9, 4, false], [2.55, -7.2, -1.9, 4, false], [-2.4, -10.2, -8.9, 4, true], [2.4, -10.2, -8.9, 4, true]];
    const PW = COURT_L * (10.97 / 23.77) + 3.66 / M;
    const keep = [];
    // Two columns of courts beside the stadium, two rows across the top.
    for (let r = 0; r < 4; r += 1) { k.court(-2.6, -2.2 - r * (COURT_L + 0.5), colors); k.court(2.6, -2.2 - r * (COURT_L + 0.5), colors); }
    for (let c = 0; c < 5; c += 1) { k.court(-3.5 + c * (PW + 0.85), -9.0, colors, true); k.court(-3.5 + c * (PW + 0.85), -10.3, colors, true); }
    keep.push([-3.2, -2.0, -8.2, -1.2], [2.0, 3.2, -8.2, -1.2], [-5, 5, -11.2, -8.2]);
    for (const [x0, x1, z0, z1] of keep) {
      for (const [ax, x, z, len] of [['x', (x0 + x1) / 2, z0, x1 - x0], ['x', (x0 + x1) / 2, z1, x1 - x0], ['z', x0, (z0 + z1) / 2, z1 - z0], ['z', x1, (z0 + z1) / 2, z1 - z0]]) {
        B.add(at(new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? len : 0.03, 0.14, ax === 'x' ? 0.03 : len), mat(0x2b5638)), x, 0.07, z));
      }
    }
    k.road('x', -11.9, -14, 14, 3);
    k.patch(0x5d6068, -1.4, 1.4, 0.2, 2.2); // parking lot below the stadium
    k.landmark('balboa', 0.6, -15.5, 2.4);
    const trees = [];
    k.scatter(-9, 9, -15, 5, 0.6, [...keep, [-14, 14, -12.3, -11.5], [-1.5, 1.5, 0.1, 2.3], [-0.2, 1.4, -16.5, -14.5]], (x, z) => { if (k.rnd() < 0.55) trees.push([x, z, 1.0 + k.rnd() * 0.7]); });
    k.trees(trees, 'euc');
    return (t) => k.anim(t);
  },
  roosevelt(w, g) {
    // Roosevelt, behind the zoo: the concrete arched hitting walls and the zoo train with its elephants across the top,
    // zoo enclosures with ponds and rocks beyond, Park Boulevard down one side, the middle school's long buildings on the other.
    const B = facing(); w.add(B);
    const k = worldKit(B, g, 51);
    k.ground(0x7fa060);
    k.landmark('roosevelt', 0, -9.0, 1.7);
    k.road('z', 2.6, -11, 6, 4, 0.55);
    // Zoo enclosures: darker ground, a pond, rocks, a fence line.
    const pens = [[-4.4, -13.2, 2.2, 1.6], [-1.6, -13.4, 2.2, 1.8], [1.3, -13.2, 2.0, 1.6], [4.0, -13.4, 2.2, 1.8]];
    for (const [x, z, pw, pd] of pens) {
      k.patch(0x6d8a4c, x - pw / 2, x + pw / 2, z - pd / 2, z + pd / 2, 0.012);
      const pond = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20).rotateX(-Math.PI / 2), mat(0x4f9bc4, { roughness: 0.3 }));
      pond.position.set(x + 0.3, 0.02, z + 0.2); pond.scale.set(1.3, 1, 0.8); B.add(pond);
      for (let r = 0; r < 3; r += 1) B.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + k.rnd() * 0.08, 0), mat(0x9a8f80, { roughness: 1 })), x - 0.5 + k.rnd() * 0.4, 0.06, z - 0.4 + k.rnd() * 0.3));
      for (const [ax, fx, fz, len] of [['x', x, z - pd / 2, pw], ['x', x, z + pd / 2, pw], ['z', x - pw / 2, z, pd], ['z', x + pw / 2, z, pd]]) B.add(at(new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? len : 0.02, 0.08, ax === 'x' ? 0.02 : len), mat(0x6b5236)), fx, 0.04, fz));
    }
    // Roosevelt Middle School: long two-storey wings with red tile roofs, on the near-left.
    k.houses([[-2.6, -5.0, 0.7, 2.0, 0.3, 0xe8dcc4, 0xb5543a], [-2.6, -2.4, 0.7, 1.6, 0.3, 0xe8dcc4, 0xb5543a], [-3.9, -3.6, 1.2, 0.6, 0.26, 0xe8dcc4, 0xb5543a]]);
    const trees = [];
    k.scatter(-9, 9, -15, 5, 0.6, [[-3.6, 3.6, -10.4, -7.6], [2.2, 3.0, -12, 7], [-4.6, -2.1, -6.2, -1.4], [-6, 6, -14.4, -12.2]], (x, z) => { if (k.rnd() < 0.6) trees.push([x, z, 0.8 + k.rnd() * 0.6]); });
    k.trees(trees, 'round');
    return (t) => k.anim(t);
  },
  northpark(w, g) {
    // North Park: the rec center in a grid of streets lined with craftsman bungalows and palms, the gym beside the courts,
    // and the North Park water tower standing over its own little lot up the street.
    const B = facing(); w.add(B);
    const k = worldKit(B, g, 67);
    k.ground(0xc9c2b4);
    const streetsZ = [-2.25, 2.25, 6.6, -6.6]; const streetsX = [-7.4, -11.8, 1.6];
    for (const x of streetsZ) k.road('z', x, -16, 6, 2, 0.45);
    for (const z of streetsX) k.road('x', z, -12, 12, 2, 0.45);
    k.patch(0x8fae6a, -1.9, 1.9, -7.1, 1.3); // the rec center's lawn around the courts
    k.landmark('northpark', -1.5, -9.4, 1.6);
    k.houses([[0.9, -5.7, 1.4, 0.9, 0.34, 0xd9c9a8, null], [0.9, -5.7, 1.45, 0.95, 0.04, 0x8a2c34, null]]); // the gym
    const wall = [0xe8dcc4, 0xc9a96e, 0x8fa3a8, 0xd98c6a, 0x6f8a6c, 0xf0e6d2, 0xa9b8c9, 0xd9c26a];
    const roof = [0x5a4a3c, 0x6b5a4a, 0x7a3a2a, 0x4a4d55];
    const homes = [];
    k.scatter(-12, 12, -16, 6, 0.62, [[-2.6, -1.9, -17, 7], [1.9, 2.6, -17, 7], [6.2, 7, -17, 7], [-7, -6.2, -17, 7], [-13, 13, -7.7, -7.1], [-13, 13, -12.1, -11.5], [-13, 13, 1.3, 1.9], [-1.9, 1.9, -7.1, 1.3], [-2.6, -0.4, -10.6, -8.2]], (x, z) => {
      if (k.rnd() < 0.82) homes.push([x, z, 0.34 + k.rnd() * 0.12, 0.42 + k.rnd() * 0.12, 0.16 + k.rnd() * 0.08, wall[Math.floor(k.rnd() * wall.length)], roof[Math.floor(k.rnd() * roof.length)]]);
    });
    k.houses(homes);
    for (const x of streetsZ) for (let z = -15; z < 5; z += 1.9) k.palm(x + 0.34, z + k.rnd() * 0.4, 0.75 + k.rnd() * 0.35, (k.rnd() - 0.5) * 0.3);
    return (t) => k.anim(t);
  },
  barnes(w, g) {
    // Barnes sits where the San Diego River runs out to the ocean in Ocean Beach. Under its tile: the park and a row of palms,
    // then the beach and the sea. The river runs out between its two rock jetties (a sailboat heads out the channel), the OB pier
    // reaches out off the beach, and Point Loma lies across the water with the old lighthouse on top.
    const B = facing();
    w.add(B);
    const sea = new THREE.PlaneGeometry(44, 44, 88, 88).rotateX(-Math.PI / 2);
    const rest = Float32Array.from(sea.attributes.position.array);
    B.add(at(new THREE.Mesh(sea, mat(0x3f93c4, { roughness: 0.25, metalness: 0.1 })), 0, 0, -10));
    const SHORE = -3.0; // z of the waterline
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(44, 0.3, 14), mat(0x8fae6a, { roughness: 1 })), 0, -0.07, -1.6 + 7)); // park
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(44, 0.3, 1.4 + 0.3), mat(0xe8d6ad, { roughness: 1 })), 0, -0.1, (SHORE - 1.6) / 2 - 0.15)); // beach
    const RX = -2.0; // the river, running inland between the jetties
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 14), mat(0x3a86b5, { roughness: 0.3 })), RX, -0.06, SHORE + 7));
    const foam = at(new THREE.Mesh(new THREE.BoxGeometry(44, 0.01, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })), 0, 0.04, SHORE);
    B.add(foam);
    // Palms along the park edge, each swaying on its own beat.
    const trunkMat = mat(0x8a7356);
    const frondMat = mat(0x3f7f4b, { side: THREE.DoubleSide });
    const palms = [];
    for (let k = 0, x = -8.5; x < 8.5; k += 1, x += 1.05 + ((k * 0.37) % 0.4)) {
      if (Math.abs(x - RX) < 0.8) continue;
      const h = 0.95 + ((k * 0.61) % 0.35); const lean = ((k * 0.73) % 0.5) - 0.25;
      const p = new THREE.Group();
      p.position.set(x, 0.08, -1.25 - (k % 2) * 0.22);
      let y = 0; let dx = 0;
      for (let s = 0; s < 5; s += 1) {
        const len = h / 5; const tilt = lean * (0.4 + (s / 5) * 0.9);
        const seg = at(cyl(0.024 - s * 0.002, 0.03 - s * 0.002, len * 1.05, trunkMat, 6), dx + (Math.sin(tilt) * len) / 2, y + (Math.cos(tilt) * len) / 2, 0);
        seg.rotation.z = -tilt;
        p.add(seg);
        dx += Math.sin(tilt) * len; y += Math.cos(tilt) * len;
      }
      const crown = new THREE.Group();
      crown.position.set(dx, y, 0);
      for (let f = 0; f < 7; f += 1) {
        const arm = new THREE.Group();
        arm.rotation.y = (f / 7) * Math.PI * 2 + k;
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.08).translate(0.17, 0, 0).rotateX(-Math.PI / 2), frondMat);
        leaf.rotation.z = -0.5 - (f % 2) * 0.2;
        arm.add(leaf);
        crown.add(arm);
      }
      p.add(crown);
      B.add(p);
      palms.push({ p, phase: k * 1.3 });
    }
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // The jetties: two rubble mounds running out from the river mouth, spray bursting at their heads.
    const jetties = [jetty(B, RX - 0.62, SHORE + 0.5, SHORE - 4.6, rnd), jetty(B, RX + 0.62, SHORE + 0.5, SHORE - 4.4, rnd)];
    // Ocean Beach: the town on the point to the right of the channel. A beach facing the water, Abbott Street behind it,
    // a row of bright little storefronts, the OCEAN BEACH sign over the street, a lifeguard tower, and the pier off its end.
    const k = worldKit(B, g, 91);
    const OB0 = 1.6; const OBTOP = -7.2;
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, -OBTOP - 1.6), mat(0x8fae6a, { roughness: 1 })), OB0 + 5, -0.07, (OBTOP - 1.6) / 2));
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, -OBTOP - 1.6), mat(0xe8d6ad, { roughness: 1 })), OB0 + 0.2, -0.065, (OBTOP - 1.6) / 2));
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 0.5), mat(0xe8d6ad, { roughness: 1 })), OB0 + 5, -0.065, OBTOP + 0.2));
    k.road('z', OB0 + 0.62, OBTOP + 0.45, -1.6, 2, 0.32);
    const shops = [];
    const tones = [0x5fb8b0, 0xe8755a, 0xf2c14e, 0xb39ddb, 0xf4f1ea, 0x7ec8e3, 0xe86a92];
    for (let z = OBTOP + 0.7, n = 0; z < -1.9; z += 0.4, n += 1) shops.push([OB0 + 1.02, z, 0.34, 0.36, 0.2 + ((n * 0.37) % 0.14), tones[n % tones.length], null]);
    for (let z = OBTOP + 0.7, n = 3; z < -1.9; z += 0.46, n += 1) shops.push([OB0 + 1.5, z, 0.36, 0.4, 0.18 + ((n * 0.29) % 0.12), tones[n % tones.length], n % 2 ? 0x7a3a2a : null]);
    k.houses(shops);
    const obSign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.153), new THREE.MeshBasicMaterial({ map: signTex('OCEAN BEACH', '#ff6fb1') }));
    obSign.position.set(OB0 + 0.62, 0.5, OBTOP + 0.75); B.add(obSign);
    for (const dx of [-0.36, 0.36]) B.add(at(cyl(0.01, 0.01, 0.5, ink, 5), OB0 + 0.62 + dx, 0.25, OBTOP + 0.75));
    for (let z = OBTOP + 0.8; z < -2; z += 1.1) k.palm(OB0 + 0.4, z, 0.7 + k.rnd() * 0.3, (k.rnd() - 0.5) * 0.4);
    // Lifeguard tower on the beach.
    const tower = new THREE.Group();
    for (const [x, z] of [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]]) tower.add(at(cyl(0.006, 0.006, 0.2, mat(0xd9d4c9), 4), x, 0.1, z));
    tower.add(at(rbox(0.17, 0.11, 0.17, 0.02, mat(0x3a7fc4)), 0, 0.25, 0));
    tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.035, 0.175), mat(0xf4f1ea)), 0, 0.26, 0));
    tower.add(at(cone(0.13, 0.06, mat(0xf4f1ea), 4).rotateY(Math.PI / 4), 0, 0.34, 0));
    tower.position.set(OB0 + 0.2, 0.08, -5.4); B.add(tower);
    // Dog Beach, at the river mouth: dogs tearing back and forth on the sand.
    const dogs = [0x8a5a3c, 0xe9d8b4, 0x2a2d35].map((col, n) => {
      const d = new THREE.Group();
      d.add(at(rbox(0.09, 0.04, 0.04, 0.015, mat(col)), 0, 0.05, 0));
      d.add(at(rbox(0.035, 0.035, 0.035, 0.01, mat(col)), 0.055, 0.07, 0));
      for (const x of [-0.03, 0.03]) d.add(at(cyl(0.006, 0.006, 0.04, mat(col), 4), x, 0.02, 0));
      d.position.set(RX - 1.4 - n * 0.3, 0.06, SHORE + 0.5 + n * 0.25);
      B.add(d);
      return { d, n };
    });
    const lineup = surfers(B, [[0.7, -6.3], [1.15, -6.9], [0.35, -7.4], [1.0, -7.8]], 0, (x, z, t) => 0.03 * Math.sin(x * 2.2 + t * 1.3) + 0.018 * Math.sin(x * 4.5 - z * 3 + t * 2.1));
    // The OB pier: a long concrete deck on piles off the beach, a T at the end, lamps along it.
    const pierMat = mat(0xd9d4c9);
    const PX = OB0 + 0.95; const PY = 0.32; const P0 = OBTOP + 0.3; const P1 = OBTOP - 5.2;
    B.add(at(rbox(0.2, 0.05, P0 - P1, 0.01, pierMat), PX, PY, (P0 + P1) / 2));
    B.add(at(rbox(1.3, 0.05, 0.2, 0.01, pierMat), PX, PY, P1));
    for (let z = P0 - 0.3; z > P1; z -= 0.42) for (const dx of [-0.07, 0.07]) B.add(at(cyl(0.012, 0.012, PY + 0.2, pierMat, 5), PX + dx, (PY - 0.2) / 2, z));
    for (const dx of [-0.55, 0.55]) B.add(at(cyl(0.012, 0.012, PY + 0.2, pierMat, 5), PX + dx, (PY - 0.2) / 2, P1));
    for (let z = P0 - 0.8; z > P1; z -= 1.3) B.add(at(cyl(0.006, 0.006, 0.2, ink, 4), PX + 0.09, PY + 0.12, z));
    B.add(at(rbox(0.18, 0.1, 0.3, 0.015, mat(0xf4f1ea)), PX, PY + 0.07, P0 - 1.4)); // the pier cafe
    B.add(at(rbox(0.21, 0.025, 0.33, 0.01, mat(0x3a7fc4)), PX, PY + 0.13, P0 - 1.4));
    // Point Loma across the water: a long brushy ridge, the old lighthouse on its high point, its lamp blinking.
    const PL = new THREE.Group();
    PL.position.set(-3.6, 0, -11.5);
    PL.rotation.y = -0.5;
    const ridge = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7d8a55, { roughness: 1 }));
    ridge.scale.set(1.1, 0.3, 3.4);
    PL.add(ridge);
    const top = 0.29;
    PL.add(at(rbox(0.26, 0.15, 0.2, 0.015, mat(0xf4f1ea)), 0, top + 0.07, 0.4)); // keeper's house
    PL.add(at(cone(0.19, 0.1, mat(0xa0442e), 4).rotateY(Math.PI / 4), 0, top + 0.19, 0.4));
    PL.add(at(cyl(0.045, 0.05, 0.28, mat(0xf4f1ea), 10), 0, top + 0.26, 0.4));
    PL.add(at(cyl(0.05, 0.05, 0.06, ink, 10), 0, top + 0.43, 0.4));
    const lamp = at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3b8 })), 0, top + 0.43, 0.4);
    PL.add(lamp);
    PL.add(at(cone(0.06, 0.06, ink, 10), 0, top + 0.49, 0.4));
    B.add(PL);
    // A small sloop sailing out the channel between the jetties, then bearing off along the coast.
    const boat = new THREE.Group();
    boat.add(at(rbox(0.14, 0.08, 0.4, 0.04, mat(0xf4f1ea)), 0, 0.04, 0));
    boat.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.144, 0.016, 0.4), mat(0x2b4f8a)), 0, 0.012, 0));
    boat.add(at(cyl(0.008, 0.008, 0.6, mat(0xd8dade), 5), 0, 0.36, 0.04));
    const sail = (pts) => new THREE.Mesh(new THREE.BufferGeometry().setFromPoints(pts.map(([z, y]) => new THREE.Vector3(0, y, z))), mat(0xfffdf6, { side: THREE.DoubleSide, roughness: 0.7 }));
    boat.add(sail([[0.048, 0.1], [0.048, 0.64], [-0.18, 0.1]]));
    boat.add(sail([[0.032, 0.6], [0.2, 0.09], [0.032, 0.09]]));
    B.add(boat);
    const pos = sea.attributes.position;
    const swell = (x, z, t) => 0.03 * Math.sin(x * 2.2 + t * 1.3) + 0.018 * Math.sin(x * 4.5 - z * 3 + t * 2.1);
    const OUT = 24;
    return (t) => {
      for (let i = 0; i < pos.count; i += 1) pos.array[i * 3 + 1] = swell(rest[i * 3], rest[i * 3 + 2] - 10, t);
      pos.needsUpdate = true;
      sea.computeVertexNormals();
      foam.material.opacity = 0.5 + 0.35 * Math.sin(t * 1.3);
      foam.position.z = SHORE + 0.06 * Math.sin(t * 1.3);
      for (const { p, phase } of palms) p.rotation.z = 0.035 * Math.sin(t * 1.1 + phase) + 0.015 * Math.sin(t * 2.7 + phase);
      lamp.visible = t % 4 < 0.6;
      const u = (t / OUT) % 1;
      const bx = RX + Math.max(0, u - 0.45) * 6; // straight out the channel, then bears off along the coast
      const bz = SHORE + 0.6 - Math.min(u, 0.45) * 12;
      boat.position.set(bx, swell(bx, bz, t), bz);
      boat.rotation.set(0.08 * Math.sin(t * 1.3 + 1), u > 0.45 ? Math.PI / 2 : 0, 0.06 * Math.sin(t * 1.3));
      boat.visible = u > 0.02 && u < 0.97;
      k.anim(t);
      for (const j of jetties) j(t);
      lineup(t);
      for (const { d, n } of dogs) {
        const a = t * (1.4 + n * 0.3) + n * 2;
        d.position.x = RX - 1.7 + 0.55 * Math.sin(a);
        d.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
        d.position.y = 0.06 + 0.02 * Math.abs(Math.sin(a * 6));
      }
    };
  },
};

function build(data) {
  H.set(data);
  if (data.color) { youColor = data.color; pennant.userData.cloth.material.color.set(data.color); }
  venues = window.VENUES.map((v) => ({ ...v, ...(data.venues.find((d) => d.id === v.id) || {}) }));
  const L = COURT_L;
  const W = COURT_L * (10.97 / 23.77);
  const PL = L + 11 / M; // the court plus its run-off
  const PW = W + 6.4 / M;
  venues.forEach((v, i) => {
    const g = new THREE.Group();
    const base = new THREE.Vector3(0, 0.12, 0); // center stage: every court takes the same spot, on the ground, when it is up
    // No slab: the court stands straight on its place's ground, and pops up out of it when it is picked.
    const text = `${String(i + 1).padStart(2, '0')} ${v.short}`;
    const faces = [label(text, false, v.accent), label(text, true, v.accent)];
    const labelMat = new THREE.MeshBasicMaterial({ map: faces[0] });
    const signMat = new THREE.MeshBasicMaterial({ map: faces[0] }); // the right edge: the headcount sign (syncCrowd), else the name
    // No edge labels: the court sits on the ground now, so there is no tile edge to print on. (The materials stay for the swap.)
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(SIDE - 0.2, SIDE - 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(v.accent), transparent: true, opacity: 0, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.004; g.add(pad);

    // The arena: its signature court (North Park: all three, side by side) on the real bearing, walled on all four sides.
    const rot = 0; // courts sit square on the tile so the yard behind them is a known, free strip
    const count = 1; // one court per place, always
    const pitch = W + 3.66 / M; // neighbouring courts share 3.66 m of run-off
    const APW = PW + (count - 1) * pitch;
    const scaleA = count > 1 ? 0.64 : 1;
    const a = new THREE.Group();
    a.rotation.y = rot;
    a.scale.setScalar(scaleA);
    for (let k = 0; k < count; k += 1) a.add(court({ x: 0, z: (k - (count - 1) / 2) * pitch, w: L, d: W, rot: 0, lit: false }, M, SURFACE[v.key]));
    const song = v.song ? `${v.song.title.toUpperCase()}  ·  ${v.song.artist.toUpperCase()}      ` : `${v.short}      `;
    const led = board(song, v.accent);
    const boards = [];
    const boardMeshes = [];
    let backWalls = 0;
    const toWorld = (x, z) => new THREE.Vector3(x * Math.cos(rot) + z * Math.sin(rot), 0, -x * Math.sin(rot) + z * Math.cos(rot));
    for (const [nx, nz, len, px, pz, ry] of [[1, 0, APW, -PL / 2, 0, Math.PI / 2], [-1, 0, APW, PL / 2, 0, -Math.PI / 2], [0, 1, PL, 0, -APW / 2, 0], [0, -1, PL, 0, APW / 2, Math.PI]]) {
      // A wall whose inside faces the camera is a back wall: it stands tall and carries the board. The two front walls stay low.
      const back = toWorld(nx, nz).dot(CAM) > 0;
      const h = back ? 0.36 : 0.07;
      const wallColor = back ? SURFACE[v.key]?.wall ?? 0x2a2d35 : SURFACE[v.key]?.wall ?? 0xdcd6ca;
      const wall = at(rbox(len + 0.05, h, 0.05, 0.012, mat(wallColor)), px - nx * 0.025, h / 2, pz - nz * 0.025);
      wall.rotation.y = ry;
      a.add(wall);
      if (back && SURFACE[v.key]?.mural && backWalls++ === 0) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.04, 0.32), new THREE.MeshBasicMaterial({ map: mural() }));
        p.position.set(px + nx * 0.004, 0.18, pz + nz * 0.004);
        p.rotation.y = ry;
        a.add(p);
      } else if (back) {
        const tex = led.t.clone();
        tex.needsUpdate = true;
        tex.repeat.x = (len - 0.06) / led.unit;
        const p = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.06, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
        p.position.set(px + nx * 0.004, 0.22, pz + nz * 0.004);
        p.rotation.y = ry;
        p.userData.songBoard = true; // tap the board to mute or unmute the song
        boardMeshes.push(p);
        a.add(p);
        boards.push(tex);
        if (v.key === 'balboa') { // the stadium court: three rows of seating behind each back wall
          for (let k = 0; k < 3; k += 1) { const row = at(rbox(len, 0.1, 0.13, 0.015, mat(SURFACE.balboa.stands[k % 2])), px - nx * (0.12 + 0.13 * k), 0.3 + 0.1 * k, pz - nz * (0.12 + 0.13 * k)); row.rotation.y = ry; a.add(row); }
        }
      }
    }
    if (v.lights) {
      for (const [x, z] of [[PL / 2, APW / 2], [-PL / 2, APW / 2], [PL / 2, -APW / 2], [-PL / 2, -APW / 2]]) {
        a.add(at(cyl(0.014, 0.018, 0.9, ink, 8), x, 0.45, z));
        const head = at(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.09), new THREE.MeshBasicMaterial({ color: 0xfff3b8 })), x * 0.97, 0.92, z * 0.97);
        head.lookAt(0, 0.4, 0);
        a.add(head);
      }
    }
    g.add(a);
    // Everything the venue has besides its court lives in its world below, not on the tile.
    const world = new THREE.Group();
    // Some places are slid over so the court lands on their ground (Barnes: on the park, not out in the river mouth).
    const inner = new THREE.Group();
    const anim = WORLD[v.key]?.(inner, g);
    if (SHIFT[v.key]) inner.position.copy(SHIFT[v.key]);
    world.add(inner);
    clearSpot(world);
    world.visible = false;
    scene.add(world);
    // Where the player stands once inside: the baseline nearer the camera.
    const end = toWorld(L / 2 - 0.06, count > 1 ? (count - 1) / 2 * pitch : 0).multiplyScalar(scaleA);
    const spot = end.dot(CAM) > 0 ? end : end.multiplyScalar(-1);
    g.traverse((o) => { o.userData.island = i; });
    g.userData = { anim, boardMeshes, i, base, period: 3.6 + (i % 3) * 0.6, phase: i * 1.7, dip: sp(), sink: sp(), glow: 0, world, rise: sp(), size: sp(i === 0 ? 1 : AWAY), pad, labelMat, signMat, faces, boards, spot: spot.setY(0.04), shadow: blob(SIDE * 1.9, 0.5), stand: CORNER.clone() };
    scene.add(g, g.userData.shadow);
    islands.push(g);
  });
  for (let k = 0; k < DUST; k += 1) {
    const p = FWD.clone().multiplyScalar(((k * 0.137) % 1) * (venues.length + 1) * STEP - STEP).add(RIGHT.clone().multiplyScalar(((k * 0.619) % 1 - 0.5) * 9));
    dustPos.set([p.x, ((k * 0.311) % 1) * 5 - 0.5, p.z], k * 3);
  }
  const s0 = islands[0].userData.base;
  st.cam.x.x = s0.x; st.cam.y.x = s0.y; st.cam.z.x = s0.z;
  dock = createHexDock({ slots: venues.map((v, k) => ({ i: k, label: DOCK_LABEL[v.key] || v.short, color: v.accent, icon: COURT_ICONS[v.key] })), onPick: (k) => go(k), post, at: st.target });
  syncCrowd();
  paint();
  post({ type: 'stage', id: venues[0].id, anthem: venues[0].anthem });
}


// The one control on the page is the slide strip (web/lib/slide.js): slide the ball down the court to jump in.
// From home the slide first lands you (your beacon); slid again on the island you landed on, it jumps into the court to play.
const slide = createSlide({ post, onSlid: () => {
  H.cheer();
  post({ type: 'slid' });
  if (presence.mode === 'meet' && venues[st.target] && presence.you !== venues[st.target].id) setTimeout(land, 200);
  else setTimeout(enter, 260);
} });

function paint() {
  const v = venues[st.target];
  const n = venues.length;
  const pct = $('pct'); if (pct) pct.textContent = `${String(st.target + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  const fill = $('fill'); // the header meter is optional: the page may be built without it
  if (fill) { fill.style.width = `${((st.target + 1) / n) * 100}%`; fill.style.background = v.accent; }
  document.documentElement.style.setProperty('--accent', v.accent);
  $('h1').textContent = `${v.name}.`;
  $('h2').textContent = v.tagline;
  $('lights').querySelector('b').textContent = v.lights ? 'LIGHTS' : 'NO LIGHTS';
  $('lights').classList.toggle('off', !v.lights);
  $('count').querySelector('b').textContent = String(v.courts.length);
  // Stats only once there is something to say; an empty record is noise.
  $('blurb').textContent = v.played ? [`${v.played} played here`, v.king ? `king: ${v.king}` : null, `you ${v.rec}`].filter(Boolean).join(' · ') : '';
  const room = presence.venues[v.id];
  const mine = presence.you === v.id;
  if (presence.mode !== 'meet') slide.setKey(String(st.target + 1), 'JUMP IN', 'SLIDE TO PLAY HERE');
  else if (mine) slide.setKey(String(st.target + 1), 'PLAY', 'SLIDE TO KEEP SCORE');
  else slide.setKey(String(st.target + 1), 'LAND HERE', presence.you ? 'MOVES YOUR BEACON HERE' : 'SLIDE WHEN YOU ARE READY TO PLAY');
  // What the headcount plays now, and what changes next. The people themselves are in the court with their names over them.
  const who = $('who');
  if (who) {
    const demo = presence.demo && (room?.people || []).length ? '<span class="demo">STAND-INS</span>' : '';
    who.innerHTML = presence.mode === 'meet' && room
      ? `<div class="line">${esc(room.now)}${demo}</div>${room.next || mine ? `<div class="row"><span class="next">${esc(room.next)}</span>${mine ? '<button id="leave">HOP OFF</button>' : ''}</div>` : ''}`
      : '';
    const leave = $('leave');
    if (leave) leave.addEventListener('click', () => { presence.you = null; post({ type: 'leave' }); syncCrowd(); paint(); });
  }
  dock?.mark(st.target);
  const sub = $('sub'); if (sub) sub.textContent = 'your six. the song is on the wall.';
}

// The dock: one floating platform per venue in its own color. A real ball hops to the one you pick, with your fighter.
const DOCK_LABEL = { ucsd: 'UCSD', lindavista: 'L. VISTA', balboa: 'BALBOA', roosevelt: 'ROOSEVELT', northpark: 'N. PARK', barnes: 'BARNES' };
let dock = null; // the dock (web/lib/dock.js), built once the venues arrive

function go(i) {
  i = Math.max(0, Math.min(venues.length - 1, i));
  if (i === st.target) return;
  st.target = i;
  dock.hop(i);
  paint();
}
function enter() {
  if (st.hop || st.at !== st.target) { st.enterOnLand = true; return; }
  if (st.diving) return;
  // Jump in: the world narrows to this one court.
  st.diving = true;
  st.jump = { t: 0, from: standOn(st.at) };
  $('ui').classList.add('dive');
  document.body.classList.add('dive'); // the paper fades lift too, so the court fills the screen
  post({ type: 'dive' });
  const id = venues[st.at].id;
  st.pickTimer = setTimeout(() => post({ type: 'pick', id }), 2600); // long enough to actually be inside the court before moving on
}
/** One step back out: from inside the court to the arenas. Also runs when you come back here from the next screen. */
function undive() {
  clearTimeout(st.pickTimer);
  if (!st.diving) return;
  st.diving = false;
  st.jump = null;
  $('ui').classList.remove('dive');
  document.body.classList.remove('dive');
}
window.undive = undive;
// Back is always one step: out of the court if you are in one, otherwise off this screen. The app's back button calls this.
window.back = () => { if (st.diving) undive(); else post({ type: 'back' }); };
// The record beside the lights opens this court's song in Apple Music.
// Sound: the record beside the lights is the mute button (tapping the wall board does the same). It spins while the song plays.
function setMuted(m) {
  st.muted = m;
  post({ type: 'mute' });
  for (const g of islands) for (const b of g.userData.boardMeshes || []) b.material.color.setScalar(m ? 0.35 : 1);
  $('listen').classList.toggle('muted', m);
  $('lstxt').textContent = m ? 'MUTED' : 'SOUND';
  $('listen').setAttribute('aria-label', m ? 'Muted. Tap for sound.' : 'Sound on. Tap to mute.');
}
$('listen').addEventListener('click', () => setMuted(!st.muted));

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
    const hit = ray.intersectObjects(islands, true)[0];
    if (hit && hit.object.userData.songBoard) {
      setMuted(!st.muted);
      return;
    }
    if (hit && hit.object.userData.island != null) {
      const i = hit.object.userData.island;
      // Tapping the island you are on jumps in, but only where you have landed (or when picking a court): landing is the slide.
      if (i !== st.target) go(i);
      else if (presence.mode !== 'meet' || presence.you === venues[i].id) enter();
    }
  } else if (Math.abs(dy) > 44 && Math.abs(dy) > Math.abs(dx)) go(st.target + (dy < 0 ? 1 : -1));
});

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const standOn = (i) => islands[i].position.clone().add(islands[i].userData.stand.clone().setY(islands[i].userData.stand.y * Math.max(0, islands[i].userData.size.x)));

/** Where the fighter is: resting on its arena, partway through a hop, or jumping down into the court (shrinking to player size). */
function fighterAt() {
  if (st.hop) {
    const { from, b } = st.hop;
    const k = THREE.MathUtils.clamp((st.hop.t - H.crouch()) / (st.hop.dur - H.crouch()), 0, 1);
    // Between arenas there is nothing under it to shade.
    return { p: H.along(st.hop.t), size: st.you.x, shadow: k < 0.12 || k > 0.88 ? from.clone().lerp(b, k).setY(THREE.MathUtils.lerp(from.y, b.y, k) + 0.04) : null };
  }
  if (st.jump) {
    const k = THREE.MathUtils.clamp((st.jump.t - 0.09) / 0.5, 0, 1);
    const to = islands[st.at].position.clone().add(islands[st.at].userData.spot.clone().multiplyScalar(islands[st.at].userData.size.x));
    const p = st.jump.from.clone().lerp(to, k);
    p.y += 0.9 * 4 * k * (1 - k);
    return { p, size: THREE.MathUtils.lerp(st.you.x, 0.36, k * k * (3 - 2 * k)), shadow: k >= 1 ? to.clone().setY(to.y + 0.01) : null };
  }
  const p = standOn(st.at);
  return { p, size: st.you.x, shadow: p.clone().setY(p.y + 0.04) };
}

function advance(dt) {
  st.clock += dt;
  slide.step(dt);
  dock?.step(dt);
  if (!venues.length) return;
  // One jump straight to the arena you picked, sized to the gap: UCSD to Barnes crouches deep and launches high.
  if (!st.hop && st.at !== st.target) {
    const to = st.target;
    const from = standOn(st.at);
    const b = islands[to].userData.base.clone().add(islands[to].userData.stand); // where it will stand once that arena is full size
    // Changing courts: you jump straight up, the court under you lifts away, the next rises into its place, and you land on it.
    st.hop = { from, b, to, t: 0, pushed: false, dur: H.jump(from, b, 1.5) };
    post({ type: 'hop' });
  }
  if (st.hop) {
    st.hop.t += dt;
    const power = H.power();
    // The arena it pushes off sinks with the push.
    if (!st.hop.pushed && st.hop.t >= H.crouch()) { st.hop.pushed = true; const u = islands[st.at].userData; u.dip.x = 0.04 + 0.03 * power; u.dip.v = 0; }
    if (st.hop.t >= st.hop.dur) {
      st.at = st.hop.to;
      st.hop = null;
      islands[st.at].userData.dip.x = Math.min(0.3, 0.05 * (0.6 + 0.4 * power));
      H.landed(st.clock);
      post({ type: 'land' });
      if (st.at === st.target) {
        post({ type: 'stage', id: venues[st.at].id, anthem: venues[st.at].anthem });
        if (st.enterOnLand) { st.enterOnLand = false; setTimeout(enter, 280); }
      }
    }
  }
  spring(st.dive, st.diving ? 1 : 0, dt, 1.0, 1);
  // Landed: you are with people now, not travelling. The place's world drops away into the paper, the other islands sink, and the
  // camera comes in until the court fills the width (1.1 Hz, ratio 1). Hopping off, or onward, brings it all back.
  const landedNow = presence.mode === 'meet' && !!venues[st.at] && presence.you === venues[st.at].id && st.target === st.at && !(st.hop && st.hop.to !== st.at);
  spring(st.land, landedNow ? 1 : 0, dt, 1.1, 1);
  // In the court you are player-sized like everyone else; out on the tile, full size.
  spring(st.you, !st.diving && islands[st.at] && !islands[st.at].userData.stand.equals(CORNER) && (!st.hop || st.hop.to === st.at) ? YOU_IN : 1, dt, 2.2, 0.8);
  if (st.jump) st.jump.t += dt;
  // Rallies: each shot flies 0.85 s on a low arc (a serve goes up first); the one it reaches swings, and sends it back.
  for (const [i, r] of rallies) {
    if (!islands[i].visible) continue;
    r.t += dt / 0.85;
    if (r.t >= 1) { r.t -= 1; r.k = (r.k + 1) % r.hitters.length; r.hitters[r.k].hit(); }
    const a = r.hitters[r.k].pos;
    const b = r.hitters[(r.k + 1) % r.hitters.length].pos;
    const k = r.t;
    r.ball.position.set(THREE.MathUtils.lerp(a.x, b.x, k), 0.14 + (r.serve && r.k === 0 ? 0.55 : 0.32) * 4 * k * (1 - k), THREE.MathUtils.lerp(a.z, b.z, k));
  }
  for (const c of crowd.values()) {
    if (!islands[c.island].visible) continue;
    if (c.here && st.clock > c.idleAt) { c.idleAt = st.clock + 4 + Math.random() * 4; c.body.kick((Math.random() - 0.5) * 2, 2 + Math.random() * 2, 0); }
    c.body.simulate(dt, st.clock);
  }
  H.step(dt, st.clock, fighterAt().p, st.hop ? st.hop.t : null, slide.charge); // carry the jelly along its path
  for (const g of islands) {
    const u = g.userData;
    spring(u.dip, 0, dt, 2.6, 0.5);
    // The arena you are headed for grows to full size; the one you are leaving stays full size under your feet until you have
    // pushed off it, then shrinks back with the rest.
    const under = u.i === st.at && !(st.hop && st.hop.pushed);
    spring(u.size, under || u.i === (st.hop ? st.hop.to : st.at) ? 1 : AWAY, dt, 2.3, 0.45); // a springy pop, overshooting a little
    spring(u.rise, u.i === (st.hop ? st.hop.to : st.at) && !landedNow ? 1 : 0, dt, 0.9, 1); // the ground of where you are rises; the last one falls away
    spring(u.sink, (st.diving || landedNow) && u.i !== st.at ? 1 : 0, dt, 1.4, 0.9);
    for (const tex of u.boards) tex.offset.x += dt * 0.07 * tex.repeat.x;
    u.glow += ((u.i === st.target ? 1 : 0) - u.glow) * Math.min(1, dt / 0.08);
  }
  // The camera rides along with a jump (and rises with it, so a big one stays in frame); at rest it sits on the arena.
  let focus = islands[st.at].position;
  if (st.hop) {
    const f = fighterAt().p;
    const k = THREE.MathUtils.clamp((st.hop.t - H.crouch()) / (st.hop.dur - H.crouch()), 0, 1);
    const ground = THREE.MathUtils.lerp(islands[st.at].position.y, islands[st.hop.to].position.y, k);
    focus = new THREE.Vector3().lerpVectors(islands[st.at].position, islands[st.hop.to].position, k).setY(ground + 0.15 * Math.max(0, f.y - ground));
  }
  const camHz = st.hop ? 2.4 : 1.3; // keeps up with a jump, settles softly after
  spring(st.cam.x, focus.x, dt, camHz, 1);
  spring(st.cam.y, focus.y, dt, camHz, 1);
  spring(st.cam.z, focus.z, dt, camHz, 1);
  for (let k = 0; k < DUST; k += 1) {
    dustPos[k * 3 + 1] += (0.05 + ((k * 0.73) % 1) * 0.07) * dt;
    if (dustPos[k * 3 + 1] > 4.6) dustPos[k * 3 + 1] = -0.6;
  }
}

function pose() {
  if (!venues.length) return;
  const t = st.clock;
  for (const g of islands) {
    const u = g.userData;
    g.position.copy(u.base);
    g.scale.set(1, u.size.x, 1); // pops up out of the ground (and sinks back into it); never shrinks across
    u.shadow.scale.setScalar(u.size.x);
    g.position.y += -u.dip.x - 7 * u.sink.x; // on the ground: no bob
    g.visible = u.sink.x < 0.97 && u.size.x > 0.01;
    u.world.position.set(u.base.x, WORLD_Y - 12 * (1 - u.rise.x), u.base.z);
    u.world.visible = u.rise.x > 0.01;
    if (u.anim && (g.visible || u.world.visible)) u.anim(t);
    u.pad.material.opacity = 0; // no tinted square around the court: it stands on plain ground
    u.shadow.material.opacity = 0; // on the ground, nothing below to shade
    const lit = u.glow > 0.5 ? 1 : 0;
    if (u.labelMat.map !== u.faces[lit]) { u.labelMat.map = u.faces[lit]; u.labelMat.needsUpdate = true; }
    if (!u.signMat.userData.live && u.signMat.map !== u.faces[lit]) { u.signMat.map = u.faces[lit]; u.signMat.needsUpdate = true; }
    u.shadow.position.set(g.position.x + 0.5, WORLD_Y + 0.12, g.position.z + 0.5);
  }
  const f = fighterAt();
  mascot.scale.setScalar(f.size);
  H.render(t, f.p, st.hop ? st.hop.t : null);
  footShadow.visible = f.shadow != null;
  if (f.shadow) footShadow.position.copy(f.shadow);
  footShadow.scale.setScalar(f.size * 0.75);
  footShadow.material.opacity = 0.7;
  for (const c of crowd.values()) if (islands[c.island].visible) c.body.render(t + c.island);
  // Name tags over the people on the island you are looking at; the far islands are just little figures.
  const showTags = !st.diving && !st.hop;
  const tmp = new THREE.Vector3();
  for (const c of crowd.values()) {
    const on = showTags && c.island === st.target && islands[c.island].userData.size.x > 0.9;
    c.tag.style.opacity = on ? '1' : '0';
    if (!on) continue;
    c.holder.getWorldPosition(tmp);
    tmp.y += 0.62 * islands[c.island].userData.size.x;
    tmp.project(camera);
    c.tag.style.transform = `translate(${((tmp.x + 1) / 2) * window.innerWidth}px,${((1 - tmp.y) / 2) * window.innerHeight}px) translate(-50%,-100%)`;
  }
  if (pennant.visible) pennant.userData.cloth.rotation.y = 0.35 * Math.sin(t * 3.1);
  slide.render(t);
  dock?.render();
  dustGeo.attributes.position.needsUpdate = true;

  // Camera. Outside: high and back, so the path of arenas reads. Inside (z = 1): low and close over the baseline, slowly circling the court.
  const z = THREE.MathUtils.clamp(st.dive.x, 0, 1);
  const orbit = rad(0.6) * Math.sin((t * Math.PI * 2) / 9) + z * rad(7) * Math.sin((t * Math.PI * 2) / 11);
  const look = new THREE.Vector3(st.cam.x.x, st.cam.y.x + 0.2 * (1 - z) + 0.08 * z, st.cam.z.x);
  const narrow = camera.aspect < 0.62 ? 1 : 0.84;
  const dir = new THREE.Vector3(Math.sin(rad(45) + orbit), THREE.MathUtils.lerp(0.82, 0.4, z), Math.cos(rad(45) + orbit)).normalize();
  camera.position.copy(look).add(dir.multiplyScalar(THREE.MathUtils.lerp(THREE.MathUtils.lerp(14 * narrow, 12, st.land.x), 4.5, z)));
  camera.lookAt(look);
  // Inside, the frame drops so the court sits mid-screen and the walls and lights fill the top, not empty tile at the bottom.
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, window.innerHeight * (0.1 * (1 - z) - 0.16 * z), window.innerWidth, window.innerHeight);
  sun.position.copy(look).add(new THREE.Vector3(-5, 9, 4));
  sun.target.position.copy(look);
  sun.target.updateMatrixWorld();
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
window.setCourts = build;
window.demoRoosevelt = () => setTimeout(() => go(3), 800);
window.demoNorthPark = () => setTimeout(() => go(4), 800);
window.demoUcsd = () => {};
window.demoLv = () => setTimeout(() => go(1), 800);
window.demoBarnes = () => setTimeout(() => go(5), 800);
window.demoCourts = () => { [1, 2, 3, 4].forEach((i, k) => setTimeout(() => go(i), 1500 + k * 2300)); setTimeout(() => go(2), 11500); setTimeout(() => window.demoSlide(0.95), 14000); };
post({ type: 'ready' });
window.courtsState = () => st; // test hook: headless stills read the hop and dive state
