// Option B (owner, 1.9.6): a lad of the club's own academy, 19 or under, sent
// back down goes back as a scholar and stops taking a senior place; anyone
// older, or bought in, is sent down on his senior contract as before.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { healBackToAcademy, sendDown } from '../src/game/acadcall'
import { seniorsOf } from '../src/game/transferRules'
import { capBill } from '../src/game/ai'
import { playerWage, firstProWage } from '../src/game/attributes'
import { migrate } from '../src/game/save'

function setup() {
  const g = newGame('aurillac', 'Back', 5)
  const club = g.clubs[g.userClubId]
  // the cheapest first: the marquee pair sit outside the cap bill
  const seniors = club.players.map(id => g.players[id]).filter(p => !p.acad && !(club.marquee ?? []).includes(p.id))
    .sort((a, b) => a.wage - b.wage)
  return { g, club, seniors }
}

describe('sending a man down', () => {
  it('sends our own 19-year-old back as a scholar, off the 46 and the cap', () => {
    const { g, club, seniors } = setup()
    const lad = seniors[0]
    lad.age = 19; lad.gradClub = g.userClubId; lad.homegrown = true
    lad.wage = firstProWage(lad.ca, lad.age)
    const before = seniorsOf(g, club), billBefore = capBill(g, club)
    expect(sendDown(g, lad)).toBe('academy')
    expect(lad.acad).toBe(true)
    expect(lad.demoted).toBe(false)
    expect(lad.wage).toBe(playerWage(lad.ca, lad.age, true))
    expect(seniorsOf(g, club)).toBe(before - 1)
    expect(capBill(g, club)).toBeLessThan(billBefore)
  })
  it('keeps a senior, or a bought-in youngster, on his contract and in the count', () => {
    const { g, club, seniors } = setup()
    const old = seniors[1]; old.age = 27; old.gradClub = g.userClubId
    const bought = seniors[2]; bought.age = 19; bought.gradClub = 'bath'
    const twenty = seniors[4]; twenty.age = 20; twenty.gradClub = g.userClubId
    const before = seniorsOf(g, club), w = old.wage
    expect(sendDown(g, old)).toBe('senior')
    expect(sendDown(g, bought)).toBe('senior')
    // 20 would walk at the summer sweep (21 leaves), so he keeps his contract
    expect(sendDown(g, twenty)).toBe('senior')
    expect(old.demoted && bought.demoted).toBe(true)
    expect(old.wage).toBe(w)
    expect(seniorsOf(g, club)).toBe(before)
  })
  it('heals a save made before the rule, once', () => {
    const { g, club, seniors } = setup()
    const lad = seniors[3]
    lad.age = 19; lad.gradClub = g.userClubId; lad.acad = true; lad.demoted = true
    const before = seniorsOf(g, club)
    const back = migrate(JSON.parse(JSON.stringify(g)))
    const p = back.players[lad.id]
    expect(p.demoted).toBe(false)
    expect(seniorsOf(back, back.clubs[back.userClubId])).toBe(before - 1)
    healBackToAcademy(back)
    expect(back.players[lad.id].demoted).toBe(false)
  })
})
