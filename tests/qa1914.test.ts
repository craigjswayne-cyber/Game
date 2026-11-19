/**
 * ---- 1.9.14 RELEASE QA ----
 * What the five QA passes found, held shut:
 *   Pro money   the treasury, an injection credit: not under Shoestring or Fire Sale
 *   Pro goals   a title that took the club up still counts; a national trophy
 *               is not the club's
 *   pre-contract binding: no release and sign back, no old bid accepted
 *   women       every club starts at the matchday minimum in every shirt
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { proGoalMet, startProChallenge } from '../src/game/prochallenge'
import { releaseToBudget } from '../src/game/treasury'
import { applyInjection } from '../src/game/grants'
import { freeAgentDemand, offerFreeAgent, respondToOffer } from '../src/game/ai'
import type { GameState, Pos } from '../src/game/model'

const MIN: [Pos, number][] = [['LP', 2], ['HK', 2], ['TP', 2], ['LK', 3], ['FL', 3], ['N8', 1], ['SH', 2], ['FH', 2], ['CE', 3], ['WG', 3], ['FB', 1]]

describe('1.9.14 QA: Pro money doors', () => {
  it('the treasury slider and a banked credit do not feed a Shoestring budget', () => {
    const g = newGame('leicester', 'QA', 91)
    startProChallenge(g, 'shoestring')
    const club = g.clubs[g.userClubId]
    club.balance += 20_000_000
    const before = club.budget
    expect(releaseToBudget(g, 5_000_000).ok).toBe(false)
    expect(applyInjection(g, 's')).toBe(false)
    expect(club.budget).toBe(before)
  })
})

describe('1.9.14 QA: Pro goals', () => {
  it('Fire Sale: a league title counts after promotion moved the club up', () => {
    const g = newGame('leicester', 'QA', 91)
    startProChallenge(g, 'firesale')
    const c = g.proChallenge!
    const league = Object.values(g.comps).find(x => x.type === 'league' && x.id !== g.clubs[g.userClubId].leagueId)!
    g.history.push({ season: g.season, compId: league.id, champion: g.userClubId })
    expect(proGoalMet(g, c)).toBe(true)
  })

  it('Academy Only: a trophy won with the country is not the club\'s', () => {
    const g = newGame('leicester', 'QA', 91)
    startProChallenge(g, 'academy')
    const c = g.proChallenge!
    const intl = Object.values(g.comps).find(x => x.type === 'intl' || x.isNational)
    if (!intl) return
    g.mgr.trophies.push({ compId: intl.id, season: g.season, clubId: g.userClubId })
    expect(proGoalMet(g, c)).toBe(false)
  })
})

const preContracted = (g: GameState) => {
  const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(x => !x.acad)!
  const to = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.players.length)!
  ;(g.preContracts ??= []).push({ playerId: p.id, toClubId: to.id, week: g.week })
  return { p, to }
}

describe('1.9.14 QA: a pre-contract is binding', () => {
  it('a released man who has signed elsewhere cannot be signed back', () => {
    const g = newGame('bath', 'QA', 9)
    const { p } = preContracted(g)
    const club = g.clubs[g.userClubId]
    club.players = club.players.filter(id => id !== p.id)
    p.clubId = null
    // first, that the same offer signs a man with no pre-contract
    const free = Object.values(g.players).find(x => x.clubId == null && !x.retired && x.id !== p.id && freeAgentDemand(x, 3) < 3000)
    if (free) expect(offerFreeAgent(g, free.id, freeAgentDemand(free, 3), 3).ok).toBe(true)
    const r = offerFreeAgent(g, p.id, freeAgentDemand(p, 3), 3)
    expect(r.ok).toBe(false)
    expect(r.msg).toContain(p.name)
    expect(g.preContracts!.some(pc => pc.playerId === p.id)).toBe(true)
  })

  it('a bid lodged before the announcement cannot be accepted', () => {
    const g = newGame('bath', 'QA', 9)
    const { p, to } = preContracted(g)
    g.offers.push({ id: 999_999, playerId: p.id, fromClubId: to.id, toClubId: g.userClubId, fee: 5_000_000, week: g.week, forUser: true, status: 'pending' })
    respondToOffer(g, 999_999, true)
    expect(g.offers.find(o => o.id === 999_999)!.status).toBe('rejected')
    expect((g.pendingDeals ?? []).some(d => d.playerId === p.id)).toBe(false)
  })
})

describe('1.9.14 QA: women\'s squads', () => {
  it('every women\'s club starts at the matchday minimum in every shirt', () => {
    const g = newGame('w:bristol', 'QA', 4242, undefined, 'coach', 'w')
    const short: string[] = []
    for (const c of Object.values(g.clubs)) {
      if (!c.players.length) continue
      for (const [pos, n] of MIN) {
        const cover = c.players.reduce((k, id) => {
          const p = g.players[id]
          if (!p || p.acad) return k
          return k + (p.pos === pos ? 1 : 0) + ((p.alt ?? []).includes(pos) ? 0.5 : 0)
        }, 0)
        if (cover < n) short.push(`${c.name} ${pos} ${cover}/${n}`)
      }
    }
    expect(short).toEqual([])
  })
})
