import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** Something done to your gear: a restring, a regrip, new shoes. */
export type GearEntry = { id: string; item: string; cost: number | null; at: number };

/** Where a thing lives in the closet: rackets hang on hooks, shoes sit on the floor, cans on the shelf, overgrips in the bin. */
export type GearKind = 'racket' | 'shoes' | 'balls' | 'grips';
/** The part of an item that wears out and gets replaced. */
export type Service = 'strings' | 'overgrip' | 'soles' | 'can';

/** How a racket is strung. Tension in pounds. */
export type StringSetup = { string: string | null; gauge: string; mains: number; crosses: number };

export type GearItem = {
  id: string;
  kind: GearKind;
  name: string;
  /** What you call it ("DREAMSICLE"). The name stays the brand / model underneath. */
  nick?: string;
  /** A copy of the photo in the app's documents folder. */
  photo: string | null;
  addedAt: number;
  /** When each part was last replaced. */
  serviced: Partial<Record<Service, number>>;
  /** Unopened cans (balls) or overgrips in the bin (grips). */
  stock?: number;
  /** When it was retired: it leaves the closet and stands planted in the domain. */
  retiredAt?: number;
  /** Circled when it was added. */
  brand?: string;
  model?: string;
  /** Which generation of the model (its paint), e.g. '2023'. Absent: the current one. */
  gen?: string | null;
  /** How many of the same frame you have (rackets): they get strung together. */
  count?: number;
  /** Shoes: main color, then the accent, as hex. */
  colors?: string[];
  /** Rackets: what is in the strings. */
  setup?: StringSetup;
  /** Every time a part was replaced, newest last: restrings keep the string that went in. */
  jobs?: Job[];
};

/** One restring or new pair. */
export type Job = { s: Service; at: number; setup?: StringSetup };
const withJob = (it: GearItem, s: Service, at: number): GearItem => ({
  ...it,
  serviced: { ...it.serviced, [s]: at },
  jobs: [...(it.jobs ?? []), { s, at, ...(s === 'strings' && it.setup ? { setup: it.setup } : {}) }],
});

/**
 * When a part is due: whichever comes first, sessions you played on it or days since it went on. A session is a time you landed
 * on a court (a match or just hitting): both wear strings.
 * Rules of thumb: polyester strings go dead in about 15 sessions or 3 months; an overgrip lasts about 5 sessions or a month;
 * an open can of balls goes flat in about 3 sessions or 2 weeks; court shoes wear through in about 50 sessions or 6 months.
 */
export const LIFE: Record<Service, { sessions: number; days: number; word: string; verb: string }> = {
  strings: { sessions: 15, days: 90, word: 'STRINGS', verb: 'RESTRING' },
  overgrip: { sessions: 5, days: 30, word: 'OVERGRIP', verb: 'NEW OVERGRIP' },
  soles: { sessions: 50, days: 180, word: 'SOLES', verb: 'NEW PAIR' },
  can: { sessions: 3, days: 14, word: 'OPEN CAN', verb: 'CRACK A NEW CAN' },
};
// The overgrip is not tracked: a racket wears out by its strings.
export const SERVICES: Record<GearKind, Service[]> = { racket: ['strings'], shoes: ['soles'], balls: ['can'], grips: [] };
/** Reorder when the shelf or bin is down to this many. */
export const REORDER_AT: Partial<Record<GearKind, number>> = { balls: 1, grips: 2 };
export const MAX: Record<GearKind, number> = { racket: 3, shoes: 6, balls: 1, grips: 1 };

const DAY = 86_400_000;

export type Wear = {
  service: Service; since: number;
  /** Your sessions on it since the part went on, and how many of those were matches. */
  sessions: number; matches: number;
  days: number;
  /** 0 fresh, 1 due, above 1 overdue. */ worn: number;
};

