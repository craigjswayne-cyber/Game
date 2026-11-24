// THE SKELETON OF THE NEW MATCH SIMULATION (2.0.0 stage 1).
//
// Owner, 20 November 2026: "There is still no connection with players,
// commentary & graphics... I want this doing proper." The new engine plays a
// match one phase at a time and writes a record of it. This holds the first
// stage: the same seed plays the same match, no match ever does anything the
// laws forbid (an illegal move throws inside the simulation), the record is
// continuous, and an average match has the shape of a real one. The full
// table against its sources is scripts/simshape.ts.
import { describe, expect, it } from 'vitest'
import { MatchSim, simSkeleton, simWithDecisions } from '../src/game/sim/skeleton'
import { evenWorld, NEUTRAL_STYLE, type Decision, type PlayStyle, type World } from '../src/game/sim/world'
import { LAW_TABLE, Laws, lawMachine } from '../src/game/sim/law'
import type { Play } from '../src/game/sim/record'
import { getInitialSnapshot, getNextSnapshot } from 'xstate'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { worldFromMatch } from '../src/game/sim/fromMatch'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'

describe('the match skeleton', () => {
  it('plays the same match from the same seed', () => {
    expect(JSON.stringify(simSkeleton({ seed: 7 }))).toBe(JSON.stringify(simSkeleton({ seed: 7 })))
    expect(JSON.stringify(simSkeleton({ seed: 7 }))).not.toBe(JSON.stringify(simSkeleton({ seed: 8 })))
  })

  it('keeps the laws, the clock and the score over 300 matches', () => {
    const N = 300
    let rucks = 0, scrums = 0, lineouts = 0, pens = 0, tries = 0, points = 0, live = 0, kicks = 0
    for (let i = 0; i < N; i++) {
      const r = simSkeleton({ seed: 5000 + i }) // an illegal sequence throws
      const last = r.plays[r.plays.length - 1]
      expect(last.kind).toBe('fullTime')
      expect(r.plays.filter(p => p.kind === 'halfTime').length).toBe(1)
      let s0 = 0, s1 = 0
      for (let k = 0; k < r.plays.length; k++) {
        const p = r.plays[k]
        expect(p.n).toBe(k)
        expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(100)
        // the score only ever goes up, and only on a score
        expect(p.score[0]).toBeGreaterThanOrEqual(s0); expect(p.score[1]).toBeGreaterThanOrEqual(s1)
        if (p.score[0] + p.score[1] > s0 + s1) expect(['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal']).toContain(p.kind)
        s0 = p.score[0]; s1 = p.score[1]
        // a try is followed by its conversion, and a score by a kick-off (or the whistle)
        if (p.kind === 'try') expect(r.plays[k + 1].kind).toBe('conversion')
        if (p.kind === 'conversion' || p.kind === 'penaltyTry' || (p.kind === 'penaltyGoal' && p.good)) expect(['kickoff', 'halfTime', 'fullTime']).toContain(r.plays[k + 1].kind)
        // a scrum has a reason before it
        if (p.kind === 'scrum') {
          let j = k - 1
          while (r.plays[j].kind === 'yellowCard' || r.plays[j].kind === 'redCard') j--
          expect(['knockOn', 'forwardPass', 'notStraight', 'unplayable', 'restartError', 'penalty', 'halfTime']).toContain(r.plays[j].kind)
        }
        live += p.live
        if (p.kind === 'ruck' || p.kind === 'maul') rucks++
        if (p.kind === 'scrum') scrums++
        if (p.kind === 'lineout') lineouts++
        if (p.kind === 'kick') kicks++
        if (p.kind === 'penalty' || p.kind === 'freeKick') pens++
        if (p.kind === 'try' || p.kind === 'penaltyTry') tries++
      }
      expect(r.score).toEqual(last.score)
      points += r.score[0] + r.score[1]
    }
    // the shape of a real match (docs/match-sim-spec.md section 4), with room for 300 matches of noise
    expect(live / N / 60).toBeGreaterThan(32); expect(live / N / 60).toBeLessThan(38)
    expect(rucks / N).toBeGreaterThan(150); expect(rucks / N).toBeLessThan(190)
    expect(kicks / N).toBeGreaterThan(38); expect(kicks / N).toBeLessThan(52)
    expect(scrums / N).toBeGreaterThan(11); expect(scrums / N).toBeLessThan(17)
    expect(lineouts / N).toBeGreaterThan(22); expect(lineouts / N).toBeLessThan(29)
    expect(pens / N).toBeGreaterThan(9.5); expect(pens / N).toBeLessThan(13.5)
    expect(tries / N).toBeGreaterThan(5.6); expect(tries / N).toBeLessThan(7)
    expect(points / N).toBeGreaterThan(46); expect(points / N).toBeLessThan(55)
  })

  it('lets the stronger side win more often', () => {
    let strong = 0
    const N = 300
    for (let i = 0; i < N; i++) { const r = simSkeleton({ seed: 9000 + i, strength: [1.15, 1] }); if (r.score[0] > r.score[1]) strong++ }
    expect(strong / N).toBeGreaterThan(0.6)
  })

  it('runs on the fast table exactly as the XState machine does', () => {
    for (const from of Object.keys(LAW_TABLE) as (keyof typeof LAW_TABLE)[]) {
      // walk the machine to the state (every state is reachable in two moves from the start)
      let snap = getInitialSnapshot(lawMachine)
      const path: Record<string, string[]> = { kickoff: [], open: ['KICKOFF'], touch: ['KICKOFF', 'TOUCH'], scrum: ['KICKOFF', 'STOP'], penalty: ['KICKOFF', 'PENALTY'], try: ['KICKOFF', 'TRY'], dropout: ['KICKOFF', 'DEAD'] }
      for (const e of path[from]) snap = getNextSnapshot(lawMachine, snap, { type: e })
      expect(snap.value).toBe(from)
      for (const e of ['KICKOFF', 'DROPOUT', 'PLAY', 'KICK', 'TOUCH', 'LINEOUT', 'STOP', 'SCRUM', 'PENALTY', 'GOAL', 'GOALMISS', 'DROPGOAL', 'DROPMISS', 'TRY', 'CON', 'DEAD', 'HALF'] as const) {
        const L = new Laws(from)
        expect(L.can(e)).toBe(snap.can({ type: e }))
        if (L.go(e)) expect(L.state).toBe(getNextSnapshot(lawMachine, snap, { type: e }).value)
      }
    }
  })
})

