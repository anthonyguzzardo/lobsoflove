import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { SceneView, useScene } from '@/components/scene-view';
import venues from '@/data/venues.json';
import { COURTS_HTML } from '@/generated/courts-html';
import { ANTHEMS, playAnthem, stopAnthem, toggleMute } from '@/lib/anthems';
import { courtStats, pickCourt } from '@/lib/courts';
import { useMatches } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import type { ThemeId } from '@/lib/themes';

/**
 * Courts: six favorite venues as to-scale islands, drawn by three.js in a WebView (web/courts.js).
 * Hopping onto a venue starts its song; "Play here" picks it.
 */
export default function Courts() {
  const params = useLocalSearchParams<{ from?: string; demo?: string }>();
  const roster = useRoster();
  const matches = useMatches();
  const scene = useScene();
  const { run } = scene;
  const you = roster.find((f) => f.isYou) ?? roster[0];
  useEffect(() => stopAnthem, []);
  // Coming back from the opponent screen lands you beside the court you picked, not still inside it.
  useFocusEffect(useCallback(() => { run('window.undive && window.undive()'); }, [run]));

  const data = JSON.stringify({
    color: you.color,
    cast: you.cast,
    venues: venues.map((v) => {
      const s = courtStats(v.id, matches);
      const [w, l] = s.record(you.id);
      const song = ANTHEMS[v.anthem as ThemeId];
      return { id: v.id, played: s.played, king: s.king ? roster.find((f) => f.id === s.king)?.name ?? null : null, rec: `${w}–${l}`, song: song ? { title: song.title, artist: song.artist, year: song.year } : null };
    }),
  });
  useEffect(() => { run(`window.setCourts(${data})`); }, [run, data]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={COURTS_HTML}
        name="courts"
        onReady={() => {
          const demo = { '1': 'demoCourts', roosevelt: 'demoRoosevelt', northpark: 'demoNorthPark', barnes: 'demoBarnes', lv: 'demoLv' }[params.demo ?? ''];
          if (demo) run(`window.${demo}()`);
        }}
        onMessage={(msg) => {
          if (msg.type === 'stage') playAnthem(msg.anthem as ThemeId);
          else if (msg.type === 'dive') sfx('go', 0.8);
          else if (msg.type === 'mute') toggleMute();
          else if (msg.type === 'back') goBack(); // the page says there was no court to step out of
          else if (msg.type === 'link') { const a = ANTHEMS[msg.anthem as ThemeId]; if (a) void Linking.openURL(a.link); }
          else if (msg.type === 'pick') {
            pickCourt(msg.id);
            // Opened from a match in progress: hand the court back. Opened from home: go pick the opponent next.
            if (params.from === 'match') goBack(); else router.push('/case');
          }
        }}
      />
      <BackSwing floating onBack={() => run('window.back()')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
});
