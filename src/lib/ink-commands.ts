// Written commands: "change fighter to servebot", "color red", "call me anthony", "court balboa", "undo last match",
// "open standings". Each one becomes a card the player confirms with a check, like a match or a gear entry.
// Pure: no React Native imports, so scripts/test-ink.ts can run it.
import type { Answers, Card, Question } from '@/lib/ink-parse';
import { sim } from '@/lib/ink-parse';
import { CAST, CAST_IDS, COLORS, type CastId, type Fighter } from '@/lib/roster';

export type Page = 'home' | 'standings' | 'courts' | 'fighter' | 'gear' | 'case';
export type Command =
  | { kind: 'cast'; cast: CastId }
  | { kind: 'color'; color: string; word: string }
  | { kind: 'name'; name: string }
  | { kind: 'court'; id: string; name: string; home: boolean }
  | { kind: 'undo'; matchId: string }
  | { kind: 'open'; page: Page };

export type Venue = { id: string; name: string };
export type Ctx = { roster: Fighter[]; venues: Venue[]; lastMatch: { id: string; label: string } | null };

const COLOR_WORDS: Record<string, string> = {
  yellow: COLORS[0], lime: COLORS[0], ball: COLORS[0], pink: COLORS[1], blue: COLORS[2], cyan: COLORS[2], orange: COLORS[3],
  purple: COLORS[4], violet: COLORS[4], green: COLORS[5], red: COLORS[6], white: COLORS[7], cream: COLORS[7],
};
const PAGES: Record<string, Page> = {
  home: 'home', standings: 'standings', table: 'standings', season: 'standings', courts: 'courts', court: 'courts',
  fighter: 'fighter', gear: 'gear', closet: 'gear', play: 'case', opponents: 'case',
};

/** Best fuzzy match of `said` among labelled options; null when nothing is close. Ties come back as a question. */
function closest<T extends string>(said: string, options: { value: T; names: string[] }[]): { value: T; score: number }[] {
  const s = said.replace(/\s+/g, '');
  return options
    .map((o) => ({ value: o.value, score: Math.max(...o.names.map((n) => sim(s, n.replace(/\s+/g, '')))) }))
    .sort((a, b) => b.score - a.score);
}

const castNames = (c: CastId) => {
  const label = CAST[c].label.toLowerCase();
  return [label, label.replace(/^the /, ''), c];
};

function pickOne<T extends string>(ranked: { value: T; score: number }[], label: (v: T) => string, prompt: string, answers: Answers): { value: T | null; question: Question | null } {
  if (answers.pick && ranked.some((r) => r.value === answers.pick)) return { value: answers.pick as T, question: null };
  const top = ranked[0];
  if (!top || top.score < 0.55) return { value: null, question: null };
  const close = ranked.filter((r) => top.score - r.score < 0.08 && r.score >= 0.55);
  if (close.length === 1) return { value: top.value, question: null };
  return { value: null, question: { field: 'pick', prompt, options: close.slice(0, 3).map((r) => ({ label: label(r.value), value: r.value })) } };
}

const card = (text: string, lines: string[], cmd: Command | null, question: Question | null = null): Card => ({
  text, lines, questions: question ? [question] : [], warn: null, canSave: !!cmd && !question, draft: cmd ? { kind: 'command', cmd } : { kind: 'none' },
});

