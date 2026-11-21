/**
 * ---- THE SEASON PLAN, MEASURED (1.9.16 audit) ----
 *
 * The Season plan card (preseasonplan.ts, PreseasonPlan.tsx) asks two
 * questions with three answers each. This probe says what each answer
 * writes, then plays the same club on the same seeds under every answer and
 * under no plan at all, on Continue (assistant's team sheet, board held off),
 * to the week after the club's 10th league match (or the whole season with
 * FULL=1), and measures the things each answer names.
 *
 * Every comparison is PAIRED by seed: the figure is the mean over seeds of
 * (option - comparison) and its standard error over seeds. An effect is
 * called distinguishable when |mean| > 2.2 standard errors (about 95% for
 * the seed counts used here). One changed setting moves every later random
 * draw of a career, so single seeds differ by a lot; only the mean over
 * seeds says anything.
 *
 * Run:  npx vite-node scripts/preseasonprobe.ts                 (8 seeds)
 *       SEEDS=1-24 npx vite-node scripts/preseasonprobe.ts
 *       SEEDS=1-12 OUT=/tmp/a.jsonl npx vite-node scripts/preseasonprobe.ts   (a shard: rows only)
 *       AGG=/tmp/a.jsonl,/tmp/b.jsonl npx vite-node scripts/preseasonprobe.ts (the table from shards)
 *       CLUB=bristol WORKS=fitness SEEDS=1-12 ...   (another club, the three ways of playing only)
 *       FULL=1 WORKS=fitness SEEDS=1-12 ...         (the whole league season)
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { FOCUS_OF, PLAN_STYLES, PLAN_WORKS, STYLE_OF, setPreseasonPlan, type PlanStyle, type PlanWork } from '../src/game/preseasonplan'
import { playbookOf, DEFAULT_LINEOUT, DEFAULT_SCRUM } from '../src/game/playbook'
import { callsOf, calledIds, drilledOf } from '../src/game/moves'
import { t } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

const CLUB = process.env.CLUB ?? 'leicester'
const FULL = !!process.env.FULL
const GAMES = Number(process.env.GAMES ?? 10)
const seedSpec = process.env.SEEDS ?? '1-8'
const SEEDS: number[] = seedSpec.includes('-')
  ? (() => { const [a, b] = seedSpec.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i) })()
  : seedSpec.split(',').map(Number)

type Cfg = { key: string; style: PlanStyle | null; work: PlanWork | null }
const CFGS: Cfg[] = [{ key: 'none', style: null, work: null }]
// WORKS=fitness (or STYLES=backs,forwards) narrows the grid, for a cheaper run at another club or over a whole season
const ONLY_W = process.env.WORKS?.split(',') as PlanWork[] | undefined
const ONLY_S = process.env.STYLES?.split(',') as PlanStyle[] | undefined
for (const s of PLAN_STYLES) for (const w of PLAN_WORKS) if ((!ONLY_W || ONLY_W.includes(w)) && (!ONLY_S || ONLY_S.includes(s))) CFGS.push({ key: `${s}+${w}`, style: s, work: w })

type Row = {
  seed: number; cfg: string; style: string; work: string
  cond1: number      // mean condition of the day-one seniors on the morning of the first league match
  condAvg: number    // the same, averaged over every week from then to the end of the run
  inj8: number       // injuries picked up by the squad in the first 8 weeks
  injAll: number     // and over the whole run
  injWeeks: number   // weeks lost to those injuries
  pts6: number       // league points after 6 league matches
  ptsN: number       // league points after GAMES league matches
  pd: number         // points difference over those matches
  pf: number; pa: number; tf: number; ta: number
  dSta: number       // attribute points gained by the day-one seniors: stamina (the Fitness session)
  dScr: number       // scrum + strength (the Set pieces session, FOCUS_ATTRS.scrum)
  dLin: number       // lineout
  dAtk: number       // handling + passing + vision (the Attack session)
  dAll: number       // all eighteen attributes
  drillSP: number    // how well drilled the called lineout and scrum routines are (0-100)
  drillMv: number    // how well drilled the called attacking moves are (0-100)
  late: number       // points difference scored in ... not tracked by the engine's fixture record; kept 0
  weeks: number
}

const seniorsOf = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
const sum = (p: Player, ks: (keyof Player['a'])[]) => ks.reduce((s, k) => s + p.a[k], 0)

function runOne(seed: number, cfg: Cfg): Row {
  const g = newGame(CLUB, 'Probe', seed)
  g.boardGrace = 999_999
  const uid = g.userClubId
  const club = g.clubs[uid]
  if (cfg.style && cfg.work) setPreseasonPlan(g, cfg.style, cfg.work)
  const day1 = seniorsOf(g)
  const a0 = new Map(day1.map(p => [p.id, { ...p.a }]))
  const league = club.leagueId
  const mine = () => g.fixtures.filter(f => f.compId === league && (f.homeId === uid || f.awayId === uid)).sort((a, b) => a.week - b.week)
  const firstWk = mine()[0].week
  const s0 = g.season
  const hurt = new Set<number>()
  let inj8 = 0, injAll = 0, injWeeks = 0
  let cond1 = NaN
  const conds: number[] = []
  let guard = 0
  const playedN = () => mine().filter(f => f.played).length
  // the league table's own row for the club (the engine's points and bonus rules), snapped after 6 and after GAMES
  type Snap = { pts: number; pf: number; pa: number; tf: number; ta: number }
  const rowNow = (): Snap => { const r = g.comps[league].table.find(x => x.teamId === uid)!; return { pts: r.pts, pf: r.pf, pa: r.pa, tf: r.tf, ta: r.ta } }
  let snap6: Snap | null = null, snapN: Snap | null = null
  const lastLeagueWk = Math.max(...mine().map(f => f.week))
  while (g.season === s0 && guard++ < 60 && (FULL ? g.week <= lastLeagueWk : playedN() < GAMES)) {
    if (g.week >= firstWk) {
      const c = mean(day1.filter(p => p.clubId === uid && !p.injury).map(p => p.cond))
      if (g.week === firstWk) cond1 = c
      conds.push(c)
    }
    const wk = g.week
    processWeekAndAdvance(g)
    for (const id of club.players) {
      const p = g.players[id]
      if (!p || p.acad) continue
      if (p.injury && !hurt.has(id)) {
        hurt.add(id); injAll++
        if (wk <= 8) inj8++
        injWeeks += p.injury.weeks ?? Math.max(1, p.injury.until - wk)
      } else if (!p.injury) hurt.delete(id)
    }
    if (g.season === s0) {
      if (!snap6 && playedN() >= 6) snap6 = rowNow()
      if (FULL ? playedN() >= mine().length : playedN() >= GAMES) snapN ??= rowNow()
    }
  }
  const rN = snapN ?? rowNow()
  const r6 = snap6 ?? rN
  const still = day1.filter(p => g.players[p.id])
  const d = (ks: (keyof Player['a'])[]) => still.reduce((s, p) => s + sum(p, ks) - ks.reduce((x, k) => x + a0.get(p.id)![k], 0), 0)
  const allKeys = Object.keys(day1[0].a) as (keyof Player['a'])[]
  const pb = playbookOf(club)
  const sp = [club.tactic.lineoutCall ?? DEFAULT_LINEOUT, club.tactic.scrumCall ?? DEFAULT_SCRUM].map(id => pb.drilled[id] ?? 30)
  const mv = calledIds(callsOf(g, club)).map(id => drilledOf(g, club, id))
  return {
    seed, cfg: cfg.key, style: cfg.style ?? 'none', work: cfg.work ?? 'none',
    cond1, condAvg: mean(conds), inj8, injAll, injWeeks,
    pts6: r6.pts, ptsN: rN.pts, pd: rN.pf - rN.pa, pf: rN.pf, pa: rN.pa, tf: rN.tf, ta: rN.ta,
    dSta: d(['sta']), dScr: d(['scr', 'str']), dLin: d(['lin']), dAtk: d(['han', 'pas', 'vis']), dAll: d(allKeys),
    drillSP: mean(sp), drillMv: mean(mv), late: 0, weeks: guard,
  }
}

// ------------------------------------------------------------------ what it writes
function describe() {
  console.log(`THE SEASON PLAN: what each answer writes  (${CLUB})`)
  console.log(`card: "${t('preplan.title')}" / "${t('preplan.sub')}"`)
  const g0 = newGame(CLUB, 'Probe', SEEDS[0])
  const t0 = g0.clubs[g0.userClubId].tactic
  console.log(`no plan: attack ${t0.atkStyle ?? '(read off dials)'}, defence ${t0.defStyle ?? '(read off dials)'}, training "${g0.training}", match prep ${g0.matchPrep ?? 'none'}`)
  console.log(`\n"${t('preplan.how')}"`)
  for (const s of PLAN_STYLES) {
    const g = newGame(CLUB, 'Probe', SEEDS[0]); setPreseasonPlan(g, s, 'fitness')
    const tc = g.clubs[g.userClubId].tactic
    console.log(`  ${t(`preplan.s_${s}`)} - "${t(`preplan.s_${s}Desc`)}": attack style ${STYLE_OF[s].atk}, defence style ${STYLE_OF[s].def}; dials style ${tc.style} tempo ${tc.tempo} kicking ${tc.kicking} ruckCommit ${tc.ruckCommit} kickStyle ${tc.kickStyle} defLine ${tc.defLine} defWidth ${tc.defWidth} ruckContest ${tc.ruckContest}`)
  }
  console.log(`\n"${t('preplan.work')}"`)
  for (const w of PLAN_WORKS) {
    const g = newGame(CLUB, 'Probe', SEEDS[0]); setPreseasonPlan(g, 'balanced', w)
    console.log(`  ${t(`preplan.w_${w}`)} - "${t(`preplan.w_${w}Desc`)}": training focus "${g.training}" (FOCUS_OF.${w}=${FOCUS_OF[w]}), weekly match prep ${g.matchPrep ?? 'left as it was (none)'}`)
  }
  // does a plan end with pre-season?
  {
    const g = newGame(CLUB, 'Probe', SEEDS[0]); g.boardGrace = 999_999
    setPreseasonPlan(g, 'forwards', 'setpiece')
    for (let i = 0; i < 12; i++) processWeekAndAdvance(g)
    console.log(`\n12 weeks later (week ${g.week}) the "pre-season work" is still the setting: training "${g.training}", match prep ${g.matchPrep ?? 'none'}, attack ${g.clubs[g.userClubId].tactic.atkStyle}`)
  }
  // identical to setting it by hand?
  {
    const a = newGame(CLUB, 'Probe', SEEDS[0]); setPreseasonPlan(a, 'balanced', 'attack')
    const b = newGame(CLUB, 'Probe', SEEDS[0]); setPreseasonPlan(b, 'balanced', 'fitness')
    console.log(`after choosing Attack: match prep ${a.matchPrep ?? 'none'} (an "Attack" match-prep week is what drills the called moves 2.2x faster, moves.ts drillMovesWeek; the plan does not set it)`)
    console.log(`after choosing Fitness: match prep ${b.matchPrep ?? 'none'} (a "Fitness" match-prep week is what adds recovery and cuts match-day drain, condition.ts / match/setup.ts; the plan does not set it)`)
  }
}

// ------------------------------------------------------------------ the table
const METRICS: [keyof Row, string, number][] = [
  ['cond1', 'condition, first league match (%)', 1],
  ['condAvg', 'condition, weekly mean (%)', 1],
  ['inj8', 'injuries, first 8 weeks', 2],
  ['injAll', 'injuries, whole run', 2],
  ['injWeeks', 'weeks lost to injury', 1],
  ['pts6', 'league points after 6', 2],
  ['ptsN', `league points after ${FULL ? 'the season' : GAMES}`, 2],
  ['pd', 'points difference', 1],
  ['tf', 'tries for', 2],
  ['ta', 'tries against', 2],
  ['dSta', 'stamina points gained (squad)', 2],
  ['dScr', 'scrum+strength points gained', 2],
  ['dLin', 'lineout points gained', 2],
  ['dAtk', 'handling+passing+vision gained', 2],
  ['dAll', 'all attribute points gained', 1],
  ['drillSP', 'called set pieces drilled (0-100)', 1],
  ['drillMv', 'called moves drilled (0-100)', 1],
]

function paired(rows: Row[], pick: (r: Row) => boolean, base: (r: Row) => boolean, metric: keyof Row) {
  const seeds = [...new Set(rows.map(r => r.seed))]
  const diffs: number[] = []
  for (const s of seeds) {
    const a = rows.filter(r => r.seed === s && pick(r)).map(r => r[metric] as number)
    const b = rows.filter(r => r.seed === s && base(r)).map(r => r[metric] as number)
    if (a.length && b.length) diffs.push(mean(a) - mean(b))
  }
  const mu = mean(diffs)
  const sd = Math.sqrt(diffs.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, diffs.length - 1))
  const se = sd / Math.sqrt(Math.max(1, diffs.length))
  return { mu, se, n: diffs.length, sig: diffs.length >= 4 && (se > 0 ? Math.abs(mu) > 2.2 * se : mu !== 0) }
}
const fmt = (x: { mu: number; se: number; sig: boolean }, dp: number) => `${x.mu >= 0 ? '+' : ''}${x.mu.toFixed(dp)}±${x.se.toFixed(dp)}${x.sig ? '*' : ' '}`

function table(rows: Row[]) {
  const seeds = [...new Set(rows.map(r => r.seed))]
  console.log(`\n=== MEASURED: ${CLUB}, ${seeds.length} seeds (${Math.min(...seeds)}-${Math.max(...seeds)}), ${FULL ? 'whole season' : `to the ${GAMES}th league match`}, ${rows.length} careers ===`)
  const none = rows.filter(r => r.cfg === 'none')
  console.log(`no plan, mean over seeds: ${METRICS.map(([k, label, dp]) => `${label} ${mean(none.map(r => r[k] as number)).toFixed(dp)}`).join('; ')}`)
  const isNone = (r: Row) => r.cfg === 'none'
  const groups: [string, string, (r: Row) => boolean][] = [
    ...PLAN_WORKS.map(w => [`work: ${t(`preplan.w_${w}`)}`, t(`preplan.w_${w}Desc`), (r: Row) => r.work === w] as [string, string, (r: Row) => boolean]),
    ...PLAN_STYLES.map(s => [`play: ${t(`preplan.s_${s}`)}`, t(`preplan.s_${s}Desc`), (r: Row) => r.style === s] as [string, string, (r: Row) => boolean]),
  ]
  console.log('\nEach cell: mean paired difference against NO PLAN ± standard error; * = distinguishable from seed noise (|mean| > 2.2 SE).')
  console.log('A "work" row averages the three ways of playing; a "play" row averages the three kinds of work.\n')
  const head = ['option', 'claim', ...METRICS.map(m => m[1])]
  console.log(head.join(' | '))
  for (const [name, claim, pick] of groups) {
    console.log([name, `"${claim}"`, ...METRICS.map(([k, , dp]) => fmt(paired(rows, pick, isNone, k), dp))].join(' | '))
  }
  // between the options themselves
  console.log('\nOption against option (paired by seed):')
  const pairs: [string, (r: Row) => boolean, (r: Row) => boolean][] = [
    ['Fitness - Attack', r => r.work === 'fitness', r => r.work === 'attack'],
    ['Set pieces - Fitness', r => r.work === 'setpiece', r => r.work === 'fitness'],
    ['Set pieces - Attack', r => r.work === 'setpiece', r => r.work === 'attack'],
    ['Forwards - Balanced', r => r.style === 'forwards', r => r.style === 'balanced'],
    ['Backs - Balanced', r => r.style === 'backs', r => r.style === 'balanced'],
    ['Forwards - Backs', r => r.style === 'forwards', r => r.style === 'backs'],
  ]
  for (const [name, a, b] of pairs) {
    console.log(`  ${name}: ${METRICS.filter(m => ['cond1', 'condAvg', 'injAll', 'pts6', 'ptsN', 'pd', 'tf', 'ta', 'dAll', 'drillSP', 'drillMv'].includes(m[0])).map(([k, label, dp]) => `${label} ${fmt(paired(rows, a, b, k), dp)}`).join('; ')}`)
  }
  // the nine cards, by league points
  console.log('\nThe nine combinations, league points and points difference against no plan:')
  for (const c of CFGS.slice(1)) {
    const p = paired(rows, r => r.cfg === c.key, isNone, 'ptsN'), d = paired(rows, r => r.cfg === c.key, isNone, 'pd')
    console.log(`  ${c.key.padEnd(18)} points ${fmt(p, 2)}  points difference ${fmt(d, 1)}`)
  }
  // the noise floor, for scale
  const sdOf = (k: keyof Row) => { const xs = none.map(r => r[k] as number); const mu = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, xs.length - 1)) }
  console.log(`\nSeed noise, for scale (standard deviation across seeds with no plan): league points ${sdOf('ptsN').toFixed(1)}, points difference ${sdOf('pd').toFixed(0)}, injuries ${sdOf('injAll').toFixed(1)}, condition ${sdOf('condAvg').toFixed(1)}`)
}

// ------------------------------------------------------------------ main
if (process.env.AGG) {
  const rows = process.env.AGG.split(',').flatMap(f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Row))
  describe()
  table(rows)
} else {
  const rows: Row[] = []
  if (!process.env.OUT) describe()
  const t0 = Date.now()
  for (const seed of SEEDS) {
    for (const cfg of CFGS) {
      const r = runOne(seed, cfg)
      rows.push(r)
      if (process.env.OUT) appendFileSync(process.env.OUT, JSON.stringify(r) + '\n')
    }
    console.error(`seed ${seed} done (${Math.round((Date.now() - t0) / 1000)}s)`)
  }
  if (!process.env.OUT) table(rows)
}
