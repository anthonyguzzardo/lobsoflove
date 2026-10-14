// Gear closet: a steel locker with a pegboard back. Rackets hang on hooks, ball cans stand on the top shelf, overgrips sit in a bin,
// shoes on the floor. Everything shows its wear: strings yellow and finally snap, overgrips go grey and come loose, balls go dull,
// soles thin out and the toe drag wears a hole.
//
// Motion spec. Everything integrates at 1/120 s.
// - Doors: open 300 ms after load to 118 degrees on a spring at 1.4 Hz, damping ratio 0.55, so they knock the stop once and settle.
// - Rackets: real pendulums. theta'' = -(g/L) sin(theta) - 2 zeta w theta', g/L = 21 (period 1.37 s), zeta 0.06, so a fling swings for a while.
//   Grab and drag turns the racket about its hook on a 12 Hz, ratio 1 spring to your finger. Neighbors collide (restitution 0.55,
//   equal masses, so a hard fling knocks the next racket like a Newton's cradle) and bounce off the side walls at 0.4.
// - Photo tags hang off each racket's throat and lag it: they seek world-vertical on a 2.2 Hz spring, ratio 0.15.
// - Camera: overview frames the whole locker above the panel; a tap pushes in on the thing (1.5 Hz, ratio 1). Never parked: 0.6 degree yaw on a 9 s sine.
// - Cans drop onto the shelf under gravity 18 u/s^2 with restitution 0.3. Cracking a can: 420 ms arc to the open spot, the lid pops 0.5 up spinning.
// - Restring: the bed redraws fresh top to bottom over 600 ms with a ping. Regrip: a roll arcs from the bin to the handle in 450 ms, then the
//   new wrap runs down the handle over 500 ms.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));

const INK = 0x16181d;
const PAPER = 0xefece5;
const CLAY = 0xe2562f;
const BALL_Y = 0xd7f205;
const rad = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const $ = (id) => document.getElementById(id);

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(PAPER, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.45));
const sun = new THREE.DirectionalLight(0xfff4e4, 1.9);
sun.position.set(-3, 8, 7);
scene.add(sun);
// The locker's own light: a warm strip under the top, lighting the pegboard from above.
const strip = new THREE.PointLight(0xffe2b0, 5, 6, 1.6);
strip.position.set(0, 4.15, 0.25);
scene.add(strip);

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
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const mixHex = (a, b, k) => { const c = new THREE.Color(a).lerp(new THREE.Color(b), clamp(k, 0, 1)); return `#${c.getHexString()}`; };
const FONT = (px, w = 800) => `${w} ${px}px ui-monospace, "SF Mono", Menlo, monospace`;

// ---------- The locker ----------
const W = 3.0; // inner width
const H = 4.4; // inner height
const D = 0.92;
const BASE = 0.18;
const SHELF_Y = 3.42;
const HOOK_Y = 3.22;
const HOOKS = [-0.95, 0, 0.95];
const SHOE_X = [-0.72, 0.72];
const steel = mat(0x262a31, { roughness: 0.55, metalness: 0.35 });
const cream = mat(0xf3eee4);
const locker = new THREE.Group();
scene.add(locker);
locker.add(at(rbox(W + 0.24, BASE, D + 0.06, 0.03, steel), 0, BASE / 2, 0));
locker.add(at(rbox(W + 0.24, 0.16, D + 0.06, 0.03, steel), 0, BASE + H + 0.08, 0));
for (const s of [-1, 1]) locker.add(at(rbox(0.12, H + 0.02, D + 0.06, 0.02, steel), s * (W / 2 + 0.06), BASE + H / 2, 0));
// Inside walls in cream so the gear reads against them.
for (const s of [-1, 1]) {
  const side = new THREE.Mesh(new THREE.PlaneGeometry(D, H), mat(0xe7e0d3));
  side.position.set(s * (W / 2 - 0.001), BASE + H / 2, 0);
  side.rotation.y = -s * Math.PI / 2;
  locker.add(side);
}
const peg = tex(512, 512, (g, w, h) => {
  g.fillStyle = '#f1ebdf'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
    const cx = 32 + x * 64; const cy = 32 + y * 64;
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(cx + 1, cy + 1.6, 7.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a342b'; g.beginPath(); g.arc(cx, cy, 6.5, 0, Math.PI * 2); g.fill();
  }
});
peg.wrapS = peg.wrapT = THREE.RepeatWrapping;
peg.repeat.set(W / 0.55, H / 0.55);
const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: peg, roughness: 0.9 }));
back.position.set(0, BASE + H / 2, -D / 2);
locker.add(back);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xddd5c6));
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, BASE + 0.001, 0);
locker.add(floor);
// Top shelf with a printed lip: what lives up here.
locker.add(at(rbox(W - 0.02, 0.05, D - 0.08, 0.01, cream), 0, SHELF_Y - 0.025, -0.03));
const lipTex = tex(1024, 64, (g, w, h) => {
  g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#efece5'; g.font = FONT(30); g.textBaseline = 'middle';
  g.fillText('BALLS', 24, h / 2 + 2);
  g.textAlign = 'right'; g.fillText('OVERGRIPS', w - 24, h / 2 + 2);
});
const lip = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, 0.15), new THREE.MeshBasicMaterial({ map: lipTex }));
lip.position.set(0, SHELF_Y - 0.06, D / 2 - 0.069);
locker.add(lip);
locker.add(at(new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, 0.035, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff1d0 })), 0, BASE + H - 0.03, 0.3));

// Doors: louvered steel, a number plate on the right one.
const doors = [];
const doorTex = (label) => tex(256, 512, (g, w, h) => {
  g.fillStyle = '#2b2f37'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 6; k += 1) {
    const y = 34 + k * 20;
    g.fillStyle = '#0d0f12'; g.fillRect(52, y, w - 104, 9);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(52, y + 9, w - 104, 2);
  }
  for (let k = 0; k < 6; k += 1) {
    const y = h - 156 + k * 20;
    g.fillStyle = '#0d0f12'; g.fillRect(52, y, w - 104, 9);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(52, y + 9, w - 104, 2);
  }
  if (label) {
    g.fillStyle = '#e2562f'; g.fillRect(64, 196, w - 128, 56);
    g.fillStyle = '#16181d'; g.font = FONT(34); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, 226);
  }
});
for (const s of [-1, 1]) {
  const hinge = new THREE.Group();
  hinge.position.set(s * (W / 2 + 0.12), BASE + H / 2, D / 2 + 0.03);
  const dw = W / 2 + 0.12;
  const panel = rbox(dw - 0.01, H + 0.02, 0.05, 0.015, new THREE.MeshStandardMaterial({ map: doorTex(s > 0 ? 'GEAR' : ''), roughness: 0.55, metalness: 0.3 }));
  panel.position.set(-s * dw / 2, 0, 0.025);
  hinge.add(panel);
  const handle = at(rbox(0.05, 0.36, 0.06, 0.02, mat(0xc9ccd2, { roughness: 0.3, metalness: 0.8 })), -s * (dw - 0.14), 0, 0.08);
  hinge.add(handle);
  locker.add(hinge);
  doors.push({ g: hinge, s, a: { x: 0, v: 0 }, knocked: false });
}

