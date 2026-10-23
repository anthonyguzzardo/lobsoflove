# Tecnifibre racket paint jobs (research, 2026-10-23)

Scope: TF40, TFIGHT, TF-X1.
Photos: `docs/research/rackets/photos/tecnifibre/`. All are Tennis Warehouse / TW Europe product shots
(img.tennis-warehouse.com), each opened and checked. The `_front` files are the two-up shot: side profile on the left,
string-bed face on the right.
Hex values were sampled from the photos and are approximate.

Shared details:
- Head shape: conventional OVAL, not squared. The TF40 and TFight use a boxy "RS Section" beam with flat sides, so the
  hoop edge looks crisp, but the outline is still oval.
- String-bed stencil: the Tecnifibre "TF" monogram (a large T with a stepped F), in BLACK. This held on every frame here.
- Butt cap: a dark octagon with a light grey/white centre and the tricolour TF logo (blue and red) on TF40 and TFight.
  The TF-X1 uses a black cap with a neon-yellow "X-DAMP" insert.
- Logo text: a big lowercase "tecnifibre" script runs down the outer face of one shaft arm. The model name ("T-FIGHT",
  "TF40", "TF-X1") sits on the side of the hoop or the other shaft arm.
- The French tricolour (blue/white/red) is a recurring motif, because the brand is French.

---

## TF40

### Current: TF40, 2024 cosmetic (retailers call it 2nd gen or V3)

- TW labels it "TF40 ... 2024" and calls the 305 16x19 the "second generation". e-tennis calls the same design "V3".
  The mechanics did not change from 2022. The new part is the cosmetic, and the 290g model was added. Launched in Europe
  around Aug 2024 (Tennis Nerd, 26 Aug 2024).
- Main color: WHITE (about `#e0e0e0` under studio light, really near-white) on the string-bed face, throat and shaft. Gloss.
- Secondary colors:
  - Top of the head: the whole OUTER beam (the side profile) from about 9 round to 3 o'clock is very dark olive-black
    (about `#2a2e2a`; "army green" per the press, but it reads as black). From the front you see a dark crown from about
    10 to 2.
  - Sides: a broken "camo/pixel" pattern in black, dark olive and ORANGE (about `#f07a2a`) where the dark crown breaks
    up into the white, at about 1 to 3 and 9 to 11 o'clock. Large black fragments of the "TF40" lettering spill down
    the right side of the hoop.
  - Throat and shaft: white, with black "Tecnifibre" text.
- Finish: gloss.
- Logo and text: large black "tecnifibre" with orange accents on one shaft arm. "TF40" in black on the side profile of the
  throat. Weight and pattern printed small near the handle.
- Stencil: black TF monogram.
- Grommets and bumper: black/dark at the top, white at the sides.
- Handle: WHITE grip. Dark octagon butt cap with a white centre and the tricolour TF logo.
- Head: oval, boxy beam.
- Photos: `tf40_2024_front.jpg`, `tf40_2024_angle.jpg`, `tf40_2024_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Tecnifibre_TF40_305g_16x19/descpageRCTFUSA-TF40R1.html
  - https://www.tennisnerd.net/?p=40413 (2024 model, "patterns in green and orange")
  - https://www.tennis.com/news/articles/take-command-with-the-updated-tecnifibre-tf40-racquet-series

### Previous: TF40, 2022 (V2), sold in the 2019-style white/black/tricolour cosmetic

- Tennis Nerd covered the 2022 TF40 (305 18x20, 305 16x19, 315 16x19) on 7 Jan 2022. TW now sells these as "TF40 v1 ...
  (original 2019 cosmetic)". The 16x19 version did not exist in 2019, so the photographed 16x19 is a 2022 frame wearing the
  2019-style look. Tennis Nerd describes the pre-2024 look as "white, red, and blue". There may be small graphic
  differences between the 2019 and 2022 versions that I could not confirm.
- Main color: a SPLIT of white and black. The string-bed face of the hoop is WHITE (`#e8e8e8`). The outer beam (side
  profile) is BLACK (`#222122`), which shows from the front as a thin black rim over the top and upper-left of the hoop.
- Secondary colors: TRICOLOUR BLOCKS, both on the RIGHT side of the hoop as you face the strings. A solid RED block
  (about `#e0202a`) at about 2:30 to 3:30, then a royal BLUE block (about `#2a3fa0`) just below it at about 4 to 5. Both
  read clearly from the front.
- Throat: asymmetric. The LEFT throat arm is solid BLACK from the bridge to the handle. The right arm is white. Black
  "tecnifibre" script on the shaft.
