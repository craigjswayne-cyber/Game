# PHASE: Rugby Manager 1.9.14: release notes

**READY (owner, 16 Nov 2026: "Ok we need to merge and upload this").**
Started 15 Nov from player feedback ("Work on it now but dont merge and ill
keep adding to it"). The store "What's new" text is in `docs/store-listing.md`.

Version 1.9.14, Play versionCode 76. Baseline: 1.9.13, code 75.

## What changed for players

- **A season plan, every summer.** Player feedback: "Be good have a
  preseason focus choose how you will play that season & practice set play".
  A **Season plan** tab on Training & Staff asks two questions, three answers
  each. **How do you want to play?** Forwards (direct attack, choke-tackle
  defence), Balanced (pods, drift) or Backs (width, blitz). **Pre-season
  work:** Fitness, Set pieces (scrum focus, with Set-Piece Work drilling the
  lineout and scrum calls faster) or Attack. The tab is there from the club's
  last game of a season to its first league match of the next (owner: "It
  dissapears for other times"), with a dot until the plan is set; a plan set
  in the summer is for the season ahead. Each answer goes where its own screen
  already reads it, so the detail can still be changed on Tactics and
  Training; set, it folds to one line with Change, and ticks "Set your game
  plan" on the first season's checklist. It adds no rule of its own and leaves
  the set-piece calls alone (a call the pack has not drilled misfires). The
  first version was a Home card with 27 choices; owner: "I think the season
  plan is too confusing".

- **Changing your marquee players.** Player feedback: "Not sure if an issue
  or user error, but I can't change my Marquee Players". It was the game:
  every career starts with both marquee slots filled (your two biggest wages,
  so you do not start in breach of the cap), and a player page with both slots
  taken showed nothing at all, so there was no way to see how to change them.
  Now that page says both are taken and offers **Make marquee instead of
  [name]** for either. The Marquee Players list on Finances > Cap & Squad opens
  the player, and says when the list can change. The rule itself is the same:
  marquee players are named while the transfer window is open.

- **Game Time, as tight as Stats.** Owner: "decrease the space around each
  player on game time page - make it listed and tighter like the stats
  page". Each row held a drop-down kept at 44px for a thumb, so the page ran
  at 59px a player against Stats' 31. What each player was told now reads as
  text, rows are 31px, and a tap on it opens a sheet with the five choices as
  full-size buttons, each saying what it means.
- **Plainer leadership note** on the Team screen (owner: "Check the
  sentences. Doesnt make sense to me?"), with no he or she, in six languages.
- **The feedback report's STORE line.** After six days without a sale
  (purchases checked and working), the report now counts the Store: visits,
  Buy taps, and how each ended (bought, cancelled, failed). Every Buy button
  in the game counts, the Pro offer and Full Fitness included. Still counts
  only, and the heaviest report still fits an email (1,793 of 1,800).

- **What the fans think is hidden.** Owner: "Remove the visual what the fans
  think - this should be in the game but hidden". The Board tab no longer
  shows the breakdown; fan mood and what moves it are still tracked exactly
  as in 1.9.13 (one flag, SHOW_FAN_SENTIMENT, brings the card back).
- **New Discord invite.** The old invites expired (owner, 16 Nov 2026). The
  game, the website, the support page and the store descriptions now use
  discord.gg/kJg5NdsRnq. The bug screen's Post on Discord still opens the
  bug-reports channel (its invite is live, owner); the ideas box opens the
  server invite.

- **Privacy policy and in-app data notice now list everything the adverts
  collect** (advertising ID, IP address, ad and app interactions, device and
  performance data), in all six languages. The policy also now says the
  banners are on ten screens (1.9.13 added the Stats tab, league table and
  fixtures list) and that Pro keeps the optional "watch an advert" buttons.
  Store declarations: `docs/launch/STORE-PRIVACY-1.9.14.md`. Publish the new
  page before updating the store forms.

## Not changed

- The match engine and the world: the plan only writes settings that already
  existed.

## Tests

- New: `tests/marqueeswap.test.ts`, `scripts/marqueeui.mjs` (browser: a full
  list offers the swap, the swap moves the slot, Finances opens the player,
  and the locked page says why).
- New: `tests/preseasonplan.test.ts`, `scripts/preplanui.mjs` (browser: the
  tab on Training & Staff in week 1 and not on Home, Set waits for both answers, every answer at least 44px,
  each lands on its screen, the card folds, and the tab is gone once the
  first league match is played; the unit test walks a whole season).

## Not in this round

- The Xcode warnings (29, from the AdMob and Filesystem plugins): still
  waiting on the full list; the plugin upgrades need testing against the
  adverts, so they go in a later round.
