# LobsOfLove: feudal "king of the court" direction (design summary, 2026-10-19)

Context for the build agent. This supersedes the "ideas with verdicts" list from the 2026-10-17 summary where they conflict. Everything below is design direction from a brainstorm with the founder, not a locked spec. Founder preferences at the bottom still apply.

## One-line pitch

A feudal war game played on real San Diego tennis courts by friend groups. You take land by winning real matches, rule it with your own laws, and get knocked off by challengers. Fun format first (UTS / LIV energy), log underneath.

## The spine (do not break this)

- **One input: a confirmed score per match, tagged with a court.** Entered once on the flip board, confirmed by the loser. Presence supplies who, where, when.
- **Everything else is derived** from that input plus passive data. Belts, land, renown, titles, storylines, standings are computed views, not new forms.
- **Passive inputs are free, active inputs are a tax.** Watch data, weather, location: fine. Anything the player has to type: avoid.
- Art is the brand, not the moat. Keep the physical, touchable, simulated feel; no static forms.

## Why this direction

The 2026-10-17 open question was behavioral: will friends log a score without being asked? The feudal layer is the answer attempt. Holding land is the reason to log; the winner logs to take the belt, the loser confirms because he can't let it stand (or disputes it, which is also engagement).

## Core mechanics

### Land = courts
- Every venue is a province. Venues group into regions (e.g. UCSD, Balboa, Morley Field, Robb Field).
- Whoever won the last confirmed match at a court holds it (the belt).
- Tennis is a point, not an area, so no hex painting. Territory is courts held.

### Feudal ranks
Peasant (no land) -> Knight (sworn to a lord) -> Lord (holds a court) -> Duke (holds a region) -> King (most land in the city).
- Knights can defend their lord's court on his behalf.
- Lords pass laws for their court.
- Dukes set region-wide laws and collect tax from their lords.
- King can declare open season.

### Fealty
- After losing, a player can swear fealty instead of just taking the L. Becomes the winner's knight, gets a cut of tribute, defends their land.
- Breaking fealty is a public betrayal (keeps half the shared land in house splits; headline in the weekly show).

### Laws (house rules per court)
The lord of a court sets decrees that change how matches there are played, and they fall when he falls. Examples: no-ad, Fast4, tiebreak at 5-5, challenger serves first, matches start at 2-2, underhand serve once a set, loser carries the bag / buys the can.
- MVP: lord picks from a list of about five. It is a settings struct hung off the belt.
- Government type per court: tyrant (lord sets laws alone, revolt needs fewer votes) or council (knights vote on laws, harder to overthrow).

### Challenges
- A challenge is a time window plus a court ("Tuesday 6-8, UCSD"). This doubles as fill-the-fourth / meetup without feeling like a form.
- Accept within 7 days or the belt is stripped and the duck becomes a storyline.
- Belt can have a defense cap so a king can't sit on it forever.

### Treasury and tribute
- Every match played on your court pays you tribute (in-game currency).
- Spend on decrees, wall fortifications, bounties, power cards.

### Sieges, bounties, revolt
- **Siege:** can't challenge a lord cold. Beat two of the court's regulars first to open the gate. Lord can spend treasury to add a wall.
- **Bounty:** put coins on a lord's head; whoever dethrones him collects. Crowd-funded bounties are group-chat fuel.
- **Revolt:** if enough people lose to a lord under his laws, they vote a revolt that forces an immediate defense with his decrees suspended.

### Lives, done right (banners)
- Three banners per season. Stake one to attack above your weight.
- Lose all three: you become a mercenary who can only fight for someone else's house until you win one back.
- Losing changes your role; it never kicks you out or penalizes logging. Do NOT add penalties that make a player on a losing streak quit.

### Decay
- An absent lord's fighter slowly melts on the throne (jelly soft body). Inactive land returns to fog.

### Gods (the layer players don't control)
Weather, season, chaos. Run by the founder to pump storylines when the group goes quiet.
- Santa Ana god: no lobs this week. Rain god: freeze all belts. Harvest god: double tribute. Seasonal pilgrimages.
- Keep the theme to feudal + gods. Do not mix in a third system (elections, parliament); it muddies who holds power.

### Heraldry
- Each house gets a crest and colors, drawn by hand in ink. Courts screen tints to whoever holds the court.

## Exploration (Assassin's Creed style)

- **Fog of war:** unplayed courts are fogged.
- **Synchronize:** first confirmed match at a court syncs it; fog lifts there and nearby, revealing holders and laws.
- **Founder's right:** first to claim an unnamed court names it ("The Pit"). Name and "founded by" stay forever, even after the court is lost.
- **Borders and passage:** entering a held region, an outsider can request a writ of passage (lord approves), pay a toll, or storm it (play as invader). "Storm it" must ALWAYS be available. A gate is a challenge, never a wall, or newcomers leave.
- **Pilgrimages:** landmark courts are shrines; visiting grants a relic for the gear closet.
- **Codex:** each synced court gets a journal entry in ink (surface, wind, light at 5pm, the crack at the baseline). Players add lore.

## Format layer (UTS / LIV)