// Painted contact shadow on the paper under the locker.
const blobTex = tex(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, 'rgba(40,34,26,0.5)'); r.addColorStop(0.5, 'rgba(40,34,26,0.18)'); r.addColorStop(1, 'rgba(40,34,26,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
const blob = (sx, sz, opacity) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(sx, sz, 1);
  return m;
};
scene.add(at(blob(5.2, 2.4, 0.6), 0, 0.002, 0.15));

// Hooks: clay pegs out of the board.
const hookMat = mat(CLAY, { roughness: 0.45 });
for (const x of HOOKS) {
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 10), hookMat);
  rod.rotation.x = Math.PI / 2;
  rod.position.set(x, HOOK_Y, -D / 2 + 0.25);
  locker.add(rod);
  locker.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), hookMat), x, HOOK_Y + 0.012, -D / 2 + 0.5));
}

// ---------- Textures that show wear ----------
const STRING_FRESH = '#f6f5ee';
const STRING_DEAD = '#b39a68';
function bedTexture(worn, sweep = 1) {
  return tex(256, 320, (g, w, h) => {
    const col = mixHex(STRING_FRESH, STRING_DEAD, worn);
    g.clearRect(0, 0, w, h);
    const draw = (color, y0, y1) => {
      g.save(); g.beginPath(); g.rect(0, y0, w, y1 - y0); g.clip();
      g.strokeStyle = color; g.lineWidth = 3.4;
      for (let k = 0; k < 16; k += 1) { const x = 10 + k * ((w - 20) / 15); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.lineWidth = 3;
      for (let k = 0; k < 19; k += 1) { const y = 10 + k * ((h - 20) / 18); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.restore();
    };
    draw(col, 0, h);
    if (sweep < 1) draw(STRING_FRESH, 0, h * sweep);
    // Dead strings: one main has snapped and curled back.
    if (worn >= 1 && sweep >= 1) {
      const x = 10 + 8 * ((w - 20) / 15);
      g.clearRect(x - 3, h * 0.38, 6, h * 0.16);
      g.strokeStyle = col; g.lineWidth = 3.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, h * 0.38); g.quadraticCurveTo(x + 16, h * 0.42, x + 10, h * 0.47); g.stroke();
      g.beginPath(); g.moveTo(x, h * 0.54); g.quadraticCurveTo(x - 15, h * 0.5, x - 9, h * 0.46); g.stroke();
    }
  });
}
const GRIP_FRESH = '#f7f5ef';
const GRIP_DEAD = '#7d7564';
function gripTexture(worn) {
  return tex(128, 256, (g, w, h) => {
    g.fillStyle = mixHex(GRIP_FRESH, GRIP_DEAD, worn); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(22,24,29,.32)'; g.lineWidth = 3;
    for (let k = -4; k < 14; k += 1) { g.beginPath(); g.moveTo(0, k * 24); g.lineTo(w, k * 24 + 34); g.stroke(); }
    // Sweat stains where the hand sits.
    if (worn > 0.3) {
      g.fillStyle = `rgba(70,58,40,${0.35 * Math.min(1, worn)})`;
      g.beginPath(); g.ellipse(w * 0.5, h * 0.62, w * 0.6, h * 0.2, 0, 0, Math.PI * 2); g.fill();
    }
  });
}
function polaroid(photo, title) {
  const t = tex(256, 300, (g, w, h) => {
    g.fillStyle = '#fffdf8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e3ddd0'; g.fillRect(18, 18, w - 36, w - 36);
    g.fillStyle = '#16181d'; g.font = FONT(24); g.textAlign = 'center'; g.textBaseline = 'middle';
    if (!photo) {
      // A drawn camera: the empty tag asks for a photo.
      g.strokeStyle = '#16181d'; g.lineWidth = 6; g.lineJoin = 'round';
      g.strokeRect(80, 100, 96, 66); g.strokeRect(108, 88, 40, 12);
      g.beginPath(); g.arc(128, 133, 20, 0, Math.PI * 2); g.stroke();
      g.font = FONT(20); g.fillText('ADD PHOTO', w / 2, 196);
    }
    g.font = FONT(22); g.fillText(title.slice(0, 14), w / 2, h - 32);
  });
  if (photo) {
    const img = new Image();
    img.onload = () => {
      const g = t.image.getContext('2d');
      const s = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 18, 18, 220, 220);
      t.needsUpdate = true;
    };
    img.src = photo;
  }
  return t;
}
const signTex = (text, bg = '#e2562f', fg = '#16181d') => tex(256, 96, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = FONT(text.length > 8 ? 30 : 40); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
});
const dueSign = (text) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.17), new THREE.MeshBasicMaterial({ map: signTex(text), transparent: true }));
  m.userData.text = text;
  return m;
};

// ---------- Rackets ----------
const FRAMES = [0x16181d, 0x2f6fd6, 0xe9e5dc, 0x3f8f5a, 0x9b6bff, 0xe2562f];
const hashColor = (s) => FRAMES[[...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % FRAMES.length];
// Collision probes down the racket: distance below the hook and half width at that height.
const PROBES = [[0.35, 0.36], [0.62, 0.27], [0.95, 0.12], [1.5, 0.05]];
const G_OVER_L = 21;
const ZETA = 0.06;
const W0 = Math.sqrt(G_OVER_L);

function buildRacket(item) {
  const g = new THREE.Group();
  const frame = mat(hashColor(item.name + item.id), { roughness: 0.32, metalness: 0.15 });
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.03, 10, 64), frame);
  head.scale.set(1, 1.3, 1.5);
  head.position.y = -0.35;
  g.add(head);
  const bedMat = new THREE.MeshStandardMaterial({ map: bedTexture(0), transparent: true, roughness: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 48), bedMat);
  bed.scale.set(0.315, 0.415, 1);
  bed.position.y = -0.35;
  g.add(bed);
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(s * 0.2, -0.72, 0);
    const b = new THREE.Vector3(s * 0.045, -1.12, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, a.distanceTo(b), 10), frame);
    arm.position.copy(a).add(b).multiplyScalar(0.5);
    arm.rotation.z = Math.atan2(b.x - a.x, a.y - b.y);
    g.add(arm);
  }
  const shaft = at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), frame), 0, -1.12, 0);
  g.add(shaft);
  const gripMat = new THREE.MeshStandardMaterial({ map: gripTexture(0), roughness: 0.95 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.052, 0.66, 8), gripMat);
  handle.position.y = -1.5;
  g.add(handle);
  // The new wrap that runs down the handle on a regrip.
  const fresh = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.056, 0.66, 8), new THREE.MeshStandardMaterial({ map: gripTexture(0), roughness: 0.95 }));
  fresh.geometry.translate(0, -0.33, 0);
  fresh.position.y = -1.17;
  fresh.visible = false;
  g.add(fresh);
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.035, 8), frame), 0, -1.845, 0));
  // An old overgrip comes loose at the top: a flap that sways.
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.16), new THREE.MeshStandardMaterial({ map: gripTexture(1), side: THREE.DoubleSide }));
  flap.geometry.translate(0, -0.08, 0);
  flap.position.set(0.05, -1.2, 0.03);
  flap.visible = false;
  g.add(flap);
  // Photo tag on a short string off the throat.
  const tagPivot = new THREE.Group();
  tagPivot.position.set(0.1, -0.86, 0.06);
  const tagMat = new THREE.MeshBasicMaterial({ map: polaroid(null, item.name) });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.35), tagMat);
  tag.position.set(0.02, -0.28, 0);
  tagPivot.add(tag);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.11, 4), mat(INK));
  thread.position.set(0.01, -0.055, 0);
  tagPivot.add(thread);
  g.add(tagPivot);
  const sign = dueSign('RESTRING');
  sign.position.set(0, -2.0, 0.06);
  sign.visible = false;
  g.add(sign);
  // A flat dark copy on the pegboard: the racket's shadow, so it reads as hanging off the wall.
  const shadow = new THREE.Group();
  const sm = new THREE.MeshBasicMaterial({ color: 0x2a2219, transparent: true, opacity: 0.13, depthWrite: false });
  const sh = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.37, 48), sm);
  sh.scale.set(1, 1.3, 1);
  sh.position.y = -0.35;
  shadow.add(sh);
  shadow.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.11, 1.15), sm), 0, -1.35, 0));
  locker.add(shadow);
  g.traverse((o) => { o.userData.pick = item.id; });
  tag.userData.photo = item.id;
  return { g, head, bed, bedMat, handle, gripMat, fresh, flap, tag, tagMat, tagPivot, sign, shadow, th: 0, w: 0, tagA: 0, tagV: 0, held: null, target: 0, sweep: 1, wrap: 1, worn: { strings: 0, overgrip: 0 } };
}

