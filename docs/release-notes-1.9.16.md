# PHASE: Rugby Manager 1.9.16: release notes

**Not merged, not uploaded.** Built on branch `v1.9.16` from the owner's two
lists (20 Nov 2026: the international notes; 21 Nov 2026, 00:24: thirteen more
points from play). Nothing goes to `main` or to a store until the owner says.
The store "What's new" text is in `docs/store-listing.md`.

Version 1.9.16, Play versionCode 79. Baseline: 1.9.15, code 78.

## What changed for players

### New

- **Start as an international coach.** A second button on the title screen, in
  the Store's style, starts a career in charge of a country with no club. It
  is the Store's existing "Become an International Coach" purchase, so the
  price is the same and anyone who already owns it is not charged again. The
  club career is free, as before. Pick the men's or women's game, a country
  and a name. Shown only where there is a store, or to an owner.
- **Real national squads and caps.** Every men's Nations Championship union and
  all twelve women's WXV Global Series unions open with their announced 2026
  squads and real cap counts, as they stood before the autumn Tests. Where a
  cap figure could not be sourced the game estimates it, as it always did.
- **Close Tests feel close.** In the last quarter of a Test with seven or fewer
  in it: stakes commentary, the crowd, a last-ten call, pressure lines before
  kicks at goal, and the close-game band on the scoreboard pulses. The score is
  not touched: a Test scores the same watched or not.
- **Bust-ups.** In a derby or a grudge match one scuffle in five boils over. A
  lenient referee warns, a fair one bins the instigator, a strict one bins one
  from each side and sometimes sends a man off. Test rivalries count as
  derbies. Measured over 6,708 matches: points and yellow cards unchanged.
- **Pre-match challenges in formation.** New Zealand's arrowhead, Fiji's tight
  block, Samoa's leader in front of loose rows and Tonga's broad block, with
  the other side in an arc on halfway. When both sides have one, both form up.
- **Free agents from day one.** A new career opens with 33 senior free agents,
  three in every position, from third-tier standard to top-flight squad cover.
  The Transfer Centre has a one-tap Free agents button with a count.
- **The rating card is asked for on a high.** Once a career, on the first quiet
  screen after a derby win, a final or knockout win, an upset or a win by
  twenty. It counts as one of the three asks a device ever gets.

### The national desk

- **Drop anyone from the draft squad.** The 23 minimum applies once the squad
  is announced, not before. The counter reads "16 of 32 named, 23 minimum".
- **Injured players are marked.** A red mark with the weeks out on the call-up
  list, the squad, the Test XV and the bench; injured, abroad and clubless
  players stay on the list, greyed, with the reason. The injury is said at the
  top of the player's page.
- **Call up or drop from a player's page**, and a name search on the call-up
  list.
- **Live stats in the teams' colours**, and the stats panel scrolls inside
  itself instead of under the phone's buttons.

### Fixes from play

- **The save slot names the job you hold.** A coach who resigned from his club
  to coach England only still read "Northampton" on the Load screen.
- **Bids never go up when you press minus.** The fee stepper had a 100k floor,
  so minus on a 30k player raised the bid to 100k. Steps now fit the price (5k
  and 25k on a cheap player, 100k and 500k on a dear one). The weekly wage
  stepper had the same fault and is fixed. A selling club's lowest price was
  rounded to the nearest 50k, which put a 30k player's floor above his asking
  price; it is now rounded to suit the fee.
- **Goal kicks from the right place.** Conversions were always drawn 15m out,
  and a missed conversion 22 to 42m out. They are now on the line of the try
  at the distance that opens the angle: 11m for a try under the posts, about
  25m for one ten metres in from touch. Penalties are drawn at the mark.
- **The briefing is a page, not three.** Danger man, head to head and the game
  plan stay open. The conditions, the opposite number, the finishers, the
  record and the partnerships are one line each and open on a tap.
- **Backroom staff cards are compact**: five posts to a screen instead of
  three and a half.
- **The dressing room sheet lines up.** The watch options started 14px left of
  the speeches beneath them.
- **Names in lists stay on one line**, cut with an ellipsis, so a long name no
  longer makes its row taller than the rest.
- **The bottom Kick Off button sits closer** to the last replacement.

### Found by tonight's audits

- **Players no longer get stuck away with their country.** When one Test
  window opened the week another closed, anyone in the old squad but not the
  new one was never released: about 14 players a season could not be picked by
  their club or called up again until the summer.
