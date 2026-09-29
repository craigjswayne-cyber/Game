// Probe: recruitment as detective work (recruit.ts).
//
// The scout report must be a report and not an oracle: it tracks knowledge,
// it is more right the more the club knows, its confidence word is honest, the
// fit leans the way the side does, the rival talk it passes on is real about
// as often as the scout says, and nothing hidden leaks through it.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { attrRange, knowledge } from '../src/game/scout'
import { remember } from '../src/game/memory'
import { personalTermsDemand } from '../src/game/ai'
import {
  agentStable, agentTone, confidenceOf, fitScore, fitWord, posBaselines, reportEstimate, rivalTalk,
  scoutReport, sideDemands, talkTruth, trueNotes, type Note,
} from '../src/game/recruit'
import { ATTR_KEYS, type GameState, type Player } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.log('FAIL ' + m) }
const ok = (c: boolean, m: string) => { if (!c) bad(m) }
const pct = (x: number) => `${(x * 100).toFixed(0)}%`

const g = newGame('leicester', 'Recruit Probe', 5150)
for (let i = 0; i < 6; i++) processWeekAndAdvance(g)

const pool = (s: GameState) => Object.values(s.players)
  .filter(p => p.clubId && p.clubId !== s.userClubId && !p.acad && p.age >= 19)
const sample = pool(g).filter((_, i) => i % 3 === 0)
console.log(`sample: ${sample.length} players`)

// ---- 1. contents grow with knowledge, and get more right -----------------
const LEVELS = [20, 40, 60, 80, 100]
const origSc = new Map(sample.map(p => [p.id, p.sc]))
const acc: Record<number, { prec: number; sDev: number; cDev: number; fit: number; err: number; n: number; ns: number; nc: number; rows: number }> = {}
const base = posBaselines(g)
// a side with a clear way of playing, so the fit has something to be right about
const tacSaved = { ...g.clubs[g.userClubId].tactic }
Object.assign(g.clubs[g.userClubId].tactic, { style: 85, tempo: 75, kicking: 20, aggression: 45 })
for (const k of LEVELS) {
  const a = { prec: 0, sDev: 0, cDev: 0, fit: 0, err: 0, n: 0, ns: 0, nc: 0, rows: 0 }
  for (const p of sample) {
    p.sc = k
    const r = scoutReport(g, p)
    const truth = trueNotes(g, p, 3, 2)
    const b = base[p.pos]
    a.n++
    // sections the report can fill: strengths, concerns, ceiling, fit, personality
    a.rows += (r.stage >= 1 ? 2 : 0) + (r.ceiling ? 1 : 0) + (r.fit ? 1 : 0) + (r.pers ? 1 : 0)
    for (const s of r.strengths) { a.ns++; if (truth.strengths.includes(s)) a.prec++; a.sDev += p.a[s as keyof typeof p.a] - b[s as keyof typeof b] }
    for (const c of r.concerns) {
      const key = (c === 'highBall' ? 'han' : c) as string
      if (!(ATTR_KEYS as readonly string[]).includes(key)) continue
      a.nc++; a.cDev += p.a[key as keyof typeof p.a] - b[key as keyof typeof b]
    }
    if (r.fit) a.fit += r.fit === truth.fit ? 1 : 0
    for (const key of ATTR_KEYS) a.err += Math.abs(reportEstimate(g, p, key) - p.a[key]) / ATTR_KEYS.length
    // stage gating
    if (k < 35 && (r.strengths.length || r.ceiling || r.fit)) bad(`k=${k}: an unscouted man has a full report (${p.name})`)
    if (k < 90 && r.pers) bad(`k=${k}: personality shown before the full file (${p.name})`)
    if (k >= 90 && !r.pers) bad(`k=${k}: full file without personality (${p.name})`)
  }
  acc[k] = a
}
Object.assign(g.clubs[g.userClubId].tactic, tacSaved)
console.log('\nknow  secs  strength-precision  true-dev(str)  true-dev(con)  fit-agree  mean-abs-err')
for (const k of LEVELS) {
  const a = acc[k]
  console.log(`${String(k).padStart(4)}  ${(a.rows / a.n).toFixed(1).padStart(4)}  ${pct(a.ns ? a.prec / a.ns : 0).padStart(18)}  ${(a.ns ? a.sDev / a.ns : 0).toFixed(2).padStart(13)}  ${(a.nc ? a.cDev / a.nc : 0).toFixed(2).padStart(13)}  ${pct(k >= 35 ? a.fit / a.n : 0).padStart(9)}  ${(a.err / a.n).toFixed(2).padStart(12)}`)
}
for (let i = 1; i < LEVELS.length; i++) {
  const lo = acc[LEVELS[i - 1]], hi = acc[LEVELS[i]]
  if (hi.rows / hi.n < lo.rows / lo.n - 0.05) bad(`report shrank from k=${LEVELS[i - 1]} to k=${LEVELS[i]}`)
  if (hi.err > lo.err + 1e-9) bad(`estimate error rose from k=${LEVELS[i - 1]} to k=${LEVELS[i]}`)
}
for (let i = 2; i < LEVELS.length; i++) {
  const lo = acc[LEVELS[i - 1]], hi = acc[LEVELS[i]]
  if (hi.prec / hi.ns < lo.prec / lo.ns - 0.01) bad(`strength precision fell from k=${LEVELS[i - 1]} to k=${LEVELS[i]}`)
  if (hi.fit / hi.n < lo.fit / lo.n - 0.01) bad(`fit agreement fell from k=${LEVELS[i - 1]} to k=${LEVELS[i]}`)
}
ok(acc[100].prec / acc[100].ns > 0.99, 'a full file names strengths that are not the truth')
ok(acc[100].fit / acc[100].n > 0.99, 'a full file misreads the fit')
ok(acc[40].prec / acc[40].ns < 0.9, 'a weekend of tape is as right as a full file: no fog in the report')
ok(acc[40].sDev / acc[40].ns > 0.5, 'low-knowledge strengths do not even lean the right way')
ok(acc[40].cDev / acc[40].nc < -0.5, 'low-knowledge concerns do not even lean the right way')
ok(acc[100].sDev / acc[100].ns > acc[40].sDev / acc[40].ns, 'strengths correlate no better with the truth at a full file')
ok(acc[100].cDev / acc[100].nc < acc[40].cDev / acc[40].nc, 'concerns correlate no better with the truth at a full file')

