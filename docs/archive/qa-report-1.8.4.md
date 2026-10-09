# PHASE: Rugby Manager 1.8.4 "The World Remembers": release report

## VERSION

1.8.4, Play versionCode 43 (`package.json`, `landing/index.html`, `packaging/android/version.json`). Check the Play Console's highest accepted code before building: codes only have to rise.

## IMPLEMENTED

- **Consequence loop (Phase 3).** The full-time "why" names the lever that answers it ("To answer it: bring Physicality down (now 100)", tapping scrolls to the dial). Half time and the next match say whether it worked ("After the break: ...", "Since last match: ..."). Every match sets homework. Evidence keeps the newest six matches plus the last meeting with every other side, so the return fixture can be read. Gate: scripts/loopprobe.ts (penalties 1.85 to 1.16 in the second half when Physicality came down at the break, d=0.55 over 324 paired matches; 41 of 41 text claims match the engine's counts).
- **Tactical and opposition memory (Phase 4).** The desk reads a run of matches (a call that keeps scoring, set piece or defence trending, an opposition starting to wait for a call), off saved evidence, no new save fields. A coach who lost answers your top cause from the last meeting, scaled by his archetype and capped (call adapt at most +0.10, unit lift at most 2.5%). Gate: scripts/memoryloopprobe.ts.
- **Manager identity and board (Phase 5).** Reputation trends ("developing", "fading"), job fit (exactly plus or minus 6 points), the board's read of your methods (capped at 4 confidence points, kept through the summer pull). Gate: scripts/identityprobe184.ts.
- **Player stories, eras, turning points (Phase 6).** Up to three lines on a player page when there is a reason (your academy, your captain, your record signing, a legend, a sale, a broken promise). Era card with W/D/L, trophies and at most three turning points. Season review turning point. Gate: scripts/storyprobe.ts.
- **News and screen hierarchy (Phase 7).** Tip and advice lines removed from 16 news stories in six languages, one masthead on the season review, wordy paragraphs trimmed, 360px fits.

## PRESERVED

Match fingerprint unchanged throughout ("FINGERPRINT PASSED: sim stream unchanged"). No new rng. Permanent red card. Title screen on a cold start, Home on load. No crowd noise. Prices, product IDs and AdMob units unchanged. Ad spots on News, Press and the match screen for non-Pro. No trait or personality labels for players or coaches. Other team talks neutral. Coach walkout after an ignored rift. Real referee names.

## BUGS FIXED

- Native billing (first real compile): concurrent connection attempts, billing flow off the main thread, pending purchase state updated together, connection closed on destroy; iOS cancel resolves as cancelled.
- Club page leaked the opposing coach's archetype below the scouting threshold.
- Pressing Continue from the Wire turned the week past open press questions and board decisions.
- "Known as a disciplinarian" for every manager (a quiet word counted as a hard call).
- Hand-promoted academy players never counted as academy debuts (eras showed 0 graduates).
- Legacy counted first place as a title when the final was lost; the turnaround trend repeated every season of a long stay.
- Loading a 1.8.2 save could top up an academy on first-team pay, so a second load changed the save.
- Raw text and placeholders: free-agent signing headline key, "nation.crusaders", "{short} want you", "Nobody is for sale, and certainly not {player}", years printed as "2,029".
- Untranslated team-sheet tags and cup names; the sent-down news was English with he/his in every language.
- A legend who moved on showed "0 appearances"; a refused bid said "came back with more" when they had not; friendlies started a press-room crisis; the treatment room listed fit men who sat out.
- Phones: sideways scroll on three screens at 320px, the full-time stamp running off the screen, names cut off, small tap targets.
- History book counted a career's first match twice.

## EXPLOITS CLOSED

- Renewals at a pay cut: the counter and the roll never go below current wage (39 cuts to 0).
- A friendly wiped a beaten coach's rematch memory (6 of 6 to 0 of 6).
- Academy-age free agents signed on academy pay and outside the senior count.
- No AI bid, and no hunt bid, for a man signed under 22 weeks ago (signing and selling on at once).
- Regression guard: scripts/exploitprobe184.ts (fails 5 of 7 checks on the old code).

## QA

- GitHub CI on the final code (4150ee4): 6 of 6 engine shards and 3 of 3 browser shards green (run 37229942356). One failure on the run before it (horizonprobe, a test fixture that predated trophies counting as titles) was fixed in the probe.
- Long local runs: stresstest, optionsprobe, dialweight, distressprobe, soakhealth (20 seasons, 0 prose violations, 0 orphans) pass.
- Saves: 1.8.2 and 1.8.3 saves load, migrate idempotently, show every 1.8.4 line, and play on a season; savefuzz, migratetest, resumeprobe, basisprobe pass. Ten-season save 9.2MB, growth flattening.
- Performance: week advance 263ms in 1.8.4 against 258ms in 1.8.3 on the same machine (no regression; the machine is slower than perfprobe's 200ms budget).
- Long careers (Phase 11): six careers, 8 to 10 seasons, five manager styles, rendered in six languages: 0 crashes, 0 NaN/undefined, 0 em dashes.
- Mobile and languages (Phase 12): 1,040 screenshots at 320 to 412px, six languages and the women's game: 0 sideways scroll, 0 raw keys, 0 leftover English after fixes.
- Release-candidate journeys (Phase 13): new player, women's game, return visit and interrupted match, 1.8.3 save, ads and Pro purchase/cancel/restore (mocked billing), language and settings: all PASS, no console errors.

## NATIVE BUILDS

- Android Studio: NOT VERIFIED. PhaseBilling.java compiles with `javac -Werror` against the real Play Billing 8.0.0, Capacitor 8.5.0 and Android API 36 jars; a full Gradle build needs the Android SDK, which this environment cannot download.
- Xcode: NOT VERIFIED. PhaseBilling.swift type-checks with swiftc 6.2.4 against stubbed StoreKit and Capacitor; a real build needs a Mac.

## KNOWN LIMITATIONS

- Free-agent flipping still clears about £8M a season after the 22-week rule (owner's decision to leave it).
- Selecting your own XV is worth about 3 points a season over the assistant's pick (autopilotprobe expects 5); identical in 1.8.3, so not a 1.8.4 change. stackprobe's "picking your side" edge is within noise on both versions.
- releasesim's "clubs go under after season six" check depends on the seed (fails on 2 of 3 seeds in 1.8.3 too).
- Friendlies add points to season stats but not appearances.
- A half-time Quick Game Plan makes the full-time analysis say the prep plan "was set but not carried through".
- The five-season era checkpoint and the end-of-job era read alike; an era read in week 1 counts the season just opened.
- Job fit never fired in 30 applications across the QA careers.
- "Wage budget full" appears on the desk most weeks for clubs at their cap.
- Polish items from the RC walk (transfer panel wording, LEI for both Leicester and Leinster, Japanese date order, store row order after purchase).

## RELEASE BLOCKERS

None in the code. Before the stores: build and test on a device in Android Studio and in Xcode.

## FINAL VERDICT

RELEASE READY, subject to the Android Studio and Xcode builds succeeding on the owner's machines.
