// The sky over San Diego, flown like a Z fighter. The city is built from real coordinates (coastline, the bays, Coronado,
// the freeways, the bridge, downtown) in meters, toon shaded with ink lines. Your fighter flies it inside a ki aura:
// drag to steer, hold BLAST to rocket forward, hold RISE to rocket straight up, let go to hover. Every court you play is a
// pillar of light at its real spot; get close and you can land on it.
import * as THREE from 'three';

import { SoftBody } from './jelly-core.js';
import { post } from './lib/bridge.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Smooth value noise, for the lie of the land.
function hash2(x, y) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise2(x, y) {
  const xi = Math.floor(x); const yi = Math.floor(y); const u = x - xi; const v = y - yi;
  const su = u * u * (3 - 2 * u); const sv = v * v * (3 - 2 * v);
  const a = hash2(xi, yi); const b = hash2(xi + 1, yi); const c = hash2(xi, yi + 1); const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, su), lerp(c, d, su), sv);
}
const fbm = (x, y) => (noise2(x, y) * 0.5 + noise2(x * 2.03 + 17, y * 2.03 + 9) * 0.27 + noise2(x * 4.1 + 3, y * 4.1 + 31) * 0.15 + noise2(x * 8.3, y * 8.3) * 0.08);

// ---------- Geography: lat/lng to meters (x east, z south) ----------
const LAT0 = 32.775; const LNG0 = -117.175;
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180); const MZ = 110900;
const gx = (lng) => (lng - LNG0) * MX;
const gz = (lat) => (LAT0 - lat) * MZ;
const G = (lat, lng) => [gx(lng), gz(lat)];
const poly = (pts) => pts.map(([la, ln]) => G(la, ln));

// The mainland: the Pacific shore from Del Mar south to Point Loma, round into the bay, down to Chula Vista, then the map edge.
const MAIN = poly([
  [33.05, -117.29], [33.0, -117.275], [32.97, -117.268], [32.95, -117.266], [32.93, -117.262], [32.905, -117.256], [32.885, -117.254],
  [32.872, -117.253], [32.862, -117.256], [32.856, -117.262], [32.851, -117.271], [32.848, -117.278], [32.841, -117.282], [32.83, -117.281],
  [32.818, -117.274], [32.806, -117.264], [32.796, -117.258], [32.782, -117.254], [32.766, -117.2525], [32.752, -117.2525], [32.745, -117.255],
  [32.735, -117.2565], [32.72, -117.2575], [32.705, -117.2555], [32.69, -117.252], [32.677, -117.247], [32.668, -117.243], [32.664, -117.24],
  [32.668, -117.236], [32.678, -117.234], [32.69, -117.234], [32.70, -117.233], [32.708, -117.232], [32.713, -117.228], [32.717, -117.224],
  [32.722, -117.218], [32.723, -117.21], [32.726, -117.203], [32.728, -117.192], [32.727, -117.183], [32.723, -117.177], [32.717, -117.1745],
  [32.711, -117.172], [32.706, -117.165], [32.701, -117.156], [32.698, -117.147], [32.691, -117.138], [32.68, -117.128], [32.668, -117.119],
  [32.655, -117.113], [32.64, -117.108], [32.625, -117.105], [32.605, -117.102], [32.585, -117.1], [32.565, -117.112], [32.54, -117.125],
  [32.5, -117.13], [32.5, -116.9], [33.05, -116.9],
]);
// Coronado and North Island, and the Silver Strand running south.
const COR = poly([
  [32.692, -117.226], [32.70, -117.222], [32.708, -117.214], [32.711, -117.2], [32.708, -117.186], [32.703, -117.177], [32.698, -117.17],
  [32.692, -117.162], [32.686, -117.155], [32.678, -117.152], [32.666, -117.148], [32.65, -117.141], [32.63, -117.135], [32.61, -117.129],
  [32.585, -117.122], [32.565, -117.118], [32.565, -117.128], [32.585, -117.13], [32.61, -117.137], [32.63, -117.144], [32.65, -117.153],
  [32.668, -117.165], [32.676, -117.175], [32.68, -117.186], [32.684, -117.2], [32.688, -117.214],
]);
// Mission Bay, its channel out to sea, and the San Diego River mouth beside it.
const MBAY = poly([
  [32.7545, -117.262], [32.7615, -117.262], [32.7615, -117.249], [32.768, -117.247], [32.778, -117.249], [32.786, -117.246], [32.792, -117.243],
  [32.794, -117.236], [32.797, -117.229], [32.795, -117.22], [32.79, -117.212], [32.785, -117.205], [32.778, -117.204], [32.77, -117.207],
  [32.765, -117.214], [32.762, -117.224], [32.7585, -117.226], [32.7585, -117.205], [32.7555, -117.205], [32.7555, -117.25],
]);
const ISLES = [
  poly([[32.783, -117.226], [32.786, -117.218], [32.781, -117.213], [32.774, -117.215], [32.772, -117.221], [32.776, -117.226]]), // Fiesta Island
  poly([[32.778, -117.24], [32.781, -117.234], [32.776, -117.232], [32.774, -117.238]]), // Vacation Isle
];
const MISSION_VALLEY = poly([[32.7585, -117.205], [32.763, -117.19], [32.765, -117.165], [32.768, -117.14], [32.775, -117.115], [32.782, -117.09], [32.79, -117.06], [32.8, -117.02]]);
const ROSE_CANYON = poly([[32.8, -117.215], [32.82, -117.222], [32.84, -117.226], [32.862, -117.228], [32.88, -117.225]]);
const FREEWAYS = [
  [[32.99, -117.25], [32.95, -117.243], [32.9, -117.226], [32.87, -117.224], [32.83, -117.225], [32.8, -117.212], [32.775, -117.205], [32.76, -117.2], [32.745, -117.193], [32.727, -117.172], [32.716, -117.158], [32.705, -117.148], [32.69, -117.13], [32.66, -117.108], [32.62, -117.093], [32.56, -117.08]], // I-5
  [[32.758, -117.215], [32.762, -117.19], [32.764, -117.16], [32.768, -117.135], [32.775, -117.11], [32.78, -117.08], [32.786, -117.04], [32.79, -116.98]], // I-8
  [[32.716, -117.153], [32.73, -117.155], [32.748, -117.16], [32.765, -117.157], [32.8, -117.148], [32.83, -117.135], [32.86, -117.125], [32.9, -117.11], [32.95, -117.1]], // 163
  [[32.9, -117.222], [32.87, -117.2], [32.83, -117.165], [32.8, -117.135], [32.77, -117.12], [32.73, -117.11], [32.69, -117.085], [32.64, -117.065], [32.56, -117.05]], // 805
  [[32.7, -117.122], [32.73, -117.112], [32.76, -117.108], [32.79, -117.115], [32.83, -117.12], [32.87, -117.115], [32.92, -117.1]], // 15
];

// Names on the land (and the water), read off as you pass over.
const PLACES = [
  [32.842, -117.272, 'LA JOLLA'], [32.92, -117.25, 'TORREY PINES'], [32.879, -117.237, 'UCSD'], [32.871, -117.211, 'UTC'],
  [32.797, -117.238, 'PACIFIC BEACH'], [32.776, -117.252, 'MISSION BEACH'], [32.781, -117.225, 'MISSION BAY'], [32.745, -117.247, 'OCEAN BEACH'],
  [32.715, -117.24, 'POINT LOMA'], [32.83, -117.19, 'CLAIREMONT'], [32.786, -117.165, 'LINDA VISTA'], [32.768, -117.15, 'MISSION VALLEY'],
  [32.754, -117.198, 'OLD TOWN'], [32.748, -117.165, 'HILLCREST'], [32.746, -117.13, 'NORTH PARK'], [32.731, -117.147, 'BALBOA PARK'],
  [32.715, -117.16, 'DOWNTOWN'], [32.682, -117.18, 'CORONADO'], [32.697, -117.143, 'BARRIO LOGAN'], [32.668, -117.1, 'NATIONAL CITY'],
  [32.83, -117.14, 'KEARNY MESA'], [32.748, -117.098, 'CITY HEIGHTS'], [32.872, -117.14, 'MIRAMAR'], [32.62, -117.08, 'CHULA VISTA'],
  [32.703, -117.205, 'NORTH ISLAND'], [32.735, -117.197, 'THE AIRPORT'], [32.78, -117.07, 'SAN DIEGO STATE'],
  [32.84, -117.31, 'PACIFIC OCEAN'], [32.75, -117.29, 'PACIFIC OCEAN'], [32.66, -117.27, 'PACIFIC OCEAN'], [32.93, -117.29, 'PACIFIC OCEAN'],
  [32.698, -117.19, 'SAN DIEGO BAY'], [32.66, -117.13, 'SAN DIEGO BAY'],
].map(([la, ln, name]) => { const [x, z] = G(la, ln); return { x, z, name }; });

function inside(x, z, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]; const [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function lineDist(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1];
    const dx = bx - ax; const dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
const near = (x, z, la, ln, r) => { const [cx, cz] = G(la, ln); return 1 - smooth(r * 0.35, r, Math.hypot(x - cx, z - cz)); };

// ---------- The grid ----------
const LAT_MIN = 32.54; const LAT_MAX = 33.0; const LNG_MIN = -117.34; const LNG_MAX = -116.96;
const NX = 260; const NZ = 370; const N = NX * NZ;
const X_MIN = gx(LNG_MIN); const X_MAX = gx(LNG_MAX); const Z_MIN = gz(LAT_MAX); const Z_MAX = gz(LAT_MIN);
const DX = (X_MAX - X_MIN) / (NX - 1); const DZ = (Z_MAX - Z_MIN) / (NZ - 1);
// Where you can fly: the city, with a margin of fog all round.
const PLAY = { x0: gx(-117.31), x1: gx(-117.02), z0: gz(32.95), z1: gz(32.6) };

const LAND = new Uint8Array(N); // 0 water, 1 mainland, 2 Coronado
for (let j = 0; j < NZ; j += 1) {
  for (let i = 0; i < NX; i += 1) {
    const x = X_MIN + i * DX; const z = Z_MIN + j * DZ;
    let l = 0;
    if (inside(x, z, MAIN)) l = 1;
    if (l && inside(x, z, MBAY)) l = 0;
    if (!l && ISLES.some((p) => inside(x, z, p))) l = 1;
    if (!l && inside(x, z, COR)) l = 2;
    LAND[j * NX + i] = l;
  }
}
/** Chamfer distance (meters) from every cell to the nearest cell where `target(k)` holds. */
function distanceTo(target) {
  const d = new Float32Array(N);
  for (let k = 0; k < N; k += 1) d[k] = target(k) ? 0 : 1e9;
  const DG = Math.hypot(DX, DZ);
  for (let j = 0; j < NZ; j += 1) for (let i = 0; i < NX; i += 1) {
    const k = j * NX + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + DX);
    if (j > 0) { v = Math.min(v, d[k - NX] + DZ); if (i > 0) v = Math.min(v, d[k - NX - 1] + DG); if (i < NX - 1) v = Math.min(v, d[k - NX + 1] + DG); }
    d[k] = v;
  }
  for (let j = NZ - 1; j >= 0; j -= 1) for (let i = NX - 1; i >= 0; i -= 1) {
    const k = j * NX + i; let v = d[k];
    if (i < NX - 1) v = Math.min(v, d[k + 1] + DX);
    if (j < NZ - 1) { v = Math.min(v, d[k + NX] + DZ); if (i < NX - 1) v = Math.min(v, d[k + NX + 1] + DG); if (i > 0) v = Math.min(v, d[k + NX - 1] + DG); }
    d[k] = v;
  }
  return d;
}
const toWater = distanceTo((k) => !LAND[k]);
const toLand = distanceTo((k) => !!LAND[k]);
const HALF = (DX + DZ) / 4;
const SD = new Float32Array(N); // signed distance to the shore: + on land, - in water
for (let k = 0; k < N; k += 1) SD[k] = LAND[k] ? toWater[k] - HALF : -(toLand[k] - HALF);

const H = new Float32Array(N);
const CLIFF = new Float32Array(N);
for (let j = 0; j < NZ; j += 1) {
  for (let i = 0; i < NX; i += 1) {
    const k = j * NX + i; const x = X_MIN + i * DX; const z = Z_MIN + j * DZ;
    const lat = LAT0 - z / MZ; const lng = LNG0 + x / MX;
    const d = SD[k];
    if (!LAND[k]) { H[k] = -0.8 - Math.min(-d, 3000) * 0.012; continue; }
    if (LAND[k] === 2) { H[k] = 0.6 + Math.min(d, 300) * 0.018; continue; }
    // Sandstone bluffs at Torrey Pines and La Jolla, the ridge of Point Loma; gentle slopes everywhere else.
    let cliff = 0;
    if (lng < -117.24 && lat > 32.835) cliff = 1;
    if (lng < -117.215 && lat < 32.745) cliff = Math.max(cliff, 0.8);
    CLIFF[k] = cliff;
    const rise = smooth(0, lerp(1500, 170, cliff), d);
    let mesa = 95 + 75 * clamp((lng + 117.22) / 0.2, 0, 1) + (fbm(x / 2600, z / 2600) - 0.5) * 44;
    const basin = Math.max(near(x, z, 32.785, -117.228, 2700), near(x, z, 32.716, -117.165, 2000) * 0.85, near(x, z, 32.69, -117.125, 2600) * 0.75, near(x, z, 32.752, -117.205, 1300));
    mesa = lerp(mesa, 14, basin);
    if (lng < -117.215 && lat < 32.745) mesa *= 1.15;
    mesa += 180 * near(x, z, 32.8395, -117.2445, 1700);
    let h = 0.6 + (mesa - 0.6) * rise;
    h = lerp(h, 9, 1 - smooth(280, 900, lineDist(x, z, MISSION_VALLEY)));
    h = lerp(h, 18, 1 - smooth(150, 560, lineDist(x, z, ROSE_CANYON)));
    const c = 1 - Math.abs(fbm(x / 2300 + 7, z / 2300 + 3) * 2 - 1);
    h -= smooth(0.8, 0.95, c) * Math.max(0, h - 15) * 0.7;
    h += (fbm(x / 480, z / 480) - 0.5) * 7 * rise;
    H[k] = Math.max(0.6, h);
  }
}
const hAtRaw = (x, z) => {
  const fi = clamp((x - X_MIN) / DX, 0, NX - 1.001); const fj = clamp((z - Z_MIN) / DZ, 0, NZ - 1.001);
  const i = fi | 0; const j = fj | 0; const u = fi - i; const w = fj - j; const k = j * NX + i;
  return (H[k] * (1 - u) + H[k + 1] * u) * (1 - w) + (H[k + NX] * (1 - u) + H[k + NX + 1] * u) * w;
};

// The courts: their real spots, read off each venue's id (c<lat*1e4>_<-lng*1e4>).
const VENUES = (window.VENUES || []).map((v) => {
  const m = /c(\d+)_(\d+)/.exec(v.id);
  const lat = m ? Number(m[1]) / 1e4 : 32.75; const lng = m ? -Number(m[2]) / 1e4 : -117.15;
  const [x, z] = G(lat, lng);
  return { ...v, x, z, lat, lng };
});
// Level the ground under each venue so its courts sit flat.
for (const v of VENUES) {
  const h0 = Math.max(4, hAtRaw(v.x, v.z));
  for (let j = 0; j < NZ; j += 1) for (let i = 0; i < NX; i += 1) {
    const k = j * NX + i; if (!LAND[k]) continue;
    const r = Math.hypot(X_MIN + i * DX - v.x, Z_MIN + j * DZ - v.z);
    if (r < 650) H[k] = lerp(h0, H[k], smooth(260, 650, r));
  }
  v.y = h0;
}
const hAt = hAtRaw;
const slopeAt = (i, j) => {
  const i0 = Math.max(0, i - 1); const i1 = Math.min(NX - 1, i + 1); const j0 = Math.max(0, j - 1); const j1 = Math.min(NZ - 1, j + 1);
  return Math.hypot((H[j * NX + i1] - H[j * NX + i0]) / ((i1 - i0) * DX), (H[j1 * NX + i] - H[j0 * NX + i]) / ((j1 - j0) * DZ));
};

// ---------- Renderer, camera, sky ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__still });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#d8e9ef');
scene.fog = new THREE.Fog(HORIZON, 2600, 21000);
const camera = new THREE.PerspectiveCamera(60, 1, 1.2, 60000);