// ---- 2. confidence is honest ---------------------------------------------
const byConf: Record<string, { prec: number; ns: number; err: number; n: number }> = {}
for (const p of sample) {
  p.sc = origSc.get(p.id)!
  const k = knowledge(g, p)
  if (k < 35) continue
  const r = scoutReport(g, p)
  const t = trueNotes(g, p, 3, 2)
  const c = (byConf[r.confidence] ??= { prec: 0, ns: 0, err: 0, n: 0 })
  c.n++
  for (const s of r.strengths) { c.ns++; if (t.strengths.includes(s)) c.prec++ }
  for (const key of ATTR_KEYS) c.err += Math.abs(reportEstimate(g, p, key) - p.a[key]) / ATTR_KEYS.length
}
for (const p of sample) { for (const k of [20, 50, 85]) { p.sc = k; const r = scoutReport(g, p); if (r.confidence !== confidenceOf(k)) bad('confidence is not the knowledge reading') } p.sc = origSc.get(p.id)! }
console.log('\nconfidence  n     strength-precision  mean-abs-err  (players as scouted in the world)')
for (const c of ['high', 'medium', 'low']) {
  const x = byConf[c]
  if (!x) { console.log(`${c.padEnd(10)}  -`); continue }
  console.log(`${c.padEnd(10)}  ${String(x.n).padEnd(4)}  ${pct(x.ns ? x.prec / x.ns : 0).padStart(18)}  ${(x.err / x.n).toFixed(2).padStart(12)}`)
}
if (byConf.high && byConf.medium) ok(byConf.high.err / byConf.high.n < byConf.medium.err / byConf.medium.n, 'high confidence is no more accurate than medium')
if (byConf.medium && byConf.low) ok(byConf.medium.err / byConf.medium.n < byConf.low.err / byConf.low.n, 'medium confidence is no more accurate than low')

