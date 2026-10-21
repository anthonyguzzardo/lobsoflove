import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent, KeyboardAvoidingView, type LayoutChangeEvent, Platform, Pressable, Share, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';

import { MONO, P } from '@/constants/paper';
import { crewNow, findPlayers, type Found, inviteLink, invitePlayer, refresh } from '@/lib/cloud';
import { faceSvg } from '@/lib/faces';
import { goBack } from '@/lib/nav';
import { sfx } from '@/lib/sfx';

type Pt = { x: number; y: number };
type Cell = { p: Found; x: number; y: number; w: number; h: number };

const NAME_H = 18;

/** Lay the people out as big as they fit: fewest columns that still fit everyone, else as many as fit at six across. */
function layout(people: Found[], W: number, H: number): { cells: Cell[]; hidden: number } {
  if (!W || !H) return { cells: [], hidden: 0 };
  let cols = 3;
  for (; cols < 6; cols++) {
    const w = W / cols;
    if (Math.ceil(people.length / cols) * (w * 0.86 + NAME_H) <= H) break;
  }
  const w = W / cols;
  const h = w * 0.86 + NAME_H;
  const fit = cols * Math.max(1, Math.floor(H / h));
  const shown = people.slice(0, fit);
  return { cells: shown.map((p, i) => ({ p, x: (i % cols) * w, y: Math.floor(i / cols) * h, w, h })), hidden: people.length - shown.length };
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
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [stroke, setStroke] = useState<Pt[]>([]);
  const asked = useRef(0);

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

  const { cells, hidden } = useMemo(() => layout(found ?? [], size.w, size.h), [found, size]);
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
  // Touch handlers straight on the grid: a short touch is a tap, anything longer is a stroke.
  const touch = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => { if (clearTimer.current) clearTimeout(clearTimer.current); pts.current = [at(e)]; setStroke(pts.current); },
    onResponderMove: (e: GestureResponderEvent) => {
      const p = at(e);
      const last = pts.current[pts.current.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
      pts.current = [...pts.current, p];
      setStroke(pts.current);
    },
    onResponderRelease: () => {
      const line = pts.current;
      const a = line[0], b = line[line.length - 1];
      const moved = line.reduce((m, p) => Math.max(m, Math.hypot(p.x - a.x, p.y - a.y)), 0);
      if (moved < 10) { tap(b); setStroke([]); return; }
      finish(line);
      clearTimer.current = setTimeout(() => setStroke([]), 380);
    },
  };

  const type = (v: string) => setQ(v);

  const send = async () => {
    const ids = [...picked];
    if (!ids.length || busy) return;
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

  const d = stroke.length > 1 ? `M${stroke.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')}` : '';
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
      <Text style={styles.hint}>{error ?? (found?.length === 0 ? `NOBODY CALLED "${q.trim().toUpperCase()}"` : 'CIRCLE THEM, COLOR THEM IN, OR TAP')}</Text>

      <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...touch}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {cells.map((c) => {
            const on = picked.has(c.p.id);
            const tag = c.p.crew === 'yours' ? 'IN CREW' : c.p.crew === 'taken' ? 'IN A CREW' : c.p.invited ? 'INVITED' : null;
            const face = c.w * 0.8;
            return (
              <View key={c.p.id} style={[styles.cell, { left: c.x, top: c.y, width: c.w, height: c.h }, tag && styles.cellDim]}>
                <View style={[styles.faceWrap, { width: face + 8, height: face + 8, borderRadius: (face + 8) / 2 }, on && { backgroundColor: c.p.color, borderColor: P.ink }]}>
                  <SvgXml xml={faceSvg(c.p.face, c.p.color)} width={face} height={face} />
                </View>
                <Text numberOfLines={1} style={[styles.name, on && styles.nameOn]}>{tag ?? c.p.name}</Text>
              </View>
            );
          })}
          {d ? (
            <Svg style={StyleSheet.absoluteFill}>
              <Path d={d} stroke={P.red} strokeWidth={7} strokeOpacity={0.85} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          ) : null}
        </View>
      </View>
      {hidden > 0 ? <Text style={styles.more}>+{hidden} MORE: TYPE A NAME TO FIND THEM</Text> : null}

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
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  cellDim: { opacity: 0.4 },
  faceWrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'transparent' },
  name: { fontFamily: MONO, fontWeight: '800', fontSize: 9, letterSpacing: 0.6, color: P.ink, marginTop: 1, paddingHorizontal: 4, maxWidth: '100%' },
  nameOn: { backgroundColor: P.ink, color: P.card, borderRadius: 4, overflow: 'hidden' },
  more: { fontFamily: MONO, fontWeight: '800', fontSize: 10, letterSpacing: 1.1, color: P.dim, textAlign: 'center', marginTop: 2 },
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
