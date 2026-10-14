// Season lines: your courts as a hand-drawn transit map. Every player is a line, every court a station, and a stylus held in a
// hand draws the season live on cream paper. After docs/mo-design/vids/pretty-fire-fuckign-art.mov (patterned rail lines drawn by a
// giant hand next to real station names, then an RGB glitch, a red frame, and the cut).
//
// Motion spec.
// - Pen: 560 px/s along the path, eased in over the first 60 px and out over the last 60 px of each line. Between lines it lifts
//   (scale 1.06, shadow pushed from 10 to 26 px) and travels to the next start on a 3 Hz, ratio 0.8 spring.
// - The pen leans with its direction of travel, smoothed on a 4 Hz, ratio 1 spring, inside 18 to 48 degrees from vertical.
// - Station stops pop in when a line first reaches them: scale 0 to 1 on pop easing (0.34, 1.56, 0.64, 1) over 260 ms.
// - Finish: 520 ms glitch (slices shifted up to 60 px, red/blue/ink blocks, RGB split), 140 ms red frame, then the clean map.
// - At rest it is never frozen: the hand breathes 1.2% on a 3.4 s sine and the paper grain shifts every 2 frames.

const post = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message), at: `${e.lineno}:${e.colno}` }));

const canvas = document.getElementById('c');
const g = canvas.getContext('2d');
const PAPER = '#ebe8e2';
const INK = '#16181d';
const W = () => window.innerWidth;
const H = () => window.innerHeight;
let dpr = 1;
const layers = { shadow: document.createElement('canvas'), ink: document.createElement('canvas'), grain: document.createElement('canvas') };
const lg = { shadow: layers.shadow.getContext('2d'), ink: layers.ink.getContext('2d') };

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  for (const c of [canvas, layers.shadow, layers.ink]) { c.width = W() * dpr; c.height = H() * dpr; }
  canvas.style.width = `${W()}px`; canvas.style.height = `${H()}px`;
  // Paper grain: fine noise, drawn multiplied over everything.
  const gr = layers.grain;
  gr.width = 256; gr.height = 256;
  const gc = gr.getContext('2d');
  const img = gc.createImageData(256, 256);
  for (let k = 0; k < img.data.length; k += 4) { const v = 200 + Math.random() * 55; img.data[k] = v; img.data[k + 1] = v * 0.99; img.data[k + 2] = v * 0.97; img.data[k + 3] = 255; }
  gc.putImageData(img, 0, 0);
}

// ---------- Stations from the real venues ----------
const VENUES = window.VENUES || [];
const NOTE = { ucsd: 'La Jolla', lindavista: 'Linda Vista', balboa: 'Morley Field', roosevelt: 'by the zoo', northpark: 'North Park' };
let stations = [];
function layoutStations() {
  // Real positions from each venue's id (lat/lon), squeezed toward the middle so the far-off UCSD courts still fit on the page.
  const pts = VENUES.map((v) => {
    const m = /c(\d+)_(\d+)/.exec(v.id);
    const lat = Number(m[1]) / 10000;
    const lon = -Number(m[2]) / 10000;
    return { v, x: lon * Math.cos((lat * Math.PI) / 180), y: -lat };
  });
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  for (const p of pts) {
    const dx = p.x - cx; const dy = p.y - cy;
    const r = Math.hypot(dx, dy) || 1;
    const k = Math.pow(r, 0.42) / r;
    p.u = dx * k; p.w = dy * k;
  }
  const minU = Math.min(...pts.map((p) => p.u)); const maxU = Math.max(...pts.map((p) => p.u));
  const minW = Math.min(...pts.map((p) => p.w)); const maxW = Math.max(...pts.map((p) => p.w));
  const top = 170; const bottom = H() - 150; const left = 60; const right = W() - 90;
  // Push stations apart until labels have room: three of the courts sit within a mile of each other by the zoo.
  const MIN = 0.32;
  for (let it = 0; it < 200; it += 1) {
    for (const a of pts) for (const b of pts) {
      if (a === b) continue;
      const dx = (b.u - a.u) / (maxU - minU || 1); const dy = (b.w - a.w) / (maxW - minW || 1);
      const d = Math.hypot(dx, dy) || 0.001;
      if (d < MIN) { const push = (MIN - d) * 0.25; b.u += (dx / d) * push * (maxU - minU); b.w += (dy / d) * push * (maxW - minW); }
    }
  }
  const minU2 = Math.min(...pts.map((p) => p.u)); const maxU2 = Math.max(...pts.map((p) => p.u));
  const minW2 = Math.min(...pts.map((p) => p.w)); const maxW2 = Math.max(...pts.map((p) => p.w));
  stations = pts.map((p) => ({
    key: p.v.key, id: p.v.id, name: p.v.short, note: NOTE[p.v.key] || '',
    x: left + ((p.u - minU2) / (maxU2 - minU2 || 1)) * (right - left),
    y: top + ((p.w - minW2) / (maxW2 - minW2 || 1)) * (bottom - top),
    lit: 0, at: -1,
  }));
}

