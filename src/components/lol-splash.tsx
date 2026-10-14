import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { EnterServe } from './enter-serve';
import { LoadingScene } from './loading-scene';

export const SPLASH_BACKGROUND = '#171d30';
const native = Platform.OS !== 'web';

/** Offline six-pose entrance; only the pastel backing has a trembling texture. */
export function LolSplash({ onFinish, onReady, preview = false }: {
  onFinish: () => void;
  onReady?: () => void;
  preview?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [replay, setReplay] = useState(0);
  const [opacity] = useState(() => new Animated.Value(1));
  const finished = useRef(false);
  const callbacks = useRef({ onReady, onFinish });
  useEffect(() => { callbacks.current = { onReady, onFinish }; }, [onReady, onFinish]);
  const size = Math.max(120, Math.min(width - 24, height - insets.top - insets.bottom - 140, 660));

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    callbacks.current.onReady?.();
    Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 280, useNativeDriver: native })
      .start(({ finished: done }) => { if (done) callbacks.current.onFinish(); });
  }, [opacity, reduced]);
  const ready = useCallback(() => callbacks.current.onReady?.(), []);
  const complete = useCallback(() => { if (!preview) finish(); }, [finish, preview]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => { if (mounted) setReduced(true); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const state = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => { mounted = false; motion.remove(); state.remove(); };
  }, []);

  useEffect(() => {
    if (preview || !active) return;
    const timeout = setTimeout(finish, 10000);
    return () => clearTimeout(timeout);
  }, [active, finish, preview]);
  useEffect(() => () => { opacity.stopAnimation(); }, [opacity]);

  return <Animated.View testID="lol-splash" accessibilityViewIsModal style={[styles.root, { opacity, paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 18) }]}>
    <View style={styles.composition}>
      <View style={{ width: size, height: size }}>
        {reduced !== null && <LoadingScene key={`${replay}-${reduced}`} reduced={reduced} preview={preview} active={active}
          onReady={ready} onComplete={complete} onError={finish} />}
      </View>
    </View>
    <View style={styles.actions}>
      {preview && <Pressable accessibilityRole="button" accessibilityLabel="Replay intro" onPress={() => setReplay(value => value + 1)} style={styles.control}>
        <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M4 10a8 8 0 1 1 0 6M4 4v6h6" fill="none" stroke="#eab26b" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
      </Pressable>}
      <EnterServe label={preview ? 'Enter game' : 'Skip intro'} onEnter={finish} />
    </View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: SPLASH_BACKGROUND, zIndex: 100, overflow: 'hidden' },
  composition: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 20, paddingVertical: 16, justifyContent: 'center', alignItems: 'center' },
  control: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#242b42', alignItems: 'center', justifyContent: 'center' },
});
