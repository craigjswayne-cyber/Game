/**
 * ---- SEASON PRIORITIES, THE FORM TREND AND THE HIDDEN TENDENCIES (1.8.2) ----
 *
 * One harness for the three pieces of the owner's blueprint that went in
 * together, because they are one idea: rotation is only a decision if the
 * legs, the marks and the men underneath it are real.
 *
 *   (a) the plan changes who the assistant picks, and how the board judges
 *   (b) the trade-off shows over whole seasons, paired by seed: rest men in the
 *       cup ranked last and the league side kicks off fresher and stronger,
 *       while the cup side is weaker
 *   (c) the form trend reads the last ten marks
 *   (d) each hidden tendency moves outcomes the way it says
 *   (e) no tendency is ever named: every string in all six languages rendered
 *       and searched, plus the hint keys resolved everywhere
 *   (f) an old save, and a damaged plan, load
 */
import en from '../src/locales/en.json'
import fr from '../src/locales/fr.json'
import es from '../src/locales/es.json'
import it from '../src/locales/it.json'
import ja from '../src/locales/ja.json'
import af from '../src/locales/af.json'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { SEASON_WEEKS, type GameState, type Player } from '../src/game/model'
import { teamUnits } from '../src/game/matchEngine'
import { migrate } from '../src/game/save'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import { applyPlanSheet, assistantSheet, boardPriorityF, planComps, planTier, restList, setSeasonPlan } from '../src/game/seasonplan'
import { CONF_GOOD, CONF_POOR, formTraits, formTrend, traitDayF, traitHints } from '../src/game/formtraits'
import { sortTable } from '../src/game/schedule'
import { reportStage } from '../src/game/scout'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const clone = (g: GameState): GameState => JSON.parse(JSON.stringify(g))
const CLUB = 'northampton'
const DICTS = { en, fr, es, it, ja, af } as unknown as Record<Lang, Record<string, unknown>>

// ---------------------------------------------------------------- (a)
console.log('(a) the plan reaches the assistant and the board')
{
  const g = newGame(CLUB, 'Probe', 9)
  const comps = planComps(g)
  ok(comps.length >= 2, `the club has competitions to rank (${comps.join(', ')})`)
  const league = g.clubs[g.userClubId].leagueId
  const cup = comps.find(c => c !== league)!
  // no plan is the old game: factor 1 and a sheet nobody touches
  ok(boardPriorityF(g, league) === 1 && boardPriorityF(g, cup) === 1, 'no plan: the board weighs every competition at 1')
  const before = JSON.stringify(g.clubs[g.userClubId].tactic.lineup)
  applyPlanSheet(g)
  ok(JSON.stringify(g.clubs[g.userClubId].tactic.lineup) === before, 'no plan: the assistant leaves the sheet alone')
  // play on to the first cup week with the squad's legs used, then ask both plans
  let guard = 0
  while (userFixtureThisWeek(g)?.compId !== cup && guard++ < SEASON_WEEKS) processWeekAndAdvance(g)
  const fx = userFixtureThisWeek(g)!
  ok(!!fx && fx.compId === cup, `reached a ${cup} fixture in week ${g.week}`)
  const cupFirst = clone(g), leagueFirst = clone(g)
  setSeasonPlan(cupFirst, [cup, league], 'strongest')
  setSeasonPlan(leagueFirst, [league, cup], 'protect')
  const restA = restList(cupFirst, fx), restB = restList(leagueFirst, fx)
  const xv = (s: GameState) => s.clubs[s.userClubId].tactic.lineup.slice(0, 15)
  const changed = xv(cupFirst).filter(id => !xv(leagueFirst).includes(id)).length
  ok(planTier(cupFirst, cup) === 'high' && planTier(leagueFirst, cup) === 'low', 'the tiers follow the order')
  ok(restA.length === 0 && restB.length >= 3, `cup ranked first rests nobody, ranked last with key men protected rests ${restB.length}`)
  ok(changed >= 3, `and the two assistants name different sides (${changed} of the XV differ)`)
  ok(restB.every(p => !xv(leagueFirst).includes(p.id)), 'every rested man is out of the side he named')
  // the week's sheet is the standing side with only the rested shirts changed
  const fit = (id: number | null) => { const p = id != null ? leagueFirst.players[id] : null; return !!p && !p.injury && p.bans === 0 && !p.natSquad }
  const kept = xv(g).filter(id => fit(id) && !restB.some(p => p.id === id)).every(id => xv(leagueFirst).includes(id))
  ok(kept, 'everyone not rested keeps his place from the standing side')
  const sheet = assistantSheet(leagueFirst, fx)
  ok(restB.every(p => !sheet.includes(p.id)), 'and the Best XV draft rests the same men')
  ok(boardPriorityF(cupFirst, cup) > 1 && boardPriorityF(leagueFirst, cup) < 1, `board volume on the cup: ${boardPriorityF(cupFirst, cup)} first, ${boardPriorityF(leagueFirst, cup)} last`)
  // the same match, the same side, the same dice: only the plan differs
  for (const s of [cupFirst, leagueFirst]) {
    s.clubs[s.userClubId].tactic.lineup = xv(g).concat(g.clubs[g.userClubId].tactic.lineup.slice(15))
    s.clubs[s.userClubId].tactic.userPicked = true
  }
  const c0 = g.clubs[g.userClubId].boardConfidence
  processWeekAndAdvance(cupFirst)
  processWeekAndAdvance(leagueFirst)
  const f1 = cupFirst.fixtures.find(f => f.id === fx.id)!
  const us = f1.homeId === g.userClubId ? f1.homeScore - f1.awayScore : f1.awayScore - f1.homeScore
  const dA = cupFirst.clubs[g.userClubId].boardConfidence - c0
  const dB = leagueFirst.clubs[g.userClubId].boardConfidence - c0
  console.log(`      cup result ${us > 0 ? 'won' : us < 0 ? 'lost' : 'drawn'} by ${Math.abs(us)}: board ${dA.toFixed(2)} with the cup first, ${dB.toFixed(2)} with it last`)
  ok(us === 0 || (us > 0 ? dA > dB : dA < dB), 'the board reacts harder to the competition ranked first')
}

