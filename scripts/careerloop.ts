/**
 * ---- THE CAREER LOOP AND THE WIDER WORLD (1.8.1) ----
 *
 * The technical manual's tester notes for the season loop and the world around
 * it found a run of things that worked once, or only in the men's game, or only
 * while the manager had a job. Each check below is one of those notes, held at
 * the engine so it cannot come back quietly.
 *
 *   THE SUMMER. The close-season diary, the week a man last played, the
 *   manager's own team sheet, the open jobs and the union's letter all had to
 *   survive the rollover, or be cleared by it, and several did the opposite.
 *
 *   OUT OF WORK. userClubId still names the club that sacked him, so a trophy
 *   or a challenge that club won after he left was going on his record.
 *
 *   THE WOMEN'S WORLD. Its Grand Slam and Wooden Spoon were never announced,
 *   and none of its matches was ever a derby.
 *
 *   THE WIDER WORLD. Derbies to come were invisible, the hunt's bid died the
 *   week it was made, a Test win lowered the manager's reputation, and the
 *   ranking exchange created points at its bounds and gave a World
 *   Championship "home" side three points of soil it was not standing on.
 *
 * Run: npx vite-node scripts/careerloop.ts
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { bookEvent, bookedThisWeek, eventSlate } from '../src/game/closeseason'
import { applyForJob, jobChance, sackManager } from '../src/game/jobs'
import { challengeCheck } from '../src/game/rollover'
import { snIdFor, snWeeksFor } from '../src/game/schedule'
import { seasonTentpoles } from '../src/game/stakes'
import { isDerby } from '../src/game/rivalries'
import { dreamsFor, DREAMS } from '../src/game/dream'
import { updateNatRank } from '../src/game/natrank'
import { applyPinnacle } from '../src/game/grants'
import { advanceHunt, talismanOf } from '../src/game/living'
import { SEASON_WEEKS, type Fixture, type GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const runTo = (g: GameState, season: number, week: number) => {
  let guard = 0
  while ((g.season < season || (g.season === season && g.week < week)) && guard++ < 400) processWeekAndAdvance(g)
}
const coachless = (g: GameState) => Object.values(g.clubs).filter(c =>
  c.id !== g.userClubId && !c.coach && !g.vacancies.some(v => v.clubId === c.id)).map(c => c.short)

// ---- 1. the summer --------------------------------------------------------
console.log('--- 1. the summer')
{
  const g = newGame('leicester', 'Probe', 777)
  runTo(g, 0, 44)
  // the manager's own sheet: the auto-pick's with two bench shirts swapped, so
  // it is his and not a sheet the rollover could have written by itself
  const club = g.clubs[g.userClubId]
  const sheet = [...club.tactic.lineup]
  ;[sheet[15], sheet[16]] = [sheet[16], sheet[15]]
  club.tactic.lineup = [...sheet]
  club.tactic.userPicked = true
  runTo(g, 0, 46)
  const slate = eventSlate(g)
  ok(slate.length > 0 && !bookedThisWeek(g), 'the first July has a diary with room in it')
  bookEvent(g, slate[0].id)
  ok(!!bookedThisWeek(g), 'and a booking fills the week')
  g.natOffer = { nat: 'ENG', week: 46 }
  runTo(g, 1, 1)
  ok(g.season === 1 && g.week === 1, 'the season turns')
  ok(Object.keys(g.closeBook ?? {}).length === 0, 'last summer\'s diary is cleared')
  const stale = Object.values(g.players).filter(p => p.lastWk != null).length
  ok(stale === 0, `nobody carries last season's "played this week" into the new one (${stale})`)
  const lu = club.tactic.lineup
  const stayed = sheet.map((id, i) => ({ id, i })).filter(x => x.id != null &&
    g.players[x.id]?.clubId === club.id && !g.players[x.id].loanFrom)
  const moved = stayed.filter(x => lu[x.i] !== x.id).length
  ok(club.tactic.userPicked === true, 'the manager\'s sheet is still his after the summer')
  ok(moved === 0, `every man still at the club keeps the shirt he was given (${stayed.length} kept, ${moved} moved)`)
  ok(lu.slice(0, 23).every(id => id != null) && new Set(lu).size === lu.length,
    'and the shirts of the men who left are filled, nobody twice')
  ok(g.vacancies.every(v => v.week <= 1), 'open jobs carry over on the new season\'s clock')
  ok(g.natOffer?.week === 46 - SEASON_WEEKS, `the union's letter keeps its clock too (week ${g.natOffer?.week})`)
  runTo(g, 1, 5)
  ok(!g.natOffer, 'and lapses three weeks after it was written, not never')
  const empty = coachless(g)
  ok(empty.length === 0, `every club with no open job has a coach in week 5 (${empty.join(', ') || 'all'})`)
  runTo(g, 1, 46)
  ok(!bookedThisWeek(g), 'the second July\'s diary is open')
  const again = eventSlate(g)
  ok(again.length > 0 && !bookEvent(g, again[0].id).includes('already') && !!bookedThisWeek(g),
    'and it takes a booking')
  runTo(g, 2, 13)
  const later = coachless(g)
  ok(later.length === 0, `two summers in, still nobody coachless (${later.join(', ') || 'all'})`)
}

// ---- 2. out of work -------------------------------------------------------
console.log('\n--- 2. a club that sacked him is not his')
{
  const g = newGame('leicester', 'Probe', 4242)
  processWeekAndAdvance(g)
  sackManager(g, 'news.sacked')
  g.sacked = null
  // his old club wins its league final, settled by hand this week
  const league = g.clubs[g.userClubId].leagueId
  const final: Fixture = {
    id: g.nextId++, compId: league, round: 99, week: g.week, stage: 'F',
    homeId: g.userClubId, awayId: g.comps[league].teamIds.find(id => id !== g.userClubId)!,
    played: true, homeScore: 30, awayScore: 10, homeTries: 4, awayTries: 1,
  }
  g.fixtures.push(final)
  const trophies = g.mgr.trophies.length
  processWeekAndAdvance(g)
  ok(g.comps[final.compId].champion === g.userClubId, `the old club lifts the ${g.comps[final.compId].name}`)
  ok(g.mgr.trophies.length === trophies, 'and the man they sacked is not credited with it')
  ok(!g.news.some(n => n.k === 'news.youWonCup'), 'nor told it is his')

  const c = newGame('montauban', 'Probe', 4242, 'sapiac')
  challengeCheck(c)
  ok(c.challenge === undefined, 'control: in the job, the Sapiac challenge completes')
  const s = newGame('montauban', 'Probe', 4242, 'sapiac')
  sackManager(s, 'news.sacked')
  challengeCheck(s)
  ok(s.challenge === 'sapiac', 'out of it, his successor cannot complete it for him')
}

// ---- 3. the women's championship --------------------------------------------
console.log('\n--- 3. the women\'s Slam and Spoon')
for (const gender of ['m', 'w'] as const) {
  const g = gender === 'w'
    ? newGame(LEAGUE_DEFS('w')[0].clubs[0].id, 'Probe', 31, undefined, 'coach', 'w')
    : newGame('bath', 'Probe', 31)
  const sn = g.comps[snIdFor(gender)]
  const last = snWeeksFor(gender)[snWeeksFor(gender).length - 1]
  for (const f of g.fixtures) if (f.compId === sn.id || f.week < last) f.played = true
  const [top, ...rest] = sn.table
  const bottom = rest[rest.length - 1]
  for (const r of sn.table) Object.assign(r, { p: 5, w: 2, d: 0, l: 3, pts: 10 })
  Object.assign(top, { w: 5, l: 0, pts: 25 })
  Object.assign(bottom, { w: 0, l: 5, pts: 0 })
  g.week = last
  const before = g.news.length
  processWeekAndAdvance(g)
  const keys = g.news.slice(before).map(n => n.k)
  ok(keys.includes('news.slam') || keys.includes('news.slamYours'), `${gender}: a Grand Slam is announced (${top.teamId})`)
  ok(keys.includes('news.spoon') || keys.includes('news.spoonYours'), `${gender}: and so is the Wooden Spoon (${bottom.teamId})`)
}

// ---- 4. derbies -------------------------------------------------------------
console.log('\n--- 4. derbies, before they are played and in both worlds')
{
  const g = newGame('northampton', 'Probe', 777)
  const coming = g.fixtures.filter(f => !f.played && isDerby(f.homeId, f.awayId) &&
    (f.homeId === 'northampton' || f.awayId === 'northampton'))
  const marked = seasonTentpoles(g).filter(t => t.icon === 'derby')
  ok(coming.length > 0 && marked.length === coming.length,
    `the season strip shows every derby still to come (${marked.length} of ${coming.length})`)
  ok(isDerby('w:saracens', 'w:quins') && isDerby('w:glasgow', 'w:edinburgh'), 'the women\'s game has derbies')
  const w = newGame('w:saracens', 'Probe', 777, undefined, 'coach', 'w')
  const wd = w.fixtures.filter(f => isDerby(f.homeId, f.awayId)).length
  ok(wd > 0, `and its fixture list has them in it (${wd})`)
}

// ---- 5. the dreams ----------------------------------------------------------
console.log('\n--- 5. dreams a club can actually finish')
{
  const offered = (clubId: string, leagueId: string) =>
    dreamsFor({ clubId, clubName: clubId, leagueId, rep: 60 }).map(d => d.id)
  ok(!offered('w:bathw', 'w:champ').includes('double'),
    'the women\'s Championship is not offered a double it can never enter the cup for')
  ok(offered('w:saracens', 'w:pwr').includes('double'), 'the top flight still is')
  ok(!offered('w:bathw', 'w:champ').includes('topflight'),
    'nor promotion, in a world whose leagues are ringfenced')
  const g = newGame('leicester', 'Probe', 777)
  const dynasty = DREAMS.find(d => d.id === 'dynasty')!
  g.mgr.finishes = [0, 1, 2].map(season => ({ season, leagueId: 'prem', pos: 1, clubId: 'leicester' }))
  ok(!dynasty.progress(g).done, 'topping the table three times and losing three finals is not a dynasty')
  g.mgr.trophies = [0, 1, 2].map(season => ({ compId: 'prem', season, clubId: 'leicester' }))
  ok(dynasty.progress(g).done, 'three league titles running is')
}

// ---- 6. the wider world -----------------------------------------------------
console.log('\n--- 6. the wider world')
{
  // the hunt's bid lands in the last open week of the window, and is still on
  // the desk when the manager next looks
  const g = newGame('leicester', 'Probe', 777)
  const star = talismanOf(g, g.userClubId)!
  const rival = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.rep >= 70)!
  g.hunt = { clubId: rival.id, playerId: star.id, stage: 2, season: g.season }
  g.week = 26
  advanceHunt(g)
  ok(g.hunt.stage === 2, 'no bid before its week')
  g.week = 27
  processWeekAndAdvance(g)
  const bid = g.offers.find(o => o.playerId === star.id && o.fromClubId === rival.id)
  ok(bid?.status === 'pending', `the hunt's bid is pending when the manager reads it in week ${g.week}`)
}
{
  // a Test win counts in the weighted record as well as the plain one
  const g = newGame('bath', 'Probe', 4242)
  applyPinnacle(g, 'ENG')
  const w0 = g.mgr.w, ww0 = g.mgr.ww ?? g.mgr.w
  for (let i = 0; i < 44; i++) processWeekAndAdvance(g)
  const natW = g.natRecord?.w ?? 0
  ok(natW > 0, `England won ${natW} Test${natW === 1 ? '' : 's'}`)
  ok(Math.abs(((g.mgr.ww ?? g.mgr.w) - ww0) - (g.mgr.w - w0)) < 1e-9,
    'and at a top-flight club every win, Test or club, weighs one in the reputation record')
}
{
  // two jobs at clubs of equal standing, applied for in the same week, are two
  // decisions and not one roll
  let differ = 0, mid = 0
  for (let seed = 1; seed <= 40; seed++) {
    const g = newGame('leicester', 'Probe', seed)
    sackManager(g, 'news.sacked')
    const [a, b] = Object.values(g.clubs).filter(c => c.leagueId === 'champ' && c.rep <= 52).slice(0, 2)
    b.rep = a.rep
    g.vacancies = [{ clubId: a.id, week: g.week }, { clubId: b.id, week: g.week }]
    const chance = jobChance(g, a.id)
    if (chance < 0.2 || chance > 0.8 || Math.abs(jobChance(g, b.id) - chance) > 1e-9) continue
    mid++
    applyForJob(g, a.id); const gotA = !!g.jobOffer; g.jobOffer = null
    applyForJob(g, b.id); const gotB = !!g.jobOffer
    if (gotA !== gotB) differ++
  }
  ok(mid > 0 && differ > 0, `equal clubs, same week: ${differ} of ${mid} pairs answered differently`)
}
{
  // the ranking exchange is an exchange, and a World Championship has no home soil
  const g = newGame('bath', 'Probe', 4242)
  const fx = (compId: string, h: number, a: number): Fixture => ({
    id: 1, compId, round: 0, week: 1, homeId: 'ENG', awayId: 'FRA', played: true,
    homeScore: h, awayScore: a, homeTries: 0, awayTries: 0,
  })
  g.natRank = { ENG: 99.9, FRA: 95 }
  updateNatRank(g, fx('aut', 40, 10))
  ok(g.natRank.ENG === 100 && Math.abs(g.natRank.ENG + g.natRank.FRA - 194.9) < 1e-6,
    `a side at the ceiling takes only what the ceiling allows, and the loser pays only that (${g.natRank.ENG} + ${g.natRank.FRA})`)
  g.natRank = { ENG: 80, FRA: 80 }
  updateNatRank(g, fx('wc', 20, 20))
  ok(g.natRank.ENG === 80 && g.natRank.FRA === 80, 'a World Championship draw between equals moves nothing')
  g.natRank = { ENG: 80, FRA: 80 }
  updateNatRank(g, fx('aut', 20, 20))
  ok(g.natRank.ENG < 80, 'a home draw between equals still costs the hosts')
}

console.log('')
if (fails === 0) console.log('CAREER LOOP PASSED: the summer, the sack, the women\'s world and the wider one all hold')
else console.log(`CAREER LOOP FAILED (${fails})`)
process.exit(fails)
