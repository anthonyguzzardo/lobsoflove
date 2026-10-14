import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { BackSwing } from '@/components/back-swing';
import { STANDINGS_HTML } from '@/generated/standings-html';
import { computeSeason, scoreLine, useMatches, winnerOf } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

type Msg =
  | { type: 'ready' } | { type: 'poke' } | { type: 'line' }
  | { type: 'match'; id: string }
  | { type: 'error'; message: string; at?: string };

/**
 * Standings: the tesseract. Every fighter is its jelly body, floating in the void, ranked by depth (web/standings.js).
 * Drag to fly through the ranks, tap a fighter to poke it, tap a match to open its card.
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
    matches: [...matches].sort((a, b) => b.playedAt - a.playedAt).map((m) => {
      const w = winnerOf(m);
      return {
        id: m.id,
        a: byId(m.p1)?.name ?? '?',
        b: byId(m.p2)?.name ?? '?',
        winner: w === m.p1 ? 'a' : w === m.p2 ? 'b' : null,
        color: (w && byId(w)?.color) || '#8a94a3',
        score: scoreLine(m.sets),
        court: m.court,
      };
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
          else if (msg.type === 'match') router.push({ pathname: '/card/[id]', params: { id: msg.id } });
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
