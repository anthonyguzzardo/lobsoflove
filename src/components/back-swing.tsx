import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, useReducedMotion, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

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
      withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.sin) }), -1, true,
    );
  }, [idle, reducedMotion]);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const ball = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, (go.value - 0.65) / 0.35),
    transform: [
      { translateX: 5 * held.value - 34 * go.value },
      { translateY: -3 * idle.value * (1 - held.value) * (1 - go.value) - 7 * Math.sin(Math.PI * go.value) },
      { scaleX: 1 - 0.14 * held.value + 0.2 * Math.sin(Math.PI * go.value) },
      { scaleY: 1 + 0.1 * held.value - 0.12 * Math.sin(Math.PI * go.value) },
    ],
  }));
  const trail = useAnimatedStyle(() => ({
    opacity: (1 - 0.5 * held.value) * (1 - go.value),
    transform: [{ translateX: -8 * go.value }, { scaleX: 1 + 0.8 * go.value }],
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
      withTiming(1, { duration: 185, easing: Easing.bezier(0.45, 0, 0.8, 0.5) }),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sfx('swish', 0.45);
    timer.current = setTimeout(() => {
      timer.current = null;
      go.value = 0;
      busy.current = false;
      onBack();
    }, reducedMotion ? 0 : 220);
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
      <Animated.View style={styles.disc}>
        <Animated.View style={[StyleSheet.absoluteFill, trail]}>
          <Svg width={52} height={52} viewBox="0 0 44 44">
            <G stroke={CREAM} strokeWidth={2.4} strokeLinecap="round">
              <Path d="M28 16.5H35" opacity={0.55} />
              <Path d="M28.5 22H38.5" />
              <Path d="M28 27.5H34" opacity={0.55} />
            </G>
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, ball]}>
          <Svg width={52} height={52} viewBox="0 0 44 44">
            <Circle cx={17} cy={22} r={7.6} fill="#d7f205" />
            <Path d="M11.6 16.6c3.3 2.9 3.3 7.9 0 10.8M22.4 16.6c-3.3 2.9-3.3 7.9 0 10.8" fill="none" stroke={CREAM} strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignSelf: 'flex-start', marginBottom: 6 },
  // The shadow lives on an outer ring: iOS drops shadows on views that clip, and the inner disc must clip the departing ball.
  ledge: { width: 52, height: 52, borderRadius: 26, backgroundColor: INK, shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  disc: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
});
