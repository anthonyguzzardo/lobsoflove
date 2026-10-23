# Babolat racket paint jobs: current and previous generation

Research date: 2026-10-23. Scope: the Babolat lines in `web/lib/gear-catalog.js` (PURE AERO 98, PURE AERO, PURE AERO RAFA, PURE DRIVE, PURE DRIVE 98, PURE STRIKE 97, PURE STRIKE 100), plus notes on Pure Strike 98.

How the colors were taken: hex values were sampled with a script from Tennis Warehouse product photos (studio light on white, so the lit side reads lighter and the shadowed side darker than the paint). Each value is the middle of that range, rounded. Treat them as close, not exact. Where something is a judgment from a photo and not confirmed by a source, it says so.

Photos are in `docs/research/rackets/photos/babolat/`. File suffixes:
- `_front`: Tennis Warehouse "hero" shot. Side view of the frame on the left, string bed facing the camera on the right.
- `_throat`: close-up of throat and shaft.
- `_head` / `_angle`: close-up of the hoop, or a three-quarter view of the head that shows the bumper and outer beam.

Every file was opened and checked by eye: right model, right paint, a real JPEG.

Current-generation status (checked against the Tennis Warehouse US Babolat racquet listing on 2026-10-23):
- Pure Aero: the 2026 line (9th gen) is current. 2023 Team/Lite are still being cleared out.
- Pure Drive: the 2025 line (11th gen) is current, including Pure Drive 98 2025.
- Pure Strike: the 4th gen (launched early 2024) is current. Since about August 2025 it ships only in the "Carbon Grey" colorway. No 5th gen exists yet.
- Pure Aero Rafa: no Rafa edition on the 2026 platform was found, and none is listed at TW. The latest is the 2023 Rafa (pink/yellow/blue), and there is a Rafa Origin in the same paint.

---

## PURE AERO 98

### Current: Pure Aero 98 2026 (9th-gen Pure Aero family, launched Feb 2026)
- **Release:** pre-orders January 2026, in stock 19 Feb 2026 (TennisNerd). TW code BPA98R.
- **Main frame:** slate grey with a green-blue cast, about `#5f7378`. The lit side reads `#81969b` and the shadowed side `#3d4a4f`.
- **Secondary color:** neon lime-yellow, about `#c8fa3c`, in solid hard-edged blocks on both sides of the hoop. The blocks run from about 2:30 to 4 o'clock and from 8 to 9:30, so the 3 and 9 o'clock zones are lime. The top of the head (10 to 2) is the same slate grey as the frame, with no contrasting band on the face. On the outer edge, a thin lime line runs along the string groove all the way round the hoop.
- **Throat and shaft:** slate grey. Large "AERO" letters run down the shaft in a darker charcoal-grey (`#2f3c42`) with lime edging, and the lime fades in near the handle.
- **Finish:** satin or semi-matte by the look of the photos. Not confirmed by a source.
- **Logo/text:** large silver-white "Babolat" lettering on the outer face of the head from about 12 to 2 o'clock (seen on the side view), plus a small Babolat "B" mark at the throat bridge. Tech text ("FSI SPIN", "NF2-TECH") sits small on the side of the hoop in lime/grey.
- **Stencil:** the standard Babolat double-ladder logo in black.
- **Grommets/bumper:** dark bumper. Grommet holes in the lime blocks read lime, and the top-of-head grommets appear lime. Elsewhere they are dark.
- **Handle/butt:** black grip, black butt cap with the lime Babolat wordmark.
- **Head shape:** oval. Aeromodular beam: a thin, aero-profiled beam with a deep groove at 3 and 9. Throat reworked for about 6% less drag, according to Babolat via TennisNerd. Open Y-throat.
- **Sources:** https://www.tennis-warehouse.com/Babolat_Pure_Aero_98_2026/descpageRCBAB-BPA98R.html , https://www.tennisnerd.net/gear/racquets/babolat-pure-aero-2026/62418 , https://tennisaddict.fr/tests/babolat-pure-aero-2026-en/
- **Photos:** `pure-aero-98_2026_front.jpg`, `pure-aero-98_2026_throat.jpg`, `pure-aero-98_2026_angle.jpg`

