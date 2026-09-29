/**
 * ---- RIVALRIES THAT ARE EARNED ----
 *
 * rivalries.ts holds the derbies the map made: Leicester and Northampton, Bath
 * and Gloucester, fixed forever. model.ts's `state.grudges` holds a season or
 * two of bad blood after a poached star or a fight. Neither is a rivalry that
 * GROWS: two clubs that meet in three finals in four years, a title decided on
 * the last day between the same pair, a manager who walked out of one for the
 * other. In real rugby those become the fixtures people circle, and after a
 * decade of nothing they quietly stop being.
 *
 * So this keeps a heat for every pair of clubs history has touched:
 *
 *   A FINAL is the loudest thing two clubs can share (+3), a semi half that, a
 *   quarter a little. A knockout settled by a kick or less adds half a point on
 *   top: the ones that ended in an argument. Even a close final (3.5) is not
 *   yet a rivalry on its own; a second meeting that matters makes it one.
 *   A TITLE DECIDED between two clubs, in a league with no final to do it, +3.
 *   LIVE BAD BLOOD at the summer (a poached star, a match that boiled over)
 *   +1.5, because a grudge that lasted to the end of the season has become
 *   part of the story. Not for a pair that met in a knockout this season:
 *   the exit strikes its own grudge, and that meeting is counted already.
 *   THE MANAGER leaving one club directly for another, +4, the moment it
 *   happens. That one is yours.
 *
 * Every summer the heat is multiplied by 0.6 before the new season's events
 * are added. One final is warm; two in consecutive years is a rivalry; a pair
 * that stops meeting is back to strangers in three or four summers.
 *
 * WHAT A RIVALRY DOES, and it is kept small on purpose, because a derby is
 * still the loudest fixture in the game and this must never outshout it:
 *   - the pre-match billing names it (stakes.ts),
 *   - the board and the terraces take the result harder, up to x1.3 against a
 *     derby's x1.8 and x1.7 (season.ts boardReaction),
 *   - it is announced when it forms and when it fades, and it goes into the
 *     season's annals line.
 * It never reaches the match engine. AI-vs-AI results cannot see it.
 */
import type { GameState } from './model'
import { seasonLabel } from './model'
import { isDerby } from './rivalries'
import { sortTable } from './schedule'
import { book, file, moment, note, type Line, type Rivalry } from './histbook'
import type { Vars } from './i18n'

export const FORM_AT = 4
export const COOL_AT = 2
const DECAY = 0.6
const MAX_HEAT = 12

const pairOf = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a])

export function rivalryOf(state: GameState, x: string, y: string): Rivalry | null {
  const [a, b] = pairOf(x, y)
  return state.hist?.rivals?.find(r => r.a === a && r.b === b) ?? null
}

/** The heat of a formed rivalry, or 0 when there is none to speak of. */
export function rivalHeat(state: GameState, x: string, y: string): number {
  const r = rivalryOf(state, x, y)
  return r && r.on ? r.heat : 0
}

/** How much louder the board and the crowd take this result: 1 to 1.3. */
export function rivalWeight(state: GameState, x: string, y: string): number {
  const h = rivalHeat(state, x, y)
  return h ? 1 + Math.min(0.3, (h - COOL_AT) * 0.05) : 1
}

/**
 * Add heat between two clubs, and announce it if a rivalry has just been born
 * with the manager's club in it. Fixed derbies are left alone: they are
 * already as hot as the game makes anything.
 */
