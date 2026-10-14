// The opponent picker scene: a clear jewel case on a white studio floor, after docs/mo-design/vids/cool-cd-player.mov.
// Bundled with three.js by scripts/build-case-web.mjs and run inside a WebView, where WebGL is GPU-accelerated.
//
// Motion spec. Springs are damped oscillators integrated at 1/120 s.
// - Tap: the lid swings on its left hinge from 0 to 178 degrees (2.0 Hz, damping ratio 0.72, about 4% overshoot).
//   As it opens the case eases to 0.72 scale and slides right by its own half width, so lid and tray stay centered.
// - Drag: free rotation, 0.45 degrees per px on both axes with no limit, so the case can be seen edge-on and from behind.
//   Release keeps the finger's speed, then settles to the nearest front-facing pose at 1.1 Hz, ratio 0.6.
// - Swap: the case leaves upward 5.5 units in 260 ms (ease-in cubic) while rolling 18 degrees; the next one rises from 5.5 below at 2.0 Hz, ratio 0.75.
// - Play: lid opens, the disc lifts 0.45 off the hub over 500 ms and spins up to 3 turns a second, then the page reports "played".
// - Hold: never frozen. The case drifts 2.2 degrees on a 5 s sine and bobs 0.03.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));

const BG = 0xf6f5f2;
const rad = THREE.MathUtils.degToRad;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.9;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
// Key light rakes in from the upper left. Kept well off the camera axis: aimed closer, its mirror reflection lands on the disc exactly when the case lies open and washes the label out.
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(-7, 7, 2.5);
scene.add(key);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Frame so a 2-unit case takes 64% of the width, whatever the aspect.
  const halfW = Math.tan(rad(15)) * camera.aspect;
  camera.position.set(0, 0, 2 / 0.64 / 2 / halfW);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

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

// Tray.
const tray = shellGroup(0.17, 0.085);
tray.add(box(0.2, 1.86, 0.13, 0.02, frosted, -0.86, 0, 0.08)); // hinge spine
const seat = new THREE.Mesh(new THREE.TorusGeometry(0.875, 0.012, 8, 96), clear);
seat.position.set(0.1, 0, 0.04);
tray.add(seat);
for (const [x, y] of [[-0.62, 0.86], [0.82, 0.86], [-0.62, -0.86], [0.82, -0.86]]) tray.add(box(0.2, 0.06, 0.05, 0.015, clear, x, y, 0.05)); // corner ribs
const hub = new THREE.Group();
hub.position.set(0.1, 0, 0.03);
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
const holo = document.createElement('canvas');
holo.width = holo.height = 512;
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
const DISC_REST = new THREE.Vector3(0.1, 0, 0.085);
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
body.add(hinge);

// Contact shadow: a soft blob on the floor behind the case.
const blob = document.createElement('canvas');
blob.width = blob.height = 256;
const ctx = blob.getContext('2d');
const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
grad.addColorStop(0, 'rgba(20,24,34,0.42)');
grad.addColorStop(0.55, 'rgba(20,24,34,0.14)');
grad.addColorStop(1, 'rgba(20,24,34,0)');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 256, 256);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
shadow.position.z = -0.9;
scene.add(shadow);

// State.
const spring = (x = 0) => ({ x, v: 0 });
function step(s, target, dt, hz, ratio) {
  const w = hz * Math.PI * 2;
  s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt;
  s.x += s.v * dt;
}
const st = {
  open: false, lid: spring(0), rx: spring(0), ry: spring(0), y: spring(-5.5),
  shown: null, wanted: null, swap: null, play: null, spin: 0, lift: spring(0), clock: 0,
  held: false, flingX: 0, flingY: 0,
};

function show(cast) {
  st.shown = cast;
  face.emissiveMap = labels[cast] || null;
  face.needsUpdate = true;
}

window.setCase = (cast) => {
  if (!st.shown) { show(cast); st.wanted = cast; return; }
  st.wanted = cast;
};
window.setOpen = (open) => { st.open = !!open; post({ type: 'open', open: st.open }); };
/** Test hook: throw the case as a finger would (degrees per second). */
window.fling = (vx, vy) => { st.rx.v = vx; st.ry.v = vy; };
window.playDisc = () => { if (!st.play) { st.open = true; st.play = { t: 0, done: false }; post({ type: 'open', open: true }); } };

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
  if (tap && !st.play && !st.swap) window.setOpen(!st.open);
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);

function advance(dt) {
  st.clock += dt;

  if (st.wanted !== st.shown && !st.swap && !st.play) st.swap = { t: 0, phase: 'out' };
  if (st.swap) {
    st.swap.t += dt;
    if (st.swap.phase === 'out') {
      const k = Math.min(1, st.swap.t / 0.26);
      st.y.x = 5.5 * k * k * k;
      if (k >= 1) {
        show(st.wanted);
        st.open = false;
        st.lid.x = 0; st.lid.v = 0;
        st.y.x = -5.5; st.y.v = 0;
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

  step(st.lid, st.open ? 1 : 0, dt, 2.0, 0.72);
  if (!st.held) {
    // Settle on the nearest pose that faces the camera, so a spin never has to unwind.
    step(st.rx, Math.round(st.rx.x / 360) * 360, dt, 1.1, 0.6);
    step(st.ry, Math.round(st.ry.x / 360) * 360, dt, 1.1, 0.6);
  }

  if (st.play) {
    st.play.t += dt;
    if (st.play.t > 0.35) {
      step(st.lift, 1, dt, 1.6, 0.8);
      st.spin = Math.min(3, st.spin + dt * 3.2);
    }
    if (!st.play.done && st.play.t > 1.45) { st.play.done = true; post({ type: 'played' }); }
  }
}

function pose() {
  const o = THREE.MathUtils.clamp(st.lid.x, 0, 1.06);
  const s = 1 - 0.28 * Math.min(o, 1);
  const drift = Math.sin((st.clock * Math.PI * 2) / 5);
  const swapRoll = st.swap && st.swap.phase === 'out' ? rad(18) * (st.y.x / 5.5) : 0;
  root.position.set(s * o, st.y.x + 0.03 * Math.sin((st.clock * Math.PI * 2) / 3.7), 0);
  root.scale.setScalar(s);
  body.rotation.set(rad(-9 + st.rx.x + drift * 1.1), rad(11 * (1 - o) + st.ry.x + drift * 2.2), swapRoll);
  lid.rotation.y = rad(-178) * st.lid.x;
  disc.position.set(DISC_REST.x, DISC_REST.y, DISC_REST.z + 0.45 * st.lift.x);
  shadow.position.x = root.position.x - s * o + 0.08 - st.ry.x * 0.012;
  shadow.position.y = root.position.y - 0.16 + st.rx.x * 0.012;
  shadow.scale.set((2.5 + 2.0 * Math.min(o, 1)) * s, 2.5 * s, 1);
  shadow.material.opacity = THREE.MathUtils.clamp(1 - Math.abs(st.y.x) / 3, 0, 1);
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
    disc.rotateY(-st.spin * Math.PI * 2 * dt);
  }
  pose();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
post({ type: 'ready' });
