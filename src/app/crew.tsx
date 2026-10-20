import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackSwing } from '@/components/back-swing';
import { InkButton } from '@/components/ink-button';
import { type Cue, SceneView, useScene } from '@/components/scene-view';
import { MONO, P, paperCard } from '@/constants/paper';
import venues from '@/data/venues.json';
import { CREW_HTML } from '@/generated/crew-html';
import {
  answerCallup, type Callup, callupLink, cancelCallup, crewNow, createCrew, deleteCrew, inviteLink, leaveCrew, postCallup, removePretender,
  startCloud, useCloud,
} from '@/lib/cloud';
import { useMatches } from '@/lib/matches';
import { useBeacon } from '@/lib/presence';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

const CUES: Record<string, Cue> = {
  poke: (m) => { void Haptics.impactAsync(m.pretender ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium); sfx(m.pretender ? 'drip' : m.cast === 'grunter' ? 'grunt' : 'squeak', 0.7); },
  arrive: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('slam', 0.5); },
  cheer: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('win', 0.8); },
  write: () => { void Haptics.selectionAsync(); sfx('swish', 0.6); },
  pen: () => { void Haptics.selectionAsync(); sfx('swish', 0.4); },
  select: (m) => { if (m.count || m.anyone) { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('pock', 0.8); } },
  warn: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); sfx('clack', 0.6); },
  tick: () => { void Haptics.selectionAsync(); sfx('tick', 0.5); },
  in: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('ping', 0.8); },
};

const FORMAT = ['', 'Serves', 'Singles', 'King of the court', 'Doubles', 'Doubles', 'Two courts', 'Two courts', 'Two courts'];
const shortName = (id: string | null | undefined) => {
  const v = venues.find((x) => x.id === id);
  return v ? v.short.replace(/ NORTH$/, '').replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()).replace(/^Ucsd/, 'UCSD') : null;
};
/** Your court: your home court if it is one of ours, else the first venue. */
const venueFor = (f: { homeCourt: string }) => venues.find((v) => v.name === f.homeCourt)?.id ?? venues[0].id;
/** When to say, from the clock: before 4 pm "after 5", into the evening "now", late "tomorrow after 5". */
const when = (d = new Date()) => (d.getHours() < 16 ? 'after 5' : d.getHours() < 20 ? 'now' : 'tomorrow after 5');

/**
 * Your crew, as a team photo of jelly fighters on paper (web/crew.js). Poke your friends. Circle the ones you want and the strip
 * calls them up: the app writes the message (one tap to retype it), sends it to the group chat with a link, and their answers
 * land on the photo. A call-up sent to you turns the strip into I'M IN. Leave or delete the crew, or hold a pretender to remove
 * them: the strip turns red and sliding it is the yes.
 */
