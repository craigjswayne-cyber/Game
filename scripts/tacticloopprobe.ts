// Probe: the tactical loop (#181). Scout the opponent, write the report, pick a
// plan, play the match, read the findings, and carry them into the next report.
//
// Seven claims, each held here:
//
//   1. A report generates for every kind of fixture the manager can face: a
//      league match, a cup tie, a friendly, and a Test when he coaches a nation.
//      A Test report carries no plans, because the club's levers do not reach
//      the union's camp.
//   2. Accuracy scales with the analysis suite and the assistant, and the report
//      is sometimes wrong even when it is sharp.
//   3. Every plan option maps onto controls that exist, applying one changes
//      those controls and nothing else, and moving one afterwards drops it.
//   4. The findings agree with the match's own numbers, three to five of them,
//      one per category, deterministic, and never a raw key on screen.
//   5. Following a sound plan helps on average, and not by so much that it
//      breaks the balance (paired matches, same fixture, same dice).
//   6. The findings kept on the save are capped, and the next report against
//      the same side reads them back.
//   7. An old or damaged save migrates cleanly.
//
// The AI-vs-AI world is held by scripts/fingerprint.ts: none of this runs there.
import { newGame } from '../src/game/newgame'
import { natFixtureThisWeek, processWeekAndAdvance, userFixtureThisWeek, userMatchThisWeek } from '../src/game/season'
import { beginMatch, matchStats, playSegment } from '../src/game/matchEngine'
import { unitBattles } from '../src/game/coachfix'
import { mulberry32 } from '../src/game/rng'
import { ROUTINE_BY_ID } from '../src/game/playbook'
import { BRIEF_BY_ID } from '../src/game/bench'
import { analystRead } from '../src/game/analyst'
import { migrate } from '../src/game/save'
import {
  FINDINGS_CAP, applyPlan, buildReport, currentPlan, isCurrent, keepFindings, lastMeeting,
  migrateTacLoop, opponentIn, planFollowed, planOptions, reportAccuracy,
  type FindingsRecord, type ReportLine,
} from '../src/game/oppreport'
import { buildFindings, fileFindings, lineText } from '../src/game/matchfindings'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const rawKey = (s: string) => /\b(oppreport|find|playbook|analyst|bench)\.[A-Za-z_]+/.test(s)
const texts = (lines: { k: string }[]) => lines.map(l => lineText(l as ReportLine))

function playOut(g: GameState, fx: Fixture, side: string) {
  const ctx = beginMatch(g, fx, mulberry32(fx.id * 7919 + 13), true, side)
  ctx.assistantSubs = true
  while (ctx.seg !== 3) playSegment(g, ctx)
  return ctx
}

// ---- 1. every kind of fixture ----------------------------------------------
console.log('\n1. a report for every fixture type')
const g = newGame('leicester', 'Loop Probe', 1811)
const me = g.clubs[g.userClubId]
let guard = 0
while (!userFixtureThisWeek(g) && guard++ < 20) processWeekAndAdvance(g)
const leagueFx = userFixtureThisWeek(g)!
ok(!!leagueFx, `a fixture to study (week ${g.week}, ${leagueFx?.compId})`)
const leagueOpp = opponentIn(g, leagueFx)!
const r1 = buildReport(g, leagueOpp)
const r1b = buildReport(g, leagueOpp)
ok(JSON.stringify(r1) === JSON.stringify(r1b), 'the report is the same on a second look')
ok(r1.lines.length >= 5, `a league report has substance (${r1.lines.length} lines)`)
const r1t = texts(r1.lines)
for (const s of r1t) console.log(`      ${s}`)
ok(r1t.every(s => !rawKey(s)) && r1t.every(s => !s.includes('—')), 'every line reads as words, no raw keys, no em dashes')
const cats = new Set(r1.lines.map(l => l.cat))
ok(['form', 'style', 'players', 'setpiece', 'coach', 'soft'].every(c => cats.has(c as ReportLine['cat'])),
  `it covers form, style, key men, set piece, the dugout and the soft spot (${[...cats].join(', ')})`)
ok(planOptions(g, leagueFx).length >= 2 && planOptions(g, leagueFx).length <= 3,
  `two or three plans for a league match (${planOptions(g, leagueFx).map(o => o.id).join(', ')})`)

