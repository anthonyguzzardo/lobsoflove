// Drawn faces for players, as SVG strings: the search grid (react-native-svg SvgXml) and the crew photo tags (web/crew.js,
// bundled by esbuild) both draw from here. A face is a head on a badge in the player's color: hair, eyes, brows, mouth and a few
// extras (headbands, a blindfold, markings). Unknown or empty codes get the plain jelly face.
//
// Canvas: 100 x 100. Head is an ellipse at (50, 58), 25 wide and 28 tall each way: top of the head y 30, chin y 86.
// Eyes sit on y 58 at x 40 and 60, brows around y 50, mouth around y 74.

const INK = '#16181d';

type Eyes = 'dot' | 'fierce' | 'wide' | 'calm' | 'closed' | 'blank' | 'none';
type Brows = 'angry' | 'thick' | 'flat' | 'raised' | 'none';
type Mouth = 'grin' | 'smile' | 'smirk' | 'flat' | 'frown' | 'open' | 'teeth' | 'lips' | 'none';
type Hair =
  | 'goku' | 'vegeta' | 'gohan' | 'trunks' | 'short' | 'curly' | 'long' | 'ponytail' | 'bun' | 'topknot' | 'gojo' | 'undercut'
  | 'megumi' | 'yuta' | 'bob' | 'sidepart' | 'mullet' | 'broly' | 'turban' | 'dome' | 'cell' | 'buu' | 'geto' | 'none';
type Extra =
  | 'headband' | 'bandana' | 'blindfold' | 'glasses' | 'shades' | 'dots6' | 'sukuna' | 'itadori' | 'scar' | 'highcollar'
  | 'earrings' | 'gauges' | 'frieza' | 'cellmarks' | 'spots' | 'pointyears' | 'panda' | 'stripes' | 'blush';

type Spec = {
  skin: string; hair: Hair; hairColor?: string; eyes: Eyes; eyeColor?: string; brows: Brows; mouth: Mouth;
  collar?: string; extras?: Extra[]; band?: string;
};

const SKIN = { light: '#f6cfa8', fair: '#fbe0c4', medium: '#e0b088', tan: '#c98e5f', brown: '#9a6240', deep: '#6e4128' };