/** the laws and the record rules, over a whole match: the test above, as a function */
function legal(plays: Play[]) {
  const L = new Laws()
  let t = -1
  for (let k = 0; k < plays.length; k++) {
    const p = plays[k]
    expect(p.n).toBe(k)
    expect(p.t).toBeGreaterThanOrEqual(t); t = p.t
    if (p.kind === 'try') expect(plays[k + 1].kind).toBe('conversion')
    if (p.kind === 'scrum') {
      let j = k - 1
      while (['yellowCard', 'redCard', 'substitution'].includes(plays[j].kind)) j--
      expect(['knockOn', 'forwardPass', 'notStraight', 'unplayable', 'restartError', 'penalty', 'halfTime']).toContain(plays[j].kind)
    }
  }
  expect(plays[plays.length - 1].kind).toBe('fullTime')
  return L
}

describe('the manager\'s hand (spec stage 3: a match that can be stopped, changed and carried on)', () => {
  it('plays exactly the same match when it is stopped and carried on with no decision, or saved and picked up again', () => {
    for (const seed of [3, 17, 4242]) {
      const whole = JSON.stringify(simSkeleton({ seed }))
      const m = new MatchSim({ seed })
      m.runUntil({ clock: 1200 }); m.runUntil({ play: 300 }); m.runUntil({ t: 3000, dead: true })
      const saved = m.save()
      m.runUntil()
      expect(JSON.stringify(m.result())).toBe(whole)
      // the saved state, picked up in a new MatchSim, plays the same rest of the match
      expect(JSON.stringify(new MatchSim({ seed, from: saved }).runUntil().result())).toBe(whole)
      // and simWithDecisions with none is simSkeleton
      expect(JSON.stringify(simWithDecisions({ seed, decisions: [] }))).toBe(whole)
    }
  })

  it('keeps everything before a decision at minute 50, and plays a legal match after it', () => {
    let changed = 0
    for (let seed = 100; seed < 140; seed++) {
      const base = simSkeleton({ seed })
      const m = new MatchSim({ seed }).runUntil({ clock: 3000 })
      const at = m.plays.length
      m.apply({ kind: 'strength', side: 1, factor: 0.8 })
      m.apply({ kind: 'penaltyCall', side: 0, call: 'corner' })
      const r = m.runUntil().result()
      expect(JSON.stringify(r.plays.slice(0, at))).toBe(JSON.stringify(base.plays.slice(0, at)))
      expect(r.plays[at - 1].clock).toBeGreaterThanOrEqual(3000)
      legal(r.plays)
      if (JSON.stringify(r.plays.slice(at)) !== JSON.stringify(base.plays.slice(at))) changed++
      // the same decisions at the same moment: the same match
      expect(JSON.stringify(simWithDecisions({ seed, decisions: [
        { at: { clock: 3000 }, decision: { kind: 'strength', side: 1, factor: 0.8 } },
        { at: { clock: 3000 }, decision: { kind: 'penaltyCall', side: 0, call: 'corner' } },
      ] }))).toBe(JSON.stringify(r))
    }
    expect(changed).toBeGreaterThan(35)
  })

  it('a strong change from minute 40 (strength x1.15) wins more matches over 300 seeds', () => {
    let before = 0, after = 0
    for (let seed = 2000; seed < 2300; seed++) {
      const a = simSkeleton({ seed })
      if (a.score[0] > a.score[1]) before++
      const b = new MatchSim({ seed }).runUntil({ clock: 2400 })
      b.apply({ kind: 'strength', side: 0, factor: 1.15 })
      const r = b.runUntil().result()
      if (r.score[0] > r.score[1]) after++
    }
    expect(after - before).toBeGreaterThan(30)
  })

  it('stops for the manager\'s penalty call and does what he says', () => {
    let asked = 0
    for (let seed = 50; seed < 70; seed++) {
      const m = new MatchSim({ seed })
      m.apply({ kind: 'penaltyCall', side: 0, call: 'ask' })
      for (let g = 0; g < 100 && !m.done; g++) {
        m.runUntil()
        const p = m.pending
        if (!p) break
        asked++
        expect(p.side).toBe(0)
        const at = m.plays.length
        m.answer(p.options.includes('posts') ? 'posts' : 'corner')
        m.step()
        const next = m.plays[at]
        if (p.options.includes('posts')) expect(next.kind).toBe('penaltyGoal')
        else expect(next.kind === 'kick' && next.result === 'penaltyToTouch' || next.kind === 'tap').toBe(true)
      }
      legal(m.plays)
    }
    expect(asked).toBeGreaterThan(40)
  })

  it('makes a substitution at the next dead ball and writes it in the record', () => {
    // a world with a bench of one: the man on wears the shirt from then on
    const named = (): World => {
      let on = false
      return { ...evenWorld(), carrier: s => (s === 1 ? 'X9' : on ? 'B16' : 'A8'), decide: d => { if (d.kind === 'substitution') on = true; return '' } }
    }
    const m = new MatchSim({ seed: 9, world: named() }).runUntil({ clock: 3000 })
    m.apply({ kind: 'substitution', side: 0, off: 'A8', on: 'B16' })
    const r = m.runUntil().result()
    const k = r.plays.findIndex(p => p.kind === 'substitution')
    expect(k).toBeGreaterThan(0)
    expect(r.plays[k]).toMatchObject({ side: 0, who: 'A8', with: ['B16'], result: 'made' })
    // made with the ball dead: the next play is a restart or a stoppage's set piece, never a phase
    expect(['kickoff', 'dropout22', 'goalLineDropout', 'scrum', 'lineout', 'penalty', 'freeKick', 'halfTime', 'fullTime']).toContain(r.plays[k + 1].kind)
    expect(r.plays.slice(k + 1).some(p => p.who === 'A8')).toBe(false)
    expect(r.plays.slice(k + 1).some(p => p.who === 'B16')).toBe(true)
    legal(r.plays)
  })

  it('takes a real substitution on the real sides: the man off is never seen again and the man on plays', () => {
    const g = newGame('leicester', 'T', 4242)
    let fx: Fixture | null | undefined = null
    for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
    const { world, home, away } = worldFromMatch(g, fx!, mulberry32(1))
    const userSide: 0 | 1 = home.teamId === g.userClubId ? 0 : 1
    const sheet = userSide === 0 ? home : away
    // the No. 8 off, the bench back-rower (shirt 19 or 20) on
    const off = sheet.players.find(p => p.shirt === 8)!.id
    const m = new MatchSim({ seed: 6, world }).runUntil({ clock: 3000 })
    // a back-rower off the bench if one is left (a hurt man may already have taken shirt 20), else anyone
    const bench = world.lineup!(userSide).bench
    const on = bench[4] || bench[3] || bench.find(Boolean)!
    expect(sheet.players.some(p => p.id === on && p.shirt > 15)).toBe(true)
    m.apply({ kind: 'substitution', side: userSide, off, on })
    const r = m.runUntil().result()
    // (the manager's change: a hurt man may have been replaced before it)
    const k = r.plays.findIndex(p => p.kind === 'substitution' && p.who === off)
    expect(r.plays[k]).toMatchObject({ result: 'made', who: off, with: [on] })
    const later = r.plays.slice(k + 1).filter(p => p.side === userSide || p.ball === userSide)
    expect(later.some(p => p.who === off || p.with?.includes(off))).toBe(false)
    expect(r.plays.slice(k + 1).some(p => p.who === on || p.with?.includes(on) || p.vs?.includes(on))).toBe(true)
    legal(r.plays)
  }, 60000)
})

