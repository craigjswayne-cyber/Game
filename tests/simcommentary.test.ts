// The commentary is true to the record (docs/match-sim-spec.md section 6, test 6).
// Over 200 matches: every line points at a real Play of a kind it may describe,
// every kind/result pair is said or on the documented silent list, every score
// quoted is the record's score, every team and man named is on the right side,
// every note (the score story, the men's numbers, the sides' patterns, the
// last ten minutes, the occasion) is worked out again here, independently, and
// found true, the feed thins to the pitch's schedule without losing a key
// line, and a match does not repeat itself.
import { describe, it, expect } from 'vitest'
import { simSkeleton, simWithDecisions } from '../src/game/sim/skeleton'
import { commentate, render, thin, SILENT, SUMMARY, FALLBACK, BASE_KINDS, MUST, type Line, type Context } from '../src/game/sim/commentary'
import { SIM_EN, EN_FLAT } from '../src/game/sim/commentary.en'
import type { Play, SimResult } from '../src/game/sim/record'
import type { World } from '../src/game/sim/world'

const TEAMS: [string, string] = ['Homeside', 'Awayside']
/** a world whose men carry their side in their id, so a test can tell whose man is named */
const namedWorld = (): World => {
  // a man replaced is picked no more: his replacement is picked in his place
  const on = new Map<string, string>()
  const id = (s: 0 | 1, role: string, r?: () => number) => { const x = `${s}:${role}${r ? Math.floor(r() * 15) + 1 : ''}`; return on.get(x) ?? x }
  return {
    str: () => 1,
    carrier: (s, _w, r) => id(s, 'c', r),
    tacklers: (s, _w, r) => [id(s, 't', r), id(s, 't', r)],
    jackal: (s, r) => id(s, 'j', r),
    kicker: (s, _b, r) => id(s, 'k', r),
    catcher: (s, r) => id(s, 'b', r),
    goalKicker: s => id(s, 'g'),
    thrower: s => id(s, 'h'),
    jumper: (s, r) => id(s, 'l', r),
    forward: (s, r) => id(s, 'f', r),
    // the bench says yes to every change but one man (so both a change made and one refused are in the record)
    decide: d => {
      if (d.kind !== 'substitution') return ''
      if (d.on.endsWith('r9')) return 'no such man on the bench'
      on.set(d.off, d.on)
      return ''
    },
  }
}
const names = { teams: TEAMS, player: (id: string) => `P${id}` }
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
/** the occasion for a match: every third a league match in the rain with captains, every fifth a derby */
const contextFor = (seed: number): Context => ({
  ...(seed % 3 === 0 ? { bonusPoints: true, weather: 'Rain' as const, captains: ['0:g', '1:h'] as [string, string], table: [3, 8] as [number, number] } : {}),
  ...(seed % 5 === 0 ? { derby: true, venue: 'The Ground', surface: 'artificial' as const } : {}),
})
const runs: { seed: number; r: SimResult; lines: Line[]; ctx: Context }[] = SEEDS.map(seed => {
  // one match in four has the manager changing men at 50 and 60 minutes
  const r = seed % 4 ? simSkeleton({ seed, world: namedWorld() }) : simWithDecisions({ seed, world: namedWorld(), decisions: [
    { at: { clock: 3000 }, decision: { kind: 'substitution', side: 0, off: '0:c3', on: '0:r1' } },
    { at: { clock: 3600 }, decision: { kind: 'substitution', side: 1, off: '1:c5', on: '1:r9' } },
  ] })
  const ctx = contextFor(seed)
  return { seed, r, lines: commentate(r, names, ctx), ctx }
})
const baseOf = (key: string) => key.replace(/^sim\./, '').replace(/\d+$/, '')
/** the play before n, stepping over substitutions (made at a dead ball, between a stoppage and its restart) */
const prevOf = (P: Play[], n: number, skipCards = false) => { let i = n - 1; while (i >= 0 && (P[i].kind === 'substitution' || (skipCards && (P[i].kind === 'yellowCard' || P[i].kind === 'redCard')))) i--; return P[i] }
const pair = (p: Play) => `${p.kind}/${p.result}`
const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)
const toLine = (s: 0 | 1, x: number) => (s === 0 ? 100 - x : x)
const clk = (p: Play) => p.clock ?? p.t
const halfIdx = (P: Play[]) => P.findIndex(p => p.kind === 'halfTime')

