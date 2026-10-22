// Dragon Ball Z: drawn faces (see faces-kit.ts for the canvas and parts).
import { circle, INK, line, p, SKIN, type Spec } from './faces-kit';

const BLACK = '#1b1b22';
const WHITE = '#f4f4f2';

/** An almond eye in any color (Beerus, Shenron): left or right side. */
const almond = (side: -1 | 1, fill: string, pupil = true) => {
  const d = side < 0 ? 'M32 58 Q40 51 47 55 Q42 61 32 58 Z' : 'M68 58 Q60 51 53 55 Q58 61 68 58 Z';
  return p(d, fill) + (pupil ? circle(side < 0 ? 41.5 : 58.5, 56.8, 1.9, INK, false) : '');
};
/** Saiyan armor: cream chest plate with the yellow shoulder straps, over a collar. */
const armor = p('M16 100 Q18 88 32 86 L68 86 Q82 88 84 100 Z', '#f1ead2') + p('M22 100 Q24 90 34 88 L36 100 Z', '#e8c14a') + p('M78 100 Q76 90 66 88 L64 100 Z', '#e8c14a');
/** A V-neck of a second color inside the collar. */
const vee = (c: string) => p('M41 85 L50 97 L59 85 Z', c);

export const DBZ: Record<string, Spec> = {
  goku: { skin: SKIN.light, hair: 'goku', hairColor: BLACK, eyes: 'fierce', brows: 'angry', mouth: 'grin', collar: '#ff8a1f', over: vee('#2f5bd8') },
  vegeta: { skin: SKIN.light, hair: 'vegeta', hairColor: BLACK, eyes: 'fierce', brows: 'thick', mouth: 'frown', collar: '#1f3d99', over: armor },
  gohan: { skin: SKIN.light, hair: 'gohan', hairColor: BLACK, eyes: 'wide', brows: 'raised', mouth: 'smile', collar: '#5b3fa0', extras: ['glasses'], over: vee('#d1203a') },
  piccolo: { skin: '#7cc85a', hair: 'turban', eyes: 'fierce', brows: 'angry', mouth: 'frown', collar: '#6b3fa0', extras: ['pointyears'], over: p('M14 100 Q16 86 30 84 L34 100 Z', WHITE) + p('M86 100 Q84 86 70 84 L66 100 Z', WHITE) },
  frieza: {
    skin: '#f4eef7', hair: 'dome', hairColor: '#8e3bbf', eyes: 'fierce', eyeColor: '#d1203a', brows: 'none', mouth: 'lips', noEars: true, extras: ['frieza'],
  },
  trunks: { skin: SKIN.light, hair: 'trunks', hairColor: '#b9a3e3', eyes: 'calm', eyeColor: '#2f5bd8', brows: 'angry', mouth: 'flat', collar: '#5b3fa0', over: vee('#1b1b22') },
  krillin: { skin: SKIN.light, hair: 'none', eyes: 'dot', brows: 'raised', mouth: 'grin', collar: '#ff7a1a', extras: ['dots6'], over: vee('#2f5bd8') },
  cell: { skin: '#f3ede6', hair: 'cell', hairColor: '#7fc244', eyes: 'fierce', eyeColor: '#7a2a8a', brows: 'none', mouth: 'smirk', collar: '#1d1f24', extras: ['cellmarks'] },
  buu: {
    skin: '#ff9fc7', hair: 'buu', hairColor: '#ff9fc7', eyes: 'closed', brows: 'none', mouth: 'grin', collar: WHITE, noEars: true, extras: ['blush'],
    over: p('M36 86 L50 100 L64 86 Z', '#5b3fa0'),
  },
  broly: { skin: SKIN.medium, hair: 'broly', hairColor: '#c7f03b', eyes: 'blank', brows: 'thick', mouth: 'teeth', collar: '#d4a017' },
  bulma: { skin: SKIN.fair, hair: 'bob', hairColor: '#4aa8e8', eyes: 'wide', eyeColor: '#1f6fb5', brows: 'raised', mouth: 'smile', collar: '#e8c41a', extras: ['earrings', 'blush'] },

  // Androids
  android_16: {
    skin: SKIN.light, hair: 'none', eyes: 'calm', eyeColor: '#2f7fd8', brows: 'flat', mouth: 'flat', collar: '#9be22d',
    head: p('M25 42 Q25 30 50 30 Q75 30 75 42 L75 72 Q74 87 50 88 Q26 87 25 72 Z', SKIN.light),
    front: p('M24 52 Q20 30 34 22 Q50 14 66 22 Q80 30 76 52 Q72 37 62 35 Q50 39 38 35 Q28 37 24 52 Z', '#e2562f')
      + line('M36 25 Q50 20 64 25', '#b8401f', 2),
    over: p('M14 100 Q16 88 30 86 L36 100 Z', '#1b1b22') + p('M86 100 Q84 88 70 86 L64 100 Z', '#1b1b22'),
  },
  android_17: {
    skin: SKIN.fair, hair: 'none', eyes: 'calm', eyeColor: '#2f7fd8', brows: 'flat', mouth: 'smirk', collar: '#1b1b22', noEars: true,
    back: p('M23 52 Q19 24 50 23 Q81 24 77 52 L79 82 L67 82 L68 62 L32 62 L33 82 L21 82 Z', BLACK),
    front: p('M25 60 Q23 30 50 27 Q77 30 75 60 Q71 42 55 36 L50 33 L45 36 Q29 42 25 60 Z', BLACK),
    over: p('M22 100 Q28 84 50 88 Q72 84 78 100 L62 100 L50 92 L38 100 Z', '#ff7a1a'),
  },
  android_18: {
    skin: SKIN.fair, hair: 'none', eyes: 'calm', eyeColor: '#2f7fd8', brows: 'flat', mouth: 'flat', collar: '#c2186b', noEars: true,
    back: p('M22 80 Q15 30 50 25 Q85 30 78 80 L68 80 L70 58 L30 58 L32 80 Z', '#f2d272'),
    front: p('M26 60 Q23 28 50 26 Q77 28 74 60 Q71 40 58 35 Q44 33 35 44 Q29 51 26 60 Z', '#f2d272'),
  },

  // Gods
  beerus: {
    skin: '#8d67bd', hair: 'none', eyes: 'none', brows: 'none', mouth: 'smirk', collar: '#1b1b22', noEars: true,
    back: p('M30 42 L16 4 L46 31 Z', '#8d67bd') + p('M70 42 L84 4 L54 31 Z', '#8d67bd') + p('M30 36 L22 14 L40 31 Z', '#c99ae0') + p('M70 36 L78 14 L60 31 Z', '#c99ae0'),
    under: almond(-1, '#ffe24a') + almond(1, '#ffe24a') + line('M31 52 L46 54', INK, 3) + line('M69 52 L54 54', INK, 3),
    over: circle(18, 34, 3.6, '#ffd23f') + circle(82, 34, 3.6, '#ffd23f') + p('M38 86 L50 98 L62 86 Z', '#e8c14a'),
  },
  whis: {
    skin: '#a9cbe6', hair: 'none', eyes: 'calm', eyeColor: '#7a3fa0', brows: 'none', mouth: 'smile', collar: '#b3261e',
    front: p('M33 46 Q32 28 40 16 Q46 6 56 0 Q53 9 58 16 Q67 28 67 46 Q50 38 33 46 Z', '#f2f4f8') + line('M45 40 Q46 26 52 14', '#c8ccd8', 1.8),
    over: `<ellipse cx="50" cy="93" rx="32" ry="7" fill="none" stroke="#3a6fd8" stroke-width="4"/>` + vee('#1b1b22'),
  },

  // Family and friends
  chichi: {
    skin: SKIN.fair, hair: 'bun', hairColor: BLACK, eyes: 'wide', brows: 'angry', mouth: 'smile', collar: '#7a3fa0',
    front: p('M28 52 Q28 33 50 32 Q72 33 72 52 L66 46 L60 51 L54 45 L48 51 L42 45 L36 51 Z', BLACK),
    over: p('M36 85 L50 94 L64 85 L60 100 L40 100 Z', '#ff7a1a'),
  },
  chiaotzu: {
    skin: '#fbfbf7', hair: 'none', eyes: 'dot', brows: 'raised', mouth: 'smile', collar: '#2f7a3a',
    head: `<ellipse cx="50" cy="60" rx="26" ry="26" fill="#fbfbf7" stroke="${INK}" stroke-width="2.6"/>`,
    under: circle(34, 68, 5, '#e8404a', false) + circle(66, 68, 5, '#e8404a', false),
    front: p('M27 46 Q29 27 50 26 Q71 27 73 46 Q50 39 27 46 Z', '#2a2a3a') + circle(50, 22, 5, '#e23a3a'),
  },
  goten: { skin: SKIN.light, hair: 'goku', hairColor: BLACK, eyes: 'wide', brows: 'raised', mouth: 'grin', collar: '#8db87a', extras: ['blush'] },
  gotenks: {
    skin: SKIN.light, hair: 'gohan', hairColor: BLACK, eyes: 'fierce', brows: 'angry', mouth: 'grin', collar: '#1f8a8a',
    front: p('M28 47 L34 60 L39 45 L46 58 L51 43 L56 58 L61 45 L66 58 L72 47 Q50 37 28 47 Z', '#9a7ad0'),
    over: p('M12 100 Q14 88 30 85 L33 100 Z', '#ffd23f') + p('M88 100 Q86 88 70 85 L67 100 Z', '#ffd23f'),
  },
  gogeta: {
    skin: SKIN.light, hair: 'goku', hairColor: BLACK, eyes: 'fierce', brows: 'angry', mouth: 'smirk', collar: '#1b1b22',
    front: p('M47 44 L43 64 L54 49 Z', BLACK) + p('M57 42 L57 60 L63 46 Z', BLACK),
    over: p('M12 100 Q14 88 30 85 L33 100 Z', '#e8c14a') + p('M88 100 Q86 88 70 85 L67 100 Z', '#e8c14a') + vee('#d1203a'),
  },
  vegito: {
    skin: SKIN.light, hair: 'vegeta', hairColor: BLACK, eyes: 'fierce', brows: 'thick', mouth: 'smirk', collar: '#1b1f3a',
    front: p('M50 46 L45 64 L56 50 Z', BLACK),
    over: circle(25, 71, 3.6, '#ffd23f') + circle(75, 71, 3.6, '#ffd23f') + circle(25, 65, 2, '#ffd23f') + circle(75, 65, 2, '#ffd23f') + vee('#ff8a1f'),
  },
  videl: {
    skin: SKIN.fair, hair: 'none', eyes: 'wide', eyeColor: '#2f5bd8', brows: 'angry', mouth: 'smile', collar: WHITE,
    back: p('M27 60 Q12 72 18 94 Q26 82 31 70 Z', BLACK) + p('M73 60 Q88 72 82 94 Q74 82 69 70 Z', BLACK) + circle(27, 64, 3, '#ffd23f') + circle(73, 64, 3, '#ffd23f'),
    front: p('M25 58 Q23 28 50 27 Q77 28 75 58 Q70 40 60 40 L56 48 L52 39 L46 48 L42 39 Q30 42 25 58 Z', BLACK),
  },
  yamcha: {
    skin: SKIN.light, hair: 'megumi', hairColor: BLACK, eyes: 'fierce', brows: 'angry', mouth: 'grin', collar: '#ff7a1a',
    under: line('M37 46 L43 68', '#a03a2a', 2.2) + line('M58 67 L66 75', '#a03a2a', 2.2) + line('M66 67 L58 75', '#a03a2a', 2.2),
    over: vee('#2f5bd8'),
  },
  tien: {
    skin: SKIN.light, hair: 'none', eyes: 'fierce', brows: 'angry', mouth: 'flat', collar: '#2f8a3a',
    under: p('M44 41 Q50 35 56 41 Q50 46 44 41 Z', '#fff') + circle(50, 40.8, 2, INK, false),
    over: vee('#e8c14a'),
  },
  hercule: {
    skin: SKIN.tan, hair: 'curly', hairColor: BLACK, eyes: 'fierce', brows: 'thick', mouth: 'grin', collar: WHITE,
    front: p('M34 69 Q40 63 50 67 Q60 63 66 69 Q70 73 72 68 Q70 76 62 72 Q56 70 50 71 Q44 70 38 72 Q30 76 28 68 Q30 73 34 69 Z', BLACK),
  },
  roshi: {
    skin: SKIN.tan, hair: 'none', eyes: 'none', brows: 'none', mouth: 'none', collar: '#ff8a1f',
    under: line('M31 49 L45 50', WHITE, 4) + line('M55 50 L69 49', WHITE, 4),
    front: p('M31 68 Q40 74 50 72 Q60 74 69 68 Q67 98 50 104 Q33 98 31 68 Z', WHITE) + p('M37 68 Q44 63 50 67 Q56 63 63 68 Q56 71 50 69 Q44 71 37 68 Z', WHITE),
    over: `<rect x="29" y="51" width="18" height="11" rx="4" fill="${INK}"/><rect x="53" y="51" width="18" height="11" rx="4" fill="${INK}"/>` + line('M47 55 L53 55', INK, 2.4)
      + line('M33 53 L37 53', '#5a6070', 1.6) + line('M57 53 L61 53', '#5a6070', 1.6),
  },
  nappa: {
    skin: '#e8b48a', hair: 'none', eyes: 'fierce', brows: 'thick', mouth: 'teeth', collar: '#1f3d99',
    head: `<ellipse cx="50" cy="57" rx="27" ry="29" fill="#e8b48a" stroke="${INK}" stroke-width="2.6"/>`,
    front: p('M33 67 Q42 62 50 66 Q58 62 67 67 Q66 74 62 72 Q56 68 50 69 Q44 68 38 72 Q34 74 33 67 Z', BLACK),
    over: armor,
  },
  raditz: {
    skin: SKIN.light, hair: 'none', eyes: 'fierce', brows: 'thick', mouth: 'smirk', collar: '#1b1b22',
    back: p('M24 42 L5 58 L17 61 L3 80 L21 76 L12 98 L31 86 L35 100 L65 100 L69 86 L88 98 L79 76 L97 80 L83 61 L95 58 L76 42 Z', BLACK),
    front: p('M25 56 L19 36 L31 32 L27 16 L41 25 L50 12 L59 25 L73 16 L69 32 L81 36 L75 56 L70 44 L57 40 L50 48 L43 40 L30 44 Z', BLACK),
    over: armor + p('M73 50 L80 50 L80 66 L73 66 Z', '#d8d8d8') + `<rect x="54" y="49" width="22" height="13" rx="2" fill="#3ad16a" fill-opacity="0.6" stroke="${INK}" stroke-width="2.2"/>`,
  },
  dr_gero: {
    skin: SKIN.light, hair: 'none', eyes: 'fierce', brows: 'none', mouth: 'none', collar: '#e8a33a',
    back: p('M25 44 Q16 56 22 68 L28 62 Z', WHITE) + p('M75 44 Q84 56 78 68 L72 62 Z', WHITE),
    under: line('M31 49 L46 53', WHITE, 5) + line('M69 49 L54 53', WHITE, 5),
    front: p('M30 68 Q37 63 50 67 Q63 63 70 68 Q69 92 50 95 Q31 92 30 68 Z', WHITE) + line('M40 76 Q50 80 60 76', '#c8c8c8', 1.6)
      + p('M27 44 L29 16 Q50 9 71 16 L73 44 Q50 37 27 44 Z', '#1b1b22') + p('M43 22 L57 22 L55 31 L50 28 L45 31 Z', '#d1203a'),
  },
  shenron: {
    skin: '#3fa34d', hair: 'none', eyes: 'none', brows: 'none', mouth: 'none', noEars: true,
    back: p('M30 36 L14 4 L40 26 Z', '#e8d07a') + p('M70 36 L86 4 L60 26 Z', '#e8d07a')
      + p('M22 44 L8 40 L18 52 L6 60 L22 62 L78 62 L94 60 L82 52 L92 40 L78 44 Z', '#2c7a36'),
    head: p('M26 46 Q26 26 50 26 Q74 26 74 46 L72 64 Q70 72 50 72 Q30 72 28 64 Z', '#3fa34d'),
    under: almond(-1, '#e23a3a', false) + almond(1, '#e23a3a', false) + line('M31 50 L46 53', INK, 3.2) + line('M69 50 L54 53', INK, 3.2),
    front: `<ellipse cx="50" cy="76" rx="19" ry="13" fill="#7cc85a" stroke="${INK}" stroke-width="2.4"/>`
      + circle(44, 72, 1.8, INK, false) + circle(56, 72, 1.8, INK, false) + line('M38 82 Q50 87 62 82', INK, 2.2)
      + line('M33 74 Q18 72 6 86', '#e8d07a', 2.2) + line('M67 74 Q82 72 94 86', '#e8d07a', 2.2),
  },
};