describe('team identity (round 4): two styles, the same strengths, two different matches to watch', () => {
  // a kicking, forward-driven side against a ball-in-hand, wide, offloading one, both average
  const pack: PlayStyle = { ...NEUTRAL_STYLE, atk: 'kick', def: 'choke', kick: 1.5, width: 0.21, maul: 1.4, pick: 1.4, offload: 0.7, corner: 0.5, tempo: 1.08,
    kickMix: { ...NEUTRAL_STYLE.kickMix, long: 1.5, touch: 1.5, box: 1.3 } }
  const hand: PlayStyle = { ...NEUTRAL_STYLE, atk: 'offload', def: 'blitz', kick: 0.6, width: 0.40, maul: 0.7, pick: 0.7, offload: 2.2, tempo: 0.88, blitz: 0.8, quick: 1.3,
    kickMix: { ...NEUTRAL_STYLE.kickMix, chip: 2, crossField: 2, grubber: 1.5 } }
  const shapeOf = (st: PlayStyle) => {
    let kicks = 0, carries = 0, wide = 0, mauls = 0, offloads = 0, lineouts = 0, margin = 0
    const N = 200
    for (let seed = 1; seed <= N; seed++) {
      const w: World = { ...evenWorld(), style: () => st }
      const r = new MatchSim({ seed, world: w }).runUntil().result()
      margin += r.score[0] - r.score[1]
      let prev: Play | null = null
      for (const p of r.plays) {
        if (p.kind === 'kick' && p.result !== 'penaltyToTouch') kicks++
        if (p.kind === 'carry') { carries++; if (prev && Math.abs(p.y - prev.y) > 10) wide++ }
        if (p.kind === 'maul') mauls++
        if (p.kind === 'offload') offloads++
        if (p.kind === 'lineout' && p.result === 'won') lineouts++
        prev = p
      }
    }
    return { kicks: kicks / N, wide: wide / carries, maulsPerLineout: mauls / lineouts, offloads: offloads / N }
  }
  it('kicks, width, mauls and offloads all differ, each the way the style says', () => {
    const a = shapeOf(pack), b = shapeOf(hand)
    expect(a.kicks).toBeGreaterThan(b.kicks * 1.4)
    expect(b.wide).toBeGreaterThan(a.wide * 1.4)
    expect(a.maulsPerLineout).toBeGreaterThan(b.maulsPerLineout * 1.5)
    expect(b.offloads).toBeGreaterThan(a.offloads * 2)
  })

  it('real clubs bring their own way of playing through the World', () => {
    const g = newGame('leicester', 'T', 4242)
    let fx: Fixture | null | undefined = null
    for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
    const { world } = worldFromMatch(g, fx!, mulberry32(1))
    const a = world.style!(0), b = world.style!(1)
    expect(a.atk).toBeTruthy(); expect(b.atk).toBeTruthy()
    expect(world.weather).toBeTruthy()
    // the two sides read differently on at least one lever a watcher sees
    expect(Math.abs(a.kick - b.kick) + Math.abs(a.width - b.width) + Math.abs(a.offload - b.offload) + Math.abs(a.maul - b.maul)).toBeGreaterThan(0.05)
  }, 60000)
})

