// Probe: the four 1.8.2 rewarded favours are fees and waits replaced, on a leash.
//
// docs/monetisation-spec.md §2-3.1, the 1.8.2 rows. Each placement is held to
// the same five promises as the four before it:
//
//   0. it renders only where a provider with rewarded spots exists, and only
//      a completed view pays (monetise.rewardedAvailable / showRewarded)
//   1. THE AGENT'S INSIDE WORD resolves one rumour line to the full file's
//      read, for one spell of talk, two a game-week
//   2. A SECOND OPINION narrows one of your youngsters' ceiling bands by one
//      step, never to the number, once per player per season
//   3. TAPE ROOM NIGHT reads the tape line as a top setup would, one match
//   4. THE SPONSOR'S TEAM NIGHT halves the senior men's hit when you stand by
//      a selection call, once in four game-weeks, across a summer too
//
// and for every one: it changes what it says and nothing else in the save, it
// spends no draw (Math.random is poisoned while it runs, and the world is
// derived from the seed and the week), and it never reaches an AI club.
//
// Run: npx vite-node scripts/rewarded182probe.ts
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { answerPress } from '../src/game/media'
import { absWeek, type GameState, type Player, type PressItem } from '../src/game/model'
import * as M from '../src/game/monetise'
import {
  canInsideWord, canSecondOpinion, canTapeRoom, canTeamNight, insideWordFavour, secondOpinionFavour,
  tapeRoomFavour, teamNightFavour, TEAM_NIGHT_WEEKS,
} from '../src/game/rewarded'
import { rivalTalk, talkPremium, FULL_FILE } from '../src/game/recruit'
import { paRange, reportStage, youthPaMargin } from '../src/game/scout'
import { buildReport, reportAccuracy } from '../src/game/oppreport'
import { adaptMap, tapeLine } from '../src/game/armsrace'
import { playbookOf } from '../src/game/playbook'
import { roomKind, TEAM_NIGHT } from '../src/game/room'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const clone = (g: GameState): GameState => JSON.parse(JSON.stringify(g))

/** Run a favour with Math.random poisoned: any draw at all fails the probe. */
function noDraw<T>(fn: () => T): T {
  const real = Math.random
  let drew = false
  Math.random = () => { drew = true; return real() }
  try { return fn() } finally {
    Math.random = real
    ok(!drew, '  (and it drew nothing from Math.random)')
  }
}

/** Every path in the save that differs, ignoring the given top-level keys. */
function diffPaths(a: unknown, b: unknown, path = '', out: string[] = [], ignore: string[] = []): string[] {
  if (out.length > 40) return out
  if (a === b) return out
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    if (!(typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9)) out.push(path)
    return out
  }
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
  for (const k of keys) {
    if (!path && ignore.includes(k)) continue
    diffPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out)
  }
  return out
}

const aiClubs = (g: GameState) => JSON.stringify(Object.values(g.clubs).filter(c => c.id !== g.userClubId))

// ------------------------------------------------------------------ 0
console.log('--- 0. only with a provider, only on a completed view\n')
{
  const g = globalThis as unknown as { rmAds?: unknown }
  const NEW = ['inside', 'opinion', 'taperoom', 'teamnight'] as const
  delete g.rmAds
  ok(NEW.every(p => !M.rewardedAvailable(p)), 'no provider (the web build): none of the four buttons renders')
  g.rmAds = { mount: () => {} }
  ok(NEW.every(p => !M.rewardedAvailable(p)), 'a banner-only provider: still none')
  let asked = ''
  g.rmAds = { mount: () => {}, showRewarded: async (p: string) => { asked = p; return 'completed' as const } }
  ok(NEW.every(p => M.rewardedAvailable(p)), 'a provider with rewarded spots: all four may render')
  ok(await M.showRewarded('inside') === 'completed' && asked === 'inside', 'the spot is asked for by its own name')
  for (const out of ['skipped', 'unavailable', 'garbage'] as const) {
    g.rmAds = { mount: () => {}, showRewarded: async () => out }
    const got = await M.showRewarded('teamnight')
    ok(got !== 'completed', `a provider saying '${out}' is never a completed view ('${got}')`)
  }
  g.rmAds = { mount: () => {}, showRewarded: async () => { throw new Error('boom') } }
  ok(await M.showRewarded('opinion') === 'unavailable', 'a provider that throws is unavailable, never paid')
  // the screens call the store's reward only on 'completed' (ScoutReport,
  // PlayerScreen, OppReport, Press): a skipped view leaves the ledger alone
  const s = newGame('northampton', 'Rewarded 182', 8201)
  const before = JSON.stringify(s)
  g.rmAds = { mount: () => {}, showRewarded: async () => 'skipped' as const }
  const out = await M.showRewarded('opinion')
  if (out === 'completed') secondOpinionFavour(s, s.clubs[s.userClubId].players[0])
  ok(JSON.stringify(s) === before, 'a skipped spot changes nothing in the save')
  delete g.rmAds
}