// a cup tie against a side from another league, and a friendly
const other = Object.values(g.clubs).find(c => c.leagueId !== me.leagueId && c.id !== me.id)!
const cupId = Object.keys(g.comps).find(id => id !== me.leagueId && (id === 'cc' || id === 'chc')) ?? 'cc'
const cupFx: Fixture = { id: 990_001, compId: cupId, round: 0, week: g.week, homeId: other.id, awayId: me.id, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 }
const rc = buildReport(g, opponentIn(g, cupFx)!)
ok(rc.lines.length >= 4 && !rc.test, `a cup report against ${other.short} (${rc.lines.length} lines)`)
ok(planOptions(g, cupFx).length >= 2, 'with plans')
const frFx: Fixture = { ...cupFx, id: 990_002, compId: 'fr', homeId: me.id, awayId: other.id }
ok(buildReport(g, opponentIn(g, frFx)!).lines.length >= 4 && planOptions(g, frFx).length >= 2, 'a friendly gets a report and plans')

// a Test, with the manager holding a national job: walk to a real one, with
// the squads named, the way countryprobe does
const gt = newGame('northampton', 'Loop Test', 61)
gt.natTeam = 'SCO'
gt.natConfidence = 60
for (let i = 0; i < 70 && !natFixtureThisWeek(gt); i++) processWeekAndAdvance(gt)
const testFx = natFixtureThisWeek(gt)
ok(!!testFx && userMatchThisWeek(gt)?.id === testFx.id, `a Test is the manager's match (week ${gt.week}, ${testFx?.compId})`)
if (testFx) {
  const rt = buildReport(gt, opponentIn(gt, testFx)!)
  ok(rt.test && rt.lines.length >= 3, `a Test report against ${opponentIn(gt, testFx)} (${rt.lines.length} lines: ${rt.lines.map(l => l.cat).join(', ')})`)
  for (const s2 of texts(rt.lines)) console.log(`      ${s2}`)
  ok(texts(rt.lines).every(s2 => !rawKey(s2)), 'in words')
  ok(planOptions(gt, testFx).length === 0, 'and no club plans in a Test week')
  const tctx = playOut(gt, testFx, testFx.homeId === 'SCO' || testFx.awayId === 'SCO' ? 'SCO' : 'LIO')
  const trec = buildFindings(gt, tctx)
  ok(!!trec && trec.items.some(f => f.k === 'find.testWeek') && trec.items.length >= 3, 'a Test\'s findings say it was the camp\'s week')
}

// ---- 2. accuracy scales with the suite -------------------------------------
console.log('\n2. accuracy')
const setUp = (s: GameState, suite: number, asst: number) => {
  const c = s.clubs[s.userClubId]
  c.facilities = { ...(c.facilities ?? {}), briefing: suite } as typeof c.facilities
  s.staff.assistant = asst
}
const lo = clone(g); setUp(lo, 0, 0)
const hi = clone(g); setUp(hi, 5, 3)
const accLo = reportAccuracy(lo, leagueOpp), accHi = reportAccuracy(hi, leagueOpp)
console.log(`      accuracy: bare ${(accLo * 100).toFixed(0)}%, full suite ${(accHi * 100).toFixed(0)}%`)
ok(accHi - accLo >= 0.2, 'the analysis suite and the assistant sharpen the report')
ok(buildReport(lo, leagueOpp).band !== 'sharp' && buildReport(hi, leagueOpp).band === 'sharp', 'a bare club reads vaguely, a full suite sharply')
// error rate across every AI club and several weeks
const errRate = (s: GameState) => {
  let wrong = 0, n = 0, held = 0
  const w0 = s.week
  for (let w = 0; w < 6; w++) {
    s.week = w0 + w
    for (const c of Object.values(s.clubs)) {
      if (c.id === s.userClubId || c.leagueId !== me.leagueId) continue
      const rep = buildReport(s, c.id)
      for (const l of rep.lines) {
        if (l.cat === 'setpiece' && l.ok === undefined) held++
        if (l.ok === undefined) continue
        if (l.cat === 'style' || l.cat === 'soft' || l.cat === 'players') { n++; if (!l.ok) wrong++ }
      }
    }
  }
  s.week = w0
  s.analyst = null
  return { rate: wrong / Math.max(1, n), n, held }
}
const eLo = errRate(lo), eHi = errRate(hi)
console.log(`      wrong reads: bare ${(eLo.rate * 100).toFixed(1)}% of ${eLo.n}, full suite ${(eHi.rate * 100).toFixed(1)}% of ${eHi.n}; set piece held back ${eLo.held} vs ${eHi.held}`)
ok(eLo.rate > eHi.rate + 0.05, 'a vague report is wrong more often')
ok(eHi.rate > 0, 'and a sharp one is still sometimes wrong')
ok(eLo.held > eHi.held, 'a vague report holds back what it cannot see')

