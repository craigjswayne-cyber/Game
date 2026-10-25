// The opening transfer list (owner, 1.9.6): a new career starts with a few
// cheap fringe men for sale in the manager's own league, and the pick moves
// nothing else in the new world.
import { describe, expect, it } from 'vitest'
import { newGame, OPENERS } from '../src/game/newgame'
import { shownCa } from '../src/game/scout'

describe('the opening transfer list', () => {
  for (const [club, seed] of [['aurillac', 1], ['northampton', 2], ['toulouse', 6]] as const) {
    it(`lists ${OPENERS} fringe men in the ${club} league, one per club`, () => {
      const g = newGame(club, 'List', seed)
      const mine = g.clubs[g.userClubId]
      const ours = mine.players.map(id => g.players[id].ca).sort((a, b) => a - b)
      const listed = Object.values(g.players).filter(p => p.transferListed)
      expect(listed.length).toBe(OPENERS)
      expect(new Set(listed.map(p => p.clubId)).size).toBe(OPENERS)
      for (const p of listed) {
        expect(p.clubId).not.toBe(g.userClubId)
        expect(g.clubs[p.clubId!].leagueId).toBe(mine.leagueId)
        expect(p.ca).toBeLessThanOrEqual(ours[ours.length >> 1])
        expect(p.ca).toBeGreaterThanOrEqual(ours[0] - 4)
      }
    })
  }
  it('is the same list for the same seed', () => {
    const ids = () => Object.values(newGame('bath', 'List', 9).players).filter(p => p.transferListed).map(p => p.id)
    expect(ids()).toEqual(ids())
  })
})

describe('no rating without a report', () => {
  it('hides another club\'s man until he is properly scouted, never your own', () => {
    const g = newGame('bath', 'List', 9)
    const own = g.players[g.clubs[g.userClubId].players[0]]
    expect(shownCa(g, own)).not.toBeNull()
    const abroad = Object.values(g.players).find(p => p.clubId && g.clubs[p.clubId].leagueId !== g.clubs[g.userClubId].leagueId && !p.intl)!
    expect(shownCa(g, abroad)).toBeNull()
    abroad.sc = 55
    expect(shownCa(g, abroad)).not.toBeNull()
    const league = Object.values(g.players).find(p => p.clubId && p.clubId !== g.userClubId && g.clubs[p.clubId].leagueId === g.clubs[g.userClubId].leagueId && !p.intl && p.ca < 88)!
    expect(shownCa(g, league)).toBeNull()
  })
})
