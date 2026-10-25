// Reads a swing on the right thumbstick for the drill (web/drill.js). Stick positions are in stick radii: x right, y DOWN
// (screen), so pulling the thumb toward you is +y.
//
// - Take-back: where you pulled the stick before swinging. Its side is the wing (right: forehand, left: backhand for a
//   right-hander). Its height is the racket face: pulled low (down past 34 degrees) closes the face and brushes up = topspin,
//   pulled level is flat, pulled high (up past 20 degrees) opens it = slice. Deeper takes more spin.
// - Swing: the flick from the take-back up through the middle. Its speed (radii a second) is pace.
// - Finish: where the thumb ends. The lean is the aim (across your body goes crosscourt, out to the side goes down the line);
//   0.55 of the lean becomes the ball's heading, up to 34 degrees. How far up you push is height.
// - Lob: soft (under 9 radii a second) and pushed way up (past 1.35 radii). 38 to 54 degrees.
// - Drop shot: pulled high (the slice face), then barely nudged up (under 7 radii a second, finish under 1.1 radii).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** The face a take-back sets: 'topspin' | 'flat' | 'slice'. */
export function faceOf(back) {
  const th = Math.atan2(back.y, Math.abs(back.x) + 1e-6);
  return th > 0.6 ? 'topspin' : th < -0.35 ? 'slice' : 'flat';
}

/** The stroke a stick swing describes. back, finish: {x, y} in radii; v: swing speed in radii/s; wing +1 / -1. */
export function readSwing(back, finish, v, wing) {
  const th = Math.atan2(back.y, Math.abs(back.x) + 1e-6);
  const spinKind = faceOf(back);
  const heading = clamp(Math.atan2(finish.x, Math.max(0.2, -finish.y)) * 0.55, -0.6, 0.6);
  const up = clamp(-finish.y, 0, 2);
  const lob = up > 1.35 && v < 9;
  // Drop shot: the open (slice) face and barely a nudge up. Soft, steep enough to clear the net, heavy backspin.
  const drop = !lob && spinKind === 'slice' && v < 7 && up < 1.1;
  let speed;
  let elev;
  let spin;
  if (drop) {
    speed = clamp(8 + 0.6 * v, 8, 12);
    elev = 14 + 6 * clamp(up / 1.1, 0, 1);
    spin = -340;
  } else if (lob) {
    speed = clamp(15 + 0.6 * v, 14, 22);
    elev = 38 + 16 * clamp((up - 1.35) / 0.5, 0, 1);
    spin = spinKind === 'topspin' ? 220 : spinKind === 'slice' ? -150 : 40;
  } else {
    speed = clamp(8 + 1.35 * v, 10, 44);
    elev = 3 + 14 * clamp((up - 0.5) / 1.2, 0, 1);
    if (spinKind === 'topspin') spin = 150 + 300 * clamp((th - 0.6) / 0.9, 0, 1);
    else if (spinKind === 'slice') { spin = -(140 + 180 * clamp((-th - 0.35) / 0.8, 0, 1)); speed *= 0.86; }
    else spin = 30;
  }
  return { wing, heading, speed, elev, spin, spinKind, lob, drop, v, up };
}

/**
 * The swing as it meets the ball. `dt` is contact time minus the ideal (s): early pulls the ball across (left on a forehand),
 * late pushes it the other way, 70 degrees a second; more than 0.2 s off frames it. `right` is the sweet-spot quality, 0..1
 * (true is 1): off-centre loses pace, scatters the aim and pops it up.
 */
export function strike(stroke, dt, right, rand = Math.random) {
  let { heading, speed, elev, spin } = stroke;
  const off = Math.abs(dt);
  let timing = off < 0.06 ? 'ON TIME' : dt < 0 ? 'EARLY' : 'LATE';
  if (off > 0.2) {
    timing = 'FRAMED';
    speed *= 0.5;
    heading += (rand() - 0.5) * 0.9;
    elev += 10;
    spin *= 0.3;
  } else {
    const tq = 1 - off / 0.2;
    heading += dt * stroke.wing * 1.22;
    speed *= 0.8 + 0.2 * tq;
  }
  // Off the sweet spot: `right` is a 0..1 quality when a number is passed (true is 1, false is 0).
  const q = right === true ? 1 : typeof right === 'number' ? right : 0;
  if (q < 1) {
    speed *= 0.6 + 0.4 * q;
    heading += (rand() - 0.5) * 0.5 * (1 - q);
    elev += 6 * (1 - q);
  }
  return { heading, speed, elev, spin, timing };
}

/**
 * A volley: the ball taken before it bounces. A punch, not a swing: most of the pace is the incoming ball's, the rest is the
 * flick. A soft punch with the open face is a drop volley; a lob stays a lob. `incoming` is the ball's speed in m/s.
 */
export function volley(stroke, incoming) {
  if (stroke.lob) return stroke;
  if (stroke.drop) return { ...stroke, speed: clamp(0.15 * incoming + 5, 6, 10), elev: 12, spin: -360 };
  // Measured from the net (contact 1 m up, 3 m out): 18 to 21 m/s at 4 to 6 degrees lands 7 to 11 m deep.
  const punch = clamp(stroke.v, 0, 20) / 20;
  return { ...stroke, speed: clamp(0.3 * incoming + 8 * punch + 8, 12, 24), elev: clamp(2 + stroke.elev * 0.3, 3, 7), spin: -60 };
}

export const rpm = (s) => Math.round((Math.abs(s) * 60) / (2 * Math.PI) / 100) * 100;
export const kmh = (v) => Math.round(v * 3.6);
