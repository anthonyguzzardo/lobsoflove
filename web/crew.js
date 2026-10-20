// Crew: your friends standing on the paper as their real jelly bodies (web/jelly-core.js), lined up like a team photo.
// No forms. You poke them. A pretender (added by name, not in the app yet) stands pale and see-through; tap one to text them their
// link. The dashed chalk spot at the end of the line is the next friend: tap it and write their name on the ink page. The one big
// action (start the crew, send the invite, call friends up, answer a call-up, confirm a delete) is the slide strip, the same one
// every page has. To call friends up you draw a loop around them with the ink page's brush: the headcount names the format, the
// app writes the message (tap it to retype it), and the strip sends it. A call-up sent to you turns the strip into I'M IN.
// Leaving or deleting the crew, or holding a pretender to remove them, turns the strip red: sliding it all the way is the yes.
//
// Motion spec.
// - Line-up: a team photo. 1.3 apart, two to a row (a phone is tall, so the photo goes up, not across). Each row back stands 1.0 further and 0.95 higher on a
//   cream riser, so every face shows over the row in front. Scale 0.6.
// - Arrival: a fighter new to the roster drops from 2.6 above its spot, lands and rings out on its own jelly (as on /fighter).
//   On the first build they drop 90 ms apart, left to right.
// - Tap: poke where the finger hit (power 6, sigma 0.5), hop 3.2 up, spin 2.4 rad/s about y, happy face for 0.8 s.
// - Hold: every 2.6 to 4.2 s one fighter (not the one you just poked) does a small hop of 2.2, so the line is never frozen.
//   Pretenders sway 4 degrees on a 3.4 s sine instead: they are not really here yet.
// - Cheer (after the crew is started or someone joins): everyone hops 4.2, 70 ms apart, happy faces for 1.2 s.
// - Chalk spot: dashed ring 0.42 across, dashes crawl around it at 0.5 rad/s, and it breathes 4% on a 1.8 s sine.
// - Circle: the loop is the patterned brush, 13 px, fading over 0.5 s after you lift. Everyone inside hops 3.0, 60 ms apart,
//   and gets a clay ring on the floor that breathes 5% on a 1.2 s sine. Someone answering in jumps 4.0 with a happy face.
// - Hold: 550 ms still on a pretender offers to remove them.
// - Camera: 30 degree lens, fits the line-up into the band between the header and the slide strip, orbits 2.5 degrees on a 9 s
//   sine, follows on a 1.4 Hz spring with ratio 1 (no bounce on a camera).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { FEEL, SoftBody } from './jelly-core.js';
import { post } from './lib/bridge.js';
import { drawBrush } from './lib/brush.js';
import { createSlide } from './lib/slide.js';

const PAPER = 0xefece5;
const $ = (id) => document.getElementById(id);
const rad = THREE.MathUtils.degToRad;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

const GAP = 1.3;
const ROW_BACK = 1.0; // each row back stands this much further away
const RISE = 0.95; // and this much higher, on a riser, like a team photo
const PER_ROW = 2;
const SCALE = 0.6;
const DROP = 2.6; // in the body's own units, the same drop as /fighter
const PALE = '#d9d3c7';

const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.setClearColor(PAPER, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.25));
const key = new THREE.DirectionalLight(0xfff4e8, 2.3);
key.position.set(-3, 6, 6);
const rim = new THREE.DirectionalLight(0xffffff, 1.4);
rim.position.set(3, 3, -5);
scene.add(key, rim);

const texOf = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
// A soft contact shadow, shared by everyone.
const shadowTex = texOf(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(40,34,26,.42)'); r.addColorStop(0.55, 'rgba(40,34,26,.16)'); r.addColorStop(1, 'rgba(40,34,26,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const ringMat = new THREE.MeshBasicMaterial({ color: 0xe2562f, transparent: true, depthWrite: false, side: THREE.DoubleSide });

// The chalk spot for the next friend.
const chalkTex = texOf(256, 256, (g, w) => {
  g.strokeStyle = 'rgba(22,24,29,.55)'; g.lineWidth = 7; g.setLineDash([20, 15]); g.lineCap = 'round';
  g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 12, 0, TAU); g.stroke();
  g.setLineDash([]); g.lineWidth = 9; g.strokeStyle = 'rgba(226,86,47,.9)';
  g.beginPath(); g.moveTo(w / 2 - 34, w / 2); g.lineTo(w / 2 + 34, w / 2); g.moveTo(w / 2, w / 2 - 34); g.lineTo(w / 2, w / 2 + 34); g.stroke();
});
const chalk = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.84), new THREE.MeshBasicMaterial({ map: chalkTex, transparent: true, depthWrite: false }));
chalk.rotation.x = -Math.PI / 2;
chalk.visible = false;
scene.add(chalk);

