import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent, KeyboardAvoidingView, type LayoutChangeEvent, Platform, Pressable, ScrollView, Share, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';

import { MONO, P } from '@/constants/paper';
import { crewNow, findPlayers, type Found, inviteLink, invitePlayer, refresh, renameCrew } from '@/lib/cloud';
import { faceSvg } from '@/lib/faces';
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
function layout(people: Found[], W: number): { cells: Cell[]; height: number } {
  if (!W) return { cells: [], height: 0 };
  const cols = W >= 600 ? 5 : 3;
  const w = W / cols;
  const h = w * 0.72 + NAME_H + 18;
  return { cells: people.map((p, i) => ({ p, x: (i % cols) * w, y: Math.floor(i / cols) * h, w, h })), height: Math.ceil(people.length / cols) * h + 12 };
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
  const [drawing, setDrawing] = useState(false);
  const [stroke, setStroke] = useState<Pt[]>([]);
  const asked = useRef(0);
  // A brand new crew (?first=1) gets its name last: once you have picked who is in it, naming it is easy.
  const first = useLocalSearchParams<{ first?: string }>().first === '1';
  const named = useRef(false);
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

  const { cells, height } = useMemo(() => layout(found ?? [], width), [found, width]);
  const open = (p: Found) => p.crew === 'free' && !p.invited;

  // Live copies for the gesture handlers, which are made once.
  const live = useRef({ cells, picked });
  useEffect(() => { live.current = { cells, picked }; }, [cells, picked]);
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
    const c = live.current.cells.find((k) => pt.x >= k.x && pt.x < k.x + k.w && pt.y >= k.y && pt.y < k.y + k.h);
    if (!c || !open(c.p)) return;
    const next = new Set(live.current.picked);
    if (next.has(c.p.id)) next.delete(c.p.id); else next.add(c.p.id);
    setPicked(next);
    void Haptics.selectionAsync();
    sfx('pock', 0.6);
  };

  const at = (e: GestureResponderEvent): Pt => ({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef({ start: { x: 0, y: 0 } as Pt, moved: false, drawing: false, scrolled: false });

  // One finger, three meanings: a quick swipe scrolls, a quick touch picks, press and hold brings out the brush (circle or
  // scribble) and holds the page still until you lift.
  const touch = {
    onTouchStart: (e: GestureResponderEvent) => {
      const t = touchRef.current;
      t.start = at(e); t.moved = false; t.drawing = false; t.scrolled = false;
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => {
        if (t.moved || t.scrolled) return;
        t.drawing = true;
        setDrawing(true);
        setBrush(nextBrush());
        pts.current = [t.start];
        setStroke(pts.current);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        sfx('swish', 0.4);
      }, HOLD_MS);
    },
    onTouchMove: (e: GestureResponderEvent) => {
      const t = touchRef.current;
      const p = at(e);
      if (!t.drawing) {
        if (Math.hypot(p.x - t.start.x, p.y - t.start.y) > 8) t.moved = true;
        return;
      }
      const last = pts.current[pts.current.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
      pts.current = [...pts.current, p];
      setStroke(pts.current);
    },
    onTouchEnd: () => {
      const t = touchRef.current;
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (t.drawing) {
        const line = pts.current;
        const moved = line.reduce((m, p) => Math.max(m, Math.hypot(p.x - t.start.x, p.y - t.start.y)), 0);
        if (moved < 10) tap(t.start); else finish(line);
        t.drawing = false;
        setDrawing(false);
        clearTimer.current = setTimeout(() => setStroke([]), 380);
      } else if (!t.moved && !t.scrolled) tap(t.start);
    },
    onTouchCancel: () => {
      const t = touchRef.current;
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (t.drawing) { t.drawing = false; setDrawing(false); setStroke([]); }
    },
  };

  const type = (v: string) => setQ(v);

  const send = async () => {
    const ids = [...picked];
    if (!ids.length || busy) return;
    if (first && !named.current) {
      // Name it now, then send. Backing out of the name keeps your picks; INVITE asks again.
      const was = crewNow()?.name ?? 'THE CREW';
      askInk({ label: 'NAME YOUR CREW', max: 40, upper: true, examples: [was] }, (t) => {
        named.current = true;
        (t && t !== was ? renameCrew(t) : Promise.resolve()).then(() => send(), (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
      });
      return;
    }
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

  const shareLink = () => {
    const url = inviteLink();
    const crew = crewNow();
    if (url && crew) void Share.share({ message: `Join ${crew.name} on LobsOfLove. Tap to get in: ${url}` });
  };

  const n = picked.size;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={12}><Text style={styles.back}>{'<'} BACK</Text></Pressable>
        <Text style={styles.title}>FIND PLAYERS</Text>
        <View style={styles.headSpace} />
      </View>
      <View style={styles.searchWrap}>
        <Svg width={20} height={20} viewBox="0 0 20 20">
          <Circle cx={8} cy={8} r={6} stroke={P.ink} strokeWidth={2.5} fill="none" />
          <Path d="M12.5 12.5 L18 18" stroke={P.ink} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={type}
          placeholder="type a name to narrow it"
          placeholderTextColor={P.faint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {q ? <Pressable onPress={() => type('')} hitSlop={10}><Text style={styles.clear}>CLEAR</Text></Pressable> : null}
      </View>
      <Text style={styles.hint}>{error ?? (found?.length === 0 ? `NOBODY CALLED "${q.trim().toUpperCase()}"` : 'TAP A FACE, OR HOLD AND CIRCLE A BUNCH')}</Text>

      <ScrollView
        style={styles.grid}
        scrollEnabled={!drawing}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={() => { touchRef.current.scrolled = true; if (holdTimer.current) clearTimeout(holdTimer.current); }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={{ height }} {...touch}>
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
                  </View>
                  <Text numberOfLines={1} style={[styles.name, on && styles.nameOn]}>{tag ?? c.p.name}</Text>
                </View>
              );
            })}
            {stroke.length > 1 ? (
              <BrushStroke style={StyleSheet.absoluteFill} brush={brush} points={stroke.map((p) => [p.x, p.y] as const)} />
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <Pressable onPress={send} disabled={!n || busy} style={({ pressed }) => [styles.go, !n && styles.goOff, pressed && n ? styles.goPressed : null]}>
          <Text style={[styles.goText, !n && styles.goTextOff]}>{busy ? 'SENDING...' : n ? `INVITE ${n} ${n === 1 ? 'PLAYER' : 'PLAYERS'}` : 'PICK WHO YOU WANT'}</Text>
        </Pressable>
        <Pressable onPress={shareLink} hitSlop={8}><Text style={styles.link}>NOT ON THE APP YET? SEND THE LINK</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  headSpace: { width: 56 },
  back: { fontFamily: MONO, fontWeight: '800', fontSize: 12, letterSpacing: 1.2, color: P.ink, width: 56 },
  title: { fontFamily: MONO, fontWeight: '800', fontSize: 13, letterSpacing: 1.6, color: P.red },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 2,
    borderWidth: 2.5, borderColor: P.ink, borderRadius: 24, backgroundColor: P.card,
  },
  search: { flex: 1, fontFamily: MONO, fontWeight: '700', fontSize: 16, color: P.ink, paddingVertical: 9 },
  clear: { fontFamily: MONO, fontWeight: '800', fontSize: 10, letterSpacing: 1.2, color: P.dim },
  hint: { fontFamily: MONO, fontWeight: '800', fontSize: 11, letterSpacing: 1.3, color: P.red, textAlign: 'center', marginTop: 10, marginBottom: 4 },
  grid: { flex: 1, marginHorizontal: 10 },
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
  foot: { paddingHorizontal: 16, paddingTop: 8, gap: 10, alignItems: 'center' },
  go: {
    alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15, borderRadius: 30, backgroundColor: P.red, borderWidth: 2.5, borderColor: P.ink,
    shadowColor: '#000', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 },
  },
  goOff: { backgroundColor: 'transparent', borderStyle: 'dashed', shadowOpacity: 0 },
  goPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } },
  goText: { fontFamily: MONO, fontWeight: '800', fontSize: 14, letterSpacing: 1.6, color: P.card },
  goTextOff: { color: P.dim },
  link: { fontFamily: MONO, fontWeight: '800', fontSize: 10, letterSpacing: 1.2, color: P.ink, textDecorationLine: 'underline' },
});