/** The sessions that wear this item: a racket only the ones played with it; shoes, cans and grips every one of yours. */
export const sessionsOn = (item: GearItem, sessions: Session[]) =>
  item.kind === 'racket' ? sessions.filter((x) => x.racket === item.id) : sessions;

export function wearOf(item: GearItem, service: Service, sessions: Session[], now = Date.now()): Wear {
  const since = item.serviced[service] ?? item.addedAt;
  const on = sessionsOn(item, sessions).filter((x) => x.at > since);
  const days = Math.max(0, Math.floor((now - since) / DAY));
  const life = LIFE[service];
  return { service, since, sessions: on.length, matches: on.filter((x) => x.kind === 'match').length, days, worn: Math.max(on.length / life.sessions, days / life.days) };
}

export function lowStock(item: GearItem): boolean {
  const at = REORDER_AT[item.kind];
  return at != null && (item.stock ?? 0) <= at;
}

/** Plain-words list of what needs doing, most urgent first. */
export function dueList(items: GearItem[], sessions: Session[], now = Date.now()): string[] {
  const out: { worn: number; text: string }[] = [];
  for (const it of items) {
    for (const s of SERVICES[it.kind]) {
      const w = wearOf(it, s, sessions, now);
      if (w.worn >= 1) out.push({ worn: w.worn, text: `${it.name}: ${LIFE[s].verb.toLowerCase()}` });
    }
    if (lowStock(it)) out.push({ worn: 0.99, text: `${it.kind === 'balls' ? 'balls' : 'overgrips'}: order more` });
  }
  return out.sort((a, b) => b.worn - a.worn).map((o) => o.text);
}

const KEY = 'lol.gear.v1';
const ITEMS_KEY = 'lol.closet.v1';
const FRESH_KEY = 'lol.gear.fresh.1';
const SESSIONS_KEY = 'lol.sessions.v1';
let entries: GearEntry[] = [];
let items: GearItem[] = [];
/** Your sessions on court, oldest first (see Session below). */
let sessions: Session[] = [];
/** The closet shows what is in use; the domain shows what was retired. Kept as stable arrays for useSyncExternalStore. */
let active: GearItem[] = [];
let retired: GearItem[] = [];
const split = () => { active = items.filter((it) => it.retiredAt == null); retired = items.filter((it) => it.retiredAt != null); };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const persist = () => {
  AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {});
  AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items)).catch(() => {});
};

/** A new closet already has a ball shelf and a grip bin; rackets and shoes come in with a photo. */
const starter = (now: number): GearItem[] => [
  { id: 'balls', kind: 'balls', name: 'BALLS', photo: null, addedAt: now, serviced: {}, stock: 2 },
  { id: 'grips', kind: 'grips', name: 'OVERGRIPS', photo: null, addedAt: now, serviced: {}, stock: 3 },
];

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const [raw, rawItems, rawSessions] = await Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(ITEMS_KEY), AsyncStorage.getItem(SESSIONS_KEY)]);
    const parsedSessions = rawSessions ? (JSON.parse(rawSessions) as Session[]) : [];
    if (Array.isArray(parsedSessions)) sessions = parsedSessions;
    const parsed = raw ? (JSON.parse(raw) as GearEntry[]) : [];
    if (Array.isArray(parsed)) entries = parsed;
    const parsedItems = rawItems ? (JSON.parse(rawItems) as GearItem[]) : null;
    items = Array.isArray(parsedItems) ? parsedItems : starter(Date.now());
    // One clean start (2026-10-23): everything logged while the gear page was being built goes, once.
    if (!(await AsyncStorage.getItem(FRESH_KEY))) {
      entries = [];
      items = starter(Date.now());
      persist();
      await AsyncStorage.setItem(FRESH_KEY, '1');
    }
  } catch {
    // Unreadable storage: start with an empty log.
    items = starter(Date.now());
  }
  split();
  emit();
}

