# PHASE launch asset manifest

Built 6 October 2026 against version 1.8.11. Every asset is listed once.
Status: ✅ DONE · ⛔ BLOCKED (waiting on an input named in the row) · ⬜ NOT STARTED.
Owner: **C** Claude (repo work) · **O** owner (account, money, signature, device, voice) · **O+C** both.
Paths are relative to `docs/launch/assets/` unless they start with a top-level folder.

Read with: `BRAND.md` (look and voice), `FACTS.md` (what copy may claim),
`PLATFORM-SPECS.md` (sizes and sources), `CALENDAR.md` (when).

## Dashboard

| | Count |
|---|---|
| Required assets | 96 |
| ✅ Done | 77 |
| ⛔ Blocked | 7 |
| ⬜ Not started | 12 |
| In progress | 0 (nothing is left half-made) |

Counts are rows in the tables below; one row may be one file or one set (for
example eight store frames).

## Regenerating everything

```
npm ci && npm run build
npx vite-node scripts/launch/showcase.ts      # the showcase career + snapshots (2 min)
node scripts/launch/capture.mjs               # phone captures (and VIEW=1032x1376 DSF=2 for iPad, ZOOM=1.15 for story screens)
node scripts/launch/storeframes.mjs           # store screenshots, all sizes
node scripts/launch/brandkit.mjs              # icons, avatars, lockups, headers, feature graphic, OG, thumbnail
node scripts/launch/social.mjs                # social templates and launch graphics
node scripts/launch/trailer.mjs               # animatics and cards (10 min)
node scripts/launch/motion.mjs                # real trailer footage from the build (25 min, plays a match)
node scripts/launch/cut.mjs                   # final trailer masters: footage, score, sound, captions (30 min)
bash scripts/launch/presskit.sh               # press kit zip and press page files
node scripts/launch/release.mjs changelog landing/changelog.html
```

Every visual reads its colours from `src/ui/tokens.css` and its type from the
game's own Space Grotesk file, through `scripts/launch/brand.mjs`.

---

## 01 Brand

Purpose: one identity, taken from the game. Visual direction: `BRAND.md`.
Definition of done: exported from vector at its own size, checked at 32 px, on the canvas colour.

| ID | Asset | Platform | Size | Status | Owner | Source | Final |
|---|---|---|---|---|---|---|---|
| BRD-01 | App icon master | All | 1024 x 1024 + SVG | ✅ | C | `brand.mjs` mark() | `01-brand/final/icon/icon-master-1024.png`, `icon-master.svg` |
| BRD-02 | Mark (ball and ring) | All | SVG | ✅ | C | `public/icon.svg` geometry | `01-brand/final/logo/mark.svg` |
| BRD-03 | Lockups: horizontal (dark, light), stacked, wordmark (dark, light) | All | 1000 x 300, 800 x 800, 800 x 220 | ✅ | C | `brandkit.mjs` | `01-brand/final/logo/` |
| BRD-04 | Small-size mark (16 to 32 px) and size check | Web | 16, 32, 48 | ✅ | C | `brandkit.mjs` smallMark() | `05-website/final/favicon-*`, `01-brand/final/icon/icon-size-check.png` |
| BRD-05 | Palette sheet | Internal, press | 1600 x 900 | ✅ | C | `tokens.css` | `01-brand/final/palette.png` |
| BRD-06 | Typography sheet | Internal, press | 1600 x 900 | ✅ | C | Space Grotesk | `01-brand/final/typography.png` |
| BRD-07 | Brand sheet (logo, colour, type, composition, voice) | Internal | | ✅ | C | | `docs/launch/BRAND.md` |
| BRD-08 | Space Grotesk licence shipped | Legal | | ✅ | C | github.com/floriankarsten/space-grotesk | `LICENSES/SpaceGrotesk-OFL.txt` |
| BRD-09 | Avatar master (circle-safe) | Social | 1024 x 1024 | ✅ | C | `brandkit.mjs` | `01-brand/final/avatar/avatar-master-1024.png` |

## 02 Store

