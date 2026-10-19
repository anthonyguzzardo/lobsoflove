import { type Href, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SceneView, useScene } from '@/components/scene-view';
import { HOME_HTML } from '@/generated/home-html';
import { toAnswer, useCloud } from '@/lib/cloud';
import { dueList, useCloset } from '@/lib/gear';
import { computeSeason, scoreLine, useMatches, winnerOf } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import { featured, findPro, proLine, proMatch, tourLine, useTour } from '@/lib/tour';

const ROUTES: Record<'play' | 'courts' | 'standings' | 'fighter' | 'write' | 'gear' | 'intro', Href> = { play: '/courts', courts: '/courts', standings: '/standings', fighter: '/fighter', write: '/ink', gear: '/gear', intro: '/splash' };

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
  const waiting = toAnswer(matches).length;

  const you = roster.find((f) => f.isYou) ?? roster[0];
  const { rows } = computeSeason(roster, matches);
  const row = rows.find((r) => r.id === you.id);
  const played = (row?.wins ?? 0) + (row?.losses ?? 0);
  const last = [...matches].sort((a, b) => b.playedAt - a.playedAt)[0];
  const name = (id: string) => roster.find((f) => f.id === id)?.name ?? '?';
  const lastWinner = last ? winnerOf(last) : null;
  const season = seasonLine(rows, you.id, name, matches.length);
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
    place: played ? rows.findIndex((r) => r.id === you.id) + 1 : 0,
    gear: (() => { const due = dueList(closet, matches); return due.length ? `${due.length} due: ${due[0]}${due.length > 1 ? ', ...' : ''}` : ''; })(),
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
      {cloud.status !== 'off' ? (
        <View style={[styles.pills, { top: insets.top + 10 }]} pointerEvents="box-none">
          {waiting ? (
            <Pressable onPress={() => { sfx('go', 0.8); router.push('/confirm'); }} accessibilityRole="button" style={[styles.pill, styles.hot]}>
              <Text style={[styles.pillText, { color: '#f4f1e6' }]}>{waiting} TO CONFIRM</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => { sfx('go', 0.8); router.push('/crew'); }} accessibilityRole="button" style={styles.pill}>
            <Text style={styles.pillText}>{cloud.crew ? cloud.crew.name : 'CREW'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;
const pts = (n: number) => `${n} point${n === 1 ? '' : 's'}`;

/** One true sentence about the season: where you stand and who you are chasing. */
function seasonLine(rows: ReturnType<typeof computeSeason>['rows'], youId: string, name: (id: string) => string, played: number): string {
  const me = rows.findIndex((r) => r.id === youId);
  const row = rows[me];
  if (!played) return 'season 01. nobody has played yet. go first.';
  if (!row || row.wins + row.losses === 0) return `season 01. ${played} match${played === 1 ? '' : 'es'} in. you have not played.`;
  const rec = `${row.wins} and ${row.losses}`;
  if (me === 0) {
    const second = rows[1];
    const gap = second ? row.points - second.points : 0;
    return `1st of ${rows.length}. ${rec}. ${second ? (gap ? `${name(second.id)} is ${pts(gap)} behind.` : `tied with ${name(second.id)}.`) : ''}`.trim();
  }
  const leader = rows[0];
  const gap = leader.points - row.points;
  return `${ordinal(me + 1)} of ${rows.length}. ${rec}. ${gap ? `${pts(gap)} behind ${name(leader.id)}.` : `tied with ${name(leader.id)}.`}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
  pills: { position: 'absolute', right: 14, flexDirection: 'row', gap: 8 },
  pill: { backgroundColor: '#f6f5f2', borderColor: '#1a1a1a', borderWidth: 2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  hot: { backgroundColor: '#ff3d7f', borderColor: '#1a1a1a' },
  pillText: { color: '#1a1a1a', fontSize: 11, fontWeight: '900', letterSpacing: 1.4, maxWidth: 140 },
});
