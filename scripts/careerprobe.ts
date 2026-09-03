/**
 * CAREER PROBE - the v1.2.7 asks, at the engine.
 *
 * Owner: "in v1.2.7 lets fix these" - release a player, a form and injury
 * record, saved plans, a depth chart, confirmations, sacking staff and a
 * difficulty setting. The screens are checked in the browser harnesses; this
 * is the part underneath them, run on a seeded career so it is the same
 * career every time:
 *
 *   1. difficulty is three levers on the manager's club and nothing else -
 *      'normal' is byte-for-byte the career that existed before it
 *   2. releasing a player pays off half the contract, frees him, and refuses
 *      for exactly the reasons the button names
 *   3. sacking a coach empties the seat for eight weeks' wages
 *   4. every match writes a rating into the ten-match record, and every
 *      injury writes into the log, so the player screen has something true
 *      to show
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { DIFFICULTIES, difficultyOf } from '../src/game/difficulty'
import { RELEASE_FLOOR, releaseBlock, releaseCost, releasePlayer } from '../src/game/release'
import { appointStaff, sackCost, sackStaff, staffCandidates } from '../src/game/staff'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, msg: string) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fails++ }
const say = (s: string) => console.log(s)

// ---- 1. difficulty ----
say('\n--- 1. difficulty pulls three levers on one club')
{
  const plain = newGame('northampton', 'Probe', 9001)
  const normal = newGame('northampton', 'Probe', 9001, undefined, 'coach', 'normal')
  const legend = newGame('northampton', 'Probe', 9001, undefined, 'coach', 'legend')
  const strip = (g: GameState) => JSON.stringify({ ...g, difficulty: undefined })
  ok(strip(plain) === strip(normal), "'normal' is the career exactly as it was without the setting")
  ok(plain.difficulty === 'normal', `a career that never chose reads as normal (${plain.difficulty})`)
  const u = 'northampton'
  ok(legend.clubs[u].balance === Math.round(normal.clubs[u].balance * 0.45),
    `legend starts with 45% of the money (${legend.clubs[u].balance} of ${normal.clubs[u].balance})`)
  const others = Object.keys(normal.clubs).filter(id => id !== u)
  const untouched = others.every(id => normal.clubs[id].balance === legend.clubs[id].balance && normal.clubs[id].wageBudget === legend.clubs[id].wageBudget)
  ok(untouched, `and the other ${others.length} clubs are not touched by it`)
  ok(difficultyOf({}).injury === 1 && difficultyOf({}).board === 0 && difficultyOf({}).cash === 1,
    'a save with no difficulty field is factor one everywhere')
  ok(DIFFICULTIES.every(d => d.cash > 0 && d.cash <= 1 && d.injury >= 1 && d.board >= 0),
    'every level makes life harder, never easier, than normal')
}

// ---- 2. release ----
say('\n--- 2. releasing a player')
{
  const g = newGame('northampton', 'Probe', 9002)
  const club = g.clubs[g.userClubId]
  const seniors = () => club.players.map(id => g.players[id]).filter(p => p && !p.acad)
  const xv = new Set(club.tactic.lineup.slice(0, 15))
  const victim = seniors().filter(p => !xv.has(p.id) && !p.loanFrom).sort((a, b) => a.ca - b.ca)[0]
  ok(!!victim, `there is a senior outside the XV to release (${victim?.name})`)
  const cost = releaseCost(g, victim.id)
  ok(cost > 0 && cost <= victim.wage * 46 * 3, `the pay-off is half the contract, in the right order of magnitude (${cost} on ${victim.wage}/wk to season ${victim.contractEnds})`)
  ok(releaseBlock(g, victim.id) === null, 'nothing blocks releasing him')
  const before = club.balance
  const n0 = seniors().length
  const wage0 = victim.wage
  const r = releasePlayer(g, victim.id)
  ok(r.ok && r.k === 'player.releasedMsg', `the release goes through (${r.k})`)
  ok(victim.clubId === null && !club.players.includes(victim.id), 'he is a free agent and off the club list')
  ok(!club.tactic.lineup.includes(victim.id), 'and out of the team sheet')
  ok(club.balance === before - cost, `the club paid exactly the pay-off (${before} -> ${club.balance})`)
  ok(victim.wage === Math.round(wage0 * 0.7), 'a released man settles for 30% less, like every AI release')
  ok(g.news.some(n => n.k === 'news.released' && n.v?.name === victim.name), 'the inbox carries the story under its key')
  ok(seniors().length === n0 - 1, 'one fewer senior')

  // the refusals
  ok(releaseBlock(g, victim.id) === 'notYours', 'he cannot be released twice')
  const other = seniors().find(p => !xv.has(p.id))!
  const savedLoan = other.loanFrom
  other.loanFrom = 'leicester'
  ok(releaseBlock(g, other.id) === 'onLoanIn', 'a man here on loan cannot be released')
  other.loanFrom = savedLoan
  const bal = club.balance
  club.balance = 0
  ok(releaseBlock(g, other.id) === 'noMoney', 'a club that cannot pay is refused')
  club.balance = bal
  // cut the squad to the floor and the next one is refused
  let guard = 0
  while (seniors().length > RELEASE_FLOOR && guard++ < 40) {
    const p = seniors().find(q => !q.loanFrom)!
    club.balance = 1e9
    releasePlayer(g, p.id)
  }
  ok(seniors().length === RELEASE_FLOOR, `the squad can be cut to the floor of ${RELEASE_FLOOR}`)
  const last = seniors()[0]
  ok(releaseBlock(g, last.id) === 'floor', 'and not one man below it')
  const refused = releasePlayer(g, last.id)
  ok(!refused.ok && refused.k === 'player.releaseFloor', `the refusal names the floor (${refused.k})`)
}

// ---- 3. sack ----
say('\n--- 3. sacking a coach')
{
  const g = newGame('northampton', 'Probe', 9003)
  const club = g.clubs[g.userClubId]
  const role = 'physio' as const
  if (!g.staffPeople?.[role]) {
    club.balance = 50_000_000
    const cands = staffCandidates(g, role)
    appointStaff(g, role, 0)
    ok(!!g.staffPeople?.[role], `a physio is appointed first (${cands[0]?.name})`)
  }
  const person = g.staffPeople![role]!
  const cost = sackCost(g, role)
  ok(cost === Math.round(person.wage * 8 / 500) * 500, `the pay-off is eight weeks of his wage (${cost} on ${person.wage})`)
  const before = club.balance
  const line = sackStaff(g, role)
  ok(typeof line === 'string' && line.includes(person.name), `the screen gets a line naming him (${line})`)
  ok(g.staff[role] === 0, 'the role is back to level 0')
  ok(!g.staffPeople?.[role], 'and the seat is empty')
  ok(club.balance === before - cost, 'the club paid the pay-off')
  ok(g.news.some(n => n.k === 'news.staffSacked'), 'the inbox carries the story')
  club.balance = 0
  const again = sackStaff(g, role)
  ok(!g.news.filter(n => n.k === 'news.staffSacked')[1], `an empty seat cannot be sacked again (${again})`)
}

// ---- 4. the record ----
say('\n--- 4. ratings and injuries are logged as they happen')
{
  const g = newGame('northampton', 'Probe', 9004)
  for (let i = 0; i < 8; i++) processWeekAndAdvance(g)
  const all = Object.values(g.players)
  const rated = all.filter(p => (p.ratings?.length ?? 0) > 0)
  ok(rated.length > 200, `${rated.length} players carry a rating record after eight weeks`)
  ok(rated.every(p => p.ratings!.length <= 10), 'no record is longer than ten')
  ok(rated.every(p => p.ratings!.every(r => r >= 1 && r <= 10)), 'every rating is on the 1-10 scale')
  const mine = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => (p.ratings?.length ?? 0) > 0)
  ok(mine.length >= 15, `${mine.length} of the manager's own men have one, so the screen has something to show`)
  ok(mine.every(p => p.lastR != null && Math.abs(p.ratings![p.ratings!.length - 1] - p.lastR) < 0.06),
    'the newest entry is the rating the form pill already shows')
  const hurt = all.filter(p => p.injury)
  ok(hurt.length > 0, `${hurt.length} players are injured somewhere in the world`)
  ok(hurt.every(p => (p.injLog?.length ?? 0) > 0), 'every one of them has the injury in his log')
  ok(hurt.every(p => p.injLog![p.injLog!.length - 1].dk === (p.injury!.dk ?? p.injLog![p.injLog!.length - 1].dk)),
    'and the newest log entry is the injury he is carrying')
  ok(all.every(p => (p.injLog ?? []).every(e => e.weeks >= 1 && typeof e.dk === 'string' && e.s >= 0 && e.w >= 1)),
    'every log entry has a season, a week, a complaint and a length')
}

console.log(fails === 0
  ? '\nCAREER PROBE PASSED: release, sack, difficulty and the record all hold at the engine'
  : `\nCAREER PROBE FAILED (${fails})`)
process.exit(fails === 0 ? 0 : 1)
