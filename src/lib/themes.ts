import { type Court, miles } from '@/lib/courts';

export type ThemeId = 'ucsd' | 'zoo' | 'balboa' | 'downtown' | 'coronado' | 'ob' | 'beach' | 'cove' | 'bay' | 'northcoast' | 'mesa' | 'east' | 'palms';

export type Theme = {
  id: ThemeId;
  /** Stage title, shown like a track name. */
  stage: string;
  tagline: string;
  sky: [string, string];
  accent: string;
  ground: string;
};

export const THEMES: Record<ThemeId, Theme> = {
  ucsd: { id: 'ucsd', stage: 'BRUTALIST HEIGHTS', tagline: 'Concrete, eucalyptus, and a marine layer that never leaves.', sky: ['#1d4a5c', '#9fc7c2'], accent: '#35d6ff', ground: '#3d5a52' },
  zoo: { id: 'zoo', stage: 'BEHIND THE ZOO', tagline: 'Something is screaming and it is not your opponent.', sky: ['#0f5b3a', '#c9e27a'], accent: '#2fe08a', ground: '#1f6b3a' },
  balboa: { id: 'balboa', stage: 'EL PRADO', tagline: 'Bell tower, tile domes, and a full parking lot.', sky: ['#c2562b', '#ffd27a'], accent: '#ff8a1f', ground: '#8a5a2c' },
  downtown: { id: 'downtown', stage: 'FLIGHT PATH', tagline: 'Serve between landings.', sky: ['#1a1440', '#c04f8f'], accent: '#ff3d7f', ground: '#2a2550' },
  coronado: { id: 'coronado', stage: 'THE CROWN', tagline: 'Across the bridge, under the red roof.', sky: ['#2b62b8', '#ffe1b0'], accent: '#ff5252', ground: '#3b7f6a' },
  ob: { id: 'ob', stage: 'SUNSET CLIFFS', tagline: 'Salt air, barefoot spectators, golden hour all day.', sky: ['#ff5e3a', '#ffc857'], accent: '#ff8a1f', ground: '#b5733a' },
  beach: { id: 'beach', stage: 'BOARDWALK', tagline: 'Dodge the beach cruisers on the way in.', sky: ['#ff7aa2', '#ffd9a0'], accent: '#ff3d7f', ground: '#c9a36a' },
  cove: { id: 'cove', stage: 'THE COVE', tagline: 'The seals have seen your second serve.', sky: ['#0f7f9c', '#b8f0e6'], accent: '#35d6ff', ground: '#4d8f7a' },
  bay: { id: 'bay', stage: 'THE BAY', tagline: 'Flat water, light wind, no excuses.', sky: ['#2f7fd6', '#c6ecff'], accent: '#35d6ff', ground: '#4f9a6a' },
  northcoast: { id: 'northcoast', stage: 'NORTH SWELL', tagline: 'Surf check first, then tennis.', sky: ['#1f5fae', '#aee6ff'], accent: '#35d6ff', ground: '#5a9a72' },
  mesa: { id: 'mesa', stage: 'THE MESA', tagline: 'Chain link, canyon wind, and locals who do not miss.', sky: ['#3b2a6b', '#ff9a5a'], accent: '#9b6bff', ground: '#5a4a6a' },
  east: { id: 'east', stage: 'EAST COUNTY HEAT', tagline: 'Ninety-eight degrees. Bring two waters.', sky: ['#d9481c', '#ffe08a'], accent: '#ff5252', ground: '#b0733f' },
  palms: { id: 'palms', stage: 'PALM COURT', tagline: 'Seventy-two and sunny. Again.', sky: ['#6a4fd6', '#ffb37a'], accent: '#d7f205', ground: '#3f8f5a' },
};

const near = (c: Court, lat: number, lng: number, r: number) => miles(c, { lat, lng }) < r;

/** Picks a stage from where the venue sits. Order matters: tighter landmarks win over broad regions. */
export function themeFor(c: Court): Theme {
  const name = `${c.name} ${c.area ?? ''}`.toLowerCase();
  const pick = (id: ThemeId) => THEMES[id];
  if (c.name.startsWith('UCSD ') || near(c, 32.8801, -117.234, 1.0)) return pick('ucsd');
  if (near(c, 32.7405, -117.15, 0.4)) return pick('zoo');
  if (/balboa|morley/.test(name) || near(c, 32.7341, -117.1446, 0.9)) return pick('balboa');
  if (near(c, 32.7157, -117.1611, 1.1)) return pick('downtown');
  if (/coronado/.test(name) || near(c, 32.6859, -117.1831, 1.8)) return pick('coronado');
  if (/ocean beach|point loma|sunset cliffs/.test(name) || near(c, 32.7499, -117.247, 1.4)) return pick('ob');
  if (/pacific beach|mission beach/.test(name) || near(c, 32.794, -117.252, 1.3)) return pick('beach');
  if (/la jolla/.test(name) || near(c, 32.84, -117.274, 1.8)) return pick('cove');
  if (/mission bay|bay park/.test(name) || near(c, 32.78, -117.226, 1.2)) return pick('bay');
  if (c.lat > 32.93 && c.lng < -117.22) return pick('northcoast');
  if (/mesa|linda vista|clairemont|tierrasanta|serra/.test(name) || near(c, 32.7836, -117.17, 1.3) || near(c, 32.82, -117.19, 2.2) || near(c, 32.83, -117.14, 1.8)) return pick('mesa');
  if (c.lng > -116.99) return pick('east');
  return pick('palms');
}
