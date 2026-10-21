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
import { LEAGUE_TIER, SEASON_WEEKS, leagueTier } from '../src/game/model'
import { LEAGUE_DEFS } from '../src/game/newgame'
import { jobProfile } from '../src/game/chairman'

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

describe('the women\'s top flights', () => {
  const TOP = ['w:pwr', 'w:pac', 'w:e1', 'w:celt']

  it('are top flights to leagueTier, and the second tiers keep their weight', () => {
    for (const id of TOP) expect(leagueTier(id)).toBe(1)
    expect(leagueTier('w:champ')).toBe(2)
    expect(LEAGUE_TIER['w:champ']).toBeUndefined()
  })

  it('a club is a fallen giant for slipping, not for being in one', () => {
    const g = newGame(LEAGUE_DEFS('w')[0].clubs[0].id, 'Chair', 75, undefined, 'coach', 'w', 'w')
    const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
    // the strongest club in each top flight, with two titles behind it: a
    // pedigree, and nothing fallen about it
    for (const lg of TOP) {
      const best = Object.values(g.clubs).filter(c => c.leagueId === lg).sort((a, b) => b.rep - a.rep)[0]
      g.history.push({ season: g.season - 1, compId: lg, champion: best.id }, { season: g.season - 2, compId: lg, champion: best.id })
      expect(jobProfile(g, best.id)).not.toBe('fallen')
    }
    for (const c of Object.values(g.clubs).filter(c => TOP.includes(c.leagueId))) {
      if (jobProfile(g, c.id) !== 'fallen') continue
      const lgRep = med(Object.values(g.clubs).filter(x => x.leagueId === c.leagueId && x.players.length > 0).map(x => x.rep))
      expect(c.rep).toBeLessThanOrEqual(lgRep - 2)
    }
  })
})