Purpose: the listing tells the loop in eight frames. Copy: `02-store/STORE-COPY.md`.
DoD: official size, opaque, real screen from the showcase career, passes the
thumbnail test (headline readable at a quarter size).

| ID | Asset | Platform | Size | Copy | Status | Owner | Source | Final |
|---|---|---|---|---|---|---|---|---|
| STO-01 to 08 | Phone screenshots, 8-frame story | Google Play | 1080 x 2340 | YOUR CLUB. YOUR WAY. to NO TWO CAREERS ARE THE SAME. | ✅ | C | `storeframes.mjs` + `10-source/captures/en*` | `02-store/final/play/` |
| STI-01 to 08 | iPhone screenshots | App Store 6.9" | 1320 x 2868 | Same | ✅ | C | Same | `02-store/final/ios-6.9/` |
| STP-01 to 08 | iPad screenshots (real tablet layout) | App Store 13" | 2064 x 2752 | Same | ✅ | C | `10-source/captures/en-1032x1376*` | `02-store/final/ipad-13/` |
| STO-IC1 | Play icon | Google Play | 512 x 512 | | ✅ | C | BRD-01 | `02-store/final/play/play-icon-512.png` |
| STO-IC2 | App Store icon (no alpha) | App Store | 1024 x 1024 | | ✅ | C | BRD-01 | `02-store/final/ios-6.9/appstore-icon-1024.png` |
| STO-FG | Feature graphic | Google Play | 1024 x 500 | THE WORLD REMEMBERS WHAT YOU DID. | ✅ | C | `brandkit.mjs` | `02-store/final/play/feature-graphic-1024x500.png` |
| STO-L01 | Play listing copy, English (title, short, full) | Google Play | 30 / 80 / 4000 | `full-description-en.txt` | ✅ | C | FACTS.md | `02-store/STORE-COPY.md` |
| STO-L02 | App Store copy, English (subtitle, promo text, description) | App Store | 30 / 170 / 4000 | | ✅ | C | | `02-store/STORE-COPY.md` |
| STO-L03 | Review-notes corrections (ads, web version, names) | Both | | | ✅ | C | | `02-store/STORE-COPY.md` |
| STO-L04 | Paste the new copy and frames into Play Console | Google Play | | | ⬜ | O | STO-01 to 08, STO-L01, STO-FG | Play Console |
| STO-L10 | French listing corrected to match | Both | | | ⬜ | C | `docs/store-listing.md` French section | `02-store/STORE-COPY.md` |
| STO-L11 | French screenshots | Both | | | ⬜ | C | `LANG_UI=fr` capture + French headlines | `02-store/final/*-fr/` (P2) |
| STO-V01 | Play promo video (YouTube URL) | Google Play | 16:9 | | ⬜ | O | Upload `phase-trailer-30s-16x9.mp4` to YouTube, paste the URL | YouTube |
| STO-V02 | App preview | App Store | 886 x 1920, 15 to 30 s | | ⛔ | O+C | Blocked on device capture and iOS | |

Note: Play's "games" promotion slot wants landscape 1920 x 1080 shots. PHASE is
portrait-only, so we do not make them; faking landscape gameplay would break the
"real product" rule.

## 03 Trailer

Purpose: the story of one decision and its memory. Plan: `03-trailer/TRAILER.md`.
DoD: real device footage, licensed music on file, captions, each cut its own
edit, exported per the spec table.

