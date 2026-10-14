import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
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
import Svg, { Circle, Defs, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { sfx } from '@/lib/sfx';

/** Splash palette: indigo console, brass trim, cartridge court, optic ball, cream chalk. */
const INDIGO = '#171d30';
const BRASS = '#eab26b';
const BRASS_DARK = '#7a4f1c';
const CREAM = '#fffdf0';
const W = 136;
const H = 54;
const BALL = 30;
/** Ball rest center, and how far the serve carries it right (clean off the pill's right edge). */
const BALL_X = 28;
const CARRY = 150;
/** Top of the lob arc, measured up from the ball's rest spot. Clears the net with room to spare. */
const ARC = 34;
const NET_X = W / 2 + 4;
/** Idle clock: one 6 s loop; every wave runs whole cycles so the seam never shows. */
const LOOP_MS = 6000;
const FLIGHT_MS = 440;
const TAU = Math.PI * 2;

/** Chalk dust from the splash halo, drifting left to right across the court on the idle clock. */
const MOTES = [
  { color: '#f6b0a6', y: 10, r: 18, p: 0 },
  { color: '#a9b5e8', y: 30, r: 22, p: 0.25 },
  { color: '#b3e0cf', y: 18, r: 16, p: 0.5 },
  { color: '#f5e3a1', y: 36, r: 20, p: 0.75 },
] as const;

/** Chalk puffs kicked up along the serve; `at` is the flight fraction where each blooms, `y` is up from the baseline. */
const PUFFS = [
  { color: '#f6b0a6', x: 24, y: 6, r: 20, at: 0.02 },
  { color: '#cdb4e6', x: 52, y: 26, r: 24, at: 0.22 },
  { color: '#b3e0cf', x: 84, y: 34, r: 26, at: 0.42 },
  { color: '#f5e3a1', x: 112, y: 26, r: 24, at: 0.6 },
  { color: '#a9b5e8', x: 138, y: 8, r: 28, at: 0.78 },
] as const;

function Chalk({ r, color, id }: { r: number; color: string; id: string }) {
  return (
    <Svg width={r * 2} height={r * 2}>
      <Defs>
        <RadialGradient id={id} cx="45%" cy="45%" r="50%">
          <Stop offset="0" stopColor={CREAM} stopOpacity={0.9} />
          <Stop offset="0.35" stopColor={color} stopOpacity={0.75} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
    </Svg>
  );
}

function Mote({ clock, m, i }: { clock: SharedValue<number>; m: (typeof MOTES)[number]; i: number }) {
  const style = useAnimatedStyle(() => {
    // 2 crossings per loop, wrapping left to right.
    const u = (2 * clock.value + m.p) % 1;
    return {
      opacity: 0.4 * Math.sin(Math.PI * u),
      transform: [
        { translateX: -m.r + (W + 2 * m.r) * u },
        { translateY: 3 * Math.sin(TAU * (u + m.p)) },
        { scale: 0.6 + 0.6 * u },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -m.r, top: m.y - m.r }, style]}>
      <Chalk r={m.r} color={m.color} id={`mote${i}`} />
    </Animated.View>
  );
}

function Puff({ go, p, i }: { go: SharedValue<number>; p: (typeof PUFFS)[number]; i: number }) {
  const style = useAnimatedStyle(() => {
    const u = Math.min(1, Math.max(0, (go.value - p.at) / (1 - p.at)));
    return {
      opacity: u === 0 ? 0 : 0.95 * (1 - 0.55 * u),
      transform: [{ translateY: -8 * u }, { scale: 0.3 + 1.1 * Math.sqrt(u) }],
    };
  });
  const top = H - 8 - p.y - p.r;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: p.x - p.r, top }, style]}>
      <Chalk r={p.r} color={p.color} id={`puff${i}`} />
    </Animated.View>
  );
}

/**
 * The enter button, sibling to BackSwing: a brass-trimmed cartridge court under a glass lid. Touch tosses the ball up
 * and cracks the lid; release serves it right, lobbing over the net on a chalk-dust trail, and the baseline chalks
 * itself in beneath. The ball leaves the right edge and `onEnter` fires.
 */