- **Fire Sale (Pro challenge): the sale money no longer comes back.** It was
  banked, and the next summer's transfer budget is read off the bank balance,
  so the budget roughly doubled a year later. The five empty shirts it left on
  the team sheet are filled.
- **Shoestring (Pro challenge): a takeover no longer opens wage room.**
- **Academy Only (Pro challenge):** the option to buy a loaned player is shut
  with the other doors (it could not be reached, but it was open).
- **Season plan: each choice does what it says.** "Set pieces" trains the
  lineout as well as the scrum (it was lowering the lineout). "Fitness" and
  "Attack" also set the week's preparation of the same name.
- **Season plan, "Backs": a drift defence behind the wide game**, not a blitz.
  With the blitz it was the worst of the three choices at both clubs measured.
- **Money in each language's own style**, pounds kept: "1,5 M£" in French,
  Italian and Spanish, "£1,5m" in Afrikaans, "£150万" in Japanese. English is
  unchanged.
- **Pre-season work is pre-season only.** It runs until the first league
  match, then Training goes back to what it was and the inbox says so. While
  it lasts the squad works four times as hard, so three weeks count.
- **Fire Sale (Pro challenge) is harder and its wording is true.** The owners
  keep the fees and the wages saved: selling the five opens no wage room.
  Measured on Continue at Leicester, Bath and Saracens: the league won in 0 of
  6 careers.
- **A "challenge complete" card follows the trophy card** when a Pro challenge
  is finished by winning one.
- **Eight women moved to the clubs the 2026 squad lists give**, and one
  duplicate row removed. Three could not be moved: their club is not in the
  game.
- **A bid can go down to nothing**, and a Pro manager sees no "?" beside a
  rating in the Transfer Centre or on another club's squad list.
- Sale held one Fijian wing twice under two spellings. Caleb Muntz is at
  Provence.

## Data

- Men: caps for South Africa, Fiji, Japan and Argentina taken back to before
  the autumn Tests from the match-day 23s (assumes every named replacement
  came on). Fiji and Japan narrowed to their November parties. 31 real Japan
  internationals replace generated players in their League One clubs.
- Men, club audit: Fiji 31 of 35 and Japan 33 of 35 of the autumn parties are
  in the game (23 real players added at their 2026-27 clubs), and 21 open caps
  filled for England, Wales, France and South Africa.
- Women, club audit: 18 real players added at clubs in the game, 36 caps
  filled, Wales 36 of 39. Italy, Canada, the USA, South Africa and Japan stay
  short because their domestic clubs are not in the game; every such player
  is listed with her club in the research doc.
- Women: 34 nationalities and 6 positions corrected from the announced squads.
  The English top flight checked club by club against the 2026-27 lists: 17
  players added, 3 moved, 5 released.
- Sources and open items: `docs/research/intl-squads-2026.md` and
  `docs/research/club-audit-1916.md`.

## For old saves

- Real squads and caps are laid over a NEW career only. A save from 1.9.15
  keeps the caps it has.
- The 33 starting free agents are in new careers only.
- Nothing in an old save is removed or migrated by this version.

## Checked

- Unit suite: 577 of 577 in 77 files (21 Nov 2026, 06:50 UTC), with the type
  check, lint, six-language parity, text lint, data audit, international audit
  and provenance audit all passing.
- Scoring bands on four worlds after every change: 49.4 points and 6.47 tries
  a game, home wins 54.5%, draws 1.5%, blowouts 6.8%. Every band holds.
- Engine fingerprint: rebaselined once for this version (real caps, new
  players and bust-ups all move fixed-seed results), with the reason noted in
  `scripts/fingerprint.ts`. The goal-kick and challenge drawings were shown to
  leave it byte for byte the same.
- In a browser at 384x832: the national desk (19 checks), the international
  start with a stand-in store (cancelled, bought, owned), the dressing room
  sheet, the staff cards, the briefing, the challenge formations, and every
  named list at 360, 384 and 412 wide in all six languages (702 checks,
  including that no money figure is clipped).

## Known and not done

- The bust-up has no animation (commentary and cards only). It belongs with
  the 2.0.0 live pitch.
- Tests were not made lower scoring: measured, the game's Tests already score
  less than the real 2026 Six Nations and are as close.
