// Courts: six small arenas, one per favorite venue. Each shows that venue's one signature court at regulation proportions and on its
// real compass bearing (from OpenStreetMap via scripts/build-venues.mjs), walled in, with the venue's song running along the back walls
// like a sponsor board. The mascot hops between arenas; sliding the ball drops the camera down into the court.
// Same paper, ink and clay language as web/home.js, after docs/mo-design/vids/claude-bot-jumper-video.mov.
//
// Motion spec. Springs are damped oscillators integrated at 1/120 s.
// - Hop: 620 ms island to island (they are far apart). 90 ms anticipation squash to 0.78, a parabola 2.2 high,
//   landing squash 0.72 recovering at 3.2 Hz, ratio 0.45. The landed tile dips 0.07 and returns at 2.6 Hz, ratio 0.5.
// - Dive: the other arenas sink 7 units (1.4 Hz, ratio 0.9), the mascot hops onto the baseline and shrinks to player size, and the camera
//   comes down from 17.5 back and steep to 5 back and low at 1.0 Hz, ratio 1. The page reports the pick 1.5 s in.
// - Wall boards scroll 0.07 of their length a second.
// - Camera follows at 1.3 Hz, ratio 1, and orbits 0.5 degrees on a 9 s sine. Islands bob 0.035 on 3.4 to 4.6 s sines.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));

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
scene.fog = new THREE.Fog(PAPER, 28, 42); // the world below a tile you just left falls away into the paper
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 120);
scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd2, 1.55));
const sun = new THREE.DirectionalLight(0xfff4e4, 2.1);
sun.position.set(-5, 9, 4);
scene.add(sun);

const FWD = new THREE.Vector3(-1, 0, -1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const STEP = 4.7;
const MASCOT = 0.95;
const SIDE = 3.5; // every arena sits on the same size tile; the venue's surroundings live in its world below
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

// Mascot.
const mascot = new THREE.Group();
const skin = mat(0xd7f205, { roughness: 0.6 });
mascot.add(at(rbox(0.62, 0.56, 0.62, 0.09, skin), 0, 0.4, 0));
for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) mascot.add(at(rbox(0.16, 0.16, 0.16, 0.04, skin), x, 0.08, z));
const eyes = [];
for (const sgn of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.16), new THREE.MeshBasicMaterial({ color: INK }));
  e.position.set(sgn * 0.13, 0.45, 0.312);
  mascot.add(e);
  eyes.push(e);
}
mascot.rotation.y = rad(45);
scene.add(mascot);
const footShadow = blob(1.0, 0.75);
scene.add(footShadow);

// Dust.
const DUST = 80;
const dustPos = new Float32Array(DUST * 3);
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.85, depthWrite: false })));

const spring = (s, target, dt, hz, ratio) => {
  const w = hz * Math.PI * 2;
  s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt;
  s.x += s.v * dt;
};
const sp = (x = 0) => ({ x, v: 0 });


let venues = [];
const islands = [];
const st = { at: 0, target: 0, hop: null, squash: sp(), clock: 0, muted: false, cam: { x: sp(), y: sp(), z: sp() }, diving: false, dive: sp(), jump: null };

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
const WORLD_Y = -3.2;
const GROUND = { ucsd: 0x8f9e74, lindavista: 0xa7a98c, balboa: 0x86a865, roosevelt: 0x7fa060, northpark: 0xb3ab9d };
const facing = () => { const f = new THREE.Group(); f.rotation.y = Math.PI / 4; return f; };

/** Venues without their own world: a ground in the venue's color, and its landmarks set back and to the side, at a size nothing on a tile allows. */
function plainWorld(v, w, g) {
  const f = facing();
  w.add(f);
  f.add(at(new THREE.Mesh(new THREE.PlaneGeometry(44, 44).rotateX(-Math.PI / 2), mat(GROUND[v.key] ?? 0x8fae6a, { roughness: 1 })), 0, 0, -6));
  const props = new THREE.Group();
  const anim = FLAVOR[v.key]?.(props);
  for (const o of [...props.children]) if (o.userData.air) g.add(o); // aircraft still fly over the tile
  if (anim) anim(0);
  props.updateMatrixWorld(true);
  const pb = new THREE.Box3().setFromObject(props);
  if (!pb.isEmpty()) {
    // Long strips run up the screen beside the tile instead of hiding behind it.
    if (pb.max.x - pb.min.x > pb.max.z - pb.min.z) props.rotation.y = Math.PI / 2;
    const k = 1.6;
    props.scale.setScalar(k);
    props.updateMatrixWorld(true);
    const rb = new THREE.Box3().setFromObject(props);
    props.position.set(-2.5 - (rb.min.x + rb.max.x) / 2, -rb.min.y, -4.6 - (rb.min.z + rb.max.z) / 2);
  }
  f.add(props);
  return anim;
}

