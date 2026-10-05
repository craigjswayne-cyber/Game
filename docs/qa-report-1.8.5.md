# PHASE: Rugby Manager 1.8.5: release report

Version 1.8.5, Play versionCode 44 (`package.json`, `landing/index.html`, `packaging/android/version.json`). Built on 1.8.4 (main 5eb42a2). Check the Play Console's highest accepted code before building: codes only have to rise.

## RELEASE VERDICT

**SHIP WITH P1 FIXES**: no P0 or P1 is open in the code. The one class of P1 left is outside this environment: the native store builds and real purchases must be verified on your machines and devices (HUMAN / DEVICE RELEASE BLOCKERS below). Once those pass, ship.

## SCORECARD (1-10)

| Area | Score | Why |
|---|---|---|
| Simulation depth | 9 | Two-layer engine, styles, playbook, tape, conditions, all deterministic |
| Tactical depth | 8 | Levers, half-time plans, tape and rematch memory; tactician identity now read |
| Causal clarity | 8 | One story from half time to full time, 0 contradictions over 168 checked matches |
| Player agency | 8 | Decisions show up in results, memory, reputation and the market |
| Persistent consequences | 8 | Rematch memory, former players, broken promises, sold players met again |
| Opposition intelligence | 8 | Adaptation perceivable and answered at full time; rivals now spend and bid |
| Manager identity | 7 | A, C, E clearly distinct blind; B and D only weakly |
| Player stories | 8 | Selective stories, Old Boys card, legends, sold youngsters |
| Club history | 8 | Eras, turning points, annals, record books |
| Career differentiation | 6 | Three of five styles tell apart blind; conservative and big-spender careers read alike |
| Economy | 7 | No infinite money; flip halved; AI premiums still make selling lucrative |
| Progression | 8 | World no longer drains; dynasty still possible with skill |
| UX | 8 | Full time and pre-match reordered; primary above the fold |
| Mobile readiness | 8 | 870 views, 320-412px, six languages, clean |
| Localisation | 8 | Dynamic careers scanned in six languages; English and gender leaks fixed |
| Stability | 9 | Saves reload into the same world; 0 crashes in long careers |
| Monetisation | 7 | Purchase, cancel, restore verified with a mock store only |
| Long-term addictiveness | 7 | Strong for academy, seller, tactician and chaotic careers |
| Commercial readiness | 7 | Code ready; native builds unverified |

## IMPLEMENTED IN 1.8.5

- **Competitive AI clubs.** Before, the top AI sides in other leagues stayed flat at about 82 while a manager pulled 8-22 points clear over 18 seasons, because stars sat unsigned in the free pool (58-120 at a time). Now:
  - AI clubs sign 85+ free agents they can afford;
  - about 13% of the manager's agreed fees draw a rival bid, with news naming the club, the offer and why the player chose ("What decided it: more minutes as a lock");
  - ambitious clubs buy one top young prospect a summer;
  - boards back clubs the manager finished above (at most 40% of budget, never over £4m), with news.
  - Top-4 AI sides now reach 85-87; the manager's lead is 1-7 points (18 at a giant). A skilled manager still wins titles.
- **Player trust.**
  - A half-time Quick Game Plan made full time say the plan "was set but not carried through" in 51 of 75 matches. It is now judged on the half it was played.
  - Contradictory advice is removed (one dial asked both ways; a territory fix against the chip; cards graded sorted with a man in the bin).
  - When the report warned the opposition was set for a call, full time now says whether it cost you (83 of 83 warned matches answered).
  - Job fit was nearly dead (0 of 146 vacancies). It now fires for the traits careers actually earn (17-33% of vacancies for common traits).
- **World memory surfaced.**
  - The men you let go: 194 of 194 meetings told, and why they left (54 of 55).
  - A former player who decides a defeat is named at full time (10 of 10).
  - Your legends in the other squad (118 of 118) and the rival coach in the dugout (20 of 20).
  - Ordinary players stay quiet (0 of 5 named).
  - "Wage budget full" now shows only while the window is open (desk weeks 29% to 5%), and repeated homework is said once.
- **Saves.**
  - A save reloaded mid-season played a different world from straight play; six repairs on load changed things the game leaves alone. Fixed: 48 weeks with a save and load every week now match straight play exactly.
  - The screen's language no longer leaks into the saved career.
- **Screens.**
  - Full time: verdict, then the two fixes above the fold, then memory lines, then the unit battles folded.
  - Pre-match: the plan and Apply come before the history cards.
  - Jobs: the prospects line sits with Not interested.
  - The desk opens Tactics on the tab its line is about.
