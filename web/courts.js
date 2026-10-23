// Courts: six places, each its own world. Each shows the venue's courts at regulation size, fenced, with the venue's song along
// the back windscreen, and the place around them (cliffs and ocean, skate park, zoo, streets, river mouth) built at real size in
// meters, so a 24 m court, a 10 m house and a 2 m player all read true. Picking another place swaps the whole world.
// Same paper, ink and clay language as web/home.js.
//
// Motion spec. Springs are damped oscillators integrated at 1/120 s.
// - Change place: your fighter jumps 3.5 units straight up in its own play style (web/lib/hero.js); the place drops 24 units
//   into the paper (2.6 Hz, ratio 1); once it is gone the next rises (2.0 Hz, ratio 0.7) and you land on it.
// - Dive: the camera comes down from fitting 4.4 units across the screen to 5.4 back and low at 1.0 Hz, ratio 1. The page
//   reports the pick 2.6 s in.
// - Wall boards scroll 0.07 of their length a second. Camera follows at 1.3 Hz, ratio 1, and orbits 0.6 degrees on a 9 s sine.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { post } from './lib/bridge.js';
import { COURT_ICONS } from './lib/court-icons.js';
import { createHandoff } from './lib/handoff.js';
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
scene.fog = new THREE.Fog(PAPER, 26, 46); // the far edge of each place fades into the paper (set to the camera in resize)
const camera = new THREE.PerspectiveCamera(26, 1, 0.4, 140);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.55));
const sun = new THREE.DirectionalLight(0xfff4e4, 2.1);
sun.position.set(-5, 9, 4);
scene.add(sun);

// The legend from the gear page, drawn over this scene: he hands you a racket when you land, and asks MATCH or JUST HIT when
// you step off (web/lib/handoff.js). The app opens him with window.offerRacket / window.askKind.
const hand = createHandoff({ renderer, post });
window.offerRacket = (d) => { if (d) hand.offer(d); else hand.close(); };
window.askKind = (d) => { if (d) { if (hand.state.session !== d.session || !hand.active) hand.ask(d); } else if (hand.state.mode === 'ask' && !hand.state.leaving) hand.close(); };

const FWD = new THREE.Vector3(-1, 0, -1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const STEP = 4.7;
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
const H = createHero(scene, { scale: 0.16, unit: STEP });
const { mascot } = H;
const footShadow = blob(0.4, 0.75);
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
const SPOTS = [[0.4, 0.7], [-0.2, 0.7], [1.26, 0.3], [-0.8, 0.7], [1.26, -0.25], [0.95, 0.76]]; // later arrivals: outside the fence, along the front sides
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
const CORNER = new THREE.Vector3(1.3, 0, 0.74); // where you stand at a place you have not landed on: the apron's near corner, outside the fence
// Sizes are real: a jelly about as tall as a person (a little over 2 m), so the court reads as 24 m long around them.
const FRIEND = 0.11; // a friend waiting outside the court
const PLAYER = 0.1; // anyone in the court (you shrink to match: YOU_IN)
const YOU_IN = 0.75;
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
  g.scale.setScalar(0.45); // a 4.5 m flagpole
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
      c.holder.position.set(x, STAND_Y, z);
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
      if (st.at === i && !st.hop && !st.diving) { const b = u.base.clone().add(stand).setY(STAND_Y); st.hop = { from, b, to: i, t: 0, pushed: false, dur: H.jump(from, b) }; post({ type: 'hop' }); }
    }
    // The rally: a ball between whoever is hitting. One player alone serves into the far box.
    const order = players >= 2 ? (RALLY[Math.min(players, 4)] || []).map((k) => hitters[k]).filter(Boolean) : hitters.length ? [hitters[0], { pos: new THREE.Vector3(-0.35, 0, -0.12), hit: () => {} }] : [];
    let r = rallies.get(i);
    if (order.length >= 2) {
      if (!r) { const ballMesh = ball(0.014, new THREE.MeshBasicMaterial({ color: 0xe4ff1a })); islands[i].add(ballMesh); r = { ball: ballMesh, k: 0, t: Math.random() }; rallies.set(i, r); }
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
  if (pennant.visible) { pennant.position.set(1.36, STAND_Y, 0.42); islands[b].add(pennant); }
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

/** The song, printed along a windscreen `h` units high: returns the texture and the world length of one pass of the text. */
function board(text, accent, bg, h) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = '800 46px ui-monospace, Menlo, monospace';
  c.width = Math.ceil(g.measureText(text).width) + 60;
  c.height = 64;
  g.fillStyle = bg; g.fillRect(0, 0, c.width, 64);
  g.font = '800 46px ui-monospace, Menlo, monospace';
  g.fillStyle = accent; g.textBaseline = 'middle';
  g.fillText(text, 30, 35);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return { t, unit: (c.width / 64) * h };
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
    P.add(at(rbox(TILE, 0.02, 1.25, 0.01, conc), 0, 0.01, 0));
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
    g.add(at(rbox(0.72, 0.02, TILE, 0.01, mat(0x8fae6a)), ZX, 0.01, 0));
    const RAIL_X = -1.63;
    for (const dx of [-0.04, 0.04]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, TILE - 0.1), mat(0x6b6f78, { metalness: 0.6, roughness: 0.4 })), RAIL_X + dx, 0.012, 0));
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
    const span = TILE - 0.4;
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
 * Places. Each venue is its own world: its court at regulation size in the middle, and the place around it, all at real size.
 * Only the place you are at is up; changing courts drops it away into the paper and raises the next one under you.
 *
 * Scale: one world unit is M meters (the court is COURT_L units long). Everything around the court is built in meters inside a
 * group scaled 1 / M, so a house is a house: ~10 m across, ~6 m to the ridge; a shade tree 10 to 14 m; a eucalyptus 20 to 30 m.
 * Everything is laid on the court's own grid (x along the court, z across it), so streets, buildings and fences all run on the
 * same two diagonals as the court, like a model on a table. The camera looks in from +x +z: `V(x, z)` gives where a point lands
 * on screen as [right, down] meters from the court's center.
 *
 * Layout bands, on screen: the court's apron spans about +-26 m across. The screen's width is about +-35 m at the court and
 * widens with distance; up the screen (V down < -26) is where the place's character lives, to about -170 where it fades into
 * the paper. Below the court (under the dock) stays low: lawn, paths, the odd bench, so nothing tall stands in front of it.
 */
const mt = (meters) => meters / M;
const DROP = 24; // how far a place sinks (units) when you leave it: past the fog, into the paper
const APRON = { x: mt(23), z: mt(14), top: mt(0.45) }; // the concrete pad the court stands on (half extents)
const FENCE = { x: mt(18.29), z: mt(9.14), h: mt(3.6), screen: mt(2.6) }; // 36.6 x 18.3 m enclosure, windscreens 2.6 m high
const STAND_Y = APRON.top + mt(0.3); // where feet go: on the court's surface
const TILE = 3.5; // the size the landmark props (FLAVOR) were drawn at
const metersGroup = () => { const f = new THREE.Group(); f.scale.setScalar(1 / M); return f; };
const V = (x, z) => [0.7071 * (x - z), 0.7071 * (x + z)]; // court-frame meters to screen [right, down] meters

