/**
 * ---- NO DESK, NO DEALS (1.9.4 audit) ----
 *
 * Out of work, userClubId still names the club that let him go (it is how
 * the Job Centre knows where he came from). The app sends a manager without a
 * job away from the desk screens (App.tsx, 19E), but a player's page is a
 * world screen and stays open, and every button on it called the engine with
 * nothing to say he had no club: he could sign a free agent, bid for a man,
 * renew, release or lend out the old club's players, all on the old club's
 * money. The engine refuses now, whichever screen asks.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { resignJob } from '../src/game/jobs'
import { agreeFee, agreePreContract, askingPrice, offerRenewalAt, renewalDemand, signFreeAgent, signOnTerms, personalTermsDemand } from '../src/game/ai'
import { releasePlayer } from '../src/game/release'
import { loanIn, loanOut, loanTargets } from '../src/game/loans'
import type { GameState } from '../src/game/model'

function outOfWork(): { g: GameState; old: string } {
  const g = newGame('leicester', 'Idle', 51)
  const old = g.userClubId
  resignJob(g)
  expect(g.unemployed).toBe(true)
  return { g, old }
}

describe('an unemployed manager', () => {
  it('cannot sign a free agent for the club that let him go', () => {
    const { g, old } = outOfWork()
    // a man an AI club has just let go
    const fa = Object.values(g.players).find(p => p.clubId && p.clubId !== old && !p.acad && p.ca < 55)!
    g.clubs[fa.clubId!].players = g.clubs[fa.clubId!].players.filter(id => id !== fa.id)
    fa.clubId = null
    const r = signFreeAgent(g, fa.id)
    expect(r.ok).toBe(false)
    expect(fa.clubId).toBeNull()
    expect(g.clubs[old].players).not.toContain(fa.id)
  })

  it('cannot buy a man for it', () => {
    // the same bid from a manager in work goes through: it is the desk refusing
    const working = newGame('leicester', 'Idle', 51)
    const target = Object.values(working.players).find(q => q.clubId && q.clubId !== 'leicester' && !q.acad && q.ca < 60 &&
      askingPrice(working, q) < working.clubs.leicester.budget / 2 && agreeFee(structuredClone(working), q.id, Math.round(askingPrice(working, q) * 1.5)).ok)!
    expect(target).toBeTruthy()
    const { g, old } = outOfWork()
    const before = g.clubs[old].balance
    const p = g.players[target.id]
    const r = agreeFee(g, p.id, Math.round(askingPrice(g, p) * 1.5))
    expect(r.ok).toBe(false)
    const s = signOnTerms(g, p.id, 5_000_000, personalTermsDemand(g, p) * 2, 0, false)
    expect(s.ok).toBe(false)
    expect(p.clubId).not.toBe(old)
    expect(g.clubs[old].balance).toBe(before)
  })

  it('cannot renew, release or lend out its players', () => {
    const { g, old } = outOfWork()
    const club = g.clubs[old]
    const ids = club.players.filter(id => !g.players[id].acad)
    const renew = g.players[ids[0]]
    const wage = renew.wage
    expect(offerRenewalAt(g, renew.id, Math.round(renewalDemand(renew) * 1.2)).ok).toBe(false)
    expect(renew.wage).toBe(wage)
    const before = club.balance
    // above the release floor, so only the missing desk can refuse it
    while (club.players.filter(id => !g.players[id].acad).length <= 25) {
      const spare = Object.values(g.players).find(p => p.clubId == null && !p.acad)!
      club.players.push(spare.id); spare.clubId = old
    }
    expect(releasePlayer(g, ids[1]).ok).toBe(false)
    expect(g.players[ids[1]].clubId).toBe(old)
    expect(club.balance).toBe(before)
    const young = ids.map(id => g.players[id]).find(p => p.age <= 23 && !club.tactic.lineup.slice(0, 15).includes(p.id))
    if (young) {
      loanOut(g, young.id)
      expect(young.onLoan).toBeFalsy()
    }
  })

  it('cannot borrow a man or pre-agree one for it', () => {
    const { g, old } = outOfWork()
    const t = loanTargets(g)[0] ?? Object.values(g.players).find(p => p.clubId && p.clubId !== old && p.age <= 23)!
    loanIn(g, t.id, 'season', 0.5)
    expect(t.clubId).not.toBe(old)
    const pc = Object.values(g.players).find(p => p.clubId && p.clubId !== old && p.contractEnds <= g.season && !p.acad)
    if (pc) {
      g.week = 30
      expect(agreePreContract(g, pc.id).ok).toBe(false)
      expect((g.preContracts ?? []).some(x => x.playerId === pc.id)).toBe(false)
    }
  })
})
