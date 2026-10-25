// The racket handoff and the leave question, drawn over a page's own scene: the legend from the gear page rises in from the
// bottom, reaches behind his back and holds out a racket. Under him, one card: a status line and big buttons.
//
// - offer: he holds out the racket you used last. PLAY <NAME> confirms; your other rackets are name chips, and tapping one makes
//   him put this one away and pull that one out. Each choice posts { type: 'racket', session, id }.
// - ask: you stepped off. He holds up the racket you played with; MATCH or JUST HIT posts { type: 'kind', session, kind }.
//   NOT NOW posts { type: 'kind', session, kind: null }.
//
// Motion (same numbers as the gear page): he rises on a spring (2.2 Hz, ratio 0.6) from below the screen; pull out 0.85 s (0-0.3 s
// the hand goes behind his back, it comes out spinning once and swings up with a little overshoot); put away 0.5 s, the reverse.
// Confirming tosses the racket down to you (0.45 s arc) and he sinks out (2.6 Hz, ratio 1).
//
// Fit: nothing he holds may leave the screen. Each frame his outline, racket included, is measured on screen; if it would cross
// the band between the top controls (safe area + 64 px) and the card, he shrinks at once, and grows back slowly.
import * as THREE from 'three';

import { designOf, stringColor } from './gear-catalog.js';
import { CLAY, INK, V, buildLegend, headGeos, inkKit, setArms, smooth } from './legend.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nameOf = (r) => (r ? r.nick || r.name : '');

function spring1(s, target, dt, hz, ratio) { const w = hz * TAU; s.v += (-w * w * (s.x - target) - 2 * ratio * w * s.v) * dt; s.x += s.v * dt; }

