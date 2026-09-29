/**
 * ---- DEVELOPMENT AS A PROJECT, AND POTENTIAL THAT MOVES (1.8.2) ----
 *
 * Owner's "mastery" brief for development: hidden learning traits the coaches
 * discover, a plan with a primary and a secondary programme whose weeks are
 * uneven, growth driven by minutes, confidence, the right shirt, the side's
 * style, mentoring, the staff and the Centre of Excellence, a ceiling that
 * drifts with a man's seasons, estimates that update in words and never show
 * the number, and a timeline on the player screen. All of it is
 * game/devproject.ts, hooked into season.ts (the week), rollover.ts (the
 * season review and the summer), ageing.ts (the summer's attribute lean) and
 * scout.ts (a young man's ceiling is an estimate).
 *
 * Held here:
 *   1. TRAITS SHAPE GROWTH. Pure and stable; about the intended rates; the
 *      summer leans towards the quick group and away from the slow one
 *      without moving the rating; a programme on the quick group lands more
 *      often than one on the slow group; the tempo moves growth by age.
 *   2. THE DRIVERS pull the right way and are bounded: minutes, confidence
 *      (and form), position, style fit, the Centre of Excellence; the week's
 *      multiplier never leaves 0.6..1.45 and its spells average one; the
 *      world's young men average one; a heavy load is a heavy load.
 *   3. CEILINGS DRIFT WITHIN BOUNDS. A stalled season lowers, a breakthrough
 *      raises, never past six either side of where he started, never under
 *      his rating, never over 99; and over two real seasons of a world.
 *   4. ESTIMATES UPDATE AND NEVER EXPOSE THE TRUTH. A young man's ceiling is
 *      a band holding the truth at his own club too, narrowing with age and
 *      exact from 24; the band follows a drift; the staff's lines carry no
 *      numbers and appear only once the coaches have had time to see.
 *   5. SAVES. An old save (no new fields) and a damaged one both load; the
 *      timeline is written for the manager's own men only, and capped.
 *
 * Run: npx vite-node scripts/devprojectprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, rollPlan, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { migrate } from '../src/game/save'
import { ageAttributes, attrLevel } from '../src/game/ageing'
import { paRange, scoutPa, youthPaMargin } from '../src/game/scout'
import { mulberry32 } from '../src/game/rng'
import { tIn } from '../src/game/i18n'
import { devNewsWeek } from '../src/game/devnews'
import { absWeek, SEASON_WEEKS, XV_SLOTS, type GameState, type Player } from '../src/game/model'
import {
  confidence, devDrive, devPhase, driveParts, driverLines, EARLY_RATE, GROUP_ATTRS, heavyLoad, learning,
  learningLines, markSights, outlookLine, PA_DRIFT_MAX, PHASE_F, planAffinity, seasonReview, styleFit,
  tempoF, TL, TL_MAX, weekGrowth,
} from '../src/game/devproject'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

const g = newGame('northampton', 'Dev Project', 182)
const all = Object.values(g.players)
const mine = (p: Player) => p.clubId === g.userClubId

console.log('--- 1. traits shape growth')
{
  const ls = all.map(p => learning(g.seed, p))
  ok(all.slice(0, 300).every((p, i) => JSON.stringify(learning(g.seed, p)) === JSON.stringify(ls[i])), 'the profile is a pure function: the same answer twice, nothing stored')
  const share = (f: (i: number) => boolean) => ls.filter((_, i) => f(i)).length / ls.length
  const early = share(i => ls[i].tempo === 'early'), late = share(i => ls[i].tempo === 'late')
  const quick = share(i => ls[i].quick != null), slow = share(i => ls[i].slow != null)
  console.log(`  ${ls.length} players: early ${(early * 100).toFixed(1)}%, late ${(late * 100).toFixed(1)}%, a quick group ${(quick * 100).toFixed(0)}%, a slow group ${(slow * 100).toFixed(0)}%`)
  ok(Math.abs(early - EARLY_RATE * (1 - late)) < 0.02 && late > 0.06 && late < 0.11, 'early developers and late bloomers each about one in twelve')
  ok(quick > 0.45 && quick < 0.6 && slow > 0.3 && slow < 0.5, 'about half learn something quickly, rather fewer something slowly')
  ok(ls.every(l => !l.quick || l.quick !== l.slow), 'never quick and slow at the same thing')
  ok(all.every(p => { const l = learning(g.seed, p); return !l.quick || !(p.pos === 'WG' && l.quick === 'setpiece') }), 'the groups fit the position (no scrummaging wingers)')

  // the summer lean: four summers of the same men, with and without it
  const kids = all.filter(p => p.age >= 17 && p.age <= 19 && learning(g.seed, p).quick && learning(g.seed, p).slow).slice(0, 250)
  let qUp = 0, sUp = 0, levelMiss = 0
  for (const k0 of kids) {
    const l = learning(g.seed, k0)
    const p = clone(k0)
    const q0 = GROUP_ATTRS[l.quick!].filter(k => k !== 'goa').reduce((s, k) => s + p.a[k], 0)
    const s0 = GROUP_ATTRS[l.slow!].filter(k => k !== 'goa').reduce((s, k) => s + p.a[k], 0)
    const lv0 = attrLevel(p)
    const st = clone({ seed: g.seed, season: 0 }) as GameState
    for (let y = 0; y < 4; y++) { p.age++; st.season = y; ageAttributes(st, p, p.ca) }
    qUp += (GROUP_ATTRS[l.quick!].filter(k => k !== 'goa').reduce((s, k) => s + p.a[k], 0) - q0) / GROUP_ATTRS[l.quick!].filter(k => k !== 'goa').length
    sUp += (GROUP_ATTRS[l.slow!].filter(k => k !== 'goa').reduce((s, k) => s + p.a[k], 0) - s0) / GROUP_ATTRS[l.slow!].filter(k => k !== 'goa').length
    levelMiss += attrLevel(p) - lv0
  }
  qUp /= kids.length; sUp /= kids.length; levelMiss /= kids.length
  console.log(`  ${kids.length} teenagers, four summers at a flat rating: quick-group attributes ${qUp >= 0 ? '+' : ''}${qUp.toFixed(2)}, slow-group ${sUp >= 0 ? '+' : ''}${sUp.toFixed(2)} each; level drift ${levelMiss.toFixed(2)}`)
  ok(qUp - sUp >= 1.2, 'the summers lean towards what he learns quickly and away from what he is slow at')
  ok(Math.abs(levelMiss) < 1.2, 'and the lean does not move the level his attributes describe (the quarter pull aside)')

  // a programme on the quick group lands more often than one on the slow
  ok(planAffinity(g.seed, kids[0], 'balanced') === 1, 'the squad session has no affinity')
  const man = all.find(p => mine(p) && !p.acad && p.age <= 23 && learning(g.seed, p).quick === 'defence' && learning(g.seed, p).slow === 'attack')
    ?? all.find(p => mine(p) && !p.acad && p.age <= 23 && learning(g.seed, p).quick && learning(g.seed, p).slow)!
  const lm = learning(g.seed, man)
  const planFor = (grp: string) => (['scrum', 'attack', 'defence', 'fitness', 'kicking'] as const)
    .find(f => (f === 'scrum' ? 'setpiece' : f === 'fitness' ? 'physical' : f) === grp) ?? 'defence'
  const landed = (plan: ReturnType<typeof planFor>) => {
    const h = clone(g)
    h.plans = [{ id: man.id, plan }]
    h.staff.defence = 3; h.staff.attack = 3; h.staff.scrumCoach = 3; h.staff.kicking = 3; h.staff.assistant = 3
    const rng = mulberry32(99)
    let n = 0
    for (let s = 0; s < 30; s++) for (let w = 1; w <= SEASON_WEEKS; w++) {
      h.season = s; h.week = w
      const p = h.players[man.id]
      const a = { ...p.a }, debt = p.tdebt
      p.pa = 99
      if (rollPlan(h, p, rng)) n++
      p.a = a; p.tdebt = debt
    }
    return n
  }
  const nQuick = landed(planFor(lm.quick!)), nSlow = landed(planFor(lm.slow!))
  console.log(`  ${man.name} (quick ${lm.quick}, slow ${lm.slow}): 30 seasons of weeks, the quick programme lands ${nQuick} times, the slow one ${nSlow}`)
  ok(nQuick > nSlow * 1.4, 'a programme on what he learns quickly lands far more often')

  ok(tempoF('early', 19) > 1 && tempoF('early', 22) < 1 && tempoF('steady', 19) === 1 && tempoF('late', 19) < 1,
    'the tempo: an early developer grows before 21 and slows after, a late one starts slower')
}

console.log('--- 2. the drivers pull the right way, and are bounded')
{
  const h = clone(g)
  h.week = 20
  const base = Object.values(h.players).find(p => mine(p) && !p.acad && p.age <= 21 && p.pos === 'FL')
    ?? Object.values(h.players).find(p => mine(p) && !p.acad && p.age <= 21)!
  const at = (over: Partial<Player>) => ({ ...base, stats: { ...base.stats }, ...over } as Player)
  const played = driveParts(h, at({ lastWk: 19, ratings: [6.1, 6.1, 6.1] }))
  const benched = driveParts(h, at({ lastWk: 10, ratings: [6.1, 6.1, 6.1] }))
  ok(played.minutes > 0 && benched.minutes < 0, `minutes: played last week ${played.minutes.toFixed(3)}, out for ten ${benched.minutes.toFixed(3)}`)
  const hi = confidence(h, at({ lastWk: 19, ratings: [8, 8.2, 7.9] }))
  const lo = confidence(h, at({ lastWk: 19, ratings: [4.6, 4.8, 5] }))
  const gone = confidence(h, at({ lastWk: 5, ratings: [8, 8.2, 7.9] }))
  ok(hi > 0.8 && lo < -0.8 && gone === 0, `confidence: good run ${hi.toFixed(2)}, poor run ${lo.toFixed(2)}, long out of the side ${gone}`)
  ok(devDrive(h, at({ lastWk: 19, ratings: [8, 8.2, 7.9] })) > devDrive(h, at({ lastWk: 19, ratings: [4.6, 4.8, 5] })), 'and confidence feeds growth')
  // form: a week of the weekly loop for a confident man and a shaken twin
  {
    const w = clone(g)
    const p = w.players[base.id], q = Object.values(w.players).find(x => mine(x) && x.id !== base.id && !x.acad && !x.injury)!
    p.ratings = [8.4, 8.4, 8.4]; q.ratings = [4.5, 4.5, 4.5]
    p.lastWk = w.week; q.lastWk = w.week
    p.form = 6; q.form = 6
    const f0 = { p: p.form, q: q.form }
    processWeekAndAdvance(w)
    const dp = w.players[p.id].form - f0.p, dq = w.players[q.id].form - f0.q
    ok(dp > dq, `confidence feeds form a little: ${dp >= 0 ? '+' : ''}${dp.toFixed(3)} against ${dq >= 0 ? '+' : ''}${dq.toFixed(3)} in a week`)
  }
  // position: on the sheet in his own shirt, a second shirt, and a wrong one
  const lu = h.clubs[h.userClubId].tactic.lineup
  const slotOf = (pos: string) => XV_SLOTS.findIndex(s => s.pos === pos)
  const place = (slot: number) => { const l = [...lu]; const was = l.indexOf(base.id); if (was >= 0) l[was] = null; l[slot] = base.id; h.clubs[h.userClubId].tactic.lineup = l }
  place(slotOf(base.pos))
  const own = driveParts(h, at({ lastWk: 19 })).position
  place(slotOf(base.pos === 'FB' ? 'LP' : 'FB'))
  const wrong = driveParts(h, at({ lastWk: 19 })).position
  const alt = base.alt[0] ? (place(slotOf(base.alt[0])), driveParts(h, at({ lastWk: 19 })).position) : -0.05
  h.clubs[h.userClubId].tactic.lineup = lu
  ok(own === 0 && wrong < alt && alt < 0, `position: his own shirt ${own}, a second shirt ${alt}, a wrong one ${wrong}`)
  // style fit: dials that reward his quick group, then his slow one
  const fitMan = Object.values(h.players).find(p => mine(p) && learning(h.seed, p).quick === 'attack' && learning(h.seed, p).slow === 'setpiece')
  if (fitMan) {
    const tc = h.clubs[h.userClubId].tactic
    const keep = { ...tc }
    Object.assign(tc, { style: 75, tempo: 50, kicking: 50, aggression: 50, defLine: 50 })
    const good = styleFit(h, fitMan)
    Object.assign(tc, { style: 25 })
    const bad = styleFit(h, fitMan)
    Object.assign(tc, keep)
    ok(good === 1 && bad === -1, 'style fit: an expansive side suits a quick handler, a forward-oriented one leans on his slow set piece')
  } else ok(false, 'found a quick handler who is slow at the set piece')
  // the Centre of Excellence, for an under-21
  const coe = (lvl: number) => { h.clubs[h.userClubId].facilities = { ...h.clubs[h.userClubId].facilities, academy: lvl }; return driveParts(h, at({})).coe }
  const c0 = coe(0), c5 = coe(5)
  ok(c5 > 0 && c0 < 0, `the Centre of Excellence: level 0 ${c0.toFixed(3)}, level 5 ${c5.toFixed(3)} a week`)
  // bounds: every combination
  let lowest = 9, highest = 0
  for (const ratings of [[3, 3, 3], [10, 10, 10]]) for (const lastWk of [19, 2]) for (const lvl of [0, 5]) for (const age of [17, 20, 23]) {
    coe(lvl)
    const d = devDrive(h, at({ ratings, lastWk, age }))
    lowest = Math.min(lowest, d); highest = Math.max(highest, d)
  }
  ok(lowest >= 0.6 && highest <= 1.45, `the week's multiplier stays in its band (${lowest.toFixed(2)}..${highest.toFixed(2)} within 0.6..1.45)`)
  // spells: a fifth flat, a fifth flying, mean one
  const phases: number[] = []
  for (let b = 0; b < 400; b++) phases.push(PHASE_F[devPhase({ ...h, season: Math.floor(b / 12), week: (b % 12) * 4 + 1 } as GameState, base)])
  const stalls = phases.filter(x => x < 1).length / phases.length
  ok(Math.abs(mean(phases) - 1) < 0.08 && stalls > 0.12 && stalls < 0.28, `the weeks come in spells: ${(stalls * 100).toFixed(0)}% of months flat, mean ${mean(phases).toFixed(3)}`)
  // the world's young men, on a fresh world, average one
  const young = Object.values(g.players).filter(p => p.clubId && p.age <= 24 && p.ca < p.pa)
  const wm = mean(young.map(p => devDrive(g, p)))
  ok(Math.abs(wm - 1) < 0.05, `the world's young men average one on the week's drivers (${wm.toFixed(3)} over ${young.length})`)
  ok(heavyLoad(at({ age: 20, avail: 16, stats: { ...base.stats, starts: 15 } })) && !heavyLoad(at({ age: 20, avail: 16, stats: { ...base.stats, starts: 8 } })) && !heavyLoad(at({ age: 25, avail: 16, stats: { ...base.stats, starts: 16 } })),
    'a heavy load: an under-22 starting nearly every week, and nobody else')
}

console.log('--- 3. ceilings drift within bounds')
{
  const h = clone(g)
  const p = Object.values(h.players).find(x => mine(x) && !x.acad && x.age <= 20 && x.pa - x.ca >= 10)!
  const pa0 = p.pa
  let low = p.pa
  for (let s = 0; s < 30; s++) {
    h.season = s; p.age = 19
    p.ca0 = p.ca; p.stats = { ...p.stats, starts: 0, apps: 0, ratingSum: 0 }
    seasonReview(h, p)
    low = Math.min(low, p.pa)
  }
  ok(p.pa < pa0 && p.pa >= pa0 - PA_DRIFT_MAX && p.pa >= p.ca, `thirty stalled, benched seasons: ceiling ${pa0} -> ${p.pa} (floor ${pa0 - PA_DRIFT_MAX}, rating ${p.ca})`)
  const q = Object.values(h.players).find(x => mine(x) && !x.acad && x.age <= 20 && x.pa <= 85 && x.id !== p.id)!
  const qa0 = q.pa
  for (let s = 0; s < 30; s++) {
    h.season = s; q.age = 20
    q.ca0 = q.ca - 6; q.stats = { ...q.stats, starts: 18, apps: 20, ratingSum: 20 * 7.6 }
    seasonReview(h, q)
  }
  ok(q.pa > qa0 && q.pa <= qa0 + PA_DRIFT_MAX && q.pa <= 99, `thirty breakthrough seasons: ceiling ${qa0} -> ${q.pa} (cap ${qa0 + PA_DRIFT_MAX})`)
  const r = Object.values(h.players).find(x => x.age >= 28)!
  const ra = r.pa
  seasonReview(h, r)
  ok(r.pa === ra, 'a 28-year-old\'s ceiling does not move')

  // two real seasons of a world
  const w = newGame('leicester', 'Drift', 777)
  const start = new Map(Object.values(w.players).map(x => [x.id, x.pa]))
  for (let s = 0; s < 2; s++) {
    const t = w.season + 1; let guard = 0
    while (w.season < t && guard++ < SEASON_WEEKS + 5) {
      const fx = userFixtureThisWeek(w); if (fx) simMatch(w, fx, weekRng(w), true)
      for (const pi of w.press.filter(x => !x.answered)) answerPress(w, pi.id, 0)
      processWeekAndAdvance(w)
    }
  }
  const ps = Object.values(w.players)
  const moved = ps.filter(x => x.pa0 != null)
  const bad = ps.filter(x => x.pa0 != null && (Math.abs(x.pa - x.pa0) > PA_DRIFT_MAX || x.pa > 99 || x.pa < x.ca))
  const drift = ps.filter(x => start.has(x.id)).map(x => x.pa - start.get(x.id)!)
  console.log(`  two seasons, seed 777: ${moved.length} ceilings moved, ${drift.filter(d => d > 0).length} up and ${drift.filter(d => d < 0).length} down, mean drift across the world ${mean(drift).toFixed(3)}`)
  ok(bad.length === 0, 'every moved ceiling stays within six of where it started, under 99 and over the rating')
  ok(moved.length > 300 && Math.abs(mean(drift)) < 0.1, 'ceilings do move, and the world\'s average barely does')
  const tl = ps.filter(x => x.tl?.length)
  ok(tl.length > 0 && tl.every(x => x.tl!.length <= TL_MAX && x.tl!.every(row => row.length === 3)), `the timeline is written (${tl.length} men) and compact`)
  ok(tl.every(x => x.career.some(c => c.clubId === w.userClubId) || x.clubId === w.userClubId || x.tl!.length <= 2), 'and only for men who have been the manager\'s')
  ok(ps.filter(x => x.clubId && x.clubId !== w.userClubId && x.tl).every(x => x.career.some(c => c.clubId === w.userClubId)), 'no AI man carries a timeline he never earned at the club')
  const review = w.news.find(n => n.k === 'news.devReview')
  console.log(`  the summer review letter: ${review ? tIn('en', 'news.devReview', review.v).split('\n').length - 2 + ' lines' : 'none this summer'}`)
  if (review) {
    const rows = JSON.parse(String(review.v?.rows_ll)) as { name: string; from: string; to: string }[]
    console.log(`  e.g. ${tIn('en', 'news.devReview', review.v).split('\n')[1]}`)
    ok(rows.every(r => r.from !== r.to && /^\d+(-\d+)?$/.test(r.from) && /^\d+(-\d+)?$/.test(r.to)), 'a revised projection reads band to band')
  }
  // the owner's addition: the staff's word in the inbox, and the intake picks
  const bt = w.news.filter(n => n.k === 'news.devBreakthrough').length
  const st = w.news.filter(n => n.k === 'news.devStalled' || n.k === 'news.devStalledMins').length
  const picks = w.news.find(n => n.k === 'news.intakePicks')
  console.log(`  two seasons of the inbox: ${bt} breakthroughs, ${st} stalls${picks ? `; intake picks:\n    ${tIn('en', 'news.intakePicks', picks.v).split('\n').slice(1).join('\n    ')}` : ''}`)
  ok(bt + st > 0, 'breakthroughs and stalls reach the inbox')
  ok(!!picks, 'the academy director names his picks on intake day')
  if (picks) {
    const rows = JSON.parse(String(picks.v?.rows_ll)) as { name: string; range: string }[]
    const truth = rows.map(r => Object.values(w.players).find(x => x.name === r.name)?.pa)
    ok(rows.length >= 1 && rows.length <= 3 && rows.every((r, i) => {
      const m = /^(\d+)-(\d+)$/.exec(r.range)
      return !!m && Number(m[1]) < Number(m[2]) && truth[i] != null
    }), 'up to three, each with a range from the fog, never a single number')
  }
}

console.log('--- 4. estimates update, and never expose the truth')
{
  const h = clone(g)
  const kids = Object.values(h.players).filter(p => mine(p) && p.age <= 22)
  ok(kids.length > 0 && kids.every(p => { const r = paRange(h, p)!; return r[0] < r[1] && r[0] <= p.pa && p.pa <= r[1] }),
    `your own under-23s: a band holding the truth, never the number (${kids.length} men)`)
  const k = kids[0]
  const width = (age: number) => { const r = paRange(h, { ...k, age } as Player)!; return r[1] - r[0] }
  ok(width(18) >= width(21) && width(21) >= width(23) && width(24) === 0, `and it narrows with age: ${width(18)} at 18, ${width(21)} at 21, ${width(23)} at 23, exact from 24`)
  h.staff.assistant = 3
  h.clubs[h.userClubId].facilities = { ...h.clubs[h.userClubId].facilities, academy: 3 }
  ok(youthPaMargin(h, { ...k, age: 18 } as Player) < youthPaMargin(g, { ...k, age: 18 } as Player) || youthPaMargin(g, { ...k, age: 18 } as Player) === 1,
    'a good assistant and Centre of Excellence see further')
  const before = scoutPa(h, k)
  k.pa = Math.min(99, k.pa + 4)
  ok(scoutPa(h, k) > before, 'when the ceiling moves, the estimate follows it')
  const row: [number, number, number] = [0, k.ca, 0]
  k.tl = [row]
  markSights(k, 70, 73)
  ok((row[2] & TL.up) !== 0, 'a rise of two or more in the estimate is written as sights raised')
  // the lines: known only after time with the coaches, and never a number
  const fresh = { ...k, joinedAt: absWeek(h.season, h.week), stats: { ...k.stats, apps: 0 } } as Player
  const long = { ...k, joinedAt: absWeek(h.season, h.week) - 80 } as Player
  const lf = learningLines(h, fresh).map(l => l.k), ll = learningLines(h, long).map(l => l.k)
  const lk = learning(h.seed, k)
  ok(!lf.some(x => x.startsWith('dev.quick.') || x.startsWith('dev.slow.')), 'a man signed this week: the coaches have nothing to say about how he learns yet')
  ok(!lk.quick || ll.includes(`dev.quick.${lk.quick}`), 'after a season and a half, they do')
  const other = Object.values(h.players).find(p => p.clubId && !mine(p) && learning(h.seed, p).quick)!
  ok(learningLines(h, other).length === 0 && learningLines(h, other, true).length === 1, 'another club\'s man: nothing, and one hedged line from a full file')
  const texts: string[] = []
  for (const p of Object.values(h.players).filter(mine)) {
    for (const l of [...learningLines(h, p), ...driverLines(h, p), outlookLine(h, p, paRange(h, p))].filter(Boolean)) {
      for (const lang of ['en', 'fr', 'es', 'it', 'ja', 'af'] as const) texts.push(tIn(lang, l!.k, l!.v))
    }
  }
  ok(texts.length > 0 && texts.every(s => !/\d/.test(s)), `the staff speak in words: ${texts.length} lines in six languages, no digit in any`)
  ok(texts.every(s => !s.includes('dev.')), 'and every line resolves')
}

console.log('--- 4b. the staff\'s inbox draws nothing from the world')
{
  const h = clone(g)
  h.week = 20
  const kid = Object.values(h.players).find(p => mine(p) && !p.acad && p.age <= 21 && p.pa - p.ca >= 8)!
  kid.ca0 = kid.ca; kid.stats = { ...kid.stats, starts: 0 }
  const before = JSON.stringify(h.players)
  const n0 = h.news.length
  devNewsWeek(h)
  ok(JSON.stringify(h.players) === before, 'the weekly word changes nobody')
  const item = h.news.slice(n0).find(n => n.playerId === kid.id) ?? h.news.slice(n0)[0]
  ok(!!item && (item.k === 'news.devStalledMins' || item.k === 'news.devStalled'), `a stalled youngster gets a line at week 20 (${item ? tIn('en', item.k!, item.v) : 'none'})`)
  const n1 = h.news.length
  devNewsWeek(h)
  ok(h.news.length === n1 || h.news.slice(n1).every(n => n.playerId !== item?.playerId), 'and only once a season')
}

console.log('--- 5. saves')
{
  const h = clone(g)
  // an old save: none of the new fields
  for (const p of Object.values(h.players)) { delete p.pa0; delete p.tl }
  h.plans = [{ id: Object.values(h.players).find(mine)!.id, plan: 'defence' }]
  const m = migrate(clone(h))
  ok(!!m && Object.values(m.players).every(p => p.pa0 == null && p.tl == null), 'an old save loads with no ceiling moved and no timeline')
  // a damaged one
  const d = clone(h)
  const ids = Object.values(d.players).filter(mine).map(p => p.id)
  const bad = d as unknown as { players: Record<number, Record<string, unknown>>; plans: unknown[] }
  bad.players[ids[0]].tl = 'yesterday'
  bad.players[ids[1]].tl = [[1, 60, 3], ['x', 2, 3], [2, 70]]
  bad.players[ids[2]].pa0 = 'high'
  bad.players[ids[3]].pa0 = Number.NaN
  bad.plans = [{ id: ids[0], plan: 'defence', plan2: 'defence' }, { id: ids[1], plan: 'attack', plan2: 'juggling', pts: -4 }, 'nonsense', { id: ids[2], plan: 'kicking', plan2: 'fitness', pts: 3 }]
  const dm = migrate(clone(d) as GameState)
  const P = dm.players
  ok(P[ids[0]].tl == null && P[ids[1]].tl?.length === 1 && P[ids[2]].pa0 == null && P[ids[3]].pa0 == null,
    'a damaged timeline or ceiling origin is trimmed or dropped')
  const pl = dm.plans ?? []
  ok(pl.length === 3 && pl[0].plan2 == null && pl[1].plan2 == null && pl[1].pts == null && pl[2].plan2 === 'fitness' && pl[2].pts === 3,
    'a damaged plan keeps its programme and loses only what was broken')
  ok(JSON.stringify(migrate(clone(dm))) === JSON.stringify(migrate(clone(dm))), 'and the migration is stable')
  // a week still runs on it
  processWeekAndAdvance(dm)
  ok(dm.week > 0, 'and a week simulates on the healed save')
}

console.log(fails ? `\nDEV PROJECT PROBE FAILED (${fails})` : '\nDEV PROJECT PROBE PASSED: traits shape growth, the drivers are bounded, ceilings drift, estimates stay estimates')
process.exit(fails ? 1 : 0)
