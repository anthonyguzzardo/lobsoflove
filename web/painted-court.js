/* global ART, DT, HALF, SINGLES, solveLaunch, stepBall, call */
// Built with ballistics.js by build-painted-court.mjs. All coordinates are metres
// until projection; the illustration stays fixed while ball and poses move.
const $ = (id) => document.getElementById(id);
const canvas = $('court');
const ctx = canvas.getContext('2d');
const scene = $('scene');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const post = (message) => window.ReactNativeWebView?.postMessage(JSON.stringify(message));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { phase: 'intro', paused: false, feeds: 0, hits: 0, landed: 0, clean: 0, ball: null, age: 0, wait: 0, swing: 10, held: false, aim: 0, playerX: 0, targetX: 0, trail: [], marks: [], callTime: 0, sound: false, time: 0 };
let width = 0, height = 0, scale = 1, offsetX = 0, offsetY = 0;
let background, poses, audio, last = 0, accumulator = 0, pointer = null;

function resize() {
  width = scene.clientWidth; height = scene.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scale = Math.max(width / 941, height / 1672);
  offsetX = (width - 941 * scale) / 2; offsetY = (height - 1672 * scale) / 2;
}
new ResizeObserver(resize).observe(scene);

// Perspective calibrated against the plate's baseline and net, independent of viewport.
function project(x, y, z) {
  const depth = clamp((HALF - z) / (HALF * 2), -.07, 1.15);
  const perspective = depth / (.28 + .72 * depth);
  const halfWidth = lerp(660, 225, perspective);
  return { x: 488 + x / SINGLES * halfWidth, y: lerp(1390, 500, perspective) - y * halfWidth / SINGLES, unit: halfWidth / SINGLES };
}

function announce(text) {
  $('call').textContent = text;
  $('call').classList.add('show');
  state.callTime = 1.5;
}

function sound(kind) {
  if (!state.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    const frequency = kind === 'hit' ? 580 : kind === 'bounce' ? 220 : 390;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(90, audio.currentTime + .09);
    gain.gain.setValueAtTime(kind === 'hit' ? .16 : .07, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .12);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + .13);
  } catch { state.sound = false; $('sound').textContent = 'Sound unavailable'; }
}

function count() { $('count').textContent = `${String(state.feeds).padStart(2, '0')} / 10     ${state.landed} IN COURT`; }

function feed() {
  if (state.feeds >= 10) { finish(); return; }
  state.feeds += 1; state.phase = 'incoming'; state.age = 0; state.trail = [];
  state.held = false; state.aim = 0;
  // A repeatable varied feed, always on the forehand; no random difficulty jumps.
  const x = [1.1, 1.7, .7, 1.4, 2.0][(state.feeds - 1) % 5];
  state.ball = solveLaunch({ x: -.6, y: 1.8, z: -11 }, { x, z: 5.5 }, 14, 100);
  const anticipated = { ...state.ball };
  for (let i = 0; i < 600 && anticipated.z < 9; i++) stepBall(anticipated);
  state.targetX = anticipated.x - 1.55;
  $('instruction').textContent = 'Hold to prepare. Release after the bounce.';
  $('detail').textContent = 'A small sideways drag sends the ball left or right.';
  count(); sound('feed');
}

function start() {
  Object.assign(state, { phase: 'waiting', paused: false, feeds: 0, hits: 0, landed: 0, clean: 0, ball: null, wait: .7, held: false, swing: 10, aim: 0, marks: [], trail: [], playerX: 0, targetX: 0 });
  $('begin').hidden = true; $('pause').hidden = false; $('pause').textContent = 'Pause';
  $('pause').setAttribute('aria-label', 'Pause practice');
  $('instruction').textContent = 'Take your time.';
  $('detail').textContent = 'Hold anywhere on the court. Release as the ball reaches you.';
  $('call').classList.remove('show'); count(); canvas.focus({ preventScroll: true });
}

function finish() {
  state.phase = 'finished'; state.ball = null; state.held = false;
  $('pause').hidden = true; $('begin').hidden = false; $('begin').textContent = 'Another ten';
  $('instruction').textContent = state.landed > 6 ? 'A lovely little rhythm.' : 'An afternoon well spent.';
  $('detail').textContent = `${state.landed} of 10 returned in court. ${state.clean} caught in the sweet spot.`;
  $('count').textContent = 'A LITTLE MORE TENNIS?';
}

function swing() {
  if (state.paused || state.phase !== 'incoming') return;
  state.held = false; state.swing = 0;
  const b = state.ball;
  if (!b || b.bounces === 0 || b.z < 6.5) { announce('Let it come to you'); return; }
  if (b.z > 11.8 || b.y < .15 || b.y > 2.7) { announce('A little earlier'); return; }
  const quality = 1 - Math.min(1, Math.abs(b.z - 9) / 3);
  const aim = clamp(-2.1 + state.aim * 7, -5.5, 5.5);
  const target = { x: aim, z: -8.6 - quality * 1.7 };
  state.ball = solveLaunch({ x: b.x, y: b.y, z: b.z }, target, 20, 170);
  state.phase = 'outgoing'; state.age = 0; state.trail = []; state.hits += 1;
  if (quality > .65) state.clean += 1;
  announce(quality > .65 ? 'Right there.' : 'Away it goes.');
  $('instruction').textContent = 'Watch it travel.';
  $('detail').textContent = 'The next ball comes on its own.';
  sound('hit');
}

