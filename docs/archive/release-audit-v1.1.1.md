# Release Audit — v1.1.1

**Date:** 26 August 2026. **Scope:** the owner's full-game audit brief — UX and
visual architecture, match engine and simulation stability, balance and
progression, commercial readiness. **Standard:** every claim below is a probe
run at this commit, a measured simulation, or a grep — nothing is assumed. This
extends `release-readiness.md` (v1.0.x store audit, still current on legal and
listing) rather than repeating it.

## Verdict

The game is release-fit. The full suite (150+ harnesses, engine and browser) is
green; a 20-season soak, a 15-season release sim, a 60-match interactive fuzz
and a paired-simulation balance audit all pass. The audit found **three real
defects**, all fixed and verified in this commit, and none of them
release-blocking crashes: a dead-end in stadium expansion, an untranslated
injury string, and an inbox pile-up. Everything else it found was evidence of
health, recorded below so the next audit has a baseline.

---

## 1. Bugs found, and the fixes applied

### 1.1 Stadium expansion was unreachable for every club (balance, fixed)

The board approves a stand only at ≥90% average fill. The gate model prices a
league Saturday at ~0.75–0.9 of sellable seats (hard cap 0.96) — and
`expansionPlan` averaged **pre-season friendlies into the fill figure**, which
the same engine deliberately prices at 38% interest. A club selling out every
league week read "77% full" to its own board. Measured: 40 scripted seasons
built zero stands; Leicester squeezed into an 8,000-seat ground was still
declined. Every sibling aggregate in `season.ts` already excluded friendlies;
this was the one that forgot. **Fix:** the vote now reads league and cup gates
only (`season.ts`, one line plus the comment). Verified: the same 8,000-seat
Leicester is approved mid-season ("500 new seats for £825k").

### 1.2 A failed HIA wrote English into a French save (i18n, fixed)

Every injury stores a `desc` (stored-English fallback) plus a `dk` dictionary
key so the Medical screen follows the reader's language. The failed-HIA path in
`matchEngine.ts` was the one writer that stored the bare string
`'concussion (failed HIA)'` with no key. **Fix:** `injury.hiaFail` added to
both dictionaries and the writer uses the standard pair. Verified in both
languages; the rng stream is untouched (`fingerprint` green).

### 1.3 Four "Academy buzz" cards in one inbox week (UX, fixed)

A retiring star with peak ≥78 seeds an academy heir, each with its own news
item. A heavy summer retired four stars at once and week 1 carried four
near-identical cards — the 20-season soak flagged it in both runs (its peak
week held 49 items). Retirements already had a digest; heirs did not.
**Fix:** three or more heirs now file one story naming them all, in both
languages via the `_l` list-fragment convention; one or two keep their own
headlines. Verified: forced four farewell tours, got one digest, English and
French both render every name.

### 1.4 Harness defects fixed along the way

- `suite.sh` binned each failing probe's own diagnosis lines (it grepped only
  lines *starting* with FAIL); the Annual-door CI failure on main reached the
  log as a bare `page.click: Timeout` because of it. Fixed: the three lines
  under each FAIL now survive, and `annualprobe`'s door click reports box,
  cover, disabled state and Playwright's own actionability text on failure.
- `dramaprobe` (new in v1.1.1) had claimed `devicematrix`'s preview port; moved.
- `soakhealth`'s scripted manager, once sacked, never applied for work again —
  17 of 20 seasons of "a manager who uses everything" silently didn't run, and
  three healthy systems (facilities, courses, scouting briefs) read as dead.
  Fixed: he applies for the best vacancy until re-hired (20/20 week-1s
  employed, 7 re-hirings), and the report now warns when a career goes hollow.

---

## 2. UX and visual architecture

**Aspect ratios.** `devicematrix` holds the layout law (no masthead collision,
reachable page end, no truncation, no right-edge overflow, edge fades on
scrollers) at six geometries covering the brief: 19.5:9 (390×844, 430×932),
20:9 (412×915), 18.5:9 (360×740), 16:9 (375×667) and 4:3 tablet (768×1024).
`geosweep` re-walks every screen at three widths; `subsprobe` drives the match
sheet at 844×390 landscape; `deskgate` covers the desktop/wide layout.

**Safe areas.** 10+ `env(safe-area-inset-*)` sites cover masthead, bottom nav,
modals, and the landscape rail (notch on the left edge).

**Tap targets.** `tapsize` enforces ≥44px on every button across 32 screens at
three widths — a probe, not a convention.

**Navigation depth.** Bottom nav (1 tap) → submenu (2) → screen tab (3). Every
core surface is ≤3 taps; the match screen's four-button control row was
audited down from seven this release cycle.

**Match-day scannability.** Score, minute, competition, weather, attendance,
penalties-conceded, possession bar and momentum needle are one glance on the
scoreboard; v1.1.1 adds the territory-driven ball and the tension band
(late-and-close named in words, static because `prefers-reduced-motion`
collapses every duration — `motionprobe` holds that information never lives
only in movement).

