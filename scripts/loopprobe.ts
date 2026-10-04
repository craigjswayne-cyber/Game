/**
 * ---- THE LOOP, CLOSED (1.8.4) ----
 *
 * The manager sees a problem, makes a decision, the simulation changes, he
 * sees the outcome, the game remembers it, and a later match says whether it
 * worked. Every step of that is read off real simulated matches here, with
 * no result mocked and no rng added anywhere:
 *
 *   1. The comparison itself, on constructed evidence: improved, partly,
 *      unchanged, worse, and a new weakness taking over; the dial read
 *      before and after the break; the full-time lead-ins.
 *   2. AT HALF TIME. A side set to push the limits (Physicality 95) gives
 *      away penalties, and the half-time word names that as what is hurting
 *      and names Physicality as the answer. Each such match is played twice
 *      from the same state on the same dice, so the two first halves are
 *      the same half: once with the dial left, once brought down to 20 at
 *      the break. The second halves are compared, pair by pair, and the
 *      full-time follow-up has to quote the engine's own counts and choose
 *      improved / partly / unchanged / worse from those numbers, and say
 *      whether the dial moved.
 *   3. MATCH TO MATCH. The same, a week apart: a match at Physicality 95
 *      whose top problem was the penalty count, then the next match played
 *      twice from the same state, the dial left or brought down. The
 *      follow-up against last match's record has to quote both counts.
 *   4. THE SEASON REMEMBERS. A season played the way the assistant plays
 *      it: every match sets the homework, the evidence and findings keep the
 *      last meeting with each side, and a league rematch's report recalls
 *      it, the "why" of that meeting with it.
 *
 * Run: npx vite-node scripts/loopprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { applyTacticsChange, beginMatch, playHalf, playSegment, type LiveCtx } from '../src/game/matchEngine'
import { matchRng, processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'
import {
  LEVERS, RECALL_CAP, buildEvidence, fileEvidence, halfFollow, htHurt, lastEvidence, leverMoved, matchFollow,
  prevEvidence, topProblem, trendOf, whyLeads, type CausalEvidence, type Follow, type WhyLine,
} from '../src/game/evidence'
import { fileFindings } from '../src/game/matchfindings'
import { buildReport, lastMeeting, opponentIn, planOptions, isClubFixture } from '../src/game/oppreport'
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

/** the follow-up as the full-time card says it (MatchDay FollowLine) */
function followText(lang: Lang, f: Follow, label: string, pair: string, moved?: string | null): string {
  const dial = LEVERS[f.cause]?.dial
  const dialKey = dial ? `tactics.slider${dial[0].toUpperCase()}${dial.slice(1)}` : null
  return [
    tIn(lang, label), tIn(lang, pair, { what_k: `matchday.fuM_${f.cause}`, a: f.a, b: f.b }), tIn(lang, `matchday.fuTrend_${f.trend}`),
    ...(moved && dialKey ? [tIn(lang, `matchday.fuLever_${moved}`, { dial_k: dialKey })] : []),
    ...(f.now ? [tIn(lang, 'matchday.fuNow', { what_k: `matchday.fuM_${f.now}` })] : []),
  ].join(' ')
}
const rawKey = (s: string) => /\b[a-z]+\.[a-zA-Z_]+\b/.test(s.replace(/\d+\.\d+/g, '')) || /[{}]/.test(s)

function emptyEv(): CausalEvidence {
  const s = () => ({
    calls: {}, pts: [0, 0, 0, 0, 0, 0], breaks: 0, styleEdge: 0, blunted: 0,
    setWon: [0, 0] as [number, number], setLost: [0, 0] as [number, number],
    turnWon: [0, 0, 0], turnLost: [0, 0, 0], pens: 0, zone: [0, 10, 0],
  })
  return { fxId: 1, season: 0, week: 1, oppId: 'x', us: 0, them: 0, min: 80, poss: 50, side: [s(), s()], swings: [], lead: [], late: 0 }
}
/** a match where we gave away `n` penalties and they kicked `p` points from them */
function pensEv(n: number, p: number, turn = 0, turnPts = 0): CausalEvidence {
  const e = emptyEv()
  e.side[0].pens = n
  e.side[1].pts[4] = p
  e.side[0].turnLost = [turn, 0, 0]
  e.side[1].pts[1] = turnPts
  e.them = p + turnPts
  return e
}