const sky = new THREE.Mesh(new THREE.SphereGeometry(50000, 32, 16), new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color('#2f86e0') }, mid: { value: new THREE.Color('#7dbdf0') }, bot: { value: HORIZON } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, mid, bot; varying vec3 vD;
void main(){ float y = max(vD.y, 0.0); vec3 c = mix(bot, mid, smoothstep(0.0, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.7, y)); gl_FragColor = vec4(c, 1.0);
#include <colorspace_fragment>
}`,
  side: THREE.BackSide, depthWrite: false, fog: false,
}));
sky.renderOrder = -10;
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xeaf4ff, 0x9a8a6a, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dd, 2.4);
sun.position.set(-0.55, 0.8, 0.35).multiplyScalar(1000);
scene.add(sun);

// Cel shading: three flat tones, and an ink line round the things that matter.
const tones = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
tones.minFilter = tones.magFilter = THREE.NearestFilter;
tones.needsUpdate = true;
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: tones, ...extra });
const INK = 0x16181d;
/** An ink outline material: the mesh pushed out along its normals, back faces only. Fades out up close (inside clouds). */
const lineMat = (thick, fadeNear = 0) => new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { thick: { value: thick }, color: { value: new THREE.Color(INK) }, fadeNear: { value: fadeNear } }]),
  vertexShader: `uniform float thick; varying float vZ;
#include <fog_pars_vertex>
void main(){ vec4 mvPosition = vec4(position + normal * thick, 1.0);
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition; vZ = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
  fragmentShader: `uniform vec3 color; uniform float fadeNear; varying float vZ;
#include <fog_pars_fragment>
void main(){ if (vZ < fadeNear) discard; gl_FragColor = vec4(color, 1.0);
#include <colorspace_fragment>
#include <fog_fragment>
}`,
  side: THREE.BackSide, fog: true,
});
function inked(mesh, mat) {
  const hull = new THREE.Mesh(mesh.geometry, mat);
  mesh.add(hull);
  return mesh;
}
const tex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};

// ---------- The land ----------
const PAL = {
  sand: new THREE.Color('#ecd9a4'), bluff: new THREE.Color('#d9a571'), scrub: new THREE.Color('#a3ad6b'), dry: new THREE.Color('#d2bd8c'),
  canyon: new THREE.Color('#62804a'), park: new THREE.Color('#79b257'), town: new THREE.Color('#dccfb8'), core: new THREE.Color('#c9c3ba'),
  base: new THREE.Color('#cdb88e'), wet: new THREE.Color('#b9c7a0'),
};
function zoneOf(x, z, k) {
  const lat = LAT0 - z / MZ; const lng = LNG0 + x / MX;
  const coronado = LAND[k] === 2;
  if (!coronado) {
    const [bx, bz] = G(32.732, -117.148);
    if (((x - bx) / 950) ** 2 + ((z - bz) / 1350) ** 2 < 1) return 'park'; // Balboa Park
    if (lat > 32.9 && lng < -117.236) return 'wild'; // Torrey Pines
    if (lat > 32.85 && lat < 32.9 && lng > -117.165 && lng < -117.08) return 'base'; // Miramar
    if (lat < 32.705 && lng < -117.225) return 'wild'; // the tip of Point Loma
    if (lat > 32.727 && lat < 32.739 && lng > -117.216 && lng < -117.18) return 'air'; // the airport
    if (near(x, z, 32.8395, -117.2445, 700) > 0.5) return 'wild'; // Soledad
    if (near(x, z, 32.759, -117.195, 380) > 0.5 || near(x, z, 32.808, -117.237, 400) > 0.5) return 'park';
    if (near(x, z, 32.782, -117.226, 2600) > 0.2 && SD[k] < 260) return 'park'; // Mission Bay's lawns
    if (ISLES.some((p) => inside(x, z, p))) return 'sand';
    if (near(x, z, 32.88, -117.235, 1200) > 0.4) return 'campus';
    if (near(x, z, 32.7157, -117.1611, 1300) > 0.05) return 'core';
    if (near(x, z, 32.871, -117.211, 1300) > 0.1) return 'utc';
    return 'town';
  }
  if (lat > 32.688 && lng < -117.18) return 'base'; // North Island
  if (lat < 32.672) return 'sand';
  return 'town';
}
const ZONE = new Array(N);
const terrainGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3);
  const c = new THREE.Color();
  for (let j = 0; j < NZ; j += 1) for (let i = 0; i < NX; i += 1) {
    const k = j * NX + i; const x = X_MIN + i * DX; const z = Z_MIN + j * DZ;
    pos[k * 3] = x; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = z;
    if (!LAND[k]) { c.copy(PAL.sand).lerp(PAL.wet, smooth(0, 300, -SD[k])); ZONE[k] = 'water'; } else {
      const zone = zoneOf(x, z, k); ZONE[k] = zone;
      const s = slopeAt(i, j); const n = fbm(x / 900, z / 900);
      if (zone === 'park') c.copy(PAL.park);
      else if (zone === 'wild') c.copy(PAL.scrub).lerp(PAL.canyon, n);
      else if (zone === 'base' || zone === 'air') c.copy(PAL.base);
      else if (zone === 'sand') c.copy(PAL.sand);
      else if (zone === 'core') c.copy(PAL.core);
      else if (zone === 'campus') c.copy(PAL.park).lerp(PAL.canyon, 0.35 + n * 0.4);
      else c.copy(PAL.town).lerp(PAL.dry, n * 0.6);
      if (s > 0.16) c.lerp(PAL.canyon, smooth(0.16, 0.35, s));
      if (CLIFF[k] > 0 && s > 0.3 && SD[k] < 500) c.copy(PAL.bluff);
      if (SD[k] < 140 && H[k] < 14 && !CLIFF[k]) c.copy(PAL.sand);
    }
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6); let n = 0;
  for (let j = 0; j < NZ - 1; j += 1) for (let i = 0; i < NX - 1; i += 1) {
    const a = j * NX + i; const b = a + 1; const cc = a + NX; const d = cc + 1;
    idx[n++] = a; idx[n++] = cc; idx[n++] = b; idx[n++] = b; idx[n++] = cc; idx[n++] = d;
  }
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  terrainGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  terrainGeo.computeVertexNormals();
}
const terrain = new THREE.Mesh(terrainGeo, toon(0xffffff, { vertexColors: true }));
scene.add(terrain);

// ---------- The sea: shallows by the shore, white water rolling in ----------
const sdTex = (() => {
  const data = new Uint16Array(N);
  for (let k = 0; k < N; k += 1) data[k] = THREE.DataUtils.toHalfFloat(clamp(SD[k], -4000, 4000) / 1000);
  const t = new THREE.DataTexture(data, NX, NZ, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
})();
const seaMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uSd: { value: null }, uMin: { value: new THREE.Vector2(X_MIN, Z_MIN) }, uSize: { value: new THREE.Vector2(X_MAX - X_MIN, Z_MAX - Z_MIN) }, uTime: { value: 0 }, uDim: { value: 0 },
    deep: { value: new THREE.Color('#1f63b4') }, shallow: { value: new THREE.Color('#3fb3d4') }, foam: { value: new THREE.Color('#f7fbf6') },
  }]),
  vertexShader: `varying vec2 vW;
#include <fog_pars_vertex>
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
  fragmentShader: `uniform sampler2D uSd; uniform vec2 uMin, uSize; uniform float uTime, uDim; uniform vec3 deep, shallow, foam; varying vec2 vW;
#include <fog_pars_fragment>
void main(){
  vec2 uv = (vW - uMin) / uSize;
  float d = -texture2D(uSd, uv).r * 1000.0; // meters out from the shore
  if (uv.x < 0.0) d = 4000.0;
  float t = smoothstep(40.0, 2200.0, d);
  vec3 c = mix(shallow, deep, floor(t * 3.0 + 0.5) / 3.0);
  float roll = step(0.86, sin(d * 0.05 - uTime * 1.7)) * (1.0 - smoothstep(40.0, 320.0, d));
  float edge = 1.0 - smoothstep(10.0, 38.0, d);
  float glint = step(0.993, sin(vW.x * 0.031 + uTime * 0.7) * sin(vW.y * 0.027 - uTime * 0.9)) * (1.0 - t * 0.5);
  c = mix(c, foam, max(max(roll * 0.85, edge), glint * 0.6));
  c *= 1.0 - uDim;
  gl_FragColor = vec4(c, 1.0);
#include <colorspace_fragment>
#include <fog_fragment>
}`,
  fog: true,
});
seaMat.uniforms.uSd.value = sdTex;
const sea = new THREE.Mesh(new THREE.PlaneGeometry(140000, 140000).rotateX(-Math.PI / 2), seaMat);
scene.add(sea);

// ---------- Freeways ----------
{
  const pos = []; const idx = [];
  for (const line of FREEWAYS) {
    const pts = poly(line); const samples = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 70));
      for (let s = 0; s < n; s += 1) samples.push([lerp(ax, bx, s / n), lerp(az, bz, s / n)]);
    }
    samples.push(pts[pts.length - 1]);
    const base = pos.length / 3;
    samples.forEach(([x, z], s) => {
      const [px, pz] = samples[Math.max(0, s - 1)]; const [nx, nz] = samples[Math.min(samples.length - 1, s + 1)];
      const dx = nx - px; const dz = nz - pz; const l = Math.hypot(dx, dz) || 1; const ox = (-dz / l) * 22; const oz = (dx / l) * 22;
      const y = Math.max(hAt(x - ox, z - oz), hAt(x + ox, z + oz), hAt(x, z), 1) + 2.5;
      pos.push(x - ox, y, z - oz, x + ox, y, z + oz);
      if (s > 0) { const a = base + (s - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x4b4e57, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })));
}

// ---------- The town: blocks of houses, towers downtown, chunked so far ones can be dropped ----------
const chunks = [];
{
  const bins = new Map();
  const r = rng(91);
  const TOWN = ['#f2e8d4', '#e9d7c0', '#f5f1e8', '#e8cbb7', '#dcd4c6', '#efe0c2'].map((h) => new THREE.Color(h));
  const GLASS = ['#a8bfd0', '#c7d4dd', '#8ea8bc', '#e5e2da', '#b9c4c9'].map((h) => new THREE.Color(h));
  const add = (x, z, w, d, h, rot, color) => {
    const key = `${Math.floor(x / 4000)},${Math.floor(z / 4000)}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push([x, z, w, d, h, rot, color]);
  };
  const [dtx, dtz] = G(32.7157, -117.1611);
  for (let j = 1; j < NZ - 1; j += 1) for (let i = 1; i < NX - 1; i += 1) {
    const k = j * NX + i; const zone = ZONE[k];
    if (!LAND[k] || SD[k] < 90 || slopeAt(i, j) > 0.17) continue;
    const x = X_MIN + i * DX; const z = Z_MIN + j * DZ;
    if (x < PLAY.x0 - 3000 || x > PLAY.x1 + 3000 || z < PLAY.z0 - 3000 || z > PLAY.z1 + 3000) continue;
    if (VENUES.some((v) => Math.hypot(x - v.x, z - v.z) < 260)) continue;
    const rot = r() < 0.75 ? 0 : (r() - 0.5) * 0.8;
    if (zone === 'core') {
      const t = 1 - Math.hypot(x - dtx, z - dtz) / 1300;
      for (let n = 0; n < 4; n += 1) add(x + (r() - 0.5) * DX * 0.8, z + (r() - 0.5) * DZ * 0.8, 24 + r() * 26, 24 + r() * 26, 20 + r() * 50 + Math.max(0, t) ** 1.5 * r() * 150, rot, GLASS[(r() * GLASS.length) | 0]);
    } else if (zone === 'utc') {
      for (let n = 0; n < 2; n += 1) add(x + (r() - 0.5) * DX * 0.7, z + (r() - 0.5) * DZ * 0.7, 30 + r() * 25, 30 + r() * 25, 18 + r() * 60, rot, GLASS[(r() * GLASS.length) | 0]);
    } else if (zone === 'campus') {
      if (r() < 0.35) add(x, z, 50 + r() * 40, 30 + r() * 30, 12 + r() * 18, rot, TOWN[(r() * TOWN.length) | 0]);
    } else if (zone === 'town') {
      const mv = lineDist(x, z, MISSION_VALLEY) < 450;
      const n = mv ? 1 : 2;
      for (let m = 0; m < n; m += 1) {
        if (r() < 0.12) continue;
        add(x + (r() - 0.5) * DX * 0.6, z + (r() - 0.5) * DZ * 0.6, mv ? 70 + r() * 60 : 34 + r() * 30, mv ? 50 + r() * 40 : 30 + r() * 26, mv ? 10 + r() * 30 : 5 + r() * 9, rot, TOWN[(r() * TOWN.length) | 0]);
      }
    } else if (zone === 'base' && r() < 0.08) add(x, z, 60 + r() * 40, 30 + r() * 20, 10 + r() * 6, 0, new THREE.Color('#c8c3b6'));
  }
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = toon(0xffffff);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const p = new V3(); const s = new V3(); const up = new V3(0, 1, 0);
  for (const list of bins.values()) {
    const mesh = new THREE.InstancedMesh(box, mat, list.length);
    let cx = 0; let cz = 0;
    list.forEach(([x, z, w, d, h, rot, color], n) => {
      const y = Math.min(hAt(x - w / 2, z - d / 2), hAt(x + w / 2, z + d / 2), hAt(x, z)) - 2;
      mesh.setMatrixAt(n, m.compose(p.set(x, y, z), q.setFromAxisAngle(up, rot), s.set(w, h + 2, d)));
      mesh.setColorAt(n, color);
      cx += x; cz += z;
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
    chunks.push({ mesh, x: cx / list.length, z: cz / list.length });
  }
}

// ---------- Landmarks ----------
const LINE = { s: lineMat(0.6), m: lineMat(1.2), l: lineMat(2.4) };
const placeAt = (obj, lat, lng, y = null, rot = 0) => { const [x, z] = G(lat, lng); obj.position.set(x, y ?? hAt(x, z), z); obj.rotation.y = rot; scene.add(obj); return obj; };
const boxM = (w, h, d, color, line = LINE.s) => inked(new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), toon(color)), line);

