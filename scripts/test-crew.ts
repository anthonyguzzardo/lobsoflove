// Run: npx tsx scripts/test-crew.ts
// The shared-season rules on the app side: what counts, who holds the belt, and the card preview of a pending match.
import assert from 'node:assert/strict';

import { courtStats } from '../src/lib/courts';
import { computeSeason, counts, type Match } from '../src/lib/matches';
import type { Fighter } from '../src/lib/roster';

const f = (id: string): Fighter => ({ id, name: id, cast: 'wall', color: '#fff', bio: '', favoritePro: '', homeCourt: '', racket: '' });
const roster = [f('you'), f('b'), f('c')];
const m = (id: string, p1: string, p2: string, sets: [number, number][], t: number, status?: Match['status'], courtId = 'ucsd'): Match =>
  ({ id, p1, p2, sets, court: '', courtId, photoUri: null, playedAt: t, status, reportedBy: p1 });

const W: [number, number][] = [[6, 4], [6, 3]];
assert.equal(counts(m('x', 'you', 'b', W, 1)), true, 'a match kept on this phone always counts');
assert.equal(counts(m('x', 'you', 'b', W, 1, 'confirmed')), true);
assert.equal(counts(m('x', 'you', 'b', W, 1, 'pending')), false);
assert.equal(counts(m('x', 'you', 'b', W, 1, 'disputed')), false);

const ms = [
  m('1', 'you', 'b', W, 1, 'confirmed'),
  m('2', 'b', 'you', W, 2, 'disputed'),
  m('3', 'c', 'you', W, 3, 'pending'),
];
const s = computeSeason(roster, ms);
assert.deepEqual(Object.keys(s.awards), ['1'], 'only confirmed matches are scored');
assert.equal(s.rows[0].id, 'you');
const preview = computeSeason(roster, ms, { include: '3' });
assert.ok(preview.awards['3'], 'the card can preview a pending match');
assert.ok(!preview.awards['2'], 'but never a disputed one');

// Belt: the last confirmed winner holds it, even with fewer wins there.
const belt = [
  m('a', 'you', 'b', W, 1, 'confirmed'),
  m('b', 'you', 'c', W, 2, 'confirmed'),
  m('c', 'b', 'you', W, 3, 'confirmed'),
  m('d', 'c', 'b', W, 4, 'pending'),
  m('e', 'c', 'b', W, 5, 'confirmed', 'balboa'),
];
const st = courtStats('ucsd', belt);
assert.equal(st.king, 'b', 'b took the belt last, despite fewer wins here than you');
assert.equal(st.since, 3);
assert.equal(st.kingWins, 1);
assert.equal(st.played, 3, 'pending and other-court matches do not count here');
assert.deepEqual(st.record('you'), [2, 1]);
assert.equal(courtStats('nowhere', belt).king, null);
console.log('crew rules ok');
