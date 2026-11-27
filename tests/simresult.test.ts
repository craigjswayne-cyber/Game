// The new engine's match as the game's match (src/game/sim/toResult.ts): the same result shape as
// an old-engine match, totals that agree with the record, marks on the old engine's scale, a week
// that turns on it, and the old path untouched when it is not used.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { matchRng } from '../src/game/season/dice'
import { beginMatch, playHalf } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { replaySim2, sim2Seed, startSim2 } from '../src/game/sim/toResult'
import type { Fixture, GameState } from '../src/game/model'

const base = (() => {
  const g = newGame('leicester', 'T', 4242)
  let fx: Fixture | null | undefined = null
  // a league match (a friendly keeps no table and no records)
  for (let i = 0; i < 30; i++) {
    fx = userFixtureThisWeek(g)
    if (fx && g.comps[fx.compId]?.table?.length) break
    fx = null
    processWeekAndAdvance(g)
  }
  if (!fx) throw new Error('no fixture')
  return { g, fxId: fx.id }
})()
const fresh = () => { const g = structuredClone(base.g); return { g, fx: g.fixtures.find(f => f.id === base.fxId)! } }

/** the old engine's watched match, played straight through by the assistant */
function oldMatch(g: GameState, fx: Fixture, dice = matchRng(g)) {
  const ctx = beginMatch(g, fx, dice, true)
  ctx.assistantSubs = true
  playHalf(g, ctx); ctx.awaiting = null; playHalf(g, ctx)
  return ctx
}
/** a new-engine match played straight through, the assistant answering every call */
function newMatch(g: GameState, fx: Fixture, seed = sim2Seed(g, fx), dice?: () => ReturnType<typeof mulberry32>) {
  const s = startSim2(g, fx, seed, { assistantBench: true, ...(dice ? { dice } : {}) })
  for (let i = 0; i < 400 && !s.done; i++) { if (s.pending) s.answer(s.defaultCall()); s.runUntil({ play: s.plays.length + 40 }) }
  const r = s.finish()
  return { s, r }
}
const keysDeep = (o: unknown, pre = ''): string[] => {
  if (!o || typeof o !== 'object' || Array.isArray(o) || o instanceof Map || o instanceof Set) return [pre]
  return Object.keys(o as object).flatMap(k => keysDeep((o as Record<string, unknown>)[k], pre ? `${pre}.${k}` : k)).sort()
}