// ---- 3. plans map onto real levers -----------------------------------------
console.log('\n3. plans are existing levers')
const PREPS = new Set(['attack', 'defence', 'setpiece', 'fitness', 'recovery'])
const DIALS = new Set(['style', 'tempo', 'kicking', 'aggression', 'defLine'])
const gp = clone(hi)
let checked = 0, bad = 0
for (const c of Object.values(gp.clubs)) {
  if (c.id === gp.userClubId || c.leagueId !== me.leagueId) continue
  const fx: Fixture = { ...leagueFx, homeId: gp.userClubId, awayId: c.id }
  for (const o of planOptions(gp, fx)) {
    checked++
    const L = o.levers
    const valid = (!L.prep || PREPS.has(L.prep))
      && Object.entries(L.dials ?? {}).every(([k, v]) => DIALS.has(k) && Number.isInteger(v) && v >= 0 && v <= 100)
      && (!L.kickStyle || ['territory', 'contest', 'attack', 'balanced'].includes(L.kickStyle))
      && (!L.lineoutCall || ROUTINE_BY_ID[L.lineoutCall]?.kind === 'lineout')
      && (!L.scrumCall || ROUTINE_BY_ID[L.scrumCall]?.kind === 'scrum')
      && (!L.brief || !!BRIEF_BY_ID[L.brief])
      && Object.keys(L).length > 0
    if (!valid) { bad++; console.error(`      bad levers: ${o.id} ${JSON.stringify(L)}`) }
  }
}
ok(checked >= 20 && bad === 0, `${checked} plan options across the league, every lever a real control`)
{
  const s = clone(hi)
  const opts = planOptions(s, leagueFx)
  const o = opts[0]
  const before = clone(s.clubs[s.userClubId].tactic)
  applyPlan(s, leagueFx, o)
  const after = s.clubs[s.userClubId].tactic
  const changed = Object.keys({ ...before, ...after }).filter(k =>
    JSON.stringify((before as unknown as Record<string, unknown>)[k]) !== JSON.stringify((after as unknown as Record<string, unknown>)[k]))
  const allowed = new Set([...Object.keys(o.levers.dials ?? {}), 'kickStyle', 'lineoutCall', 'scrumCall', 'briefs'])
  ok(changed.every(k => allowed.has(k)), `applying "${o.id}" touched only its levers (${changed.join(', ') || 'none beyond prep'})`)
  ok(s.matchPrep === o.levers.prep, 'and set the week\'s prep')
  const plan = currentPlan(s, leagueOpp)!
  ok(!!plan && planFollowed(s, plan) && isCurrent(s, leagueOpp, o), 'the plan is carried')
  const read = analystRead(s, leagueOpp)!
  ok(o.id !== 'exploit' || s.matchPrep === read.prep, 'the exploit plan sets the analyst\'s own prep, so his homework edge applies')
  s.matchPrep = s.matchPrep === 'fitness' ? 'recovery' : 'fitness'
  ok(!planFollowed(s, plan), 'change the prep and the plan is off')
}

