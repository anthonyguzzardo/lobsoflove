import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, Easing } from 'react-native-reanimated';

import { FighterAvatar } from '@/components/fighter';
import { DAMPING, EASE } from '@/constants/motion';
import type { CastId } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

/**
 * A fighter on the VS stage. Motion spec:
 * - Slam-in: starts 150 px off its side at 1.3x, lands on a spring at damping ratio 0.5 (playful, about 16% overshoot), 520 ms.
 * - Landing: squash to 1.12 wide / 0.88 tall for 80 ms, back on a 0.5 spring. The thump plays 100 ms in, as the body arrives.
 * - Hold: never frozen. Floats 4 px on a 2.6 s sine and breathes 2%.
 */
export function StageFighter({ cast, color, size, from, slam }: { cast: CastId; color: string; size: number; from: 'left' | 'right'; slam: boolean }) {
  const x = useSharedValue(slam ? (from === 'right' ? 150 : -150) : 0);
  const scale = useSharedValue(slam ? 1.3 : 1);
  const squash = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (slam) {
      x.value = withSpring(0, { duration: 520, dampingRatio: DAMPING.playful });
      scale.value = withSpring(1, { duration: 520, dampingRatio: DAMPING.playful });
      squash.value = withDelay(110, withSequence(withTiming(1, { duration: 80, easing: EASE.enter }), withSpring(0, { duration: 420, dampingRatio: DAMPING.playful })));
      const t = setTimeout(() => sfx('slam', 0.9), 100);
      float.value = withDelay(600, withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
      return () => clearTimeout(t);
    }
    float.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [slam, x, scale, squash, float]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: -4 * float.value + 6 * squash.value },
      { scaleX: scale.value * (1 + 0.12 * squash.value) * (1 + 0.02 * float.value) },
      { scaleY: scale.value * (1 - 0.12 * squash.value) * (1 + 0.02 * float.value) },
    ],
  }));

  return (
    <Animated.View style={style}>
      <FighterAvatar cast={cast} color={color} size={size} />
    </Animated.View>
  );
}