// The Coronado Bridge: a blue curve from Barrio Logan over the bay, high enough for a carrier to pass under.
{
  const [ax, az] = G(32.6995, -117.1445); const [bx, bz] = G(32.6868, -117.1585);
  const mx = (ax + bx) / 2; const mz = (az + bz) / 2; const dx = bx - ax; const dz = bz - az; const L = Math.hypot(dx, dz);
  const cx = mx + (-dz / L) * 520; const cz = mz + (dx / L) * 520;
  const at = (t) => [lerp(lerp(ax, cx, t), lerp(cx, bx, t), t), lerp(lerp(az, cz, t), lerp(cz, bz, t), t)];
  const deckMat = toon('#3f7cc0'); const pierMat = toon('#ece5d6');
  const g = new THREE.Group();
  const SEG = 48;
  for (let s = 0; s < SEG; s += 1) {
    const [x0, z0] = at(s / SEG); const [x1, z1] = at((s + 1) / SEG);
    const y0 = 8 + 60 * Math.sin(Math.PI * (s / SEG)) ** 0.7; const y1 = 8 + 60 * Math.sin(Math.PI * ((s + 1) / SEG)) ** 0.7;
    const len = Math.hypot(x1 - x0, z1 - z0, y1 - y0);
    const deck = inked(new THREE.Mesh(new THREE.BoxGeometry(22, 5, len + 1), deckMat), LINE.s);
    deck.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    deck.lookAt(x1, y1, z1);
    g.add(deck);
    if (s % 3 === 1) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(9, y0 + 10, 9).translate(0, (y0 + 10) / 2 - 10, 0), pierMat);
      pier.position.set(x0, 0, z0); g.add(pier);
    }
  }
  scene.add(g);
}
// Downtown's tall ones, each with its crown.
for (const [lat, lng, h, w, crown] of [[32.7166, -117.1693, 152, 40, 'spire'], [32.7106, -117.1683, 152, 44, 'flat'], [32.7099, -117.1672, 120, 44, 'flat'], [32.7172, -117.1651, 145, 34, 'cone'], [32.7203, -117.1665, 128, 36, 'flat'], [32.7144, -117.1607, 118, 38, 'cone']]) {
  const t = boxM(w, h, w, '#b8cddc', LINE.m);
  if (crown !== 'flat') {
    const cap = inked(new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, crown === 'spire' ? 42 : 24, 4).rotateY(Math.PI / 4).translate(0, h + (crown === 'spire' ? 21 : 12), 0), toon('#e8e4da')), LINE.m);
    t.add(cap);
  }
  placeAt(t, lat, lng, hAt(...G(lat, lng)) - 2);
}
// Petco Park.
{
  const g = new THREE.Group();
  g.add(inked(new THREE.Mesh(new THREE.CylinderGeometry(118, 110, 32, 40, 1, true), toon('#efe9dc', { side: THREE.DoubleSide })), LINE.m));
  g.children[0].position.y = 16;
  const field = new THREE.Mesh(new THREE.CircleGeometry(108, 40).rotateX(-Math.PI / 2), toon('#5fa846')); field.position.y = 1; g.add(field);
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(30, 4).rotateX(-Math.PI / 2), toon('#c98d5a')); dirt.position.set(0, 1.4, 30); dirt.rotation.y = Math.PI / 4; g.add(dirt);
  placeAt(g, 32.7073, -117.1566);
}
// Carriers: the Midway at its pier, two more at North Island.
function carrier(len, color) {
  const g = new THREE.Group();
  g.add(boxM(len * 0.13, 16, len, color, LINE.m));
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len * 0.24, 1.5, len * 1.02).translate(0, 17, 0), toon('#5c6168')); g.add(inked(deck, LINE.m));
  const island = boxM(10, 22, 34, color, LINE.s); island.position.set(len * 0.09, 17, len * 0.05); g.add(island);
  return g;
}
placeAt(carrier(300, '#8d949b'), 32.7137, -117.1751, -6, 0.05);
placeAt(carrier(330, '#7f878f'), 32.7035, -117.2015, -6, 1.45);
placeAt(carrier(330, '#7f878f'), 32.7049, -117.1935, -6, 1.5);
// Balboa Park: the California Tower and its blue-tiled dome.
{
  const g = new THREE.Group();
  const tower = boxM(14, 52, 14, '#f0e4c9', LINE.s); g.add(tower);
  const top = boxM(10, 14, 10, '#f0e4c9', LINE.s); top.position.y = 52; g.add(top);
  const dome = inked(new THREE.Mesh(new THREE.SphereGeometry(6.5, 16, 10, 0, TAU, 0, Math.PI / 2), toon('#3b8fc7')), LINE.s); dome.position.y = 66; g.add(dome);
  const hall = boxM(110, 16, 34, '#efe0c0', LINE.s); hall.position.set(-60, 0, 10); g.add(hall);
  const dome2 = inked(new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10, 0, TAU, 0, Math.PI / 2), toon('#e0a23a')), LINE.s); dome2.position.set(26, 16, 0); g.add(dome2);
  const wing = boxM(60, 16, 30, '#efe0c0', LINE.s); wing.position.set(40, 0, 0); g.add(wing);
  placeAt(g, 32.7316, -117.1525);
}
// Geisel Library: concrete trays stacked wider and wider, like a hand holding up books.
{
  const g = new THREE.Group();
  for (let n = 0; n < 7; n += 1) {
    const w = 32 + n * 9;
    const tier = boxM(w, 5.2, w, n % 2 ? '#3c4a58' : '#ece8de', LINE.s);
    tier.position.y = 8 + n * 5.4; tier.rotation.y = Math.PI / 4; g.add(tier);
  }
  const stem = boxM(18, 10, 18, '#ece8de', LINE.s); stem.rotation.y = Math.PI / 4; g.add(stem);
  placeAt(g, 32.8811, -117.2376);
}
// Hotel del Coronado: white walls, red roofs and the big red turret.
{
  const g = new THREE.Group();
  const main = boxM(190, 22, 70, '#f6f2ea', LINE.m); g.add(main);
  const roof = inked(new THREE.Mesh(new THREE.ConeGeometry(30, 36, 8).translate(0, 22 + 18, 0), toon('#c64a3c')), LINE.m); roof.position.x = -40; g.add(roof);
  for (const x of [40, 85, -85]) { const t = inked(new THREE.Mesh(new THREE.ConeGeometry(12, 16, 6).translate(0, 22 + 8, 0), toon('#c64a3c')), LINE.s); t.position.x = x; g.add(t); }
  placeAt(g, 32.6807, -117.1784, null, 0.3);
}
// Piers: Ocean Beach, Crystal Pier, Scripps.
for (const [lat, lng, len, rot] of [[32.7495, -117.2535, 600, 0], [32.7967, -117.2575, 270, -0.35], [32.8664, -117.2546, 330, -0.1]]) {
  const g = new THREE.Group();
  const deck = boxM(len, 2, 10, '#efe8d8', LINE.s); deck.position.set(-len / 2, 7, 0); g.add(deck);
  for (let x = 0; x < len; x += 40) { const post = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 2).translate(0, 0, 0), toon('#8a7a66')); post.position.set(-x, 1, 0); g.add(post); }
  placeAt(g, lat, lng, 0, rot);
}
// The runway at Lindbergh Field.
{
  const runTex = tex(512, 32, (g, w, h) => { g.fillStyle = '#4a4c52'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f1e8'; for (let x = 20; x < w - 20; x += 26) g.fillRect(x, h / 2 - 1.5, 13, 3); g.fillRect(4, 4, 10, h - 8); g.fillRect(w - 14, 4, 10, h - 8); });
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(2865, 60).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: runTex, gradientMap: tones, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  placeAt(rw, 32.7336, -117.1897, null, -0.1);
  rw.position.y += 1.2;
}
// Sailboats on the bays.
{
  const hull = new THREE.BoxGeometry(5, 2, 14); const sail = new THREE.ConeGeometry(4, 18, 3).translate(0, 10, 0);
  const g = new THREE.Group();
  const r = rng(5); const hm = toon('#f7f4ec'); const sm = toon('#fffdf6');
  for (let n = 0; n < 80; n += 1) {
    const x = lerp(X_MIN, X_MAX, r()); const z = lerp(Z_MIN, Z_MAX, r());
    if (hAt(x, z) > -3 || hAt(x + 60, z) > -1 || hAt(x - 60, z) > -1) continue;
    const b = new THREE.Group(); b.add(new THREE.Mesh(hull, hm)); b.add(new THREE.Mesh(sail, sm));
    b.position.set(x, 1, z); b.rotation.y = r() * TAU; b.scale.setScalar(2.2); g.add(b);
  }
  scene.add(g);
}

// ---------- Clouds: big painted cumulus, and you can punch straight through them ----------
const puffs = [];
{
  const r = rng(23);
  for (let c = 0; c < 34; c += 1) {
    const cx = lerp(PLAY.x0 - 4000, PLAY.x1 + 4000, r()); const cz = lerp(PLAY.z0 - 4000, PLAY.z1 + 4000, r()); const cy = 1100 + r() * 900;
    const n = 6 + ((r() * 6) | 0);
    for (let i = 0; i < n; i += 1) {
      const rad = 110 + r() * 170;
      puffs.push([cx + (r() - 0.5) * 520, cy + (r() - 0.3) * 120 + rad * 0.2, cz + (r() - 0.5) * 380, rad]);
    }
  }
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const mesh = new THREE.InstancedMesh(geo, toon('#ffffff', { emissive: new THREE.Color('#9fb6cc'), emissiveIntensity: 0.35 }), puffs.length);
  const line = new THREE.InstancedMesh(geo, lineMat(0.025, 520), puffs.length);
  const m = new THREE.Matrix4();
  puffs.forEach(([x, y, z, rad], i) => { m.makeScale(rad, rad * 0.72, rad).setPosition(x, y, z); mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
  mesh.computeBoundingSphere(); line.computeBoundingSphere();
  scene.add(mesh); scene.add(line);
}

// ---------- The courts: real courts on the ground, a pillar of light over each ----------
const courtTex = tex(256, 128, (g, w, h) => {
  g.fillStyle = '#4f8a5b'; g.fillRect(0, 0, w, h);
  const x0 = w * 0.16; const x1 = w * 0.84; const y0 = h * 0.2; const y1 = h * 0.8;
  g.fillStyle = '#3d6fa8'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = '#fbfaf3'; g.lineWidth = 2.4; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  const sy = (y1 - y0) * 0.125;
  g.beginPath(); g.moveTo(x0, y0 + sy); g.lineTo(x1, y0 + sy); g.moveTo(x0, y1 - sy); g.lineTo(x1, y1 - sy);
  const sx = (x1 - x0) * 0.27; g.moveTo(x0 + sx, y0 + sy); g.lineTo(x0 + sx, y1 - sy); g.moveTo(x1 - sx, y0 + sy); g.lineTo(x1 - sx, y1 - sy);
  g.moveTo(x0 + sx, h / 2); g.lineTo(x1 - sx, h / 2); g.stroke();
  g.strokeStyle = '#16181d'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, y0 - 6); g.lineTo(w / 2, y1 + 6); g.stroke();
});
const beamMat = (color) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uFade: { value: 1 } },
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform vec3 uColor; uniform float uTime, uFade; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float band = step(0.55, fract(vUv.y * 26.0 - uTime * 0.8));
  float a = pow(1.0 - vUv.y, 1.6) * (0.28 + 0.5 * rim + 0.18 * band) * uFade;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35 * (1.0 - rim)) * a, a);
#include <colorspace_fragment>
}`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});
const beams = [];
function buildVenues() {
  for (const v of VENUES) {
    const g = new THREE.Group();
    g.position.set(v.x, v.y, v.z);
    const mpu = v.metersPerUnit || 25;
    for (const c of v.courts || []) {
      const L = c.w * mpu; const W = c.d * mpu;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.47, W * 1.67).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: courtTex, gradientMap: tones, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
      pad.position.set(c.x * mpu, 0.6, c.z * mpu); pad.rotation.y = -(c.rot || 0) + Math.PI / 2;
      g.add(pad);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 2600, 24, 1, true).translate(0, 1300, 0), beamMat(v.accent || '#e2562f'));
    g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(150, 168, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(v.accent || '#e2562f'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    ring.position.y = 1.5; g.add(ring);
    scene.add(g);
    beams.push({ v, beam, ring, g });
  }
}
buildVenues();

// ---------- You ----------
const you = { carrier: new THREE.Group(), body: null, cast: null, color: '#d7f205', name: 'YOU' };
scene.add(you.carrier);
const youLine = lineMat(0.035);
function setYou(f) {
  if (!f) return;
  you.color = f.color || you.color; you.name = f.name || you.name;
  if (you.body && you.cast === f.cast) { you.body.setColor(you.color); return; }
  if (you.body) you.carrier.remove(you.body.group);
  // No transmission: it would redraw the whole city a second time every frame.
  you.body = new SoftBody({ cast: f.cast || 'wall', color: you.color, edge: 0.13, transmission: 0 });
  inked(you.body.mesh, youLine);
  you.carrier.add(you.body.group);
  you.cast = f.cast;
  setAura(you.color);
}

// ---------- The ki aura ----------
const NOISE = `vec3 m289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;} vec4 m289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 perm(vec4 x){return m289(((x*34.0)+1.0)*x);} vec4 tis(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){ const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
 vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx); vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=m289(i);
 vec4 p=perm(perm(perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
 float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
 vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
 vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3))); }`;
// A shell round the body: a teardrop that streams away from where you're going, licked into flame tongues by noise,
// cut into flat cel bands like the anime.
const auraMat = (scale, core, rimPow) => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uPower: { value: 0.4 }, uStretch: { value: 0 }, uDir: { value: new V3(0, 1, 0) }, uScale: { value: scale }, uColor: { value: new THREE.Color('#ffffff') }, uCore: { value: new THREE.Color(core) }, uRim: { value: rimPow } },
  vertexShader: `${NOISE}
uniform float uTime, uPower, uStretch, uScale; uniform vec3 uDir; varying vec3 vN; varying vec3 vV; varying float vTail; varying vec3 vP;
void main(){
  vec3 n = normalize(position);
  float along = dot(n, uDir); float tail = max(along, 0.0);
  vec3 p = position;
  vec3 axial = uDir * dot(p, uDir); vec3 perp = p - axial;
  p = axial + perp * (1.0 - 0.5 * tail * tail * (0.4 + uStretch));
  p += uDir * tail * tail * (0.45 + 1.5 * uStretch);
  float f = snoise(n * 2.2 - uDir * uTime * 3.4 + vec3(0.0, uTime * 0.7, 0.0));
  p += n * (0.5 + 0.5 * f) * (0.1 + 0.5 * tail) * (0.35 + 0.65 * uPower);
  p *= uScale;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * n); vV = -mv.xyz; vTail = tail; vP = n;
  gl_Position = projectionMatrix * mv;
}`,
  fragmentShader: `${NOISE}
uniform float uTime, uPower, uRim; uniform vec3 uColor, uCore, uDir; varying vec3 vN; varying vec3 vV; varying float vTail; varying vec3 vP;
void main(){
  float fr = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float tongues = snoise(vP * 5.0 - uDir * uTime * 7.0);
  float a = smoothstep(0.4, 0.88, pow(fr, uRim) + tongues * 0.3 + vTail * 0.12) * uPower;
  a = floor(a * 3.0 + 0.3) / 3.0;
  vec3 c = mix(uCore, uColor, smoothstep(0.5, 0.9, fr));
  gl_FragColor = vec4(c * a * 0.62, a * 0.62);
#include <colorspace_fragment>
}`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
});
const auraGeo = new THREE.SphereGeometry(1, 40, 28);
const aura = { inner: new THREE.Mesh(auraGeo, auraMat(1.35, '#fffef2', 1.6)), outer: new THREE.Mesh(auraGeo, auraMat(1.95, '#ffffff', 1.1)), color: new THREE.Color('#ffffff'), gold: new THREE.Color('#ffd23a') };
aura.inner.renderOrder = 5; aura.outer.renderOrder = 4;
aura.inner.frustumCulled = aura.outer.frustumCulled = false;
scene.add(aura.inner); scene.add(aura.outer);
function setAura(hex) {
  // The aura is the fighter's color pushed toward light, so a dark fighter still burns bright.
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  aura.color.setHSL(hsl.h, Math.max(0.65, hsl.s), clamp(hsl.l, 0.55, 0.68));
  document.documentElement.style.setProperty('--acc', `#${aura.color.getHexString(THREE.SRGBColorSpace)}`);
}
setAura('#d7f205');

// Points (ki flames, spray, dust), drawn as flat cel discs that shrink as they die.
const pointMat = (additive) => new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 600 } },
  vertexShader: `attribute float aSize; attribute float aA; attribute vec3 aC; uniform float uPx; varying float vA; varying vec3 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aSize * uPx / -mv.z, 0.0, 90.0); vA = aA; vC = aC; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; varying vec3 vC;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5 || vA <= 0.01) discard;
  float a = vA * (r < 0.32 ? 1.0 : 0.55);
  gl_FragColor = ${additive ? 'vec4(vC * a, a)' : 'vec4(vC, a)'};
#include <colorspace_fragment>
}`,
  transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
});
function pool(n, additive) {
  const p = { n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), size: new Float32Array(n), s0: new Float32Array(n), a: new Float32Array(n), c: new Float32Array(n * 3), drag: new Float32Array(n), grav: new Float32Array(n), next: 0 };
  const g = new THREE.BufferGeometry();
  p.draw = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(p.draw, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(p.size, 1));
  g.setAttribute('aA', new THREE.BufferAttribute(p.a, 1));
  g.setAttribute('aC', new THREE.BufferAttribute(p.c, 3));
  p.geo = g; p.mat = pointMat(additive);
  p.points = new THREE.Points(g, p.mat); p.points.frustumCulled = false;
  scene.add(p.points);
  return p;
}
function emit(p, x, y, z, vx, vy, vz, size, life, color, drag = 0, grav = 0) {
  const i = p.next; p.next = (p.next + 1) % p.n;
  p.pos[i * 3] = x; p.pos[i * 3 + 1] = y; p.pos[i * 3 + 2] = z;
  p.vel[i * 3] = vx; p.vel[i * 3 + 1] = vy; p.vel[i * 3 + 2] = vz;
  p.life[i] = life; p.max[i] = life; p.s0[i] = size; p.drag[i] = drag; p.grav[i] = grav;
  p.c[i * 3] = color.r; p.c[i * 3 + 1] = color.g; p.c[i * 3 + 2] = color.b;
}
function stepPool(p, dt) {
  for (let i = 0; i < p.n; i += 1) {
    if (p.life[i] <= 0) continue;
    p.life[i] -= dt;
    const k = Math.exp(-p.drag[i] * dt);
    p.vel[i * 3] *= k; p.vel[i * 3 + 1] = p.vel[i * 3 + 1] * k - p.grav[i] * dt; p.vel[i * 3 + 2] *= k;
    p.pos[i * 3] += p.vel[i * 3] * dt; p.pos[i * 3 + 1] += p.vel[i * 3 + 1] * dt; p.pos[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
  }
}
function drawPool(p, origin) {
  for (let i = 0; i < p.n; i += 1) {
    const t = p.life[i] > 0 ? p.life[i] / p.max[i] : 0;
    p.a[i] = t > 0 ? Math.min(1, t * 2.2) : 0;
    p.size[i] = p.s0[i] * (0.35 + 0.65 * t);
    p.draw[i * 3] = p.pos[i * 3] + (origin ? origin.x : 0); p.draw[i * 3 + 1] = p.pos[i * 3 + 1] + (origin ? origin.y : 0); p.draw[i * 3 + 2] = p.pos[i * 3 + 2] + (origin ? origin.z : 0);
  }
  for (const k of ['position', 'aSize', 'aA', 'aC']) p.geo.attributes[k].needsUpdate = true;
}
const flames = pool(160, true); // ride with you (positions relative to the body)
const world = pool(700, false); // spray, dust, debris, left in the world

// The ki streak: a ribbon of light along where you've been.
const TRAIL = 46;
const trail = { pts: Array.from({ length: TRAIL }, () => new V3()), n: 0 };
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3));
trailGeo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(TRAIL * 2), 1));
{ const idx = []; for (let i = 0; i < TRAIL - 1; i += 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trailMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color('#ffffff') } },
  vertexShader: 'attribute float aA; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aA * smoothstep(18.0, 60.0, -mv.z); gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float a = floor(vA * 3.0 + 0.5) / 3.0 * 0.55; gl_FragColor = vec4(mix(uColor, vec3(1.0), a * 0.5) * a, a);