// ------------------------------------------------------------------ 1
console.log('\n--- 1. the agent\'s inside word\n')
{
  const g = newGame('northampton', 'Rewarded 182', 8202)
  g.week = 6
  // men with a line on the report and less than the full file on them
  const withTalk = (h: GameState) => Object.values(h.players)
    .filter(p => p.clubId && p.clubId !== h.userClubId && reportStage(h, p) < 3)
    .filter(p => { h.shortlist.includes(p.id) || h.shortlist.push(p.id); return !!rivalTalk(h, p) })
  const pool = withTalk(g)
  ok(pool.length >= 4, `enough rumours in the world to test on (${pool.length})`)
  const [a, b, c, d] = pool
  const mine = g.players[g.clubs[g.userClubId].players[0]]!
  ok(!canInsideWord(g, mine.id), 'no inside word on your own man')
  const full = pool.find(p => p !== a) ?? b
  const fullC = clone(g); fullC.players[full.id].sc = 100
  ok(!canInsideWord(fullC, full.id), 'nor on a man the full file already reads')
  // what the chief scout would say at the full file, on a twin
  const twin = clone(g); twin.players[a.id].sc = Math.max(FULL_FILE, twin.players[a.id].sc ?? 20)
  const expect = rivalTalk(twin, twin.players[a.id])
  const sc0 = a.sc, prem0 = talkPremium(g, a)
  const others0 = pool.slice(1).map(p => JSON.stringify(rivalTalk(g, p)))
  const pre = clone(g)
  ok(canInsideWord(g, a.id), 'a rumour on a man we are still learning about qualifies')
  ok(noDraw(() => insideWordFavour(g, a.id)), 'the inside word goes through')
  ok(JSON.stringify(rivalTalk(g, a)) === JSON.stringify(expect), `the line reads as the full file reads it (${expect?.read})`)
  ok(a.sc === sc0, 'his scouting knowledge is untouched: the rest of his report is as it was')
  ok(talkPremium(g, a) === prem0, 'the rumour, and the premium it costs, are the same')
  ok(pool.slice(1).every((p, i) => JSON.stringify(rivalTalk(g, p)) === others0[i]), 'every other man\'s line is as it was')
  ok(diffPaths(pre, g, '', [], ['rewarded']).length === 0, `nothing else in the save moved (${diffPaths(pre, g, '', [], ['rewarded']).join(', ')})`)
  ok(!canInsideWord(g, a.id), 'once per man per spell of talk')
  ok(insideWordFavour(g, b.id), 'a second man the same week')
  ok(!canInsideWord(g, c.id) && !insideWordFavour(g, c.id), 'the third in a game-week is refused')
  g.week += 1
  ok(canInsideWord(g, c.id) || !rivalTalk(g, c), 'and the next week allows it again')
  // the spell of talk ends and the word goes with it
  const spellEnd = clone(g); spellEnd.week = 12
  ok(!spellEnd.rewarded?.insideSeen || rivalTalk(spellEnd, spellEnd.players[a.id]) === null ||
    canInsideWord(spellEnd, a.id) || reportStage(spellEnd, spellEnd.players[a.id]) >= 3,
    'a new spell of talk is a new rumour: the old word does not carry over')
  // across a season: the week ledger is stamped in absolute weeks
  const nextSeason = clone(g); nextSeason.season += 1; nextSeason.week = g.week
  ok(absWeek(nextSeason.season, nextSeason.week) !== absWeek(g.season, g.week), 'the same week number next season is a different game-week')
  void d
}

