/**
 * ---- THE GAME REMEMBERS, AND SO DO THEY (1.8.4, phase 4) ----
 *
 * Two memories, both read off records the save already keeps, with no rng
 * anywhere and nothing mocked in the matches:
 *
 *   TACTICAL MEMORY (tacmemory.ts). What the last few club matches say, as a
 *   conclusion with its numbers, on the desk's tactics row: at most two, each
 *   past a fixed threshold with a minimum sample behind it.
 *
 *   OPPONENT MEMORY (rematch.ts). A coach who lost to the manager leans a
 *   little against what beat him, the next time they meet.
 *
 * What must hold:
 *   1. The conclusions: nothing from too few matches or a noisy count; a
 *      clear trend named with its numbers; at most two; the same twice.
 *   2. The rematch reads the last meeting's evidence and nothing hidden: it
 *      follows the record, ignores the manager's real strengths, is per
 *      opponent, scaled by the kind of coach (analyst most, stubborn least)
 *      and by how long ago, and never past its caps.
 *   3. No runaway: the same cause beaten twice is no harder the third time;
 *      a new cause replaces the old; a loss forgets it; a call put away is
 *      not planned for, and one hidden among others less.
 *   4. The effect, on real matches played in pairs on the same dice: the
 *      rematch at its cap against the tape at full, in points a match.
 *   5. A signature call run every match keeps a positive edge against the
 *      sharpest analyst over a season of rematches with the memory at its cap.
 *   6. Nothing hidden: over a season, the report's line, the desk thread and
 *      the kick-off line appear in exactly the matches the engine applied it,
 *      and read as words in six languages.
 *
 * Run: npx vite-node scripts/memoryloopprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, playSegment, playHalf, type LiveCtx } from '../src/game/matchEngine'
import { matchRng, processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'
import { fileEvidence, type CausalEvidence } from '../src/game/evidence'
import { fileFindings } from '../src/game/matchfindings'
import { buildReport, isClubFixture, opponentIn } from '../src/game/oppreport'
import { ADAPT_MAX, adaptMap, adaptOf, tallyCalls } from '../src/game/armsrace'
import { archetypeOf } from '../src/game/oppcoach'
import { MEM_ADAPT, MEM_UNIT, rematchLine, rematchOf, withRematch, type Rematch } from '../src/game/rematch'
import { MIN_MATCHES, tacticalMemory, tacticalNotes } from '../src/game/tacmemory'
import { buildDesk } from '../src/game/desk'
import { moveEdge } from '../src/game/moves'
import { playbookOf } from '../src/game/playbook'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'ja', 'af']
for (const l of LANGS) await ensureLang(l)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) ** 2)) * xs.length / Math.max(1, xs.length - 1)) }
const f2 = (x: number) => x.toFixed(2)
const t0 = performance.now()
const lap = () => console.log(`      (${((performance.now() - t0) / 1000).toFixed(0)}s)`)
/** a line as the screen says it, the _k values translated */
const say = (lang: Lang, k: string, v: Record<string, string | number> = {}) =>
  tIn(lang, k, Object.fromEntries(Object.entries(v).flatMap(([n, x]) => n.endsWith('_k') ? [[n, x], [n.slice(0, -2), tIn(lang, String(x))]] : [[n, x]])))
const rawKey = (s: string) => /\b[a-z]+\.[a-zA-Z_]+\b/.test(s.replace(/\d+\.\d+/g, '')) || /[{}]/.test(s)

const L = 'mv_loop', S = 'mv_switch'

