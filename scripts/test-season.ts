// Run: npx tsx scripts/test-season.ts
import assert from 'node:assert/strict';

import { computeSeason, scoreLine, winnerOf, type Match } from '../src/lib/matches';
import { matchState, setState } from '../src/lib/tennis';
import type { Fighter } from '../src/lib/roster';

const f = (id: string): Fighter => ({ id, name: id, cast: 'wall', color: '#fff', bio: '', favoritePro: '', homeCourt: '', racket: '' });
const roster = [f('a'), f('b'), f('c')];
const m = (id: string, p1: string, p2: string, sets: [number, number][], t: number): Match => ({ id, p1, p2, sets, court: '', photoUri: null, playedAt: t });

assert.equal(winnerOf(m('x', 'a', 'b', [[6, 4], [6, 3]], 1)), 'a');
assert.equal(winnerOf(m('x', 'a', 'b', [[6, 4], [3, 6]], 1)), null, 'split sets has no winner');
assert.equal(winnerOf(m('x', 'a', 'b', [[6, 6]], 1)), null, 'tied set has no winner');
assert.equal(winnerOf(m('x', 'a', 'b', [], 1)), null);

const season = computeSeason(roster, [
  m('1', 'a', 'b', [[6, 4], [6, 3]], 1), // a straight sets: 120. b's first loss of the week: 25
  m('2', 'b', 'a', [[2, 6], [6, 4], [10, 8]], 2), // b comeback 30, upset one rank 35: 190. a 25 -> 145
  m('3', 'c', 'a', [[6, 0]], 3), // c upset one rank 35, love set 15: 150. a's second loss this week: 15 -> 160
]);
const pts = Object.fromEntries(season.rows.map((r) => [r.id, r.points]));
assert.deepEqual(pts, { b: 190, a: 160, c: 150 });
assert.deepEqual(season.awards['2'].bonuses, ['COMEBACK +30', 'UPSET +35']);
assert.deepEqual(season.awards['1'].bonuses, ['STRAIGHT SETS +20']);
assert.deepEqual(season.awards['3'].bonuses, ['UPSET +35', 'LOVE SET +15']);
assert.equal(season.awards['3'].loserPoints, 15);
assert.equal(season.rows[0].id, 'b');
assert.equal(season.awards['3'].rankAfter.c, 3);

// Losing a lot never beats winning: five losses in a week pay 25 + 15 + 5 + 5 + 5 = 55.
const farm = computeSeason(roster, [1, 2, 3, 4, 5].map((t) => m(`f${t}`, 'a', 'b', [[6, 4]], t)));
assert.equal(farm.rows.find((r) => r.id === 'b')?.points, 55);
// A week later the taper resets.
const later = computeSeason(roster, [m('l1', 'a', 'b', [[6, 4]], 0), m('l2', 'a', 'b', [[6, 4]], 8 * 24 * 3600 * 1000)]);
assert.equal(later.awards.l2.loserPoints, 25);
// Two tiebreaks won as p2, and the upset grows with the gap (capped).
const tb = computeSeason(roster, [m('t1', 'a', 'b', [[6, 7], [6, 7]], 1)]);
assert.deepEqual(tb.awards.t1.bonuses, ['STRAIGHT SETS +20', '2 TIEBREAKS +20']);
assert.equal(scoreLine([[6, 4], [4, 6], [10, 8]]), '6–4  4–6  [10–8]');

// Tennis rules for the board.
assert.equal(setState([6, 4]), 'p1');
assert.equal(setState([5, 6]), 'open');
assert.equal(setState([6, 6]), 'open');
assert.equal(setState([7, 6]), 'p1');
assert.equal(setState([5, 7]), 'p2');
assert.equal(setState([7, 4]), 'bad');
assert.equal(setState([8, 6]), 'bad');
assert.equal(setState([10, 8], true), 'p1');
assert.equal(setState([10, 9], true), 'open');
assert.equal(setState([12, 10], true), 'p1');
assert.equal(setState([13, 10], true), 'bad');
assert.equal(setState([10, 6]), 'bad', 'a 10 only happens in a breaker');
assert.equal(matchState([[6, 4]]).winner, 0, 'one set played and won');
assert.equal(matchState([[6, 4], [0, 0]]).winner, 0, 'an empty next set does not block');
assert.equal(matchState([[6, 4], [3, 2]]).winner, null, 'a set in progress does');
assert.equal(matchState([[6, 4], [4, 6]]).needsDecider, true);
assert.equal(matchState([[6, 4], [4, 6], [0, 0]]).winner, null);
assert.equal(matchState([[6, 4], [4, 6], [8, 10]], true).winner, 1);
assert.equal(matchState([[6, 4], [6, 2]]).winner, 0);
assert.match(matchState([[7, 3]]).line, /can't happen/);
console.log('season rules ok');