describe('toResult: the new engine as the game result', () => {
  it('gives the same shape as an old-engine match of the same fixture', () => {
    const a = fresh(), b = fresh()
    const oc = oldMatch(a.g, a.fx)
    const { r, s } = newMatch(b.g, b.fx)
    // what simMatch returns
    expect(Object.keys(r).sort()).toEqual(['events', 'motmId'])
    expect(r.motmId).not.toBeNull()
    // every key line has the fields an old-engine line has
    const oldEv = new Set(oc.events.flatMap(e => Object.keys(e)))
    for (const e of r.events) for (const k of Object.keys(e)) expect(oldEv.has(k), `event field ${k}`).toBe(true)
    for (const t of ['KO', 'TRY', 'HT', 'FT']) expect(r.events.some(e => e.type === t), t).toBe(true)
    // the fixture as the week reads it
    expect(keysDeep(b.fx).filter(k => !k.startsWith('events'))).toEqual(keysDeep(a.fx).filter(k => !k.startsWith('events')))
    expect(b.fx.played).toBe(true)
    // the players' season stats and the side's numbers the screens read
    const p0 = Object.values(a.g.players).find(p => p.clubId === a.g.userClubId)!
    expect(keysDeep(b.g.players[p0.id].stats)).toEqual(keysDeep(a.g.players[p0.id].stats))
    for (const k of ['finalR', 'tackles', 'sp', 'kicksAt', 'handKicks', 'played'] as const) {
      expect(s.ctx.home[k], k).toBeDefined()
      expect(oc.home[k], `old ${k}`).toBeDefined()
    }
    expect(s.ctx.seg).toBe(3)
  })

  it('totals agree with the record: points, tries, cards, substitutions', () => {
    for (let i = 0; i < 6; i++) {
      const b = fresh()
      const { s, r } = newMatch(b.g, b.fx, 777 + i)
      const P = s.plays
      const fin = P[P.length - 1].score
      expect([b.fx.homeScore, b.fx.awayScore]).toEqual([fin[0], fin[1]])
      for (const side of [0, 1] as const) {
        const team = side === 0 ? b.fx.homeId : b.fx.awayId
        const pts = r.events.filter(e => e.teamId === team).reduce((a, e) => a + (e.type === 'TRY' ? 5 : e.type === 'CON' ? 2 : e.type === 'PEN' || e.type === 'DG' ? 3 : 0), 0)
        // a penalty try is seven, with no conversion (Law 8)
        const pens = P.filter(p => p.kind === 'penaltyTry' && p.side === side).length
        expect(pts + 2 * pens, `points from the key lines, side ${side}`).toBe(fin[side])
        const tries = P.filter(p => (p.kind === 'try' || p.kind === 'penaltyTry') && p.side === side).length
        expect(side === 0 ? b.fx.homeTries : b.fx.awayTries).toBe(tries)
        const sd = side === 0 ? s.ctx.home : s.ctx.away
        expect(sd.yellowUntil.size).toBe(P.filter(p => p.kind === 'yellowCard' && p.side === side).length)
        expect(sd.sent).toBe(P.filter(p => p.kind === 'redCard' && p.side === side).length)
        expect(r.events.filter(e => e.type === 'YC' && e.teamId === team).length).toBe(sd.yellowUntil.size)
        const made = P.filter(p => p.kind === 'substitution' && p.result === 'made' && p.side === side)
        // a man is in the XV at the end when the last change that named him brought him on
        for (const m of made) {
          const last = [...made].reverse().find(n => n.who === m.who || n.with?.[0] === m.who)!
          expect(sd.lineup.slice(0, 15).includes(Number(m.who)), 'replaced man off the field').toBe(last.with?.[0] === m.who)
        }
        expect(r.events.filter(e => e.type === 'SUB' && e.teamId === team && (e.k === 'comm.subFromBench' || e.k === 'comm.subComesOn')).length).toBe(made.length)
        // a man hurt in the record is injured in the game
        for (const p of P.filter(q => q.kind === 'injury' && q.side === side)) expect(b.g.players[Number(p.who)].injury).toBeTruthy()
      }
    }
  })

  it('gives marks on the old engine scale, by position, over 200 matches', () => {
    type Acc = Record<string, number[]>
    const old: Acc = {}, neu: Acc = {}
    const take = (g: GameState, sides: { finalR?: Map<number, number> }[], acc: Acc) => {
      for (const sd of sides) for (const [id, r] of sd.finalR ?? []) (acc[g.players[id].pos] ??= []).push(r)
    }
    // the week's league fixtures (a position's average is many men, not one club's), nobody managed
    const g0 = base.g
    const fxs = g0.fixtures.filter(f => f.week === g0.week && !f.played && g0.comps[f.compId]?.table?.length && g0.clubs[f.homeId] && g0.clubs[f.awayId])
    expect(fxs.length).toBeGreaterThan(20)
    for (let i = 0; i < 200; i++) {
      const F = fxs[i % fxs.length]
      const a = structuredClone(g0), fa = a.fixtures.find(f => f.id === F.id)!
      const c = beginMatch(a, fa, mulberry32(9000 + i), true, null)
      c.assistantSubs = true
      playHalf(a, c); c.awaiting = null; playHalf(a, c)
      take(a, [c.home, c.away], old)
      const b = structuredClone(g0), fb = b.fixtures.find(f => f.id === F.id)!
      const s = startSim2(b, fb, 5000 + i, { userSideId: null, assistantBench: true, dice: () => mulberry32(9000 + i) })
      s.finish()
      take(b, [s.ctx.home, s.ctx.away], neu)
    }
    const st = (x: number[]) => { const m = x.reduce((a, b) => a + b, 0) / x.length; return { m, sd: Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length) } }
    for (const pos of ['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB']) {
      const o = st(old[pos]), n = st(neu[pos])
      expect(Math.abs(n.m - o.m), `${pos} mean ${n.m.toFixed(2)} v ${o.m.toFixed(2)}`).toBeLessThan(0.2)
      expect(Math.abs(n.sd - o.sd), `${pos} sd ${n.sd.toFixed(2)} v ${o.sd.toFixed(2)}`).toBeLessThan(0.25)
    }
  }, 300_000)

  it('turns a whole week on a new-engine managed match: table, bans, injuries', () => {
    const b = fresh()
    const { s } = newMatch(b.g, b.fx)
    const lg = b.g.comps[b.fx.compId]
    const before = structuredClone(lg.table)
    const row = (t: typeof before, id: string) => t.find(r => r.teamId === id)!
    const week = b.g.week
    processWeekAndAdvance(b.g)
    expect(b.g.week).not.toBe(week)
    const after = b.g.comps[b.fx.compId].table
    for (const id of [b.fx.homeId, b.fx.awayId]) expect(row(after, id).p).toBe(row(before, id).p + 1)
    const homeRow = row(after, b.fx.homeId), homeWas = row(before, b.fx.homeId)
    expect(homeRow.pf - homeWas.pf).toBe(s.ctx.home.score)
    // a man injured in the match is still out in the new week (unless a one-week knock has run)
    for (const p of s.plays.filter(q => q.kind === 'injury')) {
      const m = b.g.players[Number(p.who)]
      expect(m.injLog?.length).toBeGreaterThan(0)
    }
    // a red card's ban is on the man
    for (const p of s.plays.filter(q => q.kind === 'redCard')) expect(b.g.players[Number(p.who)].stats.rc).toBeGreaterThan(0)
  })

  it('stores every key line at the record clock minute (first-half added time held at 40)', () => {
    for (let i = 0; i < 8; i++) {
      const b = fresh()
      const { s } = newMatch(b.g, b.fx, 900 + i)
      const P = s.plays, ht = P.findIndex(p => p.kind === 'halfTime')
      const minOf = (p: (typeof P)[number]) => Math.min(p.n < ht ? 40 : 80, Math.floor((p.clock ?? p.t) / 60) + 1)
      const kinds: Record<string, string> = { try: 'TRY', penaltyTry: 'TRY', yellowCard: 'YC', redCard: 'RC', injury: 'INJ' }
      for (const [kind, type] of Object.entries(kinds)) {
        const want = P.filter(p => p.kind === kind).map(minOf)
        const got = s.ctx.events.filter(e => e.type === type && (type !== 'TRY' || true)).map(e => e.min)
        if (type === 'TRY') expect(got, `tries in match ${i}`).toEqual(P.filter(p => p.kind === 'try' || p.kind === 'penaltyTry').map(minOf))
        else expect(got, `${kind} in match ${i}`).toEqual(want)
      }
    }
  })

  it('waits for the manager to cover an injury, and a beaten defender is a missed tackle', () => {
    let waited = 0
    for (let i = 0; i < 12 && !waited; i++) {
      const b = fresh()
      const s = startSim2(b.g, b.fx, 300 + i)
      for (let k = 0; k < 2000 && !s.done; k++) {
        if (s.pending) s.answer(s.defaultCall())
        const inj = s.pendingInjury
        if (inj) {
          waited++
          expect(inj.options).toContain(inj.like)
          const pick = inj.options[inj.options.length - 1]
          s.cover(pick)
          // (made at the next restart the laws allow: never while a penalty is being taken)
          for (let q = 0; q < 6 && !s.done; q++) { if (s.pending) s.answerDefault(); s.runUntil({ play: s.plays.length + 30 }) }
          const made = s.plays.some(p => p.kind === 'substitution' && p.who === inj.who && p.with?.[0] === pick && p.result === 'made')
          expect(made || s.done).toBe(true)
          continue
        }
        s.runUntil({ play: s.plays.length + 30 })
      }
      s.finish()
      const beaten = s.plays.filter(p => p.kind === 'lineBreak' && p.beat?.length)
      expect(beaten.length).toBeGreaterThan(0)
      const missed = [...(s.ctx.home.missed ?? new Map()).values(), ...(s.ctx.away.missed ?? new Map()).values()].reduce((a, c) => a + c, 0)
      expect(missed).toBe(beaten.reduce((a, p) => a + (p.beat?.length ?? 0), 0))
    }
    expect(waited).toBeGreaterThan(0)
  }, 120_000)

  it('fills the half-time evidence in the old engine units: nothing time-like past 40 minutes', () => {
    for (let i = 0; i < 6; i++) {
      const b = fresh()
      const s = startSim2(b.g, b.fx, 600 + i, { assistantBench: true })
      for (let k = 0; k < 3000 && !s.ctx.htEv; k++) { if (s.pending) s.answerDefault(); s.runUntil({ play: s.plays.length + 1 }) }
      const ev = s.ctx.htEv!
      expect(ev).toBeDefined()
      expect(ev.min).toBeLessThanOrEqual(40)
      for (const sd of ev.side) {
        // zone is in ticks of four minutes, as the old engine counts it (evidence.ts shows zone * 4)
        for (const z of sd.zone) expect(z * 4).toBeLessThanOrEqual(40)
        expect(sd.zone.reduce((a, z) => a + z, 0) * 4).toBeLessThanOrEqual(41)
      }
      const both = ev.side[0].zone.reduce((a, z) => a + z, 0) + ev.side[1].zone.reduce((a, z) => a + z, 0)
      expect(both * 4).toBeGreaterThan(30)
      expect(both * 4).toBeLessThanOrEqual(46)
      expect(s.ctx.marginHist?.length ?? 0).toBeLessThanOrEqual(10)
    }
  })

  it('plays the same match again from its save, to the same place', () => {
    const a = fresh(), pre = structuredClone(a.g)
    const s = startSim2(a.g, a.fx, 4242, { assistantBench: true })
    s.runUntil({ clock: 1500 })
    if (s.us != null) s.apply({ kind: 'tactics', side: s.us, set: { tempo: 80 } })
    s.runUntil({ clock: 2400 })
    const save = s.save()
    const r = replaySim2(pre, save, { assistantBench: true })!
    expect(r.plays.length).toBe(s.plays.length)
    expect(r.score).toEqual(s.score)
    expect(r.ctx.events.map(e => e.text)).toEqual(s.ctx.events.map(e => e.text))
  })

  it('leaves the old engine as it was when the new one is not used', () => {
    // the switch off is the old kick-off, untouched: the same match, to the byte, whether or not a
    // new-engine match was played in between (no state is shared between the two paths)
    const a = fresh()
    oldMatch(a.g, a.fx)
    const c = fresh()
    newMatch(c.g, c.fx)
    const b = fresh()
    oldMatch(b.g, b.fx)
    expect(JSON.stringify(b.g)).toBe(JSON.stringify(a.g))
  })
})
