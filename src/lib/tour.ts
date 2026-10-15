import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

// PROTOTYPE FEED: ESPN's public scoreboard JSON, no key. It is unofficial and can change without notice.
// The screen only needs {tab, text, live} lines, so a paid feed (Sportradar, api-tennis) can replace this file alone.
const SCOREBOARD = (tour: Tour) => `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard`;
const RANKINGS = (tour: Tour) => `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings`;

export type Tour = 'atp' | 'wta';
export type State = 'pre' | 'in' | 'post';

export type TourMatch = {
  id: string;
  tour: Tour;
  event: string;
  round: string;
  singles: boolean;
  state: State;
  /** "Final", "Retired", "Walkover", or a start time note for pre. */
  detail: string;
  start: number;
  players: [string, string];
  /** Per-set games, one row per player. */
  sets: [number[], number[]];
  winner: 0 | 1 | null;
  /** Best world ranking of the two players; 999 when neither is ranked. */
  rank: number;
};

export type Rank = { name: string; rank: number; tour: Tour };

export type Snapshot = {
  at: number;
  matches: TourMatch[];
  ranks: Rank[];
};

/** One line for the top of the home screen. */
export type TourLine = { tab: 'LIVE' | 'FINAL' | 'NEXT'; text: string; live: boolean };
export type ProLine = { text: string; won: boolean; matchId: string | null };

const KEY = 'lol.tour.v1';
const LIVE_POLL = 45_000;
const IDLE_POLL = 5 * 60_000;
const RANK_TTL = 12 * 3_600_000;

let snap: Snapshot = { at: 0, matches: [], ranks: [] };
let ranksAt = 0;
let loaded = false;
let inflight: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/* ---------- parsing ---------- */

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

/** ESPN writes "2026-10-05T04:05Z": no seconds, which some Date parsers reject. */
const when = (iso: string) => Date.parse(iso.replace(/T(\d\d:\d\d)Z$/, 'T$1:00Z')) || 0;

const ROUNDS: [RegExp, string][] = [
  [/^final/i, 'FINAL'],
  [/semi/i, 'SF'],
  [/quarter/i, 'QF'],
  [/round of (\d+)/i, 'R$1'],
  [/^round (\d+)$/i, 'R$1'],
  [/qualifying (\d)/i, 'Q$1'],
  [/(\d)(st|nd|rd|th) round/i, 'R$1'],
  [/round robin/i, 'RR'],
];
export function shortRound(name: string): string {
  for (const [re, out] of ROUNDS) { const m = name.match(re); if (m) return out.replace('$1', m[1] ?? ''); }
  return name.toUpperCase();
}

/** "Rolex Shanghai Masters" -> "SHANGHAI MASTERS": a leading sponsor goes, the place stays. */
const SPONSORS = /^(rolex|bnp paribas fortis|bnp paribas|dongfeng voyah|dongfeng|vanda pharmaceuticals|mutua|erste bank|swiss indoors|sony|nitto|rakuten|tata|cinch|western & southern|mubadala|qatar|abierto|internazionali bnl d'italia|hsbc)\s+/i;
export function shortEvent(name: string): string {
  return name
    .replace(/\b(presented by|pres\. by)\b.*$/i, '')
    .replace(SPONSORS, '')
    .replace(/\bwomen's\b|\bchampionships?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** "Alex de Minaur" -> "de Minaur": lowercase particles stay with the surname. */
const surname = (name: string) => {
  const w = name.trim().split(/\s+/);
  let i = w.length - 1;
  while (i > 1 && /^(de|van|der|den|di|del|da|dos|le|la|von|al|el|ben)$/i.test(w[i - 1])) i--;
  return w.slice(i).join(' ') || name;
};
const last = (name: string) => surname(name).toUpperCase();

function parseScoreboard(tour: Tour, json: unknown): TourMatch[] {
  const out: TourMatch[] = [];
  for (const ev of arr(obj(json).events)) {
    const e = obj(ev);
    const event = shortEvent(str(e.shortName) || str(e.name));
    for (const g of arr(e.groupings)) {
      const grouping = obj(g);
      const singles = /singles/i.test(str(obj(grouping.grouping).displayName));
      for (const c of arr(grouping.competitions)) {
        const comp = obj(c);
        const cs = arr(comp.competitors).map(obj).sort((a, b) => num(a.order) - num(b.order));
        if (cs.length !== 2) continue;
        const names = cs.map((x) => str(obj(x.athlete).displayName) || str(obj(x.team).displayName));
        if (!names[0] || !names[1]) continue;
        const type = obj(obj(comp.status).type);
        const state = str(type.state) as State;
        if (!['pre', 'in', 'post'].includes(state)) continue;
        const sets = cs.map((x) => arr(x.linescores).map((l) => num(obj(l).value))) as [number[], number[]];
        const winner = cs[0].winner === true ? 0 : cs[1].winner === true ? 1 : null;
        out.push({
          id: `${tour}:${str(comp.id)}`,
          tour,
          event,
          round: shortRound(str(obj(comp.round).displayName)),
          singles,
          state,
          detail: str(type.shortDetail),
          start: when(str(comp.date) || str(comp.startDate)),
          players: [names[0], names[1]],
          sets,
          winner,
          rank: 999,
        });
      }
    }
  }
  return out;
}

function parseRankings(tour: Tour, json: unknown): Rank[] {
  const table = obj(arr(obj(json).rankings)[0]);
  return arr(table.ranks).map(obj).map((r) => ({ tour, name: str(obj(r.athlete).displayName), rank: num(r.current) })).filter((r) => r.name && r.rank > 0);
}

/* ---------- fetching ---------- */

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Snapshot & { ranksAt?: number };
      if (parsed && Array.isArray(parsed.matches)) { snap = { at: parsed.at, matches: parsed.matches, ranks: parsed.ranks ?? [] }; ranksAt = parsed.ranksAt ?? 0; emit(); }
    }
  } catch {
    // Unreadable cache: start empty.
  }
}

