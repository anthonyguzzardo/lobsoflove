import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Fighter } from '@/lib/roster';

export type SetScore = [number, number];

export type Match = {
  id: string;
  /** Always the device owner for now; the opponent confirms once the backend exists. */
  p1: string;
  p2: string;
  court: string;
  /** Venue id from the baked court data; absent on matches logged before courts existed. */
  courtId?: string;
  photoUri: string | null;
  sets: SetScore[];
  playedAt: number;
  /** How long it lasted, when the player wrote it down. */
  minutes?: number;
};

export const POINTS = { win: 100, loss: 25, straightSets: 20, comeback: 30, upset: 50 } as const;

export function setsWon(sets: SetScore[]): [number, number] {
  let a = 0;
  let b = 0;
  for (const [x, y] of sets) {
    if (x > y) a += 1;
    else if (y > x) b += 1;
  }
  return [a, b];
}

/** Null when the score does not decide a winner yet. */
export function winnerOf(m: Pick<Match, 'p1' | 'p2' | 'sets'>): string | null {
  if (m.sets.length === 0 || m.sets.some(([x, y]) => x === y)) return null;
  const [a, b] = setsWon(m.sets);
  return a === b ? null : a > b ? m.p1 : m.p2;
}

export type Row = { id: string; points: number; wins: number; losses: number; streak: number };
export type Award = { matchId: string; winner: string; loser: string; winnerPoints: number; loserPoints: number; bonuses: string[]; rankAfter: Record<string, number> };

function rank(rows: Map<string, Row>): Record<string, number> {
  const sorted = [...rows.values()].sort((x, y) => y.points - x.points || y.wins - x.wins);
  return Object.fromEntries(sorted.map((r, i) => [r.id, i + 1]));
}

/** Replays every match in order so the upset bonus uses the standings as they were before that match. */
export function computeSeason(roster: Fighter[], matches: Match[]): { rows: Row[]; awards: Record<string, Award> } {
  const rows = new Map<string, Row>(roster.map((f) => [f.id, { id: f.id, points: 0, wins: 0, losses: 0, streak: 0 }]));
  const awards: Record<string, Award> = {};
  for (const m of [...matches].sort((x, y) => x.playedAt - y.playedAt)) {
    const winner = winnerOf(m);
    const w = winner ? rows.get(winner) : undefined;
    const loserId = winner === m.p1 ? m.p2 : m.p1;
    const l = rows.get(loserId);
    if (!winner || !w || !l) continue;
    const before = rank(rows);
    const bonuses: string[] = [];
    let pts: number = POINTS.win;
    const [a, b] = setsWon(m.sets);
    const first = m.sets[0];
    const wonFirst = winner === m.p1 ? first[0] > first[1] : first[1] > first[0];
    if (Math.min(a, b) === 0 && m.sets.length > 1) { pts += POINTS.straightSets; bonuses.push(`STRAIGHT SETS +${POINTS.straightSets}`); }
    if (!wonFirst) { pts += POINTS.comeback; bonuses.push(`COMEBACK +${POINTS.comeback}`); }
    if (l.points > w.points && before[loserId] < before[winner]) { pts += POINTS.upset; bonuses.push(`UPSET +${POINTS.upset}`); }
    w.points += pts; w.wins += 1; w.streak = w.streak > 0 ? w.streak + 1 : 1;
    l.points += POINTS.loss; l.losses += 1; l.streak = l.streak < 0 ? l.streak - 1 : -1;
    awards[m.id] = { matchId: m.id, winner, loser: loserId, winnerPoints: pts, loserPoints: POINTS.loss, bonuses, rankAfter: rank(rows) };
  }
  const order = rank(rows);
  return { rows: [...rows.values()].sort((x, y) => order[x.id] - order[y.id]), awards };
}

const KEY = 'lol.matches.v1';
let matches: Match[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Match[]) : [];
    if (Array.isArray(parsed)) matches = parsed;
  } catch {
    // Unreadable storage: start with no matches.
  }
  emit();
}

/** Stamps the id and time (now, unless the player wrote when it was), stores the match, and returns its id. */
export function addMatch(input: Omit<Match, 'id' | 'playedAt'> & { playedAt?: number }): string {
  const playedAt = input.playedAt ?? Date.now();
  const m: Match = { ...input, id: `m${Date.now()}`, playedAt };
  matches = [...matches, m];
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(matches)).catch(() => {});
  return m.id;
}

/** Deletes a match (the "undo last match" command). */
export function removeMatch(id: string) {
  matches = matches.filter((m) => m.id !== id);
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(matches)).catch(() => {});
}

export function useMatches(): Match[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void load();
      return () => listeners.delete(l);
    },
    () => matches,
    () => matches,
  );
}

export function scoreLine(sets: SetScore[]): string {
  return sets.map(([x, y]) => `${x}–${y}`).join('  ');
}
