import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackSwing } from '@/components/back-swing';
import { FighterAvatar } from '@/components/fighter';
import { C } from '@/constants/arcade';
import { answerMatch, toAnswer } from '@/lib/cloud';
import { useMatches, winnerOf } from '@/lib/matches';
import { goHome } from '@/lib/nav';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

/** Scores your friends reported against you, one at a time. A match counts only once you confirm it. */
export default function Confirm() {
  const roster = useRoster();
  const matches = useMatches();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const queue = toAnswer(matches).sort((a, b) => a.playedAt - b.playedAt);
  const m = queue[0];
  const by = (id: string) => roster.find((f) => f.id === id);

  if (!m) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.big}>ALL SQUARE</Text>
        <Text style={styles.dim}>Nothing waiting on you.</Text>
        <Pressable onPress={goHome} accessibilityRole="button"><Text style={styles.link}>‹ HOME</Text></Pressable>
        <BackSwing floating />
      </View>
    );
  }

  const them = by(m.p1);
  const you = by(m.p2);
  const youWon = winnerOf(m) === m.p2;
  // Shown from your side of the net: your games first.
  const line = m.sets.map(([a, b]) => `${b}–${a}`).join('   ');
  const answer = async (yes: boolean) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await answerMatch(m.id, yes);
      if (yes) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx(youWon ? 'win' : 'ping'); }
      else { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid); sfx('clack', 0.5); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.tag}>{queue.length > 1 ? `${queue.length} WAITING ON YOU` : 'WAITING ON YOU'}</Text>
      <View style={styles.card}>
        <Text style={styles.meta}>{m.court.toUpperCase()} · {new Date(m.playedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</Text>
        <View style={styles.row}>
          {them ? <FighterAvatar cast={them.cast} color={them.color} size={64} /> : null}
          <Text style={styles.says} numberOfLines={2}>{(them?.name ?? 'SOMEONE').toUpperCase()} SAYS {youWon ? 'YOU BEAT THEM' : 'THEY BEAT YOU'}</Text>
          {you ? <FighterAvatar cast={you.cast} color={you.color} size={44} /> : null}
        </View>
        <Text style={styles.score}>{line}</Text>
        <Text style={styles.dim}>Your games first.</Text>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <View style={{ flex: 1 }} />
      {busy ? <ActivityIndicator color={C.ball} /> : null}
      <Pressable onPress={() => answer(true)} accessibilityRole="button" style={({ pressed }) => [styles.yes, pressed && { transform: [{ scale: 0.97 }] }]}>
        <Text style={styles.yesText}>{'THAT\u2019S RIGHT'}</Text>
      </Pressable>
      <Pressable onPress={() => answer(false)} accessibilityRole="button" style={styles.no}>
        <Text style={styles.noText}>{'THAT\u2019S NOT WHAT HAPPENED'}</Text>
      </Pressable>
      <BackSwing floating />
    </View>
  );
}

const heavy = { fontWeight: '900', fontStyle: 'italic' } as const;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  tag: { color: C.p2, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  card: { backgroundColor: C.panel, borderRadius: 20, padding: 18, gap: 12 },
  meta: { color: C.dim, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  says: { ...heavy, flex: 1, color: C.text, fontSize: 20 },
  score: { ...heavy, color: C.text, fontSize: 44, letterSpacing: 1 },
  big: { ...heavy, color: C.ball, fontSize: 36 },
  dim: { color: C.dim, fontSize: 13 },
  err: { color: C.p2, fontSize: 13, fontWeight: '800' },
  link: { color: C.ball, fontSize: 12, fontWeight: '900', letterSpacing: 1.5, padding: 12 },
  yes: { backgroundColor: C.ball, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  yesText: { ...heavy, color: C.bg, fontSize: 18 },
  no: { alignItems: 'center', paddingVertical: 14 },
  noText: { color: C.p2, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
});
