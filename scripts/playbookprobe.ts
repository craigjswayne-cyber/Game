// Probe: the playbook arms race, the analyst's confidence and the new move
// families (1.8.2, owner brief A, B and C).
//
//   1. FAMILIARITY. A call run match after match beds in (87% after fifteen)
//      and is worth more for it; a call left out is slowly forgotten.
//   2. THE ARMS RACE. The tape counts the strikes on the manager's first-phase
//      ball exactly; a sharp coach sets his defence for the one he runs most,
//      which measurably blunts it on the pitch, a stubborn one barely; and
//      splitting the ball between two strikes keeps both fresher. The report
//      and the desk say so.
//   3. THE ANALYST'S CONFIDENCE is calibrated: his "confident" reads are right
//      far more often than his hunches, the report's own confidence words
//      track its hit rate, and the analysis suite and the assistant raise
//      both how often he is right and how well he knows it.
//   4. THE NEW FAMILIES are drilled, fitted, drawn, belong to a style and are
//      played in the match, the red-zone ones in the 22 only.
//   5. NO DRAWS. Nothing here moves the match dice: a side with no calls
//      plays the same match whatever its tape says.
//
// Run: npx vite-node scripts/playbookprobe.ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { newGame } from '../src/game/newgame'
import { beginMatch, lineupFor, playHalf, resolveDecision, stepTick, teamUnits } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Club, GameState } from '../src/game/model'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import {
  MOVES, MOVE_BY_ID, callsOf, drillMovesWeek, drilledOf, familiarityOf, moveEdge, moveFit, repsOf,
} from '../src/game/moves'
import { ADAPT_WORTH, adaptOf, deskQuestion, firstPhase, migratePlaybook, tallyCalls, tapeOf } from '../src/game/armsrace'
import { playbookOf } from '../src/game/playbook'
import { archetypeOf } from '../src/game/oppcoach'
import { analystSkill, readOdds, sureBand } from '../src/game/analyst'
import { buildReport } from '../src/game/oppreport'
import { buildDesk } from '../src/game/desk'
import { STYLE_MOVES, ATK_STYLES } from '../src/game/styles'
import { MOVE_DIAGRAMS, MoveDiagram } from '../src/ui/tacticsArt'
import { CLIP_MOVES } from '../src/ui/HighlightClip'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const NEW = ['mv_wingin', 'mv_width', 'mv_peel', 'mv_maulswitch', 'mv_tap', 'mv_crashswing', 'mv_loop9', 'mv_crosskick', 'mv_grubber']

/** a season's weeks for the manager, calling what `setup` says */
function career(seed: number, weeks: number, setup: (g: GameState, me: Club) => void, each?: (g: GameState, me: Club) => void) {
  const g = newGame('leicester', 'Playbook Probe', seed)
  const me = g.clubs[g.userClubId]
  setup(g, me)
  for (let w = 0; w < weeks; w++) { each?.(g, me); processWeekAndAdvance(g) }
  return { g, me }
}

