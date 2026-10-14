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
