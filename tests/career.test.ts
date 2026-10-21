/**
 * ---- SACKED, AND BACK IN WORK (1.9.4 audit) ----
 *
 * The career's one dead end would be a manager out of work with no road back.
 * What holds:
 *
 *   - the club that sacked him refuses him outright for SACK_COOLOFF weeks
 *     (three months): jobChance is nought, an application is answered without
 *     the dice and does not spend his one application. The Job Centre card
 *     reads "They sacked you: unlikely" and shows no Apply button; the rule
 *     behind it is a flat no until the weeks run out
 *   - once they have, the same board hears him like any other
 *   - a manager who applies for what is on the board is back in work inside
 *     a season, on every seed tried
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { SACK_COOLOFF, answerJobOffer, applyForJob, jobChance, sackCooloff, sackManager } from '../src/game/jobs'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'

describe('a sacked manager', () => {
  it('is refused by the club that sacked him for three months, then heard', () => {
    const g = newGame('bath', 'Sacked', 71)
    const old = g.userClubId
    g.week = 10
    sackManager(g, 'news.sacked')
    expect(g.unemployed).toBe(true)
    expect(sackCooloff(g, old)).toBe(SACK_COOLOFF)
    expect(jobChance(g, old)).toBe(0)
    const v = g.vacancies.find(x => x.clubId === old)!
    expect(v).toBeTruthy()
    applyForJob(g, old)
    expect(v.applied).toBeFalsy()
    expect(g.jobOffer).toBeFalsy()
    g.week += SACK_COOLOFF - 1
    expect(sackCooloff(g, old)).toBe(1)
    expect(jobChance(g, old)).toBe(0)
    g.week += 1
    expect(sackCooloff(g, old)).toBe(0)
    expect(jobChance(g, old)).toBeGreaterThan(0)
  })

  it('the cold spell runs across the summer, by absolute week', () => {
    const g = newGame('bath', 'Sacked', 72)
    const old = g.userClubId
    g.week = SEASON_WEEKS - 2
    sackManager(g, 'news.sacked')
    g.season += 1
    g.week = 1
    expect(sackCooloff(g, old)).toBe(SACK_COOLOFF - 3)
  })

  for (const seed of [73, 74]) {
    it(`finds work again within a season (seed ${seed})`, () => {
      const g = newGame('bath', 'Sacked', seed)
      for (let i = 0; i < 6; i++) processWeekAndAdvance(g)
      sackManager(g, 'news.sacked')
      let weeks = 0
      while (g.unemployed && weeks < SEASON_WEEKS) {
        if (g.jobOffer) { answerJobOffer(g, true); break }
        for (const v of [...g.vacancies]) if (!v.applied && jobChance(g, v.clubId) > 0) applyForJob(g, v.clubId)
        if (g.jobOffer) { answerJobOffer(g, true); break }
        processWeekAndAdvance(g)
        weeks++
        // the job centre is never empty for a man out of work
        expect(g.vacancies.length).toBeGreaterThan(0)
      }
      expect(g.unemployed).toBe(false)
    }, 120_000)
  }
})