- **Power cards (UTS):** earned from land, bought from treasury, played in a real match before a game, logged on the flip board, visible to the opponent. Examples: game counts double, steal the serve, one extra second serve, no-ad deuce. Lords get better cards than peasants.
- **Houses as franchises (LIV):** houses compete as teams for a season; individual results score for the house; season ends in a showdown weekend.
- **Timed quarters** can exist as a law option.

## Ranking: two layers

- **Renown (public, made up):** land held, defenses, betrayals, bounties claimed, pilgrimages, grit. Rewards playing a lot and dramatically, not just being good.
- **Skill (blind, never shown):** computed from scores (and optionally effort). Used only for fair matchups, handicaps, and weekly-show odds.
- This keeps the earlier rule "don't build a public rating system." We are not competing with UTR. A 3.0 player can be the most feared lord in the city.

## Biometrics (passive only, opt-in)

- Source: Apple Watch workout via HealthKit (Health Connect on Android): heart rate over time, calories, duration, distance. Weather and daylight from court location and match time.
- Uses: **Nerve** (HR late in close matches; titles like Cold-Blooded), **Grit renown** (effort even in losses), **Stamina** (heavy weeks sag the jelly fighter, rest restores), **Suffering bonus** (heat, wind), smarter blind skill.
- Rules: biometrics only add bonus renown and titles; they never decide land or rank (players without a watch must be able to win). Opt-in, private by default, show only derived titles to others, never raw numbers. Heart rate is health data; treat it that way.
- Needs a native module and a dev build (not Expo Go), same as the pose spike.
- Skip point-by-point entry. Only revisit if pose or audio can infer it passively.

## Organic growth (design rule: gaining power requires someone not yet in the app)

- **The opponent is the invite.** Challenges go out as links to anyone. A score only counts when the loser confirms, so beating a non-user leaves him as a grey "pretender" fighter until he installs to confirm or dispute.
- **Land needs people.** Fogged courts can only be claimed with a confirmed match there.
- **Knights are recruits.** Recruiter gets the tribute cut from recruits.
- **Border wars.** Public courts are shared; when two separate friend groups both play Morley Field, their realms touch and war starts. This is the main engine: crews colliding.
- **Heralds.** Proclamations (new lord, betrayal, bounty) are designed to be screenshotted into group chats. The weekly show is the ad.
- **Flag on the court.** Crest card or QR: "This court is held by Lord X. Challenge him." Hand cards to people on the next court; check with the parks department before attaching anything to fences.
- **Fill the fourth.** Doubles' missing fourth is an open mercenary slot.
- Constraint: one friend group saturates at roughly 6-10 people. Pretender loop and border wars are the only loops that reach strangers. Build those right after the belt.

## Competitive landscape (checked 2026-10-18)

Nobody combines a ruling fiction with real, confirmed match results among friends.
- **Ogmento x NBA "King of the Court" (~2010):** closest ancestor. Courts as territory, rulers collected rent in virtual tokens. But the games were fake AR shooting, not real matches. Went nowhere.
- **Territory running apps:** INTVL, Turfly, XpandR, TGNG. Coverage of ground, not beating a person. Steal INTVL's head-to-head rivals screen (show it with fighters); skip its worldwide leaderboard.
- **Ladder apps:** Sportch, Scala, TennisRungs, TennisCall. Real challenges and score reporting, zero fiction, sold to clubs as admin tools.
- **Twenty Two (Feb 2026):** friend-group tennis log with H2H. Roughly our free tier. No traction.
- The bet: fiction is what gets results logged. That is what the two-week test now checks.

## Still avoid

Public cross-roster rating system, real-money betting, building court booking, a public feed, live public court status as a headline. Keep the friend test roster-only.

## Suggested build order

1. **Supabase season sync** with matches tagged by venue, so two real friends share one world.
2. **Belt per venue** (derived: last confirmed winner holds it) + **H2H rivals card** with fighters.
3. **Challenges as links** with time window, including the **pretender** state for non-users.
4. **Laws:** lord picks from ~5 house rules.
5. Run the **two-week friend test**. Pass signal: a fourth person asks to join.
6. Then: fog / sync / founder naming, houses + fealty + treasury, power cards, renown + blind skill, weekly show, biometrics, showdown events.

## Data model sketch (Supabase / Postgres)

Source of truth stays small; most game state is views.

- `players` (id, display_name, fighter, crest, house_id)
- `regions` (id, name)
- `venues` (id, region_id, display_name, founder_id, founded_at, gov_type)
- `matches` (id, venue_id, played_at, side_a, side_b, score, reported_by, confirmed_by, confirmed_at, status [pending|confirmed|disputed], cards_played jsonb, laws_snapshot jsonb, biometrics_ref)
- `challenges` (id, venue_id, challenger_id, target_id or invite_token, window_start, window_end, status, expires_at)
- `laws` (venue_id, set_by, set_at, rules jsonb)
- `fealty` (knight_id, lord_id, sworn_at, broken_at)
- `houses` (id, name, crest, colors)
- `ledger` (id, player_id, delta, reason, ref) for treasury, tribute, bounties
- `banners` (player_id, season_id, remaining)
- Derived views: `holders` (current holder per venue), `realms` (land per player/house), `renown`, `h2h`, `skill` (hidden).

## Founder preferences

- No emojis anywhere.
- Physical, touchable, simulated screens; hates forms and static UI.
- Build directly requested features; don't stall with "want me to start?"
- Never delete existing UI without asking.
