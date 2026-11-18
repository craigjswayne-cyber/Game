/**
 * ---- PRO CHALLENGES AND THE MOMENT OFFER (1.9.14) ----
 *   Fire Sale    five best gone before day one, no money to the budget
 *   Academy Only no bid, loan, free agent or pre-contract comes in
 *   Shoestring   half the budget, wage room held to the bill, no board money
 *   the summer   a goal met is a badge; a deadline passed ends the career;
 *                leaving the club voids it
 *   the moment   a big moment for a player 40 matches deep makes the
 *                one-time price due once more, once
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { FIRESALE_COUNT, PRO_SEASONS, applyShoestring, proBlocksMoney, proCheck, proSeasonVerdict, startProChallenge } from '../src/game/prochallenge'
import { agreeFee, offerFreeAgent } from '../src/game/ai'
import { loanIn } from '../src/game/loans'
import { requestFunds } from '../src/game/season/board'
import { capBill } from '../src/game/cap'
import { FRESH, MOMENT_MIN, proDue, proMoment, proShown, type Funnel } from '../src/game/profunnel'
import type { GameState } from '../src/game/model'

const fresh = () => newGame('leicester', 'Pro', 91)
const other = (g: GameState) => Object.values(g.players).find(p => p.clubId && p.clubId !== g.userClubId && !p.acad)!

describe('Pro challenges', () => {
  it('Fire Sale sells the five best before day one, and none of it is budget', () => {
    const g = fresh()
    const club = g.clubs[g.userClubId]
    const best = club.players.map(id => g.players[id]).filter(p => !p.acad).sort((a, b) => b.ca - a.ca).slice(0, FIRESALE_COUNT).map(p => p.id)
    const budget = club.budget
    startProChallenge(g, 'firesale')
    for (const id of best) expect(g.players[id].clubId).not.toBe(g.userClubId)
    expect(club.budget).toBeLessThanOrEqual(budget)
    expect(g.news.some(n => n.k === 'news.proStartSold')).toBe(true)
  })

  it('Academy Only lets nobody in', () => {
    const g = fresh()
    startProChallenge(g, 'academy')
    const p = other(g)
    expect(agreeFee(g, p.id, 1000).ok).toBe(false)
    expect(loanIn(g, p.id)).toBeTruthy()
    expect(p.clubId).not.toBe(g.userClubId)
    const fa = other(g)
    g.clubs[fa.clubId!].players = g.clubs[fa.clubId!].players.filter(id => id !== fa.id); fa.clubId = null
    expect(offerFreeAgent(g, fa.id, 999_999, 2).ok).toBe(false)
  })

  it('Shoestring halves the budget, holds wage room to the bill, and refuses board money', () => {
    const g = fresh()
    const club = g.clubs[g.userClubId]
    const budget = club.budget
    startProChallenge(g, 'shoestring')
    expect(club.budget).toBeLessThanOrEqual(Math.round(budget / 2 / 50_000) * 50_000 + 1)
    expect(club.wageBudget).toBeGreaterThanOrEqual(capBill(g, club))
    expect(proBlocksMoney(g)).toBe(true)
    expect(requestFunds(g)).toMatch(/./)
    const b = club.budget
    applyShoestring(g) // a summer later
    expect(club.budget).toBeLessThan(b + 1)
  })

  it('a goal met is a badge, and the career carries on', () => {
    const g = fresh()
    startProChallenge(g, 'academy')
    g.mgr.trophies.push({ compId: 'prem', season: g.season, clubId: g.userClubId })
    g.season += 1
    proCheck(g)
    expect(g.proChallenge?.done).toBe(true)
    expect(g.challengesDone).toContain('pro.academy')
    expect(g.careerOver ?? null).toBeNull()
  })

  it('Shoestring counts a run of targets met, and a miss resets it', () => {
    const g = fresh()
    startProChallenge(g, 'shoestring')
    proSeasonVerdict(g, true); proSeasonVerdict(g, true); proSeasonVerdict(g, false)
    expect(g.proChallenge!.streak).toBe(0)
    proSeasonVerdict(g, true); proSeasonVerdict(g, true); proSeasonVerdict(g, true)
    g.season += 1
    proCheck(g)
    expect(g.proChallenge?.done).toBe(true)
  })

  it('a deadline passed ends the career', () => {
    const g = fresh()
    startProChallenge(g, 'firesale')
    g.season += PRO_SEASONS.firesale - 1
    proCheck(g)
    expect(g.careerOver ?? null).toBeNull() // still in time
    g.season += 1
    proCheck(g)
    expect(g.unemployed).toBe(true)
    expect(g.careerOver?.k).toBe('over.proFailed')
    expect(g.news.some(n => n.k === 'news.proFailed')).toBe(true)
  })

  it('leaving the club voids it', () => {
    const g = fresh()
    startProChallenge(g, 'academy')
    g.unemployed = true
    proCheck(g)
    expect(g.proChallenge ?? null).toBeNull()
  })
})

describe('the moment offer', () => {
  const base = (played: number): Funnel => ({ ...FRESH, seen: [], firstPromptShown: true, firstOfferShown: true, firstOfferDeclined: true, played, remindAt: played + 5 })
  it('only for a player deep in, once', () => {
    expect(proMoment(base(MOMENT_MIN - 1)).momentDue).toBe(false)
    const due = proMoment(base(MOMENT_MIN + 3))
    expect(due.momentDue).toBe(true)
    expect(proDue(due, false)).toBe('moment')
    const shown = proShown(due, 'moment')
    expect(shown.momentShown).toBe(true)
    expect(proDue(shown, false)).not.toBe('moment')
    expect(proMoment(shown).momentDue).toBe(false)
  })
})
