# PHASE: Rugby Manager 1.9.14: release notes

**READY (owner, 16 Nov 2026: "Ok we need to merge and upload this").**
Started 15 Nov from player feedback ("Work on it now but dont merge and ill
keep adding to it"). Free-agent talks added 16 Nov after the merge, before
upload (owner: "Add it into 1.9.14 as I haven't uploaded that"), then the
club-and-country fixes the same night (owner: add to 1.9.14). The store "What's new" text is in `docs/store-listing.md`.

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

- **Negotiating with free agents.** Player feedback (Instagram, 16 Nov
  2026): "You currently can't negotiate with free agents on wages. Be good to
  add in!" Sign Free Agent signed at a fixed wage on a two-year deal. It now
  opens contract talks: choose one, two or three seasons (each shows what the
  player asks for it, and the length they would choose is the cheapest: one
  season at 23 or under, three at 29 or over, otherwise two), offer a wage,
  or sign at the asking in one tap. From 95% of the asking signs; under 80%
  is turned down; in between, character decides, and a counter is always
  honoured when you meet it. The same offer in the same week gets the same
  answer. Free agents are easier to talk down than your own players at
  renewal (97% and 85% there), since they have no club. Never under the wage
  they last earned. Every guard stays: squad limit, embargo, salary cap, wage
  budget. A one-season deal still counts as two seasons for the resale rule,
  so signing free and selling on stays as hard as before. The two-season
  asking wage is exactly what the old button charged.

- **One manager, two jobs: club and country, kept apart.** Player feedback
  (Instagram, 16 Nov 2026), from a manager holding a club and a country:
  "Couldn't see training for my international team, couldn't edit the squad,
  match week for club got muddled with international". Three fixes:
  - **The Test comes first on Home.** On a week with both, the hero card was
    still the club match (labelled "Assistant's match", from an earlier
    report) with the Test a tile further down. Now the hero is the Test,
    with the club match one line under it: "Your assistant takes Leicester v
    Sarries and reports back." Tapping it opens Club & Country.
  - **The national squad is on the Team screen.** A **Club | Country**
    switch at the top while you hold a national job. Country is the same
    window squad as on Club & Country (call up and drop while camp is open,
    the countdown and the coaches' picks between windows), not a copy.
  - **National training: the camp focus.** A **Country** tab on Training &
    Staff (with a dot while camp is open and nothing is chosen). Fitness, Set
    pieces or Attack, the club's match prep with the same sizes and trade,
    minus the briefing room: fitness tires about 8% slower; set pieces +4% on
    scrum and lineout and -1% attack; attack +3.5% and -1% defence. It lasts
    the window it was chosen in. Between windows the tab says when the next
    camp opens.
  The handbook's national-job answer says where both now live, in six
  languages.

- **The international game, rebuilt.** Owner, after a review of the
  national job: it "should be an honour", "more fun to play" and "only appear
  when coaching"; on the walk-out, "they should stand for the anthems"; and
  "This should all be fixed in 1.9.14 - do not hold anything back!"
  - **The unveiling.** Taking a job (offer or store) opens a full-screen
    unveiling under a band in the nation's colours, with the union's three
    terms for the tenure: a world ranking (top 3 for a top-five side, a
    couple of places up for most, world no. 1 to keep for the best), the
    nation's title (or a win over a top-five side where it has none), and
    three first caps handed out. The keep-the-club question is asked there.
  - **Each window is a campaign** (Club & Country and the Team screen's
    Country side): five steps (camp, squad named, announced, Tests, review)
    and the union's target, one win for each side on the fixture list ranked
    below you (one fewer when that would be a clean sweep of three or more,
    never fewer than one). **Announce the squad** once 23 are named: a
    reveal of the uncapped, the recalled and the big names left out (who take
    it badly, more so if Temperamental or Ambitious), with the press's read.
    **One event in camp**, answered once: a club asking for a player to be
    rested, a missed curfew, a knock in training, an uncapped player who
    stands out (a promised debut that never comes costs morale at the
    review). **The review** when the window closes: met is +4 (+6 beyond it),
    one short -3, more -7; below 35 a warning; below 20 the union ends the job
    there and then.
  - **Test day.** The preview opens under the nation's band with the union
    analysts' read (both rankings, their edge, ours, their danger player),
    **a captain** (the XV's leaders, Leadership shown; 12 or more steadies
    the side, as the club armband does) and **a game plan** (the club's four
    dials, for the country, also on the touchline at the breaks). In the
    middle, the plan is the engine as it was (the fingerprint is unchanged).
  - **The walk-out** before a watched Test: out of the tunnel behind the
    captain; both sides **standing in a line for the anthems**, visitors'
    first, each named; the challenge where a side lays one down (haka, Cibi,
    Siva Tau, Sipi Tau); then kick-off. Skippable. Nations now play in their
    own colours on the pitch.
  - **A Test's full time** has its own card: the score, the world ranking
    move and points, the union's reaction, first caps and milestones (25th,
    50th, 75th, 100th).
  - **Your era** on Club & Country: Tests, win %, best ranking, first caps
    given, titles, and the three terms with ticks; past tenures on the
    Profile keep their best ranking and first caps.
  - **Fixes:** a table title (the Championship, a tour) now gets the trophy
    celebration a final always had; the appointment letter no longer says
    you coach the country "when the club has no fixture" (the Test comes
    first); a national coach without a club sees the country tile on Home;
    the Isles XV letter opens the screen it is answered on; Step down sits at
    the foot of Club & Country; the Championship tile on Home and the Isles
    XV panel show only to national coaches (the Isles one only to the four
    unions it picks from).

- **After the screenshots (owner, 17 Nov 2026).**
  - **No mood on Game Time** ("mood shouldnt be on game time"): the table is
    what each player was told, appearances and what is due.
  - **Squad Cover is off Finances** ("hide this from the user ... worth
    keeping in background to provide inbox messages"). The grid is kept
    (cap.ts), and the club writes when next season is light, at the
    half-way point and six weeks from the end, naming each short unit.
  - **"I'm thinking of leaving"** (leaving.ts). The expiring-contract
    reminders already ran at six, three, one and half a month out. Now, in
    the last three months of a deal, a player whose market wage is well
    above his own (the money) or whose morale is under 4.5 (the mood) writes
    that he is thinking of leaving, once a season. Three weeks on, still
    unrenewed, with a club of his level to go to, he announces a move at the
    end of the season on a pre-contract. A renewal stops it. The rivals'
    pre-contract raid now only takes a man who has warned first (checked
    after its draws, so the world's random stream is unchanged).
  - **The club man the country's coach leaves out** (natwin.ts
    clubManLeftOut): dropping or omitting one of your own club's players
    from the national squad is personal. Happy: fine. Middling: hurt. Low:
    angry, and an Ambitious or Temperamental player at rock bottom hands in
    a transfer request. Professionals and Mercenaries take it best, Loyal
    players are hurt more. On top of the usual sting, so a drop and recall is
    never a morale gain. A letter says how it landed.
  - **The anthems, where teams stand**: one line each side of halfway,
    facing the main stand, visitors on one half and hosts on the other.
  - The captain chips had no space between the name and Leadership.

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

- **Pro challenges (Pro Manager only).** A feedback report from a player
  four seasons in (80% wins, one trophy, never opened Settings) asked for a
  harder game. The new-career screen now has three Pro challenge careers.
  Each has a deadline, and missing it ends the career (owner's choice): the
  manager is sacked and a full-screen card offers only a new career or the
  menu.
  - **Academy Only** (end of season 5): no signings, loans, pre-contracts or
    injury jokers. Win a trophy with the club.
  - **Shoestring** (end of season 6): transfer budget halved every season,
    wage budget halved (never below the current wage bill), no board funds, no paid
    injection, no town collection. Meet the board's target three seasons in
    a row (a miss resets the run).
  - **Fire Sale** (end of season 4): your five best senior players are sold
    to league rivals on day one, and only 30% of the fees reach your budget.
    The same money locks as Shoestring. Win the league.
  Picking a challenge without Pro opens the Pro purchase; nothing starts
  unless the store says it is owned. Leaving the club or being sacked for
  another reason voids the challenge. The web build has no store, so the
  challenges are open there. The match engine is unchanged: a challenge only
  blocks doors and moves money (the fingerprint is the same).
- **One-time price after a big moment.** A free player with 40 or more
  competitive matches sees the one-time Pro price once, at the next safe
  moment after a celebration screen (a trophy, a promotion, a challenge won). It is
  device state like the other Pro cards, never shown twice, and only in the
  store apps.

- **Eilidh's report (iPhone, 1.9.13), five points.**
  - A woman on the shortlist wanted by a rival was still "Move now or lose
    him". The line now has its women's version in English, French, Spanish,
    Italian and Afrikaans (Japanese does not gender it).
  - A close-season event (a golf day, a comedy night) filed an inbox story
    showing its placeholder instead of the event's name. The story text now
    reads the name it was always saved with, in six languages, which mends
    stories already in a career too.
  - On an iPhone held upright, typing in the Transfers name search zoomed the
    page in and left it there: that box was 11px and iOS zooms to any box
    under 16px. It is 16px again, and any zoom a text box brings is let go of
    when the typing stops.
  - Women's players in the positions they really play: 727 real players in
    PWR, the Celtic and Pacific sides, the French Elite 1 and 2 and Richmond
    were looked up against club squad pages, team sheets and union profiles
    (through web-search summaries of those pages; the network here does not
    open the sites themselves). 506 change position, and each is kept with
    its source; where a source said only "prop" or "back row" the old side
    or role is kept. Invented players are left alone. New careers only: a
    career already under way keeps the world it began in, so Holly Phillips
    stays on the wing in a 1.9.13 save. Bristol follows the club's
    own 2026/27 squad announcement: Holly Phillips is a tighthead prop, seven
    players join, and five not on the club's list start as free agents.
  - The try timing (a TRY line, then play, then the try's animation at the
    conversion) could not be reproduced: 30 matches through the engine and two
    full matches on the real match screen, at Fast and Normal and in Key
    Moments, play every try's animation before its line. Asked for the match
    settings she uses.

## Release QA (five testers, men's and women's careers, six languages)

Found and fixed before upload:

- Pro challenges
  - The career-over card could not be left: Main menu and New career now work.
  - Shoestring and Fire Sale: money still reached the budget through the
    treasury slider, a board funds request, a banked injection credit, the
    war chest, the objective bonus, Team of the Year and a takeover. All
    closed, and the Finances store link is hidden under them.
  - Fire Sale: a league title that took the club up was read against the
    division above, so the manager was sacked for winning it. Any league
    title since the start now counts.
  - Academy Only: the board's summer free-agent signings are gone, and a
    trophy won with the country no longer completes it.
  - Pro bought from the new-career screen is claimed at once; no other card
    opens over the career-over card; a challenge win never replaces a title
    celebration from the same summer.
- Transfers
  - A pre-contract is binding: a man who has signed elsewhere can no longer
    be released and signed back as a free agent, and a bid lodged before he
    announced cannot be accepted.
  - Medical jokers no longer warn they are leaving.
  - Free-agent and renewal wages land on GBP 50 steps, so meeting a counter
    is never refused over a few pounds.
- Women's game
  - Every women's club starts with the matchday minimum in every position
    (Exeter had no number 8 or full-back; six clubs were short).
  - The Pacific Four was played with no national squads: the summer series
    released them the week the Pacific Four named them. Every window that
    ends now closes before any window opens, and a window ending in the last
    week is reviewed in the summer.
  - "Agent talk" shortlist alert feminine in French and Italian; "Arroparla"
    in Spanish.
- International
  - A coach who steps down mid-window leaves the federation a full camp
    (England had played three Tests with four players).
  - A nation-only coach has the Country button and the camp focus.
  - The curfew's "send him home" no longer gets round the own-club rule.
  - Test-week text said "Saturday"; Tests are Friday to Sunday, so it says
    "this week" in all six languages.
  - French campaign card: no more "victoire(s)"; step labels wrap at 320px;
    the walk-out "Main stand" label reads in day theme; the captain's ring is
    on the captain's own shirt.
  - Damaged saves: the campaign card's reveal, event and review are checked
    on load.
- New: `tests/qa1914.test.ts` (eight checks; each fails on the code before
  these fixes).

Left for a later round (minor, no wrong result for a player): the loan
buy-out priced against the borrowing squad, a free agent's morale after
repeated lowball offers, the dropped-player morale counted twice, the
walk-out showing one side's challenge, kit clashes in the walk-out, the era
card's record before the week settles, and the Store line not naming the
Pro challenges.

## Not changed

- The match engine and the world: the plan only writes settings that already
  existed.

## Tests

- New: `tests/leaving.test.ts` (money and mood reasons, warn then announce,
  a renewal stops it, the raid needs a warning, the club man's reactions by
  mood and character, next season's short units).
- New: `tests/natwin.test.ts` (target, Tests counted, announcement, camp
  event, review met/missed/sacked, era into the history), `tests/natera.test.ts`
  (terms and unveiling, the Test ledger, the reaction rule, a neutral plan
  is the engine as it was, captain and dials move the units) and
  `scripts/intlstageui.mjs` (browser: unveiling, campaign, announcement,
  camp event, Test preview, walk-out and anthems, half-time dials, full-time
  card, era).
- New: `tests/natcamp.test.ts` (a focus only inside a window, gone the week
  after it closes, tied to its nation, reaches the Test at kick-off, a
  damaged one dropped on load) and `scripts/dualroleui.mjs` (browser: a
  Leicester career with the England job walked to a week with both; the
  Home hero is the Test with the assistant's line, the Team screen's
  Country side has Drop and Call up, the Country tab stores a focus).
- New: `tests/freeagenttalks.test.ts` (the old door unchanged, each length's
  asking, 95% signs, a lowball refused, a counter always honoured and the same
  week repeats it, never under the last wage, the guards, the two-season
  resale term) and `scripts/freeagentui.mjs` (browser: three lengths with
  their own asking, the card scrolls up to the thumb, a lowball answered in
  the card, signing at the asking on three seasons).
- New: `tests/prochallenge.test.ts` (Fire Sale sells five and keeps 30%,
  Academy Only blocks every way in, Shoestring halves the purse and refuses
  board money, the goal awards the badge, a missed season resets the run,
  the deadline ends the career, leaving voids it, the moment card once) and
  `scripts/prochallengeui.mjs` (browser: the Pro section on the new-career
  screen, the challenge banner, the career-over card).
- New: `tests/eilidh1914.test.ts` (her rival line in five languages, a booked
  close-season event's story names the event in all six) and
  `scripts/typezoomui.mjs` (browser: every box you type in is 16px on a
  portrait phone; it fails on the old 11px search box).
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
