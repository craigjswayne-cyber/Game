// 1.9.17, from a player's feedback: any change of a stoppage can be taken
// back (not only the newest), a penalty has a mark that changes the kick, a
// renewal can be offered for a chosen length, and a man out on loan gives up
// his place in the development focus.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { beginMatch, makeSubstitution, stepTick, resolveDecision, undoSubstitution } from '../src/game/matchEngine'
import { markAdj, penMark, penWide } from '../src/game/match/kicking'
import { renewalDemandFor, renewalTerm } from '../src/game/ai'
import { loanOut } from '../src/game/loans'
import { mulberry32 } from '../src/game/rng'
import { beginInternational } from '../src/game/intlstart'
import { pressWhy, userResults } from '../src/game/pressmood'
import { testTone } from '../src/game/natnoise'

function match(seed: number) {
  const g = newGame('bath', 'Seventeen', seed)
  let fx = userFixtureThisWeek(g)
  while (!fx) { processWeekAndAdvance(g); fx = userFixtureThisWeek(g) }
  const ctx = beginMatch(g, fx, mulberry32(3), true, g.userClubId)
  const mine = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
  for (let i = 0; i < 3; i++) { stepTick(g, ctx); if (ctx.decision) resolveDecision(g, ctx, 'posts') }
  return { g, ctx, mine }
}