// ------------------------------------------------------------------ 1
console.log('\n--- 1. the comparison, on constructed evidence\n')
{
  ok(trendOf(6, 2) === 'improved' && trendOf(6, 3) === 'improved', 'six down to two or three: improved (halved or better)')
  ok(trendOf(6, 4) === 'partly' && trendOf(3, 2) === 'partly', 'six to four, three to two: partly improved')
  ok(trendOf(6, 6) === 'unchanged' && trendOf(0, 0) === 'unchanged' && trendOf(10, 9) === 'unchanged', 'the same, or within a seventh: unchanged')
  ok(trendOf(6, 8) === 'worse' && trendOf(0, 1) === 'worse', 'up by a step or more: worse')
  ok(trendOf(12, 8, 4) === 'partly' && trendOf(12, 12, 4) === 'unchanged' && trendOf(8, 4, 4) === 'improved', 'minutes in the 22 move a tick (four minutes) at a time')

  const prev = pensEv(8, 9)
  ok(topProblem(prev) === 'pen', 'eight penalties and nine points from them: the penalty count is last match\'s top problem')
  const m = (cur: CausalEvidence) => matchFollow(prev, cur)!
  ok(m(pensEv(2, 0)).trend === 'improved' && m(pensEv(2, 0)).a === 8 && m(pensEv(2, 0)).b === 2, 'eight then two: improved, with both numbers')
  ok(m(pensEv(6, 3)).trend === 'partly', 'eight then six: partly improved')
  ok(m(pensEv(8, 9)).trend === 'unchanged', 'eight then eight: unchanged')
  ok(m(pensEv(11, 12)).trend === 'worse', 'eight then eleven: worse')
  const fresh = m(pensEv(2, 0, 9, 14))
  ok(fresh.trend === 'improved' && fresh.now === 'turn', 'penalties fixed, but nine turnovers and fourteen points from them: improved, and a new weakness took over')
  ok(!m(pensEv(9, 12)).now, 'no new weakness when the same one is still the worst')
  ok(matchFollow(emptyEv(), pensEv(2, 0)) === null, 'a match with no problem has nothing to follow up')

  // half time: the first forty, then the whole match
  const ht = pensEv(5, 9)
  ht.min = 40
  ok(htHurt(ht) === 'pen', 'five penalties and nine points by the break: the penalty count is what is hurting')
  const full = pensEv(6, 12)
  const hf = halfFollow(full, ht)!
  ok(hf.cause === 'pen' && hf.a === 5 && hf.b === 1 && hf.trend === 'improved', 'five in the first half, one in the second: improved')
  ok(halfFollow(pensEv(12, 21), ht)!.trend === 'worse', 'five, then seven more: worse')
  ok(halfFollow(full, null) === null && halfFollow(full, emptyEv()) === null, 'nothing hurting at the break: no follow-up')

  ok(leverMoved('pen', [50, 50, 50, 95], [50, 50, 50, 20]) === 'right', 'Physicality down at the break answers the penalties')
  ok(leverMoved('pen', [50, 50, 50, 50], [50, 50, 50, 70]) === 'wrong', 'up is the wrong way')
  ok(leverMoved('pen', [50, 50, 50, 50], [50, 50, 50, 55]) === 'none', 'five points is not a change')
  ok(leverMoved('turn', [50, 50, 50, 50], [10, 10, 10, 10]) === null && leverMoved('pen', undefined, [1, 2, 3, 4]) === null,
    'no dial answers the ball lost, and a Test reads no dials')

  const L = (sig: number): WhyLine => ({ cause: 'pen', sig, k: 'x', v: {} })
  const win = { ...emptyEv(), us: 20, them: 10 }, loss = { ...emptyEv(), us: 10, them: 20 }
  ok(whyLeads(win, [L(9), L(-4), L(3)]).join() === 'matchday.leadDiff,matchday.leadHurt,', 'a win: the biggest difference, then what hurt, then no label')
  ok(whyLeads(loss, [L(-9), L(4), L(-3)]).join() === 'matchday.leadHurt,matchday.leadEdge,', 'a loss: what hurt most, then the strongest advantage')
  ok(whyLeads(emptyEv(), [L(4), L(-3)]).join() === 'matchday.leadEdge,matchday.leadHurt', 'a draw: each sign labelled once')
}

