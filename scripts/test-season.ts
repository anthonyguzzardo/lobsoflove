// Run: npx tsx scripts/test-season.ts
import assert from 'node:assert/strict';

import { computeSeason, winnerOf, type Match } from '../src/lib/matches';
import type { Fighter } from '../src/lib/roster';

const f = (id: string): Fighter => ({ id, name: id, cast: 'wall', color: '#fff', bio: '', favoritePro: '', homeCourt: '', racket: '' });
const roster = [f('a'), f('b'), f('c')];
const m = (id: string, p1: string, p2: string, sets: [number, number][], t: number): Match => ({ id, p1, p2, sets, court: '', photoUri: null, playedAt: t });

assert.equal(winnerOf(m('x', 'a', 'b', [[6, 4], [6, 3]], 1)), 'a');
assert.equal(winnerOf(m('x', 'a', 'b', [[6, 4], [3, 6]], 1)), null, 'split sets has no winner');
assert.equal(winnerOf(m('x', 'a', 'b', [[6, 6]], 1)), null, 'tied set has no winner');
assert.equal(winnerOf(m('x', 'a', 'b', [], 1)), null);

const season = computeSeason(roster, [
  m('1', 'a', 'b', [[6, 4], [6, 3]], 1), // a straight sets: 120, b 25
  m('2', 'b', 'a', [[2, 6], [6, 4], [10, 8]], 2), // b comeback + upset: 100+30+50=180 -> 205, a 145
  m('3', 'c', 'a', [[6, 0]], 3), // one set: no straight-sets bonus; c below a -> upset: 150, a 170
]);
const pts = Object.fromEntries(season.rows.map((r) => [r.id, r.points]));
assert.deepEqual(pts, { b: 205, a: 170, c: 150 });
assert.deepEqual(season.awards['2'].bonuses, ['COMEBACK +30', 'UPSET +50']);
assert.deepEqual(season.awards['1'].bonuses, ['STRAIGHT SETS +20']);
assert.deepEqual(season.awards['3'].bonuses, ['UPSET +50']);
assert.equal(season.rows[0].id, 'b');
assert.equal(season.awards['3'].rankAfter.c, 3);
console.log('season rules ok');
