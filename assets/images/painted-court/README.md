# Painted courtyard prototype

The original art direction is in `art/drill-mode-studies/`. These two production layers were generated with the built-in imagegen tool using `01-ink-and-crayon.png` as the reference. The originals are retained here without destructive edits.

- `courtyard.png`: clean background plate, 941 by 1672 pixels.
- `forehand-poses.png`: transparent four-pose player sheet, 2172 by 724 pixels. Poses have unequal widths; source rectangles and foot anchors are in `web/painted-court.js`.
- `prompts.json`: exact generation prompts and reference path.

## Run and rebuild

From the repository root:

```sh
node scripts/build-painted-court.mjs
node scripts/serve-painted-court.mjs
```

Open http://localhost:8097. The standalone page also works offline by opening `dist/painted-court/index.html`. The native app route is `/painted-court`, linked from the bottom of the existing drill screen. The generated HTML includes both images, so playing does not fetch remote artwork.

Hold the court to prepare, then release after the bounce as the ball approaches the player. Drag sideways before releasing to change the return direction. With a keyboard, hold/release Space and use the arrow keys to aim. Ten feeds complete a session; missed balls advance automatically. Sound starts muted and can be enabled. Pause freezes the simulation; changing tabs pauses it too.

## Implementation and limits

The Canvas 2D renderer uses the existing `web/lib/ballistics.js` module for launch, spin, net collision and bounce. Footwork is automatic; the return is assisted toward the selected landing direction. This is a timing-and-direction experiment, not a physical racket collision simulation. Four hand-drawn poses provide the first swing study; movement between feet positions still slides. The backdrop is fixed, and the net is redrawn independently for depth ordering. No bullseye targets are used.

This experiment does not replace the current drill or store scores. Its HTML is approximately 6.3 MB because the source PNGs are embedded without optimization. Native device performance and touch feel still need a hands-on review.

## Validation

`npx expo lint` and `npx tsc --noEmit` pass. Browser coverage includes a ten-feed session (nine in, one intentionally wide), early swings, missed feeds, pointer cancellation, pause/resume, restart, and 390 by 844, 320 by 568, and desktop layouts. The browser review script requires Playwright; use `PLAYWRIGHT_MODULE` to supply an existing installation without adding an app dependency.

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-painted-court.cjs
```

Review screenshots are saved under `art/drill-mode-studies/playable-review/`.