// ------------------------------------------------------------------ 1
console.log('--- 1. familiarity\n')
{
  const { g, me } = career(4242, 26, (_, c) => { c.tactic.moveMain = 'mv_loop'; c.tactic.moveShape = 'mv_1331' })
  const reps = repsOf(me, 'mv_loop')
  const fam = familiarityOf(g, me, 'mv_loop')
  ok(reps >= 15, `a called move is a rep every match (${reps.toFixed(0)} matches in 26 weeks)`)
  const at = (n: number) => 1 - Math.exp(-n / 7.3)
  console.log(`  familiarity after 1, 5, 15 matches: ${pct(at(1))}, ${pct(at(5))}, ${pct(at(15))}; this career ${pct(fam)} after ${reps.toFixed(0)}`)
  ok(Math.abs(at(15) - 0.87) < 0.01 && fam > 0.85, 'a side knows a call it has run fifteen times at 87%')
  // it is worth more for it, at the same drilling, fit and matchup
  playbookOf(me).drilled.mv_loop = 85
  const worth = (n: number) => { playbookOf(me).reps = { mv_loop: n }; playbookOf(me).used.mv_loop = 0; return moveEdge(g, me, 'mv_loop', 0.3, 0.3).gain }
  const g0 = worth(0), g5 = worth(5), g15 = worth(15)
  console.log(`  the loop's worth at 0, 5, 15 matches: ${pct(g0)}, ${pct(g5)}, ${pct(g15)} of the try chance`)
  ok(g0 < g5 && g5 < g15 && g0 / g15 < 0.75, 'and a familiar call works better (a new one pays 70% of it)')
  // a misfire is the drilling's business, not softened
  playbookOf(me).drilled.mv_loop = 30
  const m0 = worth(0), m15 = worth(15)
  ok(m0 < 0 && Math.abs(m0 - m15) < 1e-12, 'an undrilled call misfires alike, familiar or not')
  // left out, it is forgotten slowly; an AI coach sits at the old number
  const c2 = career(4242, 20, (_, c) => { c.tactic.moveMain = 'mv_loop' }, (gg, c) => { if (gg.week === 10) c.tactic.moveMain = 'mv_switch' })
  const lo = repsOf(c2.me, 'mv_loop'), sw = repsOf(c2.me, 'mv_switch')
  ok(lo > 0 && sw > 0 && lo < 10, `a shelved call fades while the new one beds in (loop ${lo.toFixed(1)}, switch ${sw.toFixed(1)})`)
  const ai = Object.values(g.clubs).find(c => c.id !== me.id && callsOf(g, c).lineout)!
  ok(familiarityOf(g, ai, callsOf(g, ai).lineout!) === 0.87, 'an AI coach runs his calls at the familiarity the engine was balanced on')
}

