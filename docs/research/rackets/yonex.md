# Yonex racket paint jobs (research, 2026-10-23)

Scope: EZONE 98 / 100, VCORE 98 / 100, PERCEPT 97 (plus its predecessor, VCORE PRO 97).
Photos: `docs/research/rackets/photos/yonex/`. All are Tennis Warehouse product shots (img.tennis-warehouse.com),
opened and checked one by one. The `_front` files are TW's standard two-up shot: side profile on the left, string-bed face
on the right. `_angle` is a three-quarter view of the hoop. `_side` / `_throat` are close-ups.

Hex values were sampled from the product photos (median-cut palette on non-white pixels). Treat them as studio-light
approximations: gloss frames read lighter in highlights and darker in shadow. The value given is the mid-tone to paint with.

Things every current Yonex frame shares (so they are not repeated per model):
- Head shape: ISOMETRIC. The hoop is squared off at about 10 and 2 o'clock, wider across the top than an oval, with
  near-straight sides. No other brand in this file set uses a squared head. This is the single biggest Yonex tell.
- Butt cap: Yonex's dark green octagon cap with the Yonex "YY" logo in silver/white, on every model and generation here.
  Older caps read "JAPAN" on the cap. Per a TW reviewer quoted on Tennis Nerd, the 2026 VCORE caps dropped the "JAPAN" mark.
- String-bed stencil: the Yonex "YY" logo, two stacked circles beside two stacked triangles, almost always in red.
- Grommets and bumper: molded in the frame's main color (blue on EZONE, red on VCORE, green on Percept), so the head
  reads as one solid color from the front.

---

## EZONE 98 / EZONE 100

The 98 and 100 share one paint job in every generation. The 100 has a slightly larger, rounder-looking hoop.

### Current: EZONE 8th gen, 2025 ("Blast Blue")

- Released 10 January 2025 (Tennis Nerd). TW lists them as "EZONE 98 (2025)" and "EZONE 100 (2025)".
- Main color: bright metallic royal blue, gloss. Mid-tone about `#3d63b4`, shadows `#2a48a0`, highlights `#6e9eca`.
- Secondary colors: the face is almost solid blue with no top band. The accent is a mint/aqua patch (about `#4fd6b8`)
  on the beam at the lower hoop, around 4 and 8 o'clock, plus a few soft darker-blue camo-like blotches up the sides.
  On the side profile, a translucent lighter-blue panel runs down the shaft.
- Throat: same blue as the frame, with a light translucent blue (ice-blue) bridge piece and collar above the grip.
- Finish: gloss, with a slight pearlescent or metallic sheen.
- Logo and text: "YONEX" in silver/light grey along the outer face of the shaft. "EZONE" in silver on the other shaft.
  "ISOMETRIC" in small white text at the top of the hoop.
- Stencil: red Yonex logo.
- Grommets and bumper: blue, matching the frame.
- Handle: WHITE grip, which is new for this generation (the 2022 frames had black grips). Green octagon butt cap.
- Head: isometric.
- Special editions:
  - Espresso Brown (EZONE 98, 100, 98 Tour, 100L, 105), announced Aug 2026, ships about 21 Aug 2026. Matte near-black
    espresso brown (about `#3a3632`) with copper and burnt-orange camo patches scattered round the hoop, mostly at
    3 and 9 o'clock and up the throat sides. Black grip. It is too new to be common on courts yet.
  - "Aqua Night Black" (2024) was a cosmetic of the 2022 frame. It is not shown here.
- Photos: `ezone-98_2025_front.jpg`, `ezone-98_2025_angle.jpg`, `ezone-98_2025_side.jpg`, `ezone-100_2025_front.jpg`,
  `ezone-100_2025_angle.jpg`, `ezone-98-espresso_2025_front.jpg`, `ezone-98-espresso_2025_angle.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Yonex_EZONE_98_2025/descpageRCYONEX-EZ98BB.html
  - https://www.tennis-warehouse.com/Yonex_EZONE_100_2025/descpageRCYONEX-EZ10BB.html
  - https://www.tennisnerd.net/gear/racquets/yonex-ezone-2025/42542 (Blast Blue name, 10 Jan 2025 release)
  - https://www.tennis-warehouse.com/Yonex_EZONE_98_Espresso_Brown/descpageRCYONEX-EZ98EB.html
  - https://tennisexpress.com/blogs/news/yonex-ezone-espresso-brown-a-new-look (dated 5 Aug 2026)

### Previous: EZONE 7th gen, 2022 ("Sky Blue")

- Released early 2022. The TW review and retailers call it "EZONE 98 2022", and UK retailers list the color as Sky Blue.
- Main color: dark navy/midnight blue, gloss, about `#2a3550` (shadows `#222c43`).
- Secondary colors: a GRADIENT from navy to sky blue/aqua (about `#56a6c8`, brightest `#6aaac4`). The top of the head
  (10 to 2) and the throat are navy. The lower half of the hoop and the outer face of the shaft fade to sky blue. On the
  side profile the sky blue is strong along the whole beam. Overall: navy face, light-blue sides.