/** One fenced court, in world units: apron, surface, lines, net, fence and windscreens, benches, and lights if it has them. */
function enclosure(colors, { song = null, accent = '#ffffff', mural: hasMural = false, stands = null, lights = false, boards = [], boardMeshes = [] } = {}) {
  const a = new THREE.Group();
  a.add(at(rbox(APRON.x * 2, APRON.top, APRON.z * 2, mt(0.15), mat(0xd9d4c9, { roughness: 0.95 })), 0, APRON.top / 2, 0));
  const c = court({ x: 0, z: 0, w: COURT_L, d: COURT_L * (10.97 / 23.77), rot: 0, lit: false }, M, colors);
  c.position.y = APRON.top - 0.002;
  c.traverse((o) => { o.userData.courtFloor = true; });
  a.add(c);
  const wallColor = colors?.wall ?? 0x26302b;
  const post = mat(0x3a3f45, { metalness: 0.4, roughness: 0.6 });
  const wire = new THREE.MeshBasicMaterial({ color: 0x2a2f35, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  let backWalls = 0;
  // [normal x, normal z, length, center x, center z, rotation]: the two sides whose inside faces the camera are the back sides.
  for (const [nx, nz, len, px, pz, ry] of [[1, 0, FENCE.z * 2, -FENCE.x, 0, Math.PI / 2], [-1, 0, FENCE.z * 2, FENCE.x, 0, -Math.PI / 2], [0, 1, FENCE.x * 2, 0, -FENCE.z, 0], [0, -1, FENCE.x * 2, 0, FENCE.z, Math.PI]]) {
    const back = new THREE.Vector3(nx, 0, nz).dot(CAM) > 0;
    const y0 = APRON.top;
    // Chain link: a faint see-through panel, a top rail, posts every 3 m.
    const panel = at(new THREE.Mesh(new THREE.PlaneGeometry(len, FENCE.h), wire), px, y0 + FENCE.h / 2, pz);
    panel.rotation.y = ry; a.add(panel);
    const rail = at(new THREE.Mesh(new THREE.BoxGeometry(len, mt(0.08), mt(0.08)), post), px, y0 + FENCE.h, pz);
    rail.rotation.y = ry; a.add(rail);
    const n = Math.round((len * M) / 3);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(mt(0.05), mt(0.05), FENCE.h, 5), post, n + 1);
    for (let k = 0; k <= n; k += 1) {
      const s = -len / 2 + (k / n) * len;
      posts.setMatrixAt(k, new THREE.Matrix4().makeTranslation(px + (nz !== 0 ? s : 0), y0 + FENCE.h / 2, pz + (nx !== 0 ? s : 0)));
    }
    a.add(posts);
    if (!back) continue;
    // Back sides carry the windscreen: the song runs along one like a sponsor board (or the mural, at UCSD).
    const sh = FENCE.screen;
    const off = mt(0.06);
    const sx = px + nx * off; const sz = pz + nz * off;
    let map = null;
    if (hasMural && backWalls === 0) { map = mural(); map.wrapS = THREE.RepeatWrapping; map.repeat.x = Math.max(1, Math.round(len / (sh * 4))); }
    else if (song) {
      const led = board(song, accent, colors?.wallCss ?? '#1d2420', sh);
      map = led.t.clone(); map.needsUpdate = true; map.repeat.x = len / led.unit;
      boards.push(map);
    }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(len, sh), map ? new THREE.MeshBasicMaterial({ map }) : mat(wallColor, { side: THREE.DoubleSide }));
    scr.position.set(sx, y0 + mt(0.25) + sh / 2, sz); scr.rotation.y = ry;
    if (map && !hasMural) { scr.userData.songBoard = true; boardMeshes.push(scr); }
    a.add(scr);
    const backing = at(new THREE.Mesh(new THREE.PlaneGeometry(len, sh), mat(wallColor)), px - nx * off, y0 + mt(0.25) + sh / 2, pz - nz * off);
    backing.rotation.y = ry + Math.PI; a.add(backing);
    backWalls += 1;
    if (stands) { // stadium seating stepping up behind the windscreen
      for (let k = 0; k < 6; k += 1) {
        const row = at(rbox(len, mt(0.55) * (k + 1), mt(0.9), mt(0.06), mat(stands[k % 2])), px - nx * mt(1.0 + 0.9 * k), y0 + (mt(0.55) * (k + 1)) / 2, pz - nz * mt(1.0 + 0.9 * k));
        row.rotation.y = ry; a.add(row);
      }
    }
  }
  // Benches either side of the net, inside the fence.
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const b = new THREE.Group();
    b.add(at(rbox(mt(1.8), mt(0.08), mt(0.45), mt(0.03), mat(0x7a5a3c)), 0, mt(0.45), 0));
    b.add(at(rbox(mt(1.8), mt(0.4), mt(0.06), mt(0.02), mat(0x7a5a3c)), 0, mt(0.75), sz * mt(0.2)));
    for (const lx of [-0.7, 0.7]) b.add(at(new THREE.Mesh(new THREE.BoxGeometry(mt(0.06), mt(0.45), mt(0.4)), post), mt(lx), mt(0.22), 0));
    b.position.set(sx * mt(3.2), APRON.top, sz * mt(7.9));
    a.add(b);
  }
  if (lights) {
    for (const [x, z] of [[FENCE.x, FENCE.z], [-FENCE.x, FENCE.z], [FENCE.x, -FENCE.z], [-FENCE.x, -FENCE.z]]) {
      const ox = x + Math.sign(x) * mt(0.6); const oz = z + Math.sign(z) * mt(0.6);
      a.add(at(cyl(mt(0.14), mt(0.2), mt(12), ink, 8), ox, APRON.top + mt(6), oz));
      const head = at(new THREE.Mesh(new THREE.BoxGeometry(mt(1.8), mt(0.5), mt(0.9)), new THREE.MeshBasicMaterial({ color: 0xfff3b8 })), ox, APRON.top + mt(12.1), oz);
      head.lookAt(0, 0, 0); head.rotation.x = 0;
      head.rotation.y = Math.atan2(-ox, -oz);
      a.add(head);
    }
  }
  return a;
}