export const FACES: Record<string, Spec> = {
  // Dragon Ball Z
  goku: { skin: SKIN.light, hair: 'goku', hairColor: '#1b1b22', eyes: 'fierce', brows: 'angry', mouth: 'grin', collar: '#ff8a1f', extras: [] },
  vegeta: { skin: SKIN.light, hair: 'vegeta', hairColor: '#1b1b22', eyes: 'fierce', brows: 'thick', mouth: 'frown', collar: '#2f5bd8' },
  gohan: { skin: SKIN.light, hair: 'gohan', hairColor: '#1b1b22', eyes: 'wide', brows: 'raised', mouth: 'smile', collar: '#6b3fa0' },
  piccolo: { skin: '#7cc85a', hair: 'turban', eyes: 'fierce', brows: 'angry', mouth: 'frown', collar: '#6b3fa0', extras: ['pointyears'] },
  frieza: { skin: '#f4eef7', hair: 'dome', hairColor: '#8e3bbf', eyes: 'fierce', eyeColor: '#d1203a', brows: 'none', mouth: 'lips', extras: ['frieza'] },
  trunks: { skin: SKIN.light, hair: 'trunks', hairColor: '#b9a3e3', eyes: 'calm', eyeColor: '#2f5bd8', brows: 'angry', mouth: 'flat', collar: '#2f3a4a' },
  krillin: { skin: SKIN.light, hair: 'none', eyes: 'dot', brows: 'raised', mouth: 'grin', collar: '#ff8a1f', extras: ['dots6'] },
  cell: { skin: '#b4e08f', hair: 'cell', hairColor: '#1d2b14', eyes: 'fierce', eyeColor: '#b0306a', brows: 'none', mouth: 'smirk', extras: ['spots', 'cellmarks'] },
  buu: { skin: '#ff9fc7', hair: 'buu', hairColor: '#ff9fc7', eyes: 'closed', brows: 'none', mouth: 'grin', collar: '#f4f1e6', extras: ['blush'] },
  broly: { skin: SKIN.medium, hair: 'broly', hairColor: '#c7f03b', eyes: 'blank', brows: 'thick', mouth: 'teeth', collar: '#d4a017' },
  bulma: { skin: SKIN.fair, hair: 'bob', hairColor: '#1fb5b5', eyes: 'wide', eyeColor: '#1f6fb5', brows: 'raised', mouth: 'smile', collar: '#ff5fa2', extras: ['earrings', 'blush'] },
  // Tennis legends
  federer: { skin: SKIN.light, hair: 'short', hairColor: '#5a3b24', eyes: 'calm', brows: 'flat', mouth: 'smile', collar: '#f4f1e6', extras: ['headband'], band: '#f4f1e6' },
  nadal: { skin: SKIN.tan, hair: 'long', hairColor: '#3b2414', eyes: 'fierce', brows: 'thick', mouth: 'teeth', collar: '#d7f205', extras: ['bandana'], band: '#1aa36f' },
  djokovic: { skin: SKIN.light, hair: 'short', hairColor: '#2a1d14', eyes: 'calm', eyeColor: '#3a6b3a', brows: 'flat', mouth: 'smile', collar: '#1f3d99' },
  serena: { skin: SKIN.deep, hair: 'bun', hairColor: '#1b1b22', eyes: 'wide', brows: 'raised', mouth: 'grin', collar: '#e0218a', extras: ['earrings'] },
  venus: { skin: SKIN.deep, hair: 'long', hairColor: '#1b1b22', eyes: 'calm', brows: 'flat', mouth: 'smile', collar: '#ffd23f', extras: ['headband'], band: '#ffd23f' },
  agassi: { skin: SKIN.medium, hair: 'mullet', hairColor: '#8a5a2b', eyes: 'calm', brows: 'flat', mouth: 'smirk', collar: '#ff5fa2', extras: ['bandana', 'earrings'], band: '#16181d' },
  mcenroe: { skin: SKIN.light, hair: 'curly', hairColor: '#5a3b24', eyes: 'fierce', brows: 'angry', mouth: 'open', collar: '#f4f1e6', extras: ['headband'], band: '#d1203a' },
  borg: { skin: SKIN.light, hair: 'long', hairColor: '#e8c870', eyes: 'calm', eyeColor: '#3a7bd5', brows: 'flat', mouth: 'flat', collar: '#f4f1e6', extras: ['headband', 'stripes'], band: '#f4f1e6' },
  graf: { skin: SKIN.fair, hair: 'ponytail', hairColor: '#e2b858', eyes: 'calm', brows: 'flat', mouth: 'smile', collar: '#f4f1e6' },
  sampras: { skin: SKIN.medium, hair: 'short', hairColor: '#2a1d14', eyes: 'calm', brows: 'thick', mouth: 'smirk', collar: '#3a86ff' },
  navratilova: { skin: SKIN.fair, hair: 'short', hairColor: '#d9b46a', eyes: 'fierce', brows: 'flat', mouth: 'grin', collar: '#06d6a0' },
  // Jujutsu Kaisen
  gojo: { skin: SKIN.fair, hair: 'gojo', hairColor: '#f2f4f8', eyes: 'none', brows: 'none', mouth: 'smirk', collar: '#1b1f3a', extras: ['blindfold'] },
  sukuna: { skin: SKIN.light, hair: 'undercut', hairColor: '#ff8fae', eyes: 'fierce', eyeColor: '#d1203a', brows: 'angry', mouth: 'teeth', collar: '#f4f1e6', extras: ['sukuna'] },
  itadori: { skin: SKIN.light, hair: 'undercut', hairColor: '#ff8fae', eyes: 'wide', eyeColor: '#7a4a2e', brows: 'raised', mouth: 'grin', collar: '#1b1f3a', extras: ['itadori'] },
  megumi: { skin: SKIN.fair, hair: 'megumi', hairColor: '#1b1b22', eyes: 'calm', eyeColor: '#2f5b8a', brows: 'flat', mouth: 'flat', collar: '#1b1f3a' },
  nobara: { skin: SKIN.fair, hair: 'bob', hairColor: '#e8742f', eyes: 'fierce', eyeColor: '#8a4a2a', brows: 'angry', mouth: 'grin', collar: '#1b1f3a' },
  nanami: { skin: SKIN.light, hair: 'sidepart', hairColor: '#e8cf72', eyes: 'none', brows: 'flat', mouth: 'flat', collar: '#c9b037', extras: ['shades'] },
  todo: { skin: SKIN.tan, hair: 'topknot', hairColor: '#1b1b22', eyes: 'fierce', brows: 'thick', mouth: 'grin', collar: '#1b1f3a', extras: ['scar'] },
  maki: { skin: SKIN.fair, hair: 'ponytail', hairColor: '#2f5f3a', eyes: 'fierce', eyeColor: '#8a6a2a', brows: 'angry', mouth: 'smirk', collar: '#1b1f3a', extras: ['glasses'] },
  toge: { skin: SKIN.fair, hair: 'yuta', hairColor: '#e6e8ef', eyes: 'calm', eyeColor: '#8a3fa0', brows: 'flat', mouth: 'none', extras: ['highcollar'] },
  panda: { skin: '#fbfbf7', hair: 'none', eyes: 'dot', brows: 'none', mouth: 'smile', collar: '#1b1f3a', extras: ['panda'] },
  geto: { skin: SKIN.light, hair: 'geto', hairColor: '#1b1b22', eyes: 'closed', brows: 'flat', mouth: 'smirk', collar: '#2a2a2a', extras: ['gauges'] },
  yuta: { skin: SKIN.fair, hair: 'yuta', hairColor: '#1b1b22', eyes: 'calm', brows: 'raised', mouth: 'flat', collar: '#f4f1e6' },
};