function emptyEv(oppId: string, season: number, week: number, fxId = 1): CausalEvidence {
  const s = () => ({
    calls: {} as Record<string, number[]>, pts: [0, 0, 0, 0, 0, 0], breaks: 0, styleEdge: 0, blunted: 0,
    setWon: [6, 12] as [number, number], setLost: [1, 2] as [number, number],
    turnWon: [0, 0, 0], turnLost: [0, 0, 0], pens: 0, zone: [3, 14, 3],
  })
  return { fxId, season, week, oppId, us: 0, them: 0, min: 80, poss: 50, side: [s(), s()], swings: [], lead: [], late: 0 }
}
/** a meeting won by a cause, worth `p` points to it */
function wonBy(cause: 'move' | 'break' | 'set' | 'turn' | 'pen', oppId: string, season: number, week: number, p = 14, fxId = 1): CausalEvidence {
  const e = emptyEv(oppId, season, week, fxId)
  const [u, o] = e.side
  if (cause === 'move') { u.pts[0] = p; u.calls[L] = [8, 40, 2, 0, 0] }
  if (cause === 'break') { u.pts[2] = p; u.breaks = 6; o.breaks = 1 }
  if (cause === 'turn') { u.pts[1] = p; u.turnWon = [2, 2, 2] }
  if (cause === 'pen') { u.pts[4] = p; o.pens = 12 }
  if (cause === 'set') { u.pts[5] = 3; u.setLost = [0, 0]; o.setLost = [0, 7] }
  e.us = cause === 'set' ? 3 : p
  e.them = 0
  return e
}

const base = newGame('leicester', 'Memory', 1840)
const me0 = base.clubs[base.userClubId]
// a signature playbook: the loop on two balls in three, the switch on the third
me0.tactic.moveMain = L; me0.tactic.moveAlt = S; me0.tactic.moveMix = 67
{
  const pb = playbookOf(me0)
  pb.drilled[L] = 85; pb.drilled[S] = 85
  pb.reps = { ...(pb.reps ?? {}), [L]: 15, [S]: 15 }
}
const S0 = base.season
const league = Object.values(base.clubs).filter(c => c.id !== base.userClubId && c.leagueId === me0.leagueId && c.philosophy)
const byArch = (a: string) => league.filter(c => archetypeOf(c.id, c.rep) === a).sort((x, y) => y.rep - x.rep)[0]
const analyst = byArch('analyst'), reactive = byArch('reactive'), stubborn = byArch('stubborn')
console.log(`analyst ${analyst?.id} (rep ${analyst?.rep}), reactive ${reactive?.id}, stubborn ${stubborn?.id}`)
if (!analyst || !reactive || !stubborn) { console.log('FAIL: the league needs one coach of each kind'); process.exit(1) }

/** a state with these records filed, and the tape set */
function withEv(evs: CausalEvidence[], faced: Record<string, number> = { [L]: 20, [S]: 10 }): GameState {
  const g = structuredClone(base)
  g.tacLoop = { findings: [], evidence: evs }
  playbookOf(g.clubs[g.userClubId]).faced = { ...faced }
  return g
}

