// Kick-off: beginMatch builds the live context. Split out of matchEngine.ts,
// which re-exports the public parts.
import type { Fixture, GameState } from '../model'
import { subjectVar } from '../gender'
import { prepLeaked } from '../talkingpoints'
import { CHEM_SLOTS, careerRows, chemKey, demandCeiling, formGuide, grudgeBetween, oldBoyApps, unbeatenRun } from '../model'
import { analystShift, respectLayers } from '../oppcoach'
import { derbyName, isDerby } from '../rivalries'
import { analystEdge, settleAnalyst } from '../analyst'
import { venueEffect } from '../venue'
import { clamp, gauss, mulberry32, type Rng } from '../rng'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, playbookOf } from '../playbook'
import { calledIds, callsOf } from '../moves'
import { adaptMap, tallyCalls } from '../armsrace'
import { rematchOf, withRematch, type Rematch } from '../rematch'
import { ART_HOME, clubSurface, goalPenaltyOf, hotDay, matchConditions, surfaceOf, type Surface } from '../conditions'
import { teamShort } from './selection'
import { frontRowCover, homeCrowdLean, refFor } from './referee'
import { dealTheDay } from './day'
import { lateWithdrawal } from './incidents'
import { noteSpecialists, recomputeSideUnits } from './field'
import { type SideCtx, type SideMods, layer, refPenPrice } from './side'
import { mkSide, weatherUnits } from './setup'
import { type LiveCtx, pushLine, userDials } from './live'