// ---------- Shoes ----------
function buildShoe(color, side) {
  const g = new THREE.Group();
  const upper = mat(color, { roughness: 0.7 });
  const soleMat = mat(0xf7f6f2, { roughness: 0.9 });
  const sole = rbox(0.25, 0.07, 0.62, 0.03, soleMat);
  sole.position.y = 0.035;
  g.add(sole);
  const body = rbox(0.22, 0.17, 0.47, 0.07, upper);
  body.position.set(0, 0.15, -0.04);
  g.add(body);
  const toe = rbox(0.215, 0.1, 0.2, 0.05, upper);
  toe.position.set(0, 0.11, 0.2);
  g.add(toe);
  g.add(at(rbox(0.232, 0.2, 0.13, 0.05, mat(new THREE.Color(color).multiplyScalar(0.7))), 0, 0.16, -0.24));
  g.add(at(rbox(0.12, 0.05, 0.16, 0.02, mat(INK)), 0, 0.235, -0.13));
  const lace = mat(0xfffdf8, { roughness: 0.6 });
  for (let k = 0; k < 4; k += 1) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.014, 0.022), lace), 0, 0.236 - k * 0.012, -0.02 + k * 0.05));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.05, 0.28), mat(0xfffdf8)), side * 0.112, 0.12, 0.0));
  // Toe drag hole, shown once they are worn through.
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshBasicMaterial({ color: 0x2b241b }));
  hole.position.set(-side * 0.04, 0.12, 0.302);
  hole.visible = false;
  g.add(hole);
  g.rotation.y = side * rad(-9);
  return { g, sole, soleMat, upper, base: new THREE.Color(color), hole };
}
const SHOE_COLORS = [0x2f6fd6, 0x16181d, 0x3f8f5a, 0x9b6bff];

function buildPair(item) {
  const g = new THREE.Group();
  const color = SHOE_COLORS[[...item.id].reduce((n, c) => (n + c.charCodeAt(0)) >>> 0, 0) % SHOE_COLORS.length];
  const L = buildShoe(color, -1);
  const R = buildShoe(color, 1);
  L.g.position.x = -0.16;
  R.g.position.x = 0.16;
  R.g.position.z = 0.05;
  g.add(L.g, R.g);
  g.add(at(blob(0.85, 0.85, 0.55), 0, 0.004, 0.02));
  // Photo leans on the back wall behind the pair.
  const tagMat = new THREE.MeshBasicMaterial({ map: polaroid(null, item.name) });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.4), tagMat);
  tag.position.set(0, 0.27, -0.38);
  tag.rotation.x = rad(-12);
  g.add(tag);
  const sign = dueSign('NEW PAIR');
  sign.position.set(0, 0.52, 0.05);
  sign.visible = false;
  g.add(sign);
  g.traverse((o) => { o.userData.pick = item.id; });
  tag.userData.photo = item.id;
  return { g, shoes: [L, R], tag, tagMat, sign, hop: { x: 0, v: 0 }, worn: 0, fly: null };
}

// ---------- Cans and grips ----------
const canGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.26, roughness: 0.08, clearcoat: 1, depthWrite: false });
const lidMat = mat(CLAY, { roughness: 0.5 });
function buildCan(open) {
  const g = new THREE.Group();
  const fuzz = mat(BALL_Y, { roughness: 1 });
  const balls = [0, 1, 2].map((k) => { const b = at(new THREE.Mesh(new THREE.SphereGeometry(0.088, 18, 12), fuzz), 0, 0.1 + k * 0.19, 0); g.add(b); return b; });
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.62, 24, 1, true), canGlass), 0, 0.31, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.03, 24), mat(0xf4f1ea)), 0, 0.015, 0));
  const lid = new THREE.Group();
  lid.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.035, 24), lidMat), 0, 0, 0));
  lid.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 16), mat(0xd0d3d8, { metalness: 0.8, roughness: 0.3 })), 0, 0.022, 0).rotateX(Math.PI / 2));
  lid.position.y = 0.635;
  g.add(lid);
  if (open) lid.visible = false;
  g.traverse((o) => { o.userData.pick = 'balls'; });
  return { g, lid, fuzz, balls, y: { x: 0, v: 0 } };
}
const CAN_Z = -0.2;
const canX = (k) => -1.3 + k * 0.27;
const SHOW_CANS = 5;
const OPEN = new THREE.Vector3(0.22, SHELF_Y, 0.12);
const shelf = { cans: [], open: null, openLid: null, wantCans: 0 };
const moreTag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), new THREE.MeshBasicMaterial({ map: signTex('+0', '#16181d', '#efece5'), transparent: true }));
moreTag.position.set(canX(2), SHELF_Y + 0.08, 0.31);
moreTag.visible = false;
locker.add(moreTag);
const lowSign = dueSign('ORDER BALLS');
lowSign.position.set(-0.75, SHELF_Y + 0.82, 0.25);
lowSign.visible = false;
locker.add(lowSign);

const bin = new THREE.Group();
{
  const bm = mat(0x2f6fd6, { roughness: 0.6 });
  const [bw, bh, bd] = [0.62, 0.24, 0.5];
  bin.add(at(new THREE.Mesh(new THREE.BoxGeometry(bw, 0.02, bd), bm), 0, 0.01, 0));
  bin.add(at(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.02), bm), 0, bh / 2, -bd / 2));
  bin.add(at(new THREE.Mesh(new THREE.BoxGeometry(bw, bh * 0.3, 0.02), bm), 0, bh * 0.15, bd / 2));
  for (const s of [-1, 1]) bin.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.02, bh, bd), bm), s * bw / 2, bh / 2, 0));
  bin.position.set(1.05, SHELF_Y, -0.05);
  bin.traverse((o) => { o.userData.pick = 'grips'; });
  locker.add(bin);
}
const rollTex = tex(128, 64, (g, w, h) => { g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(22,24,29,.25)'; g.lineWidth = 3; for (let k = 0; k < 8; k += 1) { g.beginPath(); g.moveTo(k * 18, 0); g.lineTo(k * 18 + 10, h); g.stroke(); } });
const rollMat = new THREE.MeshStandardMaterial({ map: rollTex, roughness: 0.9 });
const rollEnd = mat(0xe8e3d8);
function buildRoll() {
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.17, 18), [rollMat, rollEnd, rollEnd]);
  r.rotation.x = Math.PI / 2;
  r.userData.pick = 'grips';
  return r;
}
const rollSpot = (k) => new THREE.Vector3(-0.2 + (k % 4) * 0.135, 0.075 + Math.floor(k / 4) * 0.11, 0.08);
const grips = { rolls: [], want: 0 };
const binLow = dueSign('ORDER GRIPS');
binLow.position.set(1.05, SHELF_Y + 0.82, 0.25);
binLow.visible = false;
locker.add(binLow);

