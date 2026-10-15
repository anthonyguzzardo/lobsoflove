// The slide control shared by every page that has one (home, courts, closet, fighter): a strip of court with a ball on it.
// You slide the ball down the strip to go. The page supplies the markup (#enter with #ballw > #ball, #skid, #dust, #klbl,
// #ksub) and the CSS; this module owns the physics, the pointer handling and the test hook.
//
// Motion spec:
// - The ball rolls without slipping: it turns distance / radius, so the seam moves exactly as a real ball's would.
// - It leaves a skid mark as wide as the ball and throws a dust puff every 14 px of travel (each lives 520 ms).
// - Crossing a court line (at 1/3 and 2/3 of the strip) ticks. `charge` (0 to 1) is how far it is pulled, for loading the fighter.
// - Release short of 78% and the ball rolls home on a spring at 2.4 Hz, damping ratio 0.5 (one overshoot).
//   Release past 78%, or flick faster than 900 px/s from past 40%, and it runs out to the baseline at 5 Hz, ratio 1.
// - At rest it is never frozen: every 2.4 s the ball rocks 9 px forward and settles back, the way you bounce one before a serve.
const BALL = 50;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const $ = (id) => document.getElementById(id);

/**
 * Wire up the page's slide strip. `post` sends events to the app (press, line); `onSlid` runs when the ball reaches the baseline.
 * Returns { setKey(num, label, sub), step(dt), render(t), charge }.
 */
export function createSlide({ post, onSlid }) {
  const key = $('enter');
  const sl = { x: 0, v: 0, max: 1, held: false, finishing: false, done: false, grab: 0, lastX: 0, lastT: 0, flick: 0, puffAt: 0, zone: 0 };
  const api = { charge: 0 };

  /** Show the strip with this label (or hide it with no `num`). Re-showing the same label does nothing. */
  api.setKey = (num, labelText, sub) => {
    const next = num ? `${num}|${labelText}|${sub}` : '';
    if (key.dataset.k === next) return;
    key.dataset.k = next;
    key.classList.toggle('show', !!num);
    Object.assign(sl, { x: 0, v: 0, held: false, finishing: false, done: false, zone: 0 });
    if (!num) return;
    $('klbl').textContent = labelText;
    $('ksub').textContent = sub;
    key.classList.remove('swap');
    void key.offsetWidth; // restart the pop
    key.classList.add('swap');
  };

  key.addEventListener('pointerdown', (e) => {
    if (sl.done || sl.finishing) return;
    const r = key.getBoundingClientRect();
    sl.max = Math.max(1, r.width - BALL - 16);
    // Grab the ball where it is; a touch elsewhere on the strip does not teleport it.
    sl.grab = clamp(e.clientX - r.left - 8 - sl.x, 0, BALL);
    sl.held = true; sl.v = 0; sl.flick = 0; sl.lastX = e.clientX; sl.lastT = performance.now();
    key.setPointerCapture(e.pointerId);
    key.classList.add('held');
    post({ type: 'press' });
  });
  key.addEventListener('pointermove', (e) => {
    if (!sl.held) return;
    const r = key.getBoundingClientRect();
    const now = performance.now();
    sl.x = clamp(e.clientX - r.left - 8 - sl.grab, 0, sl.max);
    sl.flick = 0.6 * ((e.clientX - sl.lastX) / Math.max(1, now - sl.lastT)) * 1000 + 0.4 * sl.flick;
    sl.lastX = e.clientX; sl.lastT = now;
  });
  const letGo = () => {
    if (!sl.held) return;
    sl.held = false;
    key.classList.remove('held');
    const p = sl.x / sl.max;
    if (p > 0.78 || (sl.flick > 900 && p > 0.4)) { sl.finishing = true; sl.v = Math.max(sl.flick, 600); } else sl.v = Math.min(0, sl.flick);
  };
  key.addEventListener('pointerup', letGo);
  key.addEventListener('pointercancel', letGo);

  /** Test hook: pull the ball to a fraction of the strip over 800 ms and let go, as a finger would. */
  window.demoSlide = (to) => {
    sl.max = Math.max(1, key.getBoundingClientRect().width - BALL - 16);
    sl.held = true;
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 800);
      sl.x = sl.max * to * (1 - Math.pow(1 - k, 3));
      if (k >= 1) { clearInterval(id); sl.flick = 0; letGo(); }
    }, 16);
  };

  function puff(x) {
    const d = document.createElement('i');
    d.style.left = `${x + 8 + Math.random() * 14}px`;
    d.style.setProperty('--dx', `${-10 - Math.random() * 22}px`);
    d.style.setProperty('--dy', `${-8 - Math.random() * 16}px`);
    d.style.setProperty('--s', String(0.6 + Math.random() * 0.9));
    $('dust').appendChild(d);
    setTimeout(() => d.remove(), 540);
  }

  api.step = (dt) => {
    if (!sl.held && !sl.done) {
      const hz = sl.finishing ? 5 : 2.4;
      const ratio = sl.finishing ? 1 : 0.5;
      const target = sl.finishing ? sl.max : 0;
      const w = hz * Math.PI * 2;
      sl.v += (-w * w * (sl.x - target) - 2 * ratio * w * sl.v) * dt;
      sl.x += sl.v * dt;
      if (sl.x < 0) { sl.x = 0; sl.v = Math.abs(sl.v) * 0.3; }
      if (sl.finishing && sl.x > sl.max - 1.5) {
        sl.x = sl.max; sl.done = true; sl.finishing = false;
        key.classList.add('hit');
        for (let k = 0; k < 7; k += 1) puff(sl.max + 10);
        onSlid();
        // Back from the next screen the strip should be ready again.
        setTimeout(() => { Object.assign(sl, { x: 0, v: 0, done: false, zone: 0 }); key.classList.remove('hit'); }, 1400);
      }
    }
    if (Math.abs(sl.x - sl.puffAt) > 14 && sl.x > 4) { sl.puffAt = sl.x; puff(sl.x); }
    const zone = Math.floor((sl.x / sl.max) * 3 + 0.0001);
    if (zone !== sl.zone && sl.x > 2 && !sl.done) { sl.zone = zone; post({ type: 'line' }); }
    api.charge = sl.done ? 0 : sl.x / sl.max;
  };

  api.render = (t) => {
    const u = (t % 2.4) / 0.5;
    const idle = !sl.held && !sl.finishing && !sl.done && sl.x < 1 && u < 1 ? 9 * Math.sin(Math.PI * u) : 0;
    const x = sl.x + idle;
    $('ballw').style.transform = `translate3d(${x}px,0,0)`;
    $('ball').style.transform = `rotate(${x / (BALL / 2)}rad)`;
    $('skid').style.width = `${sl.x > 2 ? sl.x + BALL / 2 + 6 : 0}px`;
  };

  return api;
}
