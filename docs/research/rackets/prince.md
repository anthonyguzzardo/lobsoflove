# Prince racket paint jobs (research, 2026-10-23)

Scope: PHANTOM 100 (the Phantom 100X family), TOUR 100. Lighter coverage than Yonex, Tecnifibre and Dunlop, as asked.
Photos: `docs/research/rackets/photos/prince/`. All are Tennis Warehouse product shots (img.tennis-warehouse.com), each
opened and checked. The `_front` files are the two-up shot: side profile on the left, string-bed face on the right.
Hex values were sampled from the photos and are approximate.

Shared details:
- String-bed stencil: a big lowercase Prince "p" in BLACK, filling the upper two-thirds of the string bed.
- Head shape: OVAL. The Phantom has a thin, flexible, flat-sided beam (about 20 mm) and a slightly elongated, teardrop
  head. The standard Phantom 100X does NOT have big O-port holes; only the "O3 Phantom 100X" variant does (see below).
- Butt cap: an octagon with the "p" logo. On older frames (2020 Phantom, 2022 Tour) it is BRIGHT LIME GREEN with a
  black p, which is very visible. On the 2024 Phantom it is dark/olive, and on the 2026 Tour it is black.

---

## PHANTOM 100 (Phantom 100X)

### Current: Phantom 100X, 2024

- TW: "Prince Phantom 100X 305g Racquet 2024" (code PHNX5), plus 290g, 18x20 and 100P versions. It added Zylon to the
  Textreme in the ATS (anti-torque system).
- Main color: OLIVE / ARMY GREEN (about `#5d5f3d`, darker `#494b34`, lighter `#787957`). The whole frame is one
  color, with a subtle tonal camo of darker and lighter olive patches on the throat and hoop.
- Top band: none.
- Sides, throat and shaft: olive. A small Textreme/Zylon badge sits on the throat. "PHANTOM" runs in dark olive along
  the side-profile shaft.
- Finish: matte/satin.
- Logo and text: small "prince" in yellow-green on the grip and throat. Very understated.
- Stencil: black p.
- Grommets and bumper: olive/dark.
- Handle: the grip is OLIVE-KHAKI (about `#8d8d6d`) with thin dark diagonal stripes. That is unusual: the handle reads
  as the same green family as the frame, not black. Dark octagon butt cap with an olive collar.
- Head: oval, thin beam, no O-ports.
- Common variant: O3 Phantom 100X (2025, code PO310X). Same olive green, slightly brighter and more yellow (about
  `#687648`), but with Prince's O3 "O-port" slots: large oval holes through the beam at 3 and 9 o'clock and across the
  top of the hoop, clearly visible in profile. Orange "prince" on the grip. Photos: `phantom-100x-o3_2025_front.jpg`,
  `phantom-100x-o3_2025_side.jpg`. Source:
  https://www.tennis-warehouse.com/Prince_O3_Phantom_100X/descpageRCTWABG-PO310X.html
- Photos: `phantom-100x_2024_front.jpg`, `phantom-100x_2024_angle.jpg`, `phantom-100x_2024_throat.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Prince_Phantom_100X_305g/descpageRCTWABG-PHNX5.html
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/PHNX5review.html

### Previous: Phantom 100X, 2020

- TW review "Prince Phantom 100X 305" (code PPX35), from early 2020. I did not find a separate 2021/2022 standard
  Phantom 100X between the 2020 and 2024 frames. There was an earlier O3 Phantom 100X in the same navy (code PP100X,
  not photographed here). So "previous" here is the 2020 frame, but there may have been an interim cosmetic that I could
  not confirm.
- Main color: dark METALLIC NAVY/SLATE BLUE (about `#4a5061`, shadows `#262a37`, highlights `#868d9e`). One color over
  the whole frame.
- Top band: none.
- Throat and shaft: navy, with a lighter blue-grey metallic sheen on the throat face. Textreme badge on the throat.
- Finish: gloss metallic.
- Logo and text: "prince" in white on the throat bridge area, and the model text in light blue on the shaft.
- Stencil: black p.
- Grommets and bumper: dark navy.
- Handle: dark grey grip with a subtle stripe pattern. BRIGHT LIME-GREEN octagon butt cap.
- Head: oval, thin beam.
- Photos: `phantom-100x_2020_front.jpg`, `phantom-100x_2020_angle.jpg`, `phantom-100x_2020_throat.jpg`
- Sources:
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/PPX35review.html

### Suggested DESIGNS entries