// ------------------------------------------------------------------ 1
console.log('\n--- 1. tactical memory: conclusions, on constructed records\n')
{
  const opp = league.map(c => c.id)
  const run = (f: (e: CausalEvidence, i: number) => void, n = 6) => {
    const evs = Array.from({ length: n }, (_, i) => { const e = emptyEv(opp[i % opp.length], 0, i + 1, i + 1); e.side[1].breaks = 4; e.side[0].breaks = 4; f(e, i); return e })
    return withEv(evs)
  }
  ok(tacticalNotes(run(() => {}, MIN_MATCHES - 1)).length === 0, `fewer than ${MIN_MATCHES} club matches: nothing said`)
  ok(tacticalNotes(run(() => {})).length === 0, 'six matches with nothing moving: nothing said')
  const tight = run((e, i) => { e.side[1].breaks = i < 3 ? 8 : 3 })
  const n1 = tacticalNotes(tight)
  ok(n1[0]?.k === 'desk.memBreaksAgainstBetter' && n1[0].v.a === 8 && n1[0].v.b === 3, `line breaks against 8, 8, 8 then 3, 3, 3: "${say('en', n1[0]?.k ?? '', n1[0]?.v)}"`)
  const noisy = run((e, i) => { e.side[1].breaks = [3, 10, 4, 9, 2, 8][i] })
  ok(!tacticalNotes(noisy).some(n => n.k.startsWith('desk.memBreaksAgainst')), 'the same averages moved by a few wild matches (3, 10, 4 then 9, 2, 8): no trend named')
  const lo = run((e, i) => { e.side[0].setWon = [6, 12]; e.side[0].setLost = [1, i < 3 ? 5 : 1] })
  const n2 = tacticalNotes(lo).find(n => n.cat === 'setpiece')
  ok(n2?.k === 'desk.memSetBetter' && n2.v.unit_k === 'oppreport.u_lineout', `own lineout lost 5 in 17 then 1 in 13: "${n2 ? say('en', n2.k, n2.v) : ''}"`)
  const strong = run((e, i) => { e.side[0].calls[L] = [8, 30, i % 2 ? 1 : 0, 0, 0]; if (i === 5) e.side[0].calls[L][2] = 2 })
  const n3 = tacticalNotes(strong).find(n => n.cat === 'attack')
  ok(n3?.k === 'desk.memStrong', `the loop scoring in three of six, four tries: "${n3 ? say('en', n3.k, n3.v) : ''}"`)
  const read = run((e, i) => { e.side[0].calls[L] = [8, 30, 0, i < 3 ? 0 : 6, 4] })
  const n4 = tacticalNotes(read).find(n => n.cat === 'adapt')
  ok(n4?.k === 'desk.memRead' && n4.v.pct === 75, `the loop set for on none of its runs, then 18 of 24: "${n4 ? say('en', n4.k, n4.v) : ''}"`)
  const steady = run((e) => { e.side[0].calls[L] = [8, 30, 0, 6, 4] })
  ok(!tacticalNotes(steady).some(n => n.cat === 'adapt'), 'set for it all along: not "beginning to"')
  const gone = structuredClone(strong)
  gone.clubs[gone.userClubId].tactic.moveMain = 'mv_crash'
  gone.clubs[gone.userClubId].tactic.moveAlt = undefined
  ok(!tacticalNotes(gone).some(n => n.k === 'desk.memStrong'), 'a call no longer in the playbook is not called a strength')
  const all = run((e, i) => { e.side[1].breaks = i < 3 ? 8 : 3; e.side[0].setLost = [1, i < 3 ? 5 : 1]; e.side[0].calls[L] = [8, 30, i % 2 ? 1 : 0, i < 3 ? 0 : 6, 4]; if (i === 5) e.side[0].calls[L][2] = 2 })
  const many = tacticalNotes(all)
  ok(many.length >= 3 && tacticalMemory(all).length === 2 && new Set(many.map(n => n.cat)).size === many.length, `four kinds supported, one a kind, two shown (${many.map(n => n.k.slice(8)).join(', ')})`)
  ok(JSON.stringify(tacticalNotes(all)) === JSON.stringify(many), 'read twice, the same')
  const tests = structuredClone(tight)
  for (const e of tests.tacLoop!.evidence!) e.oppId = 'ENG'
  ok(tacticalNotes(tests).length === 0, 'Test matches are not the club\'s trend')
  const desk = buildDesk(all).rows.find(r => r.id === 'tactics')!
  ok(desk.lines.filter(l => l.k.startsWith('desk.mem')).length === 2, 'the desk\'s tactics row carries the two')
  let raw = 0
  for (const n of many) for (const l of LANGS) if (rawKey(say(l, n.k, n.v))) raw++
  ok(raw === 0, 'and they read as words in six languages')
}