function worldKit(B, air, seed0, clear) {
  let seed = seed0;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const movers = [];
  const anims = [];
  const palms = [];
  const slab = (color, x0, x1, z0, z1, top, h = 0.3) => B.add(at(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat(color, { roughness: 1 })), (x0 + x1) / 2, top - h / 2, (z0 + z1) / 2));
  const k = {
    rnd,
    /** The place's ground, out past where it fades into the paper (or only down to z = edge, where a cliff drops away). */
    ground(color, edge = -600) { B.add(at(new THREE.Mesh(new THREE.PlaneGeometry(900, 300 - edge).rotateX(-Math.PI / 2), mat(color, { roughness: 1 })), 0, 0, (300 + edge) / 2)); },
    /** A flat patch of something on the ground (a lawn, a lot, a beach): its top sits 0.15 m up. */
    patch(color, x0, x1, z0, z1, top = 0.15) { slab(color, x0, x1, z0, z1, top); },
    /** A road along z (at x = c) or along x (at z = c), 9 m wide, with a dashed center line; `cars` drive both ways. */
    road(axis, c, a0, a1, cars = 0, width = 9) {
      if (axis === 'z') slab(0x4b4e56, c - width / 2, c + width / 2, a0, a1, 0.25); else slab(0x4b4e56, a0, a1, c - width / 2, c + width / 2, 0.25);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xe9c46a });
      for (let d = a0 + 2; d < a1 - 3; d += 9) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(axis === 'z' ? 0.25 : 3, 0.05, axis === 'z' ? 3 : 0.25), dashMat);
        dash.position.set(axis === 'z' ? c : d + 1.5, 0.27, axis === 'z' ? d + 1.5 : c);
        B.add(dash);
      }
      const palette = [0xd9443a, 0xf4f1ea, 0x2f6fd6, 0x2a2d35, 0xe9b535, 0x8a8f99, 0x3f8f62];
      for (let n = 0; n < cars; n += 1) {
        const car = new THREE.Group();
        car.add(at(rbox(1.9, 1.0, 4.6, 0.35, mat(palette[Math.floor(rnd() * palette.length)], { roughness: 0.4, metalness: 0.2 })), 0, 0.85, 0));
        car.add(at(rbox(1.7, 0.75, 2.5, 0.3, mat(0x2a2d35, { roughness: 0.3 })), 0, 1.6, -0.2));
        B.add(car);
        const dir = n % 2 ? 1 : -1;
        movers.push({ car, axis, c: c + dir * width * 0.24, a0, len: a1 - a0, dir, speed: 9 + rnd() * 5, off: rnd() * (a1 - a0) });
      }
    },
    /** True where scenery may stand: off the court's apron (plus `pad` m) and outside every keep-out box [x0, x1, z0, z1]. */
    free(x, z, keepOut = [], pad = 5) {
      if (x > clear.x0 - 23 - pad && x < clear.x1 + 23 + pad && z > clear.z0 - 14 - pad && z < clear.z1 + 14 + pad) return false;
      return !keepOut.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
    },
    /**
     * Points on a jittered grid that are free and on screen. Below the court (screen down > 20) only out at the sides, so
     * nothing hides it; `fn` gets the screen depth too, to keep what stands down there short.
     */
    scatter(x0, x1, z0, z1, step, keepOut, fn) {
      for (let x = x0; x < x1; x += step) for (let z = z0; z < z1; z += step) {
        const jx = x + (rnd() - 0.5) * step * 0.7; const jz = z + (rnd() - 0.5) * step * 0.7;
        const [sx, sy] = V(jx, jz);
        if ((sy > 20 && Math.abs(sx) < 34) || sy < -190 || sy > 110 || Math.abs(sx) > 50 - sy * 0.3) continue;
        if (k.free(jx, jz, keepOut)) fn(jx, jz, sy);
      }
    },
    /**
     * Instanced trees [x, z, height m]. 'euc' is a eucalyptus: a tall, pale, leaning trunk, bare most of the way up, with a few
     * drooping blue-grey clumps hung high. 'round' is a park shade tree: short trunk, full rounded crown.
     */
    trees(points, kind = 'round') {
      const n = points.length;
      if (!n) return;
      const euc = kind === 'euc';
      const per = euc ? 4 : 2;
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(euc ? 0.25 : 0.3, euc ? 0.45 : 0.4, 1, 6).translate(0, 0.5, 0), mat(euc ? 0xe3dccd : 0x6b5236), n);
      const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat(0xffffff, { roughness: 0.95, flatShading: true }), n * per);
      const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const c = new THREE.Color(); const e = new THREE.Euler();
      const top = new THREE.Vector3();
      points.forEach(([x, z, h], i) => {
        const lean = euc ? (rnd() - 0.5) * 0.22 : 0; const dir = rnd() * Math.PI * 2;
        q.setFromEuler(e.set(Math.cos(dir) * lean, 0, Math.sin(dir) * lean));
        const th = h * (euc ? 0.95 : 0.5);
        m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, th, 1));
        trunk.setMatrixAt(i, m);
        top.set(0, th, 0).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
        for (let j = 0; j < per; j += 1) {
          let pos; let sc; let col;
          if (euc) {
            const a = dir + j * 1.9 + rnd(); const out = 0.05 + rnd() * 0.08;
            pos = new THREE.Vector3(top.x + Math.cos(a) * out * h, top.y - (0.04 + j * 0.08 + rnd() * 0.05) * h, top.z + Math.sin(a) * out * h);
            const r = (0.07 + rnd() * 0.04) * h;
            sc = new THREE.Vector3(r * 1.1, r * 1.4, r);
            col = [0x7d9483, 0x8aa08c, 0x6c8574, 0x93a58f][(i + j) % 4];
          } else {
            pos = new THREE.Vector3(x + (j ? 0.12 : -0.06) * h, h * (0.62 + j * 0.1), z + (j ? -0.08 : 0.04) * h);
            const r = 0.3 * h * (j ? 0.75 : 1);
            sc = new THREE.Vector3(r, r * 0.85, r);
            col = [0x4f8a4a, 0x5f9a52, 0x3f7a44][(i + j) % 3];
          }
          m.compose(pos, new THREE.Quaternion(), sc);
          crown.setMatrixAt(i * per + j, m);
          crown.setColorAt(i * per + j, c.set(col));
        }
      });
      B.add(trunk, crown);
    },
    /** Instanced buildings [x, z, w, d, h, wall, roof, y0]: a hip roof, or flat when roof is null; y0 lifts it (a roof cap). Meters. */
    houses(list) {
      const n = list.length;
      if (!n) return;
      const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat(0xffffff, { roughness: 0.9 }), n);
      const roofs = list.filter((h) => h[6] != null);
      const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), mat(0xffffff, { roughness: 0.9 }), Math.max(1, roofs.length));
      const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const c = new THREE.Color();
      let r = 0;
      list.forEach(([x, z, w, d, h, wall, rf, y0 = 0], i) => {
        m.compose(new THREE.Vector3(x, y0, z), q, new THREE.Vector3(w, h, d));
        body.setMatrixAt(i, m);
        body.setColorAt(i, c.set(wall));
        if (rf != null) {
          m.compose(new THREE.Vector3(x, y0 + h, z), q, new THREE.Vector3(w * 1.12, Math.min(w, d) * 0.4, d * 1.12));
          roof.setMatrixAt(r, m);
          roof.setColorAt(r, c.set(rf));
          r += 1;
        }
      });
      roof.count = r;
      B.add(body, roof);
    },
    /** Dark window bands round a flat-roofed building [x, z, w, d] at the given heights. */
    windows(x, z, w, d, ys) { for (const y of ys) B.add(at(new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 1.1, d + 0.1), mat(0x2f3540, { roughness: 0.4 })), x, y, z)); },
    /** A palm, h m tall, leaning a little. Palms are collected and drawn instanced (k.done): a street of them is two draw calls. */
    palm(x, z, h, lean = 0) { palms.push([x, z, h, lean, rnd() * Math.PI * 2]); },
    done() {
      if (!palms.length) return;
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.36, 1, 6).translate(0, 0.5, 0), mat(0x8a7356), palms.length * 4);
      const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.4, 0.9).translate(2.2, 0, 0).rotateX(-Math.PI / 2), mat(0x3f7f4b, { side: THREE.DoubleSide }), palms.length * 8);
      const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const one = new THREE.Vector3(1, 1, 1);
      palms.forEach(([x, z, h, lean, spin], n) => {
        // Four segments that bend further over toward the top.
        let y = 0; let dx = 0;
        for (let s = 0; s < 4; s += 1) {
          const len = h / 4; const tilt = lean * (0.4 + (s / 4) * 0.9);
          q.setFromEuler(e.set(0, 0, -tilt));
          m.compose(new THREE.Vector3(x + dx, y, z), q, new THREE.Vector3(1 - s * 0.12, len * 1.04, 1 - s * 0.12));
          trunk.setMatrixAt(n * 4 + s, m);
          dx += Math.sin(tilt) * len; y += Math.cos(tilt) * len;
        }
        for (let f = 0; f < 8; f += 1) {
          q.setFromEuler(e.set(0, (f / 8) * Math.PI * 2 + spin, -0.45 - (f % 2) * 0.3, 'YXZ'));
          m.compose(new THREE.Vector3(x + dx, y, z), q, one);
          leaves.setMatrixAt(n * 8 + f, m);
        }
      });
      B.add(trunk, leaves);
    },
    /** Something drawn in tile units (jetties, surfers): a group where one unit is one old tile unit, placed in meters. */
    tile() { const g = new THREE.Group(); g.scale.setScalar(M); B.add(g); return g; },
    /**
     * One of the place's landmark props (FLAVOR), centered on (x, z) and sized to `size` meters: { h } tall or { w } across.
     * Anything airborne in it (jets, the police helicopter) flies over the whole place instead, at real size.
     */
    landmark(key, x, z, size, rotY = 0) {
      const props = new THREE.Group();
      const anim = FLAVOR[key]?.(props);
      for (const o of [...props.children]) if (o.userData.air) air.add(o);
      if (anim) { anim(0); anims.push(anim); }
      const holder = new THREE.Group();
      props.rotation.y = rotY;
      holder.add(props);
      holder.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(holder);
      const s = size.h ? size.h / (bb.max.y - bb.min.y) : size.w / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
      holder.scale.setScalar(s);
      holder.position.set(x - s * (bb.min.x + bb.max.x) / 2, -s * bb.min.y, z - s * (bb.min.z + bb.max.z) / 2);
      B.add(holder);
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
/** A sign on two posts, w m wide, its bottom edge `lift` m up. */
function sign(B, text, color, x, z, w, lift, rotY = 0) {
  const g = new THREE.Group();
  const h = (w * 112) / 512;
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(text, color), side: THREE.DoubleSide })), 0, lift + h / 2, 0));
  for (const dx of [-w * 0.4, w * 0.4]) g.add(at(cyl(0.12, 0.12, lift + h, ink, 5), dx, (lift + h) / 2, -0.05));
  g.position.set(x, 0, z); g.rotation.y = rotY;
  B.add(g);
}

/**
 * A rubble-mound jetty like the two at the San Diego River mouth (tile units, see k.tile): a low mound of dark wet rock running
 * out from the shore, packed with boulders along the crest and flanks, a rounded head, and spray bursting at the head.
 */
