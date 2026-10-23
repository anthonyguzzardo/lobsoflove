import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackSwing } from '@/components/back-swing';
import { KiOrb } from '@/components/ki-orb';
import { SceneView, useScene } from '@/components/scene-view';
import venues from '@/data/venues.json';
import { COURTS_HTML } from '@/generated/courts-html';
import { ANTHEMS, playAnthem, stopAnthem, toggleMute } from '@/lib/anthems';
import { courtStats, pickCourt } from '@/lib/courts';
import { useHunt } from '@/lib/dragon-balls';
import {
  addSession, endSession, getSession, openSession, setSessionKind, setSessionRacket, skipSession, unanswered, useCloset, useSessions, wearOf,
} from '@/lib/gear';
import { takeLanded } from '@/lib/fly';
import { useMatches } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { BEACON_HOURS, demoFriends, islandState, type Person, setBeacon, useBeacon, useCrewPeople } from '@/lib/presence';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import type { ThemeId } from '@/lib/themes';

/**
 * Courts: six favorite venues as to-scale islands, drawn by three.js in a WebView (web/courts.js). Hopping between them browses
 * (and starts each one's song); sliding on one lands you there, which is your beacon: no form, you are just there. Friends stand
 * on the islands they are at, faint ones for later. Sliding again where you landed goes to the scoreboard.
 *
 * Landing starts a session (src/lib/gear.ts): the legend from the gear page holds out the racket you used last, and you confirm
 * it or tap another racket's name. Stepping off (or the beacon running out after BEACON_HOURS) asks MATCH or JUST HIT.
 */
const HOUR = 3600 * 1000;
const venueOf = (id: string) => venues.find((v) => v.id === id);
/** Who was on that court with you at `at` (names; the crew's real ones, or the stand-ins). */
const namesAt = (people: Person[], venueId: string, at: number) => {
  const key = venueOf(venueId)?.key;
  return people.filter((p) => p.venue === key && p.at <= at).map((p) => p.name);
};
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
  // Landed here from the sky: hop straight onto that court (after the islands are built above).
  useFocusEffect(useCallback(() => {
    const id = takeLanded();
    const i = id ? venues.findIndex((v) => v.id === id) : -1;
    // Coming down from the sky onto a court is landing there.
    if (i >= 0) run(`window.flyIn(${i})`);
  }, [run]));
  const insets = useSafeAreaInsets();
  const hunt = useHunt();
  // Back goes straight back from here. Only while the legend is up does it go to the page first (to put him away).
  const handOpen = useRef(false);
  const gone = useRef(false);
  useFocusEffect(useCallback(() => { gone.current = false; }, []));
  const back = () => {
    if (handOpen.current) { run('window.back()'); return; }
    gone.current = true;
    goBack();
  };

  // Sessions: the racket handed over on landing, and MATCH or JUST HIT once you leave.
  const closet = useCloset();
  const sessions = useSessions();
  const meet = params.from !== 'match';
  const rackets = useMemo(() => closet.filter((it) => it.kind === 'racket').map((it) => ({
    id: it.id, nick: it.nick ?? null, name: it.name, brand: it.brand ?? null, model: it.model ?? null,
    string: it.setup?.string ?? null, worn: wearOf(it, 'strings', sessions).worn,
  })), [closet, sessions]);
  // The beacon ran out while you were away (or with the page open): that session is over at the 3 hour mark.
  useEffect(() => {
    const open = openSession(sessions);
    if (!open || now - open.at < BEACON_HOURS * HOUR) return;
    const end = open.at + BEACON_HOURS * HOUR;
    endSession(open.id, end, namesAt(friends, open.venue, end));
    if (beacon?.venue === open.venue) setBeacon(null);
  }, [now, sessions, beacon, friends]);
  // Over and not answered yet (and not in another one): he comes up and asks.
  const ask = openSession(sessions) ? null : unanswered(sessions, now);
  const askJson = meet && ask ? JSON.stringify({
    session: ask.id, venue: venueOf(ask.venue)?.short ?? '', pick: ask.racket,
    rackets: rackets.filter((r) => r.id === ask.racket),
  }) : null;
  useEffect(() => { run(`window.askKind(${askJson ?? 'null'})`); }, [run, askJson]);

  const landed = (venueId: string) => {
    const id = addSession(venueId);
    if (!meet || !rackets.length) return;
    const pick = getSession(id)?.racket ?? rackets[0].id;
    run(`window.offerRacket(${JSON.stringify({ session: id, venue: venueOf(venueId)?.short ?? '', pick, rackets })})`);
  };
  const leave = () => {
    const open = openSession(sessions);
    if (open) endSession(open.id, Date.now(), namesAt(friends, open.venue, Date.now()));
  };
  const answer = (sessionId: string, kind: 'match' | 'hit' | null) => {
    if (!kind) { skipSession(sessionId); return; }
    setSessionKind(sessionId, kind);
    if (kind === 'hit') { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('pock', 0.6); return; }
    // A match: the scoreboard, against whoever was on the court with you.
    const s = sessions.find((x) => x.id === sessionId);
    const opp = roster.find((f) => !f.isYou && s?.with?.includes(f.name));
    sfx('go', 0.7);
    setTimeout(() => router.push({ pathname: '/match', params: { session: sessionId, ...(opp ? { vs: opp.id } : {}) } }), 350);
  };

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
          else if (msg.type === 'back') back(); // the page says there was no court to step out of
          else if (msg.type === 'handoff') handOpen.current = !!msg.open;
          else if (msg.type === 'link') { const a = ANTHEMS[msg.anthem as ThemeId]; if (a) void Linking.openURL(a.link); }
          else if (msg.type === 'beacon') { setBeacon(msg.id); landed(msg.id); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('go', 0.8); }
          else if (msg.type === 'leave') { setBeacon(null); leave(); sfx('swish', 0.5); }
          // The legend: reaching behind his back, putting one away, the racket you picked, and the answer to MATCH or JUST HIT.
          else if (msg.type === 'reach') { sfx('swish', 0.5); setTimeout(() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }, 300); }
          else if (msg.type === 'fling') sfx('swish', 0.4);
          else if (msg.type === 'racket') {
            setSessionRacket(msg.session, msg.id);
            if (msg.swap) void Haptics.selectionAsync();
            else { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('slam', 0.5); }
          }
          else if (msg.type === 'kind') answer(msg.session, msg.kind ?? null);
          else if (msg.type === 'pick') {
            if (gone.current) return; // backed out while diving in: the dive's timer does not get to navigate too
            pickCourt(msg.id);
            // Opened from a match in progress: hand the court back. Otherwise the people you landed with are who you play: score it.
            if (params.from === 'match') goBack(); else router.push('/match');
          }
        }}
      />
      <BackSwing floating onBack={back} />
      <View style={[styles.fly, { top: insets.top + 2 }]} pointerEvents="box-none">
        <KiOrb stars={hunt.got.length || 4} onPress={() => router.push({ pathname: '/fly', params: { from: 'courts' } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
  fly: { position: 'absolute', right: 12 },
});
