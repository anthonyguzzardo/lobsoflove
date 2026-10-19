import { useSyncExternalStore } from 'react';

import raw from '@/data/courts.json';
import { counts, type Match, winnerOf } from '@/lib/matches';

/** A tennis venue baked from OpenStreetMap by scripts/build-courts.mjs (© OpenStreetMap contributors, ODbL). */
export type Court = { id: string; name: string; area: string | null; lat: number; lng: number; count: number; surface: string | null; lit: boolean | null };

export const COURTS = raw as Court[];

/** Until the app asks for location, distances are measured from the middle of the UC San Diego campus. */
export const HOME = { lat: 32.8801, lng: -117.234 };

export function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = (a.lat - b.lat) * 69.17;
  const dx = (a.lng - b.lng) * 69.17 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

export const COURTS_BY_DISTANCE = [...COURTS].sort((a, b) => miles(a, HOME) - miles(b, HOME));

export function courtById(id: string | null | undefined): Court | undefined {
  return id ? COURTS.find((c) => c.id === id) : undefined;
}

export type CourtStats = {
  played: number;
  /** Who holds the belt here: the winner of the last confirmed match at this court. */
  king: string | null;
  /** The holder's wins at this court. */
  kingWins: number;
  /** When the holder took the belt. */
  since: number | null;
  record: (id: string) => [number, number];
};

/** One court's history. Only matches that count (confirmed in a crew, or kept on this phone) move the belt or the records. */
export function courtStats(courtId: string, matches: Match[]): CourtStats {
  const here = matches.filter((m) => m.courtId === courtId && counts(m)).sort((a, b) => a.playedAt - b.playedAt);
  let king: string | null = null;
  let since: number | null = null;
  for (const m of here) {
    const w = winnerOf(m);
    if (!w) continue;
    if (w !== king) { king = w; since = m.playedAt; }
  }
  const record = (id: string): [number, number] => {
    let w = 0;
    let l = 0;
    for (const m of here) {
      if (m.p1 !== id && m.p2 !== id) continue;
      if (winnerOf(m) === id) w += 1;
      else l += 1;
    }
    return [w, l];
  };
  return { played: here.length, king, kingWins: king ? record(king)[0] : 0, since, record };
}

let picked: string | null = null;
const listeners = new Set<() => void>();

export function pickCourt(id: string) {
  picked = id;
  listeners.forEach((l) => l());
}

export function usePickedCourt(): string | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => picked, () => picked);
}