function jetty(B, x, z0, z1, rnd) {
  const len = z0 - z1;
  const shape = new THREE.Shape([new THREE.Vector2(-0.6, 0), new THREE.Vector2(0.6, 0), new THREE.Vector2(0.22, 0.2), new THREE.Vector2(-0.22, 0.2)]);
  const mound = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }), mat(0x5d5850, { roughness: 1 }));
  mound.position.set(x, -0.04, z1);
  B.add(mound);
  const n = Math.floor(len / 0.06) * 5 + 40;
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
  for (let z = z0; z > z1 + 0.1; z -= 0.06) {
    for (const [ox, oy] of [[-0.4, 0.06], [-0.2, 0.15], [0, 0.19], [0.2, 0.15], [0.4, 0.06]]) put(x + ox + (rnd() - 0.5) * 0.05, oy + rnd() * 0.03, z + (rnd() - 0.5) * 0.04, 0.06 + rnd() * 0.04);
  }
  for (let k = 0; k < 40; k += 1) { const a = rnd() * Math.PI; const r = 0.1 + rnd() * 0.45; put(x + Math.cos(a) * r, 0.05 + rnd() * 0.08, z1 + 0.15 - Math.sin(a) * r, 0.07 + rnd() * 0.04); }
  rocks.count = i;
  B.add(rocks);
  const spray = new THREE.Group();
  const drops = [];
  for (let k = 0; k < 7; k += 1) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    d.userData.v = new THREE.Vector3((rnd() - 0.5) * 0.6, 0.7 + rnd() * 0.5, -0.1 - rnd() * 0.3);
    spray.add(d); drops.push(d);
  }
  spray.position.set(x, 0.15, z1 + 0.05);
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

/** Surfers sitting on their boards in the lineup (meters), rising and falling with the swell `swell(x, z, t)`. */
function surfers(B, spots, y0, swell) {
  const list = spots.map(([x, z], k) => {
    const s = new THREE.Group();
    s.add(at(rbox(0.55, 0.12, 2.2, 0.06, mat([0xf4f1ea, 0xe9b535, 0xd9443a, 0x7ec8e3][k % 4], { roughness: 0.5 })), 0, 0, 0));
    s.add(at(rbox(0.4, 0.75, 0.3, 0.12, mat(0x16181d)), 0, 0.45, 0.1));
    s.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat(0x8a5a3c)), 0, 0.95, 0.1));
    s.position.set(x, y0, z);
    s.rotation.y = (k * 1.7) % 1 - 0.5;
    B.add(s);
    return { s, x, z };
  });
  return (t) => { for (const { s, x, z } of list) { s.position.y = y0 + swell(x, z, t) + 0.1; s.rotation.z = 0.15 * Math.sin(t * 1.3 + x); } };
}