// ------------------------------------------------------------------ 2
console.log('\n--- 2. the rematch reads the last meeting\'s record, and nothing else\n')
const A = analyst.id
{
  const r = (g: GameState, id = A) => rematchOf(g, id)
  ok(r(withEv([wonBy('break', A, S0, 3)]))?.unit === 'defence', 'won through line breaks: his defence')
  ok(r(withEv([wonBy('turn', A, S0, 3)]))?.unit === 'breakdown', 'won through turnovers: his breakdown')
  ok(r(withEv([wonBy('set', A, S0, 3)]))?.unit === 'lineout', 'won on his lineout ball: his lineout')
  const mv = r(withEv([wonBy('move', A, S0, 3)]))
  ok(mv?.cause === 'move' && mv.move === L && mv.adapt > 0, 'won through the loop: his defence set for the loop')
  ok(r(withEv([wonBy('pen', A, S0, 3)])) === null, 'won through his penalties: nothing he can plan against, nothing changed')
  const lost = wonBy('break', A, S0, 3); lost.them = 40
  ok(r(withEv([lost])) === null, 'a meeting he won: nothing changed')
  const drew = wonBy('break', A, S0, 3); drew.them = drew.us
  ok(r(withEv([drew])) === null, 'a draw: nothing changed')
  ok(r(withEv([wonBy('break', reactive.id, S0, 3)])) === null, 'per opponent: a record against another side is not his')
  ok(r(withEv([])) === null, 'no record: nothing, whatever the tape')
  // not omniscient: the same record, a far better or far worse squad
  const g = withEv([wonBy('break', A, S0, 3)])
  const before = JSON.stringify(r(g))
  for (const id of g.clubs[g.userClubId].players) { const p = g.players[id]; if (p) p.ca = Math.min(200, p.ca + 40) }
  ok(JSON.stringify(r(g)) === before, 'the manager\'s real squad changed beyond recognition: the same answer (he reads the record, not the truth)')
  g.tacLoop!.evidence![0] = wonBy('turn', A, S0, 3)
  ok(r(g)?.unit === 'breakdown', 'the record changed and the squad did not: the answer follows the record')
  // the kind of coach
  const w = (id: string) => r(withEv([wonBy('break', id, S0, 3)]), id)?.w ?? 0
  ok(w(A) > w(reactive.id) && w(reactive.id) > w(stubborn.id) && w(stubborn.id) > 0, `analyst ${w(A)}, reactive ${w(reactive.id)}, stubborn ${w(stubborn.id)}: the analyst most, the stubborn least`)
  // how long ago
  const now = withEv([wonBy('break', A, S0, 3)])
  now.season = S0 + 1
  ok(r(now)?.w === 0.5, 'a meeting last season counts half')
  now.season = S0 + 2
  ok(r(now) === null, 'older, nothing')
  // and how much it was worth
  ok((r(withEv([wonBy('break', A, S0, 3, 4)]))?.w ?? 0) < (r(withEv([wonBy('break', A, S0, 3, 14)]))?.w ?? 0), 'a cause worth four points is remembered less than one worth fourteen')
  // the caps
  let maxA = 0, maxL = 0, past = 0
  for (const cause of ['move', 'break', 'set', 'turn'] as const) {
    for (const p of [2, 7, 30, 300]) {
      const x = r(withEv([wonBy(cause, A, S0, 3, p)]))
      if (!x) continue
      maxA = Math.max(maxA, x.adapt); maxL = Math.max(maxL, x.layer)
      const ad = withRematch(adaptMap(withEv([wonBy(cause, A, S0, 3, p)], { [L]: 30 }), A), x)
      if (Object.values(ad).some(v => v > ADAPT_MAX + 1e-9)) past++
    }
  }
  ok(maxA <= MEM_ADAPT + 1e-9 && maxL <= 1 + MEM_UNIT + 1e-9, `never past its caps: adapt ${f2(maxA)} (cap ${MEM_ADAPT}), layer ${maxL.toFixed(4)} (cap ${1 + MEM_UNIT})`)
  ok(past === 0, `and a call never set for past the tape's own ceiling (${ADAPT_MAX}), even on a full tape`)
}