const p = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${extra}/>`;
const line = (d: string, color = INK, w = 2.6) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string, stroke = true) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke ? ` stroke="${INK}" stroke-width="2.2"` : ''}/>`;

/** Hair behind the head (long hair, buns, crests), drawn before the head. */
function hairBack(h: Hair, c: string): string {
  switch (h) {
    case 'long': return p('M24 50 Q20 24 50 23 Q80 24 76 50 L80 94 L66 94 L68 62 L32 62 L34 94 L20 94 Z', c);
    case 'bob': return p('M21 78 Q14 28 50 25 Q86 28 79 78 L68 78 L69 58 L31 58 L32 78 Z', c);
    case 'ponytail': return p('M70 38 Q96 40 92 74 Q90 84 84 90 Q86 72 72 58 Z', c);
    case 'bun': return circle(50, 23, 10, c);
    case 'geto': return circle(50, 22, 10, c);
    case 'topknot': return circle(50, 24, 6.5, c) + p('M46 22 L44 14 L50 18 L56 14 L54 22 Z', c);
    case 'mullet': return p('M27 58 L22 88 L37 84 L35 64 Z', c) + p('M73 58 L78 88 L63 84 L65 64 Z', c);
    case 'cell': return p('M20 74 L12 34 L28 16 L50 8 L72 16 L88 34 L80 74 L70 60 L30 60 Z', c);
    case 'broly': return p('M24 44 L4 62 L19 61 L8 84 L27 71 L29 92 L38 70 L62 70 L71 92 L73 71 L92 84 L81 61 L96 62 L76 44 Z', c);
    case 'trunks': return p('M22 72 Q16 28 50 25 Q84 28 78 72 Z', c);
    default: return '';
  }
}