// ---- 4 and 6. findings from real matches, kept and read back ---------------
console.log('\n4. findings from real matches')
const gw = clone(hi)
let matches = 0, noRaw = true, catBad = 0, countBad = 0, possBad = 0, spBad = 0, playerBad = 0, detBad = 0, recalled = 0
const seenCats = new Map<string, number>()
const verdicts = new Map<string, number>()
guard = 0
while (matches < 14 && guard++ < 40) {
  const fx = userFixtureThisWeek(gw)
  if (fx) {
    const opp = opponentIn(gw, fx)!
    const opts = planOptions(gw, fx)
    // alternate: follow the exploit plan, follow another, set none
    if (matches % 3 === 0 && opts[0]) applyPlan(gw, fx, opts[0])
    else if (matches % 3 === 1 && opts[1]) applyPlan(gw, fx, opts[1])
    else gw.matchPrep = undefined
    const ctx = playOut(gw, fx, gw.userClubId)
    const rec = buildFindings(gw, ctx)!
    const again = buildFindings(gw, ctx)!
    if (JSON.stringify(rec) !== JSON.stringify(again)) detBad++
    const home = ctx.home.teamId === gw.userClubId
    const mine = home ? ctx.home : ctx.away, them = home ? ctx.away : ctx.home
    const st = matchStats(ctx)
    const poss = st.possession[home ? 0 : 1]
    const units = unitBattles(ctx, mine, them)
    if (rec.items.length < 3 || rec.items.length > 5) countBad++
    if (new Set(rec.items.map(f => f.cat)).size !== rec.items.length) catBad++
    for (const f of rec.items) {
      seenCats.set(f.cat, (seenCats.get(f.cat) ?? 0) + 1)
      const s = lineText(f)
      if (rawKey(s) || s.includes('—')) noRaw = false
      if (f.cat === 'tactical' && f.v?.poss !== poss) possBad++
      if (f.cat === 'setpiece' && f.v?.pct != null && !units.some(u => u.pct === f.v!.pct)) spBad++
      if (f.cat === 'player') {
        const marks = mine.finalR ?? mine.ratings
        const top = [...marks.entries()].sort((a, b) => b[1] - a[1])[0]
        if (f.v?.best !== gw.players[top[0]].name) playerBad++
      }
    }
    if (rec.plan) verdicts.set(`${rec.plan.id}:${rec.plan.verdict}`, (verdicts.get(`${rec.plan.id}:${rec.plan.verdict}`) ?? 0) + 1)
    const hadLast = !!lastMeeting(gw, opp)
    if (hadLast && buildReport(gw, opp).lines.some(l => l.cat === 'history')) recalled++
    if (matches === 0) for (const f of rec.items) console.log(`      [${f.cat}] ${lineText(f)}`)
    fileFindings(gw, ctx)
    fileFindings(gw, ctx) // twice: kept once
    matches++
  }
  processWeekAndAdvance(gw)
}
ok(matches >= 10, `${matches} matches played and read`)
ok(countBad === 0, 'three to five findings every time')
ok(catBad === 0, 'never two in one category')
ok(['tactical', 'setpiece', 'player', 'strategic'].every(c => (seenCats.get(c) ?? 0) === matches) && (seenCats.get('physical') ?? 0) > 0,
  `every category appears (${[...seenCats.entries()].map(([k, v]) => `${k} ${v}`).join(', ')})`)
ok(possBad === 0, 'the possession quoted is the stats panel\'s')
ok(spBad === 0, 'the set-piece percentage is one the verdict card shows')
ok(playerBad === 0, 'the standout is the best-rated man')
ok(detBad === 0, 'the same match reads the same twice')
ok(noRaw, 'every finding reads as words, no raw keys, no em dashes')
console.log(`      plan verdicts: ${[...verdicts.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}`)
ok(verdicts.size >= 2, 'plans are judged, and not always the same way')

console.log('\n6. storage')
ok((gw.tacLoop?.findings.length ?? 0) === Math.min(FINDINGS_CAP, matches), `the save keeps the last ${gw.tacLoop?.findings.length} (cap ${FINDINGS_CAP})`)
ok(new Set(gw.tacLoop!.findings.map(f => f.fxId)).size === gw.tacLoop!.findings.length, 'one record per fixture, even filed twice')
{
  const last = gw.tacLoop!.findings[gw.tacLoop!.findings.length - 1]
  const rep = buildReport(gw, last.oppId)
  const hist = rep.lines.filter(l => l.cat === 'history')
  ok(hist.length >= 1, `the next report against ${gw.clubs[last.oppId]?.short} remembers the last meeting`)
  for (const l of hist) console.log(`      ${lineText(l)}`)
  console.log(`      reports that recalled an earlier meeting in the walk: ${recalled}`)
}
{
  const s = clone(g)
  const dummy = (i: number): FindingsRecord => ({ fxId: 1000 + i, season: s.season, week: 1, oppId: leagueOpp, us: 10, them: 3, items: [] })
  for (let i = 0; i < 25; i++) keepFindings(s, dummy(i))
  keepFindings(s, dummy(24))
  ok(s.tacLoop!.findings.length === FINDINGS_CAP && s.tacLoop!.findings[FINDINGS_CAP - 1].fxId === 1024, 'twenty-five records keep the newest six')
  ok(JSON.stringify(s.tacLoop).length < 12_000, `and the whole loop stays small (${JSON.stringify(gw.tacLoop).length} bytes after a real walk)`)
}

