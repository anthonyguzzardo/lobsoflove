/** One finger stroke: x, y in page points and t in ms since the character's first touch. */
export type Stroke = [number, number, number][];

// PROTOTYPE ONLY: Google's handwriting input endpoint (the one behind Gboard/Translate handwriting).
// It is unofficial, sends ink off the phone, and can change without notice. Before shipping, swap this
// for on-device ML Kit Digital Ink (needs a development build, not Expo Go).
const URL = 'https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8';

/**
 * Reads one stacked character. Returns the recognizer's guesses, best first.
 * Throws when there is no signal; the caller shows "?" and keeps the ink.
 */
export async function recognizeChar(strokes: Stroke[], w: number, h: number, pre = ''): Promise<string[]> {
  const ink = strokes.map((s) => [s.map((p) => Math.round(p[0])), s.map((p) => Math.round(p[1])), s.map((p) => Math.round(p[2]))]);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        options: 'enable_pre_space',
        requests: [{ writing_guide: { writing_area_width: Math.round(w), writing_area_height: Math.round(h) }, ink, language: 'en', max_num_results: 8, max_completions: 0, pre_context: pre.slice(-20) }],
      }),
    });
    const json = (await res.json()) as [string, [string, string[]][]];
    if (json[0] !== 'SUCCESS') throw new Error(`recognizer: ${json[0]}`);
    return json[1]?.[0]?.[1] ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/** What layoutLine needs from each written piece: its strokes, or a flicked space. */
export type LinePiece = { space: true } | { space?: false; strokes: Stroke[] };

/**
 * Lays the pieces out side by side as one line of normal handwriting, the way the recognizer was trained (Google's
 * online model reads whole lines with a language model; Carbune et al., IJDAR 2020). Stacked letters were all written in
 * the same spot at the same size, so one shared scale keeps their relative size and height on the line: a comma stays
 * low and small, a dash stays in the middle. Only their left-right position changes.
 */
export function layoutLine(entries: LinePiece[]): { strokes: Stroke[]; w: number; h: number } | null {
  const pieces = entries.filter((e): e is { strokes: Stroke[] } => !e.space && e.strokes.length > 0);
  if (!pieces.length) return null;
  const all = pieces.flatMap((e) => e.strokes.flat());
  const top = Math.min(...all.map((p) => p[1]));
  const bottom = Math.max(...all.map((p) => p[1]));
  const span = Math.max(40, bottom - top);
  const scale = 120 / span;
  const gap = 18;
  const out: Stroke[] = [];
  let x = 10;
  let t = 0;
  for (const e of entries) {
    if (e.space) { x += 60; continue; }
    if (!e.strokes.length) continue;
    const left = Math.min(...e.strokes.flat().map((p) => p[0]));
    const right = Math.max(...e.strokes.flat().map((p) => p[0]));
    for (const s of e.strokes) out.push(s.map(([px, py, pt]) => [x + (px - left) * scale, 10 + (py - top) * scale, t + pt]));
    t = (out[out.length - 1]?.at(-1)?.[2] ?? t) + 300;
    x += (right - left) * scale + gap;
  }
  return { strokes: out, w: x + 10, h: 140 };
}

/** The four turns a phone (and its writer) can be at, in degrees clockwise. */
export const TURNS = [0, 90, 180, 270] as const;
export type Turn = (typeof TURNS)[number];

/**
 * Turns each piece's strokes by `deg` clockwise around the piece's own center. A piece written sideways comes out
 * upright: the right turn makes letters upright, and a word written across turns with them, so its letters run left
 * to right again.
 */
export function turnPiece(strokes: Stroke[], deg: Turn): Stroke[] {
  if (!deg) return strokes;
  const pts = strokes.flat();
  const cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
  const cy = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
  const r = (deg * Math.PI) / 180;
  const c = Math.round(Math.cos(r));
  const s = Math.round(Math.sin(r));
  return strokes.map((st) => st.map(([x, y, t]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c, t]));
}

/**
 * Picks the turn whose reading makes the most sense. `score` rates one reading (something loggable, real words);
 * readings of upside-down or sideways ink are rarely anything, so the upright turn usually wins clearly. The
 * recognizer's own agreement (several of its top guesses saying the same thing) breaks ties, and `prefer` (the turn
 * already locked in) gets a small edge so the angle does not flicker between reads.
 */
export function pickTurn(results: { turn: Turn; cands: string[] }[], score: (text: string) => number, prefer: Turn | null, preferBonus = 0.6): { turn: Turn; text: string; margin: number } | null {
  const bare = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rated = results
    .filter((r) => r.cands.length)
    .map((r) => {
      const top = r.cands[0].trim();
      const agree = r.cands.slice(1, 5).filter((c) => bare(c) === bare(top)).length;
      return { turn: r.turn, text: top, value: score(top) + agree * 0.4 + (r.turn === prefer ? preferBonus : 0) };
    })
    .sort((a, b) => b.value - a.value);
  if (!rated.length) return null;
  return { turn: rated[0].turn, text: rated[0].text, margin: rated[0].value - (rated[1]?.value ?? 0) };
}

/**
 * The turn (degrees clockwise that make the writer's letters upright on the portrait screen), from gravity in device
 * axes (x right, y toward the top edge, z out of the screen). null when the phone is near flat: lying on a table,
 * gravity says nothing about where the writer is, so the writing decides instead.
 *
 * `down` is the direction gravity pulls, in device axes. iOS reports accelerationIncludingGravity as gravity itself
 * (upright: y = -9.8); Android reports the reaction (upright: y = +9.8). `flip` corrects the sign if a device
 * disagrees (src/app/ink.tsx learns it when the writing clearly reads 180 degrees from the sensor).
 */
export function turnFromGravity(x: number, y: number, z: number, os: string, flip = false): Turn | null {
  const sign = (os === 'ios' ? 1 : -1) * (flip ? -1 : 1);
  const dx = x * sign;
  const dy = y * sign;
  const g = Math.hypot(x, y, z) || 1;
  if (Math.hypot(dx, dy) < g * 0.5) return null; // more than ~60 degrees from upright: flat enough to ignore
  // The writer's up, in screen axes (x right, y down): opposite of gravity, with the device's y flipped.
  const ux = -dx;
  const uy = dy;
  const a = (Math.atan2(uy, ux) * 180) / Math.PI; // -90 is the top of the screen
  const turn = (((Math.round((-90 - a) / 90) * 90) % 360) + 360) % 360;
  // Only commit near an axis (within 30 degrees); in between, keep whatever was there.
  const off = Math.abs(((((-90 - a) - turn) % 360) + 540) % 360 - 180);
  return off <= 30 ? (turn as Turn) : null;
}