const WORLD = {
  barnes(w) {
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
    // The jetties: two lines of piled boulders out from the river mouth.
    const rockMat = mat(0x8b8478, { roughness: 1 });
    const rockGeo = new THREE.IcosahedronGeometry(0.075, 0);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const jx of [RX - 0.62, RX + 0.62]) {
      for (let z = SHORE + 0.4; z > SHORE - 4.2; z -= 0.09) {
        const out = (SHORE - z) / 4.2;
        for (const side of [-0.06, 0.06]) {
          const r = at(new THREE.Mesh(rockGeo, rockMat), jx + side + (rnd() - 0.5) * 0.05, 0.06 - out * 0.03 + rnd() * 0.03, z + (rnd() - 0.5) * 0.06);
          r.scale.setScalar(0.7 + rnd() * 0.6);
          r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
          B.add(r);
        }
      }
    }
    // The OB pier: a long concrete deck on piles off the beach, a T at the end, lamps along it.
    const pierMat = mat(0xd9d4c9);
    const PX = 2.4; const PY = 0.32; const P0 = SHORE + 0.9; const P1 = SHORE - 6.4;
    B.add(at(rbox(0.2, 0.05, P0 - P1, 0.01, pierMat), PX, PY, (P0 + P1) / 2));
    B.add(at(rbox(1.3, 0.05, 0.2, 0.01, pierMat), PX, PY, P1));
    for (let z = P0 - 0.3; z > P1; z -= 0.42) for (const dx of [-0.07, 0.07]) B.add(at(cyl(0.012, 0.012, PY + 0.2, pierMat, 5), PX + dx, (PY - 0.2) / 2, z));
    for (const dx of [-0.55, 0.55]) B.add(at(cyl(0.012, 0.012, PY + 0.2, pierMat, 5), PX + dx, (PY - 0.2) / 2, P1));
    for (let z = P0 - 0.8; z > P1; z -= 1.3) B.add(at(cyl(0.006, 0.006, 0.2, ink, 4), PX + 0.09, PY + 0.12, z));
    // Point Loma across the water: a long brushy ridge, the old lighthouse on its high point, its lamp blinking.
    const PL = new THREE.Group();
    PL.position.set(2.8, 0, -9.2);
    PL.rotation.y = 0.35;
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
      const bx = RX - Math.max(0, u - 0.45) * 9; // straight out the channel, then bears off up the coast
      const bz = SHORE + 0.6 - Math.min(u, 0.45) * 12;
      boat.position.set(bx, swell(bx, bz, t), bz);
      boat.rotation.set(0.08 * Math.sin(t * 1.3 + 1), u > 0.45 ? Math.PI / 2 : 0, 0.06 * Math.sin(t * 1.3));
      boat.visible = u > 0.02 && u < 0.97;
    };
  },
};