// ---------- Patterns ----------
// Each line is stamped along its arc length: a round base, then the pattern on top, so it can be revealed a pixel at a time.
const WIDTH = 11;
const PATTERNS = ['dots', 'ticks', 'speckle', 'beads', 'stitch', 'twotone', 'plain', 'dash'];
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
function stampBase(line, s, x, y) {
  lg.shadow.fillStyle = 'rgba(40,30,20,0.16)';
  lg.shadow.beginPath(); lg.shadow.arc(x + 1.5, y + 2.5, WIDTH / 2 + 0.8, 0, Math.PI * 2); lg.shadow.fill();
  let col = line.color;
  if (line.pattern === 'beads') col = Math.floor(s / 7) % 2 ? line.color : line.alt;
  if (line.pattern === 'twotone' && Math.floor(s / 120) % 2) col = shade(line.color, 0.35);
  if (line.pattern === 'dash' && Math.floor(s / 26) % 2) col = shade(line.color, -0.25);
  lg.ink.fillStyle = col;
  lg.ink.beginPath(); lg.ink.arc(x, y, WIDTH / 2, 0, Math.PI * 2); lg.ink.fill();
}
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
function stampMark(line, s, x, y, nx, ny) {
  const c = lg.ink;
  const light = lum(line.color) > 0.62 ? 'rgba(22,24,29,.8)' : '#fffdf6';
  switch (line.pattern) {
    case 'dots':
      if (s % 15 < 1.5) { c.fillStyle = light; c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI * 2); c.fill(); }
      break;
    case 'ticks':
      if (s % 6 < 1.5) { c.strokeStyle = shade(line.color, -0.55); c.lineWidth = 2; c.beginPath(); c.moveTo(x - nx * 4.2, y - ny * 4.2); c.lineTo(x + nx * 4.2, y + ny * 4.2); c.stroke(); }
      break;
    case 'speckle':
      if (Math.random() < 0.55) { c.fillStyle = 'rgba(22,18,14,.75)'; const o = (Math.random() - 0.5) * 7; c.beginPath(); c.arc(x + nx * o, y + ny * o, 0.9 + Math.random() * 0.7, 0, Math.PI * 2); c.fill(); }
      break;
    case 'stitch':
      if (s % 12 < 1.5) { c.strokeStyle = light; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - nx * 2.5 - ny * 2, y - ny * 2.5 + nx * 2); c.lineTo(x + nx * 2.5 + ny * 2, y + ny * 2.5 - nx * 2); c.stroke(); }
      break;
    case 'twotone':
      if (s % 18 < 1.5) { c.fillStyle = shade(line.color, -0.45); c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); }
      break;
    default:
  }
}