### Previous: Pure Aero 98 2023 (8th-gen family, launched Aug 2022)
- **Release:** the 2023 Pure Aero family went on sale in August 2022 (Galaxus listing 10 Aug 2022; TW review August 2022). TW code BARO98.
- **Main frame:** dark charcoal, about `#3c3e40`, broken up by lighter grey camouflage shards (`#767b72`). It reads as near-black from a distance.
- **Secondary colors:** neon lime (`#d4ec66`) and silver-white (`#c0c6cc`), in solid angular blocks. The two sides are not the same: the 3 o'clock side of the hoop is mostly lime, and the 9 o'clock side is mostly white/silver. More lime shards sit at about 1 to 2 o'clock. The top of the head (10 to 2) is charcoal, with an outline-style lime "Babolat" wordmark running round the top of the hoop face.
- **Throat and shaft:** charcoal, with big jagged lime and grey shards forming the "AERO" letters.
- **Finish:** mixed. Mostly satin, with glossier lime graphics (judged from photos).
- **Logo/text:** outlined lime "Babolat" round the top of the hoop. "AEROMODULAR" and "NF2 TECH" in white on the side of the beam.
- **Stencil:** standard Babolat logo in black.
- **Grommets/bumper:** black.
- **Handle/butt:** black grip, black butt cap with the lime Babolat wordmark.
- **Head shape:** oval, with the same Aeromodular beam idea as 2026 but the older throat.
- **Sources:** https://www.tennis-warehouse.com/learning_center/racquet_reviews/BARO98review.html , https://www.tennis-warehouse.com/Babolat_Pure_Aero_2023/catpage-BABPA22PP.html
- **Photos:** `pure-aero-98_2023_front.jpg`, `pure-aero-98_2023_throat.jpg`, `pure-aero-98_2023_angle.jpg`

### Suggested DESIGNS entries
```js
// Pure Aero 98 2026 (current): slate grey, lime blocks at 3 and 9, no contrasting top band
['PURE AERO 98', { base: '#5f7378', band: '#5f7378', throat: '#5f7378', head: 'oval' }],
// extras worth drawing: side: '#c8fa3c' (3 and 9 o'clock blocks), grip: '#2a2a2a'

// Pure Aero 98 2023 (previous): charcoal camo, lime on the 3 o'clock side, white on the 9 o'clock side
['PURE AERO 98 2023', { base: '#3c3e40', band: '#3c3e40', throat: '#3c3e40', head: 'oval' }],
// extras: sideRight: '#d4ec66', sideLeft: '#c0c6cc', lime shards in throat
```

---

## PURE AERO (100)

### Current: Pure Aero 2026 (9th gen, Feb 2026)
- **Paint:** the same as the Pure Aero 98 2026 above. The 100 and the 98 cannot be told apart from across a court. Slate grey `#5f7378`, solid lime `#c8fa3c` blocks at about 2:30 to 4 and 8 to 9:30, slate-grey top of the head, lime line along the outer string groove, "AERO" letters down the shaft, big silver "Babolat" on the outer face of the head at 12 to 2.
- **Differences from the 98:** the 100 has a slightly rounder, larger head and its yellow blocks sit a touch lower. Same black grip and black butt cap with the lime logo.
- **Grommets/bumper:** dark bumper. Lime grommet strip across the top of the head and on the throat bridge (visible on the front shot).
- **Variants:** Team, Lite, Super Lite and Plus share the paint.
- **Sources:** https://www.tennis-warehouse.com/Babolat_Pure_Aero_2026/descpageRCBAB-BPAR26.html , https://www.tennis-warehouse.com/learning_center/racquet_reviews/BPAR26review.html , https://www.tennisnerd.net/gear/racquets/babolat-pure-aero-2026/62418
- **Photos:** `pure-aero_2026_front.jpg`, `pure-aero_2026_throat.jpg`, `pure-aero_2026_angle.jpg`

### Previous: Pure Aero 2023 (8th gen, Aug 2022)
- **Paint:** the same as Pure Aero 98 2023. Charcoal camo `#3c3e40`. The 3 o'clock side is mostly lime `#d4ec66`. The 9 o'clock side has silver-white `#c0c6cc` blocks. Charcoal top of the head with an outlined lime "Babolat" wordmark from 10 to 12. Lime/grey shard "AERO" letters in the throat.
- **Finish:** mostly satin.
- **Grommets/bumper:** black.
- **Handle/butt:** black grip, black butt cap with the lime logo.
- **Sources:** https://www.tennis-warehouse.com/Babolat_Pure_Aero_2023/descpageRCBAB-BARO.html , https://www.tennis-warehouse.com/learning_center/racquet_reviews/BAROreview.html
- **Photos:** `pure-aero_2023_front.jpg`, `pure-aero_2023_throat.jpg`, `pure-aero_2023_head.jpg`

