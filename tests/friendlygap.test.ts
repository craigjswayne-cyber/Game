// Midweek friendlies (owner, 1.9.8: "it is out of order and I shouldn't be
// able to play a match this close to another match. The rule should be no game
// within 3 days of each other").
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { arrangeMidweekFriendly, friendlySuggestions, friendlyWeeks } from '../src/game/season'
import { fxDate, fxDayOff, seasonStart, type Fixture, type GameState } from '../src/game/model'

const DAY = 86400000
// absolute kick-off day, counted from the season's opening Saturday
const kickoff = (f: Fixture) => (f.week - 1) * 7 + fxDayOff(f)
const mineOf = (g: GameState, id: string) => g.fixtures.filter(f => f.homeId === id || f.awayId === id)

describe('midweek friendlies', () => {
  for (const [club, seed] of [['northampton', 3], ['leicester', 7], ['bath', 21]] as const) {
    it(`never sit within three days of another game (${club})`, () => {
      const g = newGame(club, 'Gap', seed)
      const weeks = friendlyWeeks(g, 40)
      expect(weeks.length).toBeGreaterThan(0)
      for (const w of weeks) {
        const day = (w - 1) * 7 - 3
        for (const f of mineOf(g, g.userClubId)) expect(Math.abs(kickoff(f) - day)).toBeGreaterThanOrEqual(3)
        for (const opp of friendlySuggestions(g, w)) {
          for (const f of mineOf(g, opp)) expect(Math.abs(kickoff(f) - day)).toBeGreaterThanOrEqual(3)
        }
      }
    })
  }

  it('is dated on its Wednesday, so it sorts before that weekend', () => {
    const g = newGame('northampton', 'Gap', 5)
    const w = friendlyWeeks(g)[0]
    const opp = friendlySuggestions(g, w)[0]
    arrangeMidweekFriendly(g, opp, w)
    const fr = g.fixtures.find(f => f.devSide && f.week === w)!
    expect(fr).toBeTruthy()
    const wed = new Date(seasonStart(g.season) + ((w - 1) * 7 - 3) * DAY)
    expect(wed.getUTCDay()).toBe(3)
    expect(fxDate(g.season, fr).startsWith('Wed ')).toBe(true)
    const weekend = mineOf(g, g.userClubId).find(f => f.week === w && !f.devSide)
    if (weekend) expect(kickoff(fr)).toBeLessThan(kickoff(weekend))
  })
})
