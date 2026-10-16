import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { INK_HTML } from '@/generated/ink-html';
import venues from '@/data/venues.json';
import { courtById, pickCourt, usePickedCourt } from '@/lib/courts';
import { addGear } from '@/lib/gear';
import { actionToLine, AI_READER_READY, askAiReader, patchCard, unknownCard } from '@/lib/ink-claude';
import { parseCommand, type Page } from '@/lib/ink-commands';
import { decode, parse, type Answers, type Card, type Slot } from '@/lib/ink-parse';
import { layoutLine, recognizeChar, type Stroke } from '@/lib/ink-recognize';
import { addMatch, removeMatch, scoreLine, useMatches, winnerOf } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { saveFighter, useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

type Msg =
  | { type: 'space' } | { type: 'erase' } | { type: 'read' } | { type: 'readNow' }
  | { type: 'save' } | { type: 'nope' } | { type: 'toss' } | { type: 'more' } | { type: 'exit' }
  | { type: 'char'; strokes: Stroke[]; w: number; h: number }
  | { type: 'choose'; field: 'opp' | 'pick'; value: string }
  | { type: 'pen'; size: number }
  | { type: 'dropped' };

const PEN_KEY = 'lol.ink.pen';
const PAGE_ROUTES: Record<Page, '/' | '/standings' | '/courts' | '/fighter' | '/gear' | '/case'> = { home: '/', standings: '/standings', courts: '/courts', fighter: '/fighter', gear: '/gear', case: '/case' };
const INK_LAST = 'lol.ink.last';

/** A written piece (one stacked letter, or a word written across) waiting on, or done with, the recognizer. */
type Entry = { space: true } | { space?: false; cands: string[] | null; strokes: Stroke[] };


/**
 * Write anything: one finger, letters stacked in one spot or written across, no form. The page (web/ink.js) draws and
 * classifies strokes; this side recognizes each character, decodes the line, and draws a card back.
 */
export default function Ink() {
  const params = useLocalSearchParams<{ demo?: string; say?: string }>();
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
  const you = roster.find((f) => f.isYou) ?? roster[0];

  /** A command if it reads as one ("change fighter to servebot"), else a match or gear entry. */
  const understand = (t: string): Card => {
    const last = [...matches].sort((a, b) => b.playedAt - a.playedAt)[0];
    const lastMatch = last ? { id: last.id, label: `${winnerOf(last) === last.p1 ? 'W' : 'L'} vs ${roster.find((f) => f.id === last.p2)?.name ?? '?'}  ${scoreLine(last.sets)}` } : null;
    return parseCommand(t, { roster, venues, lastMatch }, answers.current) ?? parse(t, roster, answers.current);
  };

  const text = () => decode(entries.current.flatMap((e): Slot[] => (e.space ? [{ space: true }] : e.cands ? [{ cands: e.cands }] : [])), names);
  const pushLine = () => {
    const pending = entries.current.filter((e) => !e.space && e.cands === null).length;
    run(`window.setLine(${JSON.stringify(text())}, ${pending})`);
  };

  // The AI reader's answer for a line the offline reader did not understand (see src/lib/ink-claude.ts).
  const ai = useRef<{ for: string; line: string | null; extra: { playedAt?: number; courtId?: string }; note: string } | null>(null);
  const asking = useRef<string | null>(null);
  const aiContext = () => {
    const last = [...matches].sort((a, b) => b.playedAt - a.playedAt)[0];
    return { roster, venues, lastMatch: last ? `${winnerOf(last) === last.p1 ? 'W' : 'L'} vs ${roster.find((f) => f.id === last.p2)?.name ?? '?'} ${scoreLine(last.sets)}` : null };
  };
  const askAi = (t: string) => {
    asking.current = t;
    const ctx = aiContext();
    askAiReader(t, ctx)
      .then((a) => { const m = actionToLine(a, ctx); ai.current = { for: t, line: m?.line ?? null, extra: m ?? {}, note: a.note }; })
      .catch((e: Error) => { ai.current = { for: t, line: null, extra: {}, note: e.message === 'CAPPED' ? 'out of AI reads for today' : "couldn't reach the reader" }; })
      .finally(() => {
        asking.current = null;
        // Still the same line, and the card is still up: show the answer.
        if (card.current && (lineText.current ?? text()) === t) showCard();
      });
  };

  const showCard = () => {
    const t = lineText.current ?? text();
    let c: Card;
    if (ai.current?.for === t) {
      c = ai.current.line ? patchCard(understand(ai.current.line), ai.current.extra, venues) : unknownCard(t, ai.current.note);
    } else {
      c = understand(t);
      // Not a score, gear or a fixed command: ask the AI reader, and say so on the card while it thinks.
      if (c.draft.kind === 'none' && AI_READER_READY && t.trim().length >= 3 && !offline.current) {
        if (asking.current !== t) askAi(t);
        c = { ...c, lines: [`"${t}"`, 'reading it...'], canSave: false };
      }
    }
    if (offline.current && c.draft.kind === 'none') c.lines = ['no signal', "can't read ink yet", 'your writing is kept'];
    card.current = c;
    run(`window.showCard(${JSON.stringify({ lines: c.lines, questions: c.questions, warn: c.warn, canSave: c.canSave })})`);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // The whole-line reading, when there is one; it replaces the letter-by-letter guess.
  const lineText = useRef<string | null>(null);
  const read = async () => {
    if (!entries.current.some((e) => !e.space)) return;
    await Promise.all(inflight.current);
    lineText.current = null;
    const line = layoutLine(entries.current);
    if (line) {
      try {
        const cands = (await recognizeChar(line.strokes, line.w, line.h)).map((c) => c.trim()).filter(Boolean);
        // Trust the recognizer's ranking. A lower reading only wins when it has the same letters and digits as the top one
        // and differs in spacing or punctuation ("6-46-2" vs "6-4 6-2"); it never gets to add or drop a character.
        const bare = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '');
        const top = cands[0] ?? null;
        const fits = top ? cands.slice(0, 8).find((c) => bare(c) === bare(top) && understand(c).draft.kind !== 'none') : undefined;
        lineText.current = fits ?? top;
        offline.current = false;
      } catch {
        offline.current = true;
      }
    }
    if (lineText.current) run(`window.setLine(${JSON.stringify(lineText.current)}, 0)`);
    // What the recognizer returned for each piece, kept so a bad read can be looked at afterwards.
    AsyncStorage.setItem(INK_LAST, JSON.stringify({ at: Date.now(), text: text(), line: lineText.current, entries: entries.current.map((e) => (e.space ? e : { cands: e.cands })) })).catch(() => {});
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
      const court = courtById(d.courtId ?? picked) ?? courtById(last?.courtId);
      const id = addMatch({ p1: 'you', p2: d.opp, sets: d.sets, court: court?.name ?? last?.court ?? '', courtId: court?.id ?? last?.courtId, photoUri: null, playedAt: d.playedAt, minutes: d.minutes ?? undefined });
      run(`window.saved(${JSON.stringify(d.won ? 'WIN SAVED' : 'SAVED')})`);
      reset();
      setTimeout(() => router.replace(`/card/${id}`), 850);
    } else if (d.kind === 'command') {
      const cmd = d.cmd;
      if (cmd.kind === 'cast') saveFighter({ ...you, cast: cmd.cast });
      else if (cmd.kind === 'color') saveFighter({ ...you, color: cmd.color });
      else if (cmd.kind === 'name') saveFighter({ ...you, name: cmd.name });
      else if (cmd.kind === 'court') { if (cmd.home) saveFighter({ ...you, homeCourt: cmd.name }); else pickCourt(cmd.id); }
      else if (cmd.kind === 'undo') removeMatch(cmd.matchId);
      run(`window.saved(${JSON.stringify(cmd.kind === 'open' ? 'GOING' : cmd.kind === 'undo' ? 'DELETED' : 'DONE')})`);
      reset();
      if (cmd.kind === 'open') setTimeout(() => router.replace(PAGE_ROUTES[cmd.page]), 650);
    } else if (d.kind === 'gear') {
      addGear({ item: d.item, cost: d.cost, at: d.at });
      run(`window.saved(${JSON.stringify(`${d.item} LOGGED`)})`);
      reset();
    }
  };

  const onReady = () => {
    pushLine();
    AsyncStorage.getItem(PEN_KEY).then((v) => { if (v) run(`window.setPen(${Number(v)})`); }).catch(() => {});
    // Test hook: /ink?say=change fighter to servebot skips the handwriting and shows the card for that sentence.
    if (params.say) { lineText.current = params.say; entries.current = [{ space: true }]; run(`window.setLine(${JSON.stringify(params.say)}, 0)`); showCard(); }
    else if (params.demo === 'hold') run('window.demoHold()');
    else if (params.demo === 'leave') run('window.demoLeave()');
    else if (params.demo) run(`window.demoInk(${params.demo === '1' ? '' : JSON.stringify(params.demo)})`);
  };

  const onMessage = (m: SceneMsg) => {
    const msg = m as Msg;
    switch (msg.type) {
      case 'char': {
        lineText.current = null;
        const entry: Entry = { cands: null, strokes: msg.strokes };
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
        lineText.current = null;
        if (entries.current.length && !entries.current[entries.current.length - 1].space) entries.current.push({ space: true });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        pushLine();
        break;
      case 'erase':
        lineText.current = null;
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
      case 'dropped':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