/** The current snapshot outside React (scripts, tests). */
export const tourSnapshot = (): Snapshot => snap;

export async function refreshTour(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    await loadCache();
    const tours: Tour[] = ['atp', 'wta'];
    const boards = await Promise.allSettled(tours.map((t) => getJson(SCOREBOARD(t)).then((j) => parseScoreboard(t, j))));
    const matches = boards.flatMap((b) => (b.status === 'fulfilled' ? b.value : []));
    if (boards.every((b) => b.status === 'rejected')) return; // offline: keep what we had
    let ranks = snap.ranks;
    if (Date.now() - ranksAt > RANK_TTL || !ranks.length) {
      const tables = await Promise.allSettled(tours.map((t) => getJson(RANKINGS(t)).then((j) => parseRankings(t, j))));
      const fresh = tables.flatMap((b) => (b.status === 'fulfilled' ? b.value : []));
      if (fresh.length) { ranks = fresh; ranksAt = Date.now(); }
    }
    const byName = new Map(ranks.map((r) => [`${r.tour}:${r.name.toLowerCase()}`, r.rank]));
    for (const m of matches) m.rank = Math.min(...m.players.map((p) => byName.get(`${m.tour}:${p.toLowerCase()}`) ?? 999));
    snap = { at: Date.now(), matches, ranks };
    emit();
    AsyncStorage.setItem(KEY, JSON.stringify({ ...snap, ranksAt })).catch(() => {});
  })().finally(() => { inflight = null; });
  return inflight;
}

function schedule() {
  if (timer) clearTimeout(timer);
  if (!listeners.size) { timer = null; return; }
  const live = snap.matches.some((m) => m.state === 'in');
  timer = setTimeout(() => { void refreshTour().finally(schedule); }, live ? LIVE_POLL : IDLE_POLL);
}

/** The latest tour snapshot. Polls while something on screen is listening: every 45 s during live play, else every 5 min. */
export function useTour(): Snapshot {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => { listeners.delete(l); if (!listeners.size && timer) { clearTimeout(timer); timer = null; } };
    },
    () => snap,
    () => snap,
  );
  useEffect(() => {
    void (async () => { await loadCache(); if (Date.now() - snap.at > 60_000) await refreshTour(); schedule(); })();
  }, []);
  return s;
}

/* ---------- lines ---------- */

const score = (m: TourMatch, lead: 0 | 1 = 0) => {
  const n = Math.max(m.sets[0].length, m.sets[1].length);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(`${m.sets[lead][i] ?? 0}-${m.sets[1 - lead][i] ?? 0}`);
  return parts.join(' ');
};

const clock = (t: number) => {
  const d = new Date(t);
  const now = new Date();
  const day = d.toDateString() === now.toDateString() ? '' : d.toDateString() === new Date(now.getTime() + 86_400_000).toDateString() ? 'TOMORROW ' : `${d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()} `;
  const hm = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toUpperCase();
  return `${day}${hm}`;
};

