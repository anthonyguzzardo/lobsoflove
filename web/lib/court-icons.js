// One small drawn icon per court for the honeycomb (web/lib/hexdock.js): ink lines, one part filled with the court's color
// (`--ic`; UCSD sets its own navy and gold). All original drawings of the place, not anyone's logo or mark.
const S = 'stroke="#16181d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const C = 'fill="var(--ic)"'; // the court's color
const P = 'fill="#fffdf0"'; // paper
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" ${S}>${body}</svg>`;

export const COURT_ICONS = {
  // UCSD: a trident in the school's navy and gold, three barbed prongs on a wrapped shaft.
  ucsd: svg(`<g stroke="#182b49" style="--ic:#f5c518"><path d="M12 21.5V4"/><path d="M6.5 5.5V8a5.5 5.5 0 0 0 11 0V5.5"/><path d="M10.6 15.2h2.8M10.6 17.6h2.8"/>
    <path ${C} d="M12 1.4l2 3.2h-4z"/><path ${C} d="M6.5 2l1.8 3.4H4.7z"/><path ${C} d="M17.5 2l1.8 3.4h-3.6z"/></g>`),
  // Balboa: the California Tower, tiered, domed, with its spire.
  balboa: svg(`<path ${C} d="M7.5 22V14h9v8z"/><path ${P} d="M9 14V9.6h6V14z"/><path ${P} d="M10.2 9.6V7h3.6v2.6z"/>
    <path ${C} d="M10.2 7a1.8 1.8 0 0 1 3.6 0z"/><path d="M12 5.2V2.4"/><path d="M10.6 22v-3a1.4 1.4 0 0 1 2.8 0v3"/><path d="M11 11.4h2"/>`),
  // Linda Vista ("beautiful view"): the sun going down behind the mesa.
  lindavista: svg(`<path ${C} d="M5.5 16a6.5 6.5 0 0 1 13 0z"/><path d="M12 6.4V4.4M6.6 9 5.3 7.7M17.4 9l1.3-1.3M3.8 13.2H2.2M21.8 13.2h-1.6"/>
    <path ${P} d="M1.8 21.6c2.6-3.6 5.4-4.6 8.4-2.8s6.4.8 12-3v5.8z"/>`),
  // Roosevelt: an elephant, since the zoo is next door.
  roosevelt: svg(`<path ${C} d="M3.6 19.2V13.4c0-3.3 2.4-5 5.8-5h3.4c1-1.9 3-2.6 4.6-1.9 2.2 1 2.6 3.8 2 6.3-.3 1.6 0 3.3 1 4.6.5.7-.3 1.5-1 1-1.6-1.3-2-3-2.1-4.6h-1V19.2h-2.5v-3.6H8.2v3.6H5.6v-2.6"/>
    <path ${P} d="M13.6 8.8c-1.1 1.6-1.1 3.6.4 4.6 1.6.6 2.7-.4 2.7-2.2z"/><circle cx="17.6" cy="9.4" r=".7" fill="#16181d" stroke="none"/><path d="M3.6 13.6 2 15.8"/>`),
  // North Park: the water tower on its braced legs.
  northpark: svg(`<path d="M8.2 13 6.4 22M15.8 13l1.8 9M8.7 16.2h6.6M7.8 19.6h8.4"/><path stroke-width="1" d="M8.6 16.2l7.4 3.4M15.4 16.2l-7.4 3.4"/>
    <rect ${C} x="6.4" y="7" width="11.2" height="6" rx="1.2"/><path ${P} d="M5.8 7 12 2.6 18.2 7z"/><path d="M12 2.6V1.4"/>`),
  // Barnes: a sailboat out on the bay.
  barnes: svg(`<path ${C} d="M12 2.8v13.4H4.8z"/><path ${P} d="M13.6 6v10.2h5.6z"/><path ${P} d="M3.8 17.4h16.4l-2.6 3H6.4z"/>
    <path d="M1.8 22.6c1.4-.9 2.6-.9 4 0s2.6.9 4 0 2.6-.9 4 0 2.6.9 4 0 2.6-.9 4 0"/>`),
};
