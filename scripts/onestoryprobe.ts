/**
 * ---- THE LOOP TELLS ONE STORY (1.8.5) ----
 *
 * DECISION > CONSEQUENCE > EXPLANATION > MEMORY > RESPONSE. Every voice on
 * the full-time card reads the same match: the "why", the follow-up after
 * the break ("After the break: ..."), the follow-up on last match ("Since
 * last match: ..."), the half-time word and its LEVERS chip, last week's
 * homework, the two fixes and the plan's finding. Each was held to its own
 * numbers by its own probe; this holds them to one another, on careers
 * played through the live path (beginMatch, the first half, a change at
 * the break, the second half, the card read as MatchDay reads it, then
 * fileFindings and fileEvidence and the week turned), with every kind of
 * half-time change: none, the dial the chip names moved its way, the same
 * dial moved the other way, and each Quick Game Plan.
 *
 * What may never happen:
 *
 *   1. The half-time word and the full-time follow-up talk about different
 *      halves, or different problems.
 *   2. A follow-up quotes a count the engine did not keep (a negative
 *      second half, a number off the record), or picks its word against
 *      its own numbers.
 *   3. "You moved X the right way" when X moved the other way, or the
 *      other way round.
 *   4. A prep plan changed at the break read as "set but not carried
 *      through" (the 1.8.5 report), or the plan's line quoting a score
 *      that is not the match's.
 *   5. The fixes telling the manager to move a dial against the way the
 *      half-time chip told him to, when he did what the chip said.
 *   6. The fixes asking for one dial both ways at once.
 *   7. Last week's homework marked sorted when the follow-up on the same
 *      thing says it got worse, or "here it is again" when it says it
 *      improved; the cards marked sorted in a match with a card in it.
 *   8. The set-piece finding and the "why" disagreeing about who lost
 *      more of their own ball.
 *   9. A raw key on screen, in any of the six languages.
 *  10. The report or the desk saying a coach is set for a call, and full
 *      time never saying what came of it; or full time answering a warning
 *      nobody gave (1.8.5, evidence.ts readTold).
 *
 * Run: npx vite-node scripts/onestoryprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { applyTacticsChange, beginMatch, playSegment, refFor, type LiveCtx } from '../src/game/matchEngine'
import { matchRng, processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import {
  LEVERS, LEVER_DIALS, readTold, toldCalls, buildEvidence, fileEvidence, halfFollow, halfSides, htEvidence, hurtCount, leverMoved,
  matchFollow, prevEvidence, rankWhy, secondHalf, sidesOf, trendOf, whyLeads, type WhyCause,
} from '../src/game/evidence'
import { halfTimeHints } from '../src/game/conditions'
import { buildFindings, fileFindings, lineText } from '../src/game/matchfindings'
import { applyPlan, currentPlan, isClubFixture, opponentIn, planFollowed, planOptions } from '../src/game/oppreport'
import { coachFixes, gradeHomework, type FixTag } from '../src/game/coachfix'
import { PRESETS } from '../src/game/tactics'
import { ADAPT_WORTH, deskQuestion } from '../src/game/armsrace'
import { buildReport } from '../src/game/oppreport'
import { ensureLang, setLang, t, type Lang } from '../src/game/i18n'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'ja', 'af']
for (const l of LANGS) await ensureLang(l)
setLang('en')
const rawKey = (s: string) => /\b[a-z]+\.[a-zA-Z_]+\b/.test(s.replace(/\d+\.\d+/g, '')) || /[{}]/.test(s)
const clamp = (x: number) => Math.max(0, Math.min(100, x))
const t0 = performance.now()

type Variant = 'none' | 'chip' | 'oppose' | `preset:${string}`
const VARIANTS: Variant[] = ['none', 'chip', 'oppose', ...PRESETS.map(p => `preset:${p.id}` as Variant)]
const ADDITIVE: WhyCause[] = ['pen', 'turn', 'set', 'break', 'phase', 'move', 'kick']
/** the homework subject and the cause a count follows it by. 'discipline'
 *  is the cards (coachfix.fixDiscipline, "keeping fifteen on the pitch"
 *  since 1.8.5: it read "the discipline" and was marked "here it is again"
 *  beside a penalty count the follow-up called improved), and is held to
 *  the cards themselves below */
