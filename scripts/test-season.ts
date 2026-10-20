// Run: npx tsx scripts/test-season.ts
import assert from 'node:assert/strict';

import { computeSeason, personalLine, scoreLine, winnerOf, type Match } from '../src/lib/matches';
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
  m('1', 'a', 'b', [[6, 4], [6, 3]], 1), // a: 60 + straight sets 20 = 80. b: 50
  m('2', 'b', 'a', [[2, 6], [6, 4], [10, 8]], 2), // b: 60 + comeback 30 + upset one rank 35 = 125 -> 175. a: 50 -> 130
  m('3', 'c', 'a', [[6, 0]], 3), // c: 60 + upset one rank 35 + love set 15 = 110. a: 50 -> 180
]);
const pts = Object.fromEntries(season.rows.map((r) => [r.id, r.points]));
assert.deepEqual(pts, { a: 180, b: 175, c: 110 });
assert.deepEqual(season.awards['2'].bonuses, ['COMEBACK +30', 'UPSET +35']);
assert.deepEqual(season.awards['1'].bonuses, ['STRAIGHT SETS +20']);
assert.deepEqual(season.awards['3'].bonuses, ['UPSET +35', 'LOVE SET +15']);
assert.equal(season.awards['3'].loserPoints, 50);
assert.equal(season.rows[0].id, 'a', 'playing three times beats winning once');

// Every loss pays the same: five losses in a week are 250.
const farm = computeSeason(roster, [1, 2, 3, 4, 5].map((t) => m(`f${t}`, 'a', 'b', [[6, 4]], t)));
assert.equal(farm.rows.find((r) => r.id === 'b')?.points, 250);
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
// Home's personal line: you against your own past.
const D = 24 * 3600 * 1000;
const NOW = 100 * D;
const pl = (ts: number[], wins: number) => ts.map((t, i) => m(`p${i}`, 'a', 'b', i < wins ? [[6, 1]] : [[1, 6]], NOW - t * D));
assert.equal(personalLine([], 'a', NOW), 'season 01. log a match and this line starts tracking you.');
assert.equal(personalLine(pl([1, 2, 9, 10, 11], 1), 'a', NOW), 'this week: 2 matches, 1 won. best week: 3. 2 weeks in a row.');
assert.equal(personalLine(pl([1, 2, 3, 9], 3), 'a', NOW), 'this week: 3 matches, 3 won. your best week ever. 2 weeks in a row.');
assert.equal(personalLine(pl([9, 10], 0), 'a', NOW), 'nothing logged this week yet. best week: 2.');
console.log('season rules ok');