#include <colorspace_fragment>
}`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});
const trailMesh = new THREE.Mesh(trailGeo, trailMat); trailMesh.frustumCulled = false; scene.add(trailMesh);

// Shockwaves (each launch), the vapor cone (breaking the sound barrier), and lightning (past nine thousand).
const rings = Array.from({ length: 6 }, () => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 72), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.visible = false; m.userData = { t: 1, dur: 0.7, size: 60 }; scene.add(m); return m;
});
function shockwave(at, normal, size = 60, dur = 0.7, color = 0xffffff) {
  const m = rings.find((r) => r.userData.t >= 1) || rings[0];
  m.position.copy(at); m.quaternion.setFromUnitVectors(new V3(0, 0, 1), normal.clone().normalize());
  m.material.color.set(color);
  m.userData = { t: 0, dur, size }; m.visible = true;
}
const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1.7, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
cone.userData.t = 1; scene.add(cone);
const BOLTS = 7; const BSEG = 7;
const bolts = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLTS * BSEG * 2 * 3), 3)), new THREE.LineBasicMaterial({ color: 0xcff4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
bolts.frustumCulled = false; bolts.visible = false; scene.add(bolts);

// ---------- Screen layers: speed lines, flashes, tags ----------
const lines = $('lines'); const lg = lines.getContext('2d');
const flash = $('flash');
const tagsEl = $('tags');
const vtags = VENUES.map((v) => {
  const el = document.createElement('div'); el.className = 'vtag'; el.style.setProperty('--c', v.accent || '#e2562f');
  el.innerHTML = `<i></i><b>${v.short || v.name}</b><small></small>`;
  tagsEl.appendChild(el);
  return { v, el, km: el.querySelector('small') };
});
const rtags = PLACES.map((p) => { const el = document.createElement('div'); el.className = 'rtag'; el.textContent = p.name; tagsEl.appendChild(el); return { p, el }; });

// ---------- State ----------
const st = {
  pos: new V3(), vel: new V3(), acc: new V3(), yaw: 0, pitch: 0, lean: { x: 0, v: 0 }, bank: 0, face: { x: 0, v: 0 },
  blast: false, rise: false, wasBlast: false, wasRise: false, blastT: 0, sinceBlast: 9, super: false, power: 0.4, flare: 0,
  stick: { on: false, x: 0, y: 0, ox: 0, oy: 0, id: null }, keys: new Set(),
  clock: 0, shake: 0, flash: 0, mach: false, landing: null, near: null, touched: false, edge: false,
  camOff: new V3(0, 3, 9), camVel: new V3(), ki: 0, nineAt: -9, boltAt: 0, cloud: 0, lastTrail: new V3(),
};
const UP = new V3(0, 1, 0);
const fwd = (yaw, pitch, out = new V3()) => out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
function startAt(v) {
  const x = v ? v.x : gx(-117.2); const z = v ? v.z + 900 : gz(32.8);
  st.pos.set(x, Math.max(hAt(x, z), 0) + 220, z);
  st.vel.set(0, 0, 0); st.yaw = 0; st.pitch = 0; st.flare = 1;
  st.camOff.set(0, 3, 9); st.camVel.set(0, 0, 0);
  for (const p of trail.pts) p.copy(st.pos);
  if (typeof hunt !== 'undefined') hunt.last.copy(st.pos);
}

// ---------- Sound: the aura's hum and crackle, the wind, the booms (WebAudio, started by your first touch) ----------
let ac = null; let au = null;
function audioOn() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; return; }
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i += 1) ch[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.value = 400;
  const wind = ac.createGain(); wind.gain.value = 0;
  noise.connect(bp); bp.connect(wind); wind.connect(ac.destination);
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
  const crack = ac.createGain(); crack.gain.value = 0;
  noise.connect(hp); hp.connect(crack); crack.connect(ac.destination);
  const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
  const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 58.5;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
  const hum = ac.createGain(); hum.gain.value = 0;
  o1.connect(lp); o2.connect(lp); lp.connect(hum); hum.connect(ac.destination);
  noise.start(); o1.start(); o2.start();
  au = { buf, bp, wind, crack, o1, o2, lp, hum };
}
function audioFrame(sf) {
  if (!au) return;
  const t = ac.currentTime;
  au.wind.gain.setTargetAtTime(0.015 + 0.2 * sf, t, 0.12);
  au.bp.frequency.setTargetAtTime(280 + 1700 * sf, t, 0.12);
  au.hum.gain.setTargetAtTime(0.035 * st.power + (st.super ? 0.03 : 0), t, 0.08);
  au.lp.frequency.setTargetAtTime(200 + 700 * st.power + (st.super ? 500 : 0), t, 0.1);
  const base = st.super ? 82 : 55;
  au.o1.frequency.setTargetAtTime(base, t, 0.2); au.o2.frequency.setTargetAtTime(base * 1.064, t, 0.2);
  au.crack.gain.setTargetAtTime(st.power > 0.85 && Math.random() < 0.35 ? 0.06 + (st.super ? 0.06 : 0) : 0, t, 0.01);
}
function boom(strength = 1) {
  if (!au) return;
  const src = ac.createBufferSource(); src.buffer = au.buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160 + 300 * strength;
  const g = ac.createGain(); const t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * strength, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 + 0.6 * strength);
  src.connect(lp); lp.connect(g); g.connect(ac.destination);
  src.start(t, Math.random()); src.stop(t + 1.3);
}

// ---------- Touch: drag anywhere to steer; the pads rocket you ----------
const stickEl = $('stick'); const knob = stickEl.querySelector('i');
function firstTouch() { audioOn(); if (!st.touched) { st.touched = true; $('hint').style.opacity = '0'; } }
function pad(el, on, off) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); firstTouch(); el.setPointerCapture(e.pointerId); el.classList.add('on'); on(); });
  const up = (e) => { e.stopPropagation(); el.classList.remove('on'); off(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
}
pad($('blast'), () => { st.blast = true; }, () => { st.blast = false; });
pad($('rise'), () => { st.rise = true; }, () => { st.rise = false; });
const landBtn = $('land');
landBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); landBtn.classList.add('on'); post({ type: 'press' }); });
landBtn.addEventListener('pointerup', (e) => { e.stopPropagation(); landBtn.classList.remove('on'); if (st.near && !st.landing && !DR.on) startLanding(st.near); });
landBtn.addEventListener('pointercancel', () => landBtn.classList.remove('on'));
// One finger steers; two fingers held down charge the Kamehameha (slide them to aim), and lifting one fires it.
const touches = new Map();
const midpoint = () => { let x = 0; let y = 0; for (const t of touches.values()) { x += t.x; y += t.y; } return { x: x / touches.size, y: y / touches.size }; };
const stickOff = () => { st.stick = { on: false, x: 0, y: 0, ox: 0, oy: 0, id: null }; stickEl.classList.remove('on'); };
window.addEventListener('pointerdown', (e) => {
  if (st.landing || DR.on) return;
  firstTouch();
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && !kame.charging && !kame.beam) { stickOff(); startCharge(midpoint()); return; }
  if (st.stick.id !== null || kame.charging) return;
  st.stick = { on: true, x: 0, y: 0, ox: e.clientX, oy: e.clientY, id: e.pointerId };
  stickEl.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; stickEl.classList.add('on'); knob.style.transform = '';
});
window.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (kame.charging && touches.size >= 2) { const m = midpoint(); aimCharge(m.x - kame.mid.x, m.y - kame.mid.y); return; }
  if (e.pointerId !== st.stick.id) return;
  let dx = e.clientX - st.stick.ox; let dy = e.clientY - st.stick.oy;
  const l = Math.hypot(dx, dy); const R = 56;
  if (l > R) { dx *= R / l; dy *= R / l; }
  st.stick.x = dx / R; st.stick.y = dy / R;
  knob.style.transform = `translate(${dx}px,${dy}px)`;
});
const stickUp = (e) => {
  touches.delete(e.pointerId);
  if (kame.charging && touches.size < 2) release();
  if (e.pointerId === st.stick.id) stickOff();
};
window.addEventListener('pointerup', stickUp); window.addEventListener('pointercancel', stickUp);
// Keys, for the desk: arrows or WASD steer, space blasts, shift rises, hold K to charge the Kamehameha.
window.addEventListener('keydown', (e) => {
  st.keys.add(e.key.toLowerCase()); if (e.key === ' ') st.blast = true; if (e.key === 'Shift') st.rise = true; firstTouch();
  if (e.key.toLowerCase() === 'k' && !kame.charging && !kame.beam && !e.repeat) startCharge({ x: 0, y: 0 });
});
window.addEventListener('keyup', (e) => {
  st.keys.delete(e.key.toLowerCase()); if (e.key === ' ') st.blast = false; if (e.key === 'Shift') st.rise = false;
  if (e.key.toLowerCase() === 'k' && kame.charging) release();
});

// ---------- Landing on a court ----------
function startLanding(v) {
  const target = new V3(v.x, v.y + 1.4, v.z);
  const from = st.pos.clone();
  const d = from.distanceTo(target);
  st.landing = { v, t: 0, from, target, ctrl: new V3((from.x + target.x) / 2, Math.max(from.y, target.y) + Math.min(350, d * 0.35), (from.z + target.z) / 2), dur: clamp(d / 420, 1.2, 2.6), hit: false, done: 0 };
  st.blast = false; st.rise = false;
  post({ type: 'landing', id: v.id });
  boom(0.5); st.flare = 1;
}
function stepLanding(dt) {
  const L = st.landing; L.t += dt;
  const u = clamp(L.t / L.dur, 0, 1);
  const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  const a = L.from.clone().lerp(L.ctrl, e); const b = L.ctrl.clone().lerp(L.target, e);
  const p = a.lerp(b, e);
  st.vel.copy(p).sub(st.pos).divideScalar(Math.max(dt, 1e-4));
  st.pos.copy(p);
  const dx = L.target.x - st.pos.x; const dz = L.target.z - st.pos.z;
  if (Math.hypot(dx, dz) > 30) st.yaw = Math.atan2(-dx, -dz);
  if (u >= 1 && !L.hit) {
    L.hit = true; st.vel.set(0, 0, 0);
    // The landing: a crater ring, the dust going up, the ground shaking.
    shockwave(st.pos.clone().add(new V3(0, 0.6, 0)), UP, 140, 0.9);
    shockwave(st.pos.clone().add(new V3(0, 0.6, 0)), UP, 60, 0.5, new THREE.Color(L.v.accent || '#ffffff'));
    for (let i = 0; i < 90; i += 1) {
      const ang = Math.random() * TAU; const sp = 20 + Math.random() * 60;
      emit(world, st.pos.x, st.pos.y, st.pos.z, Math.cos(ang) * sp, 8 + Math.random() * 30, Math.sin(ang) * sp, 6 + Math.random() * 12, 1.2 + Math.random(), DUST, 2.2, 9);
    }
    st.shake = 1.4; st.flash = 0.7; boom(1.2);
    post({ type: 'thud' });
    if (you.body) you.body.kick(0, -9, 0);
  }
  if (L.hit) { L.done += dt; if (L.done > 1.3 && !L.sent) { L.sent = true; post({ type: 'arrive', id: L.v.id, key: L.v.key }); } }
}

// ---------- The step ----------
const DUST = new THREE.Color('#cdb38a'); const SPRAY = new THREE.Color('#f4fbff'); const tmp = new V3(); const tmp2 = new V3();
const prevVel = new V3();
function step(dt) {
  st.clock += dt;
  for (const k of [seaMat, ...beams.map((b) => b.beam.material), aura.inner.material, aura.outer.material]) k.uniforms.uTime.value = st.clock;
  prevVel.copy(st.vel);
  const sp0 = st.vel.length();
  const sf = clamp(sp0 / 950, 0, 1);

  if (st.landing) stepLanding(dt);
  else if (DR.on) { /* the dragon has the stage */ }
  else {
    // Input: the stick, or the keys.
    let sx = st.stick.x; let sy = st.stick.y; let steering = st.stick.on;
    const K = st.keys;
    if (K.has('a') || K.has('arrowleft')) { sx = -1; steering = true; }
    if (K.has('d') || K.has('arrowright')) { sx = 1; steering = true; }
    if (K.has('w') || K.has('arrowup')) { sy = -1; steering = true; }
    if (K.has('s') || K.has('arrowdown')) { sy = 1; steering = true; }
    st.yaw -= sx * lerp(1.7, 0.9, sf) * dt;
    const pitchT = steering ? -sy * (st.blast ? 0.95 : 1.2) : 0;
    if (!kame.charging) st.pitch += (pitchT - st.pitch) * (1 - Math.exp(-4 * dt));
    st.bank += (-sx * lerp(0.25, 0.75, sf) - st.bank) * (1 - Math.exp(-5 * dt));
    // The edge of the map turns you back toward the city.
    const out = st.pos.x < PLAY.x0 || st.pos.x > PLAY.x1 || st.pos.z < PLAY.z0 || st.pos.z > PLAY.z1;
    if (out) {
      const cx = (PLAY.x0 + PLAY.x1) / 2 - st.pos.x; const cz = (PLAY.z0 + PLAY.z1) / 2 - st.pos.z;
      let dy = Math.atan2(-cx, -cz) - st.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      st.yaw += clamp(dy, -1, 1) * 1.6 * dt;
    }
    st.edge = out;

    const f = fwd(st.yaw, st.pitch, tmp);
    let speed = 0;
    if (kame.charging) speed = 0;
    else if (st.blast) speed = st.super ? 1500 : 950;
    else if (steering) speed = 80;
    const desired = tmp2.copy(f).multiplyScalar(speed);
    if (st.rise && !kame.charging) { desired.multiplyScalar(0.35); desired.y += st.super ? 650 : 420; }
    const k = st.blast || st.rise ? 2.3 : steering ? 1.8 : 1.3;
    st.vel.lerp(desired, 1 - Math.exp(-k * dt));
    st.pos.addScaledVector(st.vel, dt);

    // The ground (and the water) is a floor you can skim; slam into it and it shows.
    const floor = Math.max(hAt(st.pos.x, st.pos.z), 0) + 1.6;
    if (st.pos.y < floor) {
      if (st.vel.y < -60) impact(Math.min(1.5, -st.vel.y / 300));
      st.pos.y = floor; st.vel.y = Math.max(0, st.vel.y);
      if (st.pitch < 0) st.pitch *= 0.8;
    }
    if (st.pos.y > 5200) { st.pos.y = 5200; st.vel.y = Math.min(0, st.vel.y); }

    // Launches: a shockwave ring, a kick to the jelly, a thump.
    if (st.blast && !st.wasBlast) {
      shockwave(st.pos.clone(), f, 50, 0.6, aura.color); st.shake = Math.max(st.shake, 0.5); st.flash = 0.25; st.flare = 1;
      post({ type: 'blast' }); boom(0.45);
      if (you.body) you.body.kick(0, 0, 6);
    }
    if (st.rise && !st.wasRise) {
      const low = st.pos.y - floor < 80;
      shockwave(st.pos.clone().add(new V3(0, -1, 0)), UP, low ? 110 : 50, low ? 0.9 : 0.6, aura.color);
      if (low) for (let i = 0; i < 60; i += 1) { const ang = Math.random() * TAU; const s = 30 + Math.random() * 50; const ground = Math.max(hAt(st.pos.x, st.pos.z), 0); emit(world, st.pos.x, ground + 1, st.pos.z, Math.cos(ang) * s, 4 + Math.random() * 14, Math.sin(ang) * s, 5 + Math.random() * 9, 1 + Math.random() * 0.8, ground > 0.5 ? DUST : SPRAY, 2.5, 8); }
      st.shake = Math.max(st.shake, low ? 0.9 : 0.4); st.flash = 0.2; st.flare = 1;
      post({ type: 'rise' }); boom(low ? 0.9 : 0.35);
      if (you.body) you.body.kick(0, -7, 0);
    }
    st.wasBlast = st.blast; st.wasRise = st.rise;
    if (st.blast) { st.blastT += dt; st.sinceBlast = 0; } else { st.sinceBlast += dt; if (st.sinceBlast > 0.3) st.blastT = Math.max(0, st.blastT - dt * 2); }
    // Hold the blast long enough and you go past nine thousand: the aura turns gold and crackles.
    if (!st.super && st.blastT > 2.6) { st.super = true; st.nineAt = st.clock; st.flash = 0.8; st.shake = 1.1; shockwave(st.pos.clone(), f, 120, 0.9, aura.gold); post({ type: 'super' }); boom(1); document.body.classList.add('super'); }
    if (st.super && st.sinceBlast > 1.4) { st.super = false; document.body.classList.remove('super'); }

    // The courts: get close and you can land.
    let best = null; let bd = Infinity;
    for (const v of VENUES) { const d = Math.hypot(v.x - st.pos.x, v.z - st.pos.z); if (d < bd) { bd = d; best = v; } }
    const nowNear = best && bd < 750 && st.pos.y - best.y < 1200 ? best : null;
    if (nowNear !== st.near) { st.near = nowNear; if (nowNear) post({ type: 'near', id: nowNear.id }); }
  }

  stepHunt(dt);
  stepKame(dt);
  const sp = st.vel.length();
  st.acc.copy(st.vel).sub(prevVel).divideScalar(dt);
  // The sound barrier.
  if (sp > 343 && !st.mach) { st.mach = true; cone.userData.t = 0; boom(1.1); st.shake = Math.max(st.shake, 0.8); post({ type: 'boom' }); }
  if (sp < 290) st.mach = false;

  // Power: how hard the aura burns.
  const steeringNow = st.stick.on || st.keys.size > 0;
  const powerT = kame.charging ? 0.55 + 0.4 * Math.min(1, kame.t / FULL) : st.landing ? 1 : st.super ? 1.15 : st.blast ? 1 : st.rise ? 0.9 : steeringNow ? 0.55 : 0.38;
  st.power += (powerT + st.flare * 0.4 - st.power) * (1 - Math.exp(-6 * dt));
  st.flare = Math.max(0, st.flare - dt * 1.6);
  st.ki = st.blast ? Math.min(st.super ? 9001 + Math.floor((st.clock * 777) % 900) : 8999, st.ki + dt * (3200 + st.ki * 1.1)) : Math.max(0, st.ki - dt * 6000);

  // Ki flames ride along with you, streaming away from where you're going.
  const dir = sp > 25 ? tmp.copy(st.vel).multiplyScalar(-1 / sp) : tmp.set(0, 1, 0);
  const rate = 50 + 160 * st.power;
  const nEmit = Math.floor(rate * dt + Math.random());
  const fc = st.super || st.gold ? aura.gold : aura.color;
  for (let i = 0; i < nEmit; i += 1) {
    const a = Math.random() * TAU; const b = Math.acos(2 * Math.random() - 1); const r = 0.8 + Math.random() * 0.5;
    const ox = Math.sin(b) * Math.cos(a) * r; const oy = Math.cos(b) * r; const oz = Math.sin(b) * Math.sin(a) * r;
    const s = 2 + 4.5 * st.power;
    emit(flames, ox, oy, oz, dir.x * s + ox * 0.8, dir.y * s + oy * 0.8 + (sp < 25 ? 1.5 : 0), dir.z * s + oz * 0.8, 0.18 + Math.random() * 0.22 * st.power, 0.18 + Math.random() * 0.22, Math.random() < 0.12 ? SPRAY : fc, 1.5, 0);
  }
  stepPool(flames, dt);
  // Skimming the water throws spray; skimming the ground kicks up dust.
  const ground = Math.max(hAt(st.pos.x, st.pos.z), 0);
  const alt = st.pos.y - ground;
  if (alt < 30 && sp > 60) {
    const n = Math.floor((sp / 40) * dt * 30 * (1 - alt / 30) + Math.random());
    const wet = hAt(st.pos.x, st.pos.z) < 0.3;
    for (let i = 0; i < n; i += 1) {
      const side = Math.random() < 0.5 ? -1 : 1; const s = 8 + Math.random() * 20;
      emit(world, st.pos.x + (Math.random() - 0.5) * 4, ground + 0.5, st.pos.z + (Math.random() - 0.5) * 4, st.vel.z * 0.0 + side * -st.vel.z / sp * s, 10 + Math.random() * (wet ? 28 : 12), side * st.vel.x / sp * s, wet ? 2 + Math.random() * 3.5 : 3 + Math.random() * 5, 0.8 + Math.random() * 0.7, wet ? SPRAY : DUST, 1.2, 14);
    }
  }
  stepPool(world, dt);

  // Rings, the cone.
  for (const m of rings) {
    const u = m.userData; if (u.t >= 1) { m.visible = false; continue; }
    u.t = Math.min(1, u.t + dt / u.dur);
    const e = 1 - (1 - u.t) ** 3;
    m.scale.setScalar(2 + u.size * e); m.material.opacity = (1 - u.t) ** 1.5;
  }
  if (cone.userData.t < 1) cone.userData.t = Math.min(1, cone.userData.t + dt / 0.55);

  // The jelly feels the flight: it lags behind each push and wobbles out of each turn.
  if (you.body) {
    const q = you.carrier.quaternion.clone().invert();
    const la = tmp2.copy(st.acc).applyQuaternion(q).multiplyScalar(0.0035);
    la.clampLength(0, 40);
    you.body.shove(la.x, la.y, la.z, dt);
  }

  // Trail samples.
  if (st.pos.distanceTo(st.lastTrail) > 3 + sp * 0.012) {
    st.lastTrail.copy(st.pos);
    const last = trail.pts.pop(); last.copy(st.pos); trail.pts.unshift(last);
  }
  trail.pts[0].copy(st.pos);

  // Camera rig: behind and above, swinging wider as you go faster.
  const fl = tmp.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
  const dist = lerp(10.5, 15, sf) + (st.landing ? 12 : 0);
  const h = lerp(3.2, 4.2, sf) + (st.rise ? -1.2 : 0) + (st.landing ? 8 : 0);
  const target = tmp2.copy(fl).multiplyScalar(-dist).addScaledVector(UP, h);
  // Firing, the camera pulls back and up behind you, looking down the beam's line to where it lands.
  if (kame.beam) target.set(Math.cos(st.yaw), 0, -Math.sin(st.yaw)).multiplyScalar(9).addScaledVector(fl, -38).addScaledVector(UP, 20);
  target.addScaledVector(st.acc, -0.0018);
  const w = 2.2 * TAU; const z = 0.9;
  st.camVel.addScaledVector(target.clone().sub(st.camOff), w * w * dt).multiplyScalar(Math.exp(-2 * z * w * dt));
  st.camOff.addScaledVector(st.camVel, dt);
  st.shake = Math.max(0, st.shake - dt * 2.2);
  st.flash = Math.max(0, st.flash - dt * 2.5);
}

function impact(strength) {
  const g = Math.max(hAt(st.pos.x, st.pos.z), 0);
  shockwave(new V3(st.pos.x, g + 0.8, st.pos.z), UP, 60 + 80 * strength, 0.8);
  const wet = g < 0.3;
  for (let i = 0; i < 40 * strength + 10; i += 1) { const a = Math.random() * TAU; const s = 15 + Math.random() * 45 * strength; emit(world, st.pos.x, g + 1, st.pos.z, Math.cos(a) * s, 6 + Math.random() * 30 * strength, Math.sin(a) * s, 4 + Math.random() * 9, 1 + Math.random(), wet ? SPRAY : DUST, 2.2, 10); }
  st.shake = Math.max(st.shake, 0.6 + strength * 0.5); boom(0.6 + strength * 0.4);
  post({ type: 'thud' });
  if (you.body) you.body.kick(0, -6 * strength, 0);
}

// ---------- Drawing (once a frame) ----------
const proj = new V3();
function pose() {
  const sp = st.vel.length(); const sf = clamp(sp / 950, 0, 1);
  // Body: hovering, it turns round to face you; moving, it turns away and flies head first, face down, like Superman, so you
  // ride behind its back. It banks into turns.
  const horiz = Math.hypot(st.vel.x, st.vel.z);
  const flightPitch = Math.atan2(st.vel.y, horiz);
  const flying = smooth(15, 180, sp);
  const leanT = clamp(flying * (Math.PI / 2 - flightPitch) * 0.92, 0, 1.45);
  st.lean.x += (leanT - st.lean.x) * 0.12;
  // The turn: a quick spring with a little overshoot, so it whips round when you take off.
  const moving = kame.charging || !!kame.beam || sp > 22 || st.blast || st.rise || st.stick.on || st.keys.size > 0 || (st.landing && !st.landing.hit);
  const fw = 3.2 * TAU; const dtp = 1 / 60;
  st.face.v += ((moving ? 1 : 0) - st.face.x) * fw * fw * dtp - 2 * 0.55 * fw * st.face.v * dtp;
  st.face.x += st.face.v * dtp;
  const away = clamp(st.face.x, -0.15, 1.15);
  const bob = (1 - flying) * Math.sin(st.clock * 2.1) * 0.25;
  you.carrier.position.set(st.pos.x, st.pos.y + bob, st.pos.z);
  you.carrier.rotation.set(st.lean.x * (2 * clamp(away, 0, 1) - 1), st.yaw + Math.PI * away, st.bank * (1 - 2 * clamp(away, 0, 1)), 'YXZ');
  if (you.body) you.body.update(1 / 60, st.clock);

  // Aura.
  const dir = sp > 25 ? tmp.copy(st.vel).multiplyScalar(-1 / sp) : tmp.set(0, 1, 0);
  dir.lerp(UP, 1 - smooth(25, 140, sp)).normalize();
  const auraCol = st.super || st.gold ? aura.gold : aura.color;
  for (const m of [aura.inner, aura.outer]) {
    m.position.copy(you.carrier.position);
    const u = m.material.uniforms;
    u.uDir.value.copy(dir); u.uPower.value = clamp(st.power, 0, 1.2); u.uStretch.value = Math.max(smooth(30, 700, sp), st.rise ? 0.6 : 0);
    u.uColor.value.copy(auraCol);
  }
  aura.outer.material.uniforms.uScale.value = 1.95 * (1 + 0.15 * st.flare + (st.super ? 0.2 : 0));
  trailMat.uniforms.uColor.value.copy(auraCol);

  // Trail ribbon facing the camera.
  {
    const P = trailGeo.attributes.position.array; const A = trailGeo.attributes.aA.array;
    const vis = smooth(60, 400, sp);
    for (let i = 0; i < TRAIL; i += 1) {
      const p = trail.pts[i]; const q = trail.pts[Math.min(TRAIL - 1, i + 1)]; const o = trail.pts[Math.max(0, i - 1)];
      const seg = tmp2.copy(o).sub(q); if (seg.lengthSq() < 1e-6) seg.set(0, 0, 1);
      const side = seg.cross(proj.copy(camera.position).sub(p)).normalize();
      const w = (1 - i / TRAIL) * (0.45 + 0.3 * st.power) * (0.4 + 0.6 * vis);
      P.set([p.x + side.x * w, p.y + side.y * w, p.z + side.z * w, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w], i * 6);
      A[i * 2] = A[i * 2 + 1] = (1 - i / TRAIL) * vis * 0.9;
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.aA.needsUpdate = true;
  }
  drawPool(flames, you.carrier.position);
  drawPool(world, null);

  // Vapor cone.
  const ct = cone.userData.t;
  cone.visible = ct < 1;
  if (cone.visible) {
    const vd = tmp2.copy(st.vel).normalize();
    cone.position.copy(you.carrier.position).addScaledVector(vd, 0.6);
    cone.quaternion.setFromUnitVectors(UP, vd);
    cone.scale.set(2 + ct * 2.5, 2.2 + ct * 2, 2 + ct * 2.5);
    cone.material.opacity = 0.75 * (1 - ct) ** 1.4;
  }
  // Lightning, when you're past nine thousand.
  bolts.visible = st.super && Math.random() < 0.8;
  if (bolts.visible && st.clock - st.boltAt > 0.05) {
    st.boltAt = st.clock;
    const P = bolts.geometry.attributes.position.array; let n = 0;
    for (let b = 0; b < BOLTS; b += 1) {
      const a = Math.random() * TAU; const y0 = (Math.random() - 0.5) * 2.4;
      let x = Math.cos(a) * 1.3; let y = y0; let zz = Math.sin(a) * 1.3;
      for (let s = 0; s < BSEG; s += 1) {
        const nx = x + (Math.random() - 0.5) * 0.9; const ny = y + (Math.random() - 0.3) * 0.7; const nz = zz + (Math.random() - 0.5) * 0.9;
        P.set([x + you.carrier.position.x, y + you.carrier.position.y, zz + you.carrier.position.z, nx + you.carrier.position.x, ny + you.carrier.position.y, nz + you.carrier.position.z], n); n += 6;
        x = nx; y = ny; zz = nz;
      }
    }
    bolts.geometry.attributes.position.needsUpdate = true;
  }

  // Camera.
  camera.position.copy(st.pos).add(st.camOff);
  st.camBase = st.camBase || new V3(); st.camBase.copy(camera.position);
  if (st.shake > 0 && !REDUCED) camera.position.add(tmp2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(st.shake * 1.4));
  const camFloor = Math.max(hAt(camera.position.x, camera.position.z), 0) + 2;
  if (camera.position.y < camFloor) camera.position.y = camFloor;
  const fl = tmp2.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
  proj.copy(st.pos).addScaledVector(fl, 10).add(new V3(0, 1 + Math.sin(st.pitch) * 6, 0));
  // With the dragon up, the camera looks up at it.
  DR.look = (DR.look || 0) + ((DR.on && DR.phase !== 'dark' ? 1 : 0) - (DR.look || 0)) * 0.04;
  if (DR.look > 0.001) proj.lerp(tmp.set(DR.base.x, DR.base.y + 360 * Math.max(DR.grow, 0.3), DR.base.z), DR.look * 0.85);
  if (kame.beam) { const B = kame.beam; proj.copy(st.pos).lerp(tmp.copy(B.from).addScaledVector(B.dir, Math.min(B.len, 600)), 0.45); }
  st.look = st.look || new V3(); st.look.copy(proj);
  camera.lookAt(proj);
  const fov = lerp(60, 84, sf) + (st.super ? 5 : 0) + st.flare * 3;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * 0.15; camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
  const pxs = (renderer.domElement.height) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  flames.mat.uniforms.uPx.value = world.mat.uniforms.uPx.value = pxs;

  // Far blocks of town are dropped.
  for (const c of chunks) c.mesh.visible = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) < 12000;
  // Light pillars pulse; up close they thin out so they don't blind you.
  for (const b of beams) {
    const d = Math.hypot(b.v.x - camera.position.x, b.v.z - camera.position.z);
    b.beam.material.uniforms.uFade.value = smooth(200, 2500, d) * 0.85 + 0.15;
    b.ring.material.opacity = 0.5 + 0.4 * Math.sin(st.clock * 3);
    b.ring.scale.setScalar(1 + 0.08 * Math.sin(st.clock * 3));
  }
  // Inside a cloud: everything goes white.
  let inCloud = 0;
  for (const [x, y, z, r] of puffs) {
    const d = Math.hypot((camera.position.x - x) / r, (camera.position.y - y) / (r * 0.72), (camera.position.z - z) / r);
    if (d < 1.15) inCloud = Math.max(inCloud, smooth(1.15, 0.7, d));
  }
  st.cloud += (inCloud - st.cloud) * 0.25;
  flash.style.opacity = String(Math.min(1, st.flash + st.cloud * 0.85));

  poseHunt();
  poseKame();
  hud(sp, sf);
  speedLines(sf);
  audioFrame(sf);
}

const W = { w: 1, h: 1 };
function hud(sp, sf) {
  // Venue tags (pinned to the screen edge when off screen), and the names of the places below.
  const w = W.w; const h = W.h;
  for (const t of vtags) {
    proj.set(t.v.x, t.v.y + 60, t.v.z).project(camera);
    let x = (proj.x * 0.5 + 0.5) * w; let y = (-proj.y * 0.5 + 0.5) * h;
    const behind = proj.z > 1;
    if (behind) { x = w - x; y = h - 40; }
    const off = behind || x < 0 || x > w || y < 0 || y > h;
    const m = 14;
    x = clamp(x, m + 50, w - m - 50); y = clamp(y, 100, h - (x > w - 170 ? 290 : 120));
    const d = Math.hypot(t.v.x - st.pos.x, t.v.z - st.pos.z);
    t.km.textContent = d < 1000 ? `${Math.round(d / 10) * 10} M` : `${(d / 1000).toFixed(1)} KM`;
    t.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    t.el.classList.toggle('edge', off);
    t.el.classList.toggle('here', st.near === t.v);
  }
  let over = null; let od = Infinity;
  for (const r of rtags) {
    const d = Math.hypot(r.p.x - st.pos.x, r.p.z - st.pos.z);
    if (d < od) { od = d; over = r.p; }
    proj.set(r.p.x, Math.max(hAt(r.p.x, r.p.z), 0) + 40, r.p.z).project(camera);
    const vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
    const dc = Math.hypot(r.p.x - camera.position.x, r.p.z - camera.position.z);
    const a = vis ? smooth(9000, 4500, dc) * smooth(250, 900, dc) : 0;
    r.el.style.opacity = a.toFixed(2);
    if (a > 0) r.el.style.transform = `translate(${(proj.x * 0.5 + 0.5) * w}px,${(-proj.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
  }
  const overTxt = st.landing ? `LANDING AT ${st.landing.v.short || st.landing.v.name}` : st.edge ? 'EDGE OF THE MAP' : `OVER ${over ? over.name : 'SAN DIEGO'}`;
  if ($('over').textContent !== overTxt) $('over').textContent = overTxt;
  const ground = Math.max(hAt(st.pos.x, st.pos.z), 0);
  $('alt').textContent = `ALT ${Math.round(st.pos.y - ground)} M`;
  $('spd').textContent = `${Math.round(sp * 3.6).toLocaleString('en-US')} KM/H${st.mach ? '  MACH ' + (sp / 343).toFixed(1) : ''}`;
  // The power level reading, and the line everyone knows.
  const kiOn = st.ki > 30;
  $('ki').style.opacity = kiOn ? '1' : '0';
  if (kiOn) $('kin').textContent = Math.floor(st.ki).toLocaleString('en-US');
  document.body.classList.toggle('nine', st.clock - st.nineAt < 2.4);
  // Land button.
  const showLand = !!st.near && !st.landing && !DR.on;
  landBtn.classList.toggle('show', showLand);
  if (st.near) { $('landtxt').textContent = `LAND AT ${st.near.short || st.near.name}`; landBtn.style.setProperty('--c', st.near.accent || '#fffdf0'); }
  $('hint').classList.toggle('gone', showLand || st.touched);
}

function speedLines(sf) {
  const w = lines.width; const h = lines.height;
  lg.clearRect(0, 0, w, h);
  const a = REDUCED ? 0 : smooth(0.12, 0.8, sf) + (st.super ? 0.15 : 0);
  if (a <= 0.01) return;
  const cx = w / 2; const cy = h * 0.47; const R = Math.hypot(w, h) * 0.6;
  lg.fillStyle = st.super ? `rgba(255,236,150,${0.75 * a})` : `rgba(255,255,250,${0.7 * a})`;
  const n = 40 + Math.floor(40 * a);
  for (let i = 0; i < n; i += 1) {
    const ang = Math.random() * TAU; const r0 = R * (0.42 + Math.random() * 0.35 - a * 0.12); const wd = 0.004 + Math.random() * 0.012;
    lg.beginPath();
    lg.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    lg.lineTo(cx + Math.cos(ang - wd) * R * 1.3, cy + Math.sin(ang - wd) * R * 1.3);
    lg.lineTo(cx + Math.cos(ang + wd) * R * 1.3, cy + Math.sin(ang + wd) * R * 1.3);
    lg.closePath(); lg.fill();
  }
}

function resize() {
  const w = window.innerWidth; const h = window.innerHeight;
  W.w = w; W.h = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  lines.width = Math.round(w); lines.height = Math.round(h);
}
window.addEventListener('resize', resize);
resize();

// ---------- The hunt: seven tennis-ball dragon balls hidden round the city ----------
// Where they can hide: [lat, lng, name, meters above the ground (or the water)]. Each round picks seven.
const SPOTS = [
  [32.7166, -117.1693, 'ON TOP OF ONE AMERICA PLAZA', 202], [32.6947, -117.1535, 'UNDER THE CORONADO BRIDGE', 30],
  [32.7495, -117.2599, 'THE END OF OCEAN BEACH PIER', 13], [32.8395, -117.2445, 'MOUNT SOLEDAD', 5], [32.779, -117.2205, 'FIESTA ISLAND', 5],
  [32.7316, -117.1525, 'ON THE CALIFORNIA TOWER', 80], [32.7073, -117.1566, "PETCO PARK'S MOUND", 4], [32.7137, -117.1751, 'THE DECK OF THE MIDWAY', 16],
  [32.6722, -117.2408, 'THE POINT LOMA LIGHTHOUSE', 6], [32.8895, -117.2515, 'THE TORREY PINES GLIDERPORT', 6], [32.7975, -117.2601, 'THE END OF CRYSTAL PIER', 12],
  [32.8661, -117.2581, 'THE END OF SCRIPPS PIER', 12], [32.7206, -117.2557, 'SUNSET CLIFFS', 5], [32.7325, -117.1494, 'THE LILY POND', 5],
  [32.7757, -117.0719, 'SAN DIEGO STATE', 5], [32.7708, -117.2518, 'BELMONT PARK', 8], [32.808, -117.237, 'KATE SESSIONS PARK', 5],
  [32.7317, -117.2045, 'THE END OF THE RUNWAY', 4], [32.7546, -117.1975, 'OLD TOWN', 5], [32.873, -117.143, 'MIRAMAR', 5],
  [32.7035, -117.2015, 'A CARRIER AT NORTH ISLAND', 16], [32.6265, -117.105, 'THE CHULA VISTA BAYFRONT', 5], [32.642, -117.143, 'THE SILVER STRAND', 5],
  [32.7775, -117.2365, 'VACATION ISLE', 5], [32.8238, -117.1555, 'CONVOY STREET', 5], [32.8504, -117.2716, 'LA JOLLA COVE', 5],
  [32.8811, -117.2376, 'ON TOP OF GEISEL', 54], [32.6807, -117.1784, 'THE HOTEL DEL ROOF', 64],
];
const WORD = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'];
const LAYOUT = {
  1: [[0, 0]], 2: [[-0.9, 0], [0.9, 0]], 3: [[0, -0.9], [-0.9, 0.7], [0.9, 0.7]], 4: [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]],
  5: [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95], [0, 0]], 6: [[-0.85, -1.1], [0.85, -1.1], [-1.25, 0], [1.25, 0], [-0.85, 1.1], [0.85, 1.1]],
  7: [[-0.85, -1.1], [0.85, -1.1], [-1.25, 0], [1.25, 0], [-0.85, 1.1], [0.85, 1.1], [0, 0]],
};
function star(g, x, y, r, color) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = color; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#7a0f12'; g.stroke();
}
// The ball's skin: optic-yellow felt, the white seam, and its red stars on the side that faces you (u = 0.25 is +z).
const ballTex = (n) => tex(256, 128, (g, w, h) => {
  g.fillStyle = '#dcf20c'; g.fillRect(0, 0, w, h);
  const r = rng(n * 17 + 1);
  for (let i = 0; i < 1600; i += 1) { g.fillStyle = r() < 0.5 ? `rgba(255,255,200,${0.18 + r() * 0.2})` : `rgba(110,130,0,${0.12 + r() * 0.15})`; g.fillRect(r() * w, r() * h, 1.6, 1.6); }
  g.strokeStyle = '#fbfdf0'; g.lineWidth = 5; g.beginPath();
  for (let x = 0; x <= w; x += 2) { const y = h / 2 + Math.sin((x / w) * TAU * 2 + 2.4) * h * 0.34; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
  for (const [sx, sy] of LAYOUT[n]) star(g, 64 + sx * 15, 64 + sy * 15, 9.5, '#e3262b');
});
const glowTex = tex(128, 128, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,240,150,1)'); grd.addColorStop(0.25, 'rgba(255,190,60,.7)'); grd.addColorStop(1, 'rgba(255,150,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});
const ORANGE = new THREE.Color('#ffb02e');
const hunt = { round: 0, got: new Set(), balls: [], range: 1, wishes: {}, last: new V3(), summonAt: -1, stampAt: -9 };
const ballGeo = new THREE.SphereGeometry(5, 32, 20);
for (let n = 1; n <= 7; n += 1) {
  const mesh = inked(new THREE.Mesh(ballGeo, new THREE.MeshToonMaterial({ map: ballTex(n), gradientMap: tones })), lineMat(0.3));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  glow.scale.setScalar(48);
  scene.add(mesh); scene.add(glow);
  hunt.balls.push({ star: n, mesh, glow, pos: new V3(), spot: null, phase: n * 1.3 });
}
function placeBalls(round) {
  hunt.round = round;
  const r = rng(round * 7919 + 3);
  const order = SPOTS.map((s, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => SPOTS[i]);
  hunt.balls.forEach((b, i) => {
    const [lat, lng, name, above] = order[i];
    const [x, z] = G(lat, lng);
    b.spot = name; b.pos.set(x, Math.max(hAt(x, z), 0) + above, z);
  });
}
function syncBalls() { for (const b of hunt.balls) { const on = !hunt.got.has(b.star); b.mesh.visible = on; b.glow.visible = on; } }
function chime() {
  if (!au) return;
  const t = ac.currentTime;
  [784, 988, 1175, 1568].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.07); g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.07 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.5);
    o.connect(g); g.connect(ac.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.55);
  });
}
function beep(f = 1800, len = 0.05, vol = 0.06) {
  if (!au) return;
  const t = ac.currentTime; const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + len + 0.02);
}
function collect(b) {
  hunt.got.add(b.star); syncBalls();
  shockwave(b.pos.clone(), tmp.copy(camera.position).sub(b.pos), 60, 0.7, ORANGE);
  for (let i = 0; i < 40; i += 1) { const a = Math.random() * TAU; const e = Math.random() * Math.PI - Math.PI / 2; const s = 20 + Math.random() * 50; emit(world, b.pos.x, b.pos.y, b.pos.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 10, Math.sin(a) * Math.cos(e) * s, 2 + Math.random() * 3, 0.6 + Math.random() * 0.6, ORANGE, 2, 4); }
  st.flash = Math.max(st.flash, 0.35); st.flare = 1; chime();
  if (you.body) you.body.kick(0, 4, 0);
  post({ type: 'ball', star: b.star });
  $('gotn').textContent = `${WORD[b.star]}-STAR BALL`;
  $('gots').textContent = `${b.spot}  ·  ${hunt.got.size} OF 7`;
  hunt.stampAt = st.clock;
  if (hunt.got.size === 7) hunt.summonAt = st.clock + 1.8;
}
function stepHunt(dt) {
  // Fly through a ball (tested along the whole step, so even a full blast can't skip past it).
  const a = hunt.last; const b = st.pos;
  if (!st.landing && !DR.on) {
    for (const ball of hunt.balls) {
      if (hunt.got.has(ball.star)) continue;
      const ab = tmp2.copy(b).sub(a); const l2 = ab.lengthSq();
      const t = l2 > 1e-6 ? clamp(proj.copy(ball.pos).sub(a).dot(ab) / l2, 0, 1) : 0;
      if (proj.copy(a).addScaledVector(ab, t).distanceTo(ball.pos) < 24) collect(ball);
    }
  }
  hunt.last.copy(st.pos);
  if (hunt.summonAt > 0 && st.clock > hunt.summonAt && !st.landing) { hunt.summonAt = -1; summon(); }
  stepScouter(dt);
  if (DR.on) stepDragon(dt);
}

