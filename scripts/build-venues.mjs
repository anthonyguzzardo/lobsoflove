// Bakes the favorite venues from OpenStreetMap into to-scale models: src/data/venues.json.
// Every court and nearby building keeps its true position, size and angle. Run: node scripts/build-venues.mjs
// (data © OpenStreetMap contributors, ODbL)
import { readFileSync, writeFileSync } from 'node:fs';

/** `lights` is the founder's first-hand knowledge of each site and overrides the map's `lit` tag, which is wrong for North Park. */
const VENUES = [
  { id: 'c328900_1172416', key: 'ucsd', lights: true, name: 'UCSD North Campus', short: 'UCSD NORTH', anthem: 'ucsd', accent: '#35d6ff', lat: 32.89005, lng: -117.2416, r: 120, tagline: 'Seven courts above the eucalyptus.' },
  { id: 'c327930_1171703', key: 'lindavista', lights: true, name: 'Linda Vista Community Park', short: 'LINDA VISTA', anthem: 'zoo', accent: '#9b6bff', lat: 32.79298, lng: -117.17032, r: 110, tagline: 'Courts, the big skate park, and a helicopter overhead.' },
  { id: 'c327396_1171408', key: 'balboa', lights: true, name: 'Balboa Tennis Club', short: 'BALBOA TC', anthem: 'balboa', accent: '#ff8a1f', lat: 32.73961, lng: -117.14084, r: 190, tagline: 'Twenty-five courts and a stadium at Morley Field.' },
  { id: 'c327397_1171507', key: 'roosevelt', lights: false, name: 'Roosevelt', short: 'ROOSEVELT', anthem: 'cove', accent: '#2fe08a', lat: 32.73967, lng: -117.15067, r: 110, tagline: 'Behind the zoo. Something is screaming.' },
  { id: 'c327506_1171342', key: 'northpark', lights: false, name: 'North Park Rec Center', short: 'NORTH PARK', anthem: 'downtown', accent: '#ff3d7f', lat: 32.75059, lng: -117.13423, r: 110, tagline: 'Under the water tower. Day play only.' },
  // OSM maps Barnes only as one facility outline with no tennis pitches inside, so the map bake never found it. Its 25 lit courts
  // (23 hard, 2 clay, per Youth Tennis San Diego) are laid out by hand: five rows of five, long axis north-south.
  { id: 'c327534_1172349', key: 'barnes', lights: true, name: 'Barnes Tennis Center', short: 'BARNES TC', anthem: 'ob', accent: '#ff5e9a', lat: 32.75338, lng: -117.23485, r: 160, tagline: 'Where the river meets the ocean.', grid: { rows: 5, cols: 5 } },
];

/** A block of true-size courts (36.6 x 18.3 m with run-off) for a venue the map has no pitches for. */
function gridCourts(v) {
  const L = 36.6; const W = 18.3;
  const out = [];
  for (let r = 0; r < v.grid.rows; r += 1) for (let c = 0; c < v.grid.cols; c += 1) {
    out.push({ x: (c - (v.grid.cols - 1) / 2) * W, y: (r - (v.grid.rows - 1) / 2) * L, w: 23.77, d: 10.97, rot: Math.PI / 2, surface: 'hard', lit: v.lights, name: null });
  }
  return out;
}

// `node scripts/build-venues.mjs barnes` re-bakes only the named venues and keeps the rest of venues.json as it is.
const only = process.argv.slice(2);
const prev = only.length ? JSON.parse(readFileSync(new URL('../src/data/venues.json', import.meta.url))) : [];

async function overpass(query) {
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter']) {
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LobsOfLove/0.1 (venue model bake)', Accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()).elements;
    } catch (e) { console.error(url, 'failed:', e.message); }
  }
  throw new Error('all Overpass endpoints failed');
}

