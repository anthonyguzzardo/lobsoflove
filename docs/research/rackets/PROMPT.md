Redraw the rackets in /gear so each one looks like the real frame, current and previous generation.

READ FIRST
- docs/research/rackets/README.md: the index and the cross-brand problems.
- docs/research/rackets/<brand>.md: per model, per generation, the colors, where they sit on the hoop, the finish, the grip, the butt cap, the wordmark and the head shape, with suggested DESIGNS entries at the end of each model.
- docs/research/rackets/photos/<brand>/: product photos named <model>_<gen>_<view>.jpg. Open the photos for each racket before you paint it. The photos are the source of truth. Where a write-up and a photo disagree, go with the photo.

THE CODE
- web/lib/gear-catalog.js: RACKETS (what can be picked), PAINT (a flat fallback) and DESIGNS plus designOf (the paint per model line).
- web/domain.js: paintFrame(d) (about line 820) paints a 512x4 strip that wraps the hoop. Today it only knows base, a throat-colored end at each side, and one band across the top. dress() (about line 878) applies the design, swaps the head geometry for 'iso' or 'oval', and sets the throat color. buildRacket and headGeos build the frame.
- After editing web/, rebuild with: node scripts/build-case-web.mjs  (this regenerates src/generated/domain-html.ts). Never hand-edit src/generated/.

WHAT TO FIX
1. Extend the design schema and paintFrame so it can show what real frames have. Most frames now put the second color in side blocks, not a band across the top (Babolat at 3 and 9 o'clock, Head on one side at about 1 to 4, Dunlop on the upper left only). Merge the keys the brand files suggest into one schema: side color plus a clock range for where it sits, shaft, grip, butt cap, wordmark color, and gloss or matte finish. Keep base, band, throat and head working.
2. Fix designOf matching. It takes the first substring hit, so PURE AERO RAFA, PURE AERO 98, PURE DRIVE 98 and VCORE PRO all get their generic family's paint. Match the longest key first, and make sure a short key like TOUR cannot match the wrong racket.
3. Replace every DESIGNS entry with the researched current-generation look. Add real entries for Tecnifibre, Dunlop and Prince, which today only get one flat, mostly wrong color.
4. Store the previous-generation look for each model as well. If you add a way to pick the generation, it must not be a text form. Use the existing circle-pick or slide-strip style, and default to the current generation.
5. Grip and butt cap color carry a lot of each racket's look (for example, the white grips on the Yonex VCORE and EZONE and the Head Speed, and the tan leather on the Pro Staff Classic and the Pure Strike 97). Paint them if the model has those parts. If it doesn't, add them in the same toon and ink style.

HOW TO WORK
- Go one brand at a time. After each brand, render stills of every racket in it and compare them side by side with its photos. Keep fixing until a tennis player would name the racket on sight.
- Keep the existing toon and ink art style. You are matching the colors and their placement, not making photoreal renders.
- The held racket must never be cut off. Test the stills with fake phone insets.

RULES
- No emojis anywhere.
- Don't remove any existing UI without asking. Compact it instead.
- No single colored left-stripe accents.
- No text-field forms.
- Run npx expo lint and npx tsc --noEmit before you call it done.

When you finish, report the schema you settled on, any racket that still doesn't read right and why, and where the before and after stills are.
