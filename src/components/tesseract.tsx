import { type ReactNode, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { EASE, MS } from '@/constants/motion';

/** The tesseract at the end of Interstellar: books smeared through time into streaks, lattice light, black at the core. */
export const TESS = {
  void: '#050507',
  shelf: 'rgba(14,12,12,0.78)',
  edge: '#3a2c24',
  cream: '#efe3cf',
  amber: '#e0a35a',
  rust: '#b5583a',
  rose: '#c99a95',
  slate: '#3d4f66',
  steel: '#8a94a3',
  dim: '#8c8077',
} as const;

/** Mostly dark spines, a few lit ones, the way the shelves read in the film. */
const STREAK_COLORS = ['#1c1512', '#2a1d17', '#231a16', '#16120f', TESS.cream, TESS.amber, TESS.rust, TESS.rose, TESS.slate, TESS.steel, '#5a4436', '#6b5a4c'];
const LOOP_MS = 12000;
const BEAMS = 6;
/** The far opening of the corridor, as a fraction of the screen. */
const FAR = 0.12;
const TAU = Math.PI * 2;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Streak = { points: string; color: string; opacity: number };

/** Four walls of streaks running from the screen edge into the far opening. */
function corridor(w: number, h: number): Streak[] {
  const r = rng(7);
  const out: Streak[] = [];
  const fx0 = (w * (1 - FAR)) / 2;
  const fy0 = (h * (1 - FAR)) / 2;
  const fw = w * FAR;
  const fh = h * FAR;
  const pick = (lit: number) => (r() < lit ? STREAK_COLORS[4 + Math.floor(r() * 6)] : STREAK_COLORS[Math.floor(r() * 4)]);
  const walls = [
    // Side walls are the bookshelves: dense, often lit.
    { n: 46, lit: 0.42, quad: (t: number, u: number) => `0,${t * h} 0,${u * h} ${fx0},${fy0 + u * fh} ${fx0},${fy0 + t * fh}` },
    { n: 46, lit: 0.42, quad: (t: number, u: number) => `${w},${t * h} ${w},${u * h} ${fx0 + fw},${fy0 + u * fh} ${fx0 + fw},${fy0 + t * fh}` },
    // Ceiling and floor are the lattice: sparse, darker.
    { n: 18, lit: 0.18, quad: (t: number, u: number) => `${t * w},0 ${u * w},0 ${fx0 + u * fw},${fy0} ${fx0 + t * fw},${fy0}` },
    { n: 18, lit: 0.18, quad: (t: number, u: number) => `${t * w},${h} ${u * w},${h} ${fx0 + u * fw},${fy0 + fh} ${fx0 + t * fw},${fy0 + fh}` },
  ];
  for (const wall of walls) {
    let t = 0;
    while (t < 1) {
      const thick = (0.4 + r() * 1.6) / wall.n;
      const u = Math.min(1, t + thick);
      out.push({ points: wall.quad(t, u), color: pick(wall.lit), opacity: 0.35 + r() * 0.55 });
      t = u + r() * 0.006;
    }
  }
  return out;
}

function Beam({ clock, i, w, h }: { clock: SharedValue<number>; i: number; w: number; h: number }) {
  const style = useAnimatedStyle(() => {
    const u = (clock.value + i / BEAMS) % 1;
    // Exponential growth reads as constant speed through depth.
    const s = FAR * Math.pow(14, u);
    return { opacity: 0.55 * Math.sin(Math.PI * u) ** 1.5, transform: [{ scale: s }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderWidth: 2, borderColor: TESS.amber }, style]} />;
}

/** Fixed full-screen corridor behind the content; beams fly past on a 12 s loop and the walls breathe 2%. */
export function TesseractBackdrop() {
  const { width: w, height: h } = useWindowDimensions();
  const streaks = useMemo(() => corridor(w, h), [w, h]);
  const clock = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    clock.value = reducedMotion ? 0.3 : withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
  }, [clock, reducedMotion]);
  const walls = useAnimatedStyle(() => ({ transform: [{ scale: 1.02 + 0.02 * Math.sin(TAU * clock.value) }] }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: TESS.void, overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, walls]}>
        <Svg width={w} height={h}>
          {streaks.map((s, i) => <Polygon key={i} points={s.points} fill={s.color} opacity={s.opacity} />)}
        </Svg>
      </Animated.View>
      {Array.from({ length: BEAMS }, (_, i) => <Beam key={i} clock={clock} i={i} w={w} h={h} />)}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="core" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={TESS.void} stopOpacity={1} />
            <Stop offset="0.22" stopColor={TESS.void} stopOpacity={0.92} />
            <Stop offset="0.7" stopColor={TESS.void} stopOpacity={0.15} />
            <Stop offset="1" stopColor={TESS.void} stopOpacity={0.55} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="url(#core)" />
      </Svg>
    </View>
  );
}

/** One shelf's worth of smeared spines, seeded so a fighter keeps the same books. */
export function ShelfStreaks({ seed, width = 420, height = 72 }: { seed: number; width?: number; height?: number }) {
  const bars = useMemo(() => {
    const r = rng(seed);
    const out: { y: number; hh: number; color: string; opacity: number; x: number; len: number }[] = [];
    let y = 0;
    while (y < height) {
      const hh = 2 + r() * 7;
      out.push({ y, hh, color: STREAK_COLORS[4 + Math.floor(r() * 6)], opacity: 0.12 + r() * 0.3, x: r() * width * 0.4, len: width * (0.4 + r() * 0.8) });
      y += hh + 1 + r() * 6;
    }
    return out;
  }, [seed, width, height]);
  const clock = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    clock.value = reducedMotion ? 0 : withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [clock, reducedMotion]);
  const drift = useAnimatedStyle(() => ({ transform: [{ translateX: -40 * clock.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, drift]}>
      <Svg width={width + 60} height={height}>
        {bars.map((b, i) => (
          <Rect key={i} x={b.x} y={b.y} width={b.len} height={b.hh} fill={b.color} opacity={b.opacity} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** Flies a shelf out of the far opening: from small and dim at the vanishing point to its place, staggered. */
export function FromTheCore({ index, children }: { index: number; children: ReactNode }) {
  const t = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    t.value = reducedMotion ? 1 : withDelay(80 + index * MS.listStagger, withTiming(1, { duration: MS.hero, easing: EASE.enter }));
  }, [t, index, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: 40 * (1 - t.value) }, { scale: 0.7 + 0.3 * t.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