- Throat: navy.
- Finish: gloss.
- Logo and text: "YONEX" with the YY logo in light sky blue on the outer face of the shaft. "EZONE" in sky blue/silver
  on the other shaft, which also carries the yellow "dot" sticker. "ISOMETRIC" in white at the top of the hoop.
- Stencil: red Yonex logo.
- Grommets and bumper: navy.
- Handle: BLACK grip. Green octagon butt cap.
- Head: isometric.
- Photos: `ezone-98_2022_front.jpg`, `ezone-98_2022_angle.jpg`, `ezone-98_2022_side.jpg`, `ezone-100_2022_front.jpg`,
  `ezone-100_2022_angle.jpg`
- Sources:
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/EZO98review.html
  - https://centralsports.co.uk/products/yonex-ezone-98l-285g-tennis-racket-2022-sky-blue
  - TW image codes EZO98 (98) and EZO10 (100)

### Suggested DESIGNS entries

```js
// EZONE 2025 (current): one bright blue, no top band, mint flashes low on the hoop, white grip
['EZONE', { base: '#3d63b4', band: null, throat: '#3d63b4', head: 'iso',
  accent: '#4fd6b8', accentAt: 'lower-sides' /* about 4 and 8 o'clock */, grip: '#eef0f2', finish: 'gloss' }],

// EZONE 2022 (previous): navy face fading to sky blue down the sides, black grip
['EZONE', { base: '#2a3550', band: '#2a3550', throat: '#2a3550', head: 'iso',
  sides: '#56a6c8' /* gradient: navy at top, sky blue from 3 and 9 o'clock down */, grip: '#1c1d21', finish: 'gloss' }],
```

---

## VCORE 98 / VCORE 100

The 98 and 100 share one paint job in each generation.

### Current: VCORE 8th gen, 2026 ("Ruby Red")

- TW labels it "VCORE 98 8th Gen" and "VCORE 100 8th Gen". TW Europe names the color Ruby Red and says the frames were
  "updated for 2026". Tennis Nerd reviewed them on 1 Jan 2026. I did not find an exact street date. Assume early 2026.
- Main color: deep ruby/crimson red, solid, gloss. Mid-tone about `#c01530`, shadows `#921027`, highlights `#e95871`.
  It is darker and bluer than the old Tango Red. Think wine-gum red, not fire-engine red.
- Secondary colors: essentially none on the face. The whole hoop, throat and shaft are one red. Small details: a
  mint/aqua bridge piece (the inside face of the throat bridge, about `#7fd8c8`) visible through the open throat, and a
  darker maroon collar/ferrule just above the grip (about `#7a1020`).
- Finish: high gloss. Reviewers called the gloss a plus over 2023.
- Logo and text: "YONEX" plus the YY logo in cream/champagne gold (about `#f0dcb0`) on the outer face of the shaft.
  "VCORE" in thin gold capitals on the other shaft and again along the side of the hoop at about 3 o'clock.
- Stencil: red Yonex logo.
- Grommets and bumper: red, matching the frame.
- Handle: WHITE grip, new for this generation. Green octagon butt cap without the "JAPAN" text.
- Head: isometric. Per TW Europe, the 2026 frame has a reworked beam: thicker on the 98, redesigned on the 100.
- Photos: `vcore-98_2026_front.jpg`, `vcore-98_2026_angle.jpg`, `vcore-98_2026_side.jpg`, `vcore-100_2026_front.jpg`,
  `vcore-100_2026_angle.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Yonex_VCORE_98_8th_Gen/descpageRCYONEX-VC988G.html
  - https://www.tennis-warehouse.com/Yonex_VCORE_100_8th_Gen/descpageRCYONEX-VC108G.html
  - https://www.tenniswarehouse-europe.com/catpage-YONEXNEW-EN.html (Ruby Red name, 2026 update)
  - https://www.tennisnerd.net/gear/racquets/yonex-vcore-2026-review/62233

### Previous: VCORE 7th gen, 2023 (red, likely "Tango Red")

- Revealed Dec 2022 and sold from early 2023. TW calls it the 7th gen and lists the color as "Red". I remember the
  color name as "Tango Red" but found no source to confirm it.
- Main color: bright orange-red (tango red), gloss, about `#dc2133` (deeper red `#c84048` in shade).
- Secondary colors, laid out in SOLID BLOCKS:
  - Top of the head: the outside of the beam from about 10 to 2 fades to a dark charcoal/maroon (`#4d4047`). From the
    front this reads as a darker crown. On the side profile the upper hoop is dark charcoal.
  - Throat: the bridge and one side of the throat are dark charcoal/black. A bright cyan-blue block (about `#2f8fe0`)
    sits on the right-hand throat arm just below the bridge, at about 5 o'clock as you face the strings.
  - Sides: cyan "VCORE" lettering runs along the side of the hoop at 3 and 9 o'clock, with cyan block patches.
  - Shaft: red.