export function createHandoff({ renderer, post }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0.5, 11);
  camera.lookAt(0, 0.5, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a958a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-4, 7, 5);
  scene.add(sun);
  const kit = inkKit();
  const { toon, inked, LINE } = kit;

  // A paper wash behind him, so he reads over the busy court.
  const washMat = new THREE.ShaderMaterial({
    uniforms: { a: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float a; varying vec2 vUv; void main(){ gl_FragColor = vec4(0.937, 0.925, 0.898, a * (0.15 + 0.3 * smoothstep(0.1, 0.6, vUv.y))); }',
    transparent: true, depthTest: false, depthWrite: false,
  });
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), washMat);
  wash.frustumCulled = false;
  const washScene = new THREE.Scene(); // drawn first, in its own pass, so it never covers him
  washScene.add(wash);

  const carrier = new THREE.Group();
  const fig = buildLegend({ toon, inked, LINE });
  carrier.add(fig.L);
  scene.add(carrier);

  // The racket he holds: frame in its model's paint, string bed browning with wear.
  const bedCv = document.createElement('canvas');
  bedCv.width = 256; bedCv.height = 320;
  const bedTex = new THREE.CanvasTexture(bedCv);
  bedTex.colorSpace = THREE.SRGBColorSpace;
  const paintCv = document.createElement('canvas');
  paintCv.width = 1024; paintCv.height = 64;
  const paintTex = new THREE.CanvasTexture(paintCv);
  paintTex.colorSpace = THREE.SRGBColorSpace;
  const paint = toon(0xffffff, { map: paintTex });
  const throat = toon(0xf4f1ea);
  const dark = toon(0x2a2c31);
  const grip = toon(0x2a2c31);
  const racket = (() => {
    const body = new THREE.Group();
    const geo = headGeos('oval');
    const frame = inked(new THREE.Mesh(geo.frame, paint), LINE.thin);
    body.add(frame);
    const bed = new THREE.Mesh(geo.bed, new THREE.MeshBasicMaterial({ map: bedTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    bed.scale.set(0.31, 0.41, 1);
    body.add(bed);
    for (const s of [-1, 1]) {
      const a = V(s * 0.2, 0.37, 0); const b = V(s * 0.045, 0.8, 0);
      const arm = inked(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, a.distanceTo(b), 8), throat), LINE.thin);
      arm.position.copy(a).add(b).multiplyScalar(0.5);
      arm.rotation.z = -Math.atan2(b.x - a.x, b.y - a.y);
      body.add(arm);
    }
    const piece = (geo2, m, y) => { const x = inked(new THREE.Mesh(geo2, m), LINE.thin); x.position.y = y; body.add(x); return x; };
    piece(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 8), throat, 0.86);
    piece(new THREE.CylinderGeometry(0.054, 0.056, 0.62, 8), grip, 1.22);
    piece(new THREE.CylinderGeometry(0.062, 0.058, 0.05, 10), dark, 1.55);
    body.rotation.z = Math.PI; // head up
    body.position.y = 1.6; // butt in his hand
    const g = new THREE.Group();
    g.add(body);
    g.visible = false;
    return { g, body, frame, bed, head: 'oval' };
  })();
  fig.L.add(racket.g);

  function dress(r) {
    // The same design data the gear page draws from (web/lib/designs/SCHEMA.md): base, blocks by clock position, the groove
    // line, a gloss streak, grip and cap. The wordmark and arm stripes are left to the gear page.
    const d = designOf(r && (r.model || r.name), r && r.brand, r && r.gen);
    const pg = paintCv.getContext('2d');
    const W = paintCv.width; const H = paintCv.height;
    const clockU = (c) => ((((6 - c) / 12) % 1) + 1) % 1;
    const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();
    pg.fillStyle = d.base; pg.fillRect(0, 0, W, H);
    for (const z of d.zones || []) {
      const span = ((((z.to - z.from) % 12) + 12) % 12) || 12;
      const cols = Math.ceil((span / 12) * W);
      for (let i = 0; i <= cols; i += 1) { pg.fillStyle = z.fade ? mix(z.color, z.fade, i / cols) : z.color; pg.fillRect(Math.floor(clockU(z.from + span * (i / cols)) * W) - 1, 0, 3, H); }
    }
    if (d.band) { pg.fillStyle = d.band; pg.fillRect(W * 0.36, 0, W * 0.28, H); } // older flat designs: a band over the top
    if (d.bridge) { pg.fillStyle = d.bridge; const half = Math.ceil(W / 24); pg.fillRect(0, 0, half, H); pg.fillRect(W - half, 0, half, H); }
    if (d.bumper) { pg.fillStyle = d.bumper; pg.fillRect(0, 42, W, 18); }
    if (d.pin) { pg.fillStyle = d.pin; pg.fillRect(0, 40, W, 3); }
    if (d.finish === 'gloss') { pg.fillStyle = 'rgba(255,255,255,.32)'; pg.fillRect(0, 24, W, 4); }
    paintTex.needsUpdate = true;
    throat.color.set(d.throat || d.base);
    grip.color.set(d.grip || '#2a2c31');
    dark.color.set(d.cap || '#2a2c31');
    if (racket.head !== d.head) {
      const geo = headGeos(d.head);
      racket.frame.geometry = geo.frame;
      racket.frame.children[0].geometry = geo.frame;
      racket.bed.geometry = geo.bed;
      racket.head = d.head;
    }
    const worn = clamp((r && r.worn) || 0, 0, 1);
    const col = new THREE.Color(stringColor(r && r.string)).lerp(new THREE.Color('#9c7f4a'), worn).getStyle();
    const g = bedCv.getContext('2d');
    g.clearRect(0, 0, 256, 320);
    g.strokeStyle = col; g.lineWidth = 4.5; g.lineCap = 'round';
    for (let x = 14; x < 256; x += 19) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 320); g.stroke(); }
    for (let y = 14; y < 320; y += 19) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    bedTex.needsUpdate = true;
  }

  // ---------- The card ----------
  const card = document.createElement('div');
  card.id = 'hand';
  document.body.appendChild(card);

  const st = {
    mode: null, // 'offer' | 'ask' | null
    session: null,
    list: [],
    idx: 0,
    venue: '',
    rise: { x: 0, v: 0 },
    show: null, // { idx, t, phase: 'in' | 'held' | 'out', then }
    toss: null, // { t } the racket flying down to you after a confirm
    leaving: false,
    clock: 0,
    fit: { s: 1, x: 0, y: 0 },
    laugh: 0,
  };

  function drawCard() {
    if (!st.mode) { card.innerHTML = ''; card.classList.remove('on'); return; }
    // Answered: the card drops away at once instead of sitting there greyed out while he goes.
    card.classList.toggle('on', !st.leaving);
    if (st.leaving) return;
    const r = st.list[st.idx];
    if (st.mode === 'offer') {
      const chips = st.list.map((x, k) => (k === st.idx ? '' : `<button data-a="pick" data-i="${k}" class="chip">${esc(nameOf(x))}</button>`)).join('');
      card.innerHTML = `<div class="say">${st.leaving ? `PLAYING WITH ${esc(nameOf(r))}.` : `LANDED AT ${esc(st.venue)}. HE HAS ${esc(nameOf(r))}.`}</div>`
        + `<button data-a="ok" class="main">PLAY ${esc(nameOf(r))}</button>`
        + (chips ? `<div class="chips"><span>OR</span>${chips}</div>` : '');
    } else {
      card.innerHTML = `<div class="say">DONE AT ${esc(st.venue)}${r ? ` WITH ${esc(nameOf(r))}` : ''}.</div>`
        + '<div class="two"><button data-a="match" class="main">MATCH</button><button data-a="hit" class="main alt">JUST HIT</button></div>'
        + '<button data-a="later" class="small">NOT NOW</button>';
    }
    card.querySelectorAll('button').forEach((b) => { b.disabled = st.leaving; });
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || !st.mode) return;
    const a = b.dataset.a;
    if (a === 'pick') {
      const i = Number(b.dataset.i);
      if (i === st.idx) return;
      st.idx = i;
      pullOut(i);
      post({ type: 'racket', session: st.session, id: st.list[i].id, swap: true });
      drawCard();
      return;
    }
    if (a === 'ok') {
      post({ type: 'racket', session: st.session, id: st.list[st.idx].id });
      st.toss = { t: 0 };
      leave();
      return;
    }
    if (a === 'match' || a === 'hit' || a === 'later') {
      post({ type: 'kind', session: st.session, kind: a === 'later' ? null : a });
      if (a === 'hit') st.laugh = 0.8;
      leave();
    }
  });

  function leave() { st.leaving = true; drawCard(); post({ type: 'handoff', open: false }); }

  function pullOut(idx) {
    if (st.show && st.show.phase !== 'out') { st.show.phase = 'out'; st.show.t = 0; st.show.then = idx; post({ type: 'fling' }); return; }
    if (st.show && st.show.phase === 'out') { st.show.then = idx; return; }
    st.show = { idx, t: 0, phase: 'in', then: null };
    dress(st.list[idx]);
    post({ type: 'reach' });
  }

  function open(mode, d) {
    st.mode = mode;
    st.session = d.session;
    st.list = d.rackets || [];
    st.idx = Math.max(0, st.list.findIndex((r) => r.id === d.pick));
    st.venue = String(d.venue || '').toUpperCase();
    st.leaving = false;
    st.toss = null;
    st.show = null;
    st.laugh = 0;
    if (st.rise.x < 0.05) { st.rise.x = 0; st.rise.v = 0; }
    document.body.classList.add('handing');
    post({ type: 'handoff', open: true });
    // He is up and settled before he reaches.
    setTimeout(() => { if (st.mode === mode && st.list.length && !st.show) pullOut(st.idx); }, 260);
    drawCard();
  }

  function close() {
    st.mode = null;
    st.show = null;
    st.toss = null;
    st.leaving = false;
    document.body.classList.remove('handing');
    drawCard();
  }

  // ---------- Motion ----------
  const handW = new THREE.Vector3();
  function step(dt) {
    st.clock += dt;
    st.laugh = Math.max(0, st.laugh - dt);
    const up = st.mode && !st.leaving ? 1 : 0;
    spring1(st.rise, up, dt, up ? 2.2 : 2.6, up ? 0.6 : 1);
    if (st.mode && st.leaving && st.rise.x < 0.02 && (!st.toss || st.toss.t > 0.45)) close();
    if (st.toss) st.toss.t += dt;
    const sh = st.show;
    let from = 'crossed'; let to = 'crossed'; let k = 0;
    if (sh) {
      sh.t += dt;
      if (sh.phase === 'in' && sh.t >= 0.85) sh.phase = 'held';
      if (sh.phase === 'out' && sh.t >= 0.5) {
        const then = sh.then;
        st.show = null;
        if (then != null) pullOut(then);
      }
    }
    const s2 = st.show;
    if (s2 && s2.phase === 'in') {
      if (s2.t < 0.3) { from = 'crossed'; to = 'behind'; k = smooth(s2.t / 0.3); } else { const u = smooth((s2.t - 0.3) / 0.45); from = 'behind'; to = 'present'; k = u + 0.12 * Math.sin(Math.PI * u); }
    } else if (s2 && s2.phase === 'out') {
      if (s2.t < 0.3) { from = 'present'; to = 'behind'; k = smooth(s2.t / 0.3); } else { from = 'behind'; to = 'crossed'; k = smooth((s2.t - 0.3) / 0.2); }
    } else if (s2) { from = 'present'; to = 'present'; k = 1; }
    setArms(fig.arms, from, to, k);
    // The racket in his hand once it has come out from behind his back.
    const out = s2 && (s2.phase === 'in' ? s2.t >= 0.3 : s2.phase === 'held' || s2.t < 0.3);
    racket.g.visible = !!out && !(st.toss && st.toss.t > 0);
    if (out) {
      const spin = s2.phase === 'in' ? TAU * (1 - smooth((s2.t - 0.3) / 0.55)) : 0;
      const grow = s2.phase === 'in' ? 0.25 + 0.75 * smooth((s2.t - 0.3) / 0.3) : s2.phase === 'out' ? 1 - smooth(s2.t / 0.3) : 1;
      racket.g.position.copy(fig.arms[1].hand.position);
      racket.g.rotation.set(0, spin + 0.12 * Math.sin(st.clock * 0.9), 0.22 + 0.04 * Math.sin(st.clock * 1.3));
      racket.g.scale.setScalar(0.9 * Math.max(0.05, grow));
    }
  }

  // The tossed racket: a copy that arcs from his hand down past the card, toward you.
  const tossed = racket.g.clone();
  tossed.visible = false;
  scene.add(tossed);
  const tossFrom = new THREE.Vector3();

  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  /** His outline on screen, racket included: [top, bottom, left, right] in px. */
  function rect() {
    let top = Infinity; let bottom = -Infinity; let left = Infinity; let right = -Infinity;
    carrier.updateMatrixWorld(true);
    carrier.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry || o.material.visible === false) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.copy(o.geometry.boundingBox);
      for (let n = 0; n < 8; n += 1) {
        p.set(n & 1 ? box.max.x : box.min.x, n & 2 ? box.max.y : box.min.y, n & 4 ? box.max.z : box.min.z).applyMatrix4(o.matrixWorld).project(camera);
        const x = (p.x * 0.5 + 0.5) * window.innerWidth; const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
        top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
      }
    });
    return [top, bottom, left, right];
  }
  const safeProbe = document.createElement('div');
  safeProbe.className = 'safeprobe'; // stills set its height to fake a phone's inset
  safeProbe.style.cssText = 'position:fixed;top:0;left:0;height:env(safe-area-inset-top);width:0;pointer-events:none;visibility:hidden';
  document.body.appendChild(safeProbe);

  function pose() {
    const W = window.innerWidth; const H = window.innerHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    washMat.uniforms.a.value = clamp(st.rise.x, 0, 1);
    if (!st.mode && st.rise.x < 0.01) return;
    const t = st.clock;
    // Face and breath, as on the gear page.
    const lg = st.laugh > 0;
    fig.head.rotation.set(-0.16 + 0.03 * Math.sin(t * 0.8) + (lg ? 0.08 * Math.sin(t * 34) : 0), 0.12 * Math.sin(t * 0.37), 0.06 * Math.sin(t * 0.6));
    fig.brows[1].position.y = 0.12 + (t % 4.3 < 0.4 ? 0.04 : 0);
    fig.torso.scale.set(1, 1 + 0.02 * Math.sin(t * 1.9), 1);
    fig.smirk.visible = !lg; fig.grin.visible = lg;
    fig.L.position.y = 0.05 * Math.sin(t * (TAU / 4.6)) + (lg ? 0.03 * Math.abs(Math.sin(t * 17)) : 0);
    // Fit him in the band between the top controls and the card.
    const band0 = safeProbe.getBoundingClientRect().height + 64;
    const cardTop = card.classList.contains('on') ? card.getBoundingClientRect().top : H;
    const band1 = cardTop - 12;
    const fit = st.fit;
    carrier.scale.setScalar(fit.s);
    carrier.position.set(fit.x, fit.y, 0);
    const [top, bottom, left, right] = rect();
    if (Number.isFinite(top) && bottom - top > 10) {
      // He takes at most 60% of the band's height: a figure over the court, not a wall in front of it.
      const wantS = clamp(fit.s * Math.min((0.6 * (band1 - band0)) / (bottom - top), (W - 32) / (right - left)), 0.2, 1);
      // While a racket is going behind his back or coming out, he keeps his size and place (only ever shrinking to fit), so a
      // swap does not make him swell and jump.
      const settled = !st.leaving && (!st.show || st.show.phase === 'held');
      const pxPerUnit = H / (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      if (wantS < fit.s) fit.s = wantS; else if (settled) fit.s += (wantS - fit.s) * 0.04;
      if (settled) {
        // His wisp ends just over the card, so he stands up out of it.
        const target = band1 - 8 - (bottom - top) / 2;
        fit.y -= ((target - (top + bottom) / 2) / pxPerUnit) * 0.25;
        fit.x -= (((left + right) / 2 - W / 2) / pxPerUnit) * 0.25;
      }
      if (top < band0) fit.y -= (band0 - top) / pxPerUnit; // never above the line, not even for a frame
      if (bottom > band1) fit.y += (bottom - band1) / pxPerUnit; // nor into the card
    }
    carrier.position.x = fit.x;
    carrier.scale.setScalar(fit.s);
    // Rising in from (and sinking back to) below the screen.
    carrier.position.y = fit.y - (1 - clamp(st.rise.x, -0.2, 1.2)) * 9;
    // The toss.
    tossed.visible = !!(st.toss && st.toss.t > 0 && st.toss.t < 0.45);
    if (tossed.visible) {
      if (!tossFrom.lengthSq()) racket.g.getWorldPosition(tossFrom);
      const u = st.toss.t / 0.45;
      tossed.position.copy(tossFrom).lerp(V(0, -6, 2), u * u);
      tossed.position.y += 1.2 * Math.sin(Math.PI * u);
      tossed.rotation.set(0, 0, 0.22 + u * TAU * 1.5);
      tossed.scale.setScalar(0.9 * fit.s);
    } else tossFrom.set(0, 0, 0);
  }

  function render() {
    if (!st.mode && st.rise.x < 0.01) return;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(washScene, camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = auto;
  }

  /** The app's back button: an offer keeps the racket he is holding; the question counts as NOT NOW, so it is not asked again. */
  function dismiss() {
    if (!st.mode || st.leaving) return;
    if (st.mode === 'offer' && st.list[st.idx]) post({ type: 'racket', session: st.session, id: st.list[st.idx].id });
    else if (st.mode === 'ask') post({ type: 'kind', session: st.session, kind: null });
    leave();
  }

  return {
    dismiss,
    offer: (d) => open('offer', d),
    ask: (d) => open('ask', d),
    close,
    step,
    pose,
    render,
    get active() { return !!st.mode; },
    state: st,
    INK,
    CLAY,
  };
}
