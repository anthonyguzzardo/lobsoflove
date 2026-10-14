import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { BackSwing } from '@/components/back-swing';
import { LINES_HTML } from '@/generated/lines-html';
import { useMatches } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

const KEYS = ['ucsd', 'lindavista', 'balboa', 'roosevelt', 'northpark', 'barnes'];

/** Season lines: every player is a line, every court a station, drawn live by a hand (web/lines.js). */
export default function Season() {
  const roster = useRoster();
  const matches = useMatches();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const ready = useRef(false);

  const data = useMemo(() => {
    const sorted = [...matches].sort((a, b) => a.playedAt - b.playedAt);
    const players = roster.map((f) => ({
      name: f.name,
      color: f.color,
      stops: sorted.filter((m) => (m.p1 === f.id || m.p2 === f.id) && m.courtId).map((m) => m.courtId as string),
    }));
    const real = players.filter((p) => p.stops.length > 0);
    if (real.length) return JSON.stringify({ sample: false, players: real });
    // Nothing logged at the courts yet: draw sample routes in the roster's own colors so the page is never empty.
    return JSON.stringify({
      sample: true,
      players: players.slice(0, 6).map((p, i) => ({ ...p, stops: [0, 1, 2, 3].map((k) => KEYS[(i * 2 + k * (i % 2 ? 3 : 2)) % KEYS.length]) })),
    });
  }, [roster, matches]);

  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`);
  useEffect(() => { if (ready.current) run(`window.setLines(${data})`); }, [data]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        ref={web}
        source={{ html: LINES_HTML }}
        originWhitelist={['*']}
        style={styles.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        javaScriptEnabled
        onMessage={(e) => {
          const msg = JSON.parse(e.nativeEvent.data) as { type: string; message?: string; at?: string };
          switch (msg.type) {
            case 'ready': ready.current = true; run(`window.setLines(${data})`); break;
            case 'down': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); sfx('tick', 0.35); break;
            case 'stop': void Haptics.selectionAsync(); sfx('pock', 0.35); break;
            case 'glitch': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('swish', 0.7); break;
            case 'red': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('slam', 0.6); break;
            case 'again': sfx('tick', 0.5); break;
            case 'error': console.warn('season lines:', msg.message, msg.at ?? ''); break;
          }
        }}
      />
      <View style={[styles.back, { top: insets.top + 4 }]} pointerEvents="box-none">
        <BackSwing />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ebe8e2' },
  web: { flex: 1, backgroundColor: '#ebe8e2' },
  back: { position: 'absolute', left: 12 },
});
