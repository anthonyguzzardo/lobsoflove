/* Deterministic canvas art study. No assets or libraries required. */
(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  const play = document.querySelector('#play');
  const slider = document.querySelector('#time');
  const speed = document.querySelector('#speed');
  const phase = document.querySelector('#phase');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let running = !reduce.matches;
  let elapsed = 0;
  let previous = performance.now();
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pieces = Array.from({length: 480}, (_, i) => ({
    part: i % 8, a: rand() * Math.PI * 2, r: Math.sqrt(rand()),
    dx: (rand() - .5) * 220, dy: (rand() - .5) * 180,
    twist: rand() * 9, size: 1 + rand() * 2, accent: rand() > .88,
  }));
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  function pose(t) {
    const punch = smooth((t - 1.1) / .18) * (1 - smooth((t - 1.5) / .45));
    const scatter = smooth((t - 2.1) / .25) * (1 - smooth((t - 2.85) / 1.1));
    const bob = Math.sin(t * 8) * 3 * (1 - scatter);
    return {punch, scatter, bob, parts: [
      [182 + punch * 12, 126 + bob, 35, 33],
      [180 + punch * 10, 192 + bob, 26, 38],
      [134, 191 + bob, 23, 25],
      [224 + punch * 72, 176 - punch * 43 + bob, 27 + punch * 6, 26],
      [153, 251, 13, 32], [205, 252, 13, 32],
      [141, 285, 30, 13], [221, 285, 31, 13],
    ]};
  }
  function draw(canvas, mode, t) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const side = Math.round(canvas.clientWidth * dpr);
    if (canvas.width !== side) canvas.width = canvas.height = side;
    ctx.setTransform(side / 380, 0, 0, side / 380, 0, 0);
    ctx.clearRect(0, 0, 380, 380);
    const {punch, scatter, bob, parts} = pose(t);
    ctx.fillStyle = mode === 2 ? '#ffffff0c' : '#2828200c';
    ctx.beginPath(); ctx.ellipse(185, 306, 90 + scatter * 25, 8, 0, 0, Math.PI * 2); ctx.fill();
    // Stretching connectors keep the pose readable between clustered pieces.
    ctx.strokeStyle = mode === 2 ? '#dfc27a66' : '#30312c';
    ctx.lineWidth = mode === 0 ? 3 : 5;
    ctx.globalAlpha = 1 - scatter;
    for (const [from, to] of [[1, 2], [1, 3], [1, 4], [1, 5]]) {
      ctx.beginPath(); ctx.moveTo(parts[from][0], parts[from][1]);
      ctx.quadraticCurveTo(parts[to][0] - 15, parts[from][1] + 10, parts[to][0], parts[to][1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i]; const [cx, cy, rx, ry] = parts[p.part];
      const late = i === 41 ? smooth((t - 2.1) / .2) * (1 - smooth((t - 4.1) / .55)) : scatter;
      let x = cx + Math.cos(p.a) * rx * p.r + p.dx * late;
      let y = cy + Math.sin(p.a) * ry * p.r + p.dy * late + 35 * Math.sin(late * Math.PI);
      if (mode === 0) {
        ctx.strokeStyle = p.accent ? '#ce5139' : '#292b28';
        ctx.lineWidth = p.accent ? 1.8 : 1.05;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = p.a + k * .55 + late * p.twist;
          const xx = x + Math.cos(a) * (5 + p.size * 2 + late * 5);
          const yy = y + Math.sin(a) * (3 + p.size);
          if (!k) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      } else if (mode === 1) {
        x = Math.round(x / 6) * 6; y = Math.round(y / 6) * 6;
        ctx.fillStyle = p.accent ? '#cd5139' : i % 3 ? '#363d3b' : '#738078';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      } else {
        const shimmer = .55 + .45 * Math.sin(t * 6 + p.twist * 10);
        ctx.fillStyle = p.accent ? '#f4a07e' : i % 3 ? '#e9cc89' : '#b9ddd7';
        ctx.globalAlpha = .55 + shimmer * .45;
        ctx.beginPath(); ctx.arc(x, y, p.size * .7, 0, Math.PI * 2); ctx.fill();
        if (i % 31 === 0) {
          ctx.strokeStyle = '#fff7d8'; ctx.lineWidth = .7; const r = 2 + shimmer * 3;
          ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    // The eyes remain together when the rest of the fighter falls apart.
    const ex = parts[0][0] + scatter * 22, ey = parts[0][1] + scatter * 48;
    for (const direction of [-1, 1]) {
      ctx.save(); ctx.translate(ex + direction * 13, ey); ctx.rotate(direction * -.18);
      ctx.fillStyle = '#fcf5de'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 14 - scatter * 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#252925'; ctx.beginPath(); ctx.ellipse(4 + punch * 2, 1, 4, 6 - scatter * 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#252925'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-12, -14 + direction * 3); ctx.lineTo(12, -10 - direction * 3); ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = mode === 2 ? '#f4a07e' : '#ce5139'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ex, ey - 32); ctx.bezierCurveTo(ex - 25, ey - 56, ex + 25 + Math.sin(t * 5) * 8, ey - 66, ex + 12, ey - 45); ctx.stroke();
  }
  function sync() { play.textContent = running ? 'Pause' : 'Play'; }
  play.onclick = () => { running = !running; sync(); };
  document.querySelector('#restart').onclick = () => { elapsed = 0; };
  slider.oninput = () => { elapsed = Number(slider.value); running = false; sync(); };
  reduce.addEventListener('change', () => { if (reduce.matches) { running = false; sync(); } });
  function frame(now) {
    if (running && !document.hidden) elapsed = (elapsed + Math.min(now - previous, 60) * Number(speed.value)) % 5000;
    previous = now;
    const t = elapsed / 1000;
    canvases.forEach((canvas, i) => draw(canvas, i, t));
    slider.value = String(Math.round(elapsed));
    phase.value = t < 1.1 ? 'Ready' : t < 2.1 ? 'Big swing' : t < 2.85 ? 'Unravel' : t < 4 ? 'Reform' : 'Late arrival';
    requestAnimationFrame(frame);
  }
  sync(); requestAnimationFrame(frame);
})();
