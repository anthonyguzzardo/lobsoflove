// Tennis legends: drawn faces (see faces-kit.ts for the canvas and parts). Friendly caricatures, each carried by a signature
// trait: Federer's headband and waves, Nadal's bandana, Sinner's red curls, Medvedev's long face, Gauff's cap.
import { circle, INK, line, p, SKIN, type Spec } from './faces-kit';

// ------------------------------------------------------------ custom parts ---

/** A day's growth along the jaw and lip, no outline. */
const stubble = (o = 0.2) => `<path d="M26 64 Q29 87 50 88 Q71 87 74 64 Q68 82 50 82 Q32 82 26 64 Z" fill="rgba(45,30,20,${o})"/>`
  + `<path d="M41 69 Q50 66 59 69 L58 71 Q50 69 42 71 Z" fill="rgba(45,30,20,${o})"/>`;

/** A full beard and moustache in hair color. The mouth draws over it. */
const beard = (c: string) => p('M26 62 Q27 90 50 92 Q73 90 74 62 Q70 76 61 76 Q56 69 50 70 Q44 69 39 76 Q30 76 26 62 Z', c);

/** A thin moustache with a chin tuft. */
const goatee = (c: string) => p('M41 70 Q50 66 59 70 L58 72.5 Q50 69 42 72.5 Z', c) + p('M46 81 Q50 87 54 81 Q50 83 46 81 Z', c);

/** A ball cap, brim to the front. */
const cap = (c: string, brim = c) =>
  p('M24 50 Q23 24 50 22 Q77 24 76 50 Q50 44 24 50 Z', c) + line('M50 23 L50 46', INK, 1.6) + circle(50, 23, 2.2, c)
  + p('M21 50 Q50 41 79 50 Q80 56 72 55 Q50 49 28 55 Q20 56 21 50 Z', brim);

/** A visor: a band and a brim, hair showing over the top. */
const visor = (c: string) => p('M24 44 Q50 38 76 44 L76 50 Q50 44 24 50 Z', c) + p('M21 50 Q50 42 79 50 Q80 56 72 55 Q50 49 28 55 Q20 56 21 50 Z', c);

/** Curls all round the head, for big natural or wavy hair. */
const halo = (c: string, r = 9, rad = 29) =>
  Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI * (0.98 + (i / 12) * 1.04);
    return circle(+(50 + Math.cos(a) * rad).toFixed(1), +(52 + Math.sin(a) * rad * 0.95).toFixed(1), r, c);
  }).join('');

/** Big round frames, colored. */
const frames = (c: string) =>
  `<rect x="29" y="51" width="18" height="14" rx="6" fill="rgba(255,255,255,0.25)" stroke="${c}" stroke-width="3.2"/>`
  + `<rect x="53" y="51" width="18" height="14" rx="6" fill="rgba(255,255,255,0.25)" stroke="${c}" stroke-width="3.2"/>` + line('M47 57 L53 57', c, 3);

/** A pearl strand at the collar. */
const pearls = Array.from({ length: 7 }, (_, i) => circle(38 + i * 4, 90 + Math.abs(i - 3) * -0.6 + 1.5, 1.8, '#fbf8ee', false)).join('');

/** A thin gold chain at the collar. */
const chain = line('M36 86 Q50 96 64 86', '#d9b23a', 2);

/** A long face, for Medvedev. */
const longHead = (skin: string) => `<ellipse cx="50" cy="60" rx="22" ry="32" fill="${skin}" stroke="${INK}" stroke-width="2.6"/>`;

// ------------------------------------------------------------------ faces ---

