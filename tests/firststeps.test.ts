// The pre-season checklist (owner, 1.9.5: "hide it after the 3 pre-season
// games"): shown on a new career through the friendlies, gone once they are
// played whether or not every step is ticked, and never back in a later
// pre-season.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { firstSteps, preseasonOver, skipFirstSteps } from '../src/game/firststeps'
import type { GameState } from '../src/game/model'

function week(g: GameState) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  processWeekAndAdvance(g)
}

describe('the pre-season checklist', () => {
  it('shows through the friendlies and goes when they are played', () => {
    const g = newGame('northampton', 'Steps', 11)
    const mine = g.fixtures.filter(f => f.homeId === g.userClubId || f.awayId === g.userClubId)
    const first = Math.min(...mine.filter(f => f.compId !== 'fr').map(f => f.week))
    const friendlies = mine.filter(f => f.compId === 'fr' && f.week < first)
    expect(friendlies.length).toBe(3)
    expect(firstSteps(g)).not.toBeNull()
    let shown = 0
    while (!preseasonOver(g)) {
      expect(firstSteps(g)).not.toBeNull()
      shown++
      week(g)
      expect(shown).toBeLessThan(10)
    }
    expect(friendlies.every(f => g.fixtures.find(x => x.id === f.id)?.played)).toBe(true)
    // not every step was done (nobody signed anyone), and it is gone anyway
    expect(g.mgr.signings ?? 0).toBe(0)
    expect(firstSteps(g)).toBeNull()
    // and it stays gone through the league weeks
    for (let w = 0; w < 4; w++) { week(g); expect(firstSteps(g)).toBeNull() }
  }, 60_000)

  it('stays gone for a manager with a finished season, and when skipped', () => {
    const g = newGame('bath', 'Steps', 12)
    g.mgr.finishes.push({ season: g.season, leagueId: g.clubs[g.userClubId].leagueId, pos: 5 })
    expect(firstSteps(g)).toBeNull()
    const h = newGame('bath', 'Steps', 13)
    expect(firstSteps(h)).not.toBeNull()
    skipFirstSteps(h)
    expect(firstSteps(h)).toBeNull()
  })

  it('is never shown on a career without the list (an older save)', () => {
    const g = newGame('bath', 'Steps', 14)
    delete g.firstSteps
    expect(firstSteps(g)).toBeNull()
  })
})