/** A sea: a swelling plane (meters) at height y, its near edge at zNear, with white breakers rolling in to the shore. */
function sea(B, y, zNear, amp = 0.35) {
  const geo = new THREE.PlaneGeometry(900, 360, 90, 36).rotateX(-Math.PI / 2);
  const rest = Float32Array.from(geo.attributes.position.array);
  const cz = zNear - 180;
  B.add(at(new THREE.Mesh(geo, mat(0x3f8fbf, { roughness: 0.25, metalness: 0.1 })), 0, y, cz));
  const swell = (x, z, t) => amp * Math.sin(x * 0.12 + t * 1.2) + amp * 0.6 * Math.sin(x * 0.25 - z * 0.18 + t * 2);
  const breakers = [0, 1, 2].map(() => { const f = new THREE.Mesh(new THREE.BoxGeometry(900, 0.1, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); B.add(f); return f; });
  const pos = geo.attributes.position;
  return {
    swell,
    anim(t) {
      for (let i = 0; i < pos.count; i += 1) pos.array[i * 3 + 1] = swell(rest[i * 3], rest[i * 3 + 2] + cz, t);
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      breakers.forEach((f, n) => { const u = ((t / 5 + n / 3) % 1); f.position.set(0, y + 0.15, zNear - 34 + u * 32); f.material.opacity = Math.sin(Math.PI * u) * 0.8; });
    },
  };
}

/** Court-frame meters for a spot on screen [right, down] meters from the court's center: for placing single things by eye. */
const P = (sx, sy) => [0.7071 * (sx + sy), 0.7071 * (sy - sx)];
const FACE = Math.PI / 4; // turns a sign or a front to face the camera

/**
 * What each place builds around its court and its bank of neighbouring courts. `k` is the kit; B is the place's meters group
 * (the court's frame). Up the screen is -x -z; the coast at UCSD and Barnes runs along x, so the sea fills the top right.
 */
const WORLD = {
  ucsd(k, B) {
    // UCSD North: courts in a eucalyptus grove on the mesa. Up the screen the mesa ends at the sandstone cliffs: the Torrey
    // Pines Gliderport on the edge with paragliders riding the lift, Black's Beach and the Pacific below. Concrete campus
    // buildings in the trees, a bronze Triton in a plaza, North Torrey Pines Road down the right, jets overhead.
    const EDGE = -62; const CLIFF = 28;
    k.ground(0xb0a682, EDGE);
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(900, CLIFF, 6), mat(0xd9a86c, { roughness: 1 })), 0, -CLIFF / 2, EDGE - 3));
    for (const [y, c] of [[-7, 0xc28e58], [-15, 0xe3b981], [-22, 0xb98250]]) B.add(at(new THREE.Mesh(new THREE.BoxGeometry(900, 2, 6.2), mat(c, { roughness: 1 })), 0, y, EDGE - 3));
    k.patch(0xe8d6ad, -450, 450, EDGE - 26, EDGE - 6, -CLIFF + 0.5); // Black's Beach
    const ocean = sea(B, -CLIFF, EDGE - 24);
    const lineup = surfers(B, [[-60, EDGE - 40], [-80, EDGE - 46], [-104, EDGE - 42], [-124, EDGE - 50], [-44, EDGE - 48]], -CLIFF, ocean.swell);
    // The gliderport: a dirt pad on the edge, a clubhouse, a windsock, its sign.
    k.patch(0xc8b48a, -110, -50, EDGE, EDGE + 22);
    k.houses([[-98, EDGE + 11, 14, 9, 4, 0xf0e6d2, 0x7a3a2a]]);
    B.add(at(cyl(0.1, 0.1, 6, ink, 5), -58, 3, EDGE + 4));
    const sock = at(cone(0.5, 2.4, mat(0xe2562f), 10), -58, 5.6, EDGE + 4);
    B.add(sock);
    sign(B, 'GLIDERPORT', '#ffb347', -76, EDGE + 20, 12, 1.5, FACE);
    const gliders = [0xe2562f, 0x2f6fd6, 0xe9b535, 0x9b6bff].map((col, n) => {
      const p = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.7, 6, 16, Math.PI * 0.75), mat(col, { roughness: 0.6, side: THREE.DoubleSide }));
      canopy.rotation.z = Math.PI * 0.125; canopy.scale.set(1, 0.5, 1.6); canopy.position.y = 4;
      p.add(canopy);
      for (const x of [-2.8, 2.8]) { const l = at(cyl(0.04, 0.04, 5.5, ink, 3), x * 0.5, 2.6, 0); l.rotation.z = x > 0 ? 0.45 : -0.45; p.add(l); }
      p.add(at(rbox(0.6, 1.0, 0.6, 0.2, mat(0x16181d)), 0, 0, 0));
      B.add(p);
      return { p, ph: n * 1.6 };
    });
    // Triton: an original bronze figure on a stone pedestal in a paved plaza, coiled fish tail, trident raised; 7 m with plinth.
    const T = new THREE.Group();
    const bronze = mat(0x5f7d66, { metalness: 0.5, roughness: 0.45 });
    T.add(at(cyl(0.14, 0.16, 0.16, mat(0xd9d2c4), 18), 0, 0.08, 0));
    T.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(0.04, 0.3, 0.02), new THREE.Vector3(0.09, 0.22, -0.04), new THREE.Vector3(0.02, 0.18, -0.09), new THREE.Vector3(-0.07, 0.2, -0.03)]), 16, 0.035, 8), bronze));
    T.add(at(cone(0.05, 0.06, bronze, 6).rotateZ(1.2), -0.1, 0.22, -0.02));
    T.add(at(cyl(0.04, 0.032, 0.18, bronze, 10), 0, 0.5, 0));
    T.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 10), bronze), 0, 0.63, 0));
    const arm = at(cyl(0.012, 0.012, 0.15, bronze, 6), 0.06, 0.62, 0); arm.rotation.z = -0.5; T.add(arm);
    T.add(at(cyl(0.006, 0.006, 0.55, bronze, 6), 0.1, 0.6, 0));
    for (const x of [-0.03, 0, 0.03]) T.add(at(cone(0.008, 0.06, bronze, 5), 0.1 + x, 0.9, 0));
    T.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.01, 0.01), bronze), 0.1, 0.86, 0));
    T.scale.setScalar(7.5);
    T.rotation.y = FACE;
    T.position.set(-56, 0.15, -14);
    k.patch(0xd9d2c4, -66, -46, -24, -4);
    B.add(T);
    // Concrete campus buildings: stacked slabs with dark window bands.
    for (const [x, z, w, d, h] of [[-96, -30, 34, 22, 16], [-130, -50, 22, 30, 12]]) { k.houses([[x, z, w, d, h, 0xcfc9bc, null]]); k.windows(x, z, w, d, Array.from({ length: Math.floor(h / 4) }, (_, n) => 2.4 + n * 4)); }
    k.road('z', 44, -200, 200, 4);
    const trees = [];
    k.scatter(-200, 160, EDGE + 5, 160, 9, [[38, 50, -300, 300], [-114, -46, EDGE, EDGE + 26], [-70, -42, -28, 0], [-116, -76, -44, -16], [-144, -116, -68, -32], [-300, 300, -300, EDGE + 3]], (x, z, sy) => { if (Math.abs(V(x, z)[0]) < 16 && sy < -30) return; if (k.rnd() < 0.6) trees.push([x, z, sy > 20 ? 10 + k.rnd() * 4 : 18 + k.rnd() * 12]); });
    k.trees(trees, 'euc');
    return (t) => {
      k.anim(t);
      ocean.anim(t);
      lineup(t);
      sock.rotation.z = -Math.PI / 2 + 0.15 * Math.sin(t * 2.3);
      sock.rotation.y = 0.3 * Math.sin(t * 0.7);
      for (const { p, ph } of gliders) {
        const a = t * 0.12 + ph;
        p.position.set(-70 + 70 * Math.sin(a), 30 + 8 * Math.sin(t * 0.3 + ph), EDGE - 12 + 6 * Math.sin(a * 2));
        p.rotation.y = Math.atan2(70 * Math.cos(a), 12 * Math.cos(a * 2)) + Math.PI / 2;
        p.rotation.z = 0.25 * Math.cos(a);
      }
    };
  },
  lindavista(k, B) {
    // Linda Vista Community Park: the big skate park and its footbridge behind the court, a corner of palms, the rec center
    // to the left, its lot to the right, Linda Vista Road and apartments beyond. The police helicopter circles.
    k.ground(0x9db27a);
    k.landmark('lindavista', -66, -66, { w: 80 });
    k.road('x', -122, -400, 300, 4, 11);
    const apts = [];
    for (let x = -300; x < 200; x += 26) for (const z of [-142, -168]) apts.push([x + k.rnd() * 4, z, 20, 16, 9 + k.rnd() * 7, [0xe8dcc4, 0xd9c9a8, 0xf0e6d2, 0xc9b896][Math.floor(k.rnd() * 4)], null]);
    k.houses(apts);
    k.houses([[-54, -8, 20, 30, 7, 0xd8c7a6, null], [-54, -8, 21, 31, 0.8, 0x9a7a5a, null, 7]]); // rec center
    k.windows(-54, -8, 20, 30, [3.2]);
    k.patch(0x6b6e75, -30, 10, -76, -46); // the lot
    for (let x = -27; x < 8; x += 3) B.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 6), new THREE.MeshBasicMaterial({ color: 0xf4f1ea })), x, 0.18, -61));
    for (const [x, z, c] of [[-24, -66, 0xd9443a], [-12, -56, 0x2f6fd6], [3, -66, 0xf4f1ea]]) B.add(at(rbox(1.9, 1.3, 4.6, 0.4, mat(c, { roughness: 0.4 })), x, 0.8, z));
    k.patch(0xd9d4c9, 23, 200, -2, 2); // the path out from the court
    for (let x = -110; x <= -30; x += 12) k.palm(x, -38, 13 + k.rnd() * 5, (k.rnd() - 0.5) * 0.3);
    for (let z = -110; z <= -50; z += 12) k.palm(-38, z, 13 + k.rnd() * 5, (k.rnd() - 0.5) * 0.3);
    const trees = [];
    k.scatter(-200, 160, -116, 160, 12, [[-66, -42, -26, 10], [-32, 12, -78, -44], [-110, -22, -110, -22]], (x, z) => { if (k.rnd() < 0.55) trees.push([x, z, 9 + k.rnd() * 5]); });
    k.trees(trees, 'round');
    return (t) => k.anim(t);
  },
  balboa(k, B) {
    // Balboa Tennis Club at Morley Field: two rows of courts with green windscreens, the clubhouse, eucalyptus round the
    // blocks, and the California Tower over Balboa Park in the distance.
    k.ground(0x86a865);
    k.patch(0xd9d4c9, -30, 0, -84, -62); // clubhouse terrace
    k.houses([[-16, -76, 18, 12, 5, 0xf0e6d2, 0xb5543a]]);
    k.landmark('balboa', ...P(-10, -150), { h: 55 });
    k.road('z', -120, -300, 200, 3);
    const trees = [];
    k.scatter(-200, 160, -200, 160, 10, [[-34, 4, -88, -58], [-126, -114, -300, 300]], (x, z, sy) => { if (Math.abs(V(x, z)[0] + 10) < 20 && sy < -60) return; if (k.rnd() < 0.45) trees.push([x, z, sy > 20 ? 10 + k.rnd() * 4 : 18 + k.rnd() * 10]); });
    k.trees(trees, 'euc');
    return (t) => k.anim(t);
  },
  roosevelt(k, B) {
    // Roosevelt, behind the zoo: the concrete arched hitting walls behind the court, the zoo train and its elephants beyond,
    // zoo enclosures with ponds and rocks, Park Boulevard down the right, the middle school's long wing on the left.
    k.ground(0x7fa060);
    k.landmark('roosevelt', -48, -48, { w: 60 });
    k.road('z', 45, -300, 200, 4, 10);
    for (const [x, z, pw, pd] of [[-100, -64, 30, 26], [-72, -94, 30, 26], [-112, -104, 36, 30]]) {
      k.patch(0x6d8a4c, x - pw / 2, x + pw / 2, z - pd / 2, z + pd / 2);
      const pond = new THREE.Mesh(new THREE.CircleGeometry(5, 20).rotateX(-Math.PI / 2), mat(0x4f9bc4, { roughness: 0.3 }));
      pond.position.set(x + 5, 0.2, z + 3); pond.scale.set(1.3, 1, 0.8); B.add(pond);
      for (let r = 0; r < 3; r += 1) B.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 + k.rnd() * 1.2, 0), mat(0x9a8f80, { roughness: 1 })), x - 8 + k.rnd() * 6, 0.8, z - 6 + k.rnd() * 5));
      for (const [ax, fx, fz, len] of [['x', x, z - pd / 2, pw], ['x', x, z + pd / 2, pw], ['z', x - pw / 2, z, pd], ['z', x + pw / 2, z, pd]]) B.add(at(new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? len : 0.25, 1.4, ax === 'x' ? 0.25 : len), mat(0x6b5236)), fx, 0.7, fz));
    }
    k.houses([[-52, -4, 14, 46, 7, 0xe8dcc4, null], [-52, -4, 15, 47, 0.7, 0xb5543a, null, 7], [-4, -54, 46, 14, 7, 0xe8dcc4, null], [-4, -54, 47, 15, 0.7, 0xb5543a, null, 7]]); // the school's two wings
    k.windows(-52, -4, 14, 46, [2.2, 5]); k.windows(-4, -54, 46, 14, [2.2, 5]);
    const trees = [];
    k.scatter(-200, 160, -200, 160, 11, [[40, 50, -300, 300], [-60, -44, -28, 20], [-28, 20, -62, -46], [-80, -16, -80, -16], [-130, -50, -122, -48]], (x, z) => { if (k.rnd() < 0.6) trees.push([x, z, 9 + k.rnd() * 6]); });
    k.trees(trees, 'round');
    return (t) => k.anim(t);
  },
  northpark(k, B) {
    // North Park: the rec center's lawn in a grid of streets lined with craftsman bungalows and palms, the gym across the
    // street, and the North Park water tower standing over its lot a block up.
    k.ground(0xc9c2b4);
    k.patch(0x8fae6a, -42, 42, -40, 40); // the rec center lawn
    const alongX = [-46, 46, -150]; const alongZ = [-50, 50, -150];
    for (const z of alongX) k.road('x', z, -300, 200, 2);
    for (const x of alongZ) k.road('z', x, -300, 200, 2);
    k.houses([[-20, -66, 26, 18, 9, 0xd9c9a8, null], [-20, -66, 27, 19, 0.8, 0x8a2c34, null, 9]]); // the gym
    k.windows(-20, -66, 26, 18, [4]);
    k.patch(0xb3ab9c, -94, -58, -76, -42); // the water tower's lot
    k.landmark('northpark', -76, -59, { h: 38 });
    const wall = [0xe8dcc4, 0xc9a96e, 0x8fa3a8, 0xd98c6a, 0x6f8a6c, 0xf0e6d2, 0xa9b8c9, 0xd9c26a];
    const roof = [0x5a4a3c, 0x6b5a4a, 0x7a3a2a, 0x4a4d55];
    const homes = [];
    for (let x = -290; x < 190; x += 14) for (let z = -290; z < 190; z += 16) {
      const [sx, sy] = V(x, z);
      if (sy < -190 || Math.abs(sx) > 50 - sy * 0.3 || (sy > 20 && Math.abs(sx) < 34)) continue;
      if (alongX.some((s) => Math.abs(z - s) < 12) || alongZ.some((s) => Math.abs(x - s) < 11)) continue;
      if ((x > -46 && x < 46 && z > -42 && z < 42) || (x > -98 && x < -54 && z > -80 && z < -38) || (x > -36 && x < -4 && z > -78 && z < -54)) continue;
      if (k.rnd() < 0.85) homes.push([x + (k.rnd() - 0.5) * 2, z, 9 + k.rnd() * 3, 11 + k.rnd() * 3, 4 + k.rnd() * 1.5, wall[Math.floor(k.rnd() * wall.length)], roof[Math.floor(k.rnd() * roof.length)]]);
    }
    k.houses(homes);
    for (const x of alongZ) for (let z = -290; z < 190; z += 24) { const [sx, sy] = V(x + 7, z); if (!(sy > 10 && Math.abs(sx) < 40) && sy > -190) k.palm(x + 7, z + k.rnd() * 6, 12 + k.rnd() * 5, (k.rnd() - 0.5) * 0.3); }
    const trees = [];
    k.scatter(-40, 40, -38, 38, 10, [], (x, z) => { if (k.rnd() < 0.5) trees.push([x, z, 9 + k.rnd() * 4]); });
    k.trees(trees, 'round');
    return (t) => k.anim(t);
  },
  barnes(k, B) {
    // Barnes, where the San Diego River runs out to the ocean in Ocean Beach. The court on the park; up the screen a line of
    // palms, the beach and the sea. The river runs out between its two rock jetties (a sailboat heads out the channel), Ocean
    // Beach's shops and pier across the river on the left, and Point Loma lying across the water.
    const SHORE = -62;
    k.ground(0x8fae6a);
    k.patch(0xe8d6ad, -450, 450, SHORE - 2, -40); // the beach
    const ocean = sea(B, 0.05, SHORE);
    const RX = -78; // the river, running inland between the jetties
    B.add(at(new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 300), mat(0x3a86b5, { roughness: 0.3 })), RX, 0.12, SHORE + 150));
    const T = k.tile();
    const jetties = [jetty(T, (RX - 12) / M, (SHORE + 6) / M, (SHORE - 76) / M, k.rnd), jetty(T, (RX + 12) / M, (SHORE + 6) / M, (SHORE - 70) / M, k.rnd)];
    for (let x = -62; x < 120; x += 13 + k.rnd() * 4) k.palm(x, -34 - k.rnd() * 3, 13 + k.rnd() * 5, (k.rnd() - 0.5) * 0.4);
    // Ocean Beach, across the river: Abbott Street, a row of bright storefronts, the OCEAN BEACH sign, the pier.
    const OB = -112;
    k.road('z', OB, -50, 200, 2, 8);
    const tones = [0x5fb8b0, 0xe8755a, 0xf2c14e, 0xb39ddb, 0xf4f1ea, 0x7ec8e3, 0xe86a92];
    const shops = [];
    for (let z = -40, n = 0; z < 160; z += 9, n += 1) shops.push([OB + 11, z, 8, 8.5, 5 + ((n * 0.37) % 1) * 3, tones[n % tones.length], null]);
    for (let z = -36, n = 3; z < 160; z += 11, n += 1) shops.push([OB - 12, z, 10, 10, 4.5 + ((n * 0.29) % 1) * 2.5, tones[n % tones.length], n % 2 ? 0x7a3a2a : null]);
    k.houses(shops);
    sign(B, 'OCEAN BEACH', '#ff6fb1', OB, -46, 11, 5, FACE);
    const tower = new THREE.Group();
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tower.add(at(cyl(0.1, 0.1, 3, mat(0xd9d4c9), 4), x, 1.5, z));
    tower.add(at(rbox(2.6, 1.7, 2.6, 0.3, mat(0x3a7fc4)), 0, 3.6, 0));
    tower.add(at(cone(2.0, 1.0, mat(0xf4f1ea), 4).rotateY(Math.PI / 4), 0, 5, 0));
    tower.position.set(-20, 0.15, -52); B.add(tower);
    // Dog Beach, at the river mouth: dogs tearing back and forth on the sand.
    const dogs = [0x8a5a3c, 0xe9d8b4, 0x2a2d35].map((col, n) => {
      const d = new THREE.Group();
      d.add(at(rbox(1.0, 0.45, 0.4, 0.15, mat(col)), 0, 0.55, 0));
      d.add(at(rbox(0.4, 0.4, 0.38, 0.1, mat(col)), 0.6, 0.8, 0));
      for (const x of [-0.35, 0.35]) d.add(at(cyl(0.07, 0.07, 0.45, mat(col), 4), x, 0.22, 0));
      B.add(d);
      return { d, n };
    });
    const lineup = surfers(B, [[-30, -90], [-12, -100], [-48, -108], [6, -116]], 0.05, ocean.swell);
    // The OB pier: a long concrete deck on piles, a T at the end, lamps, the cafe.
    const pierMat = mat(0xd9d4c9);
    const PX = OB - 2; const PY = 6; const P0 = SHORE + 20; const P1 = SHORE - 190;
    B.add(at(rbox(4, 0.8, P0 - P1, 0.2, pierMat), PX, PY, (P0 + P1) / 2));
    B.add(at(rbox(30, 0.8, 4, 0.2, pierMat), PX, PY, P1));
    for (let z = P0 - 6; z > P1; z -= 9) for (const dx of [-1.4, 1.4]) B.add(at(cyl(0.3, 0.3, PY + 2, pierMat, 5), PX + dx, (PY - 2) / 2, z));
    for (let z = P0 - 12; z > P1; z -= 24) B.add(at(cyl(0.08, 0.08, 3.5, ink, 4), PX + 1.8, PY + 2, z));
    B.add(at(rbox(3.6, 3, 7, 0.3, mat(0xf4f1ea)), PX, PY + 1.9, P0 - 60));
    B.add(at(rbox(4.2, 0.5, 7.6, 0.2, mat(0x3a7fc4)), PX, PY + 3.6, P0 - 60));
    // Point Loma across the water: a long brushy ridge, the old lighthouse on its high point, its lamp blinking.
    const PL = new THREE.Group();
    PL.position.set(-240, 0, -170);
    const ridge = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7d8a55, { roughness: 1 }));
    ridge.scale.set(70, 40, 220);
    PL.add(ridge);
    PL.add(at(rbox(8, 5, 6, 0.5, mat(0xf4f1ea)), 0, 41, 20));
    PL.add(at(cyl(1.4, 1.6, 9, mat(0xf4f1ea), 10), 0, 46, 20));
    const lamp = at(new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3b8 })), 0, 51.5, 20);
    PL.add(lamp);
    B.add(PL);
    // A small sloop sailing out the channel between the jetties, then bearing off along the coast.
    const boat = new THREE.Group();
    boat.add(at(rbox(2.2, 1.2, 7, 0.6, mat(0xf4f1ea)), 0, 0.6, 0));
    boat.add(at(cyl(0.1, 0.1, 10, mat(0xd8dade), 5), 0, 6, 0.6));
    const sail = (pts) => new THREE.Mesh(new THREE.BufferGeometry().setFromPoints(pts.map(([z, y]) => new THREE.Vector3(0, y, z))), mat(0xfffdf6, { side: THREE.DoubleSide, roughness: 0.7 }));
    boat.add(sail([[0.8, 1.6], [0.8, 10.6], [-3, 1.6]]));
    boat.add(sail([[0.5, 10], [3.4, 1.5], [0.5, 1.5]]));
    B.add(boat);
    const OUT = 30;
    const trees = [];
    k.scatter(-200, 160, -30, 160, 12, [[RX - 12, RX + 12, -300, 300], [-130, -90, -300, 300]], (x, z) => { if (k.rnd() < 0.4) trees.push([x, z, 9 + k.rnd() * 4]); });
    k.trees(trees, 'round');
    return (t) => {
      k.anim(t);
      ocean.anim(t);
      for (const j of jetties) j(t);
      lineup(t);
      lamp.visible = t % 4 < 0.6;
      const u = (t / OUT) % 1;
      const bx = RX + Math.max(0, u - 0.45) * 200;
      const bz = SHORE + 20 - Math.min(u, 0.45) * 220;
      boat.position.set(bx, ocean.swell(bx, bz, t), bz);
      boat.rotation.set(0.06 * Math.sin(t * 1.3 + 1), u > 0.45 ? Math.PI / 2 : 0, 0.05 * Math.sin(t * 1.3));
      boat.visible = u > 0.02 && u < 0.97;
      for (const { d, n } of dogs) {
        const a = t * (1.4 + n * 0.3) + n * 2;
        d.position.set(RX + 20 + 10 * Math.sin(a), 0.15 + 0.3 * Math.abs(Math.sin(a * 6)), SHORE + 12 + n * 4);
        d.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
      }
    };
  },
};