### Suggested DESIGNS entries
```js
// Pure Aero 2026 (current)
['PURE AERO', { base: '#5f7378', band: '#5f7378', throat: '#5f7378', head: 'oval' }],
// extras: side: '#c8fa3c'
// Pure Aero 2023 (previous)
['PURE AERO 2023', { base: '#3c3e40', band: '#3c3e40', throat: '#3c3e40', head: 'oval' }],
// extras: sideRight: '#d4ec66', sideLeft: '#c0c6cc'
```
Note: the main color has moved away from the "yellow frame" that the app draws today (`base: '#f5c400'`). The last mostly yellow Pure Aero was the 2019 generation. Since 2023 the frame has been dark (charcoal), and since 2026 slate grey. In both, yellow is the accent blocks, not the frame.

---

## PURE AERO RAFA

### Current (latest): Pure Aero Rafa 2023 (2nd Rafa edition, on the 2023 Pure Aero platform)
- **Release:** 2023. TW playtest review dated June 2023. Retailers list it as "Pure Aero Rafa (2023)". The exact launch day was not confirmed. TW code PARRA. A heavier pro-spec **Pure Aero Rafa Origin** (TW code BAROR, review June 2023) wears the same paint. No 2026-platform Rafa was found as of Oct 2026 (Nadal retired Nov 2024). If Babolat does release one, this entry needs updating.
- **Main frame:** multicolor, with neon yellow and hot pink as the two big colors.
  - Top of the head (10 to 2): neon yellow `#dcf074`.
  - On the right-hand side the yellow blends through a soft orange into pink around 2 o'clock. **Gradient.**
  - The 3 o'clock side: a solid sky-blue block `#70bcdc` from about 3 to 4, with pink below it.
  - The 9 o'clock side: a solid dark navy block `#3f4457` from about 8 to 9:30, edged in yellow.
  - Lower hoop and throat: hot pink `#f08cc0`.
- **Throat and shaft:** pink, with large yellow brush-stroke "AERO" letters and small blue/navy splashes. The lower shaft above the grip turns yellow (`#cceb83`).
- **Finish:** gloss (judged from photos).
- **Logo/text:** navy "Babolat" round the top of the head on the outer face. "FSI SPIN" on the side.
- **Stencil:** standard Babolat logo. TW's front shot shows it in black.
- **Grommets/bumper:** navy/black bumper and grommets.
- **Handle/butt:** black grip, black butt cap with the yellow Babolat wordmark.
- **Head shape:** oval (2023 Pure Aero mold).
- **Sources:** https://www.tennis-warehouse.com/learning_center/racquet_reviews/PARRAreview.html , https://www.tennis-warehouse.com/learning_center/racquet_reviews/BARORreview.html , https://www.babolat.com/us/news-articles-blog-tennis-pure-aero-rafa-origin/tennis-pure-aero-rafa-origin.html (Babolat: Origin colors "yellow, pink, dark blue and light blue", chosen by Nadal), https://tennisexpress.com/blogs/news/the-new-babolat-pure-aero-rafa-line
- **Photos:** `pure-aero-rafa_2023_front.jpg`, `pure-aero-rafa_2023_throat.jpg`, `pure-aero-rafa_2023_angle.jpg`, `pure-aero-rafa-origin_2023_front.jpg`

### Previous: Pure Aero Rafa (1st Rafa edition, retail March 2021; 2019 Pure Aero mold)
- **Release:** seen on Nadal from Roland Garros 2020. Retail launch 18 March 2021, delayed by the pandemic. Mechanically it is the 2019 Pure Aero in new paint (TennisNerd). TW code BPARR.
- **Main frame:** sunset gradient.
  - Top of the head: orange `#f37334` at about 10 to 12, blending to amber/yellow-orange `#eba303` at 12 to 2. **Gradient.**
  - The 3 o'clock side: a solid magenta block `#cc5599`, with amber either side.
  - The 9 o'clock side: a solid charcoal block `#3d3a3b` with orange above it.
  - Throat and lower hoop: lemon yellow `#d9d945`.
