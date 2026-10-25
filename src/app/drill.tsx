import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Cue, SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { DRILL_HTML } from '@/generated/drill-html';
import { goBack } from '@/lib/nav';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

/** Best score per drill id, on this phone only. */
const BESTS_KEY = 'lol.drill.v1';

const CUES: Record<string, Cue> = {
  feed: () => { sfx('pock', 0.35); },
  hit: (m) => {
    void Haptics.impactAsync(m.q >= 1 ? Haptics.ImpactFeedbackStyle.Heavy : m.q > 0.5 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    sfx('pock', 0.5 + 0.5 * (m.q ?? 0.5));
  },
  bounce: (m) => { sfx('bounce', 0.15 + 0.35 * (m.v ?? 0.5)); },
  net: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid); sfx('slam', 0.4); },
  target: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('ping'); },
  miss: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
  pick: () => { void Haptics.selectionAsync(); sfx('tick', 0.6); },
  drill: (m) => { if (m.best) sfx('win'); else sfx('select'); },
  back: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('swish', 0.7); },
};

/**
 * The drill: a ball machine on a real court (web/drill.js). You run to the ball by yourself; four shot buttons hit (tap on time, drag to aim). PICK THE SHOT freezes each spot so you choose the percentage play. On a wide
 * screen (an unfolded foldable, an iPad) it splits at the middle: your court on the left, the read on the right.
 */
export default function DrillScreen() {
  const roster = useRoster();
  const scene = useScene();
  const { run } = scene;
  const bests = useRef<Record<string, number>>({});
  const you = roster.find((f) => f.isYou) ?? roster[0];

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(BESTS_KEY);
        if (raw) bests.current = JSON.parse(raw) as Record<string, number>;
      } catch {
        // Unreadable: start with no bests.
      }
      if (live) run(`window.setBests(${JSON.stringify(bests.current)})`);
    })();
    return () => { live = false; };
  }, [run]);

  useEffect(() => {
    if (you) run(`window.setPlayer(${JSON.stringify({ color: you.color })})`);
  }, [run, you]);

  const onMessage = (m: SceneMsg) => {
    // The back pill lives in the page, in the top card (the same small pill as /gear).
    if (m.type === 'back') { goBack(); return; }
    if (m.type !== 'drill' || !m.best) return;
    bests.current = { ...bests.current, [m.id as string]: m.points as number };
    AsyncStorage.setItem(BESTS_KEY, JSON.stringify(bests.current)).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView scene={scene} html={DRILL_HTML} name="drill" cues={CUES} onMessage={onMessage} />
      <Link href="/painted-court" style={styles.paintedLink}>Visit the painted courtyard</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
  paintedLink: { color: '#713e2d', backgroundColor: '#f5e7cc', textAlign: 'center', fontSize: 14, paddingTop: 14, paddingBottom: 28 },
});
