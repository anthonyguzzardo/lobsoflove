// The LobsOfLove brush: fat rounded tubes, each stroke its own color and pattern, after the opening of
// docs/mo-design/vids/pretty-fire-fuckign-art.mov. This file is the one source for the look: the palette and the
// geometry. Two renderers draw it: web/lib/brush.js (canvas 2D, for the WebView pages) and
// src/components/brush-stroke.tsx (Skia, for native screens). Pure: no DOM, no React Native.

export type Pattern = 'dots' | 'stripes' | 'speckle' | 'dash' | 'plain';
export type Brush = { color: string; to?: string; pattern: Pattern; mark?: string };
export type Pt = readonly [number, number, ...number[]];

export const BRUSHES: readonly Brush[] = [
  { color: '#e8432a', pattern: 'dots', mark: '#fff6ec' },
  { color: '#2a63d8', to: '#35c4f0', pattern: 'stripes', mark: '#122a6b' },
  { color: '#f39a2b', pattern: 'speckle', mark: '#1b1408' },
  { color: '#9a4fd6', to: '#d64fb8', pattern: 'dash', mark: '#f3d9ff' },
  { color: '#2f9e5a', pattern: 'plain' },
  { color: '#1f6fe8', pattern: 'plain' },
  { color: '#c4476b', pattern: 'dots', mark: '#fff6ec' },
];

/** Default tube thickness in points. */
export const BRUSH_WIDTH = 15;

/** Contact shadow under the tube, and the highlight along its top edge. */
export const SHADOW = { dx: 1.5, dy: 2.5, color: 'rgba(60,45,30,0.13)' };
export const HIGHLIGHT = { color: 'rgba(255,255,255,0.18)', width: 0.14, dx: -0.16, dy: -0.21 };

/** Points every `step` along the stroke, with the unit direction there: [x, y, ux, uy]. */
export function along(pts: readonly Pt[], step: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    if (!d) continue;
    const ux = (bx - ax) / d;
    const uy = (by - ay) / d;
    let t = step - carry;
    while (t <= d) {
      out.push([ax + ux * t, ay + uy * t, ux, uy]);
      t += step;
    }
    carry = d - (t - step);
  }
  return out;
}

/** Blends two #rrggbb colors; k = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, k: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a);
  const y = p(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}

/** Fixed jitter per mark, so speckles do not shimmer from frame to frame. */
export function jit(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The pattern laid on a tube, as plain shapes any renderer can draw. */
export type Mark =
  | { kind: 'dot'; x: number; y: number; r: number; color: string; alpha?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; color: string; alpha?: number; cap: 'butt' | 'round' };

export function marks(pts: readonly Pt[], brush: Brush, width = BRUSH_WIDTH): Mark[] {
  const r = width / 2;
  const c = brush.mark ?? '#ffffff';
  switch (brush.pattern) {
    case 'dots':
      return along(pts, width * 1.15).map(([x, y]) => ({ kind: 'dot', x, y, r: r * 0.3, color: c }));
    case 'stripes':
      return along(pts, width * 0.5).map(([x, y, ux, uy]) => ({
        kind: 'line', x1: x - uy * r * 0.92, y1: y + ux * r * 0.92, x2: x + uy * r * 0.92, y2: y - ux * r * 0.92,
        w: Math.max(1.4, width * 0.16), color: c, cap: 'butt',
      }));
    case 'speckle':
      return along(pts, width * 0.28).map(([x, y, ux, uy], i) => {
        const o = (jit(i, 1) - 0.5) * r * 1.3;
        return { kind: 'dot', x: x - uy * o, y: y + ux * o, r: r * (0.1 + 0.07 * jit(i, 2)), color: c };
      });
    case 'dash':
      return along(pts, width * 0.55).filter((_, i) => i % 2 === 0).map(([x, y, ux, uy]) => ({
        kind: 'line', x1: x, y1: y, x2: x + ux * width * 0.4, y2: y + uy * width * 0.4,
        w: Math.max(1.6, width * 0.2), color: c, alpha: 0.85, cap: 'round',
      }));
    default:
      return [];
  }
}

/** Hands out brushes in turn, so each new stroke looks different from the last. */
export function brushCycle(start = 0) {
  let n = start;
  return () => BRUSHES[n++ % BRUSHES.length];
}

/**
 * A hand-drawn underline `w` long at height `y`: a slight wave, a small dip, a lift at the end.
 * `seed` changes the wobble so two underlines never match exactly.
 */
export function wobbleLine(w: number, y: number, seed = 0, step = 6): [number, number][] {
  const out: [number, number][] = [];
  const n = Math.max(2, Math.round(w / step));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const wave = Math.sin(k * Math.PI * 2 + seed * 1.7) * 1.6 + Math.sin(k * Math.PI * 5 + seed) * 0.6;
    out.push([k * w, y + wave + (jit(i, seed) - 0.5) * 0.8 - Math.max(0, k - 0.85) * 18]);
  }
  return out;
}

/** How long an underline takes to draw itself, and its curve (the enter ease from docs/mo-design). */
export const DRAW_MS = 420;
export const drawEase = (t: number) => 1 - Math.pow(1 - t, 4);