function build(data) {
  skin.color.set(data.color);
  venues = window.VENUES.map((v) => ({ ...v, ...(data.venues.find((d) => d.id === v.id) || {}) }));
  const L = COURT_L;
  const W = COURT_L * (10.97 / 23.77);
  const PL = L + 11 / M; // the court plus its run-off
  const PW = W + 6.4 / M;
  venues.forEach((v, i) => {
    const g = new THREE.Group();
    const base = FWD.clone().multiplyScalar(i * STEP).add(RIGHT.clone().multiplyScalar(i % 2 ? 0.55 : -0.55)).setY(0.1 + 0.14 * ((i * 7) % 3));
    const slab = rbox(SIDE, 0.4, SIDE, 0.06, mat(0xf4f1ea));
    slab.position.y = -0.2;
    g.add(slab);
    const text = `${String(i + 1).padStart(2, '0')} ${v.short}`;
    const faces = [label(text, false, v.accent), label(text, true, v.accent)];
    const labelMat = new THREE.MeshBasicMaterial({ map: faces[0] });
    for (const [x, z, ry] of [[0, SIDE / 2 + 0.002, 0], [SIDE / 2 + 0.002, 0, Math.PI / 2]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(SIDE - 0.3, 0.3), labelMat);
      p.position.set(x, -0.2, z); p.rotation.y = ry; g.add(p);
    }
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
    const anim = WORLD[v.key] ? WORLD[v.key](world, g) : plainWorld(v, world, g);
    world.visible = false;
    scene.add(world);
    // Where the player stands once inside: the baseline nearer the camera.
    const end = toWorld(L / 2 - 0.06, count > 1 ? (count - 1) / 2 * pitch : 0).multiplyScalar(scaleA);
    const spot = end.dot(CAM) > 0 ? end : end.multiplyScalar(-1);
    g.traverse((o) => { o.userData.island = i; });
    g.userData = { anim, boardMeshes, i, base, period: 3.6 + (i % 3) * 0.6, phase: i * 1.7, dip: sp(), sink: sp(), glow: 0, world, rise: sp(), pad, labelMat, faces, boards, spot: spot.setY(0.04), shadow: blob(SIDE * 1.9, 0.5), stand: new THREE.Vector3(SIDE / 2 - 0.3, 0, SIDE / 2 - 0.3) };
    scene.add(g, g.userData.shadow);
    islands.push(g);
  });
  for (let k = 0; k < DUST; k += 1) {
    const p = FWD.clone().multiplyScalar(((k * 0.137) % 1) * (venues.length + 1) * STEP - STEP).add(RIGHT.clone().multiplyScalar(((k * 0.619) % 1 - 0.5) * 9));
    dustPos.set([p.x, ((k * 0.311) % 1) * 5 - 0.5, p.z], k * 3);
  }
  const s0 = islands[0].userData.base;
  st.cam.x.x = s0.x; st.cam.y.x = s0.y; st.cam.z.x = s0.z;
  initDock();
  paint();
  post({ type: 'stage', id: venues[0].id, anthem: venues[0].anthem });
}


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
/** The ball reached the baseline: the fighter springs, then the court is picked. */
function onSlid() { st.squash.x = -0.3; st.squash.v = 0; post({ type: 'slid' }); setTimeout(enter, 260); }