// ------------------------------------------------------------------ 3
console.log('\n--- 3. no runaway, and it fades when the manager varies\n')
{
  const one = rematchOf(withEv([wonBy('break', A, S0, 3, 14, 1)]), A)
  const two = rematchOf(withEv([wonBy('break', A, S0, 3, 14, 1), wonBy('break', A, S0, 12, 14, 2)]), A)
  ok(JSON.stringify({ ...one, fxId: 0 }) === JSON.stringify({ ...two, fxId: 0 }), 'beaten the same way twice: the third meeting is no harder than the second')
  const sw = rematchOf(withEv([wonBy('break', A, S0, 3, 14, 1), wonBy('turn', A, S0, 12, 14, 2)]), A)
  ok(sw?.unit === 'breakdown', 'beaten another way: he answers the new one and forgets the old')
  const l2 = wonBy('break', A, S0, 12, 14, 2); l2.them = 40
  ok(rematchOf(withEv([wonBy('break', A, S0, 3, 14, 1), l2]), A) === null, 'and once he has beaten the manager, he forgets')
  const put = withEv([wonBy('move', A, S0, 3)])
  put.clubs[put.userClubId].tactic.moveMain = 'mv_crash'
  ok(rematchOf(put, A) === null, 'the loop put away: nothing to plan for')
  const full = rematchOf(withEv([wonBy('move', A, S0, 3)], { [L]: 20, [S]: 10 }), A)!
  const hid = rematchOf(withEv([wonBy('move', A, S0, 3)], { [L]: 5, [S]: 10, mv_crash: 15 }), A)
  ok(!!full && (!hid || hid.w < full.w), `the loop hidden among others (a sixth of the tape): ${hid ? hid.w : 'none'} against ${full.w}`)
}

lap()
// ------------------------------------------------------------------ 4
console.log('\n--- 4. the effect, on real matches played in pairs on the same dice\n')
const mine = base.fixtures
  .filter(f => (f.homeId === base.userClubId || f.awayId === base.userClubId) && base.clubs[f.homeId] && base.clubs[f.awayId])
  .sort((a, b) => a.week - b.week || a.id - b.id)
