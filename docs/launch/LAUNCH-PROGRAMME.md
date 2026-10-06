# PHASE: Launch programme (working board)

Built from the owner's brief (`docs/launch/LAUNCH-BRIEF.md`) against the actual
repository on 6 Oct 2026. Work through it item by item; tick, don't rewrite.

**Rule:** when every P0 and P1 item below is green, PHASE launches. Nothing is
added to this board unless it can stop a launch or materially damage it.
Gameplay development stops at the product gate (section 15).

Statuses: ⬜ not started · 🔵 in progress · 🟡 blocked · 🟢 done · 🔴 blocker · ⏸️ deferred
Priorities: P0 must happen before release · P1 should · P2 can follow launch · P3 optional
Owner column: **O** = owner (needs a human, an account, money or a signature) · **C** = Claude (repo work) · **O+C** = both

---

## PHASE LAUNCH STATUS

| | |
|---|---|
| Current version | 1.8.11 in progress (main has 1.8.9; 1.8.10/1.8.11 on the working branch) |
| Target release | 1.8.11 (Play versionCode 50) or the first build after it that passes the gate |
| Target date | Set by the owner once Stage 1 is green (suggested: about 4 weeks after the product gate) |
| Android | Live on Play under the personal account; production code last accepted 36 (29 Sep). Closed testing in use. Org-account transfer not done |
| iOS | Not on the App Store. Apple developer enrolment pending; nothing created in App Store Connect |
| Website | Live at phaserugbymanager.com (landing page, privacy, app-ads.txt), deploys from main |
| Trailer | Script, storyboard and animatics done; final blocked on music licence and device capture (`assets/03-trailer/TRAILER.md`) |
| Discord | Server exists; bot code in repo but not hosted; #feedback channel requested (Cowork prompt) |
| Marketing | Launch assets built: see `docs/launch/ASSET-MANIFEST.md` |
| Press | None |
| Analytics | None by design (no network calls); console statistics only; on-device feedback report |
| Support | Email + in-game bug report + Discord; no support page or FAQ |
| Legal | Privacy policy live but out of date; no terms; real player names an accepted risk; Ruck permission verbal only |

## RELEASE READINESS

| Workstream | Status | Why |
|---|---|---|
| Product | 🔵 | 1.8.11 fixes in progress; Samsung Back test pending |
| Android | 🔵 | Builds and uploads work; device test of code 50 pending |
| iOS | 🟡 | Blocked on Apple enrolment |
| Store listings | 🔴 | Data Safety / App Privacy answers contradict the shipped ads (see B3) |
| IAP | 🔵 | Products exist on Play except `phase.supporter.intro`; prices disagree between docs |
| Trailer | ⬜ | |
| Brand | 🔵 | Icon, wordmark-in-code, palette, Space Grotesk exist; no brand sheet |
| Website | 🔵 | Live; needs copy refresh, support page |
| Discord | 🔵 | Exists; channel tidy-up |
| Social | ⬜ | |
| PR | ⬜ | |
| Creators | ⬜ | |
| Analytics | ⏸️ | Console data only for launch (decision D4) |
| Support | 🔵 | Needs a support page + FAQ |
| Legal | 🔴 | Privacy policy and store declarations must match the build; Ruck permission in writing |
| Launch runbook | ⬜ | Section 12 below |

---

## 1. CURRENT STATE (what already exists: DONE / VERIFY)