const tagsEl = $('tags');
const st = {
  data: null, mode: 'off', fighters: [], clock: 0, nextHop: 2.5, lastPoked: null,
  cam: { pos: new THREE.Vector3(0, 2, 9), vp: new THREE.Vector3(), look: new THREE.Vector3(0, 0.5, 0), vl: new THREE.Vector3() },
  offset: 0, first: true, chalkTag: null,
  sel: new Set(), anyone: false, confirm: null, answers: {}, message: '',
};

function slotFor(i, n) {
  const row = Math.floor(i / PER_ROW);
  const inRow = Math.min(PER_ROW, n - row * PER_ROW);
  const k = i % PER_ROW;
  return new THREE.Vector3((k - (inRow - 1) / 2) * GAP, row * RISE, -row * ROW_BACK);
}

// Risers for the back rows: cream blocks with an ink top edge, rebuilt when the roster changes.
const risers = new THREE.Group();
scene.add(risers);
const riserMat = new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.85 });
const edgeMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.5 });
function buildRisers(n) {
  for (const m of risers.children) m.geometry.dispose();
  risers.clear();
  const rows = Math.ceil(n / PER_ROW);
  for (let r = 1; r < rows; r += 1) {
    const inRow = Math.min(PER_ROW, n - r * PER_ROW);
    const w = Math.max(inRow, 2) * GAP + 0.3;
    const box = new THREE.Mesh(new RoundedBoxGeometry(w, r * RISE, ROW_BACK + 0.1, 3, 0.04), riserMat);
    box.position.set(0, (r * RISE) / 2, -r * ROW_BACK);
    const edge = new THREE.Mesh(new RoundedBoxGeometry(w + 0.02, 0.05, 0.05, 2, 0.02), edgeMat);
    edge.position.set(0, r * RISE, -r * ROW_BACK + (ROW_BACK + 0.1) / 2);
    risers.add(box, edge);
  }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function makeFighter(f) {
  const body = new SoftBody({ cast: f.cast, color: f.pretender ? PALE : f.color, edge: 0.13, transmission: f.pretender ? 0.62 : 0.2 });
  // Stiff enough to stand for the photo: the softest (the moonballer) otherwise slumps onto its back and never climbs up.
  body.feel = { ...FEEL[f.cast], alpha: Math.max(FEEL[f.cast].alpha, 0.026) };
  const carrier = new THREE.Group();
  body.group.scale.setScalar(SCALE);
  carrier.add(body.group);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  carrier.add(shadow);
  scene.add(carrier);
  const tag = el('div', `tag${f.you ? ' you' : ''}${f.pretender ? ' pre' : ''}`);
  tag.style.setProperty('--pc', f.color);
  tag.append(el('b', '', f.name));
  if (f.you && f.name !== 'YOU') tag.append(el('i', '', 'YOU'));
  if (f.pretender) tag.append(el("i", "", "NOT IN YET · TAP TO TEXT"));
  const mark = el('i', 'ans', '');
  tag.append(mark);
  tagsEl.append(tag);
  // A clay ring on the floor: circled for a call-up, or in on one.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 48), ringMat.clone());
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  ring.visible = false;
  carrier.add(ring);
  return { f, body, carrier, shadow, tag, mark, ring, home: new THREE.Vector3(), ph: Math.random() * TAU };
}

function drop(g, delay) {
  // Lift every lattice node: it falls from up there under its own gravity and rings out when it lands.
  const lift = () => { for (let m = 1; m < g.body.x.length; m += 3) g.body.x[m] += DROP; };
  if (REDUCED) return;
  if (delay) setTimeout(lift, delay); else lift();
}

/**
 * Called by the app with the crew as it is now: { mode, name, code, role, error, suggest, fighters, callup }.
 * `callup` is the live call-up that matters to you (yours, or one sent to you): { id, mine, caller, callerName, message, need,
 * status, answers: { id: 'in' | 'out' | null } }. Fighters keep their bodies across updates; new ones drop in.
 */
window.setCrew = (data) => {
  st.data = data;
  st.mode = data.mode;
  const want = data.fighters || [];
  const keep = new Map(st.fighters.map((g) => [g.f.id, g]));
  const next = [];
  want.forEach((f, i) => {
    let g = keep.get(f.id);
    const changed = g && (g.f.cast !== f.cast || g.f.color !== f.color || g.f.name !== f.name || !!g.f.pretender !== !!f.pretender);
    if (g && changed) { remove(g); g = null; }
    if (g) { keep.delete(f.id); g.f = f; } else {
      g = makeFighter(f);
      drop(g, st.first ? i * 90 : 0);
      if (!st.first) post({ type: 'arrive' });
    }
    next.push(g);
  });
  for (const g of keep.values()) remove(g);
  st.fighters = next;
  st.first = false;
  for (const id of [...st.sel]) if (!next.some((g) => g.f.id === id)) st.sel.delete(id);
  // Someone just said they are in: they jump for it.
  const was = st.answers;
  st.answers = data.callup ? data.callup.answers || {} : {};
  for (const g of next) if (st.answers[g.f.id] === 'in' && was[g.f.id] !== 'in') { g.body.kick(0, 4, 0); g.body.mood.happy = 1.4; post({ type: 'in' }); }
  layout();
  panel();
};

/** The app's message for the call-up you are drawing (or the one you typed instead). */
window.setMessage = (text) => { st.message = text; panel(); };

function remove(g) {
  scene.remove(g.carrier);
  g.body.geo.dispose();
  g.body.mat.dispose();
  g.tag.remove();
}

function layout() {
  const showChalk = st.mode === 'crew';
  const n = st.fighters.length + (showChalk ? 1 : 0);
  st.fighters.forEach((g, i) => { g.home.copy(slotFor(i, n)); g.carrier.position.copy(g.home); });
  chalk.visible = showChalk;
  buildRisers(n);
  if (!st.chalkTag) {
    st.chalkTag = el('div', 'tag chalk');
    st.chalkTag.append(el('b', '', 'INVITE'), el('i', '', 'TAP TO SEND THE LINK'));
    tagsEl.append(st.chalkTag);
  }
  st.chalkTag.style.display = showChalk ? '' : 'none';
  if (showChalk) chalk.position.copy(slotFor(n - 1, n)).add(new THREE.Vector3(0, 0.004, 0));
}

// ---------- What the page offers right now ----------
// One thing at a time, in this order: a confirm (delete, leave, remove), the call-up you are drawing, a call-up sent to you,
// your own call-up in flight, and otherwise the invite.
const FORMAT = ['', 'SERVES', 'SINGLES', 'KING OF THE COURT', 'DOUBLES', 'DOUBLES +1', 'TWO COURTS', 'TWO COURTS', 'TWO COURTS'];
let action = null;
let altAction = null;
function setAlt(text, act) { const a = $('alt'); a.textContent = text || ''; a.style.display = text ? '' : 'none'; altAction = act || null; }
function panel() {
  const d = st.data || {};
  const h1 = $('h1'); const h2 = $('h2'); const blurb = $('blurb'); const msg = $('msg'); const manage = $('manage');
  const strip = $('enter');
  strip.style.removeProperty('--accent');
  msg.style.display = 'none';
  manage.style.display = 'none';
  setAlt('');
  const cu = d.callup;
  const byId = (id) => st.fighters.find((g) => g.f.id === id);
  for (const g of st.fighters) {
    const a = st.answers[g.f.id];
    const invited = cu && a !== undefined;
    g.mark.textContent = !invited ? '' : a === 'in' ? 'IN' : a === 'out' ? 'OUT' : 'ASKED';
    g.mark.className = `ans ${a || (invited ? 'wait' : '')}`;
  }
  if (d.mode !== 'crew') {
    st.sel.clear();
    if (d.mode === 'solo') {
      h1.textContent = 'JUST YOU'; h2.textContent = 'FOR NOW';
      blurb.textContent = 'Slide, give it a name, and send the link to your group chat. Whoever taps it is in, with their own fighter.';
      slide.setKey('01', 'START A CREW', 'NAME IT, THEN SEND THE LINK'); action = { type: 'start' };
    } else if (d.mode === 'error') {
      h1.textContent = 'CAN’T REACH'; h2.textContent = 'THE SEASON'; blurb.textContent = d.error || '';
      slide.setKey('01', 'TRY AGAIN', 'SLIDE TO RECONNECT'); action = { type: 'retry' };
    } else {
      h1.textContent = d.mode === 'starting' ? 'SIGNING IN' : 'ON THIS PHONE';
      h2.textContent = d.mode === 'starting' ? '...' : 'NO SERVER';
      blurb.textContent = d.mode === 'starting' ? '' : 'This build has no backend, so the season stays here.';
      slide.setKey('', '', ''); action = null;
    }
    return;
  }
  h1.textContent = d.name; h2.textContent = st.sel.size || st.anyone ? `CODE ${d.code}` : 'CIRCLE WHO PLAYS';
  manage.textContent = d.role === 'commissioner' ? 'DELETE CREW' : 'LEAVE';
  manage.style.display = '';
  if (st.confirm) {
    const c = st.confirm;
    strip.style.setProperty('--accent', '#b3261e');
    const what = c.kind === 'delete' ? `DELETE ${d.name}` : c.kind === 'leave' ? `LEAVE ${d.name}` : `REMOVE ${c.name}`;
    blurb.textContent = c.kind === 'delete' ? 'Gone for everyone: the roster, every match, every call-up.' : c.kind === 'leave' ? 'Your matches stay on their record.' : 'Their matches go with them.';
    slide.setKey('!!', what, 'SLIDE ALL THE WAY TO DO IT'); action = { type: 'confirm', kind: c.kind, id: c.id };
    setAlt('KEEP IT', { type: 'unconfirm' });
    return;
  }
  if (st.sel.size || st.anyone) {
    const n = st.anyone ? Math.max(st.sel.size, 1) : st.sel.size;
    const names = [...st.sel].map((id) => byId(id)?.f.name).filter(Boolean);
    blurb.textContent = `${n + 1} PLAYING: ${FORMAT[Math.min(n + 1, 8)]}`;
    msg.style.display = '';
    $('mtext').textContent = st.message || '';
    const who = st.anyone && !names.length ? 'THE CREW' : names.length > 2 ? `${names.length} FRIENDS` : names.join(' + ');
    slide.setKey('01', `SEND TO ${who}`, 'SLIDE TO CALL THEM UP'); action = { type: 'callup', ids: [...st.sel], anyone: st.anyone, need: n };
    setAlt('NEVER MIND', { type: 'clear' });
    return;
  }
  if (cu && !cu.mine && cu.status !== 'off' && st.answers.you !== 'in') {
    const ins = Object.values(st.answers).filter((a) => a === 'in').length;
    blurb.textContent = `${cu.callerName}: "${cu.message}"  ${ins} OF ${cu.need} IN`;
    slide.setKey('01', 'I’M IN', `${cu.callerName}’S CALL-UP`); action = { type: 'in', id: cu.id };
    setAlt(st.answers.you === 'out' ? 'YOU SAID YOU’RE OUT' : 'CAN’T MAKE IT', { type: 'out', id: cu.id });
    return;
  }
  if (cu && cu.mine && cu.status !== 'off') {
    const ins = Object.values(st.answers).filter((a) => a === 'in').length;
    blurb.textContent = cu.status === 'on' ? `IT’S ON. ${ins} IN: "${cu.message}"` : `YOUR CALL-UP: ${ins} OF ${cu.need} IN. "${cu.message}"`;
    slide.setKey('01', 'SEND IT AGAIN', 'SLIDE TO NUDGE THE GROUP CHAT'); action = { type: 'resend', id: cu.id };
    setAlt('CALL IT OFF', { type: 'calloff', id: cu.id });
    return;
  }
  if (cu && !cu.mine && st.answers.you === 'in') {
    const ins = Object.values(st.answers).filter((a) => a === 'in').length;
    blurb.textContent = cu.status === 'on' ? `IT’S ON. ${ins} IN: "${cu.message}"` : `YOU’RE IN. ${ins} OF ${cu.need}: "${cu.message}"`;
    slide.setKey('01', 'SEND THE INVITE', 'SLIDE TO TEXT THE GROUP CHAT'); action = { type: 'invite' };
    return;
  }
  // Nobody else yet: the one job is sending the link. Once friends are in, circling who plays comes first.
  if (!st.fighters.some((g) => !g.f.you)) {
    h2.textContent = 'JUST YOU SO FAR';
    blurb.textContent = 'Send the link to your group chat. Whoever taps it joins with their own fighter.';
    slide.setKey('01', 'SEND THE LINK', 'TO YOUR GROUP CHAT'); action = { type: 'invite' };
    return;
  }
  blurb.textContent = 'Draw a loop around who you want to play. 1 is singles, 2 king of the court, 3 doubles.';
  slide.setKey('01', 'CIRCLE WHO PLAYS', 'DRAW A LOOP AROUND THEM'); action = { type: 'teach' };
  setAlt('SEND THE LINK AGAIN', { type: 'invite' });
}

$('alt').addEventListener('click', () => {
  const a = altAction;
  if (!a) return;
  if (a.type === 'unconfirm') { st.confirm = null; panel(); post({ type: 'tick' }); return; }
  if (a.type === 'clear') { clearSel(); return; }
  if (a.type === 'invite') { post({ ...a, type: 'slid', action: 'invite' }); return; }
  post({ ...a, type: 'alt', act: a.type });
});
$('manage').addEventListener('click', () => {
  st.confirm = { kind: st.data && st.data.role === 'commissioner' ? 'delete' : 'leave' };
  clearSel(true);
  post({ type: 'warn' });
  panel();
});
$('msg').addEventListener('click', () => post({ type: 'editmsg', text: st.message || '' }));
// Tap the crew's name to rename it (the app asks on the TYPE / WRITE page).
$('h1').addEventListener('click', () => { if (st.mode === 'crew') post({ type: 'rename' }); });
document.body.classList.add('crewpage');

const slide = createSlide({
  post,
  onSlid: () => {
    const a = action;
    if (!a) return;
    if (a.type === 'teach') { teach.t = 0; post({ type: 'tick' }); return; } // shows the loop again
    if (a.type === 'confirm') st.confirm = null;
    post({ ...a, type: 'slid', action: a.type, message: st.message || '' });
    if (a.type === 'callup') { st.sel.clear(); st.anyone = false; }
    panel();
  },
});

/** Everyone hops, left to right: the crew was started, someone joined, a call-up went out. */
window.cheer = () => {
  st.fighters.forEach((g, i) => setTimeout(() => {
    g.body.kick(0, 4.2, 0);
    g.body.mood.happy = 1.2;
  }, i * 70));
  post({ type: 'cheer' });
};

/** A shake of the head from everyone, and what went wrong in the header for 5 s. */
window.nope = (message) => {
  st.fighters.forEach((g) => { g.body.spin(3.2); g.body.mood.sly = 0.8; });
  if (!message) return;
  const b = $('blurb');
  b.textContent = message;
  b.classList.add('bad');
  clearTimeout(window.nope.t);
  window.nope.t = setTimeout(() => { b.classList.remove('bad'); panel(); }, 5000);
};

// ---------- Touch ----------
// Tap a fighter: poke. Tap a pretender: poke, then text them their link. Hold a pretender: offer to remove them.
// Drag a loop: whoever is inside is called up (the chalk spot inside means anyone in the crew). Tap the chalk spot: write a name.
const v3 = new THREE.Vector3();
/** Where a world point is on screen, in page pixels. setViewOffset is already in the projection matrix: nothing to subtract. */
function screenOf(p) {
  v3.copy(p).project(camera);
  return { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight };
}
const middleOf = (g) => g.carrier.position.clone().add(new THREE.Vector3(0, g.body.height * SCALE * 0.5, 0));
function hitAt(x, y) {
  let best = null; let bd = Infinity;
  for (const g of st.fighters) {
    const s = screenOf(middleOf(g));
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = { g }; }
  }
  const reach = window.innerWidth * 0.2;
  if (chalk.visible) {
    const s = screenOf(chalk.position);
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd && d < reach) return { chalk: true };
  }
  return best && bd < reach ? best : null;
}

