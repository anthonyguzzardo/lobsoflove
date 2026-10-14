import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { goBack } from '@/lib/nav';
import { sfx } from '@/lib/sfx';

const INK = '#16181d';
const CREAM = '#fffdf0';

/**
 * Back: a tennis ball streaking left, speed lines trailing. Touch-down shoots the ball 34 px off the left edge in 140 ms
 * while the lines stretch after it; the screen changes 150 ms later. Same control as the courts page.
 */
export function BackSwing({ onBack = goBack }: { onBack?: () => void }) {
  const go = useSharedValue(0);
  const ball = useAnimatedStyle(() => ({ opacity: 1 - go.value, transform: [{ translateX: -34 * go.value }] }));
  const trail = useAnimatedStyle(() => ({ opacity: 1 - go.value, transform: [{ translateX: -12 * go.value }, { scaleX: 1 + 0.6 * go.value }] }));
  const disc = useAnimatedStyle(() => ({ transform: [{ translateY: 3 * go.value }] }));
  return (
    <Pressable
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPressIn={() => { go.value = withTiming(1, { duration: 140, easing: Easing.bezier(0.7, 0, 0.84, 0) }); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('swish', 0.6); }}
      onPressOut={() => { go.value = withSequence(withTiming(1, { duration: 150 }), withSpring(0, { dampingRatio: 0.5, duration: 420 })); }}
      onPress={() => setTimeout(onBack, 150)}
      style={styles.hit}>
      <Animated.View style={[styles.ledge, disc]}>
      <Animated.View style={styles.disc}>
        <Animated.View style={[StyleSheet.absoluteFill, trail]}>
          <Svg width={42} height={42} viewBox="0 0 44 44">
            <G stroke={CREAM} strokeWidth={2.4} strokeLinecap="round">
              <Path d="M28 16.5H35" opacity={0.55} />
              <Path d="M28.5 22H38.5" />
              <Path d="M28 27.5H34" opacity={0.55} />
            </G>
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, ball]}>
          <Svg width={42} height={42} viewBox="0 0 44 44">
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
  ledge: { width: 42, height: 42, borderRadius: 21, backgroundColor: INK, shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  disc: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden' },
});
