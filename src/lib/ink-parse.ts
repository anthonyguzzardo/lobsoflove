// Turns stacked finger-written characters into something to log: a match, a gear entry, or a question.
// Pure: no React Native imports, so scripts/test-ink.ts can run it under tsx.
import type { Fighter } from '@/lib/roster';

export type SetScore = [number, number];

/** One written character as the recognizer saw it (best guess first), or a flicked space. */
export type Slot = { space: true } | { space?: false; cands: string[] };

// ─── Decoding: pick one character per slot ─────────────────────────────────────

/** Shapes a finger makes the same way. Digits and letters swap depending on what is around them. */
const LOOKALIKE: Record<string, string> = {
  o: '0', O: '0', D: '0', '0': 'o', l: '1', I: '1', i: '1', '|': '1', '/': '1', '1': 'l', s: '5', S: '5', '5': 's',
  b: '6', G: '6', '6': 'b', g: '9', q: '9', '9': 'g', z: '2', Z: '2', '2': 'z', B: '8', '8': 'b', T: '7', '7': 't',
  '_': '-', '~': '-', '—': '-', '–': '-', '.': ',', ',': '-', '¥': '4', y: '4', '4': 'y', A: '4', $: 's',
};

const WORDS = [
  'beat', 'won', 'win', 'w', 'def', 'over', 'vs', 'v', 'lost', 'lose', 'loss', 'l', 'to', 'against', 'with',
  'at', 'pm', 'am', 'past', 'after', 'quarter', 'half', 'today', 'yesterday', 'tonight', 'last', 'night',
  'lasted', 'hr', 'hrs', 'h', 'min', 'mins', 'm', 'match', 'played', 'i', 'my', 'got', 'new', 'for', 'and',
  'restring', 'restrung', 'strings', 'string', 'regrip', 'regripped', 'grip', 'overgrip', 'overgrips',
  'racket', 'racquet', 'shoes', 'balls', 'cost', 'paid', 'bucks',
];

const isDigit = (c: string) => c >= '0' && c <= '9';
const isLetter = (c: string) => /[a-z]/i.test(c);
type Cls = 'D' | 'L' | 'P' | '$' | 'S';
const cls = (c: string): Cls => (c === ' ' ? 'S' : isDigit(c) ? 'D' : isLetter(c) ? 'L' : c === '$' ? '$' : 'P');

/** Cost of one class following another. Scores keep digits and dashes together; words keep letters together. */
function hop(a: Cls | null, b: Cls): number {
  if (a === null || a === 'S' || b === 'S') return 0;
  if (a === b) return a === 'P' ? 1.5 : 0;
  if ((a === 'D' && b === 'P') || (a === 'P' && b === 'D') || (a === '$' && b === 'D')) return 0;
  if (a === 'D' && b === 'L') return 0.8; // 814pm, 6-4w
  if (a === 'L' && b === 'D') return 1.0;
  if (a === 'P' && b === 'L') return 1.5; // a letter right after a dash is almost always a misread digit
  return 1.0;
}

type Beam = { text: string; cost: number; run: string };

function runCost(run: string, prefixes: Set<string>): number {
  return run && !prefixes.has(run) ? 0.6 : 0;
}

/**
 * Picks the most plausible string. Each slot offers the recognizer's guesses plus their lookalikes;
 * a small beam search prefers runs of digits and dashes, runs of letters, and words it knows
 * (tennis words plus the roster's names). Without flicked spaces, it breaks letter runs at known words.
 */
