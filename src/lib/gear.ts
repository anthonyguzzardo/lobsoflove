import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** Something done to your gear: a restring, a regrip, new shoes. */
export type GearEntry = { id: string; item: string; cost: number | null; at: number };

const KEY = 'lol.gear.v1';
let entries: GearEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as GearEntry[]) : [];
    if (Array.isArray(parsed)) entries = parsed;
  } catch {
    // Unreadable storage: start with an empty log.
  }
  emit();
}

export function addGear(input: Omit<GearEntry, 'id'>): string {
  const e: GearEntry = { ...input, id: `g${Date.now()}` };
  entries = [...entries, e];
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {});
  return e.id;
}

export function useGear(): GearEntry[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void load();
      return () => listeners.delete(l);
    },
    () => entries,
    () => entries,
  );
}