// ------------------------------------------------------------------ 2
console.log('\n--- 2. a second opinion\n')
{
  const g = newGame('northampton', 'Rewarded 182', 8203)
  const squad = g.clubs[g.userClubId].players.map(id => g.players[id]!)
  const young = squad.filter(p => p.age <= 21 && youthPaMargin(g, p) > 1)
  ok(young.length >= 2, `young men whose ceiling is still a wide band (${young.length})`)
  const [a, b] = young
  const ai = Object.values(g.players).find(p => p.clubId && p.clubId !== g.userClubId && p.age <= 21)!
  ok(!canSecondOpinion(g, ai.id), 'never on another club\'s man')
  const m0 = youthPaMargin(g, a), band0 = paRange(g, a)!, pa0 = a.pa
  const bandB = JSON.stringify(paRange(g, b)), aiBand = JSON.stringify(paRange(g, ai))
  const pre = clone(g), world0 = aiClubs(g)
  ok(noDraw(() => secondOpinionFavour(g, a.id)), 'the second opinion goes through')
  const band1 = paRange(g, a)!
  ok(youthPaMargin(g, a) === m0 - 1, `one step narrower: margin ${m0} -> ${youthPaMargin(g, a)}`)
  ok(band1[1] - band1[0] <= band0[1] - band0[0] && band1[0] < band1[1],
    `the band narrows and is still a band (${band0.join('-')} -> ${band1.join('-')})`)
  ok(band1[0] <= a.pa && a.pa <= band1[1], 'and it still holds the truth')
  ok(a.pa === pa0, 'the man himself is untouched')
  ok(JSON.stringify(paRange(g, b)) === bandB && JSON.stringify(paRange(g, ai)) === aiBand, 'no other man\'s band moved')
  ok(aiClubs(g) === world0, 'no AI club moved')
  ok(diffPaths(pre, g, '', [], ['rewarded']).length === 0, 'nothing else in the save moved')
  ok(!canSecondOpinion(g, a.id), 'once per player per season')
  g.week += 5
  ok(!canSecondOpinion(g, a.id) && youthPaMargin(g, a) === m0 - 1, 'weeks later: still spent, and still narrower')
  ok(canSecondOpinion(g, b.id), 'another youngster is his own question')
  // the floor: a man already at one point is never read as the number
  const floor = clone(g)
  floor.staff = { ...(floor.staff ?? {}), assistant: 3 } as GameState['staff']
  floor.clubs[floor.userClubId].facilities.academy = 3
  const f = floor.players[b.id]; f.age = 23
  ok(youthPaMargin(floor, f) === 1 && !canSecondOpinion(floor, f.id), 'a man already one point either side is not offered it: never the number')
  const old = clone(g); old.players[b.id].age = 24
  ok(!canSecondOpinion(old, b.id), 'from 24 the staff read the number anyway: nothing to offer')
  // next season, a new question (a stale stamp reads as nothing)
  const next = clone(g); next.season += 1
  ok(youthPaMargin(next, next.players[a.id]) === m0 && canSecondOpinion(next, a.id), 'next season the opinion has lapsed and may be asked again')
}

// ------------------------------------------------------------------ 3
console.log('\n--- 3. tape room night\n')
{
  const g = newGame('bedford', 'Rewarded 182', 8204)
  const me = g.clubs[g.userClubId]
  // the tape is of calls he runs: since 1.8.5 the line names only a call
  // still in his playbook (a tape of dropped calls reads tapeRetired)
  me.tactic.moveMain = 'mv_loop'
  me.tactic.moveAlt = 'mv_blind'
  playbookOf(me).faced = { mv_loop: 14, mv_blind: 3 }
  const fx = g.fixtures.find(f => f.week >= g.week && (f.homeId === me.id || f.awayId === me.id) && g.clubs[f.homeId] && g.clubs[f.awayId])!
  const opp = fx.homeId === me.id ? fx.awayId : fx.homeId
  const acc = reportAccuracy(g, opp)
  const line0 = buildReport(g, opp).lines.find(l => l.cat === 'calls')
  ok(acc < 0.55 && line0?.k === 'armsrace.tapeUnread', `a bare club's report cannot say (acc ${acc.toFixed(2)}, ${line0?.k})`)
  ok(!canTapeRoom(g, me.id), 'never on your own club')
  const expect = tapeLine(g, opp, reportAccuracy(g, opp, true))
  const rep0 = buildReport(g, opp)
  const adapt0 = JSON.stringify(adaptMap(g, opp))
  const pre = clone(g), world0 = aiClubs(g)
  ok(canTapeRoom(g, opp), 'the unread line qualifies')
  ok(noDraw(() => tapeRoomFavour(g, opp)), 'tape room night goes through')
  const rep1 = buildReport(g, opp)
  const line1 = rep1.lines.find(l => l.cat === 'calls')!
  ok(line1.k === expect?.k && line1.k !== 'armsrace.tapeUnread', `the line reads as a top setup reads it (${line1.k})`)
  ok(line1.conf === 'high', 'and says it is confident')
  const rest = (r: typeof rep0) => JSON.stringify({ ...r, lines: r.lines.filter(l => l.cat !== 'calls') })
  ok(rest(rep0) === rest(rep1), 'every other line of the report, the band and the accuracy are as they were')
  ok(JSON.stringify(adaptMap(g, opp)) === adapt0, 'the opposition coach sets up exactly as he would have: the read changes, not the rugby')
  ok(aiClubs(g) === world0, 'no AI club moved')
  ok(diffPaths(pre, g, '', [], ['rewarded']).length === 0, 'nothing else in the save moved')
  ok(!canTapeRoom(g, opp), 'once per match')
  g.week += 1
  ok(buildReport(g, opp).lines.find(l => l.cat === 'calls')?.k === 'armsrace.tapeUnread', 'and it goes with the week: the read was for that match')
  ok(canTapeRoom(g, opp), 'the next match is its own question')
}

