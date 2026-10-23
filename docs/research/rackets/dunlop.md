# Dunlop racket paint jobs (research, 2026-10-23)

Scope: CX 200, SX 300, FX 500.
Photos: `docs/research/rackets/photos/dunlop/`. All are Tennis Warehouse product shots (img.tennis-warehouse.com), each
opened and checked. The `_front` files are the two-up shot: side profile on the left, string-bed face on the right.
Generation years come from TW review dates and product titles (codes noted below). Hex values were sampled from the
photos and are approximate.

Shared details:
- Head shape: conventional OVAL. No squared head. The CX has a thin flat-sided box beam. The SX and FX have thicker,
  rounder power beams.
- String-bed stencil: the Dunlop "flying D" (a D inside an arrowhead/chevron pointing toward 3 o'clock), in BLACK.
- Butt cap: a dark grey/black octagon with the flying-D logo in grey. Grip BLACK on every frame here.
- The big "DUNLOP" wordmark, in white or black block letters, runs along the side of the hoop at about 10 to 12
  o'clock (side profile). The model name ("CX 200", "SX 300", "FX 500") sits on one throat arm.
- Grommets and bumper: black/dark on every frame here. They match the black crown.

The most important change between generations is the layout of the black:
- 2021 to 2023 gens: ASYMMETRIC. The black covers the LEFT side of the hoop, from about 7 o'clock up to about 12,
  as you face the strings, and the right side is the line color. There is a short black block at 3 o'clock.
- 2024/2025 gens: SYMMETRIC. A black crown runs across the top from about 10 to 2, with hard splits, and both sides are
  colored.

---

## CX 200

### Current: CX 200, 2024

- TW: "updated with a new mold for 2024" (TW code DCX2S; review "Dunlop CX 200 2024"). A new CX line is reported for
  2027 (Tennis Nerd first impressions, 2 Oct 2026), but it is not on sale yet.
- Main color: RED, in a GRADIENT. Bright scarlet/orange-red (about `#e8452f`) on the hoop sides from about 2 to 4 and
  8 to 10 o'clock. It deepens through crimson to a dark wine/crimson (about `#87222f`) on the lower hoop, throat and shaft.
- Top band: BLACK crown (about `#2a2b2e`) from about 10 to 2 o'clock, with a hard split where it meets the red.
- Sides: brightest orange-red at 3 and 9 o'clock. The side profile is orange-red with black at the top.
- Throat and shaft: deep crimson/wine, matte. "CX200" in light pink/grey along the outer face of the shaft.
- Finish: MATTE/satin crimson on the throat. The bright red on the hoop is a little glossier.
- Logo and text: "DUNLOP" in black on the side of the hoop at about 10 to 12. "CX 200" on the shaft.
- Stencil: black flying D.
- Grommets and bumper: black at the top, red at the sides.
- Handle: black grip. Dark octagon butt cap.
- Head: oval, thin flat box beam.
- Common special edition: CX 200 Limited Edition (2025, 18x20 and others). Gloss BLACK frame (about `#282b2e`) with an
  orange/gold "CX200" on the throat, an orange-to-gold chevron collar above the grip, and a thin orange-red inner pinline
  round the hoop. Photos: `cx-200-limited_2025_front.jpg`, `cx-200-limited_2025_throat.jpg`.
  Source: https://www.tennis-warehouse.com/Dunlop_CX_200_18x20_Limited_Edition/descpageRCDUNLOP-CX28LE.html
- Photos: `cx-200_2024_front.jpg`, `cx-200_2024_angle.jpg`, `cx-200_2024_throat.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Dunlop_CX_200/descpageRCDUNLOP-DCX2S.html
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/DCX2Sreview.html
  - https://www.tennisnerd.net/?p=69728 (2027 CX preview)

### Previous: CX 200, 2021

- TW review "Dunlop CX 200", review date January 2021 (code D200S). It added FlexBooster in the shaft.
- Main color: glossy RED (about `#c0182c`, highlights `#d23a40`). Slightly cooler than the 2024 red, with no
  orange-to-wine gradient. One solid red.
- Black: ASYMMETRIC. Black (`#392b30`) covers the LEFT side of the hoop from about 7:30 up over the top to about 12:30,
  as you face the strings. The right side of the hoop and the throat are red. There is a short black block on the right
  side at about 3 o'clock (I could not confirm what it marks). The side profile is black at the top and red
  below.
- Throat and shaft: red. A black inset panel with "CX 200" in white sits on the outer face of the shaft (side profile).
- Finish: gloss.
- Logo and text: big "DUNLOP" in white on red along the side of the hoop at about 10 to 12. "CX 200" in white on the shaft.
- Stencil: black flying D.
- Grommets and bumper: black.
- Handle: black grip. Dark octagon butt cap.
- Photos: `cx-200_2021_front.jpg`, `cx-200_2021_angle.jpg`, `cx-200_2021_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/D200Sreview.html (review date Jan 2021)

### Suggested DESIGNS entries

```js
// CX 200 2024 (current): black crown 10-2, bright red-orange sides, deep wine throat, black grip
['CX', { base: '#e8452f', band: '#2a2b2e', throat: '#87222f', head: 'oval',
  grip: '#1c1d21', finish: 'satin' /* gradient: scarlet sides -> wine throat */ }],

// CX 200 2021 (previous): solid gloss red, black over the LEFT upper hoop (7:30 to 12:30), black block at 3 o'clock
['CX', { base: '#c0182c', band: '#392b30', bandAt: 'left-asymmetric', throat: '#c0182c', head: 'oval',
  accent: '#392b30', accentAt: '3-oclock-block', grip: '#1c1d21', finish: 'gloss' }],
```

---

## SX 300

### Current: SX 300, 2025

- TW: "Dunlop SX 300 Racquet 2025" (code DSX3R). The TW 2025 review says the biggest change is the hoop geometry. A TW
  customer calls it "v3".
- Main color: TEAL/PETROL (about `#118896`, darker `#016476`) on the lower hoop, throat and shaft, with a gradient into
  a lighter aqua (`#24aaaf`) in places.
- Top band: BLACK crown (`#2a2b2c`) from about 10 to 2 o'clock, with a hard split.
- Sides: a short NEON LIME/YELLOW-GREEN block (about `#c8ec50`) right under the black crown, at about 2 to 3:30 and
  8:30 to 10 o'clock. Then teal from about 4 and 8 o'clock down. Order from top to bottom: black, lime, teal.
- Throat and shaft: teal. "SX 300" in lime/yellow on the throat arm.
- Finish: gloss.
- Logo and text: "DUNLOP" in white/black on the side of the hoop at about 10 to 12. "SX 300" in lime on the throat.
- Stencil: black flying D.
- Grommets and bumper: black at the top. Per TW, Spin Boost+ grommets.
- Handle: black grip. Dark octagon butt cap.
- Photos: `sx-300_2025_front.jpg`, `sx-300_2025_angle.jpg`, `sx-300_2025_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Dunlop_SX_300/descpageRCDUNLOP-DSX3R.html
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/DSX3Rreview.html

### Previous: SX 300, 2022

- TW review (code X300DU), review date February 2022. For reference, the first SX 300 (2020, code RSX300, review March
  2020) was mostly black with a lime side panel. It is not photographed here.
- Main color: YELLOW-LIME (about `#c8d02a`, highlights `#d7db77`), a soft acid yellow rather than a pure yellow.
- Black: ASYMMETRIC. Black (`#3e3f41`) covers the LEFT side of the hoop from about 7 up over the top to about 12,
  as you face the strings. The right side is yellow. There is a short black block at about 3 o'clock on the right side.
- Throat and shaft: yellow-lime. The bridge is black. Black bands with the "DUNLOP" logo wrap the outer face of the shaft.
- Finish: gloss.
- Logo and text: "SX 300" in grey/silver on the throat arm. "DUNLOP" in black down the side profile of the shaft.
- Stencil: black flying D.
- Grommets and bumper: black.
- Handle: black grip. Dark octagon butt cap.
- Photos: `sx-300_2022_front.jpg`, `sx-300_2022_angle.jpg`, `sx-300_2022_throat.jpg`
- Sources:
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/X300DUreview.html (review date Feb 2022)
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/RSX300review.html (2020 gen, March 2020)

### Suggested DESIGNS entries

```js
// SX 300 2025 (current): black crown, short lime block under it, teal/petrol below and on the throat, black grip
['SX', { base: '#118896', band: '#2a2b2c', throat: '#118896', head: 'oval',
  accent: '#c8ec50', accentAt: 'under-band' /* 2-3:30 and 8:30-10 */, grip: '#1c1d21', finish: 'gloss' }],

// SX 300 2022 (previous): acid yellow-lime, black over the LEFT upper hoop, black 3 o'clock block, black grip
['SX', { base: '#c8d02a', band: '#3e3f41', bandAt: 'left-asymmetric', throat: '#c8d02a', head: 'oval',
  accent: '#3e3f41', accentAt: '3-oclock-block', grip: '#1c1d21', finish: 'gloss' }],
```

---

## FX 500

### Current: FX 500, 2025

- TW: "Meet the 2025 FX 500!" with Power Boost+ frame geometry and Power Wave grommets (code DF500). TW's spec line
  says "Racquet Colors: Blue". It reads as navy-violet plus sky blue.
- Main color: NAVY-VIOLET / indigo (about `#4a4880`, shadows `#322f56`, metallic highlights `#7e7cb1`) on the lower
  hoop, throat and shaft. Metallic gloss.
- Top band: BLACK crown (`#232629`) from about 10 to 2 o'clock, with a hard split.
- Sides: SKY BLUE (about `#6fd3f5`) from about 2 to 4 and 8 to 10 o'clock, directly under the black. The side profile
  is mostly sky blue and black.
- Throat and shaft: navy-violet. "FX 500" in light grey on the throat arm.
- Finish: gloss/metallic.
- Logo and text: "DUNLOP" in white on black at the top of the side profile. "FX 500" on the shaft.
- Stencil: black flying D.
- Grommets and bumper: black.
- Handle: black grip. Dark octagon butt cap.
- Photos: `fx-500_2025_front.jpg`, `fx-500_2025_angle.jpg`, `fx-500_2025_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Dunlop_FX_500/descpageRCDUNLOP-DF500.html
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/DF500review.html

### Previous: FX 500, 2023

- TW review (code DFX500), review date March 2023.
- Main color: bright AZURE/ROYAL BLUE (about `#0a72d0`, lighter `#1fb0f0` on the hoop face). Gloss.
- Black: mostly asymmetric, like the other 2021 to 2023 frames. Dark navy-black (`#232a40`) covers the outer beam and
  the LEFT upper hoop (about 8 to 12 o'clock) as you face the strings. There is a short dark block at about 3 o'clock.
  There is also a dark navy panel down the outer face of one shaft arm.
- Throat and shaft: royal blue. "FX 500" in light blue/silver on the throat arm.
- Finish: gloss.
- Logo and text: "DUNLOP" in blue on black along the side profile.
- Stencil: black flying D.
- Grommets and bumper: black.
- Handle: black grip. Dark octagon butt cap.
- Photos: `fx-500_2023_front.jpg`, `fx-500_2023_angle.jpg`, `fx-500_2023_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/DFX500review.html (review date March 2023)

### Suggested DESIGNS entries

```js
// FX 500 2025 (current): black crown, sky-blue shoulders, navy-violet lower hoop and throat, black grip
['FX', { base: '#4a4880', band: '#232629', throat: '#4a4880', head: 'oval',
  accent: '#6fd3f5', accentAt: 'under-band' /* 2-4 and 8-10 */, grip: '#1c1d21', finish: 'gloss' }],

// FX 500 2023 (previous): bright royal/azure blue, dark navy over the LEFT upper hoop, black grip
['FX', { base: '#0a72d0', band: '#232a40', bandAt: 'left-asymmetric', throat: '#0a72d0', head: 'oval',
  grip: '#1c1d21', finish: 'gloss' }],
```

---

## Brand-wide signatures

- A BLACK CROWN across the top of the hoop with hard color splits. On the 2024/2025 frames it is symmetric (about 10 to
  2). On the 2021 to 2023 frames it covers the LEFT upper hoop plus a black block at 3 o'clock. This maps directly
  onto the app's `band` idea.
- One line color per series, used on the sides: CX = red, SX = yellow-lime (2022) or teal + lime (2025),
  FX = blue (2023) or navy-violet + sky blue (2025). The current gens add a second, lighter color right under the crown.
- A black flying-D chevron stencil on the strings.
- Big block "DUNLOP" on the side of the hoop at about 10 to 12.
- Black grips and a dark octagon cap on every model.
- Oval heads. The CX has the thinnest, flattest beam.