- **Throat and shaft:** lemon yellow, with large magenta "AERO" letters and a small "PURE". The shaft blends towards magenta/pink lower down.
- **Finish:** gloss (photo judgment).
- **Logo/text:** big charcoal "Babolat" on the orange outer face of the head. "CORTEX PURE FEEL" and "AEROMODULAR" on the side of the beam.
- **Stencil:** standard Babolat logo, black.
- **Grommets/bumper:** black.
- **Handle/butt:** black grip, black butt cap with a white Babolat wordmark.
- **Head shape:** oval (2019 Pure Aero mold).
- **Sources:** https://www.tennisnerd.net/gear/racquets/rafas-new-racquet-paint/23113 , https://tennisnow.com/Blogs/NET-POSTS/March-2021/Babolat-Launches-Pure-Aero-Rafa.aspx , https://www.tennisnerd.net/gear/racquets/the-babolat-pure-aero-rafa-collection/25784 , https://www.tennis-warehouse.com/learning_center/racquet_reviews/BPARRreview.html
- **Photos:** `pure-aero-rafa_2021_front.jpg`, `pure-aero-rafa_2021_throat.jpg`, `pure-aero-rafa_2021_angle.jpg`

### Suggested DESIGNS entries
```js
// Pure Aero Rafa 2023 (latest): yellow top, pink body, sky blue at 3, navy at 9
['PURE AERO RAFA', { base: '#f08cc0', band: '#dcf074', throat: '#f08cc0', head: 'oval' }],
// extras: sideRight: '#70bcdc', sideLeft: '#3f4457', shaftLow: '#cceb83'
// Pure Aero Rafa 2021 (previous): orange to amber top, yellow body, magenta at 3, charcoal at 9
['PURE AERO RAFA 2021', { base: '#d9d945', band: '#f08a2a', throat: '#d9d945', head: 'oval' }],
// extras: sideRight: '#cc5599', sideLeft: '#3d3a3b'
```
Catalog note: `designOf` matches with `name.includes(k)` and takes the first hit, so 'PURE AERO RAFA' and 'PURE AERO 98' must come before 'PURE AERO' in the table. Today all three get the generic Pure Aero paint.

---

## PURE DRIVE

### Current: Pure Drive 2025 (11th gen)
- **Release:** January 2025. TennisNerd first look is dated 3 Dec 2024 and says it calls this the 11th generation. TW code BPD25R.
- **Main frame:** light metallic sky blue `#6cadd0`. The lit side is `#8ec1e0`. It is paler and more pastel than the 2021.
- **Secondary color:** dark navy `#2b3445`.
  - Top of the head (about 10 to 2) is navy, and it **gradients** down into the light blue on each side.
  - Solid navy blocks sit at 3 and 9 o'clock, from about 2:30 to 4 and 8 to 9:30, both sides.
  - A thin red outline on some lettering, per Babolat retail copy ("metallic blue with a red outline on the lettering"). It is small and does not read from a distance.
- **Throat and shaft:** light blue, with large navy "DRIVE" letters down the shaft. The lower shaft is a deeper blue `#356684`.
- **Finish:** gloss metallic.
- **Logo/text:** "Babolat" in light blue on the navy outer face at the top of the head. "PURE DRIVE" and "NF2-TECH" small on the side.
- **Stencil:** standard Babolat logo, black.
- **Grommets/bumper:** navy/black.
- **Handle/butt:** black grip, black butt cap with a white Babolat wordmark.
- **Head shape:** oval, with the classic Pure Drive open throat and box-ish beam.
- **Variants:** Pure Drive Plus, Team, Lite, Super Lite and 107 2025 share this paint. Pure Drive Tour 2025 does too, as far as listings show (not visually confirmed).
- **Sources:** https://www.tennisnerd.net/?p=42376 , https://www.tennis-warehouse.com/Babolat_Pure_Drive_2025/descpageRCBAB-BPD25R.html , https://www.tennis-warehouse.com/learning_center/racquet_reviews/BPDWreview.html , https://www.centauro.com.br/raquete-de-tenis-babolat-purdriv2025-gen11-m16koi-mktp.html
- **Photos:** `pure-drive_2025_front.jpg`, `pure-drive_2025_throat.jpg`, `pure-drive_2025_head.jpg`

