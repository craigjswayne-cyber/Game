/**
 * ---- THE 25D SURFACES, FED NONSENSE (Round 26) ----
 *
 * Round 25D added four things that read state nobody validates: a valuation
 * engine that takes a position string and two optional numbers, a hidden-trait
 * pair keyed on player id, a match-day wobble that multiplies every attribute
 * in teamUnits, and a staff-chemistry score that walks staffPeople.
 *
 * Every one of them is reachable from a corrupted save or a save written
 * before the field existed, and three of the four multiply something. A dial
 * that is not a number does not sit quietly in a field.
 *
 * The bar is the house bar: a refusal is fine, a shrug is fine. A throw, a NaN
 * in a price or a score, or a world that stops adding up is not.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch, teamUnits } from '../src/game/matchEngine'
import { bigMatchTemper, consistency, isLateBloomer, playerValue, playerWage } from '../src/game/attributes'
import { staffChem, staffChemPairs } from '../src/game/staff'
import { devFactor } from '../src/game/rollover'
import { migrate } from '../src/game/save'
import type { GameState, Player } from '../src/game/model'
import { bad, checkWorld, failCount, finite, ok } from './worldcheck'

const HOSTILE = [NaN, Infinity, -Infinity, -1, 0, 1e9, -1e9, 0.5]

// ---- the valuation engine ---------------------------------------------------
{
  let threw = 0, bogus = 0
  for (const ca of HOSTILE) for (const age of HOSTILE) for (const pa of HOSTILE) {
    for (const pos of [undefined, '', 'FH', 'NOT_A_POSITION', '__proto__']) {
      for (const form of [undefined, ...HOSTILE]) for (const yrs of [undefined, ...HOSTILE]) {
        try {
          const v = playerValue(ca, age, pa, pos, form, yrs)
          // a price may be silly, but it must be a real number a screen can print
          if (!Number.isFinite(v)) bogus++
        } catch { threw++ }
      }
    }
  }
  ok(threw === 0, `playerValue survives every hostile combination (${threw} threw)`)
  ok(bogus === 0, `and never returns a price a screen cannot print (${bogus} non-finite)`)
  // the sane path still behaves after all that
  ok(playerValue(80, 26, 85, 'FH') > 0, 'and an ordinary call still prices a player')

  // the same guard on the sibling: a NaN wage reaches the salary cap and the
  // weekly ledger, which is the same class of quiet poisoning
  let wageThrew = 0, wageBogus = 0
  for (const ca of HOSTILE) for (const age of HOSTILE) for (const acad of [true, false]) {
    try { if (!Number.isFinite(playerWage(ca, age, acad))) wageBogus++ } catch { wageThrew++ }
  }
  ok(wageThrew === 0 && wageBogus === 0, `playerWage holds the same line (${wageThrew} threw, ${wageBogus} non-finite)`)
}

// ---- the hidden traits ------------------------------------------------------
{
  let threw = 0, out = 0
  for (const seed of HOSTILE) for (const id of HOSTILE) {
    try {
      const c = consistency(seed, id)
      const t = bigMatchTemper(seed, id)
      isLateBloomer(seed, id)
      // these multiply attributes; a trait outside its band is a silent
      // strength bug, not a crash, which is exactly the sort that survives
      if (!(c >= 0.02 && c <= 0.07)) out++
      if (!(t >= -1 && t <= 1)) out++
    } catch { threw++ }
  }
  ok(threw === 0, `the hidden traits survive hostile ids and seeds (${threw} threw)`)
  ok(out === 0, `and stay inside their stated bands whatever they are asked (${out} out of band)`)
}

// ---- the staff room ---------------------------------------------------------
{
  const g = newGame('northampton', 'Fuzz', 9)
  const attack = (mut: (s: GameState) => void, what: string) => {
    const fork = structuredClone(g)
    mut(fork)
    try {
      const n = staffChem(fork)
      const pairs = staffChemPairs(fork)
      if (!Number.isFinite(n)) bad('staff chemistry', `${what} produced a non-finite score`)
      if (!Array.isArray(pairs)) bad('staff chemistry', `${what} produced a non-array pair list`)
      // devFactor multiplies growth by this: a NaN here poisons a career
      const kid = Object.values(fork.players).find(p => p.clubId === fork.userClubId)!
      const f = devFactor(fork, kid)
      if (!finite(f)) bad('staff chemistry', `devFactor after ${what} is ${f}`)
    } catch (e) {
      bad('staff chemistry', `${what} threw: ${(e as Error).message}`)
    }
  }
  attack(s => { s.staffPeople = undefined }, 'no staffPeople at all (a save older than the department)')
  attack(s => { s.staffPeople = {} }, 'an empty staff room')
  attack(s => { (s.staffPeople as Record<string, unknown>) = { attack: null, defence: undefined } }, 'null and undefined coaches')
  attack(s => { (s.staffPeople as Record<string, unknown>) = { attack: {} } }, 'a coach with no fields at all')
  attack(s => { (s.staffPeople as Record<string, unknown>) = { attack: { name: 'A', trait: undefined }, defence: { name: 'B', trait: undefined } } }, 'coaches with no trait')
  attack(s => { (s.staffPeople as Record<string, unknown>) = { attack: { name: 'A', trait: 123 }, defence: { name: 'B', trait: {} } } }, 'traits that are not strings')
  attack(s => {
    // the same man in every chair: eight copies of one trait, 28 pairs
    const p = { name: 'Clone', nat: 'ENG', age: 40, tier: 2, wage: 1, trait: 'Man-manager', since: 0, course: null }
    s.staffPeople = Object.fromEntries(['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach'].map(k => [k, { ...p }])) as never
  }, 'one man cloned into all eight chairs')
  attack(s => { (s.staffPeople as Record<string, unknown>) = { attack: { name: 'A', trait: '__proto__' }, defence: { name: 'B', trait: 'constructor' } } }, 'traits that name object internals')
  ok(true, 'the staff room absorbed every shape a corrupted save can hold')
}

// ---- the match-day wobble ---------------------------------------------------
{
  const g = newGame('northampton', 'Fuzz', 9)
  const lineup = g.clubs[g.userClubId].players.slice(0, 23)
  let threw = 0, bogus = 0
  for (const fxId of HOSTILE) for (const big of [true, false]) {
    try {
      const u = teamUnits(g, lineup, { fxId, big })
      for (const [k, v] of Object.entries(u)) {
        if (k === 'kickerId') continue
        if (!Number.isFinite(v as number)) { bogus++; break }
      }
    } catch { threw++ }
  }
  ok(threw === 0, `the wobble survives hostile fixture ids (${threw} threw)`)
  ok(bogus === 0, `and never hands the engine a non-finite unit (${bogus} bogus)`)
  // a hostile SEED is the nastier one: it reaches mulberry32 through the trait
  const wild = structuredClone(g)
  ;(wild as { seed: number }).seed = NaN
  try {
    const u = teamUnits(wild, lineup, { fxId: 7, big: true })
    ok(Number.isFinite(u.attack), `a NaN world seed still yields a real attack unit (${u.attack})`)
  } catch (e) {
    bad('match-day wobble', `a NaN world seed threw: ${(e as Error).message}`)
  }
}

// ---- legacy saves: the fields 25D added did not exist ----------------------
{
  const g = newGame('northampton', 'Fuzz', 9)
  // walk a season so there is something to strip, then strip it the way an
  // old save arrives: no lastStarts, no staffPeople, no annual stamp
  for (let i = 0; i < 8; i++) processWeekAndAdvance(g)
  const old = structuredClone(g) as GameState & Record<string, unknown>
  for (const p of Object.values(old.players)) delete (p as Partial<Player>).lastStarts
  old.staffPeople = undefined
  delete old.annual
  delete old.stance
  delete old.objDone
  try {
    const m = migrate(JSON.parse(JSON.stringify(old))) as GameState
    for (let i = 0; i < 6; i++) processWeekAndAdvance(m)
    const fx = userFixtureThisWeek(m)
    if (fx) simMatch(m, fx, weekRng(m), true)
    processWeekAndAdvance(m)
    checkWorld(m, 'a save written before 25D existed')
    ok(true, 'a pre-25D save migrates, plays a match and settles its week')
  } catch (e) {
    bad('legacy save', `a pre-25D save threw: ${(e as Error).message}`)
  }
}

// ---- and the whole world still adds up after all that ----------------------
{
  const g = newGame('northampton', 'Fuzz', 4242)
  for (let i = 0; i < 12; i++) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    processWeekAndAdvance(g)
  }
  checkWorld(g, 'a dozen ordinary weeks on the 25D engine')
}

const fails = failCount()
console.log(fails ? `\n${fails} FAILURES` : '\n25D FUZZ PASSED: the new surfaces hold their shape under nonsense')
process.exit(fails ? 1 : 0)