// ---------- The dragon radar ----------
const radar = $('radar'); const rg = radar.getContext('2d');
const RANGES = [2000, 8000, 30000];
radar.addEventListener('pointerdown', (e) => { e.stopPropagation(); firstTouch(); hunt.range = (hunt.range + 1) % RANGES.length; post({ type: 'press' }); beep(2200, 0.04); });
function drawRadar() {
  const S = radar.width; const R = S / 2; const k = S / 116;
  rg.clearRect(0, 0, S, S);
  rg.save(); rg.beginPath(); rg.arc(R, R, R - 3 * k, 0, TAU); rg.clip();
  rg.fillStyle = '#9fdc6c'; rg.fillRect(0, 0, S, S);
  rg.strokeStyle = 'rgba(30,80,30,.45)'; rg.lineWidth = 1 * k;
  for (let x = R % (14 * k); x < S; x += 14 * k) { rg.beginPath(); rg.moveTo(x, 0); rg.lineTo(x, S); rg.stroke(); rg.beginPath(); rg.moveTo(0, x); rg.lineTo(S, x); rg.stroke(); }
  const range = RANGES[hunt.range];
  const rx = Math.cos(st.yaw); const rz = -Math.sin(st.yaw); const fx = -Math.sin(st.yaw); const fz = -Math.cos(st.yaw);
  const blink = 0.55 + 0.45 * Math.sin(st.clock * 7);
  for (const b of hunt.balls) {
    if (hunt.got.has(b.star)) continue;
    const dx = b.pos.x - st.pos.x; const dz = b.pos.z - st.pos.z;
    let sx = ((dx * rx + dz * rz) / range) * (R - 8 * k); let sy = (-(dx * fx + dz * fz) / range) * (R - 8 * k);
    const l = Math.hypot(sx, sy); const edge = l > R - 9 * k;
    if (edge) { sx *= (R - 9 * k) / l; sy *= (R - 9 * k) / l; }
    rg.globalAlpha = edge ? 0.55 : blink;
    rg.beginPath(); rg.arc(R + sx, R + sy, (edge ? 3.5 : 5) * k, 0, TAU); rg.fillStyle = '#ffb02e'; rg.fill(); rg.lineWidth = 1.6 * k; rg.strokeStyle = '#6a3a00'; rg.stroke();
  }
  rg.globalAlpha = 1;
  rg.fillStyle = '#16181d'; rg.beginPath(); rg.moveTo(R, R - 7 * k); rg.lineTo(R - 5 * k, R + 5 * k); rg.lineTo(R + 5 * k, R + 5 * k); rg.closePath(); rg.fill();
  rg.restore();
  rg.lineWidth = 3 * k; rg.strokeStyle = '#16181d'; rg.beginPath(); rg.arc(R, R, R - 3 * k, 0, TAU); rg.stroke();
  $('rlbl').textContent = `${range >= 1000 ? `${range / 1000} KM` : `${range} M`}  ·  ${hunt.got.size}/7`;
}