// Ghosts: dashed outlines where something could go. Tapping one adds it.
const ghostMat = new THREE.LineDashedMaterial({ color: INK, dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.45 });
function ghost(points, label, w, h, pick) {
  const g = new THREE.Group();
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ghostMat);
  line.computeLineDistances();
  g.add(line);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.22), new THREE.MeshBasicMaterial({ map: tex(512, 112, (c, cw, ch) => {
    c.fillStyle = '#16181d'; c.font = FONT(46); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, cw / 2, ch / 2);
  }), transparent: true, depthWrite: false }));
  lab.position.y = h;
  g.add(lab);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(w, Math.abs(h) * 2 + 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = h;
  g.add(hit);
  g.traverse((o) => { o.userData.ghost = pick; });
  return g;
}
const racketGhostPts = (() => {
  const p = [];
  for (let k = 0; k <= 64; k += 1) { const a = (k / 64) * Math.PI * 2; p.push(new THREE.Vector3(Math.sin(a) * 0.33, -0.35 + Math.cos(a) * 0.43, 0)); }
  p.push(new THREE.Vector3(0.05, -0.78, 0), new THREE.Vector3(0.05, -1.84, 0), new THREE.Vector3(-0.05, -1.84, 0), new THREE.Vector3(-0.05, -0.78, 0));
  return p;
})();
const hookGhosts = HOOKS.map((x) => {
  const g = ghost(racketGhostPts, 'ADD RACKET', 0.78, -0.95, 'racket');
  g.position.set(x, HOOK_Y, 0);
  locker.add(g);
  return g;
});
const shoeGhostPts = [[-0.3, 0.3], [0.3, 0.3], [0.3, -0.3], [-0.3, -0.3], [-0.3, 0.3]].map(([x, z]) => new THREE.Vector3(x, 0.01, z));
const shoeGhosts = SHOE_X.map((x) => {
  const g = ghost(shoeGhostPts, 'ADD SHOES', 0.78, 0.25, 'shoes');
  g.position.set(x, BASE, 0.05);
  g.children[1].rotation.x = rad(-20);
  locker.add(g);
  return g;
});
const canGhostPts = (() => { const p = []; for (let k = 0; k <= 40; k += 1) { const a = (k / 40) * Math.PI * 2; p.push(new THREE.Vector3(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1)); } p.push(new THREE.Vector3(0.1, 0, 0), new THREE.Vector3(0.1, 0.62, 0), new THREE.Vector3(-0.1, 0.62, 0), new THREE.Vector3(-0.1, 0, 0)); return p; })();
const canGhost = ghost(canGhostPts, 'ADD A CAN', 0.42, 0.75, 'can');
locker.add(canGhost);
canGhost.visible = false;
const rollGhost = ghost([new THREE.Vector3(-0.09, 0, 0), new THREE.Vector3(0.09, 0, 0), new THREE.Vector3(0.09, 0.11, 0), new THREE.Vector3(-0.09, 0.11, 0), new THREE.Vector3(-0.09, 0, 0)], 'ADD GRIPS', 0.46, 0.27, 'roll');
rollGhost.position.set(1.05, SHELF_Y + 0.3, 0.1);
locker.add(rollGhost);
rollGhost.visible = false;

// ---------- State from the app ----------
const st = {
  items: [], racks: new Map(), pairs: new Map(), focus: null, row: null, clock: 0, open: false, payload: null,
  cam: { pos: new THREE.Vector3(0, 2.6, 13), look: new THREE.Vector3(0, 2.3, 0), vp: new THREE.Vector3(), vl: new THREE.Vector3() },
  pending: new Set(), stamps: new Map(),
};

function setWear(r, s, worn) {
  r.worn[s] = worn;
  if (s === 'strings') {
    r.bedMat.map.dispose();
    r.bedMat.map = bedTexture(Math.min(1, worn));
    if (worn >= 1) { r.bedMat.map.dispose(); r.bedMat.map = bedTexture(1); }
    r.bedMat.needsUpdate = true;
  } else {
    r.gripMat.map.dispose();
    r.gripMat.map = gripTexture(Math.min(1, worn));
    r.gripMat.needsUpdate = true;
    r.flap.visible = worn >= 1;
  }
}
function setShoeWear(p, worn) {
  p.worn = worn;
  for (const s of p.shoes) {
    s.sole.scale.y = lerp(1, 0.5, Math.min(1, worn));
    s.sole.position.y = 0.035 * s.sole.scale.y;
    s.soleMat.color.set(mixHex('#f7f6f2', '#a39a88', worn));
    s.upper.color.copy(s.base).lerp(new THREE.Color(0x9c8f78), 0.35 * Math.min(1, worn));
    s.hole.visible = worn >= 1;
  }
}
function setBallWear(worn) {
  if (!shelf.open) return;
  shelf.open.fuzz.color.set(mixHex('#d7f205', '#a9a77e', worn));
  for (const b of shelf.open.balls) b.scale.set(1, worn >= 1 ? 0.9 : 1, 1);
}

const rowsOf = (it) => it.rows || [];
const wornOf = (it, s) => (rowsOf(it).find((r) => r.s === s) || { worn: 0 }).worn;

