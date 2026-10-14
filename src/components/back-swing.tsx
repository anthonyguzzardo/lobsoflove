import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, useReducedMotion, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { goBack } from '@/lib/nav';
import { sfx } from '@/lib/sfx';

const INK = '#16181d';
const CREAM = '#fffdf0';

/** A small wind-up on touch, then a backhand hop on release. */
export function BackSwing({ onBack = goBack }: { onBack?: () => void }) {
  const go = useSharedValue(0);
  const held = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const idle = useSharedValue(0);
  useEffect(() => {
    idle.value = reducedMotion ? 0 : withRepeat(
      withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, [idle, reducedMotion]);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const ball = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, (go.value - 0.65) / 0.35),
    transform: [
      { translateX: 5 * held.value - 34 * go.value },
      { translateY: -7 * idle.value * (1 - held.value) * (1 - go.value) - 10 * Math.sin(Math.PI * go.value) },
      { scaleX: 1 - 0.14 * held.value + 0.2 * Math.sin(Math.PI * go.value) },
      { scaleY: 1 + 0.1 * held.value - 0.12 * Math.sin(Math.PI * go.value) },
    ],
  }));
  const seam = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-18 + 42 * idle.value - 160 * go.value}deg` }],
  }));
  const shadow = useAnimatedStyle(() => ({
    opacity: (0.3 - 0.13 * idle.value) * (1 - go.value),
    transform: [{ scaleX: 1 - 0.3 * idle.value }],
  }));
  const trail = useAnimatedStyle(() => ({
    opacity: Math.sin(Math.PI * go.value),
    transform: [{ translateX: -18 * go.value }, { scaleX: 0.7 + 0.6 * go.value }],
  }));
  const disc = useAnimatedStyle(() => ({
    transform: [{ translateY: 2 * held.value }, { scale: 1 - 0.05 * held.value }],
  }));
  const launch = () => {
    if (busy.current) return;
    busy.current = true;
    held.value = withTiming(0, { duration: 100 });
    go.value = withSequence(
      withTiming(0, { duration: 35 }),
      withTiming(1, { duration: 245, easing: Easing.bezier(0.45, 0, 0.8, 0.5) }),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sfx('swish', 0.45);
    timer.current = setTimeout(() => {
      timer.current = null;
      go.value = 0;
      busy.current = false;
      onBack();
    }, reducedMotion ? 0 : 280);
  };
  return (
    <Pressable
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPressIn={() => {
        if (!busy.current) held.value = withTiming(1, { duration: 100 });
      }}
      onPressOut={() => { held.value = withSpring(0, { damping: 14, stiffness: 260 }); }}
      onPress={launch}
      style={styles.hit}>
      <Animated.View style={[styles.ledge, disc]}>
        <Svg width={60} height={56} viewBox="0 0 60 56">
          <Path d="M8 42Q30 34 52 42L48 48Q30 55 12 48Z" fill="#d5cdbd" />
          <Path d="M8 42Q30 32 52 42Q30 53 8 42" fill={CREAM} stroke="#c5bdac" strokeWidth={1} />
          <Path d="M19 40L14 43L19 46M15 43H27" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Animated.View style={[styles.shadow, shadow]} />
        <Animated.View style={[StyleSheet.absoluteFill, trail]}>
          <Svg width={60} height={56} viewBox="0 0 60 56">
            <Path d="M9 26C24 2 33 43 55 17" fill="none" stroke="#e2562f" strokeWidth={3} strokeLinecap="round" />
            <Path d="M11 30C28 7 35 47 57 23" fill="none" stroke="#7e91c9" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.ball, ball]}>
          <Svg width={28} height={28} viewBox="0 0 28 28">
            <Defs>
              <RadialGradient id="felt" cx="30%" cy="25%" r="80%">
                <Stop offset="0" stopColor="#f1ff8d" />
                <Stop offset="0.55" stopColor="#d7f205" />
                <Stop offset="1" stopColor="#8ca511" />
              </RadialGradient>
            </Defs>
            <Circle cx={14} cy={14} r={13} fill="url(#felt)" />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, seam]}>
            <Svg width={28} height={28} viewBox="0 0 28 28">
              <Path d="M5 4C16 9 16 19 5 24M23 4C12 9 12 19 23 24" fill="none" stroke={CREAM} strokeWidth={1.8} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignSelf: 'flex-start', marginBottom: 6 },
  ledge: { width: 60, height: 56 },
  ball: { position: 'absolute', left: 21, top: 9, width: 28, height: 28 },
  shadow: { position: 'absolute', left: 24, top: 39, width: 23, height: 5, borderRadius: 12, backgroundColor: INK },
});