// ---------- The scouter: point it at a court and it reads who's there ----------
const sc = { on: false, target: null, scanT: 0, brokenUntil: -1, beepAt: 0, html: '' };
const PEOPLE = { map: {}, you: { power: 1200, rec: '0-0', name: 'YOU' } };
const scoutBtn = $('scout');
scoutBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation(); firstTouch();
  if (st.clock < sc.brokenUntil) { beep(300, 0.2, 0.08); return; }
  sc.on = !sc.on; sc.target = undefined; sc.scanT = 0;
  document.body.classList.toggle('scouting', sc.on);
  post({ type: 'scouter' }); beep(sc.on ? 2400 : 900, 0.07);
});
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const rollDigits = () => fmt(1000 + Math.random() * 8999);
function stepScouter(dt) {
  if (!sc.on) return;
  // Past nine thousand, it can't take it.
  if (st.super) {
    sc.on = false; sc.brokenUntil = st.clock + 6;
    document.body.classList.remove('scouting'); document.body.classList.add('broke');
    setTimeout(() => document.body.classList.remove('broke'), 1400);
    post({ type: 'overload' }); boom(0.4); beep(140, 0.35, 0.12);
    return;
  }
  const cf = tmp.set(0, 0, -1).applyQuaternion(camera.quaternion);
  let best = null; let ba = 0.36;
  for (const v of VENUES) {
    const d = tmp2.set(v.x, v.y + 40, v.z).sub(camera.position); const dist = d.length();
    if (dist > 16000) continue;
    const ang = Math.acos(clamp(d.dot(cf) / dist, -1, 1));
    if (ang < ba) { ba = ang; best = v; }
  }
  if (best !== sc.target) { sc.target = best; sc.scanT = 0; if (best) post({ type: 'scan' }); }
  sc.scanT += dt;
  if (sc.scanT < 0.8 && st.clock - sc.beepAt > 0.09) { sc.beepAt = st.clock; beep(1600 + Math.random() * 900, 0.03, 0.04); }
}
function drawScouter() {
  const ret = $('reticle');
  if (!sc.on) { ret.style.opacity = '0'; return; }
  const rolling = sc.scanT < 0.8;
  let html;
  if (sc.target) {
    const v = sc.target;
    proj.set(v.x, v.y + 40, v.z).project(camera);
    ret.style.opacity = proj.z < 1 ? '1' : '0';
    ret.style.transform = `translate(${(proj.x * 0.5 + 0.5) * W.w}px,${(-proj.y * 0.5 + 0.5) * W.h}px) translate(-50%,-50%) scale(${rolling ? 1.4 - sc.scanT * 0.5 : 1})`;
    const people = PEOPLE.map[v.key] || [];
    const here = people.filter((p) => p.here); const later = people.filter((p) => !p.here);
    const d = Math.hypot(v.x - st.pos.x, v.z - st.pos.z);
    const row = (p) => `<div class="scr"><i style="background:${p.color}"></i><b>${p.name}</b><span>${rolling ? rollDigits() : p.power == null ? '???' : fmt(p.power)}</span><small>${p.here ? p.rec || 'NO RECORD' : p.time}</small></div>`;
    html = `<div class="sct">${v.short || v.name}  ${d < 1000 ? `${Math.round(d)} M` : `${(d / 1000).toFixed(1)} KM`}</div>`
      + (here.length ? `<div class="scs">${here.length} HERE</div>${here.map(row).join('')}` : '<div class="scs">NOBODY HERE</div>')
      + (later.length ? `<div class="scs">COMING</div>${later.map(row).join('')}` : '');
  } else {
    ret.style.opacity = '0';
    const p = PEOPLE.you.power + st.ki;
    html = `<div class="sct">${PEOPLE.you.name}</div><div class="scs">YOUR POWER LEVEL</div><div class="scr big"><b>${fmt(p)}</b><small>${PEOPLE.you.rec}</small></div><div class="scs dim">AIM AT A COURT TO READ IT</div>`;
  }
  if (html !== sc.html) { sc.html = html; $('scread').innerHTML = html; }
}

