import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackSwing } from '@/components/back-swing';
import { FighterAvatar } from '@/components/fighter';
import { C } from '@/constants/arcade';
import { addPretender, createCrew, inviteLink, joinCrew, startCloud, useCloud } from '@/lib/cloud';
import { CAST_IDS, COLORS, useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

/**
 * Your crew: the friends whose season you share. Start one or join with a code; once in, send the invite to the group chat, or add
 * a friend by name so you can log against them before they install (they show as a pretender until they open their link).
 */
export default function CrewScreen() {
  const cloud = useCloud();
  const roster = useRoster();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [friend, setFriend] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await fn();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sfx('ping');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const invite = (forId?: string, who?: string) => {
    const url = inviteLink(forId);
    if (!url || !cloud.crew) return;
    const msg = who
      ? `${who}, you're on the ${cloud.crew.name} roster in LobsOfLove. Open this to claim your fighter and confirm your matches: ${url}`
      : `Join ${cloud.crew.name} on LobsOfLove. Code ${cloud.crew.code}: ${url}`;
    void Share.share({ message: msg });
  };

  let body: React.ReactNode;
  if (cloud.status === 'off') {
    body = <Text style={styles.note}>No backend is configured in this build, so your season stays on this phone.</Text>;
  } else if (cloud.status === 'starting') {
    body = <View style={styles.center}><ActivityIndicator color={C.ball} /><Text style={styles.note}>SIGNING IN</Text></View>;
  } else if (cloud.status === 'error') {
    body = (
      <>
        <Text style={styles.errText}>{cloud.error}</Text>
        <Btn label="TRY AGAIN" onPress={() => act(startCloud)} />
      </>
    );
  } else if (cloud.status === 'solo' || !cloud.crew) {
    body = (
      <>
        <Text style={styles.h}>START A CREW</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="CREW NAME" placeholderTextColor={C.dim} autoCapitalize="characters" maxLength={40} />
        <Btn label="START IT" onPress={() => act(() => createCrew(name))} />
        <Text style={[styles.h, { marginTop: 28 }]}>OR JOIN ONE</Text>
        <TextInput style={styles.input} value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="INVITE CODE" placeholderTextColor={C.dim} autoCapitalize="characters" autoCorrect={false} maxLength={8} />
        <Btn label="JOIN" ghost onPress={() => act(() => joinCrew(code))} />
      </>
    );
  } else {
    const crew = cloud.crew;
    body = (
      <>
        <Text style={styles.crewName} numberOfLines={1} adjustsFontSizeToFit>{crew.name}</Text>
        <Text style={styles.code}>CODE {crew.code}</Text>
        <Btn label="SEND THE INVITE TO THE GROUP CHAT" onPress={() => invite()} />
        <Text style={[styles.h, { marginTop: 24 }]}>ROSTER</Text>
        {roster.map((f) => (
          <View key={f.id} style={styles.row}>
            <FighterAvatar cast={f.cast} color={f.pretender ? C.line : f.color} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, f.pretender && { color: C.dim }]} numberOfLines={1}>{f.name}{f.isYou ? '  (YOU)' : ''}</Text>
              {f.pretender ? <Text style={styles.sub}>PRETENDER. NOT IN THE APP YET.</Text> : null}
            </View>
            {f.pretender ? <Pressable onPress={() => invite(f.id, f.name)} hitSlop={8}><Text style={styles.link}>SEND LINK</Text></Pressable> : null}
          </View>
        ))}
        <Text style={[styles.h, { marginTop: 24 }]}>ADD A FRIEND BY NAME</Text>
        <Text style={styles.note}>Log matches against them now. They confirm when they open their link.</Text>
        <TextInput style={styles.input} value={friend} onChangeText={setFriend} placeholder="THEIR NAME" placeholderTextColor={C.dim} autoCapitalize="characters" maxLength={24} />
        <Btn label="ADD THEM" ghost onPress={() => act(async () => {
          const n = roster.length;
          await addPretender(friend, CAST_IDS[n % CAST_IDS.length], COLORS[n % COLORS.length]);
          setFriend('');
        })} />
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        {body}
        {err ? <Text style={styles.errText}>{err}</Text> : null}
        {busy ? <ActivityIndicator color={C.ball} style={{ marginTop: 12 }} /> : null}
      </ScrollView>
      <BackSwing floating />
    </KeyboardAvoidingView>
  );
}

function Btn({ label, onPress, ghost }: { label: string; onPress: () => void; ghost?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.btn, ghost && styles.ghost, pressed && { transform: [{ scale: 0.97 }] }]}>
      <Text style={[styles.btnText, ghost && { color: C.ball }]}>{label}</Text>
    </Pressable>
  );
}

const heavy = { fontWeight: '900', fontStyle: 'italic' } as const;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, gap: 10 },
  center: { alignItems: 'center', gap: 10, marginTop: 40 },
  h: { color: C.dim, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  note: { color: C.dim, fontSize: 13, lineHeight: 18 },
  errText: { color: C.p2, fontSize: 13, fontWeight: '800', marginTop: 8 },
  input: { backgroundColor: C.panel, borderRadius: 12, borderWidth: 1, borderColor: C.line, color: C.text, fontSize: 18, fontWeight: '900', paddingHorizontal: 14, paddingVertical: 14, letterSpacing: 1 },
  btn: { backgroundColor: C.ball, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ghost: { backgroundColor: 'transparent', borderWidth: 2, borderColor: C.ball },
  btnText: { ...heavy, color: C.bg, fontSize: 16 },
  crewName: { ...heavy, color: C.text, fontSize: 40 },
  code: { color: C.ball, fontSize: 14, fontWeight: '900', letterSpacing: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderRadius: 12, padding: 10 },
  name: { ...heavy, color: C.text, fontSize: 18 },
  sub: { color: C.dim, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  link: { color: C.ball, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
});