### Previous: Pure Drive 2021 (10th gen)
- **Release:** autumn 2020 (TW review September 2020), sold as "2021". TW code BRPDR.
- **Main frame:** saturated cyan-blue `#00a0d8`. Much brighter and more saturated than 2025.
- **Secondary color:** navy/near-black `#2d3446`, in solid hard-edged blocks.
  - Top of the head (10 to 2) is navy, with big cyan "Babolat" letters on the outer face.
  - Navy blocks sit at 9 o'clock (about 8 to 10) and at about 4 o'clock on the right, with cyan between.
- **Throat and shaft:** a deeper royal blue `#0064ac`, with navy graphic slashes ("DRIVE" letters, dark).
- **Finish:** gloss.
- **Logo/text:** cyan "Babolat" on navy round the top of the head. Small white tech text.
- **Stencil:** standard Babolat logo, black.
- **Grommets/bumper:** black.
- **Handle/butt:** black grip, black butt cap with a white Babolat wordmark.
- **Head shape:** oval.
- **Variants:** Pure Drive Tour 2021 and Plus share the paint. The Pure Drive 30th Anniversary (2024) is a different, retro paint and is not covered here.
- **Sources:** https://www.tennis-warehouse.com/learning_center/racquet_reviews/BRPDRreview.html
- **Photos:** `pure-drive_2021_front.jpg`, `pure-drive_2021_throat.jpg`, `pure-drive_2021_head.jpg`

### Suggested DESIGNS entries
```js
// Pure Drive 2025 (current): pale metallic blue, navy top fading down, navy blocks at 3 and 9
['PURE DRIVE', { base: '#6cadd0', band: '#2b3445', throat: '#6cadd0', head: 'oval' }],
// extras: side: '#2b3445', bandGradient: true
// Pure Drive 2021 (previous): bright cyan, navy top, navy blocks
['PURE DRIVE 2021', { base: '#00a0d8', band: '#2d3446', throat: '#0064ac', head: 'oval' }],
```

---

## PURE DRIVE 98

### Current: Pure Drive 98 2025 (2nd gen of the 98)
- **Release:** with the 2025 Pure Drive family, January 2025. TW code PD98R.
- **Paint:** the same scheme as Pure Drive 2025. Light metallic blue `#6ba9cc`, a navy top of the head `#2b3445` that gradients into the blue, and navy blocks at 3 and 9.
- **Telltale difference from the 100:** a **red-orange accent** (`#f0482c`) in the string groove and grommets across the top of the head, about 11 to 1 o'clock, plus red-tinted grommets there. Visible on the angled head photo.
- **Throat:** light blue with navy "DRIVE" letters.
- **Handle/butt:** black grip, black butt cap with a white wordmark.
- **Head shape:** oval, a slightly smaller and more elongated 98 hoop.
- **Sources:** https://www.tennis-warehouse.com/Babolat_Pure_Drive_98_2025/descpageRCBAB-PD98R.html
- **Photos:** `pure-drive-98_2025_front.jpg`, `pure-drive-98_2025_throat.jpg`, `pure-drive-98_2025_head.jpg`

### Previous: Pure Drive 98 2023 (1st gen of the 98)
- **Release:** 2023 (first Pure Drive 98). TW still sells a "Pure Drive 98 2023 2-Pack" (PD98X2). The single listing's image code is BRPD98. The exact month is not confirmed.
- **Main frame:** deeper royal/cobalt blue `#0a72b8`, darker than the Pure Drive 2021, with lighter cyan panels `#04aad4`.
- **Secondary:** navy `#2c2e3b`. The top of the head is navy, and navy/cyan blocks alternate down the sides (solid blocks).
- **Accents:** red. There is red in the string groove at the top of the head, small red marks round the head, and a **red Babolat wordmark on the butt cap** (`#bb072c`). The red butt cap is the quickest way to tell it apart.
- **Throat:** royal blue with navy slash graphics.
- **Finish:** gloss.
- **Handle/butt:** black grip, black butt cap with a red wordmark.
- **Head shape:** oval.
- **Sources:** https://www.tennis-warehouse.com/Babolat_Pure_Drive_98_2023_2-Pack/descpageRCBAB-PD98X2.html
- **Photos:** `pure-drive-98_2023_front.jpg`, `pure-drive-98_2023_throat.jpg`, `pure-drive-98_2023_head.jpg`

