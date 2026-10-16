// The write-anything canvas. One finger writes, one character stacked on top of the last.
// The page only draws and classifies strokes; src/app/ink.tsx recognizes, decodes and parses, then draws a card back here.
//
// Gestures. Every stroke is ink, whatever its shape (circles, zigzags, an @), so control lives in things writing never does:
//   pause ~0.4 s after lifting   next character
//   press and hold still ~0.5 s   erase the last character; keep holding to keep erasing (on a card: throw it away)
//   fast flick to the right       space
//   pause ~1.7 s                  read it: the app draws back what it understood
//   check mark on the card        save           circle an option   answer the card's question
//   drag in from the left edge    leave (a two-finger swipe down works too)
//   two-finger tap                read now (on a card: save)

import { DRAW_MS, drawEase, wobbleLine } from '../src/lib/brush.ts';
import { post } from './lib/bridge.js';
import { drawBrush, paperGrain } from './lib/brush.js';

const PAPER = '#efece5';
const INK = '#16181d';
const CLAY = '#e2562f';
const HAND = '"Marker Felt", "Noteworthy", "Chalkboard SE", cursive';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

// Timing, in ms. CHAR_GAP is the one to tune first: too short splits a 4 into two marks, too long feels slow.
const CHAR_GAP = 420;
const WORD_GAP = 900;
const IDLE_READ = 1700;
const FLY = 340;

const cv = document.getElementById('c');
const g = cv.getContext('2d');
let W = 0, H = 0, TOP = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  readTop();
}
// The notch inset arrives after first layout in a WebView, so it is re-read until it shows up.
function readTop() { TOP = parseFloat(getComputedStyle(document.getElementById('safe')).paddingTop) || 0; }
resize();
window.addEventListener('resize', resize);

const ease = {
  enter: (t) => 1 - Math.pow(1 - t, 4),
  move: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  pop: (t) => { const c1 = 1.56, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const now = () => performance.now();

const S = {
  mode: 'write',      // 'write' | 'card'
  group: [],          // strokes of the character being written
  live: null,         // the stroke under the finger: { id, pts: [[x, y, t]] }
  fading: [],         // ink leaving the screen: { strokes, born, to?: [x, y, size] }
  line: '', pending: 0,
  card: null, cardBorn: 0, cardGone: 0, hits: [], nudge: 0,
  stamp: null,        // { text, born }
};
let charTimer = 0, idleTimer = 0;

// ─── Stroke shape tests ────────────────────────────────────────────────────────

const box = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};
const len = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
const dur = (pts) => pts[pts.length - 1][2] - pts[0][2];

function isFlick(pts, width = W) {
  const dx = pts[pts.length - 1][0] - pts[0][0];
  const dy = pts[pts.length - 1][1] - pts[0][1];
  return dur(pts) < 200 && dx > width * 0.55 && Math.abs(dy) < dx * 0.3;
}
/** Starts at the left edge and drags right: the iOS "back" motion, done with one finger. */
function isEdgeSwipe(pts) {
  const dx = pts[pts.length - 1][0] - pts[0][0];
  const dy = pts[pts.length - 1][1] - pts[0][1];
  return pts[0][0] < 36 && dx > W * 0.3 && Math.abs(dy) < dx * 0.5;
}
function isCircle(pts) {
  const b = box(pts);
  const size = Math.max(b.w, b.h);
  const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
  return pts.length >= 8 && b.w > 36 && b.h > 24 && Math.hypot(ex - sx, ey - sy) < size * 0.42 && len(pts) > size * 2.2;
}
function isCheck(pts) {
  if (pts.length < 5) return false;
  const b = box(pts);
  if (b.w < 36 || b.h < 36) return false;
  let k = 0;
  pts.forEach((p, i) => { if (p[1] > pts[k][1]) k = i; });
  const [sx, sy] = pts[0], [lx, ly] = pts[k], [ex, ey] = pts[pts.length - 1];
  const at = k / (pts.length - 1);
  return at > 0.1 && at < 0.75 && sx < lx && sy < ly - b.h * 0.2 && ex > lx + b.w * 0.15 && ey < ly - b.h * 0.5;
}

// ─── Writing ───────────────────────────────────────────────────────────────────

function closeChar() {
  clearTimeout(charTimer);
  if (!S.group.length) return;
  const t0 = S.group[0].pts[0][2];
  post({ type: 'char', w: W, h: H, strokes: S.group.map((s) => s.pts.map(([x, y, t]) => [x, y, t - t0])) });
  S.fading.push({ strokes: S.group, born: now(), to: TURN ? undefined : lineEnd() });
  S.group = [];
  S.pending++;
  armIdle();
}
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!S.live && !S.group.length && S.mode === 'write') post({ type: 'read' }); }, IDLE_READ);
}
function fadeOut(strokes) { S.fading.push({ strokes, born: now() }); }