// ------------------------------------------------------------------ 4
console.log('\n--- 4. the sponsor\'s team night\n')
{
  const userFixtureAt = (g: GameState, w: number) => g.fixtures.find(f => f.week === w && !f.played &&
    (f.homeId === g.userClubId || f.awayId === g.userClubId))
  const fit = (p: Player) => { p.injury = null; p.bans = 0; p.natSquad = false; p.onLoan = false; p.knock = undefined }
  /** roomprobe's recipe: leave the captain out of a picked side and settle the week */
  const dropCaptain = (g: GameState, minWeek = 4): PressItem | undefined => {
    let guard = 0
    while ((g.week < minWeek || !userFixtureAt(g, g.week)) && guard++ < 30) {
      for (const q of g.press) if (!q.answered) q.answered = true
      processWeekAndAdvance(g)
    }
    const club = g.clubs[g.userClubId]
    const cap = g.players[club.captain!]
    fit(cap)
    const lu = club.tactic.lineup
    if (!lu.slice(0, 15).includes(cap.id)) { const at = lu.indexOf(cap.id); if (at >= 0) lu[at] = lu[0]; lu[0] = cap.id }
    g.bonds!.xv = lu.slice(0, 15)
    const slot = lu.indexOf(cap.id)
    let bench = lu.slice(15, 23).find(id => id != null && !g.players[id!]?.injury)
    if (bench == null) { bench = club.players.find(id => !lu.includes(id) && !g.players[id]?.acad && !g.players[id]?.injury) ?? null; lu[15] = bench! }
    const bAt = lu.indexOf(bench!)
    lu[slot] = bench!; lu[bAt] = cap.id
    club.tactic.userPicked = true
    for (const q of g.press) if (!q.answered) q.answered = true
    processWeekAndAdvance(g)
    return g.press.find(q => !q.answered && roomKind(q) === 'split')
  }
  const g = newGame('leicester', 'Rewarded 182', 8205)
  const item = dropCaptain(g)
  ok(!!item, 'a split is on the office desk')
  if (item) {
    const campIds = String(item.qv?.camp ?? '').split(',').filter(Boolean).map(Number)
    ok(campIds.length > 0, `with a senior camp (${campIds.length})`)
    const plain = clone(g), night = clone(g)
    answerPress(plain, item.id, item.options.findIndex(o => o.room === 'stand'))
    const world0 = aiClubs(night)
    ok(canTeamNight(night, item.id), 'the split qualifies')
    ok(noDraw(() => teamNightFavour(night, item.id)), 'the team night goes through, and answers "stand by it"')
    const q = night.press.find(x => x.id === item.id)!
    ok(q.answered && q.options[q.options.findIndex(o => o.room === 'stand')].lk === q.alk, 'the question is answered, standing by the call')
    const drop = (h: GameState, id: number) => g.players[id].morale - h.players[id].morale
    const halved = campIds.filter(id => g.players[id].morale > 1.5)
      .every(id => Math.abs(drop(night, id) - drop(plain, id) * TEAM_NIGHT) < 1e-9)
    ok(halved && campIds.some(id => drop(plain, id) > 0), `every senior man's hit is ${TEAM_NIGHT} of what it would have been`)
    const other = diffPaths(plain, night, '', [], ['rewarded']).filter(p => !campIds.some(id => p === `players.${id}.morale`))
    ok(other.length === 0, `nothing else differs from standing by it without one: the man left out, trust, the culture (${other.join(', ')})`)
    ok(aiClubs(night) === world0, 'no AI club moved')
    // the cap: four game-weeks, whatever else is asked in between
    const craft = (h: GameState, id: number): PressItem => {
      const c = JSON.parse(JSON.stringify(item)) as PressItem
      c.id = id; c.answered = false; c.week = h.week; c.season = h.season
      delete c.alk; delete c.alv; delete c.answerLabel
      h.press.push(c)
      return c
    }
    ok(!canTeamNight(night, craft(night, item.id + 0.01).id), 'another split the same week: refused')
    for (let w = 1; w < TEAM_NIGHT_WEEKS; w++) {
      const h = clone(night); h.week += w
      ok(!canTeamNight(h, craft(h, item.id + 0.02).id), `${w} game-week${w > 1 ? 's' : ''} on: refused`)
    }
    const later = clone(night); later.week += TEAM_NIGHT_WEEKS
    ok(canTeamNight(later, craft(later, item.id + 0.03).id), `${TEAM_NIGHT_WEEKS} game-weeks on: allowed again`)
    // reverse is never softened: the team night is for standing by it
    const rev = clone(g)
    answerPress(rev, item.id, item.options.findIndex(o => o.room === 'reverse'))
    ok(!canTeamNight(rev, item.id), 'an answered question has nothing left to soften')
  }
}