**Product and engineering**
- 🟢 Game: React/TS/Vite, offline, six languages (en, fr, es, it, af, ja), men's and women's game, 171 clubs in 15 leagues. VERIFY: copy elsewhere says "100+ clubs, 8 competitions".
- 🟢 Determinism gate: `scripts/fingerprint.ts`; 300+ probes in `scripts/`, `scripts/suite.sh` (fast / browser / all).
- 🟢 CI: `.github/workflows/ci.yml`, 8 engine + 3 browser shards on push, PR, nightly, dispatch. VERIFY: GitHub-hosted runners were often unavailable on 5 Oct; shards were completed locally.
- 🟢 Crash handling: `src/ui/ErrorBoundary.tsx` + `recordCrash` in `src/game/bugreport.ts`; in-game Report a Bug screen (mail, Discord, crash record).
- 🟢 Saves: on device, flushed on pagehide/visibilitychange; migrations; savefuzz/migratetest probes.
- 🟢 Android shell: `packaging/android/scaffold.sh` (Capacitor 8.5.0, Play Billing 8.0.0, AdMob 8.1.0), `MainActivity.java` (Back handler, keep screen on), `PhaseBilling.java`, `PLAY-WALKTHROUGH.md`, `PLAY-ORG-MOVE.md`.
- 🟢 iOS shell: `packaging/ios/scaffold.sh`, `PhaseBilling.swift`, `Products.storekit`, `APP-STORE-WALKTHROUGH.md`, `APP-REVIEW-REPLY.md`.
- 🟢 Version metadata: `package.json`, `packaging/android/version.json` (code history; Console's highest accepted code was 36 on 29 Sep).

**Monetisation**
- 🟢 11 sellable products + `phase.supporter.intro` in `src/game/monetise.ts`; prices only from the store at runtime.
- 🟢 Pro Manager funnel (`src/game/profunnel.ts`, `src/ui/ProPrompt.tsx`, `docs/pro-manager.md`).
- 🟢 AdMob: `packaging/shell/ads.json` (live IDs, testing false), UMP consent then ATT, rewarded spots, 7 banner places (2 with own units, 5 falling back to Home's unit). `landing/app-ads.txt` deployed.

**Brand, web, community**
- 🟢 Icons (`public/icon*`, `packaging/ios/AppIcon-1024.png`, Android mipmaps), studio mark in code, Space Grotesk font, palette tokens (`src/ui/tokens.css`, `docs/palette-migration.md`).
- 🟢 Store art generator `scripts/storeart.mjs` (Play 1080x2340 and iOS 1290x2796, en and fr; feature graphic) and `scripts/ipadshots.mjs` (2048x2732). Output is gitignored.
- 🟢 Website: `landing/index.html` on phaserugbymanager.com via `.github/workflows/pages.yml`; `public/privacy.html` (28 Sep 2026).
- 🟢 Store copy: `docs/store-listing.md` (Play and App Store, en and fr; What's New in six languages up to 1.8.2).
- 🟢 Discord server with invites in `src/game/community.ts`; bot code in `discord/` (not hosted).
- 🟢 Ruck: byline, About credit, `public/ruck-logo.webp`.
- 🟢 Feedback: on-device usage report (`src/game/usage.ts`), player-sent by email or copy.

## 2. MISSING (genuinely)

- Store declarations that match the build (ads, data collected) and an up-to-date privacy policy.
- Ruck permission in writing.
- `phase.supporter.intro` in Play Console; all 12 products in App Store Connect.
- One agreed price list (docs disagree, see B4).
- Support page + FAQ (the store Support URL currently points at the privacy page).
- Terms of use; open-source notices (React, Zustand, Capacitor, AdMob, Play Billing); Space Grotesk OFL file.
- A CHANGELOG / release notes for 1.8.3 to 1.8.11.
- Trailer, social accounts, content bank, press kit, creator list.
- Release automation (GitHub Release → Discord etc.).
- Apple: enrolment, agreements, app record, TestFlight.

## 3. RELEASE BLOCKERS (only real ones)

| ID | Blocker | Owner | Definition of done |
|---|---|---|---|
| B1 | Samsung Back test on code 50 (section 15 script) | O | All 12 steps pass on a physical Samsung |
| B2 | 1.8.11 merged with full suite green, fingerprint unchanged | C | Merged to main; all 11 CI shards (GitHub or local equivalent) pass |
| B3 | Store privacy declarations match the build: Play Data Safety discloses AdMob advertising ID/usage; Apple App Privacy is NOT "Data Not Collected" while AdMob ships; review notes and promo text do not say "no ads" | O+C | `docs/store-listing.md` corrected (C); answers re-submitted in both consoles (O) |
| B4 | Prices agreed and entered: one table for all 12 products; intro at about 40% below Pro | O | Table in `docs/monetisation-spec.md` matches both consoles |
| B5 | `phase.supporter.intro` created and active in Play Console (and later ASC) | O | Product active; a licence tester sees the real offer price |
| B6 | Privacy policy current: 7 banner places, Pro Manager naming, feedback report, Ruck mention, no "web version" | C then O approves | `public/privacy.html` updated and deployed |
| B7 | Ruck permission in writing (email) | O | Email filed; date noted here |
| B8 | Purchases verified on a real device: buy, cancel, pending, restore after reinstall, intro offer | O | Checklist in section 10 ticked on Android (and iPhone before the App Store) |

Not blockers (common traps): analytics SDKs, a trailer, a website rebuild, the
Discord bot, localised screenshots in all six languages, creator programme.
They help a launch; none stops one.

## 4. MASTER CHECKLIST

### A. Product gate (Phase 0)

| ID | Task | Pri | Status | Owner | Depends | Definition of done |
|---|---|---|---|---|---|---|
| A1 | 1.8.11 fixes merged (taps, title bottom, speed, Ruck logo, 40%, nationality box, full-time Continue, Free with ad, loan names, News button, keep screen on) | P0 | 🔵 | C | | Merged to main, suite green |
| A2 | Samsung Back test (section 15) | P0 | ⬜ | O | A1 | 12/12 pass |
| A3 | iPhone simulator pass on 1.8.11 (taps, title, full time, offer card) | P1 | ⬜ | O | A1 | No P0/P1 found |
| A4 | Fresh install, upgrade from 1.8.2 save, save/load, background/resume, offline | P1 | ⬜ | O | A1 | Done on the Samsung |
| A5 | Long session (a full season on device) | P1 | ⬜ | O | A1 | No crash, no stuck screen |
| A6 | No debug UI, placeholder copy or art | P1 | 🔵 | C | A1 | Grep + walk report |
| A7 | Match fingerprint unchanged | P0 | 🟢 | C | | FINGERPRINT PASSED |

### B. Monetisation gate

| ID | Task | Pri | Status | Owner | DoD |
|---|---|---|---|---|---|
| M1 | Price table agreed (B4) | P0 | ⬜ | O | One table, both consoles |
| M2 | Intro product live (B5) | P0 | ⬜ | O | Active in Play |
| M3 | Device purchase checks (B8) | P0 | ⬜ | O | Section 10 ticked |
| M4 | "% OFF" shows only true figures (proDiscount rounds the real saving down) | P0 | 🔵 | C | Probe passes with the real console prices |
| M5 | "(Free with ad)" wording accurate on every rewarded button | P1 | 🔵 | C | Every rewarded label checked in six languages |
| M6 | No Pro card during matches, modals, purchases | P0 | 🟢 | C | proprompt passes |
| M7 | Own AdMob units for week/match/news/press/finance places | P2 | ⬜ | O | IDs in `ads.json` |
| M8 | In-game "privacy options" (reopen consent) | P1 | ⬜ | C | Settings button calls UMP privacy options form (required where privacyOptionsRequirementStatus is REQUIRED, which the device log showed) |

### C. Google Play (Phase 1)

| ID | Task | Pri | Status | Owner | DoD |
|---|---|---|---|---|---|
| G1 | Decide: launch on the personal account, or finish the org transfer first (`PLAY-ORG-MOVE.md`) | P0 | ⬜ | O | Decision recorded |
| G2 | Store listing copy final (name, short, full; proposition "the world remembers what you did") | P1 | ⬜ | O+C | Text in `store-listing.md`, pasted |
| G3 | Screenshots: 8-frame story (section 10) | P1 | 🔵 exported, upload pending | O+C | Exported, uploaded |
| G4 | Feature graphic | P1 | 🟢 VERIFY | C | `storeart/play/feature-graphic.png` reviewed |
| G5 | Data Safety + ads declaration + target audience + app access (B3) | P0 | 🔴 | O+C | Submitted, matches build |
| G6 | Content rating (IARC) re-check with current IAP list | P1 | ⬜ | O | Certificate current |
| G7 | Store localisation decision (D2) | P2 | ⬜ | O | Recorded |
| G8 | Production AAB code 50: signed with the existing keystore, archived | P0 | ⬜ | O | AAB stored off-machine |
| G9 | R8/minify decision (currently off; leave off for launch, D5) | P3 | ⏸️ | | |
| G10 | Release notes for 1.8.11 in six languages | P1 | 🟢 `docs/releases/1.8.11.md` | C | In `store-listing.md` |
| G11 | Staged rollout (start 20%, watch 48h) | P1 | ⬜ | O | Rollout set |

### D. Apple App Store (Phase 2)

All 🟡 blocked on enrolment (O). Steps already written in `packaging/ios/APP-STORE-WALKTHROUGH.md` (24 steps).
Fix before use (C): §17d says iPhone-only (scaffold now builds iPhone + iPad); §15 lists 11 products (add the intro); `APP-REVIEW-REPLY.md` says "no advertising SDK" and five languages (both wrong).

| ID | Task | Pri | Owner | DoD |
|---|---|---|---|---|
| I1 | Enrolment approved; Paid Apps Agreement, banking, tax | P0 | O | Agreements active |
| I2 | App record, bundle `com.phaserugbymanager.app` | P0 | O | Record exists |
| I3 | 12 IAPs created (types double-checked) | P0 | O | All "Ready to Submit" |
| I4 | Archive, upload, TestFlight, iPhone purchase checks | P0 | O | Section 10 ticked on iPhone |
| I5 | App Privacy label matches AdMob (not "Data Not Collected") | P0 | O+C | Submitted |
| I6 | Listing: subtitle, keywords (one list), promo text without "no ads", screenshots 6.9" and 13" iPad | P1 | O+C | Uploaded |
| I7 | Review notes current | P0 | C | Text in `store-listing.md` |
| I8 | Walkthrough and review-reply docs corrected | P1 | C | Contradictions removed |

### E. Brand (Phase 3)
| ID | Task | Pri | Status | Owner | DoD |
|---|---|---|---|---|---|
| BR1 | One-page brand sheet: logo usage, palette, type, voice (British, concise, no em dashes) | P2 | 🟢 | C | `docs/launch/BRAND.md` |
| BR2 | Store screenshot template (frame + headline style) | P1 | 🟢 | C | `scripts/launch/storeframes.mjs` |
| BR3 | Social avatars/headers (X, Instagram, TikTok, YouTube, Discord) | P2 | 🔵 exported; accounts O | O+C | Exported |
| BR4 | Space Grotesk OFL licence file shipped | P1 | 🟢 | C | `LICENSES/SpaceGrotesk-OFL.txt` |

### F. Trailer (Phase 4): see section 9. P2 for launch day, P1 for paid ads.

### G. Website (Phase 6)
| ID | Task | Pri | Status | Owner | DoD |
|---|---|---|---|---|---|
| W1 | Landing copy refresh: proposition headline, App Store badge only when live, consistent club count | P1 | 🔵 done on branch, deploys on merge | C | Deployed |
| W2 | Support page + FAQ (purchases, restore, saves, devices) and point store Support URL at it | P1 | 🔵 page done; store URL O | C then O | `/support.html` live |
| W3 | Terms of use page | P1 | 🔵 draft for legal read: `assets/05-website/working/terms-DRAFT.md` | C then O (legal read) | `/terms.html` live |
| W4 | Press kit page (logos, shots, fact sheet, contact) | P2 | 🔵 done on branch, deploys on merge | C | `/press.html` live |
| W5 | Search Console verified (file exists) | P2 | 🟢 VERIFY | O | Property shows data |
| W6 | Store-link UTM/referrer tags | P2 | ⬜ | C | Links carry `referrer=` |

### H. Discord (Phase 7)
| ID | Task | Pri | Status | Owner | DoD |
|---|---|---|---|---|---|
| D1 | #feedback channel (Cowork prompt already written) | P1 | 🔵 | O | Channel live, invite valid |
| D2 | Channel set per brief (#welcome, #announcements, #patch-notes, #known-issues, #faq, #bug-reports, #suggestions, #support, community channels) | P2 | ⬜ | O | Done by hand or Cowork; the bot is not needed |
| D3 | Rules, welcome, bug and idea templates | P2 | 🔵 drafted: `assets/07-discord/DISCORD.md` | C drafts, O posts | Pinned |
| D4 | Announcement webhook (for automation) | P2 | 🔵 wired (`release.yml`); secret O | O creates, C wires | Secret stored in GitHub, never in the repo |

### I. Marketing, PR, creators, community (Phases 9-14): sections 8 and 11. All P2 unless stated.

### J. Analytics (Phase 15)
Decision D4: **launch with console data only** (Play Console and App Store Connect give installs, retention cohorts, crashes, ANRs, purchases, by device). No SDK, no consent change, no privacy-label change. Revisit after the 30-day review. The on-device feedback report covers "which features are used".

### K. Support (Phase 16)
| ID | Task | Pri | Owner | DoD |
|---|---|---|---|---|
| S1 | Support page (W2) | P1 | C | Live |
| S2 | Response templates: Pro locked, restore, new phone, career gone, crash, rewarded ad failed, update, language, saves | P1 | C | `docs/launch/support-templates.md` |
| S3 | Known-issues list kept in Discord #known-issues | P2 | O | Pinned |

### L. Legal (Phase 17): flag for human confirmation; Claude cannot certify compliance
| ID | Task | Pri | Owner | DoD |
|---|---|---|---|---|
| L1 | Privacy policy current (B6) | P0 | C, O approves | Deployed |
| L2 | Store declarations (B3) | P0 | O+C | Submitted |
| L3 | Ruck permission in writing (B7) | P0 | O | Filed |
| L4 | Real player names: accepted risk (owner, 23 Aug 2026); fictional-names fallback exists in principle | P1 | O | Decision re-confirmed before launch |
| L5 | Disclaimer copy consistent ("clubs are fictional location-based identities", not "club names are real") | P1 | C | About, privacy, store, review reply agree |
| L6 | Terms of use (W3) | P1 | C, O approves | Live |
| L7 | Open-source notices + SDK inventory (React, Zustand, Capacitor, AdMob/UMP, Play Billing, StoreKit) | P1 | C | `LICENSES/` + About link |
| L8 | Facility art provenance note (AI-generated, owner-commissioned) | P2 | C | Note in `art/masters/README` |
| L9 | Age rating consistent with ads (3+/4+ with personalised ads off for children? verify UMP/TFUA settings) | P1 | O+C | Settings checked |

### M. Finance (Phase 18): one spreadsheet, monthly
P2 (O): downloads, actives, D1/D7/D30, Pro conversions, IAP revenue, ad revenue, store fees (15% small-business programmes on both stores: enrol), VAT handled by the stores for UK digital sales (verify with accountant), costs.

### N. Paid marketing (Phase 19): P3 until 30-day review. Test small only after organic baselines exist.

## 5. DEPENDENCY MAP

```
1.8.11 merged (A1) ─► code 50 build (G8) ─► Samsung test (A2) ─┐
                                        └► device purchase checks (B8)┤
Price table (B4) ─► intro product (B5) ────────────────────────────────┤
Privacy policy (B6) ─► store declarations (B3) ────────────────────────┤
Ruck email (B7) ───────────────────────────────────────────────────────┤
                                                                       ▼
                                        Product + store gate (section 15)
                                                                       │
Brand sheet ─► screenshot template ─► screenshots ─► listing ──────────┤
Trailer script ─► capture ─► edit ─► cuts ─► store/YouTube/social ─────┤
Support page + FAQ ─► store Support URL ───────────────────────────────┤
Discord channels ─► webhook ─► release automation ─────────────────────┤
                                                                       ▼
                                  Pre-launch campaign (3 weeks) ─► LAUNCH
Apple enrolment ─► agreements ─► IAPs ─► TestFlight ─► iOS review ─► iOS launch (can trail Android)
```

## 6. TIMELINE

| Stage | Contents | Length |
|---|---|---|
| 1 Release hardening | A1-A7, M4-M6, B8 | Now to code 50 passing the Samsung test |
| 2 Store preparation | B3-B7, G1-G11, W2, L1-L7 | 1 week (mostly owner console work) |
| 3 Creative production | Screenshots, trailer, brand sheet | 1-2 weeks, overlaps Stage 2 |
| 4 Marketing infrastructure | Socials, Discord channels, press kit, automation | 1 week |
| 5 Pre-launch campaign | Section 8 calendar | 3 weeks |
| 6 Launch | Section 12 | 1 day |
| 7 First 7 days | Section 13 | 1 week |
| 8 First 30 days | Section 13 | 1 month |

Android can launch on its own; iOS follows when Apple enrolment allows. Do not hold Android for iOS.

## 7. AUTOMATION PLAN

Keep it to what GitHub already runs. No new servers.

| Flow | Automate? | How |
|---|---|---|
| Version bump checks | Yes | Already enforced by probes (landingprobe, version.json notes) |
| GitHub Release from a tag | Yes | Workflow on `release: published` |
| Release notes | Half | `docs/releases/<version>.md` written per release (C); the workflow reads it |
| Discord announcement | Yes | Same workflow posts the notes to a Discord webhook stored as a GitHub secret (`DISCORD_RELEASE_WEBHOOK`); format: version, what's new (3-5 bullets), store links, date |
| Website changelog | Yes | Pages workflow already deploys from main; add `landing/changelog.html` generated from `docs/releases/` |
| Store "What's New" | Manual | Paste from `docs/releases/<version>.md` (six languages); consoles have no safe free API for this without service-account setup |
| Social copy | Half | Workflow writes a ready-to-paste post into the release body; posting stays manual (brand risk) |
| PR merged → private dev channel | Optional (P3) | Second webhook; low value for a one-person team |
| Crash alerts | No | No crash SDK by design; check Play Console Android vitals daily in launch week |
| Critical issue → admin | Manual | Discord @here in an admin channel |

## 8. CONTENT CALENDAR (pre-launch, 3 weeks)

Pillars: PHASE (features), STORIES (emergent careers), RUGBY (topical), DECISIONS ("What would you do?"), DEVELOPMENT, COMMUNITY. About 1 post a day; at most 1 in 3 directly promotional.

| Day | Pillar | Post |
|---|---|---|
| -21 | PHASE | Announcement: logo + one line: "The rugby management game where the world remembers what you did." |
| -20 | DEVELOPMENT | Why one person built a rugby manager (founder post) |
| -19 | DECISIONS | "Your star flanker wants out. Sell, or keep an unhappy man?" poll |
| -18 | PHASE | 6-second teaser |
| -17 | STORIES | Screenshot: a sold youngster scores against you two seasons later |
| -16 | RUGBY | Topical: a real law debate, tied to a LAW WATCH story from Ruck in-game |
| -15 | PHASE | The core loop in 4 frames |
| -14 | PHASE | Recruitment and scouting |
| -13 | PHASE | Tactics and the playbook |
| -12 | DECISIONS | Half-time: change the plan or trust it? |
| -11 | PHASE | Matchday highlights clip |
| -10 | STORIES | Player relationships: the dressing room remembers a broken promise |
| -9 | PHASE | Transfers and rival bids |
| -8 | PHASE | Academy and club history |
| -7 | COUNTDOWN | 7 days + rivalries |
| -6 | COUNTDOWN | 6 days + consequences |
| -5 | COMMUNITY | Founding players' first stories |
| -4 | COUNTDOWN | 4 days + women's game |
| -3 | COUNTDOWN | 3 days + six languages |
| -2 | COUNTDOWN | 2 days + Pro Manager (honest pitch) |
| -1 | COUNTDOWN | Tomorrow + 30s trailer |
| 0 | LAUNCH | Trailer, store links, Discord, website, founder post, Reddit (where allowed), email |

Post-launch engine (weekly): 2 STORIES (players' careers, with permission), 1 DECISIONS, 1 RUGBY, 1 DEVELOPMENT/update, community screenshot of the week.

## 9. TRAILER PLAN

**60-second master, 16:9, no voiceover (captions only; cheaper, works muted on social).** Music: licensed track from a royalty-free library with a written licence (P0 for the trailer only).

| Time | Scene (real gameplay capture) | On-screen copy |
|---|---|---|
| 0-4 | Title card, desk lamp intro | PHASE |
| 4-10 | Selection: you drop the captain | YOU MADE A DECISION. |
| 10-18 | Match: highlight clip, a try against you | THE MATCH ANSWERED. |
| 18-24 | Full time: "What hurt you most" verdict | YOU KNOW WHY. |
| 24-30 | Dressing room: the captain's reaction | HE REMEMBERS. |
| 30-38 | Weeks later: news, a rival bid for him; Ruck byline | SO DOES THE WORLD. |
| 38-46 | Seasons later: he scores against you for a rival | CONSEQUENCES DON'T EXPIRE. |
| 46-54 | Career history, trophies, eras | YOUR CLUB. YOUR STORY. |
| 54-60 | End card: logo, Google Play / App Store badges | THE RUGBY MANAGEMENT GAME WHERE THE WORLD REMEMBERS WHAT YOU DID. |

Cuts: 30s (scenes 1,2,3,5,6, end card), 15s (2,5,6, end), 6s (6 + end). Exports: 16:9 master, 9:16 and 1:1 and 4:5 recrops. **Verify every platform's current spec on the day before export**; do not rely on remembered dimensions. Assets needed: a seeded career save that reliably produces the captain story (C can script it with the deterministic engine), screen capture at 60fps, licensed music, end card, thumbnail.

## 10. STORE PLAN

**Screenshot story (8 frames, en first; fr second):**
1. YOUR CLUB. YOUR WAY. (Home)
2. EVERY DECISION HAS CONSEQUENCES. (full-time verdict)
3. YOUR PLAYERS REMEMBER. (player story lines)
4. THE WORLD REMEMBERS. (news with a former player / rival)
5. BUILD YOUR SQUAD. (transfer centre)
6. MASTER MATCHDAY. (highlight clip)
7. BUILD YOUR LEGACY. (club history / eras)
8. NO TWO CAREERS ARE THE SAME. (career summary)

Generated by `scripts/storeart.mjs` (extend frames and headlines). Sizes: Play phone (current: 1080x2340), iPhone 6.9" and iPad 13" (verify current App Store Connect required sizes on the day).

**Store localisation (D2):** full listing in English and French (copy exists). Store "What's New" in all six. Screenshots in en and fr only at launch; es/it/ja/af P2 after the 30-day review shows where installs come from.

**Purchase checklist (B8), run on Android and later iPhone:** buy Pro; cancel the sheet; pending (slow card); restore after reinstall; intro offer shows the real price and true % off; existing Pro sees no cards; no store reachable (airplane mode) shows the right message.

## 11. MARKETING PLAN

- **Organic first.** The strongest story: one person built a deep rugby manager where the game remembers what you did (a sold player coming back to haunt you). Lead with that, not "please review my game".
- **PR:** press kit (W4) + a one-page release; targets: rugby sites (Ruck as partner first, then others), rugby podcasts, indie/mobile game sites. Send 10 days before launch with a code-free build link (the game is free).
- **Creators:** 20-30 names across rugby, Football Manager, mobile games. Template, tracking sheet, one follow-up. **No affiliate codes at launch**: the game is free and Pro is £2-ish; codes cost admin for little return.
- **Rugby community:** Reddit r/rugbyunion has strict self-promotion rules: read them first; post the founder story only where allowed, once. Facebook rugby groups by invitation of admins only. No spam.
- **Founding players:** 20-50 from the Discord, the brief's eight questions as a form; their stories become content (with permission).
- **Paid:** none until the 30-day review; then small tests of the five creative concepts.

## 12. LAUNCH-DAY PLAN

| Time | Step | Owner |
|---|---|---|
| T-1 day | Builds approved; listings checked; social scheduled; press and creators emailed; support templates ready | O |
| 09:00 | Play: production rollout 20% | O |
| 09:15 | Fresh install from the store on the Samsung; new career; first match; Pro purchase as tester; restore | O |
| 09:45 | Website: Play badge live; App Store badge "coming soon" or live | C |
| 10:00 | Discord announcement (automated from the GitHub Release) | Auto |
| 10:05 | Social launch post + trailer | O |
| 10:30 | Founder post; community posts where allowed | O |
| Every 2h | Android vitals (crashes, ANRs), reviews, Discord, support inbox | O |
| Escalation | Crash rate over 1% or a purchase failure: halt rollout in Play Console, post in #known-issues, fix, new code | O+C |

## 13. POST-LAUNCH PLAN

**Day 7:** installs, first-match rate (console), crashes/ANRs, reviews (reply to all), support themes, Discord, Pro conversions, ad fill. Write down: what worked, what failed, what confused players, what made them stop, what got shared. Raise rollout to 100% if vitals are clean.

**Day 30:** D1/D7/D30 (Play Console retention), season completion (feedback reports), Pro conversion, most/least used screens (feedback reports), common bugs, most requested features, best-loved moments. Then, and only then, the 1.9 roadmap: every item must create a better decision, consequence, memory or story.

## 14. BIGGEST RISKS (what is most likely to be forgotten)

1. **Store declarations saying "no ads / no data collected" while AdMob ships.** Most likely cause of a rejection or removal.
2. **Prices differ between docs and consoles**, so "40% OFF" or "Usually £x" is computed from whatever is actually entered: enter the agreed table.
3. **Ruck permission only verbal.**
4. **Signing key**: the existing keystore is the only key Play accepts for this app. Back it up off the machine before launch day; if lost, the app cannot be updated.
5. **Play account choice (personal vs company)** before launch: a transfer after launch is still possible but adds paperwork mid-campaign.
6. **Privacy policy out of date** (two banner places, "Remove all ads", web version).
7. **Consent re-open control** missing (M8).
8. **GitHub runner shortages** delaying merges on launch week: keep the local shard commands in this file.
9. **Endless polishing.** The gate below is the finish line.

Local CI-equivalent when GitHub runners are unavailable:
`for s in 1..8: SHARDS=8 SHARD=$s bash scripts/suite.sh fast` and `for b in 1..3: BSHARDS=3 BSHARD=$b bash scripts/suite.sh browser`.

## 15. FINAL RELEASE GATE

**READY TO LAUNCH** only when every line is ticked:

- [ ] B1 Samsung Back test passed on the release build (script below)
- [ ] B2 Release build merged; suite green; match fingerprint unchanged
- [ ] B3 Play Data Safety / ads declaration (and Apple App Privacy if iOS) match the build
- [ ] B4 One price table entered in the console(s)
- [ ] B5 `phase.supporter.intro` active
- [ ] B6 Privacy policy current and deployed
- [ ] B7 Ruck permission in writing
- [ ] B8 Device purchase checks passed
- [ ] Keystore backed up off-machine
- [ ] Support URL points at a real support page
- [ ] No P0/P1 open on this board

Otherwise: **NOT READY TO LAUNCH**.

### Samsung test script (release build, code 50)
1. New career.
2. Hub menu open → Back → menu closes.
3. Manager menu → Back → closes.
4. World menu → Back → closes.
5. Three pages deep → Back → one page back each time.
6. On Home → Back → title screen.
7. Continue → same career.
8. Title → Back five times → still on the title.
9. Swipe-from-edge Back: repeat 2 and 6.
10. Navigation-button Back (if the phone has it): repeat 2 and 6.
11. In a live match (and after reopening mid-match): Back does not leave the match screen unexpectedly.
12. Home button out, reopen → Continue works; screen does not dim while playing.