function endStroke(st) {
  const pts = st.pts;
  if (pts.length < 2) pts.push([pts[0][0] + 0.5, pts[0][1] + 0.5, pts[0][2] + 1]); // a dot is still a mark (period, i-dot)
  if (isEdgeSwipe(pts)) { fadeOut([st]); post({ type: 'exit' }); return; }

  if (S.mode === 'card') {
    const up = pts.map(toUser); // card hits and shapes are in the writer's frame
    if (S.hits.length && isCircle(up)) {
      const b = box(up);
      const hit = S.hits.find((h) => b.cx > h.x0 - 12 && b.cx < h.x1 + 12 && b.cy > h.y0 - 24 && b.cy < h.y1 + 24) ?? S.hits.find((h) => b.x0 < h.x1 && b.x1 > h.x0 && b.y0 < h.y1 && b.y1 > h.y0);
      if (hit) { fadeOut([st]); post({ type: 'choose', field: hit.field, value: hit.value }); return; }
    }
    if (isCheck(up)) {
      fadeOut([st]);
      if (S.card.canSave) post({ type: 'save' });
      else { S.nudge = now(); post({ type: 'nope' }); }
      return;
    }
    // Anything else means they are not done: put the card away and keep writing.
    dropCard();
    post({ type: 'more' });
  }

  if (isFlick(pts.map(toUser), UW())) { fadeOut([st]); closeChar(); post({ type: 'space' }); armIdle(); return; }
  S.group.push(st);
  clearTimeout(charTimer);
  // Written across (a word, not one stacked letter): each new stroke lands in a new spot instead of on top of the
  // last ones. Pen lifts between a word's letters are longer, so wait longer before calling it done. Judged by where
  // strokes land, not by the shape's width, so a stacked letter written sideways is still one letter.
  charTimer = setTimeout(closeChar, movesOn(S.group) ? WORD_GAP : CHAR_GAP);
}

/** True when the newest stroke landed mostly outside the strokes before it: the writer is moving along a line. */
function movesOn(group) {
  if (group.length < 2) return false;
  const a = box(group[group.length - 1].pts);
  const b = box(group.slice(0, -1).flatMap((x) => x.pts));
  const pad = 6; // dots and dashes have no area of their own
  const ix = Math.max(0, Math.min(a.x1 + pad, b.x1 + pad) - Math.max(a.x0 - pad, b.x0 - pad));
  const iy = Math.max(0, Math.min(a.y1 + pad, b.y1 + pad) - Math.max(a.y0 - pad, b.y0 - pad));
  return (ix * iy) / ((a.w + 2 * pad) * (a.h + 2 * pad)) < 0.3;
}

function dropCard() { if (S.card) { S.cardGone = now(); S.mode = 'write'; } }

