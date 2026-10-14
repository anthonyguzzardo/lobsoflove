// Canvas 2D renderer for the LobsOfLove brush. The look itself (palette, pattern geometry) lives in src/lib/brush.ts,
// shared with the Skia renderer in src/components/brush-stroke.tsx. Any web/*.js page can import this.
import { BRUSH_WIDTH, DRAW_MS, HIGHLIGHT, SHADOW, brushCycle, drawEase, marks, mix, wobbleLine } from '../../src/lib/brush.ts';

export { BRUSHES, BRUSH_WIDTH, brushCycle } from '../../src/lib/brush.ts';

/** Smooth path through the points (midpoint quadratics). */
export function strokePath(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  g.lineTo(l[0], l[1]);
}

const nextBrush = brushCycle();

/**
 * Draws strokes as patterned tubes. Each stroke is { pts: [[x, y, ...]], brush? }; a stroke without a brush
 * gets the next one in turn and keeps it.
 */
export function drawBrush(g, strokes, alpha = 1, width = BRUSH_WIDTH) {
  g.save();
  g.globalAlpha = alpha;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.brush) s.brush = nextBrush();
    const b = s.brush;
    const pts = s.pts;
    const r = width / 2;
    g.strokeStyle = SHADOW.color; g.lineWidth = width;
    g.save(); g.translate(SHADOW.dx, SHADOW.dy); strokePath(g, pts); g.stroke(); g.restore();
    g.lineWidth = width;
    if (b.to && pts.length > 2) {
      const n = pts.length - 1;
      for (let i = 1; i <= n; i++) {
        g.strokeStyle = mix(b.color, b.to, i / n);
        g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke();
      }
    } else { g.strokeStyle = b.color; strokePath(g, pts); g.stroke(); }
    for (const m of marks(pts, b, width)) {
      g.globalAlpha = alpha * (m.alpha ?? 1);
      if (m.kind === 'dot') { g.fillStyle = m.color; g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.fill(); }
      else { g.strokeStyle = m.color; g.lineWidth = m.w; g.lineCap = m.cap; g.beginPath(); g.moveTo(m.x1, m.y1); g.lineTo(m.x2, m.y2); g.stroke(); }
    }
    g.globalAlpha = alpha; g.lineCap = 'round';
    g.strokeStyle = HIGHLIGHT.color; g.lineWidth = Math.max(1, width * HIGHLIGHT.width);
    g.save(); g.translate(width * HIGHLIGHT.dx, width * HIGHLIGHT.dy); strokePath(g, pts); g.stroke(); g.restore();
  }
  g.restore();
}

/** A repeating paper-grain pattern to lay over a page: g.fillStyle = paperGrain(g); g.fillRect(...). */
export function paperGrain(g) {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const x = c.getContext('2d');
  const img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 100;
    img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.92; img.data[i + 3] = 22;
  }
  x.putImageData(img, 0, 0);
  return g.createPattern(c, 'repeat');
}

let underlineSeed = 1;
/**
 * Puts a self-drawing brush underline under a DOM element. It redraws (new color, new wobble) whenever the
 * element's text changes, so a headline that changes gets a fresh stroke each time.
 */
export function brushUnderline(el, { width = 10, gap = 4 } = {}) {
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  // Not a child: pages set headline.textContent, which would wipe out a child. Instead a zero-margin spacer goes right
  // after the headline, reserving room for the stroke, and the canvas hangs from it. It moves and fades with the headline.
  const shelf = document.createElement('div');
  shelf.style.cssText = `position:relative;height:${width + gap + 2}px;pointer-events:none;flex:none;`;
  cv.style.cssText = 'position:absolute;pointer-events:none;';
  shelf.appendChild(cv);
  el.insertAdjacentElement('afterend', shelf);
  const g = cv.getContext('2d');
  let raf = 0;
  const stroke = { pts: [], brush: null };
  function run() {
    cancelAnimationFrame(raf);
    // Measure the text, not the box: the line should end where the words end.
    const range = document.createRange();
    range.selectNodeContents(el);
    const left = el.getBoundingClientRect().left;
    const textW = Math.min(el.clientWidth, [...range.getClientRects()].reduce((m, r) => Math.max(m, r.right), left) - left);
    if (textW < 8) { g.clearRect(0, 0, cv.width, cv.height); return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = textW + width * 2, h = width * 2 + 24;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    cv.style.top = `${gap - h / 2 + width / 2}px`;
    cv.style.left = `${el.getBoundingClientRect().left - shelf.getBoundingClientRect().left - width}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const full = wobbleLine(textW, h / 2, underlineSeed++).map(([x, y]) => [x + width, y]);
    stroke.brush = null; // next brush in turn
    const t0 = performance.now();
    const step = () => {
      const k = drawEase(Math.min(1, (performance.now() - t0) / DRAW_MS));
      stroke.pts = full.slice(0, Math.max(2, Math.ceil(full.length * k)));
      g.clearRect(0, 0, w, h);
      drawBrush(g, [stroke], 1, width);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    step();
  }
  let last = '';
  new MutationObserver(() => { if (el.textContent !== last) { last = el.textContent; requestAnimationFrame(run); } }).observe(el, { childList: true, characterData: true, subtree: true });
  last = el.textContent;
  requestAnimationFrame(run);
  return { redraw: run };
}
