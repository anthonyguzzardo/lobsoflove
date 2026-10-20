import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { INK_HTML } from '@/generated/ink-html';
import venues from '@/data/venues.json';
import { courtById, pickCourt, usePickedCourt } from '@/lib/courts';
import { addGear } from '@/lib/gear';
import { actionToLine, AI_READER_READY, askAiReader, patchCard, unknownCard } from '@/lib/ink-claude';
import { parseCommand, type Page } from '@/lib/ink-commands';
import { decode, parse, type Answers, type Card, type Slot } from '@/lib/ink-parse';
import { layoutLine, pickTurn, recognizeChar, TURNS, turnPiece, type Stroke, type Turn } from '@/lib/ink-recognize';
import { addMatch, removeMatch, scoreLine, useMatches, winnerOf } from '@/lib/matches';
import { useHoldTurn } from '@/lib/hold-turn';
import { goBack } from '@/lib/nav';
import { CAST_IDS, COLORS, saveFighter, useRoster } from '@/lib/roster';
import { addPretender, createCrew, joinCrew, useCloud } from '@/lib/cloud';
import { sfx } from '@/lib/sfx';

type Msg =
  | { type: 'space' } | { type: 'erase' } | { type: 'read' } | { type: 'readNow' }
  | { type: 'save' } | { type: 'nope' } | { type: 'toss' } | { type: 'more' } | { type: 'exit' }
  | { type: 'char'; strokes: Stroke[]; w: number; h: number }
  | { type: 'choose'; field: 'opp' | 'pick'; value: string }
  | { type: 'pen'; size: number }
  | { type: 'dropped' };

const PEN_KEY = 'lol.ink.pen';
const FLIP_KEY = 'lol.ink.flip';
const PAGE_ROUTES: Record<Page, '/' | '/standings' | '/courts' | '/fighter' | '/gear' | '/case' | '/crew'> = { home: '/', standings: '/standings', courts: '/courts', fighter: '/fighter', gear: '/gear', case: '/case', crew: '/crew' };
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
  const cloud = useCloud();
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
    const crew = cloud.status === 'off' ? undefined : cloud.crew?.name ?? null;
    return parseCommand(t, { roster, venues, lastMatch, crew }, answers.current) ?? parse(t, roster, answers.current);
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

  // The turn the writing is at, once a read has found it (0 = upright). Live letters are read at this turn too.
  const turnLock = useRef<Turn | null>(null);
  // How the phone is held (gravity). Held up, it decides the turn right away, like any app rotating; flat on a
  // table it has no say and the writing decides. `flip` is learned if this device reports gravity the other way.
  const [flip, setFlip] = useState(false);
  useEffect(() => { AsyncStorage.getItem(FLIP_KEY).then((v) => setFlip(v === '1')).catch(() => {}); }, []);
  const held = useHoldTurn(flip);
  const heldRef = useRef<Turn | null>(null);
  useEffect(() => {
    heldRef.current = held;
    if (held !== null && held !== turnLock.current) { turnLock.current = held; run(`window.setTurn(${held})`); }
  }, [held, run]);
  /** A clean page goes back to how the phone is held (or upright), so an old angle never sticks. */
  const unlockTurn = () => { turnLock.current = heldRef.current; run(`window.setTurn(${heldRef.current ?? 0})`); };
  /** How much sense a reading makes: something loggable, with valid sets, in plain characters. Rotated ink rarely scores. */
  const readingScore = (t: string) => {
    const c = understand(t);
    const plain = t.length ? [...t.toLowerCase()].filter((ch) => /[a-z0-9 \-$@:,.']/.test(ch)).length / t.length : 0;
    return (c.draft.kind !== 'none' ? 4 : 0) + (c.draft.kind === 'match' && !c.warn ? 1.5 : 0) + (c.canSave ? 1 : 0) + plain * 2;
  };

  // The whole-line reading, when there is one; it replaces the letter-by-letter guess.
  const lineText = useRef<string | null>(null);
  const read = async () => {
    if (!entries.current.some((e) => !e.space)) return;
    await Promise.all(inflight.current);
    lineText.current = null;
    if (entries.current.some((e) => !e.space && e.strokes.length)) {
      try {
        // The phone may be sideways, upside down, or flat on a table with the writer anywhere around it. Read the line
        // at all four turns at once and keep the one that makes sense (src/lib/ink-recognize.ts pickTurn).
        const results = await Promise.all(TURNS.map(async (turn) => {
          const line = layoutLine(entries.current.map((e) => (e.space ? e : { strokes: turnPiece(e.strokes, turn) })));
          const cands = line ? (await recognizeChar(line.strokes, line.w, line.h)).map((c) => c.trim()).filter(Boolean) : [];
          return { turn, cands };
        }));
        const hold = heldRef.current;
        const pick = pickTurn(results, readingScore, hold ?? turnLock.current, hold !== null ? 1.5 : 0.6);
        if (pick) {
          // Lock the angle once a turn wins clearly; nobody turns the phone mid-sentence.
          // The writing clearly reads upside down from the sensor's answer: this device reports gravity the other way.
          if (hold !== null && pick.margin >= 2 && pick.turn === (hold + 180) % 360) {
            setFlip((f) => { AsyncStorage.setItem(FLIP_KEY, f ? '0' : '1').catch(() => {}); return !f; });
          }
          if (pick.margin >= 1 && pick.turn !== turnLock.current) { turnLock.current = pick.turn; run(`window.setTurn(${pick.turn})`); }
          // Trust the recognizer's ranking. A lower reading only wins when it has the same letters and digits as the top one
          // and differs in spacing or punctuation ("6-46-2" vs "6-4 6-2"); it never gets to add or drop a character.
          const cands = results.find((r) => r.turn === pick.turn)!.cands;
          const bare = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '');
          const fits = cands.slice(0, 8).find((c) => bare(c) === bare(pick.text) && understand(c).draft.kind !== 'none');
          lineText.current = fits ?? pick.text;
        }
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
    const reset = () => { entries.current = []; answers.current = {}; card.current = null; unlockTurn(); };
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
      if (cmd.kind === 'found' || cmd.kind === 'recruit' || cmd.kind === 'join') {
        // Crew changes go to the server; the crew page is where you see them land.
        const go = cmd.kind === 'found' ? createCrew(cmd.name)
          : cmd.kind === 'join' ? joinCrew(cmd.code)
          : addPretender(cmd.name, CAST_IDS[roster.length % CAST_IDS.length], COLORS[roster.length % COLORS.length]);
        run(`window.saved(${JSON.stringify(cmd.kind === 'found' ? 'STARTING IT' : cmd.kind === 'join' ? 'JOINING' : 'ADDING')})`);
        reset();
        go.then(() => router.replace('/crew'), (e: unknown) => run(`window.saved(${JSON.stringify(e instanceof Error ? e.message.toUpperCase() : 'DID NOT WORK')})`));
        return;
      }
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
    else if (params.demo === 'sideways') run('window.demoSideways()');
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
        const p = recognizeChar(turnPiece(msg.strokes, turnLock.current ?? 0), msg.w, msg.h, text())
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
        if (!entries.current.length) unlockTurn();
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
