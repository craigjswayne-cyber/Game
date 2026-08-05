// 20-season long-save health audit: ledger growth, save size, world integrity
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { requestExpansion, requestFacility } from '../src/game/season'
import { appointStaff, sendToCourse, staffCandidates, staffInterest, type StaffRole } from '../src/game/staff'
import { commissionScout } from '../src/game/commission'
import { signOnTerms, askingPrice, personalTermsDemand, capBill } from '../src/game/ai'
import { loanOut } from '../src/game/loans'
import { agreePreContract } from '../src/game/ai'
import { analystRead } from '../src/game/analyst'
import type { FacilityId } from '../src/game/model'
import { SEASON_WEEKS, XV_SLOTS } from '../src/game/model'

const g = newGame('leicester', 'Soak Gaffer', 20260804)

function report(label: string) {
  const size = JSON.stringify(g).length
  const players = Object.values(g.players)
  const careerRows = players.reduce((s, p) => s + p.career.length, 0)
  const squads = Object.values(g.clubs).map(c => c.players.length).sort((a, b) => a - b)
  const squadLine = `squads med ${squads[Math.floor(squads.length / 2)]} max ${squads[squads.length - 1]}`
  console.log([
    label,
    `save ${(size / 1e6).toFixed(2)}MB`,
    `players ${players.length}`,
    `news ${g.news.length}`,
    `press ${g.press.length}`,
    `offers ${g.offers.length}`,
    `chem ${Object.keys(g.chem ?? {}).length}`,
    `grudges ${(g.grudges ?? []).length}`,
    `pledges ${(g.pledges ?? []).length}`,
    `preC ${(g.preContracts ?? []).length}`,
    `agencyBest ${Object.keys(g.agency?.best ?? {}).length}`,
    `hof ${(g.hof ?? []).length}`,
    `careerRows ${careerRows}`,
    `fixtures ${g.fixtures.length}`,
    squadLine,
  ].join(' | '))
}

