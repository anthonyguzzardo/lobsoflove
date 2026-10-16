// The opponent picker: a clear jewel case on the paper, after docs/mo-design/vids/cool-cd-player.mov. Each rival is a disc. The case
// holds a printed card: the front is a court in the rival's color, under the disc; the back is the tracklist, every match you have
// played them, read by spinning the case round. Bundled with three.js by scripts/build-case-web.mjs and run inside a WebView.
//
// Motion spec. Springs are damped oscillators integrated at 1/120 s.
// - Tap: the lid swings on its left hinge from 0 to 178 degrees (2.0 Hz, damping ratio 0.72, about 4% overshoot).
//   As it opens the case eases to 0.7 scale and slides right by its own half width, so lid and tray stay centered.
// - Drag: free rotation, 0.45 degrees per px on both axes with no limit. Release keeps the finger's speed, then settles at 1.1 Hz,
//   ratio 0.6, on whichever face is nearer: the front (disc) or the back (tracklist). Tilt always settles level.
// - Swap: the case leaves upward 5.5 units in 260 ms (ease-in cubic) while rolling 18 degrees; the next one rises from 5.5 below
//   at 2.0 Hz, ratio 0.75, front side out.
// - Play: pulling the ball down the slide strip is pulling the disc: past 4% the lid opens, the disc rises 0.5 x the pull off the hub
//   and spins up to 1.5 turns a second. At the baseline it lifts the rest of the way and spins up to 3 turns a second; from 0.45 s
//   it flies at the lens (smoothstep squared), filling the screen by 1.1 s, when the page reports "played". Let go early and the
//   disc settles back on the hub.
// - Hold: never frozen. The case drifts 2.2 degrees on a 5 s sine and bobs 0.03.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { post } from './lib/bridge.js';
import { createSlide } from './lib/slide.js';

const PAPER = 0xefece5;
const INK = '#16181d';
const MONO = 'ui-monospace,"SF Mono",Menlo,monospace';
const rad = THREE.MathUtils.degToRad;
const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.9;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
// Key light rakes in from the upper left. Kept well off the camera axis: aimed closer, its mirror reflection lands on the disc exactly when the case lies open and washes the label out.
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(-7, 7, 2.5);
scene.add(key);

// Clear polystyrene, in two weights. Walls and ribs are thick: they refract hard and pick up a cool gray in their depth, which is what
// draws the frame. The flat panes are thin and perfectly smooth, so the disc reads sharp through them and only reflections give them away.
renderer.transmissionResolutionScale = 1;
const clear = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, transmission: 1, thickness: 0.4, ior: 1.52, roughness: 0.02, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5, attenuationColor: new THREE.Color(0x9aa9bd), attenuationDistance: 0.55,
});
const pane = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, transmission: 1, thickness: 0.01, ior: 1.12, roughness: 0, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.7, specularIntensity: 1,
});
const frosted = clear.clone();
frosted.roughness = 0.3;

const box = (w, h, d, r, mat, x, y, z) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  m.position.set(x, y, z);
  return m;
};

/** A shallow open box: floor plate plus four walls, each a separate rounded slab so edges read as molded plastic. */
function shellGroup(depth, wall) {
  const g = new THREE.Group();
  g.add(box(2 - wall * 1.2, 2 - wall * 1.2, 0.02, 0.008, pane, 0, 0, 0.012));
  g.add(box(2, wall, depth, 0.02, clear, 0, 1 - wall / 2, depth / 2));
  g.add(box(2, wall, depth, 0.02, clear, 0, -1 + wall / 2, depth / 2));
  g.add(box(wall, 2 - wall * 2, depth, 0.02, clear, -1 + wall / 2, 0, depth / 2));
  g.add(box(wall, 2 - wall * 2, depth, 0.02, clear, 1 - wall / 2, 0, depth / 2));
  return g;
}

const root = new THREE.Group(); // swap travel and fit
const body = new THREE.Group(); // tilt
root.add(body);
scene.add(root);