describe('the commentary is true to the record', () => {
  it('has words for every key, and no base ends in a digit', () => {
    for (const b of Object.keys(SIM_EN)) {
      expect(b, b).not.toMatch(/\d$/)
      expect(BASE_KINDS[b], `BASE_KINDS lacks ${b}`).toBeDefined()
    }
    for (const { lines } of runs) for (const l of lines) {
      expect(EN_FLAT[l.key], l.key).toBeDefined()
      expect(render(l), l.key).not.toMatch(/[{}]/)
      expect(render(l), 'never mentions advantage (not in this engine)').not.toMatch(/advantage/i)
    }
  })

  it('every line points at a real Play of a kind it may describe, with its clock', () => {
    for (const { r, lines } of runs) {
      let last = -1
      for (const l of lines) {
        const p = r.plays[l.n]
        expect(p, `line ${l.key} n ${l.n}`).toBeDefined()
        expect(p.n).toBe(l.n)
        expect(l.t, 'a line carries the referee\'s clock').toBe(p.clock ?? p.t)
        expect(BASE_KINDS[baseOf(l.key)], l.key).toContain(p.kind)
        expect(l.n, 'lines are in the order of the record').toBeGreaterThanOrEqual(last)
        last = l.n
      }
    }
  })

  it('every kind/result pair is said every time, or is on the silent list', () => {
    const seen = new Map<string, number>(), unsaid = new Map<string, number>()
    for (const { r, lines } of runs) {
      const said = new Set(lines.map(l => l.n))
      for (const p of r.plays) {
        const k = pair(p)
        seen.set(k, (seen.get(k) ?? 0) + 1)
        if (!SILENT[k] && !said.has(p.n)) unsaid.set(k, (unsaid.get(k) ?? 0) + 1)
      }
    }
    expect([...unsaid], 'pairs with plays that got no line').toEqual([])
    for (const k of Object.keys(SILENT)) expect(seen.has(k), `silent pair ${k} never happens`).toBe(true)
  })

  it('a kick left unsaid is the one caught cleanly by the other side, said with the catch', () => {
    for (const { r, lines } of runs) {
      const said = new Set(lines.map(l => l.n))
      for (const p of r.plays) if (p.kind === 'kick' && p.result === 'inPlay' && !said.has(p.n)) {
        const c = r.plays[p.n + 1]
        expect(c.kind === 'catch' && c.result === 'caught' && c.side !== p.side).toBe(true)
        expect(lines.some(l => l.n === c.n && baseOf(l.key) === 'kickCaught')).toBe(true)
      }
    }
  })

  it('never falls back to a line with no reason (every scrum, lineout, penalty and drop-out has its cause)', () => {
    const used = new Map<string, number>()
    for (const { lines } of runs) for (const l of lines) { const b = baseOf(l.key); if (FALLBACK.has(b)) used.set(b, (used.get(b) ?? 0) + 1) }
    expect([...used]).toEqual([])
  })

  it('the reason given is the play before', () => {
    const PREV: Record<string, (q: Play, p: Play) => boolean> = {
      penRuckDef: q => q.kind === 'ruck' && q.result === 'penaltyWon',
      penRuckAtt: q => q.kind === 'ruck' && q.result === 'penaltyLost',
      penScrum: q => q.kind === 'scrum' && (q.result === 'penaltyWon' || q.result === 'penaltyLost'),
      penMaul: q => q.kind === 'maul' && q.result === 'pulledDown',
      penLineout: q => q.kind === 'lineout' && q.result === 'penalty',
      penKick: q => q.kind === 'kick',
      scrumKnock: (q, p) => q.kind === 'knockOn' && q.side !== p.side,
      scrumForward: (q, p) => q.kind === 'forwardPass' && q.side !== p.side,
      scrumNotStraight: (q, p) => q.kind === 'notStraight' && q.side !== p.side,
      scrumUnplayable: q => q.kind === 'unplayable',
      scrumRestart: (q, p) => q.kind === 'restartError' && q.side !== p.side,
      scrumChoice: (q, p) => (q.kind === 'penalty' || q.kind === 'yellowCard' || q.kind === 'redCard') && (q.kind !== 'penalty' || q.side === p.side),
      loTouch: (q, p) => q.kind === 'kick' && q.result === 'touch' && q.side !== p.side,
      loPen: (q, p) => q.kind === 'kick' && q.result === 'penaltyToTouch' && q.side === p.side,
      loFifty: (q, p) => q.kind === 'kick' && q.result === 'fiftyTwentyTwo' && q.side === p.side,
      loFull: (q, p) => q.kind === 'kick' && q.result === 'outOnFull' && q.side !== p.side,
      loCarried: (q, p) => q.kind === 'intoTouch' && q.result === 'carried' && q.side !== p.side,
      loBounced: (q, p) => q.kind === 'intoTouch' && q.result === 'bounced' && q.side !== p.side,
      dropDead: q => q.kind === 'deadBall', dropPenMiss: q => q.kind === 'penaltyGoal' && !q.good, dropDropMiss: q => q.kind === 'dropGoal' && !q.good,
      dropGlHeld: q => q.kind === 'heldUp', dropGlTouched: q => q.kind === 'deadBall' && q.result === 'touchedDown',
      tapPen: q => q.kind === 'penalty' || q.kind === 'yellowCard' || q.kind === 'redCard', tapFree: q => q.kind === 'freeKick',
      unplayableRuck: q => q.kind === 'ruck' && q.result === 'unplayable', unplayableMaul: q => q.kind === 'maul' && q.result === 'stopped',
      heldUpMaul: q => q.kind === 'maul', koSecond: q => q.kind === 'halfTime',
      kickCaught: (q, p) => q.kind === 'kick' && q.result === 'inPlay' && q.side !== p.side,
    }
    for (const { r, lines } of runs) for (const l of lines) {
      const f = PREV[baseOf(l.key)]
      if (f) { const q = prevOf(r.plays, l.n); expect(f(q, r.plays[l.n]), `${l.key} at ${l.n} after ${pair(q)}`).toBe(true) }
    }
  })

  it('says what the law gives after a kick to touch, and the lineout that follows agrees', () => {
    let checked = 0
    for (const { r, lines } of runs) for (const l of lines) {
      const b = baseOf(l.key)
      if (b !== 'penTouch' && b !== 'fiftyTwentyTwo' && b !== 'outFull') continue
      const k = r.plays[l.n]
      let li = l.n + 1
      while (r.plays[li].kind === 'substitution') li++
      const lo = r.plays[li]
      if (lo.kind === 'halfTime' || lo.kind === 'fullTime') continue
      expect(lo.kind).toBe('lineout')
      expect(lo.side, l.key).toBe(b === 'outFull' ? other(k.side) : k.side)
      if (b === 'outFull') expect(lo.x).toBe(k.x)
      checked++
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('every score quoted is the record score at that Play', () => {
    let quoted = 0
    for (const { r, lines } of runs) for (const l of lines) {
      if (l.params.hs === undefined) continue
      expect([l.params.hs, l.params.as], l.key).toEqual(r.plays[l.n].score)
      expect(l.params.home).toBe(TEAMS[0]); expect(l.params.away).toBe(TEAMS[1])
      quoted++
    }
    expect(quoted).toBeGreaterThan(1000)
  })

  it('the team named is the team in the Play, and each man named plays for the side the words put him on', () => {
    for (const { r, lines } of runs) for (const l of lines) {
      const p = r.plays[l.n], b = baseOf(l.key)
      if (l.side === null) { expect(l.params.team).toBeUndefined(); continue }
      if (!SUMMARY.has(b)) expect(l.side, `${l.key} at ${pair(p)}`).toBe(p.side)
      expect(l.params.team).toBe(TEAMS[l.side])
      expect(l.params.opp).toBe(TEAMS[other(l.side)])
      for (const k of ['player', 'player2']) if (l.params[k] !== undefined) expect(String(l.params[k]), `${k} in ${l.key} at ${pair(p)}`).toMatch(new RegExp(`^P${l.side}:`))
      if (l.params.oppPlayer !== undefined) expect(String(l.params.oppPlayer), `oppPlayer in ${l.key}`).toMatch(new RegExp(`^P${other(l.side)}:`))
    }
  })

  it('every man named is in that Play (or, at a set piece or penalty, the play that caused it)', () => {
    const SET = new Set(['restartError', 'scrum', 'lineout', 'penalty', 'freeKick', 'tap', 'kickoff', 'dropout22', 'goalLineDropout', 'conversion', 'penaltyGoal'])
    for (const { r, lines } of runs) for (const l of lines) {
      const p = r.plays[l.n]
      const q1 = prevOf(r.plays, l.n), q2 = q1 ? prevOf(r.plays, q1.n) : undefined
      const cands = (SET.has(p.kind) ? [p, q1, q2] : [p, ...(['catch', 'intoTouch', 'heldUp'].includes(p.kind) ? [q1] : [])]).filter(Boolean) as Play[]
      for (const k of ['player', 'player2', 'oppPlayer']) {
        const v = l.params[k]
        if (v === undefined) continue
        const id = String(v).slice(1)
        expect(cands.some(q => q.who === id || q.vs?.includes(id) || q.with?.includes(id) || q.offender === id), `${l.key} names ${id} at ${pair(p)}`).toBe(true)
      }
    }
  })

  it('names the men the record names: scorer, kicker, catcher, thrower, jumper, carrier, tackler, jackal', () => {
    const named = new Map<string, number>(), missed = new Map<string, number>()
    for (const { r, lines } of runs) {
      const byN = new Map<number, Line[]>()
      for (const l of lines) byN.set(l.n, [...(byN.get(l.n) ?? []), l])
      for (const p of r.plays) {
        const ls = (byN.get(p.n) ?? []).filter(l => !SUMMARY.has(baseOf(l.key)))
        const all = ls.map(l => Object.values(l.params).join('|')).join('|')
        const want = (id: string | undefined, why: string) => {
          if (!id || !ls.length) return
          const ok = all.includes(`P${id}`)
          ;(ok ? named : missed).set(why, ((ok ? named : missed).get(why) ?? 0) + 1)
        }
        if (p.kind === 'try') want(p.who, 'try scorer')
        if (p.kind === 'dropGoal' || p.kind === 'dropout22' || p.kind === 'goalLineDropout') want(p.who, 'kicker')
        if (p.kind === 'tap' || p.kind === 'heldUp' || p.kind === 'maul') want(p.who, p.kind)
        if (p.kind === 'substitution') { want(p.who, 'man off'); want(p.with?.[0], 'man on') }
        if ((p.kind === 'penalty' || p.kind === 'freeKick') && p.offender) want(p.offender, 'offender')
        if (p.kind === 'carry' && p.result === 'intercepted') want(p.vs?.[0], 'interceptor')
        if (p.kind === 'conversion' || p.kind === 'penaltyGoal') want(p.who, 'goal kicker')
        if (p.kind === 'kick' || p.kind === 'kickoff') want(p.who, 'kicker')
        if (p.kind === 'catch') want(p.who, 'catcher')
        if (p.kind === 'lineout') { want(p.who, 'thrower'); if (p.result === 'won') want(p.with?.[0], 'jumper'); if (p.result === 'stolen') want(p.vs?.[0], 'stealer') }
        if (p.kind === 'carry' || p.kind === 'lineBreak' || p.kind === 'knockOn') want(p.who, 'carrier')
        if (p.kind === 'ruck' && p.result === 'turnover') want(p.vs?.[0], 'jackal')
        if (p.kind === 'yellowCard' || p.kind === 'redCard') want(p.who, 'man carded')
      }
    }
    expect([...missed]).toEqual([])
    expect(named.get('try scorer')).toBeGreaterThan(500)
    // the passer who gave the scoring pass is said in some wordings, not all: at least a third of the time
    let pass = 0, passSaid = 0
    for (const { r, lines } of runs) for (const p of r.plays) if (p.kind === 'try' && p.with?.[0]) {
      pass++
      if (lines.some(l => l.n === p.n && l.params.player2 === `P${p.with![0]}`)) passSaid++
    }
    expect(passSaid / pass).toBeGreaterThan(0.33)
  })

  it('key moments are marked key: tries, kicks at goal, cards, line breaks, tries held up, interceptions', () => {
    const KEY = new Set(['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'lineBreak', 'heldUp'])
    let inter = 0
    for (const { r, lines } of runs) for (const l of lines) {
      const p = r.plays[l.n], b = baseOf(l.key)
      if (KEY.has(p.kind) && !SUMMARY.has(b)) expect(l.level, l.key).toBe('key')
      if (p.kind === 'ruck' && p.result === 'turnover' && b === 'turnover') expect(l.level).toBe(p.x <= 22 || p.x >= 78 ? 'key' : 'normal')
      if (p.kind === 'carry' && p.result === 'intercepted' && b === 'intercepted') { expect(l.level).toBe('key'); inter++ }
      if (p.kind === 'try' && p.result === 'interception' && !SUMMARY.has(b)) expect(b).toBe('tryInterception')
      if (l.level === 'key') expect(l.priority).toBe(3)
    }
    expect(inter).toBeGreaterThan(20)
  })

  it('every penalty and free kick says what it was for, and who gave it away', () => {
    let said = 0
    for (const { r, lines } of runs) for (const l of lines) {
      const p = r.plays[l.n]
      if ((p.kind !== 'penalty' && p.kind !== 'freeKick') || SUMMARY.has(baseOf(l.key))) continue
      if (p.cause) { expect(l.params.cause_k, `${l.key} for ${p.cause}`).toBe(`sim.cause${p.cause[0].toUpperCase()}${p.cause.slice(1)}1`); said++ }
      if (p.offender && baseOf(l.key) !== 'free') expect(l.params.oppPlayer, l.key).toBe(`P${p.offender}`)
    }
    expect(said).toBeGreaterThan(1000)
  })

  it('says the substitutions, made and refused', () => {
    const seen = new Set<string>()
    for (const { r, lines } of runs) for (const l of lines) if (r.plays[l.n].kind === 'substitution') seen.add(baseOf(l.key))
    expect([...seen].sort()).toEqual(['subMade', 'subRefused'])
  })
})

describe('every note is true when worked out again from the record so far', () => {
  /** the score before the scoring passage that ends at n (before the try, for a conversion) */
  const before = (P: Play[], n: number): [number, number] => {
    let i = n - 1
    if (P[n].kind === 'conversion') { while (i >= 0 && P[i].kind !== 'try') i--; i-- }
    return i >= 0 ? [P[i].score[0], P[i].score[1]] : [0, 0]
  }
  const passageStart = (P: Play[], n: number) => { let i = n; if (P[n].kind === 'conversion') while (i > 0 && P[i].kind !== 'try') i--; return i }
  const menOn = (P: Play[], n: number, side: 0 | 1, t = P[n].t) => {
    let men = 15
    for (let i = 0; i <= n; i++) {
      const q = P[i]
      if (q.side !== side) continue
      if (q.kind === 'redCard') men--
      if (q.kind === 'yellowCard' && (q.until ?? q.t - q.dead + 600) > t) men--
    }
    return men
  }
  const counted = new Map<string, number>()
  const check = (b: string, f: (x: { P: Play[]; l: Line; p: Play; ctx: Context }) => void) => {
    for (const { r, lines, ctx } of runs) for (const l of lines) if (baseOf(l.key) === b) { f({ P: r.plays, l, p: r.plays[l.n], ctx }); counted.set(b, (counted.get(b) ?? 0) + 1) }
  }

  it('the score story: first points, lead changes, level scores, biggest lead, comebacks, two-score games, runs, half-time', () => {
    check('firstScore', ({ P, l }) => expect(before(P, l.n)).toEqual([0, 0]))
    check('leadTaken', ({ P, l, p }) => { const b = before(P, l.n), s = l.side!; expect(b[s] - b[other(s)]).toBeLessThanOrEqual(0); expect(p.score[s] - p.score[other(s)]).toBeGreaterThan(0) })
    check('levelScores', ({ p }) => { expect(p.score[0]).toBe(p.score[1]); expect(p.score[0]).toBeGreaterThan(0) })
    check('biggestLead', ({ P, l, p }) => {
      const s = l.side!, lead = p.score[s] - p.score[other(s)]
      expect(l.params.margin).toBe(lead); expect(lead).toBeGreaterThanOrEqual(10)
      for (let i = 0; i < passageStart(P, l.n); i++) expect(Math.abs(P[i].score[0] - P[i].score[1])).toBeLessThan(lead)
    })
    for (const b of ['comeback', 'comebackLevel', 'comebackLead']) check(b, ({ P, l, p }) => {
      const s = l.side!
      let worst = 0
      for (let i = 0; i < l.n; i++) worst = Math.max(worst, P[i].score[other(s)] - P[i].score[s])
      expect(l.params.deficit).toBe(worst); expect(worst).toBeGreaterThanOrEqual(10)
      const gap = p.score[other(s)] - p.score[s]
      expect(gap).toBeLessThanOrEqual(7)
      if (b === 'comeback') { expect(l.params.margin).toBe(gap); expect(gap).toBeGreaterThan(0) }
      if (b === 'comebackLevel') expect(gap).toBe(0)
      if (b === 'comebackLead') expect(gap).toBeLessThan(0)
    })
    check('twoScore', ({ P, l, p }) => {
      const s = l.side!, b = before(P, l.n), lead = p.score[s] - p.score[other(s)]
      expect(lead).toBeGreaterThanOrEqual(8); expect(lead).toBeLessThanOrEqual(14); expect(b[s] - b[other(s)]).toBeLessThanOrEqual(7)
    })
    check('run', ({ P, l }) => {
      let i = l.n, pts = 0
      while (i > 0) {
        const d = [P[i].score[0] - P[i - 1].score[0], P[i].score[1] - P[i - 1].score[1]]
        if (d[other(l.side!)] > 0) break
        pts += d[l.side!]; i--
      }
      if (i === 0) pts += P[0].score[l.side!]
      expect(l.params.count).toBe(pts)
    })
    check('beforeHalf', ({ P, l, p }) => { expect(l.n).toBeLessThan(halfIdx(P)); expect(clk(p)).toBeGreaterThanOrEqual(2100) })
    check('afterHalf', ({ P, l, p }) => { expect(l.n).toBeGreaterThan(halfIdx(P)); expect(clk(p) - 2400).toBeLessThanOrEqual(300) })
    check('bonusTry', ({ P, l, ctx }) => {
      expect(ctx.bonusPoints).toBe(true)
      expect(P.slice(0, l.n + 1).filter(q => (q.kind === 'try' || q.kind === 'penaltyTry') && q.side === l.side).length).toBe(4)
    })
    check('tryType', ({ P, l, p }) => {
      const type = String(l.params.type_k).replace(/^sim\.type|1$/g, '').toLowerCase()
      expect(p.result).toBe(type)
      expect(P.slice(0, l.n + 1).filter(q => q.kind === 'try' && q.side === l.side && q.result === p.result).length).toBe(l.params.count)
    })
    check('tryAgain', ({ P, l, p }) => {
      const c = P.slice(0, l.n + 1).filter(q => q.kind === 'try' && q.who === p.who).length
      expect(l.params.nth_k).toBe(`sim.nth${['', '', 'Two', 'Three', 'Four', 'Five', 'Six'][c]}1`)
    })
    check('scoreManUp', ({ P, l }) => expect(l.params.men).toBe(menOn(P, l.n, other(l.side!))))
    check('scoreManDown', ({ P, l }) => expect(l.params.men).toBe(menOn(P, l.n, l.side!)))
    for (const b of ['scoreManUp', 'scoreManDown']) check(b, ({ l }) => expect(Number(l.params.men)).toBeLessThan(15))
    for (const b of ['firstScore', 'leadTaken', 'levelScores', 'twoScore', 'run', 'tryType', 'tryAgain']) expect(counted.get(b) ?? 0, `${b} never said`).toBeGreaterThan(10)
  })

  it('the last ten minutes of a close game: the time and what the trailing side needs', () => {
    const NEED = (d: number) => (d <= 2 ? 'WinKick' : d === 3 ? 'LevelKick' : d === 4 ? 'WinTry' : d === 5 ? 'LevelTry' : d === 6 ? 'WinConTry' : 'LevelConTry')
    for (const b of ['lateTrail', 'lateLast', 'lateRed', 'lateLevel', 'lateRedLevel']) check(b, ({ P, l, p }) => {
      expect(l.n).toBeGreaterThan(halfIdx(P))
      expect(clk(p)).toBeGreaterThanOrEqual(4200)
      const d = Math.abs(p.score[0] - p.score[1])
      if (b === 'lateLevel' || b === 'lateRedLevel') expect(d).toBe(0)
      else {
        expect(l.params.d).toBe(d); expect(d).toBeGreaterThan(0); expect(d).toBeLessThanOrEqual(7)
        expect(p.score[l.side!]).toBeLessThan(p.score[other(l.side!)])
        expect(l.params.need_k).toBe(`sim.need${NEED(d)}1`)
      }
      if (b === 'lateTrail' || b === 'lateLevel') expect(l.params.mins).toBe(Math.ceil((4800 - clk(p)) / 60))
      if (b === 'lateRed' || b === 'lateRedLevel') expect(clk(p)).toBeGreaterThanOrEqual(4800)
      if (b === 'lateLast') expect(4800 - clk(p)).toBeLessThanOrEqual(60)
    })
    expect(counted.get('lateTrail') ?? 0).toBeGreaterThan(20)
  })

  it('the men: goal kicking, tackles, carries, metres, turnovers, lineouts, penalties given away, first touches', () => {
    const kicks = (P: Play[], n: number, who: string) => P.slice(0, n + 1).filter(q => (q.kind === 'conversion' || q.kind === 'penaltyGoal') && q.who === who)
    check('goalPerfect', ({ P, l, p }) => { const k = kicks(P, l.n, p.who!); expect(k.every(q => q.good)).toBe(true); expect(l.params.made).toBe(k.length); expect(k.length).toBeGreaterThanOrEqual(3) })
    check('goalRun', ({ P, l, p }) => { const k = kicks(P, l.n, p.who!); expect(l.params.taken).toBe(k.length); expect(l.params.made).toBe(k.filter(q => q.good).length) })
    check('missRun', ({ P, l, p }) => {
      const k = kicks(P, l.n, p.who!); let m = 0
      for (let i = k.length - 1; i >= 0 && !k[i].good; i--) m++
      expect(l.params.count).toBe(m); expect(m).toBeGreaterThanOrEqual(2)
    })
    check('statTackles', ({ P, l }) => {
      const id = String(l.params.player).slice(1)
      // a man is in the tackle once however the record lists him
      expect(P.slice(0, l.n + 1).filter(q => q.kind === 'carry' && q.vs?.includes(id)).length).toBe(l.params.count)
    })
    check('statCarries', ({ P, l }) => {
      const id = String(l.params.player).slice(1)
      const c = P.slice(0, l.n + 1).filter(q => (q.kind === 'carry' || q.kind === 'lineBreak') && q.who === id && q.result !== 'intercepted')
      expect(c.length).toBe(l.params.count)
      expect(Math.round(c.reduce((m, q) => m + Math.max(0, q.gain ?? 0), 0))).toBe(l.params.m)
    })
    check('statMetres', ({ P, l }) => {
      const id = String(l.params.player).slice(1)
      const c = P.slice(0, l.n + 1).filter(q => (q.kind === 'carry' || q.kind === 'lineBreak') && q.who === id && q.result !== 'intercepted')
      const m = c.reduce((s, q) => s + Math.max(0, q.gain ?? 0), 0)
      expect(m).toBeGreaterThanOrEqual(Number(l.params.m))
      expect(m - Math.max(0, P[l.n].gain ?? 0)).toBeLessThan(Number(l.params.m))
    })
    check('statTurnovers', ({ P, l }) => {
      const id = String(l.params.player).slice(1)
      const c = P.slice(0, l.n + 1).filter(q => ((q.kind === 'ruck' && q.result === 'turnover') || (q.kind === 'carry' && q.result === 'intercepted')) && q.vs?.[0] === id).length
      expect(l.params.nth_k).toBe(`sim.nth${['', '', 'Two', 'Three', 'Four', 'Five', 'Six'][c]}1`)
    })
    check('statLineout', ({ P, l }) => {
      const id = String(l.params.player2).slice(1)
      expect(P.slice(0, l.n + 1).filter(q => q.kind === 'lineout' && q.result === 'won' && q.with?.[0] === id).length).toBe(l.params.count)
    })
    check('statSteals', ({ P, l }) => {
      const id = String(l.params.player).slice(1)
      expect(P.slice(0, l.n + 1).filter(q => q.kind === 'lineout' && q.result === 'stolen' && q.vs?.[0] === id).length).toBe(l.params.count)
    })
    check('offenderPens', ({ P, l }) => {
      const id = String(l.params.oppPlayer).slice(1)
      expect(P.slice(0, l.n + 1).filter(q => q.kind === 'penalty' && q.offender === id).length).toBe(l.params.count)
    })
    check('backFromBin', ({ P, l, p }) => {
      const id = String(l.params.player).slice(1)
      const card = [...P.slice(0, l.n)].reverse().find(q => q.kind === 'yellowCard' && q.who === id)!
      expect(card).toBeDefined(); expect(p.t).toBeGreaterThanOrEqual(card.until ?? 0)
      const named = (q: Play) => !!(q.who === id || q.vs?.includes(id) || q.with?.includes(id))
      expect(named(p)).toBe(true)
      for (let i = card.n + 1; i < l.n; i++) if (P[i].t >= (card.until ?? 0) && P[i].kind !== 'substitution') expect(named(P[i]), `${id} named before at ${i}`).toBe(false)
    })
    check('subFirst', ({ P, l, p }) => {
      const id = String(l.params.player).slice(1)
      const sub = P.slice(0, l.n).find(q => q.kind === 'substitution' && q.result === 'made' && q.with?.[0] === id)!
      expect(sub).toBeDefined()
      expect(p.who === id || p.vs?.includes(id) || p.with?.includes(id)).toBe(true)
      for (let i = sub.n + 1; i < l.n; i++) expect(!!(P[i].who === id || P[i].vs?.includes(id) || P[i].with?.includes(id))).toBe(false)
    })
    for (const b of ['goalPerfect', 'goalRun', 'missRun', 'statTackles', 'statCarries', 'statTurnovers', 'offenderPens', 'backFromBin', 'subFirst']) expect(counted.get(b) ?? 0, `${b} never said`).toBeGreaterThan(5)
  })

  it('the choice at a penalty: what the options were and what was chosen; the captain only when on the field', () => {
    const CH: Record<string, (p: Play) => boolean> = { Posts: p => p.kind === 'penaltyGoal', Corner: p => p.kind === 'kick' && p.result === 'penaltyToTouch', Tap: p => p.kind === 'tap', Scrum: p => p.kind === 'scrum' }
    for (const c of Object.keys(CH)) {
      check(`choice${c}`, ({ P, l, p }) => {
        expect(CH[c](p)).toBe(true)
        const pen = prevOf(P, l.n, true)
        expect(pen.kind).toBe('penalty'); expect(pen.side).toBe(l.side)
        expect(l.params.m).toBe(Math.round(Math.hypot(toLine(pen.side, pen.x), pen.y - 35)))
      })
      check(`cap${c}`, ({ P, l, p, ctx }) => {
        expect(CH[c](p)).toBe(true)
        const cap = ctx.captains?.[l.side!]
        expect(cap).toBeDefined()
        for (let i = 0; i < l.n; i++) {
          const q = P[i]
          expect(q.kind === 'redCard' && q.who === cap).toBe(false)
          expect(q.kind === 'substitution' && q.result === 'made' && q.who === cap).toBe(false)
          if (q.kind === 'yellowCard' && q.who === cap) expect(p.t).toBeGreaterThanOrEqual(q.until!)
        }
      })
    }
    expect((counted.get('choiceCorner') ?? 0) + (counted.get('choicePosts') ?? 0)).toBeGreaterThan(50)
  })

  it('the sides: territory, the ball, penalties against them, set pieces, visits to the 22, errors, turnovers', () => {
    check('territory', ({ P, l, p }) => {
      const half = halfIdx(P) < l.n ? 2 : 1
      expect(clk(p) - (half === 2 ? 2400 : 0)).toBeGreaterThanOrEqual(600)
      const w = [0, 0]
      for (let i = l.n; i >= 0 && P[i].t > p.t - 600 && P[i].kind !== 'halfTime'; i--) if (P[i].live > 0) { if (P[i].x > 50) w[0] += P[i].live; else if (P[i].x < 50) w[1] += P[i].live }
      const pct = Math.round(100 * w[l.side!] / (w[0] + w[1]))
      expect(l.params.pct).toBe(pct); expect(pct).toBeGreaterThanOrEqual(70)
    })
    check('ballTen', ({ P, l, p }) => {
      const w = [0, 0]
      let from = l.n
      while (from > 0 && P[from - 1].t > p.t - 600 && P[from - 1].kind !== 'halfTime') from--
      for (let i = from; i <= l.n; i++) w[i ? P[i - 1].ball : P[i].side] += P[i].live
      const pct = Math.round(100 * w[l.side!] / (w[0] + w[1]))
      expect(l.params.pct).toBe(pct); expect(pct).toBeGreaterThanOrEqual(68)
    })
    check('possession', ({ P, l }) => {
      const w = [0, 0]
      for (let i = 0; i <= l.n; i++) w[i ? P[i - 1].ball : P[i].side] += P[i].live
      expect(l.params.hp).toBe(Math.round(100 * w[0] / (w[0] + w[1])))
    })
    check('tries', ({ P, l }) => {
      const tr = [0, 0]
      for (let i = 0; i <= l.n; i++) if (P[i].kind === 'try' || P[i].kind === 'penaltyTry') tr[P[i].side]++
      expect([l.params.ht, l.params.at]).toEqual(tr)
    })
    check('winBy', ({ p, l }) => { expect(l.params.winner).toBe(TEAMS[p.score[0] > p.score[1] ? 0 : 1]); expect(l.params.margin).toBe(Math.abs(p.score[0] - p.score[1])) })
    check('draw', ({ p }) => expect(p.score[0]).toBe(p.score[1]))
    check('pensWarn', ({ P, l, p }) => {
      const against = other(l.side!)
      expect(P.slice(0, l.n + 1).filter(q => q.kind === 'penalty' && q.side === l.side && q.t > p.t - 900).length).toBe(l.params.count)
      expect(p.side).toBe(l.side); expect(Number(l.params.count)).toBeGreaterThanOrEqual(4); void against
    })
    check('pensTotal', ({ P, l }) => expect(P.slice(0, l.n + 1).filter(q => q.kind === 'penalty' && q.side === l.side).length).toBe(l.params.count))
    check('scrumPensWon', ({ P, l }) => {
      let c = 0
      for (let i = 1; i <= l.n; i++) { const q = P[i], pr = P[i - 1]; if (q.kind === 'penalty' && q.side === l.side && pr.kind === 'scrum' && (pr.result === 'penaltyWon' || pr.result === 'penaltyLost')) c++ }
      expect(l.params.count).toBe(c)
    })
    check('loRecord', ({ P, l }) => {
      // a quick throw is not a lineout contest: only the set lineouts count
      const own = P.slice(0, l.n + 1).filter(q => q.kind === 'lineout' && q.side === l.side && q.result !== 'quick')
      expect(l.params.total).toBe(own.length)
      expect(l.params.lost).toBe(own.filter(q => q.result === 'stolen' || q.result === 'notStraight').length)
    })
    check('scRecord', ({ P, l }) => {
      const own = P.slice(0, l.n + 1).filter(q => q.kind === 'scrum' && q.side === l.side)
      expect(l.params.total).toBe(own.length)
      expect(l.params.lost).toBe(own.filter(q => q.result === 'againstTheHead' || q.result === 'penaltyLost').length)
    })
    check('entries', ({ P, l }) => {
      // a visit: the side has the ball inside the other 22 at the end of a play, and did not at the end of the one before
      const s = l.side!, inside = (q: Play) => q.ball === s && toLine(s, q.x) <= 22 && q.kind !== 'halfTime' && q.kind !== 'fullTime'
      let visits = 0, pts = 0, from = 0, was = false
      for (let i = 0; i <= l.n; i++) {
        const now = inside(P[i])
        if (now && !was) { visits++; from = P[i].score[s] }
        if (!now && was) pts += P[i].score[s] - from
        was = now
      }
      expect(inside(P[l.n])).toBe(false); expect(inside(P[l.n - 1])).toBe(true)
      expect(l.params.count).toBe(visits); expect(l.params.pts).toBe(pts)
    })
    check('outFullCount', ({ P, l }) => expect(P.slice(0, l.n + 1).filter(q => q.kind === 'kick' && q.result === 'outOnFull' && q.side === l.side).length).toBe(l.params.count))
    check('handlingCount', ({ P, l }) => expect(P.slice(0, l.n + 1).filter(q => (q.kind === 'knockOn' || q.kind === 'forwardPass') && q.side === l.side).length).toBe(l.params.count))
    check('turnoversCount', ({ P, l }) => {
      const s = l.side!
      const c = P.slice(0, l.n + 1).filter(q => q.side === other(s) && ((q.kind === 'ruck' && q.result === 'turnover') || (q.kind === 'carry' && q.result === 'intercepted') || (q.kind === 'lineout' && q.result === 'stolen') || (q.kind === 'scrum' && q.result === 'againstTheHead'))).length
      expect(l.params.count).toBe(c)
    })
    check('phases', ({ P, l }) => {
      let k = 0, i = l.n
      // (a man hurt in the tackle, of either side, does not end the passage)
      while (i >= 0 && (P[i].kind === 'injury' || (P[i].side === l.side && (P[i].kind === 'carry' || P[i].kind === 'offload' || P[i].kind === 'lineBreak' || P[i].kind === 'maul' || (P[i].kind === 'ruck' && P[i].result === 'recycled'))))) { if (P[i].kind === 'ruck') k++; i-- }
      expect(l.params.phase).toBe(k)
    })
    check('pickGo', ({ p, l }) => { const d = toLine(l.side!, p.x); expect(d).toBeLessThanOrEqual(5); expect(l.params.d).toBe(Math.max(1, Math.round(d))); expect(p.passes ?? 0).toBe(0) })
    for (const b of ['territory', 'ballTen', 'pensWarn', 'loRecord', 'entries', 'handlingCount', 'turnoversCount', 'pickGo']) expect(counted.get(b) ?? 0, `${b} never said`).toBeGreaterThan(10)
  })

  it('men on the field and the sin bin: cards, returns, and what happened while a man was off', () => {
    for (const b of ['yellowCynical', 'yellowFoul', 'yellowPenTry', 'red', 'binBack']) check(b, ({ P, l, p }) => {
      expect(l.params.men).toBe(menOn(P, l.n, l.side!))
      if (b === 'binBack') expect(p.kind === 'yellowCard' || p.kind === 'redCard', 'a return is not said at a card').toBe(false)
    })
    for (const b of ['binOutcomeWon', 'binOutcomeLost', 'binOutcomeLevel']) check(b, ({ P, l, p }) => {
      const s = l.side!
      // the card whose ten minutes are up by now, the latest such for this side
      const card = [...P.slice(0, l.n)].reverse().find(q => q.kind === 'yellowCard' && q.side === s && (q.until ?? 0) <= p.t)!
      expect(card).toBeDefined()
      const a = p.score[s] - card.score[s], c = p.score[other(s)] - card.score[other(s)]
      expect([l.params.a, l.params.b]).toEqual([a, c])
      expect(b === 'binOutcomeWon' ? a > c : b === 'binOutcomeLost' ? a < c : a === c).toBe(true)
    })
  })

  it('the occasion is said only when the game passes it in', () => {
    check('introDerby', ({ ctx, l }) => { expect(ctx.derby).toBe(true); expect(l.n).toBe(0) })
    check('introTable', ({ ctx, l }) => { expect([l.params.hp, l.params.ap]).toEqual(ctx.table); expect(l.n).toBe(0) })
    check('introVenue', ({ ctx, l }) => expect(l.params.venue).toBe(ctx.venue))
    check('wxRain', ({ ctx }) => expect(ctx.weather).toBe('Rain'))
    check('surfArtificial', ({ ctx }) => expect(ctx.surface).toBe('artificial'))
    check('weatherKnock', ({ ctx }) => expect(['Rain', 'Damp', 'Snow']).toContain(ctx.weather))
    for (const b of ['introDerby', 'introTable', 'wxRain', 'weatherKnock', 'bonusTry']) expect(counted.get(b) ?? 0, `${b} never said`).toBeGreaterThan(3)
  })

  it('says nothing about territory before ten minutes of a half have gone (the Northampton line)', () => {
    for (const { r, lines } of runs) {
      const ht = halfIdx(r.plays)
      for (const l of lines) if (baseOf(l.key) === 'territory' || baseOf(l.key) === 'ballTen') expect(l.n < ht ? l.t : l.t - 2400).toBeGreaterThanOrEqual(600)
    }
  })

  it('a breakdown penalty only ever follows a ruck', () => {
    for (const { r, lines } of runs) for (const l of lines) {
      if (/breakdown|ruck/.test(EN_FLAT[l.key]) && /penal/i.test(EN_FLAT[l.key])) {
        const q = r.plays[l.n - 1]
        expect(q?.kind === 'ruck', `${l.key} at ${pair(r.plays[l.n])}`).toBe(true)
      }
    }
  })
})

describe('the feed fits the pitch, and a match does not repeat itself', () => {
  /** a schedule like the pitch's: every play shown, fast forward at 6x with each key moment and its build-up at life speed */
  const scheduleOf = (r: SimResult) => {
    let at = 0
    return r.plays.map(p => {
      const key = ['try', 'conversion', 'penaltyGoal', 'yellowCard', 'redCard', 'lineBreak', 'heldUp', 'dropGoal'].includes(p.kind)
      const speed = key ? 1 : 6
      const dur = Math.max(0.3, (p.live + Math.min(p.dead, 8)) / speed)
      const slot = { n: p.n, start: at, dur, speed }
      at += dur
      return slot
    })
  }

  it('thin() keeps every key line, score and stoppage reason, and otherwise never brings two lines within 1.4 s', () => {
    let before = 0, after = 0, viewing = 0
    for (const { r, lines } of runs.slice(0, 80)) {
      const slots = scheduleOf(r), start = new Map(slots.map(s => [s.n, s.start]))
      const kept = thin(lines, slots)
      const keptSet = new Set(kept)
      for (const l of lines) if (l.priority >= 3 || l.level === 'key' || l.params.hs !== undefined) expect(keptSet.has(l), `dropped ${l.key}`).toBe(true)
      for (let i = 0; i < kept.length; i++) for (let k = i + 1; k < kept.length; k++) {
        const dt = Math.abs(start.get(kept[k].n)! - start.get(kept[i].n)!)
        if (dt >= 1.4) break
        expect(kept[i].priority >= 3 && kept[k].priority >= 3, `${kept[i].key} and ${kept[k].key} ${dt.toFixed(2)} s apart`).toBe(true)
      }
      // lines stay in record order
      for (let i = 1; i < kept.length; i++) expect(kept[i].n).toBeGreaterThanOrEqual(kept[i - 1].n)
      before += lines.length; after += kept.length; viewing += slots[slots.length - 1].start
    }
    console.log(`thin: ${(before / 80).toFixed(0)} lines a match to ${(after / 80).toFixed(0)} over ${(viewing / 80 / 60).toFixed(1)} min of viewing (one every ${(viewing / after).toFixed(1)} s)`)
    expect(after).toBeLessThan(before)
  })

  it('priority 3 covers every key line, every score and every stoppage reason', () => {
    for (const { lines } of runs) for (const l of lines) {
      const b = baseOf(l.key)
      if (l.level === 'key' || MUST.has(b)) expect(l.priority, l.key).toBe(3)
      if (l.params.hs !== undefined && !SUMMARY.has(b)) expect(l.priority, l.key).toBe(3)
    }
  })

  it('repeats little: under 6% of lines repeat a sentence already said in the match, no key twice in a row, no sentence twice in twelve lines', () => {
    let lines = 0, rep = 0, keys = 0, near = 0, maxRun = 1
    for (const { lines: ls } of runs) {
      const seen = new Set<string>()
      let run = 1
      for (let i = 0; i < ls.length; i++) {
        const t = render(ls[i])
        const short = ls[i].params.hs !== undefined && t.length < 40
        if (!short) { lines++; if (seen.has(t)) rep++ }
        seen.add(t)
        if (i && ls[i].key === ls[i - 1].key) { run++; maxRun = Math.max(maxRun, run) } else run = 1
        for (let k = Math.max(0, i - 12); k < i; k++) if (render(ls[k]) === t && ls[i].priority < 3) near++
      }
      keys += new Set(ls.map(l => l.key)).size
    }
    console.log(`repetition: ${(100 * rep / lines).toFixed(1)}% of lines repeat a sentence in the match; longest run of one key ${maxRun}; ${(keys / runs.length).toFixed(0)} distinct keys a match`)
    expect(rep / lines).toBeLessThan(0.06)
    expect(maxRun).toBeLessThanOrEqual(2)
    expect(near).toBe(0)
  })

  it('a line heard often has at least six wordings in use, a key moment at least five', () => {
    const per = new Map<string, { n: number; keys: Set<string>; key: boolean }>()
    for (const { lines } of runs) for (const l of lines) {
      const b = baseOf(l.key), e = per.get(b) ?? { n: 0, keys: new Set(), key: false }
      e.n++; e.keys.add(l.key); if (l.level === 'key') e.key = true; per.set(b, e)
    }
    const ONCE = new Set(['koStart', 'koSecond', 'halfTime', 'fullTime', 'winBy', 'draw', 'tries', 'possession'])
    const short: string[] = []
    for (const [b, e] of per) {
      if (ONCE.has(b) || SUMMARY.has(b)) continue
      const rate = e.n / runs.length
      if (e.key && rate >= 0.3 && e.keys.size < 5) short.push(`${b} (key, ${e.keys.size})`)
      else if (!e.key && rate >= 1 && e.keys.size < 6) short.push(`${b} (${rate.toFixed(1)} a match, ${e.keys.size})`)
    }
    expect(short.sort()).toEqual([])
  })

  it('is the same on a re-run', () => {
    const a = commentate(runs[2].r, names, runs[2].ctx).map(render)
    const b = commentate(simSkeleton({ seed: SEEDS[2], world: namedWorld() }), names, contextFor(SEEDS[2])).map(render)
    expect(b).toEqual(a)
  })

  it('reads with no names and no context (stage 1 sides), and the fast density leaves out colour only', () => {
    const r = simSkeleton({ seed: 7 })
    const lines = commentate(r, { teams: TEAMS, player: () => '' })
    expect(lines.length).toBeGreaterThan(150)
    for (const l of lines) { expect(render(l)).not.toMatch(/[{}]/); expect(l.params.player).toBeUndefined() }
    const fast = commentate(r, { teams: TEAMS, player: () => '' }, {}, { density: 'fast' })
    expect(fast.every(l => l.priority > 0)).toBe(true)
    expect(fast.length).toBeLessThan(lines.length)
  })
})