const lasso = $('lasso');
const lg = lasso.getContext('2d');
const loop = { pts: [], on: false, fade: 0, stroke: null };
const down = { x: 0, y: 0, on: false, held: false, timer: 0 };
function sizeLasso() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  lasso.width = window.innerWidth * dpr; lasso.height = window.innerHeight * dpr;
  lg.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', sizeLasso);
sizeLasso();

function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function clearSel(quiet) {
  st.sel.clear(); st.anyone = false;
  if (!quiet) post({ type: 'select', ids: [], anyone: false });
  panel();
}

$('c').addEventListener('pointerdown', (e) => {
  if (st.mode !== 'crew' && st.mode !== 'solo') return;
  Object.assign(down, { x: e.clientX, y: e.clientY, on: true, held: false });
  loop.pts = [[e.clientX, e.clientY]]; loop.on = false; loop.stroke = null;
  clearTimeout(down.timer);
  // Hold still on a pretender for 550 ms: offer to take them back out.
  down.timer = setTimeout(() => {
    if (!down.on || loop.on) return;
    const hit = hitAt(down.x, down.y);
    if (hit && hit.g && hit.g.f.pretender) {
      down.held = true;
      st.confirm = { kind: 'remove', id: hit.g.f.id, name: hit.g.f.name };
      clearSel(true);
      hit.g.body.kick(0, 2, 0); hit.g.body.mood.sly = 1;
      post({ type: 'warn' });
      panel();
    }
  }, 550);
});
$('c').addEventListener('pointermove', (e) => {
  if (!down.on || st.mode !== 'crew') return;
  if (!loop.on && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 16) { loop.on = true; clearTimeout(down.timer); post({ type: 'pen' }); }
  if (loop.on) {
    const l = loop.pts[loop.pts.length - 1];
    if (Math.hypot(e.clientX - l[0], e.clientY - l[1]) > 3) loop.pts.push([e.clientX, e.clientY]);
    loop.fade = 1;
  }
});
$('c').addEventListener('pointerup', (e) => {
  if (!down.on) return;
  down.on = false;
  clearTimeout(down.timer);
  if (down.held) return;
  if (loop.on) {
    loop.on = false;
    if (loop.pts.length < 8) return;
    const sel = st.fighters.filter((g) => !g.f.you && (() => { const s = screenOf(middleOf(g)); return inside(loop.pts, s.x, s.y); })());
    const anyone = chalk.visible && (() => { const s = screenOf(chalk.position); return inside(loop.pts, s.x, s.y); })();
    st.confirm = null;
    st.sel = new Set(sel.map((g) => g.f.id));
    st.anyone = anyone && !sel.length;
    // The circled ones hop toward each other: a huddle.
    sel.forEach((g, i) => setTimeout(() => { g.body.kick(0, 3, 0); g.body.mood.happy = 1; }, i * 60));
    post({ type: 'select', ids: [...st.sel], anyone: st.anyone, count: sel.length });
    panel();
    return;
  }
  const hit = hitAt(down.x, down.y);
  if (!hit) { if (st.sel.size || st.anyone) clearSel(); return; }
  if (hit.chalk) { chalkPop = 1; post({ type: 'slid', action: 'invite' }); return; } // the invite spot sends the link
  const { g } = hit;
  const dy = e.clientY - down.y;
  const flick = dy < -30 ? Math.min(2.2, -dy / 60) : 0; // swipe up on someone to throw them higher
  // Poke in the body's own coordinates: where the finger is, pushed away from the camera.
  const local = new THREE.Vector3(0, g.body.height * (0.55 + 0.2 * Math.random()), 0);
  g.body.poke(local, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2, -1).normalize(), 6, 0.5);
  g.body.kick(0, 3.2 + flick * 2.4, 0);
  g.body.spin(2.4 * (Math.random() < 0.5 ? -1 : 1));
  g.body.mood.happy = 0.8;
  st.lastPoked = g;
  post({ type: 'poke', id: g.f.id, pretender: !!g.f.pretender, cast: g.f.cast });
  if (g.f.pretender) setTimeout(() => post({ type: 'invite', id: g.f.id, name: g.f.name }), 260);
});
$('c').addEventListener('pointercancel', () => { down.on = false; loop.on = false; clearTimeout(down.timer); });
let chalkPop = 0;

