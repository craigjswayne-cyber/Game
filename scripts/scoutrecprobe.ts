// Probe: the chief scout's recommendations are a mixed bag, and each one is news.
//
// Owner: "Scout reports need to come up in news for every player recommended -
// a mixed bag of recommendations. It should be some success but not always."
//
// Checks, over commissioned briefs on several seeds:
//   1. every name the scout recommends reaches the inbox, alone or in a group
//      story, and never more than two scouting stories land in one week
//   2. the verdicts are estimates: some men he rates "worth signing" or better
//      are not, by the truth, and most of them are (some success, not always)
//   3. a better chief scout on a longer brief misses by less
//   4. every story reads in all six languages with no hole and no em dash
//   5. the verdict is a pure lens: the same week twice gives the same verdict
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { commissionScout, type SearchMonths } from '../src/game/commission'
import { appointStaff, staffCandidates, staffInterest } from '../src/game/staff'
import { gradeOf, judgementSpread, scoutVerdict, worthFrom } from '../src/game/scoutrecs'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import type { GameState, NewsItem } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'af', 'ja']
for (const l of LANGS) await ensureLang(l)

function withScout(seed: number, tier?: number) {
  const g = newGame('leicester', 'Scout Probe', seed)
  g.clubs[g.userClubId].balance = 20_000_000
  if (!g.staffPeople?.scout) {
    const i = staffCandidates(g, 'scout').findIndex(c => staffInterest(g, c) !== 'no')
    if (i >= 0) appointStaff(g, 'scout', i)
  }
  if (tier != null) g.staff.scout = tier
  return g
}

const REC_KEYS = new Set(['news.scoutRec', 'news.scoutRecs', 'news.scoutMonthlyRec'])
function checkText(n: NewsItem) {
  for (const lang of LANGS) {
    for (const s of [tIn(lang, n.k + 'Subj', n.v), tIn(lang, n.k!, n.v)]) {
      if (/\{\w+\}/.test(s) || /\b(news|pos|recruit)\.\w/.test(s)) bad(`${n.k} [${lang}] unfilled: ${s}`)
      if (s.includes('\u2014')) bad(`${n.k} [${lang}] em dash: ${s}`)
    }
  }
}

let recommended = 0, wrong = 0
const byTier: Record<number, [number, number]> = {}
const differ: Record<number, [number, number]> = {}
const missBy: Record<string, number[]> = {}
for (const [tier, months] of [[1, 3], [3, 9]] as [number, SearchMonths][]) {
  for (let seed = 1; seed <= 6; seed++) {
    const g: GameState = withScout(seed * 97, tier)
    commissionScout(g, 'any', months)
    const until = g.commission!.done
    let guard = 0
    while (g.season * 100 + g.week < until && guard++ < 60) processWeekAndAdvance(g)
    // the report, then a few weeks for the desk to tell every verdict
    for (let w = 0; w < 6; w++) processWeekAndAdvance(g)
    // a sacked manager has no department writing to him (scoutDesk drops
    // what was owed), and the inbox keeps a few months, so the telling is
    // judged on the brief's own names in a career still running
    const recs = (g.scoutRecs ?? []).filter(r => r.src === 'brief')
    if (!recs.length) { if (!g.unemployed) bad(`seed ${seed}: no recommendations filed`); continue }
    // 1. told, and never a flood
    const told = new Set<number>()
    const perWeek = new Map<string, number>()
    for (const n of g.news) {
      if (n.tag !== 'scout') continue
      const wk = `${n.season}|${n.week}`
      perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1)
      if (n.playerId != null) told.add(n.playerId)
      for (const id of n.playerIds ?? []) told.add(id)
      if (REC_KEYS.has(n.k ?? '')) checkText(n)
    }
    for (const [wk, c] of perWeek) if (c > 2) bad(`seed ${seed} tier ${tier}: ${c} scouting stories in week ${wk}`)
    for (const r of g.unemployed ? [] : recs) {
      if (!r.posted) bad(`seed ${seed}: ${g.players[r.playerId]?.name} still waiting to be told after six weeks`)
      if (!told.has(r.playerId)) bad(`seed ${seed}: ${g.players[r.playerId]?.name} recommended and never named in the news`)
    }
    // 2. and 3. the verdicts against the truth
    for (const r of recs) {
      const p = g.players[r.playerId]
      if (!p) continue
      const truth = gradeOf(worthFrom(p.ca, p.pa, p.age))
      const d = (differ[tier] ??= [0, 0]); d[0]++; if (truth !== r.grade) d[1]++
      if (r.grade >= 2) { recommended++; if (truth < 2) wrong++; const t = (byTier[tier] ??= [0, 0]); t[0]++; if (truth < 2) t[1]++ }
      ;(missBy[`${tier}|${months}`] ??= []).push(Math.abs(r.pot - p.pa) + Math.abs(r.cur - p.ca))
    }
  }
}
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const share = wrong / Math.max(1, recommended)
console.log(`recommended (worth signing or better): ${recommended}, of them not, by the truth: ${wrong} (${(share * 100).toFixed(0)}%)`)
for (const [k, v] of Object.entries(differ)) console.log(`  tier ${k}: the verdict differs from the truth on ${v[1]} of ${v[0]}`)
for (const [k, v] of Object.entries(byTier)) console.log(`  tier ${k}: ${v[1]} of ${v[0]} recommendations wrong`)
for (const [k, v] of Object.entries(missBy)) console.log(`  tier|months ${k}: mean miss ${mean(v).toFixed(1)} points over ${v.length} verdicts`)
if (recommended < 10) bad('too few recommendations to judge')
if (wrong === 0) bad('every recommendation was right: the verdict is still the truth')
if (share > 0.5) bad('most recommendations were wrong: the scout is no use at all')
if (!(mean(missBy['3|9'] ?? []) < mean(missBy['1|3'] ?? []))) bad('a three-badge scout on nine months misses by no less than a one-badge scout on three')
if (!(judgementSpread(3, 39) < judgementSpread(1, 4))) bad('the judgement spread does not narrow with badge and time')

// 5. a pure lens
{
  const g = withScout(5)
  const p = Object.values(g.players).find(x => x.clubId && x.clubId !== g.userClubId)!
  const a = scoutVerdict(g, p, 13), b = scoutVerdict(g, p, 13)
  if (JSON.stringify(a) !== JSON.stringify(b)) bad('the same verdict twice came out different')
}

if (fails) { console.error(`SCOUT REC PROBE: ${fails} failures`); process.exit(1) }
console.log('SCOUT REC PROBE PASSED: a mixed bag, each name told, two stories a week at most')
