import * as Haptics from 'expo-haptics';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { HOME_HTML } from '@/generated/home-html';
import { dueList, useCloset } from '@/lib/gear';
import { computeSeason, scoreLine, useMatches, winnerOf } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

type Msg = { type: 'ready' } | { type: 'press' } | { type: 'line' } | { type: 'slid' } | { type: 'hop' } | { type: 'land' } | { type: 'go'; to: keyof typeof ROUTES } | { type: 'error'; message: string; at?: string };

const ROUTES: Record<'play' | 'courts' | 'standings' | 'fighter' | 'write' | 'gear', Href> = { play: '/case', courts: '/courts', standings: '/standings', fighter: '/fighter', write: '/ink', gear: '/gear' };

/** Home: a diorama drawn by three.js in a WebView (web/home.js). Your fighter hops between tiles; each tile is a place in the app. */
export default function Home() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const roster = useRoster();
  const closet = useCloset();
  const matches = useMatches();
  const web = useRef<WebView>(null);
  const ready = useRef(false);

  const you = roster.find((f) => f.isYou) ?? roster[0];
  const { rows } = computeSeason(roster, matches);
  const row = rows.find((r) => r.id === you.id);
  const played = (row?.wins ?? 0) + (row?.losses ?? 0);
  const last = [...matches].sort((a, b) => b.playedAt - a.playedAt)[0];
  const name = (id: string) => roster.find((f) => f.id === id)?.name ?? '?';
  const lastWinner = last ? winnerOf(last) : null;
  const data = JSON.stringify({
    name: you.name,
    color: you.color,
    cast: you.cast,
    record: played ? `you: ${row?.wins}–${row?.losses}, ${row?.points} points` : '',
    place: played ? rows.findIndex((r) => r.id === you.id) + 1 : 0,
    gear: (() => { const due = dueList(closet, matches); return due.length ? `${due.length} due: ${due[0]}${due.length > 1 ? ', ...' : ''}` : ''; })(),
    last: last && lastWinner ? `${name(lastWinner)} beat ${name(lastWinner === last.p1 ? last.p2 : last.p1)} ${scoreLine(last.sets)}` : null,
  });

  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`);
  useEffect(() => { if (ready.current) run(`window.setHome(${data})`); }, [data]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        ref={web}
        source={{ html: HOME_HTML }}
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
            run(`window.setHome(${data})`);
            if (params.demo === '1') run('window.demoHome()');
            if (params.demo === '2') run('window.demoHomeSlide()');
          } else if (msg.type === 'press') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            sfx('tick', 0.7);
          } else if (msg.type === 'line') {
            void Haptics.selectionAsync();
          } else if (msg.type === 'slid') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            sfx('swish', 0.8);
          } else if (msg.type === 'hop') {
            void Haptics.selectionAsync();
            sfx('tick', 0.6);
          } else if (msg.type === 'land') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            sfx('slam', 0.35);
          } else if (msg.type === 'go') {
            sfx('go', 0.8);
            router.push(ROUTES[msg.to]);
          } else console.warn('home scene:', msg.message, msg.at ?? '');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
  web: { flex: 1, backgroundColor: '#efece5' },
});
