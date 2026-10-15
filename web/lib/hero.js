// Your fighter as it travels a page (home tiles, court arenas): the same jelly body, face and color as the fighter screen
// (web/jelly-core.js), carried along a path. `mascot` is the carrier; the jelly rides it and feels every takeoff and landing.
// Each play style has its own way of getting from place to place, and its own fidget while it waits.
import * as THREE from 'three';

import { RainbowTrail, SoftBody } from '../jelly-core.js';

// How each play style jumps. Every jump is a real ballistic arc: launched at the style's angle under the style's gravity, with
// the speed it takes to land exactly on the target, so a longer gap means a harder push, a higher arc and more hang time.
// pre: wind-up crouch (s) for a one-gap jump; it gets deeper and longer the further it has to go. angle: launch angle (degrees).
// g: gravity relative to the page's. The flags shape the flight on top of the arc.
export const STYLES = {
  wall: { pre: 0.16, angle: 35, g: 1.3, heavy: true }, // low and flat, lands like a brick
  moon: { pre: 0.12, angle: 66, g: 0.65 }, // a huge floaty moonball
  bot: { pre: 0.06, angle: 55, g: 1, turn: true }, // snaps round in robotic quarter turns
  goblin: { pre: 0.05, angle: 40, g: 1.1, double: true }, // two sneaky skips to get there
  grunter: { pre: 0.24, angle: 58, g: 1.1 }, // a long effortful load-up
  junk: { pre: 0.09, angle: 55, g: 0.9, wobble: true }, // wobbles off line and back
  comet: { pre: 0.04, angle: 28, g: 1.4 }, // a low flat lunge
  ghost: { pre: 0.1, angle: 42, g: 0.5, glide: true }, // glides over, never really lands
  lobber: { pre: 0.12, angle: 64, g: 0.8, sly: true }, // lobs itself sky-high, smug about it
  rabbit: { pre: 0.03, angle: 30, g: 1.8, trail: true }, // zips, leaving a rainbow
};

/**
 * Put a fighter in `scene`. `scale` sizes the jelly; `unit` is the page's usual gap between places (world units): a one-unit
 * jump takes about 0.6 s at 55 degrees, which sets the page's gravity. Returns the carrier and the calls a page makes each frame.
 */
