// Babolat paint jobs, current and previous generation.
// Research: docs/research/rackets/babolat.md, photos in docs/research/rackets/photos/babolat.
// Clock ranges were measured on each front shot (string bed toward you, head up) by walking the hoop and sampling.
// Brand look: the accent sits in two side blocks at 3 and 9 split by a thin gap of frame color, not in a top band.
// Babolat butt caps are the grip color with the wordmark in the accent; `cap` is the cap body color.

const BLACK_GRIP = '#1f1f22';
const LEATHER = '#a8592a'; // Pure Strike 97 / VS tan leather; the cap is the same brown with a gold wordmark
const WHITE_GRIP = '#dededa';

// Pure Aero 2026 family: slate grey, solid lime blocks both sides, lime string groove all round, black bumper.
const LIME_26 = '#c8fa3c';
const SLATE_26 = '#5f7378';

// Pure Aero 2023 family: charcoal/slate camo, lime on the right side, silver-white on the left.
const CAMO_23 = '#4a5157'; // the photos read bluer and lighter than the research's #3c3e40: slate shards over black
const LIME_23 = '#d4ec66';
const SILVER_23 = '#d6dce2'; // research says #c0c6cc; the photos show it close to white

const AERO_2023 = (textAt) => ({
  head: 'oval',
  base: CAMO_23,
  zones: [
    // right: two lime blocks split by a thin camo gap at about 3:55
    { from: 3.1, to: 3.82, color: LIME_23 },
    { from: 3.98, to: 4.65, color: LIME_23 },
    // left: the same blocks in silver-white
    { from: 7.35, to: 8.0, color: SILVER_23 },
    { from: 8.15, to: 8.9, color: SILVER_23 },
    // lime camo shards across the top right
    { from: 0.4, to: 0.65, color: LIME_23 },
    { from: 0.9, to: 1.15, color: LIME_23 },
  ],
  bumper: '#2a2b2e',
  throat: CAMO_23,
  throatAccent: LIME_23, // the big jagged lime "AERO" shards run down both arms
  collar: BLACK_GRIP,
  grip: BLACK_GRIP,
  cap: BLACK_GRIP,
  text: LIME_23, // outlined lime wordmark on the left of the face
  textAt,
  finish: 'matte',
});

const AERO_2026 = (zones, textAt) => ({
  head: 'oval',
  base: SLATE_26,
  zones: zones.map(([from, to]) => ({ from, to, color: LIME_26 })),
  pin: LIME_26,
  bumper: '#2b3134',
  throat: SLATE_26,
  throatAccentR: LIME_26, // the halftone lime "AERO" runs down the right arm only
  shaft: '#6d8085',
  collar: BLACK_GRIP,
  grip: BLACK_GRIP,
  cap: BLACK_GRIP,
  text: '#d6dcdf', // big silver wordmark on the face
  textAt,
  finish: 'matte',
});

// Pure Drive 2025 family: pale metallic blue, navy crown fading in at both shoulders, navy blocks at 3 and 9.
const DRIVE_BLUE_25 = '#72aed3';
const DRIVE_NAVY = '#2b3445';

const DRIVE_2025 = (blocks) => ({
  head: 'oval',
  base: DRIVE_BLUE_25,
  zones: [
    { from: 9.5, to: 10.4, color: DRIVE_BLUE_25, fade: DRIVE_NAVY },
    { from: 10.4, to: 1.2, color: DRIVE_NAVY },
    { from: 1.2, to: 2.0, color: DRIVE_NAVY, fade: DRIVE_BLUE_25 },
    ...blocks.map(([from, to]) => ({ from, to, color: DRIVE_NAVY })),
  ],
  bumper: DRIVE_NAVY,
  throat: DRIVE_BLUE_25,
  throatAccent: DRIVE_NAVY, // giant navy "DRIVE" letters
  shaft: '#356684',
  collar: BLACK_GRIP,
  grip: BLACK_GRIP,
  cap: BLACK_GRIP,
  text: '#7cb4d8', // light blue wordmark on the navy crown
  textAt: [11.6, 1.4],
  finish: 'gloss',
});

// Pure Strike 4th gen: two coral blocks per side, frame color top and throat.
const STRIKE_GREY = '#949ea8'; // metallic; research #8c949a, photos read a touch lighter and cooler
const STRIKE_CORAL_GREY = '#f24c42';
const STRIKE_WHITE = '#ececea';
const STRIKE_CORAL_WHITE = '#fb4a3e';