/**
 * The ghost loop: until you have circled anyone, a faint brush loop draws itself round your friends every 4.5 s (draws in
 * 1.3 s with ease (0.16, 1, 0.3, 1), holds 0.6 s, fades 0.5 s), so the first thing the page teaches is the circle.
 */
const teach = { t: 0 };
window.__teach = teach; // test hook: stills pose the ghost loop at an exact moment
function ghostLoop(dt) {
  teach.t += dt;
  const others = st.fighters.filter((g) => !g.f.you);
  if (st.mode !== 'crew' || st.sel.size || st.anyone || st.confirm || down.on || others.length < 1) { teach.t = Math.min(teach.t, 0.8); return; }
  const c = teach.t % 4.5;
  if (c > 2.4) return;
  const pts = others.map((g) => screenOf(middleOf(g)));
  const px = window.innerWidth * 0.2; const py = window.innerHeight * 0.1; // round the bodies, not through them
  const x0 = Math.max(10, Math.min(...pts.map((q) => q.x)) - px); const x1 = Math.min(window.innerWidth - 10, Math.max(...pts.map((q) => q.x)) + px);
  const y0 = Math.min(...pts.map((q) => q.y)) - py; const y1 = Math.max(...pts.map((q) => q.y)) + py;
  const k = Math.min(1, c / 1.3); const e = 1 - (1 - k) ** 3;
  const a = c < 1.9 ? 0.6 : 0.6 * (1 - (c - 1.9) / 0.5);
  const ring = [];
  const n = Math.max(2, Math.round(64 * e));
  for (let i = 0; i <= n; i += 1) {
    const th = -2.2 + (i / 64) * Math.PI * 2.12;
    const wob = 1 + 0.04 * Math.sin(th * 3 + 1);
    ring.push([(x0 + x1) / 2 + Math.cos(th) * ((x1 - x0) / 2) * wob, (y0 + y1) / 2 + Math.sin(th) * ((y1 - y0) / 2) * wob]);
  }
  drawBrush(lg, [{ pts: ring }], a, 11);
}