// Tray. The disc sits dead center: the hinge is two knuckles on the left wall, not a spine that pushes the hub over.
const tray = shellGroup(0.17, 0.085);
const seat = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.012, 8, 96), clear);
seat.position.set(0, 0, 0.04);
tray.add(seat);
for (const [x, y] of [[-0.74, 0.86], [0.74, 0.86], [-0.74, -0.86], [0.74, -0.86]]) tray.add(box(0.2, 0.06, 0.05, 0.015, clear, x, y, 0.05)); // corner ribs
for (const y of [0.78, -0.78]) {
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 20), frosted);
  knuckle.position.set(-0.985, y, 0.17);
  tray.add(knuckle);
}
const hub = new THREE.Group();
hub.position.set(0, 0, 0.03);
const hubCore = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.09, 40), frosted);
hubCore.rotation.x = Math.PI / 2;
hubCore.position.z = 0.045;
hub.add(hubCore);
for (let i = 0; i < 8; i += 1) {
  const a = (i / 8) * Math.PI * 2;
  const tooth = box(0.035, 0.05, 0.06, 0.01, clear, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.06);
  tooth.rotation.z = a + Math.PI / 2;
  hub.add(tooth);
}
tray.add(hub);
body.add(tray);

// The printed card under the tray floor: two faces, each its own canvas, redrawn for every rival.
const CARD = 1.84;
const cardCanvas = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
const frontCv = cardCanvas(1024);
const backCv = cardCanvas(1024);
const frontTex = new THREE.CanvasTexture(frontCv);
const backTex = new THREE.CanvasTexture(backCv);
for (const t of [frontTex, backTex]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
const cardMat = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 });
const cardFront = new THREE.Mesh(new THREE.PlaneGeometry(CARD, CARD), cardMat(frontTex));
cardFront.position.z = -0.004;
const cardBack = new THREE.Mesh(new THREE.PlaneGeometry(CARD, CARD), cardMat(backTex));
cardBack.rotation.y = Math.PI;
cardBack.position.z = -0.007;
tray.add(cardFront, cardBack);

// Disc.
const loader = new THREE.TextureLoader();
const labels = {};
for (const [cast, url] of Object.entries(window.DISC_ART)) {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  labels[cast] = t;
}
// The label carries its own color (emissive) over a near-black base, so room light adds only a faint sheen. A glossier coat mirrors the bright studio and bleaches the print whenever the case lies open.
const face = new THREE.MeshPhysicalMaterial({ color: 0x050506, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.55, metalness: 0, specularIntensity: 0.25, clearcoat: 0.12, clearcoatRoughness: 0.3, envMapIntensity: 0.12 });
const mirror = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.9, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [200, 700] });
// Data side: silver with rainbow wedges, drawn as a conic gradient.
const holo = cardCanvas(512);
const hctx = holo.getContext('2d');
const conic = hctx.createConicGradient(0.6, 256, 256);
[[0, '#dfe3ea'], [0.06, '#ff7ad9'], [0.1, '#ffe07a'], [0.14, '#7affd2'], [0.2, '#dfe3ea'], [0.5, '#cfd5de'], [0.56, '#7ab8ff'], [0.6, '#c07aff'], [0.64, '#ff9a7a'], [0.7, '#dfe3ea'], [1, '#dfe3ea']].forEach(([o, c]) => conic.addColorStop(o, c));
hctx.fillStyle = conic;
hctx.fillRect(0, 0, 512, 512);
hctx.fillStyle = '#eef0f4';
hctx.beginPath(); hctx.arc(256, 256, 88, 0, Math.PI * 2); hctx.fill();
const holoTex = new THREE.CanvasTexture(holo);
holoTex.colorSpace = THREE.SRGBColorSpace;
mirror.map = holoTex;
const rim = new THREE.MeshPhysicalMaterial({ color: 0xdfe3ea, roughness: 0.15, metalness: 1 });
const discGeo = new THREE.CylinderGeometry(0.84, 0.84, 0.016, 96);
discGeo.rotateY(Math.PI / 2); // the cap's texture mapping starts a quarter turn off upright
const disc = new THREE.Mesh(discGeo, [rim, face, mirror]);
disc.rotation.x = Math.PI / 2;
const DISC_REST = new THREE.Vector3(0, 0, 0.085);
disc.position.copy(DISC_REST);
body.add(disc);

// Lid: hinged on the tray's left edge.
const hinge = new THREE.Group();
hinge.position.set(-1, 0, 0.18);
const lid = new THREE.Group();
const lidShell = shellGroup(0.06, 0.045);
lidShell.position.x = 1;
lid.add(lidShell);
for (const y of [0.55, -0.55]) lid.add(box(0.05, 0.22, 0.05, 0.012, frosted, 1.965, y, 0.035)); // booklet tabs
hinge.add(lid);