/** Hair in front of the head: caps, spikes and bangs. */
function hairFront(h: Hair, c: string, band?: string): string {
  switch (h) {
    case 'goku':
      return p('M24 62 L8 42 L22 42 L10 22 L29 30 L24 5 L41 24 L52 1 L59 22 L78 5 L72 29 L92 22 L79 41 L93 45 L76 62 L74 47 L68 53 L64 41 L58 51 L52 39 L46 51 L40 41 L34 53 L28 47 Z', c);
    case 'vegeta':
      return p('M26 60 L22 42 L13 31 L24 30 L16 11 L31 20 L30 1 L42 16 L50 -2 L58 16 L70 1 L69 20 L84 11 L76 30 L87 31 L78 42 L74 60 L71 46 L60 41 L50 49 L40 41 L29 46 Z', c);
    case 'gohan':
      return p('M25 60 L14 44 L24 42 L16 25 L32 30 L32 11 L46 24 L56 7 L62 26 L78 13 L74 32 L88 34 L76 46 L75 60 L70 46 L60 42 L54 52 L50 42 L40 46 L32 44 Z', c)
        + p('M51 42 L46 60 L57 46 Z', c);
    case 'trunks': return p('M22 72 Q16 28 50 25 Q84 28 78 72 L70 72 Q72 48 53 39 L50 37 L47 39 Q28 48 30 72 Z', c);
    case 'short': return p('M25 56 Q21 27 50 25 Q79 27 75 56 Q72 42 62 40 Q50 44 37 40 Q28 42 25 56 Z', c);
    case 'curly':
      return [[26, 54], [24, 43], [29, 33], [38, 27], [50, 24], [62, 27], [71, 33], [76, 43], [74, 54], [40, 36], [50, 34], [60, 36]]
        .map(([x, y]) => circle(x, y, 7.5, c)).join('');
    case 'long': return p('M25 55 Q24 30 50 27 Q76 30 75 55 Q66 40 52 36 L50 33 L48 36 Q34 40 25 55 Z', c);
    case 'bob': return p('M26 52 Q26 29 50 27 Q74 29 74 52 L67 45 L59 50 L53 43 L45 50 L37 45 Z', c);
    case 'ponytail': return p('M25 55 Q23 28 50 26 Q77 28 75 55 Q70 40 56 38 Q44 36 34 44 Q28 48 25 55 Z', c);
    case 'bun': return p('M25 55 Q23 28 50 27 Q77 28 75 55 Q66 40 50 38 Q34 40 25 55 Z', c);
    case 'geto':
      return p('M25 55 Q23 28 50 27 Q77 28 75 55 Q66 40 50 38 Q34 40 25 55 Z', c) + p('M38 34 Q28 50 33 74 L38 73 Q35 52 45 37 Z', c);
    case 'topknot': return p('M26 54 Q24 29 50 28 Q76 29 74 54 Q70 38 50 36 Q30 38 26 54 Z', c);
    case 'gojo':
      return p('M25 58 L17 38 L26 38 L18 18 L34 28 L35 5 L46 23 L56 3 L60 24 L74 7 L70 28 L85 21 L76 38 L85 40 L75 58 L70 44 L50 40 L30 44 Z', c);
    case 'undercut':
      return p('M25 60 Q23 35 50 31 Q77 35 75 60 Q72 45 50 42 Q28 45 25 60 Z', '#3a2a2e')
        + p('M30 47 L27 30 L38 34 L39 18 L48 29 L54 15 L58 31 L69 22 L67 35 L76 34 L70 47 Q50 39 30 47 Z', c);
    case 'megumi':
      return p('M24 60 L13 46 L22 42 L11 28 L28 32 L23 13 L38 26 L43 7 L52 24 L62 7 L64 26 L79 15 L74 32 L89 32 L78 44 L87 53 L76 58 L70 46 L62 51 L58 42 L50 51 L44 42 L36 51 L30 44 Z', c);
    case 'yuta': return p('M24 58 Q20 27 50 25 Q80 27 76 58 L72 46 L66 53 L62 42 L56 53 L50 42 L44 53 L38 42 L32 53 L28 46 Z', c);
    case 'sidepart': return p('M25 56 Q22 27 50 25 Q78 27 75 56 Q74 42 66 38 L40 36 Q30 40 25 56 Z', c) + p('M38 37 Q56 28 72 41 Q58 35 42 41 Z', c);
    case 'mullet': return p('M25 55 Q22 28 50 26 Q78 28 75 55 Q70 40 50 37 Q30 40 25 55 Z', c);
    case 'broly':
      return p('M24 60 L10 42 L23 41 L12 22 L30 30 L27 6 L42 24 L52 2 L59 23 L76 6 L71 29 L90 22 L78 41 L91 44 L76 60 L73 47 L66 52 L62 41 L56 50 L50 39 L44 50 L38 41 L33 52 L27 47 Z', c);
    case 'turban':
      return p('M23 52 Q20 20 50 18 Q80 20 77 52 Q50 42 23 52 Z', '#f4f1e6') + p('M23 52 Q50 42 77 52 L77 45 Q50 35 23 45 Z', band ?? '#6b3fa0');
    case 'dome': return p('M26 47 Q24 21 50 19 Q76 21 74 47 Q50 38 26 47 Z', c);
    case 'cell': return p('M28 40 L22 22 L38 30 L50 14 L62 30 L78 22 L72 40 Q50 32 28 40 Z', '#2e4a22');
    case 'buu':
      return p('M50 32 Q50 12 66 8 Q80 5 84 18 Q74 12 66 17 Q58 22 57 33 Z', c) + circle(38, 40, 1.8, INK, false) + circle(62, 40, 1.8, INK, false) + circle(50, 36, 1.8, INK, false);
    default: return '';
  }
}