/** The loop, drawn with the ink page's patterned brush while you draw it, fading over 0.5 s after. */
function drawLasso(dt) {
  if (!loop.on) loop.fade = Math.max(0, loop.fade - dt * 2);
  lg.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (loop.fade <= 0) ghostLoop(dt);
  if (loop.fade <= 0 || loop.pts.length < 2) return;
  if (!loop.stroke) loop.stroke = { pts: loop.pts };
  loop.stroke.pts = loop.pts;
  drawBrush(lg, [loop.stroke], loop.fade, 13);
}

// ---------- Camera ----------
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function shot() {
  const H = window.innerHeight;
  const top = $('head').getBoundingClientRect().bottom + 12;
  const bottom = H - $('panel').getBoundingClientRect().top + 64; // room for the front row's name plates
  const free = Math.max(0.3, (H - top - bottom) / H);
  const n = st.fighters.length + (chalk.visible ? 1 : 0);
  const rows = Math.max(1, Math.ceil(n / PER_ROW));
  const w = Math.min(n, PER_ROW) * GAP + 0.4;
  const h = 1.25 + (rows - 1) * RISE;
  const v = Math.tan(rad(camera.fov / 2));
  const d = Math.max(h / free / 2 / v, w / 2 / (v * camera.aspect));
  const look = new THREE.Vector3(0, 0.5 + ((rows - 1) * RISE) / 2, -((rows - 1) * ROW_BACK) / 2);
  return { look, d, offset: H / 2 - (top + (H - top - bottom) / 2) };
}
function spr(p, vel, target, dt, hz, ratio) {
  const w = TAU * hz;
  vel.addScaledVector(p.clone().sub(target), -w * w * dt).addScaledVector(vel, -2 * ratio * w * dt);
  p.addScaledVector(vel, dt);
}
{
  const s = shot();
  st.cam.pos.copy(s.look).add(new THREE.Vector3(0, s.d * 0.3, s.d));
  st.cam.look.copy(s.look);
}
function frameCam(dt) {
  const s = shot();
  const yaw = rad(2.5) * Math.sin((st.clock * TAU) / 9);
  const pitch = rad(13);
  const want = s.look.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(s.d));
  spr(st.cam.pos, st.cam.vp, want, dt, 1.4, 1);
  spr(st.cam.look, st.cam.vl, s.look, dt, 1.4, 1);
  st.offset = s.offset;
}

