// Looks up each stage's anthem on the iTunes Search API and bakes the result into src/data/anthems.json.
// Run: node scripts/build-anthems.mjs
// Only Apple's public 30-second previews are used; the app links each one back to Apple Music.
import { writeFileSync } from 'node:fs';

/** One song per court stage (theme ids from src/lib/themes.ts). The first five, plus ob (Barnes), are the founder's picks. */
const PICKS = {
  ucsd: ['Bitter Sweet Symphony', 'The Verve'],
  balboa: ['Still Into You', 'Paramore'],
  zoo: ['Song 2', 'Blur'],
  cove: ['I Miss You', 'blink-182'],
  downtown: ['Memories', 'YUNGBLUD'],
  ob: ['Los Angeles', 'The Midnight'], // Barnes Tennis Center (the Night Habits remaster is not on Apple Music; this is the 2014 original)
  beach: ["What's My Age Again?", 'blink-182'],
  coronado: ['Superman', 'Goldfinger'],
  bay: ['No Cigar', 'Millencolin'],
  northcoast: ['Blitzkrieg Bop', 'Ramones'],
  mesa: ["The Kids Aren't Alright", 'The Offspring'],
  east: ['Ace of Spades', 'Motörhead'],
  palms: ['All My Best Friends Are Metalheads', 'Less Than Jake'],
};

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const out = {};
for (const [theme, [title, artist]] of Object.entries(PICKS)) {
  const url = `https://itunes.apple.com/search?media=music&entity=song&country=us&limit=25&term=${encodeURIComponent(`${title} ${artist}`)}`;
  const { results } = await (await fetch(url)).json();
  // Prefer the original studio cut: exact title, matching artist, no live/remix/karaoke versions.
  const ok = results.filter((r) => r.previewUrl && norm(r.artistName).includes(norm(artist).slice(0, 6)) && norm(r.trackName).startsWith(norm(title)) && !/live|remix|karaoke|acoustic|demo|instrumental/i.test(`${r.trackName} ${r.collectionName}`));
  const hit = ok.sort((a, b) => a.trackName.length - b.trackName.length || new Date(a.releaseDate) - new Date(b.releaseDate))[0];
  if (!hit) { console.error(`NO MATCH: ${theme} · ${title} — ${artist}`); continue; }
  out[theme] = { title: hit.trackName, artist: hit.artistName, year: hit.releaseDate.slice(0, 4), trackId: hit.trackId, previewUrl: hit.previewUrl, link: hit.trackViewUrl };
  console.log(`${theme.padEnd(10)} ${hit.trackName} — ${hit.artistName} (${hit.releaseDate.slice(0, 4)}, ${hit.collectionName})`);
}
writeFileSync(new URL('../src/data/anthems.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`${Object.keys(out).length} of ${Object.keys(PICKS).length} baked`);
