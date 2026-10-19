import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { SceneView, useScene } from '@/components/scene-view';
import venues from '@/data/venues.json';
import { COURTS_HTML } from '@/generated/courts-html';
import { ANTHEMS, playAnthem, stopAnthem, toggleMute } from '@/lib/anthems';
import { courtStats, pickCourt } from '@/lib/courts';
import { useMatches } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { demoFriends, islandState, setBeacon, useBeacon, useCrewPeople } from '@/lib/presence';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import type { ThemeId } from '@/lib/themes';

/**
 * Courts: six favorite venues as to-scale islands, drawn by three.js in a WebView (web/courts.js). Hopping between them browses
 * (and starts each one's song); sliding on one lands you there, which is your beacon: no form, you are just there. Friends stand
 * on the islands they are at, faint ones for later. Sliding again where you landed goes to the scoreboard.
 */
export default function Courts() {
  const params = useLocalSearchParams<{ from?: string; demo?: string }>();
  const roster = useRoster();
  const matches = useMatches();
  const scene = useScene();
  const { run } = scene;
  const you = roster.find((f) => f.isYou) ?? roster[0];
  const beacon = useBeacon();
  // In a crew these are your real friends' beacons; out of one, labeled stand-ins so the islands are never empty.
  const crewPeople = useCrewPeople();
  // Re-read the clock every minute, so someone due at 6:30 walks on at 6:30.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60 * 1000); return () => clearInterval(id); }, []);
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

  const friends = crewPeople ?? demoFriends(now);
  const presence = JSON.stringify({
    you: beacon?.venue ?? null,
    mode: params.from === 'match' ? 'pick' : 'meet',
    demo: friends.some((p) => p.demo),
    venues: Object.fromEntries(venues.map((v) => [v.id, islandState(friends.filter((p) => p.venue === v.key), beacon?.venue === v.id, v.courts.length, now)])),
  });
  useEffect(() => { run(`window.setPresence(${presence})`); }, [run, presence]);

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
          else if (msg.type === 'beacon') { setBeacon(msg.id); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('go', 0.8); }
          else if (msg.type === 'leave') { setBeacon(null); sfx('swish', 0.5); }
          else if (msg.type === 'pick') {
            pickCourt(msg.id);
            // Opened from a match in progress: hand the court back. Otherwise the people you landed with are who you play: score it.
            if (params.from === 'match') goBack(); else router.push('/match');
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