const TAG_CAUSE: Partial<Record<FixTag, WhyCause>> = { setpiece: 'set' }
/** what each fix's advice does to a touchline dial */
const HOW_DIAL: Record<string, [string, 1 | -1]> = {
  'coachfix.terrHowKick': ['kicking', -1],
  'coachfix.terrHowElse': ['tempo', -1],
  'coachfix.terrHowTrade': ['tempo', -1],
  'coachfix.discHowHigh': ['aggression', -1],
  'coachfix.discHowLow': ['aggression', -1],
  'coachfix.attHowNarrow': ['style', 1],
  'coachfix.howBreakdown': ['aggression', 1],
}
/** which advice a fix's sentence is: its template, the number left open */
const howOf = (how: string) => Object.keys(HOW_DIAL).find(k => {
  const re = new RegExp(`^${t(k, { n: 999 }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('999', '\\d+')}$`)
  return re.test(how)
})

const stats = {
  matches: 0, htHurt: 0, htSame: 0, htCauseMismatch: [] as string[],
  halfFollows: 0, negative: [] as string[], offRecord: [] as string[], wrongTrend: [] as string[],
  moves: new Map<string, number>(), movedWrong: [] as string[],
  plans: 0, planChanged: 0, planDropped: [] as string[], planScore: [] as string[], planKinds: new Map<string, number>(),
  howSeen: 0, chipThenFix: [] as string[], fixBothWays: [] as string[],
  grades: 0, gradeContra: [] as string[], spContra: [] as string[], raw: [] as string[],
  warned: 0, answered: 0, unanswered: [] as string[], unwarned: [] as string[], deskNotTold: [] as string[],
}
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)
const examples: string[] = []

