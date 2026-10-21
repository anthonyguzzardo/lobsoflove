// Circle to pick. A paper sheet of choices; you draw a loop round the one you mean (a tap works too). Your stroke is ink while
// you draw; on release the pick snaps a red loop round the chosen one, holds it for 0.3 s, then the next sheet slides in.
//
// A step is { title, sub, kind: 'words' | 'swatch' | 'big', opts: [{ label, sub, color }], next(opt, answers) -> step | null }.
// Picking the last step calls done(answers). back() steps back a sheet (the app's back button calls it); on the first, cancel().

const SVGNS = 'http://www.w3.org/2000/svg';

/** Ray-casting point-in-polygon. */
function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function circlePick({ first, done, cancel, post }) {
  const root = document.createElement('div');
  root.id = 'cpick';
  root.innerHTML = '<div class="cp-head"><div class="cp-step"></div></div>'
    + '<div class="cp-title"></div><div class="cp-sub"></div><div class="cp-opts"></div>'
    + `<svg class="cp-ink"><path class="cp-stroke"/><ellipse class="cp-loop" pathLength="600"/></svg>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const stroke = $('.cp-stroke');
  const loop = $('.cp-loop');
  const history = []; // [{ step, answer }]
  let step = first;
  let busy = false;
  let pts = null;

  function render(dir) {
    $('.cp-title').textContent = step.title;
    $('.cp-sub').textContent = step.sub || 'draw a circle round it';
    $('.cp-step').textContent = `STEP ${history.length + 1}`;
    const box = $('.cp-opts');
    box.className = `cp-opts ${step.kind || 'words'}`;
    box.replaceChildren(...step.opts.map((o, k) => {
      const el = document.createElement('div');
      el.className = 'cp-o';
      el.dataset.k = String(k);
      if (o.color) { const dot = document.createElement('i'); dot.style.background = o.color; el.appendChild(dot); }
      const b = document.createElement('b'); b.textContent = o.label; el.appendChild(b);
      if (o.sub) { const s = document.createElement('span'); s.textContent = o.sub; el.appendChild(s); }
      return el;
    }));
    box.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
    stroke.setAttribute('d', '');
    loop.classList.remove('on');
  }

  function choose(k) {
    const o = step.opts[k];
    const el = root.querySelector(`.cp-o[data-k="${k}"]`);
    busy = true;
    const r = el.getBoundingClientRect();
    loop.setAttribute('cx', String(r.left + r.width / 2)); loop.setAttribute('cy', String(r.top + r.height / 2));
    loop.setAttribute('rx', String(r.width / 2 + 10)); loop.setAttribute('ry', String(r.height / 2 + 9));
    loop.classList.add('on');
    stroke.setAttribute('d', '');
    el.classList.add('hit');
    post({ type: 'circled' });
    setTimeout(() => {
      busy = false;
      const answers = [...history.map((h) => h.answer), o];
      const nxt = step.next ? step.next(o, answers) : null;
      if (!nxt) { close(); done(answers); return; }
      history.push({ step, answer: o });
      step = nxt;
      render(1);
    }, 330);
  }

  function close() { root.classList.add('out'); setTimeout(() => root.remove(), 220); }

  function back() {
    if (busy) return;
    post({ type: 'tick' });
    const prev = history.pop();
    if (!prev) { close(); cancel(); return; }
    step = prev.step;
    render(-1);
  }

  root.addEventListener('pointerdown', (e) => {
    if (busy) return;
    root.setPointerCapture(e.pointerId);
    pts = [[e.clientX, e.clientY]];
    stroke.setAttribute('d', `M${e.clientX} ${e.clientY}`);
  });
  root.addEventListener('pointermove', (e) => {
    if (!pts) return;
    const [lx, ly] = pts[pts.length - 1];
    if (Math.hypot(e.clientX - lx, e.clientY - ly) < 3) return;
    pts.push([e.clientX, e.clientY]);
    stroke.setAttribute('d', `${stroke.getAttribute('d')}L${e.clientX} ${e.clientY}`);
  });
  root.addEventListener('pointerup', () => {
    const p = pts;
    pts = null;
    if (!p || busy) return;
    const xs = p.map((q) => q[0]); const ys = p.map((q) => q[1]);
    const w = Math.max(...xs) - Math.min(...xs); const h = Math.max(...ys) - Math.min(...ys);
    const opts = [...root.querySelectorAll('.cp-o')];
    const centers = opts.map((el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    // A tap: whatever is under the finger.
    if (Math.hypot(w, h) < 26) {
      const k = opts.findIndex((el) => { const r = el.getBoundingClientRect(); return p[0][0] >= r.left && p[0][0] <= r.right && p[0][1] >= r.top && p[0][1] <= r.bottom; });
      if (k >= 0) choose(k); else stroke.setAttribute('d', '');
      return;
    }
    // A loop: the choice whose middle is inside it, nearest the loop's middle if it caught more than one. A loose loop that
    // caught none still counts if a choice sits close to its middle.
    const cx = xs.reduce((a, b) => a + b, 0) / p.length; const cy = ys.reduce((a, b) => a + b, 0) / p.length;
    let best = -1; let bestD = Infinity;
    centers.forEach(([x, y], k) => {
      const d = Math.hypot(x - cx, y - cy);
      if ((inside(p, x, y) || d < 50) && d < bestD) { best = k; bestD = d; }
    });
    if (best >= 0) choose(best);
    else { stroke.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240 }).onfinish = () => stroke.setAttribute('d', ''); }
  });

  render(1);
  return { back };
}