/** Smallest rectangle around a ring of points (meters): tries each edge's direction. Returns center, size and angle. */
function minRect(pts) {
  let best = null;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    const c = Math.cos(-a); const s = Math.sin(-a);
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const [x, y] of pts) { const u = x * c - y * s; const v = x * s + y * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
    const area = (x1 - x0) * (y1 - y0);
    if (!best || area < best.area) {
      const cu = (x0 + x1) / 2; const cv = (y0 + y1) / 2;
      best = { area, w: x1 - x0, d: y1 - y0, rot: a, x: cu * Math.cos(a) - cv * Math.sin(a), y: cu * Math.sin(a) + cv * Math.cos(a) };
    }
  }
  return best;
}

const out = [];
for (const v of VENUES) {
  if (only.length && !only.includes(v.key)) { const kept = prev.find((p) => p.key === v.key); if (kept) out.push(kept); continue; }
  const around = `(around:${v.r},${v.lat},${v.lng})`;
  const els = v.grid ? [] : await overpass(`[out:json][timeout:60];(way["leisure"="pitch"]["sport"~"tennis"]${around};way["building"]${around};way["leisure"="pitch"]["sport"~"pickleball|basketball|baseball|soccer"]${around};);out geom tags;`);
  const toM = (p) => [(p.lon - v.lng) * 111320 * Math.cos((v.lat * Math.PI) / 180), (p.lat - v.lat) * 111320]; // east, north
  const courts = []; const buildings = []; const others = [];
  for (const el of els) {
    if (!el.geometry || el.geometry.length < 4) continue;
    const r = minRect(el.geometry.map(toM));
    const t = el.tags ?? {};
    // Always describe a rectangle by its long side first.
    const rect = r.w >= r.d ? { x: r.x, y: r.y, w: r.w, d: r.d, rot: r.rot } : { x: r.x, y: r.y, w: r.d, d: r.w, rot: r.rot + Math.PI / 2 };
    if (t.leisure === 'pitch' && /tennis/.test(t.sport)) courts.push({ ...rect, surface: t.surface ?? null, lit: v.lights, name: t.name ?? t.ref ?? null });
    else if (t.building) buildings.push({ ...rect, levels: Number(t['building:levels']) || 1, name: t.name ?? null });
    else others.push({ ...rect, sport: t.sport });
  }
  if (v.grid) courts.push(...gridCourts(v));
  if (!courts.length) { console.error('no courts for', v.name); continue; }
  // Center on the courts and scale the whole site so its courts span about 3 units.
  const cx = courts.reduce((s, c) => s + c.x, 0) / courts.length;
  const cy = courts.reduce((s, c) => s + c.y, 0) / courts.length;
  const reach = Math.max(...courts.map((c) => Math.hypot(c.x - cx, c.y - cy) + Math.hypot(c.w, c.d) / 2));
  const k = 1.75 / reach;
  const fit = (o) => ({ ...o, x: +((o.x - cx) * k).toFixed(3), z: +(-(o.y - cy) * k).toFixed(3), w: +(o.w * k).toFixed(3), d: +(o.d * k).toFixed(3), rot: +o.rot.toFixed(4), y: undefined });
  const near = (o) => Math.hypot(o.x - cx, o.y - cy) * k < 2.6;
  out.push({
    id: v.id, key: v.key, name: v.name, short: v.short, anthem: v.anthem, accent: v.accent, tagline: v.tagline, lights: v.lights,
    metersPerUnit: +(1 / k).toFixed(2), reach: +(reach * k).toFixed(2),
    courts: courts.map(fit), buildings: buildings.filter(near).map(fit), others: others.filter(near).map(fit),
  });
  console.log(`${v.short.padEnd(12)} ${courts.length} courts, ${buildings.filter(near).length} buildings, ${others.filter(near).length} other pitches, 1 unit = ${(1 / k).toFixed(0)} m, court ${courts[0].w.toFixed(0)}x${courts[0].d.toFixed(0)} m, surfaces: ${[...new Set(courts.map((c) => c.surface))].join(',')}, lit: ${courts.filter((c) => c.lit).length}`);
}
writeFileSync(new URL('../src/data/venues.json', import.meta.url), JSON.stringify(out));