function playWeek(g: GameState, n: number, seed: number) {
  const fx = userFixtureThisWeek(g)
  if (!fx || fx.played || !isClubFixture(g, fx)) return false
  const club = g.clubs[g.userClubId]
  const tac = club.tactic
  // a fresh start each week, as a manager who sets his dials before kick-off
  Object.assign(tac, { style: 50, tempo: 50, kicking: 50, aggression: 40 + ((n * 37 + seed) % 50) })
  // a prep plan in three weeks of four
  const opts = planOptions(g, fx)
  const pick = n % 4 === 3 ? null : opts[(n + seed) % Math.max(1, opts.length)] ?? null
  if (pick) applyPlan(g, fx, pick)
  // a side that runs one strike on everything in half the careers, so the
  // tape fills and the sharper dugouts set up for it
  if (seed % 2) { tac.moveMain = 'mv_loop'; tac.moveAlt = undefined }
  const oppId = opponentIn(g, fx)!
  const desk = deskQuestion(g, oppId)
  const rep = buildReport(g, oppId)
  const said = !!desk || rep.lines.some(l => l.k === 'armsrace.tapeSet' || l.k === 'armsrace.tapeUnread' || l.k === 'oppreport.memMove')
  const ctx: LiveCtx = beginMatch(g, fx, matchRng(g), true, g.userClubId)
  ctx.assistantSubs = true
  playSegment(g, ctx)
  // ---- the break, as the half-time panel shows it
  const evH = buildEvidence(g, ctx)!
  if (JSON.stringify(evH) === JSON.stringify(ctx.htEv)) stats.htSame++
  const lines = halfTimeHints(refFor(fx.id), ctx.weather, ...halfSides(evH), !!ctx.uncontested, htEvidence(evH))
  const hurt = lines.find(l => l.tag === 'hurt')
  const lever = hurt?.cause ? LEVERS[hurt.cause as WhyCause] : undefined
  const variant = VARIANTS[(n * 7 + seed) % VARIANTS.length]
  const before = LEVER_DIALS.map(k => tac[k])
  const hadPlan = pick ? planFollowed(g, currentPlan(g, opponentIn(g, fx)!)!) : false
  if (variant === 'chip' && lever) tac[lever.dial] = clamp(tac[lever.dial] + 30 * lever.dir)
  if (variant === 'oppose' && lever) tac[lever.dial] = clamp(tac[lever.dial] - 30 * lever.dir)
  if (variant.startsWith('preset:')) Object.assign(tac, PRESETS.find(p => `preset:${p.id}` === variant)!.values)
  applyTacticsChange(g, ctx)
  const planChanged = !!pick && hadPlan && !planFollowed(g, currentPlan(g, opponentIn(g, fx)!)!)
  while (ctx.seg !== 3) playSegment(g, ctx)
  stats.matches++
  const tag = `s${seed} w${g.week} ${variant}`

  // ---- the full-time card, read as MatchDay MatchVerdict reads it
  const ev = buildEvidence(g, ctx)!
  const { mine, opp } = sidesOf(ctx)!
  const why = rankWhy(ev, 3)
  const leads = whyLeads(ev, why)
  const half = halfFollow(ev, ctx.htEv)
  const moved = half ? leverMoved(half.cause, ctx.htDials, ctx.shDials) : null
  const prev = prevEvidence(g, ev)
  const follow = prev ? matchFollow(prev, ev) : null
  const hw = g.fixHw
  const fresh = !!hw && hw.fxId !== fx.id && hw.season === g.season && g.week - hw.week <= 4
  const fixes = coachFixes(g, ctx, mine, opp, tac, 2)
  const grade = fresh && hw ? gradeHomework(g, ctx, mine, opp, tac, hw.tags as FixTag[]) : null
  const rec = buildFindings(g, ctx)!
  const told = toldCalls(ctx, ADAPT_WORTH)
  const answer = why.some(w => w.cause === 'read') || !!readTold(ev, told)

  // 1. the break and the follow-up talk about the same half and problem
  if (hurt?.cause) {
    stats.htHurt++
    if (half && half.cause !== hurt.cause) stats.htCauseMismatch.push(`${tag}: word ${hurt.cause}, follow-up ${half.cause}`)
    if (!half && hurtCount(ctx.htEv!, hurt.cause as WhyCause) != null) stats.htCauseMismatch.push(`${tag}: word ${hurt.cause}, no follow-up`)
  }
  // 2. the follow-up's numbers are the record's
  if (half) {
    stats.halfFollows++
    const sh = secondHalf(ev, ctx.htEv!)
    if (half.a !== hurtCount(ctx.htEv!, half.cause) || half.b !== hurtCount(sh, half.cause)) stats.offRecord.push(`${tag} ${half.cause}`)
    if (ADDITIVE.includes(half.cause) && half.b !== hurtCount(ev, half.cause)! - half.a) stats.offRecord.push(`${tag} ${half.cause} not additive`)
    if (half.a < 0 || half.b < 0) stats.negative.push(`${tag} ${half.cause} ${half.a}/${half.b}`)
    if (half.trend !== trendOf(half.a, half.b, half.cause === 'phase' ? 4 : 1)) stats.wrongTrend.push(tag)
  }
  if (follow && (follow.a < 0 || follow.b < 0)) stats.negative.push(`${tag} match ${follow.cause}`)
  // 3. the dial read is the dial moved
  if (half && moved) {
    bump(stats.moves, `${variant.startsWith('preset') ? 'preset' : variant}:${moved}`)
    const L = LEVERS[half.cause]!
    const i = LEVER_DIALS.indexOf(L.dial)
    const d = (tac[L.dial] - before[i]) * L.dir
    const truth = d >= 10 ? 'right' : d <= -10 ? 'wrong' : 'none'
    if (truth !== moved) stats.movedWrong.push(`${tag}: read ${moved}, moved ${d}`)
  }
  // 4. the plan
  const plan = rec.items.find(i => i.cat === 'strategic')
  if (pick && plan) {
    stats.plans++
    bump(stats.planKinds, `${planChanged ? 'changed' : 'kept'} -> ${plan.k}`)
    if (planChanged) stats.planChanged++
    if (plan.k === 'find.planDropped') stats.planDropped.push(`${tag} ${pick.id}`)
    if (plan.k.startsWith('find.planHalf_')) {
      const v = plan.v!
      const ht = ctx.htEv!
      if (v.us !== ht.us || v.them !== ht.them || v.us2 !== mine.score - ht.us || v.them2 !== opp.score - ht.them) stats.planScore.push(tag)
      if (examples.length < 4) examples.push(lineText(plan))
    }
  }
  // 5. the chip, done, then the fix undoing it
  const fixDials = fixes.map(f => howOf(f.how)).filter(Boolean).map(k => HOW_DIAL[k!])
  stats.howSeen += fixDials.length
  if (half && moved === 'right') {
    const L = LEVERS[half.cause]!
    for (const [dial, dir] of fixDials) {
      if (dial === L.dial && dir !== L.dir) stats.chipThenFix.push(`${tag}: chip ${L.dial} ${L.dir > 0 ? 'up' : 'down'}, fix says ${dir > 0 ? 'up' : 'down'} (${fixes.map(f => f.tag).join('+')})`)
    }
  }
  // 6. one dial, both ways
  for (const [dial, dir] of fixDials) {
    if (fixDials.some(([d2, r2]) => d2 === dial && r2 !== dir)) { stats.fixBothWays.push(`${tag}: ${dial}`); break }
  }
  // 7. the homework against the follow-up
  if (grade) {
    const cards = ctx.events.filter(e => (e.type === 'YC' || e.type === 'RC') && e.teamId === mine.teamId).length
    if (grade.fixed.includes('discipline') && cards) stats.gradeContra.push(`${tag}: fifteen on the pitch sorted, ${cards} cards`)
    if (grade.missed.includes('discipline') && !cards) stats.gradeContra.push(`${tag}: fifteen on the pitch again, no cards`)
  }
  if (grade && follow) {
    stats.grades++
    for (const tg of grade.fixed) if (TAG_CAUSE[tg] === follow.cause && follow.trend === 'worse') stats.gradeContra.push(`${tag}: ${tg} sorted, ${follow.cause} ${follow.a}->${follow.b} worse`)
    for (const tg of grade.missed) if (TAG_CAUSE[tg] === follow.cause && follow.trend === 'improved') stats.gradeContra.push(`${tag}: ${tg} again, ${follow.cause} ${follow.a}->${follow.b} improved`)
  }
  // 8. the set piece, finding against why
  const setWhy = why.find(w => w.cause === 'set')
  const sp = rec.items.find(i => i.k === 'find.spWon' || i.k === 'find.spLost')
  if (setWhy && sp) {
    const weLostMore = setWhy.sig < 0
    const unit = String(sp.v!.unit_k).replace('oppreport.u_', '')
    if (unit !== 'breakdown' && (sp.k === 'find.spWon') === weLostMore) stats.spContra.push(`${tag}: ${lineText(sp)} / ${t(setWhy.k, setWhy.v)}`)
  }
  // 10. the warning before kick-off, answered at full time
  if (desk && !told.length) stats.deskNotTold.push(`${tag}: the desk named a call the match did not hold them set for`)
  if (told.length) {
    if (!said) stats.unwarned.push(`${tag}: ${told.join(',')}`)
    stats.warned++
    const ran = told.some(id => (ev.side[0].calls[id]?.[0] ?? 0) >= 3)
    if (answer) {
      stats.answered++
      const l = readTold(ev, told)
      if (l && examples.length < 8) examples.push(t(l.k, l.v))
    } else if (ran) stats.unanswered.push(`${tag}: ${told.join(',')}`)
  }
  // 9. words, not keys
  for (const l of LANGS) {
    setLang(l)
    for (const it of rec.items) { const s = lineText(it); if (rawKey(s)) stats.raw.push(`${l}: ${s}`) }
    for (const f of fixes) if (rawKey(f.head) || rawKey(f.how)) stats.raw.push(`${l}: ${f.head} ${f.how}`)
    const rt = readTold(ev, told)
    if (rt && rawKey(t(rt.k, rt.v))) stats.raw.push(`${l}: ${t(rt.k, rt.v)}`)
  }
  setLang('en')
  void leads
  fileFindings(g, ctx)
  fileEvidence(g, ctx)
  return true
}

