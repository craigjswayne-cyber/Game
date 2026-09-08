# Made by Mimi

Fitness, nutrition, mindset, habit tracking, community and 1-1 coaching, in one
app. This directory is a working prototype of the product brief: a mobile first,
installable web app with no build step and no server.

It sits alongside the rugby game in this repository and shares nothing with it.
Nothing in `src/`, `scripts/`, `packaging/` or the root build config is touched
by anything in here.

## Run it

The app is plain ES modules, so it needs to be served over http rather than
opened off the disk (module imports and the service worker both refuse `file:`).

```bash
cd mimi
python3 -m http.server 4173      # or: npx serve .
```

Then open <http://localhost:4173> in a phone sized viewport, about 390 by 844.
Add it to the home screen for the standalone shell.

## Check it

```bash
npm install                      # from the repository root, for playwright-core
node mimi/scripts/smoke.mjs      # serves the app and drives a real browser
node mimi/scripts/icons.mjs      # regenerate the PNG icons from icons/icon.svg
```

The smoke test walks the intake, both workout filters, a logged session with its
rest timer, every habit on the tracker, the macro calculator, the recipe vault,
the analytics, a breathing session, a community post and a coaching check-in,
then reloads to prove the save survived. It fails on any console error or page
exception, and one step posts markup into the feed to check it does not run.
Screenshots land in `mimi/shots/`, which git ignores.

## What is here

```
mimi/
  index.html                 app shell, fonts, manifest
  fonts/                     Playfair Display and Sora, latin variable subsets
  manifest.webmanifest       installable PWA metadata
  sw.js                      offline cache for the whole app shell
  styles/tokens.css          every colour, type step, radius and shadow
  styles/app.css             layout and components, tokens only
  js/app.js                  route table and boot
  js/router.js               hash router, five tabs, render/mount/unmount
  js/state.js                the single store, saved to localStorage
  js/macros.js               Mifflin-St Jeor, activity factors, goal splits
  js/health.js               the Apple HealthKit seam for a native shell
  js/offline.js              downloads and service worker registration
  js/ui.js                   shared chrome: cards, meters, charts, sheets
  js/util.js                 escaping, dates, icons
  js/data/                   programmes, exercises, recipes, quotes, mindset
  js/screens/                one module per screen
  scripts/smoke.mjs          end to end harness, fails on any console error
  scripts/icons.mjs          rasterises the PNG icons from the master SVG
```

## The five tabs

| Tab | What it does |
| --- | --- |
| Home | Greeting, rotating quote, the next session, today's habits, macro targets, and the doors to Mindset, 1-1 coaching and the community feed |
| Workouts | Home and gym toggle, discipline filters, five multi-week programmes, the full exercise library, and a session player with weight and rep logging, a rest timer and per-exercise cues |
| Today | Month calendar with session dots, water glass, steps, mood, weight, a daily to-do list, and the workout and water streaks |
| Nutrition | The macro calculator with its working shown, and Mimi's recipe vault with tag filters and macros per serving |
| You | Weight chart, weekly consistency, measurements, Apple Health switches, downloads, backup export and a full reset |

Mindset, Community and 1-1 coaching sit under the Home tab: guided breathing
with a paced orb, journal prompts that save, a moderated feed, and a weekly
check-in form with a message thread.

## Onboarding

First launch runs a seven step intake: experience level, home or gym, training
discipline, goals, body metrics, activity level and daily water and step goals.
The answers pick a starting programme, set the macro targets and populate the
tracker rings. It can be re-run field by field from the You tab.

## What is real and what is a placeholder

Being straight about this matters more than a demo that looks finished.

**Real:** every screen, the routing, the store and its migration, set logging,
the rest timer, streaks, the calendar, the macro calculator (Mifflin-St Jeor
with a 1,200 kcal floor), the recipe macros, the offline shell cache, the
journal, the feed, the check-in form, backup export and reset.

**Placeholder:**

- **Exercise videos.** No video binaries ship here. The player renders its
  poster state and names the file the shipping app would stream.
- **Apple Health.** HealthKit is a native API. `js/health.js` is the seam a
  native shell fills in by setting `window.MimiHealth`; until it does, the app
  says so rather than inventing step counts.
- **The backend.** Community posts, coaching messages and check-ins are held on
  the device. The three functions at the bottom of `community.js` and the writes
  in `coaching.js` are the only places a real API would be wired in.
- **Payments.** The coaching sheet sends an enquiry. Nothing is charged.

## Design system

Warm off-white ground (`#FDFBF7`), deep maroon brand (`#4A121A`) and pink used
sparingly for the one thing on a screen that wants the eye. Playfair Display for
headings, Sora for the interface, both self hosted as latin variable subsets in
`fonts/`, with Georgia and the system sans behind them. The app makes no request
to any third party host. Every colour lives in `styles/tokens.css`.

## Taking it cross platform

The brief asks for iOS and Android. Two routes from here:

1. **Wrap it.** Capacitor around this directory gives both stores an app, a real
   HealthKit plugin behind `window.MimiHealth`, and native video. This repository
   already wraps its other app that way, in `packaging/`.
2. **Port it.** The screens are pure functions of the store, and the store is
   plain JSON. A React Native port keeps `state.js`, `macros.js` and everything
   in `js/data/` unchanged and rewrites the twelve screen modules.