// ------------------------------------------------------------------ 2
console.log('\n--- 2. the arms race\n')
{
  // the tape is exact: the first-phase strikes of a fixture, off its hashes
  const g = newGame('leicester', 'Playbook Probe', 909)
  const me = g.clubs[g.userClubId]
  me.tactic.moveMain = 'mv_loop'; me.tactic.moveAlt = 'mv_switch'; me.tactic.moveMix = 67
  let n = 0, loop = 0
  for (let fx = 1; fx <= 400; fx++) { const f = firstPhase(g, me, fx, fx % 2 === 0); n += f.n; loop += f.runs.mv_loop ?? 0 }
  console.log(`  first-phase possessions a match: ${(n / 400).toFixed(1)}; the primary on ${pct(loop / n)} of them at a 67/33 mix`)
  ok(Math.abs(loop / n - 0.67) < 0.04, 'the mix is the share of first-phase ball the primary gets')
  ok(n / 400 > 7 && n / 400 < 11, 'about nine first-phase possessions a match')

  // run one strike on everything for a season: the tape shows it
  const one = career(909, 18, (_, c) => { c.tactic.moveMain = 'mv_loop' })
  const tape1 = tapeOf(one.me)
  ok(!!tape1.top && tape1.top.id === 'mv_loop' && tape1.top.share > 0.99, `one strike on all the ball: the tape has it on ${pct(tape1.top?.share ?? 0)}`)
  // split it: each is a smaller share
  const two = career(909, 18, (_, c) => { c.tactic.moveMain = 'mv_loop'; c.tactic.moveAlt = 'mv_switch'; c.tactic.moveMix = 50 })
  const tape2 = tapeOf(two.me)
  console.log(`  split 50/50: loop ${pct(tape2.share.mv_loop ?? 0)}, switch ${pct(tape2.share.mv_switch ?? 0)} of ${tape2.total.toFixed(1)} possessions of tape`)
  ok((tape2.share.mv_loop ?? 1) < 0.62 && (tape2.share.mv_switch ?? 0) > 0.38, 'splitting the ball splits the tape')

  // who answers it: every AI club in the world against the one-strike tape
  const byArch: Record<string, number[]> = { stubborn: [], analyst: [], reactive: [] }
  const split: number[] = []
  for (const c of Object.values(one.g.clubs)) {
    if (c.id === one.me.id) continue
    byArch[archetypeOf(c.id, c.rep)].push(adaptOf(one.g, c.id, 'mv_loop'))
    split.push(adaptOf(two.g, c.id, 'mv_loop'))
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
  console.log(`  how far each kind of coach sets his defence for it: analyst ${pct(avg(byArch.analyst))}, reactive ${pct(avg(byArch.reactive))}, stubborn ${pct(avg(byArch.stubborn))}; split 50/50 ${pct(avg(split))}`)
  ok(avg(byArch.analyst) > avg(byArch.reactive) && avg(byArch.reactive) > avg(byArch.stubborn) && avg(byArch.analyst) > 0.45,
    'the analysts set up for it most, the stubborn barely')
  ok(avg(split) < avg([...byArch.analyst, ...byArch.reactive, ...byArch.stubborn]) * 0.5, 'and hiding it behind a second strike takes most of the answer away')

  // what it costs, in the move's own number
  const an = Object.values(one.g.clubs).find(c => c.id !== one.me.id && archetypeOf(c.id, c.rep) === 'analyst')!
  playbookOf(one.me).drilled.mv_loop = 90
  const fit = 0.2, mtch = 0.2
  const fresh = moveEdge(one.g, one.me, 'mv_loop', fit, mtch, 0).gain
  const read = moveEdge(one.g, one.me, 'mv_loop', fit, mtch, adaptOf(one.g, an.id, 'mv_loop')).gain
  console.log(`  the loop against a sharp dugout: ${pct(fresh)} of the try chance unread, ${pct(read)} once they are set for it`)
  ok(read < fresh * 0.5, 'a call they are set for is blunted to less than half')

  // ON THE PITCH: the same fixtures on the same dice, the opponent set for it or not
  // (lockstep, as movesprobe measures a move: the same fixture on the same
  // dice a tick at a time, the try chances the side's rugby was worth summed
  // up to the tick the two matches part; past that it is two matches)
  const fixtures = one.g.fixtures.filter(f => !f.played && (f.homeId === one.me.id || f.awayId === one.me.id) && one.g.clubs[f.homeId] && one.g.clubs[f.awayId]).slice(0, 8)
  const lock = (s: number) => {
    const mk = (setFor: boolean) => {
      const g2 = structuredClone(one.g)
      const me2 = g2.clubs[g2.userClubId]
      me2.tactic.lineup = lineupFor(g2, me2.id); me2.tactic.userPicked = true
      playbookOf(me2).drilled.mv_loop = 92
      const fx = g2.fixtures.find(f => f.id === fixtures[s % fixtures.length].id)!
      const opp = g2.clubs[fx.homeId === me2.id ? fx.awayId : fx.homeId]
      opp.tactic.defLine = 50; opp.tactic.defWidth = 30   // a narrow line, which the loop beats
      const base = mulberry32(7000 + s)
      const run = { g: g2, id: me2.id, draws: 0, ctx: null as unknown as ReturnType<typeof beginMatch>, x0: 0 }
      run.ctx = beginMatch(g2, fx, () => { run.draws++; return base() }, false)
      run.ctx.assistantSubs = true
      run.ctx.callAdapt = setFor ? { mv_loop: 0.55 } : {}
      return run
    }
    const A = mk(true), B = mk(false)
    const sideOf = (r: typeof A) => (r.ctx.home.teamId === r.id ? r.ctx.home : r.ctx.away)
    let dx = 0, apart = false
    for (;;) {
      for (const r of [A, B]) {
        r.x0 = sideOf(r).xTry ?? 0
        if (r.ctx.decision) resolveDecision(r.g, r.ctx, 'posts')
        const st = stepTick(r.g, r.ctx)
        if (r.ctx.decision) resolveDecision(r.g, r.ctx, 'posts')
        if (st !== 'play') r.ctx.awaiting = null
      }
      if (!apart) dx += ((sideOf(A).xTry ?? 0) - A.x0) - ((sideOf(B).xTry ?? 0) - B.x0)
      if (A.draws !== B.draws || A.ctx.home.score !== B.ctx.home.score || A.ctx.away.score !== B.ctx.away.score) apart = true
      if (A.ctx.tick >= 20 && B.ctx.tick >= 20) break
    }
    return { dx, pts: sideOf(A).score - sideOf(B).score }
  }
  const diffs: number[] = [], ptsD: number[] = []
  for (let s = 0; s < 48; s++) { const r = lock(s); diffs.push(r.dx); ptsD.push(r.pts) }
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const se = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (diffs.length - 1) / diffs.length)
  console.log(`  on the pitch, 48 paired matches: the defence set for the loop costs ${(-mean).toFixed(3)} (se ${se.toFixed(3)}) tries' worth before the dice part, ${(ptsD.reduce((a, b) => a + b, 0) / 48).toFixed(1)} pts a match over the eighty`)
  ok(mean < 0 && -mean > 2 * se, 'and on the pitch a side whose call is read makes measurably fewer chances')

  // the report and the desk say it
  const rep = buildReport(one.g, an.id)
  const line = rep.lines.find(l => l.cat === 'calls')
  console.log(`  the report's line: ${line?.k} ${JSON.stringify(line?.v)}`)
  ok(!!line && line.v?.pct === 100, 'the opposition report names the call and its share of first-phase ball')
  ok(!!deskQuestion(one.g, an.id), 'and the desk asks whether to keep running it when the next side is set for it')
  const deskOk = (() => { const d = buildDesk(one.g); return d.thread == null || typeof d.thread.lines[0]?.k === 'string' })()
  ok(deskOk, 'the desk still builds')
  ok(!deskQuestion(two.g, an.id) || adaptOf(two.g, an.id, tapeOf(two.me).top!.id) >= ADAPT_WORTH, 'and asks nothing it cannot stand behind')
}