```js
// PHANTOM 100X 2024 (current): matte olive all over, olive-khaki grip, no band
['PHANTOM', { base: '#5d5f3d', band: null, throat: '#5d5f3d', head: 'oval',
  grip: '#8d8d6d', finish: 'matte' }],
// O3 variant: same, plus O-port slots at 3, 9 and 12 o'clock
['O3 PHANTOM', { base: '#687648', band: null, throat: '#687648', head: 'oval', ports: true,
  grip: '#8d8d6d', finish: 'matte' }],

// PHANTOM 100X 2020 (previous): metallic navy slate all over, dark grip, lime butt cap
['PHANTOM', { base: '#4a5061', band: null, throat: '#4a5061', head: 'oval',
  grip: '#2a2c30', cap: '#7fd23a', finish: 'gloss' }],
```

---

## TOUR 100

### Current: Tour 100, 2026

- TW: "Prince Tour 100 310g 2026", "Tour 100 290g 2026" and "Tour 100P 2026" (code PTR631).
- Main color: GLOSS BLACK (about `#1d1e1f`) over the whole frame.
- Secondary colors: ORANGE (about `#f07a20`) lettering only. Giant "TOUR" letters wrap the right side of the hoop from
  about 1 to 5 o'clock, and also show on the side profile. A small orange "prince" sits on the left throat arm.
- Top band: none (all black).
- Throat and shaft: black.
- Finish: gloss.
- Logo and text: orange, as above. The grip has an orange "prince" and a small orange model print near the butt.
- Stencil: black p.
- Grommets and bumper: black.
- Handle: black grip with orange text. Black octagon butt cap.
- Head: oval.
- Photos: `tour-100_2026_front.jpg`, `tour-100_2026_angle.jpg`, `tour-100_2026_throat.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Prince_Tour_100_310g_2026/descpageRCTWABG-PTR631.html
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/PTR631review.html

### Previous: ATS Textreme Tour 100, 2022

- TW: "Prince ATS Textreme Tour 100 310", "updated ... for 2022". The review is dated June 2022 (code ATR310). It was
  still on sale in Oct 2026.
- Main color: WHITE (`#e8e8ea`) on the string-bed face, throat and shaft. Gloss.
- Black: ASYMMETRIC. The outer beam on the LEFT upper hoop (about 8 to 12 o'clock) is black, the lower throat just above
  the grip is black, and the side profile is black at the top.
- Secondary colors, in geometric zig-zag "maze" pattern blocks:
  - CORAL-ORANGE (about `#e8603a`) maze pattern on the upper-right hoop (about 12 to 3 o'clock), plus orange dots on the
    grommet strip and an orange inner stripe on the side profile.
  - Pale TEAL/AQUA (about `#8ec1c2`) maze pattern on the lower hoop at about 8 o'clock and on both throat arms above the
    black collar.
- Logo and text: big black "TOUR" lettering on the right side of the hoop (about 2 to 4 o'clock) and on the side profile.
  Small black "prince" on the throat. "ATS" and "Textreme" printed on the side.
- Stencil: black p.
- Grommets and bumper: white, with orange accents.
- Handle: black grip with orange "Textreme" print. BRIGHT LIME-GREEN octagon butt cap.
- Head: oval.
- Photos: `tour-100_2022_front.jpg`, `tour-100_2022_angle.jpg`, `tour-100_2022_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Prince_ATS_Textreme_Tour_100_310/descpageRCTWABG-ATR310.html
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/ATR310review.html (review date June 2022)

### Suggested DESIGNS entries

```js
// TOUR 100 2026 (current): all gloss black, giant orange TOUR lettering on the right side of the hoop, black grip
['TOUR', { base: '#1d1e1f', band: null, throat: '#1d1e1f', head: 'oval',
  accent: '#f07a20', accentAt: 'right-side lettering 1-5', grip: '#1c1d21', finish: 'gloss' }],

// TOUR 100 2022 (previous): white face, black upper-left outer beam, coral maze top-right, teal maze low and on the throat
['TOUR', { base: '#e8e8ea', band: '#1c1d21', bandAt: 'left-asymmetric', throat: '#e8e8ea', head: 'oval',
  accent: '#e8603a', accentAt: 'upper-right', accent2: '#8ec1c2' /* lower hoop and throat arms */,
  grip: '#1c1d21', cap: '#7fd23a', finish: 'gloss' }],
```

Note for implementation: the key 'TOUR' is risky because it also matches names like "EZONE 98 TOUR", "SX 300 TOUR" and
"VCORE 98 TOUR". Either key it on 'TOUR 100' or check the brand first.

---

## Brand-wide signatures

- A big black lowercase "p" stencil on the strings. It is the most recognizable Prince cue.
- One understated frame color per line on the current gens: Phantom = matte olive green, Tour = gloss black with orange.
- Thin, flat-sided beams and slightly elongated oval heads (Phantom). O-port slots only on the "O3" variants.
- Bright lime-green octagon butt caps on many older frames. The newer caps are dark.
- Phantom 2024 has a colored (olive-khaki) grip that matches the frame. Most other rackets have black or white grips.
- The app currently has no Prince entry in PAINT or DESIGNS, so both lines fall back to the default cream `#f4f1ea`.
  That does not match any Prince frame here.
