import { Canvas, Circle, Group, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { BRUSH_WIDTH, DRAW_MS, HIGHLIGHT, SHADOW, brushCycle, drawEase, marks, mix, wobbleLine, type Brush, type Pt } from '@/lib/brush';

function smooth(pts: readonly Pt[]) {
  const p = Skia.Path.Make();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    p.quadTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  const l = pts[pts.length - 1];
  p.lineTo(l[0], l[1]);
  return p;
}

/** One patterned tube, drawn inside a Skia canvas. Use this when you already have a <Canvas>. */
export function BrushTube({ points, brush, width = BRUSH_WIDTH }: { points: readonly Pt[]; brush: Brush; width?: number }) {
  const path = useMemo(() => (points.length > 1 ? smooth(points) : null), [points]);
  const pattern = useMemo(() => marks(points, brush, width), [points, brush, width]);
  if (!path) return null;
  const segments = brush.to && points.length > 2 ? points.slice(1).map((p, i) => ({ a: points[i], b: p, c: mix(brush.color, brush.to!, (i + 1) / (points.length - 1)) })) : null;
  return (
    <Group>
      <Group transform={[{ translateX: SHADOW.dx }, { translateY: SHADOW.dy }]}>
        <Path path={path} style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round" color={SHADOW.color} />
      </Group>
      {segments
        ? segments.map((s, i) => <Line key={i} p1={vec(s.a[0], s.a[1])} p2={vec(s.b[0], s.b[1])} strokeWidth={width} strokeCap="round" color={s.c} />)
        : <Path path={path} style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round" color={brush.color} />}
      {pattern.map((m, i) =>
        m.kind === 'dot'
          ? <Circle key={i} cx={m.x} cy={m.y} r={m.r} color={m.color} opacity={m.alpha ?? 1} />
          : <Line key={i} p1={vec(m.x1, m.y1)} p2={vec(m.x2, m.y2)} strokeWidth={m.w} strokeCap={m.cap} color={m.color} opacity={m.alpha ?? 1} />,
      )}
      <Group transform={[{ translateX: width * HIGHLIGHT.dx }, { translateY: width * HIGHLIGHT.dy }]}>
        <Path path={path} style="stroke" strokeWidth={Math.max(1, width * HIGHLIGHT.width)} strokeCap="round" strokeJoin="round" color={HIGHLIGHT.color} />
      </Group>
    </Group>
  );
}

/**
 * A standalone patterned stroke for native screens: underlines, dividers, doodles.
 * `points` are in the view's own coordinates.
 */
export function BrushStroke({ points, brush, width, style }: { points: readonly Pt[]; brush: Brush; width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Canvas style={style} pointerEvents="none">
      <BrushTube points={points} brush={brush} width={width} />
    </Canvas>
  );
}

const nextBrush = brushCycle(1);
let seeds = 1;

/**
 * Wraps a line of text and draws a brush stroke under it that draws itself in, left to right.
 * It draws again (next color, new wobble) whenever `redrawKey` changes.
 */
export function Underlined({ children, redrawKey, width = 9, gap = 3, style }: { children: ReactNode; redrawKey?: string | number; width?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Which brush and wobble this stroke uses, and how far it has drawn (0 to 1). Only the animation frame sets it.
  const [anim, setAnim] = useState<{ brush: Brush; seed: number; k: number } | null>(null);
  useEffect(() => {
    const look = { brush: nextBrush(), seed: seeds++ };
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = drawEase(Math.min(1, (Date.now() - t0) / DRAW_MS));
      setAnim({ ...look, k });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [redrawKey]);
  const h = width * 2 + 20;
  const seed = anim?.seed ?? 0;
  const full = useMemo(() => (size.w > 8 ? wobbleLine(size.w, h / 2, seed).map(([x, y]) => [x + width, y] as const) : []), [size.w, h, width, seed]);
  const pts = anim ? full.slice(0, Math.max(2, Math.ceil(full.length * anim.k))) : [];
  return (
    <View style={[{ alignSelf: 'flex-start', marginBottom: width + gap }, style]}>
      <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>{children}</View>
      {anim && pts.length > 1 ? (
        <Canvas pointerEvents="none" style={{ position: 'absolute', left: -width, top: size.h + gap - h / 2 + width / 2, width: size.w + width * 2, height: h }}>
          <BrushTube points={pts} brush={anim.brush} width={width} />
        </Canvas>
      ) : null}
    </View>
  );
}