// ------------------------------------------------------------------ 3
console.log('\n--- 3. the analyst\'s confidence\n')
{
  // every club in three worlds, every week of a season: the read's odds and
  // his confidence at each setup, against whether the read was right
  type Tally = { n: number; right: number; bands: Record<string, { n: number; right: number }>; brier: number }
  const setups: [string, number, number][] = [['bare club', 0, 0], ['middling', 2, 1], ['full suite and gold assistant', 5, 3]]
  const out: Record<string, Tally> = {}
  const all: Tally = { n: 0, right: 0, bands: {}, brier: 0 }
  const add = (t: Tally, band: string, right: boolean, conf: number) => {
    t.n++; if (right) t.right++
    const b = (t.bands[band] ??= { n: 0, right: 0 }); b.n++; if (right) b.right++
    t.brier += (conf - (right ? 1 : 0)) ** 2
  }
  for (const [name, suite, asst] of setups) {
    const t: Tally = { n: 0, right: 0, bands: {}, brier: 0 }
    for (const seed of [11, 22, 33]) {
      const g = newGame('bath', 'Analyst', seed)
      const me = g.clubs[g.userClubId]
      me.facilities = { ...(me.facilities ?? {}), briefing: suite }
      g.staff.assistant = asst
      const units = Object.keys(g.clubs).filter(id => id !== me.id).map(id => [id, teamUnits(g, lineupFor(g, id))] as const)
      for (let abs = 101; abs <= 140; abs++) for (const [id, u] of units) {
        const o = readOdds(g, id, u, abs)
        add(t, sureBand(o.confidence), o.right, o.confidence)
        add(all, sureBand(o.confidence), o.right, o.confidence)
      }
    }
    out[name] = t
    const b = (k: string) => t.bands[k] ? `${k} ${pct(t.bands[k].right / t.bands[k].n)} of ${t.bands[k].n}` : `${k} none`
    console.log(`  ${name.padEnd(30)} right ${pct(t.right / t.n)} (skill ${pct(analystSkill((() => { const g = newGame('bath', 'A', 11); g.clubs[g.userClubId].facilities = { briefing: suite }; g.staff.assistant = asst; return g })()))}); ${b('high')}, ${b('mid')}, ${b('low')}; high share ${pct((t.bands.high?.n ?? 0) / t.n)}; Brier ${(t.brier / t.n).toFixed(3)}`)
  }
  const band = (t: Tally, k: string) => (t.bands[k] ? t.bands[k].right / t.bands[k].n : NaN)
  console.log(`  pooled: high ${pct(band(all, 'high'))} (${all.bands.high?.n}), mid ${pct(band(all, 'mid'))} (${all.bands.mid?.n}), low ${pct(band(all, 'low'))} (${all.bands.low?.n})`)
  ok(band(all, 'high') > band(all, 'mid') && band(all, 'mid') > band(all, 'low'), 'confident reads are right more often than fairly-sure ones, and those more than hunches')
  ok(band(all, 'high') - band(all, 'low') > 0.35, `and by a wide margin (${pct(band(all, 'high') - band(all, 'low'))} between confident and a hunch)`)
  ok(band(all, 'high') > 0.8, 'a confident read is right better than four times in five')
  const bare = out['bare club'], full = out['full suite and gold assistant']
  ok(full.right / full.n > bare.right / bare.n + 0.3, 'the suite and the assistant make him right far more often')
  ok((full.bands.high?.n ?? 0) / full.n > 3 * ((bare.bands.high?.n ?? 0) / bare.n), 'and sure far more often')
  ok(full.brier / full.n < bare.brier / bare.n, 'and he knows better when he is right (a lower Brier score)')
  // the report's own confidence words: over every report line that can be wrong
  const lines: Record<string, { n: number; ok: number }> = {}
  for (const seed of [5, 6, 7, 8]) {
    const g = newGame('saracens', 'Report', seed)
    for (let w = 0; w < 30; w++) {
      const fx = userFixtureThisWeek(g)
      if (fx) {
        const opp = fx.homeId === g.userClubId ? fx.awayId : fx.homeId
        for (const [suite, asst] of [[0, 0], [5, 3]]) {
          const h = structuredClone(g)
          h.clubs[h.userClubId].facilities = { briefing: suite }; h.staff.assistant = asst
          for (const l of buildReport(h, opp).lines) if (l.conf && l.ok !== undefined) {
            const k = l.conf; const b = (lines[k] ??= { n: 0, ok: 0 }); b.n++; if (l.ok) b.ok++
          }
        }
      }
      processWeekAndAdvance(g)
    }
  }
  const lb = (k: string) => (lines[k] ? lines[k].ok / lines[k].n : NaN)
  console.log(`  the report's lines by the confidence it gives them: high ${pct(lb('high'))} (${lines.high?.n ?? 0}), mid ${pct(lb('mid'))} (${lines.mid?.n ?? 0}), low ${pct(lb('low'))} (${lines.low?.n ?? 0})`)
  ok(lb('high') > lb('low') + 0.2 && lb('high') >= lb('mid'), 'the report\'s confident lines are right more often than its hunches')
}

