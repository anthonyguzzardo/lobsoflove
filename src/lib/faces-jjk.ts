// Jujutsu Kaisen: drawn faces (see faces-kit.ts for the canvas and parts).
import { circle, INK, line, p, SKIN, type Spec } from './faces-kit';

/** A closed polygon path through the points. */
const poly = (pts: number[][]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;

/** Points around (cx, cy) from angle a0 to a1 (degrees; 0 is right, 270 is up), alternating inner and outer radius: spikes. */
function spikeArc(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number, n: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i <= 2 * n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / (2 * n)) * Math.PI) / 180;
    const r = i % 2 ? rOut : rIn;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** A head outline in place of the stock ellipse. */
const head = (d: string, skin: string) => `<path d="${d}" fill="${skin}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
const fill = (d: string, color: string) => `<path d="${d}" fill="${color}"/>`;

/** Long hair falling behind the shoulders. */
const longBack = (c: string) => p('M23 50 Q19 24 50 22 Q81 24 77 50 L81 96 L66 96 L68 64 L32 64 L34 96 L19 96 Z', c);

const GETO_BACK = p('M27 48 Q20 70 25 98 L37 98 Q32 74 34 56 Z', '#1b1b22') + p('M73 48 Q80 70 75 98 L63 98 Q68 74 66 56 Z', '#1b1b22');

export const JJK: Record<string, Spec> = {
  gojo: {
    skin: SKIN.fair, hair: 'none', eyes: 'none', brows: 'none', mouth: 'smirk', collar: '#1b1f3a', extras: ['blindfold'],
    // Big white spiky hair standing straight up off the blindfold.
    front: p(poly([...spikeArc(50, 47, 23, 42, 163, 377, 13), [70, 48], [64, 52], [58, 46], [51, 51], [44, 46], [38, 52], [31, 48]]), '#f1f3f8'),
  },
  sukuna: {
    skin: SKIN.light, hair: 'none', eyes: 'fierce', eyeColor: '#d1203a', brows: 'angry', mouth: 'teeth', collar: '#f4f1e6', extras: ['sukuna'],
    // Pink hair swept up and back in sharp spikes, forehead bare for the markings.
    front: p(poly([...spikeArc(50, 49, 21, 36, 178, 362, 13), [71, 45], [61, 39], [50, 41], [39, 39], [29, 45]]), '#ef9a98'),
  },
  itadori: {
    skin: SKIN.light, hair: 'none', eyes: 'fierce', eyeColor: '#8a5a2a', brows: 'raised', mouth: 'grin', collar: '#1d1f24', extras: ['itadori'],
    // Dark undercut, short spiky pink on top with a spiky fringe.
    front: p('M25 60 Q23 35 50 31 Q77 35 75 60 Q72 45 50 42 Q28 45 25 60 Z', '#4a3028')
      + p(poly([...spikeArc(50, 46, 19, 30, 188, 352, 11), [69, 45], [63, 41], [58, 46], [52, 40], [46, 46], [41, 41], [35, 46], [31, 43]]), '#f4a3ab'),
  },
  megumi: { skin: SKIN.fair, hair: 'megumi', hairColor: '#1b1b22', eyes: 'calm', eyeColor: '#2f6b6b', brows: 'flat', mouth: 'flat', collar: '#1b1f3a' },
  nobara: { skin: SKIN.fair, hair: 'bob', hairColor: '#c8743a', eyes: 'fierce', eyeColor: '#7a4a2a', brows: 'angry', mouth: 'grin', collar: '#1b1f3a' },
  nanami: {
    skin: SKIN.light, hair: 'sidepart', hairColor: '#dcd78e', eyes: 'none', brows: 'flat', mouth: 'flat', collar: '#d9d2bf',
    // The green-tinted oval goggles, and the teal shirt under the beige suit.
    over: `<ellipse cx="39" cy="57" rx="8.5" ry="6" fill="#7dbf5a" fill-opacity="0.92" stroke="${INK}" stroke-width="2.4"/>`
      + `<ellipse cx="61" cy="57" rx="8.5" ry="6" fill="#7dbf5a" fill-opacity="0.92" stroke="${INK}" stroke-width="2.4"/>`
      + line('M47.5 56 L52.5 56', INK, 2.4) + p('M42 86 L50 96 L58 86 Z', '#2f8a8a'),
  },
  todo: {
    skin: SKIN.tan, hair: 'none', eyes: 'fierce', brows: 'thick', mouth: 'grin', collar: '#6b3f8a', extras: ['scar'],
    // Square jaw, hair slicked back into a curly knot on top.
    head: head('M24 52 Q24 30 50 30 Q76 30 76 52 L75 70 Q72 86 50 88 Q28 86 25 70 Z', SKIN.tan),
    back: [[44, 20], [56, 20], [50, 13], [50, 23], [43, 13], [57, 13]].map(([x, y]) => circle(x, y, 5.5, '#1b1b22')).join(''),
    front: p('M25 54 Q23 29 50 28 Q77 29 75 54 Q70 40 58 37 L50 42 L42 37 Q30 40 25 54 Z', '#1b1b22'),
  },
  maki: {
    skin: SKIN.fair, hair: 'none',
    // Dark green hair with a pointed fringe, tied back in a ponytail; round glasses.
    back: p('M70 38 Q96 40 92 74 Q90 84 84 90 Q86 72 72 58 Z', '#2f5f3a'),
    front: p('M25 58 Q22 28 50 26 Q78 28 75 58 L71 48 L65 52 L60 44 L54 50 L48 43 L42 50 L36 45 L30 52 Z', '#2f5f3a'), eyes: 'fierce', eyeColor: '#8a6a2a', brows: 'angry', mouth: 'smirk', collar: '#1b1f3a',
    over: circle(40, 57, 7.5, 'none') + circle(60, 57, 7.5, 'none') + line('M47.5 56 L52.5 56', INK, 2.2),
  },
  toge: {
    skin: SKIN.fair, hair: 'yuta', hairColor: '#e2e4ea', eyes: 'calm', eyeColor: '#8a3fa0', brows: 'flat', mouth: 'none', extras: ['highcollar'],
  },
  panda: {
    skin: '#fbfbf7', hair: 'none', eyes: 'dot', brows: 'none', mouth: 'smile', collar: '#1b1f3a', extras: ['panda'],
    over: line('M33 46 L41 49', INK, 2) + line('M67 46 L59 49', INK, 2),
  },
  geto: { skin: SKIN.light, hair: 'geto', hairColor: '#1b1b22', eyes: 'closed', brows: 'flat', mouth: 'smirk', collar: '#2a2a2a', extras: ['gauges'], back: GETO_BACK },
  yuta: {
    skin: SKIN.fair, hair: 'yuta', hairColor: '#1f2a28', eyes: 'calm', brows: 'raised', mouth: 'flat', collar: '#f4f1e6',
    under: line('M35 64 Q40 66 45 64', '#8a7a9a', 1.8) + line('M55 64 Q60 66 65 64', '#8a7a9a', 1.8),
  },

  // ---- added from the reference set ----
  choso: {
    skin: SKIN.fair, hair: 'none', eyes: 'calm', eyeColor: '#5a3a2a', brows: 'flat', mouth: 'flat', collar: '#4a3a5a',
    // Two spiky bunches up top and the dark blood band across the bridge of the nose.
    back: p(poly(spikeArc(29, 27, 4, 13, 0, 360, 7)), '#3b2a24') + p(poly(spikeArc(71, 27, 4, 13, 0, 360, 7)), '#3b2a24'),
    under: fill('M27 61 L73 61 L73 65.5 L27 65.5 Z', '#4a2226'),
    front: p('M25 56 Q22 30 50 28 Q78 30 75 56 L70 46 L66 54 L60 44 L54 52 L50 42 L46 52 L40 44 L34 54 L30 46 Z', '#3b2a24'),
  },
  hanami: {
    skin: '#ebe4d0', hair: 'none', eyes: 'none', brows: 'none', mouth: 'none', noEars: true,
    head: head('M50 20 Q75 22 74 52 Q74 80 50 90 Q26 80 26 52 Q25 22 50 20 Z', '#ebe4d0'),
    under: `<ellipse cx="40" cy="55" rx="6" ry="5" fill="#2a2a22"/><ellipse cx="60" cy="55" rx="6" ry="5" fill="#2a2a22"/>`
      + line('M37 62 Q35 71 38 80', '#3a4a30', 2.6) + line('M63 62 Q65 71 62 80', '#3a4a30', 2.6)
      + p('M35 73 Q50 79 65 73 Q61 83 50 84 Q39 83 35 73 Z', '#fff') + line('M41 75 L42 82 M46 76.5 L46.5 83.5 M50 77 L50 84 M54 76.5 L53.5 83.5 M59 75 L58 82', INK, 1.4),
    // The branches growing out of the eyes.
    over: line('M39 54 Q36 40 31 22 M34 36 L24 30 M32 28 L35 15', '#6b4a2a', 4) + line('M61 54 Q64 40 69 22 M66 36 L76 30 M68 28 L65 15', '#6b4a2a', 4),
  },
  jogo: {
    skin: '#cfd2da', hair: 'none', eyes: 'none', brows: 'none', mouth: 'none', collar: '#cfd24a', noEars: true,
    head: head('M24 60 Q24 44 31 42 L69 42 Q76 44 76 60 Q76 84 50 88 Q24 84 24 60 Z', '#cfd2da'),
    // One big eye and a row of teeth.
    under: circle(50, 58, 8.5, '#fff') + circle(50, 58, 4, INK, false)
      + p('M36 72 L64 72 L62 80 L38 80 Z', '#fff') + line('M42 72 L42 80 M47 72 L47 80 M52 72 L52 80 M57 72 L57 80', INK, 1.4),
    // The volcano head, its crater and the brown runs down the face; spots on the collar.
    front: p('M28 46 L38 9 L62 9 L72 46 Z', '#7a4a2a') + `<ellipse cx="50" cy="9.5" rx="12" ry="3.6" fill="#3a2214" stroke="${INK}" stroke-width="2.2"/>`
      + p('M34 45 Q35 52 38 45 Z', '#7a4a2a') + p('M47 45 Q49 54 52 45 Z', '#7a4a2a') + p('M61 45 Q63 51 66 45 Z', '#7a4a2a')
      + [[24, 95], [38, 97], [62, 96], [77, 94]].map(([x, y]) => circle(x, y, 2.6, INK, false)).join(''),
  },
  junpei: {
    skin: SKIN.fair, hair: 'none', eyes: 'calm', eyeColor: '#3a3a3a', brows: 'flat', mouth: 'flat', collar: '#9a7ab8',
    // Long black bang hanging over one eye.
    front: p('M25 58 Q22 28 50 26 Q78 28 75 58 Q74 44 64 40 Q56 38 50 40 Q44 46 37 63 Q33 71 28 74 Q24 66 25 58 Z', '#1b1b22')
      + p('M70 42 Q79 52 77 72 L72 72 Q73 55 67 46 Z', '#1b1b22'),
  },
  miwa: {
    skin: SKIN.fair, hair: 'none', eyes: 'wide', eyeColor: '#3a5bb0', brows: 'raised', mouth: 'smile', collar: '#1d1f30',
    back: longBack('#7ec8e0'),
    front: p('M24 62 Q22 28 50 27 Q78 28 76 62 L71 62 L70 47 L30 47 L29 62 Z', '#7ec8e0'),
    over: p('M43 86 L50 96 L57 86 Z', '#f4f1e6'),
  },
  kenjaku: {
    skin: SKIN.light, hair: 'geto', hairColor: '#1b1b22', eyes: 'calm', brows: 'flat', mouth: 'smirk', collar: '#2a2440', extras: ['gauges'], back: GETO_BACK,
    // The stitches across the forehead, over the hairline.
    over: line('M38 46 Q50 44 62 46', INK, 2.2) + line('M41 43.5 L41 48 M45.5 42.8 L45.5 47.3 M50 42.5 L50 47 M54.5 42.8 L54.5 47.3 M59 43.5 L59 48', INK, 1.6),
  },
  hakari: {
    skin: SKIN.light, hair: 'none', eyes: 'fierce', eyeColor: '#7a8a9a', brows: 'thick', mouth: 'grin', collar: '#2f3d2f',
    head: head('M25 54 Q25 30 50 30 Q75 30 75 54 L73 70 L60 86 L40 86 L27 70 Z', SKIN.light),
    // Blond pompadour and the hood of the green parka.
    front: p('M27 47 Q24 34 31 27 Q27 13 42 7 Q59 1 71 9 Q81 17 76 30 Q78 39 73 47 Q70 40 62 37 Q50 34 38 38 Q31 41 27 47 Z', '#ecd07a')
      + line('M33 36 Q36 18 50 10', '#b8964a', 1.8) + line('M43 36 Q47 20 61 12', '#b8964a', 1.8) + line('M55 36 Q61 24 70 17', '#b8964a', 1.8)
      + line('M66 38 Q72 30 75 26', '#b8964a', 1.6),
    over: p('M14 100 Q14 78 28 74 Q50 92 72 74 Q86 78 86 100 Z', '#2f3d2f'),
  },
  mechamaru: {
    skin: SKIN.fair, hair: 'yuta', hairColor: '#1b1b22', eyes: 'fierce', eyeColor: '#3a3a4a', brows: 'angry', mouth: 'flat', collar: '#1b1f3a',
    // Kokichi Muta: the spiky top knot, the burn on the cheek, the grey scarf.
    back: p(poly(spikeArc(50, 19, 3, 12, 0, 360, 7)), '#1b1b22'),
    under: p('M59 64 Q67 65 69 73 Q62 74 59 64 Z', '#d99a9a'),
    over: p('M24 86 Q50 97 76 86 L77 93 Q50 104 23 93 Z', '#a0a4ad'),
  },
  mahito: {
    skin: '#e8e2da', hair: 'none', eyes: 'calm', eyeColor: '#5a8ac0', brows: 'none', mouth: 'grin', collar: '#1d1f24', noEars: true,
    back: p('M22 50 Q18 24 50 22 Q82 24 78 50 L82 92 L68 92 L70 62 L30 62 L32 92 L18 92 Z', '#a9bcc4'),
    // Patchwork stitches across the face.
    under: line('M33 42 L44 60 L41 78', INK, 1.8) + line('M37 49 L41 47 M40 54 L44 52 M42 66 L46 67 M41 72 L45 73', INK, 1.4)
      + line('M57 68 L71 62', INK, 1.8) + line('M61 64 L62 69 M66 62 L67 67', INK, 1.4),
    front: p('M24 64 Q20 28 50 25 Q80 28 76 64 Q72 46 60 38 Q54 34 50 34 Q46 34 40 38 Q28 46 24 64 Z', '#a9bcc4'),
  },
  mai: {
    skin: SKIN.fair, hair: 'none', eyes: 'calm', eyeColor: '#6a5a3a', brows: 'flat', mouth: 'smirk', collar: '#1d1f24',
    back: p('M22 74 Q16 30 50 26 Q84 30 78 74 L68 74 L69 58 L31 58 L32 74 Z', '#2f5a48'),
    // Dark green bob, the long side bang over one eye.
    front: p('M24 60 Q22 28 50 26 Q78 28 76 66 Q73 62 69 65 Q68 52 62 48 L58 55 L54 46 L48 53 L44 45 L38 52 L34 46 L28 53 Q25 56 24 60 Z', '#2f5a48'),
  },
  yaga: {
    skin: SKIN.tan, hair: 'none', eyes: 'none', brows: 'thick', mouth: 'flat', collar: '#f4f1e6',
    head: head('M25 52 Q25 30 50 30 Q75 30 75 52 L74 72 Q70 86 50 88 Q30 86 26 72 Z', SKIN.tan),
    front: p(poly([...spikeArc(50, 46, 20, 26, 195, 345, 12), [69, 40], [50, 38], [31, 40]]), '#5a3b24'),
    // Dark shades, mustache and goatee.
    over: `<rect x="29" y="52" width="18" height="9" rx="2" fill="#1d1f24" stroke="${INK}" stroke-width="2.2"/><rect x="53" y="52" width="18" height="9" rx="2" fill="#1d1f24" stroke="${INK}" stroke-width="2.2"/>`
      + line('M47 55 L53 55', INK, 2.4) + p('M39 71 Q50 66 61 71 L61 73.5 Q50 70 39 73.5 Z', '#3a2a1a') + p('M45 78 L55 78 L53 87 L47 87 Z', '#3a2a1a'),
  },
  momo: {
    skin: SKIN.fair, hair: 'none', eyes: 'calm', eyeColor: '#5a7ab0', brows: 'raised', mouth: 'smile', collar: '#1b1f3a',
    // Two blonde pigtails shooting straight up, tied with black bands.
    back: p('M33 34 Q16 22 17 3 Q27 14 39 25 Z', '#f2d36b') + p('M67 34 Q84 22 83 3 Q73 14 61 25 Z', '#f2d36b')
      + circle(31, 30, 3, INK, false) + circle(69, 30, 3, INK, false),
    front: p('M25 58 Q22 28 50 27 Q78 28 75 58 L71 48 L64 52 L58 44 L50 50 L42 44 L36 52 L29 48 Z', '#f2d36b'),
  },
  naoya: {
    skin: SKIN.light, hair: 'none', eyes: 'fierce', eyeColor: '#6a7a4a', brows: 'flat', mouth: 'smirk', collar: '#2a3a3a',
    front: p('M25 56 Q22 30 50 27 Q78 30 75 56 L72 46 L66 50 L64 40 L56 46 L52 38 L46 46 L40 40 L36 50 L30 44 Z', '#b9c06e'),
    // A row of piercings.
    over: circle(24, 63, 1.8, '#c9ccd6') + circle(24.5, 68, 1.8, '#c9ccd6') + circle(76, 65, 1.8, '#c9ccd6'),
  },
  kamo: {
    skin: SKIN.light, hair: 'none', eyes: 'calm', eyeColor: '#3a2a2a', brows: 'flat', mouth: 'flat', collar: '#3a2f5a', noEars: true,
    // Noritoshi Kamo: flat black top, long side locks wrapped in white.
    front: p('M25 56 Q22 28 50 26 Q78 28 75 56 Q70 40 50 36 Q30 40 25 56 Z', '#1b1b22')
      + p('M24 50 Q19 66 23 86 L32 86 Q28 66 30 54 Z', '#1b1b22') + p('M76 50 Q81 66 77 86 L68 86 Q72 66 70 54 Z', '#1b1b22')
      + p('M21 66 L31 66 L31 73 L21 73 Z', '#f4f1e6') + p('M69 66 L79 66 L79 73 L69 73 Z', '#f4f1e6'),
  },
  rika: {
    skin: SKIN.fair, hair: 'none', eyes: 'wide', eyeColor: '#2a1a14', brows: 'raised', mouth: 'grin', collar: '#2f3f8a',
    back: longBack('#4a3328'),
    front: p('M24 60 Q22 28 50 26 Q78 28 76 60 L71 58 L70 46 L30 46 L29 58 Z', '#4a3328'),
    // White collar and red ribbon.
    over: p('M38 86 L50 92 L62 86 L60 96 L40 96 Z', '#fff') + p('M45 92 L50 95 L55 92 L55 99 L50 96 L45 99 Z', '#d1203a'),
  },
  ino: {
    skin: SKIN.tan, hair: 'none', eyes: 'wide', eyeColor: '#b08a3a', brows: 'flat', mouth: 'flat', collar: '#1d1f24',
    // Takuma Ino: the black beanie, hair tufts out the sides.
    back: p('M25 52 L17 60 L27 60 Z', '#3a2a1a') + p('M75 52 L83 60 L73 60 Z', '#3a2a1a'),
    front: p('M22 50 Q20 20 50 18 Q80 20 78 50 Z', '#26282e') + p('M22 44 Q50 38 78 44 L78 52 Q50 46 22 52 Z', '#34363e'),
  },
  toji: {
    skin: SKIN.light, hair: 'none', eyes: 'fierce', eyeColor: '#3a6a4a', brows: 'flat', mouth: 'smirk', collar: '#1d1f24',
    head: head('M25 54 Q25 30 50 30 Q75 30 75 54 L74 70 Q70 86 50 88 Q30 86 26 70 Z', SKIN.light),
    // Messy black hair and the scar at the corner of the mouth.
    front: p('M24 58 Q20 28 50 26 Q80 28 76 58 L72 46 L68 54 L64 42 L58 50 L54 40 L48 50 L44 40 L38 52 L34 44 L28 52 Z', '#1b1b22'),
    over: line('M58 69 L61 78', '#c08080', 2.2),
  },
  yuki: {
    skin: SKIN.fair, hair: 'none', eyes: 'fierce', eyeColor: '#7a5ab0', brows: 'thick', mouth: 'smirk', collar: '#2a2440',
    // Yuki Tsukumo: long blonde hair, center part, strands framing the face.
    back: p('M22 50 Q18 24 50 22 Q82 24 78 50 L82 96 L66 96 L68 64 L32 64 L34 96 L18 96 Z', '#f0d98a'),
    front: p('M24 66 Q20 28 50 26 Q80 28 76 66 L72 66 Q72 46 56 36 L50 33 L44 36 Q28 46 28 66 Z', '#f0d98a'),
  },
};