// The booklet in the lid, seen once it swings open: liner notes on the rival. Closed, the lid stays clear so the disc shows through;
// the notes only come up past 90 degrees, while the lid is edge-on and the swap can't be seen.
const bookCv = document.createElement('canvas');
bookCv.width = bookCv.height = 1024;
const bookTex = new THREE.CanvasTexture(bookCv);
bookTex.colorSpace = THREE.SRGBColorSpace;
bookTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const booklet = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 1.84), new THREE.MeshStandardMaterial({ map: bookTex, roughness: 0.85, metalness: 0, envMapIntensity: 0.5, transparent: true, opacity: 0 }));
booklet.rotation.y = Math.PI;
booklet.position.set(1, 0, -0.002);
lid.add(booklet);
body.add(hinge);

// Contact shadow: a soft blob on the floor behind the case.
const blob = cardCanvas(256);
const ctx = blob.getContext('2d');
const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
grad.addColorStop(0, 'rgba(40,34,26,0.4)');
grad.addColorStop(0.55, 'rgba(40,34,26,0.13)');
grad.addColorStop(1, 'rgba(40,34,26,0)');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 256, 256);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
shadow.position.z = -0.9;
scene.add(shadow);

// The card. Front: a hard court from above in a deep shade of the rival's color, its lines in chalk, framing the disc; their style along the
// baseline. Back: the tracklist, paper and ink, one line per match against them, newest last, like the back of a real album.
/** `hex` mixed `k` of the way to ink, in plain sRGB, as paint would. */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c, ink) => Math.round(c + (ink - c) * k);
  return `rgb(${mix(n >> 16, 0x16)},${mix((n >> 8) & 255, 0x18)},${mix(n & 255, 0x1d)})`;
}
function drawCard(r) {
  const f = frontCv.getContext('2d');
  const S = 1024;
  // Their color, taken down toward ink so the disc (often printed in the same color) stands off it.
  f.fillStyle = shade(r.color, 0.55);
  f.fillRect(0, 0, S, S);
  // Grain, so the color reads as print and not as a flat fill.
  for (let i = 0; i < 2600; i += 1) {
    f.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
    f.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  f.strokeStyle = 'rgba(255,253,240,0.92)';
  f.lineWidth = 9;
  const m = 70;
  f.strokeRect(m, m, S - 2 * m, S - 2 * m); // doubles
  f.beginPath();
  f.moveTo(m + 120, m); f.lineTo(m + 120, S - m); // singles
  f.moveTo(S - m - 120, m); f.lineTo(S - m - 120, S - m);
  f.moveTo(m + 120, S / 2 - 250); f.lineTo(S - m - 120, S / 2 - 250); // service lines
  f.moveTo(m + 120, S / 2 + 250); f.lineTo(S - m - 120, S / 2 + 250);
  f.moveTo(S / 2, S / 2 - 250); f.lineTo(S / 2, S / 2 + 250); // center service line
  f.stroke();
  f.lineWidth = 6; // the net
  f.setLineDash([14, 10]);
  f.beginPath(); f.moveTo(m - 20, S / 2); f.lineTo(S - m + 20, S / 2); f.stroke();
  f.setLineDash([]);
  f.fillStyle = 'rgba(255,253,240,0.85)';
  f.font = `800 30px ${MONO}`;
  f.textBaseline = 'middle';
  f.fillText(r.style.toUpperCase(), m + 4, m / 2 + 2);
  f.textAlign = 'right';
  f.fillText(`#${r.rank}`, S - m - 4, m / 2 + 2);
  f.textAlign = 'left';
  f.fillText('LOBSOFLOVE', m + 4, S - m / 2 - 2);
  f.textAlign = 'right';
  f.fillText('SIDE A', S - m - 4, S - m / 2 - 2);
  f.textAlign = 'left';
  frontTex.needsUpdate = true;

  const b = backCv.getContext('2d');
  b.fillStyle = '#f4f1ea';
  b.fillRect(0, 0, S, S);
  b.fillStyle = r.color; // a spine band in their color down the left edge
  b.fillRect(0, 0, 64, S);
  const x0 = 110;
  b.fillStyle = INK;
  b.textBaseline = 'alphabetic';
  b.font = `800 30px ${MONO}`;
  b.globalAlpha = 0.55;
  b.fillText(`SIDE B  /  YOU VS ${r.name}`.slice(0, 44), x0, 120);
  b.globalAlpha = 1;
  b.font = `800 92px ${MONO}`;
  b.fillText('TRACKLIST', x0, 222);
  b.fillRect(x0, 252, S - x0 - 70, 6);
  const rows = r.tracks.slice(-8);
  b.font = `700 40px ${MONO}`;
  if (rows.length === 0) {
    b.fillText('01', x0, 330);
    b.fillText('FIRST MEETING', x0 + 90, 330);
    b.globalAlpha = 0.55;
    b.fillText('UNRELEASED', x0 + 90, 380);
    b.fillText('SLIDE THE BALL TO RECORD IT.', x0, 470);
    b.globalAlpha = 1;
  }
  rows.forEach((t, i) => {
    const y = 336 + i * 74;
    const n = r.tracks.length - rows.length + i + 1;
    b.globalAlpha = 0.5;
    b.fillText(String(n).padStart(2, '0'), x0, y);
    b.globalAlpha = 1;
    // W in an ink box, L as an outline: readable at a glance from across the case.
    b.fillStyle = INK;
    if (t.r === 'W') b.fillRect(x0 + 74, y - 38, 50, 50);
    else { b.lineWidth = 4; b.strokeStyle = INK; b.strokeRect(x0 + 76, y - 36, 46, 46); }
    b.fillStyle = t.r === 'W' ? '#f4f1ea' : INK;
    b.fillText(t.r, x0 + 87, y);
    b.fillStyle = INK;
    b.fillText(t.score, x0 + 150, y);
    b.globalAlpha = 0.6;
    b.textAlign = 'right';
    b.fillText(t.date, S - 70, y);
    b.textAlign = 'left';
    b.globalAlpha = 1;
  });
  b.font = `800 30px ${MONO}`;
  b.globalAlpha = 0.55;
  const [w, l] = r.h2h;
  b.fillText(w + l ? `YOU ${w}  THEM ${l}` : 'NO HISTORY YET', x0, S - 80);
  b.globalAlpha = 1;
  // A barcode, because the back of an album has one.
  let bx = S - 70 - 220;
  while (bx < S - 70) { const wBar = 3 + ((bx * 7) % 5) * 2; b.fillRect(bx, S - 128, wBar, 60); bx += wBar + 4 + ((bx * 3) % 4); }
  backTex.needsUpdate = true;
}

// Liner notes: their color across the top with the name knocked out of it, their line as a pull quote, then the credits.
function drawBooklet(r) {
  const b = bookCv.getContext('2d');
  const S = 1024;
  const x0 = 80;
  b.fillStyle = '#f4f1ea';
  b.fillRect(0, 0, S, S);
  b.fillStyle = r.color;
  b.fillRect(0, 0, S, 300);
  b.fillStyle = INK;
  b.textBaseline = 'alphabetic';
  b.font = `800 30px ${MONO}`;
  b.globalAlpha = 0.7;
  b.fillText('LINER NOTES', x0, 92);
  b.textAlign = 'right';
  b.fillText(`#${r.rank} ON THE LADDER`, S - x0, 92);
  b.textAlign = 'left';
  b.globalAlpha = 1;
  // The name, as big as fits on one line.
  let size = 120;
  b.font = `800 ${size}px ${MONO}`;
  while (b.measureText(r.name).width > S - 2 * x0 && size > 48) { size -= 4; b.font = `800 ${size}px ${MONO}`; }
  b.fillText(r.name, x0, 250);
  // Their line, wrapped, in quotes.
  b.font = `700 50px ${MONO}`;
  const words = `"${r.tagline}"`.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (b.measureText(next).width > S - 2 * x0 && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  lines.slice(0, 4).forEach((l, i) => b.fillText(l, x0, 400 + i * 66));
  // Credits: what we know about them, like the small print inside a sleeve.
  const credits = [['PLAYS', r.style], ['FAVORITE PRO', r.pro], ['HOME COURT', r.home], ['RACKET', r.racket]].filter(([, v]) => v);
  const top = S - 70 - credits.length * 58;
  b.fillRect(x0, top - 40, S - 2 * x0, 5);
  credits.forEach(([k, v], i) => {
    const y = top + 20 + i * 58;
    b.font = `800 28px ${MONO}`;
    b.globalAlpha = 0.5;
    b.fillText(k, x0, y);
    b.globalAlpha = 1;
    b.font = `700 36px ${MONO}`;
    b.fillText(String(v).toUpperCase().slice(0, 24), x0 + 300, y);
  });
  bookTex.needsUpdate = true;
}

// State.
const spring = (x = 0) => ({ x, v: 0 });
function step(s, target, dt, hz, ratio) {
  const w = hz * Math.PI * 2;
  s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt;
  s.x += s.v * dt;
}
const st = {
  open: false, lid: spring(0), rx: spring(0), ry: spring(0), y: spring(-5.5), dist: spring(8),
  rivals: [], shown: null, wanted: null, swap: null, play: null, spin: 0, lift: spring(0), clock: 0,
  held: false, flingX: 0, flingY: 0,
};
const byId = (id) => st.rivals.find((r) => r.id === id);

function setOpen(open) {
  if (st.open === !!open) return;
  st.open = !!open;
  post({ type: 'open', open: st.open });
}

// UI: the nameplate, head to head, the rack of discs, the slide strip.
const slide = createSlide({ post, onSlid: () => playDisc() });

function paintPlate(r) {
  $('rk').innerHTML = `<span>#${r.rank}</span>`;
  $('name').innerHTML = `<span>${esc(r.name)}</span>`;
  $('plate').style.setProperty('--pc', r.color);
  const [w, l] = r.h2h;
  $('hw').textContent = String(w);
  $('hl').textContent = String(l);
  $('h2h').classList.toggle('none', w + l === 0);
  $('hcap').textContent = w + l === 0 ? 'NEVER MET' : w > l ? 'YOU LEAD' : l > w ? 'THEY LEAD' : 'ALL SQUARE';
  paintTag(r);
  slide.setKey('01', `PLAY ${r.name}`, 'SLIDE TO LOAD THE DISC');
}
function paintTag(r) {
  const t = $('tag');
  const next = side ? (r.tracks.length ? 'SIDE B. EVERY MATCH YOU HAVE PLAYED THEM.' : 'SIDE B. NOTHING ON IT YET.')
    : st.open ? `"${r.tagline}"` : r.tracks.length ? 'SPIN THE CASE FOR THE TRACKLIST.' : 'TAP THE CASE TO OPEN IT.';
  if (t.textContent === next) return;
  t.textContent = next;
  t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function paintRack() {
  const rack = $('rack');
  rack.style.setProperty('--n', String(Math.max(st.rivals.length, 5)));
  rack.innerHTML = st.rivals.map((r) => `<button class="cd" data-id="${esc(r.id)}" aria-label="${esc(r.name)}"><img src="${window.DISC_ART[r.cast]}" alt=""></button>`).join('');
  markRack();
}
function markRack() {
  for (const b of $('rack').children) b.classList.toggle('on', b.dataset.id === st.wanted);
}
$('rack').addEventListener('click', (e) => {
  const b = e.target.closest('.cd');
  if (b) pick(b.dataset.id);
});

function pick(id) {
  if (!byId(id) || id === st.wanted || st.play) return;
  st.wanted = id;
  markRack();
  post({ type: 'pick', id });
}

function show(id) {
  const r = byId(id);
  st.shown = id;
  face.emissiveMap = labels[r.cast] || null;
  face.needsUpdate = true;
  drawCard(r);
  drawBooklet(r);
  paintPlate(r);
}

/** The app hands over every rival with their record against you; `pick` is the one to show first. */
window.setRack = ({ rivals, pick: first }) => {
  st.rivals = rivals;
  paintRack();
  if (!st.shown || !byId(st.shown)) {
    st.wanted = byId(first) ? first : rivals[0]?.id ?? null;
    if (st.wanted) show(st.wanted);
    markRack();
  } else if (byId(st.shown)) {
    show(st.shown); // same rival, fresh record (back from a match)
  }
};
window.pick = pick;
/** Test hook: the rival after the one in the case. */
window.nextId = () => { const i = st.rivals.findIndex((r) => r.id === st.wanted); return st.rivals[(i + 1) % st.rivals.length]?.id; };
/** Test hook: throw the case as a finger would (degrees per second). */
window.fling = (vx, vy) => { st.rx.v = vx; st.ry.v = vy; };
window.setOpen = setOpen;
function playDisc() {
  if (st.play || !st.shown) return;
  setOpen(true);
  st.play = { t: 0, done: false };
}
window.playDisc = playDisc;

// Pointer: drag spins the case freely, a short still press toggles the lid.
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, lx: e.clientX, ly: e.clientY, lt: performance.now() };
  st.held = true;
  st.rx.v = 0;
  st.ry.v = 0;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!down) return;
  const now = performance.now();
  const dx = e.clientX - down.lx;
  const dy = e.clientY - down.ly;
  const dt = Math.max(1, now - down.lt) / 1000;
  down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
  st.ry.x += dx * 0.45;
  st.rx.x += dy * 0.45;
  // Remember the finger's speed (degrees per second, lightly smoothed) to hand to the spring on release.
  st.flingY = 0.6 * (dx * 0.45) / dt + 0.4 * (st.flingY || 0);
  st.flingX = 0.6 * (dy * 0.45) / dt + 0.4 * (st.flingX || 0);
  down.lx = e.clientX; down.ly = e.clientY; down.lt = now;
});
const up = () => {
  if (!down) return;
  const tap = down.moved < 8 && performance.now() - down.t < 350;
  const idle = performance.now() - down.lt > 80;
  down = null;
  st.held = false;
  st.ry.v = idle ? 0 : THREE.MathUtils.clamp(st.flingY || 0, -900, 900);
  st.rx.v = idle ? 0 : THREE.MathUtils.clamp(st.flingX || 0, -900, 900);
  st.flingX = 0; st.flingY = 0;
  if (tap && !st.play && !st.swap && slide.charge < 0.02) setOpen(!st.open);
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);