// ─── Hold to erase ─────────────────────────────────────────────────────────────
// A finger that lands and stays put is not writing. After HOLD_MS a ring has filled around it and the last character goes;
// held on, another goes every HOLD_REPEAT, like holding backspace. Moving more than HOLD_SLOP first makes it ink instead.
const HOLD_MS = 500;
const HOLD_REPEAT = 360;
const HOLD_SLOP = 10;
let hold = null; // { id, x, y, t0, fired, timer }

function eraseOne() {
  if (S.mode === 'card') { dropCard(); post({ type: 'toss' }); return; }
  clearTimeout(charTimer);
  if (S.group.length) { fadeOut(S.group); S.group = []; post({ type: 'dropped' }); }
  else post({ type: 'erase' });
}
function startHold(id, x, y) {
  hold = { id, x, y, t0: now(), fired: 0, timer: 0 };
  const fire = () => {
    if (!hold) return;
    if (!hold.fired && S.live && S.live.id === hold.id) { S.live = null; } // the dot under the finger was never ink
    hold.fired++;
    hold.flash = now();
    eraseOne();
    hold.timer = setTimeout(fire, HOLD_REPEAT);
  };
  hold.timer = setTimeout(fire, HOLD_MS);
}
function endHold() { if (hold) { clearTimeout(hold.timer); const fired = hold.fired; hold = null; if (fired) armIdle(); return fired; } return 0; }
function drawHold(t) {
  if (!hold) return;
  const k = hold.fired ? 1 : clamp01((t - hold.t0 - 120) / (HOLD_MS - 120));
  if (k <= 0) return;
  g.save();
  g.strokeStyle = CLAY; g.lineWidth = 4; g.lineCap = 'round';
  g.globalAlpha = 0.9;
  g.beginPath(); g.arc(hold.x, hold.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.stroke();
  if (hold.flash) {
    const f = clamp01((t - hold.flash) / 220);
    g.globalAlpha = 0.5 * (1 - f); g.lineWidth = 3;
    g.beginPath(); g.arc(hold.x, hold.y, 34 + 26 * ease.enter(f), 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

// ─── Touch ─────────────────────────────────────────────────────────────────────

const fingers = new Map();
let two = null; // { t0, y0: Map(id -> y), dy, moved }

cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (fingers.size === 2) {
    // Second finger: whatever the first one started was the start of a gesture, not ink.
    if (S.live && S.live.pts.length && dur(S.live.pts) < 350) S.live = null;
    else if (S.live) { endStroke(S.live); S.live = null; }
    endHold();
    two = { t0: now() };
    clearTimeout(charTimer); clearTimeout(idleTimer);
    return;
  }
  if (fingers.size > 2 || two) return;
  const pen = S.mode === 'write' && !S.live ? (() => { const [ux, uy] = toUser([e.clientX, e.clientY]); return inUserDims(() => hitPen(ux, uy)); })() : 0;
  if (pen) { fingers.delete(e.pointerId); PEN = pen; post({ type: 'pen', size: pen }); return; }
  clearTimeout(charTimer); clearTimeout(idleTimer);
  S.live = { id: e.pointerId, pts: [[e.clientX, e.clientY, now()]] };
  startHold(e.pointerId, e.clientX, e.clientY);
});

cv.addEventListener('pointermove', (e) => {
  const f = fingers.get(e.pointerId);
  if (!f) return;
  f.x = e.clientX; f.y = e.clientY;
  if (!S.live || S.live.id !== e.pointerId) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const c of evs.length ? evs : [e]) S.live.pts.push([c.clientX, c.clientY, now()]);
  if (hold && !hold.fired && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP) endHold();
});

function up(e) {
  const f = fingers.get(e.pointerId);
  fingers.delete(e.pointerId);
  if (hold && hold.id === e.pointerId && endHold()) { S.live = null; return; }
  if (two) {
    if (f) { two.dy = (two.dy ?? 0) + (f.y - f.y0) / 2; two.moved = Math.max(two.moved ?? 0, Math.hypot(f.x - f.x0, f.y - f.y0)); }
    if (fingers.size === 0) {
      const t = now() - two.t0;
      if (two.dy > 70) post({ type: 'exit' });
      else if ((two.moved ?? 0) < 24 && t < 400) post({ type: S.mode === 'card' ? (S.card?.canSave ? 'save' : 'nope') : 'readNow' });
      if (S.mode === 'write' && !S.group.length) armIdle();
      two = null;
    }
    return;
  }
  if (S.live && S.live.id === e.pointerId) {
    const st = S.live;
    S.live = null;
    endStroke(st);
  }
}
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);