/** Who is on the tour line: your pro's match when it is live or near, else the biggest match live, next up, or just finished. */
export function featured(s: Snapshot, pro: TourMatch | null): TourMatch | null {
  const now = Date.now();
  if (pro && (pro.state === 'in' || Math.abs(pro.start - now) < 20 * 3_600_000)) return pro;
  const singles = s.matches.filter((m) => m.singles && m.players[0] && m.players[1]);
  const byRank = (a: TourMatch, b: TourMatch) => a.rank - b.rank;
  const live = singles.filter((m) => m.state === 'in').sort(byRank);
  if (live[0] && live[0].rank <= 150) return live[0];
  const soon = singles.filter((m) => m.state === 'pre' && m.start > now - 3_600_000 && m.start < now + 18 * 3_600_000).sort(byRank);
  const done = singles.filter((m) => m.state === 'post' && m.winner != null && now - m.start < 30 * 3_600_000).sort((a, b) => byRank(a, b) || b.start - a.start);
  // A top player's finished match outranks a journeyman's upcoming one.
  const best = [done[0], soon[0]].filter(Boolean).sort(byRank)[0];
  if (live[0] && (!best || best.rank > 30)) return live[0];
  if (done[0] && (!soon[0] || done[0].rank <= soon[0].rank)) return done[0];
  if (soon[0]) return soon[0];
  if (live[0]) return live[0]; // only unranked players are on court: still live, still shown
  const any = singles.filter((m) => m.state === 'post' && m.winner != null).sort((a, b) => b.start - a.start || byRank(a, b));
  return any[0] ?? null;
}

export function tourLine(m: TourMatch | null): TourLine | null {
  if (!m) return null;
  const a = last(m.players[0]);
  const b = last(m.players[1]);
  const where = `${m.event} ${m.round}`;
  if (m.state === 'in') return { tab: 'LIVE', text: `${a} v ${b}  ${score(m)}  ${where}`, live: true };
  if (m.state === 'pre') return { tab: 'NEXT', text: `${a} v ${b}  ${clock(m.start)}  ${where}`, live: false };
  const w = m.winner ?? 0;
  const tail = /retired|walkover/i.test(m.detail) ? ` (${m.detail.toUpperCase()})` : '';
  const l = (1 - w) as 0 | 1;
  return { tab: 'FINAL', text: `${last(m.players[w])} d. ${last(m.players[l])} ${score(m, w)}${tail}  ${where}`, live: false };
}

/** Finds the typed favorite pro on tour: "Alcaraz", "carlos alcaraz" and "C. Alcaraz" all land on Carlos Alcaraz. */
export function findPro(s: Snapshot, typed: string): { name: string; tour: Tour; rank: number | null } | null {
  const q = typed.trim().toLowerCase();
  if (q.length < 3) return null;
  const hit = (name: string) => {
    const n = name.toLowerCase();
    return n === q || n.includes(q) || q.includes(surname(n)) && surname(n).length >= 4;
  };
  const ranked = s.ranks.find((r) => hit(r.name));
  if (ranked) return { name: ranked.name, tour: ranked.tour, rank: ranked.rank };
  for (const m of s.matches) for (const p of m.players) if (hit(p)) return { name: p, tour: m.tour, rank: null };
  return null;
}

export function proMatch(s: Snapshot, name: string): TourMatch | null {
  const now = Date.now();
  const mine = s.matches.filter((m) => m.singles && m.players.includes(name));
  const live = mine.find((m) => m.state === 'in');
  if (live) return live;
  const next = mine.filter((m) => m.state === 'pre').sort((a, b) => a.start - b.start)[0];
  const lastDone = mine.filter((m) => m.state === 'post' && m.winner != null).sort((a, b) => b.start - a.start)[0];
  if (next && lastDone) return next.start - now < now - lastDone.start ? next : lastDone;
  return next ?? lastDone ?? null;
}

export function proLine(s: Snapshot, typed: string): ProLine {
  if (!typed.trim()) return { text: 'pick a favorite pro on FIGHTER and they show up here.', won: false, matchId: null };
  const pro = findPro(s, typed);
  if (!pro) return { text: s.at ? `no "${typed.trim()}" on tour this week.` : '', won: false, matchId: null };
  const who = `${last(pro.name)}${pro.rank ? `, no. ${pro.rank}` : ''}`;
  const m = proMatch(s, pro.name);
  if (!m) return { text: `${who}. not playing this week.`, won: false, matchId: null };
  const me = m.players[0] === pro.name ? 0 : 1;
  const them = last(m.players[1 - me]);
  const where = `${m.event} ${m.round}`;
  // Live and upcoming matches are on the ticker above, so these lines stay short.
  if (m.state === 'in') return { text: `${who}. on court now v ${them}.`, won: false, matchId: m.id };
  if (m.state === 'pre') return { text: `${who}. plays ${them} ${clock(m.start)}.`, won: false, matchId: m.id };
  const won = m.winner === me;
  return { text: `${who}. ${won ? 'WON' : 'LOST'} ${score(m, me)} v ${them}. ${where}.`, won, matchId: m.id };
}
