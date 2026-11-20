/**
 * ---- THE WINDOW AS A CAMPAIGN (1.9.14, natwin.ts) ----
 *
 *   camp opens        a target, one win per side ranked below, at least one
 *   the Tests         each one counts towards it
 *   the announcement  needs the floor, names debuts, moves the omitted
 *   the camp event    one per window, answered once, the same every time
 *   the review        met is a gain, missed a loss, under 20 ends the job
 *   the tenure's end  takes the era into the history
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { activeWindows } from '../src/game/season'
import { NAT_SQUAD_FLOOR } from '../src/game/country'
import { announceSquad, answerCampEvent, canAnnounce, noteWindowResult, openNatWindow, reviewNatWindow, windowTarget } from '../src/game/natwin'
import type { GameState } from '../src/game/model'

function camp(seed: number, nat = 'ENG'): { g: GameState; w: { id?: string; start: number; end: number } } {
  const g = newGame('leicester', 'Window', seed)
  g.natTeam = nat
  g.natConfidence = 60
  const w = activeWindows(g).filter(x => x.nations.includes(nat)).sort((a, b) => a.start - b.start)
    .find(x => g.fixtures.some(f => (f.homeId === nat || f.awayId === nat) && f.week >= x.start && f.week <= x.end))!
  g.week = w.start
  g.natSquads[nat] = []
  openNatWindow(g, w)
  return { g, w }
}
const fill = (g: GameState, n: number) => {
  const nat = g.natTeam!
  const ids = Object.values(g.players).filter(p => p.nat === nat && p.clubId && !p.injury).sort((a, b) => b.ca - a.ca).slice(0, n).map(p => p.id)
  g.natSquads[nat] = ids
  for (const id of ids) g.players[id].natSquad = true
}

describe('the window campaign', () => {
  it('opens with a target the fixture list can meet', () => {
    const { g, w } = camp(41)
    expect(g.natWin?.tests).toBeGreaterThan(0)
    expect(g.natWin!.target).toBeGreaterThanOrEqual(1)
    expect(g.natWin!.target).toBeLessThanOrEqual(g.natWin!.tests)
    expect(windowTarget(g, 'ENG', w.start, w.end).target).toBe(g.natWin!.target)
    expect(g.news.some(n => n.k === 'news.natTarget')).toBe(true)
    // opening twice is one window
    const before = g.news.length
    openNatWindow(g, w)
    expect(g.news.length).toBe(before)
  })

  it('counts the Tests', () => {
    const { g } = camp(42)
    noteWindowResult(g, 30, 10); noteWindowResult(g, 10, 10); noteWindowResult(g, 3, 20)
    expect([g.natWin!.w, g.natWin!.d, g.natWin!.l]).toEqual([1, 1, 1])
  })

  it('announces only a squad named to the floor, once', () => {
    const { g } = camp(43)
    fill(g, NAT_SQUAD_FLOOR - 1)
    expect(canAnnounce(g, NAT_SQUAD_FLOOR)).toBe(false)
    fill(g, 32)
    expect(canAnnounce(g, NAT_SQUAD_FLOOR)).toBe(true)
    const r = announceSquad(g, [])
    expect(r).not.toBeNull()
    expect(r!.debuts.every(id => (g.players[id].caps ?? 0) === 0)).toBe(true)
    expect(g.natWin!.announced).toBe(true)
    expect(announceSquad(g, [])).toBeNull()
    expect(g.news.some(n => n.k === 'news.natAnnounced')).toBe(true)
  })

  it('a big name left out takes it badly', () => {
    const { g } = camp(44)
    fill(g, 32)
    const out = g.natSquads.ENG.pop()!
    g.players[out].natSquad = false
    g.players[out].caps = 40
    g.natPrevSquad = [...g.natSquads.ENG, out]
    // a coach with no club: no two-jobs quota decides it for him (1.9.15,
    // a man the rule keeps out is not "left out")
    g.unemployed = true
    const m = g.players[out].morale
    const r = announceSquad(g, [])!
    expect(r.omitted).toContain(out)
    expect(g.players[out].morale).toBeLessThan(m)
    expect(r.tone).toBe('shock')
  })

  it('the camp throws up one event, the same every time, answered once', () => {
    const a = camp(45); fill(a.g, 32); announceSquad(a.g, [])
    const b = camp(45); fill(b.g, 32); announceSquad(b.g, [])
    expect(a.g.natWin!.event).toEqual(b.g.natWin!.event)
    const e = a.g.natWin!.event!
    expect(e).toBeTruthy()
    expect(answerCampEvent(a.g, 'b', NAT_SQUAD_FLOOR)).toBe(true)
    expect(a.g.natWin!.event!.answer).toBe('b')
    expect(answerCampEvent(a.g, 'a', NAT_SQUAD_FLOOR)).toBe(false)
  })

  it('reviews the window: met is a gain, missed a loss', () => {
    const met = camp(46)
    met.g.natWin!.w = met.g.natWin!.target
    met.g.week = met.w.end + 1
    reviewNatWindow(met.g, met.w.start)
    expect(met.g.natWin!.review!.met).toBe(true)
    expect(met.g.natConfidence).toBe(64)
    const miss = camp(46)
    miss.g.natWin!.w = 0
    miss.g.natWin!.target = 2
    miss.g.week = miss.w.end + 1
    reviewNatWindow(miss.g, miss.w.start)
    expect(miss.g.natWin!.review!.met).toBe(false)
    expect(miss.g.natConfidence).toBe(52) // missed by two: -8 (1.9.15)
    // once
    reviewNatWindow(miss.g, miss.w.start)
    expect(miss.g.natConfidence).toBe(52)
  })

  it('below 20 the union ends it, and the era goes into the history', () => {
    const { g, w } = camp(47)
    g.natConfidence = 24
    g.natRecord = { m: 3, w: 0, d: 0, l: 3 }
    g.natEra = { nat: 'ENG', bestRank: 4, debuts: [1, 2] }
    g.natWin!.target = 2
    g.week = w.end + 1
    reviewNatWindow(g, w.start)
    expect(g.natTeam).toBeNull()
    expect(g.natLastReview?.review?.sacked).toBe(true)
    const h = g.natHistory!.at(-1)!
    expect(h).toMatchObject({ nat: 'ENG', m: 3, best: 4, debuts: 2 })
    expect(g.natWin).toBeNull()
  })
})
