// The parts kit for drawn faces (src/lib/faces.ts renders them). Each group of characters lives in its own file
// (faces-dbz.ts, faces-tennis.ts, faces-jjk.ts) and describes a face as a Spec: stock parts by name, plus optional raw SVG
// layers for anything the stock parts can't draw (built with p / line / circle below, in the same 100 x 100 canvas).
//
// Canvas: 100 x 100. Head is an ellipse at (50, 58), 25 wide and 28 tall each way: top of the head y 30, chin y 86.
// Eyes sit on y 58 at x 40 and 60, brows around y 50, mouth around y 74. The badge is a circle of radius 47 at the center;
// anything outside it is clipped.

export const INK = '#16181d';

export type Eyes = 'dot' | 'fierce' | 'wide' | 'calm' | 'closed' | 'blank' | 'none';
export type Brows = 'angry' | 'thick' | 'flat' | 'raised' | 'none';
export type Mouth = 'grin' | 'smile' | 'smirk' | 'flat' | 'frown' | 'open' | 'teeth' | 'lips' | 'none';
export type Hair =
  | 'goku' | 'vegeta' | 'gohan' | 'trunks' | 'short' | 'curly' | 'long' | 'ponytail' | 'bun' | 'topknot' | 'gojo' | 'undercut'
  | 'megumi' | 'yuta' | 'bob' | 'sidepart' | 'mullet' | 'broly' | 'turban' | 'dome' | 'cell' | 'buu' | 'geto' | 'none';
export type Extra =
  | 'headband' | 'bandana' | 'blindfold' | 'glasses' | 'shades' | 'dots6' | 'sukuna' | 'itadori' | 'scar' | 'highcollar'
  | 'earrings' | 'gauges' | 'frieza' | 'cellmarks' | 'spots' | 'pointyears' | 'panda' | 'stripes' | 'blush';

export type Spec = {
  skin: string; hair: Hair; hairColor?: string; eyes: Eyes; eyeColor?: string; brows: Brows; mouth: Mouth;
  collar?: string; extras?: Extra[]; band?: string;
  /** No ears drawn (helmets, carapaces, hair that covers them). */
  noEars?: boolean;
  /** Head shape other than the stock ellipse: a full SVG element (path or ellipse) drawn in place of it. */
  head?: string;
  /** Raw SVG layers, in draw order: behind the head, over the face markings, over the front hair, and on top of everything. */
  back?: string; under?: string; front?: string; over?: string;
};

export const SKIN = { light: '#f6cfa8', fair: '#fbe0c4', medium: '#e0b088', tan: '#c98e5f', brown: '#9a6240', deep: '#6e4128' };

export const p = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${extra}/>`;
export const line = (d: string, color = INK, w = 2.6) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const circle = (cx: number, cy: number, r: number, fill: string, stroke = true) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke ? ` stroke="${INK}" stroke-width="2.2"` : ''}/>`;

