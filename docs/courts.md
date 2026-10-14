# Courts: design reference

Every venue on the Courts screen, with its colors, lights, song, and the objects around it. The founder supplied most of this first-hand, from playing there and from photos. When their word and the map data disagree, their word wins.

Last updated 2026-10-14.

## Where it lives in code

| What | File |
|---|---|
| Venue list, names, taglines, lights, song pick, accent color, real court geometry | `src/data/venues.json`, baked by `scripts/build-venues.mjs` from OpenStreetMap |
| Songs (Apple 30-second previews) | `src/data/anthems.json`, baked by `scripts/build-anthems.mjs` |
| Court surface and wall colors | `SURFACE` in `web/courts.js` |
| Objects around each court | `FLAVOR` (smaller landmarks) and `WORLD` (full scenes) in `web/courts.js` |
| Ground color under each venue | `GROUND` in `web/courts.js` |
| Page layout and styles | `scripts/build-case-web.mjs` (courts section) |
| Rebuild after any change | `node scripts/build-case-web.mjs` |

## Rules that apply to every venue

- **One court per venue.** Even where the real site has 25, the arena shows a single signature court.
- **Same tile size for every venue.** The tile holds only the walled arena. Nothing on a tile may hang off its edge or overlap the court.
- **Surroundings live in the world below the tile.** Landmarks, parks, trains, skate parks and the like are built into a separate scene under each tile, shown when you are on that venue. Aircraft are the one exception: they fly over the tile itself.
- **Courts sit square on the tile.** They do not follow their real compass bearing, so the layout stays predictable.
- **Lights are shown two ways.** Light poles stand on the corners of lit courts, and the info row reads LIGHTS or NO LIGHTS.
- **The song lives on the walls.** Title and artist scroll along the arena's back walls like a sponsor board. Tapping the board, or the speaker in the info row, mutes it.
- **No trademarks.** No school mascots or logos, and no brand logos (Nike, Wilson, Babolat and so on). Murals and art are original.
- **No emojis** anywhere, including on boards and labels.
- **Keep props small.** The founder repeatedly finds them too big. When in doubt, go smaller.

## The venues

### UCSD North Campus

| | |
|---|---|
| Lights | Yes |
| Courts at the real site | 7 |
| Court surface | Dark blue `#1f3a8f` |
| Around the court | Light blue `#6aa6dd` |
| Walls | Navy windscreens `#1e3350` |
| Song | Bitter Sweet Symphony, The Verve |
| Accent | `#35d6ff` |

Objects:
- One windscreen carries an original mural: a gold trident striking through lightning. The real wall has the King Triton mascot, which is UC San Diego's trademark, so it is not reproduced.
- Three eucalyptus trees behind the court.
- Flyovers every 19 seconds: two fighter jets in formation, then an Osprey with its rotors turning. Military aircraft from the nearby air station train over campus.

### Linda Vista Community Park

| | |
|---|---|
| Lights | Yes |
| Courts at the real site | 4 |
| Court surface | Violet-indigo `#5b4cae` |
| Around the court | Soft grey `#a3a6ab` |
| Walls | Default charcoal |
| Song | Song 2, Blur |
| Accent | `#9b6bff` |

Objects:
- The skate park, from the founder's photos: grey concrete bowls with red coping, two of them run together, red ledges, a short stair set with a red handrail, a quarter pipe, palms, tall light poles, and a skater carving the big bowl.
- The rust-red truss footbridge crossing over the skate park.
- A police helicopter. Every 26 seconds it swoops in and circles low for about 15 seconds, with red and blue lights and a searchlight sweeping the ground. The founder saw one there directing a chase.
- Removed: power-line poles. They read as a confusing metal structure.

### Balboa Tennis Club (Morley Field)

| | |
|---|---|
| Lights | Yes |
| Courts at the real site | 25 |
| Court surface | Blue `#3a6fc6` |
| Around the court | Green `#6aa86b` |
| Walls | Dark green windscreens `#2b5638` |
| Song | Still Into You, Paramore |
| Accent | `#ff8a1f` |

Objects:
- This is the stadium court. Three rows of grey concrete stands (`#bdb9b0` and `#a9a59c`) sit behind each back wall.
- A bell tower with a terracotta cap.

### Roosevelt (by the zoo)

| | |
|---|---|
| Lights | No |
| Courts at the real site | 8 |
| Court surface | Blue `#4a8bd4` |
| Around the court | Green `#5f9a5c` |
| Walls | Default charcoal |
| Song | I Miss You, blink-182 |
| Accent | `#2fe08a` |

Objects:
- Concrete hitting walls built as a row of arches, like an old aqueduct.
- The zoo train: a red engine and three cars with striped canopies running tunnel to tunnel on a loop.
- Three elephants beyond the tracks, one a calf, walking the other way.
- A giraffe looking over the hedge.

### North Park Rec Center

| | |
|---|---|
| Lights | No (the map data says lit; the founder says not) |
| Courts at the real site | 3 |
| Court surface | Green `#3d8a52` |
| Around the court | Burgundy `#8a2c34` |
| Walls | Default charcoal |
| Song | Memories, YUNGBLUD |
| Accent | `#ff3d7f` |

Objects:
- The North Park water tower: silver-green riveted tank, rust cone roof with antenna masts, green bowl and green lattice legs, and a red light blinking on the tallest mast.
- Removed: a basketball gym. The founder preferred the water tower.

### Barnes Tennis Center (Ocean Beach)

Added by another session. Colors are placeholders until the founder sends a photo.

| | |
|---|---|
| Lights | Yes |
| Courts at the real site | 25 |
| Court surface | Blue `#2f6fb8` (placeholder) |
| Around the court | Green `#5f9a6a` (placeholder) |
| Song | Santeria, Sublime |
| Accent | `#ff5e9a` |

Objects: the park and a row of palms, the beach and the sea, the San Diego River running out between two rock jetties with a sailboat heading out, the Ocean Beach pier, and Point Loma across the water with the old lighthouse.

## Adding or changing a venue

1. Add it to `VENUES` in `scripts/build-venues.mjs` with its OpenStreetMap venue id, a short name, lights, song key, accent and tagline, then run `node scripts/build-venues.mjs`.
2. Add its colors to `SURFACE`, and a ground color to `GROUND`, in `web/courts.js`.
3. Build its surroundings as a `FLAVOR` entry (small landmarks) or a `WORLD` entry (a full scene). Anything that moves returns an update function that takes the time in seconds.
4. Add a short dock label to `DOCK_LABEL` in `web/courts.js`.
5. Run `node scripts/build-case-web.mjs`, then check it in the simulator.
6. Record the founder's details here.
