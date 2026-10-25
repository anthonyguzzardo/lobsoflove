// The drill: real-size hard court, real ball flight (web/lib/ballistics.js), two thumbsticks.
//
// Left thumb moves you. Right thumb swings (web/lib/stroke.js reads it):
// - Pull back: your shoulders turn and the racket goes back on that side. Right is a forehand, left a backhand. How high you pull
//   is the racket face: low closes it (topspin), level is flat, high opens it (slice). The face shows on the racket and the stick.
// - Flick up through the middle: speed is pace, where you finish is aim (across your body = crosscourt), how far up is height.
//   Soft and way up is a lob.
// - Contact is real: the ball has to pass through your hitting zone (an arm and a racket out on the side you turned to, a step in
//   front) within 0.15 s of the swing. Turn the wrong way and you whiff. Off the sweet spot loses pace and scatters the aim.
//
// Modes: four ball-machine drills (ten balls, a target box scores double), and RALLY against a robot at three levels, first to 7
// by 2. The robot reads your ball, runs it down if it can get there, and hits back; pace and stretching it out draw errors.
//
// Wide screens (the unfolded iPhone Duo, an iPad, a phone on its side): the screen splits at the middle, where the Duo's hinge
// is. Left is your court, right is the read: a side-on view of every ball's arc over the net, and what each ball really was next
// to what you did with it. Each thumb gets its own half.
//
// Motion spec. Physics at 1/120 s; the seam turns at 5 % of its true spin so you can see which way it rolls.
// - You: run up to 6.2 m/s, reaching the stick's speed at 10 /s. Body turn on a 9 Hz, ratio 0.8 spring.
// - Racket: follows the stick while pulled back; the swing is 200 ms through, then 330 ms back to ready.
// - Robot: reacts 0.25 s after your contact, runs at 4.6 / 5.6 / 6.6 m/s on a 5 Hz, ratio 1 spring, recovers to the middle.
// - Machine: feeds 1.1 s after the last ball dies; yaws to its aim on a 6 Hz, ratio 1 spring and kicks back 6 cm.
// - The call stamps in at 1.25x and settles on a 9 Hz, ratio 0.55 spring, then fades after 1.6 s.
// - Camera: fitted every resize so the whole court, the machine or robot, and you fit inside the free part of the screen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { DOUBLES, DT, HALF, R, SERVICE, SINGLES, call, firstLanding, netH, solveLaunch, stepBall } from './lib/ballistics.js';
import { post } from './lib/bridge.js';
import { PROPS, buildPark } from './lib/park.js';
import { faceOf, kmh, readSwing, rpm, strike, volley } from './lib/stroke.js';

const PAPER = 0xefece5;
const CLAY = 0xe2562f;
const INKC = 0x16181d;
const BLUE = 0x2f6fd6;
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

// ---------- Modes ----------
// Drills: side is which wing the feeds go to (+1 forehand, -1 backhand, 0 either); target is a far-court box [x0, x1, z0, z1].
const MODES = [
  { id: 'xfh', kind: 'drill', name: 'CROSSCOURT FOREHAND', tip: 'feeds to your forehand. finish across you: deep and crosscourt.', side: 1, feeds: ['drive', 'drive', 'heavy', 'flat'], target: [-SINGLES, -1.0, -HALF, -8.4], demo: { shot: 'TOPSPIN FOREHAND, CROSSCOURT', why: 'the long diagonal over the low middle of the net: the safest deep ball there is.', pros: 'NADAL, ALCARAZ', wing: 1, back: { x: 0.6, y: 0.85 }, finish: { x: -0.75, y: -1.3 }, ms: 120 } },
  { id: 'dtlbh', kind: 'drill', name: 'BACKHAND DOWN THE LINE', tip: 'feeds to your backhand. finish out to the left: up the line.', side: -1, feeds: ['drive', 'slice', 'drive', 'heavy'], target: [-SINGLES, -1.6, -HALF, -8.0], demo: { shot: 'BACKHAND DOWN THE LINE', why: 'the change of direction: shorter court, higher net at the sides, so pick a ball you are set on.', pros: 'DJOKOVIC, WAWRINKA', wing: -1, back: { x: -0.6, y: 0.8 }, finish: { x: -0.25, y: -1.3 }, ms: 120 } },
  { id: 'read', kind: 'drill', name: 'READ IT', tip: 'anything, either side. move, turn the right way, go deep.', side: 0, feeds: ['drive', 'slice', 'heavy', 'lob', 'short', 'flat'], target: [-SINGLES, SINGLES, -HALF, -8.6], demo: { shot: 'THE RALLY BALL', why: 'read it early, get set, then topspin it deep through the middle. it buys you time.', pros: 'SINNER, DJOKOVIC', wing: 0, back: { x: 0.6, y: 0.85 }, finish: { x: -0.3, y: -1.3 }, ms: 120 } },
  { id: 'lob', kind: 'drill', name: 'LOB THE NET MAN', tip: 'he is on the net. soft, and push it way up.', side: 0, feeds: ['drive', 'slice', 'short'], target: [-SINGLES, SINGLES, -HALF, -7.0], netman: true, demo: { shot: 'TOPSPIN LOB', why: 'the net man covers the low ball. soft and steep goes over his racket and dives in.', pros: 'MURRAY, ALCARAZ', wing: 0, back: { x: 0.55, y: 0.8 }, finish: { x: 0, y: -1.75 }, ms: 420 } },
  { id: 'drop', kind: 'drill', name: 'DROP SHOT', tip: 'short feeds. pull back high, then barely nudge up: it should die before the service line.', side: 0, feeds: ['short', 'short', 'slice'], target: [-SINGLES, SINGLES, -4.6, -0.6], demo: { shot: 'DROP SHOT', why: 'when he is deep behind his baseline, the shortest ball wins: soft, heavy backspin, it sits down and dies.', pros: 'ALCARAZ, FEDERER', wing: 0, back: { x: 0.75, y: -0.45 }, finish: { x: 0, y: -0.8 }, ms: 300 } },
  { id: 'net', kind: 'drill', name: 'AT THE NET', tip: 'you start on the net. punch volleys deep, smash the lobs.', side: 0, feeds: ['drive', 'flat', 'slice', 'lob'], depth: { lob: [5.2, 7.2] }, target: [-SINGLES, SINGLES, -HALF, -7.5], start: 3.2, volley: true, demo: { shot: 'THE VOLLEY', why: 'no backswing: a short punch, the ball brings the pace. take it early, in front, and send it deep.', pros: 'FEDERER, EDBERG, MCENROE', wing: 0, back: { x: 0.55, y: 0.5 }, finish: { x: -0.2, y: -1.0 }, ms: 160 } },
  { id: 'bot1', kind: 'rally', level: 0, name: 'RALLY: ROOKIE BOT', tip: 'first to 7, win by 2. he misses when you move him.', demo: { shot: 'THE RALLY BALL', why: 'deep, through the middle, with margin. let him miss first.', pros: 'SINNER, DJOKOVIC', wing: 0, back: { x: 0.6, y: 0.85 }, finish: { x: -0.3, y: -1.3 }, ms: 120 } },
  { id: 'bot2', kind: 'rally', level: 1, name: 'RALLY: CLUB BOT', tip: 'first to 7, win by 2. faster, steadier, aims wider.', demo: { shot: 'THE RALLY BALL', why: 'deep, through the middle, with margin. let him miss first.', pros: 'SINNER, DJOKOVIC', wing: 0, back: { x: 0.6, y: 0.85 }, finish: { x: -0.3, y: -1.3 }, ms: 120 } },
  { id: 'bot3', kind: 'rally', level: 2, name: 'RALLY: PRO BOT', tip: 'first to 7, win by 2. good luck.', demo: { shot: 'THE RALLY BALL', why: 'deep, through the middle, with margin. let him miss first.', pros: 'SINNER, DJOKOVIC', wing: 0, back: { x: 0.6, y: 0.85 }, finish: { x: -0.3, y: -1.3 }, ms: 120 } },
];
const BOTS = [
  { speed: 4.6, err: 0.2, aim: [0.4, 2.6], feeds: ['drive', 'flat', 'slice'] },
  { speed: 5.6, err: 0.11, aim: [0.9, 3.3], feeds: ['drive', 'drive', 'slice', 'heavy', 'short', 'drop'] },
  { speed: 6.6, err: 0.05, aim: [1.5, 3.8], feeds: ['drive', 'heavy', 'heavy', 'slice', 'short', 'flat', 'drop'] },
];
const BALLS = 10;
const GAME = 7;
// Each feed: launch angle, spin (rad/s), and where it lands on the other side (depth from the net).
const FEEDS = {
  drive: { name: 'TOPSPIN', elev: 7, spin: 260, depth: [8.6, 10.8] },
  heavy: { name: 'HEAVY TOPSPIN', elev: 12, spin: 400, depth: [9.0, 11.0] },
  flat: { name: 'FLAT', elev: 4, spin: 50, depth: [8.4, 10.6] },
  slice: { name: 'SLICE', elev: 3, spin: -230, depth: [8.0, 10.2] },
  lob: { name: 'MOONBALL', elev: 50, spin: 140, depth: [9.6, 11.2] },
  short: { name: 'SHORT BALL', elev: 6, spin: 160, depth: [4.8, 6.2] },
  drop: { name: 'DROP SHOT', elev: 16, spin: -340, depth: [2.4, 4.4] },
};

