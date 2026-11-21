/**
 * ---- A CAREER THAT BEGINS IN A NATIONAL JOB (1.9.16, intlstart.ts) ----
 */
import { describe, expect, it } from 'vitest'
import { LEAGUE_DEFS, newGame } from '../src/game/newgame'
import { beginInternational, hostClub, startNations } from '../src/game/intlstart'
import { pickableNations } from '../src/game/nations'
import { saveLabel } from '../src/game/save'
import { processWeekAndAdvance } from '../src/game/season'
import type { Gender } from '../src/game/gender'

const open = (nat: string, gender: Gender = 'm', seed = 21) => {
  const defs = LEAGUE_DEFS(gender)
  const g = newGame(hostClub(defs, nat), 'Cal', seed, undefined, 'coach', gender)
  return { g, ok: beginInternational(g, nat) }
}

describe('startNations', () => {
  for (const gender of ['m', 'w'] as const) {
    it(`offers exactly the unions the ${gender} world plays Tests for`, () => {
      const defs = LEAGUE_DEFS(gender)
      const g = newGame(defs[0].clubs[0].id, 'Cal', 3, undefined, 'coach', gender)
      expect([...startNations(gender)].sort()).toEqual(pickableNations(g).map(([n]) => n).sort())
    })
  }
  it('puts the biggest jobs first', () => { expect(startNations('m')[0]).toBe('NZL') })
})

describe('beginInternational', () => {
  it('starts him as England head coach with no club', () => {
    const { g, ok } = open('ENG')
    expect(ok).toBe(true)
    expect(g.natTeam).toBe('ENG')
    expect(g.unemployed).toBe(true)
    expect(g.natKeepAsk ?? null).toBeNull()
    expect(saveLabel(g)).toBe('England')
  })
  it('the inbox holds his appointment and nothing from a club he never managed', () => {
    const { g } = open('ENG')
    expect(g.news.length).toBeGreaterThan(0)
    expect(g.news.some(n => n.k === 'news.natAppointedOnly')).toBe(true)
    expect(g.news.some(n => n.k === 'news.appoint' || n.k === 'news.inheritedStaff' || n.k === 'news.resigned')).toBe(false)
  })
  it('the club he stands on is advertised, so the game gives it a coach', () => {
    const { g } = open('ENG')
    expect(g.vacancies.some(v => v.clubId === g.userClubId)).toBe(true)
  })
  it('a nation with no club in the game still starts (Tonga)', () => {
    const { g, ok } = open('TGA')
    expect(ok).toBe(true)
    expect(g.natTeam).toBe('TGA')
  })
  it('refuses a union the world has no Tests for, and leaves the world a club career', () => {
    const { g, ok } = open('TGA', 'w')
    expect(ok).toBe(false)
    expect(g.unemployed).toBe(false)
    expect(g.natTeam ?? null).toBeNull()
  })
  it('the women\'s game starts the same way', () => {
    const { g, ok } = open('ENG', 'w')
    expect(ok).toBe(true)
    expect(g.natTeam).toBe('ENG')
  })
  it('a whole season runs from that start: his country plays Tests, his host club gets a coach, he stays in the job or is told', () => {
    const { g } = open('ENG', 'm', 44)
    const host = g.userClubId
    const s0 = g.season
    let guard = 0
    while (g.season === s0 && guard++ < 70) {
      for (const n of g.news) n.read = true
      processWeekAndAdvance(g)
    }
    expect(g.season).toBe(s0 + 1)
    const tests = g.fixtures.concat([]).length
    expect(tests).toBeGreaterThan(0)
    expect((g.natRecord?.m ?? 0) > 0 || g.natTeam == null).toBe(true)
    expect(g.clubs[host].coach).toBeTruthy()
    expect(g.unemployed).toBe(true)
  }, 240_000)
})