export function EnterServe({ onEnter, label = 'Enter' }: { onEnter: () => void; label?: string }) {
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
  // The lid hinges open from its top edge while held, and stays open through the serve.
  const lid = useAnimatedStyle(() => {
    const open = Math.max(held.value, go.value > 0 ? 1 : 0);
    return {
      transform: [
        { perspective: 220 },
        { translateY: -11 },
        { rotateX: `${-72 * open}deg` },
        { translateY: 11 },
      ],
      opacity: 1 - 0.35 * open,
    };
  });
  const ball = useAnimatedStyle(() => {
    const g = go.value;
    const h = held.value;
    // Idle: six little bounces per loop on the baseline, squashing on each landing.
    const bounce = Math.abs(Math.sin(Math.PI * 6 * clock.value)) * (1 - h) * (1 - g);
    const land = Math.max(0, 1 - 5 * bounce) * (1 - h) * (1 - g);
    return {
      transform: [
        { translateX: -4 * h + CARRY * g },
        { translateY: -5 * bounce - 16 * h - ARC * Math.sin(Math.PI * g) },
        { scaleX: 1 + 0.14 * land - 0.1 * h + 0.28 * g * (1 - g) * 2 },
        { scaleY: 1 - 0.14 * land + 0.14 * h - 0.14 * g * (1 - g) * 2 },
      ],
    };
  });
  const seam = useAnimatedStyle(() => ({
    transform: [{ rotate: `${12 - 24 * Math.sin(TAU * clock.value) + 900 * go.value}deg` }],
  }));
  // The net leans with the ball as it clears, then springs back.
  const net = useAnimatedStyle(() => {
    const u = Math.min(1, Math.max(0, (go.value - 0.36) / 0.4));
    return { transform: [{ translateY: 9 }, { rotate: `${16 * Math.sin(Math.PI * u) * (1 - 0.5 * u)}deg` }, { translateY: -9 }] };
  });
  // The baseline chalks itself in under the ball, from the serve spot out to the right edge.
  const chalkLine = useAnimatedStyle(() => ({
    width: Math.max(0, (W - BALL_X + 8) * Math.min(1, go.value * 1.15)),
    opacity: go.value === 0 ? 0 : 1,
  }));
  const chevron = useAnimatedStyle(() => ({
    transform: [{ translateX: 3 * Math.sin(TAU * 4 * clock.value) + 4 * held.value + 36 * go.value }],
    opacity: 1 - Math.min(1, go.value * 2),
  }));

  const serve = () => {
    if (busy.current) return;
    busy.current = true;
    held.value = withTiming(0, { duration: 80 });
    go.value = withSequence(
      withTiming(0, { duration: 30 }),
      withTiming(1, { duration: FLIGHT_MS, easing: Easing.bezier(0.3, 0, 0.7, 1) }),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    sfx('pock', 0.6);
    timer.current = setTimeout(() => {
      timer.current = null;
      go.value = 0;
      busy.current = false;
      onEnter();
    }, reducedMotion ? 0 : FLIGHT_MS + 30);
  };

  return (
    <Pressable
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        if (!busy.current) held.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => { held.value = withSpring(0, { damping: 12, stiffness: 280 }); }}
      onPress={serve}
      style={styles.hit}>
      <Animated.View style={[styles.shadow, shadow]} />
      <Animated.View style={[styles.pill, pill]}>
        <View style={styles.clip}>
          <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#4a9a55" />
                <Stop offset="1" stopColor="#2a6238" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill="url(#turf)" />
            {/* Court chalk: sideline, service boxes, and the far baseline. */}
            <Line x1={0} y1={H - 8} x2={W} y2={H - 8} stroke={CREAM} strokeOpacity={0.5} strokeWidth={2} />
            <Line x1={BALL_X - 14} y1={8} x2={BALL_X - 14} y2={H} stroke={CREAM} strokeOpacity={0.55} strokeWidth={2} />
            <Line x1={W - 20} y1={8} x2={W - 20} y2={H} stroke={CREAM} strokeOpacity={0.4} strokeWidth={2} />
            <Line x1={BALL_X - 14} y1={H / 2 + 6} x2={W - 20} y2={H / 2 + 6} stroke={CREAM} strokeOpacity={0.3} strokeWidth={1.5} />
          </Svg>
          {MOTES.map((m, i) => <Mote key={i} clock={clock} m={m} i={i} />)}
          <Animated.View style={[styles.chalkLine, chalkLine]}>
            <Svg width={W} height={8} viewBox={`0 0 ${W} 8`}>
              <Path d={`M0 4C18 2 30 7 48 4S80 1 98 5S124 3 ${W} 4`} fill="none" stroke={CREAM} strokeWidth={4} strokeLinecap="round" strokeOpacity={0.95} />
              <Path d={`M0 4C18 2 30 7 48 4S80 1 98 5S124 3 ${W} 4`} fill="none" stroke="#f6b0a6" strokeWidth={1.6} strokeDasharray="0.1 5" strokeLinecap="round" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.net, net]}>
            <Svg width={22} height={26} viewBox="0 0 22 26">
              <Defs>
                <LinearGradient id="post" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#f0d8a8" />
                  <Stop offset="1" stopColor={BRASS_DARK} />
                </LinearGradient>
              </Defs>
              <Rect x={1.5} y={6} width={19} height={19} fill={INDIGO} fillOpacity={0.55} />
              <Path d="M1.5 10H20.5M1.5 14H20.5M1.5 18H20.5M1.5 22H20.5M5 6V25M9 6V25M13 6V25M17 6V25" stroke={CREAM} strokeOpacity={0.75} strokeWidth={0.8} />
              <Rect x={0} y={5} width={22} height={2.4} rx={1.2} fill={CREAM} />
              <Rect x={0} y={1} width={3} height={25} rx={1.5} fill="url(#post)" />
              <Rect x={19} y={1} width={3} height={25} rx={1.5} fill="url(#post)" />
              <Circle cx={1.5} cy={1.5} r={1.8} fill={BRASS} />
              <Circle cx={20.5} cy={1.5} r={1.8} fill={BRASS} />
            </Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.lid, lid]}>
            <Svg width={W} height={22} viewBox={`0 0 ${W} 22`}>
              <Defs>
                <LinearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#7fb0ff" stopOpacity={0.62} />
                  <Stop offset="1" stopColor="#3a63d6" stopOpacity={0.28} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={W} height={22} fill="url(#glass)" />
              <Path d={`M10 15L34 4M48 15L58 9`} stroke={CREAM} strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" />
              <Rect x={0} y={19} width={W} height={3} fill={BRASS} fillOpacity={0.9} />
            </Svg>
          </Animated.View>
        </View>
        <Animated.View style={[styles.chevron, chevron]}>
          <Svg width={30} height={30} viewBox="0 0 30 30">
            <Path d="M11 5L22 15L11 25" fill="none" stroke={INDIGO} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M11 5L22 15L11 25" fill="none" stroke={BRASS} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Animated.View>
      {PUFFS.map((p, i) => <Puff key={i} go={go} p={p} i={i} />)}
      <Animated.View pointerEvents="none" style={[styles.ball, ball]}>
        <Svg width={BALL} height={BALL} viewBox="0 0 28 28">
          <Defs>
            <RadialGradient id="serveFelt" cx="30%" cy="25%" r="80%">
              <Stop offset="0" stopColor="#f1ff8d" />
              <Stop offset="0.55" stopColor="#d7f205" />
              <Stop offset="1" stopColor="#8ca511" />
            </RadialGradient>
          </Defs>
          <Circle cx={14} cy={14} r={12.6} fill="url(#serveFelt)" stroke={INDIGO} strokeWidth={1.4} />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, seam]}>
          <Svg width={BALL} height={BALL} viewBox="0 0 28 28">
            <Path d="M5 4C16 9 16 19 5 24M23 4C12 9 12 19 23 24" fill="none" stroke={CREAM} strokeWidth={1.8} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignSelf: 'center', width: W + 4, height: H + 4, zIndex: 10 },
  shadow: { position: 'absolute', left: 0, top: 0, width: W, height: H, borderRadius: H / 2, backgroundColor: BRASS_DARK },
  pill: { position: 'absolute', left: 0, top: 0, width: W, height: H, borderRadius: H / 2, borderWidth: 2.5, borderColor: BRASS },
  clip: { flex: 1, borderRadius: H / 2, overflow: 'hidden', backgroundColor: INDIGO },
  chalkLine: { position: 'absolute', left: BALL_X - 2.5, top: H - 8 - 4 - 2.5, height: 8, overflow: 'hidden' },
  net: { position: 'absolute', left: NET_X - 11 - 2.5, top: H - 8 - 26 - 2.5 + 1 },
  lid: { position: 'absolute', left: -2.5, top: -2.5, width: W, height: 22 },
  chevron: { position: 'absolute', right: 2, top: (H - 30) / 2 - 2.5 },
  ball: { position: 'absolute', left: BALL_X - BALL / 2, top: H - 8 - BALL + 2, width: BALL, height: BALL },
});
