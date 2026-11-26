# PHASE: Rugby Manager: the road to market leader

Written 26 Nov 2026 at the owner's request: "Identify more areas in the game to
develop. This game should be the market leader."

This builds on `docs/2.0.0-deep-dive.md` (21 Nov) and does not repeat it. That
review covered the look of match day: stadiums by tier, sponsors on boards,
big-match dressing, national colours, kit patterns, pitch and weather, trophy
art, honours badges, moment cards, screen backgrounds, crest emblems, rotation
planner, deadline day, naming a stand, a new ground. Where an item below leans
on one of those, it says so and adds only what is new.

Nothing in the code was changed for this. Sizes: **small** is a day or two,
**medium** about a week, **large** several weeks.

**Confidence.** Store pages are high confidence for what they show on the day
they were read (26 Nov 2026). Figures from AppGoblin are a third party's
estimates and are marked as such. Anything from a forum is marked **low
confidence**. Where a figure was not on the page, it says "not found".

### What was opened for this review

- Docs: `docs/2.0.0-deep-dive.md`, `docs/match-sim-spec.md`,
  `docs/match-sim-manager-levers.md`, `docs/acceptance-2.0.0.md` (headings and
  final status), `docs/release-notes-2.0.0.md`, `docs/release-notes-1.9.10.md`
  to `1.9.14.md`, `docs/roadmap.md` (sections 3 to 4), `docs/release-readiness.md`
  (cloud and device lines), `docs/monetisation.md` (the four rules),
  `docs/ip-rename-map.md`, `docs/womens-game.md`, `docs/store-listing.md`.
- Game code: `src/game/monetise.ts` (catalogue), `agency.ts`, `media.ts`,
  `fans.ts`, `medical.ts`, `academy.ts`, `staff.ts`, `firststeps.ts`,
  `legacy.ts`, `chats.ts`, `oppreport.ts`, `transfer.ts`, `ai.ts` (agent terms),
  `season/internationals.ts`, `schedule.ts`, `model/competition.ts`,
  `newgame.ts` (`LEAGUE_DEFS`, `CHALLENGES`), `save.ts` (rename table), and a
  line count of about 40 system files to judge depth.
- Screens and UI: `src/ui/screens/Saves.tsx`, `Settings.tsx`, `Press.tsx`,
  `DreamTeam.tsx`, `src/ui/Tutorial.tsx`, `src/ui/audio.ts`, `src/ui/a11y.ts`,
  and the file lists of `src/game`, `src/ui/screens`, `src/game/match`,
  `src/game/sim`, `src/game/season`, `src/game/rollover`.
- Locale strings searched in `src/locales/en.json` for real competition, club,
  brand and "Lions" names.

---

## Part 1. The market

### 1.1 The rugby rivals on phones

