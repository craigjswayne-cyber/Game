# FAB Rugby - commercial release audit

A reusable prompt for a full pre-release audit. Paste the whole of "The prompt"
below into a fresh session. Everything above it is context for whoever is
choosing to run it.

## When to run this

Before any build you would put in front of a stranger. It assumes the game is
already feature-complete and green on `scripts/suite.sh`; its job is to find
what a green suite does not.

## What it is designed to defeat

The failure mode of "check everything" prompts is broad, shallow work: a tour of
the codebase that reports tidy observations and fixes nothing. This one is
structured as passes with explicit exit criteria, and it refuses reports that
are not backed by a reproduction or a measurement.

---

## The prompt

You are the QA lead for the commercial release of **FAB Rugby**, a rugby union
management game. The bar is Football Manager, Motorsport Manager and Out of the
Park at their best: a premium, paid product that a stranger will judge in ten
minutes and a devotee will play for two hundred hours. Assume it ships next
week and your name is on it.

Be adversarial. Your job is not to confirm the game works - the suite already
claims that. Your job is to find what the suite cannot see, prove it, fix it,
and prove the fix.

### Ground rules you must not break

These are how this codebase stays trustworthy. Violating one is a worse outcome
than finding nothing.

1. **Every fix ships with a probe that fails on the old code.** Build a git
   worktree at HEAD, copy the new probe in, and show it failing before you claim
   the fix works. A fix without a failing-before demonstration is a guess.
2. **Every new balance dial is mean-neutral by measurement, never by argument.**
   Measure the world mean, add the correction constant, hold it with a probe.
   "It should roughly cancel out" is not a measurement.
3. **No em dashes in any game-facing text.** `scripts/textlint.ts` enforces it.
4. **Determinism is a feature.** New systems derive from `mulberry32` over a
   seed/id hash, never from the shared match rng. Match-stream draw counts must
   not change. If `scripts/fingerprint.ts` moves, that is either a deliberate
   mechanical change - rebaseline via the sentinel and re-check the distribution
   bands on four seeds - or a leak you have just found.
5. **Never rebuild `dist` or edit `src`/`scripts` while a suite is running.**
   The gate becomes meaningless and you will not know which state failed.
6. **Report faithfully.** If a band drifts, say so with the number. If you
   skipped something, say what and why. A clean report that hides a drift is
   the one unforgivable outcome.

### The passes

Work through all nine. Each has an exit criterion; do not move on until you can
state it as met, or state precisely why it cannot be.

**Pass 1 - Is it actually hard?**
The single question a manager game lives or dies on. Play, or drive headlessly,
several full seasons at the user's club and at a weak club. Then answer with
numbers, not impressions: what is the win rate of a manager who does nothing but
press Continue? What is it for one who uses every system well? If those two are
close, the systems are decoration. Hunt dominant strategies - a tactic preset, a
transfer loop, a training setting that is simply correct every week. Check the
board can actually sack you, that objectives are losable, and that a bad squad
feels bad to manage rather than merely slower.
*Exit: a measured difficulty curve across at least three seasons and two club
tiers, and either no dominant strategy or a fix with a probe.*

**Pass 2 - The match engine under a microscope.**
Score distributions, try counts, home advantage, draw rate, blowout share, card
and injury rates, set-piece and territory balance - against the stated health
bands. Then the qualitative half: do the tactical dials each earn their place,
or do two of the six decide everything? Does a better team win about as often as
it should? Are upsets possible without being random noise?
*Exit: every band inside tolerance on four seeds, and each dial shown to move
the result in the direction its label promises.*

**Pass 3 - The economy over a career.**
Twenty seasons. Wage inflation, transfer fee medians by era, club solvency,
board funding, the salary cap's bite, and whether a good manager becomes
unstoppably rich. Check the AI clubs run real books and can outbid you.
*Exit: no unbounded growth in any ledger, fees stable by era, and the user's
club solvent by playing well rather than by exploiting anything.*

**Pass 4 - Every screen, at the real dimensions.**
The game is played in **portrait on a phone, in night mode**. Audit at 412x915
and at least two other geometries. For every screen: nothing clipped, nothing
overlapping, no horizontal scroll, no text wrapping that tears a row open, tap
targets at least 44px, safe areas respected, contrast legible in the dark, and
no dead controls - a button that does nothing reads as a frozen game, not as a
gate. Open every screen the game can reach, including the ones that only exist
mid-match or between seasons.
*Exit: a named list of every screen visited, with the geometries, and zero
unexplained layout defects.*

**Pass 5 - The long game.**
Twenty-season soak plus a deep save. Save size and its growth curve, week-advance
time fresh versus late, news volume per week, integrity of every ledger, and
whether the world still makes sense in season twenty - do clubs still have
plausible squads, are records still being broken, has any league drifted?
*Exit: performance flat within 2x from season one, no ledger unbounded, world
coherent at season twenty.*

**Pass 6 - Hostile input and old saves.**
Feed every public function NaN, Infinity, negatives and garbage. Load saves
written before each recent feature existed. Corrupt the fields a save is most
likely to lose. The bar is not "it refuses" - a refusal is fine, a shrug is
fine. A throw, a NaN that reaches a price or a score, or a world that stops
adding up is not.
*Exit: no throw, no non-finite value reaching any displayed or multiplied
figure, and a pre-feature save that migrates, plays and settles.*

**Pass 7 - The words.**
Every string a player reads. Typos, tone, repetition across a long career, names
rendered correctly, no placeholder text, no developer voice leaking through, and
no em dashes. Check the handbook still describes the game as built - a handbook
that describes last month's rules is worse than none.
*Exit: prose sweep clean over twenty seasons, and every handbook entry verified
against the code that implements it.*

**Pass 8 - The first ten minutes.**
Start a new career as a stranger would. Is it obvious what to do? Does the
tutorial explain the right things at the right time? Can you reach a kick-off
without reading anything? Is the first match comprehensible? This is the pass
that decides a refund.
*Exit: a walkthrough of the new-player path with every point of confusion named,
and the blocking ones fixed.*

**Pass 9 - The things I have not thought of.**
Ask what a hostile reviewer would open first, and open that. Then ask what part
of this game has never been looked at by anyone, and look at it.
*Exit: at least one finding that none of passes 1-8 would have produced.*

### Severity, and what you do about it

- **Blocker** - crashes, data loss, a stuck game, anything that makes the game
  unsellable. Fix immediately, probe it, deploy.
- **Major** - a system that does not do what it claims, a balance hole, a screen
  that is broken at the real dimensions. Fix in this audit.
- **Minor** - polish, wording, small layout. Fix if cheap; list if not.
- **Deferred** - anything you judge out of scope. You must say why, and it must
  be a reason, not a shrug.

Do not report cosmetic observations as findings. If you cannot reproduce it or
measure it, it is not a finding yet.

### What done looks like

Not a document. A deployed build, plus:

1. Every Blocker and Major fixed, each with a probe demonstrated to fail on the
   old code and now folded into `scripts/suite.sh`.
2. The full suite green, including the long tier the default run skips
   (`soakhealth soakui stresstest deepsave e2edeep`) - the tier that has
   historically hidden the real bugs.
3. A short, honest report: what was found, what was fixed, what moved that you
   did not intend to move, and what you are deliberately leaving. Lead with the
   worst thing you found, not the most impressive thing you did.

Begin with Pass 4 and Pass 8 - dimensions and the first ten minutes - because
they are what a stranger sees first, and defects there are the ones that get
refunds. Then work the rest in order.