export default function CrewScreen() {
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const cloud = useCloud();
  const roster = useRoster();
  const matches = useMatches();
  const beacon = useBeacon();
  const scene = useScene();
  const { run } = scene;
  const you = roster.find((f) => f.isYou) ?? roster[0];
  // An unnamed fighter is just "YOU": name the crew after your court instead of "YOU'S CREW".
  const suggest = (you.name && you.name !== 'YOU' ? `${you.name}'S CREW` : `${shortName(venueFor(you)) ?? 'THE'} CREW`).toUpperCase().slice(0, 40);
  const inCrew = cloud.status === 'crew' && !!cloud.crew;
  // The court a call-up is for: where you are, else where you played last, else your home court's venue.
  const lastCourt = [...matches].sort((a, b) => b.playedAt - a.playedAt)[0]?.courtId;
  const venue = beacon?.venue ?? lastCourt ?? venues.find((v) => v.name === you.homeCourt)?.id ?? venues[0].id;
  const [edit, setEdit] = useState<string | null>(null);
  const edited = useRef(false);

  // The call-up that matters: one sent to you you have not said out to, else your own live one.
  const name = (id: string) => roster.find((f) => f.id === id)?.name ?? '?';
  const live: Callup | undefined = cloud.callups.find((c) => c.caller !== 'you' && c.answers.you !== 'out') ?? cloud.callups.find((c) => c.caller === 'you');
  const data = JSON.stringify({
    mode: inCrew ? 'crew' : cloud.status,
    name: cloud.crew?.name ?? '',
    code: cloud.crew?.code ?? '',
    role: cloud.crew?.role ?? '',
    error: cloud.error,
    suggest,
    fighters: (inCrew ? roster : [you]).map((f) => ({ id: f.id, name: f.name, cast: f.cast, color: f.color, you: !!f.isYou, pretender: !!f.pretender })),
    callup: live ? { id: live.id, mine: live.caller === 'you', callerName: name(live.caller), message: live.message, need: live.need, status: live.status, answers: live.answers } : null,
  });
  useEffect(() => { if (!demo) run(`window.setCrew(${data})`); }, [run, data, demo]);

  const share = (message: string) => { void Share.share({ message }); };
  const invite = (forId?: string, who?: string) => {
    const url = inviteLink(forId);
    const crew = crewNow();
    if (!url || !crew) return;
    share(who
      ? `${who}, you're on the ${crew.name} roster in LobsOfLove. Open this to claim your fighter and confirm your matches: ${url}`
      : `Join ${crew.name} on LobsOfLove. Tap to get in: ${url}`);
  };
  const fail = (e: unknown) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    sfx('bloop', 0.7);
    run(`window.nope(${JSON.stringify(e instanceof Error ? e.message : String(e))})`);
  };
  const setMessage = (t: string) => run(`window.setMessage(${JSON.stringify(t)})`);

  const onMessage = (msg: { type: string; [k: string]: any }) => {
    if (demo) return;
    switch (msg.type) {
      case 'invite': invite(msg.id, msg.name); break;
      case 'select': {
        // A fresh circle gets a fresh message, unless you typed your own for this one.
        if (!msg.count && !msg.anyone) { edited.current = false; break; }
        if (edited.current) break;
        const n = Math.max(1, msg.count);
        const court = shortName(venue) ?? 'the courts';
        setMessage(`${FORMAT[Math.min(n + 1, 8)]} at ${court} ${when()}? Need ${n} more.`);
        break;
      }
      case 'editmsg': setEdit(msg.text ?? ''); break;
      case 'alt':
        if (msg.act === 'write') router.push('/ink');
        else if (msg.act === 'out') answerCallup(msg.id, false).then(() => run('window.nope()'), fail);
        else if (msg.act === 'calloff') cancelCallup(msg.id).then(() => sfx('swish', 0.6), fail);
        break;
      case 'slid': handleSlid(msg); break;
    }
  };

  const handleSlid = (a: { [k: string]: any }) => {
    // Making the crew sends the link straight away: there is nothing else to set up.
    if (a.action === 'start') createCrew(suggest).then(() => { run('window.cheer()'); setTimeout(() => invite(), 600); }, fail);
    else if (a.action === 'retry') void startCloud();
    else if (a.action === 'invite') invite();
    else if (a.action === 'callup') {
      const ids: string[] = a.anyone ? [] : a.ids;
      postCallup(ids, a.need, venue, a.message).then((id) => {
        edited.current = false;
        run('window.cheer()');
        const link = callupLink(id);
        // Anyone circled who isn't in the app yet gets their own claim link, so answering also signs them up.
        const asked = a.anyone ? roster : roster.filter((f) => (a.ids as string[]).includes(f.id));
        const claims = asked.filter((f) => f.pretender).map((f) => `${f.name}, claim your fighter first: ${inviteLink(f.id)}`);
        share([`${a.message}${link ? ` Tap if you're in: ${link}` : ''}`, ...claims].join('\n\n'));
      }, fail);
    } else if (a.action === 'in') answerCallup(a.id, true).then(() => run('window.cheer()'), fail);
    else if (a.action === 'resend' && live) { const link = callupLink(live.id); share(`${live.message}${link ? ` Tap if you're in: ${link}` : ''}`); }
    else if (a.action === 'confirm') {
      const go = a.kind === 'delete' ? deleteCrew() : a.kind === 'leave' ? leaveCrew() : removePretender(a.id);
      go.then(() => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('swish', 0.8); }, fail);
    }
  };

  const commit = () => {
    if (edit === null) return;
    const t = edit.trim();
    if (t) { edited.current = true; setMessage(t); }
    setEdit(null);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={CREW_HTML}
        name="crew"
        cues={CUES}
        onReady={() => {
          if (demo === 'crew') run('window.demoCrew()');
          else if (demo === 'solo') run('window.demoSolo()');
          else if (demo === 'circle') run('window.demoCircle(); setTimeout(() => window.demoLoop(), 1500)');
          else if (demo === 'asked') run('window.demoAsked()');
        }}
        onMessage={onMessage}
      />
      <BackSwing floating />
      {edit !== null ? (
        <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={commit} accessibilityLabel="Done" />
          <View style={[paperCard, { marginBottom: 12 }]}>
            <Text style={styles.label}>THE MESSAGE</Text>
            <TextInput value={edit} onChangeText={setEdit} autoFocus multiline maxLength={140} placeholder="Say it your way" placeholderTextColor={P.faint} selectionColor={P.red} style={styles.input} returnKeyType="done" blurOnSubmit onSubmitEditing={commit} />
            <View style={styles.row}>
              <Text style={styles.count}>{edit.length} / 140</Text>
              <InkButton label="DONE" onPress={commit} />
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper },
  sheet: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(239,236,229,0.92)', justifyContent: 'flex-end', paddingHorizontal: 16 },
  label: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.4, color: P.red },
  input: { fontFamily: MONO, fontWeight: '800', fontSize: 18, color: P.ink, paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: P.ink, minHeight: 60 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  count: { fontFamily: MONO, fontWeight: '700', fontSize: 12, color: P.ink, opacity: 0.55 },
});
