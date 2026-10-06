# Store listing copy (launch), English

Replaces the contradicted lines in `docs/store-listing.md` (listed in
`docs/launch/FACTS.md`). Lengths counted by script on 6 Oct 2026.
French copy: the existing French listing needs the same corrections; not yet
rewritten (see the manifest, STO-L10).

## Google Play

| Field | Copy | Length |
|---|---|---|
| Title (30) | PHASE: Rugby Manager | 20 |
| Short description (80) | The rugby management game where the world remembers what you did. | 65 |
| Full description (4000) | `full-description-en.txt` | 3,273 |
| Category | Games > Sports | |
| Tags | Sports, Simulation, Strategy, Single player, Offline (unchanged) | |

## Apple App Store

| Field | Copy | Length |
|---|---|---|
| Name (30) | PHASE: Rugby Manager | 20 |
| Subtitle (30) | Men's and women's club squads (unchanged: it adds indexed words the name and keywords don't) | 29 |
| Promotional text (170) | Pick a club. Make the calls. Your players, your rivals and every agent in the game remember what you did. 171 clubs, the men's and women's game, offline. | 153 |
| Keywords (100) | Keep the existing line in `docs/store-listing.md`. It has no claims to correct | 96 |
| Description | `full-description-en.txt` | 3,273 |

## Review notes: corrections needed (App Store, and Play's app-access notes)

Replace in the existing review notes:
- "a banner at the foot of the Home and Results screens" with "banners in seven places (Home, the week, results, match day while a highlight plays, news, press and finance), and optional 'Free with ad' buttons the player chooses to press".
- Delete the paragraph about "the free web version at phaserugbymanager.com". The website no longer serves the game.
- "Player names are real" with "Player names in the top men's leagues and most of the women's game are real; lower-tier squads use generated names".

## Screenshot story

| Frame | Headline | Supporting line | Real screen |
|---|---|---|---|
| STO-01 | YOUR CLUB. YOUR WAY. | Every Monday the desk fills up. What happens next is up to you. | Home, "Today needs your decision" |
| STO-02 | EVERY DECISION HAS CONSEQUENCES. | Lose, and the coach tells you exactly why. Then you fix it. | Full time, Coach's Verdict, "What hurt you most" |
| STO-03 | YOUR PLAYERS REMEMBER. | Keep your word and they will run through a wall for you. | News, "Word kept: Lilian Larrieu" |
| STO-04 | THE WORLD REMEMBERS. | Break a promise and every agent in the game hears about it. | News, "Agents talk: your word on the market" |
| STO-05 | BUILD YOUR SQUAD. | Rivals come for your best players. Sell, or hold your nerve. | Bids For Your Players, a £16m bid |
| STO-06 | MASTER MATCHDAY. | Pick the fifteen. Set the plan. Change it at half-time. | Tactics, roles on the pitch |
| STO-07 | BUILD YOUR LEGACY. | Every season goes on your record. So does every nemesis. | Manager Legacy |
| STO-08 | NO TWO CAREERS ARE THE SAME. | 171 clubs · Men's and women's game · Six languages · Plays offline | Brand close, no screen |

Every screen is from one deterministic career built by `scripts/launch/showcase.ts`
and captured by `scripts/launch/capture.mjs`. The stories are the engine's own
words; nothing was typed in.

## Upload order and files

| Store slot | Files |
|---|---|
| Play phone screenshots (8) | `final/play/STO-01...STO-08` (1080 x 2340 PNG, opaque) |
| Play icon | `final/play/play-icon-512.png` |
| Play feature graphic | `final/play/feature-graphic-1024x500.png` |
| App Store iPhone 6.9" (8) | `final/ios-6.9/STO-01...STO-08` (1320 x 2868) |
| App Store iPad 13" (8) | `final/ipad-13/STO-01...STO-08` (2064 x 2752) |
| App Store icon | `final/ios-6.9/appstore-icon-1024.png` (no alpha) |
| Play promo video | YouTube URL of the 30s trailer, once the final cut exists (03-trailer) |
| App Store app preview | Not yet: must be re-cut from device capture at 886 x 1920, 15 to 30 s |
