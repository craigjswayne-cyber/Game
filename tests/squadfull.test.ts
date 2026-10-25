// "Squad full" adds up (1.9.6, a French bug report: 45 in the first team, and
// told 46 was the limit). A senior moved down to the academy still counts, and
// the message now says how many of those there are.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { SQUAD_LIMIT, seniorsOf, squadFull, squadFullMsg } from '../src/game/ai'

describe('the squad-full message', () => {
  const g = newGame('aurillac', 'Full', 3)
  const seniors = Object.values(g.players).filter(p => !p.acad).slice(0, SQUAD_LIMIT)
  it('is the plain one when nobody was moved down', () => {
    const club = { players: seniors.map(p => p.id) }
    expect(squadFull(g, club)).toBe(true)
    expect(squadFullMsg(g, club)).not.toContain('academy')
  })
  it('counts a demoted senior, and says so', () => {
    const down = seniors[0]
    down.acad = true; down.demoted = true
    const club = { players: seniors.map(p => p.id) }
    expect(seniors.filter(p => !p.acad).length).toBe(SQUAD_LIMIT - 1)
    expect(seniorsOf(g, club)).toBe(SQUAD_LIMIT)
    expect(squadFull(g, club)).toBe(true)
    const msg = squadFullMsg(g, club)
    expect(msg).toContain(`${SQUAD_LIMIT} of the 46`)
    expect(msg).toContain('counting 1 moved down')
  })
})