export function decode(slots: Slot[], names: string[] = []): string {
  const vocab = new Set([...WORDS, ...names.flatMap((n) => n.toLowerCase().split(/\s+/)).filter(Boolean)]);
  const prefixes = new Set<string>();
  for (const w of vocab) for (let i = 1; i <= w.length; i++) prefixes.add(w.slice(0, i));

  let beams: Beam[] = [{ text: '', cost: 0, run: '' }];
  for (const slot of slots) {
    if (slot.space) {
      beams = beams.map((b) => ({ text: b.text.trimEnd() + ' ', cost: b.cost + (b.run && !vocab.has(b.run) ? 0.3 : 0), run: '' }));
      continue;
    }
    const opts = new Map<string, number>();
    const singles = slot.cands.map((c) => c.trim()).filter((c) => c.length === 1);
    const list = singles.length ? singles : slot.cands.map((c) => c.trim()[0]).filter(Boolean);
    list.slice(0, 6).forEach((c, i) => {
      if (!opts.has(c) || opts.get(c)! > i) opts.set(c, i);
      const alt = LOOKALIKE[c];
      if (alt && (!opts.has(alt) || opts.get(alt)! > i + 1.6)) opts.set(alt, i + 1.6);
    });
    if (!opts.size) continue;
    const next: Beam[] = [];
    for (const b of beams) {
      const prev = b.text.length ? cls(b.text[b.text.length - 1]) : null;
      for (const [raw, base] of opts) {
        const c = isLetter(raw) ? raw.toLowerCase() : raw;
        const k = cls(c);
        const step = base + hop(prev, k);
        if (k === 'L') {
          // Extend the current word, or (when it is already a whole known word) start a new one.
          const run = b.run + c;
          next.push({ text: b.text + c, cost: b.cost + step + runCost(run, prefixes), run });
          if (b.run && vocab.has(b.run)) next.push({ text: b.text + ' ' + c, cost: b.cost + step + (b.run.length === 1 ? 0.8 : 0.25) + runCost(c, prefixes), run: c });
        } else {
          // Leaving a letter run that is not a whole word: it was probably a misread digit.
          next.push({ text: b.text + c, cost: b.cost + step + (b.run && !vocab.has(b.run) ? 0.5 : 0), run: '' });
        }
      }
    }
    next.sort((a, b) => a.cost - b.cost);
    beams = next.slice(0, 48);
  }
  // A word left unfinished at the end costs a little more than one that completes.
  const end = beams.map((b) => ({ ...b, cost: b.cost + (b.run && !vocab.has(b.run) ? 0.5 : 0) }));
  end.sort((a, b) => a.cost - b.cost);
  return (end[0]?.text ?? '').replace(/\s+/g, ' ').trim();
}

// ─── Parsing: what the text means ──────────────────────────────────────────────

export type Question = { field: 'opp'; prompt: string; options: { label: string; value: string }[] };
export type Answers = { opp?: string };

export type MatchDraft = { kind: 'match'; opp: string | null; sets: SetScore[]; won: boolean | null; playedAt: number; minutes: number | null; when: string };
export type GearDraft = { kind: 'gear'; item: string; cost: number | null; at: number; when: string };
export type Draft = MatchDraft | GearDraft | { kind: 'none' };

/** What gets drawn back: the lines, any open question, and whether a check mark may save it. */
export type Card = { text: string; lines: string[]; questions: Question[]; warn: string | null; canSave: boolean; draft: Draft };

const GEAR: [RegExp, string][] = [
  [/\b(re-?strung|re-?string|strings?|strung)\b/, 'RESTRING'],
  [/\b(re-?gripp?(ed)?|re-?grip|grip)\b/, 'REGRIP'],
  [/\bovergrips?\b/, 'OVERGRIP'],
  [/\bracq?u?et\b/, 'RACKET'],
  [/\bshoes?\b/, 'SHOES'],
  [/\bballs?\b/, 'BALLS'],
];
const WIN = /\b(beat|won|win|w|def|defeated|over)\b/;
const LOSE = /\b(lost|lose|loss|l)\b|\blost to\b/;

/** A finished set: 6–0…6–4, 7–5, 7–6, or a match tiebreak to 10 (last set only). */
export function validSet([a, b]: SetScore, last: boolean): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 6) return lo <= 4;
  if (hi === 7) return lo === 5 || lo === 6;
  return last && hi >= 10 && hi - lo >= 2 && (hi === 10 || hi - lo === 2);
}