- Finish: gloss, with some matte panels. TW reviewers said 2026 is "glossier".
- Logo and text: "YONEX" plus the YY logo in white on the red outer face of the shaft. "VCORE" in large cyan outline
  letters on the side of the hoop.
- Stencil: red Yonex logo.
- Grommets and bumper: red at the sides, dark at the top.
- Handle: BLACK grip. Green octagon butt cap with "JAPAN".
- Head: isometric. The 2023 frame enlarged the upper hoop.
- Common special edition: Sand Beige (Aug 2024, 7 VCORE models). Off-white/sand (about `#dcd3cc`) with a gold-tan
  outer beam (`#bfaba2`), small gold "YONEX" on the throat, white grip, and a black collar. This one is often seen.
  Photo: `vcore-98-sand-beige_2024_front.jpg`. Source:
  https://www.tennis.com/news/articles/yonex-releases-vcore-racquet-series-new-special-edition-colorway-sand-beige
- Photos: `vcore-98_2023_front.jpg`, `vcore-98_2023_angle.jpg`, `vcore-98_2023_throat.jpg`, `vcore-100_2023_front.jpg`,
  `vcore-100_2023_angle.jpg`
- Sources:
  - https://www.tennis-warehouse.com/orderusedproduct.html?pcode=YVC98 (2023 VCORE 98, color Red)
  - https://www.tennisnerd.net/?p=28327 (VCORE 2023 reveal, Dec 2022)
  - TW image codes YVC98, YVC100

### Suggested DESIGNS entries

```js
// VCORE 2026 (current): one solid deep ruby red, gold text, white grip, no black band
['VCORE', { base: '#c01530', band: null, throat: '#c01530', head: 'iso',
  text: '#f0dcb0', collar: '#7a1020', grip: '#eef0f2', finish: 'gloss' }],

// VCORE 2023 (previous): tango red, dark crown, charcoal bridge, cyan block on the throat, black grip
['VCORE', { base: '#dc2133', band: '#4d4047', throat: '#4d4047', head: 'iso',
  accent: '#2f8fe0', accentAt: 'throat-right+sides', grip: '#1c1d21', finish: 'gloss' }],
```

---

## PERCEPT 97 (and its predecessor, VCORE PRO 97)

The Percept replaced the VCORE PRO line in 2023. It is the same mold family: TW lists one grommet set for both the
Percept 97 and the VCORE PRO 97 (2021). No second-gen Percept had shipped as of Oct 2026. TW and TW Europe still sell the
2023 frame, now mostly in Midnight Navy. So "current" is the 2023 Percept, and "previous" is the 2021 VCORE PRO 97.

### Current: Percept, 1st gen, 2023 ("Olive Green")

- Launched summer 2023 (tennis.com; Tennis Nerd). Retailers list the color as Olive Green.
- Main color: TWO-TONE GREEN. The head is a deeper teal-olive (about `#285558`, mid `#3f6e6c`). The face of the throat
  and shaft is a lighter sage/olive (about `#7fb0a8`).
- Secondary colors:
  - Top of the head: the same dark teal-olive. No contrasting band.
  - Sides: a bright emerald/jade patch (about `#1fb59a`) on the beam at about 2 to 3 o'clock, and a salmon/coral
    flash (about `#e8806a`) at about 8 to 9 o'clock. Soft camo-like blotches between the two greens.
  - Throat and shaft: light sage on the face, darker green on the edges.
- Finish: mostly matte/satin, with gloss lettering.
- Logo and text: "YONEX" plus the YY logo in RED (about `#d23a3a`) on the outer face of the shaft. "PERCEPT" in small
  text on the other shaft.
