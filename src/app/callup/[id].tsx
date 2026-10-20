import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { InkLink, Rise } from '@/components/ink-button';
import { body, MONO, P } from '@/constants/paper';
import { joinCrew, startCloud } from '@/lib/cloud';

/**
 * Where a call-up link lands (lobsoflove://callup/ID?crew=CODE). Someone not in the crew yet joins it on the way; then the crew
 * photo opens, where the strip already says I'M IN.
 */
export default function CallupLink() {
  const { crew } = useLocalSearchParams<{ id: string; crew?: string }>();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      await startCloud();
      // Joining again is a no-op for members; someone in a different crew just goes to theirs.
      if (crew) await joinCrew(crew).catch((e: Error) => { if (!/another crew/.test(e.message)) throw e; });
    })().then(() => { if (live) router.replace('/crew'); }, (e: unknown) => { if (live) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [crew]);

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
          <Text style={styles.text}>OPENING THE CALL-UP</Text>
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