| ID | Asset | Platform | Size | Copy | Status | Owner | Source | Final |
|---|---|---|---|---|---|---|---|---|
| VID-SCR | Script, storyboard, cut sheets, capture list | | | THE WORLD REMEMBERS WHAT YOU DID. → YOUR CLUB. YOUR DECISIONS. YOUR STORY. | ✅ | C | | `03-trailer/TRAILER.md` |
| VID-ANI | Animatics: 60/30/15/6 s × 16:9, 9:16, 1:1, 4:5 (16 files) | Review | | | ✅ | C | `trailer.mjs` | `03-trailer/working/` |
| VID-CRD | Title and end cards, 4 ratios | All | | | ✅ | C | `trailer.mjs` | `03-trailer/final/cards/` |
| VID-CAP | Caption files (SRT) per cut | YouTube, accessibility | | | ✅ | C | `trailer.mjs` | `03-trailer/final/captions/` |
| VID-THB | YouTube thumbnail | YouTube | 1280 x 720 | THE WORLD REMEMBERS. | ✅ | C | `brandkit.mjs` | `03-trailer/final/youtube-thumbnail-1280x720.png` |
| VID-MUS | Original score, composed in code (no licence needed) | All cuts | | | ✅ | C | `scripts/launch/score.py` | Mixed into VID-01 to 04; record in TRAILER.md |
| VID-CAPT | Real footage, 11 beats, recorded from the 1.8.11 build | All cuts | 800 x 1736, 30 fps | | ✅ | C | `scripts/launch/motion.mjs` | `storeart/motion/` (regenerated) |
| VID-01 | 60 s master, 4 ratios | YouTube, website | 1920 x 1080 etc. | | ✅ | C | `scripts/launch/cut.mjs` | `03-trailer/final/phase-trailer-60s-*.mp4` |
| VID-02 | 30 s cut, 4 ratios | Play promo, social | | | ✅ | C | Same | `03-trailer/final/phase-trailer-30s-*.mp4` |
| VID-03 | 15 s cut, 4 ratios | Social | | | ✅ | C | Same | `03-trailer/final/phase-trailer-15s-*.mp4` |
| VID-04 | 6 s teaser, 4 ratios | Social bumper | | | ✅ | C | Same | `03-trailer/final/phase-trailer-6s-*.mp4` |
| VID-SFX | Sound design: the game's own whistle and thud, taps, crowd, page | All cuts | | | ✅ | C | `scripts/launch/score.py` | Mixed into VID-01 to 04 |
| VID-EAR | Owner listens to the score and signs it off (Claude cannot hear audio) | All cuts | | | ⬜ | O | | |
| VID-BDG | Official Google Play badge on end card | End card | | | ⛔ | O | Owner downloads Google's badge artwork (blocked from here) | `03-trailer/source/` |

## 04 Social

Purpose: an account worth following before anyone downloads. Bank: `04-social/SOCIAL-BANK.md`.
DoD: real screen or game quote, rendered in all listed formats, copy checked against FACTS.md.

