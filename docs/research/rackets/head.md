# HEAD racket paint jobs: current and previous generation

Research date: 2026-10-23. Scope: the HEAD lines in `web/lib/gear-catalog.js`
(SPEED MP, SPEED PRO, RADICAL MP, GRAVITY MP, EXTREME MP, PRESTIGE MP, BOOM MP).

## How this was done

- Which generation is current was checked against retailer listings and reviews
  on 2026-10-23, not memory. Tennis Warehouse (TW) currently lists Speed 2026,
  Radical 2025, Gravity 2025 (+ Zverev 2026), Extreme 2026, Boom 2026, Prestige
  MP 2023, plus two new October 2026 Prestige frames.
- All photos are Tennis Warehouse product images, fetched from
  `https://img.tennis-warehouse.com/watermark/rs.php?path=<CODE>-<N>.jpg&nw=900`.
  Each one was opened and checked by eye. Retail photos come with a black HEAD
  stencil already in the string bed.
- Hex values were sampled from those photos with ImageMagick: rows across the
  beam, taking a value a bit darker than the median so the gloss highlight
  does not skew it. Treat them as close, not exact. Studio light, gloss and
  metallic flake all move the numbers. Where a sample looked off against the
  photo, I say so.
- Clock positions are for the front view: string bed facing you, handle down.
  12 is the tip, 3 is the right side, 6 is the throat bridge.
- Photo folder: `docs/research/rackets/photos/head/`. Suffixes: `_front` is TW's
  combined side and front shot; `_throat` is a throat close-up; `_angle` is a
  three-quarter or top view; `_buttcap` shows the grip and butt cap; `_side` is
  an angled full frame.

