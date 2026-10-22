import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { P } from '@/constants/paper';
import { DAMPING, EASE } from '@/constants/motion';
import { sfx } from '@/lib/sfx';

const SIZE = 52;
const RING_MS = 1600;
const RINGS = 3;

/** One sound wave: a ring that grows out of the speaker and fades, looping. Mounted only while sound is on. */
function Ring({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: RING_MS, easing: EASE.exit }), -1, false));
    return () => cancelAnimation(p);
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * 1.1 }], opacity: (1 - p.value) * 0.55 }));
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
}

/** The app-wide sound switch: a round speaker that sends waves out while sound is on, and a slash when it is off. */
export function SoundButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.08 }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? 'Sound on. Tap to mute everything.' : 'Sound off. Tap to turn it on.'}
      hitSlop={8}
      onPressIn={() => { press.value = withSpring(1, { duration: 180, dampingRatio: DAMPING.playful }); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('tick', 0.5); }}
      onPressOut={() => { press.value = withSpring(0, { duration: 480, dampingRatio: DAMPING.playful }); }}
      onPress={onToggle}
    >
      <Animated.View style={[styles.wrap, face]}>
        {on && !reduced ? Array.from({ length: RINGS }, (_, i) => <Ring key={i} delay={i * (RING_MS / RINGS)} />) : null}
        <View style={styles.disc}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path d="M3 9.5h3.8L12 5.5v13l-5.2-4H3z" fill={P.ink} />
            {on ? (
              <>
                <Path d="M15.5 9a4 4 0 0 1 0 6" stroke={P.ink} strokeWidth={1.8} strokeLinecap="round" fill="none" />
                <Path d="M18.2 6.5a7.5 7.5 0 0 1 0 11" stroke={P.ink} strokeWidth={1.8} strokeLinecap="round" fill="none" />
              </>
            ) : (
              <>
                <Line x1={15.5} y1={9} x2={21} y2={15} stroke={P.red} strokeWidth={2} strokeLinecap="round" />
                <Line x1={21} y1={9} x2={15.5} y2={15} stroke={P.red} strokeWidth={2} strokeLinecap="round" />
              </>
            )}
          </Svg>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  disc: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: P.ink, backgroundColor: P.card,
    alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: P.ink,
  },
});

export const SOUND_BUTTON_SIZE = SIZE;