// ---------------------------------------------------------------- (b)
console.log('(b) the trade-off over a season, paired by seed')
// Both managers say "Balanced" and never touch the sheet; only the order
// differs. What the ranking buys is measured where it is made: who plays, what
// state the first-choice men are in when the league comes round, and the
// points in each competition.
interface Run { keyCond: number; keyShare: number; lgCa: number; cupCa: number; lgPts: number; cupPts: number; state: GameState }
function season(seed: number, order: 'league' | 'cup'): Run {
  const g = newGame(CLUB, 'Probe', seed)
  const league = g.clubs[g.userClubId].leagueId
  const cup = planComps(g).find(c => c !== league)!
  setSeasonPlan(g, order === 'league' ? [league, cup] : [cup, league], 'balanced')
  const key = new Set(g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => p && !p.acad)
    .sort((a, b) => b.ca - a.ca).slice(0, 15).map(p => p.id))
  const keyCond: number[] = [], keyShare: number[] = [], lgCa: number[] = [], cupCa: number[] = []
  let cupPts = 0
  let guard = 0
  let prev: string | null = null
  while (g.week < SEASON_WEEKS && guard++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g)
    if (fx && (fx.compId === league || fx.compId === cup)) {
      const xv = g.clubs[g.userClubId].tactic.lineup.slice(0, 15).map(id => (id != null ? g.players[id] : null)).filter((p): p is Player => !!p)
      if (fx.compId === league) {
        // the legs the first-choice men bring to a league match straight
        // after a cup week: the week the rotation was made for
        const avail = [...key].map(id => g.players[id]).filter(p => p && p.clubId === g.userClubId && !p.injury && !p.natSquad)
        if (prev === cup) keyCond.push(mean(avail.map(p => p.cond)))
        keyShare.push(xv.filter(p => key.has(p.id)).length / 15)
        lgCa.push(mean(xv.map(p => p.ca)))
      } else cupCa.push(mean(xv.map(p => p.ca)))
      prev = fx.compId
    }
    processWeekAndAdvance(g)
    if (fx && fx.compId === cup && fx.played) {
      const d = fx.homeId === g.userClubId ? fx.homeScore - fx.awayScore : fx.awayScore - fx.homeScore
      cupPts += d > 0 ? 2 : d === 0 ? 1 : 0
    }
  }
  const row = sortTable(g.comps[league].table).find(r => r.teamId === g.userClubId)
  return {
    keyCond: mean(keyCond), keyShare: mean(keyShare), lgCa: mean(lgCa), cupCa: mean(cupCa),
    lgPts: row?.pts ?? 0, cupPts, state: g,
  }
}
const SEEDS = process.env.QUICK ? [9] : [9, 777, 2024, 31337]
const A: Run[] = [], B: Run[] = []
const line = (r: Run) => `key men after a cup week ${r.keyCond.toFixed(1)} cond, ${(r.keyShare * 100).toFixed(0)}% of league shirts; XV ca league ${r.lgCa.toFixed(1)} cup ${r.cupCa.toFixed(1)}; ${r.lgPts} league pts, ${r.cupPts} cup pts`
for (const seed of SEEDS) {
  const a = season(seed, 'league'), b = season(seed, 'cup')
  A.push(a); B.push(b)
  console.log(`      seed ${String(seed).padEnd(5)} league first: ${line(a)}`)
  console.log(`      ${' '.repeat(10)} cup first:    ${line(b)}`)
}
const avg = (rs: Run[], k: keyof Omit<Run, 'state'>) => mean(rs.map(r => r[k] as number))
const mrun = (rs: Run[]): Run => ({ keyCond: avg(rs, 'keyCond'), keyShare: avg(rs, 'keyShare'), lgCa: avg(rs, 'lgCa'), cupCa: avg(rs, 'cupCa'), lgPts: avg(rs, 'lgPts'), cupPts: avg(rs, 'cupPts'), state: rs[0].state })
console.log(`      MEAN league first: ${line(mrun(A))}`)
console.log(`      MEAN cup first:    ${line(mrun(B))}`)
ok(avg(A, 'cupCa') < avg(B, 'cupCa') - 1, 'ranking the cup last fields a clearly weaker cup side')
ok(avg(A, 'lgCa') > avg(B, 'lgCa') && avg(A, 'keyShare') > avg(B, 'keyShare'), 'and more of the first-choice men in the league')
ok(avg(A, 'keyCond') > avg(B, 'keyCond'), 'who come from a cup week to the league with more condition in their legs')
// Results are the noisiest number here (paired seasons stop sharing dice at
// the first different sheet), so the claim is the net one: what the order
// gains in the competition put first against what it gives up in the other.
const net = (avg(A, 'lgPts') - avg(B, 'lgPts')) + (avg(B, 'cupPts') - avg(A, 'cupPts'))
ok(net > 0, `the results follow the order, net (${(avg(A, 'lgPts') - avg(B, 'lgPts')).toFixed(1)} league, ${(avg(A, 'cupPts') - avg(B, 'cupPts')).toFixed(1)} cup)`)