window.setCloset = (data) => {
  st.payload = data;
  const ids = new Set(data.items.map((i) => i.id));
  // Rackets.
  const rackets = data.items.filter((i) => i.kind === 'racket').slice(0, 3);
  for (const [id, r] of st.racks) if (!rackets.find((i) => i.id === id)) { r.g.removeFromParent(); r.shadow.removeFromParent(); st.racks.delete(id); }
  rackets.forEach((it, k) => {
    let r = st.racks.get(it.id);
    if (!r) {
      r = buildRacket(it);
      r.slot = k;
      st.racks.set(it.id, r);
      locker.add(r.g);
      r.w = 2.4 * (k % 2 ? -1 : 1); // arrives with a little swing
    }
    r.slot = k;
    r.g.position.set(HOOKS[k], HOOK_Y, 0.02);
    r.shadow.position.set(HOOKS[k] + 0.07, HOOK_Y - 0.06, -D / 2 + 0.004);
    for (const s of ['strings', 'overgrip']) {
      const w = wornOf(it, s);
      const key = `${it.id}:${s}`;
      const stamp = (it.stamps || {})[s];
      const had = st.stamps.has(key);
      const prev = st.stamps.get(key);
      st.stamps.set(key, stamp);
      if (had && stamp !== prev && !st.pending.has(key)) serviceFx(it.id, s);
      st.pending.delete(key);
      if (Math.abs(w - r.worn[s]) > 0.02 || (w >= 1) !== (r.worn[s] >= 1) || r.worn[s] === 0) setWear(r, s, w);
    }
    if (r.photo !== it.photo || r.title !== it.name) { r.photo = it.photo; r.title = it.name; r.tagMat.map.dispose(); r.tagMat.map = polaroid(it.photo, it.name); r.tagMat.needsUpdate = true; }
    const due = rowsOf(it).filter((x) => x.worn >= 1);
    r.sign.visible = due.length > 0;
    if (due.length && r.sign.userData.text !== due[0].verb) { r.sign.material.map = signTex(due[0].verb); r.sign.userData.text = due[0].verb; r.sign.material.needsUpdate = true; }
  });
  hookGhosts.forEach((g, k) => { g.visible = k >= rackets.length && (k === rackets.length); });
  // Shoes.
  const shoes = data.items.filter((i) => i.kind === 'shoes').slice(0, 2);
  for (const [id, p] of st.pairs) if (!shoes.find((i) => i.id === id)) { p.g.removeFromParent(); st.pairs.delete(id); }
  shoes.forEach((it, k) => {
    let p = st.pairs.get(it.id);
    if (!p) { p = buildPair(it); st.pairs.set(it.id, p); locker.add(p.g); p.dropY = st.open ? 1.4 : 0; p.dropV = 0; }
    p.slot = k;
    p.g.position.x = SHOE_X[k];
    p.g.position.z = 0.04;
    const key = `${it.id}:soles`;
    const stamp = (it.stamps || {}).soles;
    const had = st.stamps.has(key);
    const prev = st.stamps.get(key);
    st.stamps.set(key, stamp);
    if (had && stamp !== prev && !st.pending.has(key)) serviceFx(it.id, 'soles');
    st.pending.delete(key);
    setShoeWear(p, wornOf(it, 'soles'));
    if (p.photo !== it.photo || p.title !== it.name) { p.photo = it.photo; p.title = it.name; p.tagMat.map.dispose(); p.tagMat.map = polaroid(it.photo, it.name); p.tagMat.needsUpdate = true; }
    p.sign.visible = wornOf(it, 'soles') >= 1;
  });
  shoeGhosts.forEach((g, k) => { g.visible = k === shoes.length; });
  // Balls.
  const balls = data.items.find((i) => i.kind === 'balls');
  if (balls) {
    const key = 'balls:can';
    const stamp = (balls.stamps || {}).can;
    const had = st.stamps.has(key);
    const prev = st.stamps.get(key);
    st.stamps.set(key, stamp);
    if (balls.hasOpen && !shelf.open && !shelf.cracking) placeOpen();
    shelf.wantCans = balls.stock;
    if (had && stamp !== prev && !st.pending.has(key)) crackFx();
    st.pending.delete(key);
    syncCans();
    setBallWear(wornOf(balls, 'can'));
    lowSign.visible = balls.low;
    shelf.stock = balls.stock;
  }
  const gr = data.items.find((i) => i.kind === 'grips');
  if (gr) { grips.want = gr.stock; syncRolls(); binLow.visible = gr.low; }
  st.items = data.items;
  if (st.focus && !ids.has(st.focus)) unfocus();
  paint();
};

function syncCans() {
  const want = Math.min(SHOW_CANS, shelf.wantCans);
  while (shelf.cans.length < want) {
    const c = buildCan(false);
    const k = shelf.cans.length;
    c.g.position.set(canX(k), SHELF_Y + (st.open ? 1.0 + k * 0.15 : 0), CAN_Z);
    c.vy = 0;
    locker.add(c.g);
    shelf.cans.push(c);
  }
  while (shelf.cans.length > want) shelf.cans.pop().g.removeFromParent();
  const extra = shelf.wantCans - SHOW_CANS;
  moreTag.visible = extra > 0;
  if (extra > 0 && moreTag.userData.n !== extra) { moreTag.material.map = signTex(`+${extra}`, '#16181d', '#efece5'); moreTag.material.needsUpdate = true; moreTag.userData.n = extra; }
  canGhost.position.set(canX(Math.min(SHOW_CANS, shelf.cans.length)), SHELF_Y, CAN_Z);
}
function placeOpen() {
  const c = buildCan(true);
  c.g.position.copy(OPEN);
  locker.add(c.g);
  shelf.open = c;
  const lid = new THREE.Group();
  lid.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.035, 24), lidMat), 0, 0, 0));
  lid.position.set(OPEN.x + 0.24, SHELF_Y + 0.1, OPEN.z + 0.02);
  lid.rotation.set(0, 0, rad(78));
  lid.traverse((o) => { o.userData.pick = 'balls'; });
  locker.add(lid);
  shelf.openLid = lid;
}
function syncRolls() {
  const want = Math.min(8, grips.want);
  while (grips.rolls.length < want) {
    const r = buildRoll();
    const p = rollSpot(grips.rolls.length);
    r.position.copy(p).setY(p.y + (st.open ? 0.8 : 0));
    r.userData.vy = 0;
    r.userData.rest = p.y;
    bin.add(r);
    grips.rolls.push(r);
  }
  while (grips.rolls.length > want) bin.remove(grips.rolls.pop());
}