// ------------------------------------------------------------------ 2
console.log('\n--- 2. at half time, on real matches\n')
const HOT = 100, COOL = 0
function setDials(g: GameState, agg: number) {
  const tac = g.clubs[g.userClubId].tactic
  tac.style = 50; tac.tempo = 50; tac.kicking = 50; tac.aggression = agg
}
/** play a match, the aggression dial at `first` and changed to `second` at the break */
function playHalves(base: GameState, fx: Fixture, seed: number, first: number, second: number): { g: GameState; ctx: LiveCtx } {
  const g = structuredClone(base)
  setDials(g, first)
  // the copy's own fixture, so the base world is never written to
  const ctx = beginMatch(g, g.fixtures.find(f => f.id === fx.id)!, mulberry32(seed), false, g.userClubId)
  ctx.assistantSubs = true
  playSegment(g, ctx)
  if (second !== first) {
    g.clubs[g.userClubId].tactic.aggression = second
    applyTacticsChange(g, ctx)
  }
  while (ctx.seg !== 3) playSegment(g, ctx)
  return { g, ctx }
}
const examples: Record<string, string> = {}
{
  const pairs: { a: number; keep: number; cool: number }[] = []
  let halves = 0, named = 0, leverNamed = 0, same = 0, quoted = 0, chosen = 0, movedOk = 0, raw = 0
  const trends = { keep: new Map<string, number>(), cool: new Map<string, number>() }
  const allKeep: number[] = [], allCool: number[] = []
  for (const seed of [1841, 1842, 1843]) {
    const base = newGame('leicester', 'Loop', seed)
    const fxs = base.fixtures.filter(f => (f.homeId === base.userClubId || f.awayId === base.userClubId) && base.clubs[f.homeId] && base.clubs[f.awayId])
    for (const fx of fxs.slice(0, 40)) for (const roll of [0, 1, 2, 3]) {
      const dice = fx.id * 7 + seed + roll * 100_003
      const keep = playHalves(base, fx, dice, HOT, HOT)
      const cool = playHalves(base, fx, dice, HOT, COOL)
      halves++
      if (JSON.stringify(keep.ctx.htEv) === JSON.stringify(cool.ctx.htEv)) same++
      const pensK = keep.ctx.htEv!.side[0].pens
      const mine = (c: LiveCtx) => (c.home.teamId === c.userSideId ? c.home : c.away)
      allKeep.push(mine(keep.ctx).consPens - pensK)
      allCool.push(mine(cool.ctx).consPens - pensK)
      if (htHurt(keep.ctx.htEv) !== 'pen') continue
      named++
      if (LEVERS.pen?.dial === 'aggression' && LEVERS.pen.dir === -1) leverNamed++
      const fK = halfFollow(buildEvidence(keep.g, keep.ctx)!, keep.ctx.htEv)!
      const fC = halfFollow(buildEvidence(cool.g, cool.ctx)!, cool.ctx.htEv)!
      // the numbers are the engine's own: the penalty count at the break, and after it
      const bK = mine(keep.ctx).consPens - pensK, bC = mine(cool.ctx).consPens - pensK
      if (fK.a === pensK && fC.a === pensK && fK.b === bK && fC.b === bC) quoted++
      if (fK.trend === trendOf(pensK, bK) && fC.trend === trendOf(pensK, bC)) chosen++
      const mK = leverMoved('pen', keep.ctx.htDials, keep.ctx.shDials), mC = leverMoved('pen', cool.ctx.htDials, cool.ctx.shDials)
      if (mK === 'none' && mC === 'right') movedOk++
      trends.keep.set(fK.trend, (trends.keep.get(fK.trend) ?? 0) + 1)
      trends.cool.set(fC.trend, (trends.cool.get(fC.trend) ?? 0) + 1)
      for (const [f, m] of [[fK, mK], [fC, mC]] as const) {
        for (const l of LANGS) if (rawKey(followText(l, f, 'matchday.fuSinceHt', 'matchday.fuHalves', m))) raw++
        const key = `${f.trend}:${m}`
        examples[key] ??= followText('en', f, 'matchday.fuSinceHt', 'matchday.fuHalves', m)
      }
      pairs.push({ a: pensK, keep: bK, cool: bC })
    }
  }
  const d = pairs.map(p => p.keep - p.cool)
  const dAll = allKeep.map((x, i) => x - allCool[i])
  const se = sd(d) / Math.sqrt(d.length), seAll = sd(dAll) / Math.sqrt(dAll.length)
  console.log(`      ${halves} matches at Physicality ${HOT}, each played twice on the same dice; the penalty count named as hurting at the break in ${named}`)
  console.log(`      those ${pairs.length}: first-half penalties ${f2(mean(pairs.map(p => p.a)))}; second half left at ${HOT} ${f2(mean(pairs.map(p => p.keep)))}, brought down to ${COOL} ${f2(mean(pairs.map(p => p.cool)))}`)
  console.log(`      paired difference ${f2(mean(d))} a second half (sd ${f2(sd(d))}, se ${f2(se)}, d = ${f2(mean(d) / (sd(d) || 1))}; ${d.filter(x => x > 0).length} fewer, ${d.filter(x => x === 0).length} the same, ${d.filter(x => x < 0).length} more)`)
  console.log(`      every match: ${f2(mean(allKeep))} left, ${f2(mean(allCool))} brought down, difference ${f2(mean(dAll))} (se ${f2(seAll)}, d = ${f2(mean(dAll) / (sd(dAll) || 1))})`)
  console.log(`      follow-up left:    ${[...trends.keep.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}`)
  console.log(`      follow-up changed: ${[...trends.cool.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}`)
  ok(same === halves, 'the two first halves of every pair are the same half (no draw moved by the snapshot)')
  ok(named >= 30, `a penalty problem is identified at the break in enough matches (${named} of ${halves})`)
  ok(leverNamed === named, 'and Physicality, down, is the dial the word names for it')
  ok(mean(d) > 0 && mean(d) > 2 * se, `bringing it down cuts the second-half penalty count, by more than twice its standard error (${f2(mean(d))} > ${f2(2 * se)})`)
  ok(mean(dAll) > 2 * seAll, 'and over every match, not just the ones that were named')
  const good = (m: Map<string, number>) => ((m.get('improved') ?? 0) + (m.get('partly') ?? 0)) / Math.max(1, named)
  ok(good(trends.cool) > good(trends.keep), `the follow-up says improved or partly more often when the dial came down (${Math.round(good(trends.cool) * 100)}% against ${Math.round(good(trends.keep) * 100)}%)`)
  ok(quoted === named, 'the follow-up quotes the engine\'s own penalty counts, before and after the break')
  ok(chosen === named, 'and improved / partly / unchanged / worse is chosen from those numbers')
  ok(movedOk === named, 'the dial is read as moved the right way when it came down, and as left when it did not')
  ok(raw === 0, 'the follow-up reads as words in six languages')
}

