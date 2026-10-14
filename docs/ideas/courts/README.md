# Courts → LobsOfLove (working name)

Build plan: `PLAN.md` (October 11, 2026).

Recorded October 10, 2026 from the founder's brainstorm. Nothing built. Grew out of the October 9 market-research pass (`reports/Unoccupied market spaces to enter.md`): the founder's tennis idea plus the San Diego court-availability gap (downtown pickleball runs on a 600+ member WhatsApp group, a deputy sheriff's DIY app, and a static city PDF).

**One line:** Smash Bros character select meets Mario Kart track select, for the tennis you already play with your friends. Courts are the levels, friends are the roster, the season is the game.

**Why it's the open shape:** it logs a real activity people already do, builds a personal record, and shares it with a small real group (the Strava / Letterboxd shape, the only one the research found still lasts). It also gives three other ideas a home that isn't creepy: subject markets become "who wins Friday," Campus League becomes college-vs-college tennis as season one, the charity pot becomes the season prize.

## The six layers, in the order they'd be built

### 1. Roster (character select)
- Every friend gets a fighter name and avatar: Bowser on fire, SSJ3 Goku, whatever. The character select screen is the first thing you see.
- Card back: bio, city, favorite pro, goals, favorite court, and opt-in stats (height, weight, shot speed, best serve clocked).
- Video clips on the card (highlights). Storage cost is real; cap length, compress on device.
- Nobody is on the roster without opting in. Height/weight/speed are self-reported and optional.

### 2. Courts (track select)
- Swipe through courts like Mario Kart tracks: aerial photo or stylized map, name, surface, lights, who is on it right now (opt-in check-ins only, never passive location).
- Court page is a living history: points scored here this season, matches played, best match of the year, photos from the year, miles run on it (sum of players' logged distance), last time it was repaved, pros or celebs who played here (crowd-sourced, with a source).
- "Personal favorite court" badge; your record on this court vs. everywhere else.
- Seeding: founder's own courts first (UCSD, La Jolla, UTC), then the downtown pickleball group.

### 3. Match (the knock)
- Challenge a friend in-app. When you both arrive, knock phones to start the match.
  - iOS has no phone-to-phone NFC for third-party apps. Options: both tap "start" within ~50 m of the court at the same minute; one scans the other's QR; or MultipeerConnectivity / Nearby Interaction for the "knock" feel. Pick after a day of testing.
- A photo is required at the start (the two of you, or the court). This is the anti-cheat and the memory.
- Score entry by sets; both players confirm. Optional: match video upload, serve speed from a clip (later).
- Match card: shareable image for the group chat (the Strava post, the Wordle grid).

### 4. Season (the ATP of your friends)
- Points per match, ATP-style rolling leaderboard among your group.
- Season = a quarter or a semester. Ends with a final, a trophy card, and the charity prize.
- Streaks, rivalries (head-to-head records), "most improved," "court king" per court.

### 5. Gear log
- Racket, strings, tension, last restring, regrip color and date, shoes and their mileage.
- Add a photo and AI fills in make/model; the user confirms and adds the restring date (strings and tension can't be read from a photo).
- Alternative the founder floated: send the photo to ChatGPT/Claude and paste the answer back. The in-app version is one vision call; cheaper to do it natively.
- Reminders: "restring due" after N hours of logged play; "shoes at 300 miles."

### 6. Markets and projections
- Bet on your friends with Tufts (play money, never bought or cashed out). "Who wins Friday," "does Tony win in straight sets," "who finishes the season #1."
- Subjects are opted-in roster members; a player can never bet on their own match (rule from `../subject-markets/README.md`).
- Fantasy-style projection: simulate the season from logged results and rate who's actually best. Shown as a "projected finish" on each card.
- Sponsor-funded cash pot split by the causes players pick (Triton Food Pantry etc.), never cash to players.

## Market research, October 10, 2026

Full report: `reports/Tennis app market and court status.md` (four research notes alongside). Verdict: nobody runs a closed friend-group tennis season with avatars, court history, photo-verified starts, ATP points or play-money markets. 2025–26 racquet capital went to club SaaS (CourtReserve $54M, Playtomic €65M) and ratings (UTR, DUPR). Corrections to the list below: Pickleheads (720K registered, 1M+ monthly, check-in "in development") is the biggest adjacent risk; Playtomic entered US pickleball via DUPR in March 2026 and is criticised as "feels like work"; an indie wave (Slice, Rackt, Twenty Two, Tennboard, Tengether) does head-to-heads and match cards but none has more than 25 ratings; Strava has had tennis/pickleball sport types since 2023 with no court stats. Live public-court status has failed four ways since 2017 (manual reports, geofence, cameras, camera-AI, all at 0–2 ratings); keep presence as an opt-in roster signal, not the headline. Tennis first: the tennis social/log slot has nothing above 80 ratings; pickleball scheduling is Pickleheads' territory. Golf lesson: social and leaderboards free, personal analytics paid; Sleeper lesson: league chat plus per-league identity is the product, money tabs came years later.

## Prior art (memory list from October 10; corrected by the research above)
- **Playtomic**: court booking plus matches, levels and rankings; dominant in Europe, pushing into the US via padel and pickleball. Closest on paper. Does booking, not live "who's here," not characters, not court lore.
- **UTR Sports / DUPR**: ratings. Serious, not fun. Could feed a rating into cards later rather than compete.
- **SwingVision**: AI video tracking of a match from a phone. If video stats matter, integrate, don't rebuild.
- **Pickleheads / PlayTime Scheduler / OpenPlayGrid**: court directories and open-play scheduling. No live occupancy, no social record.
- **Strava**: the shape. No racket sports.
- Nobody found doing: character-select roster, courts as levels with history, phone-knock match start, friend-group ATP season, play-money markets on friends' matches.

## Smallest credible version
Founder's own tennis group, one court, two weeks:
1. Roster with avatars and names (local, no backend).
2. Match log: challenge, photo, score, both confirm.
3. One season leaderboard and a shareable match card.
No courts map, no gear log, no markets yet. Measure: do friends log matches without being asked, and does the card get posted in the group chat.

## Open questions
- Tennis first or pickleball first? Tennis is what the founder plays; pickleball is where the measured demand is (downtown group). Both use the same model.
- How big is "your group"? Friends only, or anyone at the court? The Strava answer is friends, with public courts.
- Does a court get a page before anyone has played there, or only once it has history?
- Name. "Courts" is a placeholder.
