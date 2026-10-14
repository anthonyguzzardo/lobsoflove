// Canvas 2D renderer for the LobsOfLove brush. The look itself (palette, pattern geometry) lives in src/lib/brush.ts,
// shared with the Skia renderer in src/components/brush-stroke.tsx. Any web/*.js page can import this.
import { BRUSH_WIDTH, HIGHLIGHT, SHADOW, brushCycle, marks, mix } from '../../src/lib/brush.ts';

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
