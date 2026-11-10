# 15-second Instagram Story ad

- `phase-story-ad-15s.mp4`: the ad. 1080x1920, 30 fps, H.264 High, AAC stereo 48 kHz, exactly 15.000 s (450 frames). Audio is silent: no music track was supplied.
- `phase-story-ad-15s-safezones.mp4`: the same video with Instagram's covered areas shaded red (top 270 px, bottom 380 px, 65 px side margins).
- `phase-story-endcard-1080x1920.png`: the last frame (end card).
- `storyboard.png`: 12 frames with timings.

| Time | Section |
|---|---|
| 0.0 to 3.45 s | LOVE RUGBY? hook, then RUGBY HAS A NEW GAME. |
| 3.5 to 5.35 s | PICK YOUR CLUB: leagues page, Men's and Women's tabs |
| 5.35 to 7.2 s | SELECT YOUR TEAM: Best XV and swaps (Leeds, National One) |
| 7.2 to 9.0 s | CALL YOUR MOVES: plays added to the Playbook |
| 9.0 to 11.5 s | WIN THE MATCH: Camborne v Rotherham, 42-5 to 47-10 (finished 49-17) |
| 11.5 to 15.0 s | Logo and FREE ON IPHONE AND ANDROID; still from 12.4 s. No store badges: a tap in a Story skips to the next story. |

## No real players on screen

The team and match clips come from English National One (Leeds; Camborne v Rotherham), whose squads are
generated, and Rotherham is a Championship club with no real players. The recorder read the game's own
`p.real` flag for both sides of the match: 0 of 65 real in each. Every visible name was also checked against the
4,300 real names in `src/data` (no hits) and by eye for well-known namesakes (a generator can still produce
one). Club names (Leeds, Camborne, Rotherham) are real community clubs, as everywhere in the game.

All gameplay is real, recorded from the built game in a 390x844 phone viewport at 3x via Chrome's screencast.
Background is `src/ui/title-bg.webp` with a 5% push-in.

## Source

`source/` holds the recorders (Playwright scripts run from `scripts/`, which import `scripts/lib/preview.mjs`),
`layers.html` + `layers.cjs` (text, logo and button layers in Barlow), `render.py` (compositor, pipes frames
to ffmpeg) and `check.py` (measures every element in every frame against the safe band). The recorded frame
folders were not committed (thousands of JPEGs); re-record with the scripts to rebuild. Paths in `render.py`
point at the session scratch folder and need updating to re-run.
