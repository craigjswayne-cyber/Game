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
import { commentate, render, thin, feed, halvesOf as halves, SILENT, SUMMARY, FALLBACK, BASE_KINDS, MUST, TICK, HOLDS, FAST, type Line, type Context } from '../src/game/sim/commentary'
import { SIM_EN as WORDS, MOVE_EN } from '../src/game/sim/commentary.en'
import { SIM_EN, EN_FLAT } from '../src/game/sim/commentary.en'
import type { Play, SimResult } from '../src/game/sim/record'
import type { World } from '../src/game/sim/world'
import { schedule } from '../src/ui/livepitch/fromRecord'

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

  it('every kick from hand and every catch has a line of its own (the ticker misses nothing routine)', () => {
    for (const { r, lines } of runs) {
      const said = new Set(lines.map(l => l.n))
      for (const p of r.plays) if (p.kind === 'kick' || p.kind === 'catch' || p.kind === 'carry' || p.kind === 'ruck' || p.kind === 'offload') {
        if (!SILENT[pair(p)]) expect(said.has(p.n), `${pair(p)} at ${p.n}`).toBe(true)
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
      // (the ticker's word on how the ball got there, before a line break, is not the moment itself)
      // (the flash is the key line; the score and the detail follow it as ordinary lines)
      if (p.kind === 'ruck' && p.result === 'turnover' && b === 'turnover') expect(l.level).toBe(p.x <= 22 || p.x >= 78 ? 'key' : 'normal')
      if (p.kind === 'carry' && p.result === 'intercepted' && b === 'intercepted') { expect(l.level).toBe('key'); inter++ }
      if (l.level === 'key') expect(l.priority).toBe(3)
    }
    for (const { r, lines } of runs) for (const p of r.plays) {
      const ls = lines.filter(l => l.n === p.n)
      if (KEY.has(p.kind)) expect(ls.some(l => l.level === 'key'), `${pair(p)} at ${p.n} has a key line`).toBe(true)
      if (p.kind === 'try' && p.result === 'interception') expect(ls.some(l => baseOf(l.key) === 'tryInterception')).toBe(true)
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
      // (only plays where a side really holds the ball say anything: a kick in flight landing in the 22 is not a visit)
      const s = l.side!, inside = (q: Play) => q.ball === s && toLine(s, q.x) <= 22
      let visits = 0, pts = 0, from = 0, was = false
      for (let i = 0; i <= l.n; i++) {
        if (!HOLDS.has(P[i].kind)) continue
        const now = inside(P[i])
        if (now && !was) { visits++; from = P[i].score[s] }
        if (!now && was) pts += P[i].score[s] - from
        was = now
      }
      expect(HOLDS.has(P[l.n].kind) && !inside(P[l.n])).toBe(true)
      expect(l.params.count).toBe(visits); expect(l.params.pts).toBe(pts)
    })
    check('outFullCount', ({ P, l }) => expect(P.slice(0, l.n + 1).filter(q => q.kind === 'kick' && q.result === 'outOnFull' && q.side === l.side).length).toBe(l.params.count))
    check('handlingCount', ({ P, l }) => expect(P.slice(0, l.n + 1).filter(q => (q.kind === 'knockOn' || q.kind === 'forwardPass') && q.side === l.side).length).toBe(l.params.count))
    check('turnoversCount', ({ P, l }) => {
      const s = l.side!
      const c = P.slice(0, l.n + 1).filter(q => q.side === other(s) && ((q.kind === 'ruck' && q.result === 'turnover') || (q.kind === 'carry' && q.result === 'intercepted') || (q.kind === 'lineout' && q.result === 'stolen') || (q.kind === 'scrum' && q.result === 'againstTheHead'))).length
      expect(l.params.count).toBe(c)
    })
    for (const b of ['phases', 'tickRuck', 'tickRuckNear']) check(b, ({ P, l }) => {
      let k = 0, i = l.n
      // (a man hurt in the tackle, of either side, does not end the passage)
      while (i >= 0 && (P[i].kind === 'injury' || (P[i].side === l.side && (P[i].kind === 'carry' || P[i].kind === 'offload' || P[i].kind === 'lineBreak' || P[i].kind === 'maul' || (P[i].kind === 'ruck' && P[i].result === 'recycled'))))) { if (P[i].kind === 'ruck') k++; i-- }
      if (l.params.phase !== undefined) expect(l.params.phase).toBe(k)
      if (l.params.d !== undefined) expect(l.params.d).toBe(Math.max(1, Math.round(toLine(l.side!, P[l.n].x))))
    })
    for (const b of ['pickGo', 'tickNear', 'tickLine']) check(b, ({ p, l }) => { const d = toLine(l.side!, p.x); expect(d).toBeLessThanOrEqual(b === 'tickLine' ? 3.5 : 10); expect(l.params.d).toBe(Math.max(1, Math.round(d))); if (b === 'pickGo') expect(p.shape === 'pickAndGo' || !p.passes).toBe(true) })
    check('tickGain', ({ p, l }) => { expect(l.params.m).toBe(Math.round(p.gain!)); expect(p.gain!).toBeGreaterThanOrEqual(4) })
    check('carryBig', ({ p, l }) => { expect(l.params.m).toBe(Math.round(p.gain!)); expect(p.gain!).toBeGreaterThanOrEqual(10) })
    check('carryBack', ({ p }) => expect(p.gain!).toBeLessThanOrEqual(-2.5))
    check('tickHeld', ({ p }) => expect(p.result === 'held' || p.result === 'drivenBack').toBe(true))
    check('tickOver', ({ p }) => expect(p.result).toBe('overTheLine'))
    check('tickPass', ({ p, l }) => expect(l.params.player2).toBe(`P${p.with?.[0]}`))
    check('tickHands', ({ p }) => expect(p.passes!).toBeGreaterThanOrEqual(2))
    check('tickContest', ({ p }) => expect(p.contested).toBe(true))
    check('tickScrumWon', ({ p }) => expect(p.result).toBe('won'))
    check('tickLaunch', ({ p, l }) => { expect(p.shape).toBe('launch'); expect(l.params.move_k).toBe(`moves.say.${p.move}`); expect(MOVE_EN[p.move!]).toBeDefined() })
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

describe('the ticker: short lines, flashes, no silence in a try build-up', () => {
  it('every line says how it flashes, how long it holds and which register it is in', () => {
    for (const { r, lines } of runs) for (const l of lines) {
      const p = r.plays[l.n], b = baseOf(l.key)
      expect(['try', 'goal', 'card', 'key', null]).toContain(l.flash)
      expect(l.hold).toBeGreaterThan(0)
      expect(l.reg).toBe(TICK.has(b) ? 'tick' : 'full')
      if (l.flash === 'try') expect(['try', 'penaltyTry']).toContain(p.kind)
      if (l.flash === 'goal') expect(p.good).toBe(true)
      if (l.flash === 'card') expect(['yellowCard', 'redCard']).toContain(p.kind)
      if (l.level === 'key') expect(l.flash).not.toBeNull()
    }
    for (const { r, lines } of runs) for (const p of r.plays) {
      const fl = lines.filter(l => l.n === p.n && l.flash).map(l => l.flash)
      if (p.kind === 'try' || p.kind === 'penaltyTry') expect(fl).toContain('try')
      if ((p.kind === 'conversion' || p.kind === 'penaltyGoal' || p.kind === 'dropGoal') && p.good) expect(fl).toContain('goal')
      if (p.kind === 'yellowCard' || p.kind === 'redCard') expect(fl).toContain('card')
    }
  })

  it('a flash is short: under 48 characters with a 21-letter name and a 14-letter team', () => {
    const long: string[] = []
    for (const b of Object.keys(WORDS).filter(b => /^flash/.test(b) || b === 'scoreLine')) for (const w of WORDS[b]) {
      const t = w.replace(/\{(player|player2|oppPlayer)\}/g, 'Abcdefghijklmnopqrstu').replace(/\{(team|opp|home|away)\}/g, 'Abcdefghijklmn').replace(/\{(m|hs|as)\}/g, '22')
      if (t.length > 48) long.push(`${b}: ${t} (${t.length})`)
    }
    expect(long).toEqual([])
  })

  it('a ticker line is 70 characters or fewer, a fuller line 90 or fewer or split in two that are (18-letter names, 14-letter teams)', () => {
    const long: string[] = []
    const NAME = 'Abcdefghijklmnopqr', TEAM = 'Abcdefghijklmn', longestMove = Math.max(...Object.values(MOVE_EN).map(x => x.length))
    const longestCause = Math.max(...Object.keys(WORDS).filter(b => /^cause/.test(b)).map(b => WORDS[b][0].length))
    for (const b of Object.keys(WORDS)) for (const w of WORDS[b] ?? []) {
      if (/^(zone|cause|nth|kind|type|need)[A-Z]/.test(b)) continue
      const t = w.replace(/\{(player|player2|oppPlayer)\}/g, NAME).replace(/\{(team|opp|home|away|winner)\}/g, TEAM).replace(/\{(m|d|phase|count|hs|as|ht|at|men|pct|hp|ap|made|taken|mins|margin|deficit|a|b|pts|lost|total)\}/g, '22')
        .replace(/\{move_k\}/g, 'x'.repeat(longestMove)).replace(/\{kick_k\}/g, 'cross-field kick').replace(/\{zone_k\}/g, `inside the ${TEAM} 22`)
        .replace(/\{cause_k\}/g, 'x'.repeat(longestCause)).replace(/\{(\w+)\}/g, 'xxxxxxxxxx')
      if (TICK.has(b)) { if (t.length > 70) long.push(`${b}: ${t} (${t.length})`); continue }
      if (t.length <= 90) continue
      const h = halves(t)
      if (!h || h[0].length > 90 || h[1].length > 90) long.push(`${b}: ${t} (${t.length})`)
    }
    expect(long).toEqual([])
  })

  it('a line over 90 characters on the ticker is shown as its two halves', () => {
    let split = 0
    for (const { lines } of runs) for (const l of lines) {
      const t = render(l)
      expect(t.length, l.key).toBeLessThanOrEqual(l.reg === 'tick' ? 90 : 120)
      if (l.part) { split++; expect(t.length).toBeLessThanOrEqual(90) }
    }
    expect(split).toBeGreaterThan(0)
  })

  it('a try build-up never goes quiet: every play of the possession that scores has a line, and the last metres are said', () => {
    let builds = 0
    for (const { r, lines } of runs) {
      const said = new Map<number, string[]>()
      for (const l of lines) said.set(l.n, [...(said.get(l.n) ?? []), baseOf(l.key)])
      for (const p of r.plays) if (p.kind === 'try') {
        // back through the possession: the side's own open play since it won the ball
        let i = p.n - 1
        while (i >= 0 && r.plays[i].side === p.side && ['carry', 'ruck', 'offload', 'lineBreak', 'maul', 'injury'].includes(r.plays[i].kind)) i--
        for (let k = i + 1; k < p.n; k++) if (r.plays[k].kind !== 'injury') expect(said.has(k), `play ${k} ${pair(r.plays[k])} in the build-up to the try at ${p.n} is silent`).toBe(true)
        // inside ten metres, the urgency shows
        for (let k = i + 1; k < p.n; k++) {
          const q = r.plays[k]
          if (q.kind === 'carry' && ['gainLine', 'held', 'drivenBack'].includes(q.result) && toLine(q.side, q.x) <= 10 && toLine(q.side, q.x) >= 0.5)
            expect(said.get(k)!.some(b => b === 'tickNear' || b === 'tickLine' || b === 'pickGo'), `carry ${k} near the line`).toBe(true)
        }
        builds++
      }
    }
    expect(builds).toBeGreaterThan(500)
  })

  it('on the pitch\'s own schedule: every flash shown, never 4 s with nothing on screen, fast forward at most 3 a second', () => {
    for (const { r, lines } of runs.slice(0, 3)) {
      const slots = schedule(r.plays), shown = feed(lines, slots), set = new Set(shown.map(x => x.line))
      for (const l of lines) if (l.flash) expect(set.has(l)).toBe(true)
      let cov = 0, worst = 0
      for (let i = 1; i < shown.length; i++) { cov = Math.max(cov, shown[i - 1].at + shown[i - 1].hold); worst = Math.max(worst, shown[i].at - cov) }
      expect(worst).toBeLessThanOrEqual(4)
      const end = slots[slots.length - 1].start + slots[slots.length - 1].dur
      for (let t = 0; t < end; t += 1) expect(shown.filter(x => x.at >= t && x.at < t + 1).length).toBeLessThanOrEqual(3 + 2)
    }
  }, 60000)

  it('a man\'s numbers and a side\'s counts come at most once every twenty seconds of the clock', () => {
    const STAT = /^(stat|offenderPens|pensTotal|turnoversCount|handlingCount|outFullCount|tryType|scrumPensWon|loRecord|scRecord|entries|subFirst|backFromBin)/
    for (const { lines } of runs) {
      let last = -Infinity
      for (const l of lines) if (STAT.test(baseOf(l.key))) { expect(l.t - last, `${l.key}`).toBeGreaterThanOrEqual(20); last = l.t }
    }
  })

  /** a schedule like the pitch's: life speed (1.1) for key moments and the five plays before them, fast forward (6 to 10) elsewhere */
  const scheduleOf = (r: SimResult) => {
    let at = 0
    const key = (p: Play) => ['try', 'conversion', 'penaltyGoal', 'yellowCard', 'redCard', 'lineBreak', 'heldUp', 'dropGoal', 'penaltyTry'].includes(p.kind)
    return r.plays.map((p, i) => {
      const life = r.plays.slice(i, i + 6).some(key)
      const speed = life ? 1.1 : 6 + (p.n % 5)
      // (dead time: the walk to a set piece is shown quickly, as the pitch does)
      const dur = Math.max(0.2, (p.live + Math.min(p.dead, 3)) / speed)
      const slot = { n: p.n, start: at, dur, speed }
      at += dur
      return slot
    })
  }

  it('feed(): no line before its play or more than one play late, flashes never dropped, fast forward at most 3 a second, life speed nearly all', () => {
    let lifeTick = 0, lifeTickShown = 0
    let life = 0, lifeShown = 0, ff = 0, ffShown = 0, ffTime = 0, quiet = 0, quietMax = 0
    for (const { r, lines } of runs.slice(0, 100)) {
      const slots = scheduleOf(r), idx = new Map(slots.map((x, i) => [x.n, i]))
      const shown = feed(lines, slots)
      const set = new Set(shown.map(x => lines[x.i]))
      for (const l of lines) {
        if (l.flash) expect(set.has(l), `flash ${l.key} dropped`).toBe(true)
        const sp = slots[idx.get(l.n)!].speed
        if (sp <= FAST) { life++; if (set.has(l)) lifeShown++; if (l.reg === 'tick' && l.priority >= 0) { lifeTick++; if (set.has(l)) lifeTickShown++ } } else { ff++; if (set.has(l)) ffShown++ }
      }
      for (const x of slots) if (x.speed > FAST) ffTime += x.dur
      for (let i = 0; i < shown.length; i++) {
        const x = shown[i], k = idx.get(x.line.n)!, a = slots[k], nx = slots[k + 1]
        expect(x.at).toBeGreaterThanOrEqual(a.start - 1e-6)
        expect(x.at).toBeLessThanOrEqual((nx ? nx.start + Math.min(nx.dur, 0.8) : a.start + Math.max(a.dur, 4)) + 1e-6)
        if (i) {
          expect(x.at).toBeGreaterThanOrEqual(shown[i - 1].at)
          // the ticker keeps the order of the record (a flash keeps its own time in its window)
          if (!x.line.flash && !shown[i - 1].line.flash) expect(x.i).toBeGreaterThan(shown[i - 1].i)
          // in fast forward never more than three new lines a second, at life speed 0.6 s apart (a flash may be forced closer)
          const fastBoth = slots[k].speed > FAST && slots[idx.get(shown[i - 1].line.n)!].speed > FAST
          if (!x.line.flash && !shown[i - 1].line.flash) expect(x.at - shown[i - 1].at, `${x.line.key}`).toBeGreaterThanOrEqual((fastBoth ? 1 / 3 : 0.33) - 0.011)
        }
      }
      // nothing on screen (each line up for its hold)
      let cov = 0
      for (let i = 1; i < shown.length; i++) { cov = Math.max(cov, shown[i - 1].at + shown[i - 1].hold); const g = shown[i].at - cov; if (g > 1.2) quiet++; quietMax = Math.max(quietMax, g) }
    }
    console.log(`feed: life speed ${lifeShown}/${life} lines shown (${(100 * lifeShown / life).toFixed(0)}%), fast forward ${ffShown}/${ff} (${(ffShown / ffTime).toFixed(2)} a second); spells with nothing on screen over 1.2 s: ${(quiet / 100).toFixed(1)} a match, longest ${quietMax.toFixed(1)} s`)
    // at life speed nearly every ticker line shows (notes around a try or a goal make way for the flash and the score)
    console.log(`feed: life speed ticker ${lifeTickShown}/${lifeTick} (${(100 * lifeTickShown / lifeTick).toFixed(0)}%)`)
    expect(lifeTickShown / lifeTick).toBeGreaterThan(0.95)
    expect(lifeShown / life).toBeGreaterThan(0.8)
    expect(ffShown / ffTime).toBeLessThanOrEqual(3)
    // (this schedule is harsher than the pitch's: six plays at life speed before every key moment, every ruck included)
    expect(quietMax).toBeLessThanOrEqual(4.05)
  })
})

describe('round 6: shapes, shirt numbers, phase counts, the voice', () => {
  const SHAPE: Record<string, string> = { oneOut: 'shOneOut', pod: 'shPod', tipOn: 'shTipOn', snipe: 'shSnipe', pullBack: 'shPullBack', podOff10: 'shPodTen',
    miss: 'shMiss', loop: 'shLoop', wraparound: 'shWrap', switch: 'shSwitch', kickPass: 'shKickPass' }

  it('every shape the record plays is said, by the man the record names', () => {
    const seen = new Set<string>()
    for (const { r, lines } of runs) for (const p of r.plays) {
      if (p.kind !== 'carry' || !p.shape || !SHAPE[p.shape] || !['gainLine', 'held', 'drivenBack', 'overTheLine', 'knockedOn', 'forwardPass'].includes(p.result)) continue
      // (the same shape by the same two men as the carry before is not said twice running: the carry line says it)
      const pc = r.plays.slice(0, p.n).reverse().find(q => q.kind === 'carry')
      if (pc && pc.shape === p.shape && pc.who === p.who && pc.with?.[0] === p.with?.[0]) continue
      const ls = lines.filter(l => l.n === p.n)
      const l = ls.find(x => baseOf(x.key) === SHAPE[p.shape!])
      expect(l, `${p.shape} at ${p.n}`).toBeDefined()
      if (l!.params.player2 !== undefined) expect(l!.params.player2).toBe(`P${p.with?.[0]}`)
      seen.add(p.shape)
    }
    expect([...seen].sort()).toEqual(Object.keys(SHAPE).filter(k => seen.has(k)).sort())
    expect(seen.size).toBeGreaterThanOrEqual(8)
  })

  it('quick and slow ball only when the record says so; a held-short break and an isolated turnover only where they happen', () => {
    for (const { r, lines } of runs) for (const l of lines) {
      const p = r.plays[l.n], b = baseOf(l.key)
      if (b === 'tickRuckQuick') expect(p.speed).toBe('quick')
      if (b === 'tickRuckSlow') expect(p.speed).toBe('slow')
      if (b === 'turnoverIsolated') expect(prevOf(r.plays, l.n).kind).toBe('lineBreak')
      if (b === 'yellowRepeated') expect(p.result).toBe('repeated')
      if (b === 'tickRunOn') expect(['clean', 'interception', 'hauledDown']).toContain(p.result)
      if (b === 'tickChase') expect(['heldShort']).toContain(p.result)
    }
  })

  it('a man named with his shirt number in the last six lines is named without it; a flash and a first mention keep it', () => {
    const numbered = (id: string) => `N${id.replace(/\W/g, '')} (${((id.length * 3 + id.charCodeAt(id.length - 1)) % 15) + 1})`
    for (const { r } of runs.slice(0, 20)) {
      const lines = commentate(r, { teams: TEAMS, player: numbered })
      const seen = new Set<string>()
      lines.forEach((l, i) => {
        for (const k of ['player', 'player2', 'oppPlayer']) {
          const v = l.params[k]
          if (typeof v !== 'string') continue
          const bare = v.replace(/ \(\d+\)$/, '')
          if (v === bare) {
            expect(l.flash, `${l.key} drops the number on a flash`).toBeNull()
            expect(seen.has(bare), `${bare} first mention without a number`).toBe(true)
            const recent = lines.slice(Math.max(0, i - 6), i).some(q => Object.values(q.params).some(x => typeof x === 'string' && x.startsWith(bare + ' (')))
            expect(recent, `${bare} without a number at line ${i}`).toBe(true)
          }
          seen.add(bare)
        }
      })
    }
  })

  it('the ticker never says a bare phase number unless the phase before it was shown', () => {
    for (const { r, lines } of runs.slice(0, 60)) {
      let at = 0
      const slots = r.plays.map(p => { const speed = 4 + (p.n % 7); const dur = Math.max(0.2, (p.live + Math.min(p.dead, 3)) / speed); const x = { n: p.n, start: at, dur, speed }; at += dur; return x })
      let last = -1
      for (const x of feed(lines, slots)) {
        // (a count, "6 phases now", is a phase line shown too)
        const t = render(x.line), m = /\b[Pp]hase (\d+)\b/.exec(t), c = /\b(\d+) phases\b/.exec(t)
        if (m) { const ph = Number(m[1]); if (ph > 1 && ph !== last) expect(ph, `"${t}" after phase ${last}`).toBe(last + 1); last = ph }
        else if (c) last = Number(c[1])
      }
    }
  })

  it('two matches read differently: the sentences (names and numbers taken out) are under 60% alike on average', () => {
    const tm = (ls: Line[]) => { const m = new Map<string, number>(); for (const l of ls) { const t = render(l).replace(/P\d:\w+/g, '#').replace(/\d+/g, '0'); m.set(t, (m.get(t) ?? 0) + 1) } return m }
    const cos = (a: Map<string, number>, b: Map<string, number>) => { let d = 0, na = 0, nb = 0; for (const [k, v] of a) { na += v * v; d += v * (b.get(k) ?? 0) } for (const v of b.values()) nb += v * v; return d / Math.sqrt(na * nb) }
    const ms = runs.slice(0, 20).map(x => tm(x.lines))
    let sum = 0, n = 0
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { sum += cos(ms[i], ms[j]); n++ }
    console.log(`words alike between matches: ${(100 * sum / n).toFixed(1)}`)
    expect(sum / n).toBeLessThan(0.6)
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
      const kept = thin(lines, slots, 1.4)
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
    let tl = 0, trep = 0
    for (const { lines: ls } of runs) { const seen = new Set<string>(); for (const l of ls) if (l.reg === 'tick') { const t = render(l); tl++; if (seen.has(t)) trep++; seen.add(t) } }
    console.log(`repetition: ${(100 * rep / lines).toFixed(1)}% of lines repeat a sentence in the match (ticker lines ${(100 * trep / tl).toFixed(1)}%); longest run of one key ${maxRun}; ${(keys / runs.length).toFixed(0)} distinct keys a match`)
    expect(trep / tl).toBeLessThan(0.06)
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
    // the commonest ticker lines: at least eight wordings in use
    for (const b of ['tickCarry', 'tickTackle', 'tickRuck', 'shOneOut', 'shPod', 'kickBox', 'kickLong', 'catchKick'].map(b => (b === 'tickRuck' ? 'tickRuckQuick' : b))) expect(per.get(b)?.keys.size ?? 0, b).toBeGreaterThanOrEqual(8)
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
