// What the legend flings into the air, drawn as stickers: no boxes, just the thing with a paper halo round it so it reads over
// the scene. Brand names get their own lettering, numbers are big condensed numerals, colors are paint blobs, strings are coils.
// Every draw returns { canvas, w, h }: w and h are the size on screen in CSS px; the canvas is drawn at 2x.

const INK = '#16181d';
const PAPER = '#fffdf8';
const CLAY = '#e2562f';

function sheet(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g, w, h);
  return { canvas: c, w, h };
}

/** Lettering with a fat paper halo, sized to fit the width. */
function letter(g, text, x, y, font, size, maxW, { fill = INK, halo = 9, spacing = 0 } = {}) {
  let s = size;
  g.font = font.replace('#', `${s}px`);
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  while (g.measureText(text).width > maxW && s > 10) { s -= 2; g.font = font.replace('#', `${s}px`); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = PAPER; g.lineWidth = halo; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
  return { w: g.measureText(text).width, s };
}

// Each brand its own lettering and one mark: our own drawing, not their logos.
const BRAND = {
  BABOLAT: { font: 'italic 900 # Futura, "Avenir Next", sans-serif', mark: 'slash' },
  WILSON: { font: '800 # "Avenir Next Condensed", "Arial Narrow", sans-serif', mark: 'bar', spacing: 2 },
  HEAD: { font: '900 # Futura, "Avenir Next", sans-serif', mark: 'none', spacing: 8 },
  YONEX: { font: 'italic 800 # "Avenir Next", sans-serif', mark: 'under' },
  TECNIFIBRE: { font: '800 # "Avenir Next Condensed", "Arial Narrow", sans-serif', mark: 'dot' },
  DUNLOP: { font: '900 # "Helvetica Neue", Helvetica, sans-serif', mark: 'chev' },
  PRINCE: { font: 'italic 700 # Georgia, serif', mark: 'under' },
  NIKE: { font: 'italic 900 # Futura, "Avenir Next", sans-serif', mark: 'swash' },
  ADIDAS: { font: '800 # "Avenir Next", sans-serif', mark: 'none', lower: true },
  ASICS: { font: 'italic 800 # "Avenir Next", sans-serif', mark: 'none', lower: true },
  'NEW BALANCE': { font: 'italic 900 # Futura, "Avenir Next", sans-serif', mark: 'slash' },
  ON: { font: '900 # "Avenir Next", sans-serif', mark: 'ring' },
  'K-SWISS': { font: '900 # Futura, "Avenir Next", sans-serif', mark: 'bar' },
};

export function brandArt(name) {
  const b = BRAND[name] || { font: '800 # "Avenir Next Condensed", sans-serif', mark: 'none' };
  const text = b.lower ? name.toLowerCase() : name;
  return sheet(190, 84, (g, w, h) => {
    const m = letter(g, text, w / 2, h / 2 - 4, b.font, 44, w - 22, { spacing: b.spacing || 0 });
    const L = w / 2 - m.w / 2; const R = w / 2 + m.w / 2; const base = h / 2 + m.s * 0.42;
    const ink = (col, lw, path) => { g.strokeStyle = PAPER; g.lineWidth = lw + 7; path(); g.stroke(); g.strokeStyle = col; g.lineWidth = lw; path(); g.stroke(); };
    if (b.mark === 'slash') ink(CLAY, 5, () => { g.beginPath(); g.moveTo(L + 6, base + 2); g.quadraticCurveTo(w / 2, base + 12, R + 4, base - 4); });
    else if (b.mark === 'swash') ink(CLAY, 5, () => { g.beginPath(); g.moveTo(L - 2, base - 2); g.quadraticCurveTo(L + 20, base + 14, R + 6, base - 10); });
    else if (b.mark === 'bar') ink(INK, 4, () => { g.beginPath(); g.moveTo(L, base + 4); g.lineTo(R, base + 4); });
    else if (b.mark === 'under') ink(CLAY, 3.5, () => { g.beginPath(); g.moveTo(L + 4, base + 4); g.lineTo(R - 4, base + 4); });
    else if (b.mark === 'dot') { g.fillStyle = PAPER; g.beginPath(); g.arc(R + 7, h / 2 - m.s * 0.3, 8, 0, 7); g.fill(); g.fillStyle = CLAY; g.beginPath(); g.arc(R + 7, h / 2 - m.s * 0.3, 5, 0, 7); g.fill(); }
    else if (b.mark === 'chev') ink(CLAY, 4, () => { g.beginPath(); g.moveTo(L - 4, h / 2 - 14); g.lineTo(L - 12, h / 2 - 4); g.lineTo(L - 4, h / 2 + 6); });
    else if (b.mark === 'ring') ink(CLAY, 4, () => { g.beginPath(); g.ellipse(w / 2, h / 2 - 4, m.w / 2 + 14, m.s * 0.62, -0.12, 0, 7); });
  });
}

/** A model name: plain heavy condensed lettering. */
export function wordArt(text) {
  return sheet(170, 56, (g, w, h) => { letter(g, text, w / 2, h / 2, '800 # "Avenir Next Condensed", "Arial Narrow", sans-serif', 30, w - 16); });
}

/** A big numeral with a small word under it. */
export function numArt(text, label) {
  return sheet(96, 104, (g, w, h) => {
    letter(g, text, w / 2, h / 2 - 6, '400 # Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif', 68, w - 8, { halo: 11 });
    if (label) letter(g, label, w / 2, h - 13, '800 # ui-monospace, Menlo, monospace', 11, w - 6, { halo: 6, fill: CLAY });
  });
}

/** A paint blob in the color, its name under it. */
export function blobArt(name, color, seed = 1) {
  return sheet(92, 100, (g, w, h) => {
    const cx = w / 2; const cy = 40; const r = 30;
    g.beginPath();
    for (let i = 0; i <= 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      const k = r * (1 + 0.09 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.1));
      const x = cx + Math.cos(a) * k; const y = cy + Math.sin(a) * k;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.strokeStyle = PAPER; g.lineWidth = 12; g.stroke();
    g.fillStyle = color; g.fill();
    g.strokeStyle = INK; g.lineWidth = 3.5; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(cx - 10, cy - 11, 8, 5, -0.6, 0, 7); g.fill();
    letter(g, name, w / 2, h - 12, '800 # ui-monospace, Menlo, monospace', 12, w - 4, { halo: 6 });
  });
}

/** A coil of string in its color, its name under it. */
export function coilArt(name, color) {
  return sheet(132, 92, (g, w, h) => {
    const cx = w / 2; const cy = 34;
    for (let k = 0; k < 4; k += 1) {
      const x = cx - 9 + k * 6; const y = cy;
      g.beginPath(); g.ellipse(x, y, 30, 20, -0.25, 0, 7);
      g.strokeStyle = PAPER; g.lineWidth = 10; if (!k) g.stroke();
      g.strokeStyle = INK; g.lineWidth = 6.5; g.stroke();
      g.strokeStyle = color; g.lineWidth = 3.5; g.stroke();
    }
    letter(g, name, w / 2, h - 14, '800 # "Avenir Next Condensed", "Arial Narrow", sans-serif', 18, w - 4, { halo: 7 });
  });
}
