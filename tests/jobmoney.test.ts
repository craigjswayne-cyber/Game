/**
 * ---- THE OLD BOARD'S MONEY STAYS WITH THE OLD BOARD (1.9.4 audit) ----
 *
 * takeJob resets everything the old desk held (the funds ask, the board's
 * grudges, the builders' slot), but three things the boardroom hands out sat
 * on the career rather than the club and walked with the manager:
 *
 *   - a facility the old chairman agreed to pay for outright (boardGrant):
 *     at the new club it built that facility's next level for nothing, at
 *     whatever that level costs there
 *   - the old chairman's ring-fenced backroom pot (staffRoom): it paid the new
 *     club's appointments and courses
 *   - the old chairman's ten weeks of grace on the sack (boardGrace)
 *
 * And the other way: the old club's building work was cancelled outright when
 * he left, although it had already paid its share ("the old club's builders
 * finish without you", said the comment). The money went and the building
 * never came. Now it opens for the club that paid for it.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { answerJobOffer } from '../src/game/jobs'
import { requestFacility } from '../src/game/season'
import { backroomFund } from '../src/game/staff'
import { FACILITY_INFO, facilityCost, type GameState } from '../src/game/model'

function moveTo(g: GameState, clubId: string) {
  g.vacancies.push({ clubId, week: g.week })
  g.jobOffer = { clubId, week: g.week }
  answerJobOffer(g, true)
  expect(g.userClubId).toBe(clubId)
}

describe('a change of club', () => {
  it('leaves the old board\'s promised building behind', () => {
    const g = newGame('leicester', 'Mover', 31)
    // what a yes in the boardroom leaves (boardroom.ts, the facilities ask)
    g.boardGrant = ['gym']
    moveTo(g, 'bath')
    const bath = g.clubs.bath
    bath.boardConfidence = 80
    const before = bath.balance
    const lvl = bath.facilities?.gym ?? 0
    requestFacility(g, 'gym')
    expect(g.boardGrant ?? []).toEqual([])
    if (g.facilityBuild) {
      // approved on its own merits: the club paid its share
      expect(before - bath.balance).toBeGreaterThan(0)
      expect(before - bath.balance).toBeLessThanOrEqual(facilityCost(FACILITY_INFO.gym, lvl))
    }
  })

  it('leaves the old board\'s backroom pot behind', () => {
    const g = newGame('leicester', 'Mover', 32)
    g.staffRoom = 400_000
    moveTo(g, 'bath')
    expect(backroomFund(g)).toBe(0)
  })

  it('leaves the old board\'s grace behind', () => {
    const g = newGame('leicester', 'Mover', 33)
    g.boardGrace = g.season * 100 + g.week + 10
    moveTo(g, 'bath')
    expect(g.boardGrace ?? 0).toBeLessThanOrEqual(g.season * 100 + g.week)
  })

  it('opens the building the old club paid for', () => {
    const g = newGame('leicester', 'Mover', 34)
    const tigers = g.clubs.leicester
    tigers.boardConfidence = 80
    tigers.balance = Math.max(tigers.balance, 20_000_000)
    const lvl = tigers.facilities?.gym ?? 0
    const before = tigers.balance
    requestFacility(g, 'gym')
    expect(g.facilityBuild?.id).toBe('gym')
    expect(tigers.balance).toBeLessThan(before)
    moveTo(g, 'bath')
    expect(g.facilityBuild).toBeNull()
    expect(tigers.facilities?.gym).toBe(lvl + 1)
  })
})