// ---------- Renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.STILL });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(PAPER, 1);
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 2, 2000);
const side = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
// The main view sees the park's fences and props; the side-on view leaves them out so nothing stands behind the players.
camera.layers.enable(PROPS);
// A sunny afternoon at a park court (web/lib/park.js): blue sky light from above, green bounce from the grass, one warm sun.
scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x5d7f45, 1.1));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
scene.add(sun);
buildPark(scene, sun);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
const flat = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const rbox = (w, h, d, r, material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material);
const along = (m) => { m.rotation.z = Math.PI / 2; return m; };

// ---------- Court (real size) ----------
const ground = new THREE.Group();
scene.add(ground);
const surround = at(new THREE.Mesh(new THREE.PlaneGeometry(18.3, 36.6), mat(0x3f8f5a)), 0, 0, 0);
surround.receiveShadow = true;
surround.rotation.x = -Math.PI / 2;
ground.add(surround);
const court = at(new THREE.Mesh(new THREE.PlaneGeometry(DOUBLES * 2, HALF * 2), mat(BLUE)), 0, 0.002, 0);
court.receiveShadow = true;
court.rotation.x = -Math.PI / 2;
ground.add(court);
const lineMat = flat(0xfffdf0);
const line = (x0, z0, x1, z1, w = 0.05) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0) || w, Math.abs(z1 - z0) || w), lineMat);
  m.rotation.x = -Math.PI / 2;
  ground.add(at(m, (x0 + x1) / 2, 0.004, (z0 + z1) / 2));
};
for (const z of [-HALF, HALF]) line(-DOUBLES, z, DOUBLES, z, 0.1);
for (const x of [-DOUBLES, DOUBLES, -SINGLES, SINGLES]) line(x, -HALF, x, HALF);
for (const z of [-SERVICE, SERVICE]) line(-SINGLES, z, SINGLES, z);
line(0, -SERVICE, 0, SERVICE);
for (const z of [-HALF, HALF]) line(0, z - Math.sign(z) * 0.1, 0, z);

// Net: posts, a see-through mesh that sags to 0.914 in the middle, white tape on top.
{
  const net = new THREE.Group();
  const N = 24;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let k = 0; k <= N; k += 1) {
    const x = -6.4 + (12.8 * k) / N;
    pos.push(x, netH(x), 0, x, 0, 0);
    uv.push((k / N) * 300, 24, (k / N) * 300, 0);
  }
  for (let k = 0; k < N; k += 1) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x2 = c.getContext('2d');
  x2.strokeStyle = 'rgba(22,24,29,.85)';
  x2.lineWidth = 3;
  x2.strokeRect(0, 0, 32, 32);
  const meshTex = new THREE.CanvasTexture(c);
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
  net.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: meshTex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })));
  const tape = [];
  for (let k = 0; k <= N; k += 1) { const x = -6.4 + (12.8 * k) / N; tape.push(new THREE.Vector3(x, netH(x), 0)); }
  net.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tape), 48, 0.035, 6), flat(0xfffdf0)));
  for (const x of [-6.4, 6.4]) net.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.12, 10), mat(0x2b2f36)), x, 0.56, 0));
  scene.add(net);
}

// Target box: a cream wash with clay cones at its corners. It flashes clay when you hit it.
const target = new THREE.Group();
const targetWash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xfffdf0, transparent: true, opacity: 0.38, depthWrite: false }));
targetWash.rotation.x = -Math.PI / 2;
targetWash.position.y = 0.006;
target.add(targetWash);
const cones = [0, 1, 2, 3].map(() => {
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 14), mat(CLAY, { roughness: 0.6 }));
  target.add(c);
  return c;
});
scene.add(target);
let targetPulse = 0;
const setTarget = ([x0, x1, z0, z1]) => {
  targetWash.scale.set(x1 - x0, z1 - z0, 1);
  targetWash.position.set((x0 + x1) / 2, 0.006, (z0 + z1) / 2);
  [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(([x, z], k) => cones[k].position.set(x, 0.16, z));
};

// ---------- Ball, its shadow, its strobe, its marks ----------
const ballTex = (() => {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#d7f205';
  x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#fffdf0';
  x.lineWidth = 9;
  x.beginPath();
  for (let u = 0; u <= 256; u += 4) { const y = 64 + 34 * Math.sin((u / 256) * Math.PI * 4); if (u) x.lineTo(u, y); else x.moveTo(u, y); }
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
// Drawn at four times true size so you can see it at the far baseline on a phone.
const BALL_SHOW = 4;
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R * BALL_SHOW, 20, 14), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.7 }));
scene.add(ballMesh);
const shadowMat = new THREE.MeshBasicMaterial({ color: INKC, transparent: true, opacity: 0.28, depthWrite: false });
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(R * BALL_SHOW, 16), shadowMat);
ballShadow.rotation.x = -Math.PI / 2;
scene.add(ballShadow);
// The arc: a strobe of ghost balls, one every 4 steps (30 a second), so the whole flight stays drawn while you read it.
const GHOSTS = 100;
const ghostMat = new THREE.MeshBasicMaterial({ color: INKC, transparent: true, opacity: 0.55, depthWrite: false });
const ghosts = new THREE.InstancedMesh(new THREE.SphereGeometry(R * 1.8, 8, 6), ghostMat, GHOSTS);
ghosts.frustumCulled = false;
ghosts.count = 0;
scene.add(ghosts);
const trailPts = [];
let ghostTick = 0;
const ghostM = new THREE.Matrix4();
const marks = Array.from({ length: 10 }, () => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), new THREE.MeshBasicMaterial({ color: INKC, transparent: true, opacity: 0, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(1, 0.55, 1);
  scene.add(m);
  return { m, life: 0 };
});
let markAt = 0;
const mark = (x, z) => {
  const k = marks[markAt++ % marks.length];
  k.m.position.set(x, 0.007, z);
  k.life = 4;
};
const spinColor = (s) => (s > 40 ? CLAY : s < -40 ? BLUE : INKC);

// ---------- People: you, the robot, the net man ----------
/**
 * A player: legs on the ground group, a torso that turns, and a racket on a shoulder pivot that turns about y (0 points the
 * racket out to the player's right, pi/2 straight ahead, pi to the left). The head tilts about the racket's long axis: the face.
 */
function makePerson(color, racketColor = INKC) {
  const g = new THREE.Group();
  const torso = new THREE.Group();
  g.add(torso);
  const bodyMat = mat(color, { roughness: 0.55 });
  torso.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.55, 6, 14), bodyMat), 0, 1.08, 0));
  torso.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), mat(0xf1d9bf)), 0, 1.72, 0));
  // A visor so you can see which way he faces.
  torso.add(at(rbox(0.3, 0.06, 0.14, 0.02, mat(racketColor)), 0, 1.8, -0.15));
  for (const x of [-0.12, 0.12]) g.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), mat(0x2b2f36)), x, 0.38, 0));
  const swing = at(new THREE.Group(), 0, 1.15, 0);
  const racket = new THREE.Group();
  racket.add(along(at(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), mat(0xf1d9bf)), 0.26, 0, 0)));
  racket.add(along(at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), mat(racketColor)), 0.62, 0, 0)));
  const head = new THREE.Group();
  head.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 28), mat(racketColor, { roughness: 0.4 })));
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.155, 24), new THREE.MeshBasicMaterial({ color: 0xfffdf0, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  head.add(strings);
  head.scale.set(1.25, 1, 1);
  head.position.set(0.82, 0, 0);
  racket.add(head);
  swing.add(racket);
  g.add(swing);
  g.traverse((o) => { o.castShadow = true; });
  // The sun casts the real shadow; this soft contact patch just grounds the feet.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: INKC, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  g.add(shadow);
  scene.add(g);
  return { g, torso, swing, racket, strings, bodyMat };
}
const me = makePerson(CLAY);
const bot = makePerson(0x2b2f36, CLAY);
bot.g.rotation.y = Math.PI;
const netman = makePerson(0x2b2f36, CLAY);
netman.g.rotation.y = Math.PI;
netman.g.position.z = -2.6;
netman.swing.rotation.set(0, Math.PI / 2, 1.1);
const NM_REACH_Y = 2.85;
const NM_REACH_X = 1.5;
const NM_Z = -2.6;

// ---------- The machine ----------
const machine = new THREE.Group();
machine.add(at(rbox(0.7, 0.75, 0.7, 0.08, mat(0x2b2f36)), 0, 0.38, 0));
machine.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.26, 0.4, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xfffdf0, transparent: true, opacity: 0.4, side: THREE.DoubleSide })), 0, 0.95, 0));
for (let k = 0; k < 14; k += 1) {
  const a = k * 2.4;
  const rr = 0.08 + (k % 3) * 0.08;
  machine.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xd7f205)), Math.cos(a) * rr, 0.84 + (k % 4) * 0.05, Math.sin(a) * rr));
}
const mouth = at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 12), mat(CLAY)), 0, 0.6, 0.4);
mouth.rotation.x = Math.PI / 2 - 0.25;
machine.add(mouth);
machine.traverse((o) => { o.castShadow = true; });
scene.add(machine);
const M = { x: 0, yaw: 0, vyaw: 0, ty: 0, kick: 0, vkick: 0 };
const MOUTH_Y = 0.9;
const MACHINE_Z = -HALF - 0.9;

