// Wilson racket paint, current generation first. Source: docs/research/rackets/wilson.md,
// checked against docs/research/rackets/photos/wilson. Clock positions are string-bed view, head up.
// No Wilson letters its name across the top of the hoop, so `text` is left unset everywhere.

// Blade 98 and Blade 100 share one cosmetic per generation.
const BLADE_GENS = [
  {
    year: 'V10',
    design: {
      head: 'oval',
      base: '#17804f',
      zones: [
        // satin bumper guard, a flatter darker green, not black
        { from: 10, to: 2, color: '#1f6a47' },
        // infrared hot-spot tick, right side just below 4 in the front photo
        { from: 3.9, to: 4.05, color: '#ff4a2a' },
      ],
      throat: '#17804f',
      // big mint "Wilson" on the left arm (the small spaced "BLADE" on the right does not read)
      throatAccentL: '#8fe3b8',
      grip: '#2f6e4f',
      cap: '#d8232a',
      finish: 'gloss',
    },
  },
  {
    year: 'V9',
    design: {
      head: 'oval',
      base: '#0b5a5e',
      // matte charcoal bumper, hard split just above 10 and 2 in the photo
      zones: [{ from: 9.8, to: 2.2, color: '#2c2f33' }],
      throat: '#0b5a5e',
      shaft: '#0d4a52',
      throatAccentL: '#25282b', // charcoal wordmark, low contrast but visible in the front photo
      grip: '#45464c',
      cap: '#e8452a',
      finish: 'matte',
    },
  },
  {
    year: 'US OPEN 26',
    design: {
      head: 'oval',
      base: '#e9e5dc',
      zones: [
        // navy upper hoop, split at about 2:40 and 9:20
        { from: 9.35, to: 2.65, color: '#2d3260' },
        // coral tick at each split
        { from: 2.65, to: 2.75, color: '#e8505a' },
        { from: 9.25, to: 9.35, color: '#e8505a' },
      ],
      bumper: '#2d3260', // navy outer edge with a lime pinstripe, all the way round
      throat: '#e9e5dc',
      bridge: '#2d3260',
      grip: '#f4f4f2',
      cap: '#f4f4f2',
      finish: 'matte',
    },
  },
  {
    year: 'FALL 26',
    design: {
      head: 'oval',
      base: '#24365a',
      zones: [
        { from: 2.75, to: 4.2, color: '#a9c4b0' }, // sage block, right
        { from: 4.2, to: 4.32, color: '#6e2a3a' }, // maroon tick
        { from: 4.32, to: 4.5, color: '#5d86a8' }, // steel blue tick
        { from: 7.5, to: 7.68, color: '#5d86a8' },
        { from: 7.68, to: 7.8, color: '#6e2a3a' },
        { from: 7.8, to: 9.25, color: '#a9c4b0' }, // sage block, left
      ],
      // taupe runs the whole outer edge (side photo); from the front it reads as the top of the hoop
      bumper: '#8a7b62',
      throat: '#24365a',
      bridge: '#8a7b62',
      grip: '#f2f2ee',
      cap: '#f2f2ee',
      finish: 'matte',
    },
  },
];

