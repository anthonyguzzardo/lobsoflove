// The courts dock as a honeycomb: one flat-topped hex cell per place, zigzagging up and down in one interlocking row (venue order
// left to right, like the old dock), with your ball hopping cell to cell. Each cell
// shows who is there at a glance (a dot per person, solid if they are here, dashed if they are coming later), and a cell with
// people on it bobs, so you can see where everyone is without travelling. Same calls as web/lib/dock.js, plus people().
//
// The ball: the cell it sits on loads for 130 ms and kicks it; it flies a true arc (hang time grows with the gap, apex 46 px plus
// a little per gap), lands dead center on the target cell and bounces out its energy (keeps 40%).
const G = 1500;
const $ = (id) => document.getElementById(id);

/** `slots`: [{ i, label, color }]. Returns { hop(i), place(i), mark(i), people(i, list), step(dt), render() }. */
export function createHexDock({ slots, onPick, post, at = 0 }) {
  const dock = $('dock');
  dock.classList.add('hex');
  dock.style.setProperty('--n', String(slots.length));
  // A cell is the place's drawn icon and who is there. Its name is not printed on it: it rises as a tag over the cell while your
  // finger is on it (and the top bar names the court on stage).
  dock.insertAdjacentHTML('beforeend', slots.map((s, k) => `<button class="cell" data-i="${s.i}" aria-label="${s.label}" style="--pc:${s.color};--k:${k};--down:${k % 2}"><span class="hx"><span class="dots"></span><span class="ic">${s.icon || ''}</span></span><span class="name">${s.label}</span></button>`).join(''));
  // Touch: a cell presses down under your finger. Hold and drag across the honeycomb and the press follows (a tick per cell);
  // let go to go there. Dragging off the honeycomb and letting go cancels.
  let pressed = null;
  const press = (cell) => {
    if (cell === pressed) return;
    if (pressed) pressed.classList.remove('press');
    pressed = cell;
    if (cell) { cell.classList.add('press'); post({ type: 'line' }); }
  };
  const cellAt = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest('#dock .cell') || null;
  dock.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    dock.setPointerCapture(e.pointerId);
    press(cell);
  });
  dock.addEventListener('pointermove', (e) => { if (dock.hasPointerCapture(e.pointerId)) press(cellAt(e)); });
  dock.addEventListener('pointerup', (e) => {
    const cell = cellAt(e);
    press(null);
    if (cell) onPick(Number(cell.dataset.i));
  });
  dock.addEventListener('pointercancel', () => press(null));
  const cellOf = (i) => dock.querySelector(`.cell[data-i="${i}"]`);
  /** Where the ball sits on a cell: on its flat top edge. */
  const spot = (i) => {
    const el = cellOf(i);
    const r = dock.getBoundingClientRect();
    if (!el) return { x: 18, y: 18 };
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2 - r.left, y: b.top - r.top - 10 };
  };
  const b = { x: null, y: 0, from: null, to: null, t: 0, T: 0, peak: 0, flying: false, vy: 0, rest: 0, squash: 0, rot: 0, at, load: null, queued: null };

  function launch(i) {
    const from = { x: b.x, y: b.y };
    const to = spot(i);
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    b.from = from; b.to = to; b.at = i; b.t = 0;
    b.peak = 46 + 0.12 * d;
    b.T = Math.sqrt((8 * b.peak) / G) * 1.05;
    b.flying = true;
    const c = cellOf(i);
    if (c) { c.classList.remove('kick'); void c.offsetWidth; c.classList.add('kick'); }
    post({ type: 'press' });
  }

  return {
    hop(i) {
      if (b.flying || b.load) { b.queued = i; return; }
      b.load = { to: i, t: 0, cell: cellOf(b.at) };
      if (b.load.cell) b.load.cell.classList.add('load');
    },
    place(i) { b.at = i; b.x = null; },
    mark(i) { [...dock.querySelectorAll('.cell')].forEach((c) => c.classList.toggle('on', Number(c.dataset.i) === i)); },
    /** Who is at cell i: [{ color, here }]. A cell with anyone here bobs. */
    people(i, list) {
      const c = cellOf(i);
      if (!c) return;
      c.querySelector('.dots').innerHTML = list.slice(0, 6).map((p) => `<i class="${p.here ? '' : 'later'}" style="--dc:${p.color}"></i>`).join('');
      c.classList.toggle('busy', list.some((p) => p.here));
    },
    step(dt) {
      if (b.x == null) { const s = spot(b.at); b.x = s.x; b.y = s.y; b.rest = s.y; }
      if (b.load) {
        b.load.t += dt;
        const k = Math.min(1, b.load.t / 0.13);
        b.squash = 0.18 * k;
        if (k >= 1) { const l = b.load; b.load = null; if (l.cell) l.cell.classList.remove('load'); launch(l.to); }
        return;
      }
      if (b.flying) {
        b.t += dt;
        const k = Math.min(1, b.t / b.T);
        b.x = b.from.x + (b.to.x - b.from.x) * k;
        b.y = b.from.y + (b.to.y - b.from.y) * k - b.peak * 4 * k * (1 - k);
        b.rot += ((b.to.x - b.from.x) / b.T) * dt / 12;
        if (k >= 1) {
          b.flying = false; b.rest = b.to.y; b.y = b.rest;
          b.vy = -Math.sqrt(2 * G * b.peak) * 0.4; // the landing bounce
          b.squash = 0.3;
          const c = cellOf(b.at);
          if (c) { c.classList.add('land'); setTimeout(() => c.classList.remove('land'), 110); }
          if (b.queued != null) { const q = b.queued; b.queued = null; setTimeout(() => this.hop(q), 60); }
        }
      } else {
        b.vy += G * dt;
        b.y += b.vy * dt;
        if (b.y >= b.rest && b.vy > 0) { const hit = b.vy; b.y = b.rest; b.vy = hit > 120 ? -hit * 0.4 : 0; if (hit > 120) b.squash = Math.min(0.3, hit / 2200); }
      }
      b.squash *= Math.exp(-dt * 14);
    },
    render() {
      if (b.x == null) return;
      $('dball').style.transform = `translate3d(${b.x}px,${b.y}px,0) scale(${1 + b.squash},${1 - b.squash})`;
      $('dball').firstElementChild.style.transform = `rotate(${b.rot}rad)`;
      const lift = Math.min(1, Math.max(0, (b.rest - b.y) / 90));
      $('dshadow').style.transform = `translate3d(${b.x}px,${(b.flying ? b.from.y + (b.to.y - b.from.y) * Math.min(1, b.t / b.T) : b.rest) + 10}px,0) scale(${1 - 0.5 * lift})`;
      $('dshadow').style.opacity = String(1 - 0.6 * lift);
    },
  };
}
