import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { BackSwing } from '@/components/back-swing';
import { STANDINGS_HTML } from '@/generated/standings-html';
import { computeSeason, useMatches } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

type Msg =
  | { type: 'ready' } | { type: 'poke' } | { type: 'line' }
  | { type: 'error'; message: string; at?: string };

/**
 * Standings: the tesseract. Every fighter is its jelly body, floating in the void, ranked by depth (web/standings.js).
 * Drag to fly through the ranks, tap a fighter or a piece of floating wreckage to knock it, ride the dock to jump to a rank.
 */
export default function Standings() {
  const roster = useRoster();
  const matches = useMatches();
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const { rows } = computeSeason(roster, matches);
  const byId = (id: string) => roster.find((f) => f.id === id);

  const data = JSON.stringify({
    fighters: rows.flatMap((r) => {
      const f = byId(r.id);
      return f ? [{ id: f.id, name: f.name, cast: f.cast, color: f.color, points: r.points, wins: r.wins, losses: r.losses, streak: r.streak }] : [];
    }),
  });

  useEffect(() => {
    if (ready.current) web.current?.injectJavaScript(`window.setStandings(${data});true;`);
  }, [data]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WebView
        ref={web}
        source={{ html: STANDINGS_HTML }}
        originWhitelist={['*']}
        style={styles.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        javaScriptEnabled
        onMessage={(e) => {
          const msg = JSON.parse(e.nativeEvent.data) as Msg;
          if (msg.type === 'ready') {
            ready.current = true;
            web.current?.injectJavaScript(`window.setStandings(${data});true;`);
          } else if (msg.type === 'poke') { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('tick', 0.5); }
          else if (msg.type === 'line') void Haptics.selectionAsync();
          else console.warn('standings scene:', msg.message, msg.at ?? '');
        }}
      />
      <BackSwing floating />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050507' },
  web: { flex: 1, backgroundColor: '#050507' },
});