export const TENNIS: Record<string, Spec> = {
  // Waves over a white band, easy smile.
  federer: {
    skin: SKIN.light, hair: 'short', hairColor: '#5a3b24', eyes: 'calm', eyeColor: '#5a3b24', brows: 'flat', mouth: 'smile', collar: '#f4f1e6',
    extras: ['headband'], band: '#f4f1e6',
    front: p('M28 44 Q24 28 38 24 Q44 16 54 20 Q64 16 70 24 Q78 30 73 44 Q62 34 50 36 Q38 34 28 44 Z', '#5a3b24')
      + line('M40 26 Q44 30 42 36', '#3a2614', 1.6) + line('M58 24 Q60 30 56 35', '#3a2614', 1.6),
    under: stubble(0.12),
  },
  // The 2005 look: long hair, bandana, the fist-pump teeth.
  nadal: { skin: SKIN.tan, hair: 'long', hairColor: '#3b2414', eyes: 'fierce', eyeColor: '#3b2414', brows: 'thick', mouth: 'teeth', collar: '#d7f205', extras: ['bandana'], band: '#1aa36f' },
  // Short dark hair with a little height, the big grin, stubble.
  djokovic: {
    skin: SKIN.light, hair: 'short', hairColor: '#2a1d14', eyes: 'calm', eyeColor: '#3a6b3a', brows: 'thick', mouth: 'grin', collar: '#1f3d99',
    front: p('M30 40 Q34 24 50 24 Q66 24 70 40 Q60 33 50 35 Q40 33 30 40 Z', '#2a1d14'), under: stubble(0.24),
  },
  // Honey-blond curls piled up high, gold hoops.
  serena: {
    skin: SKIN.deep, hair: 'bun', hairColor: '#a8783a', eyes: 'wide', eyeColor: '#3a2414', brows: 'raised', mouth: 'grin', collar: '#e0218a', extras: ['earrings'],
    back: [[40, 20], [50, 15], [60, 20], [45, 26], [56, 26]].map(([x, y]) => circle(x, y, 8, '#a8783a')).join(''),
  },
  // A big cloud of black curls.
  venus: {
    skin: SKIN.deep, hair: 'none', hairColor: '#1b1b22', eyes: 'calm', eyeColor: '#3a2414', brows: 'flat', mouth: 'smile', collar: '#ffd23f',
    back: halo('#1b1b22', 10, 30), front: p('M30 44 Q34 28 50 27 Q66 28 70 44 Q60 36 50 38 Q40 36 30 44 Z', '#1b1b22'),
  },
  // The 90s: bandana, mullet, an earring.
  agassi: { skin: SKIN.medium, hair: 'mullet', hairColor: '#8a5a2b', eyes: 'calm', eyeColor: '#3b2414', brows: 'flat', mouth: 'smirk', collar: '#ff5fa2', extras: ['bandana', 'earrings'], band: '#16181d', under: stubble(0.14) },
  // Curls, red band, mid-argument.
  mcenroe: { skin: SKIN.light, hair: 'curly', hairColor: '#5a3b24', eyes: 'fierce', eyeColor: '#2f5b8a', brows: 'angry', mouth: 'open', collar: '#f4f1e6', extras: ['headband'], band: '#d1203a' },
  // Long blond hair, striped band, ice cold.
  borg: { skin: SKIN.light, hair: 'long', hairColor: '#e8c870', eyes: 'calm', eyeColor: '#3a7bd5', brows: 'flat', mouth: 'flat', collar: '#f4f1e6', extras: ['headband', 'stripes'], band: '#f4f1e6', under: stubble(0.1) },
  // Blond ponytail, blue eyes, quiet smile.
  graf: { skin: SKIN.fair, hair: 'ponytail', hairColor: '#e2b858', eyes: 'calm', eyeColor: '#3a7bd5', brows: 'flat', mouth: 'smile', collar: '#f4f1e6' },
  // Tight dark curls, heavy brows, the shy grin.
  sampras: {
    skin: SKIN.medium, hair: 'none', hairColor: '#2a1d14', eyes: 'calm', eyeColor: '#3b2414', brows: 'thick', mouth: 'smirk', collar: '#3a86ff',
    front: [[28, 48], [30, 38], [37, 31], [46, 27], [55, 27], [63, 31], [70, 38], [72, 48]].map(([x, y]) => circle(x, y, 6, '#2a1d14')).join('')
      + p('M30 46 Q34 32 50 30 Q66 32 70 46 Q60 38 50 40 Q40 38 30 46 Z', '#2a1d14'),
  },
  // Short platinum hair, the big smile.
  navratilova: {
    skin: SKIN.fair, hair: 'short', hairColor: '#ece4cc', eyes: 'calm', eyeColor: '#3a7bd5', brows: 'flat', mouth: 'grin', collar: '#06d6a0',
    front: p('M26 50 Q24 30 42 26 Q56 22 68 30 Q76 36 74 50 Q66 38 52 38 Q38 36 26 50 Z', '#ece4cc'),
  },

  // Man bun, black band, stubble.
  zverev: {
    skin: SKIN.light, hair: 'bun', hairColor: '#8a6a3a', eyes: 'calm', eyeColor: '#3a6b8a', brows: 'flat', mouth: 'flat', collar: '#16181d',
    extras: ['headband'], band: '#16181d', under: stubble(0.22),
  },
  // Messy short brown hair, long jaw, determined.
  murray: {
    skin: SKIN.fair, hair: 'yuta', hairColor: '#4a3020', eyes: 'calm', eyeColor: '#3a6b8a', brows: 'angry', mouth: 'flat', collar: '#2fe08a',
    head: `<ellipse cx="50" cy="59" rx="24" ry="30" fill="${SKIN.fair}" stroke="${INK}" stroke-width="2.6"/>`, under: stubble(0.16),
  },
  // Pulled-back bun, gold chain and hoops, confident.
  sabalenka: {
    skin: SKIN.light, hair: 'bun', hairColor: '#9a7046', eyes: 'fierce', eyeColor: '#5a7a3a', brows: 'flat', mouth: 'smile', collar: '#ff3d7f',
    extras: ['earrings'], over: chain,
  },
  // Big dark curls, the biggest smile on tour.
  shelton: {
    skin: SKIN.tan, hair: 'curly', hairColor: '#2a1d14', eyes: 'closed', brows: 'raised', mouth: 'grin', collar: '#f4e6d0',
    back: [[30, 30], [50, 20], [70, 30], [40, 22], [60, 22]].map(([x, y]) => circle(x, y, 9, '#2a1d14')).join(''),
  },
  // Short brown hair, pink frames, pearls.
  billie_jean: {
    skin: SKIN.fair, hair: 'none', hairColor: '#6b4428', eyes: 'calm', eyeColor: '#3b2414', brows: 'raised', mouth: 'grin', collar: '#1b1f3a',
    front: p('M24 60 Q18 30 40 24 Q56 18 70 26 Q82 34 76 60 Q74 44 64 40 Q52 34 38 40 Q28 44 24 60 Z', '#6b4428'),
    over: frames('#ff3d7f') + pearls,
  },
  // Short dark hair with height on top, the grin.
  alcaraz: {
    skin: SKIN.light, hair: 'none', hairColor: '#241810', eyes: 'calm', eyeColor: '#3b2414', brows: 'thick', mouth: 'grin', collar: '#16181d',
    front: p('M26 52 Q22 34 34 28 Q42 16 58 18 Q74 20 75 36 L75 52 Q72 40 62 38 Q48 40 36 38 Q28 42 26 52 Z', '#241810'),
  },
  // Navy cap, braids down the back.
  gauff: {
    skin: SKIN.deep, hair: 'none', hairColor: '#1b1b22', eyes: 'calm', eyeColor: '#2a1a10', brows: 'flat', mouth: 'smile', collar: '#e8eef4',
    back: p('M66 46 Q84 52 80 90 L72 90 Q74 60 64 52 Z', '#1b1b22') + line('M72 56 L78 62 M71 64 L78 70 M72 72 L78 78 M73 80 L78 86', '#4a4a55', 1.4),
    over: cap('#1f2f5a', '#1f2f5a'),
  },
  // The long face, short messy hair, deadpan.
  medvedev: {
    skin: SKIN.fair, hair: 'none', hairColor: '#6b4a30', eyes: 'calm', eyeColor: '#5a6b3a', brows: 'flat', mouth: 'flat', collar: '#f4f1e6', noEars: false,
    head: longHead(SKIN.fair),
    front: p('M28 44 Q26 26 42 24 Q50 20 58 23 Q74 26 72 44 L68 36 L62 40 L58 32 L52 38 L46 32 L40 38 L34 34 Z', '#6b4a30'),
    under: stubble(0.12),
  },
  // White cap, ponytail, calm.
  rybakina: {
    skin: SKIN.fair, hair: 'ponytail', hairColor: '#c09060', eyes: 'calm', eyeColor: '#5a6b3a', brows: 'flat', mouth: 'smile', collar: '#35d6ff',
    over: cap('#fbfbf7'),
  },
  // Dark hair swept back into a ponytail, all smile.
  raducanu: {
    skin: SKIN.fair, hair: 'ponytail', hairColor: '#1f1612', eyes: 'closed', brows: 'raised', mouth: 'grin', collar: '#7a8cff',
  },
  // White band, short hair, the moustache and chin tuft, a chain.
  tiafoe: {
    skin: SKIN.deep, hair: 'short', hairColor: '#1b1b22', eyes: 'calm', eyeColor: '#2a1a10', brows: 'flat', mouth: 'smile', collar: '#d1203a',
    extras: ['headband'], band: '#fbfbf7', under: goatee('#1b1b22'), over: chain,
  },
  // Light blue cap, brown ponytail, locked in.
  swiatek: {
    skin: SKIN.fair, hair: 'ponytail', hairColor: '#5a3b24', eyes: 'fierce', eyeColor: '#5a3b24', brows: 'flat', mouth: 'flat', collar: '#16181d',
    over: cap('#9cc3ff'),
  },
  // Red curls, pale, freckles.
  sinner: {
    skin: SKIN.fair, hair: 'none', hairColor: '#d4612a', eyes: 'calm', eyeColor: '#3a6b8a', brows: 'flat', mouth: 'smile', collar: '#e85a1a',
    front: [[27, 50], [28, 39], [34, 31], [43, 26], [53, 25], [62, 28], [69, 34], [73, 44], [73, 52], [40, 36], [52, 34], [62, 38]]
      .map(([x, y]) => circle(x, y, 7, '#d4612a')).join(''),
    under: [[36, 66], [39, 68], [61, 66], [64, 68], [42, 65], [58, 65]].map(([x, y]) => circle(x, y, 1, '#c86a3a', false)).join(''),
  },
  // The 70s bowl cut, wide-eyed fire.
  connors: {
    skin: SKIN.light, hair: 'none', hairColor: '#5a3b24', eyes: 'wide', eyeColor: '#3a6b8a', brows: 'raised', mouth: 'smirk', collar: '#c8102e',
    front: p('M22 64 Q18 26 50 24 Q82 26 78 64 L73 64 Q74 52 70 47 L30 47 Q26 52 27 64 Z', '#5a3b24'),
  },
  // Long straight brown hair, center part, cool.
  sharapova: {
    skin: SKIN.fair, hair: 'long', hairColor: '#6b4423', eyes: 'calm', eyeColor: '#3a7b6a', brows: 'flat', mouth: 'smile', collar: '#16181d',
  },
  // Curls under a blue visor.
  osaka: {
    skin: SKIN.brown, hair: 'none', hairColor: '#3a2416', eyes: 'closed', brows: 'raised', mouth: 'grin', collar: '#fbfbf7',
    back: halo('#3a2416', 9, 29), front: p('M28 46 Q34 32 50 31 Q66 32 72 46 Q60 40 50 41 Q40 40 28 46 Z', '#3a2416'), over: visor('#2f5bd8'),
  },
  // Shaved sides, dark top, stubble, swagger.
  kyrgios: {
    skin: SKIN.medium, hair: 'none', hairColor: '#1b1b22', eyes: 'fierce', eyeColor: '#3b2414', brows: 'thick', mouth: 'smirk', collar: '#fbfbf7',
    under: stubble(0.24), extras: ['earrings'],
    front: p('M25 60 Q23 40 30 33 L70 33 Q77 40 75 60 Q72 46 66 42 L34 42 Q28 46 25 60 Z', '#5a5058')
      + p('M30 41 Q29 22 50 20 Q71 22 70 41 Q60 36 50 37 Q40 36 30 41 Z', '#1b1b22'),
  },
  // Dark hair up in a bun, warm smile.
  jabeur: {
    skin: SKIN.tan, hair: 'bun', hairColor: '#241810', eyes: 'calm', eyeColor: '#3b2414', brows: 'thick', mouth: 'smile', collar: '#fbfbf7',
  },
  // Long wavy hair, black band, beard.
  tsitsipas: {
    skin: SKIN.light, hair: 'long', hairColor: '#8a6038', eyes: 'calm', eyeColor: '#3a6b8a', brows: 'flat', mouth: 'flat', collar: '#e8e0c8',
    extras: ['headband'], band: '#16181d', under: beard('#8a6038'),
  },
  // White band, swept hair, stubble.
  fritz: {
    skin: SKIN.light, hair: 'short', hairColor: '#6b4a30', eyes: 'calm', eyeColor: '#3a6b8a', brows: 'flat', mouth: 'smirk', collar: '#2ad1c9',
    extras: ['headband'], band: '#fbfbf7', under: stubble(0.18),
  },
};
