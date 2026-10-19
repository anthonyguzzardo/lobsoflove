import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { C } from '@/constants/arcade';
import { joinCrew } from '@/lib/cloud';

/** Where an invite link lands (lobsoflove://join/CODE, with ?claim=TOKEN when it hands you a pretender's fighter). */
export default function Join() {
  const { code, claim } = useLocalSearchParams<{ code: string; claim?: string }>();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    joinCrew(code, claim ?? null)
      .then(() => { if (live) router.replace('/crew'); })
      .catch((e: unknown) => { if (live) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [code, claim]);

  return (
    <View style={styles.root}>
      {err ? (
        <>
          <Text style={styles.err}>{err}</Text>
          <Pressable onPress={() => router.replace('/crew')} accessibilityRole="button"><Text style={styles.link}>CREW ›</Text></Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={C.ball} />
          <Text style={styles.text}>JOINING {String(code).toUpperCase()}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  text: { color: C.text, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  err: { color: C.p2, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  link: { color: C.ball, fontSize: 13, fontWeight: '900', letterSpacing: 1.5, padding: 10 },
});
