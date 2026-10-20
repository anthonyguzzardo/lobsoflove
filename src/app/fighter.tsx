import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { FIGHTER_HTML } from '@/generated/fighter-html';
import { goBack } from '@/lib/nav';
import { CAST, type CastId, type Fighter, saveFighter, useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import { askInk } from '@/lib/ink-ask';

type Field = 'name' | 'bio' | 'favoritePro' | 'homeCourt' | 'racket';
type Msg =
  | { type: 'save' | 'poke' | 'grab' | 'fling' | 'squish' | 'splat' | 'boing' | 'beep' | 'grunt' | 'swish' | 'serve' | 'pock' | 'return' | 'flex' | 'burst' | 'cheer' | 'dash' | 'gulp' | 'crush' | 'ahh' | 'ballbounce' | 'gotyou' | 'aimtick' | 'lock' | 'snipe' | 'ace' | 'fault' | 'double' }
  | { type: 'bloop'; cast: CastId }
  | { type: 'thud'; v: number }
  | { type: 'cast'; cast: CastId }
  | { type: 'color'; color: string }
  | { type: 'edit'; field: Field };

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
  const scene = useScene();
  const { run } = scene;
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const payload = JSON.stringify({ name: draft.name, bio: draft.bio, favoritePro: draft.favoritePro, homeCourt: draft.homeCourt, racket: draft.racket, cast: draft.cast, color: draft.color });
  useEffect(() => { run(`window.setFighter(${payload})`); }, [run, payload]);

  /** A field is answered on the TYPE / WRITE page, not in a form sheet; the answer lands back on the draft. */
  const edit = (field: Field) => askInk(
    { label: FIELDS[field].label, max: FIELDS[field].max, upper: field === 'name', examples: [FIELDS[field].placeholder] },
    (t) => { setDraft((d) => ({ ...d, [field]: field === 'name' ? t || 'YOU' : t })); void Haptics.selectionAsync(); },
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={FIGHTER_HTML}
        name="fighter"
        cues={{ slid: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('win', 0.7); } }}
        onReady={() => {
          if (params.demo === '1') run('window.demoFighter()');
          // ?demo=<style> switches to that style as if its candy were tapped; ?demo=drink makes the Wall drink right away.
          if (params.demo && params.demo in CAST) run(`setTimeout(() => window.demoStyle('${params.demo}'), 900)`);
          if (params.demo === 'drink') run('setTimeout(() => window.demoDrink(), 900)');
          // ?demo=snipe switches to Servebot and serves an ace; ?demo=double serves the double fault.
          if (params.demo === 'snipe' || params.demo === 'double') run(`setTimeout(() => window.demoStyle('bot'), 900); setTimeout(() => window.demoSnipe(${params.demo === 'double'}), 3200)`);
        }}
        onMessage={(m: SceneMsg) => {
          const msg = m as Msg;
          switch (msg.type) {
            case 'cast': setDraft((d) => ({ ...d, cast: msg.cast })); break;
            case 'color': setDraft((d) => ({ ...d, color: msg.color })); void Haptics.selectionAsync(); break;
            case 'edit': edit(msg.field); break;
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
            case 'aimtick': sfx('tick', 0.45); break;
            case 'lock': void Haptics.selectionAsync(); sfx('tick', 0.9); break;
            case 'snipe': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('pock', 1); sfx('swish', 0.9); break;
            case 'ace': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('slam', 0.7); break;
            case 'fault': sfx('drip', 0.6); break;
            case 'double': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); sfx('bloop', 0.7); break;
            case 'serve': sfx('bounce', 0.3); break;
            case 'pock': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('pock', 0.7); break;
            case 'return': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('pock', 0.9); break;
            case 'save': saveFighter(draftRef.current); goBack(); break;
          }
        }}
      />
      <BackSwing floating />
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
});
