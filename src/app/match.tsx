import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { type Cue, SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { SCORE_HTML } from '@/generated/score-html';
import { courtById, usePickedCourt } from '@/lib/courts';
import { addMatch, useMatches } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import { matchState, type SetScore } from '@/lib/tennis';
import { themeFor } from '@/lib/themes';

/** The board in progress, so a phone on the bench can leave the screen between changeovers and come back to the same score. */
const DRAFT_KEY = 'lol.board.v1';
type Draft = { vs: string; sets: SetScore[]; mtb: boolean; at: number };
/** A draft older than this is a match nobody finished; start clean. */
const DRAFT_HOURS = 12;

const CUES: Record<string, Cue> = {
  lift: () => { void Haptics.selectionAsync(); sfx('tick', 0.45); },
  clack: (m) => { void Haptics.impactAsync(m.v > 0.5 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); sfx('clack', 0.3 + 0.6 * (m.v ?? 0.5)); },
  stuck: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid); sfx('clack', 0.35); },
  set: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('ping'); },
  match: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('win'); },
  bad: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
  court: () => { void Haptics.selectionAsync(); sfx('tick', 0.6); },
  tb: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('swish', 0.5); },
  poke: () => { void Haptics.selectionAsync(); sfx('squeak', 0.6); },
};

/** The match: a flip scoreboard on the court fence (web/score.js). Flip plates as you play, seal it, then the photo. */
export default function MatchScreen() {
  const { vs } = useLocalSearchParams<{ vs: string }>();
  const roster = useRoster();
  const past = useMatches();
  const scene = useScene();
  const { run } = scene;
  const you = roster.find((f) => f.isYou) ?? roster[0];
  const opp = roster.find((f) => f.id === vs) ?? roster.find((f) => !f.isYou) ?? you;
  const pickedCourt = usePickedCourt();
  const court = courtById(pickedCourt ?? (past.length ? past[past.length - 1].courtId : undefined));
  const board = useRef<{ sets: SetScore[]; mtb: boolean }>({ sets: [[0, 0]], mtb: false });
  const sealing = useRef(false);

  // Hang the board once: the saved draft for this opponent if there is a fresh one, else a clean 0-0.
  useEffect(() => {
    let live = true;
    void (async () => {
      let draft: Draft | null = null;
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        const d = raw ? (JSON.parse(raw) as Draft) : null;
        if (d && d.vs === opp.id && Date.now() - d.at < DRAFT_HOURS * 3600 * 1000) draft = d;
      } catch {
        // Unreadable draft: start clean.
      }
      if (!live) return;
      board.current = { sets: draft?.sets ?? [[0, 0]], mtb: draft?.mtb ?? false };
      const fighter = (f: typeof you) => ({ name: f.name, color: f.color, cast: f.cast });
      run(`window.setBoard(${JSON.stringify({ you: fighter(you), opp: fighter(opp), ...board.current, court: null })})`);
    })();
    return () => { live = false; };
    // The board is hung once per opponent; the court sign updates on its own below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, opp.id]);

  useEffect(() => {
    run(`window.setCourt(${JSON.stringify(court ? { name: court.name, area: court.area } : null)})`);
    if (court) run(`window.setGround(${JSON.stringify(themeFor(court).ground)})`);
  }, [run, court]);

  const shoot = async (): Promise<string | null> => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    const res = cam.granted ? await ImagePicker.launchCameraAsync({ quality: 0.7 }).catch(() => null) : null;
    // The simulator has no camera, and a denied permission lands here too: fall back to the library.
    const picked = res ?? (await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 }));
    return !picked.canceled && picked.assets[0] ? picked.assets[0].uri : null;
  };

  const seal = async () => {
    const { sets, mtb } = board.current;
    if (sealing.current || matchState(sets, mtb).winner === null) return;
    if (!court) {
      Alert.alert('Pick a court', 'Every match is played somewhere. Tap the sign on the fence.');
      return;
    }
    sealing.current = true;
    try {
      // Every match ends with a photo at the court. Backing out of the camera leaves the board as it was; the strip re-arms itself.
      const photo = await shoot();
      if (!photo) return;
      const id = addMatch({ p1: you.id, p2: opp.id, court: court.name, courtId: court.id, photoUri: photo, sets });
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      router.replace({ pathname: '/card/[id]', params: { id } });
    } finally {
      sealing.current = false;
    }
  };

  const onMessage = (m: SceneMsg) => {
    if (m.type === 'score') {
      board.current = { sets: m.sets as SetScore[], mtb: !!m.mtb };
      const draft: Draft = { vs: opp.id, ...board.current, at: Date.now() };
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
    } else if (m.type === 'court') router.push({ pathname: '/courts', params: { from: 'match' } });
    else if (m.type === 'slid') void seal();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView scene={scene} html={SCORE_HTML} name="score" cues={CUES} onMessage={onMessage} />
      <BackSwing floating />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
});
