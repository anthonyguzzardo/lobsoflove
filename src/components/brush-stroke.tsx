import { Canvas, Circle, Group, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { BRUSH_WIDTH, HIGHLIGHT, SHADOW, marks, mix, type Brush, type Pt } from '@/lib/brush';

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
