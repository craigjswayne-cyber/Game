# PHASE: Rugby Manager

A rugby union management game for phones. Pick a club, pick a side, live with
it. Dense squad tables, a real decision most days, and a career that remembers
season one when you get to season fifteen. English, French, Spanish, Italian,
Japanese and Afrikaans.

**Unofficial and independent.** PHASE: Rugby Manager is not affiliated with,
endorsed by or licensed by any player, club, league or governing body. Club
names are real; competitions, grounds and sponsors are renamed or invented.
Player names are real, used to identify people in a sporting database and for
nothing else. No official badges, kits or logos ship with the game. Anybody
named who would rather not be can write to info@fwdsandbcks.com and will be
removed in the next update.

The game itself collects nothing and sends nothing anywhere: no accounts, no
analytics, no network calls (`scripts/netprobe.ts` fails the build if one
appears). The Google Play and App Store builds add Google AdMob adverts in the
app shell, outside the game, and a Pro Manager purchase takes the banners away.
Careers are saved on the device, with export, import and a share-sheet backup.

Store release work - the monetisation layer, the legal surface, the listing copy
and the packaging - is documented in `docs/monetisation.md`,
`docs/store-listing.md`, `docs/release-readiness.md`, `docs/launch/` and
`packaging/`. Anything a player reads, store copy included, is written to
`docs/voice-bible.md`.

## What's in the game

- **171 clubs in 15 leagues.** Nine in the men's game (the English, French,
  United Provinces and Pacific top flights, Japan, the United States, and the
  second and third tiers beneath them) and six in the women's game, built the
  same way. Real players in the top flights, generated squads lower down.
- **Competitions**: full league seasons with bonus points and play-offs, a
  16-club Continental Cup, and the Northern and Southern Championships and the
  autumn and summer Tests played around you. Your internationals get called up and miss
  club matches.
- **The week**: inbox, team selection, Continue, match day. Sortable squad
  tables, 1 to 20 attributes across 18 rugby categories (scrummaging, lineout,
  rucking, goal kicking and the rest), form, morale, condition, sharpness,
  injuries and bans.
- **Match day**: live text commentary with live stats, and the pitch for tries
  and big moments, at three speeds or as an instant result that explains itself.
- **Squad building**: transfers with AI bids and negotiation, two windows, free
  agents, loans, contracts and renewals, the salary cap, board confidence and
  season objectives. Fail badly enough and you're sacked.
- **The press**: journalists ask about your players and your results. What you
  say reaches the dressing room and the board.
- **The long game**: seasons roll over with awards, ageing, retirements, academy
  intakes, prize money and a Roll of Honour. Ten seasons simulate in about 2.5
  seconds.
- **Saves**: four IndexedDB career slots with autosave.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
npm run preview    # serve the production build
```

Open it on a phone, or in a devtools mobile viewport of about 390×844. The
browser build is for development only: the public site no longer serves the
game, and players get it from the stores.

## Dev scripts

```bash
npx vite-node scripts/simtest.ts    # headless 10-season engine soak test
npx vite-node scripts/disttest.ts   # scoreline realism distribution check
node scripts/e2e.mjs                # Playwright end-to-end UI test (needs Chromium)
node scripts/icons.mjs              # regenerate PWA icons from public/icon.svg
```

## Project shape

```
src/
  data/leagues/   real squads, one file per league half (RawClub[])
  game/           pure engine: match sim, seasons, transfers, media, rollover
  ui/             React screens, one file per screen + theme.css
  store.ts        zustand store: navigation, continue loop, live match playback
```