// ---------- Loop ----------
function step(dt) {
  st.clock += dt;
  slide.step(dt);
  for (const g of st.fighters) g.body.simulate(dt, st.clock + g.ph);
  // Someone in the line-up hops now and then, so the hold is never frozen.
  if (!REDUCED && st.clock > st.nextHop && st.fighters.length) {
    st.nextHop = st.clock + 2.6 + Math.random() * 1.6;
    const pool = st.fighters.filter((g) => g !== st.lastPoked && !g.f.pretender);
    const g = pool[Math.floor(Math.random() * pool.length)];
    if (g) { g.body.kick(0, 2.2, 0); g.body.spin((Math.random() - 0.5) * 1.2); }
    st.lastPoked = null;
  }
  chalkPop = Math.max(0, chalkPop - dt * 4);
}
let lastLasso = performance.now();

function pose() {
  for (const g of st.fighters) {
    g.body.render(st.clock + g.ph);
    g.carrier.rotation.z = g.f.pretender && !REDUCED ? rad(4) * Math.sin((st.clock * TAU) / 3.4 + g.ph) : 0;
    // The shadow shrinks as the body leaves the floor.
    const lift = Math.max(0, g.body.com().y * SCALE - g.body.height * SCALE * 0.5);
    const k = 1 / (1 + lift * 1.6);
    g.shadow.scale.setScalar(k);
    g.shadow.material.opacity = k;
  }
  for (const g of st.fighters) {
    const picked = st.sel.has(g.f.id);
    const a = st.answers[g.f.id];
    g.ring.visible = picked || a === 'in' || a === null;
    // Circled: solid and breathing. In: solid. Asked, no answer yet: faint and pulsing.
    g.ring.material.opacity = picked || a === 'in' ? 0.95 : 0.25 + 0.2 * Math.sin(st.clock * 4);
    g.ring.scale.setScalar(picked ? 1 + 0.05 * Math.sin((st.clock * TAU) / 1.2) : 1);
  }
  chalk.material.rotation = 0;
  chalk.rotation.z = st.clock * 0.5;
  chalk.scale.setScalar(1 + (REDUCED ? 0 : 0.04 * Math.sin((st.clock * TAU) / 1.8)) + chalkPop * 0.25);
  slide.render(st.clock);
  camera.position.copy(st.cam.pos);
  camera.lookAt(st.cam.look);
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, st.offset || 0, window.innerWidth, window.innerHeight);
  camera.updateMatrixWorld();
  // Name plates under the feet, in screen space.
  const place = (tag, p) => {
    const s = screenOf(p);
    tag.style.transform = `translate3d(${s.x}px,${s.y + 16}px,0) translateX(-50%)`;
  };
  for (const g of st.fighters) place(g.tag, g.carrier.position);
  if (st.chalkTag && chalk.visible) place(st.chalkTag, chalk.position.clone().setZ(chalk.position.z + 0.3));
}