/** Which face the case shows: 0 front (disc), 1 back (tracklist). */
let side = 0;
function advance(dt) {
  st.clock += dt;
  const charge = slide.charge;
  slide.step(dt);

  if (st.wanted !== st.shown && !st.swap && !st.play) st.swap = { t: 0, phase: 'out' };
  if (st.swap) {
    st.swap.t += dt;
    if (st.swap.phase === 'out') {
      const k = Math.min(1, st.swap.t / 0.26);
      st.y.x = 5.5 * k * k * k;
      if (k >= 1) {
        st.open = false;
        show(st.wanted);
        st.lid.x = 0; st.lid.v = 0;
        st.y.x = -5.5; st.y.v = 0;
        // The next case comes in front side out, however the last one was left.
        st.rx.x = 0; st.rx.v = 0; st.ry.x = 0; st.ry.v = 0;
        st.swap = { t: 0, phase: 'in' };
        post({ type: 'open', open: false });
      }
    } else {
      step(st.y, 0, dt, 2.0, 0.75);
      if (Math.abs(st.y.x) < 0.003 && Math.abs(st.y.v) < 0.02) { st.y.x = 0; st.y.v = 0; st.swap = null; }
    }
  } else {
    step(st.y, 0, dt, 2.0, 0.75); // first arrival
  }

  const pulling = charge > 0.04 || !!st.play;
  step(st.lid, st.open || pulling ? 1 : 0, dt, 2.0, 0.72);
  if (!st.held) {
    // Settle level, on the nearer face. Pulling the disc always turns the front back round.
    step(st.rx, Math.round(st.rx.x / 360) * 360, dt, 1.1, 0.6);
    const half = pulling ? 360 : 180;
    step(st.ry, Math.round(st.ry.x / half) * half, dt, 1.1, 0.6);
  }
  const nowSide = ((Math.round(st.ry.x / 180) % 2) + 2) % 2;
  if (nowSide !== side && !st.held) { side = nowSide; post({ type: 'side', side }); }

  if (st.play) {
    st.play.t += dt;
    step(st.lift, 1, dt, 1.6, 0.8);
    st.spin = Math.min(3, st.spin + dt * 3.2);
    if (!st.play.done && st.play.t > 1.1) { st.play.done = true; post({ type: 'played', id: st.shown }); }
    // Gone to the match by now; set the disc back on the hub for when the player comes back.
    if (st.play.t > 2.4) { st.play = null; setOpen(false); }
  } else {
    step(st.lift, charge * 0.5, dt, 3, 0.8);
    st.spin = Math.max(charge * 1.5, st.spin - dt * 2.5);
  }
}

