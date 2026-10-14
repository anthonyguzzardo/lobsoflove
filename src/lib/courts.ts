import { useSyncExternalStore } from 'react';

import raw from '@/data/courts.json';
import { type Match, winnerOf } from '@/lib/matches';

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

export type CourtStats = { played: number; king: string | null; kingWins: number; record: (id: string) => [number, number] };

export function courtStats(courtId: string, matches: Match[]): CourtStats {
  const here = matches.filter((m) => m.courtId === courtId);
  const wins = new Map<string, number>();
  for (const m of here) {
    const w = winnerOf(m);
    if (w) wins.set(w, (wins.get(w) ?? 0) + 1);
  }
  const top = [...wins.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    played: here.length,
    king: top?.[0] ?? null,
    kingWins: top?.[1] ?? 0,
    record: (id) => {
      let w = 0;
      let l = 0;
      for (const m of here) {
        if (m.p1 !== id && m.p2 !== id) continue;
        if (winnerOf(m) === id) w += 1;
        else l += 1;
      }
      return [w, l];
    },
  };
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
