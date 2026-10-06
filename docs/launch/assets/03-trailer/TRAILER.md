# PHASE launch trailer

**Status:** the edit is locked as an animatic. The final trailer is BLOCKED on two
inputs only the owner can supply: a licensed music track, and screen recordings
from a real phone. Everything else (story, words, timings, cards, captions,
exports) is done.

| What | Where | Status |
|---|---|---|
| Script and storyboard | this file | DONE |
| Animatics, 4 cuts x 4 ratios (silent, real screens) | `working/animatic-<cut>s-<ratio>.mp4`. Committed review set: 60s and 30s 16:9; 30s, 15s and 6s 9:16. The other 11 regenerate with the script | DONE (review copies) |
| Title cards and end cards, 4 ratios | `final/cards/` | DONE |
| Caption files (on-screen words) | `final/captions/phase-trailer-<cut>s.srt` | DONE |
| Music | to licence | BLOCKED (owner) |
| Device capture | to record | BLOCKED (owner, 20 minutes on the Samsung) |
| Final masters | `final/` | NOT STARTED (needs both of the above) |

Rebuild everything: `node scripts/launch/trailer.mjs` (about 10 minutes).

## The story

Not a feature list. One career, one loop:
**a decision → the match answers → you understand why → the world remembers → the career moves on.**

No voiceover. Captions carry the story, so every cut works with the sound off.

## 60-second master (16:9)

| Time | Act | Screen (all real, one career) | On screen |
|---|---|---|---|
| 0:00 | OPEN | Black | THE WORLD REMEMBERS WHAT YOU DID. |
| 0:04 | DECISION | Press Room: "29 weeks on the bench for Océan Deltour-Peyrouse... What has he done?" Three answers | YOU MAKE A DECISION. |
| 0:09 | DECISION | Bids For Your Players: AS Paris bid £16m. Accept, Demand More, Reject | EVERY CALL IS YOURS. |
| 0:14 | CONSEQUENCE | Live match, half-time, 7-10 down, the assistant's word | THE MATCH ANSWERS. |
| 0:19 | CONSEQUENCE | Full time 17-31. Coach's Verdict: "What hurt you most: Their crash ball made 2 tries against us." | YOU KNOW WHY. |
| 0:25 | MEMORY | News: "Word kept: Lilian Larrieu". "I will not forget that, coach." | HE REMEMBERS. |
| 0:31 | MEMORY | News: "Agents talk: your word on the market" | SO DOES EVERY AGENT. |
| 0:36 | MEMORY | Match Day: "Your record against Lilian Bousquet: won 5, lost 5." | SO DOES EVERY RIVAL. |
| 0:41 | CAREER | Manager Legacy: 360 matches, a nemesis, "Known as a club built on youth" | SEASONS PASS. THE RECORD STAYS. |
| 0:46 | CAREER | Tactics: fifteen shirts on the pitch | SET THE PLAN. |
| 0:49 | END | Black | YOUR CLUB. YOUR DECISIONS. YOUR STORY. |
| 0:54 | END | Logo end card | PHASE: RUGBY MANAGER. Free on Google Play |

## The cuts (each has its own rhythm)

| Cut | Use | Sequence |
|---|---|---|
| 30s | Standard, Play promo video, paid social | Open · decision (press) · verdict · he remembers · agents · your club/decisions/story · end |
| 15s | Social, pre-roll | Open · verdict · he remembers · end |
| 6s | Teaser, bumper | He remembers · end |

The 30s is not the 60s trimmed: it drops the bid, the half-time and the career
beats and goes straight from the decision to the verdict, because at 30 seconds
the cause and effect has to be adjacent to land.

## Ratios

| Ratio | Size | For | Layout |
|---|---|---|---|
| 16:9 | 1920 x 1080 | YouTube, website, Play promo, X | Caption left, screen right |
| 9:16 | 1080 x 1920 | TikTok, Reels, Shorts, Facebook Reels | Caption top (inside the safe zone), screen below |
| 1:1 | 1080 x 1080 | Feeds | Caption left, screen right, bleeding off |
| 4:5 | 1080 x 1350 | Instagram and Facebook feed | Caption top, screen below |