const SEEDS = [18501, 18502, 18503, 18504, 18505, 18506]
const CLUBS = ['leicester', 'leicester', 'leicester', 'leicester', 'leicester', 'leicester']
SEEDS.forEach((seed, si) => {
  const g = newGame(CLUBS[si], 'Trust', seed)
  let n = 0
  for (let wk = 0; wk < 46 && n < 30; wk++) {
    if (playWeek(g, n, seed)) n++
    processWeekAndAdvance(g)
  }
})
const show = (xs: string[]) => xs.slice(0, 4).forEach(x => console.log(`        ${x}`))
console.log(`\n      ${stats.matches} matches through the live path in ${((performance.now() - t0) / 1000).toFixed(0)}s; a hurting line at the break in ${stats.htHurt}, followed up at full time in ${stats.halfFollows}`)
console.log(`      the dial read at full time: ${[...stats.moves.entries()].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`)
console.log(`      plans: ${stats.plans}, changed at the break ${stats.planChanged}: ${[...stats.planKinds.entries()].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`)
for (const e of examples) console.log(`        "${e}"`)
ok(stats.htSame === stats.matches, 'the half-time word reads the record full time holds it against')
ok(!stats.htCauseMismatch.length, `the follow-up after the break is about what the half-time word said was hurting (${stats.htCauseMismatch.length} not)`); show(stats.htCauseMismatch)
ok(!stats.offRecord.length && !stats.negative.length, `every follow-up quotes the record's own counts, none below zero (${stats.offRecord.length} off, ${stats.negative.length} negative)`); show([...stats.offRecord, ...stats.negative])
ok(!stats.wrongTrend.length, 'and picks improved / partly / unchanged / worse from them')
ok(!stats.movedWrong.length, `"the right way" / "the other way" / "left where it was" is the way the dial went (${stats.movedWrong.length} not)`); show(stats.movedWrong)
ok(['chip:right', 'oppose:wrong', 'none:none'].every(k => stats.moves.has(k)), 'the chip followed, the chip opposed and no change each came up')
ok(stats.planChanged >= 10, `enough plans changed at the break to judge (${stats.planChanged})`)
ok(!stats.planDropped.length, `a plan carried to the break and changed there is never "not carried through" (${stats.planDropped.length})`); show(stats.planDropped)
ok(!stats.planScore.length, 'the plan line quotes the score at the break and the second half\'s as the match had them')
ok(stats.howSeen >= 40, `the fixes that name a dial are recognised, so the next two checks have something to hold (${stats.howSeen})`)
ok(!stats.chipThenFix.length, `the fixes never tell him to undo what the half-time chip asked, when he did it (${stats.chipThenFix.length})`); show(stats.chipThenFix)
ok(!stats.fixBothWays.length, `the two fixes never ask for one dial both ways (${stats.fixBothWays.length})`); show(stats.fixBothWays)
ok(stats.grades >= 20 && !stats.gradeContra.length, `the homework never marks sorted what the follow-up says got worse, or the reverse (${stats.gradeContra.length} of ${stats.grades})`); show(stats.gradeContra)
ok(!stats.spContra.length, `the set-piece finding and the "why" agree on who lost more of their own ball (${stats.spContra.length})`); show(stats.spContra)
ok(stats.warned >= 20, `the report or the desk warned of a call in enough matches (${stats.warned}), and full time answered ${stats.answered}`)
ok(!stats.unanswered.length, `a warned call run three times or more is always answered at full time (${stats.unanswered.length} not)`); show(stats.unanswered)
ok(!stats.unwarned.length && !stats.deskNotTold.length, `full time never answers a warning nobody gave, nor the desk warn of one the match did not hold (${stats.unwarned.length}, ${stats.deskNotTold.length})`); show([...stats.unwarned, ...stats.deskNotTold])
ok(!stats.raw.length, 'every line reads as words in six languages'); show(stats.raw)
console.log(fails ? `\nONE STORY PROBE FAILED: ${fails}` : '\nONE STORY PROBE PASSED')
process.exit(fails ? 1 : 0)
