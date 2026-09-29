// Probe: the dressing room makes selection consequential, and the office's
// hard calls are honest about what they cost (1.8.2, src/game/room.ts).
//
//   1. dropping a popular senior splits the room along the bonds ledger: the
//      senior men and his close friends unhappy, the young ones out of it
//   2. the vice-captain backs you or not, for reasons that are his
//   3. stand by it and reverse it do different, bounded things
//   4. the culture drifts the way the calls push it, is felt (talk-back,
//      discipline, a story) and is exactly neutral until the first call
//   5. a sleepwalker is never asked about the assistant's team sheet
//   6. renew now or wait: the question states both costs, renew signs at the
//      quoted figure, waiting can lose him, and the loss comes back as a story
//   7. the final week of an injury: an early return makes him available and
//      carries a flare-up risk that resting does not
//   8. the academy decision offers a season on loan, and the loan happens
//   9. every answer is in the manager's memory
//  10. saves: an old save has no ledger, a damaged one is healed or dropped
//  11. six languages answer every key the office asks
//
// Run: npx vite-node scripts/roomprobe.ts
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { answerPress } from '../src/game/media'
import { migrate } from '../src/game/save'
import { nudgeBond, bondOf } from '../src/game/bonds'
import { flareChance } from '../src/game/knock'
import { renewalDemand } from '../src/game/ai'
import { ACAD_CALL_WEEK, academyCalls } from '../src/game/acadcall'
import { authorityEdge, cultureLean, demands, resentment } from '../src/game/culture'
import {
  DRIFT, PREMIUM, deputyBacks, migrateRoom, roomKind, roomOf, roomTidy, roomWeek, renewNowWage, seniorCamp,
} from '../src/game/room'
import { recall } from '../src/game/memory'
import type { GameState, Player, PressItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const clone = (g: GameState): GameState => JSON.parse(JSON.stringify(g))
const userFixtureAt = (g: GameState, w: number) => g.fixtures.find(f => f.week === w && !f.played &&
  (f.homeId === g.userClubId || f.awayId === g.userClubId))
const roomItems = (g: GameState, kind?: string) => g.press.filter(q => !q.answered && roomKind(q) != null && (!kind || roomKind(q) === kind))
const seniorsOf = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
const fit = (p: Player) => { p.injury = null; p.bans = 0; p.natSquad = false; p.onLoan = false; p.knock = undefined }

/** Play on until the user's club has a match in the week about to be settled. */
function toMatchWeek(g: GameState, minWeek = 4) {
  let guard = 0
  while ((g.week < minWeek || !userFixtureAt(g, g.week)) && guard++ < 30) {
    for (const q of g.press) if (!q.answered) q.answered = true
    processWeekAndAdvance(g)
  }
}

/** Leave the captain out of a sheet the manager picked, and settle the week. */
function dropCaptain(seed: number, tweak?: (g: GameState, cap: Player) => void): { g: GameState; item?: PressItem; cap: Player } {
  const g = newGame('leicester', 'Room Probe', seed)
  toMatchWeek(g)
  const club = g.clubs[g.userClubId]
  const cap = g.players[club.captain!]
  fit(cap)
  const lu = club.tactic.lineup
  if (!lu.slice(0, 15).includes(cap.id)) {
    const at = lu.indexOf(cap.id)
    if (at >= 0) lu[at] = lu[0]
    lu[0] = cap.id
  }
  g.bonds!.xv = lu.slice(0, 15)
  // swap him for a fit man off the bench
  const slot = lu.indexOf(cap.id)
  let bench = lu.slice(15, 23).find(id => id != null && !g.players[id!]?.injury)
  if (bench == null) {
    bench = club.players.find(id => !lu.includes(id) && !g.players[id]?.acad && !g.players[id]?.injury) ?? null
    lu[15] = bench!
  }
  const bAt = lu.indexOf(bench!)
  lu[slot] = bench!
  lu[bAt] = cap.id
  club.tactic.userPicked = true
  for (const q of g.press) if (!q.answered) q.answered = true
  tweak?.(g, cap)
  processWeekAndAdvance(g)
  return { g, item: roomItems(g, 'split')[0], cap }
}

console.log('\n--- 1. dropping a popular senior splits the room, along the bonds ledger\n')
let base: ReturnType<typeof dropCaptain> | null = null
{
  let friend: Player | undefined, kid: Player | undefined
  const r = dropCaptain(2024, (g, cap) => {
    const men = seniorsOf(g).filter(p => p.id !== cap.id && p.id !== g.clubs[g.userClubId].vice)
    friend = men.find(p => p.age >= 23 && p.age <= 26)
    kid = men.find(p => p.age <= 22)
    if (friend) nudgeBond(g, friend.id, cap.id, 70)
    if (kid) nudgeBond(g, kid.id, cap.id, 70)
  })
  base = r
  const { g, item, cap } = r
  ok(!!item, `leaving the captain (${cap.name}) out of a picked side puts a split on the office desk`)
  if (item) {
    ok(item.qk === 'room.splitCapQ' && item.playerId === cap.id, 'it is about him, and it says he is the captain')
    ok(item.options.length === 2 && item.options[0].room === 'stand' && item.options[1].room === 'reverse',
      'two answers: stand by it, or reverse it')
    const camp = String(item.qv?.camp ?? '').split(',').filter(Boolean).map(Number).map(id => g.players[id])
    ok(camp.length > 0, `the senior camp is named (${camp.length} men)`)
    ok(camp.every(p => p && p.age > 22), 'nobody of 22 or under is in it: the youngsters stay neutral')
    if (friend) ok(camp.some(p => p.id === friend!.id), `his close friend of ${friend.age} is in it (bond ${bondOf(g, friend.id, cap.id).toFixed(0)})`)
    if (kid) ok(!camp.some(p => p.id === kid!.id), `his close friend of ${kid.age} is not: young men keep out of it`)
    ok(typeof item.qv?.dep_k === 'string' && /^room\.dep(Backs|Against|None)/.test(String(item.qv.dep_k)),
      `the vice-captain's stance is in the question (${item.qv?.dep_k})`)
    ok(!/\d/.test(item.question.replace(cap.name, '').replace(String(g.players[Number(item.qv?.did)]?.name ?? ''), '')),
      'and no number is shown')
  }
  // the same squad with the captain in the side is never asked
  const calm = newGame('leicester', 'Room Probe', 2024)
  toMatchWeek(calm)
  calm.clubs[calm.userClubId].tactic.userPicked = true
  calm.bonds!.xv = calm.clubs[calm.userClubId].tactic.lineup.slice(0, 15)
  processWeekAndAdvance(calm)
  ok(roomItems(calm, 'split').length === 0, 'the same week with nobody dropped asks nothing')
}

console.log('\n--- 2. the deputy backs you, or does not, for reasons that are his\n')
{
  const g = base!.g
  const club = g.clubs[g.userClubId]
  const [a, b] = seniorsOf(g).filter(p => p.id !== club.captain).slice(0, 2)
  const dep = clone(g).players[a.id]
  const h = clone(g)
  const d = h.players[a.id], x = h.players[b.id]
  d.pers = 'Professional'; h.mgrTrust = 60
  ok(deputyBacks(h, d, x), 'a Professional deputy in a room that trusts the manager backs him')
  d.pers = 'Temperamental'; h.mgrTrust = 30
  nudgeBond(h, d.id, x.id, 90)
  ok(!deputyBacks(h, d, x), 'a Temperamental deputy who is close to the dropped man does not')
  ok(deputyBacks(h, d, x, d), 'but the man who took the shirt always backs the call')
  void dep
}

console.log('\n--- 3. stand by it, or reverse it\n')
{
  const { g, item, cap } = base!
  if (item) {
    const S = clone(g), R = clone(g)
    const campIds = String(item.qv?.camp ?? '').split(',').filter(Boolean).map(Number)
    const trust0 = g.mgrTrust ?? 30
    answerPress(S, item.id, 0)
    answerPress(R, item.id, 1)
    const campS = mean(campIds.map(id => S.players[id].morale)), campR = mean(campIds.map(id => R.players[id].morale))
    ok(campS < campR, `the senior camp is unhappier when you stand by it (${campS.toFixed(2)} vs ${campR.toFixed(2)})`)
    ok(S.players[cap.id].morale < R.players[cap.id].morale, 'and so is the man left out')
    ok((S.mgrTrust ?? 30) > trust0 && (R.mgrTrust ?? 30) < trust0,
      `standing by it firms up the room's trust in the manager, reversing it costs some (${trust0} -> ${S.mgrTrust} / ${R.mgrTrust})`)
    ok(R.clubs[R.userClubId].tactic.lineup.slice(0, 15).includes(cap.id), 'reversed, he is back in the starting XV')
    ok(!S.clubs[S.userClubId].tactic.lineup.slice(0, 15).includes(cap.id), 'stood by, he is not')
    const moved = Math.max(...campIds.map(id => Math.abs(S.players[id].morale - g.players[id].morale)))
    ok(moved <= 0.35, `bounded: no senior moves more than a third of a point on the answer (${moved.toFixed(2)})`)
    ok(Math.abs((S.mgrTrust ?? 30) - trust0) <= 5 && Math.abs((R.mgrTrust ?? 30) - trust0) <= 5, 'and trust moves by a few points at most')
    ok(S.press.find(q => q.id === item.id)?.rk?.startsWith('room.standR') === true &&
       R.press.find(q => q.id === item.id)?.rk?.startsWith('room.reverseR') === true, 'each answer prints its own reaction')
    ok(recall(S, { kind: 'room-stood', playerId: cap.id }).length === 1 && recall(R, { kind: 'room-reversed', playerId: cap.id }).length === 1,
      'and each is written into the manager\'s memory')
    // culture
    ok(cultureLean(S) > 0 && cultureLean(R) < 0, `the culture leans the way the call pushed it (${cultureLean(S).toFixed(2)} / ${cultureLean(R).toFixed(2)})`)
  }
}

console.log('\n--- 4. the culture: drifts, is felt, and is neutral until the first call\n')
{
  const fresh = newGame('bath', 'Culture', 77)
  ok(cultureLean(fresh) === 0 && resentment(fresh) === 1 && demands(fresh) === 1 && authorityEdge(fresh) === 0,
    'a club nobody has made a call at is exactly neutral: every factor is 1 (or 0)')
  const led = clone(fresh), pl = clone(fresh)
  roomOf(led).c = 0; roomOf(pl).c = 0
  for (let i = 0; i < 4; i++) { roomOf(led).c += DRIFT; roomOf(pl).c -= DRIFT }
  ok(cultureLean(led) >= 0.4 && cultureLean(pl) <= -0.4, 'four calls one way take the culture past the point the room talks about it')
  ok(resentment(led) > 1 && authorityEdge(led) > 0 && demands(led) === 1,
    'manager-led: firmer authority and more resentment, no extra demands')
  ok(demands(pl) > 1 && authorityEdge(pl) < 0 && resentment(pl) === 1,
    'player-led: softer authority and more knocks at the door, no extra resentment')
  ok(resentment(led) <= 1.6 && demands(pl) <= 1.5 && Math.abs(authorityEdge(led)) <= 0.15, 'all of it bounded')
  // felt through a story, once
  const n0 = led.news.length, p0 = pl.news.length
  roomWeek(led); roomWeek(pl)
  ok(led.news.slice(n0).some(n => n.k === 'room.cultureLed'), 'the manager\'s room is a story')
  ok(pl.news.slice(p0).some(n => n.k === 'room.culturePlayers'), 'and so is the players\' room')
  const n1 = led.news.length
  roomWeek(led)
  ok(!led.news.slice(n1).some(n => n.k === 'room.cultureLed'), 'told once, not every week')
  ok(led.nextId === fresh.nextId, 'and the stories spend no ids (held news)')
  // a player-led room is a happier one, slowly
  const low = seniorsOf(pl).slice(0, 5)
  for (const p of low) p.morale = 4
  const before = mean(low.map(p => p.morale))
  roomWeek(pl)
  const after = mean(low.map(p => p.morale))
  ok(after > before && after - before < 0.05, `a player-led room lifts its unhappy men a touch each week (+${(after - before).toFixed(3)})`)
  // the summer cools it
  const c0 = roomOf(led).c
  led.season += 1
  roomWeek(led)
  ok(Math.abs(roomOf(led).c) < Math.abs(c0), `the summer cools the culture (${c0} -> ${roomOf(led).c})`)
  // a new job is a new culture
  const moved = clone(fresh)
  roomOf(moved).c = 60
  moved.userClubId = Object.keys(moved.clubs).find(id => id !== moved.userClubId)!
  ok(cultureLean(moved) === 0, 'a new club starts neutral')
}

console.log('\n--- 5. the sleepwalker is never asked about the assistant\'s team sheet\n')
{
  const g = newGame('saracens', 'Sleepwalker', 31)
  let splits = 0
  for (let w = 0; w < 30; w++) {
    processWeekAndAdvance(g)
    splits += g.press.filter(q => roomKind(q) === 'split').length
    for (const q of g.press) if (!q.answered && roomKind(q) != null) q.answered = true
  }
  ok(splits === 0, `thirty weeks of an auto-picked side: no split asked (${splits})`)
  ok(cultureLean(g) === 0, 'and the culture has not moved')
}

console.log('\n--- 6. renew now, or wait\n')
{
  const g = newGame('leicester', 'Renewal', 505)
  while (g.week < 12) { for (const q of g.press) if (!q.answered) q.answered = true; processWeekAndAdvance(g) }
  const club = g.clubs[g.userClubId]
  const star = seniorsOf(g).filter(p => p.age <= 31).sort((a, b) => b.ca - a.ca)[0]
  star.contractEnds = g.season
  star.renewedSeason = undefined
  g.preContracts = (g.preContracts ?? []).filter(pc => pc.playerId !== star.id)
  for (const q of g.press) if (!q.answered) q.answered = true
  roomTidy(g)
  roomWeek(g)
  const item = roomItems(g, 'renew')[0]
  ok(!!item && item.playerId === star.id, `a first-teamer in his last year gets the question (${star.name})`)
  if (item) {
    ok(/costs more than the asking wage/.test(item.question) && /pre-contract/.test(item.question),
      'it states both sides: renewing now costs more, waiting risks a pre-contract')
    const quoted = item.options[0].roomWage!
    ok(quoted === renewNowWage(star) && quoted > renewalDemand(star),
      `renew now quotes a premium on his asking (${quoted} over ${renewalDemand(star)}, x${PREMIUM})`)
    ok(!/\d/.test(item.options[1].label), 'waiting shows no number')
    const R = clone(g), W = clone(g)
    answerPress(R, item.id, 0)
    const rs = R.players[star.id]
    const signed = rs.renewedSeason === R.season
    ok(signed ? rs.wage === quoted && rs.contractEnds > R.season : /room\.renewBlocked/.test(R.press.find(q => q.id === item.id)?.rk ?? ''),
      signed ? `renewed: on the quoted wage, and past this summer (to ${2026 + rs.contractEnds})` : 'or blocked, with the reason said')
    if (signed) ok(recall(R, { kind: 'renew-early', playerId: star.id }).length === 1, 'renewal remembered')
    answerPress(W, item.id, 1)
    ok(recall(W, { kind: 'renew-waited', playerId: star.id }).length === 1 && roomOf(W).w.some(x => x.p === star.id),
      'waiting remembered, and he is on the list of men you waited on')
    // how often waiting costs him, over many worlds' dice
    let lost = 0, told = 0
    const trials = 40
    for (let i = 0; i < trials; i++) {
      const t = clone(W)
      t.seed = 1000 + i * 7919
      t.preContracts = []
      for (let w = 25; w <= 38; w++) {
        t.week = w
        roomWeek(t)
        for (const q of t.press) if (!q.answered) q.answered = true
      }
      if ((t.preContracts ?? []).some(pc => pc.playerId === star.id)) lost++
      if (t.news.some(n => n.k === 'room.waitLost' && n.playerId === star.id)) told++
    }
    ok(lost > 0 && lost < trials, `waiting is a risk, not a certainty: lost in ${lost} of ${trials} worlds`)
    ok(told === lost, 'and every loss comes back as a story naming the wait')
    // renewed, never lost this way
    if (signed) {
      const t = clone(R)
      t.preContracts = []
      for (let w = 25; w <= 38; w++) { t.week = w; roomWeek(t) }
      ok(!(t.preContracts ?? []).some(pc => pc.playerId === star.id), 'a man renewed is never lost to the wait')
    }
    void club
  }
}

console.log('\n--- 7. the final week of an injury: rest, or bring him back early\n')
{
  const g = newGame('bristol', 'Physio', 919)
  let guard = 0
  while ((g.week < 5 || !userFixtureAt(g, g.week + 1)) && guard++ < 30) {
    for (const q of g.press) if (!q.answered) q.answered = true
    processWeekAndAdvance(g)
  }
  for (const q of g.press) if (!q.answered) q.answered = true
  const club = g.clubs[g.userClubId]
  const p = g.players[club.tactic.lineup[3]!]
  p.injury = { desc: 'hamstring strain', dk: 'injury.hamstring', until: g.week + 2, weeks: 4 }
  p.stats.starts = Math.max(3, p.stats.starts)
  roomTidy(g)
  roomWeek(g)
  const item = roomItems(g, 'injury')[0]
  ok(!!item && item.playerId === p.id, `a regular a week from fit is brought to the office (${p.name})`)
  if (item) {
    ok(item.options[0].room === 'rest' && item.options[1].room === 'early', 'rest first, the early return second')
    ok(/could go again/.test(item.question) && !/\d/.test(item.question.split(p.name).join('')), 'the risk is said in words, not as a number')
    // the manager answers next week
    g.week += 1
    const E = clone(g), S = clone(g)
    answerPress(E, item.id, 1)
    answerPress(S, item.id, 0)
    const e = E.players[p.id], s = S.players[p.id]
    ok(!e.injury && !!e.knock, 'brought back: available for selection this week, carrying a knock')
    ok(!!s.injury && !s.knock, 'rested: still with the physio')
    ok(e.knock ? flareChance(e.knock.early) > 0 : false, `and the early return carries a flare-up risk (${e.knock ? Math.round(flareChance(e.knock.early) * 100) : 0} in 100 a match) that resting does not`)
    ok(recall(E, { kind: 'rushed-back', playerId: p.id }).length === 1 && recall(S, { kind: 'rested', playerId: p.id }).length === 1,
      'both answers remembered')
    // a head injury is never offered
    const h = clone(g)
    for (const q of h.press) if (!q.answered) q.answered = true
    h.week -= 1
    const hp = h.players[p.id]
    hp.injury = { desc: 'concussion', dk: 'injury.concussion', until: h.week + 2, weeks: 3 }
    hp.knock = undefined
    h.room!.asked = []
    roomTidy(h)
    roomWeek(h)
    ok(!roomItems(h, 'injury').some(q => q.playerId === hp.id), 'a concussion is never offered')
  }
}

console.log('\n--- 8. the academy decision: keep, loan, or release\n')
{
  const g = newGame('leicester', 'Academy', 5151)
  const club = g.clubs[g.userClubId]
  const lad = club.players.map(id => g.players[id]).find(p => p && p.acad && !p.demoted && p.age < 20)!
  lad.age = 20
  g.week = ACAD_CALL_WEEK
  academyCalls(g)
  const q = g.press.find(x => !x.answered && x.playerId === lad.id && x.options.some(o => o.acad))
  ok(!!q && q.options.length === 3 && q.options.some(o => o.acad === 'loan'), 'the call has three answers, one of them a season on loan')
  if (q) {
    const i = q.options.findIndex(o => o.acad === 'loan')
    ok(/out of your hands/.test(q.options[i].label) && /minutes elsewhere/.test(q.options[i].label), 'and the loan says what it trades: minutes for control')
    answerPress(g, q.id, i)
    ok(!lad.acad && lad.clubId === g.userClubId && lad.wage === q.options[i].acadWage, 'a gate lad on loan is signed as a professional, on the quoted wage')
    ok(roomOf(g).ln.some(x => x.p === lad.id && x.s === g.season + 1), 'and is down to go out next season')
    ok(recall(g, { kind: 'acad-loaned', playerId: lad.id }).length === 1, 'remembered')
    g.season += 1
    g.week = 1
    roomWeek(g)
    ok(lad.onLoan === true && !club.tactic.lineup.includes(lad.id), 'in the first week of the new season he goes out on loan')
  }
}

console.log('\n--- 9. saves\n')
{
  ok(migrateRoom(undefined) === undefined && migrateRoom('junk') === undefined && migrateRoom([]) === undefined,
    'nothing, junk or a list migrates to no ledger')
  const healed = migrateRoom({ club: 'bath', c: 9999, band: 7, s: 'x', w: [{ p: 1, s: 1 }, { p: 'a' }, null], ln: 'x', asked: [1, 's:4'] })!
  ok(!!healed && healed.c === 100 && healed.band === 1 && healed.w.length === 1 && healed.ln.length === 0 && healed.asked.length === 1,
    'a damaged ledger is clamped and filtered, not thrown')
  const g = newGame('exeter', 'Save', 42)
  const old = clone(g)
  delete (old as Partial<GameState>).room
  const m = migrate(old)
  ok(m.room === undefined && cultureLean(m) === 0, 'an old save loads with no ledger and a neutral culture')
  processWeekAndAdvance(m)
  ok(!!m.room && m.room.club === m.userClubId, 'and the first week starts one')
  const bad = clone(m) as unknown as Record<string, unknown>
  bad.room = { club: 5 }
  const mb = migrate(bad as unknown as GameState)
  ok(mb.room === undefined, 'a ledger with no club is dropped')
  const rt = migrate(clone(base!.g))
  ok(JSON.stringify(rt.room) === JSON.stringify(base!.g.room), 'a live ledger survives a save and a load unchanged')
}

console.log('\n--- 10. six languages\n')
{
  const src = readFileSync('src/game/room.ts', 'utf8') + readFileSync('src/game/acadcall.ts', 'utf8')
  const keys = new Set([...src.matchAll(/'(room\.[A-Za-z]+)'/g)].map(m => m[1]))
  for (const b of ['room.standR', 'room.reverseR']) for (const s of ['', 'Led', 'Players']) keys.add(b + s)
  for (const k of ['room.depBacksVice', 'room.depBacksCap', 'room.depAgainstVice', 'room.depAgainstCap', 'room.waitLostSubj', 'room.cultureLedSubj', 'room.culturePlayersSubj', 'room.acadLoanR', 'room.acadLoanProR']) keys.add(k)
  const langs = ['en', 'fr', 'es', 'it', 'af', 'ja']
  const dicts = Object.fromEntries(langs.map(l => [l, JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8')).room as Record<string, string>]))
  const missing: string[] = []
  for (const k of keys) {
    const leaf = k.slice(5)
    for (const l of langs) if (typeof dicts[l]?.[leaf] !== 'string') missing.push(`${l}:${k}`)
  }
  ok(keys.size >= 40, `the office asks ${keys.size} room keys`)
  ok(missing.length === 0, `and every language answers each${missing.length ? `: missing ${missing.slice(0, 6).join(', ')}` : ''}`)
  const en = Object.values(dicts.en).join(' ')
  ok(!/—|–/.test(en) && !/[\u{1F300}-\u{1FAFF}]/u.test(en), 'no dashes of the long kind, no emoji')
  const fr = Object.values(dicts.fr)
  ok(fr.every(v => !/ [:;!?]/.test(v)), 'French punctuation is held to its sentence by a non-breaking space')
}

console.log(fails ? `\nROOM PROBE FAILED: ${fails}` : '\nROOM PROBE PASSED: the room takes sides, every call costs something, and the culture remembers')
if (fails) process.exit(1)
