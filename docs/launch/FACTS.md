# PHASE: Facts for copy

Every marketing line must agree with this page. Every line on this page was
checked against the code on 6 October 2026, at version 1.8.11 (`package.json`).
If the game changes, change this page first.

## Safe to say

| Claim | Evidence |
|---|---|
| The world remembers what you did | `src/game/memory.ts`, header: "THE CONSEQUENCE ENGINE: THE WORLD REMEMBERS WHAT YOU DID". Logs releases, promises kept and broken, players rested, academy debuts |
| Players remember promises | Pledges in press and office (`model.ts` `pledge`/`vow`); news "Word kept: {player}", "Promise broken: {player}", "{player} has not forgotten" |
| Agents hear about broken promises | News "Agents talk: your word on the market": agents want more money up front |
| Former players come back against you | `memory.ts`, `matchEngine.ts` `oldBoyApps`: "Former player {player} scores against you", "Point proved: {player}", "{player} meets the old club" |
| Rivalries, fixed and earned | About 40 derbies in `rivalries.ts`; earned rivalries that grow and fade in `grudges.ts`; rival coaches with a record that follows them between clubs (`rivalcoach.ts`) |
| Dressing room and trust | Trust scale "They do not believe a word" to "They would run through a wall"; "THE SPLIT" when the captain is dropped (`room.ts`) |
| The coach tells you why you lost | Coach's Verdict: "What hurt you most:", "Your strongest advantage:", two fixes checked the next week (`coachfix.ts`) |
| Tactics | Five attack and five defence styles, set-piece playbook, drilled moves that opponents learn to read, game plans, half-time team talk, substitutions at any stoppage |
| Match presentation | Live text commentary and live stats, three views; 2D animated highlight clips on a drawn pitch for big moments (`HighlightClip.tsx`). **Not** a 3D match engine |
| Transfers and recruitment | Transfer Centre, rival bids and bidding wars, scouting ranges until scouted, agents, loans, contracts, salary cap. Money is shown in pounds only |
| Academy | A 27-man academy squad with its own league (the "A League"), academy calls, mentoring |
| Board and press | The Boardroom (four asks), Press Room with a press barometer from Hostile to Adoring |
| Career and legacy | Manager Legacy, Roll of Honour, The Annual, Hall of Fame, eras, earned reputation traits ("Known for giving young players their chance.") |
| Size of the world | **171 clubs in 15 leagues**: 9 men's leagues with 107 clubs, 6 women's leagues with 64 clubs (`LEAGUE_DEFS`, counted 6 Oct 2026). Men's and women's game are separate careers |
| Languages | English, French, Spanish, Italian, Japanese, Afrikaans |
| Offline | No account, no login. Gameplay makes no network call (`scripts/netprobe.ts` enforces it). Adverts in the store builds use the network |
| Career length | No season cap. The manager starts at 42 and retires at 62 to 70, so up to about 28 seasons. "Fifteen seasons" is safe |
| Free to play | "The whole game is free, and it stays free" (`pro.firstLine`) |
| Pro Manager | Removes adverts, three Pro-only skins, backs an independent game. **Changes nothing in the rugby** |
| Ruck | News partner. Stories about other clubs carry the "RUCK.CO.UK" byline and logo (`Byline.tsx`). Written permission still pending (programme B7) |
| Platforms | Google Play (live, `com.phaserugbymanager.app`). App Store: **not yet live** (Apple enrolment pending) |

## Never say

| Don't | Why |
|---|---|
| "No ads", "ad-free", "nothing collected" | AdMob ships: 7 banner places and rewarded "(Free with ad)" buttons. Pro removes adverts |
| "Online", "multiplayer", "leagues with friends", "leaderboards" | Single-player only |
| "3D", "full match animation", "console-quality" | Text commentary plus 2D highlight clips |
| "News archive" | The inbox keeps 250 stories; read stories leave after 5 days |
| "Real players" or "official" anything | Lower-tier men's squads are generated names; no licences are held |
| A price | Prices are not agreed yet (programme B4) and come from the store at runtime |
| "Available on the App Store" | Not until iOS is approved. Use "Coming to the App Store" only once a date is real |
| "Over a hundred clubs across eight competitions", "three difficulty settings", "four skins" | Out of date. See below |
| "The world's most realistic", "ultimate", any superlative | Unprovable, and off-voice |

## Contradictions found in `docs/store-listing.md` (fix before the next listing update)

1. Play full description: "Over a hundred clubs across eight competitions". Now 171 clubs, 15 leagues.
2. Play full description: "Three difficulty settings, chosen once". Removed in 1.5.6.
3. Play full description: "Small adverts sit at the foot of two screens... Never during a match". There are 7 banner places, including match day while a highlight plays.
4. App Store review notes: banners only on "Home and Results". Same problem; also mentions "the free web version", which no longer exists.
5. App Store promotional text: "Offline, no accounts, nothing collected." AdMob collects the advertising ID with consent.
6. "four skins": one free, three Pro only.
7. "Player names are real": the lower men's tiers are generated.
8. Neither description mentions the women's game's size, the consequence engine, or Ruck.

The corrected copy is in `docs/launch/assets/02-store/STORE-COPY.md`.

## Open legal wording (owner to decide)

The listing says "Club names are real; competitions, grounds and sponsors are
renamed or invented." The launch programme (L5) wants "clubs are fictional
location-based identities". Real club names do appear in game (for example in
the Roll of Honour). Pick one wording and use it everywhere. Until then, no
marketing asset features a real club name as its subject; club names only appear
incidentally inside real screens.
