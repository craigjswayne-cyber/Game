# The working list

Things worth building that are not being built yet. Distinct from
`docs/roadmap.md`, which argues for whole directions: this is the running
list, added to whenever an audit or a bug hunt turns up a system the game
does not have, so the finding does not evaporate into a conversation.

Each entry says what is missing, what it would cost, what it would unlock,
and what it would disturb. Nothing here is a commitment. Nothing here is a
gap in a shipped feature either - the game works without every one of them.

Started 11 Sep 2026, from the women's game audit brief.

---

## 1. Biometrics, and a physical attribute model

**Missing today.** There is no height, no weight and no mass anywhere in
`model.ts`. Ability is carried as `ca` and `pa` - current and potential -
alongside condition, form and goalkicking. A tighthead and a winger differ
by position and ability and by nothing else the code can read.

**What it would take.** Height and weight on the player, generated per
position from a real distribution, ageing with the player and moving with
training. Then the derived pair the match engine would actually use: power
and pace. Two to three weeks, most of it in the generators and the data
files rather than the engine.

**What it would unlock.** A scrum that knows which pack is heavier. A
winger who is quick rather than merely good. Scouting reports that describe
a player rather than score him. Positional conversion that has a reason to
refuse - a 68kg scrum-half does not become a prop. And the thing that
prompted this: a women's game whose physical profile is its own rather than
the men's numbers with different names on them.

**What it would disturb.** Every existing save has no biometrics, so they
would have to be generated on load from position and ability. The match
engine's balance was tuned without them and would need re-tuning against
`bandcheck` and `aiecon`. Roughly a thousand players in the data files
would need heights and weights, and inventing those for real named people
is a sensitivity question, not just a data one.

---

## 2. A spatial match engine

**Missing today.** The engine is probabilistic, not spatial. There are no
pitch dimensions, no metres, no ball position. Commentary names distances
("from halfway", "five metres out") as flavour drawn from the event type,
not from a coordinate. Kicking is a goalkicking attribute against a
difficulty roll rather than a distance in metres.

**What it would take.** A very large change, and the honest answer is that
it is a different engine rather than an addition to this one. The roadmap's
section 1a proposes the middle path: keep the probabilistic engine and give
the *view* a phase model, so a scrum looks like a scrum without the engine
having to simulate one.

**What it would unlock.** Territory as a real quantity. Kicking to the
corner as a decision with a distance behind it. Defensive line speed.

**What it would disturb.** Essentially all of the balance work, and every
probe that asserts against current match outcomes. Not a fortnight's job.

---

## 3. Ball specification

**Missing today.** No ball size anywhere. Women's international rugby uses a
size 5 ball, the same as the men's game, so the audit item this came from
has no in-game consequence even once biometrics exist - but it is recorded
here so the question is not asked twice.

**Verdict.** Nothing to build. Closed.

---

## 4. Dual-status and central contracts

**Partly missing.** Contracts carry a wage and a length. The women's game in
reality runs on a mix: club deals, union central contracts, and players who
are semi-professional and hold a job outside the game.

**What it would take.** A contract type on the deal, and a availability rule
that reads it. Central contracts would let the union, not the club, decide
where a player turns out - which is the mechanism behind the international
clash the owner hit in 1.5.8. A week, maybe two.

**What it would unlock.** The women's game having an economy shaped like its
own rather than a scaled-down men's one, and a real reason why your best
player is not yours to pick every week.

---

## 5. Maternity and long-term absence

**Missing today.** Injury is the only long absence the game models.

**What it would take.** A leave type with its own length, its own return
curve and its own squad-registration consequence, plus the writing to handle
it with no hint of novelty or comment. Handled badly this is worse than not
having it at all, so it needs the care the sensitivity audit gave the player
names.

**Open question for the owner before any of it is written.** Whether the game
should model this at all is his call, not mine.

---

## 6. A women's World Championship

**Missing today.** The men's world builds a World Championship every fourth
season (`schedule.ts` `buildWorldCup`, gated by `isWorldCupSeason`) and crowns
it five times in a twenty-season career. The women's world has none, and
`dream.ts` `WORLD_COMPS` is explicit about it: `w: ['cc']`, so the dreams that
name a World Cup are never offered in this world rather than being offered and
left unwinnable.

Found by the 20-season women's soak (`scripts/wsoak.ts`, 11 Sep 2026). It is
handled correctly, which is exactly why it is here rather than in a bug list.

**What it would take.** A pool draw and a knockout bracket - both already
exist and are shared with the Continental Cup - plus the harder half, which is
the calendar. The women's year already carries six Test windows after 1.5.8:
the Hemispheric Championship pools and knockouts, the Autumn Tests, the
Northern Championship, the Pacific Four and the Summer Tests. A quadrennial
tournament has to take the place of some of them in its year rather than sit
on top, the way the men's `buildInternationals(rng, state, worldCup)` drops
the summer tours in a World Cup season. One to two weeks, most of it in
`schedule.ts` and in re-running `wsoak` and `genderprobe` against the result.

**What it would unlock.** The single biggest prize in the women's game, which
the sport has and this one does not - England hosted and New Zealand won the
2025 tournament. Three career dreams that the women's world currently cannot
be offered. And a reason for the national job to be the summit of a career in
both worlds rather than only one.

**What it would disturb.** The women's Test calendar, which was only just
untangled in 1.5.8 - the Hemispheric knockouts had been sitting inside the
Northern Championship window. Any World Cup year has to be re-checked against
`activeWindows` and against the club season, or the same clash comes back
wearing a bigger hat. Existing saves would gain a competition mid-career,
which the Continental Cup already proved is survivable but needs the same care
at rollover.

## 7. Update the AdMob plugin (both shells)

**Missing today.** Nothing a player can see. `@capacitor-community/admob` is
pinned at 8.1.0 in `packaging/ios/package.json` and
`packaging/android/package.json`. The 1.9.12 iOS archive (13 Nov 2026) built
and uploaded with 29 yellow warnings in Xcode, none in the game's own code.
Four of them are deprecations inside the plugin, which mean Google intends to
remove those calls from a later adverts SDK:

- `kGADAdSizeSmartBannerPortrait` and
  `currentOrientationAnchoredAdaptiveBanner(width:)` (BannerExecutor)
- `tagForChildDirectedTreatment` and `tagForUnderAgeOfConsent` (AdMobPlugin),
  replaced by an age-restricted-treatment property

The other 25 are style notes in Capacitor and Cordova headers ("double-quoted
include in framework header") and one unused value in Capacitor's file
plugin. They are not ours to fix and are left alone.

**What it would take.** Move the plugin to a release that no longer uses the
four calls, in both shells. Half a day to a day, most of it re-testing.

**What it would unlock.** Nothing new. It keeps adverts working when a future
Google Mobile Ads SDK drops the old calls, and it clears the four warnings.

**What it would disturb.** `packaging/ios/scaffold.sh` patches the plugin's
`AdMobPlugin.swift` to wire it at `load()` and stops with "the plugin no
longer looks like 8.1.0" if the file has changed, so that patch has to be
re-checked or retired. The Android scaffold pins the adverts SDK
(`ADS_SDK=25.4.0`) for the consent and 16 KB page-size reasons written
beside it. Banners, rewarded adverts, the consent form and Pro Manager's
no-adverts path all need trying on a real Android phone and a real iPhone
afterwards. Not a change to make in the middle of a release.
