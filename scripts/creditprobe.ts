/**
 * ---- THE RIGHT MEN, THE RIGHT MINUTES, THE RIGHT BOOT ----
 *
 * Three things the match engine got wrong about who was on the pitch, all
 * found by reading the code rather than by anybody complaining, because none
 * of them shows on a scoreline:
 *
 *   - finalizeMatch read the START off the lineup at full time, after every
 *     substitution had rewritten it, and credited a flat 75 or 25 minutes. The
 *     replacement who finished in the shirt got the start and 75; the man who
 *     played the first hour got 25 and no start.
 *   - an AI side's units were built once, at kick-off. Its replacements'
 *     attributes never reached its scrum or its defence.
 *   - the goal kicker was a name fixed in the units: sent off, he went on
 *     kicking (and scoring) from the stand.
 *
 * This plays real matches, finds each situation as it happens, and checks the
 * record. Nothing here tunes anything; it only reads.
 *
 * Run: npx vite-node scripts/creditprobe.ts
 */
import { newGame } from '../src/game/newgame'
import {
  autoSelect, availablePlayers, beginMatch, goalKicker, makeSubstitution, minutesPlayed,
  recomputeSideUnits, resolveDecision, rosterOf, stepTick, type LiveCtx, type SideCtx,
} from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g = newGame('leicester', 'Credit Probe', 5150)
const me = g.userClubId
const league = Object.keys(g.clubs).filter(id => g.clubs[id].leagueId === g.clubs[me].leagueId)
const rivals = league.filter(id => id !== me)

/** Everyone fit and picked afresh, so every match starts from a full squad. */
function freshen(ids: string[]) {
  for (const cid of ids) {
    const c = g.clubs[cid]
    for (const id of c.players) { const p = g.players[id]; if (p) { p.injury = null; p.bans = 0; p.cond = 100 } }
    c.tactic.lineup = autoSelect(g, availablePlayers(g, rosterOf(g, cid)))
  }
}

function fixture(homeId: string, awayId: string): Fixture {
  return {
    id: g.nextId++, compId: 'prem', round: 0, week: g.week, homeId, awayId,
    played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
  } as Fixture
}

/** One tick, the way playSegment drives it, with any kick at goal taken. */
function tick(state: GameState, ctx: LiveCtx) {
  if (ctx.decision) resolveDecision(state, ctx, 'posts')
  const r = stepTick(state, ctx)
  if (ctx.decision) resolveDecision(state, ctx, 'posts')
  if (r !== 'play') ctx.awaiting = null
}

const unitsOf = (s: SideCtx) => JSON.stringify(s.units)
/** the same units, give or take the last bit of a float: a layer multiplied in
 *  before a rebuild and after it lands in a different order */
const sameUnits = (a: string, b: string) => {
  const x = JSON.parse(a), y = JSON.parse(b)
  return Object.keys(x).every(k => x[k] === y[k] || Math.abs(x[k] - y[k]) < 1e-9 * Math.max(1, Math.abs(x[k])))
}
const snap = (ids: Iterable<number>) => new Map([...ids].map(id => [id, { ...g.players[id].stats }]))

