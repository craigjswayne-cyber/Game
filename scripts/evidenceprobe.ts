/**
 * ---- THE EVIDENCE, CHECKED (1.8.3) ----
 *
 * The full-time "why" and the half-time "working / hurting" read counters the
 * engine keeps as a match runs (matchEngine EvCount) through evidence.ts. A
 * line that says "Line breaks 6 to 2 our way: 14 points from them" is only
 * worth printing if the 6, the 2 and the 14 are true, and if the line at the
 * top is really the thing that decided the match. So:
 *
 *   1. The counters reconcile with what the game already counts: the points
 *      put down to each cause add up to the score, every time; the tries the
 *      called moves made sit inside the points put down to the moves; the
 *      turnovers by zone add up to the style's turnover counts; the ticks by
 *      zone are the ticks played; the set piece is the stats panel's and the
 *      penalties the referee's count. A watched match and the same match
 *      played silently carry the same evidence.
 *   2. The record is filed once per fixture, the newest six kept, small, and
 *      an old or damaged save loads with it healed or absent.
 *   3. Over 300 decided matches, the top "why" line names the cause that put
 *      the most points on the board in the direction of the result, by the
 *      engine's own account of every point, at least 80% of the time. The
 *      ranking adds a price for the counts behind the points (set pieces,
 *      turnovers, penalties, territory, the styles, the tape), so the check
 *      measures how often those counts move the headline away from the
 *      points. For an independent figure the probe also prints how often a
 *      ranking from the counts alone, with no points in it, finds the same
 *      cause; that number is reported, not held to a bar.
 *   4. The lines read as words in all six languages, three at most, each
 *      with a figure in it.
 *   5. At half time: at most one working and one hurting line, and the
 *      assistant's word stays at two lines.
 *   6. The tape: a call the opposition was set for is counted as blunted,
 *      and the line can say what it cost.
 *
 * Run: npx vite-node scripts/evidenceprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, matchStats, playSegment, evOf, EV_CAUSES, type LiveCtx } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import {
  EVIDENCE_CAP, WHY_MIN, buildEvidence, fileEvidence, halfSides, htEvidence, marginLeader, migrateEvidence, netPts,
  rankWhy, significance, type CausalEvidence, type WhyCause,
} from '../src/game/evidence'
import { halfTimeHints } from '../src/game/conditions'
import { refFor } from '../src/game/matchEngine'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import { migrate } from '../src/game/save'
import { playbookOf } from '../src/game/playbook'
import { adaptMap } from '../src/game/armsrace'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'ja', 'af']
for (const l of LANGS) await ensureLang(l)

function play(g: GameState, fx: Fixture, seed: number, side: string, detail = true): LiveCtx {
  const ctx = beginMatch(g, fx, mulberry32(seed), detail, side)
  ctx.assistantSubs = true
  while (ctx.seg !== 3) playSegment(g, ctx)
  return ctx
}
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

// ------------------------------------------------------------------ 1, 3, 4
console.log('\n--- 1. the counters reconcile\n')
const bad = { pts: 0, moves: 0, turns: 0, zone: 0, set: 0, pens: 0, silent: 0, det: 0 }
let sides = 0, decided = 0, agree = 0, agreeCounts = 0, draws = 0, bytes = 0, recs = 0
const lineBad = { raw: 0, many: 0, number: 0, dash: 0 }
const tops = new Map<string, number>(), misses = new Map<string, number>()
const examples: string[] = []
for (const seed of [1813, 2024, 77]) {
  const g = newGame('leicester', 'Evidence', seed)
  const fxs = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 102)
  fxs.forEach((fx, i) => {
    const side = i % 2 ? fx.homeId : fx.awayId
    const rngSeed = fx.id * 31 + seed
    // the world as it was before the match, for the same match unwatched
    const before = i < 12 ? structuredClone(g) : null
    const ctx = play(g, fx, rngSeed, side)
    const st = matchStats(ctx)
    for (const s of [ctx.home, ctx.away]) {
      const e = evOf(s)
      sides++
      if (sum(e.pts) !== s.score) bad.pts++
      const moveTries = sum(Object.values(e.calls).map(c => c[2]))
      const mp = e.pts[EV_CAUSES.indexOf('move')]
      if (mp < 5 * moveTries || mp > 7 * moveTries) bad.moves++
      if (sum(e.turnWon) !== (s.styTurnWon ?? 0) || sum(e.turnLost) !== (s.styTurnLost ?? 0)) bad.turns++
      if (sum(e.zone) !== (ctx.momoHist ?? []).length) bad.zone++
    }
    const ev = buildEvidence(g, ctx)!
    const hi = ctx.home.teamId === side ? 0 : 1
    if (ev.side[0].setLost[0] !== st.scrumsLost[hi] || ev.side[0].setLost[1] !== st.lineoutsLost[hi]
      || ev.side[1].setWon[1] !== st.lineoutsWon[1 - hi]) bad.set++
    const mine = hi === 0 ? ctx.home : ctx.away
    if (ev.side[0].pens !== mine.consPens) bad.pens++
    if (JSON.stringify(buildEvidence(g, ctx)) !== JSON.stringify(ev)) bad.det++
    // the same match nobody watched: the same evidence (played on the copy
    // of the world taken before it, since a match moves the world on)
    if (before) {
      const quiet = play(before, before.fixtures.find(f => f.id === fx.id)!, rngSeed, side, false)
      if (JSON.stringify(buildEvidence(before, quiet)) !== JSON.stringify(ev)) bad.silent++
    }
    bytes += JSON.stringify(ev).length; recs++
    // ---- 3. the ranking
    const why = rankWhy(ev)
    if (ev.us === ev.them) { draws++; return }
    decided++
    const lead = marginLeader(ev)
    const top = why[0]?.cause ?? 'none'
    tops.set(top, (tops.get(top) ?? 0) + 1)
    if (top === lead) agree++
    else misses.set(`${top} for ${lead}`, (misses.get(`${top} for ${lead}`) ?? 0) + 1)
    // the counts alone: every cause's price without the points
    const sig = significance(ev)
    const counts: Record<WhyCause, number> = { ...sig }
    for (const c of EV_CAUSES) counts[c] -= netPts(ev, c)
    const d = Math.sign(ev.us - ev.them)
    const cTop = (Object.keys(counts) as WhyCause[]).sort((a, b) => counts[b] * d - counts[a] * d)[0]
    if (cTop === lead) agreeCounts++
    // ---- 4. the words
    if (why.length > 3) lineBad.many++
    for (const w of why) {
      for (const l of LANGS) {
        const s = tIn(l, w.k, w.v)
        if (/[{}]|matchday\.|moves\.|styles\./.test(s)) lineBad.raw++
        if (s.includes('\u2014') || s.includes('\u2013')) lineBad.dash++
        // the figure for one is the word: "made a try", "once"
        if (!/[0-9]/.test(s) && w.v.n !== 1) lineBad.number++
      }
    }
    if (examples.length < 6 && why.length === 3) {
      examples.push(`${g.clubs[side].short} ${ev.us}-${ev.them} ${g.clubs[ev.oppId].short}\n        ${why.map(w => `${tIn('en', w.k, w.v)} (${w.sig > 0 ? '+' : ''}${w.sig.toFixed(1)})`).join('\n        ')}`)
    }
  })
}
ok(bad.pts === 0, `the points put down to each cause add up to the score (${sides} sides)`)
ok(bad.moves === 0, 'the tries the called moves made sit inside the points put down to the moves (5 to 7 a try)')
ok(bad.turns === 0, 'turnovers by zone add up to the style turnover counts, won and lost')
ok(bad.zone === 0, 'the ticks by zone are the ticks played')
ok(bad.set === 0, 'the set piece is the stats panel\'s, won and lost')
ok(bad.pens === 0, 'the penalties given away are the referee\'s count')
ok(bad.det === 0, 'the same match reads the same twice')
ok(bad.silent === 0, 'a watched match and the same match played silently carry the same evidence')

console.log('\n--- 3. the top line against the margin\n')
const rate = agree / Math.max(1, decided)
console.log(`      ${decided} decided matches (${draws} drawn, left out): the top line names the cause that put the most points on the board ${agree} times (${(rate * 100).toFixed(1)}%)`)
console.log(`      from the counts alone, with no points in the ranking: ${agreeCounts} (${(agreeCounts / Math.max(1, decided) * 100).toFixed(1)}%), reported, not held to a bar`)
console.log(`      top lines: ${[...tops].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`)
console.log(`      where they differ (top line for the points leader): ${[...misses].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`)
ok(decided >= 290, `at least 290 decided matches read (${decided})`)
ok(rate >= 0.8, `the top line agrees with the margin's largest contributor at least 80% of the time (${(rate * 100).toFixed(1)}%)`)

console.log('\n--- 4. the words\n')
for (const e of examples) console.log(`      ${e}`)
ok(lineBad.many === 0, 'three lines at most')
ok(lineBad.raw === 0, 'every line reads as words in six languages: no raw keys, no holes')
ok(lineBad.dash === 0, 'no dashes standing in for punctuation')
ok(lineBad.number === 0, 'every line carries a figure (for one, the word)')
ok(rankWhy({ ...emptyEv() }).length === 0, 'a match with nothing in it says nothing')

// ------------------------------------------------------------------ 2
console.log('\n--- 2. filing and the save\n')
{
  const g = newGame('leicester', 'Filing', 1830)
  const mine = g.fixtures.filter(f => (f.homeId === g.userClubId || f.awayId === g.userClubId) && g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 9)
  for (const fx of mine) {
    const ctx = play(g, fx, fx.id * 7 + 3, g.userClubId)
    fileEvidence(g, ctx)
    fileEvidence(g, ctx) // twice: kept once
  }
  const list = g.tacLoop?.evidence ?? []
  ok(list.length === EVIDENCE_CAP, `nine matches keep the newest ${list.length} (cap ${EVIDENCE_CAP})`)
  ok(new Set(list.map(e => e.fxId)).size === list.length, 'one record per fixture, even filed twice')
  ok(list[list.length - 1].fxId === mine[mine.length - 1].id, 'the newest is the last match played')
  const size = JSON.stringify(list).length
  console.log(`      ${size} bytes for ${list.length} records (${Math.round(size / list.length)} each); ${Math.round(bytes / recs)} on average over the ${recs} matches above`)
  ok(size / list.length < 800, 'a record stays under 800 bytes')
  // a half-time read is never filed
  const ht = beginMatch(g, mine[0], mulberry32(4), true, g.userClubId)
  playSegment(g, ht)
  ok(fileEvidence(g, ht) === null && (g.tacLoop?.evidence ?? []).length === EVIDENCE_CAP, 'nothing is filed before full time')
  // the save
  const round = migrate(structuredClone(g))
  ok(JSON.stringify(round.tacLoop?.evidence) === JSON.stringify(list), 'a real list survives a save and load untouched')
  const old = structuredClone(g)
  delete old.tacLoop!.evidence
  migrateEvidence(old)
  ok(old.tacLoop!.evidence === undefined && Array.isArray(old.tacLoop!.findings), 'a save from before 1.8.3 keeps its loop and has no evidence, which is read as none')
  const junk = structuredClone(g) as unknown as { tacLoop: { evidence: unknown } }
  junk.tacLoop.evidence = 'garbage'
  migrateEvidence(junk as unknown as GameState)
  ok(junk.tacLoop.evidence === undefined, 'a list that is not a list is dropped')
  const mixed = structuredClone(g)
  mixed.tacLoop!.evidence = [null, { fxId: 'x' }, { ...list[0], side: [list[0].side[0]] }, ...list, ...list] as unknown as CausalEvidence[]
  migrateEvidence(mixed)
  ok(mixed.tacLoop!.evidence!.length === EVIDENCE_CAP && mixed.tacLoop!.evidence!.every(e => Array.isArray(e.side) && e.side.length === 2),
    'unreadable entries are dropped and the rest capped')
  let threw = false
  try { migrate(structuredClone(mixed)) } catch { threw = true }
  ok(!threw, 'and the whole save still loads')
}

// ------------------------------------------------------------------ 5
console.log('\n--- 5. half time\n')
{
  const g = newGame('leicester', 'Half Time', 1831)
  const fxs = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 80)
  let said = 0, tagged = 0, over = 0, both = 0
  const shown: string[] = []
  for (const fx of fxs) {
    const ctx = beginMatch(g, fx, mulberry32(fx.id + 11), true, fx.homeId)
    playSegment(g, ctx)
    if (ctx.seg !== 1) continue
    const ev = buildEvidence(g, ctx)!
    const hte = htEvidence(ev)
    if (hte.length > 2 || hte.filter(h => h.tag === 'work').length > 1 || hte.filter(h => h.tag === 'hurt').length > 1) over++
    const [m, o] = halfSides(ev)
    const lines = halfTimeHints(refFor(fx.id), ctx.weather, m, o, !!ctx.uncontested, hte)
    if (lines.length > 2) over++
    if (lines.length) said++
    const tg = lines.filter(l => l.tag)
    if (tg.length) tagged++
    if (tg.length === 2) both++
    if (shown.length < 4 && tg.length) shown.push(`${ev.us}-${ev.them}: ${lines.map(l => `${l.tag ? tIn('en', l.tag === 'work' ? 'matchday.htWorking' : 'matchday.htHurting') + ' ' : ''}${tIn('en', l.k, l.v)}`).join(' / ')}`)
  }
  for (const s of shown) console.log(`      ${s}`)
  console.log(`      ${fxs.length} first halves: the word spoke in ${said}, with an evidence line in ${tagged} (both a working and a hurting line in ${both})`)
  ok(over === 0, 'at most one working and one hurting line, and never more than two lines in all')
  ok(tagged > fxs.length / 3, 'working or hurting is said in a good share of first halves')
}

// ------------------------------------------------------------------ 6
console.log('\n--- 6. the tape\n')
{
  const g = newGame('leicester', 'Tape', 1832)
  const me = g.clubs[g.userClubId]
  me.tactic.moveMain = 'mv_loop'
  playbookOf(me).drilled.mv_loop = 92
  playbookOf(me).faced = { mv_loop: 40 }
  const fxs = g.fixtures.filter(f => (f.homeId === me.id || f.awayId === me.id) && g.clubs[f.homeId] && g.clubs[f.awayId])
  let read = 0, blunted = 0, lines = 0
  let shown = ''
  for (const fx of fxs.slice(0, 20)) {
    const oppId = fx.homeId === me.id ? fx.awayId : fx.homeId
    const set = (adaptMap(g, oppId).mv_loop ?? 0) > 0
    playbookOf(me).faced = { mv_loop: 40 }
    const ctx = play(g, fx, fx.id + 5, me.id)
    const ev = buildEvidence(g, ctx)!
    const c = ev.side[0].calls.mv_loop
    if (set) read++
    if (set && c && c[3] > 0 && c[3] === c[0]) blunted++
    if (!set && c && c[3] > 0) blunted -= 100
    const sig = significance(ev)
    if (set && Math.abs(sig.read) >= WHY_MIN) {
      const l = rankWhy(ev, 9).find(w => w.cause === 'read')
      if (l) { lines++; shown ||= tIn('en', l.k, l.v) }
    }
  }
  console.log(`      ${read} of 20 opponents were set for the loop; blunted calls counted in ${blunted}`)
  if (shown) console.log(`      ${shown}`)
  ok(read > 0 && blunted === read, 'a call the opposition was set for is counted as blunted, and only then')
  ok(lines > 0, `the cost of the read can be a line of its own (${lines})`)
}

function emptyEv(): CausalEvidence {
  const s = () => ({
    calls: {}, pts: [0, 0, 0, 0, 0, 0], breaks: 0, styleEdge: 0, blunted: 0,
    setWon: [0, 0] as [number, number], setLost: [0, 0] as [number, number],
    turnWon: [0, 0, 0], turnLost: [0, 0, 0], pens: 0, zone: [0, 10, 0],
  })
  return { fxId: 1, season: 0, week: 1, oppId: 'x', us: 0, them: 0, min: 80, poss: 50, side: [s(), s()], swings: [], lead: [], late: 0 }
}

console.log(fails ? `\nEVIDENCE PROBE FAILED: ${fails}` : '\nEVIDENCE PROBE PASSED')
process.exit(fails ? 1 : 0)