// ---------------------------------------------------------------- (c)
console.log('(c) the form trend reads the marks')
{
  ok(formTrend({ ratings: [5, 5.5, 6, 6.5, 7, 7.5] }) === 'up', 'a climbing run reads rising')
  ok(formTrend({ ratings: [7.5, 7, 6.5, 6, 5.5, 5] }) === 'down', 'a sliding run reads falling')
  ok(formTrend({ ratings: [6.2, 6.4, 6.1, 6.3, 6.2, 6.3] }) === 'flat', 'a level run reads steady')
  ok(formTrend({ ratings: [4, 8, 9] }) === null && formTrend({}) === null, 'under four marks there is no trend')
  let agree = 0, n = 0
  for (const r of A) for (const p of Object.values(r.state.players)) {
    const tr = formTrend(p)
    if (!tr || tr === 'flat') continue
    const rs = p.ratings!
    const h = Math.floor(rs.length / 2)
    const d = mean(rs.slice(h)) - mean(rs.slice(0, h))
    n++
    if ((tr === 'up') === (d > 0)) agree++
  }
  ok(n > 500 && agree / n > 0.9, `across the worlds the arrow agrees with the later marks against the earlier (${agree}/${n})`)
}

// ---------------------------------------------------------------- (d)
console.log('(d) the tendencies move outcomes the way they say')
{
  const g = A[0].state
  const ps = Object.values(g.players)
  const share = (k: keyof ReturnType<typeof formTraits>) => ps.filter(p => formTraits(g.seed, p.id)[k]).length / ps.length
  console.log(`      shares: slow ${(share('slow') * 100).toFixed(1)}%, iron ${(share('iron') * 100).toFixed(1)}%, brittle ${(share('brit') * 100).toFixed(1)}%, confidence ${(share('conf') * 100).toFixed(1)}%`)
  ok(['slow', 'iron', 'brit', 'conf'].every(k => { const s = share(k as 'slow'); return s > 0.07 && s < 0.25 }), 'each tendency is carried by a minority')
  ok(ps.every(p => { const t = formTraits(g.seed, p.id); return !(t.iron && t.brit) }), 'nobody is both brittle and iron')
  ok(ps.every(p => JSON.stringify(formTraits(g.seed, p.id)) === JSON.stringify(formTraits(g.seed, p.id))), 'the same save, the same men')

  // slow starter: the same man at lay-off sharpness costs his side more than a
  // man without it, through the live day's units
  const club = g.clubs[g.userClubId]
  const pool = club.players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.injury)
  const slow = ps.find(p => formTraits(g.seed, p.id).slow)!
  const plain = ps.find(p => !formTraits(g.seed, p.id).slow && !formTraits(g.seed, p.id).conf)!
  const dayDrop = (p: Player) => {
    const keep = p.sharp
    p.sharp = 40; const lo = traitDayF(g.seed, p)
    p.sharp = 90; const hi = traitDayF(g.seed, p)
    p.sharp = keep
    return hi - lo
  }
  ok(dayDrop(slow) > 0.04 && dayDrop(plain) === 0, `after a lay-off a slow starter's day is ${(dayDrop(slow) * 100).toFixed(1)}% down, anyone else's untouched`)
  {
    const lu = club.tactic.lineup.slice()
    const who = g.players[lu[9]!]
    const keep = { r: who.ratings, s: who.sharp }
    who.sharp = 90
    const base = teamUnits(g, lu, { fxId: 1, big: false }).overall
    who.sharp = 40
    const rusty = teamUnits(g, lu, { fxId: 1, big: false }).overall
    who.sharp = keep.s; who.ratings = keep.r
    ok(rusty < base, `a man short of sharpness lowers his side's day either way (${base.toFixed(3)} to ${rusty.toFixed(3)})`)
  }
  // confidence player: two poor marks dent the day, two good ones lift it
  const conf = ps.find(p => formTraits(g.seed, p.id).conf && !formTraits(g.seed, p.id).slow)!
  const keepR = conf.ratings, keepS = conf.sharp
  conf.sharp = 90
  conf.ratings = [6, CONF_POOR - 0.5, CONF_POOR - 0.2]
  const low = traitDayF(g.seed, conf)
  conf.ratings = [6, CONF_GOOD + 0.3, CONF_GOOD + 0.5]
  const high = traitDayF(g.seed, conf)
  conf.ratings = [6, CONF_POOR - 0.5, CONF_GOOD + 0.5]
  const mixed = traitDayF(g.seed, conf)
  conf.ratings = keepR; conf.sharp = keepS
  ok(low < 1 && high > 1 && mixed === 1, `a confidence player's day: ${low} after two poor, ${high} after two good, ${mixed} mixed`)
  void pool

  // iron: a week's recovery from the same empty tank, for every man in the
  // world who did not play that week
  {
    const w = newGame(CLUB, 'Probe', 777)
    for (let i = 0; i < 8; i++) processWeekAndAdvance(w)
    const wk = w.week
    for (const p of Object.values(w.players)) { p.cond = 40; p.rust = 0 }
    processWeekAndAdvance(w)
    const gainI: number[] = [], gainO: number[] = []
    for (const p of Object.values(w.players)) {
      if (!p.clubId || p.injury || p.lastWk === wk) continue
      ;(formTraits(w.seed, p.id).iron ? gainI : gainO).push(p.cond - 40)
    }
    console.log(`      a week's recovery from 40: iron +${mean(gainI).toFixed(1)} v others +${mean(gainO).toFixed(1)} (${gainI.length} v ${gainO.length} men)`)
    ok(mean(gainI) > mean(gainO) + 3, 'an iron constitution gets more back')
  }
  // brittle, across whole worlds (every club, every man)
  let britInj = 0, britApps = 0, restInj = 0, restApps = 0
  for (const r of [...A, ...B]) {
    const s = r.state
    for (const p of Object.values(s.players)) {
      if (!p.clubId || p.acad || p.stats.apps < 5) continue
      const t = formTraits(s.seed, p.id)
      const inj = (p.injLog ?? []).filter(x => x.s === s.season).length
      if (t.brit) { britInj += inj; britApps += p.stats.apps } else { restInj += inj; restApps += p.stats.apps }
    }
  }
  const bRate = britInj / Math.max(1, britApps) * 100, rRate = restInj / Math.max(1, restApps) * 100
  console.log(`      injuries per 100 appearances: brittle ${bRate.toFixed(2)} v others ${rRate.toFixed(2)}`)
  ok(bRate > rRate * 1.1, 'a brittle man gets hurt more often')
}