// ---------------------------------------------------------------------------
console.log('--- an AI side\'s replacement reaches its units, and the credit is his\n')
{
  let checkedUnits = 0, unitsMoved = 0, rebuilt = 0, fresh = 0, idem = 0
  let credited = 0, creditOk = 0
  const binLoss: number[] = []
  const spread: number[] = []
  for (let i = 0; i < 40; i++) {
    const [h, a] = [rivals[i % rivals.length], rivals[(i + 3) % rivals.length]]
    freshen([h, a])
    const fx = fixture(h, a)
    // no user side at all: both are the AI's to run
    const ctx = beginMatch(g, fx, mulberry32(7100 + i), false, null)
    const before = new Map([ctx.home, ctx.away].map(s => [s, snap(s.lineup.filter((x): x is number => x != null))]))
    const subs: { side: SideCtx; outId: number; inId: number; at: number; tick: number }[] = []
    const offOther = new Set<number>()
    /** the tick a starter was first seen off the pitch (not in the bin) */
    const offFrom = new Map<number, number>()
    while (ctx.seg !== 3) {
      const pre = [ctx.home, ctx.away].map(s => ({ s, u: unitsOf(s), xv: s.lineup.slice(0, 15), on: new Set(s.onPitch) }))
      tick(g, ctx)
      // off the pitch for any reason but a card (an HIA, say) at a tick's end
      for (const s of [ctx.home, ctx.away]) {
        for (const id of s.starters ?? []) if (!s.onPitch.has(id) && !s.binned.has(id)) {
          offOther.add(id)
          if (!offFrom.has(id)) offFrom.set(id, ctx.tick)
        }
      }
      for (const { s, u, xv, on } of pre) {
        // a replacement from the bench, straight into a starter's shirt
        for (let slot = 0; slot < 15; slot++) {
          const outId = xv[slot], inId = s.lineup[slot]
          if (outId == null || inId == null || outId === inId) continue
          if (!s.benchIds.has(inId)) continue
          const at = s.onAt?.get(inId)
          if (at == null) continue
          subs.push({ side: s, outId, inId, at, tick: ctx.tick })
          // an HIA stand-in whose man failed the assessment was already in
          // the units (he had been playing in that shirt): nothing to change
          if (on.has(inId)) continue
          checkedUnits++
          if (unitsOf(s) !== u) unitsMoved++
        }
        if (ctx.seg === 3) continue
        // a rebuild now must change nothing: the units are already the units
        // of these men, and a rebuild is idempotent (the goal bonus included)
        const now = unitsOf(s), gb = s.goalBonus, cr = s.cardRisk, tf = s.tempoF
        rebuilt++
        recomputeSideUnits(g, ctx, s)
        if (sameUnits(unitsOf(s), now)) fresh++
        recomputeSideUnits(g, ctx, s)
        recomputeSideUnits(g, ctx, s)
        if (Math.abs(s.goalBonus - gb) < 1e-12 && Math.abs(s.cardRisk - cr) < 1e-12 && Math.abs(s.tempoF - tf) < 1e-12) idem++
      }
    }
    // a starter who was carded and otherwise saw the match out: the time in
    // the bin is not time played, so he is short of 80 by his ten (less, if
    // the whistle went before his ten were up)
    for (const side of [ctx.home, ctx.away]) {
      for (const id of side.starters ?? []) {
        if (!side.yellowUntil.has(id) || !side.onPitch.has(id) || side.onAt?.has(id)) continue
        if (offOther.has(id)) continue
        const cards = g.players[id].stats.yc - before.get(side)!.get(id)!.yc
        binLoss.push((80 - (g.players[id].stats.mins - before.get(side)!.get(id)!.mins)) / Math.max(1, cards))
      }
    }
    for (const { side, outId, inId, at, tick } of subs) {
      // only clean cases: neither man carded, the starter never came back,
      // and he was on the pitch until the change was made. A man who had
      // already gone off (hurt at 49, covered from elsewhere in the side, and
      // his shirt filled from the bench at 62) is honestly credited 49
      if (side.yellowUntil.has(outId) || side.yellowUntil.has(inId)) continue
      if ((offFrom.get(outId) ?? Infinity) < tick) continue
      if (side.onPitch.has(outId) || !side.starters?.has(outId)) continue
      const b = before.get(side)!
      const so = g.players[outId].stats, si = g.players[inId].stats
      const bo = b.get(outId)!, bi = b.get(inId)!
      const outMins = so.mins - bo.mins, inMins = si.mins - bi.mins
      // the replacement may himself have gone off hurt, so his figure is
      // checked against the engine's own stint, and both against the minute
      const inWant = Math.max(1, Math.round(minutesPlayed(side, inId, 80)))
      const good = so.starts - bo.starts === 1 && si.starts - bi.starts === 0 &&
        outMins === Math.max(1, Math.round(at)) && inMins === inWant && inMins <= Math.max(1, Math.round(80 - at))
      credited++
      if (good) creditOk++
      else if (credited - creditOk <= 3) {
        console.log(`    ${g.players[outId].name} off at ${at}: starts +${so.starts - bo.starts}, mins +${outMins}; ` +
          `${g.players[inId].name} on: starts +${si.starts - bi.starts}, mins +${inMins} (want ${inWant})`)
      }
      spread.push(outMins)
    }
  }
  ok(checkedUnits >= 30, `found AI substitutions to look at (${checkedUnits})`)
  ok(unitsMoved === checkedUnits, `every one of them changed that side's units (${unitsMoved} of ${checkedUnits})`)
  ok(rebuilt > 0 && fresh === rebuilt, `the units at every tick are the units of the men out there (${fresh} of ${rebuilt})`)
  ok(idem === rebuilt, `and rebuilding them again changes nothing, goal bonus included (${idem} of ${rebuilt})`)
  ok(credited >= 20 && creditOk === credited,
    `the replaced starter has the start and his minutes, the replacement neither the start nor more than his (${creditOk} of ${credited})`)
  // ten minutes a card, counted from the clock (binUntil), which can have run
  // a few minutes past the card's own line, and served until the first tick
  // after the ten are up: so ten to about seventeen, less when the whistle
  // comes first
  ok(binLoss.length >= 5 && binLoss.every(x => x >= 1 && x <= 17),
    `a sin-binned starter banks nothing for his time in the bin (${binLoss.length} of them, short of 80 by ${Math.min(...binLoss)}-${Math.max(...binLoss)} a card)`)
  if (spread.length) {
    const m = spread.reduce((x, y) => x + y, 0) / spread.length
    console.log(`    replaced starters played ${Math.min(...spread)}-${Math.max(...spread)} minutes, mean ${m.toFixed(1)} (the old flat figure: 75)`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n--- the manager\'s own change, credited the same way\n')
{
  freshen([me, rivals[0]])
  const fx = fixture(me, rivals[0])
  const ctx = beginMatch(g, fx, mulberry32(8800), true)
  const mine = ctx.home
  const ids = mine.lineup.filter((x): x is number => x != null)
  const before = snap(ids)
  while (ctx.tick < 12) tick(g, ctx)
  // the loosehead off, the bench prop on (shirt 1 and the first bench seat)
  const outId = mine.lineup[0]!, inId = mine.lineup[15]!
  const at = ctx.lastMin
  const said = makeSubstitution(g, ctx, outId, inId)
  const onNow = mine.onPitch.has(inId) && !mine.onPitch.has(outId)
  while (ctx.seg !== 3) tick(g, ctx)
  const so = g.players[outId].stats, si = g.players[inId].stats
  const bo = before.get(outId)!, bi = before.get(inId)!
  ok(onNow, `the change was made at ${at}' (${said})`)
  const clean = !mine.yellowUntil.has(outId) && !mine.yellowUntil.has(inId) && mine.onPitch.has(inId)
  ok(so.starts - bo.starts === 1 && so.mins - bo.mins === Math.round(at),
    `the starter: +1 start, +${so.mins - bo.mins} minutes (off at ${at}')`)
  ok(si.starts - bi.starts === 0 && (!clean || si.mins - bi.mins === Math.round(80 - at)),
    `the replacement: no start, +${si.mins - bi.mins} minutes${clean ? '' : ' (he did not see it out, so not checked exactly)'}`)
  // the fifteen who were never touched played the eighty, less any bin
  const untouched = ids.slice(1, 15).filter(id => mine.starters?.has(id) && mine.onPitch.has(id) && !mine.yellowUntil.has(id) &&
    ![...mine.onAt?.keys() ?? []].includes(id))
  ok(untouched.every(id => g.players[id].stats.mins - before.get(id)!.mins === 80),
    `a starter who saw it out uncarded played 80 (${untouched.length} of them)`)
}

// ---------------------------------------------------------------------------
console.log('\n--- a kicker who has gone does not kick\n')
{
  let tested = 0, clean = 0, kicksAfter = 0
  let binTested = 0, binBack = 0, binCover = 0
  for (let i = 0; i < 60 && (tested < 10 || binTested < 10); i++) {
    const [h, a] = [rivals[i % rivals.length], rivals[(i + 5) % rivals.length]]
    freshen([h, a])
    const fx = fixture(h, a)
    const ctx = beginMatch(g, fx, mulberry32(6100 + i), false, null)
    while (ctx.tick < 6) tick(g, ctx)
    const side = i % 2 ? ctx.away : ctx.home
    const k = goalKicker(g, side)
    if (!k) continue
    if (i % 3 !== 2) {
      // SENT OFF, exactly as the engine does it
      side.sent += 1
      side.onPitch.delete(k.id)
      const pts0 = { ...k.stats }
      const at0 = side.kicksAt ?? 0
      while (ctx.seg !== 3) tick(g, ctx)
      tested++
      const kicked = (k.stats.cons - pts0.cons) + (k.stats.pens - pts0.pens) + (k.stats.drops - pts0.drops)
      if (kicked === 0 && goalKicker(g, side)?.id !== k.id) clean++
      kicksAfter += (side.kicksAt ?? 0) - at0
    } else {
      // BINNED for ten: a stand-in takes the tee, and the tee comes back
      const until = ctx.lastMin + 10
      side.yellowUntil.set(k.id, until)
      side.onPitch.delete(k.id)
      side.binned.add(k.id)
      const stand = goalKicker(g, side)
      while (ctx.seg !== 3 && ctx.lastMin < until + 4) tick(g, ctx)
      binTested++
      if (stand && stand.id !== k.id && side.onPitch.has(stand.id) || !stand) binCover++
      if (!side.onPitch.has(k.id) || goalKicker(g, side)?.id === k.id) binBack++
      while (ctx.seg !== 3) tick(g, ctx)
    }
  }
  ok(tested >= 10 && clean === tested, `a sent-off kicker takes and is credited with no further kick (${clean} of ${tested})`)
  ok(kicksAfter > 0, `and his side went on kicking without him (${kicksAfter} kicks at goal)`)
  ok(binTested >= 5 && binCover === binTested, `a binned kicker is covered by a man on the pitch (${binCover} of ${binTested})`)
  ok(binBack === binTested, `and takes the tee back when his ten are up (${binBack} of ${binTested})`)
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok')
if (fails) process.exit(1)
