import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaseWeb } from '@/components/case-web';
import { Underlined } from '@/components/brush-stroke';
import { DISC_ART } from '@/lib/discs';
import { computeSeason, useMatches } from '@/lib/matches';
import { CAST, useRoster } from '@/lib/roster';
import { BackSwing } from '@/components/back-swing';
import { sfx } from '@/lib/sfx';

const INK = '#0b0f1a';

/** Opponent select: a clear jewel case you can spin, open, and play. */
export default function CaseSelect() {
  const params = useLocalSearchParams<{ pick?: string; load?: string; demo?: string }>();
  const roster = useRoster();
  const matches = useMatches();
  const insets = useSafeAreaInsets();
  const rivals = roster.filter((f) => !f.isYou);
  const [tapped, setTapped] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loads, setLoads] = useState(0);
  // `?demo=1` plays the screen by itself (spin at 3.6 s, open at 6.6 s, next fighter at 13 s, play at 16.5 s) so the motion can be recorded without a finger.
  const demo = params.demo === '1';
  useEffect(() => {
    if (!demo) return;
    const timers = [setTimeout(() => setTapped('d3'), 13000), setTimeout(() => setLoads(1), 16500)];
    return () => timers.forEach(clearTimeout);
  }, [demo]);
  const pickedId = tapped ?? params.pick ?? rivals[0]?.id;
  const index = Math.max(0, rivals.findIndex((f) => f.id === pickedId));
  const picked = rivals[index];
  const loadSignal = loads + (params.load === '1' ? 1 : 0);
  const loading = loadSignal > 0;
  const { rows } = computeSeason(roster, matches);
  const row = rows.find((r) => r.id === picked.id);
  const record = row && row.wins + row.losses > 0 ? `${row.wins}–${row.losses} · ${row.points} PTS` : 'NO MATCHES YET';

  const choose = (i: number) => {
    const next = rivals[(i + rivals.length) % rivals.length];
    if (!next || next.id === picked.id || loading) return;
    void Haptics.selectionAsync();
    sfx('swish', 0.5);
    setTapped(next.id);
  };
  const load = () => {
    if (loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    sfx('go');
    setLoads((n) => n + 1);
  };
  const loaded = () => {
    sfx('select', 0.8);
    router.push({ pathname: '/match', params: { vs: pickedId } });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 }]}>
      <StatusBar style="dark" />
      <View style={styles.pad}>
        <BackSwing />
      </View>

      <CaseWeb cast={picked.cast} playSignal={loadSignal} demo={demo} onOpenChange={(o) => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('tick', 0.6); setOpen(o); }} onPlayed={loaded} />

      <View style={styles.now}>
        <Text style={styles.track}>TRACK {String(index + 1).padStart(2, '0')} / {String(rivals.length).padStart(2, '0')}  ·  {record}</Text>
        <Underlined redrawKey={picked.id} style={{ maxWidth: '100%' }}><Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>{picked.name}</Text></Underlined>
        <Text style={styles.tagline} numberOfLines={1}>{loading ? 'Loading…' : open ? CAST[picked.cast].tagline : 'Tap to open · drag to spin'}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf} style={styles.shelfScroll}>
        {rivals.map((f, i) => (
          <Pressable key={f.id} onPress={() => choose(i)} style={[styles.mini, f.id === picked.id && styles.miniOn]} accessibilityRole="button" accessibilityLabel={f.name}>
            <Image source={DISC_ART[f.cast]} style={styles.miniDisc} contentFit="contain" />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.transport}>
        <Pressable onPress={() => choose(index - 1)} hitSlop={8} style={styles.skip} accessibilityRole="button" accessibilityLabel="Previous opponent"><Text style={styles.skipText}>⏮</Text></Pressable>
        <Pressable onPress={load} style={({ pressed }) => [styles.play, pressed && { transform: [{ scale: 0.94 }] }, loading && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={`Load ${picked.name} and play`}>
          <Text style={styles.playText}>▶</Text>
        </Pressable>
        <Pressable onPress={() => choose(index + 1)} hitSlop={8} style={styles.skip} accessibilityRole="button" accessibilityLabel="Next opponent"><Text style={styles.skipText}>⏭</Text></Pressable>
      </View>
    </View>
  );
}

const heavy = { fontWeight: '900', fontStyle: 'italic' } as const;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f5f2' },
  pad: { paddingHorizontal: 16 },
  link: { color: INK, fontSize: 12, fontWeight: '900', letterSpacing: 1.5, paddingVertical: 6, opacity: 0.6 },
  now: { alignItems: 'center', paddingHorizontal: 20 },
  track: { color: INK, opacity: 0.5, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  name: { ...heavy, color: INK, fontSize: 28 },
  tagline: { color: INK, opacity: 0.55, fontSize: 12, fontStyle: 'italic' },
  shelfScroll: { flexGrow: 0, marginTop: 10 },
  shelf: { paddingHorizontal: 16, gap: 6, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  mini: { padding: 3, borderRadius: 30, borderWidth: 2, borderColor: 'transparent', opacity: 0.6 },
  miniOn: { borderColor: INK, opacity: 1 },
  miniDisc: { width: 44, height: 44 },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 8 },
  skip: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: INK, fontSize: 24 },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  playText: { color: '#d7f205', fontSize: 30, marginLeft: 4 },
});