// ---------- State ----------
const HOME = HALF + 0.8;
const P = { x: 0, z: HOME, vx: 0, vz: 0, turn: 0, vturn: 0, swingT: -1, wing: 1, back: null, face: 'flat' };
const B = { x: 0, z: -HOME, vx: 0, vz: 0, tx: 0, tz: -HOME, plan: null, swingT: -1, wing: 1 };
let mode = 0;
let phase = 'wait'; // wait | play | dead | end
let balls = 0;
let points = 0;
let tally = { target: 0, in: 0, miss: 0 };
let score = [0, 0]; // you, bot
let rally = 0;
let bests = {};
let time = 0;
let nextAt = 1.2;
let finishAt = Infinity;
let ball = null; // { ...flight, owner: 'feed' | 'bot' | 'you', age, done }
let incoming = null; // what the last ball to you was, for the read
let shot = null;
let hits = 0;
const cur = () => MODES[mode];
const isRally = () => cur().kind === 'rally';

// ---------- Layout and cameras ----------
const L = { w: 1, h: 1, wide: false, mainW: 1, sideH: 0, top: 0, bottom: 0 };
const safe = { top: 0, bottom: 0 };
// How far you can run: a metre and a half past the singles lines, three metres behind the baseline.
const RUN_X = SINGLES + 1.5;
const RUN_Z = HALF + 2.8;
const fitPts = [
  // The far end: as far as the robot can run (same limits as you), head and racket included.
  [-RUN_X - 0.6, 0, -RUN_Z - 0.5], [RUN_X + 0.6, 0, -RUN_Z - 0.5], [-RUN_X - 0.6, 2.4, -RUN_Z - 0.5], [RUN_X + 0.6, 2.4, -RUN_Z - 0.5],
  // Your end: as far as you can run (P is clamped to these), at head height.
  [-RUN_X - 0.6, 0, RUN_Z + 0.5], [RUN_X + 0.6, 0, RUN_Z + 0.5], [0, 2.4, RUN_Z + 0.5], [-RUN_X - 0.6, 2.2, RUN_Z], [RUN_X + 0.6, 2.2, RUN_Z],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));
const v3 = new THREE.Vector3();

/**
 * Fit the court camera so every fit point lands inside the free band (below the card, above the thumbs). Measured: bisect the
 * distance until the points' spread fits the band, then shift the lens (an off-axis view offset) to centre them in it.
 */
function fitMain() {
  const aspect = L.mainW / L.h;
  camera.aspect = aspect;
  camera.clearViewOffset();
  // Low and behind you, like the TV angle: your end big, the far end small. Tall phones a little steeper so it all fits.
  const pitch = THREE.MathUtils.degToRad(aspect < 0.7 ? 40 : 30);
  const dir = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch));
  const topN = 1 - (2 * L.top) / L.h;
  const botN = -1 + (2 * L.bottom) / L.h;
  const look = new THREE.Vector3(0, 0, 1.2);
  const span = (d) => {
    camera.position.copy(look).addScaledVector(dir, -d);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of fitPts) {
      v3.copy(p).project(camera);
      x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x); y0 = Math.min(y0, v3.y); y1 = Math.max(y1, v3.y);
    }
    return { x0, x1, y0, y1 };
  };
  let lo = 5;
  let hi = 600;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const s = span(mid);
    if (s.x0 > -0.97 && s.x1 < 0.97 && s.y1 - s.y0 < topN - botN) hi = mid; else lo = mid;
  }
  const s = span(hi);
  const dy = (topN + botN) / 2 - (s.y1 + s.y0) / 2;
  camera.setViewOffset(L.mainW, L.h, 0, (dy * L.h) / 2, L.mainW, L.h);
}

function fitSide() {
  // Side-on, from your right: the whole court length, net in the middle. Heights are drawn 1.6x so a half-metre clearance reads.
  const w = L.w - L.mainW;
  const halfW = RUN_Z + 1.6; // out past where you can stand, body and racket included
  const halfH = (halfW * L.sideH) / w;
  side.left = -halfW; side.right = halfW;
  side.bottom = -0.05; side.top = 2 * halfH - 0.05;
  side.scale.set(1, 1 / 1.6, 1);
  side.position.set(30, 0, 0);
  // Start just outside the right-hand fence, so the near fence and the next court over never block the view.
  side.near = 30 - 8.9; // the fence is at 9.15
  side.far = 200;
  side.up.set(0, 1, 0);
  side.lookAt(0, 0, 0);
  side.updateProjectionMatrix();
}

function layout() {
  L.w = window.innerWidth;
  L.h = window.innerHeight;
  L.wide = L.w / L.h > 0.72 && L.w > 560;
  L.mainW = L.wide ? Math.round(L.w / 2) : L.w;
  // The side view shows the whole court length and about 5.5 m of height (heights drawn 1.6x): where the ball flies.
  L.sideH = Math.round(Math.min(L.h * 0.36, (L.w - L.mainW) * 0.27));
  document.body.style.setProperty('--sideh', `${L.sideH}px`);
  document.body.classList.toggle('wide', L.wide);
  safe.top = $('safe').offsetHeight;
  safe.bottom = $('safeb').offsetHeight;
  L.top = $('card').getBoundingClientRect().bottom + 14;
  // The thumbs live at the bottom: keep the court (and you on it) above them.
  L.bottom = safe.bottom + 2 * RAD + 30;
  renderer.setSize(L.w, L.h, false);
  ink.width = L.w * renderer.getPixelRatio();
  ink.height = L.h * renderer.getPixelRatio();
  fitMain();
  if (L.wide) fitSide();
  // Show-me steps sit just under the card on a phone (never over you), under the side view on a wide screen.
  const dm = $('demo').style;
  if (L.wide) { dm.top = `${safe.top + 12 + L.sideH + 10}px`; dm.left = `${L.mainW + 16}px`; dm.right = '16px'; }
  else { dm.top = `${$('card').getBoundingClientRect().bottom + 10}px`; dm.left = '12px'; dm.right = '12px'; }
}

// ---------- UI ----------
const ui = {
  label: $('lbl'), name: $('name'), tip: $('tip'), count: $('count'), read: $('read'), call: $('call'), callw: $('callw'),
  calls: $('calls'), hint: $('hint'), end: $('end'), feedread: $('feedread'), youread: $('youread'),
};
let callScale = 1;
let callV = 0;
let callLife = 0;

