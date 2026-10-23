// Yonex racket paint jobs. Schema: ./SCHEMA.md. Research: docs/research/rackets/yonex.md, checked against the photos.
// Every Yonex frame uses the squared isometric head.
//
// Butt caps: the write-up says a dark green octagon cap on every frame, but in every product photo the cap reads as the
// grip color (light grey under a white grip, black under a black grip). The photos win, so cap follows the grip.

const WHITE_GRIP = '#eef0f2';
const WHITE_CAP = '#dfe2e6';
const BLACK_GRIP = '#1c1d21';
const BLACK_CAP = '#1a1b1f';

// EZONE 2025 (Blast Blue): one bright blue, mint flashes low on both sides, darker camo blotches up the sides, white grip.
const EZONE_2025 = {
  head: 'iso',
  base: '#3d63b4',
  zones: [
    { from: 1.6, to: 3.2, color: '#34519f' },
    { from: 8.8, to: 10.4, color: '#34519f' },
    { from: 3.6, to: 4.3, color: '#4fd6b8' },
    { from: 7.8, to: 8.6, color: '#4fd6b8' },
  ],
  throat: '#4670c0',
  shaft: '#5a86d0', // translucent ice-blue lower shaft and collar
  grip: WHITE_GRIP,
  cap: WHITE_CAP,
  finish: 'gloss',
};

// EZONE 2022 (Sky Blue): navy crown and throat, the sides fade to sky blue (stronger on the right), black grip.
const EZONE_2022 = {
  head: 'iso',
  base: '#2a3550',
  zones: [
    { from: 1.3, to: 2.6, color: '#2a3550', fade: '#56a6c8' },
    { from: 2.6, to: 4.0, color: '#56a6c8' },
    { from: 4.0, to: 5.4, color: '#56a6c8', fade: '#2a3550' },
    { from: 7.0, to: 8.2, color: '#2a3550', fade: '#4f93b8' },
    { from: 8.2, to: 9.6, color: '#4f93b8', fade: '#2a3550' },
  ],
  throat: '#2a3550',
  grip: BLACK_GRIP,
  cap: BLACK_CAP,
  finish: 'gloss',
};

// EZONE Espresso Brown (Aug 2026 special edition of the 2025 frame): near-black brown, copper flashes low on both sides.
const EZONE_ESPRESSO = {
  head: 'iso',
  base: '#3a3632',
  zones: [
    { from: 1.8, to: 2.3, color: '#c8642c' },
    { from: 3.7, to: 4.3, color: '#d0703a' },
    { from: 7.8, to: 8.7, color: '#d0703a' },
  ],
  throat: '#3a3632',
  grip: BLACK_GRIP,
  cap: BLACK_CAP,
  finish: 'matte',
};

// VCORE 2026 (Ruby Red): solid deep red, big cream YONEX down the left side of the hoop, thin mint slivers on the right.
// The write-up puts YONEX on the shaft; the front and side photos show it lettered on the hoop at about 8 to 10:30.
const VCORE_2026 = {
  head: 'iso',
  base: '#c01530',
  zones: [
    { from: 1.6, to: 2.0, color: '#7fd8c8' },
    { from: 3.6, to: 4.4, color: '#7fd8c8' },
  ],
  throat: '#c01530',
  grip: WHITE_GRIP,
  cap: WHITE_CAP,
  text: '#f0dcb0',
  textAt: [8, 10.5],
  finish: 'gloss',
};

// VCORE 2023 (Scarlet): bright red. The write-up says a dark crown at 10 to 2; the photos show the top red and the
// charcoal at the lower hoop, bridge and upper throat, with cyan-blue blocks at about 4 and 8. Black grip.
const VCORE_2023 = {
  head: 'iso',
  base: '#dc2133',
  zones: [
    { from: 1.6, to: 2.1, color: '#3a3a44' },
    { from: 9.9, to: 10.4, color: '#3a3a44' },
    { from: 3.3, to: 4.1, color: '#2f8fe0' },
    { from: 4.1, to: 7.7, color: '#34343d' },
    { from: 7.7, to: 8.4, color: '#2f8fe0' },
  ],
  throat: '#34343d',
  shaft: '#dc2133',
  grip: BLACK_GRIP,
  cap: BLACK_CAP,
  finish: 'gloss',
};

// VCORE Sand Beige (Aug 2024 special edition of the 2023 frame): off-white with tan side blocks, white grip.
const VCORE_SAND = {
  head: 'iso',
  base: '#e6e0d8',
  zones: [
    { from: 2.4, to: 3.0, color: '#c9ad8c' },
    { from: 3.8, to: 4.4, color: '#c9ad8c' },
    { from: 7.6, to: 8.3, color: '#c9ad8c' },
    { from: 9.4, to: 10.4, color: '#c9ad8c' },
  ],
  throat: '#dcd3cc',
  throatAccent: '#c9ad8c',
  grip: WHITE_GRIP,
  cap: WHITE_CAP,
  finish: 'gloss',
};

