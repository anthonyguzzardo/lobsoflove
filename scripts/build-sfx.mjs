// Synthesizes every UI sound in code (no samples) into assets/sfx/*.wav. Run: node scripts/build-sfx.mjs
import { writeFileSync } from 'node:fs';

const SR = 44100;
const TAU = Math.PI * 2;

function render(seconds, fn) {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = fn(i / SR, i);
  // 2 ms raised-cosine fades so no file starts or ends on a step.
  const f = Math.round(0.002 * SR);
  for (let i = 0; i < f; i += 1) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / f);
    out[i] *= g;
    out[n - 1 - i] *= g;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = 0.89 / (peak || 1); // -1 dBFS peak
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * gain)) * 32767), 44 + i * 2);
  return buf;
}

let seed = 7;
const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

const sounds = {
  // Cursor move: a short felt tick, like a ball off strings.
  tick: render(0.07, (t) => Math.sin(TAU * (1900 - 9000 * t) * t) * env(t, 0.001, 0.012) + noise() * 0.25 * env(t, 0.0005, 0.004)),
  // Fighter select: two rising notes, a fifth apart.
  select: render(0.26, (t) => {
    const a = Math.sin(TAU * 660 * t) * env(t, 0.003, 0.07);
    const u = t - 0.075;
    const b = u > 0 ? (Math.sin(TAU * 990 * u) + 0.3 * Math.sin(TAU * 1980 * u)) * env(u, 0.003, 0.09) : 0;
    return a * 0.8 + b;
  }),
  // Slam-in: pitch-dropping thump plus a noise crack, for the fighter landing.
  slam: render(0.5, (t) => {
    const f = 46 + 150 * Math.exp(-t / 0.035);
    let ph = 0; // closed-form phase of the exponential sweep
    ph = TAU * (46 * t + 150 * 0.035 * (1 - Math.exp(-t / 0.035)));
    return Math.sin(ph) * env(t, 0.002, 0.16) + noise() * 0.5 * env(t, 0.0005, 0.02) + Math.sin(TAU * f * 2 * t) * 0.0;
  }),
  // Challenge: a whoosh up into a bright hit.
  go: render(0.55, (t) => {
    const sweep = Math.sin(TAU * (220 * t + 900 * t * t)) * Math.min(1, t / 0.22) * (t < 0.24 ? 1 : Math.exp(-(t - 0.24) / 0.03)) * 0.5;
    const u = t - 0.24;
    const hit = u > 0 ? (Math.sin(TAU * 880 * u) + 0.5 * Math.sin(TAU * 1320 * u) + 0.25 * Math.sin(TAU * 1760 * u)) * env(u, 0.002, 0.12) : 0;
    return sweep + hit;
  }),
  // Stage swipe: soft filtered swish.
  swish: render(0.16, (t, i) => { const n = noise(); return (n + (i ? 0 : 0)) * Math.sin(Math.PI * Math.min(1, t / 0.16)) ** 2 * 0.6 * Math.sin(TAU * 520 * t + n); }),
  // Match saved: three-note arpeggio, major triad.
  win: render(0.7, (t) => [523.25, 659.25, 783.99, 1046.5].reduce((s, f, k) => { const u = t - k * 0.085; return u > 0 ? s + (Math.sin(TAU * f * u) + 0.25 * Math.sin(TAU * f * 2 * u)) * env(u, 0.003, 0.16) : s; }, 0)),
  // Jelly: a wet pop, pitch rising 220 to 620 Hz in 70 ms, for a body pouring back up.
  bloop: render(0.2, (t) => { const ph = TAU * (620 * t - 400 * 0.025 * (1 - Math.exp(-t / 0.025))); return (Math.sin(ph) + 0.2 * Math.sin(2 * ph)) * env(t, 0.002, 0.06); }),
  // Jelly slumping: a low sliding wobble with a little wet noise.
  squish: render(0.24, (t) => (Math.sin(TAU * (160 * t - 220 * t * t)) * (1 + 0.35 * Math.sin(TAU * 14 * t)) + noise() * 0.18) * env(t, 0.008, 0.07)),
  // Paint drop landing: a falling plink.
  drip: render(0.13, (t) => { const ph = TAU * (600 * t + 900 * 0.03 * (1 - Math.exp(-t / 0.03))); return Math.sin(ph) * env(t, 0.001, 0.035); }),
  // Poke: a short rubbery boing with a decaying 18 Hz wobble.
  boing: render(0.32, (t) => Math.sin(TAU * 300 * t + 3 * Math.exp(-t / 0.12) * Math.sin(TAU * 18 * t)) * env(t, 0.002, 0.11)),
};

for (const [name, buf] of Object.entries(sounds)) writeFileSync(new URL(`../assets/sfx/${name}.wav`, import.meta.url), buf);
console.log(Object.entries(sounds).map(([n, b]) => `${n} ${(b.length / 1024).toFixed(0)}kB`).join(', '));
