// Prince. Research: docs/research/rackets/prince.md, photos in docs/research/rackets/photos/prince.
// Caps follow the photos (the flare side): black on the 2020 Phantom and 2022 Tour. The research's bright lime cap is
// the end face, which the photos do not show.

export default [
  {
    model: 'PHANTOM 100',
    keys: ['PHANTOM 100X', 'PHANTOM 100X 305', 'PHANTOM 100X 290', 'PHANTOM 100X 18X20', 'PHANTOM 100P'],
    gens: [
      {
        year: '2024',
        design: {
          head: 'oval',
          base: '#6b6b3c',
          zones: [
            // tonal camo: a darker olive patch over the upper left
            { from: 10.3, to: 11.8, color: '#4f5132' },
          ],
          bumper: '#4e5a38',
          throat: '#6b6b3c',
          // the right arm is mostly the darker olive
          throatR: '#565838',
          collar: '#6b6b3c',
          grip: '#8a8a66',
          cap: '#7a7a58',
          finish: 'matte',
        },
      },
      {
        year: '2020',
        design: {
          head: 'oval',
          base: '#4a5268',
          bumper: '#2a2c30',
          throat: '#4a5268',
          grip: '#2a2c30',
          cap: '#2a2c30',
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'TOUR 100',
    keys: ['TOUR 100P', 'TOUR 100 310', 'TOUR 100 290', 'ATS TEXTREME TOUR 100', 'TEXTREME TOUR 100'],
    gens: [
      {
        year: '2026',
        design: {
          head: 'oval',
          base: '#1d1e1f',
          zones: [
            // giant orange T O U R letters down the right side, black between them
            { from: 1.5, to: 2.1, color: '#f07a20' },
            { from: 2.4, to: 3.1, color: '#f07a20' },
            { from: 3.4, to: 4, color: '#f07a20' },
            { from: 4.2, to: 4.8, color: '#f07a20' },
          ],
          throat: '#1d1e1f',
          grip: '#1c1d21',
          cap: '#1c1d21',
          finish: 'gloss',
        },
      },
      {
        year: '2022',
        design: {
          head: 'oval',
          base: '#ececec',
          zones: [
            { from: 7.9, to: 11.6, color: '#1c1d21' },
            // the maze patterns are thin lines on white, so they read as a paler coral and aqua
            { from: 7.1, to: 7.9, color: '#a8d4d4' },
            { from: 12.4, to: 2.4, color: '#ee9a80' },
          ],
          // orange grommets all round
          pin: '#e8603a',
          bumper: '#1c1d21',
          throat: '#ececec',
          throatAccent: '#a8d4d4',
          shaft: '#1c1d21',
          grip: '#1c1d21',
          cap: '#1c1d21',
          finish: 'gloss',
        },
      },
    ],
  },
];