export function createHero(scene, { scale = 0.42, unit = 2 } = {}) {
  const G = unit * 7.4;
  const mascot = new THREE.Group();
  const hero = new SoftBody({ cast: 'wall', color: '#d7f205', edge: 0.14 });
  hero.group.scale.setScalar(scale);
  mascot.add(hero.group);
  mascot.rotation.y = THREE.MathUtils.degToRad(45); // the face looks straight down the camera's diagonal
  scene.add(mascot);
  const trail = new RainbowTrail(scene, { n: 22, band: 0.03 });

  // What each one does while it waits (every 4.5 s or so).
  const IDLE = {
    rabbit: () => [0, 40, 80, 120, 160, 200].forEach((ms, i) => setTimeout(() => hero.kick(i % 2 ? -1.2 : 1.2, 0, 0), ms)), // can't keep still
    moon: () => hero.kick(0, 4.5, 0),
    bot: () => hero.spin(Math.random() < 0.5 ? 4 : -4),
    goblin: () => hero.kick(Math.random() < 0.5 ? 1.5 : -1.5, 2.4, 0),
    grunter: () => [0, 60, 120].forEach((ms, i) => setTimeout(() => hero.kick(i % 2 ? -1.4 : 1.4, 0.4, 0), ms)),
    junk: () => hero.poke(hero.com().add(new THREE.Vector3(0.3, 0.5, 0.3)), new THREE.Vector3(-0.5, -0.5, 0), 2.4),
    comet: () => hero.kick(0, 1.8, 2.2),
    ghost: () => hero.spin(2.4),
    lobber: () => { hero.mood.sly = 1.4; },
    wall: () => hero.poke(hero.com().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(0, -1, 0), 1.4, 0.7),
  };
  const carrier = { p: new THREE.Vector3(), v: new THREE.Vector3(), ready: false, idleAt: 4 };

  const style = () => STYLES[hero.cast] || STYLES.wall;
  let plan = null; // the jump in progress

  /** Work out a jump from a to b in this play style: crouch, push, flight time, arc height. */
  function makePlan(a, b) {
    const st = style();
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const power = d / unit; // 1 for the next place over
    const th = THREE.MathUtils.degToRad(st.angle);
    const g = G * st.g;
    const leg = st.double ? d / 2 : d; // the goblin covers it in two skips
    // Apex of a true ballistic arc over that span, capped so the steep styles stay believable on a long jump (a lower apex
    // under the same gravity just means a flatter, faster arc), and the flight time that apex takes to rise and fall.
    const peak = Math.min((leg * Math.tan(th)) / 4, unit * (0.5 + 0.35 * power));
    const T = Math.sqrt((8 * peak) / g);
    return {
      a: a.clone(), b: b.clone(), d, power,
      pre: st.pre * THREE.MathUtils.clamp(0.8 + 0.45 * (power - 1), 0.8, 3), // bigger gap, deeper and longer crouch
      load: Math.min(0.95, (st.heavy ? 0.9 : 0.7) * THREE.MathUtils.clamp(0.8 + 0.12 * power, 0.8, 1.35)),
      T: st.double ? 2 * T : T,
      peak,
      st,
    };
  }

  return {
    mascot,
    hero,
    /** Crouch and launch from a to b. Returns the whole jump's length in seconds (crouch plus flight). */
    jump(a, b) {
      plan = makePlan(a, b);
      if (plan.st.sly) hero.mood.sly = 1;
      return plan.pre + plan.T;
    },
    /** How hard the current jump pushes off, 1 for the next place over (for denting the platform it leaves). */
    power: () => (plan ? plan.power : 0),
    /** The crouch of the current jump (s). */
    crouch: () => (plan ? plan.pre : 0),
    /** The fighter's color and play style, from the app. */
    set({ color, cast }) {
      if (color) hero.setColor(color);
      if (cast && cast !== hero.cast) hero.setCast(cast, false);
    },
    /** Where the carrier is `t` seconds into the current jump: crouched at the start, then flying a true arc to the target. */
    along(t) {
      const { a, b, pre, T, peak, st } = plan;
      const k = THREE.MathUtils.clamp((t - pre) / T, 0, 1);
      const kx = st.glide ? k * k * (3 - 2 * k) : k; // horizontal speed is constant in flight (the ghost eases instead)
      const p = a.clone().lerp(b, kx);
      p.y = THREE.MathUtils.lerp(a.y, b.y, k);
      const u = st.double ? (2 * k) % 1 : k;
      p.y += peak * 4 * u * (1 - u);
      if (st.wobble) p.addScaledVector(new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize(), 0.12 * plan.d * Math.sin(Math.PI * 3 * k) * (1 - k));
      return p;
    },
    /** It touched down after a hop. */
    landed(clock) {
      if (style().heavy) hero.kick(0, -4 * Math.min(2, plan ? plan.power : 1), 0);
      plan = null;
      carrier.idleAt = clock + 4.5;
    },
    /** It reached the end of a slide: jump for joy. */
    cheer() { hero.kick(0, 6, 0); hero.mood.happy = 0.8; },
    /**
     * Advance the jelly. `p` is where the carrier is this step, `hopT` the time into the current jump (null when resting),
     * `charge` how hard the slide ball is pulled (it loads the fighter).
     */
    step(dt, clock, p, hopT, charge = 0) {
      if (!carrier.ready) { carrier.p.copy(p); carrier.ready = true; }
      const vel = p.clone().sub(carrier.p).divideScalar(dt);
      const acc = vel.clone().sub(carrier.v).divideScalar(dt);
      carrier.p.copy(p); carrier.v.copy(vel);
      // Up and down it only feels the jolts (takeoff, landing), not the smooth arc between, or it would float off its own feet.
      if (Math.abs(acc.y) < 150) acc.y = 0;
      const local = acc.applyQuaternion(mascot.quaternion.clone().invert()).multiplyScalar(0.6 / scale / mascot.scale.x);
      const dv = local.multiplyScalar(dt).clampLength(0, 5);
      hero.kick(-dv.x, -dv.y, -dv.z);
      const pre = plan && hopT != null && hopT < plan.pre ? hopT / plan.pre : 0;
      hero.squash = Math.max(pre * (plan ? plan.load : 0), 0.7 * charge); // the crouch before a jump, or pulling the ball loads the fighter
      hero.simulate(dt, clock);
      if (hopT == null && clock > carrier.idleAt) { carrier.idleAt = clock + 4.5 + Math.random(); (IDLE[hero.cast] || (() => {}))(); }
    },
    /** Draw it at `p`, `hopT` into the current jump (null when resting). Returns how far through the flight it is (0 to 1). */
    render(t, p, hopT) {
      mascot.position.copy(p);
      const hk = plan && hopT != null ? THREE.MathUtils.clamp((hopT - plan.pre) / plan.T, 0, 1) : 0;
      const st = style();
      mascot.rotation.y = THREE.MathUtils.degToRad(45) + (plan && st.turn ? (Math.PI / 2) * Math.floor(hk * 4 * Math.max(1, Math.round(plan.power))) : 0);
      hero.render(t);
      trail.update(hero.group.localToWorld(hero.com()), !!plan && st.trail && hk > 0 && hk < 1);
      return hk;
    },
  };
}