// ---- 3. tactical fit leans the way the side does --------------------------
const user = g.clubs[g.userClubId]
const tac0 = { ...user.tactic }
const back = sample.find(p => p.pos === 'CE')!
const fwd = sample.find(p => p.pos === 'FL')!
const wide = () => Object.assign(user.tactic, { style: 90, tempo: 80, kicking: 15, aggression: 40 })
const tight = () => Object.assign(user.tactic, { style: 12, tempo: 25, kicking: 85, aggression: 70 })
const runner = { ...back.a, han: 17, pas: 17, pac: 17, agi: 17, vis: 16, kic: 6, str: 8, pos: 9 }
const bosher = { ...fwd.a, str: 18, scr: 16, tac: 17, agg: 16, ruc: 17, han: 7, pas: 6, pac: 7, agi: 7 }
const bB = base[back.pos], bF = base[fwd.pos]
wide()
const wR = fitWord(fitScore(back.pos, runner, bB, sideDemands(g))), wB = fitWord(fitScore(fwd.pos, bosher, bF, sideDemands(g)))
tight()
const tR = fitWord(fitScore(back.pos, runner, bB, sideDemands(g))), tB = fitWord(fitScore(fwd.pos, bosher, bF, sideDemands(g)))
Object.assign(user.tactic, { style: 50, tempo: 50, kicking: 50, aggression: 50, defLine: 50, defWidth: 50, ruckCommit: 50, ruckContest: 50 })
const nR = fitWord(fitScore(back.pos, runner, bB, sideDemands(g)))
console.log(`\nfit: running centre  wide=${wR} tight=${tR} neutral=${nR};  bosh flanker  wide=${wB} tight=${tB}`)
ok(wR === 'excellent' && tR === 'doubtful', 'a running centre does not suit a wide side more than a tight one')
ok(tB === 'excellent' && wB === 'doubtful', 'a bosh flanker does not suit a tight side more than a wide one')
ok(nR === 'good', 'a neutral side calls a specialist a poor or excellent fit')
// across the sample: the fit a full file gives flips with the dials
let flips = 0, leans = 0
for (const p of sample) {
  wide(); const sw = fitScore(p.pos, p.a, base[p.pos], sideDemands(g))
  tight(); const st = fitScore(p.pos, p.a, base[p.pos], sideDemands(g))
  if (Math.sign(sw) === -Math.sign(st) && sw !== 0) flips++
  if (fitWord(sw) !== 'good' || fitWord(st) !== 'good') leans++
}
console.log(`fit across the sample: ${pct(flips / sample.length)} flip sign between wide and tight; ${pct(leans / sample.length)} read other than Good in one of them`)
ok(flips / sample.length > 0.8, 'the fit does not respond to the dials')
ok(leans / sample.length > 0.2 && leans / sample.length < 0.9, 'the fit is either never or always decisive')
const labels = { excellent: 0, good: 0, doubtful: 0 }
wide()
for (const p of sample) labels[fitWord(fitScore(p.pos, p.a, base[p.pos], sideDemands(g)))]++
console.log(`fit words under a wide side: ${JSON.stringify(labels)}`)
Object.assign(user.tactic, tac0)

// ---- 4. no hidden value leaks -------------------------------------------
let leaks = 0
for (const p of sample.slice(0, 200)) {
  for (const k of [20, 40, 60, 80]) {
    p.sc = k
    const r1 = JSON.stringify(scoutReport(g, p))
    const pers = p.pers
    p.pers = pers === 'Loyal' ? 'Mercenary' : 'Loyal'
    const r2 = JSON.stringify(scoutReport(g, p))
    p.pers = pers
    if (r1 !== r2) leaks++
    if (k < 35) {
      const pa = p.pa
      p.pa = pa > 60 ? pa - 15 : pa + 15
      const r3 = JSON.stringify({ ...scoutReport(g, p), talk: null, agent: null })
      p.pa = pa
      if (r3 !== JSON.stringify({ ...JSON.parse(r1), talk: null, agent: null })) leaks++
    }
    const r = scoutReport(g, p)
    if (r.level[0] === r.level[1]) leaks++
    if (r.ceiling && r.ceiling[0] === r.ceiling[1]) leaks++
    for (const key of ATTR_KEYS) {
      const [lo, hi] = attrRange(g, p, key), e = reportEstimate(g, p, key)
      if (e < lo - 1e-9 || e > hi + 1e-9) leaks++
    }
  }
  p.sc = origSc.get(p.id)!
}
console.log(`\nleak checks: ${leaks} leaks (personality before the full file, ceiling before a reading, exact bands, estimates outside the shown range)`)
ok(leaks === 0, `${leaks} hidden values leaked through the report`)

