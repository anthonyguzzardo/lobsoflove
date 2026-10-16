import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Fighter } from '@/lib/roster';
import type { SetScore } from '@/lib/tennis';

export type { SetScore };

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

/**
 * Season points. A win is 100. A loss still pays for showing up, but less each time inside a week (25, 15, then 5), so losing a lot
 * never outscores winning. Upsets pay by how far up the table you reached. A love set (6-0) and a won tiebreak (7-6) pay per set.
 */
export const POINTS = { win: 100, loss: [25, 15, 5], straightSets: 20, comeback: 30, upsetBase: 20, upsetPerRank: 15, upsetMax: 80, loveSet: 15, tiebreak: 10 } as const;
const WEEK = 7 * 24 * 3600 * 1000;

/** A third set that went past 9 was a first-to-10 match tiebreak. */
export const isMatchTiebreak = (sets: SetScore[], i: number) => i === 2 && Math.max(...sets[i]) >= 10;

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
  const lossesAt = new Map<string, number[]>();
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
    const wonSet = (x: number, y: number) => (winner === m.p1 ? [x, y] : [y, x]);
    if (Math.min(a, b) === 0 && m.sets.length > 1) { pts += POINTS.straightSets; bonuses.push(`STRAIGHT SETS +${POINTS.straightSets}`); }
    if (!wonFirst) { pts += POINTS.comeback; bonuses.push(`COMEBACK +${POINTS.comeback}`); }
    const gap = before[winner] - before[loserId];
    if (l.points > w.points && gap > 0) {
      const up = Math.min(POINTS.upsetMax, POINTS.upsetBase + POINTS.upsetPerRank * gap);
      pts += up; bonuses.push(`UPSET +${up}`);
    }
    const loves = m.sets.filter(([x, y]) => { const [p, q] = wonSet(x, y); return p === 6 && q === 0; }).length;
    if (loves) { pts += loves * POINTS.loveSet; bonuses.push(`${loves > 1 ? `${loves} LOVE SETS` : 'LOVE SET'} +${loves * POINTS.loveSet}`); }
    const breakers = m.sets.filter(([x, y]) => { const [p, q] = wonSet(x, y); return p === 7 && q === 6; }).length;
    if (breakers) { pts += breakers * POINTS.tiebreak; bonuses.push(`${breakers > 1 ? `${breakers} TIEBREAKS` : 'TIEBREAK'} +${breakers * POINTS.tiebreak}`); }
    const recent = (lossesAt.get(loserId) ?? []).filter((t) => m.playedAt - t < WEEK);
    const lossPts = POINTS.loss[Math.min(recent.length, POINTS.loss.length - 1)];
    lossesAt.set(loserId, [...recent, m.playedAt]);
    w.points += pts; w.wins += 1; w.streak = w.streak > 0 ? w.streak + 1 : 1;
    l.points += lossPts; l.losses += 1; l.streak = l.streak < 0 ? l.streak - 1 : -1;
    awards[m.id] = { matchId: m.id, winner, loser: loserId, winnerPoints: pts, loserPoints: lossPts, bonuses, rankAfter: rank(rows) };
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
  return sets.map(([x, y], i) => (isMatchTiebreak(sets, i) ? `[${x}–${y}]` : `${x}–${y}`)).join('  ');
}
