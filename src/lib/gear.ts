import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Match } from '@/lib/matches';

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
 * When a part is due: whichever comes first, matches played on it or days since it went on.
 * Rules of thumb: polyester strings go dead in about 15 matches or 3 months; an overgrip lasts about 5 matches or a month;
 * an open can of balls goes flat in about 3 matches or 2 weeks; court shoes wear through in about 50 matches or 6 months.
 */
export const LIFE: Record<Service, { matches: number; days: number; word: string; verb: string }> = {
  strings: { matches: 15, days: 90, word: 'STRINGS', verb: 'RESTRING' },
  overgrip: { matches: 5, days: 30, word: 'OVERGRIP', verb: 'NEW OVERGRIP' },
  soles: { matches: 50, days: 180, word: 'SOLES', verb: 'NEW PAIR' },
  can: { matches: 3, days: 14, word: 'OPEN CAN', verb: 'CRACK A NEW CAN' },
};
// The overgrip is not tracked: a racket wears out by its strings.
export const SERVICES: Record<GearKind, Service[]> = { racket: ['strings'], shoes: ['soles'], balls: ['can'], grips: [] };
/** Reorder when the shelf or bin is down to this many. */
export const REORDER_AT: Partial<Record<GearKind, number>> = { balls: 1, grips: 2 };
export const MAX: Record<GearKind, number> = { racket: 3, shoes: 6, balls: 1, grips: 1 };

const DAY = 86_400_000;

export type Wear = { service: Service; since: number; matches: number; days: number; /** 0 fresh, 1 due, above 1 overdue. */ worn: number };

export function wearOf(item: GearItem, service: Service, matches: Match[], now = Date.now()): Wear {
  const since = item.serviced[service] ?? item.addedAt;
  const played = matches.filter((m) => m.playedAt > since).length;
  const days = Math.max(0, Math.floor((now - since) / DAY));
  const life = LIFE[service];
  return { service, since, matches: played, days, worn: Math.max(played / life.matches, days / life.days) };
}

export function lowStock(item: GearItem): boolean {
  const at = REORDER_AT[item.kind];
  return at != null && (item.stock ?? 0) <= at;
}

/** Plain-words list of what needs doing, most urgent first. */
export function dueList(items: GearItem[], matches: Match[], now = Date.now()): string[] {
  const out: { worn: number; text: string }[] = [];
  for (const it of items) {
    for (const s of SERVICES[it.kind]) {
      const w = wearOf(it, s, matches, now);
      if (w.worn >= 1) out.push({ worn: w.worn, text: `${it.name}: ${LIFE[s].verb.toLowerCase()}` });
    }
    if (lowStock(it)) out.push({ worn: 0.99, text: `${it.kind === 'balls' ? 'balls' : 'overgrips'}: order more` });
  }
  return out.sort((a, b) => b.worn - a.worn).map((o) => o.text);
}

const KEY = 'lol.gear.v1';
const ITEMS_KEY = 'lol.closet.v1';
let entries: GearEntry[] = [];
let items: GearItem[] = [];
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
    const [raw, rawItems] = await Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(ITEMS_KEY)]);
    const parsed = raw ? (JSON.parse(raw) as GearEntry[]) : [];
    if (Array.isArray(parsed)) entries = parsed;
    const parsedItems = rawItems ? (JSON.parse(rawItems) as GearItem[]) : null;
    items = Array.isArray(parsedItems) ? parsedItems : starter(Date.now());
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
export function setSetup(id: string, setup: StringSetup) { patch(id, (it) => ({ ...it, setup })); }
/** Details picked later: brand, model (it becomes the name), colors. */
export function updateItem(id: string, p: Partial<Pick<GearItem, 'brand' | 'model' | 'name' | 'colors'>>) { patch(id, (it) => ({ ...it, ...p })); }
export function renameItem(id: string, name: string) { patch(id, (it) => ({ ...it, name })); }
export function setPhoto(id: string, photo: string) { patch(id, (it) => ({ ...it, photo })); }
export function removeItem(id: string) { set(items.filter((it) => it.id !== id)); }
/** Done with it: it leaves the closet and is planted in the domain, wear history and all. */
export function retireItem(id: string, at = Date.now()) { patch(id, (it) => ({ ...it, retiredAt: at })); }
export function service(id: string, s: Service, at = Date.now()) { patch(id, (it) => withJob(it, s, at)); }
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
