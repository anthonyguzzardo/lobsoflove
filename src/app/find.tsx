import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, type LayoutChangeEvent, Platform, Pressable, Share, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';

import { MONO, P } from '@/constants/paper';
import { createCrew, crewNow, findPlayers, type Found, inviteLink, invitePlayer, refresh } from '@/lib/cloud';
import { useRoster } from '@/lib/roster';
import { CRESTS, type Crest } from '@/lib/crests';
import { faceSvg } from '@/lib/faces';
import { BackSwing } from '@/components/back-swing';
import { BrushStroke } from '@/components/brush-stroke';
import { type Brush, brushCycle } from '@/lib/brush';
import { askInk } from '@/lib/ink-ask';
import { goBack } from '@/lib/nav';
import { sfx } from '@/lib/sfx';

type Pt = { x: number; y: number };
type Cell = { p: Found; x: number; y: number; w: number; h: number };

const NAME_H = 24;
const HOLD_MS = 260;

/** Three across on a phone (five on a wide screen), with room around each face. The page scrolls for the rest. */
function layout(people: Found[], W: number): { cells: Cell[]; link: Omit<Cell, 'p'> | null; height: number } {
  if (!W) return { cells: [], link: null, height: 0 };
  const cols = W >= 600 ? 5 : 3;
  const w = W / cols;
  const h = w * 0.72 + NAME_H + 18;
  const at = (i: number) => ({ x: (i % cols) * w, y: Math.floor(i / cols) * h, w, h });
  // The last slot is the link, for anyone not on the app yet.
  return { cells: people.map((p, i) => ({ p, ...at(i) })), link: at(people.length), height: Math.ceil((people.length + 1) / cols) * h };
}

