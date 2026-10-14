# LobsOfLove — build plan

Working name: **LobsOfLove**, chosen by the founder October 11, 2026 (founder confirmed the name is available and bought `lobsoflove.com` and `lobsoflove.app` on October 11, 2026; `.tennis` deliberately skipped), replacing LoveLove and a brief Love Set Match. The "Name" table below is the earlier check and has not been redone for the new name; the founder is handling naming. Drafted October 11, 2026 from the Courts idea (`README.md`) and the market research (`reports/Tennis app market and court status.md`). This is the plan for the first playable version and the two-week test, with the later layers sketched so nothing built now blocks them.

## Name

Checked October 11, 2026 (App Store search API, DNS, registry RDAP where reachable):

| Name | App Store | Domains | Verdict |
|---|---|---|---|
| **LoveLove** | No tennis or sports app uses it. Only "LoveLove: Couple Cycle Care" (health, 0 ratings) | `lovelove.tennis` available. `lovelove.app` and `love-love.app` have no DNS and no whois record found, but the .app registry's RDAP was unreachable, so confirm at a registrar before buying. `lovelove.co` and `lovelove.club` taken. `playlovelove.com` available | **Use this.** Tennis-native (love–love is 0–0, the score before every match), nobody in sports has it, and it says "friends" without saying it |
| LoveAll | "Love All - Padel & Pickleball" (Oct 2026, 0 ratings) and "LoveAll Play Scheduler" (Jul 2026) both exist in sports | `loveall.app` has DNS (taken), `loveall.tennis` taken | Avoid: two racket apps already use it |
| Deuce | Six scorekeeper apps named Deuce, all under 10 ratings | not checked | Avoid: crowded and generic |
| Forty-Love / Ad-In | Forty-Love Tennis Academy (Oct 2026), Ad-In by Banti (Aug 2026) | not checked | Avoid |

Not checked: USPTO trademark search. Do that before the App Store listing. The product is still filed under `courts/` in this repo until the name is final.

## What the first version is

The two-week test from the research: founder plus two friends, UCSD courts. The app must do four things and nothing else:

1. **Roster**: a character-select screen of your group, each person with a fighter name and avatar.
2. **Match**: challenge someone, start at the court with a photo, enter the score, both confirm.
3. **Season**: a standings table with points, head-to-heads, and a shareable match card.
4. **Share**: the match card goes to the group chat as an image. That's the distribution.

Pass signal: a fourth person asks to join. Also measured: matches logged without prompting, opponent confirms within 24h, cards posted by someone other than the founder, standings opened on non-match days.

## Project shape

- **New Expo app** in this repo at `LobsOfLove/`, not a route inside the campus app. Different product, different bundle ID, own TestFlight. Same stack as `app/` (Expo SDK 57, expo-router, Reanimated 4) so patterns and components can be copied over, not shared.
- **Backend: Supabase** from day one. A roster shared by three phones and dual-confirmed scores need a server. Auth by Sign in with Apple plus phone OTP as fallback. Row-level security so a group only sees its own data.
- **Copy from the campus app** when needed: the character rendering approach (Puff/Ghost/Raccoon), the Tuft play-money ledger (phase 4), the occupancy-map drawing code (phase 3). Nothing imported across projects.
- **Share cards** rendered in-app with `react-native-view-shot` and sent through the native share sheet.
- Design language: not St. Elmo's night-sea glow. This is a fighting-game character select and a broadcast scoreboard. Decide the look on the roster screen first, in the simulator, before anything else is styled.

## Data model (Supabase)

```
players      id, auth_user_id, handle, fighter_name, avatar_kind (preset|photo), avatar_url,
             bio, city, favorite_pro, goals, opt_in_stats jsonb (height, weight, shot_speed), created_at
groups       id, name, invite_code, created_by, sport (tennis|pickleball), created_at
memberships  group_id, player_id, role (commissioner|player), joined_at
courts       id, osm_id, name, lat, lng, surface, lights, court_count, city, created_by
matches      id, group_id, court_id, season_id, format (singles|doubles),
             challenger_id, opponent_id, started_at, start_photo_url,
             sets jsonb [[6,4],[3,6],[10,8]], winner_id,
             challenger_confirmed_at, opponent_confirmed_at, status (pending|confirmed|disputed|void)
seasons      id, group_id, name, starts_on, ends_on, points_rule (jsonb), status
standings    (view) season_id, player_id, points, wins, losses, sets_won, sets_lost, streak
checkins     id, player_id, court_id, at, visible_to (group|public), expires_at         -- phase 3
gear         id, player_id, kind (racket|strings|shoes), make, model, photo_url,
             strung_on, tension_lbs, grip_color, retired_on, notes                      -- phase 3
markets      id, group_id, match_id, question, closes_at, resolved_outcome              -- phase 4
positions    market_id, player_id, side, tufts                                          -- phase 4
```

