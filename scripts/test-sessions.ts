// Run: npx tsx scripts/test-sessions.ts
// Land on a court, keep the racket the legend offers (DREAMSICLE), step off: DREAMSICLE shows 1 session, CHARLIE none.
import assert from 'node:assert/strict';

import { addItem, addSession, endSession, getSession, lastRacket, openSession, setSessionKind, setSessionRacket, unanswered, wearOf } from '../src/lib/gear';


const t0 = Date.now() - 60_000;
const dreamsicle = addItem('racket', 'PURE AERO 98', null, { brand: 'BABOLAT' });
// Item ids are stamped from the clock: let it tick so the two rackets differ.
const until = Date.now() + 3; while (Date.now() < until) { /* wait */ }
const charlie = addItem('racket', 'PURE AERO 98', null, { brand: 'BABOLAT' });

// First time: the first racket in the closet is offered.
assert.equal(lastRacket(), dreamsicle);
const s1 = addSession('ucsd', t0);
assert.equal(getSession(s1)?.racket, dreamsicle, 'landing preselects the racket used last');
setSessionRacket(s1, dreamsicle); // tap to confirm
endSession(s1, t0 + 30_000, ['DANIEL']);
const s = getSession(s1)!;
assert.ok(s.endedAt && s.kind === null);

const all = [s];
const item = (id: string) => ({ id, kind: 'racket' as const, name: 'X', photo: null, addedAt: t0 - 1000, serviced: {} });
assert.equal(wearOf(item(dreamsicle), 'strings', all).sessions, 1, 'DREAMSICLE: 1 session');
assert.equal(wearOf(item(charlie), 'strings', all).sessions, 0, 'CHARLIE: unchanged');
// Shoes count every session.
assert.equal(wearOf({ ...item('sh'), kind: 'shoes' }, 'soles', all).sessions, 1);

// Leaving asks MATCH or JUST HIT; JUST HIT still counts, and is not a match.
assert.equal(unanswered(all, t0 + 60_000)?.id, s1);
assert.equal(openSession(all), null);
setSessionKind(s1, 'hit');
const after = [getSession(s1)!];
assert.equal(unanswered(after, t0 + 60_000), null);
assert.equal(wearOf(item(dreamsicle), 'strings', after).sessions, 1);
assert.equal(wearOf(item(dreamsicle), 'strings', after).matches, 0);

// Next landing offers DREAMSICLE again (used last); swapping to CHARLIE moves the next session to CHARLIE.
const s2 = addSession('ucsd', t0 + 40_000);
assert.equal(getSession(s2)?.racket, dreamsicle);
setSessionRacket(s2, charlie);
setSessionKind(s2, 'match', 'm1');
const both = [getSession(s1)!, getSession(s2)!];
assert.equal(wearOf(item(charlie), 'strings', both).sessions, 1);
assert.equal(wearOf(item(charlie), 'strings', both).matches, 1);
assert.equal(wearOf(item(dreamsicle), 'strings', both).sessions, 1);
assert.equal(lastRacket(), charlie);
// A restring starts the count over.
assert.equal(wearOf({ ...item(charlie), serviced: { strings: t0 + 50_000 } }, 'strings', both).sessions, 0);

console.log('sessions ok');
