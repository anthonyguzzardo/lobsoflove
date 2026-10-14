import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FighterAvatar } from '@/components/fighter';
import { Underlined } from '@/components/brush-stroke';
import { C } from '@/constants/arcade';
import { computeSeason, scoreLine, useMatches, winnerOf } from '@/lib/matches';
import { BackSwing } from '@/components/back-swing';
import { useRoster } from '@/lib/roster';

export default function Standings() {
  const roster = useRoster();
  const matches = useMatches();
  const insets = useSafeAreaInsets();
  const { rows } = computeSeason(roster, matches);
  const byId = (id: string) => roster.find((f) => f.id === id);
  const recent = [...matches].sort((a, b) => b.playedAt - a.playedAt);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }}>
      <BackSwing />
      <Text style={styles.kicker}>SEASON 1</Text>
      <Underlined><Text style={styles.title}>STANDINGS</Text></Underlined>
      {rows.map((r, i) => {
        const f = byId(r.id);
        if (!f) return null;
        return (
          <View key={r.id} style={[styles.row, i === 0 && r.points > 0 && { borderColor: C.ball }]}>
            <Text style={[styles.rank, i === 0 && r.points > 0 && { color: C.ball }]}>{i + 1}</Text>
            <FighterAvatar cast={f.cast} color={f.color} size={44} />
            <View style={styles.grow}>
              <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
              <Text style={styles.rec}>{r.wins}–{r.losses}{r.streak > 1 ? `  ·  W${r.streak}` : r.streak < -1 ? `  ·  L${-r.streak}` : ''}</Text>
            </View>
            <Text style={styles.pts}>{r.points}</Text>
          </View>
        );
      })}
      <Text style={[styles.kicker, { marginTop: 24 }]}>MATCHES</Text>
      {recent.length === 0 ? <Text style={styles.empty}>Love–love. Nobody has played yet.</Text> : null}
      {recent.map((m) => {
        const w = winnerOf(m);
        return (
          <Pressable key={m.id} onPress={() => router.push({ pathname: '/card/[id]', params: { id: m.id } })} style={styles.match} accessibilityRole="button">
            <Text style={styles.matchNames} numberOfLines={1}>
              <Text style={w === m.p1 && { color: C.ball }}>{byId(m.p1)?.name}</Text>  vs  <Text style={w === m.p2 && { color: C.ball }}>{byId(m.p2)?.name}</Text>
            </Text>
            <Text style={styles.rec}>{scoreLine(m.sets)}  ·  {m.court}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const heavy = { fontWeight: '900', fontStyle: 'italic' } as const;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  link: { color: C.ball, fontSize: 12, fontWeight: '900', letterSpacing: 1.5, paddingVertical: 6 },
  kicker: { color: C.ball, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 8 },
  title: { ...heavy, color: C.text, fontSize: 30, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, marginBottom: 8 },
  rank: { ...heavy, color: C.dim, fontSize: 22, width: 26, textAlign: 'center' },
  grow: { flex: 1 },
  name: { ...heavy, color: C.text, fontSize: 16 },
  rec: { color: C.dim, fontSize: 12, fontWeight: '700' },
  pts: { ...heavy, color: C.text, fontSize: 24 },
  empty: { color: C.dim, fontSize: 14, marginTop: 8 },
  match: { backgroundColor: C.panel, borderRadius: 12, padding: 12, marginTop: 8 },
  matchNames: { ...heavy, color: C.text, fontSize: 15 },
});