// ---------------------------------------------------------------- (e)
console.log('(e) no tendency is ever named')
{
  // Every label the owner's brief used, and the obvious words for them in each
  // language. Checked against every string in every dictionary, rendered.
  const BANNED: RegExp[] = [
    /slow[\s-]?starter/i, /iron[\s-]?man/i, /confidence player/i, /\bbrittle\b/i,
    /fr[aá]gil/i, /\bbroos\b/i, /ysterman/i, /homme de fer/i, /hombre de hierro/i, /uomo di ferro/i,
    /スロースターター/, /鉄人/, /ガラスの/,
    // and the internal names, should one ever leak through as text
    /formTraits|traitDayF|brittleF|hint(Slow|Iron|Brit|Conf)/,
  ]
  // THE ONE KNOWN EXCEPTION, AND WHY IT IS ONE. The player screen has read a
  // man's injury RECORD for a long time (PlayerScreen: ten or more injuries a
  // season reads 'Fragile'), and the handbook and a few flavour lines use the
  // word in its everyday sense. Those predate the tendencies and read facts on
  // the record, not the hidden draw; they are frozen here so that no new string
  // can join them.
  const KNOWN = new Set([
    'player.injFragile', 'handbook.a33', 'handbook.a6', 'news.upSeats', 'news.wGround2', 'reply.assistantThinnest',
    // the recruitment brief's durability criterion (1.8.2), which reads the
    // injury record; only the French label uses the word
    'recruit.c_durability',
  ])
  const hits: string[] = []
  const leaves = (d: Record<string, unknown>, pre = ''): string[] => Object.entries(d).flatMap(([k, v]) => {
    if (!pre && k === '_meta') return []
    const path = pre ? `${pre}.${k}` : k
    if (typeof v === 'string') return [path]
    if (v && typeof v === 'object') return 'other' in (v as object) ? [path] : leaves(v as Record<string, unknown>, path)
    return []
  })
  const rawOf = (d: unknown, k: string): string => {
    let node: unknown = d
    for (const part of k.split('.')) node = (node as Record<string, unknown>)?.[part]
    return typeof node === 'string' ? node : JSON.stringify(node ?? '')
  }
  // every leaf of every dictionary, the language-only siblings included,
  // rendered through the same tIn the screens use
  let rendered = 0
  for (const [lang, dict] of Object.entries(DICTS) as [Lang, Record<string, unknown>][]) {
    await ensureLang(lang)
    for (const k of leaves(dict)) {
      const vars: Record<string, string | number> = {}
      for (const m of rawOf(dict, k).matchAll(/\{(\w+)\}/g)) {
        const v = m[1]
        vars[v] = v.endsWith('_k') ? 'common.nothing' : v.endsWith('_ll') ? '[]' : 1
      }
      let s: string
      try { s = tIn(lang, k, vars) } catch { s = rawOf(dict, k) }
      rendered++
      if (BANNED.some(re => re.test(s)) && !KNOWN.has(k.replace(/_[fw]+$/, ''))) hits.push(`${lang} ${k}: ${s.slice(0, 80)}`)
    }
  }
  if (hits.length) console.log(hits.slice(0, 30).map(h => `        ${h}`).join('\n'))
  ok(hits.length === 0, `${rendered} strings rendered across ${Object.keys(DICTS).length} languages, none names a tendency`)
  // the hints themselves: every one is words in every language, and every
  // sibling a language keeps is words too
  const HINTS = ['Slow', 'Iron', 'Brit', 'Conf'].flatMap(h => [`hint${h}`, `hint${h}V`])
  let bad = 0
  for (const [lang, dict] of Object.entries(DICTS) as [Lang, Record<string, unknown>][]) {
    const pl = (dict.player ?? {}) as Record<string, unknown>
    for (const k of HINTS) {
      const s = tIn(lang, `player.${k}`)
      if (typeof pl[k] !== 'string' || s.startsWith('player.') || BANNED.some(re => re.test(s))) { bad++; console.log(`        ${lang} ${k}: ${s}`) }
      const f = pl[`${k}_f`]
      if (f != null && (typeof f !== 'string' || BANNED.some(re => re.test(f)))) { bad++; console.log(`        ${lang} ${k}_f`) }
    }
  }
  ok(bad === 0, 'every hint is plain words in all six languages')
  // and in a real world with full knowledge, what the player screen would print
  const g = B[0].state
  let shown = 0, leaked = 0
  for (const p of Object.values(g.players)) {
    for (const k of traitHints(g, p)) { shown++; const s = tIn('en', k); if (BANNED.some(re => re.test(s))) leaked++ }
  }
  ok(shown > 0 && leaked === 0, `${shown} hint lines a manager could read, none of them a label`)
  // and the hints wait for the same knowledge nerve does
  const stranger = Object.values(g.players).find(p => p.clubId && p.clubId !== g.userClubId && reportStage(g, p) < 2 && Object.values(formTraits(g.seed, p.id)).some(Boolean))
  ok(!!stranger && traitHints(g, stranger).length === 0, 'a man at another club without a detailed report gives nothing away')
}

