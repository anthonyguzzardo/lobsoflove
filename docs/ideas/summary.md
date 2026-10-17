# LobsOfLove: business and product direction (chat summary, 2026-10-17)

A Saturday brainstorm on where the money and the competitive edge are for LobsOfLove. Use this as context in a new chat.

## Where the app is today

- Expo SDK 57 app, about six days of commits. Screens: home diorama, courts (venue islands with presence beacon), match (flip scoreboard on a fence), season lines, standings, gear closet, make-your-fighter (jelly soft body), ink (handwriting commands with an AI reader edge function), case (opponent picker), match card.
- Data is local (AsyncStorage). Supabase exists but only logs AI ink reads. Friends on the courts screen are labeled stand-ins.
- The two-week friend test from `courts/PLAN.md` (founder plus two friends, UCSD courts) has NOT run yet.
- Gear closet already models wear: strings about 15 matches or 90 days, overgrip 5 or 30, open can 3 or 14, shoes 50 or 180, with reorder thresholds.

## Conclusions we reached

- **Art is the brand, not the moat.** Anyone can build hand-made scenes. Keep it as taste.
- **Free forever:** roster, matches, season, cards, the log (things about "us"). **Paid later:** personal insight (things about "me"). Golf apps and Strava all draw this line.
- **The one input that drives everything is a score per match.** Entered once on the flip board, confirmed by the opponent. Presence supplies who, where, when. Everything else is computed. That is the "formless" version: one tiny form per match.
- **Boring core is fine.** Every lasting app in this space is a boring log with fun on top.
- **The real open question is behavioral:** will friends log a score without being asked? Only the test answers that. Stop generating ideas until it runs.

## Market size (honest)

| Figure | Value |
|---|---|
| US core tennis players | about 14.5M |
| US core pickleball players | about 7.5M |
| Typical paid conversion for a free log app | about 2% |
| Realistic personal tier price | $30 to $60 per year |
| Best comp, SwingVision | about 20k payers, about $4M per year |

Realistic good outcome: $1M to $5M per year in a few years. Great solo business, not a venture pitch. Not Flo-sized (Flo rides a monthly routine for half of humanity). Bigger money means coaches, clubs, leagues, or events, not more consumer features.

## Sorting rule for new ideas

An idea is worth building if it does at least one of these:
1. Sits on a routine that already exists (Flo, Locket widget).
2. Owns a measurement nobody else has (Arccos).
3. Rides a group that already exists (group chat, roster).

## Ideas, with verdicts

- **Fill the fourth (strong).** "Need one more" is the most common failure in the founder's real group texts. Friends-of-friends matching by availability window, level and court. Solves a weekly pain and pulls new people in.
- **Weekly sports show for your group (strong).** Auto-written storylines: who is climbing, who is ducking whom, upsets, overdue rivalries, odds for Friday. Recap card or narrated clip for the group chat. "Player genius" feeling from scores alone. Distribution.
- **Film ten seconds, your fighter learns your swing (strong, new favorite).** On-device body pose from a short clip; the jelly fighter replays your real motion. Same skeleton feeds an AI coach: "your toss drifts behind your head, here are two drills," plus "your forehand moves like this pro." Combine with score patterns (lose first sets, tiebreaks) and meetup windows to build a practice plan that fits your week. Needs a native pose module (dev build, not Expo Go). Cheap first spike: six frames from a clip to an AI model via an edge function like read-ink, return critique plus two drills.
- **String tension model (good, paid tier).** String type, date strung, matches, days, heat exposure ("left it in the car at the glider port"). Upgrade: tap strings, phone mic reads pitch, compute tension (RacquetTune proves the method). Hot car answer: if poly and a couple weeks old, assume dead, restring.
- **Gear commerce (good, cheap test).** App knows the exact moment you need strings or balls. Affiliate links on reorder prompts; local stringer directory with booking fee.
- **Coaches as customers (good, later).** Free coach tools (students, homework, match records), charge for booking. One coach brings about thirty students. Lessons are where rec tennis money is.
- **Stakes with no money (good).** Ledger of real-world debts: loser buys the can, last place hosts.
- **Events (good, near-term cash).** Monthly San Diego tournaments or ladder finals with entry fees and sponsor prizes.
- **Home-screen widget (good).** Standings, restring countdown, next challenge. Tennis is not daily, so the routine is checking, not playing.
- **Money pot released by unanimous vote (season two at earliest).** Precedent: LeagueSafe in fantasy. Problems: money transmitter licensing (use a licensed payments partner), California gambling law (entry fee plus prize plus contest; needs a lawyer), Apple real-money rules. Contradicts the earlier free-to-enter rule. Start with a ledger, or dues that buy balls or a dinner, or a charity pot.
- **Wild card into ITF or ATP events (prize, not product).** Only possible by partnering with a local UTR or ITF event as a season prize. Marketing cost, not revenue.
- **Friend location map / virtual office (skip as standalone).** Virtual offices (Gather-style) are fading. Friend maps (Zenly, Snap Map, Life360) are owned by big players. Keep "places your crew plays" as the courts screen's expansion path.
- **Watch and pocket sensor capture (later bonus).** Pocket phone sees little; court audio confuses adjacent courts; wrist works but needs a native watch app and SwingVision already has watch modes. Not a first move.

## Avoid

Live public court status as a headline, real-money betting, building a rating system, building booking, a public feed.

## Next steps

1. Sync the season across phones in Supabase so two real friends can use it.
2. Run the two-week test. Pass signal: a fourth person asks to join.
3. In parallel, the one-day swing-coach spike (frames to AI, critique plus drills).
4. Then: fill the fourth, weekly show, tension model.

## Founder preferences to keep in mind

- No emojis anywhere.
- Physical, touchable, simulated screens; hates forms and static UI.
- Build directly requested features; don't stall with "want me to start?"
- Never delete existing UI without asking.
