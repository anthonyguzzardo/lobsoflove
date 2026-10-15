import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { SceneView, useScene } from '@/components/scene-view';
import { LINES_HTML } from '@/generated/lines-html';
import { useMatches } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

const KEYS = ['ucsd', 'lindavista', 'balboa', 'roosevelt', 'northpark', 'barnes'];

/** Season lines: every player is a line, every court a station, drawn live by a hand (web/lines.js). */
export default function Season() {
  const roster = useRoster();
  const matches = useMatches();
  const scene = useScene();
  const { run } = scene;

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

  useEffect(() => { run(`window.setLines(${data})`); }, [run, data]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={LINES_HTML}
        name="season lines"
        style={styles.web}
        onMessage={(msg) => {
          switch (msg.type) {
            case 'down': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); sfx('tick', 0.35); break;
            case 'stop': void Haptics.selectionAsync(); sfx('pock', 0.35); break;
            case 'glitch': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('swish', 0.7); break;
            case 'red': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('slam', 0.6); break;
            case 'again': sfx('tick', 0.5); break;
          }
        }}
      />
      <BackSwing floating />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ebe8e2' },
  web: { backgroundColor: '#ebe8e2' },
});