// ---------- Paths ----------
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function catmull(pts, steps) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps; const t2 = t * t; const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/** A hand-drawn route through the stops: it wanders off the straight line and now and then loops, like the reference. */
function routePath(stops, lane) {
  const ctrl = [];
  stops.forEach((st, i) => {
    const off = (lane - 2.5) * 6;
    const p = { x: st.x + off, y: st.y + off * 0.6 };
    if (i === 0) { ctrl.push({ x: p.x - 30 + rnd() * 20, y: p.y - 40 - rnd() * 30 }); }
    ctrl.push(p);
    const next = stops[i + 1];
    if (!next) { ctrl.push({ x: p.x + 20 + rnd() * 30, y: p.y + 40 + rnd() * 30 }); return; }
    const dx = next.x - st.x; const dy = next.y - st.y; const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len; const ny = dx / len;
    const n = 1 + Math.floor(len / 140);
    for (let k = 1; k <= n; k += 1) {
      const t = k / (n + 1);
      const swing = (rnd() - 0.5) * Math.min(120, len * 0.45);
      const q = { x: st.x + dx * t + nx * swing + off, y: st.y + dy * t + ny * swing + off * 0.6 };
      ctrl.push(q);
      if (rnd() < 0.22) { // a loop: three points that circle back
        const r = 16 + rnd() * 14; const sgn = rnd() < 0.5 ? -1 : 1;
        ctrl.push({ x: q.x + (dx / len) * r + nx * r * sgn, y: q.y + (dy / len) * r + ny * r * sgn });
        ctrl.push({ x: q.x + nx * r * 2 * sgn, y: q.y + ny * r * 2 * sgn });
        ctrl.push({ x: q.x - (dx / len) * r * 0.4 + nx * r * sgn, y: q.y - (dy / len) * r * 0.4 + ny * r * sgn });
      }
    }
  });
  const dense = catmull(ctrl, 18);
  // Resample by arc length at 1.5 px.
  const pts = [dense[0]];
  let carry = 0;
  for (let i = 1; i < dense.length; i += 1) {
    const a = dense[i - 1]; const b = dense[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    let d = 1.5 - carry;
    while (d <= seg) { pts.push({ x: a.x + ((b.x - a.x) * d) / seg, y: a.y + ((b.y - a.y) * d) / seg }); d += 1.5; }
    carry = seg - (d - 1.5);
  }
  return pts;
}

// ---------- Season ----------
let lines = [];
let caption = '';
function build(data) {
  seed = 11;
  layoutStations();
  for (const s of stations) { s.lit = 0; s.at = -1; }
  const byKey = Object.fromEntries(stations.map((s) => [s.id, s]));
  const keyed = Object.fromEntries(stations.map((s) => [s.key, s]));
  lines = data.players.map((p, i) => {
    let stops = p.stops.map((id) => byKey[id] || keyed[id]).filter(Boolean);
    stops = stops.filter((s, k) => k === 0 || s !== stops[k - 1]);
    if (stops.length === 1) stops = [stops[0], stops[0]];
    if (!stops.length) return null;
    return { name: p.name, color: p.color, alt: shade(p.color, 0.45), pattern: PATTERNS[i % PATTERNS.length], stops, pts: routePath(stops, i), drawn: 0 };
  }).filter(Boolean);
  caption = data.sample ? 'sample routes. log matches and these become yours.' : 'every line is a player. every stop is a court you played.';
  document.getElementById('cap').textContent = caption;
  document.getElementById('sub').textContent = `${lines.length} PLAYERS  /  ${stations.length} COURTS`;
  for (const c of [lg.shadow, lg.ink]) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W(), H()); c.lineCap = 'round'; }
  pen.line = 0; pen.s = 0; pen.lift = 1; pen.state = 'travel'; pen.done = false; finish.t = -1;
  if (lines[0]) { pen.x = W() + 120; pen.y = H() * 0.3; }
}

