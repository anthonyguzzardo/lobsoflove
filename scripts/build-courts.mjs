// Bakes San Diego County tennis venues from OpenStreetMap into src/data/courts.json.
// Run: node scripts/build-courts.mjs   (data © OpenStreetMap contributors, ODbL)
import { writeFileSync } from 'node:fs';

const BBOX = '32.53,-117.62,33.51,-116.08';
const QUERIES = [
  `[out:json][timeout:120];nwr["leisure"="pitch"]["sport"~"tennis"](${BBOX});out center tags;`,
  `[out:json][timeout:120];(nwr["leisure"~"^(park|sports_centre|recreation_ground)$"]["name"](${BBOX});nwr["amenity"~"^(school|university|college|community_centre)$"]["name"](${BBOX}););out bb tags;`,
  `[out:json][timeout:60];node["place"~"^(suburb|neighbourhood|town|city|village)$"]["name"](${BBOX});out;`,
];
const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter'];

async function run(query) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LobsOfLove/0.1 (court data bake)', Accept: 'application/json' } });
        if (!res.ok) throw new Error(`${res.status}`);
        return (await res.json()).elements;
      } catch (e) {
        console.error(url, 'failed:', e.message);
      }
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  console.error('All Overpass endpoints failed.');
  process.exit(1);
}

const data = { elements: [] };
for (const q of QUERIES) data.elements.push(...(await run(q)));

const meters = (a, b) => {
  const dy = (a.lat - b.lat) * 111320;
  const dx = (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

const pitches = [];
const areas = [];
const places = [];
for (const el of data.elements) {
  const t = el.tags ?? {};
  if (t.leisure === 'pitch') {
    const lat = el.center?.lat ?? el.lat;
    const lng = el.center?.lon ?? el.lon;
    if (lat == null || t.access === 'private' || t.access === 'no') continue;
    pitches.push({ lat, lng, t });
  } else if (el.bounds && t.name) {
    const b = el.bounds;
    areas.push({ name: t.name, b, size: (b.maxlat - b.minlat) * (b.maxlon - b.minlon) });
  } else if (t.place && t.name && el.lat != null) {
    places.push({ name: t.name, lat: el.lat, lng: el.lon });
  }
}
areas.sort((x, y) => x.size - y.size);

// Cluster courts that sit within 90 m of each other into one venue.
const venues = [];
for (const p of pitches) {
  let v = venues.find((x) => x.members.some((m) => meters(m, p) < 90));
  if (!v) venues.push((v = { members: [] }));
  v.members.push(p);
}

// Hand-checked names for the home campus, whose courts OSM leaves unnamed (sites per UCSD Recreation).
const OVERRIDES = [
  { name: 'UCSD North Campus courts', lat: 32.89005, lng: -117.2416 },
  { name: 'UCSD Muir courts', lat: 32.87784, lng: -117.24288 },
  { name: 'UCSD Warren courts', lat: 32.87856, lng: -117.23053 },
  { name: 'UCSD Coast courts', lat: 32.87047, lng: -117.24841 },
];
for (const o of OVERRIDES) {
  const hit = venues.filter((v) => v.members.some((m) => meters(m, o) < 160));
  if (hit.length === 0) continue;
  hit[0].members = hit.flatMap((v) => v.members);
  hit[0].override = o.name;
  for (const v of hit.slice(1)) venues.splice(venues.indexOf(v), 1);
}

const out = [];
for (const v of venues) {
  const lat = v.members.reduce((s, m) => s + m.lat, 0) / v.members.length;
  const lng = v.members.reduce((s, m) => s + m.lng, 0) / v.members.length;
  const own = v.override ?? v.members.map((m) => m.t.name).find((n) => n && !/^court\s*\d*$/i.test(n) && !/^\d+$/.test(n) && !/backboard|wall|practice/i.test(n));
  const area = areas.find((a) => lat >= a.b.minlat && lat <= a.b.maxlat && lng >= a.b.minlon && lng <= a.b.maxlon && a.size < 0.0004);
  let near = null;
  let best = Infinity;
  for (const pl of places) {
    const d = meters(pl, { lat, lng });
    if (d < best) { best = d; near = pl.name; }
  }
  // A lone unnamed court outside any named public place is almost always a backyard.
  if (!own && !area && v.members.length < 3) continue;
  const surfaces = v.members.map((m) => m.t.surface).filter(Boolean);
  const surface = surfaces.sort((a, b) => surfaces.filter((s) => s === b).length - surfaces.filter((s) => s === a).length)[0] ?? null;
  const name = own ?? area?.name ?? (near ? `${near} courts` : 'Unnamed courts');
  out.push({
    id: `c${Math.round(lat * 1e4)}_${Math.round(-lng * 1e4)}`,
    name: /tennis|court|club|center|centre/i.test(name) || !area || own ? name : `${name} courts`,
    area: v.override ? 'UC San Diego' : near,
    lat: +lat.toFixed(5), lng: +lng.toFixed(5),
    count: v.members.length,
    surface,
    lit: v.members.some((m) => m.t.lit === 'yes') ? true : v.members.every((m) => m.t.lit === 'no') ? false : null,
  });
}
// Several venues can share one campus or park name: tell them apart by where they sit within the group.
const byName = new Map();
for (const c of out) byName.set(c.name, [...(byName.get(c.name) ?? []), c]);
for (const [name, group] of byName) {
  if (group.length < 2 || name === 'Unnamed courts') continue;
  const cLat = group.reduce((s, c) => s + c.lat, 0) / group.length;
  const cLng = group.reduce((s, c) => s + c.lng, 0) / group.length;
  const seen = new Map();
  for (const c of group) {
    const dy = (c.lat - cLat) * 111320;
    const dx = (c.lng - cLng) * 111320 * Math.cos((cLat * Math.PI) / 180);
    const dir = Math.abs(dy) >= Math.abs(dx) ? (dy >= 0 ? 'North' : 'South') : dx >= 0 ? 'East' : 'West';
    const n = (seen.get(dir) ?? 0) + 1;
    seen.set(dir, n);
    c.name = `${name} · ${dir}${n > 1 ? ` ${n}` : ''}`;
  }
}
out.sort((a, b) => b.count - a.count);
writeFileSync(new URL('../src/data/courts.json', import.meta.url), JSON.stringify(out));
console.log(`${pitches.length} courts -> ${out.length} venues`);
console.log(out.slice(0, 12).map((c) => `${c.count} · ${c.name} (${c.area})`).join('\n'));
console.log('UCSD-ish:', out.filter((c) => meters(c, { lat: 32.8801, lng: -117.234 }) < 2500).map((c) => `${c.count} · ${c.name}`).join(' | '));
