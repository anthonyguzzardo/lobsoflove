import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

export const SPLASH_BACKGROUND = '#171d30';
const ART = require('../../assets/images/lol-splash/tennis-world-painted.png');
const native = Platform.OS !== 'web';

/** A short, skippable brand entrance, not a simulated loading percentage. */
export function LolSplash({ onFinish, onReady, preview = false }: {
  onFinish: () => void;
  onReady?: () => void;
  preview?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [replay, setReplay] = useState(0);
  const [arrival] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const finished = useRef(false);
  const readyCallback = useRef(onReady);
  useEffect(() => { readyCallback.current = onReady; }, [onReady]);
  const size = Math.max(120, Math.min(width - 24, height - insets.top - insets.bottom - 140, 660));

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 280, useNativeDriver: native })
      .start(({ finished: done }) => { if (done) onFinish(); });
  }, [onFinish, opacity, reduced]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => { if (active) setReduced(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    // Asset failure or delayed decoding must never trap the user behind the splash.
    const timeout = setTimeout(() => { readyCallback.current?.(); if (!preview) finish(); }, 6000);
    return () => clearTimeout(timeout);
  }, [finish, preview]);

  useEffect(() => {
    if (!loaded || reduced === null) return;
    readyCallback.current?.();
    arrival.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(arrival, {
      toValue: 1, duration: reduced ? 0 : 1100,
      easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: native,
    });
    animation.start();
    const timeout = preview ? undefined : setTimeout(finish, reduced ? 450 : 2400);
    return () => { animation.stop(); if (timeout) clearTimeout(timeout); };
  }, [arrival, finish, loaded, preview, reduced, replay]);

  useEffect(() => () => { opacity.stopAnimation(); }, [opacity]);

  return (
    <Animated.View testID="lol-splash" accessibilityViewIsModal style={[styles.root, { opacity, paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 18) }]}>
      <View style={styles.composition}>
        <Animated.View style={{ width: size, height: size, opacity: arrival, transform: [
          { translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [34, 0] }) },
          { scale: arrival.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          { rotate: arrival.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '0deg'] }) },
        ] }}>
          <Image source={ART} style={StyleSheet.absoluteFill} contentFit="contain" transition={0}
            accessibilityLabel="An illustrated miniature tennis world in an indigo console with amber buttons and a floating yellow ball"
            onLoad={() => setLoaded(true)} onError={() => { readyCallback.current?.(); finish(); }} />
        </Animated.View>
      </View>

      <View style={styles.actions}>
        {preview && <Pressable accessibilityRole="button" accessibilityLabel="Replay intro" onPress={() => setReplay(value => value + 1)} style={styles.control}>
          <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M4 10a8 8 0 1 1 0 6M4 4v6h6" fill="none" stroke="#eab26b" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={preview ? 'Enter game' : 'Skip intro'} onPress={finish} style={styles.control}>
          <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="#eab26b" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: SPLASH_BACKGROUND, zIndex: 100, overflow: 'hidden' },
  composition: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 20, paddingVertical: 16, justifyContent: 'center' },
  control: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#242b42', alignItems: 'center', justifyContent: 'center' },
});