// ---------- The eternal dragon ----------
const DR = { on: false, t: 0, phase: '', base: new V3(), dark: 0, grow: 0, N: 70, built: false, wish: null, phaseAt: 0, shrink: 0 };
const SKY0 = { top: sky.material.uniforms.top.value.clone(), mid: sky.material.uniforms.mid.value.clone(), bot: sky.material.uniforms.bot.value.clone(), fog: scene.fog.color.clone(), sun: sun.intensity, hemi: hemi.intensity };
const SKY1 = { top: new THREE.Color('#05090a'), mid: new THREE.Color('#13241c'), bot: new THREE.Color('#2b3b33') };
function buildDragon() {
  DR.built = true;
  const geo = new THREE.SphereGeometry(1, 16, 12);
  DR.segs = new THREE.InstancedMesh(geo, toon('#ffffff', { emissive: new THREE.Color('#0d3015'), emissiveIntensity: 0.6 }), DR.N);
  DR.segLine = new THREE.InstancedMesh(geo, lineMat(0.07), DR.N);
  const a = new THREE.Color('#41a54c'); const b = new THREE.Color('#368f40');
  for (let i = 0; i < DR.N; i += 1) DR.segs.setColorAt(i, i % 3 === 0 ? b : a);
  DR.segs.frustumCulled = DR.segLine.frustumCulled = false;
  DR.spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0), toon('#e9a23b'), DR.N);
  DR.spikes.frustumCulled = false;
  const H = new THREE.Group();
  const green = toon('#41a54c', { emissive: new THREE.Color('#0d3015'), emissiveIntensity: 0.6 }); const cream = toon('#efe2bf');
  const part = (geo2, mat, x, y, z, line = LINE.m) => { const m = inked(new THREE.Mesh(geo2, mat), line); m.position.set(x, y, z); H.add(m); return m; };
  part(new THREE.BoxGeometry(40, 28, 42), green, 0, 0, 0);
  part(new THREE.BoxGeometry(28, 16, 44), green, 0, -3, 36);
  part(new THREE.BoxGeometry(26, 7, 40), cream, 0, -14, 30);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(5.5, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff2a12', fog: false })); eye.position.set(s * 13, 8, 19); H.add(eye);
    const brow = part(new THREE.BoxGeometry(14, 5, 10), green, s * 13, 15, 18); brow.rotation.z = s * 0.35;
    const horn = part(new THREE.ConeGeometry(4.5, 40, 6), cream, s * 12, 22, -14); horn.rotation.set(-1.0, 0, s * -0.35);
    const whisk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(s * 10, -4, 56), new V3(s * 40, 4, 66), new V3(s * 80, -20, 50), new V3(s * 120, -60, 20)]), 24, 1.6, 6), cream);
    H.add(whisk);
    for (let m = 0; m < 3; m += 1) { const mane = part(new THREE.ConeGeometry(6, 26, 5), toon('#e9a23b'), s * (8 + m * 6), 6 - m * 6, -22 - m * 3, LINE.s); mane.rotation.set(-1.9, 0, s * (0.5 + m * 0.25)); }
  }
  DR.eyes = H.children.filter((c) => c.material && c.material.isMeshBasicMaterial);
  DR.head = H;
  scene.add(DR.segs); scene.add(DR.segLine); scene.add(DR.spikes); scene.add(H);
}
function roar(len = 2.6) {
  if (!au) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = au.buf; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(140, t); lp.frequency.linearRampToValueAtTime(420, t + 0.5); lp.frequency.linearRampToValueAtTime(110, t + len);
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(48, t); o.frequency.linearRampToValueAtTime(70, t + 0.6); o.frequency.linearRampToValueAtTime(38, t + len);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(lp); o.connect(lp); lp.connect(g); g.connect(ac.destination); src.start(t); o.start(t); src.stop(t + len); o.stop(t + len);
}
function summon() {
  if (!DR.built) buildDragon();
  DR.on = true; DR.t = 0; DR.phase = 'dark'; DR.grow = 0; DR.wish = null; DR.shrink = 0;
  st.blast = st.rise = false; for (const el of document.querySelectorAll('.pad')) el.classList.remove('on');
  const fl = tmp.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
  DR.base.copy(st.pos).addScaledVector(fl, 1000); DR.base.y = Math.max(hAt(DR.base.x, DR.base.z), 0);
  document.body.classList.add('dragon');
  say('COME FORTH, ETERNAL DRAGON.');
  post({ type: 'summon' }); boom(0.8);
  DR.segs.visible = DR.segLine.visible = DR.spikes.visible = DR.head.visible = true;
}
function say(text) { const el = $('dsay'); el.textContent = text; el.classList.remove('in'); void el.offsetWidth; el.classList.toggle('in', !!text); }
const spine = (s, T, out) => {
  const a = s * TAU * 1.7 + T * 0.45;
  const r = 200 * Math.sin(Math.PI * Math.min(1, s * 1.12)) + 26;
  return out.set(DR.base.x + Math.cos(a) * r, DR.base.y + 20 + s * 760 + Math.sin(T * 1.3 + s * 9) * 14, DR.base.z + Math.sin(a) * r);
};
function stepDragon(dt) {
  DR.t += dt;
  const T = st.clock;
  if (DR.phase === 'dark') {
    DR.dark = Math.min(1, DR.dark + dt / 1.4);
    if (Math.random() < dt * 3) { st.flash = Math.max(st.flash, 0.5); boom(0.3); }
    if (DR.t > 1.6) { DR.phase = 'rise'; DR.phaseAt = DR.t; }
  } else if (DR.phase === 'rise') {
    const u = clamp((DR.t - DR.phaseAt) / 4.2, 0, 1);
    DR.grow = 1 - (1 - u) ** 3;
    if (Math.random() < dt * 2) st.flash = Math.max(st.flash, 0.35);
    st.shake = Math.max(st.shake, 0.35 * (1 - u));
    if (u >= 1) { DR.phase = 'speak'; DR.phaseAt = DR.t; roar(); st.shake = 1.4; post({ type: 'roar' }); say('I AM THE ETERNAL DRAGON. SPEAK YOUR WISH.'); showWishes(); }
  } else if (DR.phase === 'grant') {
    if (DR.t - DR.phaseAt > 2.4) {
      DR.phase = 'leave'; DR.phaseAt = DR.t; say('FAREWELL.');
      // The balls scatter: seven streaks off across the city.
      const head = spine(1, T, new V3());
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * TAU + Math.random() * 0.4;
        for (let k = 0; k < 14; k += 1) emit(world, head.x, head.y, head.z, Math.cos(a) * (500 - k * 22), 160 - k * 6, Math.sin(a) * (500 - k * 22), 16 - k * 0.7, 2.6, ORANGE, 0.25, 30);
      }
      boom(0.7);
    }
  } else if (DR.phase === 'leave') {
    const u = clamp((DR.t - DR.phaseAt) / 2.2, 0, 1);
    DR.shrink = u; DR.dark = 1 - u;
    if (u >= 1) {
      DR.on = false; DR.phase = ''; document.body.classList.remove('dragon'); say('');
      DR.segs.visible = DR.segLine.visible = DR.spikes.visible = DR.head.visible = false;
      hunt.got.clear(); placeBalls(hunt.round + 1); syncBalls();
    }
  }
  // You hover and turn to face it.
  st.vel.multiplyScalar(Math.exp(-3 * dt)); st.pos.addScaledVector(st.vel, dt);
  const floor = Math.max(hAt(st.pos.x, st.pos.z), 0);
  st.pos.y += (Math.max(st.pos.y, floor + 160) - st.pos.y) * (1 - Math.exp(-1.2 * dt));
  let dy = Math.atan2(-(DR.base.x - st.pos.x), -(DR.base.z - st.pos.z)) - st.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  st.yaw += dy * (1 - Math.exp(-2 * dt));
  st.pitch *= Math.exp(-3 * dt); st.bank *= Math.exp(-3 * dt);
}
function poseDragon() {
  const d = DR.dark;
  const u = sky.material.uniforms;
  u.top.value.copy(SKY0.top).lerp(SKY1.top, d); u.mid.value.copy(SKY0.mid).lerp(SKY1.mid, d); u.bot.value.copy(SKY0.bot).lerp(SKY1.bot, d);
  scene.fog.color.copy(SKY0.fog).lerp(SKY1.bot, d);
  sun.intensity = SKY0.sun * (1 - 0.7 * d); hemi.intensity = SKY0.hemi * (1 - 0.6 * d);
  seaMat.uniforms.uDim.value = d * 0.6;
  if (!DR.on || !DR.built) return;
  const T = st.clock; const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const p = new V3(); const n = new V3(); const s = new V3();
  for (let i = 0; i < DR.N; i += 1) {
    const uu = i / (DR.N - 1);
    const vis = clamp((uu - DR.shrink) / 0.05, 0, 1);
    let rad = (8 + 18 * smooth(0, 0.25, uu) - 3 * smooth(0.8, 1, uu)) * vis;
    spine(uu * DR.grow, T, p);
    if (DR.grow < 0.02) rad = 0;
    m.compose(p, q.identity(), s.set(rad, rad, rad));
    DR.segs.setMatrixAt(i, m); DR.segLine.setMatrixAt(i, m);
    spine(Math.min(1, uu * DR.grow + 0.004), T, n);
    const out = tmp.set(p.x - DR.base.x, 0, p.z - DR.base.z).normalize().add(tmp2.set(0, 0.6, 0)).normalize();
    q.setFromUnitVectors(UP, out);
    m.compose(tmp2.copy(p).addScaledVector(out, rad * 0.85), q, s.set(rad * 0.35, rad * (i % 2 ? 0.9 : 0.6), rad * 0.35));
    DR.spikes.setMatrixAt(i, m);
  }
  DR.segs.instanceMatrix.needsUpdate = DR.segLine.instanceMatrix.needsUpdate = DR.spikes.instanceMatrix.needsUpdate = true;
  spine(DR.grow, T, p);
  DR.head.position.copy(p);
  DR.head.lookAt(camera.position);
  const hs = (DR.grow > 0.05 ? 1 : 0) * (1 - DR.shrink);
  DR.head.scale.setScalar(hs);
  const glare = DR.phase === 'grant' ? 1.6 + Math.sin(T * 30) * 0.4 : 1;
  for (const e of DR.eyes) e.scale.setScalar(glare);
}
function showWishes() {
  for (const b of document.querySelectorAll('#wish button')) {
    const w = b.dataset.w; b.querySelector('em').textContent = hunt.wishes[w] ? 'YOU HAVE IT' : '';
  }
  $('wish').classList.add('show');
}
for (const b of document.querySelectorAll('#wish button')) {
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.classList.add('on'); post({ type: 'press' }); });
  b.addEventListener('pointerup', (e) => {
    e.stopPropagation(); b.classList.remove('on');
    if (DR.phase !== 'speak') return;
    const w = b.dataset.w === 'none' ? null : b.dataset.w;
    if (w) hunt.wishes[w] = true;
    applyWishes();
    $('wish').classList.remove('show');
    DR.phase = 'grant'; DR.phaseAt = DR.t; st.flash = 0.9; boom(1);
    say(w === 'gold' ? 'YOUR AURA WILL BURN GOLD. IT IS DONE.' : w === 'warp' ? 'TOUCH A COURT AND YOU WILL BE THERE. IT IS DONE.' : 'THE BALLS WILL SCATTER. IT IS DONE.');
    post({ type: 'wish', wish: w });
  });
}
function applyWishes() {
  st.gold = !!hunt.wishes.gold;
  document.body.classList.toggle('warp', !!hunt.wishes.warp);
  document.body.classList.toggle('gold', st.gold);
}

// ---------- Instant transmission: with the wish, tap a court's tag to be there ----------
for (const t of vtags) {
  t.el.addEventListener('pointerdown', (e) => { if (!hunt.wishes.warp) return; e.stopPropagation(); });
  t.el.addEventListener('pointerup', (e) => { if (!hunt.wishes.warp || st.landing || DR.on) return; e.stopPropagation(); warpTo(t.v); });
}
function warpTo(v) {
  st.flash = 1; st.flare = 1; boom(0.5); beep(3000, 0.12, 0.06);
  post({ type: 'warp' });
  st.pos.set(v.x, v.y + 160, v.z + 520); st.vel.set(0, 0, 0); st.yaw = 0; st.pitch = 0;
  st.camOff.set(0, 3.5, 11); st.camVel.set(0, 0, 0);
  for (const p of trail.pts) p.copy(st.pos);
  hunt.last.copy(st.pos);
  const el = $('it'); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
}

function poseHunt() {
  for (const b of hunt.balls) {
    if (!b.mesh.visible) continue;
    b.mesh.position.copy(b.pos); b.mesh.position.y += Math.sin(st.clock * 1.6 + b.phase) * 1.2;
    b.mesh.lookAt(camera.position); b.mesh.rotateZ(Math.sin(st.clock * 0.9 + b.phase) * 0.25);
    b.glow.position.copy(b.mesh.position);
    const d = b.pos.distanceTo(camera.position);
    b.glow.scale.setScalar((40 + d * 0.012) * (0.85 + 0.15 * Math.sin(st.clock * 5 + b.phase)));
  }
  drawRadar();
  drawScouter();
  poseDragon();
  document.body.classList.toggle('gotball', st.clock - hunt.stampAt < 2.6);
}

// ---------- The Kamehameha ----------
// Charge a ball of light at your side (KA... ME... HA... ME...), aim, and fire a beam across the city. A full charge locked on a
// court's pillar calls your crew to play there.
const KI = new THREE.Color('#8fe3ff'); const KI_CORE = new THREE.Color('#f4fdff');
const kame = { charging: false, t: 0, mid: { x: 0, y: 0 }, yaw0: 0, pitch0: 0, lock: null, hit: new V3(), stage: -1, beam: null, scorches: [], orb: null, hum: null };
const CHANT = ['KA...', 'ME...', 'HA...', 'ME...'];
const FULL = 2.0; // seconds to a full charge
const glowMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uA: { value: 1 } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform float uTime, uA; varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){ float fr = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float flick = 0.85 + 0.15 * sin(uTime * 40.0 + vP.y * 9.0);
  float core = 1.0 - smoothstep(0.1, 0.5, fr);
  vec3 c = mix(vec3(0.22, 0.62, 1.0), vec3(0.92, 0.98, 1.0), core);
  float a = (0.35 + 0.45 * core) * flick * uA; a = floor(a * 4.0 + 0.5) / 4.0;
  gl_FragColor = vec4(c * a, a);
#include <colorspace_fragment>
}`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
});
kame.orb = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), glowMat());
kame.orb.visible = false; kame.orb.renderOrder = 6; scene.add(kame.orb);
// The beam: a long tube, thin at your hands and full width after the first few tens of meters, light streaming down it.
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 60, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const kBeamMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uLen: { value: 1 }, uR: { value: 1 }, uA: { value: 1 } },
  vertexShader: `uniform float uLen, uR, uTime; varying vec3 vN; varying vec3 vV; varying float vZ;
void main(){ float zm = position.z * uLen; float flare = mix(0.3, 1.0, smoothstep(0.0, 40.0, zm));
  float wob = 1.0 + 0.06 * sin(zm * 0.05 - uTime * 30.0);
  vec3 p = vec3(position.xy * uR * flare * wob, zm);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * vec3(position.xy, 0.0)); vV = -mv.xyz; vZ = zm;
  gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime, uA; varying vec3 vN; varying vec3 vV; varying float vZ;
