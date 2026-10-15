import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { SceneView, useScene } from '@/components/scene-view';
import { STANDINGS_HTML } from '@/generated/standings-html';
import { computeSeason, useMatches } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

/**
 * Standings: the tesseract. Every fighter is its jelly body, floating in the void, ranked by depth (web/standings.js).
 * Drag to fly through the ranks, tap a fighter or a piece of floating wreckage to knock it, ride the dock to jump to a rank.
 */
export default function Standings() {
  const roster = useRoster();
  const matches = useMatches();
  const scene = useScene();
  const { run } = scene;
  const { rows } = computeSeason(roster, matches);
  const byId = (id: string) => roster.find((f) => f.id === id);

  const data = JSON.stringify({
    fighters: rows.flatMap((r) => {
      const f = byId(r.id);
      return f ? [{ id: f.id, name: f.name, cast: f.cast, color: f.color, points: r.points, wins: r.wins, losses: r.losses, streak: r.streak }] : [];
    }),
  });

  useEffect(() => { run(`window.setStandings(${data})`); }, [run, data]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SceneView
        scene={scene}
        html={STANDINGS_HTML}
        name="standings"
        style={styles.web}
        onMessage={(msg) => { if (msg.type === 'poke') { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('tick', 0.5); } }}
      />
      <BackSwing floating />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050507' },
  web: { backgroundColor: '#050507' },
});