let last = performance.now();
/** Stills: `window.paused = true` stops the clock; `window.advance(sec)` runs exactly that much physics and draws it. */
window.paused = false;
window.advance = (sec) => {
  for (let t = 0; t < sec; t += 1 / 120) { frameCam(1 / 120); step(1 / 120); }
  pose();
  renderer.render(scene, camera);
  drawLasso(0);
};
function frame(now) {
  requestAnimationFrame(frame);
  let remaining = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (window.paused) { pose(); renderer.render(scene, camera); drawLasso(0); return; }
  frameCam(Math.min(remaining, 0.05) || 1 / 60);
  while (remaining > 1e-6) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    step(dt);
  }
  pose();
  renderer.render(scene, camera);
  drawLasso(Math.min(0.05, (now - lastLasso) / 1000));
  lastLasso = now;
}
requestAnimationFrame(frame);

// Test hooks for stills: a full crew with a pretender, or you alone.
window.demoCrew = () => window.setCrew({
  mode: 'crew', name: 'LOBS OF LOVE', code: 'K7QX2M',
  fighters: [
    { id: 'you', name: 'TONY', cast: 'wall', color: '#d7f205', you: true },
    { id: 'd', name: 'DANIEL', cast: 'comet', color: '#ff8a1f' },
    { id: 'g', name: 'GARY', cast: 'bot', color: '#35d6ff' },
    { id: 'a', name: 'ARIA', cast: 'moon', color: '#9b6bff', pretender: true },
  ],
});
/** Stills: the crew with Gary and Aria circled, the loop still on screen, and the app's message. */
window.demoCircle = () => {
  window.demoCrew();
  st.sel = new Set(['g', 'a']);
  window.setMessage('King of the court at UCSD after 5? Need 2 more.');
  window.demoLoop = () => {
    const pts = [];
    const c = st.fighters.filter((g) => st.sel.has(g.f.id)).map((g) => screenOf(middleOf(g)));
    const cx = c.reduce((a, p) => a + p.x, 0) / c.length; const cy = c.reduce((a, p) => a + p.y, 0) / c.length;
    for (let k = 0; k <= 40; k += 1) { const a = (k / 40) * TAU * 1.08 - 0.4; pts.push([cx + Math.cos(a) * 210, cy + Math.sin(a) * 120 + 10]); }
    loop.pts = pts; loop.on = true; loop.fade = 1; loop.stroke = null;
  };
};
/** Stills: Daniel called you up; Gary is in, Aria has not answered. */
window.demoAsked = () => {
  window.demoCrew();
  window.setCrew({ ...st.data, callup: { id: 'c1', mine: false, callerName: 'DANIEL', message: 'Doubles at Balboa after 5? Need 3 more.', need: 3, status: 'open', answers: { you: null, g: 'in', a: null } } });
};
window.demoSolo = () => window.setCrew({ mode: 'solo', suggest: "TONY'S CREW", fighters: [{ id: 'you', name: 'TONY', cast: 'wall', color: '#d7f205', you: true }] });
window.crewState = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, px: (() => { const gl = renderer.getContext(); const b = new Uint8Array(4); gl.readPixels(gl.drawingBufferWidth >> 1, Math.round(gl.drawingBufferHeight * 0.4), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return [...b]; })(), vis: st.fighters.map((g) => g.body.mesh.visible && g.body.mesh.geometry.attributes.position ? g.body.mesh.geometry.attributes.position.count : -1), shot: (() => { const s = shot(); return [s.look.toArray(), +s.d.toFixed(2), +s.offset.toFixed(1)]; })(), clock: +st.clock.toFixed(2), cam: st.cam.pos.toArray().map((x) => +x.toFixed(2)), n: st.fighters.length, com: st.fighters.map((g) => g.body.com().toArray().map((x) => +x.toFixed(2))), h: st.fighters.map((g) => +g.body.height.toFixed(2)) });
post({ type: 'ready' });