lap()
// ------------------------------------------------------------------ 3
console.log('\n--- 3. match to match, on real matches\n')
{
  const pairs: { a: number; keep: number; cool: number }[] = []
  let firsts = 0, named = 0, quoted = 0, chosen = 0, raw = 0, fresh = 0
  const trends = { keep: new Map<string, number>(), cool: new Map<string, number>() }
  for (const seed of [1851, 1852, 1853]) {
    const g0 = newGame('leicester', 'Loop Weeks', seed)
    const fxs = g0.fixtures.filter(f => (f.homeId === g0.userClubId || f.awayId === g0.userClubId) && g0.clubs[f.homeId] && g0.clubs[f.awayId])
    for (let j = 0; j < 160; j++) {
      const i = (j * 2) % Math.min(fxs.length - 1, 40), roll = Math.floor(j / 20)
      const [fx1, fx2] = [fxs[i], fxs[i + 1]]
      const g1 = structuredClone(g0)
      setDials(g1, HOT)
      // the second match is a week on, as the filed record would be
      g1.week = fx1.week
      const own = (g: GameState, fx: Fixture) => g.fixtures.find(f => f.id === fx.id)!
      const c1 = beginMatch(g1, own(g1, fx1), mulberry32(fx1.id * 3 + seed + roll * 100_003), false, g1.userClubId)
      c1.assistantSubs = true
      while (c1.seg !== 3) playSegment(g1, c1)
      firsts++
      const prev = fileEvidence(g1, c1)!
      if (topProblem(prev) !== 'pen') continue
      named++
      const next = (agg: number) => {
        const g2 = structuredClone(g1)
        g2.week = g1.week + 1
        setDials(g2, agg)
        const c2 = beginMatch(g2, own(g2, fx2), mulberry32(fx2.id * 5 + seed + roll * 100_003), false, g2.userClubId)
        c2.assistantSubs = true
        while (c2.seg !== 3) playSegment(g2, c2)
        const cur = buildEvidence(g2, c2)!
        const back = prevEvidence(g2, cur)
        return { cur, back, f: back ? matchFollow(back, cur) : null }
      }
      const K = next(HOT), C = next(COOL)
      if (!K.f || !C.f || K.back!.fxId !== fx1.id) continue
      if (K.f.a === prev.side[0].pens && K.f.b === K.cur.side[0].pens && C.f.b === C.cur.side[0].pens) quoted++
      if (K.f.trend === trendOf(K.f.a, K.f.b) && C.f.trend === trendOf(C.f.a, C.f.b)) chosen++
      if (K.f.now || C.f.now) fresh++
      trends.keep.set(K.f.trend, (trends.keep.get(K.f.trend) ?? 0) + 1)
      trends.cool.set(C.f.trend, (trends.cool.get(C.f.trend) ?? 0) + 1)
      for (const f of [K.f, C.f]) {
        for (const l of LANGS) if (rawKey(followText(l, f, 'matchday.fuSinceLast', 'matchday.fuMatches'))) raw++
        examples[`match:${f.trend}${f.now ? ':now' : ''}`] ??= followText('en', f, 'matchday.fuSinceLast', 'matchday.fuMatches')
      }
      pairs.push({ a: prev.side[0].pens, keep: K.cur.side[0].pens, cool: C.cur.side[0].pens })
    }
  }
  const d = pairs.map(p => p.keep - p.cool)
  const se = sd(d) / Math.sqrt(d.length)
  console.log(`      ${firsts} first matches at Physicality ${HOT}; the penalty count was the top problem in ${named}`)
  console.log(`      the next match, played twice on the same dice: ${pairs.length} pairs; penalties last match ${f2(mean(pairs.map(p => p.a)))}, this match left at ${HOT} ${f2(mean(pairs.map(p => p.keep)))}, brought down to ${COOL} ${f2(mean(pairs.map(p => p.cool)))}`)
  console.log(`      paired difference ${f2(mean(d))} a match (sd ${f2(sd(d))}, se ${f2(se)}, d = ${f2(mean(d) / (sd(d) || 1))})`)
  console.log(`      follow-up left:    ${[...trends.keep.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}`)
  console.log(`      follow-up changed: ${[...trends.cool.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}; a new weakness named in ${fresh} of ${pairs.length * 2}`)
  ok(pairs.length >= 20, `enough pairs (${pairs.length})`)
  ok(mean(d) > 2 * se, `bringing it down for the next match cuts its penalty count by more than twice the standard error (${f2(mean(d))} > ${f2(2 * se)})`)
  const good = (m: Map<string, number>) => ((m.get('improved') ?? 0) + (m.get('partly') ?? 0)) / Math.max(1, pairs.length)
  ok(good(trends.cool) > good(trends.keep), `the follow-up says improved or partly more often when it came down (${Math.round(good(trends.cool) * 100)}% against ${Math.round(good(trends.keep) * 100)}%)`)
  ok(quoted === pairs.length && chosen === pairs.length, 'it quotes last match\'s count and this one\'s, and chooses its word from them')
  ok(raw === 0, 'and reads as words in six languages')
}
console.log('\n      what the full-time card says, from the matches above:')
for (const [k, v] of Object.entries(examples).sort()) console.log(`        [${k}] ${v}`)
ok(['improved', 'unchanged', 'worse'].every(t => Object.keys(examples).some(k => k.startsWith(`${t}:`))), 'improved, unchanged and worse each came up at full time')