report('start')
// economy watch: fee inflation + balance drift over the decades
const feeBuckets: number[][] = [[], [], [], []]
const parseFee = (body: string): number | null => {
  const m = body.match(/for a fee of £([\d.]+)(m|k)/)
  return m ? parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : 1e3) : null
}
function econReport(label: string) {
  const ai = Object.values(g.clubs).filter(c => c.id !== g.userClubId)
  const bals = ai.map(c => c.balance).sort((a, b) => a - b)
  const med = bals[Math.floor(bals.length / 2)]
  const budget = ai.reduce((s, c) => s + c.budget, 0) / ai.length
  const mine = g.clubs[g.userClubId]
  console.log(`${label} econ | user bal ${(mine.balance / 1e6).toFixed(1)}M | AI bal min ${(bals[0] / 1e6).toFixed(1)}M med ${(med / 1e6).toFixed(1)}M max ${(bals[bals.length - 1] / 1e6).toFixed(1)}M | AI budget avg ${(budget / 1e6).toFixed(1)}M`)
}
// treatment room + disciplinary ledger, tallied per season
let prevInjured = new Set<number>()
let newSpells = 0, spellWeeks = 0
const medBuckets: { yc: number; rc: number; matches: number; spells: number; avgWks: number }[] = []
let farewells = 0, milestoneNews = 0, totsAwards = 0
let signings = 0, loansOut = 0, preCs = 0
let retireNews = 0, loanWatch = 0, armbands = 0, debutNews = 0, lionsNews = 0, lionsHomecomings = 0, wcChampBeats = 0
let taps = 0, brokenVows = 0, courtPressers = 0
let hearings = 0, appealsWon = 0, appealsLost = 0, campBeats = 0, employedW1 = 0
// the systems added in the 8-batch: facilities, staff courses, commissions, the analyst
let facApproved = 0, facDenied = 0, facOpened = 0, standsBuilt = 0
let coursesSat = 0, coursesPassed = 0, coursesFailed = 0, staffHires = 0
let briefsSent = 0, reportsFiled = 0, analystFollowed = 0
// news pressure: how many items land in the inbox per week (EA v2, permanent)
const weeklyNews: number[] = []
// selection quality: starters wearing a shirt they cannot naturally cover.
// Nonzero is fine in an injury crisis; a high rate means autoSelect regressed
let oopStarts = 0, startSamples = 0
// forced-sub quality: injury replacements should be like-for-like when
// cover exists (EI). Judged by position class of the departing man
let injSubs = 0, likeForLike = 0
const CLASS: Record<string, string[]> = {
  LP: ['LP', 'TP'], TP: ['TP', 'LP'], HK: ['HK'], LK: ['LK', 'FL'],
  FL: ['FL', 'N8', 'LK'], N8: ['N8', 'FL'], SH: ['SH'], FH: ['FH', 'CE'],
  CE: ['CE', 'FH', 'WG'], WG: ['WG', 'FB', 'CE'], FB: ['FB', 'WG'],
}
const wcSeedTops: string[] = []
const milestoneSubjects = new Map<string, number>()
const seen = new Set<number>()
// prose quality (the FH tripwire, deep edition): the beats that only fire in
// a long save - era obituaries, testimonials, farewell tours, POTY nights,
// takeovers - must never leak internals or break house style
let proseHits = 0
const proseSeenPress = new Set<number>()
const prose = (where: string, text: string | undefined | null) => {
  if (!text) return
  const flag = (why: string) => {
    proseHits++
    if (proseHits <= 20) console.log(`WARN: prose ${why} in ${where}: ${text.replace(/\n/g, ' ').slice(0, 80)}`)
  }
  if (/\bundefined\b/.test(text)) flag('"undefined"')
  if (/\bNaN\b/.test(text)) flag('NaN')
  if (text.includes('[object Object]')) flag('raw object')
  if (text.includes('${')) flag('unrendered template')
  if (text.includes('—')) flag('em dash')
  if (/–/.test(text.replace(/[\d%]\s?–\s?\d/g, ''))) flag('en dash outside scoreline')
  if (/ {2}/.test(text)) flag('double space')
}
for (let season = 0; season < 20; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    if (g.week === 1 && !g.unemployed) employedW1++
    if (!g.unemployed) {
      // a manager who uses everything the game gives him
      if (g.week % 6 === 0) {
        const fids: FacilityId[] = ['pitch', 'gym', 'recovery', 'paddock', 'kicking', 'briefing', 'academy', 'shop']
        requestFacility(g, fids[Math.floor(g.week / 6) % fids.length])
      }
      if (g.week % 9 === 0) requestExpansion(g)
      const roles: StaffRole[] = ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach']
      const role = roles[g.week % roles.length]
      if (g.week % 4 === 0) sendToCourse(g, role)
      if (g.week % 13 === 0) {
        const cands = staffCandidates(g, role)
        const i = cands.findIndex(c => staffInterest(g, c) !== 'no')
        if (i >= 0) appointStaff(g, role, i)
      }
      if (g.week % 15 === 0) commissionScout(g, 'any', ([3, 6, 9] as const)[Math.floor(g.week / 15) % 3])
      // The audit found four systems with no long-horizon coverage at all,
      // because this scripted manager never traded: loan watch and debut
      // headlines both read 0 over twenty seasons for features that work. A
      // manager who uses everything has to buy, promise, borrow and lend.
      if (g.week === 5 || g.week === 26) {
        // a signing with a first-team promise, which also exercises pledges
        // The wage has to clear what his camp actually opens at, not a markup on
        // his current deal - a good player at another club always wants a rise,
        // and the first cut of this probe signed nobody in forty windows
        // because it offered him 10% more than he was already on.
        const user = g.clubs[g.userClubId]
        const room = user.wageBudget - capBill(g, user)
        const buy = Object.values(g.players)
          .filter(p => p.clubId && p.clubId !== g.userClubId && p.ca >= 72 && p.age <= 28 &&
            askingPrice(g, p) <= user.budget && personalTermsDemand(g, p) <= room)
          .sort((a, b) => b.ca - a.ca)[0]
        if (buy) {
          const r = signOnTerms(g, buy.id, askingPrice(g, buy), personalTermsDemand(g, buy), 0, true)
          if (r.ok) signings++
        }
      }
      if (g.week === 8) {
        // lend a fringe youngster out: fires the loan-watch postcard
        const kid = g.clubs[g.userClubId].players
          .map(id => g.players[id])
          .find(p => p && p.age <= 22 && !p.onLoan && !p.acad &&
            !g.clubs[g.userClubId].tactic.lineup.slice(0, 15).includes(p.id))
        if (kid && loanOut(g, kid.id).ok) loansOut++
      }
      if (g.week === 30) {
        // a free transfer for next summer
        const free = Object.values(g.players)
          .filter(p => p.clubId && p.clubId !== g.userClubId && p.contractEnds <= g.season && p.ca >= 68)
          .sort((a, b) => b.ca - a.ca)[0]
        if (free && agreePreContract(g, free.id).ok) preCs++
      }
      const fxNow = userFixtureThisWeek(g)
      if (fxNow && g.week % 2 === 0) {
        const oppId = fxNow.homeId === g.userClubId ? fxNow.awayId : fxNow.homeId
        const read = analystRead(g, oppId)
        if (read) { g.matchPrep = read.prep; analystFollowed++ }
      }
    }
    const fx = userFixtureThisWeek(g)
    if (fx) {
      simMatch(g, fx, weekRng(g), true)
      for (const e of fx.events ?? []) prose(`match event s${g.season}w${g.week}`, e.text)
      const evs = fx.events ?? []
      for (let i = 0; i < evs.length - 1; i++) {
        const e = evs[i]
        if (e.type !== 'INJ' || !e.text.includes('is down') || e.playerId == null) continue
        const next = evs.slice(i + 1, i + 3).find(x => x.text.includes('comes on in his place'))
        if (!next || next.playerId == null) continue
        const out = g.players[e.playerId], sub = g.players[next.playerId]
        if (!out || !sub) continue
        injSubs++
        if (sub.pos === out.pos || sub.alt.includes(out.pos) || (CLASS[out.pos]?.includes(sub.pos) ?? false)) likeForLike++
      }
      const t = g.clubs[g.userClubId].tactic
      const xv = new Set(t.lineup.slice(0, 15).filter((x): x is number => x != null))
      const avail = g.clubs[g.userClubId].players
        .map(id => g.players[id])
        .filter(p => p && !p.injury && p.bans === 0 && !p.natSquad && !p.onLoan)
      for (let i = 0; i < 15; i++) {
        const id = t.lineup[i]
        const p = id != null ? g.players[id] : null
        if (!p) continue
        startSamples++
        const pos = XV_SLOTS[i].pos
        if (p.pos !== pos && !p.alt.includes(pos)) {
          // only a misallocation if a natural fit sat unused - shoehorning
          // through a genuine positional hole is the right call
          const naturalBench = avail.some(c => !xv.has(c.id) && (c.pos === pos || c.alt.includes(pos)) && !c.acad)
          if (naturalBench) oopStarts++
        }
      }
    }
    for (const pi of g.press) {
      // match on the vow option, not the question text - FI gave the
      // courtship question three voicings and the label is the stable part
      if (!pi.answered && pi.options.some(o => o.label.includes('I am going nowhere'))) courtPressers++
      if (!pi.answered && pi.options.some(o => o.appeal)) hearings++
      if (!proseSeenPress.has(pi.id)) {
        proseSeenPress.add(pi.id)
        prose(`press s${g.season}w${g.week}`, pi.question)
        for (const o of pi.options) { prose('press option', o.label); prose('press reaction', o.reaction) }
      }
    }
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, Math.floor(Math.random() * 0) )
    let newThisWeek = 0
    for (const n of g.news) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      newThisWeek++
      prose(`news s${g.season}w${g.week}`, n.subject)
      prose(`news body s${g.season}w${g.week}`, n.body)
      if (n.subject.includes('The last dance')) farewells++
      if (n.subject.includes('Try of the Season')) totsAwards++
      if (n.subject.includes('Signing off') || n.subject.includes('tells you first')) retireNews++
      if (n.subject.includes('Loan watch')) loanWatch++
      if (n.subject.includes('armband')) armbands++
      if (n.subject.includes('Dream debut') || n.subject.includes('grandkids')) debutNews++
      if (n.subject.includes('LIONS:')) lionsNews++
      if (n.subject.includes('Lions come home')) lionsHomecomings++
      if (n.subject.includes('World champion') && n.subject.includes('building')) wcChampBeats++
      if (n.subject.includes('are watching you')) taps++
      if (n.subject.startsWith('🏛 Board approves')) facApproved++
      if (n.subject.startsWith('🏛 Board says no')) facDenied++
      if (n.subject.startsWith('🏗') && n.subject.includes('opens')) facOpened++
      if (n.subject.includes('grows by') && n.subject.includes('seats')) standsBuilt++
      if (n.subject.includes('sits his')) coursesSat++
      if (n.subject.includes('passes his')) coursesPassed++
      if (n.subject.includes('falls short of his')) coursesFailed++
      if (n.subject.includes('appointed') && n.subject.includes('Coach')) staffHires++
      if (n.subject.includes('sent out on a')) briefsSent++
      if (n.subject.includes('files his report')) reportsFiled++
      if (n.subject.includes('aged badly')) brokenVows++
      if (n.subject.includes('Appeal upheld')) appealsWon++
      if (n.subject.includes('Appeal dismissed')) appealsLost++
      if (n.subject.includes('Camp report') || n.subject.includes('Community week:') || n.subject.includes('Exhibition tour')) campBeats++
      {
        const fee = parseFee(n.body)
        if (fee != null) feeBuckets[Math.min(3, Math.floor(season / 5))].push(fee)
      }
      if (n.subject.includes('Career win number') || n.subject.includes('in the dugout')) {
        milestoneNews++
        milestoneSubjects.set(n.subject, (milestoneSubjects.get(n.subject) ?? 0) + 1)
      }
    }
    weeklyNews.push(newThisWeek)
    // capture the season's medical/disciplinary totals before rollover wipes stats
    if (g.week === SEASON_WEEKS) {
      const ps = Object.values(g.players)
      const yc = ps.reduce((s, p) => s + p.stats.yc, 0)
      const rc = ps.reduce((s, p) => s + p.stats.rc, 0)
      const matches = g.fixtures.filter(f => f.played).length
      medBuckets.push({ yc, rc, matches, spells: newSpells, avgWks: newSpells ? spellWeeks / newSpells : 0 })
      newSpells = 0; spellWeeks = 0
      prevInjured = new Set()
    }
    processWeekAndAdvance(g)
    for (const p of Object.values(g.players)) {
      if (p.injury && !prevInjured.has(p.id)) { newSpells++; spellWeeks += p.injury.weeks }
    }
    prevInjured = new Set(Object.values(g.players).filter(p => p.injury).map(p => p.id))
  }
  const wc = g.comps['wc']
  if (wc?.seeds?.length) wcSeedTops.push(wc.seeds[0])
  if ((season + 1) % 5 === 0) { report(`s${season + 1}`); econReport(`s${season + 1}`) }
}
// fee inflation: median deal per 5-season era should stay the same order
{
  const med = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0
  console.log(`transfer fees by era: ${feeBuckets.map((b, i) => `s${i * 5 + 1}-${i * 5 + 5}: n${b.length} med ${(med(b) / 1e6).toFixed(2)}M`).join(' | ')}`)
  const first = med(feeBuckets[0]), last = med(feeBuckets[3])
  if (first > 0 && last > first * 3) console.log('WARN: fee inflation over 3x across the save')
}
// treatment room + discipline: rates should hold steady across the save
{
  const clubs = Object.keys(g.clubs).length
  const line = (b: (typeof medBuckets)[number]) =>
    `YC/match ${(b.yc / Math.max(1, b.matches)).toFixed(2)} RC/match ${(b.rc / Math.max(1, b.matches)).toFixed(3)} spells/club ${(b.spells / clubs).toFixed(1)} avg ${(b.avgWks).toFixed(1)}wk`
  const first5 = medBuckets.slice(0, 5), last5 = medBuckets.slice(-5)
  const agg = (bs: typeof medBuckets) => bs.reduce((a, b) => ({ yc: a.yc + b.yc, rc: a.rc + b.rc, matches: a.matches + b.matches, spells: a.spells + b.spells, avgWks: a.avgWks + b.avgWks / bs.length }), { yc: 0, rc: 0, matches: 0, spells: 0, avgWks: 0 })
  console.log(`discipline+medical s1-5:  ${line(agg(first5))}`)
  console.log(`discipline+medical s16-20: ${line(agg(last5))}`)
  const f = agg(first5), l = agg(last5)
  if (f.yc && Math.abs(l.yc / l.matches - f.yc / f.matches) > 0.5 * (f.yc / f.matches)) console.log('WARN: card rate drifted >50% across the save')
  if (f.spells && Math.abs(l.spells - f.spells) > 0.5 * f.spells) console.log('WARN: injury rate drifted >50% across the save')
}
// career trajectory: a passively-managed big club should stay competitive,
// not spiral through relegation cycles - engine-fairness check
{
  const traj = (g.annals ?? []).map(a => a.league.pos)
  const relegations = (g.annals ?? []).filter(a => a.league.name.includes('Championship')).length
  console.log(`career trajectory (league pos by season): ${traj.join(' ') || 'none'} · seasons in tier 2: ${relegations}/${(g.annals ?? []).length}`)
  // observed spread across butterflied worlds: 3-10 tier-2 seasons out of
  // 10-16 for a do-nothing manager - honest neglect, not unfairness. Only a
  // true death spiral (70%+ of the whole career below) should trip
  if ((g.annals ?? []).length >= 8 && relegations > (g.annals ?? []).length * 0.7) console.log('WARN: passive big club spends most of its life relegated')
}
// natrank long-horizon: watch for Elo compression or bound-pinning
{
  const vals = Object.values(g.natRank ?? {})
  const min = Math.min(...vals), max = Math.max(...vals)
  const pinned = vals.filter(v => v <= 40.5 || v >= 99.5).length
  console.log(`natrank after 20 seasons: min ${min.toFixed(1)} max ${max.toFixed(1)} spread ${(max - min).toFixed(1)} pinned-at-bounds ${pinned}`)
}
console.log(`farewell arcs: ${farewells} · manager milestone news: ${milestoneNews} (dupes: ${[...milestoneSubjects.values()].filter(v => v > 1).length}) · try of the season awards: ${totsAwards}`)
if (totsAwards < 10) console.log('WARN: try of the season fired under 10 times in 20 seasons')
console.log(`trading exercised: ${signings} signings with a promise · ${loansOut} loans out · ${preCs} pre-contracts`)
console.log(`e-round beats over 20 seasons: retirement news ${retireNews} · loan watch ${loanWatch} · armband handovers ${armbands} · debut headlines ${debutNews} · lions call-ups ${lionsNews} · homecomings ${lionsHomecomings} · WC winners in squad ${wcChampBeats}`)
if (lionsHomecomings > lionsNews) console.log('WARN: Lions homecoming without a call-up')
if (lionsNews === 0) console.log('WARN: no Lions call-up news in 20 seasons (5 tours)')
console.log(`courtship arc: taps ${taps} · pressers ${courtPressers} · broken vows ${brokenVows}`)
console.log(`disciplinary hearings: ${hearings} · appeals won ${appealsWon} · lost ${appealsLost} · pre-season decisions ${campBeats}/${employedW1} employed week-1s`)
if (campBeats < employedW1) console.log('WARN: pre-season decision missing in a season where the manager was employed')

