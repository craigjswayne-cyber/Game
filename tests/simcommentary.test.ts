// The commentary is true to the record (docs/match-sim-spec.md section 6, test 6).
// Over 200 matches: every line points at a real Play of a kind it may describe,
// every kind/result pair is said or on the documented silent list, every score
// quoted is the record's score, every team and man named is on the right side,
// every summary (territory, possession, runs, phase counts, men on the field)
// is worked out again here, independently, and found true, and a re-run reads
// the same.
import { describe, it, expect } from 'vitest'
import { simSkeleton } from '../src/game/sim/skeleton'
import { commentate, render, SILENT, SUMMARY, FALLBACK, BASE_KINDS, type Line } from '../src/game/sim/commentary'
import { SIM_EN, EN_FLAT } from '../src/game/sim/commentary.en'
import type { Play, SimResult } from '../src/game/sim/record'
import type { World } from '../src/game/sim/world'

const TEAMS: [string, string] = ['Homeside', 'Awayside']
/** a world whose men carry their side in their id, so a test can tell whose man is named */
const namedWorld = (): World => {
  const id = (s: 0 | 1, role: string, r?: () => number) => `${s}:${role}${r ? Math.floor(r() * 15) + 1 : ''}`
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
  }
}
const names = { teams: TEAMS, player: (id: string) => `P${id}` }
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
const runs: { r: SimResult; lines: Line[] }[] = SEEDS.map(seed => {
  const r = simSkeleton({ seed, world: namedWorld() })
  return { r, lines: commentate(r, names) }
})
const baseOf = (key: string) => key.replace(/^sim\./, '').replace(/\d+$/, '')
const pair = (p: Play) => `${p.kind}/${p.result}`
const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)