/** the manager's fixture, against this opponent instead */
const against = (fx: Fixture, opp: string): Fixture => fx.homeId === base.userClubId ? { ...fx, awayId: opp } : { ...fx, homeId: opp }
function play(g: GameState, fx: Fixture, seed: number): LiveCtx {
  const ctx = beginMatch(g, fx, mulberry32(seed), false, g.userClubId)
  while (ctx.seg !== 3) playSegment(g, ctx)
  return ctx
}
const margin = (ctx: LiveCtx) => (ctx.home.teamId === ctx.userSideId ? 1 : -1) * (ctx.home.score - ctx.away.score)
const effects: Record<string, { d: number[]; win: number[] }> = {}
{
  const FX = mine.slice(0, 8), ROLLS = 30
  /** paired: the margin without, less the margin with */
  const pair = (name: string, off: () => GameState, on: () => GameState, check?: (c: LiveCtx) => boolean) => {
    const d: number[] = [], win: number[] = []
    let applied = 0
    for (const fx0 of FX) {
      const fx = against(fx0, A)
      for (let roll = 0; roll < ROLLS; roll++) {
        const seed = fx.id * 7 + roll * 100_003
        const a = play(off(), fx, seed), b = play(on(), fx, seed)
        if (!check || check(b)) applied++
        d.push(margin(a) - margin(b))
        win.push((margin(a) > 0 ? 1 : 0) - (margin(b) > 0 ? 1 : 0))
      }
    }
    effects[name] = { d, win }
    const se = sd(d) / Math.sqrt(d.length)
    console.log(`      ${name.padEnd(46)} ${f2(mean(d)).padStart(6)} points a match (se ${f2(se)}), ${(mean(win) * 100).toFixed(1).padStart(5)} points of wins; ${d.length} pairs${check ? `, applied in ${applied}` : ''}`)
    return applied
  }
  // the tape at full: the loop on every first-phase ball, against none
  const spam = (faced: Record<string, number>) => () => { const g = withEv([], faced); g.clubs[g.userClubId].tactic.moveAlt = undefined; return g }
  pair('the 1.8.3 tape at full (one strike, analyst)', spam({}), spam({ [L]: 40 }))
  // the signature mix's own tape, against none
  const app = (k: Rematch['cause'], u?: string) => (c: LiveCtx) => c.rematch?.cause === k && (!u || c.rematch.unit === u) && c.rematch.w === 1
  pair('rematch at its cap: the loop (on the mix\'s tape)', () => withEv([]), () => withEv([wonBy('move', A, S0, 1)]), app('move'))
  pair('rematch at its cap: his defence', () => withEv([]), () => withEv([wonBy('break', A, S0, 1)]), app('break', 'defence'))
  pair('rematch at its cap: his breakdown', () => withEv([]), () => withEv([wonBy('turn', A, S0, 1)]), app('turn', 'breakdown'))
  const tape = mean(effects['the 1.8.3 tape at full (one strike, analyst)'].d)
  const caps = ['rematch at its cap: the loop (on the mix\'s tape)', 'rematch at its cap: his defence', 'rematch at its cap: his breakdown']
  const se = (k: string) => sd(effects[k].d) / Math.sqrt(effects[k].d.length)
  const worst = Math.max(...caps.map(k => mean(effects[k].d) + 2 * se(k)))
  console.log(`      (a match's margin is noisy: the tape at full reads ${f2(tape)} with se ${f2(se('the 1.8.3 tape at full (one strike, analyst)'))}, so the`)
  console.log('      comparison with the tape that decides is the edge on the call itself, in section 5)')
  ok(worst < 1, `the rematch at its cap costs the manager under a point a match at the top of its two-se band (${f2(worst)})`)
  ok(caps.every(k => mean(effects[k].d) > -2 * (sd(effects[k].d) / Math.sqrt(effects[k].d.length))), 'and none of them helps the manager by more than the noise')
}

