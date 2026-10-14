import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { goBack } from '@/lib/nav';
import { sfx } from '@/lib/sfx';

const INK = '#16181d';
const CREAM = '#fffdf0';
const W = 112;
const H = 50;
/** Ball rest center, and how far it rushes left (past the pill's left edge). */
const BALL_X = 84;
const RUSH = 150;
const BALL = 30;
/** Idle clock: one 6 s loop; every wave runs whole cycles so the seam never shows. */
const LOOP_MS = 6000;
const FLIGHT_MS = 360;

/** The motley: paint blobs from the fire-art ropes, each drifting on its own whole-cycle orbit. */
const BLOBS = [
  { color: '#ff3b30', x: 8, y: -10, r: 34, ax: 10, ay: 6, k: 1, p: 0 },
  { color: '#2f6bff', x: 40, y: 18, r: 30, ax: 12, ay: 7, k: 2, p: 0.3 },
  { color: '#ff9a1f', x: 70, y: -14, r: 32, ax: 9, ay: 8, k: 1, p: 0.55 },
  { color: '#b84dff', x: 92, y: 20, r: 30, ax: 8, ay: 6, k: 2, p: 0.8 },
  { color: '#1fd17a', x: 22, y: 26, r: 24, ax: 14, ay: 4, k: 3, p: 0.15 },
  { color: '#ff3d7f', x: 58, y: 8, r: 22, ax: 16, ay: 9, k: 1, p: 0.65 },
] as const;

/** Smoke wisps that idle right to left across the pill, like the ball's exhaust. */
const WISPS = [
  { y: 4, r: 26, p: 0 },
  { y: 22, r: 22, p: 0.33 },
  { y: 10, r: 30, p: 0.66 },
] as const;

/** Smoke bursts left along the flight; `at` is the flight fraction where each blooms. */
const PUFFS = [
  { x: 74, y: 22, r: 22, at: 0.05 },
  { x: 50, y: 30, r: 26, at: 0.3 },
  { x: 26, y: 18, r: 28, at: 0.5 },
  { x: 0, y: 28, r: 30, at: 0.7 },
] as const;

const TAU = Math.PI * 2;