describe('the manager decides the match (round 5: "this can\'t be a preset result")', () => {
  // one real fixture, the manager's own side; every change is made on a copy of the game
  const g0 = newGame('leicester', 'T', 4242)
  let fx0: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx0; i++) { fx0 = userFixtureThisWeek(g0); if (!fx0) processWeekAndAdvance(g0) }
  const base = worldFromMatch(g0, fx0!, mulberry32(1))
  const us: 0 | 1 = base.home.teamId === g0.userClubId ? 0 : 1
  const sheet = (us === 0 ? base.home : base.away).players
  const lineup = Array.from({ length: 23 }, (_, i) => Number(sheet.find(p => p.shirt === i + 1)?.id))
  const worldWith = (change: (g: typeof g0) => void) => {
    const g = structuredClone(g0)
    const tac = g.clubs[g.userClubId].tactic as unknown as Record<string, unknown>
    tac.lineup = lineup.slice(); tac.userPicked = true
    change(g)
    return worldFromMatch(g, g.fixtures.find(f => f.id === fx0!.id)!, mulberry32(1)).world
  }
  const N = 300
  const play = (w: World, seed: number, at?: number, d?: Decision[]) => {
    const m = new MatchSim({ seed, world: w })
    if (at != null) { m.runUntil({ clock: at }); for (const x of d ?? []) m.apply(x) }
    return m.runUntil().result()
  }
  const sum = (w: World, f: (r: ReturnType<typeof play>) => number, at?: number, d?: (s: 0 | 1) => Decision[]) => {
    let t = 0
    for (let i = 0; i < N; i++) t += f(play(w, 7000 + i, at, d?.(us)))
    return t / N
  }
  const margin = (r: ReturnType<typeof play>) => r.score[us] - r.score[us === 0 ? 1 : 0]

  // each kind of decision, made at 40:00 or 60:00: everything before it as it was, the match after it moved
  // (the last number: in how many of 120 matches the rest must differ; a penalty call only bites in a
  // match where a kickable penalty comes after the call)
  const kinds: [string, number, (s: 0 | 1) => Decision[], (r: ReturnType<typeof play>, at: number) => number, number?][] = [
    ['tactics (kicking 20 to 90)', 2400, s => [{ kind: 'tactics', side: s, set: { kicking: 90 } }], (r, at) => r.plays.filter(p => p.t >= at && p.side === us && p.kind === 'kick').length],
    ['half-time talk (criticise)', 2400, s => [{ kind: 'talk', side: s, tone: 'criticise' }], r => margin(r)],
    ['substitution (No. 8 off)', 3600, s => [{ kind: 'substitution', side: s, off: lineup[7].toString(), on: lineup[19].toString() }], (r, at) => r.plays.filter(p => p.t >= at && (p.who === lineup[19].toString() || p.with?.includes(lineup[19].toString()))).length],
    ['the bench to the game', 3600, s => [{ kind: 'bench', side: s, auto: true }], (r, at) => r.plays.filter(p => p.t >= at && p.kind === 'substitution' && p.side === us).length],
    ['penalties to the corner', 3600, s => [{ kind: 'penaltyCall', side: s, call: 'corner' }], (r, at) => r.plays.filter(p => p.t >= at && p.side === us && p.kind === 'penaltyGoal').length, 55],
  ]
  for (const [name, at, dec, stat, most] of kinds) {
    it(`a decision at ${at / 60}:00 changes the match from then on, and nothing before it: ${name}`, () => {
      let differ = 0, before = 0, after = 0
      for (let i = 0; i < 120; i++) {
        const seed = 8000 + i
        const a = play(base.world, seed), m = new MatchSim({ seed, world: base.world }).runUntil({ clock: at })
        const cut = m.plays.length, tCut = m.st.t
        for (const d of dec(us)) m.apply(d)
        const b = m.runUntil().result()
        expect(JSON.stringify(b.plays.slice(0, cut))).toBe(JSON.stringify(a.plays.slice(0, cut)))
        if (JSON.stringify(b.plays.slice(cut)) !== JSON.stringify(a.plays.slice(cut))) differ++
        before += stat(a, tCut); after += stat(b, tCut)
      }
      expect(differ).toBeGreaterThan(most ?? 100)
      // and it moves what it should (the talk's direction is the old engine's own talk model: only that it moves)
      expect(after).not.toBe(before)
    }, 60000)
  }

  it('out-of-position selection costs: the loosehead and the left wing swapped', () => {
    const ok = sum(worldWith(() => {}), margin)
    const swapped = sum(worldWith(g => { const lu = g.clubs[g.userClubId].tactic.lineup; const t = lu[0]; lu[0] = lu[10]; lu[10] = t }), margin)
    expect(ok - swapped).toBeGreaterThan(2)
  }, 120000)

  it('tired men cost: the fifteen at 70% condition against fresh', () => {
    const fresh = sum(worldWith(g => { for (const id of lineup.slice(0, 15)) g.players[id].cond = 100 }), margin)
    const tired = sum(worldWith(g => { for (const id of lineup.slice(0, 15)) g.players[id].cond = 70 }), margin)
    expect(fresh - tired).toBeGreaterThan(3)
  }, 120000)

  it('poor discipline costs: aggression 95 gives away more penalties and more cards than 20', () => {
    const pens = (r: ReturnType<typeof play>) => r.plays.filter(p => (p.kind === 'penalty' || p.kind === 'freeKick') && p.side !== us).length
    const cards = (r: ReturnType<typeof play>) => r.plays.filter(p => (p.kind === 'yellowCard' || p.kind === 'redCard') && p.side === us).length
    const clean = worldWith(g => { g.clubs[g.userClubId].tactic.aggression = 20 }), dirty = worldWith(g => { g.clubs[g.userClubId].tactic.aggression = 95 })
    expect(sum(dirty, pens)).toBeGreaterThan(sum(clean, pens) * 1.04)
    expect(sum(dirty, cards)).toBeGreaterThan(sum(clean, cards) * 1.4)
  }, 120000)

  it('the named man matters: the carrier, the tackler and the kicker are the men themselves', () => {
    const w = base.world
    const field = w.lineup!(us).field
    const forms = field.filter(Boolean).map(id => w.man!(us, id, 0))
    // the side's men differ from one another, and the average man is the side
    expect(Math.max(...forms.map(f => f.carry)) / Math.min(...forms.map(f => f.carry))).toBeGreaterThan(1.1)
    const mean = forms.reduce((a, f) => a + f.tackle, 0) / forms.length
    expect(mean).toBeGreaterThan(0.95); expect(mean).toBeLessThan(1.05)
    // a man who has played sixty minutes has worse legs than one fresh off the bench
    const starter = w.man!(us, field[7], 3600)
    w.decide!({ kind: 'substitution', side: us, off: field[5], on: w.lineup!(us).bench[4] || w.lineup!(us).bench[3] }, 3600)
    const fresh = w.man!(us, w.lineup!(us).field[5], 3600)
    expect(fresh.tackle / w.man!(us, w.lineup!(us).field[5], 0).tackle).toBeGreaterThan(starter.tackle / w.man!(us, field[7], 0).tackle)
    w.newMatch!()
  })
})

