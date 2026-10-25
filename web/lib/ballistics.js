// Tennis ball flight for the drill (web/drill.js). Real numbers, metres and seconds, integrated at 1/120 s.
//
// Court: x across (your right is +x), y up, z down the court. Your baseline is z = +11.885, the far one -11.885, the net z = 0.
// - Drag: a = -KD |v| v. KD = 0.5 rho Cd A / m = 0.5 * 1.2 * 0.55 * 0.00353 / 0.057 = 0.0204.
// - Magnus: a = KM (w x v), w in rad/s. KM 9e-4 gives about 7 m/s^2 down for 300 rad/s (2900 rpm) at 25 m/s, as measured.
// - Spin is one number `s` about a fixed axis set at launch: s > 0 topspin, s < 0 slice (backspin). Decays 15 % a second.
// - Bounce (hard court): topspin kicks up and through (e 0.76, keeps 80 % of its pace), slice skids low and dies
//   (e 0.6, keeps 66 %), flat in between. Heavy backspin (under -250 rad/s, a drop shot) checks: e 0.5, keeps 35 %. Half the spin is lost on the bounce.
// - Net: 0.914 m in the middle, 1.07 m at the posts (6.4 m out).

export const DT = 1 / 120;
export const G = 9.81;
export const R = 0.033;
export const KD = 0.0204;
export const KM = 9e-4;
export const HALF = 11.885;
export const SINGLES = 4.115;
export const DOUBLES = 5.485;
export const SERVICE = 6.4;
export const netH = (x) => 0.914 + 0.156 * Math.min(1, Math.abs(x) / 6.4);

/** A ball leaving `from` along the unit ground heading (ux, uz), `elev` radians up, at `speed` m/s with spin `s` rad/s. */
export function launch(from, ux, uz, elev, speed, s) {
  const h = speed * Math.cos(elev);
  // Topspin axis = up x heading, so (w x v) points down for s > 0.
  return { x: from.x, y: from.y, z: from.z, vx: h * ux, vy: speed * Math.sin(elev), vz: h * uz, s, ax: uz, az: -ux, bounces: 0 };
}

/** One step. Returns 'bounce' on the step the ball meets the ground, 'net' on the step it hits the net, else null. */
export function stepBall(b, dt = DT) {
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  const ox = b.s * b.ax;
  const oz = b.s * b.az;
  b.vx += (-KD * sp * b.vx + KM * (-oz * b.vy)) * dt;
  b.vy += (-G - KD * sp * b.vy + KM * (oz * b.vx - ox * b.vz)) * dt;
  b.vz += (-KD * sp * b.vz + KM * (ox * b.vy)) * dt;
  const pz = b.z;
  const py = b.y;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.s *= 1 - 0.15 * dt;
  if (!b.netted && pz !== b.z && Math.sign(pz) !== Math.sign(b.z)) {
    const f = pz / (pz - b.z);
    const yc = py + (b.y - py) * f;
    if (yc < netH(b.x) + R && yc > -0.1) {
      // Into the tape or the cord: it dies and drops on the side it came from.
      b.netted = true;
      b.z = pz > 0 ? 0.06 : -0.06;
      b.vz *= -0.12;
      b.vx *= 0.2;
      b.vy = Math.min(b.vy, 0) * 0.3;
      return 'net';
    }
  }
  if (b.y < R && b.vy < 0) {
    b.y = R;
    const top = b.s > 40;
    const slice = b.s < -40;
    // Heavy backspin (a drop shot) checks up: it sits down and nearly stops.
    const check = b.s < -250;
    b.vy = -b.vy * (check ? 0.5 : slice ? 0.6 : top ? 0.76 : 0.7);
    const keep = check ? 0.35 : slice ? 0.66 : top ? 0.8 : 0.72;
    b.vx *= keep;
    b.vz *= keep;
    b.s *= 0.45;
    b.bounces += 1;
    return 'bounce';
  }
  return null;
}

/** Where a ball first lands, or that it found the net. */
export function firstLanding(b0) {
  const b = { ...b0 };
  for (let t = 0; t < 8; t += DT) {
    const ev = stepBall(b);
    if (ev === 'net') return { net: true, x: b.x, z: b.z, t };
    if (ev === 'bounce') return { net: false, x: b.x, z: b.z, t };
  }
  return { net: false, x: b.x, z: b.z, t: 8 };
}

/**
 * The ball that lands on `to` from `from` at a fixed launch angle and spin: bisect on speed (range grows with speed at a fixed
 * angle). If it can't clear the net and still land there, raise the angle 3 degrees and try again.
 */
export function solveLaunch(from, to, elevDeg, s) {
  const hx = to.x - from.x;
  const hz = to.z - from.z;
  const D = Math.hypot(hx, hz);
  const ux = hx / D;
  const uz = hz / D;
  let elev = elevDeg;
  let ball = null;
  for (let tries = 0; tries < 8; tries += 1) {
    let lo = 2;
    let hi = 70;
    for (let i = 0; i < 26; i += 1) {
      const mid = (lo + hi) / 2;
      const r = firstLanding(launch(from, ux, uz, (elev * Math.PI) / 180, mid, s));
      const d = (r.x - from.x) * ux + (r.z - from.z) * uz;
      if (r.net || d < D) lo = mid;
      else hi = mid;
    }
    ball = launch(from, ux, uz, (elev * Math.PI) / 180, (lo + hi) / 2, s);
    const r = firstLanding(ball);
    if (!r.net && Math.hypot(r.x - to.x, r.z - to.z) < 0.4) return ball;
    elev += 3;
  }
  return ball;
}

/** Where a ball first landing at (x, z) on the far side counts: IN, LONG or WIDE (singles lines, the line is in). */
export function call(x, z) {
  if (z < -HALF - R) return 'LONG';
  if (Math.abs(x) > SINGLES + R) return 'WIDE';
  return 'IN';
}