lap()
// ------------------------------------------------------------------ 4
console.log('\n--- 4. a season the assistant plays: homework, memory, the rematch\n')
{
  const g = newGame('leicester', 'Loop Season', 1861)
  let played = 0, hwSet = 0, recalled = 0, whyRecalled = 0, lessons = 0, rematches = 0, followed = 0
  const shown: string[] = []
  for (let wk = 0; wk < 46 && played < 30; wk++) {
    const fx = userFixtureThisWeek(g)
    if (fx && isClubFixture(g, fx) && !fx.played) {
      const opp = opponentIn(g, fx)!
      if (lastMeeting(g, opp) && g.clubs[opp]) {
        rematches++
        const rep = buildReport(g, opp)
        const hist = rep.lines.filter(l => l.cat === 'history')
        if (hist.length) recalled++
        const why = hist.find(l => l.k.startsWith('matchday.why'))
        if (why) {
          whyRecalled++
          if (shown.length < 2) shown.push(`${g.clubs[opp].short}: ${hist.map(l => tIn('en', l.k, Object.fromEntries(Object.entries(l.v ?? {}).flatMap(([k, v]) => k.endsWith('_k') ? [[k, v], [k.slice(0, -2), tIn('en', String(v))]] : [[k, v]])))).join(' ')}`)
        }
        if (planOptions(g, fx).some(o => o.id === 'lesson')) lessons++
      }
      // as the assistant's result plays it (store instantResult)
      const ctx = beginMatch(g, fx, matchRng(g), true, g.userClubId)
      ctx.assistantSubs = true
      playHalf(g, ctx)
      playHalf(g, ctx)
      const cur = buildEvidence(g, ctx)
      if (cur && prevEvidence(g, cur) && matchFollow(prevEvidence(g, cur)!, cur)) followed++
      fileFindings(g, ctx)
      fileEvidence(g, ctx)
      played++
      if (g.fixHw?.fxId === fx.id && g.fixHw.season === g.season) hwSet++
    }
    processWeekAndAdvance(g)
  }
  for (const s of shown) console.log(`      ${s}`)
  const loop = g.tacLoop!
  const evBytes = JSON.stringify(loop.evidence).length, fBytes = JSON.stringify(loop.findings).length
  const was = JSON.stringify(loop.evidence!.slice(-6)).length + JSON.stringify(loop.findings.slice(-6)).length
  console.log(`      ${played} matches; ${rematches} against a side met before, the report recalled ${recalled}, with the last meeting's "why" in ${whyRecalled}; the lesson plan offered ${lessons} times`)
  console.log(`      ${followed} full times had last match's problem to follow up`)
  console.log(`      the save keeps ${loop.evidence!.length} evidence records (${evBytes} bytes) and ${loop.findings.length} findings (${fBytes} bytes): ${evBytes + fBytes - was} bytes more than the newest six of each`)
  ok(hwSet === played, `every match the assistant played set the homework (${hwSet} of ${played})`)
  ok(recalled > 0 && recalled === rematches, `a league rematch is recalled in the report (${recalled} of ${rematches})`)
  ok(whyRecalled > 0, 'and the report says what decided the last meeting')
  ok(followed > played / 3, 'match to match, the next full time has the last one to hold against')
  ok(loop.evidence!.length <= RECALL_CAP && loop.findings.length <= RECALL_CAP, `the lists stay inside ${RECALL_CAP}`)
  ok(evBytes + fBytes < 30_000, 'and the whole loop stays small')
  const last = loop.evidence![loop.evidence!.length - 1]
  ok(lastEvidence(g, last.oppId) === last, 'the last record against a side is the one read back')
}

lap()
console.log(fails ? `\nLOOP PROBE FAILED: ${fails}` : '\nLOOP PROBE PASSED')
process.exit(fails ? 1 : 0)