| ID | Asset | Platform | Size | Copy | Status | Owner | Source | Final |
|---|---|---|---|---|---|---|---|---|
| SOC-T01 | Feature template | IG, FB, X, TikTok, Discord | 4:5, 9:16, 1:1, 16:9 | BUILD YOUR SQUAD. | ✅ | C | `posts.json` | `04-social/final/SOC-T01/` |
| SOC-T02 | Decision template | Same | Same | YOU HAVE £3.1M LEFT. WHO DO YOU SIGN? | ✅ | C | | `SOC-T02/` |
| SOC-T03 | Story template (rival coach) | Same | Same | "He will not have forgotten a word of it..." | ✅ | C | | `SOC-T03/` |
| SOC-T04 | Story template (word kept) | Same | Same | "You said I would get my chance..." | ✅ | C | | `SOC-T04/` |
| SOC-T05 | Career template | Same | Same | TWELVE SEASONS. ONE CLUB. | ✅ | C | | `SOC-T05/` |
| SOC-T06 | Tactical template | Same | Same | 3 POINTS DOWN AT HALF-TIME. WHAT DO YOU CHANGE? | ✅ | C | | `SOC-T06/` |
| SOC-T07 | Development template | Same | Same | WHY PLAYERS REMEMBER WHAT YOU DID. | ✅ | C | | `SOC-T07/` |
| SOC-T08 | Community template | Same | Same | TELL US ABOUT THE STRANGEST CAREER YOU'VE CREATED. | ✅ | C | | `SOC-T08/` |
| SOC-T09 | Decision template (press) | Same | Same | THE PRESS WANT AN ANSWER. | ✅ | C | | `SOC-T09/` |
| SOC-T10 | Feature template (consequence) | Same | Same | EVERY DECISION HAS CONSEQUENCES. | ✅ | C | | `SOC-T10/` |
| LCH-01 | Coming soon | Same | 4 formats | PHASE IS COMING. | ✅ | C | | `04-social/final/launch/LCH-01/` |
| LCH-07 to 00 | Countdown, 7 to 1 days | Same | 4:5, 9:16, 1:1 | 7 DAYS. ... 1 DAY. | ✅ | C | | `launch/LCH-0*/` |
| LCH-10 | Launch | Same | 4 formats | PHASE IS LIVE. | ✅ | C | | `launch/LCH-10/` |
| LCH-11 | Play now | Same | 4 formats | PLAY PHASE NOW. | ✅ | C | | `launch/LCH-11/` |
| LCH-12 | Update | Same | 4:5, 1:1, 16:9 | PHASE 1.8.11 | ✅ | C | | `launch/LCH-12/` |
| LCH-13 | Community | Same | 4 formats | YOUR CAREER. YOUR STORY. | ✅ | C | | `launch/LCH-13/` |
| SOC-AV | Avatars: YouTube 800, X 400, Instagram 320, TikTok 200, Facebook 720 | Social | Square, circle-safe | | ✅ | C | BRD-09 | `04-social/final/avatars/` |
| SOC-HD | Headers: YouTube 2560 x 1440, X 1500 x 500, Facebook 1640 x 624 | Social | | THE WORLD REMEMBERS WHAT YOU DID. | ✅ | C | `brandkit.mjs` | `04-social/final/headers/` |
| SOC-CP | 30-post copy bank | All | | 6 pillars × 5 | ✅ | C | FACTS.md | `04-social/SOCIAL-BANK.md` |
| SOC-VB | 15 short-video briefs | TikTok, Reels, Shorts | 9:16 | Hooks, captions, CTAs | ✅ | C | | `04-social/SOCIAL-BANK.md` |
| SOC-VID | 15 short videos produced | TikTok, Reels, Shorts | 9:16 | | ⬜ | C | Footage now exists (`motion.mjs`); not yet cut | `04-social/final/video/` |
| SOC-ACC | Accounts created with avatars and headers | All | | | ⬜ | O | SOC-AV, SOC-HD | Platforms |
| SOC-S5 | Real "former player scores against you" capture | All | | | ⬜ | C | A showcase career that produces the story | `10-source/captures/` |

## 05 Website

Purpose: the shop window, same brand as the app. DoD: no script, nothing
off-site, passes `scripts/landingprobe.ts`, no horizontal scroll at 390 px.

| ID | Asset | Status | Owner | Source | Final |
|---|---|---|---|---|---|
| WEB-01 | Homepage: proposition hero, the loop in five real screens, features, download, community | ✅ | C | | `landing/index.html` (live on next deploy from main) |
| WEB-02 | Support and FAQ, contact | ✅ | C | Menu labels from `src/locales/en.json` | `landing/support.html` |
| WEB-03 | Press kit page | ✅ | C | `06-press/PRESS-KIT.md` | `landing/press.html` |
| WEB-04 | Changelog, generated on deploy | ✅ | C | `docs/releases/` | `landing/changelog.html` |
| WEB-05 | Share image (Open Graph) | ✅ | C | `brandkit.mjs` | `landing/img/og.jpg`, `05-website/final/og-image-1200x630.png` |
| WEB-06 | Favicons and touch icon | ✅ | C | BRD-04 | `05-website/final/` |
| WEB-07 | Terms of use | ⛔ | O | Draft for legal review: `05-website/working/terms-DRAFT.md` | `landing/terms.html` after approval |
| WEB-08 | Trailer on the homepage | ⬜ | C | Needs the YouTube URL (no script tags allowed, so a linked thumbnail) | `landing/index.html` |
| WEB-09 | App Store badge live | ⛔ | O+C | iOS approval | `landing/index.html` |
| WEB-10 | Point the store "Support URL" at /support.html | ⬜ | O | WEB-02 deployed | Play Console, App Store Connect |