// ---------- Show me: the game plays the shot itself, slowed, with ghost thumbs and the steps spelled out ----------
const D = { on: false, plan: null, count: 0, pending: false, stopAt: Infinity };
const DEMO_BALLS = 3;
function startDemo() {
  D.on = true;
  D.count = 0;
  D.plan = null;
  D.pending = false;
  D.stopAt = Infinity;
  ball = null;
  phase = 'wait';
  nextAt = time + 0.6;
  finishAt = Infinity;
  ui.end.classList.remove('on');
  $('show').textContent = 'STOP';
  const d = cur().demo;
  ui.tip.textContent = `THE SHOT: ${d.shot}. ${d.why} USED BY ${d.pros}.`;
  caption('WATCH THE THUMBS. TOUCH A STICK TO TAKE OVER.');
}
function stopDemo() {
  if (!D.on) return;
  D.on = false;
  D.plan = null;
  sticks.L = null;
  sticks.R = null;
  SW.phase = 'idle';
  $('show').textContent = 'SHOW ME';
  ui.tip.textContent = cur().tip;
  caption('');
}
function caption(text) {
  $('demo').textContent = text;
  $('demo').classList.toggle('on', !!text);
  document.body.classList.toggle('demo', !!text);
}
/** A ball is coming in demo: plan where to stand, when to turn and when to swing. */
/** Where a volleyer at the net meets this ball: in the air, as it reaches him, between knee and above-head height. */
function findVolley(b0) {
  const sim = { ...b0, bounces: 0, netted: false };
  for (let t = 0; t < 4; t += DT) {
    const ev = stepBall(sim);
    if (ev === 'net' || sim.bounces > 0) return null;
    if (sim.z >= P.z - 0.3 && sim.y > 0.3 && sim.y < 2.9) return { t, x: sim.x, y: sim.y, z: sim.z };
  }
  return null;
}
function planDemo() {
  const c = (cur().volley && findVolley(ball)) || findContact(ball, 1, cur().id === 'drop');
  if (!c) { D.plan = null; return; }
  const d = cur().demo;
  const wing = d.wing || (c.x >= P.x ? 1 : -1);
  const m = (v) => ({ x: v.x * (d.wing ? 1 : wing), y: v.y });
  // Aim the finish at the middle of the target (or deep middle in a rally) from wherever the ball is taken:
  // readSwing turns a finish lean into heading = 0.55 * atan(x / up), so invert that.
  const t = cur().target || [-2, 2, -11, -8];
  const aimX = (t[0] + t[1]) / 2;
  const aimZ = (t[2] + t[3]) / 2;
  const h = clamp(Math.atan2(aimX - c.x, c.z - aimZ), -0.55, 0.55);
  const finish = m(d.finish);
  finish.x = clamp(Math.tan(h / 0.55) * -finish.y, -1.4, 1.4);
  D.plan = { c, wing, t0: time, back: m(d.back), finish, ms: d.ms, stage: 0, flickAt: 0 };
  caption(`1. READ IT. ${incoming ? incoming.replace('IT WAS: ', '') : ''}`);
}
const demoHome = (k) => ({ x: k === 'L' ? RAD + 34 : L.w - RAD - 34, y: L.h - safe.bottom - RAD - 34 });
const ghost = (k, n) => { const o = demoHome(k); sticks[k] = { id: -9, ox: o.x, oy: o.y, x: o.x + n.x * RAD, y: o.y + n.y * RAD }; };
function demoStep() {
  if (time >= D.stopAt) { D.stopAt = Infinity; stopDemo(); return; }
  if (D.pending && ball && ball.owner !== 'you') { D.pending = false; planDemo(); }
  const pl = D.plan;
  if (!pl) return;
  const el = time - pl.t0;
  const sx = pl.c.x - pl.wing * 0.85;
  const sz = pl.c.z + 0.3;
  // Move: the left ghost thumb steers toward the spot right up to contact, easing off as he arrives.
  if (pl.stage < 4) {
    const dx = sx - P.x;
    const dz = sz - P.z;
    const dist = Math.hypot(dx, dz);
    const k = Math.min(1, dist / 0.5);
    if (dist > 0.04 && el > Math.min(0.05, pl.c.t * 0.1)) ghost('L', { x: (dx / (dist || 1)) * k, y: (dz / (dist || 1)) * k }); else sticks.L = null;
    // The steps keep pace with the ball: at the net it arrives in under half a second.
    if (pl.stage === 0 && el > Math.min(0.35, pl.c.t * 0.2)) { pl.stage = 1; caption(`2. MOVE. get there early, an arm and a racket away from the ball, on your ${pl.wing > 0 ? 'forehand' : 'backhand'} side.`); }
  }
  // Turn: half a second out, pull the right thumb back. Its height sets the face.
  if (pl.stage === 1 && el >= pl.c.t - 0.55) {
    pl.stage = 2;
    ghost('R', pl.back);
    SW.phase = 'back'; SW.wing = pl.wing; SW.back = { ...pl.back };
    const f = faceOf(pl.back);
    caption(`3. TURN. pull the right thumb back ${pl.wing > 0 ? 'right' : 'left'} and ${f === 'topspin' ? 'low: closed face, topspin' : f === 'slice' ? 'high: open face, slice' : 'level: flat'}.`);
  }
  // Swing: flick it up through the middle to the finish.
  if (pl.stage === 2 && el >= pl.c.t - 0.03 - pl.ms / 1000) {
    pl.stage = 3;
    pl.flickAt = time;
    const fx = pl.finish.x * pl.wing;
    caption(`4. SWING. flick up${pl.finish.y < -1.6 ? ', soft and way up: a lob' : fx < -0.2 ? ', finish across you: crosscourt' : ', finish out to the side: down the line'}.`);
  }
  if (pl.stage === 3) {
    const u = clamp((time - pl.flickAt) / (pl.ms / 1000), 0, 1);
    ghost('R', { x: lerp(pl.back.x, pl.finish.x, u), y: lerp(pl.back.y, pl.finish.y, u) });
    if (u >= 1) {
      pl.stage = 4;
      sticks.L = null;
      SW.phase = 'idle';
      const len = Math.hypot(pl.finish.x - pl.back.x, pl.finish.y - pl.back.y);
      swing(readSwing(pl.back, pl.finish, len / (pl.ms / 1000), pl.wing));
    }
  }
  if (pl.stage === 4 && time - pl.flickAt > 0.6) { sticks.R = null; D.plan = null; }
}

