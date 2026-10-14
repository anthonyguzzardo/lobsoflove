import { type AudioPlayer, createAudioPlayer } from 'expo-audio';

/** Every sound is synthesized by scripts/build-sfx.mjs; nothing is sampled. */
const SOURCES = {
  tick: require('../../assets/sfx/tick.wav'),
  select: require('../../assets/sfx/select.wav'),
  slam: require('../../assets/sfx/slam.wav'),
  go: require('../../assets/sfx/go.wav'),
  swish: require('../../assets/sfx/swish.wav'),
  win: require('../../assets/sfx/win.wav'),
  bloop: require('../../assets/sfx/bloop.wav'),
  squish: require('../../assets/sfx/squish.wav'),
  drip: require('../../assets/sfx/drip.wav'),
  boing: require('../../assets/sfx/boing.wav'),
} as const;

export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};

export function sfx(name: Sfx, volume = 0.8) {
  try {
    const p = (players[name] ??= createAudioPlayer(SOURCES[name]));
    p.volume = volume;
    void p.seekTo(0);
    p.play();
  } catch {
    // Sound is decoration: a failed player must never break a tap.
  }
}