- Stencil: red Yonex logo.
- Grommets and bumper: dark green.
- Handle: BLACK grip. Green octagon butt cap with "JAPAN".
- Head: isometric. The 97 sq in head is slightly smaller and more compact than EZONE or VCORE.
- Common special edition: Midnight Navy (released July 2025, before the US Open; 97, 100, 100D, 100L, Game). Slate
  navy/grey-violet (about `#4a4a5c`) with iridescent lilac/purple and salmon-pink accents along the sides at 3 and
  9 o'clock. "PERCEPT" in grey on the throat, small red YY on the throat, black grip. It is now the most widely stocked
  Percept color. Photos: `percept-97-midnight-navy_2025_front.jpg`, `percept-97-midnight-navy_2025_angle.jpg`.
  Source: https://www.tennisnerd.net/gear/racquets/yonex-launching-the-percept-midnight-navy/57688
- Photos: `percept-97_2023_front.jpg`, `percept-97_2023_angle.jpg`, `percept-97_2023_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/PERC97review.html
  - https://prod.tennis.com/news/articles/creative-control-yonex-releases-new-percept-family-of-racquets
  - https://www.tennisgear.com.au/products/yonex-2023-percept-97l-tennis-racquet-olive-green (Olive Green name)
  - https://www.tennis-warehouse.com/Yonex_Percept_97_Midnight_Navy/descpageRCYONEX-PERM97.html

### Previous: VCORE PRO 97, 2021

- 2021 model (TW: "VCORE PRO 97 310 (2021)"). I could not confirm a color name. Some retailers may have called it
  "Matte Green", but that is unverified.
- Main color: matte dark charcoal/gunmetal with a navy cast (about `#302f37`) on the string-bed face and throat.
- Secondary colors: a GRADIENT of teal-green (about `#5fc0b8`) and violet/purple (about `#7a5cc0`) on the outer beam
  and sides of the hoop. In side profile the iridescent teal-to-purple dominates. From the front you mostly see charcoal
  with teal/purple at the edges, strongest at 2 to 4 o'clock and 8 to 10 o'clock and on the outer shaft.
- Finish: matte base with glossy gradient accents.
- Logo and text: "YONEX" in white/violet on the throat bridge area. "VCORE PRO" in teal on the shaft side.
- Stencil: red Yonex logo.
- Grommets and bumper: black/charcoal.
- Handle: black grip. Green octagon butt cap with "JAPAN".
- Head: isometric.
- Photos: `vcore-pro-97_2021_front.jpg`, `vcore-pro-97_2021_angle.jpg`, `vcore-pro-97_2021_side.jpg`
- Sources:
  - https://www.tennis-warehouse.com/Yonex_VCORE_PRO_97_310_97H_330_2021_Grommet/descpageYONEX-310VD7BG.html
  - https://www.tennis-warehouse.com/learning_center/racquet_reviews/VCP97review.html
  - TW image code 310VD7

### Suggested DESIGNS entries

```js
// PERCEPT 2023 (current): two-tone green, dark teal-olive head, sage throat, jade and coral side flashes, red YONEX
['PERCEPT', { base: '#3f6e6c', band: null, throat: '#7fb0a8', head: 'iso',
  accent: '#1fb59a', accentAt: 'right-side' /* 2-3 o'clock */, accent2: '#e8806a' /* 8-9 o'clock */,
  text: '#d23a3a', grip: '#1c1d21', finish: 'matte' }],
// Midnight Navy variant (2025, very common now)
['PERCEPT MIDNIGHT', { base: '#4a4a5c', band: null, throat: '#4a4a5c', head: 'iso',
  accent: '#a08ad0', accentAt: 'sides', grip: '#1c1d21', finish: 'satin' }],

// VCORE PRO 2021 (previous): matte charcoal face, teal-to-purple gradient on the outer beam
['VCORE PRO', { base: '#302f37', band: '#302f37', throat: '#302f37', head: 'iso',
  sides: '#5fc0b8', sides2: '#7a5cc0', grip: '#1c1d21', finish: 'matte' }],
```

Note for implementation: the catalog key 'VCORE' would also match 'VCORE PRO', so 'VCORE PRO' must come first in
DESIGNS if it is ever added.

---

## Brand-wide signatures

- Isometric (squared) head. The flat-ish top and the shoulders at 10 and 2 o'clock are the strongest at-a-glance cue,
  stronger than any color.
- One dominant color per line, with no black crown band on the current gens. EZONE = blue, VCORE = red,
  PERCEPT = green (or Midnight Navy). Accents are small flashes low on the hoop sides, not a band across the top.
- "YONEX" plus the YY logo written along the OUTER face of one shaft arm, reading toward the handle. The model name sits
  on the opposite arm.
- Red YY logo stencil on the strings, nearly universal.
- Dark green octagon butt cap.
- 2025/2026 gens ship with WHITE grips (EZONE 2025, VCORE 2026). Older gens and the Percept have black grips.
- Gloss on EZONE and VCORE. Matte/satin on Percept and VCORE PRO.
