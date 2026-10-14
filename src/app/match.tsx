import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FighterAvatar } from '@/components/fighter';
import { C } from '@/constants/arcade';
import { courtById, usePickedCourt } from '@/lib/courts';
import { addMatch, type SetScore, useMatches, winnerOf } from '@/lib/matches';
import { useRoster } from '@/lib/roster';
import { BackSwing } from '@/components/back-swing';
import { sfx } from '@/lib/sfx';

export default function MatchScreen() {
  const { vs } = useLocalSearchParams<{ vs: string }>();
  const roster = useRoster();
  const past = useMatches();
  const insets = useSafeAreaInsets();
  const you = roster.find((f) => f.isYou) ?? roster[0];
  const opp = roster.find((f) => f.id === vs) ?? roster.find((f) => !f.isYou) ?? you;
  const pickedCourt = usePickedCourt();
  const court = courtById(pickedCourt ?? (past.length ? past[past.length - 1].courtId : undefined));
  const [photo, setPhoto] = useState<string | null>(null);
  const [sets, setSets] = useState<SetScore[]>([[0, 0]]);
  const winner = winnerOf({ p1: you.id, p2: opp.id, sets });

  const takePhoto = async () => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    const res = cam.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 }).catch(() => null)
      : null;
    // The simulator has no camera, and a denied permission lands here too: fall back to the library.
    const picked = res ?? (await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 }));
    if (!picked.canceled && picked.assets[0]) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPhoto(picked.assets[0].uri);
    }
  };

  const bump = (i: number, side: 0 | 1, by: number) => {
    void Haptics.selectionAsync();
    setSets((s) => s.map((set, j) => (j === i ? (side === 0 ? [Math.max(0, set[0] + by), set[1]] : [set[0], Math.max(0, set[1] + by)]) : set) as SetScore));
  };

  const submit = () => {
    if (!winner) return Alert.alert('No winner yet', 'Every set needs a winner, and one player has to take more sets.');
    if (!photo) return Alert.alert('Photo first', 'Every match starts with a photo at the court.');
    if (!court) return Alert.alert('Pick a court', 'Every match is played somewhere.');
    const id = addMatch({ p1: you.id, p2: opp.id, court: court.name, courtId: court.id, photoUri: photo, sets });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sfx('win');
    router.replace({ pathname: '/card/[id]', params: { id } });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
      <BackSwing />
      <Text style={styles.kicker}>NEW MATCH</Text>
      <View style={styles.versus}>
        <View style={styles.who}><FighterAvatar cast={you.cast} color={you.color} size={84} /><Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{you.name}</Text></View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.who}><FighterAvatar cast={opp.cast} color={opp.color} size={84} /><Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{opp.name}</Text></View>
      </View>

      <Text style={styles.label}>1 · PHOTO AT THE COURT</Text>
      <Pressable onPress={takePhoto} style={styles.photo} accessibilityRole="button" accessibilityLabel="Take the match photo">
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.photoHint}>TAP TO SHOOT{'\n'}<Text style={styles.photoSub}>both of you, or the court</Text></Text>}
      </Pressable>

      <Text style={styles.label}>2 · COURT</Text>
      <Pressable onPress={() => router.push({ pathname: '/courts', params: { from: 'match' } })} style={styles.courtBtn} accessibilityRole="button" accessibilityLabel="Choose the court">
        <Text style={[styles.courtName, !court && { color: C.dim }]} numberOfLines={1}>{court ? court.name.toUpperCase() : 'CHOOSE YOUR COURT'}</Text>
        <Text style={styles.link}>{court ? 'CHANGE ›' : 'PICK ›'}</Text>
      </Pressable>

      <Text style={styles.label}>3 · SCORE</Text>
      {sets.map((set, i) => (
        <View key={i} style={styles.setRow}>
          <Text style={styles.setNo}>SET {i + 1}</Text>
          {([0, 1] as const).map((side) => (
            <View key={side} style={styles.stepper}>
              <Pressable onPress={() => bump(i, side, -1)} hitSlop={8} style={styles.stepBtn} accessibilityLabel="Minus one game"><Text style={styles.stepTxt}>−</Text></Pressable>
              <Text style={[styles.games, { color: side === 0 ? you.color : opp.color }]}>{set[side]}</Text>
              <Pressable onPress={() => bump(i, side, 1)} hitSlop={8} style={styles.stepBtn} accessibilityLabel="Plus one game"><Text style={styles.stepTxt}>+</Text></Pressable>
            </View>
          ))}
        </View>
      ))}
      <View style={styles.setActions}>
        {sets.length < 5 ? <Pressable onPress={() => setSets((s) => [...s, [0, 0]])}><Text style={styles.link}>+ ADD SET</Text></Pressable> : null}
        {sets.length > 1 ? <Pressable onPress={() => setSets((s) => s.slice(0, -1))}><Text style={[styles.link, { color: C.dim }]}>REMOVE LAST</Text></Pressable> : null}
      </View>

      <Pressable onPress={submit} style={({ pressed }) => [styles.cta, !(winner && photo && court) && styles.ctaOff, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button">
        <Text style={styles.ctaText}>{winner ? `GAME, SET, MATCH · ${(winner === you.id ? you : opp).name}` : 'GAME, SET, MATCH'}</Text>
      </Pressable>
      <Text style={styles.note}>Saved on this phone only for now. Opponent confirmation arrives with the shared backend.</Text>
    </ScrollView>
  );
}

const heavy = { fontWeight: '900', fontStyle: 'italic' } as const;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  kicker: { color: C.ball, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 8 },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 6 },
  who: { alignItems: 'center', width: 130 },
  name: { ...heavy, color: C.text, fontSize: 15 },
  vs: { ...heavy, color: C.dim, fontSize: 24 },
  label: { color: C.dim, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 18, marginBottom: 6 },
  photo: { height: 170, borderRadius: 14, borderWidth: 2, borderColor: C.line, borderStyle: 'dashed', backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoHint: { ...heavy, color: C.text, fontSize: 18, textAlign: 'center' },
  photoSub: { color: C.dim, fontSize: 12, fontWeight: '600', fontStyle: 'normal' },
  courtBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  courtName: { ...heavy, color: C.text, fontSize: 16, flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.panel, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  setNo: { color: C.dim, fontSize: 11, fontWeight: '800', letterSpacing: 1, width: 44 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.panelHi, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: C.text, fontSize: 22, fontWeight: '700', lineHeight: 26 },
  games: { ...heavy, fontSize: 30, width: 40, textAlign: 'center' },
  setActions: { flexDirection: 'row', gap: 20, marginTop: 2 },
  link: { color: C.ball, fontSize: 12, fontWeight: '900', letterSpacing: 1, paddingVertical: 8 },
  cta: { backgroundColor: C.ball, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center', marginTop: 18 },
  ctaOff: { opacity: 0.45 },
  ctaText: { ...heavy, color: C.bg, fontSize: 17 },
  note: { color: C.dim, fontSize: 11, textAlign: 'center', marginTop: 10 },
});