// ---------- The pen ----------
const pen = { x: 0, y: 0, vx: 0, vy: 0, lean: 0.55, leanV: 0, lift: 1, liftV: 0, line: 0, s: 0, state: 'travel', done: false };
const SPEED = 560;
function springTo(o, k, kv, target, dt, hz, ratio) {
  const w = hz * Math.PI * 2;
  o[kv] += (-w * w * (o[k] - target) - 2 * ratio * w * o[kv]) * dt;
  o[k] += o[kv] * dt;
}
let stationTick = -1;
function stepPen(dt) {
  if (pen.done) { springTo(pen, 'lift', 'liftV', 1, dt, 3, 0.8); pen.x += (W() + 220 - pen.x) * Math.min(1, dt * 2.2); pen.y += (H() * 0.25 - pen.y) * Math.min(1, dt * 2.2); return; }
  const line = lines[pen.line];
  if (!line) { pen.done = true; startFinish(); return; }
  if (pen.state === 'travel') {
    const a = line.pts[0];
    const w = 3 * Math.PI * 2;
    pen.vx += (-w * w * (pen.x - a.x) - 2 * 0.8 * w * pen.vx) * dt;
    pen.vy += (-w * w * (pen.y - a.y) - 2 * 0.8 * w * pen.vy) * dt;
    pen.x += pen.vx * dt; pen.y += pen.vy * dt;
    springTo(pen, 'lift', 'liftV', 1, dt, 3, 0.8);
    if (Math.hypot(pen.x - a.x, pen.y - a.y) < 2 && Math.hypot(pen.vx, pen.vy) < 60) { pen.state = 'draw'; pen.s = 0; post({ type: 'down' }); }
    return;
  }
  springTo(pen, 'lift', 'liftV', 0, dt, 5, 1);
  const total = (line.pts.length - 1) * 1.5;
  const ramp = Math.min(1, (pen.s + 8) / 60, (total - pen.s + 8) / 60);
  const before = pen.s;
  pen.s = Math.min(total, pen.s + SPEED * Math.max(0.18, ramp) * dt);
  const from = Math.floor(before / 1.5); const to = Math.floor(pen.s / 1.5);
  for (let i = from; i <= to; i += 1) {
    const p = line.pts[i]; const q = line.pts[Math.min(line.pts.length - 1, i + 1)];
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    stampBase(line, i * 1.5, p.x, p.y);
    const j = i - 6;
    if (j >= 0) { const a = line.pts[j]; const b = line.pts[j + 1]; const l2 = Math.hypot(b.x - a.x, b.y - a.y) || 1; stampMark(line, j * 1.5, a.x, a.y, -(b.y - a.y) / l2, (b.x - a.x) / l2); }
    if (i === line.pts.length - 1) for (let k = Math.max(0, i - 5); k <= i; k += 1) { const a = line.pts[k]; const b = line.pts[Math.min(i, k + 1)]; const l2 = Math.hypot(b.x - a.x, b.y - a.y) || 1; stampMark(line, k * 1.5, a.x, a.y, -(b.y - a.y) / l2, (b.x - a.x) / l2); }
    for (const st of line.stops) if (st.at < 0 && Math.hypot(p.x - st.x, p.y - st.y) < 9) { st.at = clock; if (clock - stationTick > 0.12) { stationTick = clock; post({ type: 'stop' }); } }
  }
  const head = line.pts[to];
  const prev = line.pts[Math.max(0, to - 8)];
  pen.x = head.x; pen.y = head.y;
  // Lean with travel: moving right tips the barrel down toward horizontal, moving left stands it up.
  const dir = Math.atan2(head.y - prev.y, head.x - prev.x);
  const want = 0.55 + 0.28 * Math.cos(dir);
  springTo(pen, 'lean', 'leanV', Math.max(0.32, Math.min(0.84, want)), dt, 4, 1);
  if (pen.s >= total) { pen.line += 1; pen.state = 'travel'; pen.vx = 0; pen.vy = 0; post({ type: 'up' }); }
}

