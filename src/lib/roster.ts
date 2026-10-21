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
  /** In a crew: a friend someone added by name who has not installed the app yet. Their matches wait for them to confirm. */
  pretender?: boolean;
  /** A bot player (DBZ, tennis legends, JJK): joins when invited, agrees with every score. */
  bot?: boolean;
  /** Drawn face code (src/lib/faces.ts); none is the plain jelly face. */
  face?: string;
};

export const CAST: Record<CastId, { label: string; tagline: string }> = {
  wall: { label: 'The Wall', tagline: "Hit it harder. It's still coming back." },
  moon: { label: 'Moonballer', tagline: "I'll put it twelve feet up. All day." },
  bot: { label: 'Serve Bot', tagline: "Ace or double. I don't do rallies." },
  goblin: { label: 'Dropshot Goblin', tagline: "I drop it short. Then shorter." },
  grunter: { label: 'The Grunter', tagline: "You'll hear me three courts over." },
  junk: { label: 'Junkballer', tagline: "No pace. No spin. I still win." },
  comet: { label: 'Net Rusher', tagline: "I chip. I charge. I pray." },
  ghost: { label: 'The No-Show', tagline: "Running five late. Start without me." },
  lobber: { label: 'Got You, Bitch', tagline: "Come to the net. I dare you." },
  rabbit: { label: 'The Jackrabbit', tagline: "I'm faster than a certain blue hedgehog." },
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
/** The shared roster while you are in a crew (src/lib/cloud.ts). The phone's own roster stays saved underneath it. */
let crew: Fighter[] | null = null;
/** Where an edit to your own fighter goes while you are in a crew. */
let pushYou: ((f: Fighter) => void) | null = null;
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
  // Your own fighter is kept on the phone too, so leaving a crew keeps the one you made.
  if (next.isYou || roster.some((f) => f.id === next.id)) {
    roster = roster.map((f) => (f.isYou && next.isYou ? { ...next, id: f.id } : f.id === next.id ? next : f));
    AsyncStorage.setItem(KEY, JSON.stringify(roster)).catch(() => {});
  }
  if (crew && next.isYou) {
    crew = crew.map((f) => (f.isYou ? { ...next, id: f.id } : f));
    pushYou?.(next);
  }
  emit();
}

/** Your fighter as saved on this phone, even while a crew roster is showing. */
export async function localYou(): Promise<Fighter> {
  await load();
  return roster.find((f) => f.isYou) ?? you;
}

/** Called by the crew sync: the shared roster (or null to go back to this phone's), and where edits to you go. */
export function setCrewRoster(next: Fighter[] | null, onSaveYou: ((f: Fighter) => void) | null = null) {
  crew = next;
  pushYou = onSaveYou;
  emit();
}

export function useRoster(): Fighter[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void load();
      return () => listeners.delete(l);
    },
    () => crew ?? roster,
    () => crew ?? roster,
  );
}