// ---- 5. agent memory ------------------------------------------------------
const target = sample[0]
const same = pool(g).filter(p => p.id !== target.id && agentStable(p.id) === agentStable(target.id)).slice(0, 3)
const other = pool(g).find(p => agentStable(p.id) !== agentStable(target.id))!
const tone0 = agentTone(g, target)
const wage0 = personalTermsDemand(g, target)
remember(g, { kind: 'promise-kept', playerId: same[0].id, payload: { name: same[0].name } })
remember(g, { kind: 'promise-kept', playerId: same[1].id, payload: { name: same[1].name } })
const toneWarm = agentTone(g, target)
const wageWarm = personalTermsDemand(g, target)
g.memory!.entries = []
remember(g, { kind: 'promise-broken', playerId: same[0].id, payload: { name: same[0].name } })
const toneCool = agentTone(g, target)
const wageCool = personalTermsDemand(g, target)
g.memory!.entries = []
remember(g, { kind: 'promise-kept', playerId: other.id, payload: { name: other.name } })
remember(g, { kind: 'promise-kept', playerId: other.id, payload: { name: other.name } })
const toneOther = agentTone(g, target)
g.memory!.entries = []
console.log(`\nagent: fresh=${tone0} two kept promises to his stable=${toneWarm} (terms ${wage0} -> ${wageWarm}) one broken=${toneCool} (terms ${wageCool}); kept to another stable=${toneOther}`)
ok(tone0 === 'neutral', 'a fresh career has an agent opinion already')
ok(toneWarm === 'warm' && wageWarm < wage0, 'kept promises to his agency did not warm the agent or the terms')
ok(toneCool === 'cool' && wageCool > wage0, 'a broken promise to his agency did not cool the agent or raise the terms')
ok(toneOther === 'neutral', 'another agency\'s clients moved this agent')

// ---- 6. rival talk: real interest is real, and the read is honest --------
const h = newGame('bath', 'Recruit Probe 2', 777)
const tally: Record<string, Record<string, { g: number; n: number }>> = {}
const followed: { id: number; club: string; genuine: boolean; from: string; season: number }[] = []
let talkSeen = 0
for (let w = 0; w < 60; w++) {
  processWeekAndAdvance(h)
  if (h.week % 3 !== 0) continue
  for (const p of pool(h)) {
    const truth = talkTruth(h, p)
    if (!truth) continue
    const sc0 = p.sc
    for (const k of [40, 70, 95]) {
      p.sc = k
      const r = rivalTalk(h, p)
      if (!r) continue
      talkSeen++
      if (r.clubId !== truth.clubId) bad('the rumour names a different club from the truth under it')
      const band = k >= 90 ? 'full' : k >= 60 ? 'detailed' : 'tape'
      const t = ((tally[band] ??= {})[r.read] ??= { g: 0, n: 0 })
      t.n++; if (truth.genuine) t.g++
    }
    p.sc = sc0
    if (followed.length < 4000) followed.push({ id: p.id, club: truth.clubId, genuine: truth.genuine, from: p.clubId!, season: h.season })
  }
}
console.log(`\nrival talk heard ${talkSeen} times; share of each read that was really genuine:`)
console.log('knowledge  "genuine"        "could be either"  "agent talk"')
for (const band of ['tape', 'detailed', 'full']) {
  const x = tally[band] ?? {}
  const f = (r: string) => x[r] ? `${pct(x[r].g / x[r].n)} of ${x[r].n}`.padEnd(17) : '-'.padEnd(17)
  console.log(`${band.padEnd(9)}  ${f('genuine')}${f('unsure')}${f('agent')}`)
}
for (const band of ['tape', 'detailed', 'full']) {
  const x = tally[band]
  if (!x?.genuine || !x?.agent) { bad(`no reads at ${band}`); continue }
  ok(x.genuine.g / x.genuine.n > x.agent.g / x.agent.n + 0.2, `at ${band} a "genuine" read is no likelier real than "agent talk"`)
}
const gap = (b: string) => tally[b].genuine.g / tally[b].genuine.n - tally[b].agent.g / tally[b].agent.n
ok(gap('full') > gap('tape'), 'the read gets no sharper with knowledge')
// the consequence: a man with genuine interest leaves more often than one with agent talk
const dedup = new Map<number, typeof followed[number]>()
for (const f of followed) if (!dedup.has(f.id)) dedup.set(f.id, f)
let gMoved = 0, gN = 0, fMoved = 0, fN = 0
for (const f of dedup.values()) {
  const p = h.players[f.id]
  const moved = !p || p.clubId !== f.from
  if (f.genuine) { gN++; if (moved) gMoved++ } else { fN++; if (moved) fMoved++ }
}
console.log(`moved clubs by the end: genuine interest ${pct(gMoved / Math.max(1, gN))} of ${gN}; agent talk ${pct(fMoved / Math.max(1, fN))} of ${fN}`)
ok(gN > 20 && fN > 20, 'too little talk to judge')
ok(gMoved / gN > fMoved / fN + 0.05, 'genuine interest is no more likely than agent talk to end in a move')

console.log(fails ? `\nRECRUIT PROBE FAILED (${fails})` : '\nRECRUIT PROBE PASSED')
process.exit(fails ? 1 : 0)