describe('1.9.17', () => {
  it('takes back the first of two changes and leaves the second standing', () => {
    const { g, ctx, mine } = match(99)
    const on = mine.lineup.slice(0, 15).filter(id => id != null && mine.onPitch.has(id)) as number[]
    const bench = mine.lineup.slice(15).filter(id => id != null && !mine.onPitch.has(id) && !mine.ratings.has(id)) as number[]
    const [a, b] = [on[9], on[12]]
    const [x, y] = [bench[bench.length - 1], bench[bench.length - 2]]
    const used = ctx.subsUsed
    makeSubstitution(g, ctx, a, x)
    makeSubstitution(g, ctx, b, y)
    expect(ctx.subsUsed).toBe(used + 2)
    expect(ctx.subStack?.length).toBe(2)
    undoSubstitution(g, ctx, x)
    expect(mine.onPitch.has(a)).toBe(true)
    expect(mine.onPitch.has(x)).toBe(false)
    expect(mine.onPitch.has(y)).toBe(true)
    expect(mine.onPitch.has(b)).toBe(false)
    expect(ctx.subsUsed).toBe(used + 1)
    expect(ctx.subStack?.map(s => s.inId)).toEqual([y])
    expect(ctx.lastSub?.inId).toBe(y)
    // and play resuming closes the window on the one left
    stepTick(g, ctx)
    expect(ctx.subStack?.length ?? 0).toBe(0)
  })

  it('a chain of changes unpicks from the newest end, back to how it was', () => {
    const { g, ctx, mine } = match(99)
    const before = [...mine.lineup]
    const a = mine.lineup[9]!
    const bench = mine.lineup.slice(15).filter(id => id != null && !mine.onPitch.has(id) && !mine.ratings.has(id)) as number[]
    const used = ctx.subsUsed
    makeSubstitution(g, ctx, a, bench[0])
    makeSubstitution(g, ctx, bench[0], bench[1])
    for (const u of [...(ctx.subStack ?? [])].reverse()) undoSubstitution(g, ctx, u.inId)
    expect(ctx.subsUsed).toBe(used)
    expect(mine.onPitch.has(a)).toBe(true)
    expect([...mine.lineup].sort()).toEqual([...before].sort())
    expect(ctx.subStack?.length ?? 0).toBe(0)
  })

  it('a longer, wider penalty is a harder kick, and the mark is the same every time it is asked', () => {
    const { ctx, mine } = match(7)
    expect(markAdj({ len: 20, wide: 0 })).toBeGreaterThan(markAdj({ len: 45, wide: 0 }))
    expect(markAdj({ len: 35, wide: 2 })).toBeGreaterThan(markAdj({ len: 35, wide: 28 }))
    expect(markAdj({ len: 70, wide: 30 })).toBeGreaterThanOrEqual(-0.22)
    expect(markAdj({ len: 5, wide: 0 })).toBeLessThanOrEqual(0.12)
    const w = penWide(ctx, mine, 31)
    expect(penWide(ctx, mine, 31)).toBe(w)
    expect(Math.abs(w)).toBeLessThanOrEqual(30)
    const m = penMark(ctx, mine, w)
    expect(m.len).toBeGreaterThanOrEqual(m.dist)
  })

  it('a renewal costs more the further it is from the length he wants', () => {
    const g = newGame('bath', 'Terms', 5)
    const p = Object.values(g.players).find(q => q.clubId === g.userClubId && !q.onLoan)!
    const own = renewalTerm(p)
    const base = renewalDemandFor(p, own)
    for (const y of [1, 2, 3]) {
      if (y === own) expect(renewalDemandFor(p, y)).toBe(base)
      else expect(renewalDemandFor(p, y)).toBeGreaterThan(base)
    }
  })

  it('a man sent out on loan leaves the development focus', () => {
    const g = newGame('bath', 'Loan', 11)
    const mineP = Object.values(g.players).filter(q => q.clubId === g.userClubId && !q.onLoan)
    let sent = 0
    for (const p of mineP.sort((x, y) => x.age - y.age)) {
      g.devFocus = [p.id]
      const r = loanOut(g, p.id)
      if (r.ok) { sent = p.id; break }
    }
    expect(sent).not.toBe(0)
    expect(g.devFocus.includes(sent)).toBe(false)
  })

  it('a national coach with no club: every Test files the press and the supporters, and the barometer reads his Tests, not a club', () => {
    const g = newGame('bath', 'Coach', 42)
    expect(beginInternational(g, 'ENG')).toBe(true)
    let guard = 0
    while ((g.natRecord?.m ?? 0) < 2 && guard++ < 40) processWeekAndAdvance(g)
    const tests = g.natRecord?.m ?? 0
    expect(tests).toBeGreaterThanOrEqual(2)
    const press = g.news.filter(n => n.k?.startsWith('news.tnPress_'))
    const social = g.news.filter(n => n.k?.startsWith('news.tnSocial_'))
    expect(press.length).toBe(tests)
    expect(social.length).toBeGreaterThanOrEqual(tests)
    for (const n of [...press, ...social]) expect(n.v?.nat_n).toBe('ENG')
    const reads = userResults(g)
    expect(reads.length).toBe(tests)
    expect(reads.every(r => r.fx.homeId === 'ENG' || r.fx.awayId === 'ENG')).toBe(true)
    // and a home Test is written up from his side, not the visitors'
    for (const n of g.news.filter(x => x.k === 'news.result')) {
      const fx = g.fixtures.find(f => f.played && f.week === n.week && (f.homeId === 'ENG' || f.awayId === 'ENG'))
      if (!fx) continue
      const us = fx.homeId === 'ENG' ? fx.homeScore : fx.awayScore
      expect(n.v?.us).toBe(us)
    }
    const why = pressWhy(g)
    expect(JSON.stringify(why)).not.toContain('Bath')
  })

  it('the tone is read off the result: a hiding is not a narrow defeat', () => {
    const g = newGame('bath', 'Tone', 42)
    beginInternational(g, 'ENG')
    expect(testTone(g, 'ENG', 'NZL', 40, 10)).toBe('rout')
    expect(testTone(g, 'ENG', 'NZL', 10, 40)).toBe('shock')
    expect(testTone(g, 'ENG', 'ITA', 20, 20)).toBe('draw')
    expect(['narrow', 'loss']).toContain(testTone(g, 'ENG', 'NZL', 18, 22))
  })
})