// ─── From the app ──────────────────────────────────────────────────────────────

window.setLine = (text, pending) => { S.line = text; S.pending = pending; };
window.showCard = (card) => {
  const fresh = !S.card || S.mode !== 'card' || card.lines.join('|') !== S.card.lines.join('|');
  S.card = card; S.mode = 'card'; S.cardGone = 0;
  if (fresh) S.cardBorn = now();
};
window.hideCard = () => dropCard();
window.saved = (text) => { S.stamp = { text, born: now() }; S.card = null; S.mode = 'write'; S.line = ''; };
window.clearAll = () => { S.line = ''; S.pending = 0; S.group = []; S.card = null; S.mode = 'write'; };

// ─── Drawing ───────────────────────────────────────────────────────────────────

// The brush is shared: src/lib/brush.ts holds the look, web/lib/brush.js draws it on a canvas.
// Pen size: three sizes, picked with the three dots under the line (top right). The app remembers the choice.
const PENS = [11, 15, 19];
let PEN = 15;
window.setPen = (w) => { if (PENS.includes(w)) PEN = w; };
const penSpot = (i) => [W - 30 - (PENS.length - 1 - i) * 34, LINE_Y() + 34];
function hitPen(x, y) {
  for (let i = 0; i < PENS.length; i++) { const [px, py] = penSpot(i); if (Math.hypot(x - px, y - py) < 17) return PENS[i]; }
  return 0;
}
function drawPens() {
  if (S.mode === 'card') return;
  PENS.forEach((w, i) => {
    const [x, y] = penSpot(i);
    g.save();
    g.fillStyle = INK; g.globalAlpha = w === PEN ? 0.9 : 0.3;
    g.beginPath(); g.arc(x, y, w / 2, 0, Math.PI * 2); g.fill();
    if (w === PEN) { g.strokeStyle = CLAY; g.globalAlpha = 1; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, w / 2 + 5, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  });
}
const drawInk = (strokes, alpha = 1) => drawBrush(g, strokes, alpha, PEN);
// Paper grain: one noise tile, laid over the whole page at low strength.
const grain = paperGrain(g);

const LINE_Y = () => (TURN ? 20 : Math.max(TOP, 20)) + 54;

// ─── Facing the writer ─────────────────────────────────────────────────────────
// The app finds the turn the writing is at (src/app/ink.tsx reads the line at all four turns). Once it knows, the line,
// the card, the hints and the pen dots are drawn facing the writer, and check marks and circles are judged from their
// side. Ink itself always stays exactly where the finger put it.
let TURN = 0;          // degrees clockwise that turn the writing upright
let turnBorn = 0;
window.setTurn = (t) => { if (t !== TURN) { TURN = t; turnBorn = now(); } };
const side = () => TURN === 90 || TURN === 270;
const UW = () => (side() ? H : W);
const UH = () => (side() ? W : H);
/** A screen point in the writer's frame. */
function toUser([x, y, ...rest]) {
  const r = (TURN * Math.PI) / 180, c = Math.round(Math.cos(r)), s = Math.round(Math.sin(r));
  const dx = x - W / 2, dy = y - H / 2;
  return [UW() / 2 + dx * c - dy * s, UH() / 2 + dx * s + dy * c, ...rest];
}
/** Runs `fn` with W and H set to the writer's width and height (no drawing transform). */
function inUserDims(fn) { const sw = W, sh = H; W = UW(); H = UH(); try { return fn(); } finally { W = sw; H = sh; } }
/** Runs `draw` in the writer's frame: W and H are the writer's width and height while it runs. */
function inUserFrame(draw) {
  const sw = W, sh = H, uw = UW(), uh = UH();
  g.save();
  g.translate(sw / 2, sh / 2);
  g.rotate((-TURN * Math.PI) / 180);
  g.translate(-uw / 2, -uh / 2);
  W = uw; H = uh;
  try { draw(); } finally { W = sw; H = sh; g.restore(); }
}
const LINE_FONT = `700 32px ${HAND}`;
function lineEnd() {
  g.font = LINE_FONT;
  const w = g.measureText(S.line + ' ').width;
  return [Math.min(16 + w, W - 40), LINE_Y() - 12, 26];
}

function drawLine(t) {
  const y = LINE_Y();
  g.save();
  g.font = LINE_FONT;
  g.textBaseline = 'alphabetic';
  const dots = '•'.repeat(Math.max(0, S.pending));
  const textW = g.measureText(S.line).width;
  const dotsW = dots ? g.measureText(' ' + dots).width : 0;
  const overflow = Math.max(0, 16 + textW + dotsW + 24 - W);
  g.fillStyle = INK; g.globalAlpha = 0.9;
  g.fillText(S.line, 16 - overflow, y);
  if (dots) { g.fillStyle = CLAY; g.globalAlpha = 0.5 + 0.4 * Math.sin(t / 140); g.fillText(' ' + dots, 16 - overflow + textW, y); }
  // Caret: where the next letter goes.
  g.globalAlpha = Math.sin(t / 260) > 0 ? 0.9 : 0.15;
  g.fillStyle = CLAY;
  g.fillRect(16 - overflow + textW + dotsW + 4, y - 26, 3, 30);
  g.restore();
  if (overflow) {
    const fade = g.createLinearGradient(0, 0, 40, 0);
    fade.addColorStop(0, PAPER); fade.addColorStop(1, 'rgba(239,236,229,0)');
    g.fillStyle = fade; g.fillRect(0, y - 40, 40, 50);
  }
  // The rule the line sits on.
  g.fillStyle = INK; g.globalAlpha = 0.14; g.fillRect(16, y + 12, W - 32, 2); g.globalAlpha = 1;
}

const EXAMPLES = ['beat dave 6-4 6-2', 'lost 7-5 6-3 @ 5pm', 'restring $28', '6-4 2-6 7-6 w', 'regrip 8 bucks'];
function drawHints(t) {
  if (S.line || S.group.length || S.live || S.mode === 'card' || S.pending || S.stamp) return;
  const i = Math.floor(t / 3400) % EXAMPLES.length;
  const k = (t % 3400) / 3400;
  const a = Math.min(clamp01(k / 0.15), clamp01((1 - k) / 0.15));
  g.save();
  g.textAlign = 'center';
  g.font = `700 13px ${MONO}`;
  g.fillStyle = INK; g.globalAlpha = 0.55;
  g.fillText('TRY WRITING', W / 2, H * 0.4 - 46);
  g.font = `700 36px ${HAND}`;
  g.globalAlpha = 0.22 * a;
  g.fillText(EXAMPLES[i], W / 2, H * 0.4);
  g.restore();
}

function drawLegend() {
  if (S.mode === 'card') return;
  const rows = S.line || S.pending
    ? ['HOLD STILL = ERASE    FLICK RIGHT = SPACE', 'PAUSE = READ IT    DRAG FROM LEFT EDGE = LEAVE']
    : ['ONE LETTER ON TOP OF THE LAST', 'HOLD STILL = ERASE    FLICK RIGHT = SPACE', 'PAUSE = READ IT    DRAG FROM LEFT EDGE = LEAVE'];
  g.save();
  g.font = `700 12px ${MONO}`;
  g.textAlign = 'center';
  g.fillStyle = INK; g.globalAlpha = S.group.length || S.live ? 0.5 : 0.85;
  rows.forEach((r, i) => g.fillText(r, W / 2, H - 34 - (rows.length - 1 - i) * 20));
  g.restore();
}

function revealText(text, x, y, font, color, t0, t, align = 'center') {
  g.save();
  g.font = font;
  g.textAlign = align;
  const w = g.measureText(text).width;
  const k = ease.enter(clamp01((t - t0) / 360));
  const left = align === 'center' ? x - w / 2 : x;
  g.beginPath(); g.rect(left - 4, y - 60, (w + 8) * k, 80); g.clip();
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
  return { x0: left, x1: left + w, y0: y - 30, y1: y + 6 };
}

function drawCard(t) {
  const c = S.card;
  if (!c) return;
  let alpha = 1;
  if (S.cardGone) { alpha = 1 - clamp01((t - S.cardGone) / 180); if (alpha <= 0) { S.card = null; S.cardGone = 0; return; } }
  const shake = S.nudge ? Math.sin((t - S.nudge) / 22) * 8 * (1 - clamp01((t - S.nudge) / 360)) : 0;
  g.save();
  g.globalAlpha = alpha;
  g.translate(shake, 0);
  const born = S.cardBorn;
  const cx = W / 2;
  let y = H * 0.3;
  const sizes = [46, 38, 22];
  c.lines.forEach((ln, i) => {
    const hit = revealText(ln, cx, y, `700 ${sizes[i] ?? 22}px ${HAND}`, i === 0 && ln.startsWith('W') ? CLAY : INK, born + i * 110, t);
    y += (sizes[i] ?? 22) + 20;
    if (i === 0) {
      // The headline of the card gets the brush underline, drawing itself in once the words are written.
      if (S.underBorn !== born) { S.underBorn = born; S.under = { pts: [], brush: null, full: wobbleLine(hit.x1 - hit.x0, 0, born % 97) }; }
      const k = drawEase(clamp01((t - born - 320) / DRAW_MS));
      if (k > 0) {
        S.under.pts = S.under.full.slice(0, Math.max(2, Math.ceil(S.under.full.length * k))).map(([x, yy]) => [hit.x0 + x, hit.y1 + 10 + yy]);
        drawBrush(g, [S.under], alpha, 11);
      }
      y += 14;
    }
  });
  if (c.warn) { revealText(c.warn, cx, y + 4, `700 20px ${HAND}`, CLAY, born + 380, t); y += 40; }

  S.hits = [];
  for (const q of c.questions) {
    y += 16;
    revealText(q.prompt, cx, y, `700 26px ${HAND}`, INK, born + 420, t);
    y += 58;
    g.font = `700 30px ${HAND}`;
    const gap = 34;
    const widths = q.options.map((o) => g.measureText(o.label).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (q.options.length - 1);
    // Options that fit go on one row; otherwise one per row.
    const row = total < W - 40;
    let x = cx - total / 2;
    q.options.forEach((o, k) => {
      const ox = row ? x + widths[k] / 2 : cx;
      const hit = revealText(o.label, ox, y, `700 30px ${HAND}`, INK, born + 520 + k * 90, t);
      // A dashed ring under each option says "circle me".
      g.save();
      g.strokeStyle = INK; g.globalAlpha = alpha * 0.28 * clamp01((t - born - 700) / 300); g.lineWidth = 2; g.setLineDash([5, 6]);
      g.beginPath(); g.ellipse((hit.x0 + hit.x1) / 2, y - 10, (hit.x1 - hit.x0) / 2 + 18, 28, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
      S.hits.push({ ...hit, field: q.field, value: o.value });
      if (row) x += widths[k] + gap; else y += 64;
    });
    if (row) y += 30;
  }

  y = Math.max(y + 40, H - 120);
  const foot = c.canSave ? 'draw a check to save' : c.questions.length ? 'circle one' : c.warn ? 'hold still to toss it, then rewrite' : 'keep writing';
  revealText(foot, cx, y, `700 26px ${HAND}`, c.canSave ? CLAY : INK, born + 600, t);
  g.font = `700 12px ${MONO}`; g.textAlign = 'center'; g.fillStyle = INK; g.globalAlpha = alpha * 0.75;
  g.fillText('HOLD STILL = TOSS    KEEP WRITING = ADD MORE', cx, y + 34);
  g.fillText('DRAG FROM LEFT EDGE = LEAVE', cx, y + 54);
  g.restore();
}

function drawStamp(t) {
  if (!S.stamp) return;
  const k = (t - S.stamp.born) / 900;
  if (k > 1) { S.stamp = null; return; }
  g.save();
  g.translate(W / 2, H * 0.45);
  g.rotate(-0.12);
  g.font = `700 52px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(S.stamp.text).width + 44;
  // Long stamps shrink to fit the screen (rotated, so leave room at the corners).
  const fit = Math.min(1, (W - 56) / w);
  const s = (0.6 + 0.4 * ease.pop(clamp01(k / 0.4))) * fit;
  g.scale(s, s);
  g.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
  g.strokeStyle = CLAY; g.lineWidth = 5;
  g.strokeRect(-w / 2, -40, w, 80);
  g.fillStyle = CLAY; g.fillText(S.stamp.text, 0, 3);
  g.restore();
}

function drawFading(t) {
  S.fading = S.fading.filter((f) => {
    const k = clamp01((t - f.born) / FLY);
    if (k >= 1) return false;
    if (f.to) {
      // Fly into the line: the character shrinks to the line's text size and lands where the next letter goes.
      const b = box(f.strokes.flatMap((s) => s.pts));
      const e = ease.move(k);
      const s = 1 + (f.to[2] / Math.max(b.h, b.w, 1) - 1) * e;
      g.save();
      g.translate(b.cx + (f.to[0] - b.cx) * e, b.cy + (f.to[1] - b.cy) * e);
      g.scale(s, s);
      g.translate(-b.cx, -b.cy);
      drawInk(f.strokes, 1 - 0.8 * e);
      g.restore();
    } else drawInk(f.strokes, 0.5 * (1 - k));
    return true;
  });
}

let frames = 0;
function frame() {
  const t = now();
  if (TOP === 0 && frames++ % 15 === 0) readTop();
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  g.fillStyle = grain;
  g.fillRect(0, 0, W, H);
  const fadeIn = turnBorn ? clamp01((t - turnBorn) / 260) : 1;
  g.globalAlpha = fadeIn;
  inUserFrame(() => { drawLine(t); drawHints(t); drawCard(t); });
  g.globalAlpha = 1;
  drawFading(t);
  drawInk(S.group);
  if (S.live) drawInk([S.live]);
  g.globalAlpha = fadeIn;
  inUserFrame(() => { drawLegend(); drawPens(); drawStamp(t); });
  g.globalAlpha = 1;
  drawHold(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ─── Demo: writes "w 6-4 6-2" stacked, so the whole loop can be recorded without a finger ──────────

const GLYPHS = {
  w: [[[0.08, 0.3], [0.28, 0.9], [0.5, 0.42], [0.72, 0.9], [0.92, 0.3]]],
  6: [[[0.72, 0.06], [0.48, 0.14], [0.32, 0.38], [0.28, 0.68], [0.38, 0.9], [0.58, 0.95], [0.74, 0.8], [0.72, 0.6], [0.55, 0.5], [0.38, 0.58], [0.3, 0.72]]],
  4: [[[0.62, 0.06], [0.2, 0.64], [0.86, 0.64]], [[0.64, 0.32], [0.64, 0.96]]],
  2: [[[0.22, 0.26], [0.38, 0.08], [0.64, 0.07], [0.76, 0.27], [0.6, 0.5], [0.22, 0.93], [0.82, 0.93]]],
  '-': [[[0.22, 0.52], [0.78, 0.52]]],
  ' ': 'flick',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let DEMO_TURN = 0; // write the demo as if the paper were turned: the app must turn it back by DEMO_TURN
async function demoStroke(poly) {
  const size = Math.min(W * 0.7, H * 0.4);
  const ox = (W - size) / 2, oy = H * 0.3;
  if (DEMO_TURN) {
    const r = (-DEMO_TURN * Math.PI) / 180, c = Math.round(Math.cos(r)), sn = Math.round(Math.sin(r));
    poly = poly.map(([x, y]) => [0.5 + (x - 0.5) * c - (y - 0.5) * sn, 0.5 + (x - 0.5) * sn + (y - 0.5) * c]);
  }
  const pts = [];
  for (let i = 1; i < poly.length; i++) {
    const [ax, ay] = poly[i - 1], [bx, by] = poly[i];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) * 14));
    for (let k = 0; k < n; k++) pts.push([ox + (ax + (bx - ax) * (k / n)) * size, oy + (ay + (by - ay) * (k / n)) * size]);
  }
  pts.push([ox + poly[poly.length - 1][0] * size, oy + poly[poly.length - 1][1] * size]);
  clearTimeout(charTimer); clearTimeout(idleTimer);
  S.live = { id: -1, pts: [] };
  for (const [x, y] of pts) { S.live.pts.push([x, y, now()]); await sleep(14); }
  const st = S.live; S.live = null; endStroke(st);
}
/** The demo, written sideways (the paper turned a quarter): the app should find the turn and face the card that way. */
window.demoSideways = async () => { DEMO_TURN = 90; await window.demoInk('w 6-4 6-2', false); };
window.demoInk = async (text = 'w 6-4 6-2', answer = true) => {
  await sleep(700);
  for (const ch of text) {
    if (ch === ' ') { closeChar(); post({ type: 'space' }); await sleep(250); continue; }
    for (const poly of GLYPHS[ch]) { await demoStroke(poly); await sleep(140); }
    await sleep(CHAR_GAP + 260);
  }
  if (!answer) return;
  // Then answer the card: circle the second option, and draw a check.
  for (let i = 0; i < 40 && !S.hits.length; i++) await sleep(150);
  await sleep(1400);
  const h = S.hits[1] ?? S.hits[0];
  if (h) {
    const cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2 - 6, rx = (h.x1 - h.x0) / 2 + 22, ry = 30;
    await demoPath(Array.from({ length: 34 }, (_, k) => { const a = -2.6 + (k / 33) * Math.PI * 2.1; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; }));
    await sleep(1600);
  }
  const x = W * 0.36, y = H * 0.62;
  await demoPath([[x, y], [x + 30, y + 46], [x + 46, y + 70], [x + 80, y + 10], [x + 120, y - 50]]);
};
/** Writes "6-4", then holds still in the middle until two characters are gone. */
window.demoHold = async () => {
  await window.demoInk('6-4', false);
  await sleep(600);
  S.live = { id: -2, pts: [[W / 2, H * 0.5, now()]] };
  startHold(-2, W / 2, H * 0.5);
  await sleep(HOLD_MS + HOLD_REPEAT + 120);
  endHold(); S.live = null;
};
/** Drags in from the left edge: the way out. */
window.demoLeave = async () => { await sleep(1200); await demoPath(Array.from({ length: 20 }, (_, k) => [6 + k * 11, H * 0.5 + k])); };
async function demoPath(pts) {
  S.live = { id: -1, pts: [] };
  for (const [px, py] of pts) { S.live.pts.push([px, py, now()]); await sleep(16); }
  const st = S.live; S.live = null; endStroke(st);
}

post({ type: 'ready' });
