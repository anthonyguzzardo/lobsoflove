import { type AudioPlayer, createAudioPlayer } from 'expo-audio';
import { useSyncExternalStore } from 'react';

import raw from '@/data/anthems.json';
import type { ThemeId } from '@/lib/themes';

/**
 * One song per court stage, the way a skate game gives every level its track.
 * These are Apple's public 30-second previews (baked by scripts/build-anthems.mjs), streamed, never bundled, and always shown
 * with a link to the full song. Swapping in our own recordings later only means changing `previewUrl` to a bundled file.
 */
export type Anthem = { title: string; artist: string; year: string; trackId: number; previewUrl: string; link: string };
export const ANTHEMS = raw as Partial<Record<ThemeId, Anthem>>;

const LEVEL = 0.7;
const FADE_MS = 420;

let player: AudioPlayer | null = null;
let playing: ThemeId | null = null;
let muted = false;
let fade: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function ramp(p: AudioPlayer, from: number, to: number, done?: () => void) {
  const steps = 12;
  let i = 0;
  const id = setInterval(() => {
    i += 1;
    try { p.volume = from + ((to - from) * i) / steps; } catch { /* player already released */ }
    if (i >= steps) { clearInterval(id); done?.(); }
  }, FADE_MS / steps);
  return id;
}

function release(p: AudioPlayer) {
  try { p.pause(); p.remove(); } catch { /* already gone */ }
}

/** Cross-fade to this stage's song. Neighboring courts on the same stage keep the same song playing. */
export function playAnthem(theme: ThemeId) {
  const a = ANTHEMS[theme];
  if (!a || playing === theme) return;
  playing = theme;
  emit();
  const old = player;
  if (old) ramp(old, muted ? 0 : LEVEL, 0, () => release(old));
  try {
    const next = createAudioPlayer({ uri: a.previewUrl });
    next.loop = true;
    next.volume = 0;
    next.play();
    player = next;
    clearInterval(fade);
    if (!muted) fade = ramp(next, 0, LEVEL);
  } catch {
    player = null; // no network or no audio: the screen works silently
  }
}

export function stopAnthem() {
  const old = player;
  player = null;
  playing = null;
  clearInterval(fade);
  if (old) ramp(old, muted ? 0 : LEVEL, 0, () => release(old));
  emit();
}

export function toggleMute() {
  muted = !muted;
  if (player) { clearInterval(fade); fade = ramp(player, muted ? LEVEL : 0, muted ? 0 : LEVEL); }
  emit();
}

export function useAnthemMuted(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => muted, () => muted);
}
