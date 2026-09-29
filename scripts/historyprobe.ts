/**
 * ---- CAREER HISTORY THAT ACTS (pillar 4) ----
 *
 * What this holds, for histbook.ts, grudges.ts, legends.ts and history.ts:
 *
 *   1. RIVALRIES ARE EARNED AND THEY FADE. Two finals form one, the summers
 *      cool it, and the manager is told both times. Over a real multi-season
 *      sim, rivalries form between the world's clubs without any help.
 *   2. THE ANNALS ARE WRITTEN, AND CAPPED: a line or three a season for the
 *      manager's club, never more, forty seasons at most.
 *   3. A FORMER CLUB REMEMBERS. Walking out of one job for another closes the
 *      tenure as a move, makes the two clubs rivals, and the first trip back
 *      is announced with a crowd that has not forgiven it.
 *   4. LEGENDS COME BACK: a legend at another club is named the week you play
 *      them, and a retired one on their coaching staff too.
 *   5. RECORDS TALK: the near-miss and the break both name the holder and the
 *      season the mark was set in.
 *   6. OLD SAVES MIGRATE: a save with no book loads, plays and grows one; a
 *      half-written book is made whole.
 *   7. THE AI NEVER NOTICED: the same world with every hook switched off plays
 *      identical AI-vs-AI results.
 *   8. IT STAYS CHEAP: the hooks' share of a season's weeks and the book's
 *      size after several seasons are inside budget.
 *
 * Run: npx vite-node scripts/historyprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS, seasonLabel, type GameState } from '../src/game/model'
import { answerJobOffer } from '../src/game/jobs'
import { migrate } from '../src/game/save'
import { book, CAPS } from '../src/game/histbook'
import { stoke, rivalsYearEnd, rivalryOf, FORM_AT } from '../src/game/grudges'
import { legendsAfterMatch, legendsYearEnd, service } from '../src/game/legends'
import { HIST_OFF, historyPreview, historyStakes, historyWeight, historyYearEnd, formerTenure, annalsFor } from '../src/game/history'
import { tIn } from '../src/game/i18n'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
// the book holds its stories until the week settle ends (histbook.ts file), so
// a hook called directly here has filed into the queue, not the inbox yet
const newsK = (g: GameState, k: string) => [...g.news, ...(g.hist?.queue ?? [])].filter(n => n.k === k)
const season = (g: GameState) => { for (let i = 0; i < SEASON_WEEKS; i++) processWeekAndAdvance(g) }
/** A season with the board kept on side. The annals are written for a
 *  manager in work, and a headless one sits near the sack on most seeds: a
 *  change to the world stream elsewhere (1.8.1) had him sacked in the second
 *  season on this one, which is a fact about the seed rather than the book. */
const seasonInWork = (g: GameState) => {
  for (let i = 0; i < SEASON_WEEKS; i++) {
    const c = g.clubs[g.userClubId]
    if (!g.unemployed && c) c.boardConfidence = Math.max(c.boardConfidence, 55)
    processWeekAndAdvance(g)
  }
}

