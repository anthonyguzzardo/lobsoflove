import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { INK_HTML } from '@/generated/ink-html';
import { courtById, usePickedCourt } from '@/lib/courts';
import { addGear } from '@/lib/gear';
import { decode, parse, type Answers, type Card, type Slot } from '@/lib/ink-parse';
import { recognizeChar, type Stroke } from '@/lib/ink-recognize';
import { addMatch, useMatches } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

type Msg =
  | { type: 'space' } | { type: 'erase' } | { type: 'read' } | { type: 'readNow' }
  | { type: 'save' } | { type: 'nope' } | { type: 'toss' } | { type: 'more' } | { type: 'exit' }
  | { type: 'char'; strokes: Stroke[]; w: number; h: number }
  | { type: 'choose'; field: 'opp'; value: string }
  | { type: 'pen'; size: number };

const PEN_KEY = 'lol.ink.pen';
const INK_LAST = 'lol.ink.last';

/** A written character waiting on (or done with) the recognizer. */
type Entry = { space: true } | { space?: false; cands: string[] | null };

/**
 * Write anything: one finger, letters stacked in one spot or written across, no form. The page (web/ink.js) draws and
 * classifies strokes; this side recognizes each character, decodes the line, and draws a card back.
 */
export default function Ink() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const roster = useRoster();
  const matches = useMatches();
  const picked = usePickedCourt();
  const scene = useScene();
  const { run } = scene;

  const entries = useRef<Entry[]>([]);
  const inflight = useRef(new Set<Promise<void>>());
  const answers = useRef<Answers>({});
  const card = useRef<Card | null>(null);
  const offline = useRef(false);
  const names = roster.map((f) => f.name);

  const text = () => decode(entries.current.filter((e): e is Slot => e.space === true || e.cands !== null), names);
  const pushLine = () => {
    const pending = entries.current.filter((e) => !e.space && e.cands === null).length;
    run(`window.setLine(${JSON.stringify(text())}, ${pending})`);
  };

  const showCard = () => {
    const c = parse(text(), roster, answers.current);
    if (offline.current && c.draft.kind === 'none') c.lines = ['no signal', "can't read ink yet", 'your writing is kept'];
    card.current = c;
    run(`window.showCard(${JSON.stringify({ lines: c.lines, questions: c.questions, warn: c.warn, canSave: c.canSave })})`);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const read = async () => {
    if (!entries.current.some((e) => !e.space)) return;
    await Promise.all(inflight.current);
    // What the recognizer returned for each piece, kept so a bad read can be looked at afterwards.
    AsyncStorage.setItem(INK_LAST, JSON.stringify({ at: Date.now(), text: text(), entries: entries.current })).catch(() => {});
    showCard();
  };

  const save = () => {
    const c = card.current;
    if (!c?.canSave) return;
    const d = c.draft;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sfx('slam', 0.4);
    const reset = () => { entries.current = []; answers.current = {}; card.current = null; };
    // The self-writing demo never touches real standings.
    if (params.demo) { run(`window.saved("DEMO: NOT SAVED")`); reset(); return; }
    if (d.kind === 'match' && d.opp) {
      // Court: the one picked on /courts this session, else wherever you played last.
      const last = [...matches].sort((a, b) => b.playedAt - a.playedAt)[0];
      const court = courtById(picked) ?? courtById(last?.courtId);
      const id = addMatch({ p1: 'you', p2: d.opp, sets: d.sets, court: court?.name ?? last?.court ?? '', courtId: court?.id ?? last?.courtId, photoUri: null, playedAt: d.playedAt, minutes: d.minutes ?? undefined });
      run(`window.saved(${JSON.stringify(d.won ? 'WIN SAVED' : 'SAVED')})`);
      reset();
      setTimeout(() => router.replace(`/card/${id}`), 850);
    } else if (d.kind === 'gear') {
      addGear({ item: d.item, cost: d.cost, at: d.at });
      run(`window.saved(${JSON.stringify(`${d.item} LOGGED`)})`);
      reset();
    }
  };

  const onReady = () => {
    pushLine();
    AsyncStorage.getItem(PEN_KEY).then((v) => { if (v) run(`window.setPen(${Number(v)})`); }).catch(() => {});
    if (params.demo === 'loops') run('window.demoLoops()');
    else if (params.demo) run(`window.demoInk(${params.demo === '1' ? '' : JSON.stringify(params.demo)})`);
  };

  const onMessage = (m: SceneMsg) => {
    const msg = m as Msg;
    switch (msg.type) {
      case 'char': {
        const entry: Entry = { cands: null };
        entries.current.push(entry);
        void Haptics.selectionAsync();
        const p = recognizeChar(msg.strokes, msg.w, msg.h, text())
          .then((c) => { entry.cands = c.length ? c : ['?']; offline.current = false; })
          .catch(() => { entry.cands = ['?']; offline.current = true; })
          .finally(() => { inflight.current.delete(p); pushLine(); });
        inflight.current.add(p);
        pushLine();
        break;
      }
      case 'space':
        if (entries.current.length && !entries.current[entries.current.length - 1].space) entries.current.push({ space: true });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        pushLine();
        break;
      case 'erase':
        entries.current.pop();
        answers.current = {};
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        pushLine();
        break;
      case 'read':
      case 'readNow':
        void read();
        break;
      case 'choose':
        answers.current = { ...answers.current, [msg.field]: msg.value };
        void Haptics.selectionAsync();
        showCard();
        break;
      case 'save':
        save();
        break;
      case 'nope':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'toss':
        card.current = null;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'more':
        card.current = null;
        break;
      case 'pen':
        void Haptics.selectionAsync();
        AsyncStorage.setItem(PEN_KEY, String(msg.size)).catch(() => {});
        break;
      case 'exit':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        goBack();
        break;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView scene={scene} html={INK_HTML} name="ink" onReady={onReady} onMessage={onMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
});
