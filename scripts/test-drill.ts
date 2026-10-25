// Drill physics and stroke reading (web/lib/ballistics.js, web/lib/stroke.js). Run: npx tsx scripts/test-drill.ts
import assert from 'node:assert/strict';

import { call, firstLanding, launch, solveLaunch, stepBall, HALF, SERVICE } from '../web/lib/ballistics.js';
import { faceOf, readSwing, strike, volley } from '../web/lib/stroke.js';

const hit = (s: ReturnType<typeof readSwing>, from = { x: 2, y: 1, z: 12 }) => {
  const r = strike(s, 0, true, () => 0.5);
  return firstLanding(launch(from, Math.sin(r.heading), -Math.cos(r.heading), (r.elev * Math.PI) / 180, r.speed, r.spin));
};
// Stick swings: back and finish in stick radii (y down), v in radii a second.
const swingOf = (back: { x: number; y: number }, finish: { x: number; y: number }, ms: number, wing = 1) =>
  readSwing(back, finish, Math.hypot(finish.x - back.x, finish.y - back.y) / (ms / 1000), wing);

// Feeds land where they are aimed, over the net.
for (const [elev, spin, to] of [[7, 260, { x: 2.5, z: 10 }], [3, -220, { x: -2, z: 9 }], [48, 120, { x: 0, z: 10.5 }], [6, 150, { x: 1, z: 5.5 }]] as const) {
  const b = solveLaunch({ x: 0, y: 0.9, z: -12.4 }, to, elev, spin);
  const r = firstLanding(b);
  assert.ok(!r.net, `feed ${elev}deg clears the net`);
  assert.ok(Math.hypot(r.x - to.x, r.z - to.z) < 0.4, `feed ${elev}deg lands on target (${r.x.toFixed(2)}, ${r.z.toFixed(2)})`);
}

// Faces: pulled low is topspin, level flat, high slice, on either wing.
assert.equal(faceOf({ x: 0.6, y: 0.8 }), 'topspin');
assert.equal(faceOf({ x: -0.6, y: 0.8 }), 'topspin');
assert.equal(faceOf({ x: 1, y: 0.1 }), 'flat');
assert.equal(faceOf({ x: 0.8, y: -0.5 }), 'slice');

// A normal rally swing: forehand, pulled low, flicked up the middle in 120 ms. Lands in, deep.
const rally = swingOf({ x: 0.6, y: 0.8 }, { x: 0, y: -1.3 }, 120);
assert.equal(rally.spinKind, 'topspin');
const r1 = hit(rally);
console.log('rally', rally.speed.toFixed(1), 'm/s', rally.elev.toFixed(1), 'deg ->', r1.z.toFixed(2), call(r1.x, r1.z));
assert.equal(call(r1.x, r1.z), 'IN');
assert.ok(!r1.net && r1.z < -SERVICE - 1, 'rally ball goes deep');

// The same hard flick: flat sails long, a low topspin take-back brings it in shorter.
const flatHard = swingOf({ x: 1, y: 0 }, { x: 0, y: -1.5 }, 70);
const topHard = swingOf({ x: 0.5, y: 0.9 }, { x: 0, y: -1.5 }, 70);
const rf = hit(flatHard);
const rt = hit(topHard);
console.log('flat hard', flatHard.speed.toFixed(1), rf.z.toFixed(2), call(rf.x, rf.z), '| top hard', topHard.speed.toFixed(1), rt.z.toFixed(2), call(rt.x, rt.z));
assert.ok(rt.z > rf.z, 'topspin dips the same swing in shorter');

// Soft and way up is a lob, and it lands in.
const lob = swingOf({ x: 0.5, y: 0.8 }, { x: 0, y: -1.7 }, 400);
assert.ok(lob.lob, 'soft high finish lobs');
const rl = hit(lob);
console.log('lob', lob.speed.toFixed(1), lob.elev.toFixed(0), '->', rl.z.toFixed(2), call(rl.x, rl.z));
assert.equal(call(rl.x, rl.z), 'IN');

// Finishing across the body (left on a forehand) aims left: crosscourt. Early pulls further.
const cross = swingOf({ x: 0.6, y: 0.8 }, { x: -0.8, y: -1.1 }, 120);
assert.ok(cross.heading < -0.1);
assert.ok(strike(cross, -0.1, true).heading < cross.heading, 'early forehand pulls left');
assert.ok(strike(rally, 0, 0.2, () => 0.5).speed < strike(rally, 0, 1).speed, 'off centre loses pace');
// Drop shot: pulled high (slice face), barely nudged. Clears the net, lands short of the service line, and dies.
const drop = swingOf({ x: 0.75, y: -0.45 }, { x: 0, y: -0.8 }, 300);
assert.ok(drop.drop && !drop.lob, 'high pull + soft nudge is a drop shot');
{
  const r = strike(drop, 0, true);
  const b = launch({ x: 0, y: 0.8, z: 6 }, Math.sin(r.heading), -Math.cos(r.heading), (r.elev * Math.PI) / 180, r.speed, r.spin);
  const first = firstLanding(b);
  assert.ok(!first.net && first.z < 0 && first.z > -SERVICE, `drop lands short over the net (${first.z.toFixed(2)})`);
  let bounces = 0;
  let x2 = 0;
  for (let t = 0; t < 6 && bounces < 2; t += 1 / 120) if (stepBall(b) === 'bounce') { bounces += 1; x2 = b.z; }
  console.log('drop', r.speed.toFixed(1), 'm/s ->', first.z.toFixed(2), 'then', x2.toFixed(2));
  assert.ok(x2 - first.z > -2.5, 'it dies: second bounce within 2.5 m');
}
// Volley: a punch takes most of its pace from the incoming ball; soft is a drop volley.
assert.ok(volley(rally, 30).speed < rally.speed && volley(rally, 30).speed > 15, 'volley punches back off the pace');
assert.ok(volley(drop, 30).speed <= 10, 'drop volley is soft');
assert.ok(HALF > 11);
console.log('drill physics ok');
