// The damped spring every page animates with: `s` is { x, v }, pulled toward `target` at `hz` with damping `ratio`
// (1 settles without overshoot, below 1 bounces). Integrate it at a fixed small dt.
export function spring(s, target, dt, hz, ratio) {
  const w = hz * Math.PI * 2;
  s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt;
  s.x += s.v * dt;
}
/** A spring state at rest at x. */
export const sp = (x = 0) => ({ x, v: 0 });