// The hand: a soft grey hand pinching a stylus, coming in from the right edge. Flat tones, one highlight, one shadow, like the
// reference's paper-cut look. Drawn in pen space: the tip at the origin, the barrel running up and to the right.
function drawHand(c, tint) {
  const breathe = 1 + 0.012 * Math.sin((clock * Math.PI * 2) / 3.4);
  c.save();
  c.scale(breathe, breathe);
  const skin = tint ? mix('#c4c4c8', tint, 0.08) : '#c4c4c8';
  const skinLo = shadeHex(skin, -0.18);
  const skinHi = shadeHex(skin, 0.28);
  // Barrel.
  c.fillStyle = '#5d5f66';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(22, -9); c.lineTo(250, -34); c.lineTo(250, 4); c.lineTo(22, 9); c.closePath(); c.fill();
  c.fillStyle = '#7b7d85';
  c.beginPath(); c.moveTo(4, -1.5); c.lineTo(22, -8); c.lineTo(250, -32); c.lineTo(250, -22); c.lineTo(22, -2); c.closePath(); c.fill();
  c.fillStyle = '#2b2d33';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(9, -3.5); c.lineTo(9, 3.5); c.closePath(); c.fill();
  // Palm: a big rounded mass off to the upper right.
  c.fillStyle = skinLo;
  blob(c, [[120, -6], [190, -70], [300, -90], [330, 40], [230, 90], [150, 50]]);
  c.fillStyle = skin;
  blob(c, [[118, -14], [180, -78], [290, -100], [320, 20], [220, 70], [150, 34]]);
  // Index finger along the top of the barrel, thumb under it, curled fingers behind.
  c.fillStyle = skinLo;
  capsule(c, 60, 34, 170, 60, 17);
  capsule(c, 150, 70, 220, 92, 18);
  c.fillStyle = skin;
  capsule(c, 46, -16, 150, -46, 15);
  capsule(c, 52, 18, 150, 30, 15);
  c.fillStyle = skinHi;
  capsule(c, 60, -22, 140, -48, 5);
  // Knuckle creases.
  c.strokeStyle = skinLo; c.lineWidth = 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(98, -38); c.quadraticCurveTo(104, -28, 100, -18); c.stroke();
  c.beginPath(); c.moveTo(102, 10); c.quadraticCurveTo(108, 20, 104, 30); c.stroke();
  c.restore();
}
function blob(c, p) {
  c.beginPath();
  c.moveTo((p[0][0] + p[p.length - 1][0]) / 2, (p[0][1] + p[p.length - 1][1]) / 2);
  for (let i = 0; i < p.length; i += 1) { const a = p[i]; const b = p[(i + 1) % p.length]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  c.closePath(); c.fill();
}
function capsule(c, x1, y1, x2, y2, r) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.beginPath();
  c.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2);
  c.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2);
  c.closePath(); c.fill();
}
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (r, g2, b) => `#${[r, g2, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, k) => { const x = hexToRgb(a); const y = hexToRgb(b); return toHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k); };
const shadeHex = (h, k) => mix(h, k < 0 ? '#000000' : '#ffffff', Math.abs(k));

function drawPen() {
  const line = lines[Math.min(pen.line, lines.length - 1)];
  const angle = -pen.lean; // barrel up and to the right
  const lift = pen.lift;
  // Shadow first, pushed further out as the pen lifts.
  const sh = 10 + 16 * lift;
  g.save();
  g.translate(pen.x + sh, pen.y + sh * 1.2);
  g.rotate(angle);
  g.scale(1.75, 1.75);
  g.globalAlpha = 0.16;
  g.filter = 'blur(6px)';
  g.fillStyle = '#2a2018';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(250, -34); g.lineTo(330, 40); g.lineTo(150, 60); g.closePath(); g.fill();
  g.restore();
  g.save();
  g.translate(pen.x - 6 * lift, pen.y - 10 * lift);
  g.rotate(angle);
  const sc = 1.75 * (1 + 0.06 * lift);
  g.scale(sc, sc);
  drawHand(g, line && line.color);
  g.restore();
}

// ---------- Stations and labels ----------
const popEase = (k) => { const c1 = 1.70158 * 1.2; const c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
function drawStations() {
  for (const s of stations) {
    const k = s.at < 0 ? 0 : Math.min(1, (clock - s.at) / 0.26);
    const r = 7.5 * (k > 0 ? popEase(k) : 0);
    // Label always sits on the paper, like the station names in the reference; it darkens once a line reaches it.
    g.fillStyle = s.at < 0 ? 'rgba(22,24,29,.45)' : INK;
    g.font = '800 12px ui-monospace, "SF Mono", Menlo, monospace';
    const right = s.x > W() * 0.62;
    g.textAlign = right ? 'right' : 'left';
    const lx = s.x + (right ? -16 : 16);
    g.fillText(s.name, lx, s.y - 4);
    g.font = '700 11px ui-monospace, "SF Mono", Menlo, monospace';
    g.fillStyle = 'rgba(22,24,29,.55)';
    g.fillText(s.note, lx, s.y + 10);
    if (r > 0) {
      g.fillStyle = '#fffdf6'; g.strokeStyle = INK; g.lineWidth = 2.6;
      g.beginPath(); g.arc(s.x, s.y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }
  g.textAlign = 'left';
}

// ---------- Finish: glitch, red frame, clean map ----------
const finish = { t: -1 };
function startFinish() { finish.t = 0; post({ type: 'glitch' }); }
function drawGlitch() {
  const t = finish.t;
  if (t < 0 || t > 0.7) return;
  if (t > 0.52) { g.fillStyle = '#e2392b'; g.fillRect(0, 0, W(), H()); if (!finish.red) { finish.red = true; post({ type: 'red' }); } return; }
  const snap = document.createElement('canvas');
  snap.width = canvas.width; snap.height = canvas.height;
  snap.getContext('2d').drawImage(canvas, 0, 0);
  const n = 7 + Math.floor(Math.random() * 6);
  for (let k = 0; k < n; k += 1) {
    const y = Math.random() * H(); const h = 6 + Math.random() * 46; const dx = (Math.random() - 0.5) * 120;
    g.drawImage(snap, 0, y * dpr, canvas.width, h * dpr, dx, y, W(), h);
    if (Math.random() < 0.4) { g.globalCompositeOperation = 'multiply'; g.fillStyle = Math.random() < 0.5 ? 'rgba(255,0,80,.35)' : 'rgba(0,160,255,.35)'; g.fillRect(dx * 0.5, y, W(), h); g.globalCompositeOperation = 'source-over'; }
  }
  for (let k = 0; k < 4; k += 1) {
    g.fillStyle = ['#e2392b', '#2f55e0', INK, '#e2392b'][k];
    g.fillRect(Math.random() * W(), Math.random() * H(), 20 + Math.random() * 90, 6 + Math.random() * 18);
  }
}

// ---------- Frame ----------
let clock = 0;
let last = performance.now();
let grainShift = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  advance(dt);
  render();
}
function advance(dt) {
  clock += dt;
  for (let k = 0; k < 4; k += 1) stepPen(dt / 4);
  if (finish.t >= 0) finish.t += dt;
}
function render() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = PAPER; g.fillRect(0, 0, W(), H());
  g.drawImage(layers.shadow, 0, 0, W(), H());
  g.drawImage(layers.ink, 0, 0, W(), H());
  drawStations();
  if (!pen.done || pen.x < W() + 200) drawPen();
  // Grain on top of everything, nudged every other frame so the paper never sits dead still.
  grainShift = (grainShift + 1) % 4;
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.22;
  const pat = g.createPattern(layers.grain, 'repeat');
  g.save(); g.translate((grainShift >> 1) * 37, (grainShift >> 1) * 53); g.fillStyle = pat; g.fillRect(-60, -60, W() + 120, H() + 120); g.restore();
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  drawGlitch();
}

window.setLines = (data) => { window.lastData = data; resize(); build(data); };
/** Test hook: run the drawing forward without waiting on frames. */
window.advance = (sec) => { for (let k = 0; k < sec * 120; k += 1) advance(1 / 120); render(); };
canvas.addEventListener('pointerup', () => { if (pen.done && finish.t > 0.7) { post({ type: 'again' }); window.setLines(window.lastData); } });
let sized = `${window.innerWidth}x${window.innerHeight}`;
window.addEventListener('resize', () => {
  const now = `${window.innerWidth}x${window.innerHeight}`;
  if (now === sized) return;
  sized = now;
  if (window.lastData) window.setLines(window.lastData);
});
resize();
requestAnimationFrame(frame);
post({ type: 'ready' });
