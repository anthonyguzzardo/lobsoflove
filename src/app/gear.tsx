import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { SceneView, type SceneMsg, useScene } from '@/components/scene-view';
import { DOMAIN_HTML } from '@/generated/domain-html';
import {
  type GearItem, type GearKind, LIFE, type Service, SERVICES, type StringSetup,
  addItem, crackCan, dueList, lowStock, renameItem, restock, retireItem, service, setSetup, updateItem, useCloset, useRetired, wearOf,
} from '@/lib/gear';
import { askInk } from '@/lib/ink-ask';
import { recognizeChar, type Stroke } from '@/lib/ink-recognize';
import { counts, type Match, useMatches, winnerOf } from '@/lib/matches';
import { goBack } from '@/lib/nav';
import { type Fighter, useRoster } from '@/lib/roster';
import { sfx } from '@/lib/sfx';

const DEFAULT_NAME: Record<GearKind, string> = { racket: 'RACKET', shoes: 'COURT SHOES', balls: 'BALLS', grips: 'OVERGRIPS' };
const PLACEHOLDER: Record<GearKind, string> = { racket: 'PURE AERO', shoes: 'GEL RESOLUTION', balls: 'PENN CHAMPIONSHIP', grips: 'TOURNA GRIP' };
const SEARCH: Record<GearKind, string> = { racket: 'tennis racket', shoes: 'tennis shoes', balls: 'tennis balls', grips: 'tennis overgrip' };
const DAY = 86_400_000;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** The gear in use, as the page shows it: wear on each part, and stock for cans and overgrips. */
function inUse(items: GearItem[], matches: Match[]) {
  return items.map((it) => ({
    id: it.id,
    kind: it.kind,
    name: it.name,
    brand: it.brand,
    model: it.model,
    count: it.count ?? 1,
    colors: it.colors ?? [],
    setup: it.setup ?? null,
    stock: it.stock ?? 0,
    low: lowStock(it),
    hasOpen: it.kind === 'balls' && it.serviced.can != null,
    rows: SERVICES[it.kind]
      .filter((s: Service) => s !== 'can' || it.serviced.can != null)
      .map((s: Service) => {
        const w = wearOf(it, s, matches);
        const life = LIFE[s];
        return { s, word: life.word, verb: life.verb, text: `${w.matches} of ${life.matches} matches, ${w.days} of ${life.days} days`, worn: w.worn };
      }),
    log: logOf(it),
  }));
}

