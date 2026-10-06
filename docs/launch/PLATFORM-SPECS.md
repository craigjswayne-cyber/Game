# PHASE: Platform specifications

Checked 6 October 2026. Every number below has a source and a status.

| Status | Meaning |
|---|---|
| **OFFICIAL** | Read on the platform's own page today |
| **OFFICIAL (via search)** | Quoted from the platform's own help page as returned by search; the page itself could not be opened from this environment |
| **VERIFY** | From a secondary source (a specs site) or not checked. Confirm on the platform's own page before upload |

This environment's network blocks `support.google.com`, `facebook.com`, `help.x.com`,
`ads.tiktok.com` and `support.discord.com`, so most social figures are **VERIFY**.
Re-check every VERIFY line on the day of upload. Specs change without notice.

---

## Apple App Store

Source: Apple, *Screenshot specifications* and *App preview specifications*,
developer.apple.com/help/app-store-connect/reference/ (read 6 Oct 2026). **OFFICIAL**

**Screenshots**
- Formats: `.jpeg`, `.jpg`, `.png`. 1 to 10 per device size.
- iPhone 6.9": 1320 x 2868, 1290 x 2796 or 1260 x 2736 (portrait). PHASE uses **1320 x 2868**.
- iPhone 6.5": 1284 x 2778 or 1242 x 2688. Required only if 6.9" shots are not supplied.
- iPhone 6.3": 1206 x 2622 or 1179 x 2556. Scaled from the larger size if not supplied.
- iPad 13": 2064 x 2752 or 2048 x 2732 (portrait). **Required if the app runs on iPad.** The iOS scaffold builds iPhone and iPad (`LAUNCH-PROGRAMME.md`, D), so iPad shots are needed before iOS submission.
- Apple's page says that if the interface is the same across sizes, only the highest required resolution is needed, and smaller sizes are scaled from it.
- No alpha channel in practice. Our frames are rendered opaque.

**App previews (video)**
- 15 to 30 seconds. Up to 3 per device size and language.
- `.mov`, `.m4v`, `.mp4` (H.264, up to High Profile 4.0, 10 to 12 Mbps), or ProRes 422 HQ `.mov`.
- 30 fps. Stereo AAC 256 kbps, 44.1 or 48 kHz. Max 500 MB.
- iPhone 6.9"/6.5": **886 x 1920** portrait. iPad 13": **1200 x 1600** portrait.
- Apple's guidelines require previews to show footage captured from the app itself. Our 30s cut must be re-cut from device capture before use as a preview (see `assets/03-trailer/TRAILER.md`).

**App icon**: 1024 x 1024, no transparency. **OFFICIAL** (standard App Store Connect requirement; the PHASE file is opaque).

## Google Play

Sources: Play Console Help *Add preview assets* (support.google.com/googleplay/android-developer/answer/9866151), quoted via search; Android Developers *Icon design specifications* (developer.android.com/distribute/google-play/resources/icon-design-specifications), read directly.

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512 x 512, 32-bit PNG, sRGB, max 1024 KB, full square (Play applies 30% corner radius and shadow itself) | **OFFICIAL** |
| Feature graphic | 1024 x 500, JPEG or 24-bit PNG, no alpha | **OFFICIAL (via search)** |
| Screenshots | JPEG or 24-bit PNG, no alpha; each side 320 to 3840 px; long side no more than twice the short side | **OFFICIAL (via search)** |
| Screenshot count | Min 2, max 8 per device type; max 8 MB each | VERIFY |
| Promotion eligibility | Apps: at least 4 screenshots at 1080 px or more. Games: at least 3 landscape 1920 x 1080 | VERIFY |
| Tablets | 7-inch and 10-inch slots; 16:9 or 9:16 | VERIFY |
| Icon content | No ranking, deals or store-programme text or badges | **OFFICIAL** |
| Promo video | YouTube URL; public or unlisted, not age-restricted, ads off, not a playlist | VERIFY (not read today) |

**PHASE decision:** phone screenshots at **1080 x 2340** (9:19.5, inside the 2:1 rule). The game is portrait-only, so the landscape "games" promotion slot is not used; we do not fake landscape gameplay.

## YouTube

| Item | Figure | Status |
|---|---|---|
| Video | 16:9; 1920 x 1080 or above; H.264 MP4 | VERIFY |
| Shorts | 9:16, 1080 x 1920, up to 3 minutes | VERIFY (secondary: Kapwing, Async, Postfast) |
| Channel banner | 2560 x 1440; content safe area 1546 x 423 centred | VERIFY |
| Profile picture | 800 x 800, shown as a circle | VERIFY |
| Thumbnail | 1280 x 720, under 2 MB | VERIFY |

## Instagram and Facebook (Meta)

| Item | Figure | Status |
|---|---|---|
| Reels | 9:16, 1080 x 1920, up to 3 minutes | VERIFY (secondary: Argil, Outfy, Somake) |
| Reels safe zone | Keep text clear of top ~269 px, bottom ~672 px, sides ~65 px at 1080 x 1920 | VERIFY |
| Feed portrait | 4:5, 1080 x 1350 | VERIFY |
| Feed square | 1:1, 1080 x 1080 | VERIFY |
| Profile picture | 320 x 320 (Instagram), shown as a circle | VERIFY |
| Facebook cover | 1640 x 624 (desktop crops differ from mobile) | VERIFY |

## TikTok

| Item | Figure | Status |
|---|---|---|
| Video | 9:16, 1080 x 1920; MP4 or MOV | VERIFY (secondary: Recurpost, Async) |
| Upload size | ~72 MB Android app, ~287 MB iOS app, up to 4 GB web | VERIFY |
| Length | Up to 10 min recorded in app, up to 60 min uploaded | VERIFY |
| Safe zone | Treat as Reels: keep words out of the bottom ~35% and right-hand ~12% | VERIFY |
| Profile picture | 200 x 200 minimum | VERIFY |

## X

| Item | Figure | Status |
|---|---|---|
| Video | Max 140 s, 512 MB for standard accounts; 1280 x 720 or 1920 x 1080 recommended | VERIFY (secondary: Postfast, SocialKit) |
| Header | 1500 x 500 | VERIFY |
| Profile picture | 400 x 400 | VERIFY |
| Images | 16:9 (1600 x 900) displays uncropped in timelines | VERIFY |

## Discord

| Item | Figure | Status |
|---|---|---|
| Server icon | 512 x 512, shown as a circle | VERIFY (secondary: several specs sites) |
| Server banner | 960 x 540 (16:9); needs Server Boost level 2 | VERIFY |
| Invite splash | 1920 x 1080; needs Boost level 1 | VERIFY |
| Attachments | 10 MB per file without Nitro | VERIFY |

## Website

No platform limits. Assets are ours to size: favicon 16/32/48 PNG and ICO, SVG
icon, Apple touch icon 180 x 180, Open Graph image 1200 x 630 (VERIFY against the
Open Graph documentation before relying on any crop).

---

## Sources

- Apple: developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/ and .../app-preview-specifications/
- Google Play: support.google.com/googleplay/android-developer/answer/9866151 (via search); developer.android.com/distribute/google-play/resources/icon-design-specifications
- Secondary (VERIFY only): kapwing.com, async.com, postfa.st, argil.ai, outfy.com, somake.ai, recurpost.com, socialk.it, michaeldishmon.com, krumzi.com
