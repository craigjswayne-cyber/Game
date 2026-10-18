# Brag Plan: PHASE: Rugby Manager (v2, showreel)

## What is this app?
A rugby union management game for phones: take the job, pick the XV, build the club, and answer for all of it on Saturday.

## The angle
A dark, high-pressure showreel. A first-person walk down a club corridor to the manager's office, then the game itself in fast cuts. The darkness comes from the title card art; the pressure comes from the job: the board is waiting, and fail badly enough and you're sacked.

## Tone
- Preset: cinematic, with chaotic-speed cuts in the middle
- Creative direction: dark sports-drama showreel, the weight of the top job

## Format: vertical 9:16, 1080x1920. Duration: 28s
Longer than /brag's usual 15-25s because the brief asked for the corridor intro, a phone montage, a four-part showcase and a feature run.

## Storyboard
| Time | Scene |
|---|---|
| 0-4.4 | First-person walk down a dark wood-panelled corridor (CSS 3D), tube lights, framed facility plans from the game's art, footsteps. "THE BOARD IS WAITING." The MANAGER door opens onto the title-card office. |
| 4.4-7.9 | Music hits. YOUR CLUB. / YOUR LEGACY. / YOUR TIME. over the office. |
| 7.9-11.4 | Phone rises in; 12 real screens flick past on the half beat while it slowly zooms. "THIS IS YOUR CHANCE / TO TAKE CONTROL." Zoom into the screen. |
| 11.4-16.9 | Full-bleed fast cuts: live match TRY + 32-12 full time ("THE CALLS ARE YOURS."), tactics pitch + starting XV ("BUILD YOUR DREAM TEAM."), campus map ("BUILD THE CLUB."), Wonderkid Watch + academy ("FIND THE WONDERKIDS."). |
| 16.9-22.9 | Feature run, one per second: MEN'S & WOMEN'S GAME, 171 CLUBS 15 LEAGUES, 11,000+ PLAYERS, PLAYS OFFLINE, TAKE CHARGE OF YOUR COUNTRY, FACE THE PRESS. |
| 22.9-24.9 | Job Centre, almost black: FAIL BADLY ENOUGH / YOU'RE SACKED. |
| 24.9-28 | PHASE / RUGBY MANAGER, then the Android robot with DOWNLOAD NOW / ON ANDROID, then "iPhone · coming soon" and "Unofficial and independent". |

## Grounding
- 171 clubs, 15 leagues, men's and women's game, plays offline, the press, "Fail badly enough and you're sacked": README / store listing.
- 11,000+ players: a fresh world has 6,977 players (men's) and 4,217 (women's), counted from newGame().
- Take charge of your country: store listing, "a national job may follow".
- Wonderkids: the Scouting Agency's Wonderkid Watch screen.

## Audio
- Music: an original score, synthesised by `brag-output/score/score.py` (numpy only, no samples, no licence to clear). 120 BPM in A minor, timed to the cuts.
- Corridor: low drone, a heartbeat that quickens towards the door, a ticking clock, footsteps, a riser.
- 4.4s: trailer braam, sub drop and taiko on the door burst; stabs on each hook line.
- 7.9-11.4: kick, 16th-note ostinato, bass and hats build with a snare roll and riser into the zoom.
- 11.4-22.9: full drive (kick, snare on 2 and 4, taiko, ostinato, string pad Am-F-Dm-E), taiko and sub hits on every cut and feature.
- 22.9: the drive drops out to a dissonant drone; 23.6 a clustered braam on "YOU'RE SACKED."
- 24.9: final braam, ringing pad and taiko under the logo and download card.
- Audio-reactive: bass drives the green glow behind the phone and the logo.

## Safe zones
All text sits between y=150 and y=1450 and inside x=80-1000, clear of the TikTok/Reels caption and button overlays.

## Notes
Screens come from the production build (scripts/storeart.mjs plus a one-off menu walk). Real player names appear in them, as in the store screenshots; none is used as headline copy.

The Android robot is reproduced or modified from work created and shared by Google and used according to terms described in the Creative Commons 3.0 Attribution License. Credit it in the post caption.
