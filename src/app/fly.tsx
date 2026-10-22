import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { FLY_HTML } from '@/generated/fly-html';
import { postCallup, useCloud } from '@/lib/cloud';
import { collectBall, makeWish, useHunt, type Wish } from '@/lib/dragon-balls';
import { setLanded } from '@/lib/fly';
import { computeSeason, type Row, useMatches } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { clock, demoFriends, useBeacon, useCrewPeople } from '@/lib/presence';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';
import { useSound } from '@/lib/sound';

/** A power level read off a real season: a base, the points, the wins, and a hot streak counts for a lot. */
const powerOf = (r: Row | undefined) => (r ? Math.round(1200 + r.points * 18 + r.wins * 140 + Math.max(0, r.streak) * 420) : null);

/**
 * The sky over San Diego, drawn by three.js in a WebView (web/fly.js). Your fighter flies the real city inside a ki aura: drag
 * to steer, hold BLAST to rocket forward, hold RISE to rocket up. Each court is a pillar of light; land on one to go there.
 * Seven tennis-ball dragon balls are hidden around the city (the radar finds them), and the scouter reads the power level of
 * whoever is at the court you look at, from their real season.
 */
export default function Fly() {
  const params = useLocalSearchParams<{ demo?: string; from?: string }>();
  const roster = useRoster();
  const matches = useMatches();
  const beacon = useBeacon();
  const hunt = useHunt();
  const crewPeople = useCrewPeople();
  const cloud = useCloud();
  const scene = useScene();
  const { run } = scene;
  const sound = useSound();
  const you =roster.find((f) => f.isYou) ?? roster[0];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60 * 1000); return () => clearInterval(id); }, []);

  const data = useMemo(() => {
    const { rows } = computeSeason(roster, matches);
    const rowOf = (id?: string) => rows.find((r) => r.id === id);
    const byName = (name: string) => rowOf(roster.find((f) => f.name.toUpperCase() === name.toUpperCase())?.id);
    const people: Record<string, { name: string; color: string; here: boolean; time: string; power: number | null; rec: string }[]> = {};
    for (const p of crewPeople ?? demoFriends(now)) {
      const r = byName(p.name);
      (people[p.venue] ??= []).push({ name: p.name, color: p.color, here: p.at <= now, time: p.at <= now ? '' : clock(p.at, now), power: powerOf(r), rec: r ? `${r.wins}-${r.losses}` : '' });
    }
    const me = rowOf(you?.id);
    return JSON.stringify({
      you: you ? { cast: you.cast, color: you.color, name: you.name, power: powerOf(me) ?? 1200, rec: me ? `${me.wins}-${me.losses}` : '0-0' } : null,
      start: beacon?.venue ?? null,
      people,
      hunt,
    });
  }, [roster, matches, crewPeople, now, you, beacon?.venue, hunt]);
  useEffect(() => { if (params.demo !== '1') run(`window.setFly(${data})`); }, [run, data, params.demo]);
  useEffect(() => { run(`window.setSound(${sound})`); }, [run, sound]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={FLY_HTML}
        name="fly"
        cues={{ press: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('tick', 0.6); } }}
        onReady={() => { if (params.demo === '1') run('window.demoFly()'); }}
        onMessage={(m: SceneMsg) => {
          switch (m.type) {
            case 'blast': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('go', 0.7); break;
            case 'rise': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('swish', 0.7); break;
            case 'boom': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); sfx('slam', 0.6); break;
            case 'super': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('win', 0.7); break;
            case 'thud': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('slam', 0.9); break;
            case 'near': void Haptics.selectionAsync(); sfx('select', 0.5); break;
            case 'landing': sfx('swish', 0.8); break;
            case 'ball': collectBall(m.star); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('ping', 0.9); break;
            case 'scan': void Haptics.selectionAsync(); break;
            case 'scouter': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('clack', 0.5); break;
            case 'overload': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); sfx('can', 0.9); break;
            case 'summon': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); sfx('grunt', 0.8); break;
            case 'roar': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('slam', 0.8); break;
            case 'wish': makeWish((m.wish as Wish | null) ?? null); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('win', 0.9); break;
            case 'warp': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid); sfx('bloop', 0.8); break;
            case 'charge': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
            case 'chant': void Haptics.impactAsync(m.n >= 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); break;
            case 'full': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
            case 'lock': void Haptics.selectionAsync(); sfx('select', 0.5); break;
            case 'fire': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('slam', 1); setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 120); break;
            case 'impact': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); sfx('slam', 0.5 + 0.5 * m.near); break;
            case 'callup': {
              // A full Kamehameha on a court calls the whole crew there, same as a call-up from the crew page.
              const say = (ok: boolean, text: string) => run(`window.callResult(${JSON.stringify({ ok, text })})`);
              const mine = cloud.callups.find((c) => c.caller === 'you' && c.status !== 'off');
              if (!cloud.crew) say(false, 'NO CREW TO CALL YET. START ONE ON THE CREW PAGE.');
              else if (mine) say(false, 'YOUR CALL-UP IS STILL OUT. CANCEL IT ON THE CREW PAGE FIRST.');
              else {
                postCallup([], 3, m.id, `Lit up ${m.name} from the sky. Doubles, need 3. Who's in?`).then(
                  () => { say(true, `CREW CALLED TO ${m.short}. NEED 3.`); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('win', 0.9); },
                  (e: unknown) => say(false, e instanceof Error ? e.message.toUpperCase() : 'THE CALL DIDN\'T GO THROUGH.'),
                );
              }
              break;
            }
            case 'arrive':
              // Back to the courts, hopped onto the one you landed on.
              setLanded(m.id);
              if (params.from === 'courts' && router.canGoBack()) router.back();
              else router.replace('/courts');
              break;
          }
        }}
      />
      <BackSwing floating onBack={goBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#d8e9ef' },
});
