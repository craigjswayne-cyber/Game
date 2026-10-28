// Player report, 1.9.6: "there is no wage room even if I join a different
// club". The wage budget was set at the career's start and never moved. It is
// now refreshed each summer and on a job move (scripts/wageroomprobe.ts plays
// that out), and a save from before 1.9.7 gives the manager's club its
// headroom once, on load.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { healWageRoom, openingWageBudget } from '../src/game/grants'
import { migrate } from '../src/game/save'
import type { GameState } from '../src/game/model'

const bill = (g: GameState, id: string) => g.clubs[id].players.reduce((s, p) => {
  const pl = g.players[p]
  return pl && !pl.acad ? s + pl.wage : s
}, 0)

/** A career from before 1.9.7 whose bill has run past its budget. */
function oldSave() {
  const g = newGame('northampton', 'Wages', 11)
  const club = g.clubs[g.userClubId]
  delete g.wageFix
  club.wageBudget = Math.round(bill(g, club.id) * 0.9)
  return { g, club }
}

describe('wage room on an old save', () => {
  it('a new career is already up to date', () => {
    const g = newGame('northampton', 'Wages', 11)
    expect(g.wageFix).toBe(1)
    const before = g.clubs[g.userClubId].wageBudget
    migrate(g)
    expect(g.clubs[g.userClubId].wageBudget).toBe(before)
  })
  it('gives the manager\'s club its headroom when a pre-1.9.7 save loads', () => {
    const { g, club } = oldSave()
    migrate(g)
    expect(g.wageFix).toBe(1)
    expect(club.wageBudget).toBe(openingWageBudget(g, club))
    expect(club.wageBudget).toBeGreaterThan(bill(g, club.id))
  })
  it('keeps a budget that already has room', () => {
    const { g, club } = oldSave()
    club.wageBudget = bill(g, club.id) * 2
    healWageRoom(g)
    expect(club.wageBudget).toBe(bill(g, club.id) * 2)
  })
  it('runs once: a save and reload cannot buy more room', () => {
    const { g, club } = oldSave()
    migrate(g)
    // the manager spends into it, then saves and reloads
    club.wageBudget = Math.round(bill(g, club.id) * 0.9)
    const again = migrate(JSON.parse(JSON.stringify(g)) as GameState)
    expect(again.clubs[again.userClubId].wageBudget).toBe(club.wageBudget)
  })
  it('leaves the other clubs for the summer', () => {
    const { g } = oldSave()
    const other = Object.values(g.clubs).find(c => c.id !== g.userClubId)!
    other.wageBudget = Math.round(bill(g, other.id) * 0.9)
    const was = other.wageBudget
    migrate(g)
    expect(other.wageBudget).toBe(was)
  })
})