describe('the commentary is true to the record', () => {
  it('has words for every key, and no base ends in a digit', () => {
    for (const b of Object.keys(SIM_EN)) {
      expect(b, b).not.toMatch(/\d$/)
      expect(BASE_KINDS[b], `BASE_KINDS lacks ${b}`).toBeDefined()
    }
    for (const { lines } of runs) for (const l of lines) {
      expect(EN_FLAT[l.key], l.key).toBeDefined()
      expect(render(l), l.key).not.toMatch(/[{}]/)
    }
  })

  it('every line points at a real Play of a kind it may describe, with its clock', () => {
    for (const { r, lines } of runs) {
      let last = -1
      for (const l of lines) {
        const p = r.plays[l.n]
        expect(p, `line ${l.key} n ${l.n}`).toBeDefined()
        expect(p.n).toBe(l.n)
        expect(l.t).toBe(p.t)
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
    // the silent list names only pairs the record really has
    for (const k of Object.keys(SILENT)) expect(seen.has(k), `silent pair ${k} never happens`).toBe(true)
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
    }
    for (const { r, lines } of runs) for (const l of lines) {
      const f = PREV[baseOf(l.key)]
      if (f) expect(f(r.plays[l.n - 1], r.plays[l.n]), `${l.key} at ${l.n} after ${pair(r.plays[l.n - 1])}`).toBe(true)
    }
  })

  it('says what the law gives after a kick to touch, and the lineout that follows agrees', () => {
    let checked = 0
    for (const { r, lines } of runs) for (const l of lines) {
      const b = baseOf(l.key)
      if (b !== 'penTouch' && b !== 'fiftyTwentyTwo' && b !== 'outFull') continue
      const k = r.plays[l.n], lo = r.plays[l.n + 1]
      // (the whistle can go before the lineout is taken: the kick's own line promises no throw)
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
        if (p.kind === 'try' && p.result !== 'chargeDown') want(p.who, 'try scorer')
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
  })

  it('key moments are marked key: tries, kicks at goal, cards, line breaks, tries held up', () => {
    const KEY = new Set(['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'lineBreak', 'heldUp'])
    for (const { r, lines } of runs) for (const l of lines) {
      const p = r.plays[l.n]
      if (KEY.has(p.kind) && !SUMMARY.has(baseOf(l.key))) expect(l.level, l.key).toBe('key')
      if (p.kind === 'ruck' && p.result === 'turnover') expect(l.level).toBe(p.x <= 22 || p.x >= 78 ? 'key' : 'normal')
    }
  })

  it('every summary is true when worked out again from the record so far', () => {
    let terr = 0
    for (const { r, lines } of runs) {
      const P = r.plays
      for (const l of lines) {
        const b = baseOf(l.key), p = P[l.n]
        if (b === 'territory') {
          // ball-in-play seconds in each half of the field, this half of the match, last ten minutes of clock
          let half = 0
          for (let i = 0; i < l.n; i++) if (P[i].kind === 'halfTime') half = i + 1
          const start = half === 0 ? 0 : P[half].t - P[half].live - P[half].dead
          expect(p.t - start, 'not in the first ten minutes of a half').toBeGreaterThanOrEqual(600)
          const w = [0, 0]
          for (let i = half; i <= l.n; i++) if (P[i].t > p.t - 600 && P[i].live > 0) { if (P[i].x > 50) w[0] += P[i].live; else if (P[i].x < 50) w[1] += P[i].live }
          const pct = Math.round(100 * w[l.side!] / (w[0] + w[1]))
          expect(l.params.pct).toBe(pct)
          expect(pct).toBeGreaterThanOrEqual(70)
          terr++
        }
        if (b === 'possession') {
          const w = [0, 0]
          for (let i = 0; i <= l.n; i++) w[i ? P[i - 1].ball : P[i].side] += P[i].live
          expect(l.params.hp).toBe(Math.round(100 * w[0] / (w[0] + w[1])))
        }
        if (b === 'tries') {
          const tr = [0, 0]
          for (let i = 0; i <= l.n; i++) if (P[i].kind === 'try' || P[i].kind === 'penaltyTry') tr[P[i].side]++
          expect([l.params.ht, l.params.at]).toEqual(tr)
        }
        if (b === 'winBy') {
          expect(l.params.winner).toBe(TEAMS[p.score[0] > p.score[1] ? 0 : 1])
          expect(l.params.margin).toBe(Math.abs(p.score[0] - p.score[1]))
        }
        if (b === 'draw') expect(p.score[0]).toBe(p.score[1])
        if (b === 'run') {
          // points by this side since the other side last scored
          let i = l.n, pts = 0
          while (i > 0) {
            const d = [P[i].score[0] - P[i - 1].score[0], P[i].score[1] - P[i - 1].score[1]]
            if (d[other(l.side!)] > 0) break
            pts += d[l.side!]; i--
          }
          if (i === 0) pts += P[0].score[l.side!]
          expect(l.params.count).toBe(pts)
        }
        if (b === 'phases') {
          // rucks won by this side in an unbroken run of carries and rucks (a line break or a maul keeps the run going)
          let k = 0, i = l.n
          while (i >= 0 && P[i].side === l.side && (P[i].kind === 'carry' || P[i].kind === 'lineBreak' || P[i].kind === 'maul' || (P[i].kind === 'ruck' && P[i].result === 'recycled'))) { if (P[i].kind === 'ruck') k++; i-- }
          expect(l.params.phase, `phase count at ${l.n}`).toBe(k)
        }
        if (b === 'tryAgain') {
          let c = 0
          for (let i = 0; i <= l.n; i++) if (P[i].kind === 'try' && `P${P[i].who}` === l.params.player) c++
          expect(l.params.count).toBe(c)
        }
        if (b.startsWith('yellow') || b === 'red' || b === 'binBack') {
          // men on the field: fifteen, less reds so far, less yellows within their ten minutes
          let men = 15
          for (let i = 0; i <= l.n; i++) {
            const q = P[i]
            if (q.side !== l.side) continue
            if (q.kind === 'redCard') men--
            if (q.kind === 'yellowCard' && q.t - q.live - q.dead + 600 > p.t) men--
          }
          expect(l.params.men, `${l.key} at ${l.n}`).toBe(men)
        }
      }
    }
    expect(terr).toBeGreaterThan(20)
  })

  it('says nothing about territory before ten minutes of a half have gone (the Northampton line)', () => {
    for (const { r, lines } of runs) {
      const ht = r.plays.findIndex(p => p.kind === 'halfTime')
      const second = r.plays[ht + 1], start2 = second.t - second.live - second.dead
      for (const l of lines) if (baseOf(l.key) === 'territory') expect(l.n < ht ? l.t : l.t - start2).toBeGreaterThanOrEqual(600)
    }
  })

  it('a breakdown penalty only ever follows a ruck', () => {
    for (const { r, lines } of runs) for (const l of lines) {
      if (/breakdown|ruck/.test(EN_FLAT[l.key])) {
        const p = r.plays[l.n], q = r.plays[l.n - 1]
        expect(p.kind === 'ruck' || p.kind === 'unplayable' || q?.kind === 'ruck', `${l.key} at ${pair(p)}`).toBe(true)
      }
    }
  })

  it('is the same on a re-run, and uses more than one wording', () => {
    const a = commentate(runs[0].r, names).map(render)
    const b = commentate(simSkeleton({ seed: SEEDS[0], world: namedWorld() }), names).map(render)
    expect(b).toEqual(a)
    const keys = new Set(runs[0].lines.map(l => l.key))
    expect(keys.size).toBeGreaterThan(40)
  })

  it('reads with no names at all (stage 1 sides)', () => {
    const r = simSkeleton({ seed: 7 })
    const lines = commentate(r, { teams: TEAMS, player: () => '' })
    expect(lines.length).toBeGreaterThan(150)
    for (const l of lines) { expect(render(l)).not.toMatch(/[{}]/); expect(l.params.player).toBeUndefined() }
  })
})
