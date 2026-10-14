import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import venues from '@/data/venues.json';
import { COURTS_HTML } from '@/generated/courts-html';
import { ANTHEMS, playAnthem, stopAnthem, toggleMute } from '@/lib/anthems';
import { courtStats, pickCourt } from '@/lib/courts';
import { useMatches } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import type { ThemeId } from '@/lib/themes';

type Msg =
  | { type: 'ready' } | { type: 'hop' } | { type: 'land' } | { type: 'mute' } | { type: 'back' } | { type: 'press' } | { type: 'line' } | { type: 'slid' } | { type: 'dive' }
  | { type: 'stage'; id: string; anthem: ThemeId }
  | { type: 'link'; anthem: ThemeId }
  | { type: 'pick'; id: string }
  | { type: 'error'; message: string; at?: string };

/**
 * Courts: five favorite venues as to-scale islands, drawn by three.js in a WebView (web/courts.js).
 * Hopping onto a venue starts its song; "Play here" picks it.
 */
export default function Courts() {
  const params = useLocalSearchParams<{ from?: string; demo?: string }>();
  const roster = useRoster();
  const matches = useMatches();
  const web = useRef<WebView>(null);
  const you = roster.find((f) => f.isYou) ?? roster[0];
  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`);
  useEffect(() => stopAnthem, []);
  // Coming back from the opponent screen lands you beside the court you picked, not still inside it.
  useFocusEffect(useCallback(() => { web.current?.injectJavaScript('window.undive && window.undive();true;'); }, []));

  const data = JSON.stringify({
    color: you.color,
    venues: venues.map((v) => {
      const s = courtStats(v.id, matches);
      const [w, l] = s.record(you.id);
      const song = ANTHEMS[v.anthem as ThemeId];
      return { id: v.id, played: s.played, king: s.king ? roster.find((f) => f.id === s.king)?.name ?? null : null, rec: `${w}–${l}`, song: song ? { title: song.title, artist: song.artist, year: song.year } : null };
    }),
  });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        ref={web}
        source={{ html: COURTS_HTML }}
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
            run(`window.setCourts(${data})`);
            if (params.demo === '1') run('window.demoCourts()');
            if (params.demo === 'roosevelt') run('window.demoRoosevelt()');
            if (params.demo === 'northpark') run('window.demoNorthPark()');
            if (params.demo === 'lv') run('window.demoLv()');
          } else if (msg.type === 'stage') playAnthem(msg.anthem);
          else if (msg.type === 'hop') { void Haptics.selectionAsync(); sfx('tick', 0.5); }
          else if (msg.type === 'land') { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('slam', 0.3); }
          else if (msg.type === 'press') { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('tick', 0.7); }
          else if (msg.type === 'line') void Haptics.selectionAsync();
          else if (msg.type === 'slid') { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('swish', 0.8); }
          else if (msg.type === 'dive') sfx('go', 0.8);
          else if (msg.type === 'mute') toggleMute();
          else if (msg.type === 'back') goBack();
          else if (msg.type === 'link') { const a = ANTHEMS[msg.anthem]; if (a) void Linking.openURL(a.link); }
          else if (msg.type === 'pick') {
            pickCourt(msg.id);
            // Opened from a match in progress: hand the court back. Opened from home: go pick the opponent next.
            if (params.from === 'match') goBack(); else router.push('/case');
          } else console.warn('courts scene:', msg.message, msg.at ?? '');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
  web: { flex: 1, backgroundColor: '#efece5' },
});