// VCORE 2021 (Tango Red, 6th gen). The research labels these photos (vcore-100_2023_*) as 2023, but they show the older
// frame: orange-red fading to maroon on the left, a blue block at the tip, charcoal over the top right, black bumper.
const VCORE_2021 = {
  head: 'iso',
  base: '#e8402c',
  zones: [
    { from: 4.0, to: 6.0, color: '#e8402c', fade: '#8a2a35' },
    { from: 6.0, to: 8.0, color: '#8a2a35' },
    { from: 8.0, to: 11.0, color: '#8a2a35' },
    { from: 11.0, to: 12.3, color: '#2a8fd0' },
    { from: 12.3, to: 2.5, color: '#2c2a30', fade: '#e8402c' },
  ],
  throat: '#e8402c',
  grip: BLACK_GRIP,
  cap: BLACK_CAP,
  finish: 'gloss',
};

// PERCEPT 2023 (Olive Green): sage hoop and throat, darker teal crown, jade block then a small coral flash on the right.
// The write-up puts the coral at 8 to 9; the front photo shows it on the right at about 3:45.
const PERCEPT_2023 = {
  head: 'iso',
  base: '#7fb0a8',
  zones: [
    { from: 8.6, to: 10.0, color: '#4a8a80' },
    { from: 10.0, to: 1.8, color: '#3f7a74' },
    { from: 1.8, to: 3.3, color: '#22b38a' },
    { from: 3.3, to: 3.6, color: '#2f6a66' },
    { from: 3.6, to: 4.1, color: '#e8806a' },
  ],
  throat: '#8fbcb2',
  grip: BLACK_GRIP,
  cap: BLACK_CAP,
  finish: 'matte',
};

// PERCEPT Midnight Navy (July 2025 colorway of the same frame, now the most stocked): slate violet, purple camo on the
// right with a salmon flash, purple low on the left.
const PERCEPT_MIDNIGHT = {
  head: 'iso',
  base: '#4a4a62',
  zones: [
    { from: 1.4, to: 3.0, color: '#8a5cc8' },
    { from: 3.0, to: 3.6, color: '#e08a80' },
    { from: 7.8, to: 9.0, color: '#7a58b8' },
  ],
  throat: '#4f4f68',
  grip: BLACK_GRIP,
  cap: BLACK_CAP,
  finish: 'matte',
};

// VCORE PRO 97 (2021): matte black, purple to blue to teal running down the right side, a little teal and blue at 8.
const VCORE_PRO_2021 = {
  head: 'iso',
  base: '#2a2a32',
  zones: [
    { from: 1.3, to: 2.6, color: '#7a4cc0', fade: '#3f6ad8' },
    { from: 2.6, to: 3.3, color: '#3f6ad8', fade: '#2fc0a8' },
    { from: 3.3, to: 5.6, color: '#2fc0a8' },
    { from: 7.6, to: 8.2, color: '#5a5ad0' },
    { from: 8.2, to: 8.9, color: '#2fc0a8' },
  ],
  throat: '#2a2a32',
  grip: BLACK_GRIP,
  cap: BLACK_CAP,
  finish: 'matte',
};

export default [
  { model: 'EZONE 98', gens: [{ year: '2025', design: EZONE_2025 }, { year: '2022', design: EZONE_2022 }, { year: 'ESPRESSO', design: EZONE_ESPRESSO }] },
  { model: 'EZONE 100', keys: ['EZONE'], gens: [{ year: '2025', design: EZONE_2025 }, { year: '2022', design: EZONE_2022 }, { year: 'ESPRESSO', design: EZONE_ESPRESSO }] },
  { model: 'VCORE 98', gens: [{ year: '2026', design: VCORE_2026 }, { year: '2023', design: VCORE_2023 }, { year: 'SAND BEIGE', design: VCORE_SAND }, { year: '2021', design: VCORE_2021 }] },
  { model: 'VCORE 100', keys: ['VCORE'], gens: [{ year: '2026', design: VCORE_2026 }, { year: '2023', design: VCORE_2023 }, { year: 'SAND BEIGE', design: VCORE_SAND }, { year: '2021', design: VCORE_2021 }] },
  { model: 'PERCEPT 97', keys: ['PERCEPT'], gens: [{ year: '2023', design: PERCEPT_2023 }, { year: 'MIDNIGHT', design: PERCEPT_MIDNIGHT }] },
  // The Percept replaced this line in 2023; same mold family.
  { model: 'VCORE PRO 97', keys: ['VCORE PRO'], gens: [{ year: '2021', design: VCORE_PRO_2021 }] },
];