### Suggested DESIGNS entries
```js
// Pure Drive 98 2025 (current)
['PURE DRIVE 98', { base: '#6ba9cc', band: '#2b3445', throat: '#6ba9cc', head: 'oval' }],
// extras: topAccent: '#f0482c' (thin line at 11 to 1)
// Pure Drive 98 2023 (previous)
['PURE DRIVE 98 2023', { base: '#0a72b8', band: '#2c2e3b', throat: '#0a72b8', head: 'oval' }],
// extras: topAccent: '#d8283a', buttLogo: '#bb072c'
```
Order 'PURE DRIVE 98' before 'PURE DRIVE' in the table.

---

## PURE STRIKE 97

### Current: Pure Strike 97, 4th gen, Carbon Grey colorway (2025)
- **Release:** the 4th gen launched in early 2024 in white. In about August 2025 (around the US Open) Babolat moved the whole Pure Strike line to the "Carbon Grey" colorway mid-cycle, with identical specs. White stock is now gone from TW. TW code PS97SN.
- **Main frame:** a cool metallic mid-grey, about `#8c949a`. The lit side is `#a6aab0` and the shadowed side `#6b7480`.
- **Secondary color:** coral red `#f55e4c`, in two solid blocks per side at 3 and 9 o'clock (about 2:30 to 4 and 8 to 9:30), split by a thin grey gap. The top of the head (10 to 2) is grey, with no contrasting face band.
- **Throat and shaft:** plain grey, with faint tone-on-tone "STRIKE" letters.
- **Finish:** satin metallic.
- **Logo/text:** dark "Babolat" on the outer face at the top of the head. Small white/black tech text by the throat ("Babolat Pure Strike", "Engineered in France").
- **Stencil:** standard Babolat logo, black.
- **Grommets/bumper:** **black** bumper and outer groove all round the head (clear on the angled photo).
- **Handle/butt:** **tan/brown leather grip** `#ad5a2c`, with a brown butt cap and a gold Babolat wordmark. This is the 97's signature.
- **Head shape:** oval, a slightly squarer-shouldered 97 hoop. Hybrid beam: boxier at the top, rounder at the throat.
- **Sources:** https://www.tennis-warehouse.com/Babolat_Pure_Strike_97_Carbon_Grey/descpageRCBAB-PS97SN.html , https://www.tennisnerd.net/gear/racquets/babolat-pure-strike-carbon-grey/58571 , https://prod.tennis.com/news/articles/babolat-gives-the-pure-strike-a-makeover-with-carbon-grey-cosmetic
- **Photos:** `pure-strike-97_2025-carbon-grey_front.jpg`, `pure-strike-97_2025-carbon-grey_throat.jpg`, `pure-strike-97_2025-carbon-grey_angle.jpg`

### Same generation, launch colorway: Pure Strike 97 2024 (white)
This colorway is very common on court because it sold from early 2024 to mid-2025.
- **Main frame:** white `#ececea`.
- **Secondary:** coral red `#fb4a3e` in two blocks per side at 3 and 9, in the same places as Carbon Grey.
- **Top of head:** white face. The bumper and outer groove are black, with bold black "Babolat" on the outer face at 12 to 1.
- **Throat:** white, with faint grey/red "STRIKE" letters.
- **Handle/butt:** tan leather grip, with a brown butt cap and a gold wordmark.
- **TW code:** PS97S.
- **Sources:** https://www.tennis-warehouse.com/learning_center/racquet_reviews/PS97Sreview.html
- **Photos:** `pure-strike-97_2024_front.jpg`, `pure-strike-97_2024_throat.jpg`, `pure-strike-97_2024_angle.jpg`

### Previous: Pure Strike VS (2022), the 97's predecessor
TW's 97 review frames the 97 as replacing the VS ("From the VS to this Pure Strike 97..."). The 3rd-gen Pure Strike line had no 97.
- **Release:** early 2022 (TW review March 2022). TW codes PSVSIN (single) and PSVDOU (2-pack).
- **Main frame:** a dark smoked/bronze metallic `#4b4643`, which reads as brown-black.
- **Secondary:** red-orange `#fc4702` and white.
  - The 3 o'clock side has a red block (about 2 to 4).
  - The 9 o'clock side has a white block over a red block.
  - There is a red patch at about 12 to 1 on the top of the head.
  - All are solid blocks.
