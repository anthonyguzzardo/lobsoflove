// How a tennis score works, for the scoreboard on the fence (web/score.js) and the match screen. Pure: no React Native imports,
// so the page bundles it and scripts/test-season.ts runs it.

export type SetScore = [number, number];

/** A set as it stands. `open` is still being played; `bad` can't happen in tennis (9-2, 7-3, 13-10 in a breaker). */
export type SetState = 'open' | 'p1' | 'p2' | 'bad';

/** Highest a plate goes: a set stops at 7, a match tiebreak runs on past 10 for as long as nobody is 2 clear. */
export const SET_MAX = 7;
export const MTB_MAX = 30;

/** A regular set: 6 with a 2-game lead, or 7-5, or 7-6 after the breaker. A match tiebreak: first to 10, by 2. */
export function setState([a, b]: SetScore, matchTiebreak = false): SetState {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const lead: SetState = a > b ? 'p1' : 'p2';
  if (matchTiebreak) {
    if (hi < 10) return 'open';
    if (hi === 10) return hi - lo >= 2 ? lead : 'open';
    return hi - lo === 2 ? lead : hi - lo < 2 ? 'open' : 'bad';
  }
  if (hi > 7) return 'bad';
  if (hi === 7) return lo === 5 || lo === 6 ? lead : 'bad';
  if (hi === 6) return lo <= 4 ? lead : 'open';
  return 'open';
}

export type MatchState = {
  /** Sets each side has won. */
  won: [number, number];
  /** Each set's state, in order. */
  sets: SetState[];
  /** The set being played now (the first one that is not finished), or -1. */
  live: number;
  /** Whoever has won, once the score settles it: two sets, or the only set played. */
  winner: 0 | 1 | null;
  /** True when one more set has to be played (it's one set all). */
  needsDecider: boolean;
  /** One line about where the match is, for under the board. */
  line: string;
};

/**
 * Reads a whole board. A match is decided when every set on it is finished and someone leads: 2-0, 2-1, or 1-0 when only one set
 * was played. Empty sets on the end (0-0) don't count, so a column hung for the next set never blocks saving a one-set match.
 * `matchTiebreak` says the last set is a first-to-10 breaker instead of a set.
 */
export function matchState(sets: SetScore[], matchTiebreak = false, names: [string, string] = ['you', 'them']): MatchState {
  let played = sets.length;
  while (played > 1 && sets[played - 1][0] === 0 && sets[played - 1][1] === 0) played -= 1;
  const states = sets.map((s, i) => setState(s, matchTiebreak && i === 2));
  const won: [number, number] = [0, 0];
  let live = -1;
  for (let i = 0; i < played; i += 1) {
    if (states[i] === 'p1') won[0] += 1;
    else if (states[i] === 'p2') won[1] += 1;
    else if (live < 0) live = i;
  }
  const allDone = live < 0 && played > 0;
  const leader: 0 | 1 | null = won[0] > won[1] ? 0 : won[1] > won[0] ? 1 : null;
  const winner = allDone && leader !== null && (Math.max(...won) >= 2 || played === 1) ? leader : null;
  const needsDecider = allDone && won[0] === 1 && won[1] === 1;
  return { won, sets: states, live, winner, needsDecider, line: describe(sets, states, live, winner, needsDecider, matchTiebreak, names) };
}

function describe(sets: SetScore[], states: SetState[], live: number, winner: 0 | 1 | null, decider: boolean, mtb: boolean, names: [string, string]): string {
  const bad = states.findIndex((s) => s === 'bad');
  if (bad >= 0) return `set ${bad + 1} reads ${sets[bad][0]}-${sets[bad][1]}. that can't happen. flip one back.`;
  if (winner !== null) return `${names[winner]} takes it. ${sets.filter(([a, b]) => a + b > 0).map(([a, b]) => `${a}-${b}`).join(' ')}`;
  if (decider) return 'one set all. play a third, or a breaker to 10.';
  if (live < 0) return 'flip a plate to start.';
  const [a, b] = sets[live];
  const label = mtb && live === 2 ? 'breaker' : `set ${live + 1}`;
  if (a === 0 && b === 0) return live === 0 ? 'swipe a plate up to add a game. down takes it back.' : `${label}. 0-0.`;
  if (!(mtb && live === 2) && a === 6 && b === 6) return `${label}. 6-6. play the tiebreak, winner goes to 7.`;
  return `${label}. ${a}-${b}.`;
}
