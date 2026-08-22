# Release audit: where it got to, and what to do next

Last updated at the end of the session that shipped the 106-3 batch (subs
sheet, garbage time, rating tail, the war chest, memoprobe's root cause and
the CRN dialweight). Read this before picking up the remaining work.

## The headline lesson, still undefeated

**Treat a red probe as a claim about the probe until proven otherwise.** The
score now stands at TEN probe bugs to one engine character (the sin-bin
`<=`), after this session's full suite returned exactly two failures and
both were the probe again:

- memoprobe (#8) detected memos BY COUNT while the news log was trimmed
  underneath it - it re-read a five-week-old memo against today's table.
  The memo had been honest all along.
- analystprobe (#9) held a FROZEN panel of hash draws to a 2-SE binomial
  band that assumes independence. The panel's triples are deterministic
  constants; frozen per-career accuracy legitimately spans 46-70% around a
  true 58%. The roll itself, measured directly over 270k triples, reads
  57.97% - the calibration assert is now that direct measurement
  (analyst.rollIsRight, exported pure for exactly this).
- wireprobe (#10) computed absolute weeks with a hardcoded 34-week season
  in a 45-week world, so a legal 16-week story gap read as 5.

Instrument before you diagnose; the instrument will usually convict the
yardstick. And the wireprobe dig found a REAL engine bug underneath: the
LAW WATCH freshness gate scanned the trimmed news log and reset at season
boundaries - the third trimmed-log gate in one session, now a stamp on
state (lawWatchAt). Grep for `state.news.some` before writing a fourth.

The tells, all seen in the wild: a number that moved when it could not have,
a failure rate too low for a broken invariant, a yardstick snapshotted once
and compared against many samples, a fixed band with no relation to the
sample's noise floor, detection by aggregate (length, count) over a log that
is trimmed or resampled, boundary `<=` against `<`.

## Current state

- All work committed on claude/rugby-manager-mobile-app-rk7yz1-m54m3g;
  merge to main and Pages deploy verified BY SHA (see the standing rules -
  a branch-filtered workflow query returns months-old greens).
- Suite: full `bash scripts/suite.sh all` run this session - 123 PASS with
  two failures, both probe bugs (#9, #10 above), fixed and re-run green,
  then the engine fast tier re-run over the follow-up engine touches. New
  probes in the engine tier: sheetlock, blowprobe, stanceprobe. stancecheck
  is a REPORTER (measurement, no verdict).
- Health numbers moved ON PURPOSE this session: garbage-time compression
  costs the world ~1.2 pts a game, all of it in already-decided matches.
  bandcheck pool now reads 53.2 pts (band 52-56), 6.25 tries, 55.2% home,
  1.7% draws, 6.2% blowouts (was 7.4%). If a future bandcheck reads ~54.4,
  that is the OLD engine, not a fix.

## What shipped this session, and what it measured

1. **Subs no longer rewrite the saved XV** (mkSide plays on a copy).
   lineupFor returns the user sheet by reference; one afternoon rewrote 8 of
   23 slots on the old engine (sheetlock.ts). This also means instant-result
   injury covers no longer leak into the sheet - the injured man's shirt is
   held for him, as lineupFor's repair path always intended.

2. **Garbage-time compression** (stepTick): leading side's open-play try
   chance damps past +35, floor 0.3, rng stream untouched. Forced mismatch
   max 101 -> 78, median rout kept; top-v-top distributions identical.
   Context that matters: headless top-v-top NEVER produced a 60+ margin in
   425 fixtures - the user's 106-3 at Leinster needed a managed save's
   stacked advantages. The compression bounds the scoreboard whatever the
   cause; the cause itself (how big a managed side's edge can compound) has
   not been separately measured and could be a future pass.

3. **Rating margin tail** (teamRatingTerm): flat cap at margin 25 meant
   31-6 paid like 106-3; now +0.35 more by margin 53, exactly symmetric,
   form untouched. 55+ wins bank mean 8.09, floor 6.7, 43% at 8+.

4. **The war chest** (the user's board-expectations ask, both halves):
   - 'Judge us in May' releases 12% of budget (100-400k, on the button)
     against beating the pundits' predicted finish; a miss repays 1.75x out
     of next summer's refresh. The rate is MEASURED (stancecheck.ts, 16
     paired careers x 3 seasons): 57% miss rate, net +85k +/- 47k a season,
     the residual arriving through better finishes (3.23 v 3.75 mean), not
     the ledger. 2x taxed 100k/season, 1.2x paid 173k - both free lunches.
   - The squad reaction was DEAD CODE (opt.morale only applies with a
     playerId). It now lands on every player and scales with stature:
     safe at a title favourite -0.7, at a wooden-spoon pick 0.0; high +0.2
     favourite, +0.6 unfancied. Reaction prose says so.
   - Found underneath: the season review's "+£250k budget" per met
     objective was WIPED by the budget refresh 400 lines later, every
     season, for two versions - only the boardOwed favour arrived. Money
     promises now settle after the refresh (stanceprobe pins the landing).

5. **memoprobe root cause** - see the headline lesson. boardMemo stamps
   quotedPos; the probe detects by id, holds prose to stamp always, stamp
   to table same-season.

6. **dialweight is CRN now**: one canonical career at 50s; per user
   fixture, the same fixture simmed from the same state and same rng at 10
   and 90; paired difference. Two clubs (Northampton + the league's most
   pack-leaning by packTilt, currently Saracens). What it resolved that
   three reverted calibrations could not:
   - aggression by referee STRADDLES ZERO: +0.30 lenient / -2.33 fussy.
   - kicking leans low-end at both shapes (-2.54 +/- 0.86 NOR, -0.92 SAR),
     inside the 4.0 dominance bar. A real number at last; if it is ever
     tuned, tune it against THIS harness only.
   - style/tempo are mean-level while swinging 6-10 |points| an afternoon,
     and tempo flips sign between clubs - balanced decision dials.
   - The mean-louder-than-noise assert on style/tempo was REMOVED on
     purpose: under CRN a balanced dial reads mean-zero while deciding
     matches. Decoration is caught exactly - all paired diffs zero.
   Probes that pin seed-specific outcomes (a title, a finish) break when
   the engine legitimately moves; stanceprobe now FINDS a qualifying seed
   at runtime instead. Prefer that shape.

## The championship-weekend batch (second wave of live feedback)

Four more reports arrived from the user's double-winning season, all four
the game mis-narrating its own biggest moments, all fixed and pinned by
scripts/occasionprobe.ts (8 of 15 asserts fail on the old engine, the first
reproducing the screenshot verbatim):

- a neutral final's 80,941 was announced as the home gate record (guard:
  !fx.venue)
- the final-day spotlight promised "Win and it is yours" in a playoff
  league (playoff leagues now talk top seed; tableless-title leagues keep
  the old words)
- mathematical playoff qualification now gets announced, strict check
  (5 pts a game for every rival, ties against you), stamped once a season
  (state.playoffClinch)
- the press room leads with a won final the Monday after, a double toasted
  as a double (state.silverwareAsk stamp)

Note the pattern across BOTH waves: every stamp is on state, never a scan
of the trimmed news log.

## The evening batch (third wave)

- THE ANNUAL GATE LEAKED THROUGH MATCHES: kickOff/instantResult had no
  annual check, so the Team screen's MATCHDAY button played a gated season
  to week 6. Both reroute to the Annual now, like Continue. The general
  rule this makes three for: A GATE MUST HOLD EVERY DOOR, and the probe
  must walk every door (annualprobe now walks the match door too).
- Development deals end at 21: warned at 20, promote by 21 or he walks
  (user request, verbatim). AI academies unchanged. acadprobe stages it.
- Legacy screen: league cell width-capped (Finish was off-screen at 412px),
  cups ride on the season row. HOF criteria are club-blind by design
  (peak CA 85 + 350 apps/150 tries/2200 pts, or raw 470/190/3000) - the
  user asked, answer given, criteria left alone.
- Test-window press question rotates its option sets and cools via
  state.natAskAt (no playerId means the office memo never applied).
- MatchDay XV/bench tables share fixed column widths (bench stars drifted).
- "world rankings are out of sync" is NOT diagnosed - the list renders
  live, the arrows compare a monthly snapshot; asked the user what exactly
  disagreed before touching it.
- LEAGUE TABLE PTS CLIPPED ON DEVICE, UNREPRODUCIBLE HEADLESS: the old
  auto-layout table fit headless Chromium at 412/384/360 with fat data and
  scaled text - but with ZERO pixels of slack every time, and a no-slack
  layout clips under any real device's font metrics (the screenshot).
  Lesson for layout probes: a pass at exactly the viewport edge is a fail
  waiting for a font; and geosweep only ever reads tables at week one,
  when the data is at its narrowest. Fixed colgroup layout removes the
  class. Same session: the treasury (balance -> transfer budget in 500k
  slices above the boardReinvests reserve, econprobe holds the ledger).

## The late-night pair (fourth wave)

- GAME-TIME PROMISES BILL AVAILABILITY NOW, NOT THE CALENDAR: p.avail ticks
  forward in settleGameTime (skips natSquad, bans, injury, loans; signings
  and loanees start at zero on arrival; abs-week stamp prevents double
  counting; reset with season stats). ledgerRow bills a share of avail. The
  old whole-season share survives only as a first-touch fallback for saves
  the counter has not reached. humanprobe stages Test-duty v benched-by-
  choice; old engine owed both the same and drifted both.
- THE BUY-BACK GATE: p.joinedAt stamped by the transfer executor; agreeFee
  refuses sales of a sub-22-week arrival below double the ask, with the
  reason in the message. haggleprobe pins door, reason, and expiry.

- RENEWAL COUNTERS ARE HONOURED: "they'd sign today at X" was refused when
  met (week-seeded roll ran below FULL demand; counter = 0.97 * demand), and
  fmtMoney printed the counter as "£8k" while the button's fmtWage said
  "£8.4k" - the same 8,400. Any offer at or above the counter signs now;
  wages print via fmtWage. renewprobe meets every quoted counter same-week
  (old engine: all 23 refused, Fischetti reproduces the screenshot).
- NAMING RIGHTS NAME THE GROUND: applyStadiumName composes
  "{sponsor} Stadium at {stadiumBase}" (base captured once, so sponsors
  replace rather than stack); signOffer and the expiry caretaker both call
  it; seedDeals derives the inherited sponsor from the data's own name
  ("cinch...") so fresh worlds agree from day one; save.ts heals live
  mismatched saves idempotently on load. dealprobe pins all three.
- FREE AGENTS: "Free agents" is an option in the market's League select
  (their league is nowhere), and signFreeAgent(ai.ts) replaced the inline
  page button that skipped cap and embargo checks. Rule of the find: AN
  ENGINE RULE A SCREEN CAN BYPASS IS NOT A RULE - grep the screens for
  direct state mutation when touching any market path.

- THE TEST WEEK IS THE MANAGER'S: userMatchThisWeek (season.ts) is the one
  decision point for whose match this week is - Test outranks club; the day
  walk and both match entrances read it. The settle's "assistant's Saturday"
  block runs the club fixture's full bookkeeping with boardReaction's
  delegated flag (mgr record counts only the match he attended). Home
  carries a country desk card. testweekprobe stages the collision.
- THE COUNTRY DESK (the user approved the full package: "yep this all
  sounds good. lets build it all"): src/game/country.ts is the engine -
  natWindow (open call-up window + cap, read off season.ts's now-exported
  activeWindows), natEligible (one callable() predicate shared with the
  guards so screen and engine can never disagree), natCallUp and natDrop
  (refusal-message contract like treasury's releaseBlock; cap at the
  window size, floor NAT_SQUAD_FLOOR=23, injured/loaned/clubless refused,
  every squad change voids state.natLineup so match day repicks from the
  real room). state.natRecord {m,w,d,l} is the tenure's own Test ledger,
  incremented beside the mgr record in the settle's Test branch, started
  in answerNatOffer, cleared on resignNat and the union's annual-review
  sack (rollover.ts). A national-coach press beat (media.ts, stamp
  natCoachAskAt, 6-week cooldown, window-open gated) carries the new
  PressOption.natConf field - answers move the UNION's confidence, not
  the club board. The Club & Country screen (Country.tsx, nav 'country')
  holds it all: rank + points + confidence bar + tenure record, both
  appointments with step-down buttons (resign/resignNat, two-tap
  confirm), the window squad with Drop/Call-up per row, the next men in,
  the Test calendar. Home's country card and a natTeam-gated World menu
  entry route to it (the entry appears only while the job is held and
  vanishes on resign or sack - the user confirmed that gating is the
  intended shape). countryprobe.ts pins the lot (its old-code
  demonstration is module-not-found: the feature did not exist).
- NO VELVET ROPE + THE RECORD SURVIVES (user: "there should be no age
  limits or restrictions on who should be picked" / "your international
  record still stays on your profile"): callable() in country.ts is now
  passport + fit + not-already-in-camp ONLY - the 12-name eligible cap,
  the clubId and onLoan refusals are gone, and natEligible returns the
  whole qualified population. The window-open default build in season.ts
  drops its ca>=68 floor for the USER's nation only (usersNat flag; AI
  nations keep it so the world sim's squad quality is untouched - a
  nation of 60-rated pros now gets its real men called instead of
  generated stand-ins). closeNatTenure (model.ts, NOT country.ts - a
  country->season->rollover import cycle was the reason) is the ONE door
  out of a tenure: it archives natRecord into natHistory and clears the
  live fields; store.resignNat and the rollover annual-review sack both
  call it, and Profile.tsx shows every tenure - closed and current - in
  an International Record card. countryprobe parts 5-7 pin all of it,
  demonstrated behaviourally red on c2e612e (9 FAILs on their own lines;
  closeNatTenure is looked up via a namespace import in the probe so the
  old code fails per-assert instead of dying at load). countryui.mjs
  checks the profile card renders both tenures.
- A LEAGUE IS JUDGED ON ITS OWN TERMS (user, scanning National League One
  clubs: "they all say relegation zone"): the new-career Media Verdict
  read ABSOLUTE reputation on Premiership-calibrated thresholds, so every
  club in a lower division wore the same bottom tag - in a league with no
  relegation and no playoffs, both impossible words. mediaVerdict
  (newgame.ts) ranks the club inside its own league and only promises
  what that league has: playoff words need playoffTeams > 0, promotion
  words are for ladder leagues (natl1), relegation words need the league
  on RELEGATES - which moved from a LeagueTable-local constant to
  model.ts as the single source (LeagueTable, mediaVerdict and gossip's
  pundit-predictions verdict all read it; the pundit line said
  "relegation favourites" in no-relegation leagues too). verdictprobe.ts
  sweeps every league for monoculture, exactly-one-favourite and
  impossible-word claims; red on 2fce955 (the rule only existed as a
  screen constant). LESSON REPEATED: absolute thresholds calibrated on
  the top flight break silently in every other division - grep for
  rep-threshold word ladders when a lower league reads wrong.
- LOAN GRAVITY (user, at Esher: "ive been able to loan some huge
  players... unrealistic... the odd few may for game time but
  realistically it would be more championship players"): loanTargets'
  only parentage test was parent.rep >= user.rep + 4 - at a rep-38
  third-tier club EVERY club in the world passed, and the
  top-12-by-potential sort handed Esher twelve Premiership/Top 14
  wonderkids and zero Championship names (the old-code probe run shows
  exactly that). Two-part fix in loans.ts, both reading the new
  LEAGUE_TIER/leagueTier pyramid map in model.ts: (1) a two-division
  drop is only for age <= 21 behind a mulberry32 per-player-per-season
  gate; (2) "the odd few" is a COUNT, not just a filter - at most two
  big-drop names on the list at once, because the potential sort ranks
  any surviving wonderkid above every honest borrow (first cut passed
  the letter of the rule with 11 of 12 still top-flight kids - assert
  list COMPOSITION, not just member legality). loanstep.ts pins it,
  4 FAILs on 19e62d0 via the namespace-fallback trick.
- NORTHAMPTON 2026/27 (user supplied the club's own squad-announcement
  screenshots): prem_b rewritten to the published list - nine out (West,
  Millar Mills, Atuanya, Scott-Young, Graham, Brown, James, Furbank,
  Ramm), new seniors authored (Zigiriadis, Alexander, Bennett, Taylor,
  Pugh, Faissal, Todaro), Hendy moved to FB as the resident 15. Neculai
  (ex-Zebre) and Els (ex-Quins) arrive via VERIFIED_CLUB relocation, not
  second entries. The 18 Senior Academy names went to ACADEMY_PROSPECTS
  (17 fitted to ACAD_SHAPE's open shirts; Pugh takes the third senior 9
  because the shape holds only two SHs). TRAPS HIT, for next time: (1)
  deleting an authored man whose name is in the PREM_2526 guide lets
  FROM_GUIDE drag a NAMESAKE in by name alone - Cardiff's Atuanya and the
  Pirates' Tom James both landed at Saints until hand-table entries
  pinned each to his own club; (2) relocating a player OUT opens a
  real-cover gap at his old club and trips dataaudit's ratchet (31>30) -
  Zebre needed a real backfill (Matteo Nocera, additions.ts) not a
  ratchet bump. saintscheck.ts pins the announcement (37 FAILs on
  9dde811); dataaudit PASSED after the backfill.
- THE DATA CHANGE'S RED WAVE, five probes, each a different lesson:
  - round25b (terrace pulse repeated at seed 2, weeks 41+42): A REAL
    ENGINE BUG - and a lesson in paying the instrumentation debt. First
    diagnosis (news-scan cooldown vs NEWS_KEEP trim - the fourth
    news-scanning gate) was true but NOT the firing mechanism: the
    stamp fix alone left seed 2 red. pulsedebug instrumentation showed
    week 42 was a BLANK week - no match, form guide frozen at LWWW, so
    "fresh" (run-just-became-three) stayed true and the fresh path
    BYPASSED the cooldown entirely, re-announcing the same third win.
    Both fixed in gossip.ts: state.pulseAt stamps (subject ->
    season*100+week) and the cooldown now holds BOTH doors - a genuine
    new streak needs 4+ match-weeks between same-subject pulses, so
    nothing legitimate is lost and fresh only picks the voice. The rng
    draw stays where it was; the stream is untouched.
  - ratingprobe: PROBE BUG #11 - "the world's mean mark" was one club's
    marks weighted by that club's RESULTS; the new Saints squad lost
    more autopiloted seasons, the loss buckets grew, and the raw mean
    sank with the rating scale untouched. The tripwire now anchors on
    the midpoint of the narrow-win and narrow-loss bucket means, which
    no result mix can move.
  - difficultyprobe: "sleepwalk NEVER wins the league" at n=3 was a coin
    toss wearing a principle's clothes - the flipped seed's title was
    won by the optimiser too. The claim is now paired per seed:
    autopilot must never win a title the engaged manager MISSED, and
    Continue must not be a guaranteed trophy.
  - dialweight's referee conditional: the observational buckets held
    different MATCHES (SE +/- 1.7 against a sub-point slope). Now a
    controlled experiment: refFor hashes the fixture id, so the same
    snapshot re-simmed under a swapped id changes only the whistle, and
    the same rng seed gives CRN across the referee - one paired
    lenient-minus-fussy swing per fixture, noise cancelled in the pair.
  - fingerprint: legitimate rebaseline (the data change moves the world
    build stream), done per its own protocol - four-seed balance
    verification BEFORE updating EXPECTED, in the same commit, run
    PAIRED (same script at 9dde811 and at the new data): 53.4 -> 53.6
    pts/game against a seed spread 1.7 wide, tries 6.28 -> 6.28.
  - dialweight's controlled referee experiment then showed the real
    slope: +4.23 +/- 1.96 a match paired - the observational buckets
    had a genuinely large effect buried, not a marginal one.
  META-LESSON: a data edit is an engine-visible change; expect the
  seed-pinned measurement family to move, and treat each red as its own
  diagnosis - this wave held one real engine bug among four probe
  calibration artifacts.
- THE 2026-27 PREMIERSHIP TRANSFER WINDOW (user pasted Wikipedia's transfer
  list and the league's captains article as screenshots - BOTH DOMAINS ARE
  EGRESS-BLOCKED here, and WebSearch's summary of the same page merged Bath's
  and Bristol's squads into one, so screenshots are the only trustworthy
  route). 233 movements recorded in a ledger, then classified mechanically
  rather than by hand: 59 relocations, 22 removals, 8 skipped, 113 arrivals
  we never had. Ledger + plan kept at scratchpad/xfer/ (regenerate rather
  than trust it: it is scratch).
  - MECHANISM: VERIFIED_CLUB gained `name@sourceclub` keys. A name is not an
    identity - 35 names in this data belong to two men - and the old
    name-keyed table would have sent the Esher winger George Martin to
    Saracens alongside the Leicester lock. A scoped key binds one LISTING;
    any scoped key silences the plain-name form for that name's other
    listings (SCOPED_NAMES, precomputed - the lookup runs per player per
    build). dataaudit learned the key form too, including that a pin must
    name a club the man is actually listed at.
  - RULE THAT SAVED THE DATA: a movement only bites if the player is in the
    squad of the club the page says he LEFT. Eight fired otherwise - Newcastle
    releasing "Jack Grant" would have deleted a Waratahs scrum-half, "Harry
    Wilson" leaving Saracens would have deleted the Wallabies number eight.
  - SAME-MAN DUPLICATES MUST BE PINNED AT BOTH ENDS. Pinning only the
    departing listing left the duplicate unmoved, and the builder's global
    one-player-per-name dedupe then kept the WRONG copy (Chamberlain built at
    bulls when the pin said lions). Six pairs now pinned twice.
  - HAND-ADDED MEN ARE EXEMPT FROM RELOCATION (newgame.ts). additions.ts
    places a man at the club that needs him; the 2025-26 guide still said
    Northampton and silently deleted all four restored Saints men.
  - GAP_BUDGET 30 -> 39, documented: nine clubs the page does not cover
    genuinely lost a man (Ospreys, Blues, Dragons, Chiefs, Drua, La Rochelle,
    Stade). Two of thirteen new gaps closed with men the list itself names
    arriving (Vunipola to Leicester, Francis to Sale). Never invent the rest.
  - Captains: the league's article settled three of the four open questions
    this repo had recorded (Sale is van Rhyn not Ben Curry; Exeter's Jenkins
    is the on-field skipper; Dombrandt confirmed), added Newcastle, and
    confirmed GLOUCESTER IS OFFICIALLY TBC - which is why no name is pinned
    there rather than a guess.
  - xferprobe.ts pins all of it; 38 FAILs on 14a8b95.
- THE FOUR PILLARS (user approved the design doc, then: "action everything
  above to make this game more challenging"). Three new leaf modules plus
  couplings, and the meta-claim that made it shippable: IN A FRESH WORLD AT
  NEUTRAL DIALS NOTHING FIRES - fingerprint verified unchanged with all of
  it wired, because the tendency window is empty, every dial sits at 50 and
  repetitionFatigue() is exactly 1.0.
  - authority.ts: squadProfile (top-23 mean ca on the reputation ruler),
    standing() (gap bites past -20, saturates at -45, delivered trust
    cancels the strain LINEARLY TO ZERO at 100 - the first cut kept 25%
    forever and trustprobe rightly convicted it against the trust
    system's own full-effect promise), the discipline machine (flagged -> handled / festering /
    challenged; a fine's landing is deterministic on incident id vs bite),
    the senior-players meeting (2 live grievances, challengeAt STAMP,
    8-week cooldown). Couplings: drillWeek speed x standing.familiarity,
    applyPreTalk distance x standing.talk (COMPOSED with trustFactor - they
    model different things), office incidents resolved via answerPress's
    new opt.disc, auto-fester after 2 ignored weeks in disciplineWeek.
  - tendency.ts: 5-match ring buffer of user dials written at club-match
    settle; predictability = extremity x (1 - spread) so alternating 15/85
    reads ZERO; pattern maps the habit onto the COUNTER table's ids.
    dialStreak walks per-dial extremity runs (+/-signed, decay 1/match).
  - oppcoach.ts: archetypeOf hash of club id -> stubborn 45% / analyst 35%
    / reactive 20% (measured 48/35/18 across the world). analystShift =
    dials pulled toward COUNTER by predictability x rep-skill x 0.45,
    expressed as unit-factor RATIOS through a coefficient table that MUST
    match applyModifiers term for term (cross-referenced comments both
    ends). Applied in beginMatch as layer()s with a "done his homework"
    event. Reactive tier lives inside aiTacticShift: losing by 5+ at tick 5
    (then 10+ at tick 14, max twice), counters the user's loudestDial with
    small paired trade layers, no rng. repetitionFatigue: tempo/aggression/
    defLine streaks past 75 cost 3%/match petrol after the first, cap 12%,
    via side.repF set ONCE in mkSide (the substitution rebuild re-runs
    applyModifiers, NOT mkSide - drainF is assignment-unsafe there, which
    is why repF is its own field).
  - scout.ts staged reports: reportStage 0-3 on the knowledge scalar;
    persKnown at 90+; PlayerScreen gates the Character chip and the trait
    chip (stage 2) and prints the stage word. ClubScreen names the dugout
    archetype (The Believer / The Analyst / The Tinkerer) - countering is
    a system to play against, not a hidden tax.
  - pillarprobe.ts pins all of it including the beginMatch integration and
    the fresh-world silences; red on 705dafe (modules absent). Watch in
    future: dialweight now measures dials in a world where reactive
    dugouts answer them - if its floors/bars ever drift, suspect that
    coupling first.

## The absent-manager wave (autopilot must cost something)

Live report, week 11 of a fresh hands-off save, 3W-1D-1L: "ive not made one
single change yet in the game since I signed up and started everything is
done with the auto buttons". difficultyprobe's sleepwalk/optimise gap was
this finding in a lab; the save was it in the wild. Two free lunches:

1. **Every auto-named side was the honest optimiser.** The Best XV button
   was autoSelect with claim() on top; the day-one sheet, the stale
   tidy-up, MatchDay's tunnel fix and one-tap rotation were all the same
   answer key. Now `assistantJudgement(state)` (matchEngine.ts) is a
   deterministic per-man misread - mulberry32 on (seed, season, week,
   player id), zero shared-rng draws - multiplied into autoSelect's score
   at every point where the ASSISTANT names the user's side. Amplitude by
   staff.assistant level: 12/8/5/2 percent for levels 0-3, so upgrading
   the assistant is now a real lever. AI clubs and the difficultyprobe
   OPTIMISER still get the honest ranking (no judge arg = factor 1). A
   manager-picked sheet (userPicked) is untouched, as ever.

   THE TRAP THIS WAVE WALKED INTO, measured before it shipped: the first
   cut had lineupFor re-name an unclaimed sheet FRESH EVERY WEEK through
   the assistant's eye, on the theory that weekly fuzz compounds. It made
   autopilot BETTER - difficultyprobe's sleepwalker jumped to 55.7 pts
   (paired 314d8cb baseline: 34.7) and the optimise gap collapsed to 4.7
   (probe red). A weekly form-and-condition refresh is worth far more
   than a 12% misread costs. The absent manager's real bill is the STATIC
   sheet nobody updates; the misread is a surcharge on the rare day
   somebody names one. The sticky sheet stays, exactly as before, and
   only the naming moments carry the eye. Final paired numbers (n=3
   seeds, noise-dominated, read the asserts not the points): old
   sleepwalk 34.7 / optimise 60.3, new sleepwalk 43.0 / optimise 57.0,
   both trees green on every difficultyprobe assert. Paired four-seed
   balance: 53.80 pts/game on BOTH trees - the league never noticed.
2. **Silence at the press desk was free.** An expired question now docks
   0.8 board confidence and 0.4 fan mood in the expiry sweep
   (season.ts), sized below the worst live answer (board -0.2 option = 1.0
   confidence) so answering badly still beats not answering.

Surfaced: Selection screen shows a muted "your assistant names this side"
line on unclaimed sheets; handbook Q&A "What happens if I never pick the
team myself?"; Tutorial and Best XV handbook text now call the button the
assistant's draft. Probe: scripts/absentprobe.ts (red on 314d8cb: export
missing + both expiry costs 0.00). Fingerprint: ONLY the leicester fixture
moved (the fingerprint world's user club) - the other five scorelines held,
which is the dormancy property doing its job; rebaselined with the paired
four-seed balance measurement in the same commit. Trap for the next reader:
lineupFor writes a FRESH array each weekly naming, so capture
club.tactic.lineup AFTER the call when asserting write-back (nearly probe
bug #12).

## The charcoal-and-green pass (floodlit palette, user-specified)

User: "looking to bring the game colours up to the level", with eight anchor
values - bg #181a19, cards #222624, active #42b94f, pressed #247a32,
headings #f4f6f4, body #9ba29d, borders #3a403c - and two rules: charcoal
dominates (green ONLY for actions, selected states, ratings, form, positive
numbers) and a #247a32-to-#42b94f gradient for major hero elements.

Night theme only - the day theme keeps its blue-and-cream. Implementation is
almost entirely the .app.night token block in theme.css: the --brand-* ramp
(masthead, nav, buttons) remapped to charcoal so the chassis follows without
touching component rules, and the --gold accent family keeps its NAME but
carries the green (every active state, meter, unread bar and key number
already points at it - renaming eight tokens across 3358 lines buys nothing).
The hero gradient is rationed to the Continue button and .btn.gold, with
near-black ink: white sits at 2.5:1 on #42b94f, the dark ink reads 7:1 there
and 3.4:1 on the deep end. Literal navy stragglers to sweep on any future
palette change: masthead/bottom-nav/scoreboard/title-screen gradients,
dt-board, sheet-row, rt-bar, cap-bar - grep the night block for hexes.

Probe: scripts/paletteqa.mjs pins the eight anchors and the two structural
promises (chrome stays charcoal, selection is green, hero gradient on
Continue) to the RENDERED page. Guardrails: nightcontrast 2.2 caught the
first cut's ghost stars at 1.6:1 (--star-empty landed two steps too dark for
the striped rows - read that token's comment before touching it); colouraudit
was rebaselined 0.112 -> 0.093 deliberately, in the same commit, because the
charcoal directive lowers AVERAGE chroma by design while squad/tactics hold
26%/30% vivid; contrastprobe 4.5 on form controls passed untouched.

PROBE BUG #12, and it finally happened for real: the red-demonstration run
of paletteqa on the old worktree came back GREEN because an earlier crashed
probe run (server.stop was misnamed server.kill) leaked its DETACHED vite
preview on port 4193, and the worktree probe connected to it - measuring the
NEW dist while standing in the old tree. --strictPort makes the second vite
exit, it does not make the first one die. Before trusting any browser-probe
red OR green from a worktree, pgrep for stray "vite preview" holders of that
port. The false green read exactly like a probe that forgot to look.

## The token system (two accents, two modes, no hex outside tokens.css)

The design brief that supersedes the charcoal-and-green pass: role-named
semantic tokens in src/ui/tokens.css (night DEFAULT + day from one variable
swap), green = positive/actionable, gold = value/attention, red = loss/risk,
key numbers in text-primary with colour only on deltas, elevation by surface
lightness (the shadow tokens are gone), hero gradient rationed to the club
header and matchday hero. Stage 1 (tokens + contrast audit) was gated on
user approval; approved with --on-primary amended #0b1310 -> #070d0a.

The enforcement triad:
  - scripts/tokenlint.ts - hex anywhere outside tokens.css fails the suite
    (src/data exempt: club colours are data; alpha masks and stopOpacity
    glosses exempt; RETIRED token names banned so fallbacks cannot resurrect
    the old palette).
  - scripts/paletteqa.mjs - the rendered contract, night AND day legs.
  - docs/contrast-audit.md - 66 pairs, 60 pass, 6 usage rules.
docs/palette-migration.md is the judgement-call ledger (deliverable 4).

Traps hit and paid for:
  - JS sets --club1 per save but never --club1-ink; pointing the :root
    default at --on-primary painted shirt numbers black-on-black at night
    (1.1:1). It is var(--prop-ink) white, as the old palette had it.
  - The ghost stars demanded a THIRD calibration (star-empty saga continues):
    border-strong reads 2.1:1 on striped rows at night, 1.6 in day. They
    are var(--text-muted) now - slightly louder, always readable.
  - The old --gold was action AND value in one token; 52 sites classified
    by hand (selection family -> --row-selected-*/primary, attention ->
    gold, structure -> border). grep the commit for the full mapping.
  - Old saves keep their rm-night key; only fresh installs flip to night
    default (localStorage absent => night).

## Open work, roughly in order

1. **Pass 9 of the commercial release audit** - untouched.
   Prompt: docs/release-audit-prompt.md.
2. **Where does a managed save's edge come from?** The 106-3 needed an
   effective strength gap headless play never produces between top clubs.
   Facilities + morale + chem + talks + briefs each measured fine alone;
   nobody has measured them STACKED against the AI baseline. If the stack
   is worth more than a rep tier, difficulty reads too easy for an
   attentive manager. (This is measurement, not a fix - the compression
   already bounds the scoreboard.)
3. **Ratings, user's verdict pending**: "feel better but still a little way
   off" was written before the tail shipped. Wait for live feedback before
   touching the constants again.
4. Two design calls that are the USER'S to make, not yours to assume:
   - every replacement comes on at 60% minimum, making the Medical screen's
     "under 62%" warning partly untrue for bench players
   - forwards still rate below backs (21% v 29% rated 7+ post-tail);
     closing it needs a scrum/breakdown term, and those figures carry the
     tactical dials, so it could be farmed by a slider. Left deliberately.

## Conventions worth knowing

- Full suite: `bash scripts/suite.sh all` - POSITIONAL arg. Without `all`
  it silently skips the five long probes.
- Never rebuild `dist` or edit `src`/`scripts` while a suite runs.
- Every fix ships with a probe demonstrated to fail on the old code, via a
  git worktree at HEAD with `ln -sfn /home/user/Game/node_modules`.
- Every new dial mean-neutral, verified by MEASUREMENT (stancecheck.ts is
  the current template: paired careers, same seeds, report the SEM).
- Deterministic gates use mulberry32 on seed/id hashes, never the shared
  match rng (dialweight's per-fixture rng is the template).
- Deploy verification must MATCH THE SHA.
- No em dashes in game text (scripts/textlint.ts); chat is exempt.

## The off-screen reply bug class (from live feedback, still worth hunting)

A button calls an engine function that returns a sentence, and the screen
puts that sentence in ONE banner at the top of the page - 786px above the
thumb that tapped. KEY THE MESSAGE TO THE THING THAT ASKED
(`useState<{key, text}>`), and PUT THE REASON IN FRONT OF THE DECISION
through a predicate both the row and the engine read (Training.tsx's
appointBlock/courseBlock). scripts/hireprobe.mjs guards it by measuring
getBoundingClientRect distance from the tapped button. Screens with long
lists whose row actions render outside the row have not all been checked.

## Feature requests on file

1. **Continue should serve the desk** - shipped (the desk gate, budgeted at
   MAX_DESK_HOLDS because a rollover writes 54 stories in one settle).
   Watch for feedback on the gate's feel.
2. **Board expectations cost money** - shipped this session, see above.
