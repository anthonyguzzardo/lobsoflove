import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { sfx } from '@/lib/sfx';

/** A message from a page in web/ (sent with `post` from web/lib/bridge.js). */
export type SceneMsg = { type: string; [key: string]: any };
export type Cue = (msg: SceneMsg) => void;

/**
 * Haptics and sounds for the pieces every page shares: the slide strip (press, line, slid; web/lib/slide.js), the dock and the
 * travelling fighter (hop, land; web/lib/dock.js, web/lib/hero.js). A screen overrides any of them, or silences one with null.
 */
export const CUES: Record<string, Cue> = {
  press: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('tick', 0.7); },
  line: () => { void Haptics.selectionAsync(); },
  slid: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('swish', 0.8); },
  hop: () => { void Haptics.selectionAsync(); sfx('tick', 0.6); },
  land: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('slam', 0.35); },
};

/**
 * The handle a screen keeps on its page. `run` evaluates JS in the page; anything run before the page says it is ready waits
 * and goes in, in order, the moment it is, so screens never have to track readiness themselves.
 */
export function useScene() {
  const ref = useRef<WebView>(null);
  const state = useRef({ ready: false, queue: [] as string[] });
  const run = useCallback((js: string) => {
    if (state.current.ready) ref.current?.injectJavaScript(`${js};true;`);
    else state.current.queue.push(js);
  }, []);
  const ready = useCallback(() => {
    state.current.ready = true;
    for (const js of state.current.queue.splice(0)) ref.current?.injectJavaScript(`${js};true;`);
  }, []);
  return { ref, run, ready };
}

type Props = {
  scene: ReturnType<typeof useScene>;
  html: string;
  /** For logs: "<name> scene: <error>". */
  name: string;
  /** Overrides for the shared cues (null silences one). */
  cues?: Record<string, Cue | null>;
  /** The page loaded; queued runs have gone in. Demos and one-off setup go here. */
  onReady?: () => void;
  /** Every other message, after its cue has played. */
  onMessage?: (msg: SceneMsg) => void;
  style?: StyleProp<ViewStyle>;
  allowsInlineMediaPlayback?: boolean;
};

/** A full-bleed page from web/, drawn in a WebView that owns its own touches. Every screen with a page uses this. */
export function SceneView({ scene, html, name, cues, onReady, onMessage, style, allowsInlineMediaPlayback }: Props) {
  const { ref, ready } = scene;
  return (
    <WebView
      ref={ref}
      source={{ html }}
      originWhitelist={['*']}
      style={[styles.web, style]}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      contentInsetAdjustmentBehavior="never"
      javaScriptEnabled
      allowsInlineMediaPlayback={allowsInlineMediaPlayback}
      onMessage={(e) => {
        const msg = JSON.parse(e.nativeEvent.data) as SceneMsg;
        if (msg.type === 'error') { console.warn(`${name} scene:`, msg.message, msg.at ?? ''); return; }
        if (msg.type === 'ready') { ready(); onReady?.(); return; }
        const cue = cues && msg.type in cues ? cues[msg.type] : CUES[msg.type];
        cue?.(msg);
        onMessage?.(msg);
      }}
    />
  );
}

const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: '#efece5' } });