function eyesSvg(e: Eyes, color: string): string {
  const pupil = (x: number, y: number, r: number) => circle(x, y, r, color, false) + circle(x + r * 0.35, y - r * 0.35, r * 0.35, '#fff', false);
  switch (e) {
    case 'dot': return circle(40, 58, 3.3, INK, false) + circle(60, 58, 3.3, INK, false);
    case 'fierce':
      return p('M32 58 Q40 51 47 55 Q42 61 32 58 Z', '#fff') + p('M68 58 Q60 51 53 55 Q58 61 68 58 Z', '#fff') + pupil(42, 57, 2.6) + pupil(58, 57, 2.6);
    case 'blank': return p('M32 58 Q40 51 47 55 Q42 61 32 58 Z', '#fff') + p('M68 58 Q60 51 53 55 Q58 61 68 58 Z', '#fff');
    case 'wide': return circle(40, 58, 5.4, '#fff') + circle(60, 58, 5.4, '#fff') + pupil(40.5, 58.5, 3.2) + pupil(59.5, 58.5, 3.2);
    case 'calm':
      return circle(40, 59, 3.4, '#fff') + circle(60, 59, 3.4, '#fff') + pupil(40, 59.6, 2.4) + pupil(60, 59.6, 2.4)
        + line('M34 57 Q40 54 46 57') + line('M54 57 Q60 54 66 57');
    case 'closed': return line('M34 60 Q40 54 46 60') + line('M54 60 Q60 54 66 60');
    default: return '';
  }
}

function browsSvg(b: Brows, c: string): string {
  switch (b) {
    case 'angry': return line('M32 48 L46 52', c, 3.2) + line('M68 48 L54 52', c, 3.2);
    case 'thick': return line('M31 47 L46 52', c, 5) + line('M69 47 L54 52', c, 5);
    case 'flat': return line('M33 50 L46 50', c, 3) + line('M54 50 L67 50', c, 3);
    case 'raised': return line('M33 50 Q40 45 46 49', c, 3) + line('M54 49 Q60 45 67 50', c, 3);
    default: return '';
  }
}