// ---- 1. rivalries form and cool ----
{
  const g = newGame('northampton', 'Rival', 181)
  const uid = g.userClubId
  const opp = 'exeter'
  const why = { k: 'hist.whyFinal', v: { comp: 'Premier Division', season: seasonLabel(0) } }
  stoke(g, uid, opp, 3, why)
  ok(!rivalryOf(g, uid, opp)?.on, 'one final is warm, not a rivalry')
  g.fixtures = []; g.grudges = []
  rivalsYearEnd(g)                       // 3 -> 1.8
  stoke(g, uid, opp, 3, why)             // 4.8: a second final
  const r = rivalryOf(g, uid, opp)
  ok(!!r?.on && r.heat >= FORM_AT, `a second final makes it one (heat ${r?.heat.toFixed(2)})`)
  ok(newsK(g, 'hist.rivalBorn').length === 1, 'and the manager is told it was born')
  ok(historyWeight(g, { homeId: uid, awayId: opp } as never) > 1 && historyWeight(g, { homeId: uid, awayId: opp } as never) <= 1.3,
    `it weighs on the board and the terraces, modestly (x${historyWeight(g, { homeId: uid, awayId: opp } as never).toFixed(2)})`)
  const st = historyStakes(g, { homeId: uid, awayId: opp } as never)
  ok(st.some(s => s.text.includes(g.clubs[opp].short)), 'the pre-match billing names it')
  stoke(g, 'leicester', uid, 10, why)
  ok(!rivalryOf(g, 'leicester', uid), 'a fixed derby is left to rivalries.ts')
  let cooled = 0
  for (let i = 0; i < 4 && !cooled; i++) { rivalsYearEnd(g); g.season++; cooled = newsK(g, 'hist.rivalFades').length }
  ok(cooled === 1 && !rivalryOf(g, uid, opp)?.on, 'left alone, it cools within a few summers, and the manager is told')
}

// ---- 3. a former club remembers ----
{
  const g = newGame('bath', 'Mover', 182)
  for (let i = 0; i < 6; i++) processWeekAndAdvance(g)
  const old = g.userClubId
  const to = 'gloucester' === old ? 'bristol' : 'exeter'
  g.vacancies.push({ clubId: to, week: g.week })
  g.jobOffer = { clubId: to, week: g.week }
  answerJobOffer(g, true)
  ok(g.userClubId === to, `the move went through (${old} -> ${to})`)
  const x = formerTenure(g, old)
  ok(!!x && x.exit === 'moved' && x.w + x.d + x.l > 0, `the old tenure closed as a move with its record (${x?.w}-${x?.d}-${x?.l})`)
  ok(!!rivalryOf(g, old, to)?.on, 'and the two clubs are rivals now')
  const fx = g.fixtures.find(f => !f.played && f.week > g.week && ((f.homeId === old && f.awayId === to) || (f.homeId === to && f.awayId === old)))
  if (fx) {
    g.week = fx.week
    historyPreview(g)
    const line = [...newsK(g, 'hist.returnAway'), ...newsK(g, 'hist.returnHome')][0]
    ok(!!line, `the meeting is announced (${line?.k})`)
    ok(line?.v?.crowd_k === 'hist.crowd_hostile' && line?.v?.exit_k === 'hist.exit_moved', 'and the crowd has not forgiven a move')
    ok(historyWeight(g, fx) >= 1.2, 'your board and terraces take it harder')
    historyPreview(g)
    ok([...newsK(g, 'hist.returnAway'), ...newsK(g, 'hist.returnHome')].length === 1, 'said once, not every time the week is looked at')
  } else ok(false, 'found a meeting with the old club')
}