lap()
// ------------------------------------------------------------------ 5
console.log('\n--- 5. a signature call against an analyst who remembers, a season of rematches\n')
{
  // the manager runs the 67/33 mix every match; every one of his fixtures is
  // filed on the tape as its match would begin, and before each the analyst
  // remembers the loop at its cap (as if it had beaten him last time)
  const g = withEv([], {})
  const me = g.clubs[g.userClubId]
  const pb = playbookOf(me)
  const rows: { tape: number; mem: number; gain: number; gain0: number }[] = []
  for (let i = 0; i < 16 && i < mine.length; i++) {
    g.tacLoop = { findings: [], evidence: [wonBy('move', A, g.season, mine[i].week, 14, 900 + i)] }
    const rm = rematchOf(g, A)
    const ad = withRematch(adaptMap(g, A), rm)
    let gain = 0, gain0 = 0
    for (const [id, w] of [[L, 0.67], [S, 0.33]] as const) {
      gain += w * moveEdge(g, me, id, 0.2, 0.2, ad[id] ?? 0).gain
      gain0 += w * moveEdge(g, me, id, 0.2, 0.2, adaptOf(g, A, id)).gain
    }
    rows.push({ tape: adaptOf(g, A, L), mem: (ad[L] ?? 0) - adaptOf(g, A, L), gain, gain0 })
    tallyCalls(g, mine[i])
    pb.drilled[L] = 85; pb.drilled[S] = 85
  }
  const late = rows.slice(4)
  for (const [i, r] of rows.entries()) if (i % 3 === 0 || i === rows.length - 1) console.log(`      meeting ${String(i + 1).padStart(2)}: tape on the loop ${f2(r.tape)}, remembered +${f2(r.mem)}, the mix's edge ${(r.gain * 100).toFixed(2)}% (without the memory ${(r.gain0 * 100).toFixed(2)}%)`)
  ok(rows.length >= 10, `${rows.length} meetings`)
  ok(late.every(r => r.gain > 0), `the signature mix keeps a positive edge in every meeting from the fifth on (lowest ${(Math.min(...late.map(r => r.gain)) * 100).toFixed(2)}%)`)
  ok(late.every(r => r.mem <= MEM_ADAPT + 1e-9) && Math.max(...late.map(r => r.mem)) > 0, `the memory never adds more than ${MEM_ADAPT} to the loop's adapt`)
  const cost = mean(late.map(r => r.gain0 - r.gain)), tapeCost = mean(late.map(r => {
    const e0 = 0.67 * moveEdge(g, me, L, 0.2, 0.2, 0).gain + 0.33 * moveEdge(g, me, S, 0.2, 0.2, 0).gain
    return e0 - r.gain0
  }))
  console.log(`      over meetings 5 to ${rows.length}: the tape takes ${(tapeCost * 100).toFixed(2)} points of edge off the mix, the memory ${(cost * 100).toFixed(2)} more`)
  ok(cost < tapeCost, 'the memory takes less off it than the tape does')

  // and on real matches: twelve meetings in a row with the analyst, played
  // and filed, the memory built from each one as it happens, against the
  // same twelve with nothing remembered
  // (against the league's weakest analyst, so the manager wins often enough
  // to be remembered)
  const A2 = league.filter(c => archetypeOf(c.id, c.rep) === 'analyst').sort((x, y) => x.rep - y.rep)[0].id
  const chain = (remember: boolean) => {
    const c = withEv([])
    const out = { pts: 0, wins: 0, loopTries: 0, loopRuns: 0, loopM: 0, applied: 0, log: [] as string[] }
    for (let i = 0; i < 12; i++) {
      if (!remember && c.tacLoop?.evidence) c.tacLoop.evidence = c.tacLoop.evidence.filter(e => e.oppId !== A2)
      const fx = { ...against(mine[i], A2), week: c.week }
      const ctx = play(c, fx, fx.id * 11 + 5)
      if (ctx.rematch) out.applied++
      const ev = fileEvidence(c, ctx)!
      out.log.push(`${ev.us}-${ev.them}${ctx.rematch ? `[${ctx.rematch.cause}]` : ''}`)
      out.loopM += ev.side[0].calls[L]?.[1] ?? 0
      out.pts += ev.us - ev.them
      if (ev.us > ev.them) out.wins++
      out.loopTries += ev.side[0].calls[L]?.[2] ?? 0
      out.loopRuns += ev.side[0].calls[L]?.[0] ?? 0
      playbookOf(c.clubs[c.userClubId]).drilled[L] = 85; playbookOf(c.clubs[c.userClubId]).drilled[S] = 85
    }
    return out
  }
  const on = chain(true), off = chain(false)
  console.log(`      twelve real meetings with ${A2}, remembered: applied in ${on.applied}, ${on.wins} wins, margin ${f2(on.pts / 12)} a match, the loop ${on.loopTries} tries and ${on.loopM} metres in ${on.loopRuns} runs`)
  console.log(`        ${on.log.join(' ')}`)
  console.log(`      the same twelve, forgotten: ${off.wins} wins, margin ${f2(off.pts / 12)} a match, the loop ${off.loopTries} tries and ${off.loopM} metres in ${off.loopRuns} runs`)
  console.log(`        ${off.log.join(' ')}`)
  ok(on.applied > 0, 'remembered, it is applied after the meetings he lost')
  ok(off.applied === 0, 'with no record against him, nothing is applied')
}