const set = (next: GearItem[]) => { items = next; split(); emit(); persist(); };
const patch = (id: string, fn: (it: GearItem) => GearItem) => set(items.map((it) => (it.id === id ? fn(it) : it)));
const first = (kind: GearKind) => items.find((it) => it.kind === kind && it.retiredAt == null);

/** A written log line ("restring 28"). It also counts on the closet: the first racket gets restrung, a can goes on the shelf. */
export function addGear(input: Omit<GearEntry, 'id'>): string {
  const e: GearEntry = { ...input, id: `g${Date.now()}` };
  entries = [...entries, e];
  const racket = first('racket');
  if (input.item === 'RESTRING' && racket) service(racket.id, 'strings', input.at);
  else if ((input.item === 'REGRIP' || input.item === 'OVERGRIP') && racket) regrip(racket.id, input.at);
  else if (input.item === 'SHOES' && first('shoes')) service(first('shoes')!.id, 'soles', input.at);
  else if (input.item === 'BALLS' && first('balls')) restock('balls', 1);
  else { emit(); persist(); }
  return e.id;
}

type Extra = Pick<GearItem, 'brand' | 'model' | 'count' | 'colors' | 'setup'>;
export function addItem(kind: GearKind, name: string, photo: string | null, extra: Extra = {}): string {
  const id = `${kind}${Date.now()}`;
  set([...items, { id, kind, name, photo, addedAt: Date.now(), serviced: {}, ...extra }]);
  return id;
}
/** Every piece of gear, in use and retired, gone. Starts over with an empty closet. */
export function wipeGear() { entries = []; set(starter(Date.now())); }
export function setSetup(id: string, setup: StringSetup) { patch(id, (it) => ({ ...it, setup })); }
/** Details picked later: brand, model (it becomes the name), colors. */
export function updateItem(id: string, p: Partial<Pick<GearItem, 'brand' | 'model' | 'gen' | 'name' | 'colors'>>) { patch(id, (it) => ({ ...it, ...p })); }
export function nickItem(id: string, nick: string) { patch(id, (it) => ({ ...it, nick: nick || undefined })); }
export function renameItem(id: string, name: string) { patch(id, (it) => ({ ...it, name })); }
export function setPhoto(id: string, photo: string) { patch(id, (it) => ({ ...it, photo })); }
export function removeItem(id: string) { set(items.filter((it) => it.id !== id)); }
/** Done with it: it leaves the closet and is planted in the domain, wear history and all. */
export function retireItem(id: string, at = Date.now()) { patch(id, (it) => ({ ...it, retiredAt: at })); }
export function service(id: string, s: Service, at = Date.now()) { patch(id, (it) => withJob(it, s, at)); }
/** The last restring (or new pair) really happened on another day: move it there. */
export function redateLast(id: string, s: Service, at: number) {
  patch(id, (it) => {
    const jobs = [...(it.jobs ?? [])];
    const k = jobs.map((j) => j.s).lastIndexOf(s);
    if (k < 0) return withJob(it, s, at);
    jobs[k] = { ...jobs[k], at };
    return { ...it, jobs, serviced: { ...it.serviced, [s]: at } };
  });
}
export function restock(kind: GearKind, n: number) {
  const it = first(kind);
  if (it) patch(it.id, (x) => ({ ...x, stock: Math.max(0, (x.stock ?? 0) + n) }));
}
/** Crack a new can: one off the shelf, and the open-can clock starts over. */
export function crackCan(at = Date.now()): boolean {
  const it = first('balls');
  if (!it || (it.stock ?? 0) <= 0) return false;
  patch(it.id, (x) => ({ ...x, stock: (x.stock ?? 0) - 1, serviced: { ...x.serviced, can: at } }));
  return true;
}
/** A fresh overgrip goes on the racket; one comes out of the bin if there is one. */
export function regrip(racketId: string, at = Date.now()) {
  const bin = first('grips');
  set(items.map((it) => {
    if (it.id === racketId) return { ...it, serviced: { ...it.serviced, overgrip: at } };
    if (bin && it.id === bin.id) return { ...it, stock: Math.max(0, (it.stock ?? 0) - 1) };
    return it;
  }));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  void load();
  return () => { listeners.delete(l); };
};