const strikeBlocks = (coral, r1, r2) => [
  { from: r1[0], to: r1[1], color: coral },
  { from: r2[0], to: r2[1], color: coral },
  { from: 12 - r1[1], to: 12 - r1[0], color: coral },
  { from: 12 - r2[1], to: 12 - r2[0], color: coral },
];

// Pure Strike 3rd gen (2019): white, coral blocks on the right, charcoal blocks on the left, coral bumper.
const STRIKE_2019 = (grip) => ({
  head: 'oval',
  base: '#ecebea',
  zones: [
    { from: 3.05, to: 3.75, color: '#fb5a45' },
    { from: 4.05, to: 4.8, color: '#fb5a45' },
    { from: 7.2, to: 7.95, color: '#474b4e' },
    { from: 8.25, to: 8.95, color: '#474b4e' },
  ],
  // the outer rim reads coral over the top and right in every photo; the research says the left half is black
  bumper: '#f2604a',
  throat: '#ecebea',
  throatAccentL: '#fb5a45', // the red and black "STRIKE" stencil stack runs down the left arm; red reads strongest
  collar: grip,
  grip,
  cap: grip,
  text: '#2a2a2c', // black wordmark down the upper left of the face
  textAt: [9.3, 11.6],
  finish: 'gloss',
});

