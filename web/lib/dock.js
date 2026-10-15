// The dock shared by home and courts: a row of little floating platforms, one per place, with a real ball that hops to the one
// you pick. The page supplies the markup (#dock holding #dshadow and #dball) and the CSS; slots are added here.
//
// The ball moves like a ball that got hit, not one that wants to go somewhere: the platform it sits on loads for 130 ms and kicks
// it, it flies a true ballistic arc at a fixed 64 degree launch (so a longer gap needs a harder hit, and it gets one), horizontal
// speed constant in the air, spin from its speed, and it lands dead on the target and bounces out its energy (keeps 42%).
const G = 1500;
const $ = (id) => document.getElementById(id);

/**
 * `slots`: [{ i, label, color? }]. `onPick(i)` runs when a slot is tapped. `post` sends sound cues to the app. An `at` with no
 * slot (home's START) parks the ball at the left end. Returns { hop(i), place(i), mark(i), step(dt), render() }.
 */
export function createDock({ slots, onPick, post, at = 0 }) {
  const dock = $('dock');
  dock.insertAdjacentHTML('beforeend', slots.map((s) => `<button class="slot" data-i="${s.i}"${s.color ? ` style="--pc:${s.color}"` : ''}><span class="pf"></span><span class="lbl">${s.label}</span></button>`).join(''));
  dock.addEventListener('click', (e) => { const b = e.target.closest('.slot'); if (b) onPick(Number(b.dataset.i)); });
  const slotOf = (i) => dock.querySelector(`.slot[data-i="${i}"]`);
  const dk = { x: 0, y: 0, vx: 0, vy: 0, to: 0, flying: false, squash: 0, rot: 0, at, load: null, queued: null };
  const slotX = (i) => {
    const el = slotOf(i);
    if (!el) return 18; // no platform for this place: the ball waits at the left end
    const r = dock.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return b.left + b.width / 2 - r.left;
  };
  const restY = () => dock.clientHeight - 49; // sitting on a platform top

  function launch(i, from, slot) {
    dk.to = slotX(i); dk.at = i;
    const R = dk.to - from;
    const T = Math.tan((64 * Math.PI) / 180);
    const vy = Math.max(260, Math.sqrt((Math.abs(R) * G * T) / 2));
    dk.vy = -vy;
    dk.vx = R / ((2 * vy) / G); // lands exactly on the target platform
    dk.x = from;
    dk.flying = true;
    if (slot) { slot.classList.remove('load'); slot.classList.remove('kick'); void slot.offsetWidth; slot.classList.add('kick'); }
    post({ type: 'press' });
  }

  return {
    /** Send the ball to slot i (queued if it is already in the air). */
    hop(i) {
      if (dk.flying || dk.load) { dk.queued = i; return; }
      dk.load = { to: i, t: 0, slot: slotOf(dk.at) };
      if (dk.load.slot) dk.load.slot.classList.add('load');
      dk.vy = 0;
    },
    /** Put the ball on slot i without a hop. */
    place(i) { dk.at = i; dk.x = 0; },
    /** Light up slot i. */
    mark(i) { [...dock.querySelectorAll('.slot')].forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === i)); },
    step(dt) {
      if (!dk.x) { dk.x = slotX(dk.at); dk.y = restY(); }
      const floor = restY();
      if (dk.load) {
        dk.load.t += dt;
        const k = Math.min(1, dk.load.t / 0.13);
        dk.y = restY() + 6 * k * k;
        dk.squash = 0.18 * k;
        if (k >= 1) { const l = dk.load; dk.load = null; dk.y = restY(); launch(l.to, dk.x || slotX(dk.at), l.slot); }
        return;
      }
      if (dk.flying) dk.x += dk.vx * dt;
      dk.rot += (dk.vx * dt) / 12; // rolls through the air at its own speed (radius 12 px)
      dk.vy += G * dt;
      dk.y += dk.vy * dt;
      if (dk.y >= floor && dk.vy > 0) {
        const hit = dk.vy;
        dk.y = floor;
        if (dk.flying) { dk.flying = false; dk.x = dk.to; dk.vx = 0; if (dk.queued != null) { const q = dk.queued; dk.queued = null; setTimeout(() => this.hop(q), 60); } }
        dk.vy = hit > 140 ? -hit * 0.42 : 0;
        if (hit > 140) {
          dk.squash = Math.min(0.35, hit / 2200);
          const s = slotOf(dk.at);
          if (s) { s.classList.add('land'); setTimeout(() => s.classList.remove('land'), 110); }
        }
      }
      dk.squash *= Math.exp(-dt * 14);
    },
    render() {
      $('dball').style.transform = `translate3d(${dk.x}px,${dk.y}px,0) scale(${1 + dk.squash},${1 - dk.squash})`;
      $('dball').firstElementChild.style.transform = `rotate(${dk.rot}rad)`;
      const lift = Math.min(1, (restY() - dk.y) / 90);
      $('dshadow').style.transform = `translateX(${dk.x}px) scale(${1 - 0.5 * lift})`;
      $('dshadow').style.opacity = String(1 - 0.6 * lift);
    },
  };
}
