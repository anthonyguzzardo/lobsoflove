import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import { inkButtonText, label as labelStyle, MONO, P } from '@/constants/paper';
import { DAMPING, EASE, MS } from '@/constants/motion';
import { sfx } from '@/lib/sfx';

/** How far the face sits above its shadow, and so how far it travels when pressed. */
const LIFT = 5;

/**
 * A physical ink button. Press: the face sinks onto its shadow and squashes. Release: it springs back past rest and settles.
 * If onPress returns a promise the face stays down with a ball bouncing inside until it settles; success pops it, failure shakes it.
 */
export function InkButton({ label, onPress, ghost = false, hot = false, style }: {
  label: string;
  onPress: () => void | Promise<unknown>;
  /** Cream face with an ink border instead of a solid ink face. */
  ghost?: boolean;
  /** Red face: the thing that needs doing. */
  hot?: boolean;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const down = useSharedValue(0); // 0 resting, 1 on the shadow
  const squash = useSharedValue(0);
  const shake = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const spring = (to: number, ratio: number, ms: number = MS.move) => withSpring(to, { duration: reduced ? 1 : ms, dampingRatio: ratio });

  const pressIn = () => {
    if (busy) return;
    down.value = withTiming(1, { duration: MS.feedback * 0.6, easing: EASE.move });
    squash.value = withTiming(1, { duration: MS.feedback * 0.6, easing: EASE.move });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sfx('tick', 0.5);
  };
  const release = () => {
    // Up past rest, then settle: the playful spring the characters use.
    down.value = spring(0, DAMPING.playful, 520);
    squash.value = withSequence(withTiming(-0.8, { duration: 90, easing: EASE.exit }), spring(0, DAMPING.playful, 480));
  };
  const fire = () => {
    if (busy) return;
    sfx('pock', 0.8);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const r = onPress();
    if (!r || typeof (r as Promise<unknown>).then !== 'function') { release(); return; }
    setBusy(true);
    down.value = withTiming(1, { duration: MS.feedback });
    (r as Promise<unknown>).then(
      () => {
        if (!live.current) return;
        setBusy(false);
        release();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        sfx('ping', 0.7);
      },
      () => {
        if (!live.current) return;
        setBusy(false);
        release();
        shake.value = withSequence(
          withTiming(-10, { duration: 50 }), withTiming(9, { duration: 70 }), withTiming(-6, { duration: 70 }),
          withTiming(4, { duration: 60 }), spring(0, DAMPING.premium, 260),
        );
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        sfx('bloop', 0.7);
      },
    );
  };

  const face = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value },
      { translateY: down.value * LIFT },
      { scaleX: 1 + squash.value * 0.025 },
      { scaleY: 1 - squash.value * 0.06 },
    ],
  }));
  const shadow = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const color = ghost ? P.ink : P.paper;
  return (
    <Pressable onPressIn={pressIn} onPressOut={() => { if (!busy) release(); }} onPress={fire} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy }} style={[{ paddingBottom: LIFT }, style]}>
      <Animated.View style={[styles.shadow, shadow]} />
      <Animated.View style={[styles.face, ghost && styles.ghost, hot && styles.hot, face]}>
        {busy ? <Bouncer color={color} /> : <Text style={[inkButtonText, { color }]}>{label}</Text>}
      </Animated.View>
    </Pressable>
  );
}

/** A ball bouncing in place on the button's floor while the server answers. */
function Bouncer({ color }: { color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(
      withTiming(-9, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }),
    ), -1);
    return () => cancelAnimation(y);
  }, [y]);
  // Squashes when it lands.
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scaleX: y.value > -1 ? 1.25 : 1 }, { scaleY: y.value > -1 ? 0.8 : 1 }] }));
  return (
    <View style={styles.bouncerRow}>
      <Animated.View style={[styles.ball, { backgroundColor: color === P.paper ? P.ball : P.red }, s]} />
    </View>
  );
}

/** An underlined mono link that dips and springs back, for the small actions (SEND LINK, HOME). */
export function InkLink({ label, onPress, color = P.ink }: { label: string; onPress: () => void; color?: string }) {
  const reduced = useReducedMotion();
  const d = useSharedValue(0);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: d.value * 3 }, { scale: 1 - d.value * 0.05 }] }));
  return (
    <Pressable
      hitSlop={10}
      accessibilityRole="button"
      onPressIn={() => { d.value = withTiming(1, { duration: MS.feedback * 0.6 }); void Haptics.selectionAsync(); sfx('tick', 0.4); }}
      onPressOut={() => { d.value = withSpring(0, { duration: reduced ? 1 : 420, dampingRatio: DAMPING.playful }); }}
      onPress={() => { sfx('pock', 0.6); onPress(); }}
    >
      <Animated.Text style={[styles.link, { color }, st]}>{label}</Animated.Text>
    </Pressable>
  );
}

/** Rises into place on the enter curve, `index` steps behind the one before it. Nothing pops in from nowhere. */
export function Rise({ index = 0, children, style }: { index?: number; children: ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(index * MS.listStagger, withTiming(1, { duration: MS.move + 120, easing: EASE.enter }));
  }, [index, reduced, t]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, t.value * 1.6), transform: [{ translateY: (1 - t.value) * 22 }, { rotate: `${(1 - t.value) * -1.2}deg` }] }));
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
}

/** Never frozen: a 2% breath, for something that is waiting on you. */
export function Breathe({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const b = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    b.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(b);
  }, [b, reduced]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + b.value * 0.04 }, { rotate: `${(b.value - 0.5) * 2}deg` }] }));
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', left: 0, right: 0, top: LIFT, bottom: 0, backgroundColor: P.ink, borderRadius: 5 },
  face: { backgroundColor: P.ink, borderRadius: 5, borderWidth: 2, borderColor: P.ink, paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  ghost: { backgroundColor: P.card },
  hot: { backgroundColor: P.red },
  bouncerRow: { height: 20, justifyContent: 'flex-end', alignItems: 'center' },
  ball: { width: 12, height: 12, borderRadius: 6 },
  link: { ...labelStyle, fontFamily: MONO, textDecorationLine: 'underline' },
  pillShadow: { position: 'absolute', left: 0, right: 0, top: 3, bottom: 0, backgroundColor: P.ink, borderRadius: 4 },
  pill: { backgroundColor: P.card, borderColor: P.ink, borderWidth: 2, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontFamily: MONO, fontWeight: '800', fontSize: 11, letterSpacing: 1.4, color: P.ink, maxWidth: 150 },
});

/** A small tag-shaped button for overlays on a scene (home's crew and confirm tags): same sink and spring as InkButton. */
export function InkPill({ label, onPress, hot = false }: { label: string; onPress: () => void; hot?: boolean }) {
  const reduced = useReducedMotion();
  const d = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: d.value * 3 }, { scaleY: 1 - d.value * 0.06 }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ paddingBottom: 3 }}
      onPressIn={() => { d.value = withTiming(1, { duration: MS.feedback * 0.6, easing: EASE.move }); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('tick', 0.5); }}
      onPressOut={() => { d.value = withSpring(0, { duration: reduced ? 1 : 480, dampingRatio: DAMPING.playful }); }}
      onPress={onPress}
    >
      <View style={styles.pillShadow} />
      <Animated.View style={[styles.pill, hot && styles.hot, face]}>
        <Text style={[styles.pillText, hot && { color: P.paper }]} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