// ---------- Effects for things you did ----------
const fx = [];
function tween(ms, step, done) { fx.push({ t: 0, ms, step, done }); }
const ease = (k) => 1 - Math.pow(1 - k, 3);
function serviceFx(id, s) {
  const r = st.racks.get(id);
  if (r && s === 'strings') {
    r.sweep = 0;
    post({ type: 'ping' });
    tween(600, (k) => { r.bedMat.map.dispose(); r.bedMat.map = bedTexture(Math.min(1, r.worn.strings), ease(k)); r.bedMat.needsUpdate = true; }, () => setWear(r, 'strings', 0));
    r.w += 1.2;
  } else if (r && s === 'overgrip') {
    const roll = grips.rolls[grips.rolls.length - 1];
    const wrap = () => {
      r.fresh.visible = true;
      r.fresh.scale.y = 0.001;
      post({ type: 'wrap' });
      tween(500, (k) => { r.fresh.scale.y = Math.max(0.001, ease(k)); }, () => { r.fresh.visible = false; setWear(r, 'overgrip', 0); });
    };
    if (roll) {
      const from = roll.getWorldPosition(new THREE.Vector3());
      bin.remove(roll);
      grips.rolls.pop();
      grips.want = Math.max(0, grips.want - 1);
      locker.add(roll);
      const to = new THREE.Vector3();
      tween(450, (k) => {
        r.handle.getWorldPosition(to);
        const p = from.clone().lerp(to, ease(k));
        p.y += 0.6 * Math.sin(Math.PI * k);
        roll.position.copy(locker.worldToLocal(p));
        roll.rotation.z += 0.3;
        roll.scale.setScalar(1 - 0.6 * k);
      }, () => { locker.remove(roll); wrap(); });
    } else wrap();
  } else if (s === 'soles') {
    const p = st.pairs.get(id);
    if (!p) return;
    post({ type: 'kick' });
    p.fly = { t: 0 };
    tween(380, (k) => { p.g.position.set(SHOE_X[p.slot] - 2.6 * k, BASE + 0.9 * Math.sin(Math.PI * k * 0.8), 0.04 + 1.2 * k); p.g.rotation.z = 2.4 * k; }, () => {
      p.g.rotation.z = 0;
      setShoeWear(p, 0);
      p.fly = null;
      p.dropY = 1.4; p.dropV = 0;
    });
  }
}
function crackFx() {
  const old = shelf.open;
  const oldLid = shelf.openLid;
  if (old) {
    const from = old.g.position.clone();
    tween(560, (k) => { old.g.position.set(from.x + 1.2 * k, from.y + 0.8 * Math.sin(Math.PI * k) - 3 * k * k, from.z + 1.6 * k); old.g.rotation.z = -3 * k; }, () => old.g.removeFromParent());
    if (oldLid) oldLid.removeFromParent();
  }
  shelf.open = null;
  shelf.openLid = null;
  shelf.cracking = true;
  // The rightmost can on the shelf comes forward and pops.
  const c = shelf.cans.pop() || buildCan(false);
  if (!c.g.parent) { c.g.position.set(canX(0), SHELF_Y + 1, CAN_Z); locker.add(c.g); }
  const from = c.g.position.clone();
  tween(420, (k) => { const p = from.clone().lerp(OPEN, ease(k)); p.y += 0.3 * Math.sin(Math.PI * k); c.g.position.copy(p); }, () => {
    post({ type: 'pop' });
    const lid = c.lid;
    const lp = lid.position.clone();
    tween(520, (k) => { lid.position.set(lp.x + 0.24 * k, lp.y + 0.55 * Math.sin(Math.PI * k) - 0.5 * k * k, lp.z + 0.02 * k); lid.rotation.z = rad(78) * k; lid.rotation.y = 7 * k; }, () => {
      c.g.remove(lid);
      lid.position.set(OPEN.x + 0.24, SHELF_Y + 0.1, OPEN.z + 0.02);
      lid.rotation.set(0, 0, rad(78));
      locker.add(lid);
      shelf.openLid = lid;
      post({ type: 'land' });
    });
    shelf.open = c;
    shelf.cracking = false;
    c.fuzz.color.set(BALL_Y);
    for (const b of c.balls) b.scale.set(1, 1, 1);
  });
  syncCans();
}

// ---------- Panel ----------
const ui = $('ui');
const byId = (id) => st.items.find((i) => i.id === id);
function paint() {
  const it = st.focus ? byId(st.focus) : null;
  ui.classList.toggle('focus', !!it);
  if (!it) {
    const due = (st.payload && st.payload.due) || [];
    $('h1').textContent = 'THE CLOSET.';
    $('h2').textContent = due.length ? `${due.length} THING${due.length > 1 ? 'S' : ''} DUE.` : 'ALL GOOD.';
    $('due').innerHTML = due.slice(0, 3).map((d) => `<li>${esc(d)}</li>`).join('') || '<li class="ok">nothing worn out yet</li>';
    $('hint').textContent = st.racks.size || st.pairs.size ? 'tap anything to look closer. grab a racket and swing it.' : 'tap a dashed outline to add your racket or shoes.';
    setKey('', '', '');
    canGhost.visible = false; rollGhost.visible = false;
    return;
  }
  $('kind').textContent = { racket: 'RACKET', shoes: 'SHOES', balls: 'BALLS', grips: 'OVERGRIPS' }[it.kind];
  $('name').textContent = it.name;
  const rows = rowsOf(it);
  if (!st.row || !rows.find((r) => r.s === st.row)) st.row = rows.length ? [...rows].sort((a, b) => b.worn - a.worn)[0].s : null;
  let html = rows.map((r) => `<button class="row${r.s === st.row && rows.length > 1 ? ' on' : ''}${r.worn >= 1 ? ' due' : ''}" data-s="${r.s}"><b>${r.word}</b><span>${esc(r.text)}</span><i class="bar"><u style="width:${Math.round(Math.min(1, r.worn) * 100)}%"></u></i><em>${r.worn >= 1 ? 'DUE NOW' : r.worn >= 0.6 ? 'WEARING' : 'FRESH'}</em></button>`).join('');
  if (it.kind === 'balls' || it.kind === 'grips') {
    const n = it.stock;
    const what = it.kind === 'balls' ? (n === 1 ? 'can' : 'cans') : (n === 1 ? 'overgrip' : 'overgrips');
    html += `<div class="stock${it.low ? ' due' : ''}"><b>${n}</b><span>${what} ${it.kind === 'balls' ? 'on the shelf' : 'in the bin'}${it.low ? '. running low.' : ''}</span><button id="order">ORDER MORE</button></div>`;
    html += `<p class="how">${it.kind === 'balls' ? 'bought some? tap the dashed can to put one on the shelf.' : 'bought some? tap the dashed roll. a regrip takes one out.'}</p>`;
  } else if (!it.photo) html += '<p class="how">tap the tag to add a photo.</p>';
  $('rows').innerHTML = html;
  const row = rows.find((r) => r.s === st.row);
  if (it.kind === 'balls') setKey(it.stock > 0 ? '01' : '', 'CRACK A NEW CAN', 'SLIDE TO OPEN ONE');
  else if (row) setKey('01', row.verb, 'SLIDE WHEN IT IS DONE');
  else setKey('', '', '');
  canGhost.visible = it.kind === 'balls' && shelf.wantCans < SHOW_CANS;
  rollGhost.visible = it.kind === 'grips';
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
$('rows').addEventListener('click', (e) => {
  const b = e.target.closest('.row');
  if (b && b.dataset.s !== st.row) { st.row = b.dataset.s; post({ type: 'tick' }); paint(); }
  if (e.target.closest('#order')) post({ type: 'order', kind: byId(st.focus).kind });
});
let pressTimer = 0;
$('name').addEventListener('pointerdown', () => { pressTimer = setTimeout(() => { pressTimer = -1; post({ type: 'remove', id: st.focus }); }, 650); });
$('name').addEventListener('pointerup', () => { if (pressTimer !== -1) { clearTimeout(pressTimer); post({ type: 'edit', id: st.focus }); } pressTimer = 0; });
$('name').addEventListener('pointercancel', () => { clearTimeout(pressTimer); pressTimer = 0; });

function focus(id) {
  if (st.focus === id) return;
  st.focus = id;
  st.row = null;
  post({ type: 'focus', id });
  paint();
}
function unfocus() {
  if (!st.focus) return;
  st.focus = null;
  post({ type: 'focus', id: null });
  paint();
}
window.unfocus = unfocus;
window.focusItem = focus;

// ---------- Slide strip (same control as home) ----------
const key = $('enter');
const sl = { x: 0, v: 0, max: 1, held: false, finishing: false, done: false, grab: 0, lastX: 0, lastT: 0, flick: 0, puffAt: 0, zone: 0 };
const BALL = 50;
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
  void key.offsetWidth;
  key.classList.add('swap');
}
key.addEventListener('pointerdown', (e) => {
  if (sl.done || sl.finishing) return;
  const r = key.getBoundingClientRect();
  sl.max = Math.max(1, r.width - BALL - 16);
  sl.grab = clamp(e.clientX - r.left - 8 - sl.x, 0, BALL);
  sl.held = true; sl.v = 0; sl.flick = 0; sl.lastX = e.clientX; sl.lastT = performance.now();
  key.setPointerCapture(e.pointerId);
  key.classList.add('held');
  post({ type: 'press' });
});
key.addEventListener('pointermove', (e) => {
  if (!sl.held) return;
  const r = key.getBoundingClientRect();
  const now = performance.now();
  sl.x = clamp(e.clientX - r.left - 8 - sl.grab, 0, sl.max);
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
      setTimeout(() => { Object.assign(sl, { x: 0, v: 0, done: false, zone: 0 }); key.classList.remove('hit'); }, 1400);
    }
  }
  if (Math.abs(sl.x - sl.puffAt) > 14 && sl.x > 4) { sl.puffAt = sl.x; puff(sl.x); }
  const zone = Math.floor((sl.x / sl.max) * 3 + 0.0001);
  if (zone !== sl.zone && sl.x > 2 && !sl.done) { sl.zone = zone; post({ type: 'line' }); }
}
function slideRender(t) {
  const u = (t % 2.4) / 0.5;
  const idle = !sl.held && !sl.finishing && !sl.done && sl.x < 1 && u < 1 ? 9 * Math.sin(Math.PI * u) : 0;
  const x = sl.x + idle;
  $('ballw').style.transform = `translate3d(${x}px,0,0)`;
  $('ball').style.transform = `rotate(${x / (BALL / 2)}rad)`;
  $('skid').style.width = `${sl.x > 2 ? sl.x + BALL / 2 + 6 : 0}px`;
}
/** The ball reached the baseline: do the thing on the object right away, then tell the app. */
function onSlid() {
  const it = byId(st.focus);
  if (!it) return;
  post({ type: 'slid' });
  if (it.kind === 'balls') {
    if (it.stock <= 0) return;
    st.pending.add('balls:can');
    shelf.wantCans = Math.max(0, shelf.wantCans - 1);
    crackFx();
    post({ type: 'crack' });
    return;
  }
  const s = st.row;
  if (!s) return;
  st.pending.add(`${it.id}:${s}`);
  serviceFx(it.id, s);
  post({ type: 'service', id: it.id, s });
}