// the 8-batch systems over a full career
console.log(`\nfacilities: ${facApproved} approved, ${facDenied} declined, ${facOpened} opened, ${standsBuilt} new stands`)
console.log(`staff: ${staffHires} appointments, ${coursesSat} courses sat, ${coursesPassed} passed, ${coursesFailed} failed`)
console.log(`scouting: ${briefsSent} briefs sent, ${reportsFiled} reports filed`)
console.log(`analyst: ${analystFollowed} reads followed, record ${g.analystRecord?.right ?? 0} right / ${g.analystRecord?.wrong ?? 0} wrong`)
const estate = Object.values(g.clubs[g.userClubId]?.facilities ?? {}).reduce((a, b) => a + b, 0)
console.log(`estate at the end: ${estate}/40, ground ${g.clubs[g.userClubId]?.capacity.toLocaleString()}`)
if (facOpened === 0) console.log('WARN: no facility ever finished building in 20 seasons')
if (facApproved > 0 && facOpened < facApproved - 1) console.log(`WARN: ${facApproved} builds approved but only ${facOpened} opened`)
if (coursesSat === 0) console.log('WARN: no coach ever sat a course')
if (coursesSat > 8 && coursesPassed === 0) console.log('WARN: every coaching course failed')
if (coursesSat > 8 && coursesFailed === 0) console.log('WARN: every coaching course passed - the 58% gate is not biting')
if (coursesSat !== coursesPassed + coursesFailed) console.log(`WARN: ${coursesSat} courses sat but ${coursesPassed + coursesFailed} verdicts`)
if (briefsSent === 0) console.log('WARN: no scouting brief was ever commissioned')
if (briefsSent > 2 && reportsFiled === 0) console.log('WARN: briefs sent but no report ever came back')
if (analystFollowed > 20) {
  const rec = g.analystRecord ?? { right: 0, wrong: 0 }
  if (rec.right + rec.wrong === 0) console.log('WARN: reads followed but the analyst has no record')
  if (rec.wrong === 0) console.log('WARN: the analyst was never wrong across a whole career')
}
if (estate > 40) console.log(`WARN: estate above the cap: ${estate}`)
{
  const sorted = [...weeklyNews].sort((a, b) => a - b)
  const mean = weeklyNews.reduce((s, x) => s + x, 0) / Math.max(1, weeklyNews.length)
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
  const max = sorted[sorted.length - 1] ?? 0
  console.log(`news pressure: mean ${mean.toFixed(1)}/wk · p95 ${p95} · max ${max}`)
  if (mean > 10) console.log('WARN: inbox spam - mean news volume over 10 items a week')
  if (p95 > 22) console.log('WARN: inbox spike weeks - p95 news volume over 22')
}
if (appealsWon + appealsLost > hearings) console.log('WARN: appeal verdicts without a hearing')
if (courtPressers > taps) console.log('WARN: courtship presser fired without a tap')
if (brokenVows > 0) console.log('WARN: broken-vow story in a save where the manager never moved')
{
  const rate = startSamples ? (oopStarts / startSamples) * 100 : 0
  console.log(`selection quality: ${oopStarts}/${startSamples} out-of-position starts (${rate.toFixed(1)}%)`)
  if (rate > 5) console.log('WARN: autoSelect regressing - too many out-of-position starters')
  const lfl = injSubs ? (likeForLike / injSubs) * 100 : 100
  console.log(`forced-sub quality: ${likeForLike}/${injSubs} like-for-like (${lfl.toFixed(0)}%)`)
  // 60, not 40. The guard is called like-for-like and it was letting through a
  // rate where one forced sub in three put a man in the wrong shirt. Measured
  // range across audits: 65 to 71 percent, so 60 is a real floor rather than a
  // formality, and it fires before the behaviour has visibly rotted.
  if (injSubs >= 20 && lfl < 60) console.log(`WARN: injury subs regressing at ${lfl.toFixed(0)}% like-for-like - pickBenchSub not respecting the shirt`)
}
{
  const stale = Object.values(g.players).filter(p => p.debutPending && p.stats.apps > 0).length
  const youngRetiring = Object.values(g.players).filter(p => p.retiring && p.age < 37).length
  if (stale) console.log(`WARN: ${stale} stale debutPending flags on played players`)
  if (youngRetiring) console.log(`WARN: ${youngRetiring} retiring flags under age 37`)
}
console.log(`WC top seeds by cycle: ${wcSeedTops.join(', ') || 'none observed'}`)
// D-round ledgers: bounded and coherent after 20 seasons
{
  const vb = Object.keys(g.vsBook ?? {}).length
  const db = Object.keys(g.derbyBook ?? {}).length
  const poty = Object.values(g.players).filter(p => (p.poty ?? 0) > 0).length
  const legends = (g.legendOf ?? []).length
  const runs = Object.values(g.vsBook ?? {}).map(r => r.run ?? 0)
  const runMax = runs.length ? Math.max(...runs) : 0
  const runMin = runs.length ? Math.min(...runs) : 0
  console.log(`d-ledgers: vsBook ${vb} opponents · derbyBook ${db} · gateRecord ${g.gateRecord ? g.gateRecord.att : 'none'} · natConf ${g.natConfidence ?? 'n/a'} · tenureStart s${g.tenureStart} · legends ${legends} · living POTY holders ${poty}`)
  console.log(`ds-round: streak extremes ${runMin}..${runMax} · potyRoll ${(g.potyRoll ?? []).length} seasons`)
  if ((g.potyRoll ?? []).some(w => !w.name || w.season > g.season)) console.log('WARN: bad potyRoll entry')
  const badRuns = Object.entries(g.vsBook ?? {}).filter(([, r]) => (r.run ?? 0) > r.w || -(r.run ?? 0) > r.l)
  if (badRuns.length) console.log(`WARN: ${badRuns.length} streak/total mismatches in vsBook`)
  if (vb > 200) console.log('WARN: vsBook unbounded?')
  if (g.gateRecord && !g.clubs[g.gateRecord.oppId]) console.log('WARN: gate record dangling club')
}
// prose sweep verdict: every news item, press line and match event above,
// plus the long-lived ledgers that outlast the news feed
{
  for (const h of g.hof ?? []) prose('hall of fame', `${h.name} ${h.club ?? ''}`)
  for (const a of g.annals ?? []) prose('annals', a.league.name)
  console.log(`prose sweep: ${proseHits} violations across 20 seasons (news ${seen.size}, press ${proseSeenPress.size})`)
  if (proseHits > 0) console.log('WARN: prose violations in the deep world - see lines above')
}
// integrity sweep at the end
let orphans = 0, badRefs = 0
for (const c of Object.values(g.clubs)) {
  for (const id of c.players) if (!g.players[id]) orphans++
}
for (const p of Object.values(g.players)) {
  if (p.clubId && !g.clubs[p.clubId]) badRefs++
}
console.log(`integrity: roster orphans ${orphans}, bad club refs ${badRefs}`)
