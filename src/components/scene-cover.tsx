import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { MONO, P } from '@/constants/paper';

const BALL = 34;
const HOP = 46;
const BEAT = 300;

/**
 * Paper over a page while its WebView loads: a ball bouncing on the spot, so a slow page reads as loading, not frozen.
 * Fades out the moment the page says it is ready. The ball only shows after a short beat, so fast pages never flash it.
 */
export function SceneCover({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  const fade = useSharedValue(1);
  const show = useSharedValue(0);
  const t = useSharedValue(0);
  // After a long wait, say so: a page that takes this long is working hard, not stuck.
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    show.value = withDelay(180, withTiming(1, { duration: 200 }));
    t.value = withRepeat(withSequence(
      withTiming(1, { duration: BEAT, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: BEAT, easing: Easing.in(Easing.quad) }),
    ), -1);
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, [show, t]);

  useEffect(() => {
    if (!ready) return;
    fade.value = withTiming(0, { duration: 220 });
    const timer = setTimeout(() => setGone(true), 240);
    return () => clearTimeout(timer);
  }, [ready, fade]);

  const cover = useAnimatedStyle(() => ({ opacity: fade.value }));
  const group = useAnimatedStyle(() => ({ opacity: show.value }));
  // Up and down, squashed flat on the ground and stretched in the air.
  const ball = useAnimatedStyle(() => {
    const ground = 1 - Math.min(1, t.value * 6);
    return {
      transform: [
        { translateY: -t.value * HOP },
        { scaleX: 1 + ground * 0.18 },
        { scaleY: 1 - ground * 0.18 },
      ],
    };
  });
  const shadow = useAnimatedStyle(() => ({ opacity: 0.22 - t.value * 0.12, transform: [{ scaleX: 1 - t.value * 0.4 }] }));

  if (gone) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.cover, cover]} pointerEvents={ready ? 'none' : 'auto'}>
      <Animated.View style={[styles.stage, group]}>
        <View style={{ height: BALL + HOP, justifyContent: 'flex-end', alignItems: 'center' }}>
          <Animated.View style={ball}>
            <Svg width={BALL} height={BALL} viewBox="0 0 34 34">
              <Circle cx={17} cy={17} r={15} fill={P.ball} stroke={P.ink} strokeWidth={2.5} />
              <Path d="M5 8 Q14 17 5 26 M29 8 Q20 17 29 26" stroke="#fffdf4" strokeWidth={2.2} fill="none" strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </View>
        <Animated.View style={[styles.shadow, shadow]} />
        {slow ? <Text style={styles.slow}>STILL WARMING UP</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: P.paper, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center' },
  shadow: { width: BALL, height: 6, borderRadius: 3, backgroundColor: P.ink, marginTop: 2 },
  slow: { marginTop: 18, fontFamily: MONO, fontWeight: '800', fontSize: 11, letterSpacing: 1.4, color: P.dim },
});
