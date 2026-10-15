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