export function beginMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean, userTeamId: string | null = state.userClubId): LiveCtx {
  const derby = isDerby(fx.homeId, fx.awayId)
  // a big day: a knockout tie or a derby - the matches with an atmosphere
  // that gets inside players' heads (25D-2)
  const big = !!fx.stage || derby
  const home = mkSide(state, fx.homeId, userTeamId, fx.id, big)
  const away = mkSide(state, fx.awayId, userTeamId, fx.id, big)
  // THE CONDITIONS (conditions.ts) are the fixture's, by a hash of where and
  // when it is played. The draw the old weather roll took is still taken, and
  // thrown away, so every dice after it in the match is where it always was.
  // A fixture that already carries its day keeps it (a probe that asks for a
  // wet day sets one; the game itself never sets it before kick-off).
  rng()
  const weather = fx.weather ?? matchConditions(state, fx)
  const surface: Surface = surfaceOf(state, fx)
  fx.weather = weather
  fx.derby = derby
  let goalPenalty = 0
  const ref = refFor(fx.id)
  for (const side of [home, away]) {
    weatherUnits(state, side, weather)
    if (derby) side.cardRisk *= 1.35
    // ---- SOMEBODY TOLD THEM HOW YOU PLAY ----
    // A rival coach briefed a journalist about your side this week
    // (talkingpoints.ts), so the team you meet has read it. The edge is small
    // and it is real: they defend your shape a little better and your attack
    // has to work harder for the same ball. It only ever costs the USER, which
    // is the point - it is a story about your week, not a coin flip.
    if (prepLeaked(state) && side.teamId === state.userClubId) {
      layer(side, 'attack', 0.95)
      layer(side, 'breakdown', 0.97)
    }
    // The whistle sets the tone, and now it sets four of them. Each dial acts on
    // the unit it is an opinion about, so a scrum pedant makes your front row
    // matter and a permissive ref makes your jackals matter.
    //
    // LAYERED, NOT WRITTEN STRAIGHT ONTO THE UNITS (audit 16D). A substitution
    // rebuilds the units from scratch and re-applies only side.mods, so a direct
    // write here survived exactly until the user's first sub or slider touch -
    // while every AI side, which never recomputes, kept its referee all match.
    layer(side, 'card', ref.cards)
    layer(side, 'attack', ref.flow)
    layer(side, 'scrum', ref.scrum)
    layer(side, 'breakdown', ref.breakdown)
    // "fussy at the tackle - hands off, or it is a penalty": the briefing has
    // claimed this since the panel shipped, and the penalty rate never read
    // the referee at all. A fussy whistle (breakdown 0.90) now blows a tenth
    // more penalties; a lenient one (1.10) a tenth fewer (audit 16D)
    side.refPenF = 2 - ref.breakdown
    // SWAPPED IN AS A RATIO, NOT ASSIGNED. The first version of this wrote
    // `side.penRisk = aggPenRisk(...)` outright, which was wrong in a way only
    // splitprobe caught: by the time we get here the dial block has already
    // multiplied in the defensive line's own penalty cost, and an assignment
    // threw it away. A full blitz stopped paying its 12% and the without-ball
    // system silently went half free.
    //
    // So: divide out the referee-blind aggression price the dial block used and
    // multiply in the referee-aware one. Everything else layered onto penRisk
    // survives untouched, and a later recompute - where the dial block can see
    // refPenF and computes the right price first time - lands on the same
    // number, which is the property that matters.
    side.penRisk *= refPenPrice(side, side.refPenF) / refPenPrice(side, 1)
  }
  // FAVOURITE PRESSURE (25D-2). On the big day the stronger side carries the
  // weight of expectation and the underdog plays with nothing to lose: the
  // gap closes a touch, scaled to how wide it was (up to 3% each way). Applied
  // as layered ratios so a substitution cannot silently restore the full gap,
  // and zero-sum by construction - one side gives exactly what the other gets.
  if (big) {
    const fav = home.units.overall >= away.units.overall ? home : away
    const dog = fav === home ? away : home
    const gapR = (fav.units.overall - dog.units.overall) / Math.max(1, dog.units.overall)
    // A CUP TIE IS ITS OWN KIND OF DAY (1.8.14): one game, no table to fall
    // back on, so in a cup knockout the squeeze is wider (up to 4.5%) than
    // in a league play-off or a derby
    const cupKO = !!fx.stage && state.comps[fx.compId]?.type === 'cup'
    const squeeze = Math.min(cupKO ? 0.045 : 0.03, gapR * (cupKO ? 0.5 : 0.35))
    if (squeeze > 0.001) {
      layer(fav, 'attack', 1 - squeeze)
      layer(fav, 'defence', 1 - squeeze)
      layer(dog, 'attack', 1 + squeeze)
      layer(dog, 'defence', 1 + squeeze)
    }
  }
  // Law 3: if either side cannot cover the front row, nobody contests the scrum.
  // Both sides lose the weapon, so the side with the better pack pays for the
  // other's shortage - which is the real law and the real argument about it.
  const homeFR = frontRowCover(state, home.lineup)
  const awayFR = frontRowCover(state, away.lineup)
  const uncontested = !homeFR.legal || !awayFR.legal
  if (uncontested) {
    // Uncontested means neither side can WIN the scrum, not that the scrum stops
    // existing. Both get the average of the two, so the differential vanishes and
    // the absolute level stays sane.
    //
    // The first cut set both to 1, on the assumption these were multipliers around
    // 1.0. They are not: unit strengths run at 15-20. So instead of neutralising
    // the set piece it deleted it, and because attack weighs scrum while defence
    // does not, world scoring fell from 52.4 to 48.8 points a game on the 7% of
    // matches where a front-row shortage bites. Check the scale before you clamp.
    // Applied as a layered ratio so a substitution does not silently restore a
    // contested scrum (audit 16D): the factors lock the levelling in at kick-off
    // and survive every recompute.
    const level = (home.units.scrum + away.units.scrum) / 2
    const homeF = level / Math.max(1, home.units.scrum)
    const awayF = level / Math.max(1, away.units.scrum)
    layer(home, 'scrum', homeF)
    layer(away, 'scrum', awayF)
  }
  // THE ARMS RACE (1.8.2, armsrace.ts): how far this opponent is set for each
  // of the manager's calls, off the tape as it stood BEFORE this match, and
  // then this match's reps and first-phase strikes on the tape
  //
  // THE REMATCH (1.8.4, rematch.ts): and what this coach remembers of the
  // last meeting, read off the same tape, a little more on the call that
  // beat him or a little more in the unit that did
  let callAdapt: Record<string, number> | undefined
  let rematch: Rematch | null = null
  if (fx.homeId === state.userClubId || fx.awayId === state.userClubId) {
    const oppId = fx.homeId === state.userClubId ? fx.awayId : fx.homeId
    rematch = rematchOf(state, oppId)
    callAdapt = withRematch(adaptMap(state, oppId), rematch)
    tallyCalls(state, fx)
  }
  // The analysts were watching. Calling the same move every week is how it stops
  // working, so the tally is kept here, once per match, for both clubs. The
  // manager's own is kept by tallyCalls above (1.8.3: it fades in-season and
  // a strike wears by its share of the ball, armsrace.ts THE WEAR).
  for (const id of [fx.homeId, fx.awayId]) {
    const c = state.clubs[id]
    if (!c || id === state.userClubId) continue
    const pb = playbookOf(c)
    for (const call of [c.tactic.lineoutCall ?? DEFAULT_LINEOUT, c.tactic.scrumCall ?? DEFAULT_SCRUM]) {
      pb.used[call] = (pb.used[call] ?? 0) + 1
    }
    // and the attacking moves, on the same tape (moves.ts)
    for (const call of calledIds(callsOf(state, c))) pb.used[call] = (pb.used[call] ?? 0) + 1
  }
  // the analyst's read: if the manager prepared for the weakness he named and
  // the read was sound, the soft spot gives a little more on the day. This is
  // THEIR half of the edge; ours is the homework in applyModifiers, on the
  // unit that goes after it (EXPLOITED_BY). If he called it wrong, the week
  // was spent on a problem the opposition do not have.
  if (userTeamId === state.userClubId && (fx.homeId === state.userClubId || fx.awayId === state.userClubId)) {
    const oppId = fx.homeId === state.userClubId ? fx.awayId : fx.homeId
    const edge = analystEdge(state, oppId)
    if (edge) {
      if (edge.right) {
        const theirs = fx.homeId === state.userClubId ? away : home
        layer(theirs, edge.unit, 0.955)
      }
      settleAnalyst(state, oppId)
    }
  }

  // dynamic bad blood: derby-lite heat when there's history between the clubs
  const grudge = !derby ? grudgeBetween(state, fx.homeId, fx.awayId) : null
  if (grudge) { layer(home, 'card', 1.25); layer(away, 'card', 1.25) }
  // old boys: a man facing his former club plays the game of his life
  // (club matches only - career rows never reference national sides). Since
  // 1.9.6 nothing says so: the card, the commentary line and the stories went
  // (owner: "remove the old boys feature"), and only this lift stays, so the
  // match stream is the one it was.
  if (state.clubs[fx.homeId] && state.clubs[fx.awayId]) {
    for (const side of [home, away]) {
      const oppId = side === home ? fx.awayId : fx.homeId
      for (const id of side.lineup) {
        const p = id != null ? state.players[id] : null
        if (!p || side.exIds.has(p.id)) continue
        const oldApps = oldBoyApps(p, oppId)
        if (!oldApps) continue
        side.exIds.add(p.id)
        if (side.onPitch.has(p.id)) side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) + 0.2)
      }
    }
  }
  // big-game players find another gear when it really matters
  if (fx.stage || derby) {
    for (const side of [home, away]) {
      let n = 0
      for (const id of side.lineup.slice(0, 15)) {
        const p = id != null ? state.players[id] : null
        if (p?.trait === 'Big-Game Player') { n++; side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) + 0.3) }
      }
      layer(side, 'attack', 1 + Math.min(n, 3) * 0.008)
    }
  }
  // THE SCALP (16C, user: "the pressure should be building on the squad...
  // spotlight should be on us and only a good manager should stay unbeaten").
  // A side 8+ competitive games unbeaten this season is everyone's cup final:
  // the chaser lifts, flat, and the holder tightens under the weight - but the
  // nerves tax is discounted by what the manager built. An experienced XV with
  // a good room plays through the noise almost untouched; a young side with a
  // wobbling one feels all of it. Applies to ANY club on a run, both ways in
  // the same match, so it is a law of the world rather than a tax on the user.
  // Deterministic from state like every pre-match dial - no rng is drawn.
  if (state.clubs[fx.homeId] && state.clubs[fx.awayId] && fx.compId !== 'fr') {
    for (const [id, holder, chaser] of [[fx.homeId, home, away], [fx.awayId, away, home]] as [string, SideCtx, SideCtx][]) {
      const run = unbeatenRun(state, id)
      if (run < 8) continue
      const heat = Math.min(run - 7, 9) // grows to a cap at 16 unbeaten
      layer(chaser, 'attack', 1 + heat * 0.004)
      let age = 0, morale = 0, n = 0
      for (const pid of holder.lineup.slice(0, 15)) {
        const p = pid != null ? state.players[pid] : null
        if (!p) continue
        age += p.age; morale += p.morale; n++
      }
      const calm = n
        ? Math.max(0, Math.min(1, ((age / n - 25) / 6) * 0.5 + ((morale / n - 5) / 4) * 0.5))
        : 0.5
      layer(holder, 'attack', 1 - heat * 0.004 * (1 - calm))
    }
  }

  // THE WIDTH MATCHUP (18D). Defensive width is read against the opponent's
  // attacking shape at kick-off: a spread line blunts an expansive attack, a
  // narrow one blunts a forward assault, and the WRONG call pays the other
  // way in equal measure - rock, paper, scissors rather than a free dial.
  // Through layer() so it survives recomputes; 50 (or a save without the
  // dial) multiplies by exactly 1.0 and the fingerprint holds.
  {
    const fT = (v: number | undefined) =>
      (Number.isFinite(v as number) ? Math.max(0, Math.min(100, v as number)) - 50 : 0) / 50
    for (const [mine, theirs] of [[home, away], [away, home]] as const) {
      const myT = state.clubs[mine.teamId]?.tactic
      const oppT = state.clubs[theirs.teamId]?.tactic
      if (!myT || !oppT) continue
      const w = 1 + 0.05 * fT(myT.defWidth) * fT(oppT.style)
      if (w !== 1) layer(mine, 'defence', w)
    }
  }

  // KICKING STYLE (1.7.3, owner: "kick strategy", four styles). What kind of
  // kick, read against the day and the opponent at kick-off, scaled by how
  // much the side kicks at all (the kicking dial: a side that barely kicks
  // barely cares what kind). Every style trades something; 'balanced', or no
  // style at all, multiplies by exactly 1 and the fingerprint holds.
  //   TERRITORY  touch-finders: more ground from every kick; pays when your
  //              lineout is the better one (the ball comes back to you in
  //              their half), costs a little when it is theirs
  //   CONTEST    up-and-unders to win it back: the chase is a breakdown
  //              battle, and in the wet a spilled high ball is the best
  //              attacking platform in the game; in the dry it is a gift of
  //              possession more often than not
  //   ATTACK     grubbers and cross-kicks: behind a rushing line they are the
  //              way through, against a patient one less so, and a wet ball
  //              does not bounce where you want it; territory is given up
  for (const [mine, theirs] of [[home, away], [away, home]] as const) {
    const myT = state.clubs[mine.teamId]?.tactic
    const oppT = state.clubs[theirs.teamId]?.tactic
    const ks = myT?.kickStyle
    if (!myT || !ks || ks === 'balanced') continue
    const kick = Number.isFinite(myT.kicking) ? Math.max(0, Math.min(100, myT.kicking)) : 50
    const k = 0.4 + 0.6 * kick / 100
    const wet = weather === 'Rain' || weather === 'Snow'
    const oppLine = Number.isFinite(oppT?.defLine as number) ? ((oppT!.defLine as number) - 50) / 50 : 0
    if (ks === 'territory') {
      layer(mine, 'kicking', 1 + 0.06 * k)
      const setEdge = mine.units.lineout >= theirs.units.lineout
      layer(mine, 'attack', setEdge ? 1 + 0.025 * k : 1 - 0.015 * k)
    } else if (ks === 'contest') {
      layer(mine, 'breakdown', 1 + 0.03 * k)
      layer(mine, 'attack', 1 + (wet ? 0.05 : -0.01) * k)
      layer(mine, 'kicking', 1 - 0.02 * k)
    } else if (ks === 'attack') {
      layer(mine, 'attack', 1 + (0.02 + 0.03 * Math.max(0, oppLine)) * k - (wet ? 0.045 * k : 0))
      layer(mine, 'kicking', 1 - 0.05 * k)
    }
  }

  goalPenalty = goalPenaltyOf(weather)

  // Attendance breathes with success: winning sides pack the ground,
  // struggling ones see gaps - and no two gates are ever identical.
  const hostClub = state.clubs[fx.homeId]
  if (hostClub) {
    // formGuide sorts by week; a raw slice of the fixtures array reads appended
    // cup rounds out of calendar order (the Home pips bug). No rng is drawn
    // here, so the stream and the fingerprint are untouched.
    const recent = formGuide(state, hostClub.id, 4)
    let formPts = 0
    for (const r of recent) formPts += r === 'W' ? 1 : r === 'D' ? 0.5 : 0
    const formF = recent.length ? (formPts / recent.length - 0.5) * 0.16 : 0 // hot streak ±8%
    const confF = (hostClub.boardConfidence - 55) / 800                       // mood around the club
    const fanF = hostClub.id === state.userClubId ? ((state.fanMood ?? 60) - 60) / 900 : 0
    let interest = clamp(
      0.44 + hostClub.rep / 250 + (state.clubs[fx.awayId]?.rep ?? 60) / 430 + formF + confF + fanF + gauss(rng) * 0.05,
      0.24, 0.96)
    if (derby) interest = clamp(interest + 0.16, 0.5, 0.99)
    if (fx.stage) interest = clamp(interest + 0.08, 0.5, 0.99) // knockout fever
    // Nobody fills a ground for a pre-season friendly. The audit found 24,330
    // of 25,849 at Welford Road for one, paying £730k at the gate - a bigger
    // payday than most league Saturdays, for a game that does not count.
    if (fx.compId === 'fr') interest *= 0.38
    // a live count, never a round sell-out figure twice
    const jitter = Math.floor(rng() * Math.max(60, hostClub.capacity * 0.012))
    // seats you can actually shift: the smaller of the ground and the catchment
    let sellable = Math.min(hostClub.capacity, demandCeiling(hostClub))
    // a showpiece final at a neutral ground: two travelling supports plus the
    // neutrals fill a stadium no catchment model applies to. The gauss above
    // is still drawn and folded in, so the rng stream is identical - a final
    // just reads it as the difference between 88% and 99% of Twickenham.
    if (fx.venue) {
      sellable = fx.venue.capacity
      interest = clamp(0.93 + (interest - 0.6) * 0.15, 0.88, 0.99)
    }
    fx.att = Math.max(400, Math.round(sellable * interest) - jitter)
    // a testimonial packs the ground whatever the fixture list says
    if (fx.testimonial != null) fx.att = Math.max(fx.att, sellable - jitter)
  }
  // THE HOME CROWD, now that it has been counted (homeCrowdLean). Folded into
  // refPenF, which every later recompute reads, and swapped into penRisk as a
  // ratio for the same reason the referee's own price is (see above).
  const crowdLean = homeCrowdLean(state, fx)
  if (crowdLean > 0) {
    for (const side of [home, away]) {
      const rp = side.refPenF ?? 1
      const f = side === home ? 1 - crowdLean : 1 + crowdLean
      side.penRisk *= refPenPrice(side, rp * f) / refPenPrice(side, rp)
      side.refPenF = rp * f
    }
  }

  // every match started together deepens a partnership (counted at kick-off,
  // after this match's units were computed from the old familiarity)
  state.chem ??= {}
  const chemToday = new Set<string>()
  for (const side of [home, away]) {
    for (const [i, j] of CHEM_SLOTS) {
      const a = side.lineup[i], b = side.lineup[j]
      if (a != null && b != null) {
        const k = chemKey(a, b)
        state.chem[k] = (state.chem[k] ?? 0) + 1
        chemToday.add(k)
      }
    }
  }

  // the terraces are worth points: a bouncing home crowd lifts the side,
  // a mutinous one flattens it (user's club only - the AI crowds average out)
  let hfa = state.clubs[fx.homeId] ? 1.06 : 1.03
  // F27: and the trip the other lot made. A flat 1.06 said a bus up the M1 and a
  // flight to the highveld cost a visiting side the same thing, which is nonsense
  // in a world where Belfast and Pretoria are in the same competition. The edge is
  // a REDISTRIBUTION with a mean of exactly 1 (scripts/venueprobe.ts holds it
  // there), so the hard trips take from the easy ones rather than from the away
  // side everywhere: a local derby is now marginally less of a fortress than it
  // was, which is the half of the trade that keeps the books balanced.
  const venue = venueEffect(state, fx.homeId, fx.awayId, fx.week)
  hfa *= venue.edge
  if (fx.homeId === state.userClubId) hfa += ((state.fanMood ?? 60) - 60) * 0.0006
  // a final at a neutral ground has no host: the side listed as home is only
  // the winner of the first semi-final, and Twickenham does not sing for him.
  // Exactly 1.0 - a deterministic gate, no rng consulted, so only finals move.
  if (fx.venue) hfa = 1
  // THE PLASTIC PITCH (1.8.2 depth, conditions.ts). A side that plays every
  // home match on an artificial surface knows its pace and its bounce, and a
  // visitor raised on grass does not: a small edge to the home side there,
  // about what the clubs that play on one have measured for themselves.
  // Nothing on grass or hybrid, nothing between two artificial grounds.
  else if (surface === 'artificial' && state.clubs[fx.awayId] && clubSurface(state.clubs[fx.awayId]) !== 'artificial') hfa *= ART_HOME

  const ctx: LiveCtx = {
    fx, home, away, rng, detail, weather, surface, derby, goalPenalty,
    crng: mulberry32(((Math.imul(fx.id | 0, 2654435761) ^ Math.imul(state.season | 0, 40503) ^ 0x5eed) >>> 0) || 1),
    hfa,
    events: [], lastMin: 0,
    isUser: fx.homeId === userTeamId || fx.awayId === userTeamId,
    userSideId: fx.homeId === userTeamId ? fx.homeId : fx.awayId === userTeamId ? fx.awayId : null,
    tick: 0, seg: 0, awaiting: null, field: 50, motmId: null, talkUsed: false, subsUsed: 0,
    preTalk: null, decision: null, momo: 0, grudge: grudge?.reason ?? null,
    callAdapt,
    ...(rematch ? { rematch } : {}),
  }
  ctx.kickSeed = Math.floor(rng() * 4294967296) >>> 0
  ctx.chemToday = chemToday
  // THE DAY (1.8.16): how each side's units are going, and a warm-up
  // withdrawal now and then, both off the incident dice (no draw on rng);
  // and whether it is a hot afternoon, off the fixture
  dealTheDay(ctx, uncontested)
  lateWithdrawal(state, ctx, home)
  lateWithdrawal(state, ctx, away)
  ctx.hot = hotDay(state, fx, weather)
  ctx.koDials = userDials(state, ctx)

  // THE ANALYST'S HOMEWORK (pillar 2): an analyst-archetype dugout facing the
  // user starts with its plan pulled toward the counter to the user's habit.
  // Layered like the referee - a substitution cannot wash it off - and drawn
  // from no rng: an empty tendency window means nothing happens, which is
  // every calibrated harness and every fresh world.
  for (const side of [home, away]) {
    if (side.isUser || !ctx.isUser) continue
    // A BIG NAME IS RESPECTED (E9, oppcoach.setUpForUser): a coach who has
    // set up to spoil the manager's game also works harder at it, a little
    // more effort in defence and at the breakdown, for this match only
    const rl = respectLayers(state, side.teamId)
    if (rl) for (const [u, m] of Object.entries(rl)) layer(side, u as keyof SideMods, m)
    // THE REMATCH (1.8.4): the unit that lost him the last meeting, a little
    // lifted; a remembered call is in callAdapt above. Said at kick-off, as
    // the report and the desk said it before
    const rm = ctx.rematch
    if (rm) {
      if (rm.unit && rm.layer !== 1) layer(side, rm.unit, rm.layer)
      pushLine(state, ctx, 0, 'SUB', side, 'comm.oppRematch', { team: teamShort(state, side.teamId) })
    }
    const shift = analystShift(state, side.teamId)
    if (!shift) continue
    for (const [u, m] of Object.entries(shift.layers)) layer(side, u as keyof SideMods, m)
    pushLine(state, ctx, 0, 'SUB', side, state.clubs[side.teamId]?.coach ? 'comm.oppCoachNamed' : 'comm.oppCoach', {
      ...subjectVar(state.clubs[side.teamId]?.coachGender), coach: state.clubs[side.teamId]?.coach ?? '',
      team: teamShort(state, side.teamId),
      pattern_k: `comm.pattern${shift.pattern[0].toUpperCase()}${shift.pattern.slice(1)}`,
    })
  }
  // THE STYLES ON THE KICK-OFF LINE (1.8.2): hA/hD the home side's attack
  // and defence, aA/aD the away side's, so anything that has only the events
  // (the highlight clip, styles.matchStyles) knows how both sides played
  const koSty: Record<string, string> = {}
  if (home.sty) { koSty.hA = home.sty.atk; koSty.hD = home.sty.def }
  if (away.sty) { koSty.aA = away.sty.atk; koSty.aD = away.sty.def }
  if (fx.venue) {
    pushLine(state, ctx, 0, 'KO', home, fx.att ? 'comm.koFinalDayGate' : 'comm.koFinalDay',
      { venue: fx.venue.name, city: fx.venue.city, att: fx.att ?? 0, ...koSty })
  } else if (derby) {
    pushLine(state, ctx, 0, 'KO', home, fx.att ? 'comm.koDerbyGate' : 'comm.koDerby',
      { derby: derbyName(fx.homeId, fx.awayId) ?? '', att: fx.att ?? 0, ...koSty })
  } else if (grudge) {
    pushLine(state, ctx, 0, 'KO', home, 'comm.koGrudge', { reason_k: grudge.rk ?? 'common.nothing', ...(grudge.rv ?? {}), ...koSty })
  } else {
    pushLine(state, ctx, 0, 'KO', home, 'comm.koPlain', {
      wx_k: weather === 'Rain' ? 'comm.koRain' : weather === 'Wind' ? 'comm.koWind' : weather === 'Snow' ? 'comm.koSnow' : weather === 'Damp' ? 'comm.koDamp' : 'common.nothing',
      ...koSty,
    })
  }
  // THE HAKA (item 54): New Zealand lay down the challenge, and the side
  // facing it answers. Only ever for the national side; words only.
  if (detail && (fx.homeId === 'NZL' || fx.awayId === 'NZL')) {
    const nz = fx.homeId === 'NZL' ? home : away
    const them = nz === home ? away : home
    pushLine(state, ctx, 0, 'SUB', nz, `comm.haka${1 + (fx.id % 3)}`, { team: teamShort(state, nz.teamId), opp: teamShort(state, them.teamId) })
  }
  if (detail && ctx.hot) pushLine(state, ctx, 0, 'SUB', null, 'comm.hotDay')
  noteSpecialists(state, ctx, home)
  noteSpecialists(state, ctx, away)
  if (uncontested) {
    ctx.uncontested = true
    const short = !homeFR.legal
      ? teamShort(state, fx.homeId)
      : teamShort(state, fx.awayId)
    pushLine(state, ctx, 1, 'SUB', null, 'comm.uncontested', { team: short })
  }
  if (fx.homeId === state.userClubId) {
    const mood = state.fanMood ?? 60
    if (mood >= 80) pushLine(state, ctx, 1, 'SUB', home, 'comm.crowdBouncing')
    else if (mood <= 30) pushLine(state, ctx, 1, 'SUB', home, 'comm.crowdFlat')
  }
  if (fx.testimonial != null && state.players[fx.testimonial]) {
    const hero = state.players[fx.testimonial]
    pushLine(state, ctx, 1, 'SUB', home, 'comm.testimonial', { player: hero.name }, hero.id)
  }
  // a landmark afternoon announced at kickoff: the appearance he is about
  // to make sits on the salute ladder
  if (ctx.detail) {
    for (const side of [home, away]) {
      if (side.teamId !== state.userClubId) continue
      for (const id of side.lineup.slice(0, 15)) {
        const p = id != null ? state.players[id] : null
        if (!p) continue
        const cApps = careerRows(p).reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0) + 1
        if ([50, 100, 150, 200, 250].includes(cApps)) {
          pushLine(state, ctx, 1, 'SUB', side, 'comm.milestoneApps', { player: p.name, n: cApps }, p.id)
        }
      }
    }
  }
  // ONE CANONICAL BUILD AT KICK-OFF (1.8.16): the day, the respect, the
  // rematch and the analyst each layer onto the units one multiplication at a
  // time, and the rebuild multiplies the same mods in another order, so the two
  // differed in the fifteenth decimal place (teamtalkprobe: a silent room must
  // leave the units exactly as they were). Rebuilt once from the mods here, so
  // every later rebuild starts from the number it would have made. No draws.
  for (const side of [home, away]) recomputeSideUnits(state, ctx, side)
  // THE NUMBER ON THE BACK IS THE ONE HE WALKED OUT IN (owner, 1.8.16: "if
  // they are number 23 on the bench they should be 23 on the pitch"). Taken
  // once the sheet is final (after any warm-up withdrawal), 1-15 the XV and
  // 16-23 the bench, and it does not change when he takes another man's place.
  for (const side of [home, away]) {
    side.shirtNo = {}
    side.lineup.forEach((id, i) => { if (id != null && i < 23) side.shirtNo![id] = i + 1 })
  }
  return ctx
}

/** The number a man wears in this match: the one he had at kick-off, or, on a
 *  match saved before 1.8.16, the shirt he is filling now. */
export function shirtNumber(side: SideCtx, id: number): number | undefined {
  const n = side.shirtNo?.[id]
  if (n != null) return n
  const i = side.lineup.indexOf(id)
  return i >= 0 ? i + 1 : undefined
}
