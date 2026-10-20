import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackSwing } from '@/components/back-swing';
import { FighterAvatar } from '@/components/fighter';
import { Breathe, InkButton, InkLink, Rise } from '@/components/ink-button';
import { body, label, MONO, P, paperCard } from '@/constants/paper';
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
  const [err, setErr] = useState<string | null>(null);
  const queue = toAnswer(matches).sort((a, b) => a.playedAt - b.playedAt);
  const m = queue[0];
  const by = (id: string) => roster.find((f) => f.id === id);

  if (!m) {
    return (
      <View style={[styles.root, styles.center]}>
        <Rise><Text style={styles.big}>ALL SQUARE</Text></Rise>
        <Rise index={1}><Text style={styles.dim}>Nothing waiting on you.</Text></Rise>
        <Rise index={2}><InkLink label="‹ HOME" onPress={goHome} /></Rise>
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
    setErr(null);
    try {
      await answerMatch(m.id, yes);
      if (yes) sfx(youWon ? 'win' : 'ping');
      else sfx('clack', 0.5);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 16 }]}>
      <Breathe style={{ alignSelf: 'flex-start' }}><Text style={styles.tag}>{queue.length > 1 ? `${queue.length} WAITING ON YOU` : 'WAITING ON YOU'}</Text></Breathe>
      <Rise key={m.id} style={styles.card}>
        <Text style={styles.meta}>{m.court.toUpperCase()} · {new Date(m.playedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</Text>
        <View style={styles.row}>
          {them ? <FighterAvatar cast={them.cast} color={them.color} size={64} /> : null}
          <Text style={styles.says} numberOfLines={2}>{(them?.name ?? 'SOMEONE').toUpperCase()} SAYS {youWon ? 'YOU BEAT THEM' : 'THEY BEAT YOU'}</Text>
          {you ? <FighterAvatar cast={you.cast} color={you.color} size={44} /> : null}
        </View>
        <Text style={styles.score}>{line}</Text>
        <Text style={styles.dim}>Your games first.</Text>
      </Rise>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <View style={{ flex: 1 }} />
      <Rise index={1}><InkButton label={'THAT\u2019S RIGHT'} onPress={() => answer(true)} /></Rise>
      <Rise index={2} style={{ marginBottom: 4 }}><InkButton label={'THAT\u2019S NOT WHAT HAPPENED'} ghost onPress={() => answer(false)} /></Rise>
      <BackSwing floating />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper, paddingHorizontal: 16, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center' },
  tag: label,
  card: { ...paperCard, gap: 12 },
  meta: { ...label, color: P.dim },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  says: { flex: 1, fontFamily: MONO, fontWeight: '800', fontSize: 17, color: P.ink },
  score: { fontFamily: MONO, fontWeight: '800', fontSize: 40, color: P.ink, letterSpacing: 1 },
  big: { fontFamily: MONO, fontWeight: '800', fontSize: 30, color: P.ink },
  dim: { ...body, color: P.dim },
  err: { ...body, color: P.red },
});
