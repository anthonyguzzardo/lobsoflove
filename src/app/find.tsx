import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { MONO, P } from '@/constants/paper';
import { crewNow, findPlayers, type Found, inviteLink, invitePlayer } from '@/lib/cloud';
import { goBack } from '@/lib/nav';
import { sfx } from '@/lib/sfx';

/**
 * Find players the way any app does it: type part of a name, everyone with the app who matches shows up as you type, tap one and
 * they are invited. They get a push and a JOIN on their crew page. Anyone not on the app yet gets the link instead (bottom row).
 */
export default function Find() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, true>>({});
  const asked = useRef(0);

  // Search as you type, a beat after the last key.
  useEffect(() => {
    const t = q.trim();
    if (!t) return;
    const n = ++asked.current;
    const timer = setTimeout(() => {
      findPlayers(t).then(
        (r) => { if (n === asked.current) { setFound(r); setError(null); } },
        (e: Error) => { if (n === asked.current) setError(e.message); },
      );
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  const type = (v: string) => { setQ(v); if (!v.trim()) { asked.current++; setFound(null); setError(null); } };

  const invite = (p: Found) => {
    if (p.crew !== 'free' || p.invited || sent[p.id]) return;
    setSent((s) => ({ ...s, [p.id]: true }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sfx('pock', 0.8);
    invitePlayer(p.id).catch((e: Error) => {
      setSent((s) => { const n = { ...s }; delete n[p.id]; return n; });
      setError(e.message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
  };

  const shareLink = () => {
    const url = inviteLink();
    const crew = crewNow();
    if (url && crew) void Share.share({ message: `Join ${crew.name} on LobsOfLove. Tap to get in: ${url}` });
  };

  const status = (p: Found) =>
    p.crew === 'yours' ? 'IN YOUR CREW' : p.crew === 'taken' ? 'IN A CREW' : p.invited || sent[p.id] ? 'INVITED' : 'INVITE';

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={12}><Text style={styles.back}>{'<'} BACK</Text></Pressable>
        <Text style={styles.title}>FIND PLAYERS</Text>
        <View style={styles.headSpace} />
      </View>
      <View style={styles.searchWrap}>
        <Svg width={20} height={20} viewBox="0 0 20 20">
          <Circle cx={8} cy={8} r={6} stroke={P.ink} strokeWidth={2.5} fill="none" />
          <Path d="M12.5 12.5 L18 18" stroke={P.ink} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={type}
          placeholder="search by name"
          placeholderTextColor={P.faint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          autoFocus
        />
        {q ? <Pressable onPress={() => type('')} hitSlop={10}><Text style={styles.clear}>CLEAR</Text></Pressable> : null}
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listIn} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.note}>{error}</Text> : null}
        {found === null && !error ? <Text style={styles.note}>everyone on LobsOfLove shows up here</Text> : null}
        {found?.length === 0 ? <Text style={styles.note}>nobody called &quot;{q.trim()}&quot; yet</Text> : null}
        {found?.map((p) => {
          const s = status(p);
          const open = s === 'INVITE';
          return (
            <Pressable key={p.id} onPress={() => invite(p)} style={({ pressed }) => [styles.row, pressed && open && styles.pressed]}>
              <Blob color={p.color} />
              <View style={styles.who}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                {p.home ? <Text style={styles.home} numberOfLines={1}>{p.home}</Text> : null}
              </View>
              <View style={[styles.pill, open ? styles.pillGo : styles.pillDone]}>
                <Text style={[styles.pillText, open && styles.pillGoText]}>{s}</Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable onPress={shareLink} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
          <Text style={styles.linkText}>NOT ON THE APP YET? SEND THE LINK</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A jelly fighter's head in their color: a soft blob with two eyes. */
function Blob({ color }: { color: string }) {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <Path d="M20 4 C31 4 36 12 36 22 C36 32 29 37 20 37 C11 37 4 32 4 22 C4 12 9 4 20 4 Z" fill={color} stroke={P.ink} strokeWidth={2.5} />
      <Circle cx={15} cy={19} r={2.6} fill={P.ink} />
      <Circle cx={25} cy={19} r={2.6} fill={P.ink} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  headSpace: { width: 56 },
  back: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.2, color: P.ink, width: 56 },
  title: { fontFamily: MONO, fontWeight: '800', fontSize: 13, letterSpacing: 1.6, color: P.red },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 2.5, borderColor: P.ink, borderRadius: 24, backgroundColor: P.card,
  },
  search: { flex: 1, fontFamily: MONO, fontWeight: '700', fontSize: 17, color: P.ink, paddingVertical: 10 },
  clear: { fontFamily: MONO, fontWeight: '800', fontSize: 10, letterSpacing: 1.2, color: P.dim },
  list: { flex: 1 },
  listIn: { padding: 16, gap: 10 },
  note: { fontFamily: MONO, fontWeight: '700', fontSize: 13, color: P.dim, textAlign: 'center', marginVertical: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 2, borderColor: P.ink, borderRadius: 14, backgroundColor: P.card,
  },
  pressed: { opacity: 0.75 },
  who: { flex: 1, minWidth: 0 },
  name: { fontFamily: MONO, fontWeight: '800', fontSize: 16, letterSpacing: 0.6, color: P.ink },
  home: { fontFamily: MONO, fontWeight: '700', fontSize: 11, color: P.dim, marginTop: 2 },
  pill: { borderWidth: 2, borderColor: P.ink, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  pillGo: { backgroundColor: P.red },
  pillDone: { backgroundColor: 'transparent', opacity: 0.55 },
  pillText: { fontFamily: MONO, fontWeight: '800', fontSize: 10, letterSpacing: 1.1, color: P.ink },
  pillGoText: { color: P.card },
  linkRow: { marginTop: 8, paddingVertical: 14, borderWidth: 2, borderColor: P.ink, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center' },
  linkText: { fontFamily: MONO, fontWeight: '800', fontSize: 11, letterSpacing: 1.2, color: P.ink },
});
