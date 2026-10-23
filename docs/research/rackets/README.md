# Racket paint reference

What each racket in `web/lib/gear-catalog.js` really looks like, current and previous generation, researched 2026-10-23.
Each brand file has per-model notes, source links, photo filenames, and suggested DESIGNS entries per generation.

| Brand | File | Photos |
|---|---|---|
| Babolat | babolat.md | photos/babolat (51) |
| Wilson | wilson.md | photos/wilson (44) |
| Head | head.md | photos/head (64) |
| Yonex | yonex.md | photos/yonex (31) |
| Tecnifibre | tecnifibre.md | photos/tecnifibre (20) |
| Dunlop | dunlop.md | photos/dunlop (20) |
| Prince | prince.md | photos/prince (14) |

Photos are git-ignored (local only, about 17MB). Filenames: `<model>_<generation>_<view>.jpg`. All are Tennis Warehouse product shots, checked by eye.
Hex values are sampled from studio photos: close, not exact. Metallic paints are the least reliable.

## What the current DESIGNS table gets wrong, across brands

1. **The band over the top is rare now.** Most frames put the second color in blocks at the sides (Babolat at 3 and 9, Head on one side about 1 to 4, Dunlop on the upper left only). The schema needs a side color and where it sits.
2. **Key order bug.** `designOf` takes the first substring match, so PURE AERO RAFA, PURE AERO 98 and PURE DRIVE 98 get the generic paint, and VCORE also matches VCORE PRO. List specific keys before generic ones, or match longest key first.
3. **Missing brands.** Tecnifibre, Dunlop and Prince only have a flat PAINT color, and most of those are wrong (Tecnifibre is white-based, the Dunlop CX is red, the Prince lines fall back to cream).
4. **Grip and butt cap carry a lot of the look** (white grips on the Yonex VCORE and EZONE and on the Head Speed, the tan leather grip on the Pro Staff Classic and the Pure Strike 97).

## Optional keys the brand files suggest

The brand files use slightly different names for these; merge them into one schema.

- `side` / `accent`: the second color in side blocks.
- `sideArc` / `accentAt` / `bandAt`: where that color sits on the hoop, as a clock range.
- `shaft`: the color between throat and handle, if it differs.
- `grip`: the handle wrap color.
- `cap`: the butt cap color.
- `text`: the wordmark color.
- `finish`: 'gloss' | 'matte'.
