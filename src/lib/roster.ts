import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type CastId = 'wall' | 'moon' | 'bot' | 'goblin' | 'grunter' | 'junk' | 'comet' | 'ghost' | 'lobber' | 'rabbit';

export type Fighter = {
  id: string;
  name: string;
  cast: CastId;
  color: string;
  bio: string;
  favoritePro: string;
  homeCourt: string;
  racket: string;
  isYou?: boolean;
  /** Placeholder slot until a real friend joins. */
  demo?: boolean;
};

export const CAST: Record<CastId, { label: string; tagline: string }> = {
  wall: { label: 'The Wall', tagline: 'Everything comes back.' },
  moon: { label: 'Moonballer', tagline: 'Twelve feet over the net, every time.' },
  bot: { label: 'Serve Bot', tagline: 'Ace or double fault. No third option.' },
  goblin: { label: 'Dropshot Goblin', tagline: 'You will run. You will not get there.' },
  grunter: { label: 'The Grunter', tagline: 'Heard from three courts away.' },
  junk: { label: 'Junkballer', tagline: 'No pace, no spin, no rhythm, no mercy.' },
  comet: { label: 'Net Rusher', tagline: 'Chip, charge, pray.' },
  ghost: { label: 'The No-Show', tagline: '"Running five late."' },
  lobber: { label: 'Got You, Bitch', tagline: "Come to the net. I dare you." },
  rabbit: { label: 'The Jackrabbit', tagline: 'Faster than a certain blue hedgehog.' },
};

export const CAST_IDS = Object.keys(CAST) as CastId[];

export const COLORS = ['#d7f205', '#ff3d7f', '#35d6ff', '#ff8a1f', '#9b6bff', '#2fe08a', '#ff5252', '#f4f1e6'];

const you: Fighter = {
  id: 'you', name: 'YOU', cast: 'wall', color: COLORS[0], isYou: true,
  bio: '', favoritePro: '', homeCourt: '', racket: '',
};

const demo = (id: string, cast: CastId, color: string): Fighter => ({
  id, cast, color, demo: true, name: CAST[cast].label.toUpperCase(),
  bio: CAST[cast].tagline, favoritePro: '', homeCourt: '', racket: '',
});

const SEED: Fighter[] = [
  you,
  demo('d1', 'goblin', COLORS[5]),
  demo('d2', 'bot', COLORS[2]),
  demo('d3', 'moon', COLORS[4]),
  demo('d4', 'grunter', COLORS[6]),
  demo('d5', 'junk', COLORS[3]),
  demo('d6', 'comet', COLORS[1]),
];

const KEY = 'lol.roster.v1';
let roster: Fighter[] = SEED;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Fighter[];
      if (Array.isArray(parsed) && parsed.some((f) => f.isYou)) roster = parsed;
    }
  } catch {
    // Unreadable storage: keep the seed roster.
  }
  emit();
}

export function saveFighter(next: Fighter) {
  roster = roster.map((f) => (f.id === next.id ? next : f));
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(roster)).catch(() => {});
}

export function useRoster(): Fighter[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void load();
      return () => listeners.delete(l);
    },
    () => roster,
    () => roster,
  );
}
