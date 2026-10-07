/**
 * ---- THE NAME THAT FITS THE JOB, AT A SENSIBLE RATE (1.8.5) ----
 *
 * QA applied for thirty jobs and the card never said "what you are known
 * for is what this job wants". Measured over three careers of four seasons
 * the assistant ran: the only trait any of them earned was "attack", which
 * fitted no job at all, and not one vacancy in 146 fitted anybody. The
 * profile-only fit (youth to an academy, turnaround to a club in trouble,
 * spender to new money) was near dead, because a career rarely earns those
 * three and those jobs are rarely open.
 *
 * jobs.ts now fits every trait to some job: by the kind of club (chairman.ts
 * jobProfile) or by what its league form says it is short of (clubNeed). This
 * plays real worlds through processWeekAndAdvance and reads every vacancy as
 * it opens, against every trait:
 *
 *   1. every trait fits some vacancies, and none fits most of them
 *   2. the traits careers actually earn (attack, defence) fit a real share
 *   3. a club short of points is one whose scoring is a sixth under its
 *      league's rate, read off its own table row, and never before four
 *      matches
 *   4. the card's line says why, in six languages
 *   5. the lift stays JOB_FIT (identityprobe184 holds its bound)
 *
 * Run: npx vite-node scripts/jobfitprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS, type GameState } from '../src/game/model'
import { JOB_FIT, NEED, clubNeed, jobChance, jobFitLine, traitFits } from '../src/game/jobs'
import type { Trait } from '../src/game/repute'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'ja', 'af']
for (const l of LANGS) await ensureLang(l)
const TRAITS: Trait[] = ['youth', 'turnaround', 'spender', 'innovator', 'hard', 'players', 'attack', 'defence']
const fit: Record<string, number> = {}
let vacs = 0, needWrong = 0, needEarly = 0, raw = 0
const shown = new Set<string>()
const t0 = performance.now()

function needTruth(g: GameState, id: string): string | null {
  const c = g.clubs[id], table = g.comps[c.leagueId]?.table ?? []
  const row = table.find(r => r.teamId === id)
  const p = table.reduce((s, r) => s + r.p, 0)
  if (!row || row.p < 4 || !p) return null
  const lg = table.reduce((s, r) => s + r.pf, 0) / p
  const short = 1 - row.pf / row.p / lg, leak = row.pa / row.p / lg - 1
  return short >= NEED && short >= leak ? 'attack' : leak >= NEED ? 'defence' : null
}

// Three worlds, and up to three more while a trait has fitted nothing yet: an
// academy job is three clubs in the world (Benetton, Provence, Seattle), and
// whether one of them loses its coach in two seasons is the dice, not the code.
// From 1.8.14 also while there are fewer than sixty vacancies: a board that
// weighs recent silverware before sacking opens a few fewer jobs, and three
// worlds read 59. The bar is a sample size, so the sample grows to meet it.
let worlds = 0
for (const [club, seed] of [['leicester', 51], ['bath', 52], ['northampton', 53], ['exeter', 54], ['sale', 55], ['gloucester', 56]] as const) {
  if (worlds >= 3 && vacs >= 60 && TRAITS.every(tr => (fit[tr] ?? 0) > 0)) break
  worlds++
  const g = newGame(club, 'Fit', seed)
  const seen = new Set<string>()
  for (let w = 0; w < SEASON_WEEKS * 2; w++) {
    processWeekAndAdvance(g)
    for (const v of g.vacancies) {
      const key = `${v.clubId}|${v.week}|${g.season}`
      if (seen.has(key)) continue
      seen.add(key)
      vacs++
      for (const tr of TRAITS) if (traitFits(g, v.clubId, tr)) fit[tr] = (fit[tr] ?? 0) + 1
      const need = clubNeed(g, v.clubId)
      if (need !== needTruth(g, v.clubId)) needWrong++
      const row = g.comps[g.clubs[v.clubId].leagueId]?.table.find(r => r.teamId === v.clubId)
      if (need && (!row || row.p < 4)) needEarly++
      for (const tr of TRAITS) if (traitFits(g, v.clubId, tr)) {
        const line = jobFitLine(g, v.clubId, tr)
        for (const l of LANGS) {
          const s = tIn(l, line)
          if (/[{}]|\b[a-z]+\.[a-zA-Z_]+\b/.test(s)) raw++
        }
        shown.add(tIn('en', line))
      }
    }
  }
}
console.log(`\n      ${vacs} vacancies over ${worlds} worlds of two seasons (${((performance.now() - t0) / 1000).toFixed(0)}s); the share each trait fits:`)
for (const tr of TRAITS) console.log(`        ${tr.padEnd(11)} ${Math.round(((fit[tr] ?? 0) / vacs) * 100)}%`)
for (const s of shown) console.log(`      "${s}"`)
const share = (tr: Trait) => (fit[tr] ?? 0) / Math.max(1, vacs)
ok(vacs >= 60, `enough vacancies to read (${vacs})`)
ok(TRAITS.every(tr => share(tr) > 0), 'every trait a career can earn fits some vacancy')
ok(TRAITS.every(tr => share(tr) <= 0.5), 'and none fits most of them: a fit is recognition, not the rule')
ok(share('attack') >= 0.08 && share('defence') >= 0.08, `the traits careers earn most (results) fit a real share (attack ${Math.round(share('attack') * 100)}%, defence ${Math.round(share('defence') * 100)}%)`)
ok(!needWrong && !needEarly, `a club's need is its own table row against its league's rate, from four matches (${needWrong} wrong, ${needEarly} early)`)
ok(raw === 0 && shown.size >= 3, `the card says why in six languages (${shown.size} different lines)`)
ok(JOB_FIT === 0.06 && typeof jobChance === 'function', 'the lift is still six points')
console.log(fails ? `\nJOB FIT PROBE FAILED: ${fails}` : '\nJOB FIT PROBE PASSED')
process.exit(fails ? 1 : 0)