// ------------------------------------------------------------------ 4
console.log('\n--- 4. the new families\n')
{
  ok(NEW.every(id => !!MOVE_BY_ID[id]), `all nine are in the library (${MOVES.length} moves)`)
  const g = newGame('leicester', 'Families', 4242)
  const me = g.clubs[g.userClubId]
  // drilled: each rises week by week when called
  const rose = NEW.filter(id => {
    const m = MOVE_BY_ID[id]
    me.tactic.moveMain = undefined; me.tactic.moveRed = undefined
    if (m.red) me.tactic.moveRed = id; else me.tactic.moveMain = id
    const a = drilledOf(g, me, id)
    for (let w = 0; w < 6; w++) drillMovesWeek(g, me, true)
    return drilledOf(g, me, id) > a + 5
  })
  ok(rose.length === NEW.length, `each is drilled like the rest when it is called (${rose.length}/9)`)
  // fitted: an average XV is an average fit, and the right men make it
  const fits = NEW.map(id => {
    const xs = Object.keys(g.clubs).map(c => {
      const lu = lineupFor(g, c)
      return moveFit(MOVE_BY_ID[id], (s, a) => { const p = lu[s - 1] != null ? g.players[lu[s - 1]!] : undefined; return p ? p.a[a] : null })
    })
    return [id, xs.reduce((a, b) => a + b, 0) / xs.length] as const
  })
  console.log(`  mean fit over the world's first XVs: ${fits.map(([id, f]) => `${id.slice(3)} ${f.toFixed(2)}`).join(', ')}`)
  ok(fits.every(([, f]) => Math.abs(f) < 0.12), 'the world\'s average side is an average fit for each (measured references)')
  // styled, drawn, clipped
  ok(NEW.every(id => ATK_STYLES.some(s => STYLE_MOVES[s].includes(id))), 'each belongs to an attacking style')
  const svgs = NEW.map(id => renderToStaticMarkup(createElement(MoveDiagram, { id })))
  ok(NEW.every(id => MOVE_DIAGRAMS.includes(id)) && new Set(svgs).size === NEW.length && svgs.every(s => (s.match(/--dg-move/g) ?? []).length >= 3), 'each has its own whiteboard diagram')
  ok(NEW.every(id => CLIP_MOVES.includes(id)), 'and its own clip')
  // in the match: the red-zone plays run only in their 22, and are called
  const seen: Record<string, number> = {}
  for (let s = 0; s < 24; s++) {
    const h = structuredClone(g)
    const m2 = h.clubs[h.userClubId]
    m2.tactic.moveMain = 'mv_wingin'; m2.tactic.moveAlt = 'mv_crosskick'
    m2.tactic.moveRed = s % 2 ? 'mv_tap' : 'mv_maulswitch'
    for (const id of ['mv_wingin', 'mv_crosskick', 'mv_tap', 'mv_maulswitch']) playbookOf(m2).drilled[id] = 92
    const fx = h.fixtures.filter(f => (f.homeId === m2.id || f.awayId === m2.id) && h.clubs[f.homeId] && h.clubs[f.awayId])[s % 10]
    const ctx = beginMatch(h, fx, mulberry32(900 + s), true)
    playHalf(h, ctx); playHalf(h, ctx)
    for (const e of ctx.events) {
      if (e.teamId !== m2.id || typeof e.v?.move_k !== 'string') continue
      const k = `${e.k?.replace(/\d+$/, '')}:${e.v.move_k}`
      seen[k] = (seen[k] ?? 0) + 1
    }
  }
  const has = (re: RegExp) => Object.keys(seen).some(k => re.test(k))
  console.log(`  what the commentary named in 24 matches: ${Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k.replace('comm.', '').replace('moves.say.', '')} ${n}`).join(', ')}`)
  ok(has(/moveCallTap:moves\.say\.mv_tap/) || has(/moveTryTap.*mv_tap/), 'the tap penalty is taken in their 22')
  ok(has(/mv_maulswitch/) && !has(/moveCallSc:.*mv_maulswitch/), 'the maul switch is run off their lineout')
  ok(has(/mv_wingin/) && has(/mv_crosskick/), 'and the primary and secondary strikes both run')
  // an old save's calls become the playbook
  const old = newGame('leicester', 'Old', 1)
  const oc = old.clubs[old.userClubId]
  oc.tactic.moveLineout = 'mv_loop'; oc.tactic.moveScrum = 'mv_blind'
  migratePlaybook(old)
  ok(oc.tactic.moveMain === 'mv_loop' && oc.tactic.moveAlt === 'mv_blind' && oc.tactic.moveLineout === undefined, 'an old save\'s lineout and scrum calls become the primary and the secondary')
  migratePlaybook(old)
  ok(oc.tactic.moveMain === 'mv_loop' && oc.tactic.moveAlt === 'mv_blind', 'and migrating twice changes nothing')
}

// ------------------------------------------------------------------ 5
console.log('\n--- 5. no draws\n')
{
  // a side with no calls: the tape is irrelevant and the match identical
  const g = newGame('leicester', 'Dice', 31)
  const me = g.clubs[g.userClubId]
  const fx = g.fixtures.find(f => (f.homeId === me.id || f.awayId === me.id) && g.clubs[f.homeId] && g.clubs[f.awayId])!
  const runIt = (withTape: boolean) => {
    const h = structuredClone(g)
    if (withTape) playbookOf(h.clubs[h.userClubId]).faced = { mv_loop: 40 }
    const ctx = beginMatch(h, h.fixtures.find(f => f.id === fx.id)!, mulberry32(5), false)
    playHalf(h, ctx); playHalf(h, ctx)
    return `${ctx.home.score}-${ctx.away.score}-${ctx.events.length}`
  }
  ok(runIt(true) === runIt(false), 'a manager with no calls plays the same match whatever tape he has')
  // counting twice counts once
  const h = structuredClone(g)
  h.clubs[h.userClubId].tactic.moveMain = 'mv_loop'
  tallyCalls(h, fx); const once = JSON.stringify(playbookOf(h.clubs[h.userClubId]).faced)
  tallyCalls(h, fx); const twice = JSON.stringify(playbookOf(h.clubs[h.userClubId]).faced)
  ok(once === twice, 'a fixture is put on the tape once, however often it is begun')
}

if (fails) { console.error(`PLAYBOOK PROBE: ${fails} failures`); process.exit(1) }
console.log('\nPLAYBOOK PROBE PASSED')