About, Features and Download are sections of the homepage (`#how`, `#features`,
store buttons); Contact is on the support page. Privacy is the existing
`public/privacy.html` (its update is launch-programme blocker B6, outside this brief).

## 06 Press

| ID | Asset | Status | Owner | Final |
|---|---|---|---|---|
| PRS-01 | Fact sheet, one-line, short and long descriptions, features, pricing, platforms | ✅ | C | `06-press/PRESS-KIT.md` |
| PRS-02 | Downloadable press pack (logos, icon, 8 frames, 8 screens, key art, GIF, facts) | ✅ | C | `landing/press/phase-press-kit.zip` |
| PRS-03 | Usage guidance, credits, Ruck attribution | ✅ | C | `PRESS-KIT.md`, press page |
| PRS-04 | Developer bio | ⛔ | O | Owner's own words: `PRESS-KIT.md` |
| PRS-05 | Trailer in the press pack | ✅ | C | Link in `PRESS-KIT.md`; file too large for the zip |

## 07 Discord

| ID | Asset | Size | Status | Owner | Final |
|---|---|---|---|---|---|
| DSC-01 | Server icon | 512 x 512 | ✅ | C | `07-discord/final/discord-server-icon-512.png` |
| DSC-02 | Server banner | 960 x 540 | ✅ | C | `07-discord/final/discord-server-banner-960x540.png` |
| DSC-03 | Welcome image | 1600 x 900 | ✅ | C | `07-discord/final/discord-welcome-1600x900.png` |
| DSC-04 | Templates: welcome, release, patch notes, general, known issues, event, founder | | ✅ | C | `07-discord/DISCORD.md` |
| DSC-05 | Channels created and art uploaded | | ⬜ | O | Discord |
| DSC-06 | Release webhook secret | | ⛔ | O | GitHub secret `DISCORD_RELEASE_WEBHOOK` (steps in DISCORD.md) |

## 08 Creators

| ID | Asset | Status | Owner | Final |
|---|---|---|---|---|
| CRE-01 | Creator email, press email, follow-up, review instructions | ✅ | C | `08-creators/OUTREACH.md` |
| CRE-02 | Tracking sheet | ✅ | C | `08-creators/creators.csv` |
| CRE-03 | Target list researched (20 to 30 names) | ⬜ | O+C | `creators.csv` |
| CRE-04 | Play promo codes for reviewer Pro unlocks | ⛔ | O | Play Console |

## 09 Release

| ID | Asset | Status | Owner | Final |
|---|---|---|---|---|
| REL-01 | Release file format and template (six languages) | ✅ | C | `docs/releases/TEMPLATE.md` |
| REL-02 | 1.8.11 release notes, six languages, checked under 500 characters | ✅ | C | `docs/releases/1.8.11.md` |
| REL-03 | Generator: check, store, Discord, social, changelog | ✅ | C | `scripts/launch/release.mjs` |
| REL-04 | Workflow: GitHub Release → Discord + staged social/store copy | ✅ | C | `.github/workflows/release.yml` |
| REL-05 | Website changelog regenerated on every deploy | ✅ | C | `.github/workflows/pages.yml` |
| REL-06 | Runbook | ✅ | C | `09-release/README.md` |

## 10 Source

| ID | Asset | Status | Owner | Final |
|---|---|---|---|---|
| SRC-01 | Showcase career builder (deterministic, snapshots at story weeks) | ✅ | C | `scripts/launch/showcase.ts` |
| SRC-02 | Importable showcase saves (verified through Saves > Import) | ✅ | C | `10-source/saves/showcase-saves.zip` |
| SRC-03 | Raw captures: phone, phone "Bigger" text, iPad, iPad "Bigger" text | ✅ | C | `10-source/captures/` |
| SRC-04 | Capture, compose and build scripts | ✅ | C | `scripts/launch/` |
| SRC-05 | Music and SFX provenance recorded (original, no licences needed) | ✅ | C | `03-trailer/TRAILER.md` |
