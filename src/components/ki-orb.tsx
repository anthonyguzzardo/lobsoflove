import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { MONO, P } from '@/constants/paper';
import { sfx } from '@/lib/sfx';

// A gold aura: a teardrop of flame licking up round the ball (viewBox 100 x 120, ball at 50,72).
const AURA = 'M50 4C56 22 66 18 70 30C74 22 80 22 82 16C84 34 92 44 90 62C96 60 98 54 98 50C100 76 90 100 74 110C66 116 58 118 50 118C42 118 34 116 26 110C10 100 0 76 2 50C2 54 4 60 10 62C8 44 16 34 18 16C20 22 26 22 30 30C34 18 44 22 50 4Z';
// Where the stars sit on the ball's face, for one to seven.
const STARS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-7, 0], [7, 0]], 3: [[0, -6], [-7, 5], [7, 5]], 4: [[-6, -6], [6, -6], [-6, 6], [6, 6]],
  5: [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, 0]], 6: [[-6, -8], [6, -8], [-9, 0], [9, 0], [-6, 8], [6, 8]],
  7: [[-6, -8], [6, -8], [-9, 0], [9, 0], [-6, 8], [6, 8], [0, 0]],
};
const star = (cx: number, cy: number, r: number) => {
  let d = '';
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }
  return `${d}Z`;
};

/**
 * The way up to the sky: a tennis-ball dragon ball burning in a gold Super Saiyan aura. Its stars count the balls you've caught.
 * Press it and the aura flares before you take off.
 */
export function KiOrb({ stars = 4, onPress, label = 'FLY' }: { stars?: number; onPress: () => void; label?: string }) {
  const reduced = useReducedMotion();
  const a = useSharedValue(0); const b = useSharedValue(0); const down = useSharedValue(0); const flare = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    a.value = withRepeat(withTiming(1, { duration: 230, easing: Easing.inOut(Easing.quad) }), -1, true);
    b.value = withRepeat(withTiming(1, { duration: 330, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [a, b, reduced]);
  const outer = useAnimatedStyle(() => ({
    transform: [{ translateY: 6 - a.value * 3 - flare.value * 6 }, { scaleX: 1 - a.value * 0.04 + flare.value * 0.25 }, { scaleY: 1 + a.value * 0.09 + flare.value * 0.4 }],
  }));
  const inner = useAnimatedStyle(() => ({
    opacity: 0.75 + b.value * 0.25,
    transform: [{ translateY: 12 - b.value * 3 - flare.value * 4 }, { scaleX: 0.74 + flare.value * 0.2 }, { scaleY: 0.74 + b.value * 0.1 + flare.value * 0.3 }],
  }));
  const ball = useAnimatedStyle(() => ({ transform: [{ translateY: down.value * 4 }, { scale: 1 - down.value * 0.06 + flare.value * 0.08 }] }));
  const n = Math.min(7, Math.max(1, stars));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fly over San Diego"
      hitSlop={8}
      onPressIn={() => { down.value = withTiming(1, { duration: 70 }); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
      onPressOut={() => { down.value = withSpring(0, { duration: reduced ? 1 : 420, dampingRatio: 0.45 }); }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        sfx('go', 0.9);
        flare.value = withSequence(withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 500 }));
        setTimeout(onPress, reduced ? 0 : 160);
      }}
      style={styles.wrap}
    >
      <Animated.View style={[styles.layer, outer]} pointerEvents="none">
        <Svg width={W} height={H} viewBox="0 0 100 120"><Path d={AURA} fill="#ffd23a" stroke={P.ink} strokeWidth={3.5} strokeLinejoin="round" /></Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, inner]} pointerEvents="none">
        <Svg width={W} height={H} viewBox="0 0 100 120"><Path d={AURA} fill="#fff6b0" /></Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, ball]} pointerEvents="none">
        <Svg width={W} height={H} viewBox="0 0 100 120">
          <Circle cx={50} cy={78} r={26} fill={P.ink} />
          <Circle cx={50} cy={74} r={26} fill="#dcf20c" stroke={P.ink} strokeWidth={3.5} />
          <Path d="M27 62C38 66 40 82 30 90M73 58C62 64 60 80 70 88" fill="none" stroke="#fbfdf0" strokeWidth={3.2} strokeLinecap="round" />
          <G>{STARS[n].map(([x, y], i) => <Path key={i} d={star(50 + x, 74 + y, 5.4)} fill="#e3262b" stroke="#7a0f12" strokeWidth={0.8} />)}</G>
          <Circle cx={41} cy={64} r={4} fill="#fbffd0" opacity={0.7} />
        </Svg>
      </Animated.View>
      <View style={styles.tag} pointerEvents="none"><Text style={styles.tagText}>{label}</Text></View>
    </Pressable>
  );
}

const W = 64; const H = 77;
const styles = StyleSheet.create({
  wrap: { width: W, height: H + 12, alignItems: 'center' },
  layer: { position: 'absolute', left: 0, top: 0, width: W, height: H },
  tag: { position: 'absolute', bottom: 0, backgroundColor: P.ink, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontFamily: MONO, fontWeight: '800', fontSize: 9.5, letterSpacing: 1.4, color: '#ffd23a' },
});
