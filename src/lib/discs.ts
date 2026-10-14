import type { CastId } from '@/lib/roster';

/** CD labels rendered by scripts/build-discs.py, one per fighter style. */
export const DISC_ART: Record<CastId, number> = {
  wall: require('../../assets/discs/wall.png'),
  moon: require('../../assets/discs/moon.png'),
  bot: require('../../assets/discs/bot.png'),
  goblin: require('../../assets/discs/goblin.png'),
  grunter: require('../../assets/discs/grunter.png'),
  junk: require('../../assets/discs/junk.png'),
  comet: require('../../assets/discs/comet.png'),
  ghost: require('../../assets/discs/ghost.png'),
};
