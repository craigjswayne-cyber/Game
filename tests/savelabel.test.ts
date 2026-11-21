/**
 * ---- THE SAVE SLOT NAMES THE JOB HE HOLDS (1.9.16) ----
 *
 * Owner: "ive taken a job as England coach, i resigned from Northampton but
 * the game save still says northampton". userClubId stays on the last club
 * after a resignation, and the label read it.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { resignJob } from '../src/game/jobs'
import { saveLabel } from '../src/game/save'

describe('saveLabel', () => {
  it('names the club while he has one', () => {
    expect(saveLabel(newGame('northampton', 'Cal', 7))).toMatch(/Northampton/)
  })
  it('names his country when that is the only job he holds', () => {
    const g = newGame('northampton', 'Cal', 7)
    g.natTeam = 'ENG'
    resignJob(g)
    expect(saveLabel(g)).toBe('England')
  })
  it('says so when he holds no job at all', () => {
    const g = newGame('northampton', 'Cal', 7)
    resignJob(g)
    expect(saveLabel(g)).toBe('Between jobs')
  })
})