function showMode() {
  const m = cur();
  ui.label.textContent = `${m.kind === 'rally' ? 'RALLY' : 'DRILL'} ${mode + 1} OF ${MODES.length} · TAP TO CHANGE`;
  ui.name.textContent = m.name;
  ui.tip.textContent = m.tip;
  target.visible = m.kind === 'drill';
  if (m.kind === 'drill') setTarget(m.target);
  netman.g.visible = !!m.netman;
  machine.visible = m.kind === 'drill';
  bot.g.visible = m.kind === 'rally';
  showCount();
}
function showCount() {
  const m = cur();
  const best = bests[m.id];
  if (m.kind === 'rally') ui.count.textContent = `YOU ${score[0]} · BOT ${score[1]}${best ? ` · WINS ${best}` : ''}`;
  else ui.count.textContent = `BALL ${Math.min(balls + 1, BALLS)} OF ${BALLS} · ${points} PTS${best != null ? ` · BEST ${best}` : ''}`;
}
function stamp(word, sub = '', tone = '') {
  ui.callw.textContent = word;
  ui.calls.textContent = sub;
  ui.call.className = `on ${tone}`;
  callScale = 1.25;
  callV = 0;
  callLife = 1.6;
}
function startMode(k) {
  stopDemo();
  mode = (k + MODES.length) % MODES.length;
  balls = 0;
  points = 0;
  tally = { target: 0, in: 0, miss: 0 };
  score = [0, 0];
  phase = 'wait';
  nextAt = time + 1.0;
  finishAt = Infinity;
  ball = null;
  shot = null;
  trailPts.length = 0;
  Object.assign(P, { x: 0, z: cur().start || HOME, vx: 0, vz: 0 });
  Object.assign(B, { x: 0, z: -HOME, vx: 0, vz: 0, tx: 0, tz: -HOME, plan: null });
  ui.end.classList.remove('on');
  showMode();
}
$('show').addEventListener('click', () => { post({ type: 'pick' }); if (D.on) stopDemo(); else startDemo(); });
$('card').addEventListener('click', (e) => { if (e.target.closest('#bk') || e.target.closest('#show')) return; post({ type: 'pick' }); startMode(mode + 1); });
$('card').addEventListener('pointerdown', (e) => { if (!e.target.closest('#bk') && !e.target.closest('#show')) $('card').classList.add('press'); });
// Back: the pill sinks onto its shadow, then the app goes back.
$('bk').addEventListener('pointerdown', () => $('bk').classList.add('press'));
$('bk').addEventListener('click', () => { post({ type: 'back' }); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  $('card').addEventListener(ev, () => $('card').classList.remove('press'));
  $('bk').addEventListener(ev, () => $('bk').classList.remove('press'));
}
$('again').addEventListener('click', (e) => { e.stopPropagation(); post({ type: 'pick' }); startMode(mode); });
$('next').addEventListener('click', (e) => { e.stopPropagation(); post({ type: 'pick' }); startMode(mode + 1); });

// ---------- Reading a ball ahead ----------
/**
 * Where a player on `sideSign` (+1 your half, -1 the far half) would take this ball: after its first bounce on that side,
 * the point nearest 1 m high, ideally before backing past 15.4 m. Null if it never comes down on that side in play.
 */
function findContact(b0, sideSign, early = false) {
  const sim = { ...b0, bounces: 0, netted: false };
  let best = null;
  let bestScore = Infinity;
  for (let t = 0; t < 5; t += DT) {
    const ev = stepBall(sim);
    if (ev === 'net' || sim.bounces >= 2 || Math.abs(sim.z) > 16.5) break;
    if (sim.bounces === 1 && Math.sign(sim.z) === sideSign) {
      const d = Math.abs(sim.z);
      if (d > 0.8 && d < 15.4 && sim.y < 2.7) {
        const sc = Math.abs(sim.y - 1.0) + (sim.y > 1.6 ? (sim.y - 1.6) * 2 : 0);
        // Early: take it on the rise, the first moment it is up past 0.6 m (moving in on a short ball).
        if (early && sim.y >= 0.6 && sim.vy > 0) return { t, x: sim.x, y: sim.y, z: sim.z };
        if (sc < bestScore - 1e-3) { bestScore = sc; best = { t, x: sim.x, y: sim.y, z: sim.z }; }
      }
    }
  }
  return best;
}
/** The call on your side of the net: IN, LONG or WIDE. */
const callNear = (x, z) => (z > HALF + R ? 'LONG' : Math.abs(x) > SINGLES + R ? 'WIDE' : 'IN');

function describeBall(b, from) {
  const type = b.type ? FEEDS[b.type].name : b.s > 300 ? 'HEAVY TOPSPIN' : b.s > 40 ? 'TOPSPIN' : b.s < -40 ? 'SLICE' : 'FLAT';
  const land = firstLanding(b);
  const wing = land.x >= P.x ? 'FOREHAND' : 'BACKHAND';
  return `${from}: ${type} ${rpm(b.s)} RPM, ${kmh(Math.hypot(b.vx, b.vy, b.vz))} KM/H, ${land.z > 7.5 ? 'DEEP' : 'SHORT'} TO YOUR ${wing}`;
}

// ---------- Machine and robot feeding ----------
function setBall(b, owner) {
  ball = { ...b, owner, age: 0, done: false, nm: false };
  if (D.on && owner !== 'you') D.pending = true;
  trailPts.length = 0;
  ghostMat.color.setHex(spinColor(b.s));
}

function machineFeed() {
  const m = cur();
  const type = pick(m.feeds);
  const f = FEEDS[type];
  const wing = m.side || pick([1, -1]);
  const tx = clamp(P.x + wing * rand(1.0, 2.6), -SINGLES + 0.4, SINGLES - 0.4);
  const dr = (m.depth && m.depth[type]) || f.depth;
  const tz = rand(dr[0], dr[1]);
  M.x = rand(-1.2, 1.2);
  const b = solveLaunch({ x: M.x, y: MOUTH_Y, z: MACHINE_Z + 0.4 }, { x: tx, z: tz }, f.elev, f.spin);
  b.type = type;
  setBall(b, 'feed');
  incoming = describeBall(b, 'IT WAS');
  M.ty = Math.atan2(tx - M.x, tz - MACHINE_Z);
  M.vkick = -1.6;
  post({ type: 'feed' });
}

/** The robot hits from (x, y, z): picks a shot by level, and sometimes misses (more often when stretched or rushed). */
function botHit(from, stretch, pace) {
  const lv = BOTS[cur().level];
  let type = pick(lv.feeds);
  if (P.z < 7.5 && Math.random() < 0.5) type = 'lob';
  const f = FEEDS[type];
  const away = P.x > 0 ? -1 : 1;
  const wide = rand(lv.aim[0], lv.aim[1]);
  let tx = Math.random() < 0.7 ? away * wide : -away * wide;
  let tz = rand(f.depth[0], f.depth[1]);
  const pErr = lv.err + 0.3 * stretch + (pace > 30 ? 0.1 : 0) + (pace > 38 ? 0.1 : 0);
  let netErr = false;
  if (Math.random() < pErr) {
    const kind = pick(['long', 'wide', 'net']);
    if (kind === 'long') tz = rand(12.3, 13.5);
    else if (kind === 'wide') tx = Math.sign(tx || 1) * rand(4.5, 5.4);
    else netErr = true;
  }
  const b = solveLaunch(from, { x: tx, z: tz }, f.elev, f.spin);
  if (netErr) b.vy -= 2.2;
  b.type = type;
  setBall(b, 'bot');
  incoming = describeBall(b, 'IT WAS');
  B.swingT = 0;
  B.wing = from.x < B.x ? 1 : -1;
  B.plan = null;
  B.tx = 0;
  B.tz = -HOME;
  post({ type: 'feed' });
}

function botServe() {
  B.x = rand(-1, 1);
  botHit({ x: B.x - 0.6, y: 1.0, z: -HALF - 0.3 }, 0, 0);
}

/** On your contact in a rally: where can the robot take it, and can it get there in time? */
function planBot() {
  const c = findContact(ball, -1);
  const land = firstLanding(ball);
  if (!c || land.net || call(land.x, land.z) !== 'IN') { B.plan = null; return; }
  const wing = c.x < B.x ? 1 : -1; // facing you, his forehand is on your left
  const sx = c.x + wing * 0.8;
  const sz = c.z - 0.3;
  const need = Math.hypot(sx - B.x, sz - B.z) / BOTS[cur().level].speed + 0.25;
  B.plan = { t: c.t, x: c.x, y: c.y, z: c.z, reach: need <= c.t + 0.05, stretch: clamp(need / Math.max(0.3, c.t), 0, 1) };
  B.tx = clamp(sx, -RUN_X, RUN_X);
  B.tz = clamp(sz, -RUN_Z, -1);
}

// ---------- Sticks ----------
const ink = $('ink');
const ictx = ink.getContext('2d');
const RAD = 56;
const sticks = { L: null, R: null };
// The swing: idle -> back (pulled, turned) -> fwd (flicking up) -> idle.
const SW = { phase: 'idle', wing: 1, back: { x: 0, y: 0 }, backAt: 0, peak: 0 };

function stickPos(s) {
  return { x: (s.x - s.ox) / RAD, y: (s.y - s.oy) / RAD };
}
function onDown(e) {
  if (ui.end.classList.contains('on')) return;
  if (e.target.closest && e.target.closest('#card')) return;
  // Touching a stick takes over from show-me.
  if (D.on) stopDemo();
  const k = e.clientX < L.w / 2 ? 'L' : 'R';
  if (sticks[k]) return;
  sticks[k] = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
}
function onMove(e) {
  for (const k of ['L', 'R']) {
    const s = sticks[k];
    if (!s || s.id !== e.pointerId) continue;
    s.x = e.clientX;
    s.y = e.clientY;
    if (k === 'R') swingInput(stickPos(s), performance.now() / 1000, false);
  }
}
function onUp(e) {
  for (const k of ['L', 'R']) {
    const s = sticks[k];
    if (!s || s.id !== e.pointerId) continue;
    if (k === 'R') swingInput(stickPos(s), performance.now() / 1000, true);
    sticks[k] = null;
  }
}
addEventListener('pointerdown', onDown);
addEventListener('pointermove', onMove);
addEventListener('pointerup', onUp);
addEventListener('pointercancel', onUp);

/**
 * Right stick, every move. Pulled past half a radius (not upward): take-back. While back, the deepest point is the take-back.
 * Then up past the middle: the swing is on; it lets go when the thumb stops climbing, lifts, or reaches 1.9 radii.
 */
function swingInput(n, now, lifted) {
  const d = Math.hypot(n.x, n.y);
  if (SW.phase === 'idle') {
    if (!lifted && d > 0.45 && n.y > -0.2) {
      SW.phase = 'back';
      SW.wing = Math.abs(n.x) > 0.15 ? Math.sign(n.x) : ball && ball.x < P.x ? -1 : 1;
      SW.back = { ...n };
      SW.backAt = now;
    }
    return;
  }
  if (SW.phase === 'back') {
    if (lifted) { SW.phase = 'idle'; ui.read.classList.remove('on'); return; }
    if (n.y > -0.05) {
      if (Math.abs(n.x) > 0.25) SW.wing = Math.sign(n.x);
      if (d >= Math.hypot(SW.back.x, SW.back.y) - 0.08) { SW.back = { ...n }; SW.backAt = now; }
      ui.read.textContent = `${SW.wing > 0 ? 'FOREHAND' : 'BACKHAND'} · ${faceOf(SW.back).toUpperCase()}`;
      ui.read.classList.add('on');
      return;
    }
    SW.phase = 'fwd';
    SW.peak = -n.y;
    SW.last = { n, now };
    return;
  }
  if (SW.phase === 'fwd') {
    const climbing = -n.y > SW.peak + 0.01;
    if (climbing) SW.peak = -n.y;
    const rate = SW.last ? (SW.last.n.y - n.y) / Math.max(1e-3, now - SW.last.now) : 10;
    SW.last = { n, now };
    if (lifted || -n.y >= 1.9 || (!climbing && rate < 1.5)) letGo(n, now);
  }
}
/** The flick is over: read it and swing. Also called when the thumb sits still mid-flick (no move events come then). */
function letGo(n, now) {
  const v = Math.hypot(n.x - SW.back.x, n.y - SW.back.y) / Math.max(0.04, now - SW.backAt);
  SW.phase = 'idle';
  ui.read.classList.remove('on');
  swing(readSwing(SW.back, n, v, SW.wing));
}

// ---------- Your contact ----------
function swing(stroke) {
  P.swingT = 0;
  P.wing = stroke.wing;
  if (!ball || ball.done || ball.owner === 'you') return;
  // Look 0.15 s ahead for the ball passing through the zone: an arm and a racket out on the wing, a step in front.
  const sim = { ...ball };
  let best = null;
  for (let k = 0; k <= 18; k += 1) {
    const zx = P.x + stroke.wing * 0.85;
    const zz = P.z - 0.3;
    const d = Math.hypot(sim.x - zx, sim.z - zz);
    // Up to 3 m: anything higher than 2.1 is taken overhead, a smash.
    if (sim.y > 0.1 && sim.y < 3.0 && d < 1.25 && (!best || d < best.d)) best = { d, b: { ...sim }, zz };
    stepBall(sim);
  }
  if (!best) { stamp('WHIFF', 'move to it, and turn to the side it is on', 'bad'); return; }
  const dt = clamp((best.b.z - best.zz) / Math.max(4, best.b.vz), -0.3, 0.3);
  const q = 1 - best.d / 1.25;
  const b = best.b;
  // Before it bounces on your side it is a volley (a punch); above 2.1 m it is a smash (hit down, hard).
  const isVolley = b.bounces === 0 && b.z > 0;
  const isSmash = b.y > 2.1 && !stroke.lob && !stroke.drop;
  let st = isVolley && !isSmash ? volley(stroke, Math.hypot(b.vx, b.vy, b.vz)) : stroke;
  // A low volley: you open the face to lift it over the net (up to 6 more degrees below 1 m).
  if (isVolley && !isSmash && !st.lob) st = { ...st, elev: st.elev + clamp((1.0 - b.y) * 8, 0, 6) };
  const hit = strike(st, dt, 0.35 + 0.65 * q);
  const ux = Math.sin(hit.heading);
  const uz = -Math.cos(hit.heading);
  const e = THREE.MathUtils.degToRad(hit.elev);
  let nb = {
    x: b.x, y: Math.max(b.y, 0.35), z: b.z, vx: hit.speed * Math.cos(e) * ux, vy: hit.speed * Math.sin(e), vz: hit.speed * Math.cos(e) * uz,
    s: hit.spin, ax: uz, az: -ux, bounces: 0,
  };
  if (st.drop && !isSmash && hit.timing !== 'FRAMED') {
    // Touch: the right pace for a drop depends on where you hit it from, so the swing sets how far past the net it lands
    // (2 to 4 m, a drop volley 1.4 to 2.6 m) and the contact sets the error: off centre falls shorter, and very off finds the net.
    const k = clamp(st.v / 7, 0, 1);
    const tz = -(isVolley ? 1.4 + 1.2 * k : 2.0 + 2.0 * k) + (1 - q) * 1.6;
    nb = solveLaunch({ x: b.x, y: Math.max(b.y, 0.35), z: b.z }, { x: clamp(b.x + Math.tan(hit.heading) * (b.z - tz), -SINGLES - 0.3, SINGLES + 0.3), z: Math.min(tz, -0.3) }, 20, -340);
    if (q < 0.35) nb.vy *= 0.8;
    hit.speed = Math.hypot(nb.vx, nb.vy, nb.vz);
  }
  if (isSmash) {
    // Down into the far court along the aim, deep; off centre it lands shorter and wider.
    const tz = -8.8 + (1 - q) * 3;
    nb = solveLaunch({ x: b.x, y: b.y, z: b.z }, { x: clamp(b.x + Math.tan(hit.heading) * (b.z - tz), -SINGLES - 0.5, SINGLES + 0.5), z: tz }, -6, 40);
    hit.speed = Math.hypot(nb.vx, nb.vy, nb.vz);
  }
  setBall(nb, 'you');
  const kind = isSmash ? 'SMASH' : isVolley ? (st.drop ? 'DROP VOLLEY' : st.lob ? 'LOB VOLLEY' : 'VOLLEY') : st.drop ? 'DROP SHOT' : st.lob ? 'LOB' : st.spinKind.toUpperCase();
  shot = { stroke: st, hit, q, kind };
  hits += 1;
  rally += 1;
  if (hits === 4) { ui.hint.classList.add('done'); setTimeout(layout, 520); }
  if (isRally()) planBot();
  post({ type: 'hit', q: hit.timing === 'ON TIME' && q > 0.6 ? 1 : hit.timing === 'FRAMED' ? 0.2 : 0.6 });
}

const youText = () => {
  if (!shot) return 'NO SWING';
  const { stroke: s, hit, q } = shot;
  return `${shot.kind === 'SMASH' ? 'OVERHEAD' : s.wing > 0 ? 'FOREHAND' : 'BACKHAND'}, ${shot.kind}, ${kmh(hit.speed)} KM/H, ${hit.timing}${q < 0.4 ? ', OFF CENTRE' : ''}`;
};

// ---------- Results ----------
function drillResult(word, pts, tone, sub) {
  if (D.on) { demoResult(word, tone, sub); return; }
  points += pts;
  if (word === 'TARGET') tally.target += 1;
  else if (pts > 0) tally.in += 1;
  else tally.miss += 1;
  balls += 1;
  readout();
  stamp(word, L.wide ? sub || '' : [sub, incoming].filter(Boolean).join('\n'), tone);
  endBall(L.wide ? 1.5 : 2.0);
  if (balls >= BALLS) finishAt = time + 1.3;
}
/** In show-me nothing counts: call it, then the next ball, three of them, then hand it back. */
function demoResult(word, tone, sub) {
  readout();
  stamp(word, sub || '', tone);
  endBall(2.2);
  D.count += 1;
  if (D.count >= DEMO_BALLS) D.stopAt = time + 1.8;
}
function rallyPoint(youWon, word, sub) {
  if (D.on) { demoResult(word, youWon ? 'hot' : 'bad', sub); return; }
  score[youWon ? 0 : 1] += 1;
  readout();
  const r = rally > 2 ? `RALLY ${rally}. ` : '';
  stamp(word, `${r}${sub || ''}${L.wide ? '' : incoming ? `\n${incoming}` : ''}`, youWon ? 'hot' : 'bad');
  post({ type: youWon ? 'target' : 'miss' });
  endBall(2.0);
  const [a, b] = score;
  if ((a >= GAME || b >= GAME) && Math.abs(a - b) >= 2) finishAt = time + 1.4;
}
function readout() {
  ui.feedread.textContent = incoming ? incoming.replace('IT WAS: ', '') : '';
  ui.youread.textContent = youText();
  showCount();
}
function endBall(wait) {
  if (ball) ball.done = true;
  phase = 'dead';
  nextAt = time + wait;
}

function finish() {
  phase = 'end';
  const m = cur();
  const prev = bests[m.id];
  if (m.kind === 'rally') {
    const won = score[0] > score[1];
    const wins = (prev || 0) + (won ? 1 : 0);
    if (won) bests[m.id] = wins;
    $('score').textContent = `${score[0]}-${score[1]}`;
    $('of').textContent = '';
    $('tally').textContent = won ? 'YOU BEAT THE BOT' : 'THE BOT WINS';
    $('best').textContent = wins ? `WINS VS THIS BOT: ${wins}` : 'NO WINS YET';
    post({ type: 'drill', id: m.id, points: wins, best: won });
  } else {
    const isBest = prev == null || points > prev;
    if (isBest) bests[m.id] = points;
    $('score').textContent = `${points}`;
    $('of').textContent = `/ ${BALLS * 2}`;
    $('tally').textContent = `${tally.target} TARGET · ${tally.in} IN · ${tally.miss} MISSED`;
    $('best').textContent = isBest ? (prev == null ? 'FIRST SCORE' : `NEW BEST. WAS ${prev}`) : `BEST ${prev}`;
    post({ type: 'drill', id: m.id, points, best: isBest });
  }
  $('endname').textContent = m.name;
  ui.end.classList.add('on');
}

// ---------- Simulation ----------
function step(dt) {
  time += dt;
  if (phase === 'wait' && time >= nextAt) {
    phase = 'play';
    rally = 0;
    shot = null;
    if (isRally()) botServe(); else machineFeed();
  }
  if (phase === 'dead' && time >= nextAt && finishAt === Infinity) {
    phase = 'wait';
    nextAt = time + 0.1;
    if (isRally()) { Object.assign(P, { x: 0, z: HOME, vx: 0, vz: 0 }); Object.assign(B, { x: 0, z: -HOME, tx: 0, tz: -HOME, plan: null }); }
  }
  if (time >= finishAt) { finishAt = Infinity; finish(); }

  if (SW.phase === 'fwd' && SW.last && performance.now() / 1000 - SW.last.now > 0.06) letGo(SW.last.n, SW.last.now);
  if (ball) stepLive(dt);

  if (D.on) demoStep();
  // You: the left stick sets the run, up to 6.2 m/s; you reach it at 10 /s. Stay on your half.
  const ls = sticks.L ? stickPos(sticks.L) : { x: 0, y: 0 };
  const lm = Math.min(1, Math.hypot(ls.x, ls.y));
  const la = Math.atan2(ls.y, ls.x);
  const tvx = lm > 0.12 ? Math.cos(la) * lm * 6.2 : 0;
  const tvz = lm > 0.12 ? Math.sin(la) * lm * 6.2 : 0;
  P.vx += (tvx - P.vx) * Math.min(1, dt * 10);
  P.vz += (tvz - P.vz) * Math.min(1, dt * 10);
  P.x = clamp(P.x + P.vx * dt, -RUN_X, RUN_X);
  P.z = clamp(P.z + P.vz * dt, 0.6, RUN_Z);
  // Body turn: shoulders round to the wing while the racket is back, square again after.
  const turnTo = SW.phase !== 'idle' ? -SW.wing * 1.15 : P.swingT >= 0 && P.swingT < 0.3 ? -P.wing * 0.3 : 0;
  const tw = 2 * Math.PI * 9;
  P.vturn += (tw * tw * (turnTo - P.turn) - 2 * 0.8 * tw * P.vturn) * dt;
  P.turn += P.vturn * dt;
  if (P.swingT >= 0) { P.swingT += dt; if (P.swingT > 0.6) P.swingT = -1; }

  // Robot: run to the plan, or recover to the middle.
  const lv = BOTS[cur().level] || BOTS[0];
  const bw = 2 * Math.PI * 5;
  B.vx += (bw * bw * (B.tx - B.x) - 2 * bw * B.vx) * dt;
  B.vz += (bw * bw * (B.tz - B.z) - 2 * bw * B.vz) * dt;
  const bs = Math.hypot(B.vx, B.vz);
  if (bs > lv.speed) { B.vx *= lv.speed / bs; B.vz *= lv.speed / bs; }
  B.x = clamp(B.x + B.vx * dt, -RUN_X, RUN_X);
  B.z = clamp(B.z + B.vz * dt, -RUN_Z, -1);
  if (B.swingT >= 0) { B.swingT += dt; if (B.swingT > 0.6) B.swingT = -1; }

  if (cur().netman) netman.g.position.x += ((ball ? ball.x * 0.5 : 0) - netman.g.position.x) * Math.min(1, dt * 3);

  const mw = 2 * Math.PI * 6;
  M.vyaw += (mw * mw * (M.ty - M.yaw) - 2 * mw * M.vyaw) * dt;
  M.yaw += M.vyaw * dt;
  const kw = 2 * Math.PI * 5;
  M.vkick += (kw * kw * (0 - M.kick) - 2 * 0.4 * kw * M.vkick) * dt;
  M.kick += M.vkick * dt;

  for (const k of marks) if (k.life > 0) k.life -= dt;
  targetPulse = Math.max(0, targetPulse - dt * 1.4);
  const cw = 2 * Math.PI * 9;
  callV += (cw * cw * (1 - callScale) - 2 * 0.55 * cw * callV) * dt;
  callScale += callV * dt;
  if (callLife > 0) { callLife -= dt; if (callLife <= 0) ui.call.classList.remove('on'); }
}

/** The live ball: fly it, and call what happens. */
function stepLive(dt) {
  const pz = ball.z;
  const ev = stepBall(ball, dt);
  ball.age += dt;
  if ((ghostTick += 1) % 4 === 0) { trailPts.push(ball.x, ball.y, ball.z); if (trailPts.length > GHOSTS * 3) trailPts.splice(0, 3); }
  if (ev === 'bounce') { mark(ball.x, ball.z); post({ type: 'bounce', v: clamp(Math.abs(ball.vy) / 8, 0.1, 1) }); }
  if (ev === 'net') post({ type: 'net' });
  const gone = Math.abs(ball.z) > 17 || Math.abs(ball.x) > 14;
  if (!ball.done) {
    const rallyMode = isRally();
    if (ball.owner === 'you') {
      if (cur().netman && !ball.nm && pz > NM_Z && ball.z <= NM_Z) {
        ball.nm = true;
        if (Math.abs(ball.x - netman.g.position.x) < NM_REACH_X && ball.y < NM_REACH_Y) {
          Object.assign(ball, { vz: 12, vy: 2, vx: ball.vx * -0.3, s: -80, owner: 'gone' });
          post({ type: 'miss' });
          drillResult('PICKED OFF', 0, 'bad', 'lob it higher, over his racket');
          return;
        }
      }
      if (ev === 'net') {
        if (rallyMode) rallyPoint(false, 'NET', 'more height: push further up');
        else drillResult('NET', 0, 'bad', 'more height: push further up');
      } else if (ev === 'bounce' && ball.bounces === 1) {
        // Landing on your own side: it never reached the net.
        const c = ball.z > 0 ? 'SHORT' : call(ball.x, ball.z);
        if (rallyMode) {
          if (c !== 'IN') rallyPoint(false, c, c === 'LONG' ? 'too hard: pull lower for topspin' : c === 'SHORT' ? 'it never reached the net: a bit more' : 'aim it in');
        } else {
          const [x0, x1, z0, z1] = cur().target;
          if (c === 'IN' && ball.x >= x0 && ball.x <= x1 && ball.z >= z0 - R && ball.z <= z1) {
            targetPulse = 1;
            post({ type: 'target' });
            drillResult('TARGET', 2, 'hot', '+2');
          } else if (c === 'IN') drillResult('IN', 1, '', '+1, now find the box');
          else { post({ type: 'miss' }); drillResult(c, 0, 'bad', c === 'LONG' ? 'too hard: pull lower for topspin, or finish lower' : c === 'SHORT' ? 'it never reached the net: a bit more, or move in first' : 'aim it in: finish less wide'); }
        }
      } else if (rallyMode && B.plan && B.plan.reach && ball.age >= B.plan.t) {
        botHit({ x: ball.x, y: ball.y, z: ball.z }, B.plan.stretch, shot ? shot.hit.speed : 20);
      } else if (rallyMode && (ball.bounces >= 2 || gone)) rallyPoint(true, 'WINNER', B.plan && !B.plan.reach ? 'he could not get there' : '');
    } else if (ball.owner === 'feed' || ball.owner === 'bot') {
      if (ev === 'net') {
        if (rallyMode) rallyPoint(true, 'BOT NETTED', '');
        else endBall(0.6);
      } else if (ev === 'bounce' && ball.bounces === 1 && ball.z > 0 && callNear(ball.x, ball.z) !== 'IN') {
        if (rallyMode) rallyPoint(true, `BOT ${callNear(ball.x, ball.z)}`, 'leave those');
        else endBall(0.6);
      } else if ((ball.bounces >= 2 && ball.z > 0) || ball.z > 16.5) {
        shot = null;
        if (rallyMode) rallyPoint(false, 'MISSED', 'get there earlier: move first, then swing');
        else { post({ type: 'miss' }); drillResult('MISSED', 0, 'bad', 'move to it, turn, then swing'); }
      }
    }
  }
  if (gone || (ball.done && time > nextAt + 0.5)) ball = null;
}

// ---------- Pose and draw ----------
/** The racket's turn about y for a swing `t` seconds in (or the pulled-back hold when t < 0 and `held`). */
function racketAngle(t, wing, held, pull) {
  const ready = Math.PI / 2;
  const back = wing > 0 ? -1.2 : Math.PI + 1.2;
  const thru = wing > 0 ? 2.6 : Math.PI - 2.6;
  if (held) return lerp(ready, back, clamp(pull, 0, 1));
  if (t < 0) return ready;
  if (t < 0.2) return lerp(back, thru, t / 0.2);
  return lerp(thru, ready, Math.min(1, (t - 0.2) / 0.33));
}
const FACE_TILT = { topspin: -0.45, flat: 0, slice: 0.55 };

function pose() {
  if (ball) {
    ballMesh.visible = ballShadow.visible = true;
    ballMesh.position.set(ball.x, ball.y + R * (BALL_SHOW - 1), ball.z);
    ballMesh.rotateOnWorldAxis(v3.set(ball.ax, 0, ball.az), ball.s * (1 / 60) * 0.05);
    ballShadow.position.set(ball.x, 0.008, ball.z);
  } else {
    ballMesh.visible = ballShadow.visible = false;
  }
  ghosts.count = trailPts.length / 3;
  for (let k = 0; k < ghosts.count; k += 1) ghosts.setMatrixAt(k, ghostM.makeTranslation(trailPts[k * 3], trailPts[k * 3 + 1], trailPts[k * 3 + 2]));
  ghosts.instanceMatrix.needsUpdate = true;
  for (const k of marks) k.m.material.opacity = clamp(k.life / 4, 0, 1) * 0.35;

  me.g.position.set(P.x, 0, P.z);
  me.torso.rotation.y = P.turn;
  const held = SW.phase === 'back';
  const pull = held ? Math.hypot(SW.back.x, SW.back.y) : 0;
  me.swing.rotation.y = racketAngle(P.swingT, held ? SW.wing : P.wing, held, pull);
  // The face: tilt about the racket's long axis, and the racket head drops for a low take-back.
  const face = held ? faceOf(SW.back) : 'flat';
  me.racket.rotation.x = lerp(me.racket.rotation.x, FACE_TILT[face] * (SW.wing || 1), 0.3);
  me.swing.rotation.z = held ? clamp(-SW.back.y * 0.45, -0.5, 0.5) : 0;
  me.strings.material.color.setHex(held ? spinColor(face === 'topspin' ? 100 : face === 'slice' ? -100 : 0) : 0xfffdf0);

  bot.g.position.set(B.x, 0, B.z);
  bot.swing.rotation.y = racketAngle(B.swingT, B.wing, false, 0);

  machine.position.set(M.x, 0, MACHINE_Z - M.kick * 0.06);
  machine.rotation.y = M.yaw;

  const pulse = 1 + 0.35 * Math.sin(targetPulse * Math.PI);
  for (const c of cones) c.scale.setScalar(pulse);
  targetWash.material.opacity = 0.38 + 0.4 * targetPulse;
  targetWash.material.color.setHex(targetPulse > 0 ? CLAY : 0xfffdf0);

  ui.call.style.transform = `translate(-50%,0) scale(${callScale.toFixed(3)})`;
}

/** The two sticks, drawn where the thumbs are (faint at their home spots when nobody is touching). */
function drawSticks() {
  const pr = renderer.getPixelRatio();
  ictx.setTransform(pr, 0, 0, pr, 0, 0);
  ictx.clearRect(0, 0, L.w, L.h);
  const homeY = L.h - safe.bottom - RAD - 34;
  const homes = { L: { x: RAD + 34, y: homeY }, R: { x: L.w - RAD - 34, y: homeY } };
  for (const k of ['L', 'R']) {
    const s = sticks[k];
    const o = s ? { x: s.ox, y: s.oy } : homes[k];
    const n = s ? stickPos(s) : { x: 0, y: 0 };
    const nm = Math.hypot(n.x, n.y);
    const kx = o.x + (nm > 1 ? n.x / nm : n.x) * RAD;
    const ky = o.y + (nm > 1 ? n.y / nm : n.y) * RAD;
    ictx.globalAlpha = s ? 0.92 : 0.38;
    ictx.fillStyle = 'rgba(255,253,248,.55)';
    ictx.strokeStyle = '#16181d';
    ictx.lineWidth = 2.5;
    ictx.beginPath(); ictx.arc(o.x, o.y, RAD, 0, Math.PI * 2); ictx.fill(); ictx.stroke();
    if (k === 'R') {
      // The swing guide: the pull-back half, split into the three faces.
      ictx.lineWidth = 6;
      for (const [a0, a1, col] of [[0.6, Math.PI - 0.6, '#e2562f'], [-0.35, 0.6, '#16181d'], [Math.PI - 0.6, Math.PI + 0.35, '#16181d'], [-0.9, -0.35, '#2f6fd6'], [Math.PI + 0.35, Math.PI + 0.9, '#2f6fd6']]) {
        ictx.strokeStyle = col;
        ictx.globalAlpha = (s ? 0.75 : 0.3);
        ictx.beginPath(); ictx.arc(o.x, o.y, RAD + 7, a0, a1); ictx.stroke();
      }
      ictx.globalAlpha = s ? 0.92 : 0.38;
    }
    ictx.fillStyle = k === 'R' && SW.phase === 'back' ? (faceOf(SW.back) === 'topspin' ? '#e2562f' : faceOf(SW.back) === 'slice' ? '#2f6fd6' : '#16181d') : '#16181d';
    ictx.beginPath(); ictx.arc(kx, ky, 22, 0, Math.PI * 2); ictx.fill();
    ictx.fillStyle = '#16181d';
    ictx.font = '800 10px ui-monospace, Menlo, monospace';
    ictx.textAlign = 'center';
    if (!s) ictx.fillText(k === 'L' ? 'MOVE' : 'SWING', o.x, o.y + RAD + 22);
  }
  ictx.globalAlpha = 1;
}

function render() {
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, L.mainW, L.h);
  renderer.setScissor(0, 0, L.mainW, L.h);
  renderer.setClearColor(PAPER, 1);
  renderer.clear();
  renderer.render(scene, camera);
  if (L.wide) {
    const w = L.w - L.mainW;
    const h = L.sideH;
    const y = L.h - safe.top - 12 - h;
    renderer.setViewport(L.mainW, 0, w, L.h);
    renderer.setScissor(L.mainW, 0, w, L.h);
    renderer.setClearColor(0x24382c, 1);
    renderer.clear();
    renderer.setViewport(L.mainW, y, w, h);
    renderer.setScissor(L.mainW, y, w, h);
    renderer.render(scene, side);
  }
  renderer.setScissorTest(false);
  drawSticks();
}

