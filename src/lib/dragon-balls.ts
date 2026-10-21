import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * The seven tennis-ball dragon balls hidden around the city on /fly. `round` picks where they are hidden (the page turns it into
 * seven spots), `got` is which stars you have this round, and `wishes` are what the dragon has granted you, kept for good.
 */
export type Wish = 'gold' | 'warp';
export type Hunt = { round: number; got: number[]; wishes: Partial<Record<Wish, true>> };

const KEY = 'lol.dragonballs.v1';
let hunt: Hunt = { round: 1, got: [], wishes: {} };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const save = () => { AsyncStorage.setItem(KEY, JSON.stringify(hunt)).catch(() => {}); };

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) hunt = { ...hunt, ...(JSON.parse(raw) as Hunt) };
  } catch {
    // Unreadable storage: start a fresh hunt.
  }
  emit();
}

/** You flew through the ball with this many stars. */
export function collectBall(star: number) {
  if (hunt.got.includes(star)) return;
  hunt = { ...hunt, got: [...hunt.got, star] };
  emit(); save();
}

/** The dragon granted a wish: keep it, and the balls scatter to new spots. `null` just scatters them. */
export function makeWish(wish: Wish | null) {
  hunt = { round: hunt.round + 1, got: [], wishes: wish ? { ...hunt.wishes, [wish]: true } : hunt.wishes };
  emit(); save();
}

export function useHunt(): Hunt {
  return useSyncExternalStore(
    (l) => { listeners.add(l); void load(); return () => listeners.delete(l); },
    () => hunt,
    () => hunt,
  );
}