| Game | Maker | Price model | Last update | Rating (count) | What it offers |
|---|---|---|---|---|---|
| **Rugby Manager 26** | Game On Software Ltd | Free, then "Full game" $6.99; also sells +1M cash $2.99, +1M salary cap $2.99, a players pack $9.99, a set-moves pack $14.99, "Six Nations Ireland" $4.99, set-move packs $1.99. Ads. | v1.4.4, "Apr 1" (iOS); Android store updated 2026-03-31 (AppGoblin) | iOS US: 3.0 (1 rating). Android: no rating, about 28K installs (AppGoblin estimate) | 3D or 2D match, skill trees, chemistry, scouting hub, 1,800+ players, press conferences, board, global leaderboard. Sources: https://apps.apple.com/app/id6755044490 , https://appgoblin.info/apps/com.GameOnSoftwareLTD.GoRugbyManager26 |
| **GO Rugby Manager** (same maker's earlier title) | Game On Software Ltd | Free, then full game $6.99; nine set-move packs at $2.99 | v1.0.17, 1 Nov 2024 | Not enough ratings to show | Real players from 40+ clubs, three leagues and European cups, 2D match, salary cap. https://apps.apple.com/us/app/-/id6451142572 |
| **Blackout Rugby (World Cup Ed.)** | Blackout Sports | Free; tokens $1.99 to $99.99, a $69.99 a year premium subscription, loot boxes, ads | v1.254.21, 14 Nov (iOS); Android 13 Nov 2026 (AppGoblin) | iOS US 4.2 (5). Android 3.36 (553), about 235K installs (AppGoblin estimate). Steam: Mixed, 65% of 128 | Online multiplayer manager, 3D match, tech trees, cards for training and contracts, leagues with friends, timers. https://apps.apple.com/app/id1539351070 , https://appgoblin.info/apps/rugby.blackout.android , https://store.steampowered.com/app/1157960/Blackout Rugby |
| **Rugby Manager: Be a manager** | Sweet Nitro | Free; "Gold Balls" $4.99 to $99.99 | v8.10, "April 22" (year not shown) | iOS US 4.6 (157) | Create a club, live player auctions, real-time matches, build a stadium. https://apps.apple.com/app/id1024979276 |
| **Rugby Sevens Manager** | Sweet Nitro | Free; Gold Balls $4.99 to $99.99 | v8.04, "Jan 31" | iOS US 4.5 (24) | The same engine for sevens: tournaments and a world series. https://apps.apple.com/us/app/id1459839842 |
| **Rugby Union Team Manager 4** (PC and Mac only, not on phones) | Alternative Software | $39.99 once | Released 30 Nov 2022 | Steam 70% of 60 | 320 clubs, 10,000+ players, 50+ competitions, 2D and 3D engines, player, coach and database editors, Steam Workshop, Steam achievements. English and French only. https://store.steampowered.com/app/1880930?l=english |
| Rugby Union Team Manager 3 (PC) | Alternative Software | $39.99, plus $8.99 internationals DLC | Released 8 Oct 2020 | Steam Mixed, 68% of 58 | Same family. https://store.steampowered.com/app/1314410 |

Not a manager but in the same store searches: Rugby Nations 26 (an action game,
https://apps.apple.com/app/id6745006677). Phase itself did not come up in a web
search for its own name with "app"; that is a web search, not the store's own
search, so treat it as **low confidence**, but it is worth checking store search
by hand.

**What their reviewers say**

- Rugby Manager 26, the only US review (21 Dec 2025): "the ad videos are
  relentless", "you can't play the game without upgrading", and the game froze
  after the reviewer paid for the last one. https://apps.apple.com/app/id6755044490
- Rugby Manager: Be a manager. Praise: "Everything you could think of about
  running a rugby team." The wish: "Wish developers would come up with something
  self-contained like the Football Manager games. Would definitely spend money on
  that." Complaint: "high level players that seemingly had no idea how to play
  rugby. Strategy adjustments did little." https://apps.apple.com/app/id1024979276
- Blackout Rugby. Operation Sports praised the tutorial, the wiki and the depth
  of training, and criticised pay-or-wait timers on things like stadium upgrades
  that appear "nearly almost from the start", plus bugs in the match view and UI
  overlays. https://www.operationsports.com/blackout-rugby-manager-review-waiting-is-the-hardest-part/
  One App Store review says the game kicks the player out (Oct 2022).
  https://apps.apple.com/app/id1539351070
- The Rugby Forum thread on rugby managers (**low confidence**, undated): people
  want "a Football Manager-style rugby game with depth"; complaints about older
  games were dubious player stats, no editor, tries nearly impossible in open
  play, unrealistic goal kicking, the game getting "repetitive and too easy after
  a few seasons", and crashes. One poster valued that a game was "easy to mod".
  https://www.therugbyforum.com/threads/rugby-manager.9408

**Reading the rugby field.** Nobody on phones has a big following: the largest
rating count found on any rugby manager store page is 553 (Blackout, Android,
via AppGoblin) and the best rated iOS one has 157. Every free rival sells power
(cash, salary cap, players, set moves, tokens or timers), and that is what their
reviewers complain about. The one deep, honest rugby manager (Rugby Union Team
Manager 4) is a PC game from 2022 with editors and achievements. The opening is
plain: be the self-contained "Football Manager of rugby" on a phone that the
Sweet Nitro reviewer asked for, and do not sell power.

### 1.2 The leaders people compare everything to

| Game | Price model | Rating (count) | Source |
|---|---|---|---|
| Football Manager 27 Mobile (Netflix) | Netflix membership | iOS US 4.6 (7.1K) | https://apps.apple.com/app/id6446123740 |
| New Star Manager | Free; packs $0.99 to $6.99, a $5.99 team editor | iOS US 4.7 (8.2K); last update 24 Apr 2024 | https://apps.apple.com/app/id1360417684 |
| Top Eleven | Free; tokens £1.99 to £19.99, loot boxes, battle pass | iOS UK 4.7 (98K); v27.11, 4 Nov | https://apps.apple.com/gb/app/id459035295 |
| Motorsport Manager Mobile 3 | Paid $1.99; IAP $1.99 to $9.99 | iOS US 4.9 (5.8K); last update 5 Aug 2022 | https://apps.apple.com/app/id1346580540 |
| Soccer Manager 2026 | Free; gold £1.99 to £24.99 | iOS UK 4.6 (5.8K) | https://apps.apple.com/gb/app/id6449935779 |
| Out of the Park Baseball 26 (PC) | $49.99 | Steam Very Positive, 82% of 828 | https://store.steampowered.com/app/3116890 |

**The six things that keep players for years, and why**

1. **A squad you grew yourself.** On FMScout, players say what keeps a save going
   is building from a weak club with a home-grown core and "standout players"
   they are proud of; what ends a save is when the club's young talent "dried
   up" for ten seasons (**low confidence**, forum).
   https://www.fmscout.com/q-7794-How-long-before-you-normally-ditch-your-save.html
   Phase already has a 27-man academy that plays its own league (`academy.ts`);
   the work is making the yearly intake and a graduate's first cap feel like an
   event.
2. **Decisions during the event that change it.** Motorsport Manager's listing
   leads with tuning qualifying laps, pit-stop strategy, and reacting to
   "weather, crashes, and safety car periods", and it is the highest rated
   manager found (4.9 from 5.8K). https://apps.apple.com/app/id1346580540 FM27
   Mobile leads with real-time match stats such as expected goals.
   https://apps.apple.com/app/id6446123740 Phase's new engine makes in-match
   decisions real (`docs/match-sim-manager-levers.md`), but there are no
   touchline shouts at all ("Shouts during the match: none in the game").
3. **Playing alongside other people.** Top Eleven's 98K ratings sit on weekly
   association tournaments, live PvP and 28-day seasons; Blackout sells leagues
   with friends; Rugby Manager 26 has a global leaderboard.
   https://apps.apple.com/gb/app/id459035295 , https://apps.apple.com/app/id1539351070
   Phase has no online or shared element of any kind.
4. **Making the world your own.** Rugby Union Team Manager 4 ships player,
   coach and database editors and Workshop support; OOTP lists Workshop support;
   an FM Mobile reviewer asks for "deeper in-game editor controls"; New Star
   Manager sells a team editor. https://store.steampowered.com/app/1880930?l=english ,
   https://store.steampowered.com/app/3116890 , https://apps.apple.com/app/id6446123740 ,
   https://apps.apple.com/app/id1360417684 Phase removed its editor on 27 Aug
   (`Saves.tsx` comment).
5. **The career is never lost.** FM27 Mobile says saves carry over from earlier
   mobile editions; one of its reviewers asks for progress to be kept "after a
   crash". https://apps.apple.com/app/id6446123740 Phase is single-device with
   export only (`docs/release-readiness.md` line 23, "FAIL", later "MITIGATED").
6. **Fair money.** The best-rated games here are the ones that do not sell
   wins: Motorsport Manager Mobile 3 (paid, 4.9). The coin-led games carry the
   angry reviews: Top Eleven, "all about the coins now that or you can't win";
   Soccer Manager, "PLEASE REMOVE gold off buying players"; an FM Mobile reviewer
   worried about "pay-to-win". https://apps.apple.com/gb/app/id459035295 ,
   https://apps.apple.com/gb/app/id6449935779 , https://apps.apple.com/app/id6446123740

One more fact that matters: **FM26 added women's football for the first time
after two decades**, with a separate database and a choice at the start of a
men's or women's team (Pocket Gamer, 19 Sep 2025).
https://www.pocketgamer.com/football-manager-26-mobile/womens-football-debut
It did so under a licensing deal "brokered by FIFPRO and national unions ... on
behalf of players" (FIFPRO, 5 Nov 2025).
https://fifpro.org/en/articles/2025/11/sports-interactive-and-fifpro-add-women-players-to-football-manager-video-game
No rugby rival's store page found mentions a women's game. Phase has one.

---

## Part 2. Where Phase stands, honestly

Strong = deep and visible to a player. Thin = there, but shallow or hidden.
Missing = not found in the code.

| What players of the genre expect | Phase | Evidence (file) and note |
|---|---|---|
| Match experience and in-match decisions | Strong (after 2.0.0) | New engine plays every carry and ruck (`src/game/sim/`, `docs/match-sim-spec.md`); live pitch (`src/ui/livepitch/`); subs, talks, penalty calls and tactic changes bite (`docs/match-sim-manager-levers.md`). Gap: no shouts; captain and called moves barely matter. |
| Tactics depth | Strong | `tactics.ts`, `playbook.ts`, `moves.ts`, `styles.ts`, zone plans, `oppreport.ts` response plans |
| Training and player development | Strong | `season/training.ts` (load, focus, plans), `devproject.ts`, `mentoring.ts`, `retrain.ts`, `ageing.ts` |
| Youth and academy | Strong | `academy.ts` (27-man squad with its own league), `acadcall.ts`, `rollover/intake.ts` |
| Scouting and recruitment | Strong | `scout.ts`, `scoutknow.ts` (fog of knowledge), `commission.ts`, `recruit.ts`, `agency.ts` |
| Transfers, contracts, agents | Strong, agents thin | `transfer.ts`, `rivalbids.ts`, `loans.ts`, `handshake.ts`, `cap.ts`; agents exist only as a price lift (`ai.ts`, `agentTermsLift`), not as people you deal with |
| Squad dynamics, morale, personalities | Strong | `bonds.ts`, `culture.ts`, `room.ts`, `authority.ts`, `temperament.ts`, `chats.ts`, `unsettled.ts` |
| Injuries, medical, sports science | Has it, thin | `match/injuries.ts`, `physio.ts`, `knock.ts`, `condition.ts`; the physio room has two levers (`medical.ts`); "Sports scientist" is only a coach trait (`staff.ts`) |
| Staff | Strong | `staff.ts` (named coaches, badges, courses), `staffrift.ts` |
| Finances, sponsors, stadium | Strong underneath, invisible on match day | `commercial.ts`, `sponsortalks.ts`, `books.ts`, `model/facilities.ts`; visibility is the deep dive's items 1, 2, 9 |
| Board, objectives, job security | Strong | `chairman.ts`, `boardroom.ts`, `boardmemo.ts`, `objectives.ts`, `season/board.ts` |
| Press, media, social | Press strong, social missing | `media.ts` (1,443 lines), `Press.tsx`, `pressmood.ts`; "social media" appears once, in `terraces.ts` |
| Fans and supporter mood | Has it | `fans.ts` (mood with four named causes), `terraces.ts` |
| International management and call-ups | Strong | `country.ts`, `season/internationals.ts`, `natrank.ts`, `isles.ts`, `Country.tsx` |
| Competitions and formats | Strong for fifteens, sevens missing | Nine men's leagues and six women's (`newgame.ts`, `src/data/leagues/w_*`), European cups, Tests, tours, World Championships (`schedule.ts`); no sevens anywhere in `src` |
| Records, history, hall of fame | Has it, history screen thin | `records.ts`, `legends.ts`, `legacy.ts`, `histbook.ts`, `erastory.ts`; `History.tsx` is 46 lines |
| Career movement (offers, reputation) | Strong | `jobs.ts`, `repute.ts`, `career.ts`, `Jobs.tsx`, `Offers.tsx` |
| Editor or customisation | Missing | Removed 27 Aug, v1.1.3 (`Saves.tsx`, `monetise.ts` comments) |
| Online or social play | Missing | No server, no accounts by design; `DreamTeam.tsx` leaderboards are in-save only |
| Achievements | Missing (platform) | No Game Center or Play Games achievements; objectives and challenges only (`objectives.ts`, `CHALLENGES`) |
| Tutorials and onboarding | Thin | `Tutorial.tsx` is four paragraphs; `firststeps.ts` five pre-season steps; Handbook rarely opened (deep dive 2.5) |
| Accessibility | Has it, thin | Text size and separate haptics switch (`Settings.tsx`), dialog focus (`a11y.ts`), colour-blind check on tokens (`Squad.tsx` comment, `scripts/colourblind.ts`), `docs/contrast-audit.md`; no screen-reader pass on the live pitch found |
| Save handling and cloud | Thin | Four slots, export, share-sheet backup (`Saves.tsx`, `nativeshare.ts`); no cloud (`docs/roadmap.md` 4c) |
| Performance on low-end phones | Unknown | "Frame rate and battery on an older Android have not been measured" (`docs/release-notes-2.0.0.md`); a fresh men's save is 5.26 MB (`docs/womens-game.md`) |
| Sound | Thin | All sound is synthesised, no recorded audio (`src/ui/audio.ts` header) |
| The women's game | Strong, and unique among rugby rivals | Two separate worlds (`docs/womens-game.md`), six leagues, women's World Championship (`schedule.ts`, 1.6.4), women's European cup weeks (`W_CC_*`), women's challenges. Not built: kick distances, set-piece weighting, injury tables (ACL), maternity for invented players only (`docs/womens-game.md` section 7) |

**The honest summary.** Phase is deeper than every rugby rival on a phone in
almost every row. The three gaps against the field are: **no online or shared
play** (Top Eleven, Blackout, Rugby Manager 26 all have some), **no editor or
customisation** (Rugby Union Team Manager 4, New Star Manager, FM all have one),
and **no cloud saves or platform achievements** (FM Mobile carries saves; RUTM 4
and Motorsport Manager have achievements). A fourth risk is not a feature: the
store sells cash, a maxed estate and a heal (`SELLABLE_SKUS` in `monetise.ts`),
which sits awkwardly beside rule 2 of `docs/monetisation.md` ("Nothing behind
the till touches the simulation") and beside the reviews quoted in 1.2.

---

## Part 3. The roadmap to market leader

Ranked by how likely each is to make Phase the rugby manager people recommend.
The group each belongs to is given after the rank.

### The twenty

**1. Cloud saves through the platform (2.2)**
- What: the career backs up to Google Play Games saved games and iCloud, with no account of Phase's own. A new phone finds the career waiting.
- Why: the one review complaint that never goes away (`docs/roadmap.md` 4c); FM Mobile carries saves between editions (1.2, point 5); release readiness marks it FAIL then MITIGATED.
- Builds on: `src/game/save.ts`, `Saves.tsx`, `nativeshare.ts`, the native shells.
- Size: medium to large (two to three weeks per roadmap). Art: none.
- Money: none directly. Do not sell it; losing a career is not a premium problem.
- Risk: the 5.26 MB save is above some platform limits per slot (check each); conflict when two devices play the same career.

**2. A fair-play pledge, made true (2.0.0)**
- What: take cash injections and the heal off the shelf for new purchases, keep Pro Manager, cosmetics, Remove Ads and the tip jar, and say on the store page that nothing sold wins matches.
- Why: every free rugby rival sells power and that is what reviewers hate (1.1); the top-rated leaders do not (1.2, point 6). It makes rule 2 of `docs/monetisation.md` true again.
- Builds on: `SELLABLE_SKUS`, `grants.ts`, `Supporter.tsx`, `docs/store-listing.md`.
- Size: small in code. Art: none.
- Money: loses the injection revenue; gains a message no rival can copy without rebuilding their shop. The owner's call (Part 5, question 1).
- Risk: revenue drop; buyers who already own consumables must keep what they bought.

**3. Touchline shouts during the match (2.1)**
- What: four to six shouts (tighten up, go wide, kick for territory, slow it down, keep the ball, protect the lead) that act for ten minutes and cost something (energy or discipline).
- Why: in-match decisions are what keep players in Motorsport Manager (1.2, point 2); the levers table records "Shouts during the match: none in the game".
- Builds on: the new engine's decision weights (`src/game/sim/`, `World.style`), `control.ts` `applyTacticsChange`, the half-time talk spell (`TALK_SPELL_S`) as the model for a timed effect.
- Size: medium. Art: six icons in the existing SVG set (`glyphs.tsx`).
- Money: none.
- Risk: balance; each shout needs a paired-seed measure like the levers doc.

**4. The match report that reads the record (2.1)**
- What: after a managed match, a territory strip, a carries and line-breaks map, breakdown speed, set-piece success and tackle counts per player, all from the new engine's record.
- Why: FM27 Mobile leads with real-time stats (1.2); Rugby Manager 26 sells "analytics"; the spec leaves "which of the new player numbers go on the match report" open (`docs/match-sim-spec.md` section 9).
- Builds on: the `Play` record (spec section 2), `matchday/Stats.tsx`, `Ratings.tsx`, `ScoreCard.tsx`.
- Size: medium. Art: none (drawn in code on the pitch shape already used).
- Money: none. Could be part of Pro as a deeper second page, never a gate on the basic report.
- Risk: screen space on a small phone; the owner already finds some screens too wordy.

**5. Shared weekly challenge with platform leaderboards (2.2)**
- What: one scenario a week, the same seed for everyone (a club, a fixture, a crisis), scored on result and margin; scores go to Game Center and Play Games leaderboards. No server of Phase's own.
- Why: Phase is the only game in 1.1 and 1.2 with no shared element; Top Eleven, Blackout and Rugby Manager 26 all have one. A weekly scenario gives people something to talk about on the Discord.
- Builds on: `newgame.ts` `CHALLENGES` (eight today), deterministic seeds (`rng.ts`, the engine's determinism test), `nativeshare.ts`.
- Size: medium. Art: one header per challenge from the deep dive's X set.
- Money: a rewarded advert for a second attempt, never for a better score.
- Risk: seeds must give the same match on every device and version; cheating on a leaderboard is possible with an edited save, so keep the leaderboard light.

**6. Platform achievements (2.2)**
- What: wire the deep dive's 24 honours badges (its section 4.6) to Game Center and Play Games achievements, so they show outside the game.
- Why: Rugby Union Team Manager 4 has Steam achievements and Motorsport Manager has Game Center achievements and leaderboards (1.1, 1.2); achievements show on a player's profile, which is free promotion.
- Builds on: the honours list once built, `objectives.ts`, `records.ts`.
- Size: small once the honours exist. Art: the H set already listed.
- Money: none.
- Risk: the hidden Isles XV badge must stay hidden in the platform list too.

**7. Battery saver and a measured low-end phone (2.0.0)**
- What: measure frame rate and battery on one older Android before release; add a setting that caps the live pitch at 30 frames and uses smaller stadium pictures.
- Why: "not been measured" (`docs/release-notes-2.0.0.md`); crash and freeze complaints are in the reviews of Rugby Manager 26, Blackout and FM Mobile (1.1, 1.2).
- Builds on: `LivePitch.tsx`, `matchPrefs.ts`, `artPreload.ts`; the 30 fps budget in `docs/roadmap.md`.
- Size: small. Art: half-size copies of the 12 stadium pictures.
- Money: none.
- Risk: none worth naming; the risk is not doing it.

**8. A data and community pack (later, owner's call)**
- What: export and import of a plain file holding club names, kits, colours and player names, so the community can share "real name" packs while the game itself could ship invented names one day.
- Why: editors are standard (1.2, point 4); a forum poster valued a game being "easy to mod" (low confidence); it is also the licensing escape route (see the traps below).
- Builds on: `save.ts` (import and rename table), `src/data/leagues/`, `kits.ts`.
- Size: large. Art: none.
- Money: could be a Pro feature, as New Star Manager sells its editor ($5.99).
- Risk: the owner removed the editor on 27 Aug ("this isnt needed for this game"); a pack that adds real club names and crests puts the trap back in users' hands, so the game must ship no crest images in packs.

**9. The women's game made physically different (2.3, theme: the women's game first)**
- What: the parts `docs/womens-game.md` lists as not built: kick distances 15 to 20% shorter, set pieces weighted to technique over mass, injury tables weighted to knees and ACL.
- Why: FM26 made a women's game a headline in Sep 2025 (1.2); no rugby rival has one. Being the only rugby manager that does the women's game properly is a story the press will run.
- Builds on: `gender.ts`, the new engine's contest strengths (`src/game/sim/fromMatch.ts`), `match/injuries.ts`.
- Size: medium. Art: the deep dive's M12 card.
- Money: none extra.
- Risk: the numbers need sources before tuning (the same rule as `docs/match-sim-sources.md`); the men's game must not move (the doc's own section 8).

**10. A women's season that looks like the real calendar (2.3)**
- What: an invented equivalent of the women's global Test series, contract lengths and free movement closer to the women's game (FM26 models "more free transfers, shorter contracts"), and the dual-career player: some women's players hold jobs and train less.
- Why: the same evidence as 9; the doc lists the global series as missing; FM26's women's model (Pocket Gamer, 1.2).
- Builds on: `schedule.ts` (women's windows), `rollover/contracts.ts`, `season/training.ts`.
- Size: medium. Art: one trophy (deep dive T set).
- Money: none.
- Risk: "dual career" must only apply to invented players or as a club-level setting, never as an invented fact about a named real player (the owner's own rule on maternity, `docs/womens-game.md`).

**11. Contextual first-season coach (2.1)**
- What: replace the four-paragraph welcome with short tips that appear the first time a player meets a thing (first penalty call, first injury, first contract, first board memo), each one line with "show me".
- Why: Blackout's tutorial is the thing its reviewer praised (1.1); feedback shows Offers, Settings and Handbook rarely opened (deep dive 2.5).
- Builds on: `Tutorial.tsx`, `firststeps.ts`, `handbook.ts`, `ContextCard.tsx`.
- Size: small to medium. Art: none.
- Money: none.
- Risk: nagging; one tip per day at most and an off switch.

**12. Share cards (2.2)**
- What: a picture of the result, a trophy, a season summary or a call-up, made by the game and sent through the share sheet with the game's name on it.
- Why: the goal is "the game rugby fans recommend"; a shared picture is a recommendation. None of the rivals' listings mention it.
- Builds on: `nativeshare.ts`, `ScoreCard.tsx`, `SeasonReview.tsx`, the deep dive's moment cards.
- Size: small to medium. Art: reuses M and T sets.
- Money: Pro cosmetic frames only.
- Risk: real player names in a shared image are the same rights question as in the game; keep crests drawn in code.

**13. Law changes over a long save (later)**
- What: every few seasons the world body trials and adopts a law change (a timed red card, a shot clock on kicks, a scrum rule), the board and the league vote, and the engine plays it.
- Why: a save goes flat around season five (deep dive 3.2); Motorsport Manager has "votes on rule changes" (1.2). Rugby changes its laws often, which no rival models.
- Builds on: `src/game/sim/law.ts`, `match/discipline.ts`, `rollover/format.ts`, `erastory.ts`.
- Size: large. Art: none.
- Money: none.
- Risk: every check script and band; each law needs its own measure.

**14. Agents as people (2.3 or later)**
- What: a handful of named agents who represent several players each, remember how you treated them, push for moves, and can be leant on.
- Why: Part 2 shows agents only as a price factor (`agentTermsLift`); FM's transfer complaints are about AI behaviour (1.2, FM review "Fix transfers").
- Builds on: `ai.ts`, `recruit.ts`, `memory.ts`, `chats.ts`.
- Size: medium. Art: none (silhouettes in code).
- Money: none.
- Risk: more inbox text; the owner already wants less.

**15. A sports science and medical department you run (later)**
- What: injury-risk forecasts per player, return-to-play choices (rush, normal, careful), a head-injury protocol decision during matches, a medical staff hire.
- Why: Part 2 marks medical thin (two levers); FM27 Mobile lists physio reports on injury risk (1.2).
- Builds on: `physio.ts`, `medical.ts`, `knock.ts`, `condition.ts`, the engine's `hia` entry.
- Size: medium. Art: deep dive X3.
- Money: never sell faster healing. The heal SKU (`HEAL_SKU`) is the opposite of this item.
- Risk: player welfare tone on head injuries; never let a manager "play through" a head injury.

**16. Sevens (later)**
- What: a sevens circuit for the club or nation, short weekend tournaments, its own squad drawn from the fifteens and the academy.
- Why: Sweet Nitro keeps a separate sevens game alive at 4.5 (1.1); no fifteens manager found has both. Sevens is in the Olympics and in the women's game, which suits Phase.
- Builds on: `academy.ts` (a second squad that plays its own matches), `schedule.ts`, the block engine for unmanaged games.
- Size: large. Art: a small ground (deep dive S1 style), invented trophy.
- Money: could sit behind the paid international gate the women's doc already plans; never sell results.
- Risk: the world series name and its tournaments are trademarks; invent all of it.

**17. Social feed (2.3 or later)**
- What: an invented social feed of fans, pundits and players reacting to results, signings and your press answers.
- Why: Part 2 marks social media missing; FM has had one for years; it gives weeks between matches more life without more inbox mail.
- Builds on: `terraces.ts`, `fans.ts`, `pressmood.ts`, `gossip.ts`, `media.ts`.
- Size: medium. Art: none.
- Money: none.
- Risk: six languages of short posts; real players must never be shown saying invented things that harm them, so posts from named players stay neutral.

**18. Live pitch accessibility (2.0.0)**
- What: respect the phone's reduce-motion setting on the live pitch (show Key moments), make sure the two sides' discs can be told apart in every kit clash and for colour-blind players (a pattern or outline, not colour alone), and let text size reach the score bar.
- Why: FM27 Mobile lists a separate accessibility menu (1.2); Phase already checks tokens for colour blindness but not kit clashes on the pitch.
- Builds on: `a11y.ts`, `matchPrefs.ts`, `src/ui/kit.ts`, `scripts/colourblind.ts`.
- Size: small. Art: none.
- Money: none.
- Risk: none.

**19. A history screen worth opening (2.3 or later)**
- What: a league almanac: every season's table, winners, top scorers and awards, head-to-head between any two clubs, and the club's own timeline, searchable.
- Why: OOTP's deep history sits behind 82% positive from 828 reviews (1.2); `History.tsx` is 46 lines while the data exists (`histbook.ts`, `records.ts`).
- Builds on: `histbook.ts`, `records.ts`, `legends.ts`, `Tables.tsx`.
- Size: medium. Art: deep dive X8.
- Money: none.
- Risk: save size; history must be summarised, not every fixture kept.

**20. Licensing clean-up (2.0.0)**
- What: remove the stored English fallback subject "LIONS: ... make the tour" in `season/internationals.ts` (line 225; the screen shows "THE TOUR" from the key, but the raw text is written into every save and bug report); review the challenge title "Sauvez Sapiac" (Stade Sapiac is Montauban's real ground) and the venue names "Greater Twickenham" and "Little Twickenham".
- Why: see the traps below; small now, expensive after a complaint.
- Builds on: `season/internationals.ts`, `newgame.ts` `CHALLENGES`, `model/competition.ts`, `docs/ip-rename-map.md`.
- Size: small. Art: none.
- Money: none.
- Risk: old saves keep the old text unless `save.ts` renames on load (it already has a rename table for Lions names).

### The same twenty, grouped

| Release | Theme | Items |
|---|---|---|
| **2.0.0** (ships with the live match view; small things only) | Ship it clean | 2 Fair-play pledge, 7 Battery saver and a measured old phone, 18 Live pitch accessibility, 20 Licensing clean-up. Plus the deep dive's small items 3, 5, 7. |
| **2.1** | The match you manage | 3 Touchline shouts, 4 Match report from the record, 11 Contextual first-season coach |
| **2.2** | Never lose a career, never play alone | 1 Cloud saves, 5 Weekly shared challenge, 6 Platform achievements, 12 Share cards |
| **2.3** | The women's game, first class | 9 Physical differences, 10 The women's calendar and contracts, 17 Social feed if there is room |
| **Later** | The long save | 8 Data and community pack, 13 Law changes, 14 Agents as people, 15 Sports science, 16 Sevens, 19 History almanac |

### The top ten in one line each

1. Cloud saves through Play Games and iCloud: never lose a career.
2. Fair-play pledge: stop selling cash and healing; say so on the store page.
3. Touchline shouts: live decisions between talks.
4. Match report from the new engine's record.
5. A weekly shared challenge with platform leaderboards.
6. Platform achievements from the honours list.
7. Battery saver and a real old-phone measurement before 2.0.0.
8. A data and community pack (export and import of names and kits).
9. The women's game made physically different.
10. A women's calendar and contracts that match the real game.

### Licensing traps, plainly

- **Never use** real club names beyond the owner's rename rules, real crests,
  real kits with sponsor marks, real competition names or logos (Six Nations,
  Rugby Championship, Premiership, Top 14, Champions Cup, Super Rugby, World
  Cup, the sevens world series), real sponsor brands, or **"Lions" / "British &
  Irish Lions"** anywhere a player can see it. The Lions hold trade mark
  registrations "from cosmetics to corporate hospitality and beyond", managed
  through licensing partners (Reddie & Grose, 24 Jul 2025,
  https://www.reddie.co.uk/2025/07/24/protecting-the-pride-the-british-irish-lions-and-the-business-of-brand-licensing/).
  A search of `src/locales/en.json` values found none of those competition names
  and no visible "Lions"; the one leftover is item 20.
- **Real player names** are the largest open risk and not one this review can
  settle. FM uses real names under a FIFPRO and national-union deal (Part 1); the
  FIFA 21 row in Nov 2020 showed players will ask who gave permission
  (https://www.pushsquare.com/news/2020/11/fifa_21_rights_row_rumbles_on_as_fifpro_agents_weigh_in).
  `docs/ip-rename-map.md` says the player-name pass is "NOT yet done". Ask a
  lawyer, and keep item 8 as the way out if needed.
- **Near-miss names**: "Quins Rugby" and "Sarries RFC" are the owner's choice
  (rename map, v1.0.3), but they are the clubs' own short names; "Greater
  Twickenham" and "Little Twickenham" carry the name of the RFU's ground. Check
  with a lawyer before a store push or a press release names them.
- **Invented sponsor names** must be searched before they become logos (deep
  dive section 6 already says this).
- **Sevens**: the world series and Olympic names and rings are off limits.

---

## Part 4. Ten things that would make it feel premium

1. **Recorded sound**: a crowd bed and a real whistle; today every sound is synthesised (`src/ui/audio.ts` header).
2. **Haptics with meaning**: a different buzz for a try, a card and the final whistle; the switch exists (`Settings.tsx`), the vocabulary does not.
3. **Load times measured and shown fast**: time from tap to Home on an old phone is not in any doc read; a 5.26 MB save is big to parse (`docs/womens-game.md`).
4. **Typography**: the three Barlow weights already ship (`landing/`); use one condensed weight for every number on screen so tables read like a broadcast.
5. **Empty states that teach**: a screen with nothing in it (no offers, no injuries, no news) should say what will fill it; Offers is never opened in two reports (deep dive 2.5).
6. **Store page round the live pitch**: the 2.0.0 notes say store text and screenshots "want redoing round the pitch" (`docs/release-notes-2.0.0.md`); lead with the women's game and "nothing sold wins matches".
7. **A trailer captured from the real game**: 30 seconds of the live pitch, the touchline call and a try; `scripts/storeart.mjs` already makes real screenshots.
8. **Answering every review**: FM's developer replies to every review shown on its page (https://apps.apple.com/app/id6446123740); Phase can do the same in both consoles.
9. **Support that feels human**: the support page and an e-mail exist (`docs/store-listing.md`); add the in-game bug report's reference number to every reply so players know they were heard (`BugReport.tsx`).
10. **Community with a rhythm**: the Discord is linked from the menu (`docs/store-listing.md`); a weekly challenge post (item 5) and a monthly "save of the month" give it a reason to be open.

---

## Part 5. Open questions for the owner

1. Will you stop selling cash injections and the heal to new buyers, so the store page can say nothing sold wins matches?
2. Are the real player names cleared with anyone (players' associations or a lawyer), and if not, do you want the community pack (item 8) as the fallback?
3. Is a small shared element acceptable if it uses only Game Center and Play Games (no Phase account, no Phase server)?
4. Should 2.3 be the women's release, and should the store page and the 2.0.0 trailer lead with the women's game?
5. Do you want sevens at all, and if so for the women's game first?
