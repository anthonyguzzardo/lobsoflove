import { Easing } from 'react-native-reanimated';

/** Motion in numbers, from docs/mo-design (cheat sheet 03). Use these instead of adjectives. */
export const EASE = {
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  move: Easing.bezier(0.76, 0, 0.24, 1),
  exit: Easing.bezier(0.7, 0, 0.84, 0),
  pop: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

/** Damping ratios: 1.0 UI and text, 0.8 premium product, 0.5 playful characters. */
export const DAMPING = { ui: 1, premium: 0.8, playful: 0.5 } as const;

export const MS = { feedback: 140, move: 320, hero: 700, listStagger: 60 } as const;