// ---------- Touch ----------
const ray = new THREE.Raycaster();
const ndc = (e) => new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.02);
const onPlane = (e) => { ray.setFromCamera(ndc(e), camera); const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null; };
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  ray.setFromCamera(ndc(e), camera);
  const pickables = [];
  locker.traverse((o) => { if (o.isMesh && o.visible && (o.userData.pick || o.userData.ghost || o.userData.photo)) pickables.push(o); });
  const hit = ray.intersectObjects(pickables, false).find((h) => { let o = h.object; while (o) { if (!o.visible) return false; o = o.parent; } return true; });
  down = { x: e.clientX, y: e.clientY, t: performance.now(), hit: hit ? hit.object.userData : null };
  const id = hit && hit.object.userData.pick;
  const r = id && st.racks.get(id);
  if (r && !hit.object.userData.photo) {
    const p = onPlane(e);
    if (p) {
      const pivot = new THREE.Vector3(HOOKS[r.slot], HOOK_Y, 0);
      r.held = { a0: Math.atan2(p.x - pivot.x, pivot.y - p.y), th0: r.th, pivot };
      r.target = r.th;
      canvas.setPointerCapture(e.pointerId);
      post({ type: 'grab' });
      down.racket = r;
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  const r = down && down.racket;
  if (!r || !r.held) return;
  const p = onPlane(e);
  if (!p) return;
  const a = Math.atan2(p.x - r.held.pivot.x, r.held.pivot.y - p.y);
  let d = a - r.held.a0;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  r.target = clamp(r.held.th0 + d, -1.3, 1.3);
});
const release = (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 380;
  const r = down.racket;
  if (r) r.held = null;
  const h = down.hit;
  down = null;
  if (moved > 10 || !quick) return;
  if (!h) { if (st.focus) unfocus(); return; }
  if (h.ghost) {
    if (h.ghost === 'can') { shelf.wantCans += 1; syncCans(); post({ type: 'restock', kind: 'balls' }); }
    else if (h.ghost === 'roll') { grips.want += 1; syncRolls(); post({ type: 'restock', kind: 'grips' }); }
    else post({ type: 'add', kind: h.ghost });
    return;
  }
  if (h.photo && st.focus === h.photo) { post({ type: 'photo', id: h.photo }); return; }
  const id = h.pick || h.photo;
  if (r) r.w += (r.slot === 1 ? 1 : -1) * 1.4; // a tap pokes it
  const p = st.pairs.get(id);
  if (p) { p.hop.v = 6; post({ type: 'squeak' }); }
  if (st.focus === id && h.pick && !h.photo) return;
  focus(id);
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// ---------- Simulation ----------
function spring(s, target, dt, hz, ratio) {
  const w = hz * Math.PI * 2;
  s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt;
  s.x += s.v * dt;
}
const sprV = (x, v, target, dt, hz, ratio) => {
  const w = hz * Math.PI * 2;
  v.addScaledVector(x.clone().sub(target), -w * w * dt).addScaledVector(v, -2 * ratio * w * dt);
  x.addScaledVector(v, dt);
};
let clackAt = 0;
function clack(v) {
  if (st.clock - clackAt < 0.08 || v < 0.4) return;
  clackAt = st.clock;
  post({ type: 'clack', v: Math.min(1, v / 5) });
}
function step(dt) {
  st.clock += dt;
  slideStep(dt);
  for (let k = fx.length - 1; k >= 0; k -= 1) {
    const f = fx[k];
    f.t += dt * 1000;
    const p = Math.min(1, f.t / f.ms);
    f.step(p);
    if (p >= 1) { fx.splice(k, 1); if (f.done) f.done(); }
  }
  // Doors.
  if (st.clock > 0.3 && !st.open) { st.open = true; post({ type: 'doors' }); }
  for (const d of doors) {
    const target = st.open ? rad(118) : 0;
    const before = d.a.v;
    spring(d.a, target, dt, 1.4, 0.55);
    if (!d.knocked && st.open && before > 0 && d.a.v <= 0) { d.knocked = true; if (d.s > 0) post({ type: 'knock' }); }
    d.g.rotation.y = d.s * d.a.x;
  }
  // Rackets.
  const list = [...st.racks.values()].sort((a, b) => a.slot - b.slot);
  for (const r of list) {
    if (r.held) {
      const w = 12 * Math.PI * 2;
      r.w += (-w * w * (r.th - r.target) - 2 * w * r.w) * dt;
    } else r.w += (-G_OVER_L * Math.sin(r.th) - 2 * ZETA * W0 * r.w) * dt;
    r.th += r.w * dt;
    // Side walls.
    const x0 = HOOKS[r.slot];
    for (const [L, hw] of PROBES) {
      const x = x0 + L * Math.sin(r.th);
      if (x + hw > W / 2 - 0.02 && r.w > 0) { clack(Math.abs(r.w)); r.w = -r.w * 0.4; }
      if (x - hw < -W / 2 + 0.02 && r.w < 0) { clack(Math.abs(r.w)); r.w = -r.w * 0.4; }
    }
    // Tag lags behind, seeking world-vertical.
    const tw = 2.2 * Math.PI * 2;
    r.tagV += (-tw * tw * (r.tagA + r.th) - 2 * 0.15 * tw * r.tagV) * dt;
    r.tagA += r.tagV * dt;
    if (r.flap.visible) r.flap.rotation.z = 0.25 + 0.2 * Math.sin(st.clock * 3.1) - 0.4 * r.th;
  }
  for (let k = 0; k + 1 < list.length; k += 1) {
    const a = list[k];
    const b = list[k + 1];
    if (b.slot !== a.slot + 1) continue;
    let pen = -1;
    for (const [L, hw] of PROBES) pen = Math.max(pen, (HOOKS[a.slot] + L * Math.sin(a.th) + hw) - (HOOKS[b.slot] + L * Math.sin(b.th) - hw));
    if (pen > 0 && a.w > b.w) {
      const rel = a.w - b.w;
      const avg = (a.w + b.w) / 2;
      a.w = avg - 0.55 * rel / 2;
      b.w = avg + 0.55 * rel / 2;
      if (a.held) a.w = Math.min(a.w, 0);
      clack(rel);
      a.th -= pen * 0.5 / 0.35; b.th += pen * 0.5 / 0.35;
    }
  }
  // Shoes hop when poked, drop in when new.
  for (const p of st.pairs.values()) {
    spring(p.hop, 0, dt, 3.2, 0.5);
    if (p.dropY !== undefined && p.dropY > 0) {
      p.dropV -= 18 * dt;
      p.dropY += p.dropV * dt;
      if (p.dropY <= 0) { p.dropY = 0; if (p.dropV < -1.5) { post({ type: 'thud' }); p.dropV = -p.dropV * 0.25; p.dropY = 0.0001; } else p.dropV = 0; }
    }
  }
  // Cans and rolls fall into place.
  shelf.cans.forEach((c, k) => {
    const rest = SHELF_Y;
    c.vy = (c.vy || 0) - 18 * dt;
    c.g.position.y += c.vy * dt;
    c.g.position.x += (canX(k) - c.g.position.x) * Math.min(1, dt * 10);
    if (c.g.position.y <= rest) { if (c.vy < -1.6) { post({ type: 'pock', v: Math.min(1, -c.vy / 8) }); c.vy = -c.vy * 0.3; } else c.vy = 0; c.g.position.y = rest; }
  });
  grips.rolls.forEach((r) => {
    r.userData.vy -= 18 * dt;
    r.position.y += r.userData.vy * dt;
    if (r.position.y <= r.userData.rest) { if (r.userData.vy < -1.6) { post({ type: 'pock', v: 0.4 }); r.userData.vy *= -0.3; } else r.userData.vy = 0; r.position.y = r.userData.rest; }
  });
}

// ---------- Camera ----------
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
/** Distance that fits a w x h box into the screen area above the panel. */
function fit(w, h, freeFrac) {
  const v = Math.tan(rad(camera.fov / 2));
  return Math.max(h / freeFrac / 2 / v, w / 2 / (v * camera.aspect));
}
function shot() {
  const H_ = window.innerHeight;
  const top = 64;
  const panel = $('panel').getBoundingClientRect().height + 24;
  const free = Math.max(0.3, (H_ - top - panel) / H_);
  const it = st.focus ? byId(st.focus) : null;
  let look; let size;
  if (it && it.kind === 'racket' && st.racks.get(it.id)) { const r = st.racks.get(it.id); look = new THREE.Vector3(HOOKS[r.slot], HOOK_Y - 0.92, 0); size = [1.8, 2.5]; }
  else if (it && it.kind === 'shoes' && st.pairs.get(it.id)) { const p = st.pairs.get(it.id); look = new THREE.Vector3(SHOE_X[p.slot], BASE + 0.3, 0.05); size = [1.25, 0.95]; }
  else if (it && it.kind === 'balls') { look = new THREE.Vector3(-0.55, SHELF_Y + 0.4, 0); size = [2.05, 1.15]; }
  else if (it && it.kind === 'grips') { look = new THREE.Vector3(1.0, SHELF_Y + 0.25, 0); size = [1.15, 0.9]; }
  else { look = new THREE.Vector3(0, BASE + (H + 0.3) / 2 - 0.1, 0); size = [W + 0.7, H + 1.3]; }
  const d = fit(size[0], size[1], free);
  // Shift the view so the subject sits centered in the free band, not the whole screen.
  const offset = H_ / 2 - (top + (H_ - top - panel) / 2);
  return { look, d, offset };
}
function frameCam(dt) {
  const s = shot();
  const yaw = rad(0.6) * Math.sin((st.clock * Math.PI * 2) / 9) + (st.focus ? rad(6) : 0);
  const pitch = st.focus ? rad(8) : rad(6);
  const want = s.look.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(s.d));
  sprV(st.cam.pos, st.cam.vp, want, dt, 1.5, 1);
  sprV(st.cam.look, st.cam.vl, s.look, dt, 1.5, 1);
  st.offset = s.offset;
}
st.cam.pos.copy(shot().look).add(new THREE.Vector3(0, 0.6, shot().d * 1.15));
st.cam.look.copy(shot().look);