**Animation & frame budget.** One `setTimeout` heartbeat in the whole app
(cleaned up in its effect), zero `setInterval`s, zero polling. Kick arcs and
try flashes animate `transform`/`opacity` (compositor-friendly); the ball
eases `left` on a single 19px element. Text scale (`textscale`), night + day
contrast (`nightcontrast`, ≥2.2:1 everywhere), and French fit (`langprobe`)
are all probe-enforced.

## 3. Match engine and rulebook

**Laws modelled:** contested scrums with referee weighting; the uncontested-
scrum law when a front row cannot be fielded (set piece removed, which
correctly hurts the better scrum); lineouts, mauls, breakdown contests; 50:22
as a prep effect; penalty advantage; yellow cards with 10-minute bins tracked
on the replay clock, red cards with bans and hearings/appeals; HIA temporary
substitutions (~1 per 3 matches, 40% fail into a 12–21-day RTP — now keyed in
both languages); conversions, penalties, drop goals; weather, derbies,
neutral-venue finals, testimonials. Referees are 13 named profiles with
measured tendencies (scrum pedantry, breakdown patience, card rate, advantage
flow) that the pre-match sheet discloses.

**Touchline decisions:** posts / corner / tap, engine-stopped. The corner maul
reads lineout+pack against defence+breakdown — rebalanced this cycle after
measurement showed the boot dominated by +2.1 to +4.5 points a match.

**Tactical responsiveness** (`dialweight`, paired sims: same fixture, same rng,
dial 10 vs 90): every dial moves real points (aggression mean |swing| 9.4 a
match), **no dial is a dominant strategy** across a backs-leaning and a
pack-leaning squad (all |means| < 4.0 both ways), and aggression costs 3.13
points more a match in front of a fussy referee than a lenient one — the
matchup interactions the brief asked for, measured with the world held still.

**Interactive stability:** 60 chaotic matches (random pauses, talks, subs,
tactic slams, penalty calls every tick) with all engine invariants held.

## 4. Twenty-season soak

**Scoring drift** (every league match, 1,112/season, seed 20260825):
points/match 55.3 → 51.3, tries/match 6.43 → 5.54, both settling by season 5
and flat thereafter — inside the professional-rugby anchor (~50–55 pts, ~5–6
tries). Home wins 53–59%, draws 1.5–3.6%, and blowouts (30+) *fall* from 20%
to 11% as the world equalises while one-score games rise 25%→33%.

**Age & regen integrity:** mean age dips 23.3 → 21.9 then recovers to a stable
22.8; u23 regen quality at equilibrium (9.6 → 9.4 across six seasons); every
age stays 17–36; retirements and regens every season from the third; population
6,583 → ~7,400 and banded.

**Economy:** transfer fee medians £2.4M → £3.3M over 20 seasons (~1.5%/yr);
AI budgets £4.2M → £5.0M; league-wide money on a human scale (£952M); 47 of
101 clubs in the red at any time, distress contained, and clubs that cannot
pay actually go under (115 administrations over the run).

**Discipline & medical:** YC/match 0.69 → 0.62, RC/match 0.032 → 0.027,
injury spells and lengths flat (≈11.5 spells/club/season, avg 5.9wk).

**Save health:** size plateaus (7.7MB → 8.2MB, ×1.07 over the last 8 seasons),
round-trips through JSON every season, no NaN/Infinity in any text field, news
feed capped at 250, zero roster orphans or bad club refs, prose sweep clean
across 6,027 news items and 114 press conferences.

## 5. Balance and progression notes (no change needed)

- **Analyst:** skill = 0.3 + briefing×0.06 + assistant×0.05, capped 0.78 by a
  documented tuning decision. At a bare small club he is wrong more often than
  right — and the card prints his running record next to the follow button, so
  he documents himself. Working as designed.
- **Passive-career fairness:** a scripted, tactically passive manager bounces
  between 1st and 16th and spends ~half a career in tier 2 — inside the
  documented honest-neglect band; a sacked manager finds work again.
- **Difficulty** is club choice plus board expectation, not a slider — the
  documented design; the expectation system (pre-season decisions 3/3 employed
  week-1s in the soak) is exercised.

## 6. Commercial readiness

Unchanged from `release-readiness.md` where it stands, plus this cycle:

- **Privacy claims hold:** `netprobe` sweeps the shipped bundle — no fetch, no
  sockets, no SDKs, no remote fonts. "No data collected" remains grep-true.
- **Monetisation:** `storeprobe`/`moneyprobe` green — no till in the web build,
  a working one behind a bridge, fail-open, receipts out of the save.
- **IP:** `ipprobe` green against 121 real-world marks in the shipped bundle.
- **Version:** 1.1.1 in `package.json` and the TWA manifest.
- **Still human-gated:** Play signing key in `twa-manifest.json`; App Store
  packaging via `packaging/ios` (Capacitor); store account setup per the
  launch sheet.

## 7. Recommended next (not blocking)

1. Inbox pressure: mean 9.4 items/week on a busy career — consider digests for
   other bulk beats (the heir digest above is the pattern).
2. `soakui` and `e2edeep` (long browser soaks) on a quiet machine before the
   store submission build is cut.
3. A `dramaprobe`-style guard for the Skip announcement is in; consider the
   same for future presentation work by default.
