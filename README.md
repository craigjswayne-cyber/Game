# 🏉 Rugby Manager

A classic-style rugby union management game for mobile — a personal, just-for-fun project
in the spirit of the great late-90s management sims, dressed in an editorial
heritage look (deep forest green, parchment, serif mastheads).

**Personal use only. Not for sale or distribution.** Player names are real,
included purely for private enjoyment; clubs and grounds are fictional
(location-based identities, since v1.0.2).

## What's in the game

- **8 selectable competitions, 100+ clubs, ~1,600 real players (2026–27 window, verified)**
  - The English, French and Celtic/South African top flights plus their second
    tiers, Super Rugby Pacific and Japan's League One
  - Fictional location-based clubs and grounds with real capacities and
    colours, calibrated 1–100 player ratings
- **Competitions**: full league seasons with bonus points and playoffs, a 16-team
  Champions Cup (pools → knockouts), plus the Six Nations, Rugby Championship and
  Autumn internationals simulated around you — your players get called up and
  become unavailable during test windows.
- **The classic loop**: Inbox → team selection → Continue → match day. Dense sortable
  squad tables, 1–20 attributes across 18 rugby-specific categories (scrummaging,
  lineout, rucking, goal kicking…), form, morale, condition, sharpness, injuries, bans.
- **Match day**: live-text commentary with a pitch view and flashing key events —
  tries, conversions, penalties, drop goals, cards, injuries — at three playback
  speeds, with instant skip.
- **Squad building**: transfers with AI bids and negotiations, free agents,
  contracts and renewals, transfer listing, wage and transfer budgets, board
  confidence and season objectives — fail badly enough and you're sacked.
- **The press**: journalists ask about your players and your results; your right
  to reply moves morale and board confidence.
- **Long-term play**: seasons roll over with awards, ageing, retirements, youth
  academy intakes (regens), Champions Cup requalification, prize money, and a
  roll of honour. 10 seasons simulate in ~2.5 seconds.
- **Saves**: IndexedDB save slots with autosave — installable as a PWA and playable offline.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build to dist/
npm run preview    # serve the production build
```

Open on your phone (or in devtools mobile viewport, ~390×844) and add to your
home screen for the full app experience.

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