- Finish: gloss.
- Stencil: black TF monogram.
- Grommets and bumper: black.
- Handle: BLACK grip with the black throat collar. Dark octagon butt cap with the tricolour TF logo.
- Photos: `tf40_2022_front.jpg`, `tf40_2022_angle.jpg`, `tf40_2022_throat.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Tecnifibre_TF40_v1_305_16x19_Racquet/descpageRCTFUSA-TF4016.html
  - https://tennisnerd.net/gear/racquets/tecnifibre-tf40-2022/26043

### Suggested DESIGNS entries

```js
// TF40 2024 (current): white frame, dark olive-black crown breaking into orange pixel-camo, white grip
['TF40', { base: '#eeeeec', band: '#2a2e2a', throat: '#eeeeec', head: 'oval',
  accent: '#f07a2a', accentAt: 'band-edges' /* 1-3 and 9-11 o'clock */, grip: '#eeeeec', finish: 'gloss' }],

// TF40 2022 (previous): white face, thin black rim, red then blue block on the right side, left throat arm black, black grip
['TF40', { base: '#eeeeec', band: '#222122', throat: '#eeeeec', throatLeft: '#222122', head: 'oval',
  accent: '#e0202a', accentAt: 'right-side 2:30-3:30', accent2: '#2a3fa0' /* right side 4-5 */, grip: '#1c1d21', finish: 'gloss' }],
