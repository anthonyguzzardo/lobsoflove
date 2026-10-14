import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { BackSwing } from '@/components/back-swing';
import { FIGHTER_HTML } from '@/generated/fighter-html';
import { goBack } from '@/lib/nav';
import { CAST, type CastId, type Fighter, saveFighter, useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

type Field = 'name' | 'bio' | 'favoritePro' | 'homeCourt' | 'racket';
type Msg =
  | { type: 'ready' | 'press' | 'line' | 'slid' | 'save' | 'poke' | 'grab' | 'fling' | 'squish' | 'splat' | 'boing' | 'beep' | 'grunt' | 'swish' | 'serve' | 'pock' | 'return' | 'flex' | 'burst' | 'cheer' | 'dash' | 'gulp' | 'crush' | 'ahh' | 'ballbounce' | 'gotyou' }
  | { type: 'bloop'; cast: CastId }
  | { type: 'thud'; v: number }
  | { type: 'cast'; cast: CastId }
  | { type: 'color'; color: string }
  | { type: 'edit'; field: Field }
  | { type: 'error'; message: string; at?: string };

const FIELDS: Record<Field, { label: string; max: number; placeholder: string }> = {
  name: { label: 'FIGHTER NAME', max: 16, placeholder: 'BASELINE BANDIT' },
  bio: { label: 'ONE LINE OF TRASH TALK', max: 90, placeholder: 'I do not miss. I just choose not to hit.' },
  favoritePro: { label: 'FAVORITE PRO', max: 30, placeholder: 'Alcaraz' },
  homeCourt: { label: 'HOME COURT', max: 30, placeholder: 'Muir courts' },
  racket: { label: 'RACKET', max: 30, placeholder: 'Babolat Pure Aero' },
};

/** Make your fighter: a soft-body jelly you grab, poke and fling, drawn by three.js in a WebView (web/fighter.js). */
export default function MakeYourFighter() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const roster = useRoster();
  const you = roster.find((f) => f.isYou) ?? roster[0];
  const [draft, setDraft] = useState<Fighter>(you);
  const [editing, setEditing] = useState<Field | null>(null);
  const [text, setText] = useState('');
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const run = (js: string) => web.current?.injectJavaScript(`${js};true;`);
  const payload = JSON.stringify({ name: draft.name, bio: draft.bio, favoritePro: draft.favoritePro, homeCourt: draft.homeCourt, racket: draft.racket, cast: draft.cast, color: draft.color });
  useEffect(() => { if (ready.current) run(`window.setFighter(${payload})`); }, [payload]);

  const commit = () => {
    if (!editing) return;
    const value = editing === 'name' ? text.trim().toUpperCase() || 'YOU' : text.trim();
    setDraft((d) => ({ ...d, [editing]: value }));
    setEditing(null);
    void Haptics.selectionAsync();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        ref={web}
        source={{ html: FIGHTER_HTML }}
        originWhitelist={['*']}
        style={styles.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        javaScriptEnabled
        onMessage={(e) => {
          const msg = JSON.parse(e.nativeEvent.data) as Msg;
          switch (msg.type) {
            case 'ready':
              ready.current = true;
              run(`window.setFighter(${JSON.stringify(draftRef.current)})`);
              if (params.demo === '1') run('window.demoFighter()');
              // ?demo=<style> switches to that style as if its candy were tapped; ?demo=drink makes the Wall drink right away.
              if (params.demo && params.demo in CAST) run(`setTimeout(() => window.demoStyle('${params.demo}'), 900)`);
              if (params.demo === 'drink') run('setTimeout(() => window.demoDrink(), 900)');
              break;
            case 'cast': setDraft((d) => ({ ...d, cast: msg.cast })); break;
            case 'color': setDraft((d) => ({ ...d, color: msg.color })); void Haptics.selectionAsync(); break;
            case 'edit': setText(draftRef.current[msg.field] === 'YOU' && msg.field === 'name' ? '' : draftRef.current[msg.field]); setEditing(msg.field); break;
            case 'poke': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('pock', 0.8); break;
            case 'boing': sfx('pock', 0.45); break;
            case 'grab': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); sfx('squeak', 0.45); break;
            case 'fling': sfx('swish', 0.5); break;
            case 'thud': void Haptics.impactAsync(msg.v > 0.5 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); sfx('bounce', 0.3 + 0.5 * msg.v); break;
            case 'squish': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); sfx('can', 0.6); break;
            case 'bloop': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('bloop', 0.8); break;
            case 'splat': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('drip', 0.8); break;
            case 'beep': sfx('tick', 0.5); break;
            case 'grunt': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('grunt', 0.7); break;
            case 'swish': sfx('swish', 0.4); break;
            case 'flex': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('grunt', 0.55); break;
            case 'burst': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('pock', 1); sfx('swish', 0.8); break;
            case 'cheer': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('select', 0.8); break;
            case 'dash': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('squeak', 0.55); break;
            case 'gulp': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); sfx('bloop', 0.5); break;
            case 'crush': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('pock', 0.6); break;
            case 'ahh': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
            case 'gotyou': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('select', 0.8); break;
            case 'ballbounce': sfx('bounce', 0.45); break;
            case 'serve': sfx('bounce', 0.3); break;
            case 'pock': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('pock', 0.7); break;
            case 'return': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('pock', 0.9); break;
            case 'press': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('tick', 0.7); break;
            case 'line': void Haptics.selectionAsync(); break;
            case 'slid': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('win', 0.7); break;
            case 'save': saveFighter(draftRef.current); goBack(); break;
            case 'error': console.warn('fighter scene:', msg.message, msg.at ?? ''); break;
          }
        }}
      />
      <BackSwing floating />
      {editing ? (
        <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={commit} accessibilityLabel="Done" />
          <View style={[styles.card, { marginBottom: 12 }]}>
            <Text style={styles.label}>{FIELDS[editing].label}</Text>
            {editing !== 'name' ? <Text style={styles.hint}>Shows on your player card.</Text> : null}
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              maxLength={FIELDS[editing].max}
              autoCapitalize={editing === 'name' ? 'characters' : 'sentences'}
              autoCorrect={editing === 'bio'}
              placeholder={FIELDS[editing].placeholder}
              placeholderTextColor="rgba(22,24,29,0.35)"
              returnKeyType="done"
              onSubmitEditing={commit}
              style={[styles.input, editing === 'name' && styles.inputName]}
              selectionColor="#e2562f"
            />
            <View style={styles.row}>
              <Text style={styles.count}>{text.length} / {FIELDS[editing].max}</Text>
              <Pressable onPress={commit} style={({ pressed }) => [styles.done, pressed && styles.donePressed]} accessibilityRole="button">
                <Text style={styles.doneText}>DONE</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
  web: { flex: 1, backgroundColor: '#efece5' },
  sheet: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(239,236,229,0.92)', justifyContent: 'flex-end', paddingHorizontal: 16 },
  card: { backgroundColor: '#fffdf8', borderRadius: 12, padding: 16, borderWidth: 2, borderColor: '#16181d', shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 } },
  label: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.4, color: '#e2562f' },
  hint: { fontFamily: MONO, fontWeight: '700', fontSize: 13, color: '#16181d', marginTop: 4 },
  input: { fontFamily: MONO, fontWeight: '700', fontSize: 18, color: '#16181d', paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: '#16181d' },
  inputName: { fontSize: 28, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  count: { fontFamily: MONO, fontWeight: '700', fontSize: 12, color: '#16181d', opacity: 0.55 },
  done: { backgroundColor: '#16181d', borderRadius: 4, paddingHorizontal: 16, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  donePressed: { transform: [{ translateY: 4 }], shadowOffset: { width: 0, height: 0 } },
  doneText: { fontFamily: MONO, fontWeight: '800', fontSize: 14, letterSpacing: 1.4, color: '#efece5' },
});