- **Throat:** smoke, with red/white "STRIKE VS" letters.
- **Finish:** gloss metallic.
- **Handle/butt:** tan leather grip `#cf7c46`, with a gold wordmark on the butt.
- **Head shape:** oval, 97.
- **Note:** an older 2017 Pure Strike VS (white/grey) exists. It is not this one.
- **Sources:** https://www.tennis-warehouse.com/learning_center/racquet_reviews/PSVDOUreview.html , https://www.tennis-warehouse.com/learning_center/racquet_reviews/PS97Dreview.html
- **Photos:** `pure-strike-vs_2022_front.jpg`, `pure-strike-vs_2022_throat.jpg`, `pure-strike-vs_2022_angle.jpg`

### Suggested DESIGNS entries
```js
// Pure Strike 97 Carbon Grey (current, 2025 colorway of 4th gen)
['PURE STRIKE 97', { base: '#8c949a', band: '#8c949a', throat: '#8c949a', head: 'oval' }],
// extras: side: '#f55e4c', bumper: '#1e1e1e', grip: '#ad5a2c' (leather)
// Pure Strike 97 2024 white (same gen, launch colorway; very common)
['PURE STRIKE 97 2024', { base: '#ececea', band: '#ececea', throat: '#ececea', head: 'oval' }],
// extras: side: '#fb4a3e', bumper: '#222222', grip: '#ad5a2c'
// Pure Strike VS 2022 (previous)
['PURE STRIKE VS', { base: '#4b4643', band: '#4b4643', throat: '#4b4643', head: 'oval' }],
// extras: sideRight: '#fc4702', sideLeft: '#f2f2f2' + '#fc4702', grip: '#cf7c46'
```

---

## PURE STRIKE 100 (and 98)

### Current: Pure Strike 100, 4th gen, Carbon Grey colorway (2025)
- **Release:** the 4th gen launched early 2024 (TW review April 2024). Carbon Grey colorway from about August 2025. TW codes PS1019 (16x19) and PS1020 (16x20).
- **Main frame:** metallic mid-grey `#8c949a`.
- **Secondary:** coral red `#f55e4c`, two blocks per side at 3 and 9 (about 2:30 to 4 and 8 to 9:30), solid. Grey top of head.
- **Throat:** plain grey.
- **Finish:** satin metallic.
- **Logo/text:** dark "Babolat" on the outer face at the top of the head. Small tech text by the throat.
- **Stencil:** standard Babolat logo, black.
- **Grommets/bumper:** black bumper and outer groove.
- **Handle/butt:** **white synthetic grip** `#dcdcd8`, with a white butt cap and a black Babolat wordmark. On the 98 Carbon Grey the grip is black.
- **Head shape:** oval, a fuller 100 hoop.
- **Sources:** https://www.tennis-warehouse.com/Babolat_Pure_Strike_100_Carbon_Grey/descpageRCBAB-PS1019.html , https://www.tennisnerd.net/gear/racquets/babolat-pure-strike-carbon-grey/58571
- **Photos:** `pure-strike-100_2025-carbon-grey_front.jpg`, `pure-strike-100_2025-carbon-grey_throat.jpg`, `pure-strike-100_2025-carbon-grey_angle.jpg`

### Same generation, launch colorway: Pure Strike 100 2024 (white)
- **Main frame:** white `#ececea`, with coral red `#fb4a3e` blocks at 3 and 9 (two per side).
- **Top of head:** white face. Black bumper/groove, with bold black "Babolat" on the outer face at 12 to 2.
- **Throat:** white, with faint red "STRIKE" letters.
- **Handle/butt:** white grip, with a white butt cap and a black wordmark.
- **TW code:** STRPS. The 2024 16x20 is PS1620.
- **Sources:** https://www.tennis-warehouse.com/learning_center/racquet_reviews/STRPSreview.html , https://www.tennis-warehouse.com/Babolat_Pure_Strike_100_16x20/descpageRCBAB-PS1620.html
- **Photos:** `pure-strike-100_2024_front.jpg`, `pure-strike-100_2024_throat.jpg`, `pure-strike-100_2024_angle.jpg`

