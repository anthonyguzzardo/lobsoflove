import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { CastId } from '@/lib/roster';

/**
 * Who is at which court, now or later. No forms: you are somewhere because you jumped onto that island, and a friend is coming
 * because they dropped a marker for later. Until there is a server, the friends are local stand-ins (`demo`) on a schedule made
 * fresh from the clock, and only your own beacon is real (kept on this phone).
 */
export type Person = { name: string; color: string; cast: CastId; venue: string; at: number; demo?: boolean };

/** Your beacon: the island you jumped onto, and when. */
export type Beacon = { venue: string; at: number };

const KEY = 'lol.beacon.v1';
/** A beacon older than this is a session that is over. */
export const BEACON_HOURS = 3;

let beacon: Beacon | null = null;
let loaded = false;
/** Real friends at the courts while you are in a crew (src/lib/cloud.ts); null means use the stand-ins. */
let crewPeople: Person[] | null = null;
/** Where your beacon goes while you are in a crew. */
let pushBeacon: ((venue: string | null) => void) | null = null;

/** Called by the crew sync: who is at which court, and where your own beacon goes. */
export function setCrewPresence(people: Person[] | null, onBeacon: typeof pushBeacon = null) {
  crewPeople = people;
  pushBeacon = onBeacon;
  emit();
}

export function useCrewPeople(): Person[] | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => crewPeople,
    () => crewPeople,
  );
}
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const b = raw ? (JSON.parse(raw) as Beacon) : null;
    if (b && Date.now() - b.at < BEACON_HOURS * 3600 * 1000) beacon = b;
  } catch {
    // Unreadable storage: no beacon.
  }
  emit();
}

/** Jump onto `venue` (or off everything with null). */
export function setBeacon(venue: string | null) {
  beacon = venue ? { venue, at: Date.now() } : null;
  emit();
  pushBeacon?.(venue);
  if (beacon) AsyncStorage.setItem(KEY, JSON.stringify(beacon)).catch(() => {});
  else AsyncStorage.removeItem(KEY).catch(() => {});
}

export function useBeacon(): Beacon | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void load();
      return () => listeners.delete(l);
    },
    () => beacon,
    () => beacon,
  );
}

const MIN = 60 * 1000;
/** The next half hour at least `lead` minutes away: when a friend would say they'll be there. */
const halfHourAfter = (now: number, lead: number) => Math.ceil((now + lead * MIN) / (30 * MIN)) * 30 * MIN;
const tomorrowAt = (now: number, h: number, m: number) => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d.getTime(); };

/**
 * Stand-in friends, taken from how the group actually plays: two already at UCSD (one hitting serves), one coming after work,
 * one planning tomorrow at Roosevelt. Venue keys match src/data/venues.json `key`.
 */
export function demoFriends(now: number): Person[] {
  return [
    { name: 'DANIEL', color: '#ff8a1f', cast: 'comet', venue: 'ucsd', at: now - 15 * MIN, demo: true },
    { name: 'GARY', color: '#35d6ff', cast: 'bot', venue: 'ucsd', at: now - 5 * MIN, demo: true },
    { name: 'ARIA', color: '#9b6bff', cast: 'moon', venue: 'ucsd', at: halfHourAfter(now, 50), demo: true },
    { name: 'TROY', color: '#2fe08a', cast: 'rabbit', venue: 'roosevelt', at: tomorrowAt(now, 18, 30), demo: true },
  ];
}

/** What a headcount plays: one hits serves, two play singles, three play king of the court, four play doubles. */
export function formatFor(n: number, courts: number): string {
  if (n <= 1) return 'SERVES';
  if (n === 2) return 'SINGLES';
  if (n === 3) return 'KING OF THE COURT';
  if (n === 4) return 'DOUBLES';
  if (n === 5) return 'DOUBLES, ONE ROTATING';
  return courts > 1 ? 'TWO COURTS' : 'ROTATE IN';
}

/** "6:30", or "TMRW 6:30" when it is not today. */
export function clock(at: number, now: number): string {
  const d = new Date(at);
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/, '');
  const today = new Date(now).toDateString() === d.toDateString();
  return today ? t : `TMRW ${t}`;
}

/** The same, short enough for the sign on the island's edge. */
const SHORT = ['', 'SERVES', 'SINGLES', 'KOC', 'DOUBLES', 'DOUBLES +1'];

/**
 * One island's state for the page: who is here (in arrival order: the first one holds the court), who is coming and when, and
 * what that adds up to. No form asked for a format; the headcount says it, and the page shows it by where people stand.
 */
export function islandState(people: Person[], youHere: boolean, courts: number, now: number) {
  const here = people.filter((p) => p.at <= now).sort((a, b) => a.at - b.at);
  const later = people.filter((p) => p.at > now).sort((a, b) => a.at - b.at);
  const n = here.length + (youHere ? 1 : 0);
  const sameDay = (at: number) => new Date(at).toDateString() === new Date(now).toDateString();
  const today = later.filter((p) => sameDay(p.at));
  let next = '';
  if (today.length === 1) next = `${today[0].name} AT ${clock(today[0].at, now)} MAKES ${n + 1}: ${formatFor(n + 1, courts)}`;
  else if (today.length > 1) next = `${n + today.length} BY ${clock(today[today.length - 1].at, now)}: ${formatFor(n + today.length, courts)}`;
  else if (n === 3) next = 'ONE MORE FOR DOUBLES';
  else if (later.length) next = `NEXT: ${later[0].name} ${clock(later[0].at, now)}`;
  return {
    people: [
      ...here.map((p) => ({ name: p.name, color: p.color, cast: p.cast, here: true, time: '' })),
      ...later.map((p) => ({ name: p.name, color: p.color, cast: p.cast, here: false, time: clock(p.at, now) })),
    ],
    now: n ? `${n} HERE: ${formatFor(n, courts)}` : 'NOBODY HERE YET',
    next,
    sign: n ? `${n} HERE · ${SHORT[Math.min(n, 5)] || (courts > 1 ? '2 COURTS' : 'ROTATE')}` : later.length ? `NEXT ${clock(later[0].at, now)}` : '',
  };
}
