/**
 * ---- THE SEASON PLAN: what each answer does, held at the engine (1.9.16 audit) ----
 *
 * The measured table is scripts/preseasonprobe.ts (24 seeds). These are the
 * parts of it that are deterministic for one seed, so they can be assertions.
 *
 * GAPS between the card's wording and the engine are written as `it.fails`:
 * the assertion states what the wording promises and goes green only while
 * the engine still does not do it. When one is closed, change it to `it`.
 *   GAP 1  Fitness, "Legs for the season": no recovery or match-day lever is set.
 *   GAP 2  Attack, "Moves and handling": the called moves are drilled no faster.
 *   GAP 3  Set pieces, "Scrum and lineout": the squad's lineout attribute goes DOWN.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { FOCUS_OF, STYLE_OF, setPreseasonPlan, type PlanStyle, type PlanWork } from '../src/game/preseasonplan'
import { recoveryShift } from '../src/game/condition'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, playbookOf } from '../src/game/playbook'
import { MOVES, drilledOf, isStrike } from '../src/game/moves'
import { t } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

const CLUB = 'leicester', SEED = 3
const fresh = (style?: PlanStyle, work?: PlanWork) => {
  const g = newGame(CLUB, 'Audit', SEED); g.boardGrace = 999_999
  if (style && work) setPreseasonPlan(g, style, work)
  return g
}
const seniors = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
const weeks = (g: GameState, n: number) => { for (let i = 0; i < n; i++) processWeekAndAdvance(g) }
const squadSum = (g: GameState, ids: number[], ks: (keyof Player['a'])[]) => ids.reduce((s, id) => s + ks.reduce((x, k) => x + (g.players[id]?.a[k] ?? 0), 0), 0)

describe('the Season plan: what the card says and what it writes', () => {
  it('the wording shown to the player', () => {
    expect(t('preplan.w_fitness')).toBe('Fitness'); expect(t('preplan.w_fitnessDesc')).toBe('Legs for the season')
    expect(t('preplan.w_setpiece')).toBe('Set pieces'); expect(t('preplan.w_setpieceDesc')).toBe('Scrum and lineout')
    expect(t('preplan.w_attack')).toBe('Attack'); expect(t('preplan.w_attackDesc')).toBe('Moves and handling')
    expect(t('preplan.s_forwardsDesc')).toBe('Win it up front')
    expect(t('preplan.s_balancedDesc')).toBe('A bit of everything')
    expect(t('preplan.s_backsDesc')).toBe('Move it wide')
  })

  it('a way of playing is an attack style and a defence style, with their dials', () => {
    expect(STYLE_OF).toEqual({ forwards: { atk: 'direct', def: 'choke' }, balanced: { atk: 'pods', def: 'drift' }, backs: { atk: 'width', def: 'blitz' } })
    const g = fresh('backs', 'fitness')
    const tac = g.clubs[g.userClubId].tactic
    expect([tac.atkStyle, tac.defStyle, tac.style, tac.defLine]).toEqual(['width', 'blitz', 84, 88])
  })

  it('the work is a training focus and, since 1.9.16, the week\'s match preparation of the same name', () => {
    expect(FOCUS_OF).toEqual({ fitness: 'fitness', setpiece: 'scrum', attack: 'attack' })
    expect(fresh('balanced', 'fitness').matchPrep).toBe('fitness')
    expect(fresh('balanced', 'attack').matchPrep).toBe('attack')
    expect(fresh('balanced', 'setpiece').matchPrep).toBe('setpiece')
  })

  it('"pre-season" work is not pre-season only: it is still the setting twelve weeks on', () => {
    const g = fresh('forwards', 'setpiece')
    weeks(g, 12)
    expect(g.week).toBeGreaterThan(8) // well into the league season
    expect(g.training).toBe('scrum')
    expect(g.matchPrep).toBe('setpiece')
    expect(g.clubs[g.userClubId].tactic.atkStyle).toBe('direct')
  }, 60_000)
})

describe('the pre-season work, measured on one seed over ten weeks', () => {
  const none = fresh(), fit = fresh('balanced', 'fitness'), sp = fresh('balanced', 'setpiece'), atk = fresh('balanced', 'attack')
  // the same style in all four, so only the work differs
  setPreseasonPlan(none, 'balanced', 'fitness'); none.training = 'balanced'
  const ids = seniors(none).map(p => p.id)
  const before = { lin: squadSum(none, ids, ['lin']) }
  for (const g of [none, fit, sp, atk]) weeks(g, 10)

  it('Fitness moves attribute points into stamina', () => {
    expect(squadSum(fit, ids, ['sta'])).toBeGreaterThan(squadSum(none, ids, ['sta']))
  })
  it('Attack moves attribute points into handling, passing and vision', () => {
    expect(squadSum(atk, ids, ['han', 'pas', 'vis'])).toBeGreaterThan(squadSum(none, ids, ['han', 'pas', 'vis']))
  })
  it('Set pieces moves attribute points into scrummaging and strength, and drills the called set pieces further', () => {
    expect(squadSum(sp, ids, ['scr', 'str'])).toBeGreaterThan(squadSum(none, ids, ['scr', 'str']))
    const drilled = (g: GameState) => { const pb = playbookOf(g.clubs[g.userClubId]); return (pb.drilled[DEFAULT_LINEOUT] ?? 30) + (pb.drilled[DEFAULT_SCRUM] ?? 30) }
    expect(drilled(sp)).toBeGreaterThan(drilled(none))
  })

  // GAP 3: FOCUS_OF.setpiece is 'scrum' (scr, str), and a trained point is paid for by a donor attribute
  // the programme does not cover (ageing.ts trainPoint): the lineout is one of the donors
  it('FIXED 1.9.16, was GAP 3: Set pieces ("Scrum and lineout") does not lower the squad\'s lineout attribute', () => {
    expect(squadSum(none, ids, ['lin'])).toBe(before.lin) // no plan: untouched
    expect(squadSum(sp, ids, ['lin'])).toBeGreaterThanOrEqual(squadSum(none, ids, ['lin']))
  })
}, 240_000)

describe('the levers the wording points at and the plan does not pull', () => {
  // GAP 1: recovery (condition.ts recoveryShift) and match-day drain (match/setup.ts) read matchPrep === 'fitness',
  // which the plan never sets; the training focus 'fitness' only moves attribute points to stamina
  it('FIXED 1.9.16, was GAP 1: Fitness ("Legs for the season") improves the week\'s recovery', () => {
    const none = fresh(), fit = fresh('balanced', 'fitness')
    const p = seniors(none)[0]
    const byHand = fresh(); byHand.matchPrep = 'fitness'
    expect(recoveryShift(byHand, byHand.players[p.id], true)).toBeGreaterThan(recoveryShift(none, p, true)) // the lever exists
    expect(recoveryShift(fit, fit.players[p.id], true)).toBeGreaterThan(recoveryShift(none, p, true))       // the plan does not pull it
  })

  // GAP 2: moves.ts drillMovesWeek sharpens the called moves 2.2x faster under matchPrep === 'attack',
  // which the plan never sets
  it('FIXED 1.9.16, was GAP 2: Attack ("Moves and handling") drills the called attacking move faster', () => {
    const strike = MOVES.find(m => isStrike(m.id))!.id
    const run = (g: GameState) => { g.clubs[g.userClubId].tactic.moveMain = strike; weeks(g, 6); return drilledOf(g, g.clubs[g.userClubId], strike) }
    const none = fresh(); setPreseasonPlan(none, 'balanced', 'fitness'); none.training = 'balanced'
    const byHand = fresh('balanced', 'attack'); byHand.matchPrep = 'attack'
    const base = run(none)
    // measured on this seed: no plan 65.5, the plan 65.6, an Attack match-prep week set by hand 72.0
    // (the tenth is the manager's standing in the room, which differs by a hair between two careers)
    expect(run(byHand)).toBeGreaterThan(base + 3)                    // the lever exists
    expect(run(fresh('balanced', 'attack'))).toBeGreaterThan(base + 3) // the plan does not pull it
  }, 120_000)

  it('changing the answer changes the preparation with it, and a preparation the manager chose himself is left alone', () => {
    const g = fresh('balanced', 'setpiece')
    setPreseasonPlan(g, 'balanced', 'attack')
    expect(g.matchPrep).toBe('attack')
    g.matchPrep = 'recovery'
    setPreseasonPlan(g, 'balanced', 'fitness')
    expect(g.matchPrep).toBe('recovery')
  })
})