// ------------------------------------------------------------------ 5
console.log('\n--- 5. the summer: seasonal ledgers go, the team night\'s four weeks do not\n')
{
  const g = newGame('northampton', 'Rewarded 182', 8206)
  const young = g.clubs[g.userClubId].players.map(id => g.players[id]!).find(p => p.age <= 20 && youthPaMargin(g, p) > 1)!
  secondOpinionFavour(g, young.id)
  const start = g.season
  let guard = 0
  while (g.season === start && guard++ < 60) {
    g.clubs[g.userClubId].boardConfidence = Math.max(70, g.clubs[g.userClubId].boardConfidence)
    for (const q of g.press) if (!q.answered) q.answered = true
    // the last week before the summer: a team night stamped here
    if (g.week >= 47 && !g.rewarded?.teamNight) (g.rewarded ??= {}).teamNight = [absWeek(g.season, g.week), -1]
    processWeekAndAdvance(g)
  }
  ok(g.season === start + 1, `the season rolled (${guard} weeks)`)
  ok(!g.rewarded?.opinion && !g.rewarded?.insideSeen && !g.rewarded?.tape, 'the seasonal ledgers went with it')
  ok(Array.isArray(g.rewarded?.teamNight), 'the team night\'s stamp did not')
  const stamp = g.rewarded!.teamNight![0]
  const gap = absWeek(g.season, g.week) - stamp
  ok(gap < TEAM_NIGHT_WEEKS, `and it still counts: ${gap} game-week${gap === 1 ? '' : 's'} since, across the summer`)
  const p = g.players[young.id]
  ok(!p || p.clubId !== g.userClubId || !g.rewarded?.opinion, 'last season\'s second opinion has lapsed')
}

// ------------------------------------------------------------------ 6
console.log('\n--- 6. a sleepwalker\'s world is the same world\n')
{
  // the same seed, one career spending every favour it can and one spending
  // none: every fixture between two AI clubs finishes the same
  const run = (spend: boolean) => {
    const g = newGame('bedford', 'Rewarded 182', 8207)
    playbookOf(g.clubs[g.userClubId]).faced = { mv_loop: 14, mv_blind: 3 }
    for (let w = 0; w < 8; w++) {
      if (spend) {
        for (const p of Object.values(g.players)) if (canInsideWord(g, p.id)) insideWordFavour(g, p.id)
        for (const id of g.clubs[g.userClubId].players) if (canSecondOpinion(g, id)) secondOpinionFavour(g, id)
        for (const c of Object.keys(g.clubs)) if (canTapeRoom(g, c)) { tapeRoomFavour(g, c); break }
      }
      for (const q of g.press) if (!q.answered) q.answered = true
      processWeekAndAdvance(g)
    }
    return g
  }
  const A = run(true), B = run(false)
  const aiFx = (g: GameState) => g.fixtures.filter(f => f.played && f.homeId !== g.userClubId && f.awayId !== g.userClubId)
    .map(f => `${f.id}:${f.homeScore}-${f.awayScore}`).join('|')
  ok(!!A.rewarded && Object.keys(A.rewarded).length > 0, `the spending career spent (${Object.keys(A.rewarded ?? {}).join(', ')})`)
  ok(aiFx(A) === aiFx(B) && aiFx(A).length > 0, 'every AI-vs-AI result is identical')
  ok(diffPaths(A, B, '', [], ['rewarded']).length === 0,
    `and eight weeks on, the two saves differ in the ledger alone (${diffPaths(A, B, '', [], ['rewarded']).slice(0, 6).join(', ')})`)
}

if (fails) { console.error(`\nREWARDED 1.8.2 PROBE FAILED (${fails})`); process.exit(1) }
console.log('\nREWARDED 1.8.2 PROBE PASSED: four more favours, each a fee or a wait replaced, on a leash')