function mouthSvg(m: Mouth): string {
  switch (m) {
    case 'grin': return p('M40 71 Q50 82 60 71 Z', '#fff');
    case 'smile': return line('M42 72 Q50 78 58 72');
    case 'smirk': return line('M43 74 Q52 76 59 70');
    case 'flat': return line('M44 74 L56 74');
    case 'frown': return line('M43 76 Q50 71 57 76');
    case 'open': return p('M44 70 Q50 68 56 70 Q58 80 50 81 Q42 80 44 70 Z', INK) + `<path d="M46 78 Q50 74 54 78 Z" fill="#e2562f"/>`;
    case 'teeth': return p('M39 70 L61 70 Q59 80 50 80 Q41 80 39 70 Z', '#fff') + line('M41 74 L59 74', INK, 1.6) + line('M50 70 L50 80', INK, 1.4);
    case 'lips': return p('M43 73 Q50 70 57 73 Q50 77 43 73 Z', '#5b2a6b');
    default: return '';
  }
}

/** Extras under the eyes (markings) and over everything (bands, glasses), split so eyes and hair stack right. */
function extrasUnder(x: Extra[]): string {
  let s = '';
  if (x.includes('dots6')) for (const [cx, cy] of [[42, 37], [50, 36], [58, 37], [42, 43], [50, 42], [58, 43]]) s += circle(cx, cy, 1.6, INK, false);
  if (x.includes('sukuna')) {
    s += line('M33 64 L46 64', INK, 2.6) + line('M54 64 L67 64', INK, 2.6) + line('M28 70 L35 70', INK, 2.6) + line('M65 70 L72 70', INK, 2.6);
    s += line('M47 40 L50 46 L53 40', INK, 2.4);
    s += p('M35 67 Q40 63 45 66 Q41 69 35 67 Z', '#fff') + p('M65 67 Q60 63 55 66 Q59 69 65 67 Z', '#fff');
  }
  if (x.includes('itadori')) s += line('M37 64 L36 67', '#a03030', 2) + line('M63 64 L64 67', '#a03030', 2);
  if (x.includes('frieza')) s += line('M35 62 Q37 66 36 70', '#8e3bbf', 2.4) + line('M65 62 Q63 66 64 70', '#8e3bbf', 2.4);
  if (x.includes('cellmarks')) s += line('M34 63 L38 72', '#b0306a', 2.4) + line('M66 63 L62 72', '#b0306a', 2.4);
  if (x.includes('spots')) for (const [cx, cy] of [[30, 48], [70, 46], [28, 70], [72, 68], [36, 80], [64, 81]]) s += circle(cx, cy, 2.4, '#4c8a2e', false);
  if (x.includes('blush')) s += circle(33, 67, 3.6, 'rgba(255,90,120,0.45)', false) + circle(67, 67, 3.6, 'rgba(255,90,120,0.45)', false);
  if (x.includes('panda')) {
    s += `<ellipse cx="39" cy="59" rx="7" ry="9" transform="rotate(25 39 59)" fill="${INK}"/><ellipse cx="61" cy="59" rx="7" ry="9" transform="rotate(-25 61 59)" fill="${INK}"/>`;
    s += circle(40, 58, 2.2, '#fff', false) + circle(60, 58, 2.2, '#fff', false) + p('M46 66 Q50 64 54 66 Q50 71 46 66 Z', INK);
  }
  if (x.includes('scar')) s += line('M34 44 L44 70', '#7a2a1e', 2.6);
  return s;
}