### Previous: Pure Strike 100, 3rd gen (2019)
- **Release:** 2019 (TW review August 2019; the 3rd-gen 98 18x20 review is November 2019). TW code BPSTRI.
- **Main frame:** white `#e4e4e4`.
- **Secondary:** **asymmetric**, solid blocks.
  - The 3 o'clock side has a coral/red-orange block `#fd674f`.
  - The 9 o'clock side has a charcoal block `#474b4e`.
  - Across the top of the head, the outer rim on the right half (about 12 to 3) is red-orange, and the left half is black.
- **Throat and shaft:** white, with a stack of black and red stencil "STRIKE" letters down the shaft (a "barcode" look).
- **Finish:** gloss.
- **Logo/text:** black "Babolat" on the outer face at the top of the head.
- **Grommets/bumper:** black on the left/top, red-orange groove on the right outer edge.
- **Handle/butt:** white grip, with a white butt cap and a black wordmark.
- **Head shape:** oval.
- **Sources:** https://www.tennis-warehouse.com/learning_center/racquet_reviews/BPSTRIreview.html , https://www.tennis-warehouse.com/learning_center/racquet_reviews/PS182review.html
- **Photos:** `pure-strike-100_2019_front.jpg`, `pure-strike-100_2019_throat.jpg`, `pure-strike-100_2019_angle.jpg`

### Pure Strike 98 (note)
- **Current:** Carbon Grey (2025 colorway of the 2024 4th gen). Same paint as the 100, but with a black grip and black butt cap. TW codes PS9816 and PS9818. Photo: `pure-strike-98_2025-carbon-grey_front.jpg`.
- **Previous:** 3rd gen 98 18x20 / 16x19 (late 2019). Same asymmetric white/red/charcoal scheme as the 100 above. Photo: `pure-strike-98_2019_front.jpg`.

### Suggested DESIGNS entries
```js
// Pure Strike 100 Carbon Grey (current)
['PURE STRIKE 100', { base: '#8c949a', band: '#8c949a', throat: '#8c949a', head: 'oval' }],
// extras: side: '#f55e4c', bumper: '#1e1e1e', grip: '#dcdcd8'
// Pure Strike 100 2024 white (same gen, launch colorway)
['PURE STRIKE 100 2024', { base: '#ececea', band: '#ececea', throat: '#ececea', head: 'oval' }],
// extras: side: '#fb4a3e', bumper: '#222222', grip: '#dcdcd8'
// Pure Strike 100 3rd gen 2019 (previous)
['PURE STRIKE 100 2019', { base: '#e4e4e4', band: '#fd674f', throat: '#e4e4e4', head: 'oval' }],
// extras: sideRight: '#fd674f', sideLeft: '#474b4e', grip: '#e8e8e8'
```
Today the app's 'PURE STRIKE' entry has a white base, a black top band and a **red throat**. No recent Pure Strike has a red throat. On the current and 2024 frames the red sits at 3 and 9, and the throat is the frame color.

---

## Brand-wide signatures (what makes a Babolat read as a Babolat)

1. **Color blocks at 3 and 9 o'clock.** Almost every current Babolat puts its accent color in solid, hard-edged blocks on the sides of the hoop (lime on the Aero, navy on the Drive, coral on the Strike). The top of the head is usually the frame color or a darker shade. A contrasting band only at 10 to 2 is less typical of Babolat than side blocks.
2. **Big "Babolat" wordmark on the outer face of the head**, running round the top of the hoop from about 11 to 2. You see it from the side, not from the string-bed view.
3. **The Babolat string stencil:** two stacked, stepped "ladder" grids slanting to the right, nearly always in black. It is the easiest brand tell in a front view.
4. **The model name in giant letters down the throat/shaft** ("AERO", "DRIVE", "STRIKE"), often clipped or stylized.
5. **Black grip and black butt cap with the wordmark in the accent color** (lime on the Aero, white on the Drive, red on the Drive 98 2023). The exceptions are the Strike 97/VS (tan leather and gold) and the Strike 100 (white grip).
6. **Oval heads only.** No squared isometric heads. The shapes are rounded, teardrop-ish oval hoops with an open Y-throat. The Aero has a thin aero beam with deep side grooves.
7. **One saturated accent on a quiet base** in the modern paints (2023 onward): grey/charcoal plus lime, pale blue plus navy, grey/white plus coral. The Rafa editions are the deliberate exception, using multicolor gradients.
