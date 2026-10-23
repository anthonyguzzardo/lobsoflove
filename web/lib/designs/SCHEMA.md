# Racket design schema

One file per brand: `web/lib/designs/<brand>.js`, default export an array of models. web/lib/gear-catalog.js merges them.

```js
export default [
  {
    model: 'PURE AERO 98',     // the name as it appears in RACKETS in gear-catalog.js (upper case)
    keys: ['PURE AERO 98'],    // optional extra names that should match this model (upper case)
    gens: [                    // current generation FIRST, then the previous one
      { year: '2026', design: { ... } },
      { year: '2023', design: { ... } },
    ],
  },
];
```

`year` is what the player picks between, so it must be short and distinct ('2026', '2023', 'V9', 'V14', 'CARBON GREY'...).

## design

Clock positions describe the head as you look at the string bed with the head up: 12 is the tip, 3 is the right side,
6 is the throat, 9 is the left side. Ranges run clockwise from `from` to `to` and may wrap past 12 (`from: 10, to: 2`).
Fractions are fine (2.5 = half past two).

| key | required | meaning |
|---|---|---|
| `head` | yes | `'oval'` or `'iso'` (squared-off Yonex isometric head) |
| `base` | yes | main hoop color, hex |
| `zones` | no | painted blocks on the hoop: `[{ from, to, color, fade? }]`. `fade` is a second hex: the block blends from `color` at `from` to `fade` at `to` (for gradients like the Rafa sunset). Later zones paint over earlier ones. Leave `base` showing where the photo shows the main color. |
| `pin` | no | a thin line running all round the hoop along the string groove, hex |
| `pinAt` | no | clock range for `pin` when it does not run all the way round |
| `throat` | yes | throat arms (the open Y), hex |
| `throatAccent` | no | a second color painted in a stripe down the middle of each throat arm (big shaft lettering, side panels) |
| `throatAccentL`, `throatAccentR` | no | the stripe on one arm only (e.g. Wilson's big wordmark down the left arm); each falls back to `throatAccent` |
| `shaft` | no | the short solid piece between the throat and the handle; defaults to `throat` |
| `grip` | yes | handle wrap color |
| `cap` | yes | butt cap color |
| `text` | no | wordmark color; when set, the brand wordmark is lettered across the top of the hoop face |
| `textAt` | no | clock range for the wordmark, default `[10.5, 1.5]` |
| `throatL`, `throatR` | no | the left / right throat arm when they differ (left and right as you look at the strings); each falls back to `throat` |
| `bridge` | no | the bridge across the bottom of the string bed (about 5.5 to 6.5 on the hoop) |
| `collar` | no | the thin ring where the shaft meets the grip; defaults to `shaft` |
| `bumper` | no | the outer edge of the hoop when it differs from the face (black bumpers) |
| `finish` | yes | `'gloss'` or `'matte'` |

Rules:
- Hex values: take them from the research file and check them against the photos. The photos win.
- Only describe what reads at phone size: big color blocks, not every logo or tech text.
- Do not invent a generation. If the research only has one, give one.
