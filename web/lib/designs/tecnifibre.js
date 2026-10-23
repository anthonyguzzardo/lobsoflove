// Tecnifibre: white frames. Research: docs/research/rackets/tecnifibre.md, photos in docs/research/rackets/photos/tecnifibre.
// Caps: the photos show the butt flare in the grip color (white flare with black "Tecnifibre" on white grips), so cap
// follows the photo, not the research's "dark octagon" (that is the end face, which the photos do not show).

export default [
  {
    model: 'TF40',
    keys: ['TF 40', 'TF40 305', 'TF40 315', 'TF40 290'],
    gens: [
      {
        year: '2024',
        design: {
          head: 'oval',
          base: '#eeeeec',
          zones: [
            // dark olive crown over the top, breaking up into camo down the right side
            { from: 9.5, to: 12.5, color: '#2a2e2a' },
            { from: 12.5, to: 1.3, color: '#f07a2a' },
            { from: 1.3, to: 2.6, color: '#2a2e2a', fade: '#eeeeec' },
            // big black TF40 lettering fragments on the lower right
            { from: 4, to: 4.7, color: '#2a2e2a' },
          ],
          bumper: '#2a2e2a',
          throat: '#eeeeec',
          grip: '#f2f2f0',
          cap: '#f2f2f0',
          finish: 'gloss',
        },
      },
      {
        year: '2022',
        design: {
          head: 'oval',
          base: '#eeeeec',
          zones: [
            { from: 2.2, to: 3.2, color: '#e0202a' },
            { from: 4.1, to: 4.8, color: '#2a3fa0' },
          ],
          bumper: '#222122',
          // Photo: the black throat arm is the RIGHT one as you face the strings (research says left).
          throat: '#eeeeec',
          throatR: '#1f1f21',
          shaft: '#1f1f21',
          grip: '#1c1d21',
          cap: '#1c1d21',
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'TFIGHT',
    keys: ['T-FIGHT', 'TFIGHT ISO', 'T-FIGHT ISO', 'TFIGHT 305S', 'TFIGHT 300S', 'TFIGHT 315S', 'TFIGHT 305', 'TFIGHT 300'],
    gens: [
      {
        year: '2025',
        design: {
          head: 'oval',
          base: '#f0f0ee',
          zones: [
            // red over blue slash pair on the right side
            { from: 2.2, to: 2.6, color: '#e0283a' },
            { from: 2.7, to: 3.15, color: '#2a3fbf' },
          ],
          throat: '#f0f0ee',
          grip: '#f0f0ee',
          cap: '#f0f0ee',
          finish: 'gloss',
        },
      },
      {
        year: 'ISO 2022',
        design: {
          head: 'oval',
          base: '#f0f0ee',
          zones: [
            // outline lettering: black T-FIGHT and blue/red 305 over the top, red/blue/black fragments lower right
            { from: 10.6, to: 11.8, color: '#1c1d21' },
            { from: 12.1, to: 12.6, color: '#2a3fbf' },
            { from: 12.8, to: 1.4, color: '#e0283a' },
            { from: 3.4, to: 3.7, color: '#e0283a' },
            { from: 3.85, to: 4.3, color: '#2a3fbf' },
            { from: 4.5, to: 5, color: '#1c1d21' },
          ],
          throat: '#f0f0ee',
          grip: '#f0f0ee',
          cap: '#f0f0ee',
          finish: 'gloss',
        },
      },
    ],
  },
  {
    model: 'TF-X1',
    keys: ['TF X1', 'TFX1', 'TF-X1 V2', 'TF-X1 305', 'TF-X1 300'],
    gens: [
      {
        year: 'V2 2024',
        design: {
          head: 'oval',
          base: '#eef0ee',
          zones: [
            // neon crown, hard edge on the left, fading to white down the right side
            { from: 9.6, to: 1.4, color: '#cfe84a' },
            { from: 1.4, to: 3, color: '#cfe84a', fade: '#eef0ee' },
          ],
          bumper: '#cfe84a',
          bridge: '#cfe84a',
          throat: '#eef0ee',
          grip: '#f0f0ee',
          cap: '#f0f0ee',
          finish: 'gloss',
        },
      },
      {
        year: 'V1 2021',
        design: {
          head: 'oval',
          base: '#eef0ee',
          zones: [
            { from: 9.5, to: 2.5, color: '#4a4b4a' },
            // neon lettering flecks on the lower right
            { from: 3.6, to: 4.2, color: '#c8e040' },
          ],
          bumper: '#4a4b4a',
          bridge: '#4a4b4a',
          throat: '#eef0ee',
          grip: '#f0f0ee',
          cap: '#f0f0ee',
          finish: 'gloss',
        },
      },
    ],
  },
];
