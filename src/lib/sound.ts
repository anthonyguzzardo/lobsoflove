import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** The one switch for every sound in the app: taps, the courts songs, the fly page's aura. Remembered on this phone. */
const KEY = 'sound:on';

let on = true;
const listeners = new Set<(on: boolean) => void>();

/** Called with the new value whenever sound flips. Pages that play audio themselves subscribe here. */
export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function soundOn() {
  return on;
}

export function setSound(next: boolean) {
  if (next === on) return;
  apply(next);
  void AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => {});
}

function apply(next: boolean) {
  on = next;
  listeners.forEach((l) => l(on));
}

export function useSound(): boolean {
  return useSyncExternalStore(onSoundChange, () => on, () => on);
}

// Read the saved choice once at launch. Until it lands, sound stays on, the default.
void AsyncStorage.getItem(KEY).then((v) => { if (v !== null) apply(v === '1'); }).catch(() => {});