// ---- 5. a sound plan helps, and not by too much ----------------------------
console.log('\n5. balance: paired matches, same fixture, same dice')
// Four arms on every fixture, each a copy of the same world played with the
// same dice: no prep at all; the analyst's prep alone (what his card's button
// has always done); the exploit plan; and the other plans on offer. The plan
// adds no engine modifier of its own, so against the prep-alone arm it should
// be a shade either way, and against doing nothing a sound read should help.
const arms = { base: [] as number[], prep: [] as number[], exploit: [] as number[], soundGain: [] as number[], overPrep: [] as number[] }
const otherGain = new Map<string, number[]>()
let winsBase = 0, winsPlan = 0
for (const [club, seed] of [['leicester', 51], ['northampton', 52], ['bath', 53]] as const) {
  const w = newGame(club, 'Balance', seed)
  setUp(w, 5, 3)
  let played = 0
  guard = 0
  while (played < 12 && guard++ < 40) {
    const fx = userFixtureThisWeek(w)
    const oppId = fx ? opponentIn(w, fx) : null
    const read = oppId ? analystRead(w, oppId) : null
    const opts = fx ? planOptions(w, fx) : []
    const exploit = opts.find(o => o.id === 'exploit')
    if (fx && read && exploit) {
      const margin = (s: GameState) => {
        const c = playOut(s, s.fixtures.find(f => f.id === fx.id)!, s.userClubId)
        return c.home.teamId === s.userClubId ? c.home.score - c.away.score : c.away.score - c.home.score
      }
      const base = clone(w); base.matchPrep = undefined
      const prep = clone(w); prep.matchPrep = read.prep
      const plan = clone(w); applyPlan(plan, fx, exploit)
      const mBase = margin(base), mPrep = margin(prep), mPlan = margin(plan)
      arms.base.push(mBase); arms.prep.push(mPrep); arms.exploit.push(mPlan)
      arms.overPrep.push(mPlan - mPrep)
      if (read.right) arms.soundGain.push(mPlan - mBase)
      if (mBase > 0) winsBase++
      if (mPlan > 0) winsPlan++
      for (const o of opts) {
        if (o.id === 'exploit') continue
        const other = clone(w); applyPlan(other, fx, o)
        const list = otherGain.get(o.id) ?? []
        list.push(margin(other) - mBase)
        otherGain.set(o.id, list)
      }
      played++
    }
    processWeekAndAdvance(w)
  }
}
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
const sgn = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`
const n5 = arms.base.length
const gainAll = mean(arms.exploit) - mean(arms.base)
console.log(`      ${n5} fixtures. Margin a match: no prep ${sgn(mean(arms.base))}, analyst's prep alone ${sgn(mean(arms.prep))}, exploit plan ${sgn(mean(arms.exploit))}`)
console.log(`      exploit plan over no prep ${sgn(gainAll)} (sound reads ${sgn(mean(arms.soundGain))} over ${arms.soundGain.length}); over the prep alone ${sgn(mean(arms.overPrep))}`)
for (const [id, xs] of otherGain) console.log(`      ${id} plan over no prep ${sgn(mean(xs))} (${xs.length})`)
console.log(`      wins: ${winsBase} with no prep, ${winsPlan} with the exploit plan`)
ok(n5 >= 24, 'enough paired matches to judge')
ok(mean(arms.soundGain) > 0, 'following a plan built on a sound read helps on average')
ok(Math.abs(mean(arms.overPrep)) <= 3, 'the plan is worth about what its levers already were: no hidden modifier')
ok(gainAll < 8 && mean(arms.soundGain) < 10, 'an edge, not a cheat code')
ok([...otherGain.values()].every(xs => Math.abs(mean(xs)) < 8), 'no other plan swings a match by a converted try')

// ---- 7. migration ----------------------------------------------------------
console.log('\n7. save migration')
{
  const s = clone(g)
  migrateTacLoop(s)
  ok(s.tacLoop === undefined, 'a save without the loop stays without it')
  ;(s as unknown as Record<string, unknown>).tacLoop = 'garbage'
  migrateTacLoop(s)
  ok(s.tacLoop === undefined, 'a mangled loop is dropped rather than crashing the load')
  ;(s as unknown as Record<string, unknown>).tacLoop = {
    findings: [...Array.from({ length: 20 }, (_, i) => ({ fxId: i, season: 1, week: 1, oppId: 'x', us: 0, them: 0, items: [] })), null, { fxId: 'no' }],
    plan: { abs: 1, oppId: 'x', id: 'nonsense', levers: {} },
  }
  migrateTacLoop(s)
  ok(s.tacLoop!.findings.length === FINDINGS_CAP && s.tacLoop!.findings.every(f => typeof f.fxId === 'number'), 'bad entries are dropped and the rest capped')
  ok(s.tacLoop!.plan === null, 'a plan the game does not know is cleared')
  const round = migrate(clone(gw))
  ok(JSON.stringify(round.tacLoop) === JSON.stringify(gw.tacLoop), 'a real loop survives a save and load untouched')
}

console.log(fails ? `\nTACTIC LOOP PROBE FAILED (${fails})` : '\nTACTIC LOOP PROBE PASSED')
process.exit(fails ? 1 : 0)
