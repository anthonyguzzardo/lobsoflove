// Run: npx tsx scripts/test-ink.ts
import assert from 'node:assert/strict';

import { parseCommand } from '../src/lib/ink-commands';
import { decode, parse, takeSets, takeTime, type Slot } from '../src/lib/ink-parse';
import type { Fighter } from '../src/lib/roster';

const f = (id: string, name: string, isYou = false): Fighter => ({ id, name, isYou, cast: 'wall', color: '#fff', bio: '', favoritePro: '', homeCourt: '', racket: '' });
const roster = [f('you', 'YOU', true), f('d1', 'DAVID'), f('d2', 'DAVE'), f('d3', 'SERVE BOT'), f('d4', 'MARCO')];
const names = roster.map((r) => r.name);
const now = new Date(2026, 9, 14, 21, 0); // Oct 14, 9:00 pm

// Stacked characters with recognizer-style candidate lists.
const s = (...cands: string[]): Slot => ({ cands });
const word = (w: string): Slot[] => [...w].map((c) => s(c));

// Lookalikes get fixed by what is around them.
assert.equal(decode([s('6'), s('-'), s('l', '1', 'I'), s(' '), s('G', '6')]), '6-16');
assert.equal(decode([s('b', '6'), s('-'), s('4')]), '6-4', 'b between score marks reads as 6');
assert.equal(decode([...word('beat'), s('O', 'o'), s('v'), s('e'), s('r')], names), 'beat over');
assert.equal(decode([...word('beat'), ...word('marco')], names), 'beat marco', 'splits run-together words at known words');
assert.equal(decode([...word('won'), { space: true }, s('6'), s('-'), s('S', 's', '5'), s('7'), s('-'), s('5')], names), 'won 6-57-5');

// Written across instead of stacked: whole words come back from the recognizer and must be kept whole.
assert.equal(decode([s('Anthony', 'Anthomy', 'A')], names), 'anthony');
assert.equal(decode([s('beat', 'heat'), s('marco', 'Marco'), s('6-4', '6.4'), { space: true }, s('6-2')], names), 'beat marco6-4 6-2');

// Sets: the writer's own example, commas and all.
assert.deepEqual(takeSets('6,4-2,6,7,6').sets, [[6, 4], [2, 6], [7, 6]]);
assert.deepEqual(takeSets('646276').sets, [[6, 4], [6, 2], [7, 6]], 'no separators: digits pair up');
assert.deepEqual(takeSets('6-4 3-6 10-8').sets, [[6, 4], [3, 6], [10, 8]], 'match tiebreak');
assert.equal(takeSets('6-4 6').odd, true);

// Times.
const at = (txt: string) => takeTime(txt, now).at?.toTimeString().slice(0, 5);
assert.equal(at('814pm'), '20:14');
assert.equal(at('8 past 5'), '17:08');
assert.equal(at('@5'), '17:00');
assert.equal(at('half past 6'), '18:30');
assert.equal(takeTime('lasted 1h20', now).minutes, 80);
assert.equal(takeTime('90min', now).minutes, 90);

// The full example: score, win word, opponent.
let c = parse('6,4-2,6,7,6 win over david', roster, {}, now);
assert.equal(c.draft.kind, 'match');
if (c.draft.kind === 'match') {
  assert.equal(c.draft.opp, 'd1');
  assert.equal(c.draft.won, true);
  assert.deepEqual(c.draft.sets, [[6, 4], [2, 6], [7, 6]]);
}
assert.equal(c.canSave, true);
assert.equal(c.lines[0], 'W  vs DAVID');

// "lost 6-3 6-2" is written winner-first: flip it.
c = parse('lost to marco 6-3 6-2 814pm', roster, {}, now);
assert.ok(c.draft.kind === 'match' && c.draft.won === false);
assert.ok(c.draft.kind === 'match' && c.draft.sets[0][0] === 3);
assert.equal(c.lines[2], 'today 8:14 pm');

// A name that fits two people asks; circling one answers.
c = parse('beat davd 6-4 6-4', roster, {}, now);
assert.equal(c.questions.length, 1);
assert.equal(c.canSave, false);
c = parse('beat davd 6-4 6-4', roster, { opp: 'd2' }, now);
assert.equal(c.canSave, true);

// Bad sets block saving.
assert.ok(parse('beat marco 6-5 6-2', roster, {}, now).warn?.includes('set 1'));
assert.ok(parse('beat marco 6-4 2-6', roster, {}, now).warn?.includes('tied'));

// Gear.
c = parse('restring $28', roster, {}, now);
assert.ok(c.draft.kind === 'gear' && c.draft.item === 'RESTRING' && c.draft.cost === 28);
c = parse('got my racket regripped', roster, {}, now);
assert.ok(c.draft.kind === 'gear' && c.draft.item === 'REGRIP');

c = parse('restring 28', roster, {}, now);
assert.ok(c.draft.kind === 'gear' && c.draft.cost === 28, 'bare number with a gear word is the price');
assert.equal(parse('beat marco 6-4 6-2 $10 balls', roster, {}, now).draft.kind, 'match', 'a real score wins over gear words');

// Commands.
const ctx = { roster, venues: [{ id: 'v1', name: 'Balboa Tennis Club' }, { id: 'v2', name: 'Linda Vista Community Park' }, { id: 'v3', name: 'North Park Rec Center' }], lastMatch: { id: 'm1', label: 'W vs MARCO 6-4 6-2' } };
const cmd = (t: string) => { const c = parseCommand(t, ctx); return c?.draft.kind === 'command' ? c.draft.cmd : null; };
assert.deepEqual(cmd('change fighter to servebot'), { kind: 'cast', cast: 'bot' });
assert.deepEqual(cmd('chnge figter to srvebot'), null, 'too mangled for the fixed commands: no guessing');
assert.deepEqual(cmd('change fighter to srvebot'), { kind: 'cast', cast: 'bot' }, 'misspelled name still lands');
assert.deepEqual(cmd('make me the junkballer'), { kind: 'cast', cast: 'junk' });
assert.deepEqual(cmd('color red'), { kind: 'color', color: '#ff5252', word: 'red' });
assert.deepEqual(cmd('call me anthony'), { kind: 'name', name: 'ANTHONY' });
assert.deepEqual(cmd('court balboa'), { kind: 'court', id: 'v1', name: 'Balboa Tennis Club', home: false });
assert.deepEqual(cmd('home court north park'), { kind: 'court', id: 'v3', name: 'North Park Rec Center', home: true });
assert.deepEqual(cmd('undo last match'), { kind: 'undo', matchId: 'm1' });
assert.deepEqual(cmd('open standings'), { kind: 'open', page: 'standings' });
assert.equal(parseCommand('beat marco 6-4 6-2', ctx), null, 'a match is not a command');
assert.equal(parseCommand('restring $28', ctx), null, 'gear is not a command');

console.log('ink parse: all good');