/** Neighbouring courts in each place's bank: [x, z] meters in the court's frame (18.3 m apart side by side, 40.6 end to end). */
const BANK = {
  ucsd: [[0, -18.3], [0, 18.3]],
  balboa: [[0, -36.6], [0, -18.3], [0, 18.3], [-40.6, -36.6], [-40.6, -18.3], [-40.6, 0], [-40.6, 18.3]],
  barnes: [[0, -18.3]],
  northpark: [[0, -18.3], [0, 18.3]],
  lindavista: [[0, -18.3]],
  roosevelt: [[0, -18.3]],
};

function build(data) {
  H.set(data);
  if (data.color) { youColor = data.color; pennant.userData.cloth.material.color.set(data.color); }
  venues = window.VENUES.map((v) => ({ ...v, ...(data.venues.find((d) => d.id === v.id) || {}) }));
  venues.forEach((v, i) => {
    const g = new THREE.Group();
    const base = new THREE.Vector3(0, 0, 0);
    const colors = SURFACE[v.key];
    const song = v.song ? `${v.song.title.toUpperCase()}  ·  ${v.song.artist.toUpperCase()}      ` : `${v.short}      `;
    const boards = [];
    const boardMeshes = [];
    const arena = enclosure(colors, { song, accent: v.accent, mural: !!colors?.mural, stands: v.key === 'balboa' ? colors.stands : null, lights: !!v.lights, boards, boardMeshes });
    arena.traverse((o) => { o.userData.island = i; o.userData.arena = true; });
    g.add(arena);
    // The place: its bank of courts, then its world, then anything that flies over it.
    const bank = BANK[v.key] || [];
    for (const [x, z] of bank) { const n = enclosure(colors); n.position.set(mt(x), 0, mt(z)); n.traverse((o) => { o.userData.arena = true; o.userData.island = i; }); g.add(n); }
    const B = metersGroup();
    const air = new THREE.Group();
    air.scale.setScalar(2.5); // the landmark props' aircraft were drawn small: this makes a jet ~15 m and the helicopter ~10 m
    const xs = [0, ...bank.map((b) => b[0])]; const zs = [0, ...bank.map((b) => b[1])];
    const k = worldKit(B, air, 11 + i * 13, { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
    const anim = WORLD[v.key]?.(k, B);
    k.done();
    if (v.key === 'ucsd') k.landmark('ucsd', 0, -400, { h: 1 }); // only for its jets: the props themselves sit out past the fog
    g.add(B, air);
    // Where the player stands once inside: the baseline nearer the camera.
    const end = new THREE.Vector3(COURT_L / 2 - 0.06, 0, 0);
    const spot = end.dot(CAM) > 0 ? end : end.multiplyScalar(-1);
    g.userData = { anim, boardMeshes, boards, i, base, rise: sp(i === 0 ? 1 : 0), glow: 0, spot: spot.setY(STAND_Y), stand: CORNER.clone() };
    g.visible = i === 0;
    scene.add(g);
    islands.push(g);
  });
  for (let k = 0; k < DUST; k += 1) dustPos.set([((k * 0.619) % 1 - 0.5) * 7, ((k * 0.311) % 1) * 5 - 0.5, ((k * 0.137) % 1 - 0.5) * 7], k * 3);
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
  $('blurb').textContent = v.played ? [`${v.played} played here`, v.king ? `held by ${v.king}` : null, `you ${v.rec}`].filter(Boolean).join(' · ') : '';
  const room = presence.venues[v.id];
  const mine = presence.you === v.id;
  if (presence.mode !== 'meet') slide.setKey(String(st.target + 1), 'JUMP IN', 'SLIDE TO PLAY HERE');
  else if (mine) slide.setKey(String(st.target + 1), 'PLAY', 'SLIDE TO KEEP SCORE');
  else slide.setKey(String(st.target + 1), 'LAND HERE', presence.you ? 'MOVES YOUR BEACON HERE' : 'SLIDE WHEN YOU ARE READY TO PLAY');
  // What the headcount plays now, and what changes next. The people themselves are in the court with their names over them.
  // The one button for being here: LAND HERE (your beacon, and the legend hands you a racket) or HOP OFF once you have.
  const lb = $('landbtn');
  if (lb) {
    lb.hidden = presence.mode !== 'meet';
    lb.textContent = mine ? 'HOP OFF' : 'LAND HERE';
    lb.classList.toggle('off', mine);
  }
  const who = $('who');
  if (who) {
    const demo = presence.demo && (room?.people || []).length ? '<span class="demo">STAND-INS</span>' : '';
    who.innerHTML = presence.mode === 'meet' && room
      ? `<div class="line">${esc(room.now)}${demo}</div>${room.next || mine ? `<div class="row"><span class="next">${esc(room.next)}</span>${mine ? '<button id="leave">HOP OFF</button>' : ''}</div>` : ''}`
      : '';
    const leave = $('leave');
    if (leave) leave.addEventListener('click', hopOff);
  }
  dock?.mark(st.target);
  const sub = $('sub'); if (sub) sub.textContent = 'your six. the song is on the wall.';
}

function hopOff() { presence.you = null; post({ type: 'leave' }); syncCrowd(); paint(); }
$('landbtn')?.addEventListener('click', () => {
  if (st.hop || st.diving || hand.active || !venues[st.target]) return;
  if (presence.you === venues[st.target].id) hopOff(); else land();
});
/** Arrived from the sky (/fly): hop to that court and land on it. */
window.flyIn = (i) => {
  go(i);
  if (st.at === st.target && !st.hop) { if (presence.you !== venues[st.target].id) land(); } else st.landOnArrive = true;
};

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
window.back = () => { if (hand.active) hand.dismiss(); else if (st.diving) undive(); else post({ type: 'back' }); };
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
    const hits = ray.intersectObjects(islands, true);
    // Look through everything the tap passes (trees, poles, wire in front), not just the first thing it touches.
    const board = hits.find((h) => h.object.userData.songBoard);
    const onCourt = !st.hop && hits.find((h) => h.object.userData.arena && h.object.userData.island === st.target);
    const hit = onCourt || hits[0];
    if (board && (!onCourt || !onCourt.object.userData.courtFloor)) {
      setMuted(!st.muted);
      return;
    }
    // The whole court you're on is the mute button: fence, windscreens, apron, every court in the bank. Only where you can go
    // in does the court surface still take you inside.
    if (onCourt) {
      // Only when picking a court for a match does a tap dive in; landed here, MATCH or JUST HIT is asked when you step off.
      const canEnter = presence.mode !== 'meet';
      if (hit.object.userData.courtFloor && canEnter) enter();
      else setMuted(!st.muted);
      return;
    }
    if (hit && hit.object.userData.island != null) {
      const i = hit.object.userData.island;
      // Tapping the island you are on jumps in, but only where you have landed (or when picking a court): landing is the slide.
      if (i !== st.target) go(i);
      else if (presence.mode !== 'meet') enter();
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

const standOn = (i) => islands[i].userData.base.clone().add(islands[i].userData.stand).setY(islands[i].position.y + STAND_Y);

/** Where the fighter is: standing at its place, partway through a jump between places, or jumping into the court. */
function fighterAt() {
  if (st.hop) {
    const { from, b } = st.hop;
    const k = THREE.MathUtils.clamp((st.hop.t - H.crouch()) / (st.hop.dur - H.crouch()), 0, 1);
    // In the air between places there is no ground under it to shade.
    return { p: H.along(st.hop.t), size: st.you.x, shadow: k < 0.06 || k > 0.94 ? from.clone().lerp(b, k).setY(STAND_Y + 0.004) : null };
  }
  if (st.jump) {
    const k = THREE.MathUtils.clamp((st.jump.t - 0.09) / 0.5, 0, 1);
    const to = islands[st.at].userData.base.clone().add(islands[st.at].userData.spot);
    const p = st.jump.from.clone().lerp(to, k);
    p.y += 0.35 * 4 * k * (1 - k);
    return { p, size: THREE.MathUtils.lerp(st.you.x, YOU_IN, k * k * (3 - 2 * k)), shadow: k >= 1 ? to.clone().setY(STAND_Y + 0.004) : null };
  }
  const p = standOn(st.at);
  return { p, size: st.you.x, shadow: p.clone().setY(p.y + 0.004) };
}

function advance(dt) {
  st.clock += dt;
  hand.step(dt);
  slide.step(dt);
  dock?.step(dt);
  if (!venues.length) return;
  // Changing places: you jump straight up out of the frame, this place drops away into the paper under you, the next rises
  // into its spot, and you come down on it. The jump is tall enough (3.5 units) that the swap is done before you land.
  if (!st.hop && st.at !== st.target) {
    const from = standOn(st.at);
    const b = islands[st.target].userData.base.clone().add(islands[st.target].userData.stand).setY(STAND_Y);
    st.hop = { from, b, to: st.target, t: 0, pushed: false, dur: H.jump(from, b, 3.5) };
    post({ type: 'hop' });
  }
  if (st.hop) {
    st.hop.t += dt;
    if (!st.hop.pushed && st.hop.t >= H.crouch()) st.hop.pushed = true;
    if (st.hop.t >= st.hop.dur) {
      st.at = st.hop.to;
      st.hop = null;
      H.landed(st.clock);
      post({ type: 'land' });
      if (st.at === st.target) {
        post({ type: 'stage', id: venues[st.at].id, anthem: venues[st.at].anthem });
        if (st.enterOnLand) { st.enterOnLand = false; setTimeout(enter, 280); }
        if (st.landOnArrive) { st.landOnArrive = false; if (presence.you !== venues[st.at].id) setTimeout(land, 200); }
      }
    }
  }
  spring(st.dive, st.diving ? 1 : 0, dt, 1.0, 1);
  // In the court you are player-sized like everyone else; out on the apron, a little bigger.
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
    r.ball.position.set(THREE.MathUtils.lerp(a.x, b.x, k), STAND_Y + 0.07 + (r.serve && r.k === 0 ? 0.22 : 0.12) * 4 * k * (1 - k), THREE.MathUtils.lerp(a.z, b.z, k));
  }
  for (const c of crowd.values()) {
    if (!islands[c.island].visible) continue;
    if (c.here && st.clock > c.idleAt) { c.idleAt = st.clock + 4 + Math.random() * 4; c.body.kick((Math.random() - 0.5) * 2, 2 + Math.random() * 2, 0); }
    c.body.simulate(dt, st.clock);
  }
  H.step(dt, st.clock, fighterAt().p, st.hop ? st.hop.t : null, slide.charge);
  // The place you leave drops away fast once you have pushed off (2.6 Hz, ratio 1); the next waits until it is gone, then rises
  // with a little overshoot (2.0 Hz, ratio 0.7), so two places are never on screen at once.
  const leaving = st.hop && st.hop.to !== st.at ? islands[st.at].userData.rise.x : 0;
  for (const g of islands) {
    const u = g.userData;
    const up = st.hop && st.hop.to !== st.at ? (u.i === st.at ? !st.hop.pushed : u.i === st.hop.to && leaving < 0.04) : u.i === st.at;
    spring(u.rise, up ? 1 : 0, dt, up ? 2.0 : 2.6, up ? 0.7 : 1);
    for (const tex of u.boards) tex.offset.x += dt * 0.07 * tex.repeat.x;
  }
  // The camera stays on the place; during a jump it lifts a little with you.
  const focus = islands[st.at].userData.base.clone();
  if (st.hop) focus.y += 0.12 * Math.max(0, fighterAt().p.y);
  const camHz = st.hop ? 2.4 : 1.3;
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
    g.position.y -= DROP * (1 - u.rise.x);
    g.visible = u.rise.x > 0.005;
    if (u.anim && g.visible) u.anim(t);
  }
  const f = fighterAt();
  mascot.scale.setScalar(f.size);
  H.render(t, f.p, st.hop ? st.hop.t : null);
  footShadow.visible = f.shadow != null;
  if (f.shadow) footShadow.position.copy(f.shadow);
  footShadow.scale.setScalar(f.size);
  footShadow.material.opacity = 0.7;
  for (const c of crowd.values()) if (islands[c.island].visible) c.body.render(t + c.island);
  // Name tags over the people at the place on screen.
  const showTags = !st.diving && !st.hop;
  const tmp = new THREE.Vector3();
  for (const c of crowd.values()) {
    const on = showTags && c.island === st.at && islands[c.island].userData.rise.x > 0.9;
    c.tag.style.opacity = on ? '1' : '0';
    if (!on) continue;
    c.holder.getWorldPosition(tmp);
    tmp.y += 0.24;
    tmp.project(camera);
    c.tag.style.transform = `translate(${((tmp.x + 1) / 2) * window.innerWidth}px,${((1 - tmp.y) / 2) * window.innerHeight}px) translate(-50%,-100%)`;
  }
  if (pennant.visible) pennant.userData.cloth.rotation.y = 0.35 * Math.sin(t * 3.1);
  slide.render(t);
  hand.pose();
  dock?.render();
  dustGeo.attributes.position.needsUpdate = true;

  // Camera. Outside: back far enough that the court and its place fit the screen's width (FIT units, about 70 m across at
  // the court), looking down the diagonal at 39 degrees. Inside (z = 1): low and close over the baseline, slowly circling.
  const z = THREE.MathUtils.clamp(st.dive.x, 0, 1);
  const orbit = rad(0.6) * Math.sin((t * Math.PI * 2) / 9) + z * rad(7) * Math.sin((t * Math.PI * 2) / 11);
  const look = new THREE.Vector3(st.cam.x.x, st.cam.y.x + 0.05 * z, st.cam.z.x);
  const FIT = 4.4;
  const far = FIT / (2 * Math.tan(rad(13)) * Math.min(camera.aspect, 0.8));
  const dist = THREE.MathUtils.lerp(far, 5.4, z);
  const dir = new THREE.Vector3(Math.sin(rad(45) + orbit), THREE.MathUtils.lerp(0.82, 0.55, z), Math.cos(rad(45) + orbit)).normalize();
  camera.position.copy(look).add(dir.multiplyScalar(dist));
  camera.lookAt(look);
  scene.fog.near = dist + 10; scene.fog.far = dist + 40;
  // The court sits below the middle of the screen, just above the dock, so the top two thirds show the place behind it.
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, window.innerHeight * (-0.13 * (1 - z) - 0.04 * z), window.innerWidth, window.innerHeight);
  sun.position.copy(look).add(new THREE.Vector3(-5, 9, 4));
  sun.target.position.copy(look);
  sun.target.updateMatrixWorld();
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
  hand.render();
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
window.courtsState = () => st;
// Test hook: with window.paused set, step the scene exactly `sec` seconds and draw it (headless stills).
window.advanceBy = (sec) => { for (let k = 0; k < sec * 120; k += 1) advance(1 / 120); pose(); renderer.render(scene, camera); hand.render(); };
window.advance = window.advanceBy; // test hook: headless stills read the hop and dive state
window.__go = (i) => go(i); // test hooks: headless stills jump straight to a place, or into its court
window.__enter = () => enter();