Each is composed separately; nothing is cropped from the 16:9.

## From animatic to final: what changes

1. **Live screens instead of stills.** Record the same beats on the Samsung (see the capture list). Replace each still with the recording, keeping the timing.
2. **Music** under the whole thing (brief below).
3. **Sound design** (brief below).
4. **App Store badge** on the end card once iOS is live; until then "Free on Google Play" only. Use the official Google Play badge artwork from Google's badge page, unaltered (owner to download; the page is blocked from this environment).
5. Export per the table at the end.

## Capture list (owner, on the phone, about 20 minutes)

Set up: Settings > Text size: Bigger (matches the stills); night mode; Do Not
Disturb on; battery above 50% so the status bar is clean; screen recorder at the
highest quality, 60 fps if offered. To film the same career as the stills, unzip
`10-source/saves/showcase-saves.zip` and use Saves > Import on the phone
(`s11w30.import.json` for the match and the news beats, `final.import.json` for
the rest). Verified 6 Oct 2026: `final.import.json` imports through Saves > Import
in the 1.8.11 build and opens Sam Ashworth's career at RC Montauban, season 12
(tested in the browser build, which runs the same code as the phone; try it once
on the phone before the session). Your own career works too.

1. Press Room question with three answers. Hold 3 s, tap an answer.
2. Bids For Your Players: hold on the bid card, tap Demand More.
3. Live match at normal speed, 20 s, including a highlight clip.
4. Half-time screen, scroll gently through the assistant's word.
5. Full time: let the stamp play, scroll to the Coach's Verdict.
6. News: open "Word kept", let it sit 4 s.
7. News: "Agents talk".
8. Match Day preview with "Your record against...".
9. Manager Legacy, slow scroll from the top to "Across the dugout".
10. Tactics: tap a shirt, set a role.

Crop the phone's status bar and navigation bar out in the edit. No taps on
anything that opens a purchase or an advert.

## Music brief

Modern, confident, restrained. Think a broadsheet sports documentary, not an
esports promo. Builds with the story: sparse piano or plucked strings under the
open and the decision; a pulse arrives with the match; full but not loud at the
memory beats; resolves on the end card. 60 s with clean edit points at 30, 15 and
6 s, or stems.

**Licence must cover:** worldwide, perpetual, online and social advertising,
app store previews, YouTube (with Content ID cleared or whitelisted for our
channel), paid social. Keep the licence PDF in `10-source/music/` and record it
below. Don't use a track because it sounds good: use it because the licence is on file.

| Track | Composer | Library | Licence ID | Scope | Date | File |
|---|---|---|---|---|---|---|
| (to be chosen) | | | | | | |

## Sound design

Quiet and tactile: UI taps and confirmations from the game itself, a page turn
on news beats, a referee's whistle into the match, low crowd bed under the
match (rising at the try), one soft impact on each caption. No whooshes, risers
or arcade hits. Library sounds need the same licence record as the music.

## Captions

- Burned in: the captions *are* the on-screen words, so every cut works muted.
- Sidecar: `final/captions/*.srt` for YouTube and accessibility, matching the 60s, 30s, 15s and 6s timings.
- 9:16: words sit in the top third, clear of TikTok/Reels/Shorts UI (bottom ~35%, right ~12%).

## Final export specs

| Master | Codec | Notes |
|---|---|---|
| 16:9 1920 x 1080 | H.264 High, 30 fps, 16 to 20 Mbps, AAC 320 kbps | YouTube, website. Also a ProRes 422 HQ archive in `archive/` |
| 9:16 1080 x 1920 | H.264, 30 fps, 12 to 16 Mbps | TikTok, Reels, Shorts (check each app's upload limit, PLATFORM-SPECS) |
| 1:1, 4:5 | H.264, 30 fps, 10 to 12 Mbps | Feeds |
| App Store preview | 886 x 1920, 15 to 30 s, 30 fps, H.264 10 to 12 Mbps, AAC 256 kbps | From device capture only |

Animatic exports are H.264 CRF 17, 30 fps, with a silent stereo track so every
upload path accepts them.