function extrasOver(x: Extra[], band: string): string {
  let s = '';
  if (x.includes('headband') || x.includes('bandana')) s += p('M24 44 Q50 37 76 44 L76 51 Q50 44 24 51 Z', band);
  if (x.includes('stripes')) s += line('M26 47.5 Q50 41 74 47.5', '#2f5bd8', 1.6);
  if (x.includes('bandana')) s += p('M74 46 L88 40 L86 52 Z', band) + p('M74 49 L89 57 L80 60 Z', band);
  if (x.includes('blindfold')) s += p('M23 51 Q50 46 77 51 L77 63 Q50 58 23 63 Z', '#16181d');
  if (x.includes('glasses')) s += `<rect x="31" y="52" width="16" height="12" rx="3" fill="none" stroke="${INK}" stroke-width="2.4"/><rect x="53" y="52" width="16" height="12" rx="3" fill="none" stroke="${INK}" stroke-width="2.4"/>` + line('M47 57 L53 57', INK, 2.2);
  if (x.includes('shades')) s += `<rect x="29" y="51" width="18" height="12" rx="5" fill="#cfe8b0" fill-opacity="0.85" stroke="${INK}" stroke-width="2.4"/><rect x="53" y="51" width="18" height="12" rx="5" fill="#cfe8b0" fill-opacity="0.85" stroke="${INK}" stroke-width="2.4"/>` + line('M47 56 L53 56', INK, 2.4);
  if (x.includes('highcollar')) s += p('M24 70 Q50 78 76 70 L80 100 L20 100 Z', '#1b1f3a') + line('M50 74 L50 100', '#3a3f6a', 2);
  if (x.includes('earrings')) s += circle(25, 69, 2.6, '#ffd23f') + circle(75, 69, 2.6, '#ffd23f');
  if (x.includes('gauges')) s += circle(25, 69, 4, 'none') + circle(75, 69, 4, 'none');
  return s;
}

/** Whether this code has a drawn face (otherwise the plain jelly face is used). */
export const hasFace = (code: string | null | undefined) => !!code && code in FACES;

/** A player's face as a complete <svg>, on a badge in their color. */
export function faceSvg(code: string | null | undefined, color: string, size = 100): string {
  const f = code ? FACES[code] : undefined;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">`;
  const clip = `<defs><clipPath id="fc"><circle cx="50" cy="50" r="47"/></clipPath></defs>`;
  const badge = `<circle cx="50" cy="50" r="47" fill="${color}"/>`;
  const rim = `<circle cx="50" cy="50" r="47" fill="none" stroke="${INK}" stroke-width="3"/>`;
  if (!f) {
    // The plain jelly: a soft blob in a lighter tint of the badge, two eyes.
    const blob = p('M50 22 C70 22 78 38 78 56 C78 76 66 86 50 86 C34 86 22 76 22 56 C22 38 30 22 50 22 Z', '#fffdf8');
    return `${open}${clip}${badge}<g clip-path="url(#fc)">${blob}${circle(42, 54, 3.4, INK, false)}${circle(58, 54, 3.4, INK, false)}${line('M45 66 Q50 70 55 66')}</g>${rim}</svg>`;
  }
  const hc = f.hairColor ?? INK;
  const x = f.extras ?? [];
  const ears = x.includes('pointyears') || f.hair === 'turban'
    ? p('M27 54 L12 44 L26 66 Z', f.skin) + p('M73 54 L88 44 L74 66 Z', f.skin)
    : x.includes('panda') ? circle(30, 34, 9, INK) + circle(70, 34, 9, INK)
    : circle(25, 60, 5, f.skin) + circle(75, 60, 5, f.skin);
  const collar = f.collar ? p('M14 100 Q18 86 36 84 L64 84 Q82 86 86 100 Z', f.collar) : '';
  const head = `<ellipse cx="50" cy="58" rx="25" ry="28" fill="${f.skin}" stroke="${INK}" stroke-width="2.6"/>`;
  return [
    open, clip, badge, '<g clip-path="url(#fc)">',
    collar, hairBack(f.hair, hc), ears, head,
    extrasUnder(x), eyesSvg(f.eyes, f.eyeColor ?? INK), browsSvg(f.brows, f.hair === 'none' || f.hair === 'dome' || f.hair === 'turban' ? INK : hc === '#f2f4f8' || hc === '#e6e8ef' ? '#9aa0b0' : hc),
    mouthSvg(f.mouth), hairFront(f.hair, hc, f.band), extrasOver(x, f.band ?? '#f4f1e6'),
    '</g>', rim, '</svg>',
  ].join('');
}