function pose() {
  for (const r of st.racks.values()) {
    r.g.rotation.z = r.th;
    r.shadow.rotation.z = r.th;
    r.tagPivot.rotation.z = r.tagA;
    r.sign.rotation.z = -r.th;
  }
  for (const p of st.pairs.values()) {
    if (!p.fly) p.g.position.y = BASE + Math.max(0, p.hop.x * 0.06) + (p.dropY || 0);
  }
  // Due signs swing gently so they are never frozen.
  const sway = 0.06 * Math.sin(st.clock * 2.1);
  lowSign.rotation.z = sway; binLow.rotation.z = -sway;
  for (const p of st.pairs.values()) p.sign.rotation.z = sway;
  slideRender(st.clock);
  camera.position.copy(st.cam.pos);
  camera.lookAt(st.cam.look);
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, st.offset || 0, window.innerWidth, window.innerHeight);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let remaining = Math.min((now - last) / 1000, 0.1);
  last = now;
  while (remaining > 1e-6) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    step(dt);
  }
  frameCam(Math.min((now - (frame.t || now)) / 1000, 0.05) || 1 / 60);
  frame.t = now;
  pose();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
paint();
/** Test hook: run the simulation forward without waiting on frames (headless renders only a few). */
window.advance = (sec) => { for (let k = 0; k < sec * 120; k += 1) { step(1 / 120); frameCam(1 / 120); } pose(); renderer.render(scene, camera); };

/** Self-playing tour for recording: swing, knock the neighbor, look at a racket, restring it, crack a can. */
window.demoCloset = () => {
  const rs = () => [...st.racks.values()].sort((a, b) => a.slot - b.slot);
  setTimeout(() => { const r = rs()[0]; if (r) { r.w = -5.5; post({ type: 'fling' }); } }, 1600);
  setTimeout(() => { const r = rs()[0]; if (r) focus([...st.racks.keys()].find((k) => st.racks.get(k) === r)); }, 4200);
  setTimeout(() => window.demoSlide(0.95), 6000);
  setTimeout(() => focus('balls'), 9000);
  setTimeout(() => window.demoSlide(0.95), 10600);
  setTimeout(() => unfocus(), 13600);
};
post({ type: 'ready' });
