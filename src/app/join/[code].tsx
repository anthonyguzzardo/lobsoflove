import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { InkLink, Rise } from '@/components/ink-button';

import { body, MONO, P } from '@/constants/paper';
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
          <Rise><Text style={styles.err}>{err}</Text></Rise>
          <Rise index={1}><InkLink label="CREW ›" onPress={() => router.replace('/crew')} /></Rise>
        </>
      ) : (
        <>
          <ActivityIndicator color={P.ink} />
          <Text style={styles.text}>JOINING {String(code).toUpperCase()}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  text: { fontFamily: MONO, fontWeight: '800', fontSize: 14, letterSpacing: 2, color: P.ink },
  err: { ...body, color: P.red, textAlign: 'center', fontSize: 15 },
});
