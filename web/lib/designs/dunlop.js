// Dunlop. Research: docs/research/rackets/dunlop.md, photos in docs/research/rackets/photos/dunlop.
// The second color sits on the upper LEFT (about 7:30 to 10:30) on every gen here. The research calls the 2024/2025
// black crown symmetric (10 to 2); the front photos show it running from about 10:30 over the top and down the right
// to about 2:45, with a short block of the bright color at 3. The photos win.

const BLACK_GRIP = '#1c1d21';
// Every frame here has a black bumper all round the outer edge and a black collar above the grip.

export default [
  {
    model: 'CX 200',
    keys: ['CX200', 'CX 200 TOUR', 'CX 200 LS', 'CX 200 PLUS'],
    gens: [
      {
        year: '2024',
        design: {
          head: 'oval',
          base: '#a3262f',
          zones: [
            { from: 7.5, to: 10.4, color: '#ee4a2c' },
            { from: 10.4, to: 2.75, color: '#2a2b2e' },
            { from: 2.75, to: 3.4, color: '#ee4a2c' },
          ],
          bumper: '#1c1d21',
          throat: '#9c2430',
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'matte',
        },
      },
      {
        year: '2021',
        design: {
          head: 'oval',
          base: '#c41a2c',
          zones: [
            { from: 7.6, to: 11.2, color: '#2e2629' },
            { from: 2.75, to: 3.25, color: '#2e2629' },
          ],
          bumper: '#1c1d21',
          throat: '#c41a2c',
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'SX 300',
    keys: ['SX300', 'SX 300 TOUR', 'SX 300 LS', 'SX 300 LITE'],
    gens: [
      {
        year: '2025',
        design: {
          head: 'oval',
          base: '#13909c',
          zones: [
            { from: 7.5, to: 10.4, color: '#cdee4c' },
            { from: 10.4, to: 2.75, color: '#2a2b2c' },
            { from: 2.75, to: 3.4, color: '#cdee4c' },
          ],
          bumper: '#1c1d21',
          throat: '#118896',
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'gloss',
        },
      },
      {
        year: '2022',
        design: {
          head: 'oval',
          base: '#c8d02a',
          zones: [
            { from: 7.4, to: 11.4, color: '#3e3f41' },
            { from: 2.75, to: 3.25, color: '#3e3f41' },
          ],
          bumper: '#1c1d21',
          throat: '#c8d02a',
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'FX 500',
    keys: ['FX500', 'FX 500 TOUR', 'FX 500 LS', 'FX 500 LITE'],
    gens: [
      {
        year: '2025',
        design: {
          head: 'oval',
          base: '#45437e',
          zones: [
            { from: 7.6, to: 10.4, color: '#5cc8f0' },
            { from: 10.4, to: 2.75, color: '#232629' },
            { from: 2.75, to: 3.3, color: '#5cc8f0' },
          ],
          bumper: '#1c1d21',
          throat: '#45437e',
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'gloss',
        },
      },
      {
        year: '2023',
        design: {
          head: 'oval',
          base: '#1279d6',
          zones: [
            { from: 7.5, to: 11, color: '#232a40' },
            { from: 2.75, to: 3.25, color: '#232a40' },
          ],
          bumper: '#1c1d21',
          throat: '#1279d6',
          collar: BLACK_GRIP,
          grip: BLACK_GRIP,
          cap: BLACK_GRIP,
          finish: 'gloss',
        },
      },
    ],
  },
];