const day = (at: number) => { const d = new Date(at); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
const tension = (x: StringSetup) => (x.mains === x.crosses ? `${x.mains}` : `${x.mains}/${x.crosses}`);
/** What has been done to it, newest first, for the card: every restring with what went in, or every new pair. */
function logOf(it: GearItem): string[] {
  const s: Service = it.kind === 'racket' ? 'strings' : 'soles';
  const jobs = (it.jobs ?? []).filter((j) => j.s === s).sort((a, b) => b.at - a.at);
  const verb = s === 'strings' ? 'restrung' : 'new pair';
  if (!jobs.length) {
    const at = it.serviced[s];
    return [at ? `${verb} ${day(at)}` : `nothing logged since you added it ${day(it.addedAt)}`];
  }
  const lines = jobs.slice(0, 3).map((j) => {
    const x = j.setup;
    const what = x ? [x.string, x.gauge ? `${x.gauge} GA` : '', `${tension(x)} LB`].filter(Boolean).join(', ') : '';
    return `${verb} ${day(j.at)}${what ? `: ${what}` : ''}`;
  });
  if (jobs.length > 3) lines.push(`${jobs.length} ${s === 'strings' ? 'restrings' : 'pairs'} since ${day(it.addedAt)}`);
  return lines;
}

function span(ms: number): string {
  const days = Math.max(1, Math.round(ms / DAY));
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

/** What a piece of retired gear did while you used it: the matches you played between getting it and retiring it. */
function historyOf(it: GearItem, matches: Match[], me: string, roster: Fighter[]) {
  const end = it.retiredAt ?? Date.now();
  const played = matches.filter((m) => counts(m) && m.playedAt >= it.addedAt && m.playedAt <= end && (m.p1 === me || m.p2 === me));
  let w = 0; let l = 0;
  let best: { m: Match; margin: number } | null = null;
  for (const m of played) {
    const win = winnerOf(m);
    if (!win) continue;
    if (win !== me) { l += 1; continue; }
    w += 1;
    const mine = m.p1 === me;
    const margin = m.sets.reduce((a, [x, y]) => a + (mine ? x - y : y - x), 0);
    if (!best || margin > best.margin) best = { m, margin };
  }
  const lines = [`${played.length} match${played.length === 1 ? '' : 'es'} over ${span(end - it.addedAt)}`];
  if (best) {
    const mine = best.m.p1 === me;
    const opp = mine ? best.m.p2 : best.m.p1;
    const score = best.m.sets.map(([x, y]) => (mine ? `${x}-${y}` : `${y}-${x}`)).join(' ');
    lines.push(`best win ${score} over ${roster.find((f) => f.id === opp)?.name ?? 'someone'}`);
  }
  const d = new Date(end);
  lines.push(`planted ${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
  return { id: it.id, kind: it.kind, name: it.name, colors: it.colors ?? [], matches: played.length, record: `${w}-${l}`, lines };
}

/**
 * Gear: your fighter and the legend who floats behind it. What you use now is in the dock and on the ground in front; hold your
 * fighter (or tap DOMAIN) to expand the domain, where everything you have retired stands planted in the ground. Drawn by three.js in a WebView (web/domain.js).
 */
export default function Gear() {
  const params = useLocalSearchParams<{ demo?: string }>();
  const demo = params.demo === '1';
  // Rackets and shoes only for now; balls and overgrips come back once these two are right.
  const closet = useCloset();
  const items = useMemo(() => closet.filter((it) => it.kind === 'racket' || it.kind === 'shoes'), [closet]);
  const retired = useRetired();
  const matches = useMatches();
  const roster = useRoster();
  const scene = useScene();
  const { run } = scene;
  const state = useRef({ focus: null as string | null, held: false, open: false, pick: false });
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const you = roster.find((f) => f.isYou) ?? roster[0];
  const data = useMemo(() => {
    const me = you?.id ?? 'you';
    const past = retired.filter((it) => it.kind === 'racket' || it.kind === 'shoes').map((it) => historyOf(it, matches, me, roster));
    const due = dueList(items, matches);
    const planted = past.filter((i) => i.kind === 'racket').reduce((a, i) => a + i.matches, 0);
    return JSON.stringify({
      you: you ? { cast: you.cast, color: you.color, name: you.name } : null,
      gear: inUse(items, matches),
      items: past,
      due,
      title: 'YOUR GEAR.',
      sub: due.length ? `${due.length} THING${due.length > 1 ? 'S NEED' : ' NEEDS'} WORK.` : 'NOTHING NEEDS WORK.',
      hint: 'tap RACKET or SHOES and he pulls it out. tap DOMAIN, or hold your fighter, to see your old gear.',
      inside: past.length
        ? { sub: `${past.length} PLANTED. ${planted} MATCHES IN THE GROUND.`, hint: 'pull one up to see what it won. the arrow closes it.' }
        : { sub: 'NOTHING PLANTED YET.', hint: 'hold a racket\'s name to retire it. it gets planted here. the arrow closes it.' },
    });
  }, [items, retired, matches, roster, you]);
  useEffect(() => { if (!demo) run(`window.setDomain(${data})`); }, [run, data, demo]);

  const byId = (id: string) => itemsRef.current.find((i) => i.id === id);
  /** Naming a piece of gear happens on the TYPE / WRITE page; the answer renames it here. */
  const startEdit = (id: string) => {
    const it = byId(id);
    if (!it) return;
    askInk({ label: 'WHAT IS IT CALLED', max: 22, upper: true, examples: [PLACEHOLDER[it.kind]] }, (t) => { renameItem(id, t || DEFAULT_NAME[it.kind]); void Haptics.selectionAsync(); });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SceneView
        scene={scene}
        html={DOMAIN_HTML}
        name="gear"
        onReady={() => {
          if (demo) run('window.demoDomain()');
        }}
        onMessage={(m: SceneMsg) => {
          switch (m.type) {
            // Your fighter hopped off the page: go back.
            case 'leave': goBack(); break;
            case 'grab': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); break;
            // He reaches behind his back and whips it out.
            case 'reach': sfx('swish', 0.5); setTimeout(() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }, 300); break;
            // Holding your fighter: each quarter of the charge hits harder.
            case 'charge': void Haptics.impactAsync(m.v > 0.7 ? Haptics.ImpactFeedbackStyle.Heavy : m.v > 0.4 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light); sfx('tick', 0.3 + 0.5 * m.v); break;
            case 'kiss': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('pock', 0.5); break;
            case 'fizzle': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); sfx('drip', 0.5); break;
            case 'expand': state.current.open = true; void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('slam', 1); setTimeout(() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }, 160); break;
            case 'collapse': state.current.open = false; void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('swish', 0.7); break;
            case 'tick': void Haptics.selectionAsync(); sfx('tick', 0.4); break;
            case 'free': state.current.held = true; void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('slam', 0.5); break;
            case 'sink': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('pock', 0.4); break;
            case 'fling': state.current.held = false; sfx('swish', 0.6); break;
            case 'plant': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sfx('slam', 0.9); break;
            case 'twang': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('ping', 0.35); break;
            case 'rise': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('clack', 0.25); break;
            case 'swing': case 'swish': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('swish', 0.4); break;
            case 'poke': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sfx('squeak', 0.6); break;
            case 'laugh': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); sfx('bloop', 0.6); setTimeout(() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, 120); break;
            case 'focus': state.current.focus = m.id ?? null; if (m.id) { void Haptics.selectionAsync(); sfx('select', 0.5); } break;
            case 'add': {
              if (demo) break;
              const kind = m.kind as 'racket' | 'shoes';
              // Circled all the way to a model: it comes in named. Circled OTHER: write the name.
              const id = addItem(kind, typeof m.name === 'string' ? m.name : m.brand ?? DEFAULT_NAME[kind], null, {
                brand: m.brand, model: m.model, count: m.count, colors: Array.isArray(m.colors) ? m.colors : undefined,
              });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              sfx('slam', 0.6);
              if (typeof m.name !== 'string') startEdit(id);
              break;
            }
            case 'setup': if (!demo) setSetup(m.id, m.setup as StringSetup); break;
            case 'detail': if (!demo) updateItem(m.id, m.patch); break;
            case 'toss': setTimeout(() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, 150); sfx('swish', 0.5); break;
            case 'pick': state.current.pick = !!m.open; break;
            case 'circled': {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              sfx('pock', 0.6);
              break;
            }
            case 'restock': if (!demo) restock(m.kind as GearKind, 1); sfx('pock', 0.5); break;
            case 'crack': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); sfx('can', 0.8); if (!demo) crackCan(); break;
            case 'service':
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              sfx('ping', 0.8);
              if (demo) break;
              service(m.id, m.s as Service);
              break;
            case 'edit': if (!demo) startEdit(m.id); break;
            // A number written on the page with your finger (tension): read it and hand the guesses back.
            case 'read':
              recognizeChar(m.strokes as Stroke[], m.w as number, m.h as number).then(
                (c) => run(`window.readNum(${JSON.stringify(c)})`),
                () => run('window.readNum(null)'),
              );
              break;
            case 'remove': {
              const it = byId(m.id);
              if (!it || it.kind === 'balls' || it.kind === 'grips') break;
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(`Retire ${it.name}?`, 'It gets planted in your domain with every match it played.', [
                { text: 'Keep using it', style: 'cancel' },
                { text: 'Plant it', onPress: () => { run(`window.retire(${JSON.stringify(it.id)})`); retireItem(it.id); } },
              ]);
              break;
            }
            case 'order': {
              const kind = m.kind as GearKind;
              const it = itemsRef.current.find((i) => i.kind === kind);
              const q = it && it.name !== DEFAULT_NAME[kind] ? `${it.name} ${SEARCH[kind]}` : SEARCH[kind];
              void WebBrowser.openBrowserAsync(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`);
              break;
            }
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#efece5' },
});
