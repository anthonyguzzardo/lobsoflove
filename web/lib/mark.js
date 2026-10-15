// The mark in the corner: L, a tennis ball, a backwards L, ringed by the patterned brush lines from
// docs/mo-design/vids/pretty-fire-fuckign-art.mov (dots, ticks, dashes, speckle). An unseen pen draws it stroke by stroke,
// over and over, while the ring of lines turns.
//
// Motion. Draw: 3.2 s, strokes in order, each at pen speed (time shared by length). Hold: 0.9 s, never still: the ring keeps
// turning (one turn per 14 s). Un-draw: 1.3 s, the strokes rewind. Gap: 0.35 s. Tap: whatever is left completes in one
// 220 ms pop (0.16,1,0.3,1), the ball squashes to 1.16 wide / 0.86 tall and springs back, and the page goes on to the artwork.
const NS = 'http://www.w3.org/2000/svg';
const PAPER = '#f4efe3';
const DRAW = 3.2;
const HOLD = 0.9;
const UNDRAW = 1.3;
const GAP = 0.35;
const TURN = 14; // seconds per turn of the ring

const mk = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};

// A patterned stroke: the base line, an overlay that cuts the pattern into it, both hidden behind a mask that grows along the path.
const PATTERNS = {
  plain: null,
  dots: (w) => ({ stroke: PAPER, 'stroke-width': w * 0.36, 'stroke-dasharray': `0 ${w * 0.75}`, 'stroke-linecap': 'round' }),
  ticks: (w) => ({ stroke: PAPER, 'stroke-width': w * 0.72, 'stroke-dasharray': `${w * 0.2} ${w * 0.5}`, 'stroke-linecap': 'butt', opacity: 0.8 }),
  dash: (w) => ({ stroke: PAPER, 'stroke-width': w * 1.1, 'stroke-dasharray': `${w * 1.4} ${w * 0.6}`, 'stroke-linecap': 'butt', 'stroke-dashoffset': w * 0.7 }),
  speckle: (w) => ({ stroke: PAPER, 'stroke-width': w * 0.3, 'stroke-dasharray': `0 ${w * 0.55} 0 ${w * 0.9} 0 ${w * 0.4}`, 'stroke-linecap': 'round' }),
};

let uid = 0;

