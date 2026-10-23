// HEAD paint jobs, current and previous generation.
// Source: docs/research/rackets/head.md, checked against the TW photos in docs/research/rackets/photos/head.
// Clock ranges were measured on the front-facing shot (string bed toward you, head up).
// `cap` is the color the butt flare shows from the side; HEAD end faces are black with a silver or white icon.

const BLACK_GRIP = '#1c1d21';

const SPEED_2026 = {
  head: 'oval',
  base: '#3d4147', // dark slate, not pure black
  zones: [{ from: 1.25, to: 3.25, color: '#ecebe8' }], // one white block, right side only
  throat: '#3d4147',
  shaft: '#ecebe8', // white throat V and handle top
  grip: '#eeedeb',
  cap: '#ecebe8', // white outer rim, black end face
  finish: 'matte',
};

const SPEED_2024 = {
  head: 'oval',
  base: '#d6dade',
  // black from the lower left, over the top, to just past 2 on the right
  zones: [{ from: 8.25, to: 2.5, color: '#2f2f38' }],
  throat: '#d6dade',
  shaft: '#2f2f38', // lower throat arms and shaft turn black
  grip: '#363636',
  cap: '#2a2a2e',
  finish: 'matte',
};

export default [
  {
    model: 'SPEED MP',
    gens: [
      { year: '2026', design: SPEED_2026 },
      { year: '2024', design: SPEED_2024 },
    ],
  },
  {
    // Same paint as the MP in both generations; only the small PRO label differs.
    model: 'SPEED PRO',
    gens: [
      { year: '2026', design: SPEED_2026 },
      { year: '2024', design: SPEED_2024 },
    ],
  },
  {
    model: 'RADICAL MP',
    gens: [
      {
        year: '2025',
        design: {
          head: 'oval',
          base: '#fb6450', // coral
          // Photo: the red block starts a bit past 2 (write-up said 2) and there is a second red patch low on the left.
          zones: [
            { from: 2.25, to: 4.75, color: '#f5301f' },
            { from: 7, to: 8.25, color: '#f5301f' },
          ],
          // Left arm is red, right arm red up top and coral lower; red reads best for the arms.
          throat: '#f5301f',
          shaft: '#fb6450',
          grip: '#f46a5f', // salmon grip, a touch lighter in the photo than the sampled #f25652
          cap: '#f46a5f', // coral rim round a black end face
          finish: 'gloss',
        },
      },
      {
        year: '2023',
        design: {
          head: 'oval',
          base: '#fd4a1a',
          zones: [{ from: 4.25, to: 6, color: '#333659' }], // navy only on the lower right into the bridge
          pin: '#f73253', // pinker string-bed face
          throat: '#333659',
          shaft: '#333659',
          grip: BLACK_GRIP,
          cap: BLACK_GRIP, // photo shows an all-black cap, no orange rim
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'GRAVITY MP',
    gens: [
      {
        year: '2025',
        design: {
          head: 'oval',
          base: '#1e2020', // gloss black
          // metallic teal from past 2 on the right, round the bottom, to about 8 on the left
          zones: [{ from: 2.3, to: 8.25, color: '#1a8a9a' }],
          throat: '#1a8a9a',
          shaft: '#1e2020',
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'gloss',
        },
      },
      {
        year: '2023',
        design: {
          head: 'oval',
          base: '#3d4252', // matte slate navy
          // pale steel blue: wider on the right side and a short patch low on the left, thin line elsewhere
          zones: [
            { from: 2.25, to: 4.3, color: '#6f8aa6' },
            { from: 7, to: 8, color: '#6f8aa6' },
          ],
          pin: '#6f8aa6',
          throat: '#3d4252',
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'matte',
        },
      },
    ],
  },
  {
    model: 'EXTREME MP',
    gens: [
      {
        year: '2026',
        design: {
          head: 'oval',
          base: '#9ad85a', // lime
          zones: [{ from: 1.25, to: 3.1, color: '#1f211e' }],
          throat: '#9ad85a',
          shaft: '#1f211e',
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'gloss',
        },
      },
      {
        year: '2024',
        design: {
          head: 'oval',
          base: '#d3dcc0', // pale sage
          // neon lime from about 2 on the right, round the bottom, to about 8.5 on the left; soft edges
          zones: [
            { from: 2, to: 2.5, color: '#d3dcc0', fade: '#c2e45a' },
            { from: 2.5, to: 8.25, color: '#c2e45a' },
            { from: 8.25, to: 8.75, color: '#c2e45a', fade: '#d3dcc0' },
          ],
          // Photo: both upper arms are lime (write-up said the right arm is sage); sage from mid-throat down.
          throat: '#c2e45a',
          shaft: '#d3dcc0',
          grip: '#cbdcae',
          cap: '#cbdcae',
          finish: 'matte',
        },
      },
    ],
  },
  {
    // Listed before PRESTIGE MP so a substring match on 'PRESTIGE MP' cannot catch it.
    model: 'IPRESTIGE MP',
    keys: ['IPRESTIGE MP 2.0', 'IPRESTIGE'],
    gens: [
      {
        year: '2026',
        design: {
          head: 'oval',
          base: '#2f2e2f', // black
          zones: [{ from: 7.6, to: 4.4, color: '#bbbabb' }], // silver face over the whole top
          throat: '#2f2e2f',
          throatAccent: '#b8962e', // gold inserts on both arms
          grip: BLACK_GRIP, // black with small gold dots
          cap: BLACK_GRIP,
          text: '#1a1a1a', // huge black HEAD on the silver, right side
          textAt: [1.5, 4.25],
          finish: 'matte',
        },
      },
    ],
  },
  {
    model: 'PRESTIGE MP',
    gens: [
      {
        // Still the regular-production Prestige MP; the 2026 Limited is a special edition.
        year: '2023',
        design: {
          head: 'oval',
          base: '#3c3a40', // charcoal
          // Photo: the deep red starts a bit past 2 on the right and runs round the bottom to about 8
          // (write-up said 3 to 5 plus the lower hoop).
          zones: [{ from: 2.3, to: 8.1, color: '#6b2a2a' }],
          throat: '#6b2a2a',
          shaft: '#3c3a40',
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'matte', // matte charcoal body; the red panel itself is gloss metallic
        },
      },
      {
        year: '2021',
        design: {
          head: 'oval',
          base: '#2c2a2e',
          // subtle wine sheen building over the top right and down the right side
          zones: [
            { from: 11, to: 1, color: '#2c2a2e', fade: '#4a1f2a' },
            { from: 1, to: 4.5, color: '#4a1f2a' },
          ],
          throat: '#2c2a2e',
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          // The big orange-red HEAD sits on the inner wall of the right side; it is the frame's signature.
          text: '#ff4a2a',
          textAt: [1, 3.5],
          finish: 'matte',
        },
      },
    ],
  },
  {
    model: 'BOOM MP',
    gens: [
      {
        year: '2026',
        design: {
          head: 'oval',
          base: '#1fc2e7', // cyan
          zones: [{ from: 1.15, to: 3.1, color: '#2e353e' }],
          throat: '#1fc2e7',
          shaft: '#202b3a',
          grip: '#232c3d', // navy, not black
          cap: '#232c3d',
          finish: 'matte', // reads satin in the photos, not the gloss the write-up says
        },
      },
      {
        year: '2024',
        design: {
          head: 'oval',
          base: '#70e0c8', // mint
          zones: [{ from: 8.2, to: 2.15, color: '#222426' }], // black over the top, lower on the left
          throat: '#70e0c8',
          shaft: '#222426',
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'matte',
        },
      },
    ],
  },
];
