/**
 * ---- WHO CAN BE SENT OUT AT KICK-OFF (1.9.4 audit) ----
 *
 * lineupFor is the one door every match's twenty-three goes through. 1.9.4
 * taught it to check the club bench as well as the fifteen ("THE BENCH TOO",
 * match/selection.ts). These hold that, and the holes the audit found beside
 * it:
 *
 *   - a club sheet: an injured, banned, loaned-out, called-up, departed or
 *     on-leave man is never sent out, in the XV or on the bench, and the same
 *     man is never in two shirts
 *   - a club sheet longer than twenty-three (a hand-edited or imported save)
 *     does not buy extra replacements
 *   - the national coach's Test sheet: it was kept whenever the fifteen were
 *     uninjured and in the squad, so a man still banned (a ban only runs down
 *     in a week his club plays) started, and an injured man on the bench was
 *     named and could be sent on
 *   - a sheet cut short (a damaged save) was played short, six men a side
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { lineupFor, autoSelect, availablePlayers } from '../src/game/match/selection'
import { beginMatch } from '../src/game/matchEngine'
import { matchRng, processWeekAndAdvance, userMatchThisWeek } from '../src/game/season'
import { applyPinnacle } from '../src/game/grants'
import type { GameState, Player } from '../src/game/model'

const injure = (p: Player) => { p.injury = { desc: 'Hamstring', until: 99, weeks: 4 } as Player['injury'] }

/** a man who could not lawfully take the field, for each way of being one */
const ABSENT: [string, (g: GameState, p: Player) => void][] = [
  ['injured', (_g, p) => injure(p)],
  ['banned', (_g, p) => { p.bans = 1 }],
  ['loaned out', (_g, p) => { p.onLoan = true }],
  ['called up', (_g, p) => { p.natSquad = true }],
  ['on leave', (_g, p) => { p.maternity = { until: 99 } as unknown as Player['maternity'] }],
  ['sold', (g, p) => {
    const other = Object.values(g.clubs).find(c => c.id !== g.userClubId)!
    g.clubs[g.userClubId].players = g.clubs[g.userClubId].players.filter(id => id !== p.id)
    other.players.push(p.id); p.clubId = other.id
  }],
  ['released', (g, p) => {
    g.clubs[g.userClubId].players = g.clubs[g.userClubId].players.filter(id => id !== p.id)
    p.clubId = null
  }],
]

function fresh(): GameState {
  const g = newGame('leicester', 'Selector', 77)
  const club = g.clubs[g.userClubId]
  club.tactic.lineup = autoSelect(g, availablePlayers(g, club.players))
  club.tactic.userPicked = true
  return g
}

describe('the club sheet at kick-off', () => {
  for (const [what, make] of ABSENT) {
    for (const slot of [3, 9, 15, 20]) {
      it(`a man ${what} in shirt ${slot + 1} is not sent out`, () => {
        const g = fresh()
        const club = g.clubs[g.userClubId]
        const id = club.tactic.lineup[slot]!
        make(g, g.players[id])
        const lu = lineupFor(g, g.userClubId)
        expect(lu).not.toContain(id)
        expect(lu.length).toBe(23)
        expect(lu.slice(0, 15).every(x => x != null)).toBe(true)
      })
    }
  }

  it('the same man in two shirts plays in one', () => {
    const g = fresh()
    const lu = g.clubs[g.userClubId].tactic.lineup
    lu[18] = lu[4]
    const out = lineupFor(g, g.userClubId).filter(x => x != null)
    expect(new Set(out).size).toBe(out.length)
  })

  it('a sheet longer than twenty-three does not buy more replacements', () => {
    const g = fresh()
    const club = g.clubs[g.userClubId]
    const named = new Set(club.tactic.lineup)
    const spare = club.players.filter(id => !named.has(id) && !g.players[id].injury && !g.players[id].acad).slice(0, 5)
    expect(spare.length).toBe(5)
    club.tactic.lineup = [...club.tactic.lineup, ...spare]
    const lu = lineupFor(g, g.userClubId)
    expect(lu.length).toBe(23)
    // and the match itself fields eight replacements, not thirteen
    const fx = g.fixtures.find(f => f.homeId === g.userClubId || f.awayId === g.userClubId)!
    const ctx = beginMatch(g, fx, matchRng(g), false)
    const side = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
    expect(side.benchIds.size).toBeLessThanOrEqual(8)
  })

  it('a sheet that is too short is filled, not played short', () => {
    const g = fresh()
    const club = g.clubs[g.userClubId]
    club.tactic.lineup = club.tactic.lineup.slice(0, 6)
    const lu = lineupFor(g, g.userClubId)
    expect(lu.length).toBe(23)
    expect(lu.slice(0, 15).every(x => x != null)).toBe(true)
  })
})

describe('the Test sheet at kick-off', () => {
  /** a national coach, in the week of his first Test */
  function testWeek(): { g: GameState; nat: string } {
    const g = newGame('leicester', 'Selector', 78)
    expect(applyPinnacle(g, 'ENG')).toBe(true)
    const nat = g.natTeam!
    for (let i = 0; i < 60; i++) {
      const fx = userMatchThisWeek(g)
      if (fx && (fx.homeId === nat || fx.awayId === nat) && (g.natSquads[nat]?.length ?? 0) >= 23) return { g, nat }
      processWeekAndAdvance(g)
    }
    throw new Error('no Test within sixty weeks')
  }
  function picked(g: GameState, nat: string) {
    const lu = autoSelect(g, availablePlayers(g, g.natSquads[nat], true))
    g.natLineup = { team: nat, lineup: lu }
    return lu
  }

  it('a man banned since the sheet was written does not start', () => {
    const { g, nat } = testWeek()
    const lu = picked(g, nat)
    const id = lu[5]!
    g.players[id].bans = 1
    expect(lineupFor(g, nat)).not.toContain(id)
  })

  it('an injured man on the Test bench is not named', () => {
    const { g, nat } = testWeek()
    const lu = picked(g, nat)
    const id = lu[19]!
    injure(g.players[id])
    expect(lineupFor(g, nat)).not.toContain(id)
  })

  it('a sound Test sheet is the coach\'s own, untouched', () => {
    const { g, nat } = testWeek()
    const lu = picked(g, nat)
    expect(lineupFor(g, nat)).toBe(lu)
  })

  it('a banned man is not in the side that kicks off', () => {
    const { g, nat } = testWeek()
    const lu = picked(g, nat)
    const id = lu[1]!
    g.players[id].bans = 1
    const fx = userMatchThisWeek(g)!
    const ctx = beginMatch(g, fx, matchRng(g), false, nat)
    const side = ctx.home.teamId === nat ? ctx.home : ctx.away
    expect(side.lineup).not.toContain(id)
  })
})