```

---

## TFIGHT (TFight 300 / 305)

### Current: TFight "S", 2025

- TW: "TFight 300S / 305S / 315S", "updated with a more powerful beam for 2025". The TW 305S review says the 305S
  replaced the ISO 305. Tennis Nerd's 2025 piece notes a glossy finish. TW also lists "TFight 300 / 285 / 270" in the
  same cosmetic.
- Main color: WHITE (`#f0f0ee`), gloss, over the whole frame.
- Secondary colors: TRICOLOUR STRIPES, shown as a pair of diagonal slashes, royal BLUE (about `#2a3fbf`) beside RED
  (about `#e0283a`). From the front there are two places: on the right side of the hoop at about 2:30 to 3, and on the
  left throat arm just below the hoop (about 7 o'clock). The side profile repeats the slashes at about 3 o'clock and
  on the throat. The top of the head is plain white, with no band.
- Finish: gloss.
- Logo and text: "T-FIGHT" in black italic capitals along the side of the hoop (side profile) and on the throat arm,
  with a small blue-white-red flag after it. "tecnifibre" in grey on the grip/handle. "RS Section" printed on the throat.
- Stencil: black TF monogram.
- Grommets and bumper: white.
- Handle: WHITE grip. Dark octagon butt cap with the tricolour TF logo.
- Head: oval, boxy RS-section beam.
- Common special editions:
  - TFight IG (Iga Swiatek's frame; 300 / 300S): bright coral-ORANGE (about `#f06040`) with white "tecnifibre", a white
    grip, and a neon yellow-green fleck. Seen often on women's and juniors' courts. Photo: `tfight-ig_2025_front.jpg`.
  - TFight Blue "Project Blue" (TW collab): navy (`#1c1f4c`) with white "tecnifibre" and an orange flash. Photo:
    `tfight-blue_2025_front.jpg`. It is a TW exclusive, so it is less common.
- Photos: `tfight_2025_front.jpg`, `tfight_2025_angle.jpg`, `tfight_2025_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Tecnifibre_TFight_305S/descpageRCTFUSA-TF305S.html
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/TF305Sreview.html
  - https://www.tennisnerd.net/gear/racquets/tecnifibre-tfight-2025/43684
  - https://www.tennis-warehouse.com/Tecnifibre_TFight_300_IG/descpageRCTFUSA-TF30IG.html
  - https://www.tennis-warehouse.com/Tecnifibre_TFight_Blue_305S_Racquet/descpageRCTFUSA-TFB305.html

### Previous: TFight ISO, 2022

- TW: the "T-Fight ISO 305 ... updated with improved feel ... for 2022". It added the IsoFlex system.
- Main color: WHITE, gloss. It looks very close to the 2025 S frame.
- Secondary colors: no slashes. Instead, big outline lettering wraps the hoop: BLACK "T-FIGHT" across the top from
  about 10 to 12, and the weight ("305") in RED and BLUE at about 12 to 1. Blue and black lettering fragments sit on the
  right side of the lower hoop at about 4 o'clock, plus thin red and blue pinstripes on the side profile and short
  tricolour dashes on the throat.
- Finish: gloss.
- Stencil: black TF monogram.
- Grommets and bumper: white.
- Handle: WHITE grip. Dark octagon butt cap with the tricolour TF logo.
- Photos: `tfight_2022_front.jpg`, `tfight_2022_angle.jpg`, `tfight_2022_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/ISO305review.html
  - https://www.tennis-warehouse.com/orderusedproduct.html?pcode=ISO305

### Suggested DESIGNS entries

```js
// TFIGHT 2025 (current): white all over, blue and red slash pair at 3 o'clock and on the left throat arm, white grip
['TFIGHT', { base: '#f0f0ee', band: null, throat: '#f0f0ee', head: 'oval',
  accent: '#2a3fbf', accent2: '#e0283a', accentAt: 'right-side+left-throat', text: '#1c1d21', grip: '#f0f0ee', finish: 'gloss' }],

// TFIGHT ISO 2022 (previous): white, with black T-FIGHT plus red/blue "305" lettering across the top of the hoop
['TFIGHT', { base: '#f0f0ee', band: null, throat: '#f0f0ee', head: 'oval',
  accent: '#1c1d21', accentAt: 'top' /* lettering 10-1 o'clock */, accent2: '#e0283a', grip: '#f0f0ee', finish: 'gloss' }],
```

---

## TF-X1

### Current: TF-X1 V2, 2024

- Launched with no pre-sale around April 2024 (Tennis Nerd, 3 Apr 2024). Colors listed as "White / Neon yellow". Not
  carried by TW USA as of Oct 2026. TW Europe carries the 305 V2 and 270 V2.
- Main color: WHITE face (`#eef0ee`), gloss.
- Secondary colors: the OUTER beam (side profile) is NEON YELLOW-GREEN (about `#cfe84a`) over the upper hoop. From
  the front this shows as a neon crown from about 8 to 2 o'clock, thickest across the top, fading to white down the
  right side. A soft gradient fades neon into white on the
  throat bridge and the inner throat. Dark grey "TF-X1" lettering sits on the side of the hoop at about 10 to 11 o'clock.
- Throat: white, with a neon bridge.
- Finish: gloss.
- Logo and text: "TF-X1" in dark grey/black italic on the throat and hoop side. "tecnifibre" in grey on the other arm.
- Stencil: black TF monogram.
- Grommets and bumper: neon yellow.
- Handle: WHITE grip. Black octagon butt cap with a neon "X-DAMP" insert.
- Head: oval.
- Photos: `tf-x1_2024_front.jpg`, `tf-x1_2024_angle.jpg`, `tf-x1_2024_side.jpg`
- Sources:
  - https://www.tennisnerd.net/gear/racquets/tecnifibre-tf-x1-v2/36691
  - https://www.tenniswarehouse-europe.com/catpage-RECVO2-EN.html (TF-X1 305 V2, TFX135)

### Previous: TF-X1 (V1), 2021

- The TW review is dated October 2021. One retailer lists it as "white/black/neon yellow".
- Main color: WHITE face, gloss.
- Secondary colors: the OUTER beam is dark charcoal grey (about `#4a4b4a`), with neon yellow-green (about `#c8e040`)
  chevrons/arrows running round the outside of the hoop. From the front you see a white face with a dark grey rim on
  the upper hoop and neon flecks. Large dark-grey "Tecnifibre" lettering on the throat.
- Finish: gloss.
- Stencil: black TF monogram.
- Grommets and bumper: dark grey with neon.
- Handle: WHITE grip. Black octagon butt cap with a neon "X-DAMP" insert.
- Photos: `tf-x1_2021_front.jpg`, `tf-x1_2021_angle.jpg`, `tf-x1_2021_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/TFX130review.html (review date Oct 2021)
  - https://racquetpoint.com/products/tecnifibre-tf-x1-300-tennis-racket

### Suggested DESIGNS entries

```js
// TF-X1 V2 2024 (current): white face, neon yellow outer beam (a neon rim from the front), white grip
['TF-X1', { base: '#eef0ee', band: '#cfe84a', throat: '#eef0ee', head: 'oval',
  rim: '#cfe84a' /* whole outer beam */, grip: '#eef0ee', finish: 'gloss' }],

// TF-X1 V1 2021 (previous): white face, charcoal outer beam with neon chevrons, white grip
['TF-X1', { base: '#eef0ee', band: '#4a4b4a', throat: '#eef0ee', head: 'oval',
  accent: '#c8e040', accentAt: 'outer-beam', grip: '#eef0ee', finish: 'gloss' }],
```

---

## Brand-wide signatures

- WHITE frames. All three current lines are white-based, and so are the previous TFight and TF-X1. The app's single
  Tecnifibre paint (`'TF': '#25272d'`, near-black) is the opposite of what you see on court.
- Tricolour blue/white/red flashes (TFight, TF40 2022) and the tricolour TF logo on the butt cap.
- A black "TF" monogram stencil on the strings, a stepped T/F mark, not a circle or a letter.
- Big lowercase "tecnifibre" script down one shaft arm.
- White grips on most current frames (TF40 2024, TFight, TF-X1).
- Oval head with a boxy, flat-sided beam on the control frames.
- Line identities: TF40 = white with a dark crown plus orange camo. TFight = white with red/blue slashes.
  TF-X1 = white with a neon-yellow rim.