function Blob({ clock, go, b, i }: { clock: SharedValue<number>; go: SharedValue<number>; b: (typeof BLOBS)[number]; i: number }) {
  const style = useAnimatedStyle(() => {
    const a = TAU * (b.k * clock.value + b.p);
    return {
      transform: [
        { translateX: b.ax * Math.sin(a) - 26 * go.value },
        { translateY: b.ay * Math.cos(a) },
        { scale: 1 + 0.12 * Math.sin(2 * a) + 0.35 * go.value },
      ],
    };
  });
  const d = b.r * 2;
  return (
    <Animated.View style={[{ position: 'absolute', left: b.x - b.r, top: b.y - b.r + H / 2 - 10, width: d, height: d }, style]}>
      <Svg width={d} height={d}>
        <Defs>
          <RadialGradient id={`blob${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={b.color} stopOpacity={1} />
            <Stop offset="0.55" stopColor={b.color} stopOpacity={0.85} />
            <Stop offset="1" stopColor={b.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={b.r} cy={b.r} r={b.r} fill={`url(#blob${i})`} />
      </Svg>
    </Animated.View>
  );
}

function Smoke({ r, id }: { r: number; id: string }) {
  return (
    <Svg width={r * 2} height={r * 2}>
      <Defs>
        <RadialGradient id={id} cx="45%" cy="40%" r="50%">
          <Stop offset="0" stopColor="#f4f0ff" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#d9d2ea" stopOpacity={0.45} />
          <Stop offset="1" stopColor="#d9d2ea" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
    </Svg>
  );
}

function Wisp({ clock, w, i }: { clock: SharedValue<number>; w: (typeof WISPS)[number]; i: number }) {
  const style = useAnimatedStyle(() => {
    // 2 crossings per loop, wrapping right to left.
    const u = (2 * clock.value + w.p) % 1;
    return {
      opacity: 0.32 * Math.sin(Math.PI * u),
      transform: [
        { translateX: W + w.r - (W + 2 * w.r) * u },
        { translateY: -4 * Math.sin(TAU * u) },
        { scale: 0.7 + 0.5 * u },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: -w.r, top: w.y - w.r / 2 }, style]}>
      <Smoke r={w.r} id={`wisp${i}`} />
    </Animated.View>
  );
}

function Puff({ go, p, i }: { go: SharedValue<number>; p: (typeof PUFFS)[number]; i: number }) {
  const style = useAnimatedStyle(() => {
    const u = Math.min(1, Math.max(0, (go.value - p.at) / (1 - p.at)));
    return {
      opacity: u === 0 ? 0 : 0.95 * (1 - 0.6 * u),
      transform: [{ translateY: -10 * u }, { scale: 0.35 + 1.1 * Math.sqrt(u) }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: p.x - p.r, top: p.y - p.r }, style]}>
      <Smoke r={p.r} id={`puff${i}`} />
    </Animated.View>
  );
}

/**
 * The one back button for every screen: a motley, smoking pill; touch winds the ball up, release sends it rushing
 * right to left on a candy-rope trail. `floating` pins it top left under the notch, over full-screen scenes and WebViews.
 */
export function BackSwing({ onBack = goBack, floating = false }: { onBack?: () => void; floating?: boolean }) {
  const insets = useSafeAreaInsets();
  const go = useSharedValue(0);
  const held = useSharedValue(0);
  const clock = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    clock.value = reducedMotion ? 0 : withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
  }, [clock, reducedMotion]);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: 2 * held.value }, { translateY: 2 * held.value }, { scale: 1 - 0.03 * held.value }],
  }));
  const shadow = useAnimatedStyle(() => ({
    transform: [{ translateX: 4 - 2 * held.value }, { translateY: 4 - 2 * held.value }],
  }));
  const ball = useAnimatedStyle(() => {
    const g = go.value;
    return {
      transform: [
        { translateX: 7 * held.value - RUSH * g },
        { translateY: -3 * Math.sin(TAU * 4 * clock.value) * (1 - held.value) * (1 - g) },
        { scaleX: 1 - 0.18 * held.value + 0.55 * g },
        { scaleY: 1 + 0.12 * held.value - 0.28 * g },
      ],
    };
  });
  const seam = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-18 + 30 * Math.sin(TAU * clock.value) - 720 * go.value}deg` }],
  }));
  // The rope is revealed from the ball's rest spot out to wherever the ball is now.
  const rope = useAnimatedStyle(() => ({
    width: Math.max(0, RUSH * go.value - 4),
    opacity: go.value === 0 ? 0 : 1,
  }));
  const chevron = useAnimatedStyle(() => ({
    transform: [{ translateX: -3 * Math.sin(TAU * 4 * clock.value) - 5 * held.value - 30 * go.value }],
    opacity: 1 - go.value,
  }));

  const launch = () => {
    if (busy.current) return;
    busy.current = true;
    held.value = withTiming(0, { duration: 80 });
    go.value = withSequence(
      withTiming(0, { duration: 30 }),
      withTiming(1, { duration: FLIGHT_MS, easing: Easing.bezier(0.55, 0, 0.85, 0.35) }),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    sfx('swish', 0.55);
    timer.current = setTimeout(() => {
      timer.current = null;
      go.value = 0;
      busy.current = false;
      onBack();
    }, reducedMotion ? 0 : FLIGHT_MS + 30);
  };

  const button = (
    <Pressable
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPressIn={() => {
        if (!busy.current) held.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => { held.value = withSpring(0, { damping: 12, stiffness: 280 }); }}
      onPress={launch}
      style={styles.hit}>
      <Animated.View style={[styles.shadow, shadow]} />
      <Animated.View style={[styles.pill, pill]}>
        <View style={styles.clip}>
          {BLOBS.map((b, i) => <Blob key={i} clock={clock} go={go} b={b} i={i} />)}
          {WISPS.map((w, i) => <Wisp key={i} clock={clock} w={w} i={i} />)}
          <Animated.View style={[styles.rope, rope]}>
            <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <Path d="M0 30C14 18 26 40 40 26S66 16 80 28S100 32 112 25" fill="none" stroke="#2f6bff" strokeWidth={5} strokeLinecap="round" />
              <Path d="M0 18C16 30 28 10 44 22S70 34 84 20S102 16 112 24" fill="none" stroke="#ff9a1f" strokeWidth={5} strokeLinecap="round" />
              <Path d="M0 18C16 30 28 10 44 22S70 34 84 20S102 16 112 24" fill="none" stroke="#b84dff" strokeWidth={5} strokeDasharray="5 5" />
              <Path d="M0 25C12 14 30 34 46 24S72 14 86 26S104 28 112 25" fill="none" stroke="#ff3b30" strokeWidth={7} strokeLinecap="round" />
              <Path d="M0 25C12 14 30 34 46 24S72 14 86 26S104 28 112 25" fill="none" stroke={CREAM} strokeWidth={2.6} strokeDasharray="0.1 6" strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </View>
        <Animated.View style={[styles.chevron, chevron]}>
          <Svg width={30} height={30} viewBox="0 0 30 30">
            <Path d="M19 5L8 15L19 25" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M19 5L8 15L19 25" fill="none" stroke={CREAM} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Animated.View>
      {PUFFS.map((p, i) => <Puff key={i} go={go} p={p} i={i} />)}
      <Animated.View pointerEvents="none" style={[styles.ball, ball]}>
        <Svg width={BALL} height={BALL} viewBox="0 0 28 28">
          <Defs>
            <RadialGradient id="felt" cx="30%" cy="25%" r="80%">
              <Stop offset="0" stopColor="#f1ff8d" />
              <Stop offset="0.55" stopColor="#d7f205" />
              <Stop offset="1" stopColor="#8ca511" />
            </RadialGradient>
          </Defs>
          <Circle cx={14} cy={14} r={12.6} fill="url(#felt)" stroke={INK} strokeWidth={1.4} />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, seam]}>
          <Svg width={BALL} height={BALL} viewBox="0 0 28 28">
            <Path d="M5 4C16 9 16 19 5 24M23 4C12 9 12 19 23 24" fill="none" stroke={CREAM} strokeWidth={1.8} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
  if (!floating) return button;
  return <View pointerEvents="box-none" style={[styles.floating, { top: insets.top + 4 }]}>{button}</View>;
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', left: 12, zIndex: 20 },
  hit: { alignSelf: 'flex-start', width: W + 4, height: H + 4, marginBottom: 6, zIndex: 10 },
  shadow: { position: 'absolute', left: 0, top: 0, width: W, height: H, borderRadius: H / 2, backgroundColor: INK },
  pill: { position: 'absolute', left: 0, top: 0, width: W, height: H, borderRadius: H / 2, borderWidth: 2.5, borderColor: INK },
  clip: { flex: 1, borderRadius: H / 2, overflow: 'hidden', backgroundColor: '#1a1033' },
  rope: { position: 'absolute', top: -2.5, bottom: 0, right: W - BALL_X - 2.5, overflow: 'hidden', alignItems: 'flex-end' },
  chevron: { position: 'absolute', left: 9, top: (H - 30) / 2 - 2.5 },
  ball: { position: 'absolute', left: BALL_X - BALL / 2, top: (H - BALL) / 2, width: BALL, height: BALL },
});