function clock(h: number, m: number, ampm: string | undefined, now: Date): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  if (ampm) {
    d.setHours((h % 12) + (ampm === 'pm' ? 12 : 0), m);
    if (d.getTime() > now.getTime() + 3600e3) d.setDate(d.getDate() - 1);
    return d;
  }
  // No am/pm: the most recent of the two that has already happened (a match you are logging is in the past).
  const options = [h % 12, (h % 12) + 12].map((hh) => {
    const x = new Date(d);
    x.setHours(hh, m);
    if (x.getTime() > now.getTime() + 3600e3) x.setDate(x.getDate() - 1);
    return x;
  });
  return options.sort((x, y) => y.getTime() - x.getTime())[0];
}

/** Pulls a time and a duration out of the text, and returns the text with them removed. */
export function takeTime(text: string, now: Date): { rest: string; at: Date | null; minutes: number | null } {
  let rest = ` ${text} `;
  let at: Date | null = null;
  let minutes: number | null = null;
  const cut = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (m) { fn(m); rest = rest.replace(m[0], ' '); }
  };
  cut(/\blasted\s*(\d+)\s*(?:h|hr|hrs|hour|hours)\s*(\d+)?\s*(?:m|min|mins)?\b/, (m) => { minutes = Number(m[1]) * 60 + Number(m[2] ?? 0); });
  cut(/\b(\d+)\s*(?:h|hr|hrs)\s*(\d+)\s*(?:m|min|mins)?\b/, (m) => { minutes = Number(m[1]) * 60 + Number(m[2]); });
  cut(/\blasted\s*(\d+)\s*(?:m|min|mins)\b|\b(\d+)\s*(?:min|mins)\b/, (m) => { minutes = Number(m[1] ?? m[2]); });
  cut(/\b(\d+)\s*(?:hrs?|hours?)\b/, (m) => { minutes = Number(m[1]) * 60; });
  if (rest.includes('yesterday')) { rest = rest.replace('yesterday', ' '); now = new Date(now.getTime() - 86400e3 + 1); }
  cut(/\b(quarter|half|\d{1,2})\s*(?:past|after)\s*(\d{1,2})\s*(am|pm)?/, (m) => {
    const mins = m[1] === 'quarter' ? 15 : m[1] === 'half' ? 30 : Number(m[1]);
    at = clock(Number(m[2]), mins, m[3], now);
  });
  cut(/(?:@|\bat)?\s*\b(\d{1,2}):?(\d{2})\s*(am|pm)\b/, (m) => { at = clock(Number(m[1]), Number(m[2]), m[3], now); });
  cut(/(?:@|\bat)?\s*\b(\d{1,2})\s*(am|pm)\b/, (m) => { at = clock(Number(m[1]), 0, m[2], now); });
  cut(/(?:@|\bat)\s*(\d{1,2}):?(\d{2})?\b/, (m) => { at = clock(Number(m[1]), Number(m[2] ?? 0), undefined, now); });
  return { rest: rest.trim(), at, minutes };
}

/** Score digits in writing order. Single digits pair up; a two-digit 10+ is a match tiebreak. */
export function takeSets(text: string): { sets: SetScore[]; odd: boolean } {
  const nums: number[] = [];
  for (const tok of text.match(/\d+/g) ?? []) {
    const n = Number(tok);
    if (tok.length === 2 && n >= 10 && n <= 20) nums.push(n);
    else for (const d of tok) nums.push(Number(d));
  }
  const sets: SetScore[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) sets.push([nums[i], nums[i + 1]]);
  return { sets, odd: nums.length % 2 === 1 };
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}
const sim = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);

/** Every roster fighter scored against the words that are not tennis words. */
export function matchNames(text: string, roster: Fighter[]): { word: string | null; ranked: { id: string; name: string; score: number }[] } {
  const words = (text.match(/[a-z]+/g) ?? []).filter((w) => w.length >= 2 && !WORDS.includes(w));
  const word = words.sort((a, b) => b.length - a.length)[0] ?? null;
  const ranked = roster.filter((f) => !f.isYou).map((f) => {
    const name = f.name.toLowerCase();
    const parts = [name, name.replace(/\s+/g, ''), ...name.split(/\s+/)];
    let score = 0;
    for (const w of words) for (const p of parts) score = Math.max(score, sim(w, p));
    return { id: f.id, name: f.name, score };
  });
  ranked.sort((a, b) => b.score - a.score);
  return { word, ranked };
}