// Framing. The case sits in the #stage box the page lays out, as big as the stage allows; never taller than 80% of it.
const OPEN_SCALE = 0.7;
function fit(dt, snap) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const sr = $('stage').getBoundingClientRect();
  const tan = Math.tan(rad(15));
  const aspect = w / h;
  // Closed, the case is 2 units wide and fills 80% of the stage width; open, lid and tray are 4 x 0.7 and fill 94%.
  const o = THREE.MathUtils.clamp(st.lid.x, 0, 1);
  const span = 2 + (4 * OPEN_SCALE - 2) * o;
  const byW = (span / (0.8 + 0.14 * o)) * (w / Math.max(120, sr.width)) / (2 * tan * aspect);
  const byH = (2 / 0.8) * (h / Math.max(120, sr.height)) / (2 * tan);
  const d = Math.max(byW, byH);
  if (snap) st.dist.x = d; else step(st.dist, d, dt, 2, 1);
  camera.position.set(0, 0, st.dist.x);
  camera.setViewOffset(w, h, 0, h / 2 - (sr.top + sr.height / 2), w, h);
}
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  fit(0, true);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function pose(t) {
  const o = THREE.MathUtils.clamp(st.lid.x, 0, 1.06);
  const s = 1 - (1 - OPEN_SCALE) * Math.min(o, 1);
  const drift = Math.sin((st.clock * Math.PI * 2) / 5);
  const swapRoll = st.swap && st.swap.phase === 'out' ? rad(18) * (st.y.x / 5.5) : 0;
  root.position.set(s * o, st.y.x + 0.03 * Math.sin((st.clock * Math.PI * 2) / 3.7), 0);
  root.scale.setScalar(s);
  body.rotation.set(rad(-9 + st.rx.x + drift * 1.1), rad(11 * (1 - o) + st.ry.x + drift * 2.2), swapRoll);
  lid.rotation.y = rad(-178) * st.lid.x;
  // On play the disc leaves the tray and flies at the lens, spinning, filling the screen as the match loads.
  // It travels in world space, straight down the lens axis, whatever the case's tilt.
  const fly = st.play ? Math.pow(THREE.MathUtils.smoothstep(st.play.t, 0.45, 1.1), 2) : 0;
  disc.position.set(DISC_REST.x, DISC_REST.y, DISC_REST.z + 0.45 * st.lift.x);
  if (fly > 0) {
    root.updateMatrixWorld();
    const at = body.localToWorld(disc.position.clone()).lerp(new THREE.Vector3(0, 0, st.dist.x - 0.9), fly);
    disc.position.copy(body.worldToLocal(at));
  }
  $('ui').style.opacity = String(1 - THREE.MathUtils.smoothstep(fly, 0.15, 0.6));
  booklet.material.opacity = THREE.MathUtils.smoothstep(st.lid.x, 0.45, 0.6);
  shadow.position.x = root.position.x - s * o + 0.08 - st.ry.x * 0.012;
  shadow.position.y = root.position.y - 0.16 + st.rx.x * 0.012;
  shadow.scale.set((2.5 + 2.0 * Math.min(o, 1)) * s, 2.5 * s, 1);
  shadow.material.opacity = THREE.MathUtils.clamp(1 - Math.abs(st.y.x) / 3, 0, 1);
  slide.render(t);
  if (st.shown) paintTag(byId(st.shown));
}

const DT = 1 / 120;
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min((now - last) / 1000, 0.1);
  last = now;
  // `window.paused` (a test hook) holds the simulation so `advance` can pose exact frames.
  while (acc >= DT) {
    if (!window.paused) { advance(DT); disc.rotateY(-st.spin * Math.PI * 2 * DT); }
    acc -= DT;
  }
  fit(DT, false);
  camera.updateProjectionMatrix();
  pose(now / 1000);
  renderer.render(scene, camera);
}
window.advance = (sec) => {
  for (let k = 0; k < sec * 120; k += 1) { advance(DT); disc.rotateY(-st.spin * Math.PI * 2 * DT); }
  fit(0, true);
  camera.updateProjectionMatrix();
  pose(st.clock);
  renderer.render(scene, camera);
};
requestAnimationFrame(frame);
post({ type: 'ready' });