export default [
  {
    model: 'PURE AERO 98',
    gens: [
      // Lime blocks sit a touch higher on the 98 than on the 100; the silver wordmark shows on the upper right.
      { year: '2026', design: AERO_2026([[3.1, 3.88], [4.1, 4.9], [7.35, 8.1], [8.25, 8.9]], [0.7, 2.9]) },
      // The user owns two of these. Front shot: lime on the RIGHT (3 o'clock), silver-white on the LEFT (9).
      { year: '2023', design: AERO_2023([9.3, 11.6]) },
    ],
  },
  {
    model: 'PURE AERO',
    keys: ['PURE AERO 100', 'PURE AERO TEAM', 'PURE AERO LITE', 'PURE AERO PLUS'],
    gens: [
      // On the 100 the silver wordmark shows on the upper left of the face in the front shot.
      { year: '2026', design: AERO_2026([[3.1, 3.85], [4.15, 4.8], [7.2, 7.85], [8.15, 8.85]], [9.1, 10.6]) },
      {
        year: '2023',
        design: {
          ...AERO_2023([9.4, 11.6]),
          zones: [
            ...AERO_2023().zones,
            { from: 1.45, to: 2.05, color: SILVER_23 }, // a silver shard at the right shoulder the 98 does not have
          ],
        },
      },
    ],
  },
  {
    model: 'PURE AERO RAFA',
    keys: ['PURE AERO RAFA ORIGIN', 'RAFA ORIGIN'],
    gens: [
      {
        // 2023 Rafa and Rafa Origin share this paint. No 2026-platform Rafa exists as of Oct 2026.
        year: '2023',
        design: {
          head: 'oval',
          base: '#e888c0', // hot pink: lower hoop and throat
          zones: [
            { from: 7.25, to: 1.4, color: '#d8f272' }, // neon yellow over the top
            { from: 1.4, to: 2.1, color: '#d8f272', fade: '#e888c0' }, // yellow through orange into pink, right shoulder
            { from: 6.9, to: 7.3, color: '#e888c0', fade: '#d8f272' }, // same blend low on the left
            { from: 3.1, to: 3.82, color: '#78c0e2' }, // sky blue, split by a pink line
            { from: 3.95, to: 4.65, color: '#78c0e2' },
            { from: 7.4, to: 7.95, color: '#464e5f' }, // navy, split by a yellow line
            { from: 8.1, to: 8.9, color: '#464e5f' },
          ],
          bumper: '#3f4457', // navy outer rim
          throat: '#e888c0',
          throatAccent: '#d8f272', // yellow brush-stroke "AERO"
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          text: '#3f4457', // navy wordmark down the upper left
          textAt: [9.2, 11.5],
          finish: 'matte', // research guessed gloss; the close-ups show a soft pearly satin
        },
      },
      {
        // 1st Rafa edition (retail March 2021, 2019 Pure Aero mold)
        year: '2021',
        design: {
          head: 'oval',
          base: '#f2b01a', // amber
          zones: [
            { from: 9.0, to: 9.8, color: '#f2b01a', fade: '#f7813f' },
            { from: 9.8, to: 1.0, color: '#f7813f' }, // orange crown
            { from: 1.0, to: 1.7, color: '#f7813f', fade: '#f2b01a' },
            { from: 3.1, to: 3.9, color: '#d8649f' }, // magenta, split by a lemon line
            { from: 4.05, to: 4.65, color: '#d8649f' },
            { from: 4.65, to: 6.3, color: '#e6e46a' }, // lemon lower right and bridge
            { from: 6.3, to: 6.8, color: '#e6e46a', fade: '#f2b01a' },
            { from: 7.4, to: 7.95, color: '#4a4947' }, // charcoal, split by an amber line
            { from: 8.1, to: 8.9, color: '#4a4947' },
          ],
          bumper: '#2e2d2e',
          throat: '#e6e870', // lemon
          throatAccent: '#c8409a', // magenta "AERO"
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          text: '#3d3a3b', // charcoal wordmark on the orange
          textAt: [9.3, 11.6],
          finish: 'matte', // research guessed gloss; the photos show satin
        },
      },
    ],
  },
  {
    model: 'PURE DRIVE',
    keys: ['PURE DRIVE 100', 'PURE DRIVE TEAM', 'PURE DRIVE LITE', 'PURE DRIVE PLUS', 'PURE DRIVE TOUR', 'PURE DRIVE 107'],
    gens: [
      { year: '2025', design: DRIVE_2025([[3.1, 3.82], [4.0, 4.6], [7.4, 7.85], [8.1, 8.9]]) },
      {
        year: '2021',
        design: {
          head: 'oval',
          base: '#0aa0dc', // saturated cyan
          zones: [
            // navy runs from the crown down the whole right shoulder to 3, with cyan letters over it
            { from: 11.9, to: 3.05, color: '#2d3446' },
            { from: 3.68, to: 3.88, color: '#2d3446' },
            { from: 4.5, to: 5.0, color: '#2d3446' },
            { from: 7.45, to: 8.1, color: '#2d3446' },
            { from: 8.32, to: 8.93, color: '#2d3446' },
          ],
          bumper: '#2d3446',
          throat: '#0a8fd0',
          throatAccent: '#2d3446', // navy "DRIVE" slashes
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          text: '#0896d0', // big cyan wordmark on the navy crown
          textAt: [11.9, 2.2],
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'PURE DRIVE 98',
    gens: [
      // Same paint as the Pure Drive 2025 apart from the red-orange top line.
      {
        year: '2025',
        design: {
          ...DRIVE_2025([[3.05, 3.77], [3.97, 4.7], [7.3, 8.03], [8.23, 8.95]]),
          base: '#6ba9cc',
          pin: '#f0482c', // red-orange groove and grommets across the top only: the 98's tell
          pinAt: [10.5, 1.5],
        },
      },
      {
        year: '2023',
        design: {
          head: 'oval',
          base: '#0a7cc0', // royal blue: the whole left half and the top left
          zones: [
            { from: 0.2, to: 3.05, color: '#2c2e3b' }, // navy crown and right shoulder
            { from: 3.05, to: 3.62, color: '#0bb4dc' }, // bright cyan, split by navy
            { from: 3.62, to: 3.88, color: '#2c2e3b' },
            { from: 3.88, to: 4.72, color: '#0bb4dc' },
            { from: 4.72, to: 5.9, color: '#2c2e3b' }, // navy down to the bridge
            { from: 7.45, to: 8.1, color: '#2c2e3b' },
            { from: 8.35, to: 8.95, color: '#2c2e3b' },
          ],
          bumper: '#22252e',
          pin: '#d8283a', // red groove and grommets across the top
          pinAt: [10.5, 1.5],
          throat: '#0a7cc0',
          throatL: '#0a7cc0', // royal with navy letters
          throatR: '#2c2e3b', // navy with cyan letters
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP, // the wordmark on the cap is red (#bb072c), the quickest tell for this frame
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'PURE STRIKE 97',
    gens: [
      {
        // 4th gen in the Carbon Grey colorway (only colorway sold since about Aug 2025)
        year: 'CARBON GREY',
        design: {
          head: 'oval',
          base: STRIKE_GREY,
          zones: strikeBlocks(STRIKE_CORAL_GREY, [3.0, 3.72], [3.9, 4.68]),
          // research says a black bumper; the angled photo shows a grey bumper with dark grooves, so none is set
          throat: STRIKE_GREY,
          collar: '#1c1c1c',
          grip: LEATHER,
          cap: '#9a5222',
          text: '#3a3f45',
          textAt: [11.2, 1.3],
          finish: 'matte',
        },
      },
      {
        // same 4th gen, launch colorway (early 2024 to mid 2025)
        year: '2024 WHITE',
        design: {
          head: 'oval',
          base: STRIKE_WHITE,
          zones: strikeBlocks(STRIKE_CORAL_WHITE, [3.0, 3.7], [3.95, 4.7]),
          // research says black bumper; the photos show it white like the face, so none is set
          throat: STRIKE_WHITE,
          collar: '#e8e6e0',
          grip: '#b5672e',
          cap: '#a85d28',
          text: '#2a2a2a', // bold black wordmark across the top
          textAt: [10.5, 1.5],
          finish: 'matte',
        },
      },
      {
        // Pure Strike VS (2022), the 97's predecessor
        year: '2022 VS',
        design: {
          head: 'oval',
          base: '#4b4643', // smoked bronze, reads brown-black
          zones: [
            { from: 3.15, to: 3.7, color: '#fc4702' },
            { from: 3.9, to: 4.65, color: '#fc4702' },
            { from: 7.4, to: 8.1, color: '#f2f2f2' },
            { from: 8.35, to: 8.95, color: '#f2f2f2' },
          ],
          throat: '#4b4643',
          throatAccentL: '#fc4702', // red "STRIKE" letters on the left arm
          throatAccentR: '#f2f2f2', // white "VS" letters on the right arm
          collar: '#29242a',
          grip: '#cf7c46',
          cap: '#c27236',
          text: '#fc4702', // red wordmark down the upper left
          textAt: [9.4, 11.8],
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'PURE STRIKE 100',
    keys: ['PURE STRIKE 100 16X20', 'PURE STRIKE TEAM', 'PURE STRIKE LITE'],
    gens: [
      {
        year: 'CARBON GREY',
        design: {
          head: 'oval',
          base: STRIKE_GREY,
          zones: strikeBlocks(STRIKE_CORAL_GREY, [3.15, 3.87], [4.09, 4.85]),
          bumper: '#262626',
          throat: STRIKE_GREY,
          throatAccentR: STRIKE_CORAL_GREY, // coral "STRIKE" letters on the right arm
          collar: WHITE_GRIP,
          grip: WHITE_GRIP,
          cap: WHITE_GRIP,
          text: '#2a2a2a',
          textAt: [10.8, 1.3],
          finish: 'matte',
        },
      },
      {
        year: '2024 WHITE',
        design: {
          head: 'oval',
          base: STRIKE_WHITE,
          zones: strikeBlocks(STRIKE_CORAL_WHITE, [3.15, 3.87], [4.1, 4.87]),
          bumper: '#262626',
          throat: STRIKE_WHITE,
          collar: WHITE_GRIP,
          grip: WHITE_GRIP,
          cap: WHITE_GRIP,
          text: '#2a2a2a',
          textAt: [10.5, 1.5],
          finish: 'matte',
        },
      },
      { year: '2019', design: STRIKE_2019('#ececea') },
    ],
  },
  {
    // Not in RACKETS yet. Same 4th-gen paint as the 100, but black grip and cap.
    model: 'PURE STRIKE 98',
    keys: ['PURE STRIKE 98 16X19', 'PURE STRIKE 98 18X20'],
    gens: [
      {
        year: 'CARBON GREY',
        design: {
          head: 'oval',
          base: STRIKE_GREY,
          zones: strikeBlocks(STRIKE_CORAL_GREY, [3.1, 3.82], [4.05, 4.8]),
          bumper: '#262626',
          throat: STRIKE_GREY,
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          text: '#2a2a2a',
          textAt: [10.8, 1.3],
          finish: 'matte',
        },
      },
      { year: '2019', design: STRIKE_2019('#ececea') },
    ],
  },
];