export function stoke(state: GameState, x: string, y: string, amount: number, why: Line): void {
  if (x === y || !state.clubs[x] || !state.clubs[y] || isDerby(x, y)) return
  const h = book(state)
  const [a, b] = pairOf(x, y)
  let r = h.rivals.find(q => q.a === a && q.b === b)
  if (!r) { r = { a, b, heat: 0, why: [] }; h.rivals.push(r) }
  r.heat = Math.min(MAX_HEAT, r.heat + amount)
  r.why = [why, ...r.why.filter(w => w.k !== why.k)].slice(0, 2)
  if (!r.on && r.heat >= FORM_AT) {
    r.on = true
    r.since = state.season
    const uid = state.userClubId
    if (!state.unemployed && (a === uid || b === uid)) {
      const opp = a === uid ? b : a
      const v: Vars = { club: state.clubs[opp].short, why_k: why.k, ...(why.v ?? {}) }
      file(state, 'hist.rivalBorn', v)
      moment(state, uid, 55, 'hist.anRival', { club: state.clubs[opp].short })
      note(state, { kind: 'rivalry-born', clubId: opp })
    }
  }
}

/** Why these two cannot stand each other, as a fragment for a sentence. */
export function rivalWhy(r: Rivalry): Line {
  return r.why[0] ?? { k: 'hist.whyHistory' }
}

/**
 * The summer: cool every pair, then add what this season did. Called by the
 * rollover while the season's fixtures and tables still exist.
 */
export function rivalsYearEnd(state: GameState): void {
  const h = book(state)
  for (const r of h.rivals) r.heat *= DECAY
  const lbl = seasonLabel(state.season)

  // the knockouts, every competition, every club
  const STAGE: Record<string, number> = { F: 3, SF: 1.5, QF: 0.75 }
  const met = new Set<string>()
  for (const f of state.fixtures) {
    const base = f.stage ? STAGE[f.stage] : 0
    if (!base || !f.played || !state.clubs[f.homeId] || !state.clubs[f.awayId]) continue
    const comp = state.comps[f.compId]
    const close = Math.abs(f.homeScore - f.awayScore) <= 3
    const k = f.stage === 'F' ? 'hist.whyFinal' : f.stage === 'SF' ? 'hist.whySemi' : 'hist.whyQuarter'
    met.add(pairOf(f.homeId, f.awayId).join('|'))
    stoke(state, f.homeId, f.awayId, base + (close ? 0.5 : 0),
      { k: close ? `${k}Close` : k, v: { comp: comp?.short ?? '', season: lbl } })
  }

  // a title decided between two clubs, where no final did the deciding
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league' || comp.playoffTeams > 0 || !comp.table?.length) continue
    const [first, second] = sortTable(comp.table)
    if (!first || !second || first.p < 4) continue
    if (first.pts - second.pts <= 3) {
      stoke(state, first.teamId, second.teamId, 3, { k: 'hist.whyTitle', v: { comp: comp.short, season: lbl } })
    }
  }

  // bad blood that lasted the season
  // (a knockout exit strikes a grudge of its own in season.ts, so a pair that
  // met in a knockout this summer has been counted once already)
  for (const g of state.grudges ?? []) {
    if (g.until < state.season || met.has(pairOf(g.a, g.b).join('|'))) continue
    stoke(state, g.a, g.b, 1.5, { k: 'hist.whyBadBlood', v: { season: lbl } })
  }

  // and the ones that have faded
  const uid = state.userClubId
  for (const r of h.rivals) {
    if (!r.on || r.heat >= COOL_AT) continue
    r.on = false
    if (!state.unemployed && (r.a === uid || r.b === uid)) {
      const opp = r.a === uid ? r.b : r.a
      file(state, 'hist.rivalFades', { club: state.clubs[opp]?.short ?? opp, since: seasonLabel(r.since ?? state.season) },
        { week: 1, season: state.season + 1 })
    }
  }
  h.rivals = h.rivals.filter(r => r.on || r.heat >= 0.5)
  if (h.rivals.length > 60) h.rivals = h.rivals.sort((a, b) => b.heat - a.heat).slice(0, 60)
}

/** The manager walked out of one club for another: that is a rivalry now. */
export function rivalsManagerMoved(state: GameState, fromId: string, toId: string): void {
  stoke(state, fromId, toId, 4, { k: 'hist.whyManager', v: { manager: state.managerName } })
}