// ---------------------------------------------------------------- (f)
console.log('(f) old saves load')
{
  const g = newGame('bath', 'Probe', 4242)
  for (let i = 0; i < 6; i++) processWeekAndAdvance(g)
  const old = clone(g)
  delete old.seasonPlan
  for (const p of Object.values(old.players)) delete p.ratings
  const m = migrate(old)
  ok(m.seasonPlan === undefined, 'a save from before the plan loads with no plan')
  ok(Object.values(m.players).every(p => formTrend(p) === null), 'and a man with no marks yet shows no trend')
  for (let i = 0; i < 3; i++) processWeekAndAdvance(m)
  ok(m.week === g.week + 3, 'and plays on')
  const bent = clone(g) as GameState & { seasonPlan: unknown }
  bent.seasonPlan = { order: 'prem', rot: 'everybody' }
  ok(migrate(bent as GameState).seasonPlan === undefined, 'a damaged plan is dropped, not half-read')
  const noSeason = clone(g) as GameState & { seasonPlan: unknown }
  noSeason.seasonPlan = { order: ['prem', 'cc'], rot: 'balanced' }
  const ns = migrate(noSeason as GameState)
  ok(ns.seasonPlan?.season === g.season && ns.seasonPlan.rot === 'balanced', 'a plan without its season is stamped with this one')
  const kept = clone(g)
  setSeasonPlan(kept, planComps(kept).reverse(), 'protect')
  const back = migrate(clone(kept))
  ok(JSON.stringify(back.seasonPlan) === JSON.stringify(kept.seasonPlan), 'a good plan survives a save and load')
}

console.log(fails ? `SEASON PLAN PROBE FAILED (${fails})` : 'SEASON PLAN PROBE PASSED')
process.exit(fails ? 1 : 0)