const when = (d: Date, now: Date) => {
  const day = d.toDateString() === now.toDateString() ? 'today' : d.toDateString() === new Date(now.getTime() - 86400e3).toDateString() ? 'yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const h = d.getHours();
  return `${day} ${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/** Reads decoded text into a card. `answers` holds what the person circled on earlier questions. */
export function parse(text: string, roster: Fighter[], answers: Answers = {}, now = new Date()): Card {
  const t = text.toLowerCase().replace(/[–—]/g, '-');
  const timed = takeTime(t, now);
  const { at, minutes } = timed;
  // Money is never a score: "$28" must not become a 2-8 set.
  const money = timed.rest.match(/\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:\$|bucks|dollars)/);
  const rest = money ? timed.rest.replace(money[0], ' ') : timed.rest;
  const { sets: raw, odd } = takeSets(rest);
  const time = at ?? now;
  const base = { text, questions: [] as Question[], warn: null as string | null };

  // Gear: a gear word and no real score ("restring 28" is a price, not a set).
  const gear = GEAR.find(([re]) => re.test(t));
  const bare = rest.match(/\d+(?:\.\d{1,2})?/);
  if (gear && !raw.some((x, i) => validSet(x, i === raw.length - 1))) {
    const cost = money ? Number(money[1] ?? money[2]) : bare ? Number(bare[0]) : null;
    return { ...base, lines: [`${gear[1]}${cost !== null ? `  $${cost}` : ''}`, when(time, now)], canSave: true, draft: { kind: 'gear', item: gear[1], cost, at: time.getTime(), when: when(time, now) } };
  }
  if (!raw.length) {
    return { ...base, lines: [text ? `"${text}"` : '', 'not a score or gear yet', 'keep writing'], canSave: false, draft: { kind: 'none' } };
  }

  // Orient the sets: the writer's own games first, unless a win/lose word says otherwise.
  let sets = raw;
  const said: boolean | null = WIN.test(t) ? true : LOSE.test(t) ? false : null;
  const tally = (s: SetScore[]) => s.reduce((n, [a, b]) => n + (a > b ? 1 : b > a ? -1 : 0), 0);
  if (said !== null && Math.sign(tally(sets)) === (said ? -1 : 1)) sets = sets.map(([a, b]) => [b, a]);
  const lead = tally(sets);
  const won = lead === 0 ? null : lead > 0;
  const bad = sets.findIndex((s, i) => !validSet(s, i === sets.length - 1));

  // Opponent: the closest roster name, a question when two are close, or a question when none fit.
  const { word, ranked } = matchNames(rest, roster);
  let opp = answers.opp ?? null;
  if (!opp) {
    const top = ranked[0];
    const close = ranked.filter((r) => top && r.score >= 0.72 && top.score - r.score < 0.08);
    if (top && top.score >= 0.72 && close.length === 1) opp = top.id;
    else {
      const pool = (close.length > 1 ? close : ranked).slice(0, 3);
      base.questions.push({ field: 'opp', prompt: word ? `who's "${word}"?` : 'who did you play?', options: pool.map((r) => ({ label: r.name, value: r.id })) });
    }
  }
  const oppName = roster.find((f) => f.id === opp)?.name ?? '?';

  if (odd) base.warn = 'one score is missing a number';
  else if (bad >= 0) base.warn = `set ${bad + 1} (${sets[bad][0]}-${sets[bad][1]}) isn't a finished set`;
  else if (won === null) base.warn = 'sets are tied: no winner yet';

  const lines = [
    `${won === null ? '?' : won ? 'W' : 'L'}  vs ${oppName}`,
    sets.map(([a, b]) => `${a}-${b}`).join('  '),
    `${when(time, now)}${minutes ? ` · ${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60 ? `${minutes % 60}m` : ''}`.trimEnd() : ''}`,
  ];
  return {
    ...base,
    lines,
    canSave: !!opp && won !== null && !base.warn,
    draft: { kind: 'match', opp, sets, won, playedAt: time.getTime(), minutes, when: when(time, now) },
  };
}