function pause(value) {
  if (state.phase === 'intro' || state.phase === 'finished') return;
  state.paused = value; state.held = false; pointer = null;
  $('pause').textContent = value ? 'Resume' : 'Pause';
  $('pause').setAttribute('aria-label', value ? 'Resume practice' : 'Pause practice');
  $('instruction').textContent = value ? 'Stay a while.' : 'Hold to prepare. Release after the bounce.';
  $('detail').textContent = value ? 'Your next shot can wait.' : 'A small sideways drag sends the ball left or right.';
  last = 0; accumulator = 0;
}

$('begin').onclick = start;
$('pause').onclick = () => pause(!state.paused);
$('sound').onclick = () => {
  state.sound = !state.sound;
  $('sound').textContent = state.sound ? 'Sound on' : 'Sound off';
  $('sound').setAttribute('aria-pressed', String(state.sound));
  if (state.sound) sound('bounce');
};
$('back').onclick = () => {
  if (window.ReactNativeWebView) post({ type: 'back' });
  else if (window.parent !== window) window.parent.history.back();
  else { start(); pause(true); }
};
canvas.addEventListener('pointerdown', (event) => {
  if (pointer !== null || state.paused || state.phase !== 'incoming') return;
  pointer = { id: event.pointerId, x: event.clientX };
  canvas.setPointerCapture(event.pointerId);
  state.held = true; state.aim = 0;
  if (audio && state.sound) void audio.resume();
});
canvas.addEventListener('pointermove', (event) => {
  if (pointer?.id !== event.pointerId) return;
  state.aim = clamp((event.clientX - pointer.x) / (width * .42), -1, 1);
});
canvas.addEventListener('pointerup', (event) => {
  if (pointer?.id !== event.pointerId) return;
  pointer = null; state.held = false; swing();
});
canvas.addEventListener('pointercancel', () => { pointer = null; state.held = false; });
canvas.addEventListener('lostpointercapture', () => { pointer = null; state.held = false; });
canvas.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (state.paused || state.phase !== 'incoming') return;
  if (event.code === 'Space' && !event.repeat) state.held = true;
  if (event.code === 'ArrowLeft') state.aim = clamp(state.aim - .12, -1, 1);
  if (event.code === 'ArrowRight') state.aim = clamp(state.aim + .12, -1, 1);
});
canvas.addEventListener('keyup', (event) => { if (event.code === 'Space' && state.held) { event.preventDefault(); swing(); } });
window.addEventListener('blur', () => pause(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

function tick(dt) {
  if (state.paused) return;
  state.time += dt; state.swing += dt; state.age += dt;
  state.playerX = lerp(state.playerX, state.targetX, 1 - Math.exp(-dt * 5));
  state.callTime -= dt;
  if (state.callTime <= 0) $('call').classList.remove('show');
  if (state.phase === 'waiting') { state.wait -= dt; if (state.wait <= 0) feed(); }
  const b = state.ball;
  if (!b) return;
  const event = stepBall(b, dt * .72);
  if (event === 'bounce') {
    state.marks.push({ x: b.x, z: b.z, time: state.time });
    if (state.marks.length > 20) state.marks.shift();
    sound('bounce');
    if (state.phase === 'incoming' && b.bounces === 1) {
      $('instruction').textContent = 'Here it comes. Release to swing.';
    } else if (state.phase === 'outgoing') {
      const inCourt = b.z < 0 && call(b.x, b.z) === 'IN';
      if (inCourt) state.landed += 1;
      announce(inCourt ? 'Lovely depth.' : Math.abs(b.x) > SINGLES ? 'Just wide.' : 'A little long.');
      count(); state.phase = 'waiting'; state.wait = 1.5;
    }
  }
  if (event === 'net' && state.phase !== 'waiting') {
    announce('Caught the tape.'); state.phase = 'waiting'; state.wait = 1.5;
  }
  if (state.phase === 'incoming' && (b.z > 12.8 || b.bounces > 1)) {
    announce('The next one is yours.'); state.held = false; state.phase = 'waiting'; state.wait = 1;
    $('instruction').textContent = 'Release a little sooner, after the bounce.';
  }
  if (state.phase === 'outgoing' && state.age > 7) { state.phase = 'waiting'; state.wait = 1; }
  if (b.z < -16 || b.z > 17 || b.bounces > 3) state.ball = null;
}

function line(x1, y1, x2, y2, color, thickness = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = thickness;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function net() {
  const left = project(-5.1, 0, 0), right = project(5.1, 0, 0);
  const topL = project(-5.1, 1.07, 0), topR = project(5.1, 1.07, 0);
  ctx.fillStyle = 'rgba(35,43,32,.07)'; ctx.fillRect(left.x, topL.y, right.x - left.x, left.y - topL.y);
  for (let i = 0; i <= 65; i++) {
    const f = i / 65, x = lerp(left.x, right.x, f), sag = Math.sin(f * Math.PI) * 8;
    line(x, topL.y + sag, x + .7, left.y, 'rgba(28,39,29,.65)', 1.1);
  }
  for (let y = topL.y + 9; y < left.y; y += 9) {
    ctx.strokeStyle = 'rgba(28,39,29,.6)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(left.x, y); ctx.quadraticCurveTo(488, y + 12, right.x, y); ctx.stroke();
  }
  ctx.strokeStyle = '#f4e8ce'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(topL.x, topL.y); ctx.quadraticCurveTo(488, topL.y + 16, topR.x, topR.y); ctx.stroke();
  line(left.x - 2, topL.y - 9, left.x - 2, left.y + 5, '#34392d', 5);
  line(right.x + 2, topR.y - 9, right.x + 2, right.y + 5, '#34392d', 5);
}

// Source boxes accommodate the hand-drawn sheet's unequal pose widths. Anchors
// align each player's standing foot, preventing the body jumping between poses.
const frames = [
  { x: 0, w: 570, anchor: 270 },
  { x: 605, w: 455, anchor: 810 },
  { x: 1080, w: 695, anchor: 1400 },
  { x: 1790, w: 382, anchor: 2010 },
];
function player() {
  const p = project(state.playerX, 0, 10.8);
  const moving = Math.abs(state.playerX - state.targetX) > .07;
  const bounce = reduced ? 0 : moving ? Math.sin(state.time * 16) * 4 : Math.sin(state.time * 2) * 1.3;
  const frame = state.swing < .12 ? 2 : state.swing < .58 ? 3 : state.held ? 1 : 0;
  const f = frames[frame], factor = .64;
  ctx.save();
  ctx.fillStyle = 'rgba(34,49,34,.16)';
  ctx.beginPath(); ctx.ellipse(p.x - 45, p.y + 2, 105, 15, -.2, 0, Math.PI * 2); ctx.fill();
  ctx.translate(p.x, p.y + bounce);
  ctx.drawImage(poses, f.x, 0, f.w, 724, -(f.anchor - f.x) * factor, -690 * factor, f.w * factor, 724 * factor);
  ctx.restore();
}

function ball() {
  const b = state.ball;
  if (!b) return;
  const p = project(b.x, b.y, b.z), floor = project(b.x, 0, b.z);
  const radius = clamp(p.unit * .10, 5.5, 13);
  ctx.fillStyle = `rgba(31,51,35,${clamp(.3 - b.y * .06, .08, .3)})`;
  ctx.beginPath(); ctx.ellipse(floor.x, floor.y, radius * (1 + b.y * .16), radius * .38, -.2, 0, Math.PI * 2); ctx.fill();
  if (!reduced && !state.paused) {
    state.trail.push({ x: p.x, y: p.y });
    if (state.trail.length > 5) state.trail.shift();
  }
  if (!reduced) {
    for (let i = 1; i < state.trail.length; i++) {
      const a = state.trail[i - 1], c = state.trail[i];
      line(a.x, a.y, c.x, c.y, `rgba(255,223,49,${i * .09})`, radius * .6);
    }
  }
  ctx.fillStyle = '#f9dc37'; ctx.strokeStyle = '#68592b'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#fff4bf'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(p.x - radius * .65, p.y, radius * .8, -.9, .9); ctx.stroke();
}

function render() {
  ctx.clearRect(0, 0, width, height);
  ctx.save(); ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);
  ctx.drawImage(background, 0, 0, 941, 1672);
  for (const mark of state.marks) {
    const p = project(mark.x, 0, mark.z);
    const age = state.time - mark.time;
    ctx.strokeStyle = `rgba(245,232,201,${Math.max(.08, .45 - age * .02)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 7, 2, -.35, 0, Math.PI * 2); ctx.stroke();
  }
  if (state.ball?.z < 0) ball();
  net(); player();
  if (state.ball?.z >= 0) ball();
  ctx.restore();
}

function animate(now) {
  const elapsed = last ? Math.min((now - last) / 1000, .05) : 0; last = now;
  accumulator += elapsed;
  while (accumulator >= DT) { tick(DT); accumulator -= DT; }
  render(); requestAnimationFrame(animate);
}

function loadImage(src) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; }); }
Promise.all([loadImage(ART.background), loadImage(ART.player)]).then(([bg, sprite]) => {
  background = bg; poses = sprite; resize();
  $('begin').disabled = false; $('begin').textContent = 'Step onto the court';
  if (!window.ReactNativeWebView && window.parent === window) $('back').textContent = 'Reset';
  post({ type: 'ready' }); requestAnimationFrame(animate);
}).catch(() => { $('error').hidden = false; post({ type: 'ready' }); });

// Read-only diagnostics for the browser review; input still goes through real events.
window.courtyardState = () => ({ phase: state.phase, paused: state.paused, feeds: state.feeds, hits: state.hits, landed: state.landed, held: state.held, ball: state.ball ? { x: state.ball.x, y: state.ball.y, z: state.ball.z, bounces: state.ball.bounces } : null });