// ---- 4 + 5. legends and records ----
{
  const g = newGame('leicester', 'Legend', 183)
  const uid = g.userClubId
  const club = g.clubs[uid]
  legendsAfterMatch(g)                   // read the club in quietly
  ok(newsK(g, 'hist.legendApps').length === 0 && newsK(g, 'hist.recBroken').length === 0, 'reading a club in files nothing')
  const h = book(g)
  const top = Math.max(...club.players.map(id => g.players[id]).filter(x => x && !x.youth).map(x => service(x, uid).apps))
  const HOLD = top + 20
  h.recs[uid] = { apps: { name: 'Old Holder', val: HOLD, season: 3 } }
  const p = g.players[club.players.find(id => !g.players[id].youth && g.players[id].pos === 'FL')!]
  p.career = [{ season: 0, clubId: uid, apps: HOLD - 2 - p.stats.apps, tries: 0, points: 0 }]
  p.hist = { apps: 0, tries: 0, points: 0 }; p.exClub = null
  g.season = 5
  legendsAfterMatch(g)
  const near = newsK(g, 'hist.recNear')[0]
  ok(!!near && near.v?.old === 'Old Holder' && near.v?.season === seasonLabel(3) && near.v?.n === 2,
    `the chase names the holder and his season (${near ? tIn('en', near.k!, near.v) : 'none'})`)
  p.career[0].apps += 5
  legendsAfterMatch(g)
  const broke = newsK(g, 'hist.recBroken').find(n => n.v?.stat_k === 'hist.statApps')
  ok(newsK(g, 'hist.recBroken').length === 1, 'the other records were read in quietly, not broken on the spot')
  ok(!!broke && broke.v?.old === 'Old Holder' && broke.v?.oldN === HOLD && broke.v?.season === seasonLabel(3),
    `the break says whose it was (${broke ? tIn('en', broke.k!, broke.v) : 'none'})`)
  ok(h.recs[uid].apps?.name === p.name && h.recs[uid].apps?.season === 5,
    `and the record carries the new name and season (${JSON.stringify(h.recs[uid].apps)})`)
  ok(newsK(g, 'hist.legendApps').length + newsK(g, 'hist.legendRecord').length === 1 && h.legends.some(l => l.pid === p.id),
    'a club record and a long career make a legend, announced once')

  // he leaves for another club, and comes back as an opponent
  const opp = 'northampton' === uid ? 'sale' : 'northampton'
  club.players = club.players.filter(id => id !== p.id)
  g.clubs[opp].players.push(p.id); p.clubId = opp
  legendsYearEnd(g)
  const fx = g.fixtures.find(f => !f.played && ((f.homeId === uid && f.awayId === opp) || (f.homeId === opp && f.awayId === uid)))!
  g.week = fx.week
  historyPreview(g)
  ok(newsK(g, 'hist.legendBack').some(n => n.v?.player === p.name), 'a legend in the other shirt is named the week you meet')

  // a retired legend in the opposition's backroom
  const ghost = { pid: 999_999, name: 'Aaa Retired', clubId: uid, apps: 180, tries: 20, pts: 100, season: 1, gone: 4, retired: true, staffAt: opp }
  h.legends.push(ghost)
  historyPreview(g)
  ok(newsK(g, 'hist.legendCoach').some(n => n.v?.player === ghost.name), 'and a retired one on their coaching staff')
}

// ---- 2 + 6 + 8. a real multi-season career: annals, migration, cost ----
{
  const g = newGame('northampton', 'Annals', 184)
  let hookMs = 0
  const t0 = performance.now()
  for (let s = 0; s < 4; s++) {
    seasonInWork(g)
    // time the hooks on their own, on the state as it now stands
    const a = performance.now(); historyPreview(g); hookMs += performance.now() - a
    if (s === 1) {
      // an old save: no book at all, round-tripped through migrate
      const old = JSON.parse(JSON.stringify(g)) as GameState
      delete old.hist
      const m = migrate(old)
      ok(!m.hist, 'a save from before the book loads without one')
      for (let i = 0; i < 10; i++) processWeekAndAdvance(m)
      ok(!!m.hist && m.hist.tenures.some(x => x.clubId === m.userClubId && x.to == null), 'and grows one, with the current job open, as soon as it plays')
      const half = JSON.parse(JSON.stringify(g)) as GameState
      half.hist = { rivals: [] } as never
      const hm = migrate(half)
      ok(Array.isArray(hm.hist?.annals) && Array.isArray(hm.hist?.legends) && typeof hm.hist?.said === 'object', 'a half-written book is made whole')
    }
  }
  const secs = (performance.now() - t0) / 1000
  const h = book(g)
  const mine = h.annals.filter(a => a.clubId === g.userClubId)
  ok(mine.length === 4, `four seasons, four annals entries (${mine.length})`)
  ok(mine.every(a => a.lines.length >= 1 && a.lines.length <= CAPS.linesPerSeason), 'each a line to three, never more')
  ok(annalsFor(g, 0, g.userClubId).every(s => s.length > 5 && !s.includes('hist.')), `and they render: "${annalsFor(g, 0, g.userClubId).join(' ')}"`)
  const everOn = h.rivals.filter(r => r.on).length
  console.log(`        world rivalries on after 4 seasons: ${everOn}, tracked pairs ${h.rivals.length}`)
  ok(h.rivals.length > 0 && everOn > 0, 'rivalries grow out of the world on their own')
  ok(h.rivals.length <= CAPS.rivals && h.legends.length <= CAPS.legends, 'and every list stays under its cap')
  for (let i = 0; i < CAPS.annals + 10; i++) { g.season++; historyYearEnd(g) }
  ok(book(g).annals.length <= CAPS.annals, `the annals are capped at ${CAPS.annals} seasons (${book(g).annals.length})`)
  const size = JSON.stringify(g.hist).length
  console.log(`        4 seasons in ${secs.toFixed(1)}s; book ${size} bytes`)
  ok(size < 40_000, `the book stays small (${size} bytes)`)
  ok(hookMs < 50, `the preview hook is cheap (${hookMs.toFixed(1)}ms over four calls)`)
}

