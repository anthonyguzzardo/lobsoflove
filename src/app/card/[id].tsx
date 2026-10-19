import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { BackSwing } from '@/components/back-swing';
import { FighterAvatar } from '@/components/fighter';
import { Underlined } from '@/components/brush-stroke';
import { C } from '@/constants/arcade';
import { computeSeason, useMatches } from '@/lib/matches';
import { goHome } from '@/lib/nav';
import { useRoster } from '@/lib/roster';

export default function MatchCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roster = useRoster();
  const matches = useMatches();
  const insets = useSafeAreaInsets();
  const shot = useRef<ViewShotRef>(null);
  const match = matches.find((m) => m.id === id);
  // A match you just reported is still waiting on your opponent: show what it will be worth once they confirm.
  const award = computeSeason(roster, matches, { include: id }).awards[id];
  const byId = (x: string) => roster.find((f) => f.id === x);
  const w = award ? byId(award.winner) : undefined;
  const l = award ? byId(award.loser) : undefined;

  if (!match || !award || !w || !l) {
    return <View style={[styles.root, styles.center]}><Text style={styles.dim}>Match not found.</Text><BackSwing /></View>;
  }
  const winnerIsP1 = award.winner === match.p1;
  const line = match.sets.map(([a, b]) => (winnerIsP1 ? `${a}–${b}` : `${b}–${a}`)).join('   ');

  const share = async () => {
    const uri = await shot.current?.capture?.();
    if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <ViewShot ref={shot} options={{ format: 'png', quality: 1 }} style={styles.card}>
        {match.photoUri ? <Image source={{ uri: match.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <View style={styles.scrim} />
        <View style={styles.top}>
          <Text style={styles.brand}>LOBSOFLOVE</Text>
          <Text style={styles.meta}>{match.court.toUpperCase()} · {new Date(match.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}</Text>
          {match.status && match.status !== 'confirmed' ? (
            <Text style={styles.wait}>{match.status === 'disputed' ? 'DISPUTED. THIS ONE DOES NOT COUNT.' : `WAITING ON ${(byId(match.reportedBy === match.p1 ? match.p2 : match.p1)?.name ?? 'THEM').toUpperCase()} TO CONFIRM`}</Text>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <View style={styles.row}>
            <FighterAvatar cast={w.cast} color={w.color} size={74} />
            <View style={styles.col}>
              <Text style={[styles.tag, { color: C.ball }]}>WINNER · #{award.rankAfter[w.id]}</Text>
              <Text style={styles.wName} numberOfLines={1} adjustsFontSizeToFit>{w.name}</Text>
            </View>
            <Text style={[styles.pts, { color: C.ball }]}>+{award.winnerPoints}</Text>
          </View>
          <Underlined redrawKey={line}><Text style={styles.score}>{line}</Text></Underlined>
          {award.bonuses.length ? <Text style={styles.bonus}>{award.bonuses.join('  ·  ')}</Text> : null}
          <View style={[styles.row, { marginTop: 8 }]}>
            <FighterAvatar cast={l.cast} color={l.color} size={46} />
            <View style={styles.col}>
              <Text style={styles.tag}>#{award.rankAfter[l.id]}</Text>
              <Text style={styles.lName} numberOfLines={1}>{l.name}</Text>
            </View>
            <Text style={[styles.pts, { color: C.dim, fontSize: 18 }]}>+{award.loserPoints}</Text>
          </View>
        </View>
      </ViewShot>
      <Pressable onPress={share} style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button"><Text style={styles.ctaText}>SEND TO THE GROUP CHAT</Text></Pressable>
      <View style={styles.links}>
        <Pressable onPress={goHome} style={styles.second} accessibilityRole="button"><Text style={styles.link}>‹ HOME</Text></Pressable>
        <Pressable onPress={() => router.dismissTo('/standings')} style={styles.second} accessibilityRole="button"><Text style={styles.link}>STANDINGS ›</Text></Pressable>
      </View>
    </View>
  );
}

const heavy = { fontWeight: '900', fontStyle: 'italic' } as const;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  dim: { color: C.dim },
  card: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: C.panel, justifyContent: 'space-between' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,15,26,0.45)' },
  top: { padding: 16 },
  brand: { ...heavy, color: C.ball, fontSize: 20, letterSpacing: 0.5 },
  meta: { color: C.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  wait: { color: C.p2, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  bottom: { backgroundColor: 'rgba(11,15,26,0.9)', padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  col: { flex: 1 },
  tag: { color: C.dim, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  wName: { ...heavy, color: C.text, fontSize: 28 },
  lName: { ...heavy, color: C.dim, fontSize: 17 },
  pts: { ...heavy, fontSize: 30 },
  score: { ...heavy, color: C.text, fontSize: 44, marginTop: 6, letterSpacing: 1 },
  bonus: { color: C.p2, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  cta: { backgroundColor: C.ball, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  ctaText: { ...heavy, color: C.bg, fontSize: 18 },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  second: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 },
  link: { color: C.ball, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
});
