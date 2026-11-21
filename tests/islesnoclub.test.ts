/**
 * ---- A COUNTRY AND NO CLUB IS STILL A CANDIDATE (1.9.16) ----
 *
 * The owner's sentence for the Isles XV job: top reputation, coaching
 * internationally, has won something. Nothing about a club. islesEligible
 * turned away anyone flagged `unemployed`, which only means "no club", so a
 * coach who took England and nothing else (the paid international start, or a
 * man who resigned his club for his country) could never be asked.
 */
import { describe, expect, it } from 'vitest'
import { LEAGUE_DEFS, newGame } from '../src/game/newgame'
import { beginInternational, hostClub } from '../src/game/intlstart'
import { islesEligible } from '../src/game/isles'
import { isLionsSeason } from '../src/game/schedule'

describe('Isles XV eligibility', () => {
  it('asks a national coach who has no club', () => {
    const g = newGame(hostClub(LEAGUE_DEFS('m'), 'ENG'), 'No Club', 5, undefined, 'coach', 'm')
    beginInternational(g, 'ENG')
    expect(g.unemployed).toBe(true)
    while (!isLionsSeason(g.season)) g.season++
    g.licensed = true
    g.mgr.trophies.push({ compId: 'sn', season: 1 } as never)
    expect(islesEligible(g)).toEqual({ ok: true, why: 'isles.whyYes' })
  })
  it('still turns away a coach with no country', () => {
    const g = newGame('leicester', 'Club Only', 5)
    while (!isLionsSeason(g.season)) g.season++
    g.licensed = true
    g.mgr.trophies.push({ compId: 'sn', season: 1 } as never)
    expect(islesEligible(g).why).toBe('isles.whyNotIntl')
  })
})