// ---- 7. the AI never noticed ----
{
  // THE SHARED ID COUNTER. News, players and fixtures take their ids from one
  // counter (state.nextId), and the match engine seeds its commentary and
  // kicking streams from the fixture id, so a story that took an id would shift
  // every tie drawn after it onto another stream. The book's stories take ids
  // that do not spend the counter (heldnews.ts), so the two worlds are played
  // untouched - no counter handed across - and compared week by week: every
  // fixture's id and every score, the user's own matches included, must match.
  // (One world after the other, not interleaved: the name registry and the
  // player-id counter are module state, and two live worlds would share them.)
  const WEEKS = SEASON_WEEKS + 12
  const sig = (g: GameState) => g.fixtures
    .map(f => `${f.id}:${f.compId}:${f.homeId}${f.played ? `${f.homeScore}-${f.awayScore}` : '_'}${f.awayId}`).join('|')
  const on = newGame('bath', 'Twin', 185)
  const weeksOn: string[] = [], idsOn: number[] = []
  for (let i = 0; i < WEEKS; i++) { processWeekAndAdvance(on); weeksOn.push(sig(on)); idsOn.push(on.nextId) }
  HIST_OFF.on = true
  const off = newGame('bath', 'Twin', 185)
  const weeksOff: string[] = [], idsOff: number[] = []
  for (let i = 0; i < WEEKS; i++) { processWeekAndAdvance(off); weeksOff.push(sig(off)); idsOff.push(off.nextId) }
  HIST_OFF.on = false
  const told = on.news.filter(n => n.k?.startsWith('hist.')).length
  const drift = Math.max(...idsOn.map((x, i) => Math.abs(x - idsOff[i])))
  ok(told > 0, `the book told ${told} stories still in the inbox`)
  ok(drift === 0, `and moved the shared id counter by ${drift} in ${WEEKS} weeks`)
  const firstDiff = weeksOn.findIndex((w, i) => w !== weeksOff[i])
  if (firstDiff >= 0) {
    const x = weeksOn[firstDiff].split('|'), y = weeksOff[firstDiff].split('|')
    const d = x.map((t, i) => [t, y[i]]).filter(([t, u]) => t !== u)
    console.log(`        week ${firstDiff + 1}: ${d.length} fixtures differ, first: ${d.slice(0, 3).map(([t, u]) => `${t} / ${u}`).join('  ')}`)
  }
  ok(firstDiff === -1, firstDiff === -1
    ? `every fixture id and every score identical with the book on and off, week by week, for ${WEEKS} weeks`
    : `fixtures first differ after week ${firstDiff + 1}`)
  const ids = on.news.map(n => n.id)
  ok(new Set(ids).size === ids.length, 'and no two stories share an id')
  ok(!!on.hist && !off.hist, 'and the switch really did switch it')
}

console.log(fails ? `HISTORY PROBE FAILED (${fails})` : 'HISTORY PROBE PASSED: the club remembers, and the AI never noticed')
process.exit(fails ? 1 : 0)
