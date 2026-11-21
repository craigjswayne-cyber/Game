/**
 * ---- THE CAMP FLAG GOES WHEN THE CAMP DOES (1.9.16) ----
 *
 * A player in a national squad carries natSquad, and his club cannot pick
 * him. Marcus Smith "isn't available for England" was a man who could not be
 * called up; the mirror fault would be a man whose flag outlives the window,
 * who then cannot be picked by his club or called up again. Held over a whole
 * season: at every week, a player flagged as in camp is in a squad that
 * exists, and every man in a squad carries the flag.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'

describe('natSquad flag', () => {
  for (const coach of [null, 'ARG'] as const) it(`matches the squads every week of a season${coach ? ', with the manager coaching ' + coach : ''}`, () => {
    const g = newGame('leicester', 'NS', 77)
    if (coach) { g.natTeam = coach; g.natConfidence = 60; g.natRecord = { m: 0, w: 0, d: 0, l: 0 } }
    const s0 = g.season
    let weeks = 0, camps = 0, guard = 0
    while (g.season === s0 && guard++ < 70) {
      const inSquads = new Set(Object.values(g.natSquads ?? {}).flat())
      const flagged = Object.values(g.players).filter(p => p.natSquad)
      for (const p of flagged) expect(inSquads.has(p.id), `${p.name} flagged in week ${g.week} but in no squad`).toBe(true)
      for (const id of inSquads) {
        const p = g.players[id]
        if (p) expect(p.natSquad, `${p.name} in a squad in week ${g.week} without the flag`).toBe(true)
      }
      if (inSquads.size) camps++
      weeks++
      for (const n of g.news) n.read = true
      processWeekAndAdvance(g)
    }
    expect(weeks).toBeGreaterThan(30)
    expect(camps).toBeGreaterThan(3) // the season really had windows
    expect(camps).toBeLessThan(weeks) // and weeks without one
  }, 240_000)
})