Rules enforced server-side: a match counts only when both players confirm; a player cannot confirm for someone else; a disputed match is void after 72h; a player can never hold a position on their own match.

## Points (season rule v1)

Keep it legible on a card. ATP flavor without ATP math:

- Win: 100. Loss: 25 (showing up counts).
- Straight-sets win: +20. Win from a set down: +30. Beat someone above you in the standings: +50.
- Season ends on a date. Top two play a final worth 200 to the winner.
- Shown on the card: points earned this match, new rank, head-to-head record.

Ratings (UTR/DUPR style) are not built. If a level is needed later, copy Playtomic's rule that only competitive matches move it.

## Screens, phase 1

1. **Welcome / join**: sign in, enter an invite code or create a group. Commissioner is whoever creates it.
2. **Roster (home)**: character select. Grid of fighter cards, tap to flip for bio and stats, long-press to challenge. Your own card first. Empty slots say "invite."
3. **Make your fighter**: name, avatar (preset character set or your photo with a stylized frame), bio, favorite pro, city, goals, optional stats.
4. **Challenge**: pick opponent, court (from a short list, add new by dropping a pin), optional date. Opponent gets a push.
5. **Match start**: at the court, take the photo (both of you or the court). Starts the clock. The knock is a later flourish; v1 is "both tap Start."
6. **Score entry**: sets, tiebreak support, winner computed. Submit sends a confirm request to the opponent.
7. **Confirm**: opponent sees the sets, taps Confirm or Dispute.
8. **Match card**: rendered image. Avatars, fighter names, score, court, points earned, rank change. Share button.
9. **Season standings**: table, streaks, head-to-head grid, days left, trophy for the leader.
10. **Match history**: list of cards.

## Phases

### Phase 0 — setup (days 1–2)
- `npx create-expo-app lovelove`, expo-router, Reanimated, NativeWind if the campus app's styling is being reused.
- Supabase project, schema above (phase 1 tables), RLS, Sign in with Apple.
- EAS project, bundle ID, TestFlight internal group with the two friends.

### Phase 1 — roster and match (days 3–8)
- Screens 1–8. Roster screen first, in the simulator, until it looks like a character select and not a contacts list.
- Push notifications for challenge and confirm (Expo push).
- Match card rendering and share sheet.

### Phase 2 — season and test (days 9–14)
- Screens 9–10, points rule v1, season creation by the commissioner.
- TestFlight build to the two friends. Season one starts. The two-week clock starts here, not at phase 0.
- Log every match for two weeks. Keep a launch log: matches logged, confirm latency, cards shared, who shared, standings views.

### Phase 3 — courts as levels, gear (after the test passes)
- Import San Diego tennis courts from OpenStreetMap (`leisure=pitch` + `sport=tennis`), keep history in our DB keyed by OSM id (ODbL share-alike stays off our data).
- Court page: aerial, record on this court, matches here, court king, photos from matches, best match here, last repaved and lore as editable facts with a source.
- Opt-in "I'm here" check-in visible to your roster only, 2h expiry. No public occupancy claims.
- Gear log: add racket by photo (vision model fills make and model, user confirms), restring date and tension, grip color, shoes. Hours per racket from logged match durations. Restring reminder at a user-set interval.
- Pickleball mode: same tables with `sport=pickleball`, 11-point games instead of sets.

### Phase 4 — markets, charity, league
- Tufts ledger copied from the campus app. Markets on matches inside the group only. No self-betting, no cash in or out.
- Charity pot: sponsor-funded, split by the causes players pick. California legal review first.
- Campus League mode: a group per college, cross-group season, 8-college scoreboard. This is where the Campus League idea lives.
- Group kit: a link per roster to a print-on-demand group store. Not built commerce.

## Things the research said not to build
- Live public-court occupancy as the headline. Four failed approaches since 2017.
- Pickleball scheduling and open-play organizing. Pickleheads owns it.
- Ratings. UTR and DUPR exist; integrate later if ever.
- AI video stats. SwingVision; integrate if ever.
- Court booking. Link out.
- Animated avatar fights on the matchup screen. Sleeper removed theirs as clutter.

## Open decisions for the founder
1. Avatar system: a preset cast of fighters (cheap, consistent, on-brand) vs. your own photo in a frame vs. AI-generated from a prompt (cost, moderation). Recommendation: preset cast plus photo; AI later.
2. Does the commissioner set the season length, or is it always a quarter?
3. Doubles in v1 or v2? Recommendation: v2, singles only for the test.
4. ~~Buy `lovelove.tennis` now?~~ Resolved: `lobsoflove.com` and `lobsoflove.app` bought October 11, 2026. USPTO search still to do before the App Store listing.
