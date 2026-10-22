import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { BackSwing } from '@/components/back-swing';
import { SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { MONO, P } from '@/constants/paper';
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
import { answerAsk, currentAsk } from '@/lib/ink-ask';
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


/** One line of the type side: what you typed, or what the app read it as. */
type Chat = { who: 'you' | 'app'; text: string; canSave?: boolean };

/**
 * The page opens on a split down the middle: TYPE on the left, WRITE on the right. Tap one to go in; each has a switch to the
 * other. TYPE is like texting the app ("beat dave 6-4 6-2", "add maya"): the reply comes back as a chat line, with SAVE IT
 * when it can be saved. WRITE is the finger canvas. Both go through the same reader and card.
 *
 * Write anything: one finger, letters stacked in one spot or written across, no form. The page (web/ink.js) draws and
 * classifies strokes; this side recognizes each character, decodes the line, and draws a card back.
 */
export default function Ink() {
  const params = useLocalSearchParams<{ demo?: string; say?: string; for?: string }>();
  // Opened from the crew's chalk spot: the page asks for one friend's name, and whatever is written is read as adding them.
  const friend = params.for === 'friend';
  // Opened by another page for one answer (src/lib/ink-ask.ts): whatever is typed or written is that answer, as is.
  const [ask] = useState(() => (params.for === 'ask' ? currentAsk() : null));
  const askValue = (t: string) => { const v = t.trim().slice(0, ask?.max ?? 140); return ask?.upper ? v.toUpperCase() : v; };
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
  const insets = useSafeAreaInsets();
  const [chat, setChat] = useState<Chat[]>([]);
  const [typed, setTyped] = useState('');
  const chatScroll = useRef<ScrollView>(null);
  /** The app's answer to the current line goes in the chat: replaced while it is still the same line, added for a new one. */
  const reply = (line: string, c: Card) => setChat((cs) => {
    const text = c.lines.filter(Boolean).join('  ·  ');
    const lastYou = [...cs].reverse().find((m) => m.who === 'you');
    const last = cs[cs.length - 1];
    const next: Chat = { who: 'app', text, canSave: c.canSave };
    if (last?.who === 'app' && lastYou?.text === line) return [...cs.slice(0, -1), next];
    return lastYou?.text === line ? [...cs, next] : [...cs, { who: 'you', text: line }, next];
  });
  const you = roster.find((f) => f.isYou) ?? roster[0];

  /** A command if it reads as one ("change fighter to servebot"), else a match or gear entry. */
  const understand = (t: string): Card => {
    if (ask) return { text: t, lines: [ask.label, askValue(t) || '...'], questions: [], warn: null, canSave: !!askValue(t), draft: { kind: 'none' } };
    const last = [...matches].sort((a, b) => b.playedAt - a.playedAt)[0];
    const lastMatch = last ? { id: last.id, label: `${winnerOf(last) === last.p1 ? 'W' : 'L'} vs ${roster.find((f) => f.id === last.p2)?.name ?? '?'}  ${scoreLine(last.sets)}` } : null;
    const crew = cloud.status === 'off' ? undefined : cloud.crew?.name ?? null;
    const said = friend && t.trim() && !/^\s*(add|recruit|invite|sign)\b/i.test(t) ? `add ${t.trim()}` : t;
    return parseCommand(said, { roster, venues, lastMatch, crew }, answers.current) ?? parse(said, roster, answers.current);
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
      if (c.draft.kind === 'none' && !friend && !ask && AI_READER_READY && t.trim().length >= 3 && !offline.current) {
        if (asking.current !== t) askAi(t);
        c = { ...c, lines: [`"${t}"`, 'reading it...'], canSave: false };
      }
    }
    if (offline.current && c.draft.kind === 'none') c.lines = ['no signal', "can't read ink yet", 'your writing is kept'];
    card.current = c;
    reply(t, c);
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
    if (ask) { answerAsk(c.text); run('window.saved("SAVED")'); reset(); setTimeout(goBack, 450); return; }
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
    if (ask) run(`window.setHints(${JSON.stringify({ title: ask.label, examples: ask.examples?.length ? ask.examples : ['...'] })})`);
    if (friend) run(`window.setHints(${JSON.stringify({ title: "WRITE YOUR FRIEND'S NAME", examples: ['maya', 'jo', 'big dave', 'sam'] })})`);
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

  /** A typed line: read it exactly as written, no handwriting in between. */
  const send = () => {
    const t = typed.trim();
    if (!t) return;
    setTyped('');
    // Answering a page's question: sending it is the answer. No card, no extra tap.
    if (ask) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); answerAsk(t); goBack(); return; }
    setChat((cs) => [...cs, { who: 'you', text: t }]);
    entries.current = [{ space: true }];
    answers.current = {};
    lineText.current = t;
    run(`window.setLine(${JSON.stringify(t)}, 0)`);
    showCard();
  };
  const hint = ask ? (ask.examples?.[0] ?? '') : friend ? 'type their name: maya' : 'type it: beat dave 6-4 6-2';
  const label = ask ? ask.label : friend ? 'ADD A FRIEND' : null;

  // Where you are: the split chooser first, then typing or writing (each can switch to the other).
  const [mode, setMode] = useState<'pick' | 'type' | 'write'>(params.say || params.demo ? 'write' : 'pick');
  const pickMode = (m: 'type' | 'write') => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('go', 0.6); setMode(m); };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      {/* The canvas stays loaded underneath so the reader and its card work in both modes; it is only seen in WRITE. */}
      <View style={[StyleSheet.absoluteFill, mode !== 'write' && styles.hidden]} pointerEvents={mode === 'write' ? 'auto' : 'none'}>
        <SceneView scene={scene} html={INK_HTML} name="ink" onReady={onReady} onMessage={onMessage} />
      </View>
      {mode === 'write' ? (
        <View style={[styles.switchRow, { top: insets.top + 6 }]} pointerEvents="box-none">
          <Pressable onPress={() => pickMode('type')} hitSlop={10} style={styles.switch}><KeysIcon size={18} /><Text style={styles.switchText}>TYPE INSTEAD</Text></Pressable>
        </View>
      ) : null}
      {mode === 'pick' ? (
        <View style={styles.pick}>
          {/* Two halves, edge to edge: nothing above, nothing below. */}
          <View style={styles.halves}>
            <Pressable style={({ pressed }) => [styles.half, styles.halfType, pressed && styles.halfPressed]} onPress={() => pickMode('type')}>
              <KeysIcon size={96} light />
              <Text style={[styles.halfWord, styles.light]}>TYPE</Text>
              <Text style={[styles.halfSub, styles.light]}>{ask ? 'on the keyboard' : friend ? 'their name, on the keyboard' : 'like texting the app'}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.half, pressed && styles.halfPressed]} onPress={() => pickMode('write')}>
              <PenIcon size={96} />
              <Text style={styles.halfWord}>WRITE</Text>
              <Text style={styles.halfSub}>{friend ? 'their name, with your finger' : 'with your finger'}</Text>
            </Pressable>
          </View>
          <BackSwing floating />
          {/* The question, stuck on the seam like a sticker. */}
          <View style={[styles.stickerRow, { top: insets.top + 74 }]} pointerEvents="none">
            <View style={styles.sticker}><Text style={styles.stickerText}>{label ?? 'SAY IT'}</Text></View>
          </View>
        </View>
      ) : null}
      {mode === 'type' ? (
        <View style={[styles.chat, { paddingTop: insets.top + 8 }]}>
          <View style={styles.head}>
            <Pressable onPress={() => setMode('pick')} hitSlop={12}><Text style={styles.back}>{'<'} BACK</Text></Pressable>
            <Text style={styles.title}>{label ?? 'TYPE IT'}</Text>
            <Pressable onPress={() => pickMode('write')} hitSlop={10} style={styles.switch}><PenIcon size={18} /><Text style={styles.switchText}>WRITE INSTEAD</Text></Pressable>
          </View>
          <ScrollView ref={chatScroll} style={styles.log} contentContainerStyle={styles.logIn} onContentSizeChange={() => chatScroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
            {chat.length ? chat.map((m, k) => (
              <View key={k} style={[styles.bubble, m.who === 'you' ? styles.you : styles.app]}>
                <Text style={[styles.btext, m.who === 'you' && styles.youText]}>{m.text}</Text>
                {m.who === 'app' && m.canSave && k === chat.length - 1 ? (
                  <Pressable onPress={save} hitSlop={8}><Text style={styles.saveIt}>SAVE IT</Text></Pressable>
                ) : null}
              </View>
            )) : <Text style={styles.empty}>{ask ? ask.label.toLowerCase() : friend ? 'type your friend\'s name' : 'type it like a text: a score, a time, a restring'}</Text>}
          </ScrollView>
          <View style={[styles.bar, { paddingBottom: Math.max(10, insets.bottom) }]}>
            <TextInput style={styles.field} value={typed} onChangeText={setTyped} onSubmitEditing={send} placeholder={hint} placeholderTextColor="rgba(22,24,29,0.35)" returnKeyType="send" autoCapitalize={ask?.upper ? 'characters' : ask ? 'sentences' : 'none'} autoCorrect={!friend && !ask?.upper} maxLength={ask?.max} autoFocus />
            <Pressable onPress={send} hitSlop={8} style={[styles.send, !typed.trim() && { opacity: 0.35 }]}><Text style={styles.sendText}>SEND</Text></Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** A keyboard, drawn: a rounded slab with three rows of keys and a space bar. */
function KeysIcon({ size, light }: { size: number; light?: boolean }) {
  const c = light ? '#fffdf4' : P.ink;
  return (
    <Svg width={size} height={size * 0.7} viewBox="0 0 60 42">
      <Rect x={2} y={2} width={56} height={38} rx={7} stroke={c} strokeWidth={3.5} fill="none" />
      {[0, 1, 2].map((row) => Array.from({ length: 5 - row }, (_, k) => (
        <Rect key={`${row}-${k}`} x={9 + row * 4 + k * 9.5} y={8 + row * 7.5} width={5} height={4.5} rx={1.2} fill={c} />
      )))}
      <Rect x={17} y={31} width={26} height={4} rx={2} fill={c} />
    </Svg>
  );
}

/** A pen nib writing a stroke. */
function PenIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Path d="M40 6 L54 20 L24 50 L8 54 L12 38 Z" stroke={P.ink} strokeWidth={3.5} strokeLinejoin="round" fill="#f2c230" />
      <Path d="M12 38 L24 50" stroke={P.ink} strokeWidth={3.5} />
      <Path d="M34 12 L48 26" stroke={P.ink} strokeWidth={3.5} />
      <Path d="M6 58 Q 20 50 30 56 T 56 54" stroke={P.red} strokeWidth={3.5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
  hidden: { opacity: 0 },
  pick: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#efece5' },
  halves: { flex: 1, flexDirection: 'row' },
  stickerRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  sticker: {
    backgroundColor: P.red, borderWidth: 3, borderColor: P.ink, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, transform: [{ rotate: '-4deg' }],
    shadowColor: P.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 5 }, elevation: 6, maxWidth: '86%',
  },
  stickerText: { fontWeight: '900', fontStyle: 'italic', fontSize: 26, letterSpacing: 0.5, color: '#fffdf4', textAlign: 'center' },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 10 },
  halfType: { backgroundColor: P.ink },
  halfPressed: { opacity: 0.8 },
  halfWord: { fontFamily: MONO, fontWeight: '800', fontSize: 34, letterSpacing: 3, color: P.ink },
  halfSub: { fontFamily: MONO, fontWeight: '700', fontSize: 12, color: P.ink, opacity: 0.6, textAlign: 'center' },
  light: { color: '#fffdf4' },
  switchRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: P.ink, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fffdf4' },
  switchText: { fontFamily: MONO, fontWeight: '800', fontSize: 10, letterSpacing: 1.2, color: P.ink },
  chat: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 16, backgroundColor: '#efece5' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  back: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.2, color: P.ink },
  title: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.4, color: P.red },
  log: { flex: 1 },
  logIn: { paddingVertical: 8, gap: 8, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { fontFamily: MONO, fontWeight: '700', fontSize: 13, color: P.ink, opacity: 0.45, textAlign: 'center', marginBottom: 12 },
  bubble: { maxWidth: '86%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 2, borderColor: P.ink },
  you: { alignSelf: 'flex-end', backgroundColor: P.ink },
  app: { alignSelf: 'flex-start', backgroundColor: '#fffdf4' },
  btext: { fontFamily: MONO, fontWeight: '700', fontSize: 14, color: P.ink },
  youText: { color: '#fffdf4' },
  saveIt: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.4, color: P.red, marginTop: 6, textDecorationLine: 'underline' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6 },
  field: { flex: 1, fontFamily: MONO, fontWeight: '700', fontSize: 16, color: P.ink, borderWidth: 2, borderColor: P.ink, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fffdf4' },
  send: { backgroundColor: P.red, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 2, borderColor: P.ink },
  sendText: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.2, color: '#fffdf4' },
});