export function mountMark(el, { onTap } = {}) {
  const svg = mk('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, el);
  const defs = mk('defs', {}, svg);
  const ring = mk('g', {}, svg); // turns slowly around the ball
  const body = mk('g', {}, svg);
  const strokes = [];

  function stroke(parent, d, { color, w, pattern = 'plain', cap = 'round', opacity = 1 }) {
    const id = `lolmk${uid++}`;
    const mask = mk('mask', { id }, defs);
    const cover = mk('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': w + 2.5, 'stroke-linecap': cap, 'stroke-linejoin': 'round' }, mask);
    const g = mk('g', { mask: `url(#${id})`, opacity }, parent);
    mk('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': cap, 'stroke-linejoin': 'round' }, g);
    const over = PATTERNS[pattern];
    if (over) mk('path', { d, fill: 'none', ...over(w) }, g);
    const len = cover.getTotalLength ? cover.getTotalLength() : 100;
    cover.setAttribute('stroke-dasharray', String(len));
    cover.setAttribute('stroke-dashoffset', String(len));
    strokes.push({ cover, len, g });
    return g;
  }

  // The ring: five brush arcs at different radii, each its own pattern, drawn last.
  const arc = (r, a0, a1) => {
    const p = (a) => [50 + r * Math.cos(a), 48 + r * Math.sin(a)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const d2r = (d) => (d * Math.PI) / 180;

  // Draw order: left L, the ball, its seams, right L, then the ring.
  stroke(body, 'M22 16V80H42', { color: '#e8664f', w: 7.5, pattern: 'dots' });
  const ballG = mk('g', {}, body);
  const fill = mk('circle', { cx: 50, cy: 48, r: 17.2, fill: '#c7dc5c', opacity: 0 }, ballG);
  stroke(ballG, 'M50 30.5a17.5 17.5 0 1 1-.01 0', { color: '#3f7f5a', w: 3.4, pattern: 'dots' });
  stroke(ballG, 'M42.5 35C37.5 42 37.5 54 42.5 61', { color: '#fff6d8', w: 3 });
  stroke(ballG, 'M57.5 35C62.5 42 62.5 54 57.5 61', { color: '#fff6d8', w: 3 });
  stroke(body, 'M78 16V80H58', { color: '#3f7fc4', w: 7.5, pattern: 'ticks' });
  stroke(ring, arc(27, d2r(200), d2r(330)), { color: '#9fc3a0', w: 2.8, pattern: 'ticks', opacity: 0.72 });
  stroke(ring, arc(31, d2r(20), d2r(150)), { color: '#e8a598', w: 3, pattern: 'dots', opacity: 0.72 });
  stroke(ring, arc(35, d2r(230), d2r(400)), { color: '#b7a7d6', w: 2.6, pattern: 'dash', opacity: 0.68 });
  stroke(ring, arc(39, d2r(60), d2r(210)), { color: '#e3c48e', w: 3.2, opacity: 0.62 });
  stroke(ring, arc(42, d2r(280), d2r(380)), { color: '#8fb8c9', w: 2.8, pattern: 'speckle', opacity: 0.68 });

  // Time shared by length, so the pen moves at one speed.
  const total = strokes.reduce((s, k) => s + k.len, 0);
  let acc = 0;
  for (const k of strokes) { k.a = acc / total; acc += k.len; k.b = acc / total; }

  const ease = (q) => q + 0.35 * (q * q * (3 - 2 * q) - q); // mostly linear, a touch of settle at the ends
  function paint(p) {
    for (const k of strokes) {
      const q = Math.max(0, Math.min(1, (p - k.a) / (k.b - k.a)));
      k.cover.setAttribute('stroke-dashoffset', String(k.len * (1 - ease(q))));
    }
    fill.setAttribute('opacity', String(Math.max(0, Math.min(1, (p - strokes[1].a) / (strokes[1].b - strokes[1].a)))));
  }

  const st = { t0: performance.now(), done: false, pop: null };
  function progressAt(s) {
    const cycle = DRAW + HOLD + UNDRAW + GAP;
    const c = s % cycle;
    if (c < DRAW) return c / DRAW;
    if (c < DRAW + HOLD) return 1;
    if (c < DRAW + HOLD + UNDRAW) return 1 - (c - DRAW - HOLD) / UNDRAW;
    return 0;
  }
  let shown = -1;
  function frame(now) {
    const s = (now - st.t0) / 1000;
    ring.setAttribute('transform', `rotate(${((s / TURN) * 360) % 360} 50 48)`);
    let p;
    if (st.pop) {
      const u = Math.min(1, (now - st.pop.at) / 220);
      const e = 1 - Math.pow(1 - u, 3); // (0.16,1,0.3,1), near enough
      p = st.pop.from + (1 - st.pop.from) * e;
      if (u >= 1 && !st.done) { st.done = true; }
    } else p = progressAt(s);
    if (p !== shown) { shown = p; paint(p); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Tap: finish the drawing in one pop and hand over.
  el.addEventListener('click', () => {
    if (st.pop) return;
    st.pop = { at: performance.now(), from: shown < 0 ? 0 : shown };
    ballG.classList.remove('pop');
    void ballG.getBoundingClientRect();
    ballG.classList.add('pop');
    setTimeout(() => { onTap && onTap(); }, 280);
    // Back on this page later: the pen picks the loop up from a full drawing and un-draws from there.
    setTimeout(() => { st.pop = null; st.done = false; st.t0 = performance.now() - DRAW * 1000; }, 1600);
  });

  return { svg };
}