/** Reads a command, or returns null when the text is not one (then it is read as a match or gear). */
export function parseCommand(text: string, ctx: Ctx, answers: Answers = {}): Card | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  let m: RegExpMatchArray | null;

  // Fighter: "change fighter to servebot", "make me the junkballer", "i'm serve bot", "be the wall".
  if ((m = t.match(/ (?:change|switch|set) (?:my )?(?:fighter|character|style|player) (?:to |into )?(.+)| make me (?:a |an |the )?(.+)| (?:i'?m|i am) (?:a |an |the )?(.+)| be (?:a |an |the )?(.+)| fighter (.+)/))) {
    const said = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]).trim();
    const ranked = closest(said, CAST_IDS.map((c) => ({ value: c, names: castNames(c) })));
    const { value, question } = pickOne(ranked, (c) => CAST[c].label.toUpperCase(), `which one is "${said}"?`, answers);
    if (value) return card(text, ['CHANGE FIGHTER', CAST[value].label.toUpperCase(), `"${CAST[value].tagline}"`], { kind: 'cast', cast: value });
    if (question) return card(text, ['CHANGE FIGHTER', '?'], null, question);
    return card(text, ['CHANGE FIGHTER', `no fighter called "${said}"`, 'try serve bot, the wall, moonballer'], null);
  }

  // Color: "color red", "make my color blue", "change color to pink".
  if ((m = t.match(/ colou?r (?:to )?([a-z]+)/))) {
    const word = m[1];
    const ranked = closest(word, Object.keys(COLOR_WORDS).map((w) => ({ value: w, names: [w] })));
    const hit = ranked[0] && ranked[0].score >= 0.6 ? ranked[0].value : null;
    if (hit) return card(text, ['CHANGE COLOR', hit.toUpperCase()], { kind: 'color', color: COLOR_WORDS[hit], word: hit });
    return card(text, ['CHANGE COLOR', `no color called "${word}"`, 'try red, blue, green, pink, orange, purple, yellow'], null);
  }

  // Name: "call me anthony", "rename me to ace", "my name is ...", "change name to ...".
  if ((m = t.match(/ call me (.+)| rename me (?:to )?(.+)| my name is (.+)| (?:change|set) (?:my )?name (?:to )?(.+)/))) {
    const name = (m[1] ?? m[2] ?? m[3] ?? m[4]).trim().toUpperCase().slice(0, 16);
    return card(text, ['CHANGE NAME', name], { kind: 'name', name });
  }

  // Court: "court balboa", "playing at linda vista", "home court north park".
  if ((m = t.match(/ (home )?court (?:is |to )?(.+)| (?:playing|play) at (.+)/))) {
    const home = !!m[1];
    const said = (m[2] ?? m[3]).trim();
    const ranked = closest(said, ctx.venues.map((v) => ({ value: v.id, names: [v.name.toLowerCase(), v.name.toLowerCase().split(' ')[0]] })));
    const name = (id: string) => ctx.venues.find((v) => v.id === id)?.name ?? id;
    const { value, question } = pickOne(ranked, name, `which court is "${said}"?`, answers);
    if (value) return card(text, [home ? 'HOME COURT' : 'PLAYING AT', name(value).toUpperCase()], { kind: 'court', id: value, name: name(value), home });
    if (question) return card(text, [home ? 'HOME COURT' : 'PLAYING AT', '?'], null, question);
    if (PAGES[said]) return null;
    return card(text, ['COURT', `no court called "${said}"`], null);
  }

  // Undo: "undo", "undo last match", "delete last match".
  if (/ (?:undo|delete|remove|scratch) (?:the )?(?:last )?(?:match|game)? ?$| undo /.test(t)) {
    if (!ctx.lastMatch) return card(text, ['UNDO', 'no matches to undo'], null);
    return card(text, ['DELETE LAST MATCH', ctx.lastMatch.label], { kind: 'undo', matchId: ctx.lastMatch.id });
  }

  // Go somewhere: "open standings", "go to gear", "show courts".
  if ((m = t.match(/ (?:open|go to|goto|show|take me to) (?:the |my )?([a-z]+)/))) {
    const ranked = closest(m[1], Object.keys(PAGES).map((w) => ({ value: w, names: [w] })));
    if (ranked[0] && ranked[0].score >= 0.6) {
      const page = PAGES[ranked[0].value];
      return card(text, ['OPEN', page.toUpperCase()], { kind: 'open', page });
    }
  }
  return null;
}
