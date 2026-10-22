import { type AudioPlayer, createAudioPlayer } from 'expo-audio';

import { soundOn } from '@/lib/sound';

/** Every sound is synthesized by scripts/build-sfx.mjs; nothing is sampled. */
const SOURCES = {
  tick: require('../../assets/sfx/tick.wav'),
  select: require('../../assets/sfx/select.wav'),
  slam: require('../../assets/sfx/slam.wav'),
  go: require('../../assets/sfx/go.wav'),
  swish: require('../../assets/sfx/swish.wav'),
  win: require('../../assets/sfx/win.wav'),
  bloop: require('../../assets/sfx/bloop.wav'),
  drip: require('../../assets/sfx/drip.wav'),
  grunt: require('../../assets/sfx/grunt.wav'),
  pock: require('../../assets/sfx/pock.wav'),
  bounce: require('../../assets/sfx/bounce.wav'),
  can: require('../../assets/sfx/can.wav'),
  squeak: require('../../assets/sfx/squeak.wav'),
  clack: require('../../assets/sfx/clack.wav'),
  ping: require('../../assets/sfx/ping.wav'),
} as const;

export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};

export function sfx(name: Sfx, volume = 0.8) {
  if (!soundOn()) return;
  try {
    const p = (players[name] ??= createAudioPlayer(SOURCES[name]));
    p.volume = volume;
    void p.seekTo(0);
    p.play();
  } catch {
    // Sound is decoration: a failed player must never break a tap.
  }
}