export default [
  { model: 'BLADE 98', gens: BLADE_GENS },
  { model: 'BLADE 100', gens: BLADE_GENS },

  {
    model: 'PRO STAFF 97',
    keys: ['PRO STAFF 97 CLASSIC', 'PRO STAFF CLASSIC'],
    gens: [
      {
        // sold as "Pro Staff 97 Classic"; some retailers call it v15
        year: 'CLASSIC',
        design: {
          head: 'oval',
          base: '#1e1f21',
          zones: [
            // red over yellow pinstripe on each side, just above 3 and 9
            { from: 2.82, to: 2.9, color: '#d6202a' },
            { from: 2.9, to: 2.98, color: '#f2c21b' },
            { from: 9.02, to: 9.1, color: '#f2c21b' },
            { from: 9.1, to: 9.18, color: '#d6202a' },
          ],
          throat: '#1e1f21',
          // silver "Wilson" on the left arm; the "PRO STAFF" on the right does not read face-on
          throatAccentL: '#b9bbbd',
          // the shaft carries the same red over yellow stripe above the grip; red reads at phone size
          collar: '#d6202a',
          grip: '#232325',
          cap: '#d8232a',
          finish: 'matte',
        },
      },
      {
        year: 'V14',
        design: {
          head: 'oval',
          base: '#7a4a32',
          // copper sides fade to navy-black across the top (soft gradient, not a hard band)
          zones: [
            { from: 9.5, to: 11, color: '#7a4a32', fade: '#22232b' },
            { from: 11, to: 1, color: '#22232b' },
            { from: 1, to: 2.5, color: '#22232b', fade: '#7a4a32' },
          ],
          throat: '#3a2a26',
          throatAccentL: '#c8743c',
          collar: '#22232b', // dark navy ring above the grip
          bumper: '#22232b', // black outer edge all round (angle photo)
          grip: '#c27a5a', // tan / terracotta, the v14's main cue
          cap: '#d9381e', // red-orange face, black W, copper surround
          finish: 'matte',
        },
      },
      {
        // Pro Staff 97 v14 Roland-Garros 2026 "Session de Soiree"
        year: 'RG 26',
        design: {
          head: 'oval',
          base: '#272c42',
          // cream ornament decals on the lower hoop either side of the throat
          zones: [
            { from: 4.25, to: 4.65, color: '#d9d6cc' },
            { from: 7.35, to: 7.75, color: '#d9d6cc' },
          ],
          throat: '#272c42',
          throatAccentL: '#e06a2a', // orange wordmark
          grip: '#d9692a',
          cap: '#d9692a',
          finish: 'matte',
        },
      },
    ],
  },

  {
    model: 'CLASH 100',
    gens: [
      {
        year: 'V3',
        design: {
          head: 'oval',
          base: '#1c1c1e',
          // infrared inner hoop wall and grommet strip: from the front it is a thin line inside the hoop
          pin: '#ff4a22',
          throat: '#1c1c1e',
          // infrared "Wilson" on the left arm; the "v3 100" panel on the right only shows from the side
          throatAccentL: '#ff4a22',
          bridge: '#ff4a22', // infrared underside of the bridge shows through the strings
          grip: '#232325',
          cap: '#d8232a',
          finish: 'matte',
        },
      },
      {
        year: 'V2',
        design: {
          head: 'oval',
          // photo reads brighter than the write-up's #8e1f2c
          base: '#9e1c2a',
          zones: [{ from: 9.8, to: 2.2, color: '#232527' }],
          throat: '#9e1c2a', // the v2 throat is red, not black
          throatAccentL: '#232527', // black wordmark
          collar: '#232527',
          grip: '#3d3e41',
          cap: '#e04a2a',
          finish: 'matte',
        },
      },
      {
        year: 'REVERSE',
        design: {
          head: 'oval',
          base: '#ec3a2e',
          throat: '#ec3a2e',
          throatAccentL: '#f4f2ee', // white wordmark
          grip: '#f2f2f0',
          cap: '#d8232a',
          finish: 'matte',
        },
      },
      {
        year: 'US OPEN 26',
        design: {
          head: 'oval',
          base: '#e6e2da',
          zones: [
            // lime upper half of the hoop face, 9 round to 3
            { from: 9, to: 3, color: '#dcec5a' },
            // royal blue tick where lime meets cream
            { from: 3, to: 3.1, color: '#3550b0' },
            { from: 8.9, to: 9, color: '#3550b0' },
          ],
          bumper: '#2d3260', // navy outer edge, full length (side photo)
          throat: '#e6e2da',
          bridge: '#2d3260',
          grip: '#f4f4f2',
          cap: '#f4f4f2',
          finish: 'matte',
        },
      },
    ],
  },

  {
    model: 'ULTRA 100',
    gens: [
      {
        year: 'V5',
        design: {
          head: 'oval',
          base: '#1c4fd6',
          pin: '#3fd6c0', // aqua grommet strip on the inner hoop
          throat: '#1c4fd6',
          throatAccentL: '#3fd6c0', // aqua wordmark
          grip: '#222326',
          cap: '#d8232a',
          // write-up says gloss; the close-up shows a satin metallic, so matte
          finish: 'matte',
        },
      },
      {
        year: 'V4',
        design: {
          head: 'oval',
          base: '#2e6a8e',
          zones: [{ from: 9.75, to: 2.25, color: '#1c2433' }], // navy bumper band
          throat: '#2e6a8e',
          throatAccentL: '#1c2433', // navy wordmark, tone-on-tone
          shaft: '#1c2433', // shafts darken to navy above the grip
          grip: '#3a3d48',
          cap: '#e04a2a',
          finish: 'matte',
        },
      },
      {
        year: 'RG 26',
        design: {
          head: 'oval',
          base: '#e0702a',
          zones: [
            // cream ornament decals either side of the throat
            { from: 4.25, to: 4.65, color: '#f0d9c0' },
            { from: 7.35, to: 7.75, color: '#f0d9c0' },
          ],
          // indigo outer edge all round; the face stays clay orange (side photo)
          bumper: '#3a3a86',
          throat: '#e0702a',
          throatAccentL: '#f0d9c0', // cream script wordmark
          bridge: '#3a3a86',
          grip: '#e2772f',
          cap: '#e2772f',
          finish: 'matte',
        },
      },
      {
        year: 'FALL 26',
        design: {
          head: 'oval',
          base: '#5a2352',
          zones: [
            { from: 11.9, to: 12.1, color: '#1f5466' }, // teal tick at the tip
            { from: 2.8, to: 4.2, color: '#a8d4c0' }, // mint block, right
            { from: 4.2, to: 4.32, color: '#1f5466' },
            { from: 4.32, to: 4.55, color: '#ddd8c8' },
            { from: 7.45, to: 7.68, color: '#ddd8c8' },
            { from: 7.68, to: 7.8, color: '#1f5466' },
            { from: 7.8, to: 9.2, color: '#a8d4c0' }, // mint block, left
          ],
          bumper: '#8a7b62', // taupe outer edge, full length
          throat: '#5a2352',
          bridge: '#8a7b62',
          grip: '#f2f2ee',
          cap: '#f2f2ee',
          finish: 'matte',
        },
      },
    ],
  },

  {
    model: 'SHIFT 99',
    gens: [
      {
        // only retail generation; the pearl sheen (pink / lavender / blue) is left out at phone size.
        // The write-up's orange tick at 4 o'clock is not visible in the front photo; the orange
        // marks sit on the throat arms just under the hoop, too small to paint.
        year: 'V1',
        design: {
          head: 'oval',
          base: '#e9edf1',
          throat: '#e9edf1',
          grip: '#a6a6a8',
          cap: '#d8232a',
          finish: 'gloss',
        },
      },
    ],
  },

  // Not yet in RACKETS. Federer's line: RF 01 replaced the Pro Staff RF97 Autograph.
  {
    model: 'RF 01',
    keys: ['RF01', 'RF 01 PRO', 'RF01 PRO', 'RF 97', 'RF97'],
    gens: [
      {
        year: 'V1',
        design: {
          head: 'oval',
          base: '#1f2120',
          // glossier upper hoop catches a dark grey-green; soft edges
          zones: [
            { from: 9, to: 10.5, color: '#1f2120', fade: '#3e4743' },
            { from: 10.5, to: 1.5, color: '#3e4743' },
            { from: 1.5, to: 3, color: '#3e4743', fade: '#1f2120' },
          ],
          throat: '#1f2120',
          grip: '#c77a4c', // tan leather-look
          cap: '#8a5a3a', // bronze surround, the one cap without a red W
          finish: 'matte',
        },
      },
      {
        // Pro Staff RF97 Autograph v13: fully blacked out
        year: 'RF97',
        design: {
          head: 'oval',
          base: '#1b1b1d',
          throat: '#1b1b1d',
          grip: '#1e1e20',
          cap: '#1e1e20',
          finish: 'matte',
        },
      },
      {
        year: 'LAVER CUP 26',
        design: {
          head: 'oval',
          base: '#5a4ed2',
          // violet upper hoop darkens to navy toward the throat
          zones: [
            { from: 3, to: 5, color: '#5a4ed2', fade: '#22285a' },
            { from: 5, to: 7, color: '#22285a' },
            { from: 7, to: 9, color: '#22285a', fade: '#5a4ed2' },
          ],
          throat: '#22285a',
          collar: '#1b1b1d',
          grip: '#c97a42',
          cap: '#8a5a3a',
          finish: 'matte',
        },
      },
    ],
  },
];