const inside = (pt: Pt, poly: Pt[]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

/**
 * Find players: everyone on the app is a face on the page. Circle the ones you want, or scribble over a face to color it in, or
 * tap it. Typing a name narrows the page. INVITE sends them all at once: bots (DBZ, tennis legends, JJK) join on the spot, real
 * players get a push and a JOIN on their crew page. Anyone not on the app gets the link (bottom row).
 */
export default function Find() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);
  const [headH, setHeadH] = useState(110);
  const scrollY = useRef(0);
  // Where the page was scrolled when the brush came out (it holds still while drawing).
  const [offY, setOffY] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [stroke, setStroke] = useState<Pt[]>([]);
  const asked = useRef(0);
  const roster = useRoster();
  const me = roster.find((f) => f.isYou);
  const suggest = (me?.name && me.name !== 'YOU' ? `${me.name}'S CREW` : 'THE CREW').toUpperCase().slice(0, 40);
  // The same magic pen as everywhere else: each stroke takes the next brush in the cycle.
  const [nextBrush] = useState(() => brushCycle());
  const [brush, setBrush] = useState<Brush>(() => nextBrush());

  // Everyone on open; narrowed as you type, a beat after the last key.
  useEffect(() => {
    const n = ++asked.current;
    const timer = setTimeout(() => {
      findPlayers(q.trim()).then(
        (r) => { if (n === asked.current) { setFound(r); setError(null); } },
        (e: Error) => { if (n === asked.current) setError(e.message); },
      );
    }, q ? 220 : 0);
    return () => clearTimeout(timer);
  }, [q]);

  const { cells, link, height } = useMemo(() => layout(found ?? [], width), [found, width]);
  const open = (p: Found) => p.crew === 'free' && !p.invited;

  // Live copies for the gesture handlers, which are made once.
  const live = useRef({ cells, picked, link });
  useEffect(() => { live.current = { cells, picked, link }; }, [cells, picked, link]);
  const pts = useRef<Pt[]>([]);

  /** A stroke picks: a loop takes everyone inside it; a scribble colors in every face it went over. All already picked: unpick. */
  const finish = (line: Pt[]) => {
    const { cells: cs, picked: was } = live.current;
    const xs = line.map((p) => p.x), ys = line.map((p) => p.y);
    const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const a = line[0], b = line[line.length - 1];
    const loop = line.length > 10 && Math.hypot(a.x - b.x, a.y - b.y) < Math.max(50, diag * 0.35);
    const hits = cs.filter((c) => open(c.p)).filter((c) => {
      if (loop) return inside({ x: c.x + c.w / 2, y: c.y + c.h / 2 - NAME_H / 2 }, line);
      const m = c.w * 0.12;
      return line.filter((p) => p.x > c.x + m && p.x < c.x + c.w - m && p.y > c.y + m && p.y < c.y + c.h - NAME_H).length >= 2;
    }).map((c) => c.p.id);
    if (!hits.length) return;
    const allIn = hits.every((id) => was.has(id));
    const next = new Set(was);
    hits.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
    setPicked(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sfx(allIn ? 'swish' : 'pock', 0.8);
  };

  const tap = (pt: Pt) => {
    const l = live.current.link;
    if (l && pt.x >= l.x && pt.x < l.x + l.w && pt.y >= l.y && pt.y < l.y + l.h) { shareLink(); return; }
    const c = live.current.cells.find((k) => pt.x >= k.x && pt.x < k.x + k.w && pt.y >= k.y && pt.y < k.y + k.h);
    if (!c || !open(c.p)) return;
    const next = new Set(live.current.picked);
    if (next.has(c.p.id)) next.delete(c.p.id); else next.add(c.p.id);
    setPicked(next);
    void Haptics.selectionAsync();
    sfx('pock', 0.6);
  };

  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPt = useRef<Pt>({ x: 0, y: 0 });

  // One finger, three meanings: a quick swipe scrolls, a quick touch picks, press and hold brings out the brush (circle or
  // scribble). The brush is a gesture-handler pan that only wakes after the hold; once it wakes it owns the finger and the
  // scroll view is cancelled on the spot, so the page holds still until you lift.
  const beginDraw = (p: Pt) => {
    if (clearTimer.current) { clearTimeout(clearTimer.current); clearTimer.current = null; }
    startPt.current = p;
    setOffY(scrollY.current);
    setDrawing(true);
    setBrush(nextBrush());
    pts.current = [p];
    setStroke(pts.current);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sfx('swish', 0.4);
  };
  const moveDraw = (p: Pt) => {
    const last = pts.current[pts.current.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
    pts.current = [...pts.current, p];
    setStroke(pts.current);
  };
  const endDraw = (done: boolean) => {
    const line = pts.current;
    pts.current = [];
    setDrawing(false);
    if (done && line.length) {
      const s = startPt.current;
      const moved = line.reduce((m, p) => Math.max(m, Math.hypot(p.x - s.x, p.y - s.y)), 0);
      if (moved < 10) tap(s); else finish(line);
    }
    // The ink always goes: a short beat to show what it caught, then wiped. Nothing else cancels this.
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => { clearTimer.current = null; setStroke([]); }, done ? 380 : 0);
  };

  // These callbacks run on touch, not during render; the refs rule can't tell builder callbacks apart from render code.
  /* eslint-disable react-hooks/refs */
  const lift = (ok: boolean) => { if (pts.current.length) endDraw(ok); };
  const draw = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(HOLD_MS)
    .onStart((e) => beginDraw({ x: e.x, y: e.y }))
    .onUpdate((e) => moveDraw({ x: e.x, y: e.y }))
    .onFinalize((_e, ok) => lift(ok));
  const pick = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(HOLD_MS)
    .onEnd((e, ok) => { if (ok) tap({ x: e.x, y: e.y }); });
  const gesture = Gesture.Exclusive(draw, pick);
  /* eslint-enable react-hooks/refs */

  const type = (v: string) => setQ(v);

  const send = async () => {
    const ids = [...picked];
    if (!ids.length || busy) return;
    if (!crewNow()) { makeCrew(() => send()); return; }
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => invitePlayer(id)));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sfx('win', 0.8);
      await refresh();
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setBusy(false);
    }
  };

  /** Drop every pick at once. */
  const clearAll = () => {
    if (!picked.size) return;
    setPicked(new Set());
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sfx('swish', 0.7);
  };

  /**
   * No crew yet (a brand new one): name it, and only then make it. Backing out of the name makes nothing and keeps your picks.
   */
  const makeCrew = (then: () => void) => {
    askInk({ label: 'NAME YOUR CREW', max: 40, upper: true, examples: [suggest] }, (t) => {
      createCrew(t || suggest).then(then, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    });
  };

  const shareLink = () => {
    if (!crewNow()) { makeCrew(shareLink); return; }
    const url = inviteLink();
    const crew = crewNow();
    if (url && crew) void Share.share({ message: `Join ${crew.name} on LobsOfLove. Tap to get in: ${url}` });
  };

  const n = picked.size;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      {/* Faces edge to edge, scrolling under the back button and search on top, and the buttons at the bottom. */}
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ paddingTop: headH + 6, paddingBottom: (n ? 96 : 24) + insets.bottom }}
        scrollEnabled={!drawing}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
      >
        <GestureDetector gesture={gesture}>
        <View style={{ height }} collapsable={false}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {cells.map((c) => {
              const on = picked.has(c.p.id);
              const tag = c.p.crew === 'yours' ? 'IN CREW' : c.p.crew === 'taken' ? 'IN A CREW' : c.p.invited ? 'INVITED' : null;
              const face = c.w * 0.62;
              const ring = face + 14;
              // Picked: lifted off the page like a sticker (ring, hard shadow, tilt) and the name flips to a black pill. None
              // of that needs color to read. Once anyone is picked, everyone else steps back.
              const back = !on && !tag && picked.size > 0;
              return (
                <View key={c.p.id} style={[styles.cell, { left: c.x, top: c.y, width: c.w, height: c.h }, tag && styles.cellDim, back && styles.cellBack]}>
                  <View style={[styles.faceWrap, { width: ring, height: ring, borderRadius: ring / 2 }, on && styles.faceOn]}>
                    <SvgXml xml={faceSvg(c.p.face, c.p.color)} width={face} height={face} />
                    {on && CRESTS[c.p.face] ? <CrestStamp crest={CRESTS[c.p.face]} /> : null}
                  </View>
                  <Text numberOfLines={1} style={[styles.name, on && styles.nameOn]}>{tag ?? c.p.name}</Text>
                </View>
              );
            })}
            {link ? (
              <View style={[styles.cell, { left: link.x, top: link.y, width: link.w, height: link.h }]}>
                <View style={[styles.linkTile, { width: link.w * 0.62 + 14, height: link.w * 0.62 + 14, borderRadius: (link.w * 0.62 + 14) / 2 }]}>
                  <Text style={styles.linkPlus}>+</Text>
                </View>
                <Text style={styles.name}>SEND THE LINK</Text>
              </View>
            ) : null}
          </View>
        </View>
        </GestureDetector>
      </ScrollView>

      {/* The brush lives in one screen-sized layer. A canvas as tall as the whole scrolling list is bigger than the GPU allows
          and crashes the app; the page holds still while drawing, so content points just shift by the scroll and top padding. */}
      {stroke.length > 1 ? (
        <BrushStroke style={StyleSheet.absoluteFill} brush={brush} points={stroke.map((p) => [p.x, p.y + headH + 6 - offY] as const)} />
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + 4 }]} onLayout={(e: LayoutChangeEvent) => setHeadH(e.nativeEvent.layout.height)}>
        <View style={[styles.searchWrap, error && styles.searchError]}>
          <Svg width={18} height={18} viewBox="0 0 20 20">
            <Circle cx={8} cy={8} r={6} stroke={P.ink} strokeWidth={2.5} fill="none" />
            <Path d="M12.5 12.5 L18 18" stroke={P.ink} strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
          <TextInput
            style={styles.search}
            value={q}
            onChangeText={type}
            placeholder={error ?? (found?.length === 0 ? 'nobody by that name' : 'find players')}
            placeholderTextColor={error ? P.red : P.faint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {q ? <Pressable onPress={() => type('')} hitSlop={10}><Text style={styles.clear}>CLEAR</Text></Pressable> : null}
        </View>
      </View>
      <BackSwing floating />

      {n ? (
        <View style={[styles.foot, { paddingBottom: Math.max(12, insets.bottom) }]} pointerEvents="box-none">
          <Pressable onPress={clearAll} hitSlop={6} style={({ pressed }) => [styles.clearAll, pressed && styles.goPressed]}>
            <Text style={styles.clearAllText}>CLEAR</Text>
          </Pressable>
          <Pressable onPress={send} disabled={busy} style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
            <Text style={styles.goText}>{busy ? 'SENDING...' : `INVITE ${n} ${n === 1 ? 'PLAYER' : 'PLAYERS'}`}</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/**
 * The crest a picked face stamps on its corner, in the character's own tongue: a tennis ball with the home cheer for players,
 * the gi kanji in a white patch for Dragon Ball, a cursed seal for Jujutsu Kaisen.
 */
function CrestStamp({ crest }: { crest: Crest }) {
  if (crest.kind === 'tennis') {
    return (
      <View style={styles.cheer}>
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Circle cx={7} cy={7} r={6} fill={P.ball} stroke={P.ink} strokeWidth={1.6} />
          <Path d="M2.4 3.6 Q6 7 2.4 10.4 M11.6 3.6 Q8 7 11.6 10.4" stroke="#fffdf4" strokeWidth={1.3} fill="none" />
        </Svg>
        <Text style={styles.cheerText} numberOfLines={1}>{crest.text}</Text>
      </View>
    );
  }
  const dbz = crest.kind === 'dbz';
  return (
    <View style={[styles.seal, dbz ? styles.sealDbz : styles.sealJjk]}>
      <Text style={[styles.sealText, dbz ? styles.sealTextDbz : styles.sealTextJjk, crest.text.length > 1 && styles.sealTextSmall]}>{crest.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper },
  // A paper strip behind the back button and search, so faces scroll under it cleanly. The back button is the app's own
  // (BackSwing, 112 wide, floating at the same height); the search fills the rest of the row.
  top: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: P.paper, paddingLeft: 134, paddingRight: 12, paddingBottom: 10 },
  searchError: { borderColor: P.red },
  linkTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderStyle: 'dashed', borderColor: P.ink },
  linkPlus: { fontWeight: '900', fontSize: 34, color: P.ink, marginTop: -4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 14,
    borderWidth: 2.5, borderColor: P.ink, borderRadius: 25, backgroundColor: P.card,
  },
  search: { flex: 1, fontFamily: MONO, fontWeight: '700', fontSize: 16, color: P.ink, paddingVertical: 9 },
  clear: { fontFamily: MONO, fontWeight: '800', fontSize: 10, letterSpacing: 1.2, color: P.dim },
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10 },
  cellDim: { opacity: 0.4 },
  cellBack: { opacity: 0.45 },
  faceWrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'transparent' },
  faceOn: {
    borderColor: P.red, backgroundColor: P.card, transform: [{ scale: 1.12 }, { rotate: '-5deg' }],
    shadowColor: P.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 5 }, elevation: 6,
  },
  name: { fontFamily: MONO, fontWeight: '800', fontSize: 11, letterSpacing: 0.8, color: P.ink, marginTop: 6, paddingHorizontal: 6, paddingVertical: 2, maxWidth: '100%' },
  nameOn: { backgroundColor: P.ink, color: P.card, borderRadius: 5, overflow: 'hidden', marginTop: 9 },
  clearAll: {
    paddingHorizontal: 16, justifyContent: 'center', borderRadius: 30, borderWidth: 2.5, borderColor: P.ink, backgroundColor: P.card,
    shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 },
  },
  clearAllText: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.4, color: P.ink },
  cheer: {
    position: 'absolute', top: -10, right: -18, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 7, paddingVertical: 3,
    backgroundColor: P.card, borderWidth: 2, borderColor: P.ink, borderRadius: 12, transform: [{ rotate: '9deg' }],
  },
  cheerText: { fontWeight: '900', fontStyle: 'italic', fontSize: 11, color: P.ink },
  seal: {
    position: 'absolute', top: -8, right: -8, width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: P.ink,
    alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }],
  },
  sealDbz: { backgroundColor: '#fffdf4' },
  sealJjk: { backgroundColor: '#2a1740' },
  sealText: { fontWeight: '900', fontSize: 16, lineHeight: 19 },
  sealTextDbz: { color: P.ink },
  sealTextJjk: { color: '#e9d8ff' },
  sealTextSmall: { fontSize: 10, lineHeight: 12 },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  go: {
    flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 30, backgroundColor: P.red, borderWidth: 2.5, borderColor: P.ink,
    shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 },
  },
  goPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } },
  goText: { fontFamily: MONO, fontWeight: '800', fontSize: 14, letterSpacing: 1.6, color: P.card },
});