export function useGear(): GearEntry[] {
  return useSyncExternalStore(subscribe, () => entries, () => entries);
}

/** What is in use (the closet). */
export function useCloset(): GearItem[] {
  return useSyncExternalStore(subscribe, () => active, () => active);
}

/** What was retired (the domain). */
export function useRetired(): GearItem[] {
  return useSyncExternalStore(subscribe, () => retired, () => retired);
}

// ---------- Sessions ----------
/**
 * A time you were on a court: from landing (your beacon) to stepping off, or to the beacon running out after BEACON_HOURS.
 * Kept on this phone only. `racket` is the one the legend handed you (null: none in the closet). `kind` is the answer to
 * MATCH or JUST HIT once you leave; null until then, and a session counts toward wear either way.
 */
export type Session = {
  id: string;
  at: number;
  /** Venue id (src/data/venues.json `id`). */
  venue: string;
  racket: string | null;
  kind: 'match' | 'hit' | null;
  /** When you stepped off; absent while you are still there. */
  endedAt?: number;
  /** The match saved in /match for this session. */
  matchId?: string;
  /** Who was on the court with you when you left (names, for the opponent pick). */
  with?: string[];
  /** The question was put away without an answer. */
  skipped?: boolean;
};

const saveSessions = () => { emit(); AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)).catch(() => {}); };
const patchSession = (id: string, fn: (x: Session) => Session) => { sessions = sessions.map((x) => (x.id === id ? fn(x) : x)); saveSessions(); };

/** The racket you played with last: the one the legend offers first. */
export function lastRacket(): string | null {
  for (let k = sessions.length - 1; k >= 0; k -= 1) {
    const r = sessions[k].racket;
    if (r && items.some((it) => it.id === r && it.retiredAt == null)) return r;
  }
  return items.find((it) => it.kind === 'racket' && it.retiredAt == null)?.id ?? null;
}

/** You landed on `venue`. Any session still open somewhere else is over from now. Returns the new session's id. */
export function addSession(venue: string, at = Date.now()): string {
  const id = `s${at}`;
  sessions = [...sessions.map((x) => (x.endedAt == null ? { ...x, endedAt: at } : x)), { id, at, venue, racket: lastRacket(), kind: null }];
  saveSessions();
  return id;
}
export function setSessionRacket(id: string, racket: string | null) { patchSession(id, (x) => ({ ...x, racket })); }
/** Stepped off the court (or the beacon ran out at `at`). */
export function endSession(id: string, at = Date.now(), withNames: string[] = []) {
  patchSession(id, (x) => (x.endedAt == null ? { ...x, endedAt: at, with: withNames } : x));
}
export function setSessionKind(id: string, kind: 'match' | 'hit', matchId?: string) {
  patchSession(id, (x) => ({ ...x, kind, ...(matchId ? { matchId } : {}) }));
}
export function skipSession(id: string) { patchSession(id, (x) => ({ ...x, skipped: true })); }

/** One session as it is right now (fresh, unlike a value captured in a render). */
export const getSession = (id: string) => sessions.find((x) => x.id === id) ?? null;
/** The session you are in now, if any. */
export const openSession = (list: Session[]) => list.find((x) => x.endedAt == null) ?? null;
/** The last session that is over and still waiting on MATCH or JUST HIT (only from the last day; older ones just count). */
export function unanswered(list: Session[], now = Date.now()): Session | null {
  for (let k = list.length - 1; k >= 0; k -= 1) {
    const x = list[k];
    if (x.endedAt == null || x.kind || x.skipped) continue;
    return now - x.endedAt < DAY ? x : null;
  }
  return null;
}

export function useSessions(): Session[] {
  return useSyncExternalStore(subscribe, () => sessions, () => sessions);
}