function paint() {
  const v = venues[st.target];
  const n = venues.length;
  $('pct').textContent = `${String(st.target + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  $('fill').style.width = `${((st.target + 1) / n) * 100}%`;
  $('fill').style.background = v.accent;
  document.documentElement.style.setProperty('--accent', v.accent);
  $('h1').textContent = `${v.name}.`;
  $('h2').textContent = v.tagline;
  $('lights').querySelector('b').textContent = v.lights ? 'LIGHTS' : 'NO LIGHTS';
  $('lights').classList.toggle('off', !v.lights);
  $('count').querySelector('b').textContent = String(v.courts.length);
  // Stats only once there is something to say; an empty record is noise.
  $('blurb').textContent = v.played ? [`${v.played} played here`, v.king ? `king: ${v.king}` : null, `you ${v.rec}`].filter(Boolean).join(' · ') : '';
  setKey(String(st.target + 1), 'JUMP IN', 'SLIDE TO PLAY HERE');
  $('sub').textContent = 'your six. the song is on the wall.';
}

// The dock: one floating platform per venue in its own color. A real ball hops to the one you pick, with your fighter.
const dock = $('dock');
const DOCK_LABEL = { ucsd: 'UCSD', lindavista: 'L. VISTA', balboa: 'BALBOA', roosevelt: 'ROOSEVELT', northpark: 'N. PARK', barnes: 'BARNES' };
const dk = { x: 0, y: 0, vx: 0, vy: 0, to: 0, flying: false, squash: 0, rot: 0, at: 0, load: null, queued: null };
const G = 1500;
function initDock() {
  dock.insertAdjacentHTML('beforeend', venues.map((v, k) => `<button class="slot" data-i="${k}" style="--pc:${v.accent}"><span class="pf"></span><span class="lbl">${DOCK_LABEL[v.key] || v.short}</span></button>`).join(''));
  dock.addEventListener('click', (e) => { const b = e.target.closest('.slot'); if (b) go(Number(b.dataset.i)); });
  dk.at = st.target;
}
const slotX = (i) => { const r = dock.getBoundingClientRect(); const b = dock.children[2 + i].getBoundingClientRect(); return b.left + b.width / 2 - r.left; };
const restY = () => dock.clientHeight - 49;
const DOCK_READY = () => venues.length > 0;
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
  if (!venues.length) return;
  $('dball').style.transform = `translate3d(${dk.x}px,${dk.y}px,0) scale(${1 + dk.squash},${1 - dk.squash})`;
  $('dball').firstElementChild.style.transform = `rotate(${dk.rot}rad)`;
  const lift = Math.min(1, (restY() - dk.y) / 90);
  $('dshadow').style.transform = `translateX(${dk.x}px) scale(${1 - 0.5 * lift})`;
  $('dshadow').style.opacity = String(1 - 0.6 * lift);
  [...dock.querySelectorAll('.slot')].forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === st.target));
}

function go(i) {
  i = Math.max(0, Math.min(venues.length - 1, i));
  if (i === st.target) return;
  st.target = i;
  dockHop(i);
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
  $('home').classList.add('out');
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
  $('home').classList.remove('out');
}
window.undive = undive;
// Back is always one step: out of the court if you are in one, otherwise off this screen.
// Wind up on touch; only a completed click sends the ball back.
let backPending = false;
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
const backControl = $('home');
const releaseBack = () => backControl.classList.remove('held');
backControl.addEventListener('pointerdown', () => {
  if (!backPending) backControl.classList.add('held');
});
backControl.addEventListener('pointerup', releaseBack);
backControl.addEventListener('pointerleave', releaseBack);
backControl.addEventListener('pointercancel', releaseBack);
backControl.addEventListener('click', () => {
  if (backPending) return;
  backPending = true;
  releaseBack();
  backControl.classList.add('swing');
  post({ type: 'press' });
  setTimeout(() => {
    backControl.classList.remove('swing');
    backPending = false;
    if (st.diving) undive(); else post({ type: 'back' });
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280);
});

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
    if (hit && hit.object.userData.island != null) { const i = hit.object.userData.island; if (i === st.target) enter(); else go(i); }
  } else if (Math.abs(dy) > 44 && Math.abs(dy) > Math.abs(dx)) go(st.target + (dy < 0 ? 1 : -1));
});

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const standOn = (i) => islands[i].position.clone().add(islands[i].userData.stand);
const HOP = 0.62;

function advance(dt) {
  st.clock += dt;
  slideStep(dt);
  dockStep(dt);
  if (!venues.length) return;
  if (!st.hop && st.at !== st.target) { st.hop = { from: standOn(st.at), to: st.at + Math.sign(st.target - st.at), t: 0 }; post({ type: 'hop' }); }
  if (st.hop) {
    st.hop.t += dt;
    if (st.hop.t >= 0.09 + HOP) {
      st.at = st.hop.to;
      st.hop = null;
      st.squash.x = 0.28; st.squash.v = 0;
      islands[st.at].userData.dip.x = 0.07;
      post({ type: 'land' });
      if (st.at === st.target) {
        post({ type: 'stage', id: venues[st.at].id, anthem: venues[st.at].anthem });
        if (st.enterOnLand) { st.enterOnLand = false; setTimeout(enter, 280); }
      }
    }
  }
  spring(st.squash, 0, dt, 3.2, 0.45);
  spring(st.dive, st.diving ? 1 : 0, dt, 1.0, 1);
  if (st.jump) st.jump.t += dt;
  for (const g of islands) {
    const u = g.userData;
    spring(u.dip, 0, dt, 2.6, 0.5);
    spring(u.rise, u.i === (st.hop ? st.hop.to : st.at) ? 1 : 0, dt, 0.9, 1); // the ground of where you are rises; the last one falls away
    spring(u.sink, st.diving && u.i !== st.at ? 1 : 0, dt, 1.4, 0.9);
    for (const tex of u.boards) tex.offset.x += dt * 0.07 * tex.repeat.x;
    u.glow += ((u.i === st.target ? 1 : 0) - u.glow) * Math.min(1, dt / 0.08);
  }
  const focus = islands[st.hop ? st.hop.to : st.at].position;
  spring(st.cam.x, focus.x, dt, 1.3, 1);
  spring(st.cam.y, focus.y, dt, 1.3, 1);
  spring(st.cam.z, focus.z, dt, 1.3, 1);
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
    g.position.y += 0.035 * Math.sin((t * Math.PI * 2) / u.period + u.phase) * (1 - st.dive.x) - u.dip.x - 7 * u.sink.x;
    g.visible = u.sink.x < 0.97;
    u.world.position.set(u.base.x, WORLD_Y - 12 * (1 - u.rise.x), u.base.z);
    u.world.visible = u.rise.x > 0.01;
    if (u.anim && (g.visible || u.world.visible)) u.anim(t);
    u.pad.material.opacity = 0.1 * u.glow * (1 - st.dive.x);
    u.shadow.material.opacity = 0.5 * (1 - u.sink.x);
    const lit = u.glow > 0.5 ? 1 : 0;
    if (u.labelMat.map !== u.faces[lit]) { u.labelMat.map = u.faces[lit]; u.labelMat.needsUpdate = true; }
    u.shadow.position.set(g.position.x + 0.5, WORLD_Y + 0.12, g.position.z + 0.5);
  }
  let stretch = 1 + 0.025 * Math.sin((t * Math.PI * 2) / 2.2);
  let size = MASCOT;
  if (st.hop) {
    const b = standOn(st.hop.to);
    const pre = Math.min(1, st.hop.t / 0.09);
    const k = THREE.MathUtils.clamp((st.hop.t - 0.09) / HOP, 0, 1);
    mascot.position.lerpVectors(st.hop.from, b, k);
    const rise = 2.2 * 4 * k * (1 - k);
    mascot.position.y += rise;
    stretch = k <= 0 ? 1 - 0.22 * pre : 1 + 0.14 * Math.sin(Math.PI * k);
    footShadow.position.set(mascot.position.x, THREE.MathUtils.lerp(st.hop.from.y, b.y, k) + 0.04, mascot.position.z);
    footShadow.visible = k < 0.12 || k > 0.88; // between islands there is nothing under it to shade
    footShadow.material.opacity = 0.7;
  } else if (st.jump) {
    // Into the court: one hop from the tile's corner to the baseline, landing at player size.
    const k = THREE.MathUtils.clamp((st.jump.t - 0.09) / 0.5, 0, 1);
    const to = islands[st.at].position.clone().add(islands[st.at].userData.spot);
    mascot.position.lerpVectors(st.jump.from, to, k);
    mascot.position.y += 0.9 * 4 * k * (1 - k);
    stretch = k <= 0 ? 1 - 0.22 * Math.min(1, st.jump.t / 0.09) : k < 1 ? 1 + 0.14 * Math.sin(Math.PI * k) : stretch;
    size = THREE.MathUtils.lerp(MASCOT, 0.34, k * k * (3 - 2 * k));
    footShadow.visible = k >= 1;
    footShadow.position.set(to.x, to.y + 0.01, to.z);
  } else {
    mascot.position.copy(standOn(st.at));
    footShadow.visible = true;
    footShadow.position.set(mascot.position.x, mascot.position.y + 0.04, mascot.position.z);
    footShadow.material.opacity = 0.75;
  }
  footShadow.scale.setScalar(size);
  stretch -= st.squash.x + 0.22 * charge; // pulling the ball loads the fighter
  mascot.scale.set(size / Math.sqrt(stretch), size * stretch, size / Math.sqrt(stretch));
  slideRender(t);
  dockRender();
  const blink = (t % 3.1) < 0.11 ? 0.12 : 1;
  for (const e of eyes) e.scale.y = blink;
  dustGeo.attributes.position.needsUpdate = true;

  // Camera. Outside: high and back, so the path of arenas reads. Inside (z = 1): low and close over the baseline, slowly circling the court.
  const z = THREE.MathUtils.clamp(st.dive.x, 0, 1);
  const orbit = rad(0.6) * Math.sin((t * Math.PI * 2) / 9) + z * rad(7) * Math.sin((t * Math.PI * 2) / 11);
  const look = new THREE.Vector3(st.cam.x.x, st.cam.y.x + 0.2 * (1 - z) + 0.08 * z, st.cam.z.x);
  const narrow = camera.aspect < 0.62 ? 1 : 0.84;
  const dir = new THREE.Vector3(Math.sin(rad(45) + orbit), THREE.MathUtils.lerp(0.82, 0.4, z), Math.cos(rad(45) + orbit)).normalize();
  camera.position.copy(look).add(dir.multiplyScalar(THREE.MathUtils.lerp(19.5 * narrow, 4.5, z)));
  camera.lookAt(look);
  // Inside, the frame drops so the court sits mid-screen and the walls and lights fill the top, not empty tile at the bottom.
  camera.setViewOffset(window.innerWidth, window.innerHeight, 0, window.innerHeight * (0.13 * (1 - z) - 0.16 * z), window.innerWidth, window.innerHeight);
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