let last = performance.now();
let acc = 0;
function frame(now) {
  // Show-me runs at 55 % speed so you can follow the thumbs.
  acc += Math.min(0.1, (now - last) / 1000) * (D.on ? 0.55 : 1);
  last = now;
  // `window.paused` (a test hook) holds the simulation so `advance` can pose exact frames.
  while (acc >= DT) { if (!window.paused) step(DT); acc -= DT; }
  pose();
  render();
  requestAnimationFrame(frame);
}

// ---------- App and test hooks ----------
window.setPlayer = ({ color } = {}) => { if (color) me.bodyMat.color.set(color); };
window.setBests = (b) => { bests = b || {}; showCount(); };
window.advance = (sec) => { for (let k = 0; k < sec * 120; k += 1) step(DT); pose(); render(); };
/** Test hook: a swing as if the right thumb pulled to `back` and flicked to `finish` in `ms`. */
window.fakeSwing = ({ wing, back, finish: fin, ms = 120 }) => { const s = readSwing(back, fin, Math.hypot(fin.x - back.x, fin.y - back.y) / (ms / 1000), wing); swing(s); return s; };
/** Test hook: hold the right stick pulled back at n (radii), or let go (null). */
window.fakeHold = (n) => {
  const ox = L.w - RAD - 34;
  const oy = L.h - safe.bottom - RAD - 34;
  if (n) { SW.phase = 'back'; SW.wing = Math.sign(n.x) || 1; SW.back = n; sticks.R = { id: -2, ox, oy, x: ox + n.x * RAD, y: oy + n.y * RAD }; } else { SW.phase = 'idle'; sticks.R = null; }
};
window.fakeLeft = (n) => {
  const ox = RAD + 34;
  const oy = L.h - safe.bottom - RAD - 34;
  sticks.L = n ? { id: -1, ox, oy, x: ox + n.x * RAD, y: oy + n.y * RAD } : null;
};
window.teleport = (x, z) => { Object.assign(P, { x, z, vx: 0, vz: 0 }); };
window.contact = () => (ball && ball.owner !== 'you' ? findContact(ball, 1) : null);
window.state = () => ({ ball: ball && { x: ball.x, y: ball.y, z: ball.z, b: ball.bounces, o: ball.owner, type: ball.type }, shot: shot && shot.kind, landZ: ball && ball.owner === 'you' ? firstLanding(ball).z : null, plan: D.plan && { stage: D.plan.stage, c: D.plan.c }, phase, mode, kind: cur().kind, balls, points, score: [...score], owner: ball && ball.owner, done: ball && ball.done, P: { x: P.x, z: P.z }, B: { x: B.x, z: B.z }, time, wide: L.wide, ballZ: ball && ball.z });
window.startMode = startMode;
window.startDemo = startDemo;
window.demoOn = () => D.on;
window.fitReport = () => { camera.updateProjectionMatrix(); let y0 = 9, y1 = -9, x0 = 9, x1 = -9; for (const p of fitPts) { v3.copy(p).project(camera); x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x); y0 = Math.min(y0, v3.y); y1 = Math.max(y1, v3.y); } return { x0, x1, y0, y1, topN: 1 - (2 * L.top) / L.h, botN: -1 + (2 * L.bottom) / L.h, cam: camera.position.toArray(), top: L.top, bottom: L.bottom }; };

addEventListener('resize', layout);
showMode();
layout();
requestAnimationFrame(frame);
post({ type: 'ready' });
