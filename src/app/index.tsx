import { type Href, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Breathe, InkPill } from '@/components/ink-button';
import { SceneView, useScene } from '@/components/scene-view';
import { SOUND_BUTTON_SIZE, SoundButton } from '@/components/sound-button';
import { HOME_HTML } from '@/generated/home-html';
import { toAnswer, toCallupAnswer, useCloud } from '@/lib/cloud';
import { dueList, useCloset } from '@/lib/gear';
import { computeSeason, counts, personalLine, scoreLine, useMatches, winnerOf } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import { setSound, useSound } from '@/lib/sound';
import { featured, findPro, proLine, proMatch, tourLine, useTour } from '@/lib/tour';

const ROUTES: Record<'play' | 'courts' | 'standings' | 'fighter' | 'write' | 'gear' | 'crew' | 'intro', Href> = { play: '/courts', courts: '/courts', standings: '/standings', fighter: '/fighter', write: '/ink', gear: '/gear', crew: '/crew', intro: '/splash' };

/** Home: a diorama drawn by three.js in a WebView (web/home.js). Your fighter hops between tiles; each tile is a place in the app. */
export default function Home() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const roster = useRoster();
  const closet = useCloset();
  const matches = useMatches();
  const tour = useTour();
  const scene = useScene();
  const { run } = scene;
  const cloud = useCloud();
  const insets = useSafeAreaInsets();
  const sound = useSound();
  const waiting = toAnswer(matches).length;
  const called = toCallupAnswer(cloud.callups)[0];

  const you = roster.find((f) => f.isYou) ?? roster[0];
  const { rows } = computeSeason(roster, matches);
  const row = rows.find((r) => r.id === you.id);
  const played = (row?.wins ?? 0) + (row?.losses ?? 0);
  const last = [...matches].sort((a, b) => b.playedAt - a.playedAt)[0];
  const name = (id: string) => roster.find((f) => f.id === id)?.name ?? '?';
  const lastWinner = last ? winnerOf(last) : null;
  const season = personalLine(matches.filter(counts), you.id);
  const pro = findPro(tour, you.favoritePro);
  const proM = pro ? proMatch(tour, pro.name) : null;
  const line = tourLine(featured(tour, proM));
  const data = JSON.stringify({
    season,
    tour: line,
    pro: proLine(tour, you.favoritePro),
    name: you.name,
    color: you.color,
    cast: you.cast,
    record: played ? `you: ${row?.wins}–${row?.losses}, ${row?.points} points` : '',
    // Your place shows only in the top half. Lower down, home talks about you against your own past instead.
    place: played && rows.findIndex((r) => r.id === you.id) < Math.ceil(rows.length / 2) ? rows.findIndex((r) => r.id === you.id) + 1 : 0,
    gear: (() => { const due = dueList(closet, matches); return due.length ? `${due.length} due: ${due[0]}${due.length > 1 ? ', ...' : ''}` : ''; })(),
    // The crew platform's team photo wears your crew's colors (you first), and its key says who is in it.
    crew: cloud.crew ? { name: cloud.crew.name, n: roster.length, colors: [you.color, ...roster.filter((f) => !f.isYou).map((f) => f.color)] } : null,
    last: last && lastWinner ? `${name(lastWinner)} beat ${name(lastWinner === last.p1 ? last.p2 : last.p1)} ${scoreLine(last.sets)}` : null,
  });

  useEffect(() => { run(`window.setHome(${data})`); }, [run, data]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={HOME_HTML}
        name="home"
        onReady={() => {
          if (params.demo === '1') run('window.demoHome()');
          if (params.demo === '2') run('window.demoHomeSlide()');
        }}
        onMessage={(msg) => {
          if (msg.type === 'go') { sfx('go', 0.8); router.push(ROUTES[msg.to as keyof typeof ROUTES]); }
        }}
      />
      <View style={[styles.sound, { top: insets.top + 10 }]} pointerEvents="box-none">
        <SoundButton on={sound} onToggle={() => setSound(!sound)} />
      </View>
      {cloud.status !== 'off' ? (
        <View style={[styles.pills, { top: insets.top + 10 + SOUND_BUTTON_SIZE + 10 }]} pointerEvents="box-none">
          {cloud.status === 'solo' && cloud.invites[0] ? (
            <Breathe><InkPill hot label={`${cloud.invites[0].from} INVITED YOU`} onPress={() => { sfx('go', 0.8); router.push('/crew'); }} /></Breathe>
          ) : null}
          {called ? (
            <Breathe><InkPill hot label={`${roster.find((f) => f.id === called.caller)?.name ?? 'A FRIEND'} CALLED YOU UP`} onPress={() => { sfx('go', 0.8); router.push('/crew'); }} /></Breathe>
          ) : null}
          {waiting ? (
            <Breathe><InkPill hot label={`${waiting} TO CONFIRM`} onPress={() => { sfx('go', 0.8); router.push('/confirm'); }} /></Breathe>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
  pills: { position: 'absolute', right: 14, flexDirection: 'row', gap: 8 },
  sound: { position: 'absolute', right: 14 },
});
