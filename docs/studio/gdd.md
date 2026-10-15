# PHASE: Rugby Manager: game summary (as it exists today)

Shared reference for the studio agents. Written 15 Oct 2026 from the code and
docs at version 1.9.0. Describes what ships, not what is planned.

Markers: **[GAP]** something missing or contradictory · **[GUESS]** inferred,
not confirmed by the owner or the code.

## 1. Identity

| | |
|---|---|
| Genre | Rugby union management sim, text and tables, portrait-first |
| Platforms | Google Play (live, FWDS & BCKS LTD). iOS pending Apple developer account approval |
| Business model | Free, AdMob ads in the native shell, 12 store products (11 on sale, plus a one-time Pro intro offer) |
| Languages | English, French, Spanish, Italian, Japanese, Afrikaans (`src/locales/`) |
| Licensing | Unlicensed. Real player names. Clubs named after their location (for example Northampton RFC), not the official club names. Competitions, grounds and sponsors renamed or invented. No badges, kits or logos |
| Owner | Solo developer, part-time |
| Community | Discord, already linked in-game (About screen, bug report) |
| Website | phaserugbymanager.com (`landing/`) |

## 2. Tech

- TypeScript, React 18, Zustand, Vite 5. No game engine.
- `src/game/` pure engine (match sim, seasons, transfers, media, rollover).
  `src/ui/screens/` 45 screens. `src/data/leagues/` squad data. `src/store.ts`
  navigation and the Continue loop.
- Saves: four IndexedDB slots, autosave, export/import, share-sheet backup.
- Stores: Capacitor 8.5 shells in `packaging/android` and `packaging/ios`, own
  billing plugins (`PhaseBilling.java`, `PhaseBilling.swift`), ads bridge in
  `packaging/shell`. The web game makes no network calls; `scripts/netprobe.ts`
  enforces it.
- Tests: ~400 scripts in `scripts/`, GitHub Actions "Gate" (engine probes on
  every push in 8 shards, browser suite nightly).

## 3. Core loop

1. **The week**: read the inbox, pick the team, set tactics and training, press Continue.
2. **Match day**: live text commentary and stats, a pitch view for tries and big
   moments, three speeds or an instant result with an explanation.
3. **Between matches**: transfers, contracts, scouting, medical, academy,
   facilities, press conferences, finances.
4. **Season end**: awards, ageing, retirements, academy intake, prize money,
   Roll of Honour, board review. Fail badly enough and you are sacked.

## 4. Content

- 171 clubs in 15 leagues: 9 men's (English, French, United Provinces and
  Pacific top flights, Japan, USA, plus second and third tiers) and 6 women's.
- Real players in top flights, generated squads lower down.
- Competitions: league seasons with bonus points and play-offs, a 16-club
  Continental Cup, Northern and Southern Championships, autumn and summer Tests
  (internationals get called up and miss club games). National team jobs.
- Players: 1 to 20 attributes across 18 rugby categories, form, morale,
  condition, sharpness, injuries, bans.
- Systems: transfers with AI bids and negotiation, two windows, loans, free
  agents, salary cap, board confidence, season objectives, press, facilities,
  academy, mentoring, depth chart.
- Long game: 10 seasons simulate in about 2.5 seconds; careers built for 15+ seasons.

## 5. Monetisation

Rule in the code: nothing sold changes match results, player ability or balance,
except the products below that the owner chose to sell as shortcuts (marked *).

| Product id | Type | What it does |
|---|---|---|
| `phase.supporter` | Permanent | Pro Manager: removes banner ads |
| `phase.supporter.intro` | Permanent | Pro Manager at a one-time lower price, offered once |
| `phase.license` | Permanent | "Support the game" tip, changes nothing |
| `phase.uncapped` | Permanent | Charter (*) **[GUESS: lifts the salary cap, from the id]** |
| `phase.estate` | Permanent | (*) Every facility to maximum at the current ground |
| `phase.ground` | Consumable | (*) The estate again after moving club (£9.99 per code comment) |
| `phase.pinnacle` | Permanent | (*) An international job offer follows within weeks |
| `phase.inject.s/m/l/xl` | Consumable | (*) Board cash injection, £10m to £130m in game |
| `phase.heal` | Consumable | (*) Heals every injury, refreshes the squad |

Ads: two banner slots (Home, weekly Results) and rewarded spots, all in the
shell, with UMP consent then ATT on iOS.

- **[GAP]** Pro Manager price: you state £2.99; `docs/pro-manager.md` and
  `docs/monetisation-spec.md` say $1.99. The app reads prices from the store at
  runtime, so only the docs are affected.
- **[GAP]** Bought but unused consumables are lost on reinstall (disclosed on
  the support page).

## 6. Status and known gaps

- **[GAP]** 1.9.0 report (`docs/release-report-1.9.0.md`) says NOT READY: the
  device checks on Android have not been done, and the contested set-piece
  engine change has had no human play-test. **[GUESS]** 1.8.18 (versionCode
  57) is the build live on Play.
- **[GAP]** iOS: `PhaseBilling.swift` 1.9.0 changes have never been compiled;
  Restore does not call `AppStore.sync()` (checklist S1, S15). Needs a Mac.
- **[GAP]** Saves carry no version number, so future save migrations have
  nothing to key on.
- **[GAP]** No in-app review prompt on either store.
- **[GAP]** No analytics by design, so retention can only be seen through the
  Play Console and App Store Connect dashboards.
- **[GAP]** Store privacy forms under-declare what AdMob collects (checklist B1).

## 7. Where to look

| Topic | Doc |
|---|---|
| Store blockers | `docs/launch/STORE-READINESS-CHECKLIST.md` |
| iOS submission | `packaging/ios/APP-STORE-WALKTHROUGH.md` |
| Monetisation rules | `docs/monetisation.md`, `docs/pro-manager.md` |
| Writing style for player-facing text | `docs/voice-bible.md` |
| Future directions | `docs/roadmap.md`, `docs/working-list.md` |
| Testing | `docs/testing.md` |