lap()
// ------------------------------------------------------------------ 6
console.log('\n--- 6. a season or more as the assistant plays it: nothing hidden\n')
{
  const shown: Record<string, string> = {}
  const notes: Record<string, number> = {}
  let played = 0, applied = 0, reportSaid = 0, koSaid = 0, deskSaid = 0, mismatch = 0, raw = 0, deskTooMany = 0
  for (const [club, seed] of [['leicester', 1861], ['bath', 77], ['newcastle', 4242]] as const) {
    const g = newGame(club, 'Memory Season', seed)
    const me = g.clubs[g.userClubId]
    me.tactic.moveMain = L; me.tactic.moveAlt = S; me.tactic.moveMix = 67
    for (let wk = 0; wk < 92 && played < 150; wk++) {
      const fx = userFixtureThisWeek(g)
      if (fx && isClubFixture(g, fx) && !fx.played) {
        const opp = opponentIn(g, fx)!
        const rm = rematchOf(g, opp)
        const rep = buildReport(g, opp)
        const line = rep.lines.find(l => l.k.startsWith('oppreport.mem'))
        const desk = buildDesk(g)
        if (desk.thread?.lines[0]?.k === 'desk.tRematch') deskSaid++
        const tac = desk.rows.find(r => r.id === 'tactics')
        const mem = tac?.lines.filter(l => l.k.startsWith('desk.mem')) ?? []
        if (mem.length > 2) deskTooMany++
        for (const l of mem) {
          notes[l.k] = (notes[l.k] ?? 0) + 1
          shown[l.k] ??= say('en', l.k, l.v)
          for (const lang of LANGS) if (rawKey(say(lang, l.k, l.v))) raw++
        }
        const ctx = beginMatch(g, fx, matchRng(g), true, g.userClubId)
        ctx.assistantSubs = true
        const ko = ctx.events.some(e => e.k === 'comm.oppRematch')
        if (rm) applied++
        if (line) reportSaid++
        if (ko) koSaid++
        if (!!rm !== !!line || !!rm !== !!ctx.rematch || !!rm !== ko || (rm && JSON.stringify(rm) !== JSON.stringify(ctx.rematch))) mismatch++
        if (line && rm) {
          const r = rematchLine(rm)
          if (line.k !== r.k) mismatch++
          shown[`${line.k} (${archetypeOf(opp, g.clubs[opp].rep)}, w ${rm.w})`] ??= say('en', line.k, line.v)
          for (const lang of LANGS) if (rawKey(say(lang, line.k, line.v)) || rawKey(say(lang, 'comm.oppRematch', { team: 'X' }))) raw++
        }
        playHalf(g, ctx)
        playHalf(g, ctx)
        fileFindings(g, ctx)
        fileEvidence(g, ctx)
        played++
      }
      processWeekAndAdvance(g)
    }
  }
  console.log(`      ${played} club matches over three careers; the rematch applied in ${applied}: the report said so in ${reportSaid}, the kick-off in ${koSaid}, the desk thread in ${deskSaid} (it gives way to a former player)`)
  console.log(`      the desk's conclusions: ${Object.entries(notes).map(([k, v]) => `${k.slice(8)} ${v}`).join(', ')}`)
  for (const [k, v] of Object.entries(shown).sort()) console.log(`        [${k}] ${v}`)
  ok(applied > 0, 'the rematch comes up in real careers')
  ok(mismatch === 0, 'the report\'s line and the kick-off line appear in exactly the matches the engine applied it, and say what it applied')
  ok(deskSaid > 0 && deskSaid <= applied, 'the desk thread says so too, never when nothing was applied')
  ok(deskTooMany === 0, 'never more than two conclusions on the desk')
  ok(Object.keys(notes).length >= 3, 'and several kinds of conclusion come up')
  ok(raw === 0, 'every line reads as words in six languages')
}

lap()
console.log(fails ? `\nMEMORY LOOP PROBE FAILED: ${fails}` : '\nMEMORY LOOP PROBE PASSED')
process.exit(fails ? 1 : 0)