void main(){ float fr = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float core = 1.0 - smoothstep(0.08, 0.45, fr);
  float stream = step(0.5, fract(vZ * 0.012 - uTime * 6.0)) * 0.12;
  vec3 c = mix(vec3(0.2, 0.6, 1.0), vec3(0.95, 1.0, 1.0), core);
  float a = (0.35 + 0.5 * core + stream) * uA; a = floor(a * 4.0 + 0.5) / 4.0;
  gl_FragColor = vec4(c * a, a);
#include <colorspace_fragment>
}`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});
const kBeam = new THREE.Mesh(beamGeo, kBeamMat); kBeam.visible = false; kBeam.frustumCulled = false; kBeam.renderOrder = 7; scene.add(kBeam);
const kHead = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glowMat()); kHead.visible = false; kHead.renderOrder = 7; scene.add(kHead);
const blastDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), glowMat()); blastDome.visible = false; blastDome.renderOrder = 7; scene.add(blastDome);
const scorchTex = tex(128, 128, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, 'rgba(20,18,16,.85)'); grd.addColorStop(0.55, 'rgba(40,30,22,.6)'); grd.addColorStop(1, 'rgba(40,30,22,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});
const handPos = (out) => {
  // The ball sits at the fighter's side, a little back, like cupped hands at the hip.
  const r = tmp2.set(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
  return out.copy(you.carrier.position).addScaledVector(r, 1.5).add(fwd(st.yaw, 0, proj).multiplyScalar(-0.4)).add(new V3(0, -0.3, 0));
};
function startCharge(mid) {
  kame.charging = true; kame.t = 0; kame.stage = -1; kame.mid = mid; kame.yaw0 = st.yaw; kame.pitch0 = st.pitch; kame.lock = null;
  st.blast = st.rise = false; for (const el of document.querySelectorAll('.pad')) el.classList.remove('on');
  kame.orb.visible = true;
  document.body.classList.add('charging');
  post({ type: 'charge' });
  if (au) {
    const t = ac.currentTime; const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(520, t + FULL);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(2400, t + FULL);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.3);
    o.connect(lp); lp.connect(g); g.connect(ac.destination); o.start(t);
    kame.hum = { o, g };
  }
}
function aimCharge(dx, dy) {
  st.yaw = kame.yaw0 - dx * 0.006;
  st.pitch = clamp(kame.pitch0 - dy * 0.005, -1.1, 0.9);
}
function stopHum() { if (kame.hum && au) { const t = ac.currentTime; kame.hum.g.gain.setTargetAtTime(0.0001, t, 0.05); kame.hum.o.stop(t + 0.3); } kame.hum = null; }
/** Where the camera's center is pointing: the first court pillar it passes, or the ground (or the sea) it reaches. */
function aimPoint() {
  // Aim from the steady camera, not the shaking one, so the lock doesn't flicker while you charge.
  const o = st.camBase || camera.position; const d = st.look ? tmp.copy(st.look).sub(o).normalize() : tmp.set(0, 0, -1).applyQuaternion(camera.quaternion);
  let hitT = 9000;
  for (let t = 20; t < 9000; t += 30) {
    const x = o.x + d.x * t; const y = o.y + d.y * t; const z = o.z + d.z * t;
    if (y < Math.max(hAt(x, z), 0)) { hitT = t; break; }
  }
  let lock = null; let lockT = hitT;
  for (const v of VENUES) {
    const dxz = Math.hypot(d.x, d.z) || 1e-6;
    const t = ((v.x - o.x) * d.x + (v.z - o.z) * d.z) / (dxz * dxz);
    if (t <= 0 || t > lockT + 200) continue;
    const off = Math.hypot(o.x + d.x * t - v.x, o.z + d.z * t - v.z);
    const y = o.y + d.y * t;
    if (off < 130 && y < v.y + 2600 && y > v.y - 400) { lock = v; lockT = t; }
  }
  if (lock) return { lock, point: new V3(lock.x, lock.y + 2, lock.z) };
  return { lock: null, point: new V3(o.x + d.x * hitT, o.y + d.y * hitT, o.z + d.z * hitT) };
}
function stepKame(dt) {
  if (kame.charging) {
    kame.t += dt;
    const c = Math.min(1, kame.t / FULL);
    const stage = Math.min(3, Math.floor(kame.t / (FULL / 4)));
    if (stage !== kame.stage) {
      kame.stage = stage;
      const el = $('kame'); el.textContent = CHANT[stage]; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
      post({ type: 'chant', n: stage }); beep(300 + stage * 120, 0.08, 0.05);
    }
    if (kame.t >= FULL && !kame.full) { kame.full = true; st.flash = Math.max(st.flash, 0.4); post({ type: 'full' }); }
    st.shake = Math.max(st.shake, 0.12 + 0.45 * c);
    st.flare = Math.max(st.flare, 0.4 * c);
    // Light pulls in to the ball from all round it.
    const hp = handPos(proj); const rx = hp.x - you.carrier.position.x; const ry = hp.y - you.carrier.position.y; const rz = hp.z - you.carrier.position.z;
    for (let i = 0; i < 3; i += 1) {
      const a = Math.random() * TAU; const b = Math.acos(2 * Math.random() - 1); const R = 3 + Math.random() * 3;
      const ox = Math.sin(b) * Math.cos(a) * R; const oy = Math.cos(b) * R; const oz = Math.sin(b) * Math.sin(a) * R;
      emit(flames, rx + ox, ry + oy, rz + oz, -ox * 2.6, -oy * 2.6, -oz * 2.6, 0.25 + Math.random() * 0.2, 0.36, Math.random() < 0.4 ? KI_CORE : KI, 0, 0);
    }
    // Low to the ground, the dust and loose rocks lift.
    const g = Math.max(hAt(st.pos.x, st.pos.z), 0);
    if (st.pos.y - g < 70 && Math.random() < 0.5 + c) {
      const a = Math.random() * TAU; const R = 6 + Math.random() * 40;
      emit(world, st.pos.x + Math.cos(a) * R, g + 0.5, st.pos.z + Math.sin(a) * R, 0, 3 + Math.random() * 8 * c, 0, 1.5 + Math.random() * 3, 1.4, g > 0.5 ? DUST : SPRAY, 0.5, -1);
    }
    const aim = aimPoint();
    if (aim.lock !== kame.lock) { kame.lock = aim.lock; if (aim.lock) { post({ type: 'lock' }); beep(2600, 0.06, 0.06); } }
  }
  if (kame.beam) stepBeam(dt);
  for (const s of kame.scorches) { s.life -= dt; s.mesh.material.opacity = 0.85 * clamp(s.life / 8, 0, 1); if (s.life <= 0) { scene.remove(s.mesh); s.dead = true; } }
  kame.scorches = kame.scorches.filter((s) => !s.dead);
}
function release() {
  kame.charging = false; kame.full = false;
  document.body.classList.remove('charging');
  stopHum();
  const c = Math.min(1, kame.t / FULL);
  if (kame.t < 0.45) {
    kame.orb.visible = false; $('kame').classList.remove('in');
    boom(0.2); return;
  }
  const from = handPos(new V3());
  const aim = aimPoint();
  const dir = aim.point.clone().sub(from); const dist = dir.length(); dir.normalize();
  kame.beam = { from, dir, dist, c, len: 0, t: 0, hold: 0.6 + 0.9 * c, r: 1.6 + 4.4 * c, hit: false, lock: aim.lock, point: aim.point, end: 0 };
  kame.orb.visible = false;
  const el = $('kame'); el.textContent = 'HA!!'; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in', 'ha');
  setTimeout(() => el.classList.remove('ha'), 1600);
  st.flash = 0.7; st.shake = Math.max(st.shake, 0.9 + c); st.vel.addScaledVector(dir, -15 - 30 * c);
  if (you.body) you.body.kick(-dir.x * 4, -dir.y * 4, -dir.z * 4);
  post({ type: 'fire', c }); roarBeam(c);
  if (aim.lock && c < 1) say2('CHARGE IT ALL THE WAY TO CALL THE CREW');
}
function roarBeam(c) {
  if (!au) return;
  const t = ac.currentTime; const len = 1.2 + 1.2 * c;
  const src = ac.createBufferSource(); src.buffer = au.buf; src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6; bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(300, t + len);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * (0.5 + c), t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp); bp.connect(g); g.connect(ac.destination); src.start(t, Math.random()); src.stop(t + len);
}
function stepBeam(dt) {
  const B = kame.beam; B.t += dt;
  // The beam stays in your hands as the recoil pushes you back.
  handPos(B.from); B.dir.copy(B.point).sub(B.from); B.dist = B.dir.length(); B.dir.normalize(); if (B.hit) B.len = B.dist;
  B.len = Math.min(B.dist, B.len + dt * 3200);
  if (B.len >= B.dist && !B.hit) { B.hit = true; explode(B); }
  if (B.hit) { B.end += dt; }
  const thin = B.end > B.hold ? clamp(1 - (B.end - B.hold) / 0.45, 0, 1) : 1;
  kBeam.visible = kHead.visible = thin > 0;
  kBeam.position.copy(B.from); kBeam.lookAt(B.from.clone().add(B.dir));
  kBeamMat.uniforms.uLen.value = Math.max(1, B.len); kBeamMat.uniforms.uR.value = B.r * thin; kBeamMat.uniforms.uTime.value = st.clock;
  kHead.position.copy(B.from).addScaledVector(B.dir, B.len); kHead.scale.setScalar(B.r * 1.6 * thin); kHead.material.uniforms.uTime.value = st.clock;
  if (thin <= 0) kame.beam = null;
  // Skimming the ground, the beam tears a trench of dust as it goes.
  const tip = kHead.position; const g = Math.max(hAt(tip.x, tip.z), 0);
  if (!B.hit && tip.y - g < 40) for (let i = 0; i < 4; i += 1) emit(world, tip.x, g + 1, tip.z, (Math.random() - 0.5) * 40, 15 + Math.random() * 30, (Math.random() - 0.5) * 40, 6 + Math.random() * 10, 1.4, g > 0.5 ? DUST : SPRAY, 1.5, 9);
}
function explode(B) {
  const p = B.point; const g = Math.max(hAt(p.x, p.z), 0); const wet = hAt(p.x, p.z) < 0.3;
  const size = 90 + 220 * B.c;
  blastDome.position.set(p.x, g, p.z); blastDome.userData = { t: 0, size }; blastDome.visible = true;
  shockwave(new V3(p.x, g + 2, p.z), UP, size * 2.2, 1.1, KI);
  shockwave(new V3(p.x, g + 2, p.z), UP, size * 1.3, 0.8);
  for (let i = 0; i < 140; i += 1) {
    const a = Math.random() * TAU; const s = 40 + Math.random() * 160 * (0.5 + B.c);
    emit(world, p.x, g + 2, p.z, Math.cos(a) * s, 30 + Math.random() * (wet ? 260 : 140), Math.sin(a) * s, 10 + Math.random() * 26, 1.6 + Math.random() * 1.4, wet ? SPRAY : DUST, 1.4, wet ? 40 : 18);
  }
  if (!wet) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(size * 0.7, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
    m.position.set(p.x, g + 1, p.z); scene.add(m); kame.scorches.push({ mesh: m, life: 40 });
  }
  const near = clamp(1 - camera.position.distanceTo(p) / 6000, 0.25, 1);
  st.flash = Math.max(st.flash, 0.9 * near); st.shake = Math.max(st.shake, 1.6 * near); boom(1.2 + 0.5 * near);
  post({ type: 'impact', near });
  // A full charge on a court calls the crew there.
  if (B.lock && B.c >= 1) {
    const b = beams.find((x) => x.v === B.lock); if (b) b.flareT = st.clock;
    post({ type: 'callup', id: B.lock.id, key: B.lock.key, name: B.lock.name, short: B.lock.short || B.lock.name });
  }
}
function poseKame() {
  if (kame.charging) {
    const c = Math.min(1, kame.t / FULL);
    handPos(kame.orb.position);
    kame.orb.scale.setScalar((0.2 + 0.65 * c) * (1 + 0.08 * Math.sin(st.clock * 50)));
    kame.orb.material.uniforms.uTime.value = st.clock;
    // The lock: a ring on the court you'll call up.
    const L = $('klock');
    if (kame.lock) {
      proj.set(kame.lock.x, kame.lock.y + 120, kame.lock.z).project(camera);
      L.style.opacity = proj.z < 1 ? '1' : '0';
      L.style.transform = `translate(${(proj.x * 0.5 + 0.5) * W.w}px,${(-proj.y * 0.5 + 0.5) * W.h}px) translate(-50%,-50%)`;
      $('klocktxt').textContent = c >= 1 ? `CALL THE CREW TO ${kame.lock.short || kame.lock.name}` : `${kame.lock.short || kame.lock.name}  ·  CHARGE ${Math.round(c * 100)}%`;
      L.classList.toggle('full', c >= 1);
    } else L.style.opacity = '0';
  } else $('klock').style.opacity = '0';
  if (blastDome.visible) {
    const u = blastDome.userData; u.t += 1 / 60;
    const k = clamp(u.t / 1.2, 0, 1);
    blastDome.scale.set(u.size * (0.3 + 0.7 * (1 - (1 - k) ** 3)), u.size * 0.8 * (0.3 + 0.7 * (1 - (1 - k) ** 3)), u.size * (0.3 + 0.7 * (1 - (1 - k) ** 3)));
    blastDome.material.uniforms.uA.value = 1 - k; blastDome.material.uniforms.uTime.value = st.clock;
    if (k >= 1) blastDome.visible = false;
  }
  for (const b of beams) {
    const f = b.flareT ? clamp(1 - (st.clock - b.flareT) / 4, 0, 1) : 0;
    if (f > 0) { b.beam.material.uniforms.uFade.value += 2.5 * f; b.ring.scale.setScalar(1 + 2.5 * f); }
  }
}
function say2(text) { const el = $('calls'); el.textContent = text; el.classList.remove('in', 'ok'); void el.offsetWidth; el.classList.add('in'); }
/** From the app: how the call-up went. */
window.callResult = ({ ok, text }) => {
  const el = $('calls'); el.textContent = text; el.classList.remove('in', 'ok'); void el.offsetWidth; el.classList.add('in'); el.classList.toggle('ok', !!ok);
};

let last = performance.now();
/** Stills: `window.paused = true` stops the clock; `window.advance(sec)` runs exactly that much and draws it. */
window.paused = false;
window.advance = (sec) => {
  for (let t = 0; t < sec; t += 1 / 60) step(1 / 60);
  pose(); renderer.render(scene, camera);
};
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!window.paused && dt > 0) { const n = Math.ceil(dt / (1 / 60)); for (let i = 0; i < n; i += 1) step(dt / n); }
  pose();
  renderer.render(scene, camera);
}

/** From the app: who you are, and which court to start over. */
window.setFly = (d) => {
  if (d.you) { setYou(d.you); PEOPLE.you = { power: d.you.power ?? 1200, rec: d.you.rec ?? '0-0', name: d.you.name || 'YOU' }; }
  if (d.people) PEOPLE.map = d.people;
  if (d.hunt) {
    // A new round (after a wish) re-hides them; within a round, only add what's been caught.
    if (d.hunt.round !== hunt.round && !DR.on) { hunt.got = new Set(d.hunt.got); placeBalls(d.hunt.round); } else for (const n of d.hunt.got) hunt.got.add(n);
    hunt.wishes = { ...hunt.wishes, ...d.hunt.wishes };
    syncBalls(); applyWishes();
  }
  if (!st.started) { st.started = true; startAt(VENUES.find((v) => v.id === d.start || v.key === d.start) || VENUES[0]); }
};
window.demoFly = (hunt = { round: 1, got: [], wishes: {} }) => window.setFly({
  you: { cast: 'wall', color: '#d7f205', name: 'TONY', power: 4120, rec: '14-6' }, start: 'balboa', hunt,
  people: { ucsd: [{ name: 'DANIEL', color: '#ff8a1f', here: true, time: '', power: 5480, rec: '18-7' }, { name: 'GARY', color: '#35d6ff', here: true, time: '', power: 3960, rec: '9-11' }, { name: 'ARIA', color: '#9b6bff', here: false, time: '6:30', power: 6120, rec: '' }], roosevelt: [{ name: 'TROY', color: '#2fe08a', here: false, time: 'TMRW 6:30', power: null, rec: '' }] },
});
/** Test hook: put yourself somewhere, doing something. */
window.__fly = ({ lat, lng, alt = 200, yaw = 0, pitch = 0, speed = 0, blast = false, rise = false, sup = false, cam } = {}) => {
  if (lat != null) { const [x, z] = G(lat, lng); st.pos.set(x, Math.max(hAt(x, z), 0) + alt, z); }
  st.yaw = yaw; st.pitch = pitch; st.blast = blast; st.rise = rise; st.wasBlast = blast; st.wasRise = rise;
  st.vel.copy(fwd(yaw, pitch)).multiplyScalar(speed);
  if (sup) { st.super = true; st.blastT = 3; document.body.classList.add('super'); }
  if (cam) st.camOff.set(...cam); else st.camOff.copy(fwd(yaw, 0).multiplyScalar(-lerp(10.5, 15, clamp(speed / 950, 0, 1)))).add(new V3(0, lerp(3.2, 4.2, clamp(speed / 950, 0, 1)), 0));
  st.camVel.set(0, 0, 0);
  for (const p of trail.pts) p.copy(st.pos).addScaledVector(st.vel, -0.2 * (trail.pts.indexOf(p) / TRAIL));
  hunt.last.copy(st.pos);
};
window.__hunt = hunt; window.__kame = kame; window.__charge = () => startCharge({ x: 0, y: 0 }); window.__release = () => release(); window.__summon = () => summon(); window.__DR = DR; window.__sc = sc;
window.__st = st;

placeBalls(1); syncBalls();
startAt(VENUES[0]);
setYou({ cast: 'wall', color: '#d7f205', name: 'YOU' });
requestAnimationFrame(frame);
post({ type: 'ready' });