- **Career identity.**
  - Youth reputation now needs debuts the manager chose (not the age gate's churn) and minutes over the league norm.
  - New tactician reading of in-match and week-to-week changes.
  - New seller and prudent readings.
  - "Known as a disciplinarian" counts distinct men, not every match a rested man missed.
  - The board letter says when the salary cap or an embargo held the manager back.
  - Feminine French, Spanish and Italian reputation lines.
- **Economy.**
  - Free-agent flip: a man signed out of the pool fetches a quarter of his value if sold before his free deal ends. Profit fell from a mean of 23.6M to about half, and the open-window version from up to 66M.
  - A fee cannot be agreed under an embargo.
  - "Steady progress" needs a climb.

## PRESERVED

Match fingerprint unchanged on every merge ("FINGERPRINT PASSED: sim stream unchanged"). No new rng on the match stream. Prices, product IDs and ad units unchanged. Ad spots on News, Press and the match screen for non-Pro. No trait or personality labels for players or coaches. Other team talks neutral. Permanent red card. Title screen on a cold start, Home on load. No crowd noise.

## QA (verified)

- GitHub CI on the final 1.8.5 code (8e2f74a): 11 of 11 jobs green, 8 engine shards and 3 browser shards (run 37275352982). Engine probes now run in 8 shards (they outgrew 6 at the 40-minute limit).
- New regression probes: onestoryprobe, jobfitprobe, trustfixprobe, memoryauditprobe, formerui, rivalbidprobe, plus QA tools (savegen, saveintegrity, savedet, langsave, perfrun, tickbench, browserperf, purchasestate). leaguestrength is a report.
- Saves: 1.8.2, 1.8.3, 1.8.4 and 1.8.5 saves, men's and women's, 1.5 to 12 seasons, all idempotent, playable, deterministic across reload, no duplicates, NaN or orphans.
- Purchase state (mock store): Pro survives reload, language change, import and a new career. A cancel leaves nothing. Restore on fresh storage works. A banked credit is consumed only when used.
- Performance against 1.8.4 on the same machine: week, rollover, save, load, match tick and launch all within noise (largest +4% cold launch). Save 10.3MB at 15 seasons. Nothing grows without bound.
- Long careers: five styles, ten seasons each, every screen rendered in six languages, plus a women's career: 0 errors, saves healthy.
- Mobile: 870 views, 320-412px, six languages and the women's game: no sideways scroll, raw keys, NaN, em dashes, emoji or leftover English.
- Economy: aiecon mean AI club gain 0.24M (band 0.27M ±15%). distressprobe now measures on the year's books after prize money (2-14% across six worlds, limit 25%) with a depth guard, instead of at the ledger's low point, which swung 10-63% on the same rules.
- Native billing code: `javac -Werror` against the real Play Billing 8.0.0, Capacitor 8.5.0 and API 36 jars passes. Swift type-checks against stubbed StoreKit and Capacitor.

## NOT VERIFIED (HUMAN / DEVICE RELEASE BLOCKERS)

- **Android Studio:** full Gradle release build, signed AAB with the existing keystore, install from Play internal testing.
- **Physical Android device:** Pro purchase, cancellation, restore after reinstall, pending purchase, app resume, no connection.
- **Xcode:** archive and signing, upload, TestFlight install.
- **Physical iPhone:** the same purchase checks in the sandbox.
- **Play Console / App Store Connect:** version code 44 and build number accepted, listing and notes.
- **Manual human playtest on a phone:** the agents played through the real UI in a browser, but no human has played 1.8.5 on a device.

## OPEN ISSUES

| Priority | Issue | Evidence | Recommended action |
|---|---|---|---|
| P2 | Conservative manager mostly invisible; a passive renew-only career can breach the cap and be embargoed | Career D: wage bill 103-143% of budget, embargo; prudent trait never fired | Investigate the cap audit against renewals in 1.8.6 |
| P2 | Big spender held back has no positive identity, only the board's cap lines | Career B: cap blocked 26 deals, embargo 13 | Consider a "held back by the cap" reading |
| P2 | Free-agent hold: keeping free stars to the end of their deal then selling still clears up to 30-40M in peak seasons | flip runs | Signing-on fee for free agents, or AI clubs signing more of the pool |
| P2 | AI bid premiums 1.2-1.6x value make selling everything lucrative | Career E: £335M in ten seasons, still 7th-10th | Taper premiums for repeat sellers |
| P2 | Rival bids: a manager who won't raise his offer loses most contests (Bristol 12 of 12) | rivalbid runs | Intended pressure; watch player feedback |
| P3 | No desk note when the cap blocks a signing (per-deal reasons are shown) | | |
| P3 | Derby names hardcoded English (rivalries.ts) | | Move to locale keys |
| P3 | Lopsided AI buys (a 36-rated veteran sold for a fee) | | |
| P3 | Quick Game Plan stays on the club after the match | | |
| P3 | Tactics Roles pitch shirt tap areas overlap at the corners | | |

## DO NOT FIX BEFORE RELEASE

- A new spender or conservative reputation system, another trait layer or another currency.
- Commentary lines during play for former players (the full-time card covers it; touching the match stream risks the fingerprint).
- Reworking the salary cap rules.
- AI premium tapering and a free-agent signing fee (balance work needing its own long runs).
- Season review memory additions, derby name localisation.