A recurring problem with the current table: most modern HEAD paint jobs are
**asymmetric side blocks** (a second color on ONE side of the hoop, usually the
right side from about 1 to 4 o'clock), not a symmetric band over the top. The
suggested entries below keep the existing `{ base, band, throat, head }` keys
and add these optional keys where they matter:

- `side`: the color of the one-sided block, with `sideArc: [fromClock, toClock]`
- `shaft`: the lower throat and shaft just above the grip, when it differs from the throat arms
- `grip`: the stock grip color, when it is not black

The renderer may ignore these. They are here so a designer can use them.

---

## SPEED MP

### Current: Speed 2026 (Auxetic 2.0 + Hy-Bor), released early 2026

The Jannik Sinner frame. TW lists the color as "White/Black", but it reads as a
dark slate frame with one white block.

- **Main frame:** dark slate/charcoal with a faint blue cast, about `#3d4147`
  (beam samples `#3e4145`, `#414348`, `#47494e`). It is not pure black.
- **Secondary color:** a solid **white block on the right side of the hoop from
  about 1 to 4 o'clock**, about `#ecebe8`. It is a hard split, not a gradient.
  The top of the head (10 to 2) is slate. The throat arms are slate. The base of
  the throat V and the very top of the handle are white.
- **Grip:** white, about `#eeedeb`. This is the big change from 2024.
- **Finish:** mostly matte or satin. The white block is satin.
- **Logos:** a large blocky "HEAD" wordmark in white on the outer side of the
  hoop. "SPEED" in thin, spaced, slightly lighter grey type runs up the throat
  arm (tone on tone). A small "MP" sits at 12 o'clock. The HEAD head-icon is at
  the throat V, in black on white.
- **Stencil:** HEAD logo, black in retail photos.
- **Grommets and bumper:** black or dark slate, matching the frame.
- **Butt cap:** black, with a white HEAD icon and a white outer rim. The handle
  is white under the grip.
- **Head shape:** HEAD oval with an open throat. The hoop has a central groove
  channel along its outer edge.
- **Special editions:** a Speed Tour 2026 (97 in², same black/white theme with
  metallic matte finish, per retailer copy, not photographed here). See also the
  Speed Legend 2025 below.
- **Sources:** https://www.tennis-warehouse.com/descpage-HSPMP6.html ;
  https://www.tennis-warehouse.com/Head_Speed_Team_2026/descpage-HSPTM6.html
- **Photos:** `speed-mp_2026_front.jpg`, `speed-mp_2026_throat.jpg`,
  `speed-mp_2026_buttcap.jpg`, `speed-mp_2026_angle.jpg`

### Previous: Speed 2024 (Auxetic 2.0), released January 2024

- **Main frame:** light cool grey-white, about `#d6dade` (samples `#d4d9dd`,
  `#cbd0d4`). Under studio light it reads white.
- **Secondary color:** black, about `#2f2f38`, in a hard split. The black runs
  from about 8 o'clock on the left side up over the top to about 2 o'clock, so
  the top band and the left upper hoop are black. The right side from 2 o'clock
  down, the lower hoop, the throat bridge and the upper throat arms are
  grey-white. Below mid-throat the shaft turns black (`#403f45`): first on the
  right arm, then both arms.
- **Grip:** black, about `#363636`.
- **Finish:** satin or matte.
- **Logos:** grey HEAD block letters on the black hoop sides. A large grey
  outlined "S" and "SPEED" run down the black lower throat, with a small "MP".
  The HEAD icon is at the throat V, in grey on black.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** black.
- **Butt cap:** black, with a silver HEAD icon.
- **Head shape:** oval, open throat.
- **Sources:** https://www.tennis-warehouse.com/descpage-HSPDM.html
- **Photos:** `speed-mp_2024_front.jpg`, `speed-mp_2024_throat.jpg`,
  `speed-mp_2024_buttcap.jpg`, `speed-mp_2024_angle.jpg`

### Common special: Speed MP Legend 2025

All gloss black, with gold accents: the Djokovic "N" signature mark on the throat
and handle, a gold HEAD wordmark on the throat, and a gold HEAD icon on the
butt cap. TW still sells it. It is a tribute edition, so it is seen less on
courts than the stock frames.

- **Sources:** https://www.tennis-warehouse.com/descpage-HSMPL5.html
- **Photos:** `speed-mp-legend_2025_front.jpg`, `speed-mp-legend_2025_throat.jpg`

### Suggested DESIGNS entries

```js
// Speed 2026 (current)
['SPEED', { base: '#3d4147', band: null, throat: '#3d4147', head: 'oval',
            side: '#ecebe8', sideArc: [1, 4], shaft: '#ecebe8', grip: '#eeedeb' }],
// Speed 2024 (previous)
['SPEED', { base: '#d6dade', band: '#2f2f38', throat: '#d6dade', head: 'oval',
            shaft: '#2f2f38', grip: '#363636' }],
// Speed Legend 2025 (special)
['SPEED LEGEND', { base: '#1c1c1e', band: null, throat: '#1c1c1e', head: 'oval', accent: '#c9a24a' }],
```

---

## SPEED PRO

### Current: Speed Pro 2026, released early 2026

Same paint as the Speed MP 2026, checked against TW photos: dark slate frame,
white block on the right side of the hoop from about 1 to 4 o'clock, white at
the throat V, and a white grip. The black butt cap has a white rim. The only
visible difference is the "PRO" text on the frame. Frame color is about
`#3d4147`, and the white is about `#ecebe8`.

- **Sources:** https://www.tennis-warehouse.com/descpage-HSPDP6.html
- **Photos:** `speed-pro_2026_front.jpg`, `speed-pro_2026_throat.jpg`, `speed-pro_2026_angle.jpg`

### Previous: Speed Pro 2024, released January 2024

Same paint as the Speed MP 2024: grey-white frame, black over the top and upper
left, black lower throat and shaft, black grip, "PRO" text. The butt cap is
black with a silver icon.

- **Sources:** https://www.tennis-warehouse.com/descpage-HSPDP.html
- **Photos:** `speed-pro_2024_front.jpg`, `speed-pro_2024_throat.jpg`, `speed-pro_2024_angle.jpg`

### Suggested DESIGNS entries

```js
// Speed Pro 2026 (current), same as Speed MP 2026
['SPEED PRO', { base: '#3d4147', band: null, throat: '#3d4147', head: 'oval',
                side: '#ecebe8', sideArc: [1, 4], shaft: '#ecebe8', grip: '#eeedeb' }],
// Speed Pro 2024 (previous), same as Speed MP 2024
['SPEED PRO', { base: '#d6dade', band: '#2f2f38', throat: '#d6dade', head: 'oval',
                shaft: '#2f2f38', grip: '#363636' }],
```

(In the current table, `'SPEED'` matches both lines through `includes`, so one
Speed entry covers MP and Pro unless the drawing needs the "PRO" text.)

---

## RADICAL MP

### Current: Radical 2025 (Auxetic 2.0), released 2025

TW lists the color as "Orange". It is a tonal, two-shade orange frame with no
navy at all.

- **Main frame:** light coral/salmon orange, about `#fb6450` (samples
  `#fb6450`, `#fd6652`, `#f9534c`).
- **Secondary color:** a saturated red-orange, about `#f5301f` (samples
  `#fa2a1c`, `#f72c1e`), in hard diagonal splits. It covers the right side of
  the hoop from about 2 to 5 o'clock, the lower left hoop from about 7 to 8
  o'clock, and the LEFT throat arm. The right throat arm and the top of the head
  (10 to 2) are coral. Overall it reads as a harlequin of the two oranges.
- **Grip:** coral/salmon, about `#f25652`. This is unusual. It is the same color
  family as the frame.
- **Finish:** gloss.
- **Logos:** a dark HEAD wordmark low on the left throat arm, near the QR
  sticker. The Auxetic "A" badge is in white on the throat. A small dark HEAD
  icon sits at the throat V. "MP" is at 12 o'clock.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** coral and red, matching the frame. There is no black
  on the hoop.
- **Butt cap:** black, with a silver HEAD icon and a coral/red rim.
- **Head shape:** oval, open throat.
- **Sources:** https://www.tennis-warehouse.com/descpage-HRMP.html ;
  https://www.tennisnerd.net/gear/racquets/head-radical-racquet-review-pro-and-mp-auxetic-2-0/45446
- **Photos:** `radical-mp_2025_front.jpg`, `radical-mp_2025_throat.jpg`,
  `radical-mp_2025_buttcap.jpg`, `radical-mp_2025_angle.jpg`

### Previous: Radical 2023 (Auxetic), released early 2023

- **Main frame (head):** vivid red-orange, about `#fd4a1a` (samples `#fd3503`,
  `#ff5a37`). The string-bed face of the hoop is pinker, about `#f73253`.
- **Secondary color:** deep navy, about `#333659`. The navy starts on the lower
  right of the hoop at about 4 to 5 o'clock, runs through the throat bridge
  (right half), and covers both throat arms below the yoke and the whole shaft.
  The upper left throat arm stays orange. It is a hard split.
- **Grip:** black.
- **Finish:** gloss.
- **Logos:** an orange HEAD wordmark on the navy throat. A small orange HEAD
  icon is at the throat V. "MP" is in a box at 12 o'clock.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** orange/pink, matching the head.
- **Butt cap:** black, with a silver HEAD icon and an orange rim band.
- **Head shape:** oval, open throat.
- **Sources:** https://www.tennis-warehouse.com/Head_Radical_MP_2023/descpageRCHEAD-HMPRD.html ;
  https://www.tenniswarehouse-europe.com/Head_Radical_MP_2023_Racket/descpageRCHEAD-HMPR-EN.html
- **Photos:** `radical-mp_2023_front.jpg`, `radical-mp_2023_throat.jpg`,
  `radical-mp_2023_buttcap.jpg`, `radical-mp_2023_angle.jpg`

### Suggested DESIGNS entries

```js
// Radical 2025 (current)
['RADICAL', { base: '#fb6450', band: null, throat: '#f5301f', head: 'oval',
              side: '#f5301f', sideArc: [2, 5], grip: '#f25652' }],
// Radical 2023 (previous)
['RADICAL', { base: '#fd4a1a', band: null, throat: '#333659', head: 'oval',
              shaft: '#333659', grip: '#1c1d21' }],
```

---

## GRAVITY MP

The Gravity line's signature is a **"flip" design**: the two faces of the frame
carry different colors. The original 2019 Gravity was teal on one face and "hot
lava" orange-pink on the other, and the app's current teal-plus-pink entry
copies that 2019 look. The 2021 Gravity flipped blue-violet against
yellow-green gradients. Neither of those is the current or previous generation
any more. Source: https://www.tennisnerd.net/?p=23959 and the retailer copy
summarized under "Sources" below.

### Current: Gravity 2025 (Auxetic 2.0), released 16 January 2025

- **Main frame:** gloss black, about `#1e2020`.
- **Secondary color:** metallic teal/petrol blue with visible flake, about
  `#1a8a9a`. It ranges from `#15808f` in shadow to `#32a3b5` in highlight; HEAD
  calls it "stellar blue". In the front view the teal covers the right side of
  the hoop from about 2 o'clock down round the bottom of the hoop to about 8
  o'clock, then the throat bridge and the upper throat arms. The top of the head
  and the upper left hoop (8 to 2) are black. The lower throat and shaft are
  black. The edge between teal and black is a sharp split. The side view shows
  more black, which fits the flip idea.
- **Grip:** black.
- **Finish:** gloss. The teal is metallic.
- **Logos:** "GRAVITY" with a big grey "G" roundel runs up the black throat. A
  white HEAD wordmark is on the throat. Grey HEAD block letters are on the hoop
  sides. "MP" is at 12 o'clock.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** black.
- **Butt cap:** black, with a silver HEAD icon.
- **Head shape:** oval, open throat.
- **Sources:** https://www.tennis-warehouse.com/descpage-HGMPG.html ;
  https://www.head.com/shop-tennis/racquets/tour/gravity ;
  https://www.tennisnerd.net/?p=42848
- **Photos:** `gravity-mp_2025_front.jpg`, `gravity-mp_2025_throat.jpg`,
  `gravity-mp_2025_buttcap.jpg`, `gravity-mp_2025_angle.jpg`

### Previous: Gravity 2023 (Auxetic), released early 2023

- **Main frame:** matte dark slate navy, about `#3d4252` (samples `#434652`,
  `#464950`).
- **Secondary color:** a light steel/periwinkle blue, about `#6f8aa6` (samples
  `#5a6f87`, `#5d7b96`). It runs as a thin inner edge on the string-bed side of
  the hoop, round most of the head, and as a lighter panel on the left throat
  arm. From the front the frame reads almost single-color navy, with a pale blue
  rim lining the string bed. I could not confirm from these photos whether the
  back face is a different color, as the "flip" idea suggests.
- **Grip:** black.
- **Finish:** matte.
- **Logos:** dark, low-contrast HEAD and "MP" on the throat. A small light-blue
  HEAD icon is at the throat V. A light-blue Gravity "G" mark sits at 12 o'clock.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** dark navy.
- **Butt cap:** black, with a silver HEAD icon.
- **Head shape:** oval, open throat.
- **Sources:** https://www.tenniswarehouse-europe.com/Raquette_HEAD_Gravity_MP_2023/descpageRCHEAD-HGMPR-FR.html
- **Photos:** `gravity-mp_2023_front.jpg`, `gravity-mp_2023_throat.jpg`,
  `gravity-mp_2023_buttcap.jpg`, `gravity-mp_2023_angle.jpg`

### Special: Gravity MP / Tour Zverev 2026

TW lists these as new. There are two schemes. One is champagne gold
(about `#c9b78a`) with a dark navy top and left hoop and a navy shaft. The other
is dark navy with a violet/purple (about `#7a3fc4`) right-side block and a purple
throat, carrying a purple "G" and the Zverev mark. They are too new for me to say
how common they are on courts.

- **Sources:** https://www.tennis-warehouse.com/descpage-HGMPZ6.html
- **Photos:** `gravity-mp-zverev_2026_front.jpg` (gold), `gravity-mp-zverev-purple_2026_front.jpg`,
  `gravity-mp-zverev_2026_throat.jpg`

### "Reverse" colorway

I found no retail product called a "reverse" Gravity. The term most likely
describes the flip paint above, where each face is a different color. No
separate photos were taken for it.

### Suggested DESIGNS entries

```js
// Gravity 2025 (current)
['GRAVITY', { base: '#1e2020', band: null, throat: '#1a8a9a', head: 'oval',
              side: '#1a8a9a', sideArc: [2, 8], shaft: '#1e2020' }],
// Gravity 2023 (previous)
['GRAVITY', { base: '#3d4252', band: null, throat: '#3d4252', head: 'oval', rim: '#6f8aa6' }],
```

---

## EXTREME MP

### Current: Extreme 2026 (Auxetic 2.0 + Hy-Bor), launched mid 2026

- **Main frame:** bright lime/apple green, about `#9ad85a` (samples `#88d051`,
  `#abdc74`, `#bce078`). It has a slightly translucent, candy look.
- **Secondary color:** black, about `#1f211e`. It forms a **block on the right
  side of the hoop from about 1 to 4 o'clock**, plus the base of the throat V and
  the shaft just above the grip. The top of the head is lime, and so are the
  throat arms. These are hard splits.
- **Grip:** black.
- **Finish:** gloss.
- **Logos:** "EXTREME" (styled "EXTREM3") in dark type runs up the lime throat
  arm. A big black HEAD wordmark is on the hoop. A lime HEAD icon sits on the
  black at the throat V.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** lime, matching the frame. Each grommet is outlined.
- **Butt cap:** black, with a white HEAD icon and a lime rim.
- **Head shape:** oval, open throat. Spin Grommets are used.
- **Sources:** https://www.tennis-warehouse.com/descpage-HREM26.html ;
  https://www.tennisnerd.net/gear/racquets/racquet-reviews/head-extreme-2026-review-a-solid-update-with-a-standout-new-model/66718
- **Photos:** `extreme-mp_2026_front.jpg`, `extreme-mp_2026_throat.jpg`, `extreme-mp_2026_angle.jpg`

### Previous: Extreme 2024 (Auxetic 2.0), released 2024

- **Main frame:** pale sage/milky mint-grey, about `#d3dcc0` (samples `#d4e1c1`,
  `#d1dabc`).
- **Secondary color:** neon lime-yellow, about `#c2e45a` (samples `#bde467`,
  `#bae360`). It covers the right side of the hoop from about 2 to 5 o'clock,
  wraps round the lower hoop and the throat bridge, and runs down the left throat
  arm. The top of the head (9 to 2) and the right throat arm are pale sage. The
  edges are soft, almost a fade.
- **Grip:** pale sage-mint, about `#cbdcae`. It is not black.
- **Finish:** matte or satin.
- **Logos:** a small black HEAD wordmark on the throat. A black HEAD icon is at
  the throat V. Pale grey text sits on the hoop.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** pale grey/sage.
- **Butt cap:** black, with a silver icon and a pale rim.
- **Head shape:** oval, open throat.
- **Sources:** https://www.tennis-warehouse.com/descpage-HREM24.html
- **Photos:** `extreme-mp_2024_front.jpg`, `extreme-mp_2024_throat.jpg`, `extreme-mp_2024_angle.jpg`

### Suggested DESIGNS entries

```js
// Extreme 2026 (current)
['EXTREME', { base: '#9ad85a', band: null, throat: '#9ad85a', head: 'oval',
              side: '#1f211e', sideArc: [1, 4], shaft: '#1f211e', grip: '#1c1d21' }],
// Extreme 2024 (previous)
['EXTREME', { base: '#d3dcc0', band: null, throat: '#c2e45a', head: 'oval',
              side: '#c2e45a', sideArc: [2, 5], grip: '#cbdcae' }],
```

---

## PRESTIGE MP

Generation status needs care. No Prestige 2025 appeared anywhere I looked. The
regular-production Prestige MP is still the **2023** frame. TW still sells it,
and HEAD's own product page is `prestige-mp-2023-236123`. Two new Prestige
frames launched on 1 October 2026, the **Prestige MP Limited** and the
**iPrestige MP 2.0**. Tennisnerd frames them as HEAD "bringing back" the
Prestige, so treat them as the newest Prestige look, but not yet as the common
on-court Prestige. Below, Current is the 2023 frame, with the 2026 frames noted.
Previous is 2021.

### Current (regular production): Prestige MP 2023 (Auxetic 2.0)

- **Main frame:** charcoal/anthracite with a slight warm cast, about `#3c3a40`
  (samples `#3d383e`, `#423e44`).
- **Secondary color:** a deep metallic red. HEAD calls it "deep red". It reads
  oxblood to copper, about `#6b2a2a` in mid-tone; samples run from `#3c242a` in
  shadow to about `#7a3328` in highlight. It covers the right side of the hoop
  from about 3 to 5 o'clock, then the lower hoop and throat bridge, and the
  upper throat arms. The top of the head (9 to 3) is charcoal, and so are the
  lower throat and shaft. The edges are hard, with a chameleon sheen on the red.
  Decathlon describes it as "special red paint in the central color block".
- **Grip:** black.
- **Finish:** a matte charcoal body with a gloss metallic red panel.
- **Logos:** "PRESTIGE" in spaced grey caps runs down the charcoal throat arm,
  with a large outlined "P". A dark-blue HEAD wordmark sits on the throat. A grey
  HEAD icon is at the throat V. "MP" is at 12 o'clock.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** black/charcoal.
- **Butt cap:** black, with a silver HEAD icon.
- **Head shape:** oval, with a classic thin box beam (21.5 mm). It looks slimmer
  than the Speed, Boom and Extreme.
- **Sources:** https://www.tenniswarehouse-europe.com/Head_Prestige_MP_2023_Racket/descpageRCHEAD-HPRMP-EN.html ;
  https://www.head.com/en/prestige-mp-2023-236123.html
- **Photos:** `prestige-mp_2023_front.jpg`, `prestige-mp_2023_side.jpg`, `prestige-mp_2023_throat.jpg`
- **Note:** the Prestige Pro 2023 (TW code PRPROR, color "Maroon") is darker:
  black with a maroon-purple right side. It is not the same panel layout as the
  MP.

### New October 2026: Prestige MP Limited and iPrestige MP 2.0

- **Prestige MP Limited 2026:** metallic silver, about `#c0bfbb`, with a black
  block (about `#3d3d3f`) on the right side of the hoop from about 1 to 4
  o'clock, black at the base of the throat V, and a black grip. "HEAD" and
  "PRESTIGE" are in gold, about `#c9a227`, on the throat. The butt cap is black
  and silver. It shares specs with the 2023 MP L.
  Photos: `prestige-mp-limited_2026_front.jpg`, `prestige-mp-limited_2026_throat.jpg`,
  `prestige-mp-limited_2026_angle.jpg`.
  Source: https://www.tennis-warehouse.com/descpage-HPMPL6.html
- **iPrestige MP 2.0 2026:** a retro remake of the mid-2000s "Intelligence"
  iPrestige. The frame is black (about `#2f2e2f`), with the string-bed face of
  the top hoop in silver (about `#bbbabb`) from about 9 to 3 o'clock. A huge
  white "HEAD" wordmark runs on the right side of the hoop, and "intelligence"
  script is on the left. Gold/olive inserts (about `#b8962e`) sit on both throat
  arms. "smarter racquet. better game." is at 12 o'clock. The grip is black with
  gold dots, and the butt cap is silver with an "intelligence" badge.
  Photos: `iprestige-mp-2_2026_front.jpg`, `iprestige-mp-2_2026_throat.jpg`.
  Sources: https://www.tennisnerd.net/?p=69346 ;
  https://www.tenniswarehouse-europe.com/Head_iPrestige_MP_20_2026_Racket/descpageRCHEAD-HIPMP2-DE.html

### Previous: Prestige MP 2021 (Auxetic), in stock November 2021

- **Main frame:** black/charcoal, about `#2c2a2e`.
- **Secondary color:** a dark wine/burgundy sheen, about `#4a1f2a`. It is
  subtle and gradient-like, on the right side of the hoop and the string-bed
  face, and is mostly visible as a reddish tint. The accent color is a bright
  orange-red, about `#ff4a2a`, used only for graphics: a very large "HEAD"
  wordmark on the string-bed face of the hoop (visible in the side view), a big
  "P", and the HEAD icon at the throat V.
- **Grip:** black.
- **Finish:** matte.
- **Logos:** a big orange-red "P" with "PRESTIGE" stacked down the throat. An
  orange-red HEAD icon is at the throat V. The gold Auxetic "A" badge is on the
  throat. "MP" with "400" is on the throat.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** black.
- **Butt cap:** black, with a silver icon and a red "P" on the handle flare.
- **Head shape:** oval, thin box beam.
- **Sources:** https://www.tennis-warehouse.com/learning_center/racquet_reviews/MIPPREreview.html ;
  https://www.tennis.com/baseline/articles/racquet-preview-head-prestige-2021-fifth-decade-auxetic-graphene
- **Photos:** `prestige-mp_2021_front.jpg`, `prestige-mp_2021_throat.jpg`,
  `prestige-mp_2021_buttcap.jpg`, `prestige-mp_2021_angle.jpg`

### Suggested DESIGNS entries

```js
// Prestige MP 2023 (current regular production)
['PRESTIGE', { base: '#3c3a40', band: null, throat: '#6b2a2a', head: 'oval',
               side: '#6b2a2a', sideArc: [3, 5], shaft: '#3c3a40' }],
// Prestige MP 2021 (previous)
['PRESTIGE', { base: '#2c2a2e', band: null, throat: '#2c2a2e', head: 'oval',
               side: '#4a1f2a', sideArc: [1, 5], accent: '#ff4a2a' }],
// Prestige MP Limited 2026 (newest, not yet common)
['PRESTIGE LIMITED', { base: '#c0bfbb', band: null, throat: '#c0bfbb', head: 'oval',
                       side: '#3d3d3f', sideArc: [1, 4], shaft: '#3d3d3f', accent: '#c9a227' }],
```

---

## BOOM MP

### Current: Boom 2026 (Auxetic 2.0 + Hy-Bor), launched early 2026

- **Main frame:** bright sky/cyan blue, about `#1fc2e7` (samples `#01b3e0`,
  `#07bde7`, `#1fc2e7`).
- **Secondary color:** dark navy, about `#2e353e`. It forms a **block on the
  right side of the hoop from about 1 to 4 o'clock**, plus the base of the throat
  V and the shaft above the grip (`#202b3a`). The top of the head and the throat
  arms are cyan. These are hard splits.
- **Grip:** navy, about `#232c3d`. It is not black.
- **Finish:** gloss.
- **Logos:** a white HEAD wordmark on the right throat arm. "BOOM" in spaced
  light type runs up the throat. A white HEAD icon sits on the navy at the
  throat V. "MP" is at 12 o'clock.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** cyan, matching the frame.
- **Butt cap:** black/navy, with a white HEAD icon and a cyan rim.
- **Head shape:** oval, open throat.
- **Sources:** https://www.tennis-warehouse.com/descpage-HBOMP6.html ;
  https://www.tennisnerd.net/gear/racquets/racquet-reviews/head-boom-2026-review-controlled-power-gets-smarter-and-slightly-firmer/64495
- **Photos:** `boom-mp_2026_front.jpg`, `boom-mp_2026_throat.jpg`, `boom-mp_2026_angle.jpg`

#### Boom MP 2026 Purple (the alternate)

A lavender frame, about `#b8a8d0`, with a deeper violet right-side block from
about 1 to 4 o'clock (about `#8468bb`) and a violet throat base. The grip is
violet, about `#7768a4`, and the butt cap is violet with a black centre. It is
sold as a full family (MP, MP L, MP UL, Team, juniors), so it should be common.

- **Sources:** https://www.tennis-warehouse.com/descpage-HBOMPA.html
- **Photos:** `boom-mp-purple_2026_front.jpg`, `boom-mp-purple_2026_throat.jpg`

### Previous: Boom 2024 (Auxetic 2.0), released early 2024

- **Main frame:** bright mint/aqua green, about `#70e0c8`. Samples run
  `#7ee7d6` to `#99e6d4` with the highlight included, so the true paint is a
  touch deeper than the samples.
- **Secondary color:** black, about `#222426`. It runs from about 8 o'clock on
  the left side up over the top of the head to about 2 o'clock, so it is a real
  top band. The lower throat and shaft are black too, from just below the yoke
  on the right arm. The rest of the hoop, the throat bridge and the upper throat
  arms are mint. These are hard splits.
- **Grip:** black.
- **Finish:** satin/gloss.
- **Logos:** a large mint outlined "B" and "BOOM" on the black lower throat. A
  big mint HEAD wordmark is on the black hoop sides. A mint HEAD icon is at the
  throat V.
- **Stencil:** HEAD logo, black.
- **Grommets and bumper:** mint in mint zones, black in black zones.
- **Butt cap:** black, with a silver icon and a mint rim band.
- **Head shape:** oval, open throat.
- **Sources:** https://www.tennis-warehouse.com/Head_Boom_MP_2024/descpageRCHEAD-HBOOMM.html
- **Photos:** `boom-mp_2024_front.jpg`, `boom-mp_2024_throat.jpg`, `boom-mp_2024_angle.jpg`

#### Boom MP Alternate 2024

This is two-tone teal with no black. The main color is a vivid teal-mint, about
`#1fd5c0`. A pale icy mint, about `#a9e2dd`, covers the top of the head (about
10 to 2 o'clock) and the upper left hoop, and the lower throat/shaft is also
pale mint. The grip is pale mint, about `#9dd2d2`, and the butt cap is dark
navy. It was common in 2024 and 2025.

- **Sources:** https://www.tenniswarehouse-europe.com/HEAD_Boom_MP_Alternate_2024_Tennisschl_xE4_ger/descpageRCHEAD-BOOMMA-DE.html
- **Photos:** `boom-mp-alternate_2024_front.jpg`, `boom-mp-alternate_2024_throat.jpg`,
  `boom-mp-alternate_2024_angle.jpg`

### Suggested DESIGNS entries

```js
// Boom 2026 (current)
['BOOM', { base: '#1fc2e7', band: null, throat: '#1fc2e7', head: 'oval',
           side: '#2e353e', sideArc: [1, 4], shaft: '#202b3a', grip: '#232c3d' }],
// Boom 2026 Purple (current alternate)
['BOOM PURPLE', { base: '#b8a8d0', band: null, throat: '#b8a8d0', head: 'oval',
                  side: '#8468bb', sideArc: [1, 4], shaft: '#8468bb', grip: '#7768a4' }],
// Boom 2024 (previous)
['BOOM', { base: '#70e0c8', band: '#222426', throat: '#70e0c8', head: 'oval',
           shaft: '#222426', grip: '#1c1d21' }],
// Boom 2024 Alternate (previous alternate)
['BOOM ALTERNATE', { base: '#1fd5c0', band: '#a9e2dd', throat: '#1fd5c0', head: 'oval',
                     shaft: '#a9e2dd', grip: '#9dd2d2' }],
```

---

## Gaps and uncertainties

- Hex values come from studio photos. Metallic paints are the least reliable
  numbers: the Gravity 2025 teal, the Prestige 2023 red, and the Zverev gold and
  purple.
- Gravity 2023 and 2025: TW shows mostly one face. Because Gravity is a flip
  design, the back face may carry a different color balance. I did not verify
  the back face.
- Prestige: whether the 2026 Limited or the iPrestige 2.0 replaces the 2023 as
  "the" Prestige MP is unclear. HEAD sells all three.
- Zverev Gravity 2026: I could not judge how common it is on courts. It is
  listed by TW, and HEAD shows it as new.
- Speed Tour 2026 (97 in², metallic matte black/white) was not photographed. It
  is outside the app's model list.
- Radical 2025 and Extreme 2026 release months come from retailer and review
  pages, not from HEAD press releases.

## What the current app table gets wrong (HEAD)

| Line | App today | Reality |
|---|---|---|
| SPEED | white base, black band, black throat | 2024 is close (grey-white, black top and left, black shaft, black grip). 2026 is **inverted**: dark slate frame, white right-side block, **white grip**. |
| RADICAL | orange base, navy band, navy throat | Navy was never on the top of the head. 2023 is orange head with navy throat and shaft. 2025 has **no navy at all**: two-tone coral and red-orange, with a coral grip. |
| GRAVITY | teal base, pink band | That is the 2019 original. 2023 is matte slate navy with a pale-blue rim. 2025 is gloss black with metallic teal on the right and bottom of the hoop and the throat. |
| EXTREME | yellow base, black band, black throat | 2026 is **lime green**, not yellow, with the black block on the right side and a black shaft (no black top band). 2024 is pale sage with neon lime, and a pale grip. |
| PRESTIGE | maroon base, black band | Inverted. The base is charcoal/black, and the red is a lower and throat panel (2023) or a subtle wine sheen (2021). The newest 2026 frames are silver/black/gold and black/silver/gold. |
| BOOM | teal base, orange band | Nothing orange in either generation. 2026 is cyan with a navy side block and navy grip. 2024 is mint with a black top band and black shaft. |

---

## Brand-wide signatures

What makes a HEAD look like a HEAD at a glance:

1. **The HEAD string stencil:** the stylized "head" icon (an arc with a dot)
   stenciled large in the upper half of the string bed, usually black.
2. **Asymmetric hard-split color blocks:** almost every current HEAD frame puts
   a second color on ONE side of the hoop, usually the right side (front view)
   from about 1 to 4 o'clock, or splits the frame on a diagonal. Symmetric
   top bands are rare now. Boom 2024 and Speed 2024 have a top band, but even
   those run down one side.
3. **A contrasting throat V and shaft:** the base of the throat V and the shaft
   just above the grip often switch to the second color, with a small HEAD
   icon sitting there.
4. **Big blocky "HEAD" wordmark on the hoop sides:** wide, pixel-like capitals
   along the outer edge at 3 and/or 9 o'clock, readable in side views.
5. **The model name runs up the throat arm** in thin, widely spaced capitals
   ("S P E E D", "B O O M", "P R E S T I G E"), often with a big outlined
   initial letter (S, B, P, G).
6. **Oval head, open Y throat, and a grooved outer hoop:** a central channel
   runs round the outside of the hoop. HEAD does not use a squared isometric head.
7. **Octagonal black butt cap** with a silver or white HEAD icon, often with a
   rim band in the frame color.
8. **Grip matched to the paint on recent frames:** Speed 2026 white, Radical
   2025 coral, Boom 2026 navy, Extreme 2024 sage. HEAD no longer defaults to a
   black grip.
9. **Small "MP" / "PRO" / "TOUR" label at 12 o'clock** on the top of the hoop.
